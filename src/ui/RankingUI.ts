import { UIManager } from '../core/ui/UIManager';
import { ApiUtils } from '../core/utils/ApiUtils';
import { DJClassSystem } from '../core/progression/DJClassSystem';
import { AuthService } from '../services/auth/AuthService';

export interface LeaderboardEntry {
    display_name: string;
    avatar_url?: string;
    score: number;
    max_streak?: number;
    play_count?: number;
    current_streak?: number;
    total_notes_hit?: number;
    level?: number;
    accuracy?: number;
    timestamp: string;
}

export class RankingUI {
    private ui: UIManager;
    private onClose: () => void;
    private currentType: string = 'score'; // score, combo, plays, level, songs
    private currentCategory: 'user' | 'song' = 'user';
    private currentSongId?: string;

    constructor(onClose: () => void) {
        this.ui = UIManager.getInstance();
        this.onClose = onClose;
    }

    public async show(songId?: string): Promise<void> {
        this.currentSongId = songId;
        
        // If showing ranking for a specific song, default to 'user' category
        if (songId) {
            this.currentCategory = 'user';
            this.currentType = 'score';
        } else if (this.currentCategory === 'song') {
            this.currentType = 'songs';
        }

        const data = await this.fetchRanking(songId, this.currentType);
        this.render(data);
    }

    private render(data: LeaderboardEntry[]) {
        const themeCyan = '#00ffff';
        
        const styles = `
            <style>
                .ranking-overlay {
                    position: fixed; inset: 0; background: rgba(0,0,0,0.4);
                    display: flex; align-items: center; justify-content: center;
                    z-index: 1500; 
                    animation: mm-fadeIn 0.3s ease-out;
                    backdrop-filter: blur(10px);
                }
                .ranking-modal {
                    width: clamp(380px, 90vw, 900px);
                    height: 85vh;
                    background: rgba(10, 15, 15, 0.7);
                    border: 2px solid ${themeCyan};
                    border-radius: 20px;
                    display: flex; flex-direction: column;
                    box-shadow: 0 0 50px rgba(0, 255, 255, 0.2), inset 0 0 20px rgba(0, 255, 255, 0.1);
                    overflow: hidden;
                    font-family: 'Outfit', sans-serif;
                    position: relative;
                }
                .ranking-header {
                    padding: 25px 40px;
                    background: linear-gradient(180deg, rgba(0, 255, 255, 0.1), transparent);
                    border-bottom: 1px solid rgba(0, 255, 255, 0.2);
                    display: flex; justify-content: space-between; align-items: center;
                }
                .ranking-title-area { display: flex; align-items: center; gap: 25px; }
                .ranking-title-group h2 { margin: 0; font-size: 2.2rem; font-weight: 950; color: #fff; text-shadow: 0 0 15px ${themeCyan}; letter-spacing: -1px; }
                .ranking-subtitle { font-family: 'Goldman', cursive; font-size: 0.7rem; color: ${themeCyan}; letter-spacing: 4px; text-transform: uppercase; margin-bottom: 4px; opacity: 0.8; }
                
                .category-switcher {
                    display: flex; background: rgba(0,0,0,0.4); border-radius: 30px; padding: 4px; border: 1px solid rgba(0, 255, 255, 0.2);
                }
                .category-btn {
                    padding: 6px 20px; font-family: 'Goldman'; font-size: 0.8rem; border-radius: 20px; cursor: pointer; transition: 0.3s;
                    color: rgba(255,255,255,0.4);
                }
                .category-btn.active { background: ${themeCyan}; color: #000; box-shadow: 0 0 10px ${themeCyan}; }

                .ranking-tabs {
                    display: flex; gap: 10px; padding: 15px 40px; background: rgba(0,0,0,0.3);
                }
                .rank-tab {
                    padding: 8px 20px; font-family: 'Goldman', cursive; font-size: 0.75rem; 
                    color: rgba(255,255,255,0.4); cursor: pointer; transition: 0.2s;
                    border: 1px solid transparent; border-radius: 6px; text-transform: uppercase;
                }
                .rank-tab:hover { color: #fff; background: rgba(255,255,255,0.05); }
                .rank-tab.active { 
                    color: #000; background: ${themeCyan}; font-weight: 900;
                    box-shadow: 0 0 15px ${themeCyan}; border-color: #fff;
                }

                .ranking-list {
                    flex: 1; overflow-y: auto; padding: 20px 40px;
                    display: flex; flex-direction: column; gap: 8px;
                }
                .ranking-list::-webkit-scrollbar { width: 6px; }
                .ranking-list::-webkit-scrollbar-thumb { background: ${themeCyan}44; border-radius: 3px; }

                .ranking-item {
                    display: grid; grid-template-columns: 50px 60px 1fr 220px;
                    align-items: center; padding: 12px 20px;
                    background: rgba(255, 255, 255, 0.03);
                    border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.05);
                    transition: 0.2s;
                }
                .ranking-item:hover { background: rgba(0, 255, 255, 0.08); transform: translateX(5px); border-color: ${themeCyan}44; }
                .ranking-item.me { border: 1px solid ${themeCyan}; background: rgba(0, 255, 255, 0.05); }

                .rank-num { font-family: 'Goldman'; font-weight: 900; font-size: 1.4rem; color: rgba(255,255,255,0.3); }
                .rank-top-1 { color: #ffd700; text-shadow: 0 0 15px rgba(255,215,0,0.6); font-size: 1.8rem; }
                .rank-avatar-wrap { position: relative; width: 45px; height: 45px; }
                .rank-avatar { width: 100%; height: 100%; border-radius: 10px; border: 2px solid rgba(255,255,255,0.1); object-fit: cover; background: #000; }
                .rank-info { display: flex; flex-direction: column; padding-left: 15px; }
                .rank-name { font-weight: 900; font-size: 1.1rem; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 400px; }
                .rank-sub-text { font-size: 0.7rem; color: ${themeCyan}; font-weight: 800; opacity: 0.7; }
                .rank-val-group { text-align: right; }
                .rank-score-val { font-family: 'Goldman'; font-size: 1.4rem; font-weight: 700; color: #fff; }
                .rank-sub-val { font-size: 0.75rem; opacity: 0.5; font-weight: 800; text-transform: uppercase; }

                .ranking-footer {
                    padding: 20px 40px; border-top: 1px solid rgba(255, 255, 255, 0.1);
                    display: flex; justify-content: space-between; align-items: center;
                    background: rgba(0,0,0,0.2);
                }
                .close-rank-btn {
                    padding: 10px 40px; background: transparent; border: 2px solid ${themeCyan};
                    border-radius: 8px; color: ${themeCyan}; font-weight: 900; font-family: 'Goldman';
                    cursor: pointer; transition: 0.3s;
                }
            </style>
        `;

        const listHtml = data.length > 0 
            ? data.map((entry, index) => this.renderEntry(entry, index)).join('')
            : `<div class="ranking-empty" style="padding: 50px; text-align: center; opacity: 0.5;">NO RANKING DATA FOUND IN D1</div>`;

        const tabs = this.currentCategory === 'user' 
            ? [
                { id: 'score', label: 'HALL OF FAME' },
                { id: 'combo', label: 'MAX STREAK' },
                { id: 'plays', label: 'DEDICATION' },
                { id: 'level', label: 'EXPERIENCE' }
            ]
            : [
                { id: 'songs', label: 'POPULARITY' }
            ];

        const html = `
            ${styles}
            <div class="ranking-overlay">
                <div class="ranking-modal">
                    <div class="ranking-header">
                        <div class="ranking-title-area">
                            <div class="ranking-title-group">
                                <div class="ranking-subtitle">${this.currentCategory === 'user' ? 'GLOBAL LEADERBOARD' : 'GLOBAL TRACK CHARTS'}</div>
                                <h2>WORLD RANKING</h2>
                            </div>
                            <div class="category-switcher">
                                <div class="category-btn ${this.currentCategory === 'user' ? 'active' : ''}" data-cat="user">PLAYERS</div>
                                <div class="category-btn ${this.currentCategory === 'song' ? 'active' : ''}" data-cat="song">TRACKS</div>
                            </div>
                        </div>
                    </div>
                    <div class="ranking-tabs">
                        ${tabs.map(t => `<div class="rank-tab ${this.currentType === t.id ? 'active' : ''}" data-type="${t.id}">${t.label}</div>`).join('')}
                    </div>
                    <div class="ranking-list">
                        ${listHtml}
                    </div>
                    <div class="ranking-footer">
                        <div style="font-size: 0.75rem; color: #00ffff; opacity: 0.6; font-weight: 800;">DATA SOURCE: CLOUDFLARE D1 (REMOTE)</div>
                        <button class="close-rank-btn" id="close-ranking">DISMISS</button>
                    </div>
                </div>
            </div>
        `;

        this.ui.createOverlay('ranking-ui', html);
        this.attachEventListeners();
    }

    private renderEntry(entry: LeaderboardEntry, index: number): string {
        const rankNum = index + 1;
        const rankClass = rankNum <= 3 ? `rank-top-${rankNum}` : '';
        const themeCyan = '#00ffff';

        if (this.currentCategory === 'song') {
            const cleanName = entry.display_name.split('/').pop()?.replace(/\.(mid|mp3|wav)$/i, '') || entry.display_name;
            const uniqueUsers = entry.total_notes_hit || 0;

            return `
                <div class="ranking-item">
                    <div class="rank-num ${rankClass}">${rankNum}</div>
                    <div style="display: flex; align-items: center; justify-content: center; width: 45px; height: 45px; background: rgba(0,255,255,0.1); border-radius: 10px; color: ${themeCyan}; font-size: 1.5rem;">🎵</div>
                    <div class="rank-info">
                        <div class="rank-name">${cleanName}</div>
                        <div class="rank-sub-text">GLOBAL POPULARITY CHART</div>
                    </div>
                    <div class="rank-val-group">
                        <div class="rank-score-val">${entry.score.toLocaleString()}</div>
                        <div class="rank-sub-val">TOTAL PLAYS (${uniqueUsers} USERS)</div>
                    </div>
                </div>
            `;
        }

        const isMe = entry.display_name === AuthService.getInstance().getUserName();
        const level = entry.level || 1;
        const classInfo = DJClassSystem.getClassInfo(level);
        const avatar = entry.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(entry.display_name)}&background=random&color=fff`;

        return `
            <div class="ranking-item ${isMe ? 'me' : ''}">
                <div class="rank-num ${rankClass}">${rankNum}</div>
                <div class="rank-avatar-wrap">
                    <img src="${avatar}" class="rank-avatar" />
                    <div style="position: absolute; bottom: -5px; right: -5px; width: 22px; height: 22px; background: #111; border-radius: 50%; padding: 2px; border: 1.5px solid ${themeCyan};">
                        ${classInfo.emblemSVG}
                    </div>
                </div>
                <div class="rank-info">
                    <div class="rank-name">${entry.display_name}</div>
                    <div class="rank-sub-text" style="color: ${classInfo.color}">${classInfo.name}</div>
                </div>
                <div class="rank-val-group">
                    <div class="rank-score-val">${entry.score.toLocaleString()}</div>
                    <div class="rank-sub-val">SERVER SCORE</div>
                </div>
            </div>
        `;
    }

    private attachEventListeners(): void {
        document.getElementById('close-ranking')?.addEventListener('click', () => {
            this.hide();
            this.onClose();
        });

        const catBtns = document.querySelectorAll('.category-btn');
        catBtns.forEach(btn => {
            btn.addEventListener('click', async () => {
                const cat = btn.getAttribute('data-cat') as 'user' | 'song';
                if (cat && cat !== this.currentCategory) {
                    this.currentCategory = cat;
                    this.currentType = cat === 'user' ? 'score' : 'songs';
                    const data = await this.fetchRanking(this.currentSongId, this.currentType);
                    this.render(data);
                }
            });
        });

        const tabs = document.querySelectorAll('.rank-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', async () => {
                const type = tab.getAttribute('data-type');
                if (type && type !== this.currentType) {
                    this.currentType = type;
                    const data = await this.fetchRanking(this.currentSongId, this.currentType);
                    this.render(data);
                }
            });
        });
    }

    private async fetchRanking(songId?: string, type: string = 'score'): Promise<LeaderboardEntry[]> {
        const apiPath = type === 'songs' ? '/api/scores/top?type=songs' : (songId ? `/api/scores/top?songId=${songId}` : `/api/scores/top?type=${type}`);
        
        try {
            const response = await ApiUtils.fetch(apiPath, {}, true); 
            if (!response.ok) return [];
            const data = await response.json();

            if (type === 'songs') {
                // If the server returns users for a song request (old server), filter them out
                return data.filter((item: any) => item.display_name.includes('/') || item.display_name.includes('.mid') || item.display_name.includes('터키행진곡'));
            }
            return data;
        } catch (e) {
            console.error('[RankingUI] Global fetch failed:', e);
            return [];
        }
    }

    public hide(): void {
        this.ui.hide('ranking-ui');
    }
}
