import { UIManager } from '../core/ui/UIManager';
import { AuthService } from '../services/auth/AuthService';
import { ExperienceSystem } from '../core/score/ExperienceSystem';

export class CollectionUI {
    private ui: UIManager;
    private onClose: () => void;

    constructor(onClose: () => void) {
        this.ui = UIManager.getInstance();
        this.onClose = onClose;
    }

    public async show(): Promise<void> {
        const auth = AuthService.getInstance();
        if (!auth.isSignedIn()) {
            alert("로그인이 필요한 기능입니다.");
            return;
        }
        
        const data = await this.fetchCollection();
        if (!data) {
            this.onClose();
            return;
        }

        try {
            const { stats, rankCounts, recentRecords } = data;
            const level = stats?.level || 1;
            const totalXP = stats?.exp || 0;
            const progress = ExperienceSystem.getLevelProgress(totalXP);
            const xpToNext = ExperienceSystem.getXPToNextLevel(totalXP);

            this.renderModal(auth, level, totalXP, progress, xpToNext, stats, rankCounts, recentRecords);
        } catch (e) {
            console.error("Collection Render Error:", e);
            alert("데이터를 표시하는 중 오류가 발생했습니다.");
            this.hide();
            this.onClose();
        }
    }

    private renderModal(auth: AuthService, level: number, totalXP: number, progress: number, xpToNext: number, stats: any, rankCounts: any[], recentRecords: any[]) {
        const styles = `
            <style>
                .col-overlay {
                    position: fixed; inset: 0; background: rgba(0,0,0,0.85);
                    display: flex; align-items: center; justify-content: center;
                    z-index: 1000; backdrop-filter: blur(15px);
                    animation: mm-fadeIn 0.4s cubic-bezier(0.23, 1, 0.32, 1);
                }
                .col-modal {
                    width: clamp(400px, 90vw, 1000px);
                    max-height: 85vh;
                    background: rgba(15, 15, 20, 0.95);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 40px;
                    display: flex; flex-direction: column;
                    box-shadow: 0 40px 120px rgba(0,0,0,1);
                    overflow: hidden;
                    font-family: 'Outfit', sans-serif;
                    color: white;
                }
                .col-header {
                    padding: 40px;
                    background: linear-gradient(135deg, rgba(0, 210, 255, 0.1), rgba(58, 123, 213, 0.1));
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                    display: flex; justify-content: space-between; align-items: center;
                }
                .col-profile { display: flex; align-items: center; gap: 20px; }
                .col-level-badge {
                    width: 80px; height: 80px; background: #3a7bd5;
                    border-radius: 20px; display: flex; flex-direction: column;
                    align-items: center; justify-content: center;
                    box-shadow: 0 0 30px rgba(58, 123, 213, 0.4);
                }
                .col-level-val { font-size: 2.2rem; font-weight: 900; line-height: 1; }
                .col-level-lbl { font-size: 0.7rem; font-weight: 900; opacity: 0.8; }

                .col-user-info h2 { margin: 0; font-size: 1.8rem; font-weight: 900; }
                .col-exp-container { width: 300px; margin-top: 10px; }
                .col-exp-bar {
                    height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden;
                }
                .col-exp-fill {
                    height: 100%; background: linear-gradient(to right, #00d2ff, #3a7bd5);
                    box-shadow: 0 0 10px #00d2ff;
                }
                .col-exp-text { font-size: 0.75rem; opacity: 0.5; margin-top: 5px; }

                .col-content {
                    flex: 1; overflow-y: auto; padding: 40px;
                    display: grid; grid-template-columns: 1fr 1fr; gap: 40px;
                }

                .col-section-title {
                    font-size: 1.1rem; font-weight: 900; margin-bottom: 20px;
                    display: flex; align-items: center; gap: 10px;
                }
                .col-section-title::before { content: ''; width: 4px; height: 18px; background: #00d2ff; border-radius: 2px; }

                .col-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
                .col-stat-card {
                    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05);
                    padding: 20px; border-radius: 20px; transition: 0.3s;
                }
                .col-stat-card:hover { background: rgba(255,255,255,0.06); transform: translateY(-3px); }
                .col-stat-val { font-size: 1.5rem; font-weight: 900; color: #00d2ff; }
                .col-stat-lbl { font-size: 0.75rem; opacity: 0.5; text-transform: uppercase; letter-spacing: 1px; }

                .col-rank-list { display: flex; gap: 10px; justify-content: space-around; }
                .col-rank-item { text-align: center; }
                .col-rank-badge {
                    width: 50px; height: 50px; border-radius: 12px;
                    display: flex; align-items: center; justify-content: center;
                    font-weight: 900; font-size: 1.2rem; margin-bottom: 5px;
                }
                .rb-sp { background: #ffea00; color: #000; box-shadow: 0 0 15px rgba(255,234,0,0.3); }
                .rb-s { background: #f9ca24; color: #000; }
                .rb-a { background: #6ab04c; }
                .rb-b { background: #4834d4; }
                .rb-c { background: #eb4d4b; }

                .col-recent-list { display: flex; flex-direction: column; gap: 10px; }
                .col-recent-item {
                    display: flex; justify-content: space-between; align-items: center;
                    padding: 12px 20px; background: rgba(255,255,255,0.02); border-radius: 15px;
                }
                .col-recent-info { display: flex; align-items: center; gap: 15px; }
                .col-recent-grade { font-weight: 900; color: #00d2ff; width: 30px; }
                .col-recent-name { font-weight: 600; font-size: 0.95rem; }
                .col-recent-meta { font-size: 0.7rem; opacity: 0.4; }

                .col-footer { padding: 30px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.05); }
                .col-close-btn {
                    padding: 14px 60px; background: #3a7bd5; border: none;
                    border-radius: 999px; color: white; font-weight: 900;
                    cursor: pointer; transition: 0.3s;
                }
                .col-close-btn:hover { transform: scale(1.05); box-shadow: 0 0 25px rgba(58, 123, 213, 0.5); }
            </style>
        `;

        const rankMap: Record<string, number> = {};
        if (rankCounts) {
            rankCounts.forEach((rc: any) => rankMap[rc.best_grade] = rc.count);
        }

        const html = `
            ${styles}
            <div class="col-overlay">
                <div class="col-modal">
                    <div class="col-header">
                        <div class="col-profile">
                            <div class="col-level-badge">
                                <span class="col-level-val">${level}</span>
                                <span class="col-level-lbl">LEVEL</span>
                            </div>
                            <div class="col-user-info">
                                <h2>${auth.getUserName()}</h2>
                                <div class="col-exp-container">
                                    <div class="col-exp-bar">
                                        <div class="col-exp-fill" style="width: ${progress * 100}%"></div>
                                    </div>
                                    <div class="col-exp-text">NEXT LEVEL: ${Math.floor(xpToNext).toLocaleString()} XP</div>
                                </div>
                            </div>
                        </div>
                        <div style="text-align: right">
                            <div style="font-size: 0.8rem; opacity: 0.4; letter-spacing: 2px;">NEXUS COLLECTION</div>
                            <div style="font-size: 1.2rem; font-weight: 900; color: #00d2ff;">SYNCHRONIZED</div>
                        </div>
                    </div>
                    
                    <div class="col-content">
                        <!-- Left Pillar: Statistics -->
                        <div>
                            <div class="col-section-title">GLOBAL STATISTICS</div>
                            <div class="col-stats-grid">
                                <div class="col-stat-card">
                                    <div class="col-stat-val">${(stats?.play_count ?? 0).toLocaleString()}</div>
                                    <div class="col-stat-lbl">Total Plays</div>
                                </div>
                                <div class="col-stat-card">
                                    <div class="col-stat-val">${(stats?.total_score ?? 0).toLocaleString()}</div>
                                    <div class="col-stat-lbl">Cumulative Score</div>
                                </div>
                                <div class="col-stat-card">
                                    <div class="col-stat-val">${(stats?.max_combo ?? 0).toLocaleString()}</div>
                                    <div class="col-stat-lbl">Record Combo</div>
                                </div>
                                <div class="col-stat-card">
                                    <div class="col-stat-val">${ExperienceSystem.getLevelFromXP(totalXP)}</div>
                                    <div class="col-stat-lbl">Rank Level</div>
                                </div>
                            </div>

                            <div class="col-section-title" style="margin-top: 35px;">GRADE DISTRIBUTION</div>
                            <div class="col-rank-list">
                                <div class="col-rank-item">
                                    <div class="col-rank-badge rb-sp">S+</div>
                                    <div class="col-stat-lbl">${rankMap['S+'] || 0}</div>
                                </div>
                                <div class="col-rank-item">
                                    <div class="col-rank-badge rb-s">S</div>
                                    <div class="col-stat-lbl">${rankMap['S'] || 0}</div>
                                </div>
                                <div class="col-rank-item">
                                    <div class="col-rank-badge rb-a">A</div>
                                    <div class="col-stat-lbl">${rankMap['A'] || 0}</div>
                                </div>
                                <div class="col-rank-item">
                                    <div class="col-rank-badge rb-b">B</div>
                                    <div class="col-stat-lbl">${rankMap['B'] || 0}</div>
                                </div>
                            </div>
                        </div>

                        <!-- Right Pillar: Recent History -->
                        <div>
                            <div class="col-section-title">RECENT ACHIEVEMENTS</div>
                            <div class="col-recent-list">
                                ${recentRecords?.length > 0 ? recentRecords.map((r: any) => `
                                    <div class="col-recent-item">
                                        <div class="col-recent-info">
                                            <div class="col-recent-grade">${r.best_grade}</div>
                                            <div>
                                                <div class="col-recent-name">${r.song_id?.split('/').pop().replace('.mid','')}</div>
                                                <div class="col-recent-meta">${r.key_mode}K ${r.difficulty}</div>
                                            </div>
                                        </div>
                                        <div style="text-align: right">
                                            <div style="font-weight: 700;">${(r.high_score ?? 0).toLocaleString()}</div>
                                            <div class="col-recent-meta">${(r.best_accuracy ?? 0).toFixed(1)}%</div>
                                        </div>
                                    </div>
                                `).join('') : '<div style="opacity: 0.3; text-align: center; padding: 40px;">No records yet. Start playing!</div>'}
                            </div>
                        </div>
                    </div>

                    <div class="col-footer">
                        <button class="col-close-btn" id="close-col">DISMISS</button>
                    </div>
                </div>
            </div>
        `;

        this.ui.createOverlay('collection-ui', html);
        document.getElementById('close-col')?.addEventListener('click', () => {
            this.hide();
            this.onClose();
        });
    }

    private async fetchCollection(): Promise<any> {
        try {
            const auth = AuthService.getInstance();
            const token = await auth.getClerk()?.session?.getToken();
            
            const response = await fetch('/api/user/collection', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error("Fetch failed");
            return await response.json();
        } catch (e) {
            console.error(e);
            return null;
        }
    }

    public hide(): void {
        this.ui.hide('collection-ui');
    }
}
