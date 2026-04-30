import { UIManager } from '../core/ui/UIManager';
import { MenuMusicManager } from '../core/audio/MenuMusicManager';
import { LoadingOverlay } from '../games/rhythm/renderer/LoadingOverlay';

type Tab = 'audio' | 'gameplay';

export class SettingsUI {
    private ui: UIManager;
    private onAction: (action: string) => void;
    private activeTab: Tab = 'audio';
    private isCreated: boolean = false;
    private tabContainers: Map<Tab, HTMLElement> = new Map();

    constructor(onAction: (action: string) => void) {
        this.ui = UIManager.getInstance();
        this.onAction = onAction;
    }

    public async show(): Promise<void> {
        this.createShell();
        const root = document.getElementById('settings-ui-root');
        if (root) root.style.opacity = '1';
        
        this.updateTabContentUI();
        MenuMusicManager.getInstance().playMusic('options');
    }

    private createShell(): void {
        if (this.isCreated) return;
        this.isCreated = true;

        const html = `
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Outfit:wght@900&display=swap');

                .settings-overlay {
                    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                    background: rgba(0, 0, 0, 0.4);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    display: flex; justify-content: center; align-items: center;
                    z-index: 100; font-family: 'Outfit', 'Black Han Sans', sans-serif;
                    opacity: 0; animation: stFadeIn 0.3s forwards ease-out;
                    padding: 20px; box-sizing: border-box;
                }

                @keyframes stFadeIn { to { opacity: 1; } }

                .settings-window {
                    width: 80vw; max-width: 900px;
                    height: 70vh;
                    display: flex; flex-direction: column;
                    position: relative;
                    gap: 20px;
                    --header-btn-height: clamp(50px, 6.5vh, 70px); 
                }

                .settings-header {
                    display: flex; justify-content: space-between; align-items: flex-end;
                    padding: 10px 0 0 0;
                    gap: 30px; 
                }

                .settings-tabs {
                    display: flex; gap: 6px; margin-bottom: -4px; z-index: 10;
                    flex-shrink: 0; align-items: flex-end; padding-top: 15px; flex: 1;
                }

                .tab-btn {
                    flex: 1; min-width: 0; height: var(--header-btn-height);
                    display: flex; align-items: center; justify-content: center;
                    background: rgba(20, 15, 35, 0.8);
                    border: 3px solid rgba(255, 255, 255, 0.2);
                    border-bottom: none; border-radius: 12px 12px 0 0;
                    color: rgba(255, 255, 255, 0.4);
                    font-family: 'Black Han Sans', sans-serif;
                    font-size: clamp(0.7rem, 1.8vw, 1.1rem); 
                    box-sizing: border-box; font-weight: 900; 
                    cursor: pointer; white-space: nowrap;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    text-transform: uppercase;
                    text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
                }
                .tab-btn.active {
                    color: #fff; background: var(--active-color, #00E5FF);
                    border-color: rgba(255,255,255,0.8); z-index: 11;
                    transform: translateY(-2px);
                    filter: drop-shadow(0 0 15px var(--active-glow, rgba(0,229,255,0.6)));
                }

                .tab-btn.tab-audio.active { --active-color: #FF006E; --active-glow: rgba(255,0,110,0.6); }
                .tab-btn.tab-gameplay.active { --active-color: #00E5FF; --active-glow: rgba(0,229,255,0.6); }

                .btn-return-fixed {
                    height: var(--header-btn-height); padding: 0 40px; 
                    background: linear-gradient(135deg, #FF0000 0%, #990000 100%);
                    color: #fff; border: 3px solid #fff; border-radius: 12px;
                    font-family: 'Black Han Sans', sans-serif; font-size: 1.1rem;
                    cursor: pointer; transition: all 0.2s;
                    text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
                    box-shadow: 0 4px 15px rgba(255,0,0,0.3);
                    display: flex; align-items: center; justify-content: center;
                }

                .settings-panel {
                    background: rgba(10, 10, 30, 0.8);
                    border: 4px solid rgba(255, 255, 255, 0.8);
                    border-radius: 0 24px 24px 24px;
                    padding: 0; color: #fff;
                    display: flex; flex-direction: column;
                    position: relative; flex: 1; min-height: 0;
                    overflow: hidden; z-index: 20;
                }

                #settings-tab-content {
                    flex: 1; display: flex; flex-direction: column;
                    min-height: 0; width: 100%; padding: 0;
                    box-sizing: border-box; align-items: stretch;
                    overflow: hidden;
                }

                .tab-container-scroll {
                    height: 100%; width: 100%; overflow-y: auto;
                    padding: 30px; box-sizing: border-box;
                }

                .setting-row {
                    display: flex; justify-content: space-between; align-items: center;
                    margin-bottom: 24px; gap: 20px;
                    width: 100%; box-sizing: border-box;
                }
                .setting-row label { 
                    font-family: 'Black Han Sans', sans-serif;
                    font-weight: 700; font-size: 1.5rem; 
                    white-space: nowrap; min-width: 200px; 
                    text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
                }
                input[type=range] { flex: 1; cursor: pointer; accent-color: #FF006E; height: 8px; border-radius: 4px; }
                
                .dev-options-box {
                    background: rgba(0, 0, 0, 0.75);
                    border: 2px solid rgba(255, 255, 255, 0.25);
                    border-radius: 20px; padding: 24px; margin-top: 10px;
                    box-shadow: 0 12px 40px rgba(0,0,0,0.6);
                    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
                    display: flex; flex-direction: column; gap: 16px;
                }
                .dev-label {
                    font-family: 'Black Han Sans', sans-serif; color: #fff;
                    font-size: 1.4rem; text-shadow: -1.5px -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 1.5px 0 #000, 1.5px 1.5px 0 #000;
                    letter-spacing: 1px; margin: 0;
                }
                .dev-option-row {
                    display: flex; justify-content: space-between; align-items: center;
                    width: 100%; gap: 15px; padding: 8px 0;
                }
                .dev-option-label {
                    font-family: 'Outfit'; font-size: 1rem; font-weight: 800;
                    color: rgba(255,255,255,0.85); text-transform: uppercase; letter-spacing: 0.5px;
                }
                .dev-action-btn {
                    background: linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%);
                    border: 2px solid #fff; color: #fff; padding: 6px 16px;
                    border-radius: 8px; font-family: 'Black Han Sans', sans-serif;
                    font-size: 0.9rem; cursor: pointer; transition: 0.2s;
                    text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
                    box-shadow: 0 4px 12px rgba(255, 65, 108, 0.3);
                }
            </style>

            <div class="settings-overlay" id="settings-ui-root">
                <div class="settings-window">
                    <div class="settings-header">
                        <div class="settings-tabs" id="settings-tabs">
                            <button class="tab-btn tab-audio active" data-tab="audio">AUDIO</button>
                            <button class="tab-btn tab-gameplay" data-tab="gameplay">GAMEPLAY</button>
                        </div>
                        <button id="btn-back" class="btn-return-fixed">← APPLY & RETURN</button>
                    </div>
                    <div class="settings-panel" id="settings-panel">
                        <div id="settings-tab-content"></div>
                    </div>
                </div>
            </div>
        `;

        this.ui.createOverlay('settings-ui', html);
        
        const contentEl = document.getElementById('settings-tab-content');
        if (contentEl) {
            ['audio', 'gameplay'].forEach(t => {
                const container = document.createElement('div');
                container.style.display = 'none';
                container.className = 'tab-container-scroll';
                this.activeTab = t as Tab; 
                this.renderActiveTabContent(container);
                contentEl.appendChild(container);
                this.tabContainers.set(t as Tab, container);
            });
            this.activeTab = 'audio'; 
        }

        this.attachShellListeners();
    }

    private updateTabContentUI(): void {
        const contentEl = document.getElementById('settings-tab-content');
        if (!contentEl) return;

        document.querySelectorAll('#settings-tabs .tab-btn[data-tab]').forEach(btn => {
            const tab = btn.getAttribute('data-tab');
            if (tab === this.activeTab) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        const panel = document.getElementById('settings-panel');
        if (panel) {
            let borderColor = '#FF006E';
            let boxShadow = '0 0 40px rgba(255, 0, 110, 0.3)';
            if (this.activeTab === 'gameplay') { borderColor = '#00E5FF'; boxShadow = '0 0 40px rgba(0, 229, 255, 0.3)'; }
            
            panel.style.borderColor = borderColor;
            panel.style.boxShadow = boxShadow;
        }

        this.tabContainers.forEach((container, tab) => {
            if (tab === this.activeTab) {
                container.style.display = 'block';
            } else {
                container.style.display = 'none';
            }
        });
    }

    private renderActiveTabContent(container: HTMLElement): void {
        if (this.activeTab === 'audio') {
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
        } else if (this.activeTab === 'gameplay') {
            const showFps = localStorage.getItem('nexus_show_fps') === 'true';
            container.innerHTML = `
                <div class="dev-options-box">
                    <h3 class="dev-label">DEVELOPER OPTIONS</h3>
                    <div class="dev-option-row">
                        <span class="dev-option-label">FPS MONITOR</span>
                        <input type="checkbox" id="check-show-fps" ${showFps ? 'checked' : ''} style="width: 24px; height: 24px;">
                    </div>
                    <div class="dev-option-row">
                        <span class="dev-option-label">STORAGE MANAGEMENT</span>
                        <button class="dev-action-btn" id="btn-force-reset">PURGE & RELOAD</button>
                    </div>
                </div>
            `;
            
            container.querySelector('#check-show-fps')?.addEventListener('change', (e) => {
                const checked = (e.target as HTMLInputElement).checked;
                localStorage.setItem('nexus_show_fps', checked.toString());
                window.dispatchEvent(new CustomEvent('nexus-setting-changed', { 
                    detail: { key: 'nexus_show_fps', value: checked } 
                }));
            });

            container.querySelector('#btn-force-reset')?.addEventListener('click', () => this.handleForceReset());
        }
    }

    private async handleForceReset(): Promise<void> {
        if (!confirm("모든 데이터를 삭제하고 초기화하시겠습니까?")) return;
        const loading = LoadingOverlay.getInstance();
        loading.show("PURGING ALL DATA...");
        localStorage.clear();
        sessionStorage.clear();
        if ('indexedDB' in window) {
            const dbs = await (window.indexedDB as any).databases?.() || [];
            for (const db of dbs) if (db.name) window.indexedDB.deleteDatabase(db.name);
        }
        window.location.reload();
    }

    private attachShellListeners(): void {
        document.querySelectorAll('#settings-tabs .tab-btn[data-tab]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = (e.currentTarget as HTMLElement).getAttribute('data-tab') as Tab;
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

    public destroy(): void {
        this.isCreated = false;
        document.getElementById('settings-ui-root')?.remove();
        MenuMusicManager.getInstance().playMusic('main');
    }
}
