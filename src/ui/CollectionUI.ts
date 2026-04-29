import { UIManager } from '../core/ui/UIManager';
import { AuthService } from '../services/auth/AuthService';
import { ExperienceSystem } from '../core/score/ExperienceSystem';
import { DJClassSystem } from '../core/progression/DJClassSystem';
import { ApiUtils } from '../core/utils/ApiUtils';
import { SystemInitializer } from '../core/SystemInitializer';

export class CollectionUI {
    private ui: UIManager;
    private onClose: () => void;
    
    private currentKeyMode: number = 6;
    private currentDifficulty: string = 'NORMAL';
    private currentRankFilter: string | null = null;
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
        const { stats, records } = this.cachedData;
        
        const level = stats?.level || 1;
        const totalXP = stats?.exp || 0;
        this.renderModal(auth, level, totalXP, stats, records);
        this.attachEventListeners();
    }

    private renderModal(auth: AuthService, level: number, totalXP: number, stats: any, records: any[]) {
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
                    height: min(850px, 92vh); 
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
                    overflow: hidden;
                }
                
                .col-sec-tag {
                    width: 100%;
                    box-sizing: border-box;
                    background: linear-gradient(90deg, rgba(0, 255, 255, 0.4), transparent);
                    padding: 8px 20px; 
                    font-family: 'Goldman', cursive; font-size: 0.95rem; font-weight: 700;
                    color: #fff; text-transform: uppercase; letter-spacing: 2px;
                    border-bottom: 1px solid rgba(0, 255, 255, 0.3);
                }

                /* VIBRANT SECTION THEMES */
                .sec-stats { border-color: #00d2d3; box-shadow: inset 0 0 15px rgba(0, 210, 211, 0.1); }
                .sec-stats .col-sec-tag { background: linear-gradient(90deg, rgba(0, 210, 211, 0.5), transparent); border-bottom-color: rgba(0, 210, 211, 0.4); text-shadow: 0 0 8px rgba(0, 210, 211, 0.8); }

                .sec-grade { border-color: #f368e0; box-shadow: inset 0 0 15px rgba(243, 104, 224, 0.1); }
                .sec-grade .col-sec-tag { background: linear-gradient(90deg, rgba(243, 104, 224, 0.5), transparent); border-bottom-color: rgba(243, 104, 224, 0.4); text-shadow: 0 0 8px rgba(243, 104, 224, 0.8); }

                .sec-logs { border-color: #1dd1a1; box-shadow: inset 0 0 15px rgba(29, 209, 161, 0.1); }
                .sec-logs .col-sec-tag { background: linear-gradient(90deg, rgba(29, 209, 161, 0.5), transparent); border-bottom-color: rgba(29, 209, 161, 0.4); text-shadow: 0 0 8px rgba(29, 209, 161, 0.8); }

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
                .col-content { flex: 1; padding: 30px 35px; display: grid; grid-template-columns: 1fr 1fr; gap: 30px; overflow: hidden; min-height: 0; }
                
                .col-left-stats { display: flex; flex-direction: column; gap: 15px; overflow: hidden; height: 100%; }
                .col-right-logs { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
                
                .col-left-stats .sec-stats { flex: 7; display: flex; flex-direction: column; min-height: 0; }
                .col-left-stats .sec-grade { flex: 3; display: flex; flex-direction: column; min-height: 0; }
                .col-left-stats .sec-grade .grade-grid-heavy { flex: 1; align-content: center; }
                
                .stats-grid-heavy { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding: 20px; }
                .stat-box-heavy { background: rgba(0,0,0,0.5); border: 2px solid rgba(0, 255, 255, 0.25); padding: 15px; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
                .stat-box-heavy.wide { grid-column: span 3; border-color: ${themeCyan}; background: rgba(0, 255, 255, 0.05); }
                .stat-v { font-size: 2rem; font-family: 'Goldman'; color: ${themeCyan}; text-shadow: 0 0 12px ${themeCyan}; }
                .stat-l { font-size: 0.7rem; opacity: 0.6; font-weight: 800; text-transform: uppercase; margin-top: 6px; letter-spacing: 0.5px; }

                /* RANK COLORS */
                .grade-grid-heavy { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; padding: 10px 15px; }
                .grade-item-heavy { background: rgba(0,15,15,0.4); border: 2px solid rgba(255,255,255,0.1); height: 50px; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; transition: 0.2s; cursor: pointer; }
                .grade-item-heavy:hover { border-color: ${themeCyan}; transform: translateY(-4px); background: rgba(0, 255, 255, 0.08); }
                .grade-item-heavy.active { border-color: #fff; background: rgba(255, 255, 255, 0.1); box-shadow: 0 0 20px rgba(255, 255, 255, 0.2); }
                .grade-item-heavy.active.s_plus { border-color: #f1c40f; background: rgba(241, 196, 15, 0.1); box-shadow: 0 0 20px rgba(241, 196, 15, 0.4); }
                .grade-item-heavy.active.s { border-color: #ff4757; background: rgba(255, 71, 87, 0.1); box-shadow: 0 0 20px rgba(255, 71, 87, 0.4); }
                .grade-item-heavy.active.a { border-color: #2ecc71; background: rgba(46, 204, 113, 0.1); box-shadow: 0 0 20px rgba(46, 204, 113, 0.4); }
                .grade-item-heavy.active.b { border-color: #3498db; background: rgba(52, 152, 219, 0.1); box-shadow: 0 0 20px rgba(52, 152, 219, 0.4); }
                
                .gt-h { font-family: 'Goldman'; font-size: 1.8rem; color: #fff; font-weight: 700; }
                .gt-h.s_plus { color: #f1c40f; text-shadow: 0 0 20px #f1c40f, 0 0 40px rgba(241, 196, 15, 0.4); }
                .gt-h.s { color: #ff4757; text-shadow: 0 0 15px rgba(255, 71, 87, 0.6); }
                .gt-h.a { color: #2ecc71; text-shadow: 0 0 15px rgba(46, 204, 113, 0.6); }
                .gt-h.b { color: #3498db; text-shadow: 0 0 15px rgba(52, 152, 219, 0.6); }
                .gc-h { font-size: 0.85rem; font-weight: 900; color: #fff; opacity: 0.6; margin-top: 4px; }

                /* LOG HUD */
                .perf-scroll { flex: 1; height: 100%; padding: 20px 10px; display: flex; flex-direction: column; gap: 4px; overflow-y: auto; overflow-x: hidden; }
                .perf-scroll::-webkit-scrollbar { width: 8px; }
                .perf-scroll::-webkit-scrollbar-thumb { background: rgba(0, 255, 255, 0.3); border-radius: 4px; }

                .perf-item { 
                    display: flex; 
                    flex-direction: column;
                    gap: 8px;
                    padding: 14px 20px; 
                    background: rgba(255,255,255,0.02); 
                    border-radius: 8px; 
                    transition: 0.15s ease-out; 
                    border: 1px solid rgba(255,255,255,0.1);
                    min-width: 0;
                    margin-bottom: 2px;
                }
                .perf-item:nth-child(even) { background: rgba(0, 255, 255, 0.05); }
                .perf-item:hover { background: rgba(0, 255, 255, 0.12) !important; border-color: rgba(0, 255, 255, 0.4); transform: translateX(4px); }

                .pi-name { 
                    font-size: 1.1rem; font-weight: 850; color: #fff; 
                    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; 
                    width: 100%;
                }
                
                .pi-sub-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between; /* Pushes everything apart */
                    min-width: 0;
                }

                .pi-sub-left { display: flex; align-items: center; gap: 12px; }

                .pi-grade { 
                    font-family: 'Goldman'; font-weight: 900; font-size: 1rem; 
                    min-width: 35px; text-align: left; opacity: 0.9;
                }
                
                .pi-meta { 
                    font-size: 0.6rem; font-weight: 600; color: rgba(255,255,255,0.3); 
                    text-transform: uppercase; letter-spacing: 0.5px;
                    display: flex; gap: 20px; align-items: center;
                }
                .pi-meta-item { display: flex; flex-direction: column; gap: 2px; }
                .pi-meta-item span { font-size: 0.55rem; opacity: 0.6; }
                .pi-meta-item b { color: ${themeCyan}; font-size: 0.75rem; font-weight: 800; opacity: 0.8; }

                .pi-score { 
                    font-family: 'Goldman'; font-size: 0.85rem; font-weight: 600; 
                    color: rgba(255,255,255,0.8); text-align: right;
                }

                /* MEDIUM-HEIGHT PC OPTIMIZATION (Fixes clipping on smaller browser windows) */
                @media (max-height: 850px) and (min-width: 901px) {
                    .col-header { padding: 12px 25px; }
                    .col-avatar { width: 45px; height: 45px; }
                    .col-username { font-size: 1.3rem; }
                    .col-level-val { font-size: 2.6rem; }
                    .col-emblem-wrap { width: 65px; height: 65px; }
                    .col-content { padding: 15px 25px; gap: 20px; }
                    .stats-grid-heavy { padding: 15px 20px; gap: 10px; }
                    .stat-v { font-size: 1.8rem; }
                    .stat-box-heavy { padding: 12px; }
                    .grade-grid-heavy { padding: 10px; gap: 8px; }
                    .grade-item-heavy { height: 75px; }
                    .gt-h { font-size: 1.5rem; }
                    .perf-scroll { padding: 10px; }
                }

                /* ============================================================
                   MOBILE PORTRAIT (Narrow width, tall screen)
                   ============================================================ */
                @media (max-width: 900px) and (orientation: portrait) {
                    .col-overlay { padding-bottom: 0; align-items: stretch; }
                    .col-modal { 
                        width: 100vw; height: 100dvh; border-radius: 0; 
                        border-left: none; border-right: none;
                        animation: mm-slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                    }
                    .col-header { flex-direction: column; gap: 15px; padding: 15px 20px; align-items: flex-start; }
                    .col-progression { width: 100%; justify-content: space-between; gap: 15px; border-top: 1px solid rgba(0,255,255,0.1); padding-top: 15px; }
                    .col-level-val { font-size: 2.2rem; }
                    .col-class-info { align-items: flex-start; }
                    .col-xp-bar-heavy { width: clamp(100px, 30vw, 160px); }
                    .col-emblem-wrap { width: 60px; height: 60px; }
                    .col-filter-bar { flex-direction: column; gap: 12px; padding: 12px 20px; align-items: stretch; }
                    .col-filter-bar > div { flex-direction: column; gap: 8px; }
                    .col-tab-group { overflow-x: auto; padding: 4px; display: flex; }
                    .col-tab { padding: 6px 12px; font-size: 0.7rem; flex-shrink: 0; }
                    .col-content { grid-template-columns: 1fr; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 20px; }
                    .col-section { margin-top: 20px; }
                    .stat-box-heavy { padding: 12px; }
                    .stat-v { font-size: 1.8rem; }
                    .grade-grid-heavy { grid-template-columns: repeat(2, 1fr); padding: 10px; }
                    .perf-scroll { height: auto; min-height: 300px; padding: 10px 5px; }
                    .col-btn-heavy { padding: 8px 20px; font-size: 0.9rem; }
                }

                /* ============================================================
                   MOBILE LANDSCAPE — Commercial-Quality HUD Dashboard
                   Completely self-contained, no dependency on portrait styles.
                   ============================================================ */
                @media (max-height: 500px) and (orientation: landscape) {
                    /* --- FOUNDATION --- */
                    .col-overlay { padding: 0; align-items: stretch; justify-content: stretch; }
                    .col-modal { 
                        width: 100vw; height: 100dvh; border-radius: 0; 
                        border: none; border-top: 2px solid ${themeCyan}; border-bottom: 2px solid ${themeCyan};
                        overflow: hidden; display: flex; flex-direction: column;
                    }

                    /* --- TITLE BAR: 18px --- */
                    .col-title-bar { 
                        flex-shrink: 0; padding: 1px 12px; font-size: 0.5rem; letter-spacing: 2px; 
                        border-bottom-color: rgba(0,255,255,0.2);
                    }
                    .col-title-status { width: 5px; height: 5px; }

                    /* --- HEADER: Compact single row ~34px --- */
                    .col-header { 
                        padding: 3px 12px; 
                        flex-direction: row; justify-content: space-between; align-items: center;
                        gap: 12px; flex-shrink: 0; border-bottom-width: 1px;
                        background: linear-gradient(180deg, rgba(0,255,255,0.08), transparent);
                    }
                    .col-profile { gap: 8px; }
                    .col-avatar { width: 26px; height: 26px; border-width: 1.5px; border-radius: 6px; }
                    .col-username { font-size: 0.8rem; letter-spacing: 0; }
                    /* Hide the "NEXUS SYSTEM SYNCED" subtitle on landscape */
                    .col-username + div { display: none; }
                    
                    .col-progression { 
                        gap: 12px; width: auto; border-top: none; padding-top: 0;
                    }
                    .col-level-val { font-size: 1.5rem; text-shadow: 0 0 15px ${themeCyan}; }
                    .col-class-info { 
                        flex-direction: column; align-items: flex-end; gap: 1px; 
                    }
                    .col-class-name { font-size: 0.55rem; letter-spacing: 1px; }
                    .col-xp-bar-heavy { width: 70px; height: 4px; margin-top: 1px; border-width: 1px; border-radius: 2px; }
                    /* XP number text */
                    .col-class-info > div:last-child { font-size: 0.5rem !important; margin-top: 1px !important; opacity: 0.5 !important; }
                    .col-emblem-wrap { width: 28px; height: 28px; }
                    .col-emblem-icon { width: 16px; height: 16px; }

                    /* --- FILTER BAR: Compact single row ~28px --- */
                    .col-filter-bar { 
                        padding: 4px 12px; flex-shrink: 0; 
                        flex-direction: row; justify-content: space-between; align-items: center;
                        background: rgba(0,15,15,0.6); border-bottom-width: 1px;
                    }
                    .col-filter-bar > div { display: flex; flex-direction: row; gap: 8px; }
                    .col-tab-group { padding: 2px; border-radius: 6px; gap: 3px; }
                    .col-tab { padding: 6px 14px; font-size: 0.75rem; border-radius: 5px; border-width: 2px; }
                    .col-btn-heavy { 
                        padding: 6px 24px; font-size: 0.85rem; border-width: 2px; border-radius: 6px; 
                        height: 30px; line-height: 16px;
                    }

                    /* --- MAIN CONTENT: Two columns filling remaining height --- */
                    .col-content { 
                        display: flex; flex-direction: row;
                        padding: 6px 10px 4px 10px; gap: 10px;
                        flex: 1; min-height: 0; overflow: hidden;
                    }
                    
                    /* Left Column: 2 sections stacked, each taking half */
                    .col-left-stats { 
                        flex: 1; display: flex; flex-direction: column; 
                        gap: 6px; height: 100%; min-height: 0; overflow: hidden;
                    }
                    .col-left-stats .col-section { 
                        flex: 1; display: flex; flex-direction: column;
                        margin-top: 0; border-width: 1.5px; border-radius: 6px;
                        overflow: hidden;
                    }
                    .col-sec-tag { 
                        font-size: 0.55rem; padding: 4px 10px; left: 0; top: 0; width: 100%; box-sizing: border-box;
                        height: auto; line-height: normal; border-radius: 0; border-width: 0 0 1px 0;
                        letter-spacing: 1px; color: #fff;
                    }

                    /* Stats Grid */
                    .stats-grid-heavy { 
                        flex: 7; display: grid; grid-template-columns: repeat(3, 1fr);
                        padding: 6px; gap: 6px; align-content: center;
                    }
                    .stat-box-heavy { padding: 6px; border-width: 1px; border-radius: 4px; display: flex; flex-direction: column; justify-content: center; min-height: 50px; }
                    .stat-v { font-size: 1.1rem; }
                    .stat-l { font-size: 0.45rem; margin-top: 2px; letter-spacing: 0.3px; }
                    .stat-box-heavy.wide { grid-column: span 3; }
                    .stat-box-heavy.wide .stat-v { font-size: 1.2rem !important; }

                    /* Grade Grid */
                    .grade-grid-heavy { 
                        flex: 3; display: grid; grid-template-columns: repeat(4, 1fr);
                        padding: 6px; gap: 6px; align-content: center;
                    }
                    .grade-item-heavy { 
                        height: 50px; border-width: 1px; border-radius: 4px; 
                        padding: 2px 0; min-height: 0; flex-direction: column; display: flex; justify-content: center; align-items: center;
                    }
                    .gt-h { font-size: 1.1rem; }
                    .gc-h { font-size: 0.6rem; margin-top: 0; }

                    /* Right Column: Mission log fills full height */
                    .col-right-logs { 
                        flex: 1; display: flex; flex-direction: column; 
                        height: 100%; min-height: 0; overflow: hidden;
                    }
                    .col-right-logs .col-section { 
                        flex: 1; display: flex; flex-direction: column;
                        margin-top: 0; overflow: hidden; border-width: 1.5px; border-radius: 6px;
                    }
                    .perf-scroll { 
                        flex: 1; padding: 6px; gap: 6px; 
                        overflow-y: auto; min-height: 0; display: flex; flex-direction: column;
                    }
                    .perf-scroll::-webkit-scrollbar { width: 6px; }
                    .perf-scroll::-webkit-scrollbar-thumb { border: none; border-radius: 3px; }
                    
                    .perf-item { 
                        display: flex; 
                        flex-direction: column;
                        gap: 3px;
                        padding: 6px 10px; 
                        background: rgba(255,255,255,0.02); 
                        border-radius: 5px; 
                        border: 1px solid rgba(255,255,255,0.08);
                        min-width: 0;
                    }
                    .perf-item:nth-child(even) { background: rgba(0, 255, 255, 0.04); }
                    .pi-name { 
                        font-size: 0.8rem; font-weight: 800; color: #fff; 
                        white-space: nowrap; overflow: hidden; text-overflow: ellipsis; 
                    }
                    .pi-sub-row {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        min-width: 0;
                    }
                    .pi-sub-left { display: flex; align-items: center; gap: 10px; }
                    .pi-grade { font-size: 0.85rem; min-width: 28px; }
                    .pi-score { font-size: 0.8rem; color: rgba(255,255,255,0.7); }
                    .pi-meta { gap: 12px; display: flex; align-items: center; }
                    .pi-meta-item { display: flex; flex-direction: column; gap: 1px; }
                    .pi-meta-item span { font-size: 0.45rem; }
                    .pi-meta-item b { font-size: 0.6rem; }
                }

                /* EMBLEM MODAL */
                .emb-modal-overlay {
                    position: absolute; inset: 0; background: rgba(0,0,0,0.85);
                    display: none; justify-content: center; align-items: center;
                    z-index: 2000; backdrop-filter: blur(10px);
                    animation: mm-fadeIn 0.3s forwards;
                }
                .emb-modal-overlay.active { display: flex; }
                .emb-modal {
                    width: min(850px, 95%); max-height: 85%;
                    background: rgba(0, 15, 15, 0.95);
                    border: 2px solid ${themeCyan}; border-radius: 12px;
                    display: flex; flex-direction: column; overflow: hidden;
                    box-shadow: 0 0 40px rgba(0, 255, 255, 0.2);
                }
                .emb-header {
                    padding: 15px 25px; border-bottom: 2px solid ${themeCyan};
                    display: flex; justify-content: space-between; align-items: center;
                    background: linear-gradient(90deg, rgba(0,255,255,0.2), transparent);
                }
                .emb-title { font-family: 'Goldman', cursive; font-size: 1.2rem; color: #fff; text-shadow: 0 0 10px ${themeCyan}; }
                .emb-grid {
                    padding: 20px; display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
                    gap: 15px; overflow-y: auto; flex: 1;
                }
                .emb-item {
                    background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 8px; padding: 15px 10px; display: flex; flex-direction: column;
                    align-items: center; gap: 10px; transition: 0.2s; position: relative;
                }
                .emb-item.locked { opacity: 0.9; }
                .emb-item.locked .emb-frame, .emb-item.locked .emb-icon { filter: grayscale(100%) brightness(0.1) drop-shadow(0 0 5px rgba(255,255,255,0.2)); }
                .emb-item.unlocked { border-color: rgba(0, 255, 255, 0.3); background: rgba(0, 255, 255, 0.05); }
                .emb-item.unlocked:hover { transform: translateY(-5px); border-color: ${themeCyan}; box-shadow: 0 5px 15px rgba(0,255,255,0.15); }
                .emb-item.current { border-color: #f1c40f; box-shadow: 0 0 20px rgba(241,196,15,0.2); background: rgba(241,196,15,0.05); }
                .emb-icon-wrap { position: relative; width: 60px; height: 60px; }
                .emb-frame, .emb-icon { position: absolute; inset: 0; width: 100%; height: 100%; transition: all 0.3s; }
                .emb-name { font-family: 'Goldman', cursive; font-size: 0.75rem; text-align: center; color: #fff; line-height: 1.2; }
                .emb-item.locked .emb-name { color: #888 !important; }
                .emb-item.locked .emb-lvl { filter: grayscale(100%); opacity: 0.6; }
                .emb-lvl { font-size: 0.65rem; font-weight: 800; color: ${themeCyan}; letter-spacing: 1px; }
                .emb-locked-text { font-size: 0.6rem; color: #ff4757; font-weight: 900; margin-top: -5px; }
                .emb-lock-overlay {
                    position: absolute; inset: -5px; display: flex; justify-content: center; align-items: center;
                    background: rgba(0,0,0,0.3); border-radius: 50%; color: #ff4757; z-index: 10;
                    backdrop-filter: blur(1px); box-shadow: 0 0 15px rgba(255, 71, 87, 0.3);
                }

                /* Mobile landscape overrides */
                @media (max-height: 500px) and (orientation: landscape) {
                    .emb-modal { max-height: 95%; flex-direction: row; }
                    .emb-header { border-bottom: none; border-right: 2px solid ${themeCyan}; flex-direction: column; width: 150px; padding: 15px; }
                    .emb-grid { grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); padding: 10px; gap: 8px; }
                    .emb-item { padding: 10px 5px; gap: 6px; }
                    .emb-icon-wrap { width: 40px; height: 40px; }
                    .emb-name { font-size: 0.6rem; }
                    .emb-lvl { font-size: 0.55rem; }
                }

                @keyframes mm-slideUp {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
            </style>
        `;

        // Recalculate Rank Stats locally for perfect consistency with the list
        const relevantRecords = records.filter(r => r.key_mode === this.currentKeyMode && r.difficulty === this.currentDifficulty);
        
        // Helper to get effective grade consistently
        const getEffectiveGrade = (r: any) => {
            if (r.best_accuracy >= 100) return 'S+';
            if (r.best_grade === 'S+') return 'S'; // Downgrade if AP is lost (legacy)
            return ['S', 'A'].includes(r.best_grade) ? r.best_grade : 'B';
        };

        const localRankStats = {
            rank_s_plus: relevantRecords.filter(r => getEffectiveGrade(r) === 'S+').length,
            rank_s: relevantRecords.filter(r => getEffectiveGrade(r) === 'S').length,
            rank_a: relevantRecords.filter(r => getEffectiveGrade(r) === 'A').length,
            rank_b: relevantRecords.filter(r => getEffectiveGrade(r) === 'B').length,
            total_plays: relevantRecords.reduce((sum, r) => sum + (r.play_count || 0), 0)
        };
        
        // --- Song List Expansion Logic ---
        const allSongs = SystemInitializer.getInstance().getVerifiedSongs();
        
        // Create a combined map of all songs joined with their performance records
        let combinedRecords = allSongs.map(song => {
            const record = records.find(r => 
                r.song_id === song.url && 
                r.key_mode === this.currentKeyMode && 
                r.difficulty === this.currentDifficulty
            );
            return { song, record };
        });

        // Apply Rank Filter if active
        if (this.currentRankFilter) {
            combinedRecords = combinedRecords.filter(cr => {
                if (!cr.record) return false;
                const effectiveGrade = getEffectiveGrade(cr.record);
                if (this.currentRankFilter === 'B') {
                    return effectiveGrade === 'B';
                }
                return effectiveGrade === this.currentRankFilter;
            });
        }

        // Sort: Played songs (recent first), then unplayed songs (alphabetical)
        combinedRecords.sort((a, b) => {
            if (a.record && !b.record) return -1;
            if (!a.record && b.record) return 1;
            
            if (a.record && b.record) {
                return new Date(b.record.last_played_at).getTime() - new Date(a.record.last_played_at).getTime();
            }
            
            return a.song.name.localeCompare(b.song.name);
        });

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
                            <div class="col-emblem-wrap" id="emblem-trigger">
                                <div class="col-emblem-frame" style="color: ${classInfo.color}">${makeUniqueSVG(classInfo.frameSVG, 'main')}</div>
                                <div class="col-emblem-icon">${makeUniqueSVG(classInfo.emblemSVG, 'main')}</div>
                            </div>
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
                            <div class="col-section sec-stats">
                                <div class="col-sec-tag">Operational Stats</div>
                                <div class="stats-grid-heavy">
                                    <div class="stat-box-heavy">
                                        <div class="stat-v">${(stats.max_streak || 0).toLocaleString()}</div>
                                        <div class="stat-l">MAX STREAK // 연속콤보</div>
                                    </div>
                                    <div class="stat-box-heavy">
                                        <div class="stat-v">${(stats.total_notes_hit || 0).toLocaleString()}</div>
                                        <div class="stat-l">TOTAL HITS // 누적콤보</div>
                                    </div>
                                    <div class="stat-box-heavy">
                                        <div class="stat-v">${(stats.play_count || 0).toLocaleString()}</div>
                                        <div class="stat-l">TOTAL PLAYS // 총 플레이</div>
                                    </div>
                                    <div class="stat-box-heavy wide">
                                        <div class="stat-v" style="font-size: 1.8rem;">${(stats.total_score || 0).toLocaleString()}</div>
                                        <div class="stat-l">Total Accumulated Score // 누적 점수</div>
                                    </div>
                                </div>
                            </div>

                            <!-- PERFORMANCE DISTRIBUTION SECTION -->
                             <div class="col-section sec-grade">
                                <div class="col-sec-tag">Performance Rating (TOTAL PLAYS: ${localRankStats.total_plays}) ${this.currentRankFilter ? `(FILTER: ${this.currentRankFilter})` : ''}</div>
                                <div class="grade-grid-heavy">
                                    <div class="grade-item-heavy rank-filter ${this.currentRankFilter === 'S+' ? 'active s_plus' : ''}" data-rank="S+">
                                        <div class="gt-h s_plus">S+</div>
                                        <div class="gc-h">${localRankStats.rank_s_plus}</div>
                                    </div>
                                    <div class="grade-item-heavy rank-filter ${this.currentRankFilter === 'S' ? 'active s' : ''}" data-rank="S">
                                        <div class="gt-h s">S</div>
                                        <div class="gc-h">${localRankStats.rank_s}</div>
                                    </div>
                                    <div class="grade-item-heavy rank-filter ${this.currentRankFilter === 'A' ? 'active a' : ''}" data-rank="A">
                                        <div class="gt-h a">A</div>
                                        <div class="gc-h">${localRankStats.rank_a}</div>
                                    </div>
                                    <div class="grade-item-heavy rank-filter ${this.currentRankFilter === 'B' ? 'active b' : ''}" data-rank="B">
                                        <div class="gt-h b">B</div>
                                        <div class="gc-h">${localRankStats.rank_b}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- MISSION LOGS SECTION -->
                        <div class="col-right-logs">
                            <div class="col-section sec-logs" style="display: flex; flex-direction: column; flex: 1; height: 100%; overflow: hidden;">
                                <div class="col-sec-tag">Mission Archive Log</div>
                                <div class="perf-scroll">
                                    ${combinedRecords.length > 0 ? combinedRecords.map(({ song, record }) => `
                                        <div class="perf-item" style="${!record ? 'opacity: 0.4;' : ''}">
                                            <div class="pi-name">${song.name}</div>
                                            <div class="pi-sub-row">
                                                <div class="pi-sub-left">
                                                    <div class="pi-grade ${record ? (getEffectiveGrade(record) === 'S+' ? 'gt-h s_plus' : getEffectiveGrade(record) === 'S' ? 'gt-h s' : getEffectiveGrade(record) === 'A' ? 'gt-h a' : 'gt-h b') : 'gt-h'}" style="${!record ? 'opacity: 0.2;' : ''}">
                                                        ${record ? getEffectiveGrade(record) : '--'}
                                                    </div>
                                                    <div class="pi-meta">
                                                        ${record ? `
                                                            <div class="pi-meta-item"><span>COMBO</span><b>${record.max_combo}</b></div>
                                                            <div class="pi-meta-item"><span>ACCURACY</span><b>${(record.best_accuracy || 0).toFixed(2)}%</b></div>
                                                            <div class="pi-meta-item"><span>PLAYS</span><b>${record.play_count || 1}</b></div>
                                                        ` : '<span style="letter-spacing: 2px; opacity: 0.3; font-size: 0.6rem;">INITIALIZING_ARCHIVE_DATA</span>'}
                                                    </div>
                                                </div>
                                                <div class="pi-score" style="${!record ? 'opacity: 0.2;' : ''}">${record ? (record.high_score || 0).toLocaleString() : '0'}</div>
                                            </div>
                                        </div>
                                    `).join('') : '<div style="opacity: 0.3; text-align: center; padding: 2rem 0; font-weight: 900; font-size: 1.2rem; letter-spacing: 2px;">LIBRARY EMPTY</div>'}
                                </div>
                            </div>
                        </div>
                        </div>
                    </div>
                    
                    <!-- EMBLEM POPUP MODAL -->
                    <div class="emb-modal-overlay" id="emblem-modal">
                        <div class="emb-modal">
                            <div class="emb-header">
                                <div class="emb-title">MEDAL ARCHIVE</div>
                                <button class="col-btn-heavy" id="close-emblem" style="margin-top: 10px;">CLOSE</button>
                            </div>
                            <div class="emb-grid">
                                ${DJClassSystem.getAllClasses().map(cls => {
                                    const isLocked = level < cls.minLevel;
                                    const isCurrent = classInfo.id === cls.id;
                                    return `
                                        <div class="emb-item ${isLocked ? 'locked' : 'unlocked'} ${isCurrent ? 'current' : ''}">
                                            <div class="emb-icon-wrap">
                                                <div class="emb-frame" style="color: ${cls.color}; filter: drop-shadow(0 0 10px ${cls.bgGlow})">${makeUniqueSVG(cls.frameSVG, 'emb_' + cls.id)}</div>
                                                <div class="emb-icon">${makeUniqueSVG(cls.emblemSVG, 'emb_' + cls.id)}</div>
                                                ${isLocked ? `<div class="emb-lock-overlay">
                                                    <svg viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                                </div>` : ''}
                                            </div>
                                            <div class="emb-name" style="color: ${isLocked ? '#fff' : cls.color}">${cls.name}</div>
                                            <div class="emb-lvl">LV.${cls.minLevel}</div>
                                            ${isLocked ? `<div class="emb-locked-text">LOCKED</div>` : ''}
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.ui.createOverlay('collection-ui', html);
    }

    private attachEventListeners() {
        const modal = document.getElementById('emblem-modal');

        // Close Main Modal
        document.getElementById('close-col')?.addEventListener('click', () => {
            this.hide();
            this.onClose();
        });

        // Toggle Emblem Guide Modal
        document.getElementById('emblem-trigger')?.addEventListener('click', () => {
            modal?.classList.add('active');
        });

        document.getElementById('close-emblem')?.addEventListener('click', () => {
            modal?.classList.remove('active');
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

        const rankFilters = document.querySelectorAll('.rank-filter');
        rankFilters.forEach(box => {
            box.addEventListener('click', () => {
                const rank = (box as HTMLElement).dataset.rank || null;
                if (this.currentRankFilter === rank) {
                    this.currentRankFilter = null;
                } else {
                    this.currentRankFilter = rank;
                }
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
