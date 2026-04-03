import { UIManager } from '../core/ui/UIManager';
import { SettingsUI } from './SettingsUI';
import { MenuMusicManager } from '../core/audio/MenuMusicManager';
import { ThemeManager } from '../core/ThemeManager';

export class MainMenu {
    private ui: UIManager;
    private onStartGame: (mode: string) => void;
    private settingsUI: SettingsUI | null = null;
    private currentLang: string = 'en';
    private themeUnsubscribe: (() => void) | null = null;

    private readonly l10n: any = {
        en: {
            title: 'MAIN MENU',
            subTitle: 'Select Your Activity',
            play: 'PLAY',
            playDesc: 'Rhythm Game',
            editor: 'EDITOR',
            editorDesc: 'Create Maps',
            pong: 'PONG',
            pongDesc: 'Mini Game',
            shop: 'SHOP',
            shopDesc: 'Items & Skins',
            friends: 'FRIENDS',
            settings: 'SETTINGS',
            inbox: 'INBOX',
            version: 'TEST VERSION'
        },
        ko: {
            title: '메인 메뉴',
            subTitle: '활동을 선택하세요',
            play: '플레이',
            playDesc: '리듬 게임',
            editor: '에디터',
            editorDesc: '맵 제작',
            pong: '퐁',
            pongDesc: '미니 게임',
            shop: '상점',
            shopDesc: '아이템 및 스킨',
            friends: '친구',
            settings: '설정',
            inbox: '메시지',
            version: '테스트 버전'
        },
        ja: {
            title: 'メインメニュー',
            subTitle: 'アク티비티を選択',
            play: 'プレイ',
            playDesc: 'リズムゲーム',
            editor: 'エディター',
            editorDesc: 'マップ作成',
            pong: 'ポン',
            pongDesc: 'ミニゲーム',
            shop: 'ショップ',
            shopDesc: 'アイテム＆スキン',
            friends: 'フレンド',
            settings: '設定',
            inbox: '受信トレイ',
            version: 'テストバージョン'
        }
    };

    constructor(onStartGame: (mode: string) => void) {
        this.ui = UIManager.getInstance();
        this.onStartGame = onStartGame;
    }

    public show(): void {
        const t = this.l10n[this.currentLang];
        MenuMusicManager.getInstance().playMusic('main');

        const styles = `
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Outfit:wght@900&display=swap');

                /* ── DESIGN TOKENS ── */
                :root {
                    --mm-blur: 16px; /* Slightly deeper blur v53 */
                    --mm-glass-bg: rgba(0, 0, 0, 0.45); /* Darker/More solid base v53 */
                    --mm-glass-border: rgba(255, 255, 255, 0.25); /* Stronger edges v53 */
                    --mm-text-shadow: 0 2px 10px rgba(0,0,0,0.9);
                }

                /* ── ANIMATIONS ── */
                @keyframes mm-fadeInDown {
                    from { opacity: 0; transform: translateY(-20px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes mm-fadeInUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes mm-cardIn {
                    from { opacity: 0; transform: translateY(30px) scale(0.95); }
                    to   { opacity: 1; transform: translateY(0)    scale(1); }
                }

                /* ── TOP HUD (Persistent Overlay) ── */
                .mm-top-hud {
                    position: fixed;
                    top: 0; left: 0; right: 0;
                    z-index: 200; /* Stays above everything v45 */
                    padding: clamp(6px, 1.5vh, 12px) clamp(16px, 4vw, 48px);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    animation: mm-fadeInDown 0.5s ease both;
                    background: linear-gradient(to bottom, rgba(0,0,0,0.6), transparent);
                    pointer-events: none; /* Clicks through to UI below */
                    height: clamp(50px, 8vh, 80px); /* Fixed height ceiling v46 */
                    box-sizing: border-box;
                }
                .mm-top-hud > * { pointer-events: auto; } /* Enable hud buttons */

                .mm-top-spacer {
                    height: clamp(50px, 8vh, 80px); /* Matches HUD height to prevent overlap v46 */
                    width: 100%;
                    flex-shrink: 0;
                }

                .mm-version-badge {
                    margin-left: 100px; /* Shift to avoid FPS counter overlap v50 */
                }
                .mm-version-badge, .mm-currency-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: clamp(4px, 1vh, 8px) clamp(12px, 2.5vw, 24px);
                    background: var(--mm-glass-bg);
                    border: 1px solid var(--mm-glass-border);
                    border-radius: 999px;
                    backdrop-filter: blur(var(--mm-blur));
                    -webkit-backdrop-filter: blur(var(--mm-blur));
                    font-weight: 800;
                    font-size: clamp(0.7rem, 1.5vh, 0.9rem);
                    text-shadow: var(--mm-text-shadow);
                    white-space: nowrap;
                    color: white;
                }
                .mm-currency-badge.gold { border-color: rgba(255,210,80,0.4); background: rgba(255,190,0,0.1); }
                .mm-currency-badge.gem { border-color: rgba(130,180,255,0.4); background: rgba(80,130,255,0.1); }

                /* ── BGM BADGE ── */
                .mm-bgm-badge {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    padding: clamp(4px, 1vh, 8px) clamp(12px, 2.5vw, 24px);
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 999px;
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    font-size: clamp(0.7rem, 1.5vh, 0.85rem);
                    font-weight: 800;
                    color: rgba(255,255,255,0.85);
                    text-shadow: var(--mm-text-shadow);
                    white-space: nowrap;
                    min-width: clamp(200px, 25vw, 350px);
                    overflow: hidden;
                }
                .mm-visualizer { display: flex; align-items: flex-end; gap: 3px; height: clamp(10px, 1.8vh, 18px); padding-bottom: 2px; }
                .mm-vis-bar {
                    width: 3px; background: #ff006e; border-radius: 2px;
                    animation: mm-vis-jump 0.6s infinite ease-in-out;
                    box-shadow: 0 0 8px rgba(255, 0, 110, 0.4);
                }
                .mm-vis-bar:nth-child(1) { animation-duration: 0.4s; height: 40%; }
                .mm-vis-bar:nth-child(2) { animation-duration: 0.7s; height: 70%; }
                .mm-vis-bar:nth-child(3) { animation-duration: 0.5s; height: 55%; }
                @keyframes mm-vis-jump { 0%, 100% { height: 30%; } 50% { height: 90%; } }

                .mm-bgm-text-wrapper {
                    flex: 1; width: clamp(150px, 20vw, 300px); overflow: hidden;
                    mask-image: linear-gradient(to right, transparent, black 15%, black 85%, transparent);
                    -webkit-mask-image: linear-gradient(to right, transparent, black 15%, black 85%, transparent);
                    display: flex;
                }
                .mm-bgm-text-content { display: flex; width: max-content; animation: mm-marquee 18s linear infinite; }
                .mm-bgm-text-item { white-space: nowrap; padding-right: clamp(100px, 15vw, 200px); }
                @keyframes mm-marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }

                /* ── MAIN MENU CONTAINER ── */
                .mm-container {
                    position: fixed; inset: 0; width: 100vw; height: 100vh;
                    display: flex; flex-direction: column;
                    justify-content: space-between;
                    font-family: 'Outfit', 'Black Han Sans', sans-serif;
                    color: white; overflow: hidden; z-index: 50;
                    user-select: none; box-sizing: border-box;
                    /* Reduced direct vignetting to 'swap' transparency v53 */
                    box-shadow: inset 0 0 120px rgba(0,0,0,0.4); 
                    background: radial-gradient(ellipse 120% 60% at 50% 0%, rgba(240,147,251,0.04) 0%, transparent 70%),
                                radial-gradient(ellipse 120% 60% at 50% 100%, rgba(245, 87,108,0.06) 0%, transparent 70%);
                }

                /* ── CENTER STACK ── */
                .mm-content-center {
                    flex: 1; display: flex; flex-direction: column;
                    align-items: center; justify-content: center;
                    gap: clamp(20px, 4vh, 50px); /* Responsive gap v52 */
                    animation: mm-fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
                    width: 100%;
                    min-height: 0; /* Allow shrinking to save footer v52 */
                }

                .mm-title-box {
                    display: flex; flex-direction: column; align-items: center;
                    padding: clamp(8px, 1.2vh, 12px) clamp(20px, 5vw, 60px);
                    /* Swapped: More solid/dark background for Title v53 */
                    background: rgba(0, 0, 0, 0.55); border: 2px solid var(--mm-glass-border);
                    border-radius: 40px; backdrop-filter: blur(var(--mm-blur));
                    box-shadow: 0 15px 50px rgba(0,0,0,0.6);
                    transform-origin: center;
                    flex-shrink: 0;
                }
                .mm-main-title-text {
                    font-family: 'Black Han Sans', sans-serif; font-size: clamp(2.5rem, 7vh, 4.2rem); font-weight: 900;
                    margin: 0; padding: 0; line-height: 1.1;
                    background: linear-gradient(to bottom, #ffffff 0%, #e0e7ff 100%);
                    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
                    filter: drop-shadow(0 4px 10px rgba(0,0,0,0.85));
                    text-transform: uppercase;
                }
                .mm-main-title-sub { 
                    font-size: clamp(0.7rem, 1.4vh, 0.9rem); color: rgba(255,255,255,0.9); 
                    letter-spacing: 8px; font-weight: 900; margin-top: 8px; text-transform: uppercase;
                }

                .mm-panel {
                    background: var(--mm-glass-bg); border: 1px solid var(--mm-glass-border);
                    border-radius: 50px; backdrop-filter: blur(var(--mm-blur));
                    padding: clamp(15px, 2.5vh, 30px); box-shadow: 0 25px 80px rgba(0,0,0,0.5);
                    width: clamp(320px, 92vw, 1150px);
                    max-height: 50vh; display: flex; align-items: center; justify-content: center;
                    flex-shrink: 1; min-height: 0;
                }
                @media (max-height: 720px) {
                    .mm-panel { max-height: 42vh; }
                    .mm-content-center { gap: clamp(10px, 2vh, 25px); }
                    .mm-title-box { padding: 6px 30px; }
                }
                @media (max-height: 600px) {
                    .mm-panel { max-height: 36vh; border-radius: 30px; }
                    .mm-card { gap: 4px; }
                    .mm-card-icon { font-size: 1.8rem; }
                    .mm-bottom-nav { height: 90px; padding-bottom: 20px; gap: 40px; }
                }
                .mm-center { display: flex; width: 100%; gap: 25px; justify-content: center; }
                .mm-card {
                    position: relative; flex: 1; aspect-ratio: 1.4 / 1; border-radius: 30px;
                    border: 3px solid rgba(255,255,255,0.35); display: flex; flex-direction: column;
                    align-items: center; justify-content: center; gap: 12px; cursor: pointer; overflow: hidden;
                    transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
                }
                .mm-card-play { background: linear-gradient(135deg, rgba(255,0,110,1), rgba(255,100,50,1)); }
                .mm-card-editor { background: linear-gradient(135deg, rgba(255,200,0,1), rgba(180,255,0,1)); }
                .mm-card-pong { background: linear-gradient(135deg, rgba(140,255,0,1), rgba(0,210,255,1)); }
                .mm-card-shop { background: linear-gradient(135deg, rgba(0,210,255,1), rgba(120,0,255,1)); }
                .mm-card:hover { transform: scale(1.06) translateY(-8px); border-color: white; box-shadow: 0 10px 30px rgba(255,255,255,0.2); }
                .mm-card-icon { font-size: clamp(2rem, 5vh, 2.8rem); filter: drop-shadow(0 2px 5px rgba(0,0,0,0.3)); } /* Restrengthened v51 */
                .mm-card-label { font-family: 'Black Han Sans', sans-serif; font-size: clamp(0.9rem, 1.8vh, 1.25rem); }
                .mm-card-sub { font-size: clamp(0.6rem, 1vh, 0.75rem); opacity: 0.8; text-transform: uppercase; font-weight: 800; }

                .mm-bottom-nav {
                    flex: 0 0 auto; height: clamp(90px, 12vh, 120px); /* Fluid height with strict floor v52 */
                    padding-bottom: clamp(15px, 3vh, 30px); display: flex; justify-content: center; align-items: center;
                    gap: clamp(40px, 8vw, 100px); background: linear-gradient(to top, rgba(0,0,0,0.85), transparent);
                    flex-shrink: 0; /* Never squash the footer! v52 */
                }
                .mm-nav-item { display: flex; flex-direction: column; align-items: center; gap: 12px; cursor: pointer; opacity: 0.75; transition: 0.3s; }
                .mm-nav-item:hover { opacity: 1; transform: translateY(-8px); }
                .mm-nav-icon { font-size: clamp(2rem, 5vh, 2.8rem); }
                .mm-nav-label { font-size: 1rem; font-weight: 900; text-transform: uppercase; }

                .mm-lang-group { display: flex; gap: 25px; margin-left: 60px; border-left: 2px solid rgba(255,255,255,0.2); padding-left: 60px; }
                .mm-flag-btn { font-size: 2.5rem; cursor: pointer; opacity: 0.4; transition: 0.3s; }
                .mm-flag-btn.active, .mm-flag-btn:hover { opacity: 1; transform: scale(1.3) translateY(-4px); }
                .mm-nav-item { display: flex; flex-direction: column; align-items: center; gap: 10px; cursor: pointer; opacity: 0.8; transition: 0.2s; }
                .mm-nav-item:hover { opacity: 1; transform: translateY(-6px); }
                .mm-nav-icon { font-size: clamp(2.5rem, 6vh, 3.5rem); } /* Enlarged footer icons v49 */
                .mm-nav-label { font-size: clamp(0.85rem, 2vh, 1.2rem); font-weight: 900; text-transform: uppercase; }

                .mm-lang-group { 
                    display: flex; gap: 20px; margin-left: 50px; 
                    border-left: 3px solid rgba(255,255,255,0.2); 
                    padding: 10px 0 10px 50px; 
                }
                .mm-flag-btn { font-size: clamp(2.2rem, 5.5vh, 3.2rem); cursor: pointer; opacity: 0.4; transition: 0.2s; }
                .mm-flag-btn.active, .mm-flag-btn:hover { opacity: 1; transform: scale(1.25) translateY(-4px); }
            </style>
        `;

        const hudHtml = `
            ${styles}
            <div class="mm-top-hud">
                <div class="mm-version-badge">🎮 ${t.version}</div>
                <div class="mm-bgm-badge" id="mm-bgm-container">
                    <div class="mm-visualizer">
                        <div class="mm-vis-bar"></div>
                        <div class="mm-vis-bar"></div>
                        <div class="mm-vis-bar"></div>
                    </div>
                    <div class="mm-bgm-text-wrapper">
                        <div class="mm-bgm-text-content">
                            <span class="mm-bgm-text-item mm-bgm-text-target">Loading...</span>
                            <span class="mm-bgm-text-item mm-bgm-text-target">Loading...</span>
                        </div>
                    </div>
                </div>
                <div class="mm-hud-right">
                    <div class="mm-currency-badge gold">🪙 1,000</div>
                    <div class="mm-currency-badge gem">💎 50</div>
                </div>
            </div>
        `;

        const bodyHtml = `
            <div class="mm-container">
                <div class="mm-top-spacer"></div>
                <div class="mm-content-center">
                    <div class="mm-title-box">
                        <div class="mm-main-title-text">${t.title}</div>
                        <div class="mm-main-title-sub">${t.subTitle}</div>
                    </div>
                    <div class="mm-panel">
                        <div class="mm-center">
                            <div class="mm-card mm-card-play" id="btn-rhythm">
                                <div class="mm-card-icon">🎵</div>
                                <div class="mm-card-label">${t.play}</div>
                                <div class="mm-card-sub">${t.playDesc}</div>
                            </div>
                            <div class="mm-card mm-card-editor" id="btn-editor">
                                <div class="mm-card-icon">💿</div>
                                <div class="mm-card-label">${t.editor}</div>
                                <div class="mm-card-sub">${t.editorDesc}</div>
                            </div>
                            <div class="mm-card mm-card-pong" id="btn-pong">
                                <div class="mm-card-icon">🎾</div>
                                <div class="mm-card-label">${t.pong}</div>
                                <div class="mm-card-sub">${t.pongDesc}</div>
                            </div>
                            <div class="mm-card mm-card-shop" id="btn-shop">
                                <div class="mm-card-icon">🛒</div>
                                <div class="mm-card-label">${t.shop}</div>
                                <div class="mm-card-sub">${t.shopDesc}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="mm-bottom-nav">
                    <div class="mm-nav-item">
                        <div class="mm-nav-icon">👥</div>
                        <div class="mm-nav-label">${t.friends}</div>
                    </div>
                    <div class="mm-nav-item" id="btn-settings">
                        <div class="mm-nav-icon">⚙️</div>
                        <div class="mm-nav-label">${t.settings}</div>
                    </div>
                    <div class="mm-nav-item">
                        <div class="mm-nav-icon">✉️</div>
                        <div class="mm-nav-label">${t.inbox}</div>
                    </div>
                    <div class="mm-lang-group">
                        <div class="mm-flag-btn ${this.currentLang === 'en' ? 'active' : ''}" id="lang-en" title="English">🇺🇸</div>
                        <div class="mm-flag-btn ${this.currentLang === 'ko' ? 'active' : ''}" id="lang-ko" title="한국어">🇰🇷</div>
                        <div class="mm-flag-btn ${this.currentLang === 'ja' ? 'active' : ''}" id="lang-ja" title="日本語">🇯🇵</div>
                    </div>
                </div>
            </div>
        `;

        this.ui.createOverlay('global-hud', hudHtml);
        this.ui.createOverlay('main-menu', bodyHtml);

        this.attachListeners();
        
        // Initialize BGM Text and subscribe
        this.updateBGMText();
        if (this.themeUnsubscribe) this.themeUnsubscribe();
        this.themeUnsubscribe = ThemeManager.getInstance().subscribe(() => {
            this.updateBGMText();
        });
    }

    private attachListeners(): void {
        document.getElementById('btn-rhythm')?.addEventListener('click', () => {
            this.hideAll();
            this.onStartGame('rhythm');
        });
        document.getElementById('btn-editor')?.addEventListener('click', () => {
            this.hideAll();
            this.onStartGame('editor');
        });
        document.getElementById('btn-pong')?.addEventListener('click', () => {
            this.hideAll();
            this.onStartGame('pong');
        });
        document.getElementById('btn-settings')?.addEventListener('click', () => {
            this.hideMenuOnly();
            this.showSettings();
        });

        // Language switchers
        document.getElementById('lang-en')?.addEventListener('click', () => {
            if (this.currentLang === 'en') return;
            this.currentLang = 'en';
            this.show();
        });
        document.getElementById('lang-ko')?.addEventListener('click', () => {
            if (this.currentLang === 'ko') return;
            this.currentLang = 'ko';
            this.show();
        });
        document.getElementById('lang-ja')?.addEventListener('click', () => {
            if (this.currentLang === 'ja') return;
            this.currentLang = 'ja';
            this.show();
        });
    }

    private updateBGMText(): void {
        const theme = ThemeManager.getInstance().getCurrentTheme();
        const textElements = document.querySelectorAll('.mm-bgm-text-target');
        if (textElements.length > 0 && theme.bgm) {
            const parts = theme.bgm.split('/');
            const filename = parts[parts.length - 1];
            textElements.forEach(el => {
                (el as HTMLElement).innerText = filename;
            });
            const container = document.getElementById('mm-bgm-container');
            if (container) container.title = theme.songTitle || filename;
        }
    }

    private showSettings(): void {
        this.settingsUI = new SettingsUI((action) => {
            if (action === 'layout_editor') {
                this.settingsUI?.destroy();
                this.hideAll();
                this.onStartGame('layout_editor');
            } else if (action === 'back') {
                this.settingsUI?.destroy();
                this.show(); // This will re-create/re-show both HUD and Menu
            }
        });
        this.settingsUI.show();
    }

    public hideMenuOnly(): void {
        this.ui.hide('main-menu');
    }

    public hideAll(): void {
        if (this.themeUnsubscribe) {
            this.themeUnsubscribe();
            this.themeUnsubscribe = null;
        }
        this.ui.hide('main-menu');
        this.ui.hide('global-hud');
    }

    public hide(): void {
        this.hideMenuOnly();
    }
}
