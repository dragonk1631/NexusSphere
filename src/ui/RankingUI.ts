import { UIManager } from '../core/ui/UIManager';
import { ScoreManager } from '../core/score/ScoreManager';
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
    private currentType: string = 'score'; // score, combo, plays, level
    private currentSongId?: string;

    constructor(onClose: () => void) {
        this.ui = UIManager.getInstance();
        this.onClose = onClose;
    }

    public async show(songId?: string): Promise<void> {
        this.currentSongId = songId;
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
                    display: flex; justify-content: space-between; align-items: flex-end;
                }
                .ranking-title-group h2 { margin: 0; font-size: 2.2rem; font-weight: 950; color: #fff; text-shadow: 0 0 15px ${themeCyan}; letter-spacing: -1px; }
                .ranking-subtitle { font-family: 'Goldman', cursive; font-size: 0.7rem; color: ${themeCyan}; letter-spacing: 4px; text-transform: uppercase; margin-bottom: 4px; opacity: 0.8; }
                
                /* TAB SYSTEM */
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
                    display: grid; grid-template-columns: 50px 60px 1fr 180px;
                    align-items: center; padding: 12px 20px;
                    background: rgba(255, 255, 255, 0.03);
                    border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.05);
                    transition: 0.2s;
                }
                .ranking-item:hover { background: rgba(0, 255, 255, 0.08); transform: translateX(5px); border-color: ${themeCyan}44; }
                .ranking-item.me { border: 1px solid ${themeCyan}; background: rgba(0, 255, 255, 0.05); }

                .rank-num { font-family: 'Goldman'; font-weight: 900; font-size: 1.4rem; color: rgba(255,255,255,0.3); }
                .rank-top-1 { color: #ffd700; text-shadow: 0 0 15px rgba(255,215,0,0.6); font-size: 1.8rem; }
                .rank-top-2 { color: #c0c0c0; text-shadow: 0 0 12px rgba(192,192,192,0.5); }
                .rank-top-3 { color: #cd7f32; text-shadow: 0 0 10px rgba(205,127,50,0.4); }
                
                .rank-avatar-wrap { position: relative; width: 45px; height: 45px; }
                .rank-avatar { width: 100%; height: 100%; border-radius: 10px; border: 2px solid rgba(255,255,255,0.1); object-fit: cover; background: #000; }
                .rank-emblem-mini { 
                    position: absolute; bottom: -5px; right: -5px; width: 22px; height: 22px; 
                    background: #111; border-radius: 50%; padding: 2px; border: 1.5px solid ${themeCyan};
                    box-shadow: 0 2px 5px rgba(0,0,0,0.5);
                }

                .rank-info { display: flex; flex-direction: column; padding-left: 15px; }
                .rank-name { font-weight: 900; font-size: 1.1rem; color: #fff; }
                .rank-level { font-size: 0.7rem; color: ${themeCyan}; font-weight: 800; opacity: 0.7; }
                
                .rank-val-group { text-align: right; }
                .rank-score-val { font-family: 'Goldman'; font-size: 1.4rem; font-weight: 700; color: #fff; }
                .rank-sub-val { font-size: 0.75rem; opacity: 0.5; font-weight: 800; text-transform: uppercase; }

                .ranking-empty { padding: 100px; text-align: center; opacity: 0.5; font-size: 1.2rem; letter-spacing: 2px; }
                
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
                .close-rank-btn:hover { background: ${themeCyan}; color: #000; box-shadow: 0 0 20px ${themeCyan}; }

                /* ── RESPONSIVE DESIGN (Mobile) ── */
                @media (max-width: 768px) {
                    .ranking-modal { width: 95vw; height: 92vh; border-radius: 15px; }
                    .ranking-header { padding: 8px 15px; flex-direction: row; align-items: center; justify-content: space-between; gap: 5px; }
                    .ranking-title-group h2 { font-size: 1.2rem; }
                    .ranking-subtitle { display: none; } /* Hide subtitle on mobile to save space */
                    
                    .ranking-tabs { 
                        padding: 5px 10px; gap: 4px; overflow-x: auto; 
                        white-space: nowrap; -webkit-overflow-scrolling: touch;
                        background: rgba(0,0,0,0.5);
                    }
                    .rank-tab { padding: 5px 10px; font-size: 0.6rem; }
                    
                    .ranking-list { padding: 10px; gap: 6px; }
                    .ranking-item { 
                        grid-template-columns: 35px 50px 1fr 100px; 
                        padding: 10px 12px; border-radius: 10px;
                    }
                    .rank-num { font-size: 1.1rem; }
                    .rank-avatar-wrap { width: 40px; height: 40px; }
                    .rank-info { padding-left: 10px; }
                    .rank-name { font-size: 0.95rem; line-height: 1.2; }
                    .rank-level { font-size: 0.6rem; }
                    
                    .rank-score-val { font-size: 1.1rem; }
                    .rank-sub-val { font-size: 0.6rem; }
                    
                    .ranking-footer { padding: 15px 20px; }
                    .close-rank-btn { padding: 8px 25px; font-size: 0.8rem; width: 100%; }
                }
                @media (max-width: 480px) {
                    .ranking-item { grid-template-columns: 30px 45px 1fr 85px; padding: 8px; }
                    .rank-avatar-wrap { width: 35px; height: 35px; }
                    .rank-num { font-size: 1rem; }
                    .rank-name { font-size: 0.85rem; }
                    .rank-score-val { font-size: 0.95rem; }
                }
            </style>
        `;

        const listHtml = data.length > 0 
            ? data.map((entry, index) => this.renderEntry(entry, index)).join('')
            : `<div class="ranking-empty">NO DATA FOUND FOR THIS CATEGORY</div>`;

        const tabs = [
            { id: 'score', label: 'HALL OF FAME' },
            { id: 'combo', label: 'MAX STREAK' },
            { id: 'hits', label: 'TOTAL HITS' },
            { id: 'plays', label: 'DEDICATION' },
            { id: 'level', label: 'EXPERIENCE' }
        ];

        const tabsHtml = tabs.map(t => `
            <div class="rank-tab ${this.currentType === t.id ? 'active' : ''}" data-type="${t.id}">${t.label}</div>
        `).join('');

        const html = `
            ${styles}
            <div class="ranking-overlay">
                <div class="ranking-modal">
                    <div class="ranking-header">
                        <div class="ranking-title-group">
                            <div class="ranking-subtitle">${this.currentSongId ? 'TRACK LEADERBOARD' : 'GLOBAL RANKINGS'}</div>
                            <h2>WORLD RANKING</h2>
                        </div>
                        ${AuthService.getInstance().isAdmin() ? `<button id="admin-panel-trigger" class="admin-entry-btn">COMMAND CENTER</button>` : ''}
                    </div>
                    <div class="ranking-tabs">
                        ${tabsHtml}
                    </div>
                    <div class="ranking-list">
                        ${listHtml}
                    </div>
                    <div class="ranking-footer">
                        <div class="rank-sub-val" style="opacity: 0.3">DATA REFRESHES IN REAL-TIME</div>
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
        const isMe = entry.display_name === AuthService.getInstance().getUserName();
        
        const level = entry.level || 1;
        const classInfo = DJClassSystem.getClassInfo(level);
        
        let valueStr = entry.score.toLocaleString();
        let subStr = 'TOTAL POINTS';

        if (this.currentType === 'combo') {
            valueStr = (entry.max_streak || 0).toLocaleString();
            subStr = 'MAX COMBO';
        } else if (this.currentType === 'hits') {
            valueStr = (entry.total_notes_hit || 0).toLocaleString();
            subStr = 'TOTAL HITS';
        } else if (this.currentType === 'plays') {
            valueStr = (entry.play_count || 0).toLocaleString();
            subStr = 'SESSIONS';
        } else if (this.currentType === 'level') {
            valueStr = `LV.${entry.level}`;
            subStr = 'PLAYER LEVEL';
        }

        if (this.currentSongId) {
            subStr = `${entry.accuracy?.toFixed(2)}% ACC`;
        }

        const avatar = entry.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(entry.display_name)}&background=random&color=fff`;

        return `
            <div class="ranking-item ${isMe ? 'me' : ''}">
                <div class="rank-num ${rankClass}">${rankNum}</div>
                <div class="rank-avatar-wrap">
                    <img src="${avatar}" class="rank-avatar" />
                    <div class="rank-emblem-mini" style="border-color: ${classInfo.color}">${classInfo.emblemSVG}</div>
                </div>
                <div class="rank-info">
                    <div class="rank-name">${entry.display_name}</div>
                    <div class="rank-level" style="color: ${classInfo.color}">${classInfo.name}</div>
                </div>
                <div class="rank-val-group">
                    <div class="rank-score-val">${valueStr}</div>
                    <div class="rank-sub-val">${subStr}</div>
                </div>
            </div>
        `;
    }

    private attachEventListeners(): void {
        document.getElementById('close-ranking')?.addEventListener('click', () => {
            this.hide();
            this.onClose();
        });

        document.getElementById('admin-panel-trigger')?.addEventListener('click', async () => {
            const { AdminUI } = await import('./AdminUI');
            AdminUI.getInstance().show();
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
        try {
            const apiPath = songId 
                ? `/api/scores/top?songId=${songId}` 
                : `/api/scores/top?type=${type}`;
            
            const response = await ApiUtils.fetch(apiPath, {}, true); // forceGlobal = true
            if (!response.ok) throw new Error(`Server returned ${response.status}`);
            
            const data = await response.json();
            console.info(`[RankingUI] Successfully fetched global rankings from server. Records: ${data.length}`);
            return data;
        } catch (e) {
            console.warn(`[RankingUI] Global fetch failed, using local fallback:`, e);
            return this.getLocalFallback(songId, type);
        }
    }

    private getLocalFallback(songId?: string, _type: string = 'score'): LeaderboardEntry[] {
        const sm = ScoreManager.getInstance();
        const archive = sm.getLocalArchiveData();
        
        if (songId) {
            const songRecords = archive.records.filter(r => r.song_id === songId);
            return songRecords.map(r => ({
                display_name: 'Local Player',
                score: r.high_score,
                accuracy: r.best_accuracy,
                max_combo: r.max_combo,
                timestamp: r.last_played_at
            })).sort((a, b) => b.score - a.score);
        }

        // Global stats from local archive
        const stats = archive.stats;
        const entry: LeaderboardEntry = {
            display_name: 'Local Player',
            score: stats.total_score,
            max_streak: stats.max_streak,
            play_count: stats.play_count,
            current_streak: sm.getLiveStreak(),
            total_notes_hit: stats.total_notes_hit,
            level: stats.level,
            timestamp: new Date().toISOString()
        };

        return [entry];
    }

    public hide(): void {
        this.ui.hide('ranking-ui');
    }
}
