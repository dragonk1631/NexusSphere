import { UIManager } from '../core/ui/UIManager';
import { AuthService } from '../services/auth/AuthService';
import { ExperienceSystem } from '../core/score/ExperienceSystem';
import { DJClassSystem } from '../core/progression/DJClassSystem';
import { ApiUtils } from '../core/utils/ApiUtils';

export class CollectionUI {
    private ui: UIManager;
    private onClose: () => void;
    
    private currentKeyMode: number = 4;
    private currentDifficulty: string = 'NORMAL';
    private cachedData: any = null;

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
            alert("동기화에 실패했습니다. 네트워크 연결을 확인하거나 잠시 후 다시 시도해주세요.");
            this.onClose();
            return;
        }
        this.cachedData = data;
        this.render();
    }

    private render() {
        const auth = AuthService.getInstance();
        const { stats, rankCounts, records } = this.cachedData;
        
        const level = stats?.level || 1;
        const totalXP = stats?.exp || 0;
        this.renderModal(auth, level, totalXP, stats, rankCounts, records);
        this.attachEventListeners();
    }

    private renderModal(auth: AuthService, level: number, totalXP: number, stats: any, rankCounts: any[], records: any[]) {
        const classInfo = DJClassSystem.getClassInfo(level);
        
        // Helper to make SVG IDs unique for this render instance to prevent collision
        const makeUniqueSVG = (svg: string, postfix: string) => {
            return svg.replace(/id="([^"]+)"/g, `id="$1-${postfix}"`)
                      .replace(/url\(#([^)]+)\)/g, `url(#$1-${postfix})`);
        };

        const themeCyan = '#00ffff';
        const darkCyan = '#008888';
        const bgBlack = 'rgba(5, 12, 12, 0.55)';

        const styles = `
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Goldman:wght@400;700&family=Outfit:wght@400;700;900&display=swap');
                
                .col-overlay {
                    position: fixed; inset: 0; background: rgba(0,0,0,0.5);
                    display: flex; align-items: flex-end; justify-content: center;
                    z-index: 1500; animation: mm-fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                    padding-bottom: 25px;
                    box-sizing: border-box;
                }
                
                .col-modal {
                    width: min(1200px, 98vw); 
                    height: calc(100vh - 120px);
                    background: ${bgBlack}; 
                    border: 3px solid ${themeCyan};
                    border-radius: 12px;
                    display: flex; flex-direction: column;
                    box-shadow: 0 0 35px rgba(0, 255, 255, 0.2), inset 0 0 25px rgba(0, 255, 255, 0.1); 
                    overflow: hidden; font-family: 'Outfit', sans-serif; color: white;
                    backdrop-filter: blur(35px) saturate(180%);
                    position: relative; min-height: 0;
                }

                /* NEW PAGE TITLE BAR */
                .col-title-bar {
                    background: rgba(0, 255, 255, 0.1);
                    padding: 6px 35px; border-bottom: 1px solid rgba(0, 255, 255, 0.3);
                    font-family: 'Goldman', cursive; font-size: 0.75rem; 
                    letter-spacing: 4px; color: ${themeCyan}; font-weight: 700;
                    display: flex; align-items: center; gap: 10px;
                    text-transform: uppercase;
                }
                .col-title-status { width: 8px; height: 8px; background: ${themeCyan}; border-radius: 50%; box-shadow: 0 0 8px ${themeCyan}; animation: mm-pulse 1.5s infinite; }

                /* SECTION HUD */
                .col-section {
                    position: relative;
                    border: 2px solid ${themeCyan};
                    border-radius: 10px;
                    background: rgba(0, 30, 30, 0.2);
                    box-shadow: inset 0 0 15px rgba(0, 255, 255, 0.05);
                    margin-top: 15px;
                }
                
                .col-sec-tag {
                    position: absolute; top: -14px; left: 15px;
                    background: linear-gradient(180deg, ${themeCyan}, ${darkCyan});
                    padding: 3px 22px; border-radius: 5px;
                    font-family: 'Goldman', cursive; font-size: 0.85rem; font-weight: 700;
                    color: #000; text-transform: uppercase; letter-spacing: 2px;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.4); border: 1.5px solid #fff;
                }

                /* HEADER HUD */
                .col-header {
                    padding: 20px 35px; border-bottom: 2px solid rgba(0, 255, 255, 0.3);
                    display: flex; justify-content: space-between; align-items: center;
                    background: linear-gradient(180deg, rgba(0, 255, 255, 0.15), transparent);
                }
                .col-profile { display: flex; align-items: center; gap: 20px; }
                .col-avatar {
                    width: 60px; height: 60px; border: 3px solid ${themeCyan};
                    border-radius: 10px; box-shadow: 0 0 15px rgba(0, 255, 255, 0.3);
                    overflow: hidden; background: #000;
                }
                .col-avatar img { width: 100%; height: 100%; object-fit: cover; }
                .col-username { font-size: 1.6rem; font-weight: 950; color: #fff; text-shadow: 0 0 15px ${themeCyan}; text-transform: uppercase; letter-spacing: -0.5px; }
                
                .col-progression { display: flex; align-items: center; gap: 30px; }
                .col-level-val { 
                    font-size: 3.6rem; font-weight: 700; color: #fff;
                    font-family: 'Goldman', cursive; line-height: 0.9;
                    text-shadow: 0 0 30px ${themeCyan};
                }
                .col-class-info { display: flex; flex-direction: column; align-items: flex-end; }
                .col-class-name { font-size: 1.1rem; font-weight: 900; color: ${classInfo.color}; letter-spacing: 1.5px; text-transform: uppercase; text-shadow: 0 0 15px ${classInfo.bgGlow}; }
                .col-xp-bar-heavy { 
                    width: 160px; height: 12px; background: rgba(0,0,0,0.6); 
                    border: 2px solid ${themeCyan}; border-radius: 3px; margin-top: 8px; overflow: hidden;
                }
                .col-xp-fill-heavy { height: 100%; background: linear-gradient(90deg, ${darkCyan}, ${themeCyan}); }

                /* EMBLEM UI RESTORATION */
                .col-emblem-wrap { 
                    position: relative; width: 80px; height: 80px; 
                    display: flex; align-items: center; justify-content: center;
                    cursor: pointer; transition: 0.3s;
                }
                .col-emblem-wrap:hover { transform: scale(1.1) rotate(5deg); }
                .col-emblem-frame { position: absolute; inset: 0; color: ${classInfo.color}; filter: drop-shadow(0 0 15px ${classInfo.bgGlow}); }
                .col-emblem-icon { position: relative; width: 38px; height: 38px; filter: drop-shadow(0 0 8px #fff); }

                /* FILTER BAR & TABS */
                .col-filter-bar {
                    padding: 12px 35px; display: flex; justify-content: space-between; align-items: center;
                    background: rgba(0, 15, 15, 0.5); border-bottom: 2px solid rgba(0, 255, 255, 0.2);
                }
                .col-tab-group { display: flex; gap: 6px; background: rgba(0,0,0,0.4); padding: 4px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); }
                .col-tab {
                    padding: 7px 20px; font-size: 0.85rem; font-weight: 900; cursor: pointer;
                    color: rgba(255,255,255,0.4); border-radius: 6px; transition: 0.2s;
                    text-transform: uppercase; font-family: 'Goldman', cursive; border: 1.5px solid transparent;
                }
                
                /* VIBRANT TAB THEMES */
                .col-tab.active[data-val="4"], .col-tab.active[data-val="6"] { background: linear-gradient(180deg, #00ffff, #008888); color: #000; box-shadow: 0 0 15px #00ffff; border-color: #fff; }
                .col-tab.active[data-val="EASY"] { background: linear-gradient(180deg, #2ecc71, #27ae60); color: #000; box-shadow: 0 0 15px #2ecc71; border-color: #fff; }
                .col-tab.active[data-val="NORMAL"] { background: linear-gradient(180deg, #3498db, #2980b9); color: #000; box-shadow: 0 0 15px #3498db; border-color: #fff; }
                .col-tab.active[data-val="HARD"] { background: linear-gradient(180deg, #e74c3c, #c0392b); color: #fff; box-shadow: 0 0 15px #e74c3c; border-color: #fff; }
                .col-tab.active[data-val="EXPERT"] { background: linear-gradient(180deg, #9b59b6, #8e44ad); color: #fff; box-shadow: 0 0 15px #9b59b6; border-color: #fff; }

                .col-btn-heavy {
                    padding: 10px 35px; font-family: 'Goldman', cursive; font-size: 1.1rem; font-weight: 700;
                    border: 3px solid #fff; border-radius: 10px; cursor: pointer; transition: 0.2s;
                    color: #fff; text-shadow: 0 2px 4px rgba(0,0,0,0.5);
                    background: linear-gradient(180deg, #ff4757, #990000); box-shadow: 0 4px 12px rgba(255, 71, 87, 0.4);
                }

                /* CONTENT HUD */
                .col-content { flex: 1; padding: 30px 35px; display: grid; grid-template-columns: 1fr 380px; gap: 30px; overflow: hidden; }
                
                .stats-grid-heavy { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; padding: 25px 20px; }
                .stat-box-heavy { background: rgba(0,0,0,0.5); border: 2px solid rgba(0, 255, 255, 0.25); padding: 18px; border-radius: 8px; display: flex; flex-direction: column; align-items: center; }
                .stat-box-heavy.wide { grid-column: span 2; border-color: ${themeCyan}; background: rgba(0, 255, 255, 0.05); }
                .stat-v { font-size: 2.2rem; font-family: 'Goldman'; color: ${themeCyan}; text-shadow: 0 0 12px ${themeCyan}; }
                .stat-l { font-size: 0.75rem; opacity: 0.55; font-weight: 800; text-transform: uppercase; margin-top: 6px; letter-spacing: 1px; }

                /* RANK COLORS */
                .grade-grid-heavy { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; padding: 20px; }
                .grade-item-heavy { background: rgba(0,15,15,0.4); border: 2px solid rgba(255,255,255,0.1); height: 85px; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; transition: 0.2s; }
                .grade-item-heavy:hover { border-color: ${themeCyan}; transform: translateY(-4px); background: rgba(0, 255, 255, 0.08); }
                
                .gt-h { font-family: 'Goldman'; font-size: 1.8rem; color: #fff; font-weight: 700; }
                .gt-h.s_plus { color: #f1c40f; text-shadow: 0 0 20px #f1c40f, 0 0 40px rgba(241, 196, 15, 0.4); }
                .gt-h.s { color: #00ffff; text-shadow: 0 0 15px #00ffff; }
                .gt-h.a { color: #2ecc71; text-shadow: 0 0 15px #2ecc71; }
                .gt-h.b { color: #3498db; text-shadow: 0 0 15px #3498db; }
                .gc-h { font-size: 0.85rem; font-weight: 900; color: #fff; opacity: 0.6; margin-top: 4px; }

                /* LOG HUD */
                .perf-scroll { flex: 1; height: 100%; padding: 25px 15px; display: flex; flex-direction: column; gap: 6px; overflow-y: auto; }
                .perf-scroll::-webkit-scrollbar { width: 14px; }
                .perf-scroll::-webkit-scrollbar-thumb { background: linear-gradient(180deg, ${themeCyan}, ${darkCyan}); border: 3px solid #000; border-radius: 7px; }

                .perf-item { display: flex; align-items: center; padding: 12px 18px; background: rgba(255,255,255,0.04); border-radius: 8px; transition: 0.2s; border: 2px solid transparent; }
                .perf-item:hover { background: rgba(0, 255, 255, 0.1); border-color: ${themeCyan}; transform: translateX(8px); }

                @media (max-width: 900px) {
                    .col-overlay { padding-bottom: 0; align-items: stretch; }
                    .col-modal { 
                        width: 100vw; 
                        height: 100dvh; 
                        border-radius: 0; 
                        border-left: none; border-right: none;
                    }
                    .col-header { 
                        flex-direction: column; 
                        gap: 15px; 
                        padding: 15px 20px; 
                        align-items: flex-start;
                    }
                    .col-progression { 
                        width: 100%; 
                        justify-content: space-between; 
                        gap: 15px;
                        border-top: 1px solid rgba(0,255,255,0.1);
                        padding-top: 15px;
                    }
                    .col-level-val { font-size: 2.2rem; }
                    .col-class-info { align-items: flex-start; }
                    .col-xp-bar-heavy { width: clamp(100px, 30vw, 160px); }
                    .col-emblem-wrap { width: 60px; height: 60px; }
                    
                    .col-filter-bar { 
                        flex-direction: column; 
                        gap: 12px; 
                        padding: 12px 20px;
                        align-items: stretch;
                        height: auto;
                    }
                    .col-filter-bar > div { flex-direction: column; gap: 8px; }
                    .col-tab-group { overflow-x: auto; padding: 4px; display: flex; }
                    .col-tab { padding: 6px 12px; font-size: 0.7rem; flex-shrink: 0; }
                    
                    .col-content { 
                        grid-template-columns: 1fr; 
                        padding: 20px; 
                        overflow-y: auto;
                        display: flex; 
                        flex-direction: column;
                        gap: 20px;
                    }
                    .col-section { margin-top: 20px; }
                    .stat-box-heavy { padding: 12px; }
                    .stat-v { font-size: 1.8rem; }
                    .grade-grid-heavy { grid-template-columns: repeat(2, 1fr); padding: 10px; }
                    .perf-scroll { height: auto; min-height: 300px; padding: 10px 5px; }
                    .col-btn-heavy { padding: 8px 20px; font-size: 0.9rem; }
                    .col-modal {
                        animation: mm-slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                    }
                }

                /* 
                   ULTRA-LANDSCAPE OPTIMIZATION (Priority High)
                   This MUST come after max-width to override it for landscape mobile devices.
                */
                @media (max-height: 500px) {
                    .col-overlay { padding-bottom: 0; align-items: stretch; }
                    .col-modal { 
                        height: 100dvh !important; 
                        border-radius: 0; 
                        width: 100vw !important;
                        overflow-y: auto !important; 
                        display: block !important; /* Switch to natural flow for scrollability */
                    }
                    .col-title-bar { position: sticky; top: 0; z-index: 10; padding: 3px 15px; font-size: 0.55rem; }
                    .col-header { 
                        padding: 6px 15px; 
                        flex-direction: row !important;
                        justify-content: space-between;
                        gap: 15px;
                    }
                    .col-avatar { width: 28px; height: 28px; }
                    .col-username { font-size: 0.85rem; }
                    .col-level-val { font-size: 1.6rem; }
                    .col-class-name { font-size: 0.65rem; }
                    .col-xp-bar-heavy { display: none; } /* Hide bar to save space */
                    .col-emblem-wrap { width: 32px; height: 32px; }
                    
                    .col-filter-bar { 
                        position: sticky; top: 22px; z-index: 10; 
                        padding: 4px 15px; 
                        flex-direction: row !important;
                        height: auto;
                    }
                    .col-filter-bar > div { flex-direction: row !important; gap: 10px; }
                    .col-tab { padding: 3px 8px; font-size: 0.6rem; }
                    .col-btn-heavy { padding: 4px 12px; font-size: 0.75rem; }
                    
                    .col-content { 
                        display: grid !important; 
                        grid-template-columns: 1.15fr 1fr !important; 
                        padding: 8px 12px !important; 
                        gap: 12px !important; 
                        overflow: visible !important;
                        height: auto !important;
                    }
                    .col-section { margin-top: 15px !important; }
                    .stat-v { font-size: 1.1rem; }
                    .grade-item-heavy { height: 35px; }
                    .gt-h { font-size: 0.9rem; }
                    .perf-scroll { height: auto !important; min-height: 200px; overflow: visible; }
                }
                @keyframes mm-slideUp {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
            </style>
        `;

        const currentRankStats = rankCounts.find(rc => rc.key_mode === this.currentKeyMode && rc.difficulty === this.currentDifficulty) || {};
        const filteredRecords = records.filter(r => r.key_mode === this.currentKeyMode && r.difficulty === this.currentDifficulty)
                                       .sort((a,b) => new Date(b.last_played_at).getTime() - new Date(a.last_played_at).getTime());

        const html = `
            ${styles}
            <div class="col-overlay">
                <div class="col-modal">
                    <!-- HUD TITLE BAR -->
                    <div class="col-title-bar">
                        <div class="col-title-status"></div>
                        SYSTEM ARCHIVE // COLLECTION
                    </div>

                    <!-- MAIN HUD HEADER -->
                    <div class="col-header">
                        <div class="col-profile">
                            <div class="col-avatar">
                                <img src="${auth.getClerk()?.user?.imageUrl || ''}" alt="AVATAR">
                            </div>
                            <div>
                                <div class="col-username">${auth.getUserName()}</div>
                                <div style="font-size: 0.75rem; opacity: 0.5; font-weight: 800; margin-top: 5px; letter-spacing: 1.5px; color: ${themeCyan}; text-transform: uppercase;">NEXUS SYSTEM SYNCED // USER_ID: ${auth.getClerk()?.user?.id?.slice(0, 8)}</div>
                            </div>
                        </div>
                        <div class="col-progression">
                            <div class="col-level-val">LV.${level}</div>
                            <div class="col-class-info">
                                <div class="col-class-name">${classInfo.name}</div>
                                <div class="col-xp-bar-heavy">
                                    <div class="col-xp-fill-heavy" style="width: ${ExperienceSystem.getLevelProgress(totalXP) * 100}%"></div>
                                </div>
                                <div style="font-size: 0.75rem; opacity: 0.6; margin-top: 8px; font-weight: 900; letter-spacing: 0.5px;">
                                    ${Math.floor(totalXP).toLocaleString()} / ${ExperienceSystem.getXPThresholdForLevel(level + 1).toLocaleString()} XP
                                </div>
                            </div>
                            <div class="col-emblem-wrap" id="emblem-trigger">
                                <div class="col-emblem-frame" style="color: ${classInfo.color}">${makeUniqueSVG(classInfo.frameSVG, 'main')}</div>
                                <div class="col-emblem-icon">${makeUniqueSVG(classInfo.emblemSVG, 'main')}</div>
                            </div>
                        </div>
                    </div>

                    <!-- HUD FILTER BOX -->
                    <div class="col-filter-bar">
                        <div style="display: flex; gap: 15px;">
                            <div class="col-tab-group" id="key-tabs">
                                <div class="col-tab ${this.currentKeyMode === 4 ? 'active' : ''}" data-val="4">4 KEYS</div>
                                <div class="col-tab ${this.currentKeyMode === 6 ? 'active' : ''}" data-val="6">6 KEYS</div>
                            </div>
                            <div class="col-tab-group" id="diff-tabs">
                                <div class="col-tab ${this.currentDifficulty === 'EASY' ? 'active' : ''}" data-val="EASY">EASY</div>
                                <div class="col-tab ${this.currentDifficulty === 'NORMAL' ? 'active' : ''}" data-val="NORMAL">NORMAL</div>
                                <div class="col-tab ${this.currentDifficulty === 'HARD' ? 'active' : ''}" data-val="HARD">HARD</div>
                                <div class="col-tab ${this.currentDifficulty === 'EXPERT' ? 'active' : ''}" data-val="EXPERT">EXPERT</div>
                            </div>
                        </div>
                        <button class="col-btn-heavy" id="close-col">BACK</button>
                    </div>

                    <!-- HUD MAIN CONTENT -->
                    <div class="col-content">
                        <div class="col-left-stats">
                            <!-- ACHIEVEMENTS SECTION -->
                            <div class="col-section">
                                <div class="col-sec-tag">Operational Stats</div>
                                <div class="stats-grid-heavy">
                                    <div class="stat-box-heavy">
                                        <div class="stat-v">${(stats.max_streak || 0).toLocaleString()}</div>
                                        <div class="stat-l">연속콤보기록</div>
                                    </div>
                                    <div class="stat-box-heavy">
                                        <div class="stat-v">${(stats.total_notes_hit || 0).toLocaleString()}</div>
                                        <div class="stat-l">누적 콤보기록</div>
                                    </div>
                                    <div class="stat-box-heavy wide">
                                        <div class="stat-v" style="font-size: 2.2rem;">${(stats.total_score || 0).toLocaleString()}</div>
                                        <div class="stat-l">Total Accumulated Score // 누적 점수</div>
                                    </div>
                                </div>
                            </div>

                            <!-- PERFORMANCE DISTRIBUTION SECTION -->
                            <div class="col-section">
                                <div class="col-sec-tag">Performance Rating</div>
                                <div class="grade-grid-heavy">
                                    <div class="grade-item-heavy"><div class="gt-h s_plus">S+</div><div class="gc-h">${currentRankStats.rank_s_plus || 0}</div></div>
                                    <div class="grade-item-heavy"><div class="gt-h s">S</div><div class="gc-h">${currentRankStats.rank_s || 0}</div></div>
                                    <div class="grade-item-heavy"><div class="gt-h a">A</div><div class="gc-h">${currentRankStats.rank_a || 0}</div></div>
                                    <div class="grade-item-heavy"><div class="gt-h b">B</div><div class="gc-h">${currentRankStats.rank_b || 0}</div></div>
                                </div>
                            </div>
                        </div>

                        <!-- MISSION LOGS SECTION -->
                        <div class="col-right-logs">
                            <div class="col-section" style="display: flex; flex-direction: column; flex: 1; height: 100%; overflow: hidden;">
                                <div class="col-sec-tag">Mission Archive Log</div>
                                <div class="perf-scroll">
                                    ${filteredRecords.length > 0 ? filteredRecords.map(r => `
                                        <div class="perf-item">
                                            <div class="pi-grade ${r.best_grade === 'S+' ? 'gt-h s_plus' : r.best_grade === 'S' ? 'gt-h s' : r.best_grade === 'A' ? 'gt-h a' : r.best_grade === 'B' ? 'gt-h b' : 'gt-h'}">${r.best_grade}</div>
                                            <div class="pi-info">
                                                <div class="pi-name">${r.song_id?.split('/').pop().replace('.mid','').replace('.mp3','')}</div>
                                                <div class="pi-meta">COMBO ${r.max_combo} | ACCURACY ${(r.best_accuracy || 0).toFixed(2)}%</div>
                                            </div>
                                            <div class="pi-score">${(r.high_score || 0).toLocaleString()}</div>
                                        </div>
                                    `).join('') : '<div style="opacity: 0.3; text-align: center; padding: 2rem 0; font-weight: 900; font-size: 1.2rem; letter-spacing: 2px;">NO RECENT ANALYTICS</div>'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.ui.createOverlay('collection-ui', html);
    }

    private attachEventListeners() {
        const guide = document.getElementById('class-guide');

        // Close Main Modal
        document.getElementById('close-col')?.addEventListener('click', () => {
            this.hide();
            this.onClose();
        });

        // Toggle Class Guide
        document.getElementById('emblem-trigger')?.addEventListener('click', () => {
            guide?.classList.add('active');
        });

        document.getElementById('close-guide')?.addEventListener('click', () => {
            guide?.classList.remove('active');
        });

        const keyTabs = document.querySelectorAll('#key-tabs .col-tab');
        keyTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.currentKeyMode = parseInt((tab as HTMLElement).dataset.val || '4');
                this.render();
            });
        });

        const diffTabs = document.querySelectorAll('#diff-tabs .col-tab');
        diffTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.currentDifficulty = (tab as HTMLElement).dataset.val || 'NORMAL';
                this.render();
            });
        });
    }

    private async fetchCollection(): Promise<any> {
        try {
            const auth = AuthService.getInstance();
            const token = await auth.getClerk()?.session?.getToken();
            
            console.log(`[CollectionUI] Syncing data...`);
            const response = await ApiUtils.fetch('/api/user/sync', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({ message: 'Unknown error' }));
                throw new Error(err.message || `HTTP ${response.status}`);
            }
            return await response.json();
        } catch (e) {
            console.error("[CollectionUI] Sync failed:", e);
            return null;
        }
    }

    public hide(): void {
        this.ui.hide('collection-ui');
    }
}
