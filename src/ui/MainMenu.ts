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
            subTitle: 'アク티ビティを選択',
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
        const html = `
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Outfit:wght@900&display=swap');

                /* ── DESIGN TOKENS ── */
                :root {
                    --mm-blur: 12px;
                    --mm-glass-bg: rgba(255, 255, 255, 0.07);
                    --mm-glass-border: rgba(255, 255, 255, 0.18);
                    --mm-text-shadow: 0 2px 8px rgba(0,0,0,0.8);
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
                @keyframes mm-shimmer {
                    0%   { left: -100%; }
                    100% { left: 200%; }
                }

                /* ── ROOT CONTAINER ── */
                .mm-container {
                    position: fixed;
                    inset: 0;
                    width: 100vw; height: 100vh;
                    background: transparent;
                    display: grid;
                    grid-template-rows: auto 1fr auto;
                    font-family: 'Outfit', 'Black Han Sans', sans-serif;
                    color: white;
                    overflow: hidden;
                    z-index: 50;
                    user-select: none;
                    box-sizing: border-box;
                    box-shadow: inset 0 0 180px rgba(0,0,0,0.45);
                }
                .mm-container::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background:
                        radial-gradient(ellipse 120% 60% at 50% 0%,   rgba(240,147,251,0.08) 0%, transparent 70%),
                        radial-gradient(ellipse 120% 60% at 50% 100%, rgba(245, 87,108,0.1) 0%, transparent 70%);
                    pointer-events: none;
                    z-index: 0;
                }

                /* ── TOP HUD ── */
                .mm-top-hud {
                    position: relative;
                    z-index: 5;
                    padding: clamp(6px, 1.5vh, 12px) clamp(16px, 4vw, 48px);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    animation: mm-fadeInDown 0.5s ease both;
                    background: linear-gradient(to bottom, rgba(0,0,0,0.5), transparent);
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
                }
                .mm-currency-badge.gold { border-color: rgba(255,210,80,0.4); background: rgba(255,190,0,0.1); }
                .mm-currency-badge.gem { border-color: rgba(130,180,255,0.4); background: rgba(80,130,255,0.1); }

                /* ── MAIN BODY (FLEX FLOW) ── */
                .mm-body {
                    position: relative;
                    z-index: 2;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: clamp(10px, 2.5vh, 30px);
                    padding: clamp(10px, 2vh, 40px) 20px;
                    overflow: hidden; /* Contain children */
                }

                /* ── TITLE BOX (The "Box-shaped Button" UI) ── */
                .mm-title-box {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: clamp(8px, 2vh, 16px) clamp(20px, 5vw, 60px);
                    background: var(--mm-glass-bg);
                    border: 1px solid var(--mm-glass-border);
                    border-radius: clamp(16px, 3vh, 32px);
                    backdrop-filter: blur(var(--mm-blur));
                    -webkit-backdrop-filter: blur(var(--mm-blur));
                    box-shadow: 0 10px 40px rgba(0,0,0,0.35);
                    animation: mm-fadeInDown 0.6s 0.1s ease both;
                    flex-shrink: 0; /* Title shouldn't shrink too much */
                }
                .mm-main-title-text {
                    font-family: 'Black Han Sans', sans-serif;
                    font-size: clamp(2rem, 6vh, 4.5rem);
                    font-weight: 900;
                    letter-spacing: clamp(4px, 1vw, 12px);
                    /* Brighter White-Silver Look */
                    background: linear-gradient(to bottom, #ffffff 0%, #d0d8ff 100%);
                    -webkit-background-clip: text;
                    background-clip: text;
                    -webkit-text-fill-color: transparent; /* Required: show gradient, not solid fill */
                    color: transparent; /* Fallback */
                    -webkit-text-stroke: 1px rgba(0,0,0,0.6);
                    paint-order: stroke fill;
                    /* Deep Drop Shadow */
                    filter:
                        drop-shadow(0 3px 8px rgba(0,0,0,0.95))
                        drop-shadow(0 0 12px rgba(165,180,252,0.35));
                    text-transform: uppercase;
                }
                .mm-main-title-sub {
                    font-size: clamp(0.6rem, 1.2vh, 0.85rem);
                    color: #ff006e;
                    letter-spacing: 6px;
                    text-transform: uppercase;
                    font-weight: 900;
                    margin-top: 4px;
                    text-shadow: 0 0 12px rgba(255,0,110,0.5);
                }

                /* ── MAIN PANEL ── */
                .mm-panel {
                    position: relative;
                    background: var(--mm-glass-bg);
                    border: 1px solid var(--mm-glass-border);
                    border-radius: clamp(24px, 5vh, 48px);
                    backdrop-filter: blur(var(--mm-blur));
                    -webkit-backdrop-filter: blur(var(--mm-blur));
                    padding: clamp(15px, 2.5vh, 30px);
                    box-shadow: 0 15px 60px rgba(0,0,0,0.4);
                    animation: mm-cardIn 0.5s 0.1s ease both;
                    width: clamp(320px, 94vw, 1200px);
                    max-height: 55vh; /* Safe vertical limit */
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 1; /* Allow shrinking for small heights */
                }

                .mm-center {
                    display: flex;
                    width: 100%;
                    gap: clamp(10px, 2vw, 30px);
                    justify-content: center;
                }

                /* ── MENU CARDS ── */
                .mm-card {
                    position: relative;
                    flex: 1;
                    aspect-ratio: 1.25 / 1;
                    max-height: 100%;
                    border-radius: clamp(14px, 2.5vh, 28px);
                    border: 3px solid rgba(255,255,255,0.4);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    cursor: pointer;
                    overflow: hidden;
                    transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
                    backdrop-filter: blur(var(--mm-blur));
                    -webkit-backdrop-filter: blur(var(--mm-blur));
                    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
                }
                /* Combined Gloss/Reflection into one ::after for clean code */
                .mm-card::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 60%);
                    pointer-events: none;
                }
                
                .mm-card-play   { background: linear-gradient(135deg, rgba(255,0,110,0.85), rgba(255,128,64,0.85)); }
                .mm-card-editor { background: linear-gradient(135deg, rgba(255,208,0,0.85), rgba(208,255,0,0.85)); }
                .mm-card-pong   { background: linear-gradient(135deg, rgba(162,255,0,0.85), rgba(0,210,255,0.85)); }
                .mm-card-shop   { background: linear-gradient(135deg, rgba(0,210,255,0.85), rgba(112,0,255,0.85)); }

                .mm-card:hover {
                    transform: scale(1.05) translateY(-6px);
                    border-color: white;
                    box-shadow: 0 15px 35px rgba(0,0,0,0.3), 0 0 20px rgba(255,255,255,0.25);
                }
                .mm-card:active { transform: scale(0.98); }

                .mm-card-icon { font-size: clamp(2.5rem, 8vh, 5.5rem); color: white; }
                .mm-card-label { 
                    font-family: 'Black Han Sans', sans-serif; 
                    font-size: clamp(1rem, 2vh, 1.8rem); 
                    text-shadow: var(--mm-text-shadow); 
                }
                .mm-card-sub { font-size: 0.75rem; opacity: 0.9; text-transform: uppercase; font-weight: 800; }

                /* ── BOTTOM NAV ── */
                .mm-bottom-nav {
                    z-index: 5;
                    padding: clamp(8px, 1.8vh, 16px) clamp(16px, 4vw, 48px);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: clamp(15px, 4vw, 60px);
                    background: linear-gradient(to top, rgba(0,0,0,0.5), transparent);
                    animation: mm-fadeInUp 0.5s 0.2s ease both;
                }
                .mm-nav-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 6px;
                    cursor: pointer;
                    opacity: 0.75;
                    transition: all 0.2s;
                    padding: 8px 20px;
                }
                .mm-nav-item:hover { opacity: 1; transform: translateY(-4px); }
                .mm-nav-icon { font-size: clamp(2rem, 5vh, 3.2rem); }
                .mm-nav-label { font-size: clamp(0.7rem, 1.6vh, 0.95rem); font-weight: 900; text-transform: uppercase; }

                /* ── LANG SWITCHER ── */
                .mm-lang-group { display: flex; gap: 15px; margin-left: 30px; border-left: 1px solid rgba(255,255,255,0.2); padding-left: 30px; }
                .mm-flag-btn { font-size: 1.8rem; cursor: pointer; opacity: 0.4; transition: 0.2s; }
                .mm-flag-btn.active, .mm-flag-btn:hover { opacity: 1; transform: scale(1.15); }
                
                /* ── BGM BADGE ── */
                .mm-bgm-badge {
                    position: absolute;
                    bottom: clamp(10px, 2vh, 20px);
                    left: clamp(10px, 3vw, 40px);
                    padding: 8px 16px;
                    background: rgba(0,0,0,0.4);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 12px;
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px);
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 0.85rem;
                    font-weight: 700;
                    color: rgba(255,255,255,0.9);
                    z-index: 10;
                    animation: mm-fadeInUp 0.6s 0.4s ease both;
                    pointer-events: none;
                }
                .mm-bgm-icon {
                    color: #ff006e;
                    animation: mm-pulse 2s infinite ease-in-out;
                }
                @keyframes mm-pulse {
                    0%, 100% { transform: scale(1); opacity: 0.8; }
                    50% { transform: scale(1.2); opacity: 1; }
                }

                /* ── RESPONSIVE COMPACT ── */
                @media (max-height: 520px) {
                    .mm-body { gap: 10px; padding: 5px 20px; }
                    .mm-title-box { padding: 4px 30px; border-radius: 12px; }
                    .mm-main-title-text { font-size: clamp(1.2rem, 10vh, 2.22rem); }
                    .mm-main-title-sub { display: none; }
                    .mm-panel { max-height: 65vh; padding: 10px; border-radius: 20px; }
                    .mm-card-sub { display: none; }
                    .mm-nav-label { display: none; }
                    .mm-bottom-nav { gap: 20px; }
                }
            </style>

            <div class="mm-container">

                <!-- TOP HUD -->
                <div class="mm-top-hud">
                    <div class="mm-version-badge">🎮 ${t.version}</div>
                    <div class="mm-hud-right">
                        <div class="mm-currency-badge gold">🪙 1,000</div>
                        <div class="mm-currency-badge gem">💎 50</div>
                    </div>
                </div>

                <!-- MAIN WORK AREA (Vertical Flow) -->
                <div class="mm-body">
                    
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

                <!-- BOTTOM NAV + LANG SWITCHER -->
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

                <!-- BGM BADGE -->
                <div class="mm-bgm-badge" id="mm-bgm-container">
                    <span class="mm-bgm-icon">♫</span>
                    <span id="mm-bgm-text">Loading...</span>
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

        // Initialize BGM Text and subscribe to updates
        this.updateBGMText();
        if (this.themeUnsubscribe) this.themeUnsubscribe();
        this.themeUnsubscribe = ThemeManager.getInstance().subscribe(() => {
            this.updateBGMText();
        });
    }

    private updateBGMText(): void {
        const theme = ThemeManager.getInstance().getCurrentTheme();
        const textEl = document.getElementById('mm-bgm-text');
        if (textEl) {
            textEl.innerText = theme.songTitle || 'Nexus Sphere BGM';
        }
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
        if (this.themeUnsubscribe) {
            this.themeUnsubscribe();
            this.themeUnsubscribe = null;
        }
        this.ui.hide('main-menu');
    }
}

