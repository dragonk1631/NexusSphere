import { UIManager } from '../core/ui/UIManager';
import { ThemeManager } from '../core/ThemeManager';
import { EconomyManager } from '../core/score/EconomyManager';
import { NoteSkinManager } from '../core/NoteSkinManager';
import { RenderCache } from '../games/rhythm/graphics/RenderCache';
import { MenuMusicManager } from '../core/audio/MenuMusicManager';
import { BackgroundRenderer } from '../core/graphics/BackgroundRenderer';
import { LoadingOverlay } from '../games/rhythm/renderer/LoadingOverlay';
import { AuthService } from '../services/auth/AuthService';
import { ModalUI } from './ModalUI';
import { getCharacterImagePath } from '../core/utils/PathUtils';
import { applyCharacterSpriteStyle, CharacterFrame } from './utils/CharacterStyleUtils';

type ShopTab = 'theme' | 'note' | 'character';

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
                }
                @media (max-width: 800px) {
                    .btn-close-shop {
                        padding: 0 20px;
                        font-size: 0.85rem !important;
                    }
                }

                .god-user-list {
                    margin-top: 10px;
                    background: rgba(0,0,0,0.3);
                    border-radius: 10px;
                    padding: 8px;
                    max-height: 180px;
                    display: flex;
                    flex-direction: column;
                    gap: 5px;
                    border: 1px solid rgba(255,255,255,0.05);
                }
                .god-user-items {
                    overflow-y: auto;
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .god-user-items::-webkit-scrollbar { width: 4px; }
                .god-user-items::-webkit-scrollbar-thumb { background: rgba(0,229,255,0.3); border-radius: 2px; }
                
                .god-user-item {
                    font-size: 0.7rem;
                    padding: 6px 10px;
                    background: rgba(255,255,255,0.05);
                    border-radius: 6px;
                    cursor: pointer;
                    display: flex;
                    flex-direction: column;
                    text-align: left;
                    transition: 0.2s;
                }
                .god-user-item:hover { 
                    background: rgba(0,229,255,0.15);
                    transform: translateX(2px);
                }
                .god-user-id-small { color: rgba(0,229,255,0.6); font-size: 0.6rem; margin-top: 2px; font-family: monospace; }
                
                .god-btn-user-delete {
                    background: rgba(255, 61, 0, 0.1); color: #ff3d00;
                    border: 1px solid rgba(255, 61, 0, 0.3); border-radius: 4px;
                    padding: 0 6px; cursor: pointer; font-size: 0.7rem; line-height: 1.4;
                    transition: 0.2s;
                }
                .god-btn-user-delete:hover {
                    background: #ff3d00; color: #fff;
                    transform: scale(1.1);
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

                /* Guest Experience v7 - Full Screen Width Fixed Bar */
                .shop-guest-banner {
                    position: fixed;
                    top: 50%; left: 0; 
                    transform: translateY(-50%);
                    background: linear-gradient(90deg, rgba(255, 0, 204, 0.4) 0%, rgba(51, 51, 255, 0.4) 100%);
                    padding: 18px 0; 
                    display: flex; flex-direction: row;
                    align-items: center; justify-content: center;
                    gap: 35px; 
                    font-weight: 900; 
                    font-size: 1.2rem;
                    border-top: 2px solid rgba(255, 255, 255, 0.3);
                    border-bottom: 2px solid rgba(255, 255, 255, 0.3);
                    animation: bannerPulse 3s infinite ease-in-out;
                    z-index: 2000;
                    backdrop-filter: blur(20px);
                    box-shadow: 0 0 50px rgba(0,0,0,0.7);
                    pointer-events: auto;
                    white-space: nowrap;
                    width: 100vw;
                    box-sizing: border-box;
                }
                @keyframes bannerPulse { 
                    0%, 100% { opacity: 0.95; filter: brightness(1); } 
                    50% { opacity: 1; filter: brightness(1.2); } 
                }
                .banner-login-btn {
                    background: linear-gradient(135deg, #ff00cc 0%, #3333ff 100%);
                    color: #fff; border: 1.5px solid #fff; padding: 8px 28px;
                    border-radius: 8px; font-family: 'Black Han Sans'; cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); 
                    font-weight: 900; font-size: 1rem;
                    box-shadow: 0 0 20px rgba(255, 0, 204, 0.5);
                    text-transform: uppercase;
                }
                .banner-login-btn:hover { transform: scale(1.1) rotate(-1deg); filter: brightness(1.3); box-shadow: 0 0 30px rgba(255, 0, 204, 0.8); }

                .shop-window.is-guest .shop-card {
                    pointer-events: none !important;
                    filter: grayscale(0.5) contrast(0.8) brightness(0.7) !important;
                    cursor: default !important;
                }
                .shop-window.is-guest .shop-card:hover {
                    transform: none !important;
                    box-shadow: none !important;
                }
                
                @media (max-width: 850px) {
                    .shop-guest-banner {
                        padding: 8px 15px;
                        font-size: 0.75rem;
                        gap: 12px;
                        max-width: 95%;
                    }
                    .banner-login-btn {
                        padding: 4px 12px;
                        font-size: 0.75rem;
                    }
                }

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

                .theme-grid, .note-grid, .character-grid {
                    display: grid; 
                    grid-template-columns: repeat(5, 1fr);
                    gap: clamp(12px, 2vw, 24px);
                    width: 100%; height: 100%; box-sizing: border-box; flex: 1;
                }

                /* SHARED PREMIUM CARD DESIGN */
                .shop-card {
                    position: relative;
                    background: linear-gradient(135deg, #2a2a40 0%, #111119 100%);
                    border-radius: 20px;
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    cursor: pointer;
                    display: flex;
                    flex-direction: column;
                    padding: 16px;
                    transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
                    overflow: hidden;
                    box-shadow: 0 15px 35px rgba(0,0,0,0.6);
                    height: 100%;
                    box-sizing: border-box;
                    text-align: left;
                    backdrop-filter: blur(10px);
                }

                .shop-card::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.12) 0%, transparent 70%);
                    pointer-events: none;
                    z-index: 1;
                }

                .shop-card-aura {
                    position: absolute;
                    bottom: -20%;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 120%;
                    height: 60%;
                    background: radial-gradient(ellipse at center, var(--card-glow, #fff) 0%, transparent 70%);
                    opacity: 0.15;
                    filter: blur(30px);
                    pointer-events: none;
                    z-index: 0;
                    transition: opacity 0.3s;
                }

                .shop-card:hover .shop-card-aura {
                    opacity: 0.35;
                }

                .shop-card:hover {
                    transform: translateY(-8px) scale(1.02);
                    border-color: rgba(255, 255, 255, 0.4);
                    box-shadow: 0 20px 40px rgba(0,0,0,0.8);
                }

                .shop-card.active {
                    border: 4px solid #fff !important;
                    background: linear-gradient(135deg, #4a4a80 0%, #252545 100%);
                    box-shadow: 0 0 25px rgba(255, 255, 255, 0.4);
                    animation: themePulse 1.5s ease-in-out infinite;
                    z-index: 5;
                }

                .shop-card.active::after {
                    content: '✓';
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    width: 28px;
                    height: 28px;
                    background: #00E5FF;
                    color: #000;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 16px;
                    font-weight: 900;
                    box-shadow: 0 0 15px rgba(0, 229, 255, 0.6);
                    z-index: 20;
                }

                .shop-card-frame {
                    position: absolute;
                    inset: 5px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 12px;
                    pointer-events: none;
                }

                .shop-card-header {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    margin-bottom: 12px;
                    z-index: 2;
                    width: 100%;
                }

                .shop-card-title {
                    font-family: 'Black Han Sans', sans-serif;
                    font-size: clamp(0.9rem, 1.3vw, 1.1rem);
                    color: #fff;
                    text-align: center;
                    width: 100%;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    -webkit-text-stroke: 0.8px rgba(0,0,0,0.5);
                    paint-order: stroke fill;
                    text-shadow: 0 4px 8px rgba(0,0,0,1);
                    letter-spacing: 0.5px;
                }

                .shop-preview-area {
                    flex: 1;
                    background: radial-gradient(circle at 50% 50%, #1a1a2e 0%, #05050a 100%);
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                    overflow: hidden;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    box-shadow: inset 0 0 20px rgba(0,0,0,0.6);
                }

                .shop-preview-area::after {
                    content: '';
                    position: absolute;
                    width: 150%;
                    height: 150%;
                    background: radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%);
                    animation: noteGlow 4s infinite ease-in-out;
                }

                @keyframes noteGlow {
                    0%, 100% { opacity: 0.3; transform: scale(1); }
                    50% { opacity: 0.6; transform: scale(1.2); }
                }

                /* Note Skin Specifics */
                .note-preview-img {
                    width: 70%;
                    height: auto;
                    object-fit: contain;
                    filter: drop-shadow(0 0 15px rgba(255, 255, 255, 0.4));
                    z-index: 2;
                    transition: transform 0.3s ease;
                }
                .shop-card:hover .note-preview-img { transform: scale(1.1) rotate(5deg); }

                /* Theme Specifics */
                .theme-preview-bg {
                    position: absolute; inset: 0;
                    background-size: cover; background-position: center;
                    transition: transform 0.6s cubic-bezier(0.165, 0.84, 0.44, 1);
                }
                .shop-card:hover .theme-preview-bg { transform: scale(1.15); }

                /* Character Specifics */
                .char-preview-sprite {
                    width: 100%; height: 100%;
                    filter: drop-shadow(0 5px 15px rgba(0,0,0,0.5));
                    transform: scale(0.9);
                    transition: transform 0.3s ease;
                }
                .shop-card:hover .char-preview-sprite { transform: scale(1.05); }

                .shop-price-overlay {
                    position: absolute;
                    bottom: 12px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(0, 0, 0, 0.9);
                    padding: 4px 14px;
                    border-radius: 20px;
                    border: 2px solid #FFD700;
                    color: #FFD700 !important;
                    font-family: 'Outfit', sans-serif;
                    font-size: 0.95rem;
                    font-weight: 900;
                    z-index: 50;
                    backdrop-filter: blur(5px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    pointer-events: none;
                    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.5), 0 0 15px rgba(255, 215, 0, 0.3);
                    text-shadow: 0 0 5px rgba(0,0,0,1);
                    white-space: nowrap;
                    min-width: 80px;
                }

                .shop-card.locked {
                    filter: saturate(0.8) brightness(0.85);
                }
                
                .shop-card.locked .note-preview-img, 
                .shop-card.locked .theme-preview-bg,
                .shop-card.locked .char-preview-sprite {
                    filter: grayscale(0.4) brightness(0.6);
                }

                @media (max-width: 900px) {
                    .tab-container-fit {
                        padding: 8px !important;
                    }
                    .theme-grid, .note-grid, .character-grid {
                        gap: 8px !important;
                    }
                    .shop-card {
                        padding: 5px !important;
                        border-radius: 12px !important;
                    }
                    .shop-card-header {
                        margin-bottom: 2px !important;
                    }
                    .shop-card-title {
                        font-size: 0.5rem !important;
                        -webkit-text-stroke: 0.2px rgba(0,0,0,0.5) !important;
                    }
                    .shop-preview-area {
                        border-radius: 6px !important;
                    }
                    .note-preview-img {
                        width: 98% !important;
                    }
                    .char-preview-sprite {
                        transform: scale(1.1) !important;
                    }
                    .shop-price-overlay {
                        bottom: 3px !important;
                        font-size: 0.55rem !important;
                        padding: 1px 4px !important;
                        min-width: 50px !important;
                    }
                }

                @keyframes themePulse {
                    0%, 100% { border-color: #fff; transform: scale(1.04); }
                    50% { border-color: #00E5FF; transform: scale(1.06); }
                }

                .shop-tab-btn.tab-character.active { --active-color: #00E5FF; --active-glow: rgba(0, 229, 255, 0.6); }

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
                            <button class="shop-tab-btn tab-theme active" data-tab="theme">THEME</button>
                            <button class="shop-tab-btn tab-note" data-tab="note">NOTE SKIN</button>
                            <button class="shop-tab-btn tab-character" data-tab="character">CHARACTER</button>
                        </div>
                        <div style="display: flex; gap: 10px; position: relative;">
                            <button id="btn-god-mode" class="btn-god-mode">GOD</button>
                            <button id="btn-close-shop" class="col-btn-heavy btn-close-shop">BACK</button>
                            
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
                                <div class="god-row" style="margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px; flex-direction: column; align-items: stretch; gap: 8px;">
                                    <div style="font-size: 0.7rem; color: #888; text-transform: uppercase;">Gift to Specific User</div>
                                    <div style="display: flex; gap: 4px;">
                                        <input type="text" id="god-target-user-id" class="god-input" placeholder="User ID..." style="flex: 1;">
                                        <button id="god-btn-fill-self" class="god-btn" style="font-size: 0.6rem; padding: 0 8px; background: rgba(255,255,255,0.1);">SELF</button>
                                    </div>
                                    <div style="display: flex; gap: 8px;">
                                        <input type="number" id="god-gift-amount" class="god-input" placeholder="Amount..." value="5000">
                                        <button id="god-btn-gift-coins" class="god-btn" style="background: #FFD700; color: #000;">GIFT</button>
                                    </div>
                                </div>
                                <div class="god-user-list">
                                    <button id="god-btn-fetch-users" class="god-btn" style="width: 100%; font-size: 0.65rem; padding: 4px; background: rgba(0,229,255,0.1);">↻ LOAD USER LIST</button>
                                    <div id="god-user-items" class="god-user-items"></div>
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
            ['theme', 'note', 'character'].forEach(t => {
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
        const auth = AuthService.getInstance();
        const isAdmin = auth.isAdmin();
        const isSignedIn = auth.isSignedIn();

        const btn = document.getElementById('btn-god-mode');
        if (btn) {
            if (isAdmin) btn.classList.add('admin-visible');
            else btn.classList.remove('admin-visible');
        }

        // Handle Guest Banner
        const windowEl = document.querySelector('.shop-window');
        const overlay = document.querySelector('.shop-overlay');
        const bannerId = 'shop-guest-banner';
        const existingBanner = document.getElementById(bannerId);
 
        if (!isSignedIn) {
            if (windowEl) windowEl.classList.add('is-guest');
            if (overlay && !existingBanner) {
                const banner = document.createElement('div');
                banner.id = bannerId;
                banner.className = 'shop-guest-banner';
                banner.innerHTML = `
                    <span>SIGN IN TO SYNC PURCHASES</span>
                    <button class="banner-login-btn">SIGN IN NOW</button>
                `;
                overlay.appendChild(banner);
                banner.querySelector('.banner-login-btn')?.addEventListener('click', () => auth.openSignIn());
            }
        } else {
            if (windowEl) windowEl.classList.remove('is-guest');
            existingBanner?.remove();
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
                } else if (this.activeTab === 'character') {
                    borderColor = '#00E5FF';
                    boxShadow = '0 0 40px rgba(0, 229, 255, 0.3)';
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
        if (this.activeTab === 'theme') {
            this.renderThemeTab(container);
        } else if (this.activeTab === 'note') {
            this.renderNoteTab(container);
        } else if (this.activeTab === 'character') {
            this.renderCharacterTab(container);
        }
    }

    private renderThemeTab(container: HTMLElement): void {
        const themeManager = ThemeManager.getInstance();
        const currentThemeId = themeManager.getCurrentTheme().id;
        const renderCache = RenderCache.getInstance();
        const economy = EconomyManager.getInstance();
        const themes = themeManager.getAllThemes();

        const themesHtml = themes.map((t, idx) => {
            const url = renderCache.getBackgroundPreviewUrlLocal(t.id);
            const isOwned = economy.isThemeOwned(t.id);
            const price = (idx === 0 || t.id === 'deep-space') ? 0 : (idx < 7 ? 1000 : 2000);
            const accentColor = t.color1;
            const bgStyle = url ? `background-image: url(${url});` : `background: linear-gradient(135deg, ${t.color1}, ${t.color2});`;

            return `
            <div class="shop-card theme-btn theme-item ${t.id === currentThemeId ? 'active' : ''} ${!isOwned ? 'locked' : ''}" 
                    data-theme="${t.id}" data-price="${price}"
                    style="--card-glow: ${accentColor}; border-bottom: 3px solid ${accentColor}44;">
                <div class="shop-card-aura"></div>
                <div class="shop-card-frame"></div>
                <div class="shop-card-header">
                    <span class="shop-card-title">${t.name}</span>
                </div>
                <div class="shop-preview-area">
                    <div class="theme-preview-bg" style="${bgStyle}"></div>
                    ${!isOwned ? `
                        <div class="shop-price-overlay">
                            <span>🔒</span>
                            <span>${price.toLocaleString()}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
            `;
        }).join('');

        container.innerHTML = `<div class="theme-grid">${themesHtml}</div>`;
        this.attachThemeListeners(container);
    }

    private renderNoteTab(container: HTMLElement): void {
        const skinManager = NoteSkinManager.getInstance();
        const currentSkinId = skinManager.getCurrentSkin().id;
        const renderCache = RenderCache.getInstance();
        const economy = EconomyManager.getInstance();
        const skins = skinManager.getAllSkins();
        const skinColors = ['#00E5FF', '#A2FF00', '#FF3D00', '#8B4513', '#FFD700', '#9C27B0', '#FFD700', '#2196F3', '#00FFCC', '#FF69B4'];

        const skinsHtml = skins.map((s, idx) => {
            const previewUrl = renderCache.getPreviewDataURL(s.id);
            const isOwned = economy.isSkinOwned(s.id);
            const price = (idx === 0) ? 0 : 1500;
            const accentColor = skinColors[idx % skinColors.length];

            return `
            <div class="shop-card skin-btn ${s.id === currentSkinId ? 'active' : ''} ${!isOwned ? 'locked' : ''}" 
                 data-skin="${s.id}" data-price="${price}"
                 style="--card-glow: ${accentColor}; border-bottom: 3px solid ${accentColor}44;">
                <div class="shop-card-aura"></div>
                <div class="shop-card-frame"></div>
                <div class="shop-card-header">
                    <span class="shop-card-title">${s.name}</span>
                </div>
                <div class="shop-preview-area" style="background: radial-gradient(circle at 50% 50%, ${accentColor}11 0%, #05050a 100%);">
                    <img src="${previewUrl}" class="note-preview-img" alt="${s.name}">
                    ${!isOwned ? `
                        <div class="shop-price-overlay">
                            <span>🔒</span>
                            <span>${price.toLocaleString()}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
            `;
        }).join('');

        container.innerHTML = `<div class="note-grid">${skinsHtml}</div>`;
        this.attachSkinListeners(container);
    }

    private renderCharacterTab(container: HTMLElement): void {
        const economy = EconomyManager.getInstance();
        const currentCharId = economy.getActiveCharacter();
        
        const characters = [
            { id: 'baby', name: 'BABY (Default)', price: 0, img: getCharacterImagePath('baby') },
            { id: 'melodia', name: 'MELODIA', price: 5000, img: getCharacterImagePath('melodia') },
            { id: 'flora', name: 'FLORA', price: 5000, img: getCharacterImagePath('flora') },
            { id: 'cathy', name: 'CATHY', price: 8000, img: getCharacterImagePath('cathy') },
            { id: 'cherry', name: 'CHERRY', price: 8000, img: getCharacterImagePath('cherry') },
            { id: 'haru', name: 'HARU', price: 12000, img: getCharacterImagePath('haru') },
            { id: 'haruto', name: 'HARUTO', price: 12000, img: getCharacterImagePath('haruto') },
            { id: 'luna', name: 'LUNA', price: 15000, img: getCharacterImagePath('luna') },
            { id: 'sakura', name: 'SAKURA', price: 15000, img: getCharacterImagePath('sakura') },
            { id: 'thumb', name: 'THUMB', price: 20000, img: getCharacterImagePath('thumb') }
        ];

        const charHtml = characters.map((c) => {
            const isOwned = economy.isCharacterOwned(c.id);
            const isActive = c.id === currentCharId;
            const accentColor = '#00E5FF';

            return `
                <div class="shop-card character-card ${isActive ? 'active' : ''} ${isOwned ? 'owned' : 'locked'}" 
                     data-char="${c.id}" data-price="${c.price}"
                     style="--card-glow: ${accentColor}; border-bottom: 3px solid ${accentColor}44;">
                    <div class="shop-card-aura"></div>
                    <div class="shop-card-frame"></div>
                    <div class="shop-card-header">
                        <span class="shop-card-title">${c.name}</span>
                    </div>
                    <div class="shop-preview-area">
                        ${c.img ? `<div class="char-preview-sprite" style="background-image: url('${c.img}');"></div>` : `<div class="char-placeholder">?</div>`}
                        ${!isOwned ? `
                            <div class="shop-price-overlay">
                                <span>🔒</span>
                                <span>${c.price.toLocaleString()}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = `<div class="character-grid">${charHtml}</div>`;
        
        container.querySelectorAll('.char-preview-sprite').forEach((sprite, idx) => {
            const charData = characters[idx];
            if (charData) {
                const isOwned = economy.isCharacterOwned(charData.id);
                let frame: CharacterFrame = CharacterFrame.IDLE;
                if (charData.id === currentCharId) frame = CharacterFrame.HAPPY;
                else if (!isOwned) frame = CharacterFrame.MISS;
                applyCharacterSpriteStyle(sprite as HTMLElement, charData.id, frame);
            }
        });

        this.attachCharacterListeners(container);
    }

    private attachCharacterListeners(container: HTMLElement): void {
        const economy = EconomyManager.getInstance();
        
        container.querySelectorAll('.character-card').forEach(card => {
            if (card.classList.contains('placeholder')) return;

            card.addEventListener('click', (e) => {
                e.preventDefault();
                const charId = card.getAttribute('data-char');
                const price = parseInt(card.getAttribute('data-price') || '0');
                if (!charId) return;

                const isOwned = economy.isCharacterOwned(charId);

                if (!isOwned) {
                    ModalUI.getInstance().show(
                        '캐릭터 구매',
                        `${price.toLocaleString()} 코인으로 이 캐릭터를 구매하시겠습니까?`,
                        {
                            confirmLabel: '구매하기',
                            cancelLabel: '취소',
                            onConfirm: () => {
                                const res = economy.purchaseCharacter(charId, price);
                                if (res.success) {
                                    ModalUI.getInstance().showNotification('구매 성공', res.message, 3000, 'info');
                                    this.updateCurrencyUI();
                                    this.renderCharacterTab(container);
                                } else {
                                    ModalUI.getInstance().show('구매 실패', res.message, { type: 'error' });
                                }
                            }
                        }
                    );
                } else {
                    economy.setActiveCharacter(charId);
                    this.renderCharacterTab(container);
                    window.dispatchEvent(new CustomEvent('nexus-character-changed', { detail: { charId } }));
                }
            });
        });
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
            ['baby', 'melodia', 'flora', 'cathy', 'cherry', 'haru', 'haruto', 'luna', 'sakura', 'thumb'].forEach(cId => economy.adminSetOwnership('char', cId, true));
            this.renderActiveTabContent(this.tabContainers.get(this.activeTab)!);
        });

        document.getElementById('god-btn-reset-all')?.addEventListener('click', () => {
            const economy = EconomyManager.getInstance();
            const themeManager = ThemeManager.getInstance();
            const skinManager = NoteSkinManager.getInstance();

            // 1. Reset ownership and coins in DB/Cache
            economy.adminResetAll();

            // 2. Reset active selections to actual factory defaults
            themeManager.setTheme('deep-space');
            skinManager.setSkin('classic-gel');
            localStorage.setItem('nexus_active_character', 'baby');

            // 3. Notify system of character change
            window.dispatchEvent(new CustomEvent('nexus-character-changed', { detail: { charId: 'baby' } }));

            // 4. Reset Shop UI state and move cursor to first tab
            this.activeTab = 'theme';
            this.updateCurrencyUI();
            this.updateTabContentUI();
            
            ModalUI.getInstance().showNotification('FACTORY RESET', 'All progress and selections have been reset to defaults.', 3000, 'info');
        });

        document.getElementById('god-btn-fill-self')?.addEventListener('click', () => {
            const auth = AuthService.getInstance();
            const input = document.getElementById('god-target-user-id') as HTMLInputElement;
            if (input) input.value = auth.getUserId() || '';
        });

        document.getElementById('god-btn-gift-coins')?.addEventListener('click', async () => {
            const targetId = (document.getElementById('god-target-user-id') as HTMLInputElement).value;
            const amount = parseInt((document.getElementById('god-gift-amount') as HTMLInputElement).value || '0');
            
            if (!targetId || amount <= 0) {
                ModalUI.getInstance().showNotification('INVALID INPUT', 'Please enter a valid User ID and amount.', 3000, 'error');
                return;
            }

            const res = await AuthService.getInstance().adminGiveCoins(targetId, amount);
            if (res.success) {
                ModalUI.getInstance().show('GIFT SUCCESS', res.message, { type: 'info' });
                
                // If the target is the current user, sync to show the update immediately
                if (targetId === AuthService.getInstance().getUserId()) {
                    const { ScoreManager } = await import('../core/score/ScoreManager');
                    await ScoreManager.getInstance().syncWithServer();
                    this.updateCurrencyUI();
                }
            } else {
                ModalUI.getInstance().show('GIFT FAILED', res.message || (res as any).error, { type: 'error' });
            }
        });

        document.getElementById('god-btn-fetch-users')?.addEventListener('click', async () => {
            const btn = document.getElementById('god-btn-fetch-users') as HTMLButtonElement;
            const originalText = btn.innerText;
            btn.innerText = 'FETCHING...';
            btn.disabled = true;

            try {
                const result = await AuthService.getInstance().fetchAdminUsers();
                console.log("[GodMode] Fetched users result:", result);

                const container = document.getElementById('god-user-items');
                if (container) {
                    const auth = AuthService.getInstance();
                    const currentUserId = auth.getUserId();

                    // Handle both direct array or nested { users: [...] } response
                    const rawUsers = Array.isArray(result) ? result : (result && (result as any).users ? (result as any).users : []);
                    
                    // Filter out the current admin user and ensure list is clean
                    const users = rawUsers.filter((u: any) => {
                        const uid = u.user_id || u.id;
                        return uid && uid !== currentUserId;
                    });
                    
                    if (users.length === 0) {
                        container.innerHTML = `<div style="padding: 10px; font-size: 0.7rem; color: #888; text-align: center;">NO OTHER USERS FOUND</div>`;
                    } else {
                        container.innerHTML = users.map((u: any) => {
                            const userId = u.user_id || u.id || 'N/A';
                            const name = u.display_name || u.username || u.first_name || 'Unknown';
                            const email = u.email || '';
                            
                            return `
                                <div class="god-user-item" data-id="${userId}">
                                    <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 8px;">
                                        <span style="font-weight: 700; color: #fff;">${name}</span>
                                        <div style="display: flex; align-items: center; gap: 6px;">
                                            ${email ? `<span style="font-size: 0.6rem; color: #888;">${email}</span>` : ''}
                                            <button class="god-btn-user-delete" data-id="${userId}" title="Delete User Record">✕</button>
                                        </div>
                                    </div>
                                    <div class="god-user-id-small">${userId}</div>
                                </div>
                            `;
                        }).join('');

                        // Attach select listeners
                        container.querySelectorAll('.god-user-item').forEach(item => {
                            item.addEventListener('click', (e) => {
                                // If click was on delete button, don't trigger selection
                                if ((e.target as HTMLElement).classList.contains('god-btn-user-delete')) return;

                                const targetIdInput = document.getElementById('god-target-user-id') as HTMLInputElement;
                                const selectedId = item.getAttribute('data-id');
                                console.log("[GodMode] Selected User ID:", selectedId);

                                if (targetIdInput && selectedId) {
                                    targetIdInput.value = selectedId;
                                    targetIdInput.focus();
                                    targetIdInput.style.borderColor = '#00E5FF';
                                    targetIdInput.style.boxShadow = '0 0 15px rgba(0, 229, 255, 0.5)';
                                    setTimeout(() => {
                                        targetIdInput.style.borderColor = '';
                                        targetIdInput.style.boxShadow = '';
                                    }, 800);
                                }
                            });
                        });

                        // Attach delete listeners
                        container.querySelectorAll('.god-btn-user-delete').forEach(delBtn => {
                            delBtn.addEventListener('click', async (e) => {
                                e.stopPropagation();
                                const targetId = delBtn.getAttribute('data-id');
                                if (!targetId) return;

                                ModalUI.getInstance().show(
                                    'CONFIRM DELETION',
                                    `Are you sure you want to permanently delete user [${targetId}] from the application database?`,
                                    {
                                        confirmLabel: 'DELETE',
                                        cancelLabel: 'CANCEL',
                                        onConfirm: async () => {
                                            const res = await auth.adminDeleteUser(targetId);
                                            if (res.success) {
                                                ModalUI.getInstance().showNotification('DELETED', 'User record removed from DB.', 3000, 'info');
                                                btn.click(); // Re-fetch list
                                            } else {
                                                ModalUI.getInstance().show('FAILED', res.message, { type: 'error' });
                                            }
                                        }
                                    }
                                );
                            });
                        });
                    }
                }
            } catch (e) {
                console.error("[GodMode] Failed to fetch users:", e);
                const container = document.getElementById('god-user-items');
                if (container) container.innerHTML = `<div style="padding: 10px; font-size: 0.7rem; color: #ff3d00; text-align: center;">FETCH ERROR</div>`;
            } finally {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        });
    }

    private attachCharacterListeners(container: HTMLElement): void {
        const economy = EconomyManager.getInstance();
        
        container.querySelectorAll('.character-card').forEach(card => {
            if (card.classList.contains('placeholder')) return;

            card.addEventListener('click', () => {
                const charId = card.getAttribute('data-char');
                const price = parseInt(card.getAttribute('data-price') || '0');
                if (!charId) return;

                const isOwned = economy.isCharacterOwned(charId);

                if (!isOwned) {
                    ModalUI.getInstance().show(
                        '캐릭터 구매',
                        `${price.toLocaleString()} 코인으로 이 캐릭터를 구매하시겠습니까?`,
                        {
                            confirmLabel: '구매하기',
                            cancelLabel: '취소',
                            onConfirm: () => {
                                const res = economy.purchaseCharacter(charId, price);
                                if (res.success) {
                                    ModalUI.getInstance().showNotification('구매 성공', res.message, 3000, 'info');
                                    this.updateCurrencyUI();
                                    this.renderActiveTabContent(container);
                                } else {
                                    ModalUI.getInstance().show('구매 실패', res.message, { type: 'error' });
                                }
                            }
                        }
                    );
                } else {
                    economy.setActiveCharacter(charId);
                    this.renderActiveTabContent(container);
                    // Notify any observers if needed
                    window.dispatchEvent(new CustomEvent('nexus-character-changed', { detail: { charId } }));
                }
            });
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
                    if (!AuthService.getInstance().isSignedIn()) {
                        ModalUI.getInstance().show(
                            'SIGN IN REQUIRED',
                            'You need a Nexus account to purchase premium themes and save them to your inventory.',
                            {
                                confirmLabel: 'SIGN IN',
                                cancelLabel: 'LATER',
                                onConfirm: () => AuthService.getInstance().openSignIn()
                            }
                        );
                        return;
                    }

                    const price = parseInt(btn.getAttribute('data-price') || '0');
                    ModalUI.getInstance().show(
                        '테마 구매',
                        `${price.toLocaleString()} 코인으로 이 테마를 구매하시겠습니까?`,
                        {
                            confirmLabel: '구매하기',
                            cancelLabel: '취소',
                            onConfirm: () => {
                                const res = economy.purchaseTheme(themeId, price);
                                if (res.success) {
                                    ModalUI.getInstance().showNotification('구매 성공', res.message, 3000, 'info');
                                    this.updateCurrencyUI();
                                    this.renderActiveTabContent(container);
                                    themeManager.setTheme(themeId);
                                    economy.setActiveTheme(themeId);
                                } else {
                                    ModalUI.getInstance().show('코인 부족', '코인이 부족하여 이 테마를 구매할 수 없습니다.', { type: 'error' });
                                }
                            }
                        }
                    );
                    return;
                }
                themeManager.setTheme(themeId);
                economy.setActiveTheme(themeId);
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
                    if (!AuthService.getInstance().isSignedIn()) {
                        ModalUI.getInstance().show(
                            'SIGN IN REQUIRED',
                            'You need a Nexus account to purchase premium note skins and save them to your inventory.',
                            {
                                confirmLabel: 'SIGN IN',
                                cancelLabel: 'LATER',
                                onConfirm: () => AuthService.getInstance().openSignIn()
                            }
                        );
                        return;
                    }

                    const price = parseInt(btn.getAttribute('data-price') || '0');
                    ModalUI.getInstance().show(
                        '노트 스킨 구매',
                        `${price.toLocaleString()} 코인으로 이 노트를 구매하시겠습니까?`,
                        {
                            confirmLabel: '구매하기',
                            cancelLabel: '취소',
                            onConfirm: () => {
                                const res = economy.purchaseSkin(skinId, price);
                                if (res.success) {
                                    ModalUI.getInstance().showNotification('구매 성공', res.message, 3000, 'info');
                                    this.updateCurrencyUI();
                                    this.renderActiveTabContent(container);
                                    skinManager.setSkin(skinId);
                                    economy.setActiveSkin(skinId);
                                } else {
                                    ModalUI.getInstance().show('코인 부족', '코인이 부족하여 이 노트 스킨을 구매할 수 없습니다.', { type: 'error' });
                                }
                            }
                        }
                    );
                    return;
                }
                skinManager.setSkin(skinId);
                economy.setActiveSkin(skinId);
                this.renderActiveTabContent(container);
            });
        });
    }
}
