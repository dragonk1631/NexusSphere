import { UIManager } from '../core/ui/UIManager';
import { ThemeManager } from '../core/ThemeManager';
import { NoteSkinManager } from '../core/NoteSkinManager';
import { RenderCache } from '../games/rhythm/graphics/RenderCache';
import { MenuMusicManager } from '../core/audio/MenuMusicManager';

type Tab = 'visual' | 'skin' | 'audio' | 'gameplay';

export class SettingsUI {
    private ui: UIManager;
    private onAction: (action: string) => void;
    private activeTab: Tab = 'visual';
    private isCreated: boolean = false;

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
                .settings-overlay {
                    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                    background: rgba(0, 0, 0, 0.08);
                    display: flex; justify-content: center; align-items: center;
                    z-index: 100; font-family: 'Nunito', sans-serif;
                    opacity: 0; animation: stFadeIn 0.3s forwards ease-out;
                    padding: 20px; box-sizing: border-box;
                }
                @keyframes stFadeIn { to { opacity: 1; } }

                .settings-window {
                    width: 98vw; max-width: 1600px;
                    height: 94vh;
                    display: flex; flex-direction: column;
                }

                /* Tabs */
                .settings-tabs {
                    display: flex; gap: clamp(6px, 1vw, 12px); margin-bottom: -4px; z-index: 10;
                    flex-shrink: 0; overflow-x: auto; align-items: flex-end;
                    padding-top: 15px;
                }
                .settings-tabs::-webkit-scrollbar { display: none; }
                .tab-btn {
                    padding: clamp(6px, 1vw, 10px) clamp(12px, 2vw, 25px);
                    background: rgba(30, 25, 45, 0.5);
                    border: 4px solid transparent;
                    border-bottom: none;
                    border-radius: 12px 12px 0 0;
                    color: rgba(255, 255, 255, 0.6);
                    font-size: clamp(14px, 2.2vw, 18px); font-weight: 900; cursor: pointer;
                    white-space: nowrap;
                    transition: all 0.25s ease;
                }
                .tab-btn.tab-visual.active {
                    background: #00E5FF; color: #000; border-color: #00E5FF;
                    box-shadow: 0 -8px 25px rgba(0, 229, 255, 0.5);
                }
                .tab-btn.tab-audio.active {
                    background: #FF007F; color: #fff; border-color: #FF007F;
                    box-shadow: 0 -8px 25px rgba(255, 0, 127, 0.5);
                }
                .tab-btn.tab-gameplay.active {
                    background: #A1C4FD; color: #000; border-color: #A1C4FD;
                    box-shadow: 0 -8px 25px rgba(161, 196, 253, 0.5);
                }
                .tab-btn:hover:not(.active) {
                    color: rgba(255,255,255,0.9);
                    background: rgba(60, 50, 80, 0.7);
                    transform: translateY(-2px);
                }
                .btn-return {
                    margin-left: auto;
                    background: linear-gradient(90deg, #ffba00, #ff6c00);
                    color: #fff !important; border-color: transparent !important;
                    border-radius: 20px 20px 0 0;
                    box-shadow: 0 -4px 15px rgba(255, 150, 0, 0.4);
                }
                .btn-return:hover { filter: brightness(1.2); transform: translateY(-4px); }

                /* Panel */
                .settings-panel {
                    background: rgba(10, 5, 20, 0.15);
                    border: 4px solid rgba(255, 255, 255, 0.8);
                    border-radius: 0 24px 24px 24px;
                    padding: clamp(16px, 3vw, 32px); box-sizing: border-box;
                    color: #fff;
                    display: flex; flex-direction: column;
                    position: relative;
                    flex: 1; min-height: 0;
                    overflow: hidden;
                    transition: border-color 0.3s ease, box-shadow 0.3s ease;
                }

                /* Tab content */
                #settings-tab-content {
                    flex: 1; display: flex; flex-direction: column;
                    min-height: 0;
                    width: 100%; box-sizing: border-box;
                    align-items: stretch;
                }
                .settings-section {
                    display: flex; flex-direction: column; flex: 1;
                    width: 100%; box-sizing: border-box;
                    min-width: 0; align-self: stretch;
                    overflow-y: auto; padding-right: 5px;
                }
                .settings-section::-webkit-scrollbar { width: 8px; }
                .settings-section::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.3); border-radius: 4px; }

                /* Theme Grid */
                .theme-grid {
                    display: grid;
                    grid-template-columns: repeat(5, 1fr);
                    grid-template-rows: 1fr 1fr;
                    gap: clamp(10px, 1.5vw, 18px);
                    flex: 1;
                    width: 100%; box-sizing: border-box;
                    padding: clamp(8px, 1vw, 16px) 0;
                }
                @media (max-width: 700px) {
                    .theme-grid { grid-template-columns: repeat(4, 1fr); }
                }

                /* Theme Buttons */
                .theme-btn {
                    position: relative; border-radius: 14px; border: 3px solid;
                    cursor: pointer; display: flex; align-items: flex-end; justify-content: center;
                    padding: 10px; transition: all 0.2s cubic-bezier(0.25, 1.5, 0.5, 1);
                    box-shadow: 0 6px 14px rgba(0,0,0,0.4); overflow: hidden;
                    min-height: 60px;
                }
                .theme-btn::before {
                    content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
                    background: inherit; opacity: 0; transition: 0.2s;
                }
                .theme-btn:hover { transform: translateY(-4px) scale(1.05); box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
                .theme-btn:hover::before { opacity: 0.4; }

                /* NON-selected: dim slightly */
                .theme-btn:not(.active) {
                    opacity: 0.6;
                    filter: brightness(0.75);
                }
                .theme-btn:not(.active):hover {
                    opacity: 0.9;
                    filter: brightness(1);
                }

                /* ACTIVE theme: bold glow + animated pulse */
                .theme-btn.active {
                    transform: scale(1.06); border-color: #fff !important; border-width: 4px;
                    box-shadow: 0 0 25px 6px rgba(255,255,255,0.8), inset 0 0 15px rgba(255,255,255,0.4);
                    animation: themePulse 2s ease-in-out infinite;
                    opacity: 1; filter: brightness(1.1);
                }
                @keyframes themePulse {
                    0%, 100% { box-shadow: 0 0 25px 6px rgba(255,255,255,0.8), inset 0 0 15px rgba(255,255,255,0.4); }
                    50% { box-shadow: 0 0 35px 10px rgba(255,255,255,1), inset 0 0 20px rgba(255,255,255,0.6); }
                }

                /* Checkmark badge for active theme */
                .theme-btn.active::after {
                    content: '✓';
                    position: absolute; top: 6px; right: 8px;
                    background: #00E5FF; color: #000;
                    width: 24px; height: 24px; border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 14px; font-weight: 900;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.5);
                    z-index: 2;
                }

                .theme-name {
                    position: relative; z-index: 1; font-size: clamp(13px, 1.5vw, 17px); font-weight: 800;
                    color: #fff; text-shadow: 0 2px 6px rgba(0,0,0,0.9); text-align: center; width: 100%;
                }

                /* Sliders */
                .setting-row {
                    display: flex; justify-content: space-between; align-items: center;
                    margin-bottom: clamp(12px, 2vw, 20px); gap: 20px;
                    width: 100%; box-sizing: border-box;
                }
                .setting-row label { font-weight: 700; font-size: clamp(16px, 1.8vw, 22px); white-space: nowrap; min-width: 140px; }
                input[type=range] { flex: 1; cursor: pointer; accent-color: #FF0055; }

                /* Buttons */
                .btn-row { display: flex; justify-content: center; align-items: center; gap: clamp(10px, 2vw, 20px); flex: 1; width: 100%; }
                .glass-btn {
                    background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.3);
                    padding: clamp(12px, 2.5vw, 16px) clamp(24px, 4.5vw, 36px); border-radius: 30px; color: #fff; font-size: clamp(16px, 3.5vw, 20px); font-weight: 800;
                    cursor: pointer; transition: 0.2s;
                }
                .glass-btn:hover { background: rgba(255,255,255,0.25); transform: translateY(-2px); }
                .glass-btn.primary { background: linear-gradient(45deg, #FF0055, #f093fb); border-color: #fff; }
                .glass-btn.primary:hover { filter: brightness(1.2); box-shadow: 0 5px 15px rgba(255,0,85,0.4); }
            </style>

            <div class="settings-overlay" id="settings-ui-root">
                <div class="settings-window">
                    <div class="settings-tabs" id="settings-tabs">
                        <button class="tab-btn tab-visual active" data-tab="visual">VISUAL</button>
                        <button class="tab-btn tab-skin" data-tab="skin">SKIN</button>
                        <button class="tab-btn tab-audio" data-tab="audio">AUDIO</button>
                        <button class="tab-btn tab-gameplay" data-tab="gameplay">GAMEPLAY</button>
                        <button id="btn-back" class="tab-btn btn-return">← APPLY & RETURN</button>
                    </div>
                    <div class="settings-panel" id="settings-panel">
                        <div id="settings-tab-content" style="flex:1;display:flex;flex-direction:column;width:100%;min-height:0;box-sizing:border-box;"></div>
                    </div>
                </div>
            </div>
        `;

        this.ui.createOverlay('settings-ui', html);
        this.attachShellListeners();
    }

    /** Only swap the inner tab content + update tab button classes. No full DOM replace = zero flicker. */
    private updateTabContent(): void {
        const contentEl = document.getElementById('settings-tab-content');
        if (!contentEl) return;

        // 1. Update tab button active states (no re-render)
        document.querySelectorAll('#settings-tabs .tab-btn[data-tab]').forEach(btn => {
            const tab = btn.getAttribute('data-tab');
            if (tab === this.activeTab) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        // 2. Update panel border color smoothly via CSS transition
        const panel = document.getElementById('settings-panel');
        if (panel) {
            let borderColor = '#00F0FF';
            let boxShadow = '0 0 40px rgba(0, 240, 255, 0.3)';
            if (this.activeTab === 'skin') { borderColor = '#FFD700'; boxShadow = '0 0 40px rgba(255, 215, 0, 0.3)'; }
            else if (this.activeTab === 'audio') { borderColor = '#FF007F'; boxShadow = '0 0 40px rgba(255, 0, 127, 0.3)'; }
            else if (this.activeTab === 'gameplay') { borderColor = '#A1C4FD'; boxShadow = '0 0 40px rgba(161, 196, 253, 0.3)'; }
            panel.style.borderColor = borderColor;
            panel.style.boxShadow = `${boxShadow}, inset 0 0 30px ${borderColor}66`;
        }

        // 3. Build only the inner content
        const themeManager = ThemeManager.getInstance();
        const currentThemeId = themeManager.getCurrentTheme().id;
        const skinManager = NoteSkinManager.getInstance();
        const currentSkinId = skinManager.getCurrentSkin().id;

        if (this.activeTab === 'visual') {
            const themes = themeManager.getAllThemes();
            const themesHtml = themes.map(t => `
                <button class="theme-btn ${t.id === currentThemeId ? 'active' : ''}" data-theme="${t.id}"
                        style="background: linear-gradient(135deg, ${t.color1}, ${t.color2}); border-color: ${t.color3};">
                    <span class="theme-name">${t.name}</span>
                </button>
            `).join('');

            contentEl.innerHTML = `
                <div class="settings-section" style="width:100%;box-sizing:border-box;">
                    <h3 style="margin: 0 0 10px 0; font-size: 20px; color: #fff; text-shadow: 0 2px 5px rgba(0,0,0,0.5);">Game Background Theme</h3>
                    <div class="theme-grid" style="width:100%;box-sizing:border-box; margin-bottom: 24px;">
                        ${themesHtml}
                    </div>
                </div>
            `;
            this.attachThemeListeners();
        } else if (this.activeTab === 'skin') {
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
                <div class="settings-section" style="width:100%;box-sizing:border-box;">
                    <h3 style="margin: 0 0 10px 0; font-size: 20px; color: #fff; text-shadow: 0 2px 5px rgba(0,0,0,0.5);">Note & Receptor Skin</h3>
                    <div class="theme-grid" style="width:100%;box-sizing:border-box; margin-bottom: 24px;">
                        ${skinsHtml}
                    </div>
                </div>
            `;
            this.attachSkinListeners();
        } else if (this.activeTab === 'audio') {
            contentEl.innerHTML = `
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
            contentEl.innerHTML = `
                <div class="settings-section" style="width:100%;box-sizing:border-box;">
                    <div class="btn-row" style="width:100%;box-sizing:border-box;">
                        <button id="btn-layout-editor" class="glass-btn primary">🎨 Customize UI Layout</button>
                    </div>
                </div>
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

    /** Attach listeners for theme buttons (re-attached when visual tab content is swapped). */
    private attachThemeListeners(): void {
        document.querySelectorAll('.theme-btn:not(.skin-btn)').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const themeId = target.getAttribute('data-theme');
                if (themeId) {
                    ThemeManager.getInstance().setTheme(themeId);
                    this.updateTabContent(); // Only updates inner content
                }
            });
        });
    }

    private attachSkinListeners(): void {
        document.querySelectorAll('.skin-btn').forEach(btn => {
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
