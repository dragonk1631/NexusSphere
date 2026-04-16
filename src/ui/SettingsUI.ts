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

    public async show(): Promise<void> {
        // 1. Show global loading overlay immediately (covers the whole screen)
        const loading = LoadingOverlay.getInstance();
        loading.show("PREPARING SETTINGS..."); 
        loading.updateProgress(0);

        // 2. Pre-create shell but keep hidden/transparent
        this.createShell();
        const root = document.getElementById('settings-ui-root');
        if (root) root.style.opacity = '0'; // Keep hidden

        // 3. Batch load ALL thumbnails & background state before displaying shell
        try {
            await this.preLoadAllAssets((progress) => {
                loading.updateProgress(progress); // Assuming preLoadAllAssets now returns 0.0-1.0
            });
        } catch (e) {
            console.error("[SettingsUI] Pre-load failed", e);
        }

        // 4. Everything is ready, show UI and hide loading
        this.updateTabContentUI();
        MenuMusicManager.getInstance().playMusic('options');

        requestAnimationFrame(() => {
            if (root) {
                root.style.transition = 'opacity 0.4s ease-out';
                root.style.opacity = '1';
            }
            loading.hide();
        });
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


    /** New: Pre-load all thumbnails and wait for BackgroundRenderer */
    private async preLoadAllAssets(onProgress: (p: number) => void): Promise<void> {
        const themeManager = ThemeManager.getInstance();
        const themes = themeManager.getAllThemes();
        const renderCache = RenderCache.getInstance();

        // Pass 1: Background Renderer (30% of progress) - waitForReady returns 0.0-1.0
        await BackgroundRenderer.getInstance().waitForReady((p) => onProgress(p * 0.3));

        // Pass 2: Theme Thumbnails (70% of progress)
        let loaded = 0;
        await Promise.all(themes.map(async (t) => {
            await renderCache.getBackgroundPreview(t.id);
            loaded++;
            onProgress(0.3 + (loaded / themes.length) * 0.7);
        }));
    }

    /** Restore: Shows loading while BackgroundRenderer is updating */
    private async switchWithLoading(status: string, action: () => void): Promise<void> {
        const loading = LoadingOverlay.getInstance();
        loading.show(status);
        
        try {
            action();
            // Wait for BackgroundRenderer to settle on the new state
            await BackgroundRenderer.getInstance().waitForReady((p) => loading.updateProgress(p));
        } finally {
            requestAnimationFrame(() => {
                this.updateTabContentUI();
                loading.hide();
            });
        }
    }

    /** Renamed from updateTabContent to focus purely on UI state application */
    private updateTabContentUI(): void {
        const contentEl = document.getElementById('settings-tab-content');
        if (!contentEl) return;

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

            // Sync all containers
            this.tabContainers.forEach((container, tab) => {
                if (tab === this.activeTab) {
                    container.style.display = 'block';
                    // Re-render certain tabs to ensure the correct theme/skin is highlighted
                    this.renderActiveTabContent(container);
                } else {
                    container.style.display = 'none';
                }
            });
        });
    }

    /** Refresh or render the content for the currently active tab */
    private renderActiveTabContent(container: HTMLElement): void {
        const themeManager = ThemeManager.getInstance();
        const currentThemeId = themeManager.getCurrentTheme().id;
        const skinManager = NoteSkinManager.getInstance();
        const currentSkinId = skinManager.getCurrentSkin().id;
        const renderCache = RenderCache.getInstance();

        if (this.activeTab === 'theme') {
            const themes = themeManager.getAllThemes();
            const themesHtml = themes.map(t => {
                // Since we pre-loaded, this will be instant from memory
                const url = renderCache.getBackgroundPreviewUrlLocal(t.id);
                
                let innerHtml = `<span class="theme-name">${t.name}</span>`;
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

                const bgStyle = url ? `background-image: url(${url});` : `background: linear-gradient(135deg, ${t.color1}, ${t.color2});`;

                return `
                <button class="theme-btn ${t.id === currentThemeId ? 'active' : ''}" 
                        data-theme="${t.id}"
                        style="${bgStyle} border-color: ${t.color3}; background-size: cover; background-position: center; background-repeat: no-repeat;">
                    ${innerHtml}
                </button>
                `;
            }).join('');

            container.innerHTML = `
                <div class="theme-grid">
                    ${themesHtml}
                </div>
            `;
            this.attachThemeListeners(container);

        } else if (this.activeTab === 'note') {
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

            container.innerHTML = `
                <div class="theme-grid">
                    ${skinsHtml}
                </div>
            `;
            this.attachSkinListeners(container);

        } else if (this.activeTab === 'audio') {
            container.innerHTML = `
                <div class="setting-row" style="width:100%;box-sizing:border-box; padding-top: 10px;">
                    <label>MASTER VOLUME</label>
                    <input type="range" id="master-volume" min="0" max="100" value="80">
                </div>
                <div class="setting-row" style="width:100%;box-sizing:border-box;">
                    <label>SFX VOLUME</label>
                    <input type="range" id="sfx-volume" min="0" max="100" value="100">
                </div>
            `;
            // Add listeners for audio sliders if needed (omitted for brevity as per existing pattern)
        } else if (this.activeTab === 'gameplay') {
            const showFps = localStorage.getItem('nexus_show_fps') === 'true';
            container.innerHTML = `
                <style>
                    /* Toggle Switch Style v51 - Compact Version */
                    .nexus-switch {
                        position: relative; display: inline-block;
                        width: 48px; height: 24px;
                        flex-shrink: 0;
                    }
                    .nexus-switch input { opacity: 0; width: 0; height: 0; }
                    .nexus-slider {
                        position: absolute; cursor: pointer;
                        top: 0; left: 0; right: 0; bottom: 0;
                        background-color: rgba(255,255,255,0.1);
                        transition: .25s; border-radius: 20px;
                        border: 2px solid rgba(255,255,255,0.3);
                    }
                    .nexus-slider:before {
                        position: absolute; content: "";
                        height: 18px; width: 18px;
                        left: 1px; bottom: 1px;
                        background-color: #fff;
                        transition: .25s; border-radius: 50%;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.4);
                    }
                    input:checked + .nexus-slider {
                        background-color: #00E5FF;
                        border-color: #fff;
                        box-shadow: 0 0 12px rgba(0,229,255,0.5);
                    }
                    input:checked + .nexus-slider:before {
                        transform: translateX(24px);
                    }

                    .dev-options-box {
                        background: rgba(0, 0, 0, 0.75);
                        border: 2px solid rgba(255, 255, 255, 0.25);
                        border-radius: 20px;
                        padding: 24px;
                        margin-top: 10px;
                        box-shadow: 0 12px 40px rgba(0,0,0,0.6);
                        backdrop-filter: blur(12px);
                        -webkit-backdrop-filter: blur(12px);
                        display: flex;
                        flex-direction: column;
                        gap: 16px;
                    }
                    
                    .dev-header-row {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        width: 100%;
                    }

                    .dev-label {
                        font-family: 'Black Han Sans', sans-serif;
                        color: #fff;
                        font-size: 1.4rem;
                        text-shadow: -1.5px -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 1.5px 0 #000, 1.5px 1.5px 0 #000;
                        letter-spacing: 1px;
                        margin: 0;
                    }

                    .dev-status-wrapper {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                    }

                    .dev-status-text {
                        font-size: 0.95rem;
                        font-weight: 800;
                        color: #00E5FF;
                        text-transform: uppercase;
                        text-shadow: 1px 1px 2px #000;
                    }

                    .dev-desc {
                        color: rgba(255,255,255,0.9);
                        font-size: 0.95rem;
                        font-family: 'Outfit';
                        font-weight: 600;
                        text-shadow: 1px 1px 3px #000;
                        line-height: 1.6;
                        margin: 0;
                        padding-top: 12px;
                        border-top: 1px solid rgba(255,255,255,0.1);
                    }

                    .dev-option-row {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        width: 100%;
                        gap: 15px;
                        padding: 8px 0;
                    }

                    .dev-option-label {
                        font-family: 'Outfit';
                        font-size: 1rem;
                        font-weight: 800;
                        color: rgba(255,255,255,0.85);
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }

                    .dev-action-btn {
                        background: linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%);
                        border: 2px solid #fff;
                        color: #fff;
                        padding: 6px 16px;
                        border-radius: 8px;
                        font-family: 'Black Han Sans', sans-serif;
                        font-size: 0.9rem;
                        cursor: pointer;
                        transition: 0.2s;
                        text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
                        box-shadow: 0 4px 12px rgba(255, 65, 108, 0.3);
                    }
                    .dev-action-btn:hover {
                        transform: scale(1.05);
                        filter: brightness(1.2);
                        box-shadow: 0 0 20px rgba(255, 65, 108, 0.6);
                    }
                    .dev-action-btn:active { transform: scale(0.95); }
                </style>

                <div class="dev-options-box">
                    <h3 class="dev-label">DEVELOPER OPTIONS</h3>
                    
                    <div class="dev-option-row">
                        <span class="dev-option-label">FPS MONITOR</span>
                        <label class="nexus-switch">
                            <input type="checkbox" id="check-show-fps" ${showFps ? 'checked' : ''}>
                            <span class="nexus-slider"></span>
                        </label>
                    </div>

                    <div class="dev-option-row">
                        <span class="dev-option-label">STORAGE MANAGEMENT</span>
                        <button class="dev-action-btn" id="btn-force-reset">PURGE & RELOAD</button>
                    </div>

                    <p class="dev-desc">
                        * 개발자 옵션은 엔진 성능을 모니터링하거나 비정상적인 캐시 상태를 강제로 초기화할 때 사용합니다. 
                        PURGE 액션 실행 시 모든 곡 데이터와 설정이 소거되므로 주의하십시오.
                    </p>
                </div>
            `;
            
            const fpsCheck = container.querySelector('#check-show-fps') as HTMLInputElement;
            fpsCheck?.addEventListener('change', (e) => {
                const checked = (e.target as HTMLInputElement).checked;
                localStorage.setItem('nexus_show_fps', checked.toString());
                window.dispatchEvent(new CustomEvent('nexus-setting-changed', { 
                    detail: { key: 'nexus_show_fps', value: checked } 
                }));
            });

            const resetBtn = container.querySelector('#btn-force-reset');
            resetBtn?.addEventListener('click', () => this.handleForceReset());
        }
    }

    private async handleForceReset(): Promise<void> {
        const msg = "주의: 모든 게임 데이터(다운로드된 곡, 커스텀 설정, 점수)가 완전히 삭제됩니다.\n캐시 오염이나 자산 누락 문제를 해결하기 위해 엔진을 초기 수렴 상태로 되돌리시겠습니까?";
        if (!confirm(msg)) return;

        const loading = LoadingOverlay.getInstance();
        loading.show("PURGING ALL ENGINE DATA...");
        loading.updateProgress(0.3);

        try {
            // 1. Clear Service Worker Caches
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map(name => caches.delete(name)));
            }
            loading.updateProgress(0.6);

            // 2. Clear LocalStorage / SessionStorage
            localStorage.clear();
            sessionStorage.clear();
            loading.updateProgress(0.8);

            // 3. Clear IndexedDB (BinaryVault)
            // Note: We attempt to delete all discovered DBs if the browser supports it
            if ('indexedDB' in window && (window.indexedDB as any).databases) {
                const dbs = await (window.indexedDB as any).databases();
                for (const db of dbs) {
                    if (db.name) window.indexedDB.deleteDatabase(db.name);
                }
            } else {
                // Fallback: Delete known DB names if databases() is not available
                window.indexedDB.deleteDatabase('BinaryVault');
                window.indexedDB.deleteDatabase('LocalSongStorage');
            }
            
            loading.updateProgress(1.0);
            
            // Allow some time for the final progress display
            await new Promise(r => setTimeout(r, 500));
            window.location.reload();
        } catch (e) {
            console.error("[SettingsUI] Purge failed:", e);
            loading.hide();
            alert("초기화 과정 중 오류가 발생했습니다. 브라우저 설정에서 직접 데이터를 지워주세요.");
        }
    }

    private attachShellListeners(): void {
        document.querySelectorAll('#settings-tabs .tab-btn[data-tab]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const tab = target.getAttribute('data-tab') as Tab;
                if (tab && tab !== this.activeTab) {
                    this.activeTab = tab;
                    this.updateTabContentUI();
                }
            });
        });

        document.getElementById('btn-back')?.addEventListener('click', () => {
            this.destroy();
            this.onAction('back');
        });
    }

    private attachThemeListeners(container: HTMLElement): void {
        container.querySelectorAll('.theme-btn:not(.skin-btn)').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const themeId = target.getAttribute('data-theme');
                const themeManager = ThemeManager.getInstance();
                const currentThemeId = themeManager.getCurrentTheme().id;
                
                if (themeId && themeId !== currentThemeId) {
                    void this.switchWithLoading("CHANGING THEME...", () => {
                        themeManager.setTheme(themeId);
                    });
                }
            });
        });
    }

    private attachSkinListeners(container: HTMLElement): void {
        container.querySelectorAll('.skin-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const skinId = target.getAttribute('data-skin');
                if (skinId) {
                    void this.switchWithLoading("CHANGING SKIN...", () => {
                        NoteSkinManager.getInstance().setSkin(skinId);
                    });
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
