import { UIManager } from '../core/ui/UIManager';
import { ThemeManager } from '../core/ThemeManager';
import { EconomyManager } from '../core/score/EconomyManager';
import { NoteSkinManager } from '../core/NoteSkinManager';
import { RenderCache } from '../games/rhythm/graphics/RenderCache';
import { MenuMusicManager } from '../core/audio/MenuMusicManager';
import { BackgroundRenderer } from '../core/graphics/BackgroundRenderer';
import { LoadingOverlay } from '../games/rhythm/renderer/LoadingOverlay';
import { AuthService } from '../services/auth/AuthService';

type ShopTab = 'theme' | 'note';

export class ShopUI {
    private ui: UIManager;
    private onClose: () => void;
    private activeTab: ShopTab = 'theme';
    private isCreated: boolean = false;
    private tabContainers: Map<ShopTab, HTMLElement> = new Map();

    constructor(onClose: () => void) {
        this.ui = UIManager.getInstance();
        this.onClose = onClose;
    }

    public async show(): Promise<void> {
        const loading = LoadingOverlay.getInstance();
        loading.updateProgress(0);

        this.createShell();
        const root = document.getElementById('shop-ui-root');
        if (root) root.style.opacity = '0';

        try {
            await this.preLoadAllAssets((progress) => {
                loading.updateProgress(progress);
            });
        } catch (e) {
            console.error("[ShopUI] Pre-load failed", e);
        }

        this.updateTabContentUI();
        this.updateGodModeUI();
        MenuMusicManager.getInstance().playMusic('options');

        requestAnimationFrame(() => {
            if (root) {
                root.style.transition = 'opacity 0.4s ease-out';
                root.style.opacity = '1';
            }
        });
    }

    private createShell(): void {
        if (this.isCreated) return;
        this.isCreated = true;

        const html = `
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Outfit:wght@900&display=swap');

                .shop-overlay {
                    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                    background: rgba(0, 0, 0, 0.4);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    display: flex; justify-content: center; align-items: center;
                    z-index: 100; font-family: 'Outfit', 'Black Han Sans', sans-serif;
                    opacity: 0; animation: shopFadeIn 0.3s forwards ease-out;
                    padding: 20px; box-sizing: border-box;
                }

                @keyframes shopFadeIn { to { opacity: 1; } }

                .shop-window {
                    width: 98vw; max-width: 1400px;
                    height: 90vh;
                    display: flex; flex-direction: column;
                    position: relative;
                    --header-btn-height: clamp(50px, 6.5vh, 70px);
                }

                .shop-header {
                    display: flex; justify-content: space-between; align-items: flex-end;
                    padding: 10px 0 0 0;
                    gap: 30px;
                }

                .shop-tabs {
                    display: flex; gap: 6px; margin-bottom: -4px; z-index: 10;
                    flex-shrink: 0; align-items: flex-end; padding-top: 15px; flex: 1;
                }

                .shop-tab-btn {
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

                .shop-tab-btn.active {
                    color: #fff; background: var(--active-color, #A2FF00);
                    border-color: rgba(255,255,255,0.8); z-index: 11;
                    transform: translateY(-2px);
                    filter: drop-shadow(0 0 15px var(--active-glow, rgba(162,255,0,0.6)));
                }

                .shop-tab-btn.tab-theme.active { --active-color: #A2FF00; --active-glow: rgba(162,255,0,0.6); }
                .shop-tab-btn.tab-note.active { --active-color: #FFD700; --active-glow: rgba(255,215,0,0.6); }

                .btn-close-shop {
                    height: var(--header-btn-height); padding: 0 40px;
                    background: linear-gradient(135deg, #FF0000 0%, #990000 100%);
                    color: #fff; border: 3px solid #fff; border-radius: 12px;
                    font-family: 'Black Han Sans', sans-serif; font-size: 1.1rem;
                    cursor: pointer; transition: all 0.2s;
                    text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
                    box-shadow: 0 4px 15px rgba(255,0,0,0.3);
                    display: flex; align-items: center; justify-content: center;
                }

                .btn-close-shop:hover {
                    filter: brightness(1.2) drop-shadow(0 0 15px rgba(255,0,0,0.5));
                    transform: scale(1.05) translateY(-2px);
                }

                .btn-god-mode {
                    height: var(--header-btn-height); padding: 0 25px;
                    background: linear-gradient(135deg, #ff00cc 0%, #3333ff 100%);
                    color: #fff; border: 3px solid #fff; border-radius: 12px;
                    font-family: 'Black Han Sans', sans-serif; font-size: 1.1rem;
                    cursor: pointer; transition: all 0.2s;
                    text-shadow: 0 0 10px rgba(255,255,255,0.8);
                    box-shadow: 0 0 20px rgba(255, 0, 204, 0.4);
                    display: none; align-items: center; justify-content: center;
                }
                .btn-god-mode.admin-visible { display: flex; }
                .btn-god-mode:hover { transform: scale(1.1) rotate(2deg); filter: hue-rotate(90deg); }

                .god-panel {
                    position: absolute; top: calc(var(--header-btn-height) + 20px); right: 0; width: 280px;
                    background: rgba(10, 10, 25, 0.95); border: 2px solid #ff00cc;
                    border-radius: 16px; padding: 20px; z-index: 1000;
                    display: none; flex-direction: column; gap: 12px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.9), 0 0 20px rgba(255, 0, 204, 0.2);
                    backdrop-filter: blur(10px); animation: godSlideIn 0.3s ease-out;
                }
                @keyframes godSlideIn { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
                .god-panel.active { display: flex; }

                .god-title { font-family: 'Black Han Sans'; color: #ff00cc; font-size: 1.3rem; text-align: center; margin-bottom: 5px; }
                .god-row { display: flex; gap: 10px; align-items: center; }
                .god-input { 
                    flex: 1; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);
                    color: #fff; padding: 8px 12px; border-radius: 8px; font-family: 'Outfit';
                }
                .god-btn {
                    padding: 8px 15px; border-radius: 8px; border: none; font-family: 'Black Han Sans';
                    cursor: pointer; transition: 0.2s; font-size: 0.9rem;
                }
                .god-btn-set { background: #ff00cc; color: #fff; }
                .god-btn-unlock { background: #00ffcc; color: #000; flex: 1; }
                .god-btn-reset { background: #555; color: #fff; flex: 1; }
                .god-btn:hover { filter: brightness(1.2); transform: translateY(-2px); }

                .shop-panel {
                    background: rgba(0, 20, 20, 0.6);
                    border: 4px solid rgba(255, 255, 255, 0.8);
                    border-radius: 0 24px 24px 24px;
                    padding: 0; color: #fff;
                    display: flex; flex-direction: column;
                    position: relative; flex: 1; min-height: 0;
                    overflow: hidden; z-index: 20;
                }

                #shop-tab-content {
                    flex: 1; display: flex; flex-direction: column;
                    min-height: 0; width: 100%; padding: 0;
                    box-sizing: border-box; align-items: stretch;
                    overflow: hidden;
                }

                .tab-container-fit {
                    height: 100%; width: 100%; display: flex; flex-direction: column;
                    overflow: hidden; padding: clamp(12px, 2vw, 24px); box-sizing: border-box;
                }

                .theme-grid {
                    display: grid; grid-template-columns: repeat(5, 1fr);
                    grid-template-rows: repeat(2, 1fr); gap: clamp(12px, 2vw, 24px);
                    width: 100%; height: 100%; box-sizing: border-box; flex: 1;
                }

                .theme-btn {
                    position: relative; border-radius: 16px; border: 2px solid rgba(255,255,255,0.3);
                    cursor: pointer; display: flex; align-items: flex-end; justify-content: center;
                    padding: clamp(10px, 1.5vh, 20px); transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3); overflow: hidden; height: 100%;
                    background: rgba(255, 255, 255, 0.05);
                }

                .theme-btn:hover { transform: translateY(-6px) scale(1.02); box-shadow: 0 12px 30px rgba(0,0,0,0.7); }
                
                .theme-btn.active {
                    transform: scale(1.04); border-color: #fff !important; border-width: 4px;
                    box-shadow: 0 0 15px rgba(255,255,255,0.6);
                    animation: themePulse 1.5s ease-in-out infinite;
                }

                @keyframes themePulse {
                    0%, 100% { border-color: #fff; transform: scale(1.04); }
                    50% { border-color: #00E5FF; transform: scale(1.06); }
                }

                .theme-btn.active::after {
                    content: '✓'; position: absolute; top: 6px; right: 8px;
                    background: #00E5FF; color: #000; width: 24px; height: 24px;
                    border-radius: 50%; display: flex; align-items: center; justify-content: center;
                    font-size: 14px; font-weight: 900; z-index: 2;
                }

                .theme-name {
                    position: relative; z-index: 5; font-family: 'Black Han Sans', sans-serif;
                    font-size: clamp(13px, 1.5vw, 17px); font-weight: 800; color: #fff;
                    text-align: center; width: 100%;
                    text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
                }

                .theme-btn.locked { filter: grayscale(0.8) brightness(0.4); }
                .theme-btn.locked:hover { filter: grayscale(0.2) brightness(0.7); }

                .lock-badge {
                    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
                    background: rgba(0,0,0,0.8); padding: 8px 15px; border-radius: 20px;
                    border: 2px solid #ffd700; color: #ffd700; font-family: 'Black Han Sans';
                    font-size: 0.9rem; pointer-events: none; display: flex; flex-direction: column; align-items: center;
                    z-index: 10;
                }

                /* Removed redundant currency HUD v2 */
                .shop-tab-content-wrapper {
                    flex: 1; display: flex; flex-direction: column;
                    min-height: 0; width: 100%; padding: 0;
                    box-sizing: border-box; align-items: stretch;
                    overflow: hidden;
                    transition: opacity 0.2s ease-out;
                }
            </style>

            <div class="shop-overlay" id="shop-ui-root">
                <div class="shop-window">
                    <div class="shop-header">
                        <div class="shop-tabs" id="shop-tabs">
                            <button class="shop-tab-btn tab-theme active" data-tab="theme">THEME SHOP</button>
                            <button class="shop-tab-btn tab-note" data-tab="note">NOTE SKIN SHOP</button>
                        </div>
                        <div style="display: flex; gap: 10px; position: relative;">
                            <button id="btn-god-mode" class="btn-god-mode">GOD</button>
                            <button id="btn-close-shop" class="btn-close-shop">EXIT SHOP</button>
                            
                            <div id="god-panel" class="god-panel">
                                <div class="god-title">GOD CONTROLS</div>
                                <div class="god-row">
                                    <input type="number" id="god-coin-input" class="god-input" placeholder="Coins..." value="99999">
                                    <button id="god-btn-set-coins" class="god-btn god-btn-set">SET</button>
                                </div>
                                <div class="god-row">
                                    <button id="god-btn-unlock-all" class="god-btn god-btn-unlock">UNLOCK ALL</button>
                                </div>
                                <div class="god-row">
                                    <button id="god-btn-reset-all" class="god-btn god-btn-reset">RESET ALL</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="shop-panel" id="shop-panel">
                        <div id="shop-tab-content" class="shop-tab-content-wrapper"></div>
                    </div>
                </div>
            </div>
        `;

        this.ui.createOverlay('shop-ui', html);

        const contentEl = document.getElementById('shop-tab-content');
        if (contentEl) {
            ['theme', 'note'].forEach(t => {
                const container = document.createElement('div');
                container.style.display = 'none';
                container.className = 'tab-container-fit';
                this.activeTab = t as ShopTab;
                this.renderActiveTabContent(container);
                contentEl.appendChild(container);
                this.tabContainers.set(t as ShopTab, container);
            });
            this.activeTab = 'theme';
        }

        this.attachShellListeners();
        this.updateCurrencyUI();
    }

    private updateCurrencyUI(): void {
        // Since we removed internal coin HUD, we trigger global update if needed,
        // but for now we just make sure global UI stays fresh.
        window.dispatchEvent(new CustomEvent('nexus-auth-changed'));
    }

    private updateGodModeUI(): void {
        const isAdmin = AuthService.getInstance().isAdmin();
        const btn = document.getElementById('btn-god-mode');
        if (btn) {
            if (isAdmin) btn.classList.add('admin-visible');
            else btn.classList.remove('admin-visible');
        }
    }

    private async preLoadAllAssets(onProgress: (p: number) => void): Promise<void> {
        const themeManager = ThemeManager.getInstance();
        const themes = themeManager.getAllThemes();
        const renderCache = RenderCache.getInstance();

        await BackgroundRenderer.getInstance().waitForReady((p) => onProgress(p * 0.3));

        let loaded = 0;
        await Promise.all(themes.map(async (t) => {
            await renderCache.getBackgroundPreview(t.id);
            loaded++;
            onProgress(0.3 + (loaded / themes.length) * 0.7);
        }));
    }

    private updateTabContentUI(): void {
        const contentEl = document.getElementById('shop-tab-content');
        if (!contentEl) return;

        // Visual feedback for tab switching
        contentEl.style.opacity = '0';

        setTimeout(() => {
            document.querySelectorAll('#shop-tabs .shop-tab-btn[data-tab]').forEach(btn => {
                const tab = btn.getAttribute('data-tab');
                if (tab === this.activeTab) btn.classList.add('active');
                else btn.classList.remove('active');
            });

            const panel = document.getElementById('shop-panel');
            if (panel) {
                let borderColor = '#A2FF00';
                let boxShadow = '0 0 40px rgba(162, 255, 0, 0.3)';
                if (this.activeTab === 'note') { 
                    borderColor = '#FFD700'; 
                    boxShadow = '0 0 40px rgba(255, 215, 0, 0.3)'; 
                    panel.style.borderRadius = '24px';
                } else {
                    panel.style.borderRadius = '0 24px 24px 24px';
                }
                panel.style.borderColor = borderColor;
                panel.style.boxShadow = boxShadow;
            }

            this.tabContainers.forEach((container, tab) => {
                if (tab === this.activeTab) {
                    container.style.display = 'block';
                    this.renderActiveTabContent(container);
                } else {
                    container.style.display = 'none';
                }
            });

            contentEl.style.opacity = '1';
        }, 50);
    }

    private renderActiveTabContent(container: HTMLElement): void {
        const themeManager = ThemeManager.getInstance();
        const currentThemeId = themeManager.getCurrentTheme().id;
        const skinManager = NoteSkinManager.getInstance();
        const currentSkinId = skinManager.getCurrentSkin().id;
        const renderCache = RenderCache.getInstance();
        const economy = EconomyManager.getInstance();

        if (this.activeTab === 'theme') {
            const themes = themeManager.getAllThemes();
            const themesHtml = themes.map((t, idx) => {
                const url = renderCache.getBackgroundPreviewUrlLocal(t.id);
                const isOwned = economy.isThemeOwned(t.id);
                const price = (idx === 0 || t.id === 'deep-space') ? 0 : (idx < 7 ? 1000 : 2000);

                let innerHtml = `<span class="theme-name">${t.name}</span>`;
                if (!isOwned) {
                    innerHtml += `<div class="lock-badge"><span>🔒</span><span>${price.toLocaleString()} Coin</span></div>`;
                }

                const bgStyle = url ? `background-image: url(${url});` : `background: linear-gradient(135deg, ${t.color1}, ${t.color2});`;

                return `
                <button class="theme-btn ${t.id === currentThemeId ? 'active' : ''} ${!isOwned ? 'locked' : ''}" 
                        data-theme="${t.id}" data-price="${price}"
                        style="${bgStyle} border-color: ${t.color3}; background-size: cover; background-position: center;">
                    ${innerHtml}
                </button>
                `;
            }).join('');

            container.innerHTML = `<div class="theme-grid">${themesHtml}</div>`;
            this.attachThemeListeners(container);

        } else if (this.activeTab === 'note') {
            const skins = skinManager.getAllSkins();
            const skinsHtml = skins.map((s, idx) => {
                const previewUrl = renderCache.getPreviewDataURL(s.id);
                const isOwned = economy.isSkinOwned(s.id);
                const price = (idx === 0) ? 0 : 1500;

                let innerHtml = `
                    <img src="${previewUrl}" alt="${s.name}" style="height: 30px; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)); z-index: 5;">
                    <span class="theme-name">${s.name}</span>
                `;
                if (!isOwned) {
                    innerHtml += `<div class="lock-badge"><span>🔒</span><span>${price.toLocaleString()} Coin</span></div>`;
                }

                return `
                <button class="theme-btn skin-btn ${s.id === currentSkinId ? 'active' : ''} ${!isOwned ? 'locked' : ''}" 
                        data-skin="${s.id}" data-price="${price}"
                        style="background: linear-gradient(135deg, #333340, #1a1a25); border-color: #555566; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;">
                    ${innerHtml}
                </button>
            `}).join('');

            container.innerHTML = `<div class="theme-grid">${skinsHtml}</div>`;
            this.attachSkinListeners(container);
        }
    }

    private attachShellListeners(): void {
        document.getElementById('btn-close-shop')?.addEventListener('click', () => {
            this.ui.hide('shop-ui');
            this.onClose();
        });

        document.querySelectorAll('#shop-tabs .shop-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.activeTab = btn.getAttribute('data-tab') as ShopTab;
                this.updateTabContentUI();
            });
        });

        // God Mode Listeners
        const btnGod = document.getElementById('btn-god-mode');
        const panelGod = document.getElementById('god-panel');
        btnGod?.addEventListener('click', () => {
            panelGod?.classList.toggle('active');
        });

        document.getElementById('god-btn-set-coins')?.addEventListener('click', () => {
            const input = document.getElementById('god-coin-input') as HTMLInputElement;
            const val = parseInt(input.value || '0');
            EconomyManager.getInstance().adminSetCoins(val);
            this.updateCurrencyUI();
        });

        document.getElementById('god-btn-unlock-all')?.addEventListener('click', () => {
            const economy = EconomyManager.getInstance();
            ThemeManager.getInstance().getAllThemes().forEach(t => economy.adminSetOwnership('theme', t.id, true));
            NoteSkinManager.getInstance().getAllSkins().forEach(s => economy.adminSetOwnership('skin', s.id, true));
            this.renderActiveTabContent(this.tabContainers.get(this.activeTab)!);
        });

        document.getElementById('god-btn-reset-all')?.addEventListener('click', () => {
            EconomyManager.getInstance().adminResetAll();
            this.updateCurrencyUI();
            this.renderActiveTabContent(this.tabContainers.get(this.activeTab)!);
        });
    }

    private attachThemeListeners(container: HTMLElement): void {
        const themeManager = ThemeManager.getInstance();
        const economy = EconomyManager.getInstance();

        container.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const themeId = btn.getAttribute('data-theme');
                if (!themeId) return;

                if (btn.classList.contains('locked')) {
                    const price = parseInt(btn.getAttribute('data-price') || '0');
                    if (confirm(`${price.toLocaleString()} 코인으로 이 테마를 구매하시겠습니까?`)) {
                        const res = economy.purchaseTheme(themeId, price);
                        alert(res.message);
                        if (res.success) {
                            this.updateCurrencyUI();
                            this.renderActiveTabContent(container);
                            themeManager.setTheme(themeId);
                        }
                    }
                    return;
                }
                themeManager.setTheme(themeId);
                this.renderActiveTabContent(container);
            });
        });
    }

    private attachSkinListeners(container: HTMLElement): void {
        const skinManager = NoteSkinManager.getInstance();
        const economy = EconomyManager.getInstance();

        container.querySelectorAll('.skin-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const skinId = btn.getAttribute('data-skin');
                if (!skinId) return;

                if (btn.classList.contains('locked')) {
                    const price = parseInt(btn.getAttribute('data-price') || '0');
                    if (confirm(`${price.toLocaleString()} 코인으로 이 노트를 구매하시겠습니까?`)) {
                        const res = economy.purchaseSkin(skinId, price);
                        alert(res.message);
                        if (res.success) {
                            this.updateCurrencyUI();
                            this.renderActiveTabContent(container);
                            skinManager.setSkin(skinId);
                        }
                    }
                    return;
                }
                skinManager.setSkin(skinId);
                this.renderActiveTabContent(container);
            });
        });
    }
}
