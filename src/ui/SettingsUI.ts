import { UIManager } from '../core/ui/UIManager';
import { ThemeManager } from '../core/ThemeManager';
import { NoteSkinManager } from '../core/NoteSkinManager';
import { RenderCache } from '../games/rhythm/graphics/RenderCache';
import { MenuMusicManager } from '../core/audio/MenuMusicManager';
import { BackgroundRenderer } from '../core/graphics/BackgroundRenderer';
import { LoadingOverlay } from '../games/rhythm/renderer/LoadingOverlay';

type Tab = 'theme' | 'note' | 'audio' | 'gameplay';

export class SettingsUI {
    private ui: UIManager;
    private onAction: (action: string) => void;
    private activeTab: Tab = 'theme';
    private isCreated: boolean = false;
    private tabContainers: Map<Tab, HTMLElement> = new Map();

    constructor(onAction: (action: string) => void) {
        this.ui = UIManager.getInstance();
        this.onAction = onAction;
    }

    public show(): void {
        this.createShell();
        this.updateTabContent();
        MenuMusicManager.getInstance().playMusic('options');
    }

    /** Build the full overlay shell (once). Tabs & panel frame stay fixed. */
    private createShell(): void {
        if (this.isCreated) return;
        this.isCreated = true;

        const html = `
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Outfit:wght@900&display=swap');

                .settings-overlay {
                    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                    background: transparent; /* FULLY TRANSPARENT v29 */
                    backdrop-filter: none; /* NO BLUR v29 */
                    -webkit-backdrop-filter: none;
                    display: flex; justify-content: center; align-items: center;
                    z-index: 100; font-family: 'Outfit', 'Black Han Sans', sans-serif;
                    opacity: 0; animation: stFadeIn 0.3s forwards ease-out;
                    padding: 20px; box-sizing: border-box;
                }

                @keyframes stFadeIn { to { opacity: 1; } }

                .settings-window {
                    width: 98vw; max-width: 1400px;
                    height: 90vh;
                    display: flex; flex-direction: column;
                    position: relative;
                    --header-btn-height: clamp(50px, 6.5vh, 70px); /* Unified Height v38 */
                }


                /* Header Area (v37 Alignment) */
                .settings-header {
                    display: flex; justify-content: space-between; align-items: flex-end;
                    padding-right: 0; /* Align with panel right edge v37 */
                    gap: 30px; /* Space between tabs and return v37 */
                }


                /* Tabs (v38 Fine-Tuned) */
                .settings-tabs {
                    display: flex; 
                    gap: 6px; /* Breathing Space v38 */
                    margin-bottom: -4px; 
                    z-index: 10;
                    flex-shrink: 0; 
                    align-items: flex-end;
                    padding-top: 15px;
                    flex: 1;
                }



                .tab-btn {
                    flex: 1;
                    min-width: 0;
                    height: var(--header-btn-height); /* Precision Height v38 */
                    display: flex; align-items: center; justify-content: center; /* Center Fit v38 */
                    background: rgba(20, 15, 35, 0.8);
                    border: 3px solid rgba(255, 255, 255, 0.2);
                    border-bottom: none;
                    border-radius: 12px 12px 0 0;
                    color: rgba(255, 255, 255, 0.4);
                    font-family: 'Black Han Sans', sans-serif;
                    font-size: clamp(0.7rem, 1.8vw, 1.1rem); 
                    box-sizing: border-box;
                    font-weight: 900; 
                    cursor: pointer;
                    white-space: nowrap;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    text-transform: uppercase;
                    /* High-Performance 1px Outline v31 */
                    text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
                }
                .tab-btn.active {
                    color: #fff;
                    background: var(--active-color, #00E5FF);
                    border-color: rgba(255,255,255,0.8);
                    z-index: 11;
                    transform: translateY(-2px);
                    text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
                    filter: drop-shadow(0 0 15px var(--active-glow, rgba(0,229,255,0.6)));
                }

                /* Specific Tab Colors (v25 - Swapped v26) */
                .tab-btn.tab-theme.active { --active-color: #A2FF00; --active-glow: rgba(162,255,0,0.6); }
                .tab-btn.tab-note.active { --active-color: #FFD700; --active-glow: rgba(255,215,0,0.6); }
                .tab-btn.tab-audio.active { --active-color: #FF006E; --active-glow: rgba(255,0,110,0.6); }
                .tab-btn.tab-gameplay.active { --active-color: #00E5FF; --active-glow: rgba(0,229,255,0.6); }


                .tab-btn:hover:not(.active) {
                    color: rgba(255,255,255,0.9);
                    background: rgba(60, 50, 80, 0.7);
                    transform: translateY(-4px);
                    border-color: rgba(255, 255, 255, 0.4);
                }

                /* Fixed Return Button (v38 Perfect Sync) */
                .btn-return-fixed {
                    height: var(--header-btn-height); /* IDENTICAL HEIGHT v38 */
                    padding: 0 40px; 
                    margin-bottom: 0px; 
                    background: linear-gradient(135deg, #FF0000 0%, #990000 100%);
                    color: #fff;
                    border: 3px solid #fff;
                    border-radius: 12px;
                    font-family: 'Black Han Sans', sans-serif;
                    font-size: 1.1rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
                    box-shadow: 0 4px 15px rgba(255,0,0,0.3);
                    display: flex; align-items: center; justify-content: center;
                    white-space: nowrap;
                    box-sizing: border-box;
                }


                .btn-return-fixed:hover {
                    filter: brightness(1.2) drop-shadow(0 0 15px rgba(255,0,0,0.5));
                    transform: scale(1.05) translateY(-2px);
                }



                /* Panel (Technika Glass v24 - v29 Pure-Outline) */
                .settings-panel {
                    background: transparent; /* FULLY TRANSPARENT v29 */
                    border: 4px solid rgba(255, 255, 255, 0.8);
                    border-radius: 0 24px 24px 24px;
                    padding: 0;
                    color: #fff;
                    display: flex; flex-direction: column;
                    position: relative;
                    flex: 1; min-height: 0;
                    overflow: hidden;
                    transition: border-color 0.4s ease, box-shadow 0.4s ease;
                    backdrop-filter: none; /* NO BLUR v29 */
                    -webkit-backdrop-filter: none;
                    box-shadow: none; /* REMOVED INSET v29 */
                    z-index: 20;
                }



                /* Tab Content Animation Wrapper (v35 Zero-Padding) */
                #settings-tab-content {
                    flex: 1; display: flex; flex-direction: column;
                    min-height: 0; width: 100%; 
                    padding: 0; /* Box-Free Restoration v35 */
                    box-sizing: border-box;
                    align-items: stretch;
                    opacity: 1; transform: none;
                    transition: opacity 0.15s ease-out, transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    overflow: hidden; /* No global scroll v33 */
                    will-change: opacity, transform;
                }


                #settings-tab-content.transitioning { opacity: 0; transform: scale(0.99) translateY(5px); }


                #settings-tab-content::-webkit-scrollbar { width: 8px; }
                #settings-tab-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.3); border-radius: 4px; }

                /* Tab Containers (v36 Breathing Room) */
                .tab-container-fit {
                    height: 100%; width: 100%; 
                    display: flex; flex-direction: column;
                    overflow: hidden;
                    padding: clamp(12px, 2vw, 24px); /* Professional spacing v36 */
                    box-sizing: border-box;
                }

                .tab-container-scroll {
                    height: 100%; width: 100%;
                    overflow-y: auto;
                    padding: 20px; /* Audio/Gameplay still need padding */
                    box-sizing: border-box;
                }

                .tab-container-scroll::-webkit-scrollbar { width: 6px; }
                .tab-container-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }


                /* Theme Grid (v36 Balanced) */



                /* Theme Grid (v36 Balanced) */
                .theme-grid {
                    display: grid;
                    grid-template-columns: repeat(5, 1fr);
                    grid-template-rows: repeat(2, 1fr);
                    gap: clamp(12px, 2vw, 24px); /* Breathing Room v36 */
                    width: 100%; height: 100%; box-sizing: border-box;
                    padding: 0;
                    flex: 1;
                }





                @media (max-width: 700px) {
                    .theme-grid { grid-template-columns: repeat(4, 1fr); }
                }

                /* Theme Buttons (v36 Rounded Rect) */
                .theme-btn {
                    position: relative; border-radius: 16px; border: 2px solid rgba(255,255,255,0.3);
                    cursor: pointer; display: flex; align-items: flex-end; justify-content: center;
                    padding: clamp(10px, 1.5vh, 20px); transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3); overflow: hidden;
                    height: 100%;
                    background: rgba(255, 255, 255, 0.05);
                }



                .theme-btn::before {
                    content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
                    background: inherit; opacity: 0; transition: 0.2s;
                }
                .theme-btn:hover { transform: translateY(-6px) scale(1.02); box-shadow: 0 12px 30px rgba(0,0,0,0.7); }
                .theme-btn:hover::before { opacity: 0.4; }

                /* NON-selected: no box, just glass v35 */
                .theme-btn:not(.active) {
                    opacity: 1;
                    filter: brightness(0.9);
                }
                .theme-btn:not(.active):hover {
                    background: rgba(255, 255, 255, 0.15);
                    filter: brightness(1.2);
                }


                /* ACTIVE theme: clean highlight + lighter pulse */
                .theme-btn.active {
                    transform: scale(1.04); border-color: #fff !important; border-width: 4px;
                    box-shadow: 0 0 15px rgba(255,255,255,0.6);
                    animation: themePulse 1.5s ease-in-out infinite;
                    opacity: 1; filter: brightness(1.1);
                }
                @keyframes themePulse {
                    0%, 100% { border-color: #fff; transform: scale(1.04); }
                    50% { border-color: #00E5FF; transform: scale(1.06); }
                }

                /* Checkmark badge for active theme */
                .theme-btn.active::after {
                    content: '✓';
                    position: absolute; top: 6px; right: 8px;
                    background: #00E5FF; color: #000;
                    width: 24px; height: 24px; border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 14px; font-weight: 900;
                    z-index: 2;
                }

                .theme-name {
                    position: relative; z-index: 5; /* Above sparkles v44 */
                    font-family: 'Black Han Sans', sans-serif;
                    font-size: clamp(13px, 1.5vw, 17px); font-weight: 800;
                    color: #fff; 
                    text-align: center; width: 100%;
                    text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
                }

                /* Marchen Icon Live Preview v44 */
                .icon-sparkle-marchen {
                    position: absolute;
                    width: 4px; height: 4px;
                    background: #fff;
                    border-radius: 50%;
                    box-shadow: 0 0 10px 2px #fff275, 0 0 4px 1px #fff; /* Pink Bloom Effect */
                    opacity: 0;
                    pointer-events: none;
                    z-index: 1;
                    animation: marchenIconTwinkle 1.8s infinite ease-in-out;
                    will-change: transform, opacity;
                }

                @keyframes marchenIconTwinkle {
                    0%, 100% { opacity: 0; transform: scale(0.3) rotate(45deg); }
                    50% { opacity: 0.8; transform: scale(1.2) rotate(45deg); }
                }

                .theme-btn[data-theme="marchen"] {
                    overflow: hidden;
                }

                /* Sliders & Rows (Technika Gothic v24) */
                .setting-row {
                    display: flex; justify-content: space-between; align-items: center;
                    margin-bottom: clamp(12px, 2vw, 24px); gap: 20px;
                    width: 100%; box-sizing: border-box;
                }
                .setting-row label { 
                    font-family: 'Black Han Sans', sans-serif;
                    font-weight: 700; font-size: clamp(16px, 1.8vw, 24px); 
                    white-space: nowrap; min-width: 140px; 
                    text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
                }

                input[type=range] { flex: 1; cursor: pointer; accent-color: #FF006E; height: 8px; border-radius: 4px; }

                /* Buttons & Global Text Outline (v30) */
                .btn-row { display: flex; justify-content: center; align-items: center; gap: clamp(10px, 2vw, 20px); flex: 1; width: 100%; }
                .glass-btn {
                    font-family: 'Black Han Sans', sans-serif;
                    background: rgba(255,255,255,0.1); border: 2px solid rgba(255,255,255,0.3);
                    padding: clamp(12px, 2.5vw, 18px) clamp(24px, 4.5vw, 40px); border-radius: 30px; color: #fff; font-size: clamp(14px, 2.5vw, 20px); font-weight: 800;
                    cursor: pointer; transition: 0.2s;
                    text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
                    text-transform: uppercase;
                }
                .glass-btn:hover { background: rgba(255,255,255,0.2); transform: translateY(-2px); border-color: #fff; }
                .glass-btn.primary { 
                    background: linear-gradient(135deg, #ff006e 0%, #ff8040 100%); 
                    border-color: #fff;
                    box-shadow: 0 0 20px rgba(255, 0, 110, 0.3);
                }
                .glass-btn.primary:hover { filter: brightness(1.2) drop-shadow(0 0 15px rgba(255,0,110,0.5)); }

                p {
                    text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
                }
                
                .setting-row label {
                    text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
                }

            </style>


            <div class="settings-overlay" id="settings-ui-root">
                <div class="settings-window">
                    <div class="settings-header">
                        <div class="settings-tabs" id="settings-tabs">
                            <button class="tab-btn tab-theme active" data-tab="theme">THEME</button>
                            <button class="tab-btn tab-note" data-tab="note">NOTE</button>
                            <button class="tab-btn tab-audio" data-tab="audio">AUDIO</button>
                            <button class="tab-btn tab-gameplay" data-tab="gameplay">GAMEPLAY</button>
                        </div>
                        <button id="btn-back" class="btn-return-fixed">← APPLY & RETURN</button>
                    </div>
                    <div class="settings-panel" id="settings-panel">
                        <div id="settings-tab-content"></div>
                    </div>
                    </div>


                </div>
            </div>
        `;

        this.ui.createOverlay('settings-ui', html);
        
        // Pre-render all containers v30
        const contentEl = document.getElementById('settings-tab-content');
        if (contentEl) {
            ['theme', 'note', 'audio', 'gameplay'].forEach(t => {
                const container = document.createElement('div');
                container.style.display = 'none';
                container.style.width = '100%';
                // Use fit container for grid tabs, scroll for others v33
                container.className = (t === 'theme' || t === 'note') ? 'tab-container-fit' : 'tab-container-scroll';
                this.activeTab = t as Tab; 
                this.renderActiveTabContent(container);
                contentEl.appendChild(container);
                this.tabContainers.set(t as Tab, container);
                
                if (t === 'theme') this.attachThemeListeners(container);
                if (t === 'note') this.attachSkinListeners(container);
            });

            this.activeTab = 'theme'; 
        }

        this.attachShellListeners();

    }


    /** Only swap visibility + update active states with a deliberate 'READY' loading phase. (v31) */
    private updateTabContent(): void {
        const contentEl = document.getElementById('settings-tab-content');
        if (!contentEl) return;

        // 1. Show Global Unified Loading Screen
        const loading = LoadingOverlay.getInstance();
        loading.show("SYNCHRONIZING ASSETS...");
        contentEl.classList.add('transitioning');

        // 2. Wait for actual assets to be ready (v45 Dynamic Sync)
        (async () => {
            await BackgroundRenderer.getInstance().waitForReady((p) => loading.updateProgress(p));
            
            requestAnimationFrame(() => {
                // Update tab button active states
                document.querySelectorAll('#settings-tabs .tab-btn[data-tab]').forEach(btn => {
                    const tab = btn.getAttribute('data-tab');
                    if (tab === this.activeTab) btn.classList.add('active');
                    else btn.classList.remove('active');
                });

                // Update panel border color
                const panel = document.getElementById('settings-panel');
                if (panel) {
                    let borderColor = '#FFD700';
                    let boxShadow = '0 0 40px rgba(255, 215, 0, 0.3)';
                    if (this.activeTab === 'theme') { borderColor = '#A2FF00'; boxShadow = '0 0 40px rgba(162, 255, 0, 0.3)'; }
                    else if (this.activeTab === 'note') { borderColor = '#FFD700'; boxShadow = '0 0 40px rgba(255, 215, 0, 0.3)'; }
                    else if (this.activeTab === 'audio') { borderColor = '#FF006E'; boxShadow = '0 0 40px rgba(255, 0, 110, 0.3)'; }
                    else if (this.activeTab === 'gameplay') { borderColor = '#00E5FF'; boxShadow = '0 0 40px rgba(0, 229, 255, 0.3)'; }
                    
                    panel.style.borderColor = borderColor;
                    panel.style.boxShadow = boxShadow;
                }

                // Toggle Container Visibility
                this.tabContainers.forEach((container, tab) => {
                    if (tab === this.activeTab) {
                        container.style.display = 'block';
                        this.refreshActiveStatesInContainer(container, tab);
                    } else {
                        container.style.display = 'none';
                    }
                });

                // Clear Transition & Loading
                setTimeout(() => {
                    contentEl.classList.remove('transitioning');
                    loading.hide();
                }, 50);
            });
        })();
    }


    /** Refresh internal button states (e.g. checkmarks) when returning to a tab. */
    private refreshActiveStatesInContainer(container: HTMLElement, tab: Tab): void {
        if (tab === 'theme') {
            const currentThemeId = ThemeManager.getInstance().getCurrentTheme().id;
            container.querySelectorAll('.theme-btn:not(.skin-btn)').forEach(btn => {
                if (btn.getAttribute('data-theme') === currentThemeId) btn.classList.add('active');
                else btn.classList.remove('active');
            });
        } else if (tab === 'note') {
            const currentSkinId = NoteSkinManager.getInstance().getCurrentSkin().id;
            container.querySelectorAll('.skin-btn').forEach(btn => {
                if (btn.getAttribute('data-skin') === currentSkinId) btn.classList.add('active');
                else btn.classList.remove('active');
            });
        }
    }


    private renderActiveTabContent(contentEl: HTMLElement): void {
        const themeManager = ThemeManager.getInstance();
        const currentThemeId = themeManager.getCurrentTheme().id;
        const skinManager = NoteSkinManager.getInstance();
        const currentSkinId = skinManager.getCurrentSkin().id;


        if (this.activeTab === 'theme') {
            const themes = themeManager.getAllThemes();
            
            // v48: Show loading overlay while batch-loading thumbnails
            const loading = LoadingOverlay.getInstance();
            loading.show("PREPARING THEMES...");
            loading.updateProgress(0);

            // Sequential or parallel? Parallel with progress
            let loadedCount = 0;
            const previewPromises = themes.map(async (t) => {
                const url = await RenderCache.getInstance().getBackgroundPreview(t.id);
                loadedCount++;
                loading.updateProgress(Math.floor((loadedCount / themes.length) * 100));
                return { theme: t, url };
            });

            Promise.all(previewPromises).then(results => {
                const themesHtml = results.map(res => {
                    const t = res.theme;
                    let innerHtml = `<span class="theme-name">${t.name}</span>`;
                    
                    // v44: Inject live sparkles for Marchen
                    if (t.id === 'marchen') {
                        const sparkles = Array.from({ length: 8 }).map((_) => {
                            const top = Math.random() * 80 + 10;
                            const left = Math.random() * 80 + 10;
                            const delay = Math.random() * 2;
                            const duration = 1.5 + Math.random() * 1;
                            return `<span class="icon-sparkle-marchen" style="top:${top}%; left:${left}%; animation-delay:${delay}s; animation-duration:${duration}s;"></span>`;
                        }).join('');
                        innerHtml = sparkles + innerHtml;
                    }

                    const bgStyle = res.url ? `background-image: url(${res.url});` : `background: linear-gradient(135deg, ${t.color1}, ${t.color2});`;

                    return `
                    <button class="theme-btn ${t.id === currentThemeId ? 'active' : ''}" 
                            data-theme="${t.id}"
                            style="${bgStyle} border-color: ${t.color3}; background-size: cover; background-position: center; background-repeat: no-repeat;">
                        ${innerHtml}
                    </button>
                    `;
                }).join('');

                contentEl.innerHTML = `
                    <div class="theme-grid">
                        ${themesHtml}
                    </div>
                `;

                // Re-bind listeners as we just replaced the HTML
                this.attachThemeListeners(contentEl);
                loading.hide();
            });

        } else if (this.activeTab === 'note') {
            const renderCache = RenderCache.getInstance();
            const skins = skinManager.getAllSkins();
            const skinsHtml = skins.map(s => {
                const previewUrl = renderCache.getPreviewDataURL(s.id);
                return `
                <button class="theme-btn skin-btn ${s.id === currentSkinId ? 'active' : ''}" data-skin="${s.id}"
                        style="background: linear-gradient(135deg, #333340, #1a1a25); border-color: #555566; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;" title="${s.description}">
                    <img src="${previewUrl}" alt="${s.name}" style="height: 30px; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">
                    <span class="theme-name">${s.name}</span>
                </button>
            `}).join('');

            contentEl.innerHTML = `
                <div class="theme-grid">
                    ${skinsHtml}
                </div>
            `;


        } else if (this.activeTab === 'audio') {
            contentEl.innerHTML = `
                <div class="setting-row" style="width:100%;box-sizing:border-box; padding-top: 10px;">
                    <label>MASTER VOLUME</label>
                    <input type="range" id="master-volume" min="0" max="100" value="80">
                </div>
                <div class="setting-row" style="width:100%;box-sizing:border-box;">
                    <label>SFX VOLUME</label>
                    <input type="range" id="sfx-volume" min="0" max="100" value="100">
                </div>
            `;
        } else if (this.activeTab === 'gameplay') {
            contentEl.innerHTML = `
                <div class="setting-row" style="width:100%;box-sizing:border-box; margin-bottom: 20px; padding-top: 10px;">
                    <label style="flex:1;">UI LAYOUT CONFIGURATION</label>
                    <button id="btn-layout-editor" class="glass-btn primary" style="flex:1;">🎨 OPEN LAYOUT EDITOR</button>
                </div>
                <p style="color: rgba(255,255,255,0.5); font-size: 0.9rem; margin-top: 10px; font-family: 'Outfit';">
                    * 아케이드 터치 스크린 규격에 맞춰 각 UI 요소의 위치와 크기를 자유롭게 조절할 수 있습니다.
                </p>
            `;
            document.getElementById('btn-layout-editor')?.addEventListener('click', () => {
                this.destroy();
                this.onAction('layout_editor');
            });
        }
    }

    /** Attach listeners that live on the shell (tabs, back button). Called once. */
    private attachShellListeners(): void {
        document.querySelectorAll('#settings-tabs .tab-btn[data-tab]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const tab = target.getAttribute('data-tab') as Tab;
                if (tab && tab !== this.activeTab) {
                    this.activeTab = tab;
                    this.updateTabContent();
                }
            });
        });

        document.getElementById('btn-back')?.addEventListener('click', () => {
            this.destroy();
            this.onAction('back');
        });
    }

    /** Attach listeners for theme buttons (Scoped v30). */
    private attachThemeListeners(container: HTMLElement = document.body): void {
        container.querySelectorAll('.theme-btn:not(.skin-btn)').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const themeId = target.getAttribute('data-theme');
                const currentThemeId = ThemeManager.getInstance().getCurrentTheme().id;
                
                // v46: Ignore click if already active
                if (themeId && themeId !== currentThemeId) {
                    ThemeManager.getInstance().setTheme(themeId);
                    this.updateTabContent();
                } else {
                    console.log(`[SettingsUI] Theme ${themeId} is already active. Ignoring click.`);
                }
            });
        });
    }

    private attachSkinListeners(container: HTMLElement = document.body): void {
        container.querySelectorAll('.skin-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const skinId = target.getAttribute('data-skin');
                if (skinId) {
                    NoteSkinManager.getInstance().setSkin(skinId);
                    this.updateTabContent();
                }
            });
        });
    }


    public hide(): void {
        this.destroy();
    }

    public destroy(): void {
        this.isCreated = false;
        const el = document.getElementById('settings-ui');
        if (el) el.remove();
        const root = document.getElementById('settings-ui-root');
        if (root) root.remove();
        MenuMusicManager.getInstance().playMusic('main');
    }
}
