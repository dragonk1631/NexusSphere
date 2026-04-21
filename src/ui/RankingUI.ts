import { UIManager } from '../core/ui/UIManager';
import { ScoreManager } from '../core/score/ScoreManager';
import { ApiUtils } from '../core/utils/ApiUtils';

export interface LeaderboardEntry {
    display_name: string;
    score: number;
    accuracy: number;
    max_combo: number;
    timestamp: string;
}

export class RankingUI {
    private ui: UIManager;
    private onClose: () => void;

    constructor(onClose: () => void) {
        this.ui = UIManager.getInstance();
        this.onClose = onClose;
    }

    public async show(songId?: string): Promise<void> {
        const data = await this.fetchRanking(songId);
        
        const styles = `
            <style>
                .ranking-overlay {
                    position: fixed; inset: 0; background: rgba(0,0,0,0.2);
                    display: flex; align-items: center; justify-content: center;
                    z-index: 150; 
                    animation: mm-fadeIn 0.3s ease-out;
                }
                .ranking-modal {
                    width: clamp(350px, 80vw, 800px);
                    max-height: 75vh;
                    margin-top: 60px; /* Offset for HUD */
                    background: rgba(20, 20, 25, 0.7);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 30px;
                    display: flex; flex-direction: column;
                    box-shadow: 0 30px 100px rgba(0,0,0,0.8);
                    overflow: hidden;
                    font-family: 'Outfit', sans-serif;
                    backdrop-filter: blur(25px);
                    -webkit-backdrop-filter: blur(25px);
                }
                .ranking-header {
                    padding: 30px;
                    background: linear-gradient(to right, rgba(255, 0, 110, 0.1), transparent);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                    display: flex; justify-content: space-between; align-items: center;
                }
                .ranking-title { margin: 0; font-size: 2rem; font-weight: 900; color: #ff006e; }
                .ranking-subtitle { opacity: 0.6; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 2px; }
                
                .ranking-list {
                    flex: 1; overflow-y: auto; padding: 20px;
                    display: flex; flex-direction: column; gap: 10px;
                }
                .ranking-item {
                    display: grid; grid-template-columns: 50px 1fr 100px 100px;
                    align-items: center; padding: 15px 25px;
                    background: rgba(255, 255, 255, 0.03);
                    border-radius: 15px; border: 1px solid transparent;
                    transition: 0.2s;
                }
                .ranking-item:hover { background: rgba(255, 255, 255, 0.07); transform: scale(1.02); }
                .rank-num { font-weight: 900; font-size: 1.2rem; }
                .rank-1 { color: #ffd700; font-size: 1.5rem; text-shadow: 0 0 10px rgba(255,215,0,0.5); }
                .rank-2 { color: #c0c0c0; }
                .rank-3 { color: #cd7f32; }
                
                .rank-name { font-weight: 600; }
                .rank-score { font-weight: 900; color: #00ffcc; text-align: right; }
                .rank-acc { opacity: 0.6; text-align: right; font-size: 0.85rem; }

                .ranking-empty { padding: 50px; text-align: center; opacity: 0.5; }
                
                .ranking-footer {
                    padding: 20px; text-align: center;
                    border-top: 1px solid rgba(255, 255, 255, 0.05);
                }
                .close-rank-btn {
                    padding: 12px 40px; background: #ff006e; border: none;
                    border-radius: 999px; color: white; font-weight: 900;
                    cursor: pointer; transition: 0.3s;
                }
                .close-rank-btn:hover { transform: scale(1.1); box-shadow: 0 0 20px rgba(255,0,110,0.5); }
            </style>
        `;

        const listContent = data.length > 0 
            ? data.map((entry, index) => {
                const rankClass = index < 3 ? `rank-${index + 1}` : '';
                return `
                    <div class="ranking-item">
                        <div class="rank-num ${rankClass}">${index + 1}</div>
                        <div class="rank-name">${entry.display_name || 'Anonymous User'}</div>
                        <div class="rank-acc">${entry.accuracy.toFixed(2)}%</div>
                        <div class="rank-score">${entry.score.toLocaleString()}</div>
                    </div>
                `;
            }).join('')
            : '<div class="ranking-empty">No records found for this track.</div>';

        const html = `
            ${styles}
            <div class="ranking-overlay">
                <div class="ranking-modal">
                    <div class="ranking-header">
                        <div>
                            <div class="ranking-subtitle">HALL OF FAME</div>
                            <h2 class="ranking-title">WORLD RANKING</h2>
                        </div>
                        <div style="text-align: right">
                            <div class="rank-acc">${songId ? 'SONG SPECIFIC' : 'GLOBAL STATS'}</div>
                        </div>
                    </div>
                    <div class="ranking-list">
                        ${listContent}
                    </div>
                    <div class="ranking-footer">
                        <button class="close-rank-btn" id="close-ranking">DISMISS</button>
                    </div>
                </div>
            </div>
        `;

        this.ui.createOverlay('ranking-ui', html);
        document.getElementById('close-ranking')?.addEventListener('click', () => {
            this.hide();
            this.onClose();
        });
    }

    private static isServerDown: boolean = false;

    private async fetchRanking(songId?: string): Promise<LeaderboardEntry[]> {
        if (RankingUI.isServerDown) return this.getLocalFallback(songId);

        try {
            const apiPath = songId ? `/api/scores?songId=${songId}` : '/api/scores/top';
            const response = await ApiUtils.fetch(apiPath);
            
            const contentType = response.headers.get('content-type');
            if (!response.ok || !contentType || !contentType.includes('application/json')) {
                if (response.status === 404) RankingUI.isServerDown = true;
                throw new Error('Server unavailable');
            }
            
            return await response.json();
        } catch (e) {
            console.debug('[RankingUI] Falling back to local records:', e);
            return this.getLocalFallback(songId);
        }
    }

    private getLocalFallback(songId?: string): LeaderboardEntry[] {
        const scoreManager = ScoreManager.getInstance();
        const localData = scoreManager.getLocalRanking();
        
        if (songId) {
            return localData.filter((entry: any) => entry.songId === songId);
        }
        return localData.slice(0, 10);
    }

    public hide(): void {
        this.ui.hide('ranking-ui');
    }
}
