import { UIManager } from '../core/ui/UIManager';
import { ApiUtils } from '../core/utils/ApiUtils';
import { DJClassSystem } from '../core/progression/DJClassSystem';
import { AuthService } from '../services/auth/AuthService';
import { getCharacterImagePath } from '../core/utils/PathUtils';
import { applyCharacterSpriteStyle } from './utils/CharacterStyleUtils';

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
                    width: clamp(380px, 95vw, 900px);
                    height: 88vh;
                    background: rgba(10, 15, 15, 0.85);
                    border: 2px solid ${themeCyan};
                    border-radius: 24px;
                    display: flex; flex-direction: column;
                    box-shadow: 0 0 50px rgba(0, 255, 255, 0.2), inset 0 0 20px rgba(0, 255, 255, 0.1);
                    overflow: hidden;
                    font-family: 'Outfit', sans-serif;
                    position: relative;
                    backdrop-filter: blur(20px);
                }
                .ranking-header {
                    padding: 15px 30px;
                    background: linear-gradient(180deg, rgba(0, 255, 255, 0.1), transparent);
                    border-bottom: 1px solid rgba(0, 255, 255, 0.2);
                    display: flex; justify-content: space-between; align-items: center;
                    position: relative;
                }
                .ranking-title-area { display: flex; align-items: center; gap: 20px; flex: 1; }
                .ranking-title-group { display: flex; flex-direction: column; }
                .ranking-subtitle { font-family: 'Goldman', cursive; font-size: 0.6rem; color: ${themeCyan}; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 2px; opacity: 0.7; }
                .ranking-title-group h2 { margin: 0; font-size: 1.8rem; font-weight: 950; color: #fff; text-shadow: 0 0 15px ${themeCyan}; letter-spacing: -1px; line-height: 1; }
                
                .category-switcher {
                    display: flex; background: rgba(0,0,0,0.4); border-radius: 12px; padding: 3px; border: 1px solid rgba(0, 255, 255, 0.2);
                    margin-left: 20px;
                }
                .category-btn {
                    padding: 6px 15px; font-family: 'Goldman'; font-size: 0.75rem; border-radius: 8px; cursor: pointer; transition: 0.3s;
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

                .rank-num { font-family: 'Goldman'; font-weight: 900; font-size: 1.4rem; color: rgba(255,255,255,0.3); text-align: center; }
                .rank-top-1 { color: #ffd700; text-shadow: 0 0 15px rgba(255,215,0,0.6); font-size: 1.8rem; }
                .rank-avatar-wrap { position: relative; width: 45px; height: 45px; margin: 0 auto; }
                .rank-avatar { width: 100%; height: 100%; border-radius: 10px; border: 2px solid rgba(255,255,255,0.1); object-fit: cover; background: #000; }
                .rank-avatar-sprite { 
                    width: 100%; height: 100%; 
                    border-radius: 10px;
                    border: 2px solid rgba(255,255,255,0.1);
                    background-color: #000;
                }
                .rank-info { display: flex; flex-direction: column; padding-left: 15px; min-width: 0; }
                .rank-name { font-weight: 900; font-size: 1.1rem; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .rank-sub-text { font-size: 0.7rem; color: ${themeCyan}; font-weight: 800; opacity: 0.7; }
                .rank-val-group { text-align: right; }
                .rank-score-val { font-family: 'Goldman'; font-size: 1.4rem; font-weight: 700; color: #fff; }
                .rank-sub-val { font-size: 0.75rem; opacity: 0.5; font-weight: 800; text-transform: uppercase; }

                .ranking-footer { display: none; }

                @media (max-width: 800px) {
                    .ranking-modal { width: 98vw; height: 95vh; }
                    .ranking-header { padding: 10px 15px; }
                    .ranking-title-area { gap: 10px; }
                    .ranking-title-group h2 { font-size: 1.1rem; }
                    .ranking-subtitle { font-size: 0.5rem; letter-spacing: 1px; }
                    .category-switcher { margin-left: 5px; border-radius: 8px; }
                    .category-btn { padding: 4px 8px; font-size: 0.6rem; }
                    .close-rank-btn { padding: 6px 15px; font-size: 0.7rem; border-radius: 6px; }

                    .ranking-tabs { padding: 6px 10px; gap: 4px; overflow-x: auto; }
                    .rank-tab { padding: 4px 10px; font-size: 0.55rem; border-radius: 4px; }
                    
                    .ranking-list { padding: 4px 8px; gap: 4px; }
                    .ranking-item { 
                        grid-template-columns: 35px 40px 1fr auto; 
                        padding: 6px 10px; gap: 4px;
                        border-radius: 8px;
                    }
                    .rank-num { font-size: 1rem; width: 25px; }
                    .rank-top-1 { font-size: 1.2rem; }
                    .rank-avatar-wrap { width: 32px; height: 32px; }
                    .rank-emblem-badge { width: 16px; height: 16px; right: -5px !important; bottom: -5px !important; border-width: 1px; }
                    .rank-info { padding-left: 6px; gap: 0; }
                    .rank-name { font-size: 0.85rem; line-height: 1.1; }
                    .rank-sub-text { font-size: 0.6rem; }
                    .rank-score-val { font-size: 1rem; }
                    .rank-sub-val { font-size: 0.55rem; }
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
                                <div class="ranking-subtitle">GLOBAL LEADERBOARD</div>
                                <h2>WORLD RANKING</h2>
                            </div>
                            <div class="category-switcher">
                                <div class="category-btn ${this.currentCategory === 'user' ? 'active' : ''}" data-cat="user">PLAYERS</div>
                                <div class="category-btn ${this.currentCategory === 'song' ? 'active' : ''}" data-cat="song">TRACKS</div>
                            </div>
                        </div>
                        <button class="col-btn-heavy" id="close-ranking">BACK</button>
                    </div>
                    <div class="ranking-tabs">
                        ${tabs.map(t => `<div class="rank-tab ${this.currentType === t.id ? 'active' : ''}" data-type="${t.id}">${t.label}</div>`).join('')}
                    </div>
                    <div class="ranking-list">
                        ${listHtml}
                    </div>
                </div>
            </div>
        `;

        this.ui.createOverlay('ranking-ui', html);
        
        // Apply intelligent styling to all avatars
        this.applyAvatarStyles();
        
        this.attachEventListeners();
    }

    private applyAvatarStyles(): void {
        const list = document.querySelector('.ranking-list');
        if (!list) return;

        const avatars = list.querySelectorAll('.rank-avatar-sprite');
        avatars.forEach(sprite => {
            const bgImg = (sprite as HTMLElement).style.backgroundImage;
            if (bgImg && bgImg.includes('characters/char_')) {
                // Extract charId from URL (e.g. url(".../char_baby.png") -> baby)
                const match = bgImg.match(/char_([^.]+)\.png/);
                if (match) {
                    applyCharacterSpriteStyle(sprite as HTMLElement, match[1]);
                }
            }
        });
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
        
        let avatarHtml = '';
        if (isMe) {
            const currentCharId = localStorage.getItem('nexus_active_character') || 'baby';
            const charImg = getCharacterImagePath(currentCharId);
            avatarHtml = `<div class="rank-avatar-sprite" style="background-image: url('${charImg}');"></div>`;
        } else if (entry.avatar_url && (entry.avatar_url.includes('characters/char_') || entry.avatar_url.includes('raw.githubusercontent.com'))) {
            avatarHtml = `<div class="rank-avatar-sprite" style="background-image: url('${entry.avatar_url}');"></div>`;
        } else {
            const avatar = entry.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(entry.display_name)}&background=random&color=fff`;
            avatarHtml = `<img src="${avatar}" class="rank-avatar" />`;
        }

        return `
            <div class="ranking-item ${isMe ? 'me' : ''}">
                <div class="rank-num ${rankClass}">${rankNum}</div>
                <div class="rank-avatar-wrap">
                    ${avatarHtml}
                    <div class="rank-emblem-badge" style="position: absolute; bottom: -5px; right: -5px; width: 22px; height: 22px; background: #111; border-radius: 50%; padding: 2px; border: 1.5px solid ${themeCyan};">
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
            const response = await ApiUtils.fetch(apiPath, {}); 
            if (!response.ok) return [];
            const data = await response.json();

            if (type === 'songs') {
                // The new V3 server returns clean titles from the songs table.
                // No need to filter for paths/extensions anymore.
                return data;
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
