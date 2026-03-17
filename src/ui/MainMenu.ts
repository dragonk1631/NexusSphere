import { UIManager } from '../core/ui/UIManager';
import { SettingsUI } from './SettingsUI';
import { MenuMusicManager } from '../core/audio/MenuMusicManager';

export class MainMenu {
    private ui: UIManager;
    private onStartGame: (mode: string) => void;
    private settingsUI: SettingsUI | null = null;
    private currentLang: string = 'en';

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
                /* ── IMPORT FONTS (Technika Gothic v17) ── */
                @import url('https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Outfit:wght@900&display=swap');

                /* =========================================
                   NEXUS SPHERE — MAIN MENU  (Premium v2)
                   Transparent bg: game canvas shows through
                   ========================================= */

                @keyframes mm-fadeInDown {
                    from { opacity: 0; transform: translateY(-24px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes mm-fadeInUp {
                    from { opacity: 0; transform: translateY(24px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes mm-cardIn {
                    from { opacity: 0; transform: translateY(30px) scale(0.92); }
                    to   { opacity: 1; transform: translateY(0)    scale(1); }
                }
                @keyframes mm-titlePulse {
                    0%, 100% { text-shadow: 0 0 20px rgba(240,147,251,0.8), 0 0 40px rgba(240,147,251,0.4), 0 4px 0 rgba(0,0,0,0.5); }
                    50%      { text-shadow: 0 0 30px rgba(245,87,108,1),     0 0 60px rgba(245,87,108,0.6), 0 4px 0 rgba(0,0,0,0.5); }
                }
                @keyframes mm-shimmer {
                    0%   { left: -100%; }
                    100% { left: 200%; }
                }

                /* ── Container (Outfit v17 - Repaired) ── */
                .mm-container {
                    position: fixed;
                    top: 0; left: 0; width: 100vw; height: 100vh;
                    background: transparent; /* REDEEMED: Game canvas shows through */
                    display: grid;
                    grid-template-rows: auto 1fr auto;
                    font-family: 'Outfit', 'Black Han Sans', sans-serif;
                    overflow: hidden;
                    color: white;
                    overflow: hidden;
                    padding-bottom: 0;
                    z-index: 50;
                    user-select: none;
                    box-sizing: border-box;
                    /* Subtle darkening vignette - preserves colour, adds depth */
                    box-shadow: inset 0 0 180px rgba(0,0,0,0.45);
                }

                /* ── Vignette overlay ── */
                .mm-container::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background:
                        radial-gradient(ellipse 120% 60% at 50% 0%,   rgba(240,147,251,0.10) 0%, transparent 70%),
                        radial-gradient(ellipse 120% 60% at 50% 100%, rgba(245, 87,108,0.12) 0%, transparent 70%);
                    pointer-events: none;
                    z-index: 0;
                }

                /* ── TOP HUD ── */
                .mm-top-hud {
                    position: relative;
                    z-index: 2;
                    width: 100%;
                    box-sizing: border-box;
                    padding: clamp(10px, 2vh, 18px) clamp(16px, 4vw, 48px);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    animation: mm-fadeInDown 0.5s ease both;
                    background: linear-gradient(to bottom, rgba(0,0,0,0.40), transparent);
                }
                /* Right-align the currency group */
                .mm-hud-right {
                    justify-self: end;
                }
                /* ── CENTERED MAIN TITLE ── */
                .mm-main-title {
                    text-align: center;
                    margin-bottom: clamp(15px, 3vh, 35px);
                    animation: mm-fadeInDown 0.6s 0.1s ease both;
                    z-index: 2;
                }
                .mm-title-box {
                    display: inline-block;
                    padding: clamp(10px, 2.5vh, 20px) clamp(25px, 6vw, 60px);
                    background: rgba(255,255,255,0.06);
                    border: 1px solid rgba(255,255,255,0.20);
                    border-radius: clamp(16px, 3vh, 32px);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                }
                .mm-main-title-text {
                    font-family: 'Black Han Sans', sans-serif;
                    font-size: clamp(2.5rem, 8vh, 5.2rem);
                    font-weight: 900;
                    letter-spacing: clamp(4px, 1vw, 15px);
                    /* Brighter Technika Style (v21 Repaired) */
                    background: linear-gradient(to bottom, #ffffff 0%, #f0f4ff 50%, #cadbff 100%);
                    -webkit-background-clip: text;
                    background-clip: text;
                    -webkit-text-fill-color: transparent;
                    color: transparent;
                    /* Robust 1px Outline via Filter (v21) */
                    filter: 
                        drop-shadow(-1px -1px 0 rgba(0,0,0,0.8)) 
                        drop-shadow(1px -1px 0 rgba(0,0,0,0.8)) 
                        drop-shadow(-1px 1px 0 rgba(0,0,0,0.8)) 
                        drop-shadow(1px 1px 0 rgba(0,0,0,0.8))
                        drop-shadow(0 0 15px rgba(165,180,252,0.6));
                    text-transform: uppercase;
                    margin-left: clamp(10px, 2vw, 25px);
                    display: inline-block; /* Ensure block model for clipping */
                }

                .mm-main-title-sub {
                    font-family: 'Outfit', sans-serif;
                    font-size: 0.95rem;
                    color: #ff006e;
                    letter-spacing: 10px;
                    text-transform: uppercase;
                    font-weight: 900;
                    margin-top: 5px;
                    text-shadow: 
                        -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000,
                        0 0 12px rgba(255,0,110,0.6);
                }

                .mm-version-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: clamp(5px, 1.2vh, 9px) clamp(10px, 2.2vw, 20px);
                    background: rgba(255,255,255,0.10);
                    border: 1px solid rgba(255,255,255,0.25);
                    border-radius: 999px;
                    color: white;
                    font-weight: 800;
                    font-size: clamp(0.65rem, 1.5vh, 0.85rem);
                    letter-spacing: 0.5px;
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    text-shadow: 0 1px 3px rgba(0,0,0,0.6);
                    white-space: nowrap;
                }

                .mm-hud-right {
                    display: flex;
                    gap: clamp(6px, 1.5vw, 14px);
                }

                .mm-currency-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: clamp(4px, 0.8vw, 8px);
                    padding: clamp(5px, 1.2vh, 9px) clamp(12px, 2.5vw, 22px);
                    border-radius: 999px;
                    color: white;
                    font-weight: 900;
                    font-size: clamp(0.7rem, 1.6vh, 0.9rem);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    text-shadow: 0 1px 3px rgba(0,0,0,0.6);
                    white-space: nowrap;
                    position: relative;
                    overflow: hidden;
                }
                .mm-currency-badge.gold {
                    background: linear-gradient(135deg, rgba(255,195,0,0.30), rgba(255,140,0,0.20));
                    border: 1px solid rgba(255,210,80,0.50);
                    box-shadow: 0 0 16px rgba(255,180,0,0.20), inset 0 1px 0 rgba(255,255,255,0.20);
                }
                .mm-currency-badge.gem {
                    background: linear-gradient(135deg, rgba(130,180,255,0.30), rgba(80,130,255,0.20));
                    border: 1px solid rgba(140,180,255,0.50);
                    box-shadow: 0 0 16px rgba(100,160,255,0.20), inset 0 1px 0 rgba(255,255,255,0.20);
                }

                /* ── BODY (middle row) ── */
                .mm-body {
                    position: relative;
                    z-index: 2;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    /* Add explicit top/bottom gap to prevent touching screen edges */
                    padding: clamp(20px, 4vh, 60px) 0;
                }

                /* ── PANEL BOX wrapping the cards — Precise 5px Padding ── */
                .mm-panel {
                    position: relative;
                    z-index: 2;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.15);
                    border-radius: clamp(30px, 6vh, 60px);
                    backdrop-filter: blur(28px);
                    -webkit-backdrop-filter: blur(28px);
                    box-shadow:
                        0 12px 80px rgba(0,0,0,0.45),
                        inset 0 1px 0 rgba(255,255,255,0.15);
                    /* Breathable 20px vertical padding as requested v9 */
                    padding: 20px clamp(20px, 4vw, 50px);
                    animation: mm-cardIn 0.5s 0.05s ease both;
                    /* Definitive Container Sizing v13 */
                    width: clamp(320px, 94vw, 1300px);
                    max-width: 95%;
                    height: auto;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                /* ── CENTER BUTTON GRID (Dynamic Single Row v13) ── */
                .mm-center {
                    display: flex;
                    align-items: stretch; /* Match heights across cards */
                    justify-content: center;
                    gap: clamp(12px, 2vw, 40px);
                    flex-wrap: nowrap; /* FORCED SINGLE ROW */
                    width: 100%;
                    padding: 15px; /* Internal balance */
                    box-sizing: border-box;
                }

                /* ── GAME CARD BUTTON (Technika Glossy v14) ── */
                .mm-card {
                    position: relative;
                    flex: 1; /* Scale to fill container */
                    min-width: 0;
                    max-width: none; /* Let container width divide space */
                    aspect-ratio: 1.25 / 1;
                    border-radius: clamp(16px, 3.5vh, 32px);
                    border: 4px solid rgba(255,255,255,0.6);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: clamp(10px, 2vh, 25px);
                    cursor: pointer;
                    overflow: hidden;
                    transition: transform 0.4s cubic-bezier(0.23, 1, 0.32, 1),
                                box-shadow  0.4s cubic-bezier(0.23, 1, 0.32, 1),
                                border-color 0.25s ease;
                    /* Glass Glow effect */
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                    padding: 10px clamp(15px, 2.5vw, 40px);
                    box-sizing: border-box;
                    box-shadow: 0 15px 35px rgba(0,0,0,0.25);
                }

                /* Technika Liquid Gloss Reflection (v15 Refined) */
                .mm-card::after {
                    content: '';
                    position: absolute;
                    top: -10%; left: -10%; right: -10%; height: 60%;
                    background: linear-gradient(135deg, 
                        rgba(255,255,255,0.55) 0%, 
                        rgba(255,255,255,0.15) 45%, 
                        transparent 100%);
                    transform: skewY(-5deg);
                    pointer-events: none;
                    z-index: 2;
                    border-radius: inherit;
                }

                .mm-card-content {
                    display: contents; /* Revert to direct children in flex column */
                }

                /* Entrance staggering */
                .mm-card:nth-child(1) { animation: mm-cardIn 0.55s 0.15s ease both; }
                .mm-card:nth-child(2) { animation: mm-cardIn 0.55s 0.22s ease both; }
                .mm-card:nth-child(3) { animation: mm-cardIn 0.55s 0.29s ease both; }
                .mm-card:nth-child(4) { animation: mm-cardIn 0.55s 0.36s ease both; }

                /* Shimmer sweep on hover */
                .mm-card::before {
                    content: '';
                    position: absolute;
                    top: 0; bottom: 0;
                    left: -100%;
                    width: 55%;
                    background: linear-gradient(120deg, transparent, rgba(255,255,255,0.18), transparent);
                    transform: skewX(-18deg);
                    transition: none;
                    pointer-events: none;
                }
                .mm-card:hover::before {
                    animation: mm-shimmer 0.65s ease forwards;
                }

                /* Top gloss */
                .mm-card::after {
                    content: '';
                    position: absolute;
                    top: 0; left: 0; right: 0;
                    height: 45%;
                    background: linear-gradient(180deg, rgba(255,255,255,0.18), transparent);
                    border-radius: inherit;
                    border-bottom-left-radius: 0;
                    border-bottom-right-radius: 0;
                    pointer-events: none;
                }

                /* Individual Technika Spectrum Gradients (v15) */
                .mm-card-play {
                    background: linear-gradient(135deg, #ff006e 0%, #ff8040 50%, #ffd000 100%);
                    color: #ff006e;
                }
                .mm-card-editor {
                    background: linear-gradient(135deg, #ffd000 0%, #d0ff00 50%, #a2ff00 100%);
                    color: #ffd000;
                }
                .mm-card-pong {
                    background: linear-gradient(135deg, #a2ff00 0%, #00ffca 50%, #00d2ff 100%);
                    color: #a2ff00;
                }
                .mm-card-shop {
                    background: linear-gradient(135deg, #00d2ff 0%, #7000ff 50%, #ff006e 100%);
                    color: #00d2ff;
                }

                .mm-card:hover {
                    transform: scale(1.05) translateY(-5px);
                    box-shadow: 0 20px 45px rgba(0,0,0,0.3), 0 0 30px currentColor;
                    border-color: white;
                }
                .mm-card:active {
                    transform: translateY(2px) scale(0.97);
                    transition-duration: 0.1s;
                }

                /* Card icon (Technika v14) */
                .mm-card-icon {
                    font-size: clamp(3.2rem, 10vh, 6.5rem);
                    line-height: 1;
                    filter: drop-shadow(0 5px 15px rgba(0,0,0,0.2));
                    transition: transform 0.35s cubic-bezier(0.23, 1, 0.32, 1);
                    position: relative; z-index: 3; /* Above gloss */
                    color: white;
                }
                .mm-card:hover .mm-card-icon {
                    transform: scale(1.1) translateY(-12px);
                }

                /* Card labels (Technika Gothic v18 - Thinner Outline) */
                .mm-card-label {
                    font-family: 'Black Han Sans', sans-serif;
                    color: white;
                    font-size: clamp(1.1rem, 2.5vh, 2rem);
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    /* Refined 1px Stroke + Drop Shadow */
                    text-shadow: 
                        -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000,
                        0 5px 12px rgba(0,0,0,0.5);
                    line-height: 1.1;
                    position: relative; z-index: 3;
                }

                .mm-card-sub {
                    font-family: 'Outfit', sans-serif;
                    color: rgba(255,255,255,0.9);
                    font-size: clamp(0.55rem, 1.3vh, 0.9rem);
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 1.5px;
                    text-shadow: 1px 1px 4px rgba(0,0,0,0.8);
                    position: relative; z-index: 3;
                }

                /* ── BOTTOM NAV ── */
                .mm-bottom-nav {
                    position: relative;
                    z-index: 2;
                    width: 100%;
                    box-sizing: border-box;
                    padding: clamp(10px, 2.5vh, 24px) clamp(16px, 4vw, 48px);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: clamp(20px, 5vw, 80px);
                    background: linear-gradient(to top, rgba(0,0,0,0.50), transparent);
                    animation: mm-fadeInUp 0.55s 0.1s ease both;
                }

                .mm-nav-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 10px;
                    cursor: pointer;
                    opacity: 0.8;
                    transition: opacity 0.2s, transform 0.25s cubic-bezier(0.23, 1, 0.32, 1);
                    padding: 12px 24px;
                    border-radius: 20px;
                }
                .mm-nav-item:hover {
                    opacity: 1;
                    transform: translateY(-8px);
                    background: rgba(255,255,255,0.12);
                }
                .mm-nav-item:active {
                    transform: translateY(0);
                    transition-duration: 0.08s;
                }

                .mm-nav-icon {
                    font-size: clamp(2.5rem, 6vh, 4rem);
                    filter: drop-shadow(0 4px 10px rgba(0,0,0,0.5));
                    line-height: 1;
                }

                .mm-nav-label {
                    color: rgba(255,255,255,0.95);
                    font-weight: 900;
                    font-size: clamp(0.7rem, 1.8vh, 1.1rem);
                    text-transform: uppercase;
                    letter-spacing: clamp(1.5px, 0.4vw, 3px);
                    text-shadow: 0 2px 6px rgba(0,0,0,0.7);
                }

                .mm-nav-item.active .mm-nav-icon,
                .mm-nav-item.active .mm-nav-label { color: #f093fb; }
                .mm-nav-item.active { opacity: 1; }

                /* ── LANG SWITCHER (Optimized v10) ── */
                .mm-lang-group {
                    display: flex;
                    gap: clamp(8px, 1.5vw, 20px);
                    margin-left: clamp(15px, 3vw, 40px);
                    padding-left: clamp(15px, 3vw, 40px);
                    border-left: 1px solid rgba(255,255,255,0.15);
                }
                .mm-flag-btn {
                    font-size: 2rem;
                    cursor: pointer;
                    filter: grayscale(0.8) opacity(0.5);
                    transition: all 0.2s;
                }
                .mm-flag-btn:hover {
                    filter: grayscale(0) opacity(1);
                    transform: scale(1.2);
                }
                .mm-flag-btn.active {
                    filter: grayscale(0) opacity(1);
                    transform: scale(1.1);
                    text-shadow: 0 0 15px rgba(255,255,255,0.8);
                }

                /* Compact: Short landscape (mobile phones) */
                @media (max-height: 480px) {
                    .mm-main-title { margin-bottom: 5px; margin-top: -15px; }
                    .mm-main-title-text { font-size: clamp(1rem, 4vh, 1.8rem); }
                    .mm-main-title-sub { font-size: 0.4rem; }
                    /* Strict 20px vertical padding v9 */
                    .mm-panel { 
                        padding: 20px clamp(20px, 4vw, 50px); 
                        border-radius: 20px; 
                        width: 95vw;
                        height: auto; 
                        max-height: 75vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .mm-center { gap: clamp(10px, 3vw, 25px); }
                    .mm-card { max-width: 220px; aspect-ratio: 1.25 / 1; padding: 5px; border-width: 2px; }
                    .mm-card-icon { font-size: clamp(2.5rem, 15vh, 4rem); }
                    .mm-card-label { font-size: 1rem; }
                    .mm-card-sub { display: none; }
                    .mm-body { padding: 5px 0; }
                    .mm-bottom-nav { padding: 5px 30px; gap: clamp(20px, 5vw, 60px); }
                    .mm-nav-label { display: none; }
                    .mm-lang-group { margin-left: 15px; padding-left: 15px; gap: 10px; }
                    .mm-flag-btn { font-size: 1.5rem; }
                }

                /* Very wide screens — limit card size */
                @media (min-width: 1800px) {
                    .mm-center { gap: 56px; }
                    .mm-card { max-width: 230px; }
                }
            </style>

            <div class="mm-container">

                <!-- TOP HUD: version | coins + gems -->
                <div class="mm-top-hud">
                    <div class="mm-version-badge">🎮 <span>${t.version}</span></div>
                    <div class="mm-hud-right">
                        <div class="mm-currency-badge gold">🪙 <span>1,000</span></div>
                        <div class="mm-currency-badge gem">💎 <span>50</span></div>
                    </div>
                </div>

                <!-- BODY: card panel, shifted slightly above center -->
                <div class="mm-body">
                    
                    <!-- REPOSITIONED TITLE CLAM SHELL -->
                    <div class="mm-main-title">
                        <div class="mm-title-box">
                            <div class="mm-main-title-text"><span>${t.title}</span></div>
                            <div class="mm-main-title-sub">${t.subTitle}</div>
                        </div>
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

                        </div> <!-- /mm-center -->
                    </div> <!-- /mm-panel -->
                </div> <!-- /mm-body -->

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

