import { UIManager } from '../core/ui/UIManager';
import { ThemeManager, type ScreenContext } from '../core/ThemeManager';

type Tab = 'visual' | 'audio' | 'gameplay';

export class SettingsUI {
    private ui: UIManager;
    private onAction: (action: string) => void;
    private activeTab: Tab = 'visual';
    private activeContext: ScreenContext = 'settings';

    constructor(onAction: (action: string) => void) {
        this.ui = UIManager.getInstance();
        this.onAction = onAction;
    }

    public show(): void {
        ThemeManager.getInstance().setContext('settings');
        this.render();
    }

    private render(): void {
        const themeManager = ThemeManager.getInstance();
        const themes = themeManager.getAllThemes();

        // Context Theme ID
        const currentThemeId = themeManager.getThemeForContext(this.activeContext).id;

        const themesHtml = themes.map(t => `
            <button class="theme-btn ${t.id === currentThemeId ? 'active' : ''}" data-theme="${t.id}" 
                    style="background: linear-gradient(135deg, ${t.color1}, ${t.color2}); border-color: ${t.color3};">
                <span class="theme-name">${t.name}</span>
            </button>
        `).join('');

        let tabContentHtml = '';

        if (this.activeTab === 'visual') {
            tabContentHtml = `
                <div class="settings-section" style="width:100%;box-sizing:border-box;">
                    <div class="context-selector" style="width:100%;box-sizing:border-box;">
                        <button class="ctx-btn ${this.activeContext === 'settings' ? 'active' : ''}" data-ctx="settings">Options Menu</button>
                        <button class="ctx-btn ${this.activeContext === 'menu' ? 'active' : ''}" data-ctx="menu">Main Menu</button>
                        <button class="ctx-btn ${this.activeContext === 'game' ? 'active' : ''}" data-ctx="game">Gameplay</button>
                        <button class="ctx-btn ${this.activeContext === 'title' ? 'active' : ''}" data-ctx="title">Title Screen</button>
                    </div>
                    <div class="theme-grid" style="width:100%;box-sizing:border-box;">
                        ${themesHtml}
                    </div>
                </div>
            `;
        } else if (this.activeTab === 'audio') {
            tabContentHtml = `
                <div class="settings-section" style="width:100%;box-sizing:border-box;">
                    <div class="setting-row" style="width:100%;box-sizing:border-box;">
                        <label>Master Volume</label>
                        <input type="range" id="master-volume" min="0" max="100" value="80">
                    </div>
                    <div class="setting-row" style="width:100%;box-sizing:border-box;">
                        <label>SFX Volume</label>
                        <input type="range" id="sfx-volume" min="0" max="100" value="100">
                    </div>
                </div>
            `;
        } else if (this.activeTab === 'gameplay') {
            tabContentHtml = `
                <div class="settings-section" style="width:100%;box-sizing:border-box;">
                    <div class="btn-row" style="width:100%;box-sizing:border-box;">
                        <button id="btn-layout-editor" class="glass-btn primary">🎨 Customize UI Layout</button>
                    </div>
                </div>
            `;
        }

        const html = `
            <style>
                .settings-overlay {
                    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                    background: rgba(10, 5, 20, 0.6);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    display: flex; justify-content: center; align-items: center;
                    z-index: 100; font-family: 'Nunito', sans-serif;
                    opacity: 0; animation: fadeIn 0.3s forwards ease-out;
                    padding: 20px; box-sizing: border-box;
                }
                @keyframes fadeIn { to { opacity: 1; } }

                /* Main Window — fixed dimensions so panel never resizes between tabs */
                .settings-window {
                    width: 95vw; max-width: 1400px;
                    height: 85vh;
                    display: flex; flex-direction: column;
                }

                /* Tabs - Mimicking the angled panels */
                .settings-tabs {
                    display: flex; gap: clamp(6px, 1vw, 12px); margin-bottom: -4px; z-index: 10;
                    flex-shrink: 0; overflow-x: auto; align-items: flex-end;
                    padding-top: 15px; /* Room for active shadow/transform */
                }
                .settings-tabs::-webkit-scrollbar { display: none; }
                .tab-btn {
                    padding: clamp(10px, 1.5vw, 15px) clamp(20px, 3vw, 40px);
                    background: rgba(30, 25, 45, 0.9);
                    border: 4px solid transparent;
                    border-bottom: none;
                    border-radius: 16px 16px 0 0;
                    color: rgba(255, 255, 255, 0.5);
                    font-size: clamp(14px, 3vw, 18px); font-weight: 900; cursor: pointer;
                    white-space: nowrap;
                    transition: 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }
                .tab-btn.tab-visual.active {
                    background: #00E5FF;
                    color: #000;
                    border-color: #00E5FF;
                    box-shadow: 0 -8px 25px rgba(0, 229, 255, 0.5);
                }
                .tab-btn.tab-audio.active {
                    background: #FF007F;
                    color: #fff;
                    border-color: #FF007F;
                    box-shadow: 0 -8px 25px rgba(255, 0, 127, 0.5);
                }
                .tab-btn.tab-gameplay.active {
                    background: #A1C4FD;
                    color: #000;
                    border-color: #A1C4FD;
                    box-shadow: 0 -8px 25px rgba(161, 196, 253, 0.5);
                }
                .tab-btn:hover:not(.active) {
                    color: rgba(255,255,255,0.9);
                    background: rgba(60, 50, 80, 0.9);
                    transform: translateY(-2px);
                }
                
                .btn-return {
                    margin-left: auto;
                    background: linear-gradient(90deg, #ffba00, #ff6c00);
                    color: #fff !important;
                    border-color: transparent !important;
                    border-radius: 20px 20px 0 0;
                    box-shadow: 0 -4px 15px rgba(255, 150, 0, 0.4);
                }
                .btn-return:hover {
                    filter: brightness(1.2);
                    transform: translateY(-4px);
                }

                /* Panel — flex:1 fills remaining height; stays same size across tabs */
                .settings-panel {
                    background: rgba(15, 10, 25, 0.65);
                    backdrop-filter: blur(24px);
                    -webkit-backdrop-filter: blur(24px);
                    border: 4px solid rgba(255, 255, 255, 0.8);
                    border-radius: 0 24px 24px 24px;
                    padding: clamp(16px, 3vw, 32px); box-sizing: border-box;
                    color: #fff;
                    display: flex; flex-direction: column;
                    position: relative;
                    flex: 1; min-height: 0;
                    overflow: hidden;
                }

                /* Context Selector for Visual Tab — stretches full width */
                .context-selector {
                    display: flex; gap: clamp(8px, 1vw, 12px);
                    margin-bottom: clamp(12px, 2vw, 20px);
                    background: rgba(0,0,0,0.3); padding: 10px 14px; border-radius: 12px;
                    border: 1px solid rgba(255,255,255,0.15);
                    flex-shrink: 0; width: 100%; box-sizing: border-box;
                }
                .ctx-btn {
                    flex: 1; padding: clamp(8px, 1vw, 12px); border-radius: 8px;
                    border: 1px solid transparent; background: transparent;
                    color: rgba(255,255,255,0.5); font-weight: 800; cursor: pointer; transition: 0.2s;
                    font-size: clamp(13px, 1.5vw, 15px); white-space: nowrap; text-align: center;
                }
                .ctx-btn.active {
                    background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.3);
                    color: #00F0FF; box-shadow: 0 0 10px rgba(0,240,255,0.2);
                }
                .ctx-btn:hover:not(.active) { background: rgba(255,255,255,0.05); color: #fff; }

                /* Tab content area — fills remaining panel space, scrolls if needed */
                #settings-tab-content {
                    flex: 1; display: flex; flex-direction: column;
                    min-height: 0; overflow-y: auto;
                    width: 100%; box-sizing: border-box;
                    align-items: stretch;
                }
                .settings-section {
                    display: flex; flex-direction: column; flex: 1;
                    width: 100%; box-sizing: border-box;
                    min-width: 0; align-self: stretch;
                }

                /* Theme Grid — 5 columns, responsive fallback */
                .theme-grid {
                    display: grid;
                    grid-template-columns: repeat(5, 1fr);
                    gap: clamp(10px, 1.5vw, 18px);
                    flex: 1;
                    width: 100%; box-sizing: border-box;
                }
                @media (max-width: 700px) {
                    .theme-grid { grid-template-columns: repeat(3, 1fr); }
                }
                .theme-btn {
                    position: relative; border-radius: 14px; border: 3px solid;
                    cursor: pointer; display: flex; align-items: flex-end; justify-content: center;
                    padding: 10px; transition: all 0.2s cubic-bezier(0.25, 1.5, 0.5, 1);
                    box-shadow: 0 6px 14px rgba(0,0,0,0.4); overflow: hidden;
                    /* Let height be determined by grid, not a fixed value */
                    min-height: 70px;
                }
                .theme-btn::before {
                    content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
                    background: inherit; opacity: 0; transition: 0.2s;
                }
                .theme-btn:hover { transform: translateY(-3px) scale(1.03); box-shadow: 0 8px 20px rgba(0,0,0,0.4); }
                .theme-btn:hover::before { opacity: 0.4; }
                .theme-btn.active {
                    transform: scale(1.03); border-color: #fff !important;
                    box-shadow: 0 0 15px 3px rgba(255,255,255,0.6), inset 0 0 10px rgba(255,255,255,0.5);
                }
                .theme-name {
                    position: relative; z-index: 1; font-size: clamp(11px, 1.2vw, 14px); font-weight: 800;
                    color: #fff; text-shadow: 0 2px 4px rgba(0,0,0,0.8); text-align: center; width: 100%;
                }

                /* Sliders — stretch full width */
                .setting-row {
                    display: flex; justify-content: space-between; align-items: center;
                    margin-bottom: clamp(12px, 2vw, 20px); gap: 20px;
                    width: 100%; box-sizing: border-box;
                }
                .setting-row label { font-weight: 700; font-size: clamp(14px, 1.5vw, 18px); white-space: nowrap; min-width: 140px; }
                input[type=range] { flex: 1; cursor: pointer; accent-color: #FF0055; }
                
                /* Buttons */
                .btn-row { display: flex; justify-content: center; align-items: center; gap: clamp(10px, 2vw, 20px); flex: 1; width: 100%; }
                .glass-btn {
                    background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.3);
                    padding: clamp(10px, 2vw, 12px) clamp(20px, 4vw, 30px); border-radius: 30px; color: #fff; font-size: clamp(14px, 3vw, 16px); font-weight: 800;
                    cursor: pointer; transition: 0.2s; backdrop-filter: blur(5px);
                }
                .glass-btn:hover { background: rgba(255,255,255,0.25); transform: translateY(-2px); }
                .glass-btn.primary { background: linear-gradient(45deg, #FF0055, #f093fb); border-color: #fff; }
                .glass-btn.primary:hover { filter: brightness(1.2); box-shadow: 0 5px 15px rgba(255,0,85,0.4); }
            </style>

            <div class="settings-overlay" id="settings-ui-root">
                <div class="settings-window">
                    <div class="settings-tabs">
                        <button class="tab-btn tab-visual ${this.activeTab === 'visual' ? 'active' : ''}" data-tab="visual">VISUAL</button>
                        <button class="tab-btn tab-audio ${this.activeTab === 'audio' ? 'active' : ''}" data-tab="audio">AUDIO</button>
                        <button class="tab-btn tab-gameplay ${this.activeTab === 'gameplay' ? 'active' : ''}" data-tab="gameplay">GAMEPLAY</button>
                        <button id="btn-back" class="tab-btn btn-return">← APPLY & RETURN</button>
                    </div>
                    ${(() => {
                let borderColor = '#00F0FF';
                let boxShadow = '0 0 40px rgba(0, 240, 255, 0.3)';
                if (this.activeTab === 'audio') { borderColor = '#FF007F'; boxShadow = '0 0 40px rgba(255, 0, 127, 0.3)'; }
                else if (this.activeTab === 'gameplay') { borderColor = '#A1C4FD'; boxShadow = '0 0 40px rgba(161, 196, 253, 0.3)'; }
                return `<div class="settings-panel" style="border-color: ${borderColor}; box-shadow: ${boxShadow}, inset 0 0 30px ${borderColor}66;">`;
            })()}
                        <div id="settings-tab-content" style="flex:1;display:flex;flex-direction:column;width:100%;min-height:0;overflow-y:auto;box-sizing:border-box;">
                            ${tabContentHtml}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // If overlay already exists, we just update it avoiding flicker,
        // Else create it.
        const existing = document.getElementById('settings-ui-root');
        if (existing) {
            existing.outerHTML = html;
        } else {
            this.ui.createOverlay('settings-ui', html);
        }

        this.attachListeners();
    }

    private attachListeners(): void {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const tab = target.getAttribute('data-tab') as Tab;
                if (tab && tab !== this.activeTab) {
                    this.activeTab = tab;
                    this.render();
                }
            });
        });

        // Context switching (Visual tab)
        document.querySelectorAll('.ctx-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const ctx = target.getAttribute('data-ctx') as ScreenContext;
                if (ctx && ctx !== this.activeContext) {
                    this.activeContext = ctx;
                    this.render();
                }
            });
        });

        // Theme Selection (Visual tab)
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const themeId = target.getAttribute('data-theme');
                if (themeId) {
                    ThemeManager.getInstance().setThemeForContext(this.activeContext, themeId);
                    // If we're modifying the 'settings' context while IN settings,
                    // we should force ThemeManager to re-apply / re-notify so BackgroundRenderer picks it up instantly.
                    if (this.activeContext === 'settings') {
                        ThemeManager.getInstance().setContext('settings');
                    }
                    this.render(); // Re-render to update active styling
                }
            });
        });

        // Layout Editor action
        document.getElementById('btn-layout-editor')?.addEventListener('click', () => {
            this.destroy();
            this.onAction('layout_editor');
        });

        // Back Action
        document.getElementById('btn-back')?.addEventListener('click', () => {
            this.destroy();
            this.onAction('back');
        });
    }

    public hide(): void {
        this.destroy();
    }

    public destroy(): void {
        const el = document.getElementById('settings-ui');
        if (el) el.remove();
        const root = document.getElementById('settings-ui-root');
        if (root) root.remove();
    }
}
