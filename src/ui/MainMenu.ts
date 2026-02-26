import { UIManager } from '../core/ui/UIManager';
import { SettingsUI } from './SettingsUI';

export class MainMenu {
    private ui: UIManager;
    private onStartGame: (mode: string) => void;
    private settingsUI: SettingsUI | null = null;

    constructor(onStartGame: (mode: string) => void) {
        this.ui = UIManager.getInstance();
        this.onStartGame = onStartGame;
    }

    public show(): void {
        const html = `
            <style>
                /* Base Reset specific to Main Menu to avoid bleeding */
                .mm-container {
                    position: fixed;
                    top: 0; left: 0; width: 100vw; height: 100vh;
                    background: transparent;
                    font-family: 'Nunito', 'Segoe UI', sans-serif;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: space-between;
                    overflow: hidden;
                    z-index: 50;
                    user-select: none;
                    box-sizing: border-box;
                }

                /* Top HUD */
                .mm-top-hud {
                    width: 100%;
                    padding: clamp(8px, 2vw, 20px);
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    z-index: 2;
                    box-sizing: border-box;
                    flex-shrink: 0;
                }
                .mm-badge {
                    background: rgba(255, 255, 255, 0.15);
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                    color: white;
                    padding: clamp(5px, 1.5vw, 8px) clamp(8px, 2.5vw, 16px);
                    border-radius: 20px;
                    font-weight: 800;
                    font-size: clamp(0.65rem, 2vw, 1.1rem);
                    border: 1px solid rgba(255, 255, 255, 0.4);
                    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    text-shadow: 0 2px 4px rgba(0,0,0,0.5);
                    white-space: nowrap;
                }
                .mm-stats {
                    display: flex;
                    gap: 8px;
                }

                /* Ribbon Title */
                .mm-ribbon-container {
                    position: relative;
                    margin-top: clamp(2vh, 4vh, 6vh);
                    width: 100%;
                    display: flex;
                    justify-content: center;
                    z-index: 2;
                }
                .mm-ribbon {
                    background: linear-gradient(to bottom, #f093fb 0%, #f5576c 100%);
                    padding: clamp(6px, 1.5vh, 10px) clamp(20px, 8vw, 50px);
                    border-radius: 8px;
                    box-shadow: 0 6px 0 #c2314a, 0 10px 20px rgba(0,0,0,0.4);
                    border: 2px solid rgba(255,255,255,0.8);
                    position: relative;
                }
                .mm-ribbon::before, .mm-ribbon::after {
                    content: '';
                    position: absolute;
                    top: 15px;
                    bottom: -10px;
                    width: 30px;
                    background: #c2314a;
                    z-index: -1;
                }
                .mm-ribbon::before {
                    left: -20px;
                    clip-path: polygon(0 0, 100% 0, 100% 100%, 0 50%);
                }
                .mm-ribbon::after {
                    right: -20px;
                    clip-path: polygon(0 0, 100% 0, 100% 50%, 0 100%);
                }
                .mm-ribbon h1 {
                    margin: 0;
                    font-size: clamp(1.2rem, 5vw, 2.5rem);
                    font-weight: 900;
                    color: white;
                    text-transform: uppercase;
                    text-shadow: 0 3px 0 #c2314a, 0 5px 10px rgba(0,0,0,0.5);
                    letter-spacing: 2px;
                }

                /* Center Buttons */
                .mm-center {
                    display: flex;
                    gap: clamp(8px, 2.5vw, 20px);
                    justify-content: center;
                    align-items: center;
                    flex: 1;
                    flex-wrap: wrap;
                    z-index: 2;
                    margin-top: 2vh;
                    padding: 0 clamp(8px, 3vw, 30px);
                    max-width: 100%;
                }
                .mm-big-btn {
                    position: relative;
                    width: clamp(80px, 20vw, 150px);
                    height: clamp(80px, 20vw, 150px);
                    border-radius: 25px;
                    border: 3px solid rgba(255, 255, 255, 0.8);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    /* Layered shadow: depth + glow */
                    box-shadow:
                        0 10px 0 rgba(0,0,0,0.2),
                        0 15px 25px rgba(0,0,0,0.3),
                        inset 0 1px 0 rgba(255,255,255,0.5);
                    text-decoration: none;
                    overflow: hidden;
                }
                /* Shimmer/light reflection pseudo-element */
                .mm-big-btn::before {
                    content: '';
                    position: absolute;
                    top: 0; left: -80%;
                    width: 60%;
                    height: 100%;
                    background: linear-gradient(120deg, transparent, rgba(255,255,255,0.35), transparent);
                    transform: skewX(-20deg);
                    transition: left 0.5s;
                    pointer-events: none;
                }
                .mm-big-btn:hover::before {
                    left: 120%;
                }
                /* Top gloss overlay */
                .mm-big-btn::after {
                    content: '';
                    position: absolute;
                    top: 0; left: 0;
                    right: 0;
                    height: 50%;
                    background: linear-gradient(to bottom, rgba(255,255,255,0.25), transparent);
                    border-radius: 22px 22px 0 0;
                    pointer-events: none;
                }
                .mm-big-btn:hover {
                    transform: translateY(-5px) scale(1.05);
                    box-shadow:
                        0 15px 0 rgba(0,0,0,0.2),
                        0 20px 30px rgba(0,0,0,0.4),
                        0 0 20px rgba(255,255,255,0.2),
                        inset 0 1px 0 rgba(255,255,255,0.5);
                }
                .mm-big-btn:active {
                    transform: translateY(10px);
                    box-shadow: 0 0px 0 rgba(0,0,0,0.2), 0 5px 10px rgba(0,0,0,0.3);
                }
                /* Unique button gradients with glow colors */
                .mm-btn-play {
                    background: linear-gradient(160deg, #ff9a9e 0%, #f772a1 50%, #fecfef 100%);
                    border-color: rgba(255,255,255,0.9);
                    filter: drop-shadow(0 0 8px rgba(255,100,170,0.4));
                }
                .mm-btn-songs {
                    background: linear-gradient(160deg, #74b9ff 0%, #0984e3 50%, #c2e9fb 100%);
                    border-color: rgba(255,255,255,0.9);
                    filter: drop-shadow(0 0 8px rgba(9,132,227,0.4));
                }
                .mm-btn-chars {
                    background: linear-gradient(160deg, #a29bfe 0%, #6c5ce7 50%, #fbc2eb 100%);
                    border-color: rgba(255,255,255,0.9);
                    filter: drop-shadow(0 0 8px rgba(108,92,231,0.4));
                }
                .mm-btn-shop {
                    background: linear-gradient(160deg, #ffecd2 0%, #fcb69f 50%, #ffd6a5 100%);
                    border-color: rgba(255,255,255,0.9);
                    filter: drop-shadow(0 0 8px rgba(252,182,159,0.4));
                }
                
                .mm-big-btn .icon {
                    font-size: clamp(2rem, 6vw, 3.5rem);
                    margin-bottom: clamp(6px, 1.5vw, 10px);
                    filter: drop-shadow(0 4px 6px rgba(0,0,0,0.2));
                    position: relative; z-index: 1;
                }
                .mm-big-btn .label {
                    color: white;
                    font-size: clamp(0.7rem, 2vw, 1.2rem);
                    font-weight: 900;
                    text-shadow: 0 3px 5px rgba(0,0,0,0.4);
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    position: relative; z-index: 1;
                }

                /* Bottom Nav */
                .mm-bottom-nav {
                    width: 100%;
                    padding: clamp(10px, 2.5vh, 20px) clamp(10px, 4vw, 40px);
                    display: flex;
                    justify-content: center;
                    gap: clamp(20px, 8vw, 60px);
                    z-index: 2;
                    background: linear-gradient(to top, rgba(255,255,255,0.5), transparent);
                    flex-shrink: 0;
                    box-sizing: border-box;
                }
                .mm-nav-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    cursor: pointer;
                    transition: transform 0.2s;
                }
                .mm-nav-item:hover { transform: scale(1.1); }
                .mm-nav-item .icon {
                    font-size: clamp(1.5rem, 5vw, 2.2rem);
                    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
                }
                .mm-nav-item .label {
                    color: rgba(255, 255, 255, 0.9);
                    font-weight: 800;
                    margin-top: 6px;
                    text-shadow: 0 2px 4px rgba(0,0,0,0.5);
                    font-size: clamp(0.65rem, 2vw, 0.9rem);
                    letter-spacing: 1px;
                }
            </style>

            <div class="mm-container">
                <div class="mm-top-hud">
                    <div class="mm-badge"><span>🎮</span> VERSION 1.0</div>
                    <div class="mm-stats">
                        <div class="mm-badge"><span>🪙</span> COINS: 1000</div>
                        <div class="mm-badge"><span>💎</span> GEMS: 50</div>
                    </div>
                </div>

                <div class="mm-ribbon-container">
                    <div class="mm-ribbon">
                        <h1>MAIN MENU</h1>
                    </div>
                </div>

                <div class="mm-center">
                    <!-- Rhythm Game -->
                    <div class="mm-big-btn mm-btn-play" id="btn-rhythm">
                        <div class="icon">🎵</div>
                        <div class="label">PLAY</div>
                    </div>
                    <!-- Editor -->
                    <div class="mm-big-btn mm-btn-songs" id="btn-editor">
                        <div class="icon">💿</div>
                        <div class="label">EDITOR</div>
                    </div>
                    <!-- Pong -->
                    <div class="mm-big-btn mm-btn-chars" id="btn-pong">
                        <div class="icon">🎾</div>
                        <div class="label">PONG</div>
                    </div>
                    <!-- Shop (Placeholder) -->
                    <div class="mm-big-btn mm-btn-shop" id="btn-shop">
                        <div class="icon">🛒</div>
                        <div class="label">SHOP</div>
                    </div>
                </div>

                <div class="mm-bottom-nav">
                    <div class="mm-nav-item">
                        <div class="icon">👥</div>
                        <div class="label">FRIENDS</div>
                    </div>
                    <div class="mm-nav-item" id="btn-settings">
                        <div class="icon">⚙️</div>
                        <div class="label">SETTINGS</div>
                    </div>
                    <div class="mm-nav-item">
                        <div class="icon">✉️</div>
                        <div class="label">INBOX</div>
                    </div>
                </div>
            </div>
        `;

        this.ui.createOverlay('main-menu', html);

        document.getElementById('btn-rhythm')?.addEventListener('click', () => {
            this.hide();
            this.onStartGame('rhythm');
        });

        document.getElementById('btn-editor')?.addEventListener('click', () => {
            this.hide();
            this.onStartGame('editor');
        });

        document.getElementById('btn-pong')?.addEventListener('click', () => {
            this.hide();
            this.onStartGame('pong');
        });

        document.getElementById('btn-settings')?.addEventListener('click', () => {
            this.hide();
            this.showSettings();
        });
    }

    private showSettings(): void {
        this.settingsUI = new SettingsUI((action) => {
            if (action === 'layout_editor') {
                this.settingsUI?.destroy();
                this.onStartGame('layout_editor');
            } else if (action === 'back') {
                this.settingsUI?.destroy();
                this.show();
            }
        });
        this.settingsUI.show();
    }

    public hide(): void {
        this.ui.hide('main-menu');
    }
}

