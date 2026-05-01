import { UIManager } from '../core/ui/UIManager';
import { SettingsUI } from './SettingsUI';
import { ShopUI } from './ShopUI';
import { MenuMusicManager } from '../core/audio/MenuMusicManager';
import { ThemeManager } from '../core/ThemeManager';
import { RankingUI } from './RankingUI';
import { CollectionUI } from './CollectionUI';
import { AuthService } from '../services/auth/AuthService';
import { EconomyManager } from '../core/score/EconomyManager';
import { ScoreManager } from '../core/score/ScoreManager';
import { ExperienceSystem } from '../core/score/ExperienceSystem';
import { DJClassSystem } from '../core/progression/DJClassSystem';
import { LoadingOverlay } from '../games/rhythm/renderer/LoadingOverlay';
import { ModalUI } from './ModalUI';

export class MainMenu {
    private ui: UIManager;
    private onStartGame: (mode: string) => void;
    private settingsUI: SettingsUI | null = null;
    private shopUI: ShopUI | null = null;
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
            ranking: 'RANKING',
            rankingDesc: 'World Tiers',
            collection: 'COLLECTION',
            collectionDesc: 'Your Records',
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
            ranking: '랭킹',
            rankingDesc: '월드 티어',
            collection: '컬렉션',
            collectionDesc: '자신의 기록',
            shop: '상점',
            shopDesc: '아이템 및 스킨',
            friends: '친구',
            settings: '설정',
            inbox: '메시지',
            version: '테스트 버전'
        },
        ja: {
            title: 'メインメニュー',
            subTitle: 'アクティビティを選択',
            play: 'プレイ',
            playDesc: 'リズムゲーム',
            editor: 'エディター',
            editorDesc: 'マップ作成',
            ranking: 'ランキング',
            rankingDesc: 'ワールドティア',
            collection: 'コレクション',
            collectionDesc: '自分の記録',
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
                    --mm-blur: 10px; /* Optimized v54: Lower blur saves CPU/GPU during transitions */
                    --mm-glass-bg: rgba(0, 0, 0, 0.55); /* Darker base to maintain glass look with lower blur */
                    --mm-glass-border: rgba(255, 255, 255, 0.2); 
                    --mm-text-shadow: 0 2px 8px rgba(0,0,0,0.9);
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
                    display: grid;
                    grid-template-columns: 1fr auto 1fr;
                    align-items: center;
                    animation: mm-fadeInDown 0.5s ease both;
                    background: linear-gradient(to bottom, rgba(0,0,0,0.6), transparent);
                    pointer-events: none; /* Clicks through to UI below */
                    height: clamp(50px, 8vh, 80px); /* Fixed height ceiling v46 */
                    box-sizing: border-box;
                }
                /* .mm-top-hud > * { pointer-events: auto; } <-- REMOVED v63: Grid cells were blocking canvas touch */

                .mm-top-spacer {
                    height: clamp(50px, 8vh, 80px); /* Matches HUD height to prevent overlap v46 */
                    width: 100%;
                    flex-shrink: 0;
                }

                .mm-hud-left {
                    justify-self: start;
                    pointer-events: auto;
                    display: flex;
                    gap: clamp(6px, 1vw, 12px);
                    align-items: center;
                }

                .mm-auth-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 10px;
                    height: clamp(24px, 3.2vh, 30px); /* Slimmer height to match BGM v67 */
                    padding: 0 clamp(10px, 2vw, 20px) 0 3px;
                    background: var(--mm-glass-bg);
                    border: 1px solid var(--mm-glass-border);
                    border-radius: 999px;
                    backdrop-filter: blur(var(--mm-blur));
                    -webkit-backdrop-filter: blur(var(--mm-blur));
                    cursor: pointer;
                    transition: 0.2s;
                }
                .mm-auth-badge:hover {
                    background: rgba(255, 255, 255, 0.15);
                    transform: scale(1.05);
                }

                .mm-version-badge { display: none; } /* Replaced by auth info v67 */
                .mm-version-badge, .mm-currency-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    height: clamp(24px, 3.2vh, 30px); /* Unified slim height v67 */
                    padding: 0 clamp(10px, 2vw, 20px);
                    box-sizing: border-box;
                    background: var(--mm-glass-bg);
                    border: 1px solid var(--mm-glass-border);
                    border-radius: 999px;
                    backdrop-filter: blur(var(--mm-blur));
                    -webkit-backdrop-filter: blur(var(--mm-blur));
                    font-weight: 800;
                    font-size: clamp(0.65rem, 1.4vh, 0.85rem);
                    text-shadow: 0 2px 10px rgba(0,0,0,0.85);
                    white-space: nowrap;
                    color: white;
                    pointer-events: auto;
                }
                .mm-currency-badge.gold { border-color: rgba(255,210,80,0.4); background: rgba(255,190,0,0.1); color: #ffd700; }
                .mm-currency-badge.gem { border-color: rgba(130,180,255,0.4); background: rgba(80,130,255,0.1); color: #82b4ff; }
                
                /* ── AUTH BADGE ── */
                .mm-auth-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 12px;
                    padding: clamp(4px, 1vh, 8px) clamp(10px, 2vw, 20px);
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid var(--mm-glass-border);
                    border-radius: 999px;
                    backdrop-filter: blur(var(--mm-blur));
                    cursor: pointer;
                    transition: 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    pointer-events: auto;
                }
                .mm-auth-badge:hover { background: rgba(255, 255, 255, 0.2); transform: translateY(-2px) scale(1.05); }
                
                /* GUEST / SIGN IN Call to Action - Premium Vibe */
                .mm-auth-badge.guest {
                    background: linear-gradient(135deg, #ff00cc 0%, #3333ff 100%);
                    border: 1.5px solid rgba(255, 255, 255, 0.8);
                    padding: 0 clamp(15px, 2.5vw, 30px);
                    box-shadow: 0 0 15px rgba(255, 0, 204, 0.4);
                    animation: btn-pulse-vibrant 2.5s infinite;
                    transition: 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }
                .mm-auth-badge.guest:hover {
                    box-shadow: 0 0 25px rgba(255, 0, 204, 0.7);
                    transform: scale(1.08) rotate(-1deg);
                    filter: brightness(1.2);
                }
                .mm-auth-badge.guest .mm-auth-name {
                    font-size: 0.75rem;
                    letter-spacing: 1px;
                    color: #fff;
                    font-weight: 900;
                    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
                }

                @keyframes btn-pulse-vibrant {
                    0%, 100% { box-shadow: 0 0 10px rgba(255, 0, 204, 0.3); }
                    50% { box-shadow: 0 0 25px rgba(255, 0, 204, 0.6), 0 0 40px rgba(51, 51, 255, 0.3); }
                }

                .mm-auth-avatar {
                    width: clamp(24px, 3.5vh, 32px);
                    height: clamp(24px, 3.5vh, 32px);
                    border-radius: 50%;
                    background: #555;
                    border: 2px solid #00ffcc;
                    object-fit: cover;
                }
                
                /* [NEW] Progression Badge v67 */
                .mm-progression-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    height: clamp(24px, 3.2vh, 30px); /* Unified slim height v67 */
                    padding: 0 clamp(8px, 1.5vw, 15px);
                    background: rgba(0, 0, 0, 0.5);
                    border: 1px solid rgba(0, 255, 204, 0.3);
                    border-radius: 999px;
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px);
                }

                .mm-auth-avatar-mini {
                    width: clamp(22px, 3.2vh, 28px);
                    height: clamp(22px, 3.2vh, 28px);
                    border-radius: 50%;
                    border: 1.5px solid #00ffcc;
                    object-fit: cover;
                }

                .mm-auth-emblem-mini {
                    width: clamp(16px, 2.2vh, 20px);
                    height: clamp(16px, 2.2vh, 20px);
                    position: relative;
                }
                .mm-auth-emblem-frame { position: absolute; inset: -3px; opacity: 0.5; }
                .mm-auth-emblem-icon { position: absolute; inset: 0; }
                .mm-auth-emblem-mini svg { width: 100%; height: 100%; }

                .mm-auth-level-mini {
                    font-size: 0.75rem;
                    font-weight: 900;
                    color: #00ffcc;
                    text-shadow: 0 0 5px rgba(0, 255, 204, 0.5);
                }

                .mm-auth-name { 
                    font-family: 'Black Han Sans', sans-serif;
                    font-size: 0.8rem; 
                    font-weight: 900; 
                    color: white; 
                    text-transform: uppercase;
                    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
                }

                /* ── BGM BADGE ── */
                .mm-bgm-badge {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    height: clamp(24px, 3.2vh, 30px); /* Unified fixed height v67 */
                    padding: 0 clamp(12px, 2.5vw, 24px);
                    box-sizing: border-box;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 999px;
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    font-size: clamp(0.7rem, 1.5vh, 0.85rem);
                    font-weight: 800;
                    color: rgba(255,255,255,0.85);
                    text-shadow: 0 0 12px rgba(0,0,0,1); /* BGM Halo v56 */
                    white-space: nowrap;
                    min-width: clamp(200px, 25vw, 350px);
                    overflow: hidden;
                    justify-self: center; /* Anchor to the dead center v56 */
                    pointer-events: auto; /* Enable touch v63 */
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
                    mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
                    -webkit-mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
                    display: flex;
                    justify-content: flex-start;
                }
                .mm-bgm-text-content { 
                    display: flex; 
                    width: max-content; 
                    animation: mm-marquee 15s linear infinite; /* Increased scroll speed slightly v55 */
                    justify-content: flex-start;
                }
                .mm-bgm-text-item { 
                    min-width: clamp(150px, 20vw, 300px);
                    white-space: nowrap; 
                    padding-right: 80px; /* Reduced gap between loops v55 */
                    text-align: center;
                }
                @keyframes mm-marquee { 
                    0%   { transform: translateX(0); }
                    8%   { transform: translateX(0); } /* Reduced pause time (approx half of 15%) v55 */
                    100% { transform: translateX(-50%); } 
                }

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
                    background: linear-gradient(to bottom, #ffffff 10%, #e0e7ff 100%);
                    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
                    -webkit-text-stroke: 1.5px rgba(0,0,0,0.85); /* Strong stroke v55 */
                    paint-order: stroke fill;
                    filter: drop-shadow(0 6px 12px rgba(0,0,0,0.85));
                    text-transform: uppercase;
                }
                .mm-main-title-sub { 
                    font-size: clamp(0.7rem, 1.4vh, 0.9rem); color: rgba(255,255,255,0.95); 
                    letter-spacing: 12px; font-weight: 900; margin-top: 8px; text-transform: uppercase;
                    text-shadow: 0 4px 15px rgba(0,0,0,1); /* Subtitle Halo v56 */
                }

                .mm-panel {
                    background: var(--mm-glass-bg); border: 1px solid var(--mm-glass-border);
                    border-radius: 50px; backdrop-filter: blur(var(--mm-blur));
                    padding: clamp(15px, 2.8vh, 35px); box-shadow: 0 25px 80px rgba(0,0,0,0.5);
                    width: clamp(320px, 90vw, 1050px); /* Tighter panel v69 */
                    max-height: 52vh; display: flex; align-items: center; justify-content: center;
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
                .mm-center { 
                    display: flex; 
                    width: 100%; 
                    gap: clamp(10px, 1.5vw, 20px); /* Tighter gap for horizontal density v71 */
                    justify-content: center; 
                    align-items: center;
                }
                .mm-card {
                    position: relative; flex: 1; aspect-ratio: 1.3 / 1; /* Sleek horizontal proportion */
                    border-radius: 32px;
                    border: 3px solid rgba(255,255,255,0.35); display: flex; flex-direction: column;
                    align-items: center; justify-content: center; gap: 10px; cursor: pointer; overflow: hidden;
                    transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
                    padding: clamp(20px, 3vh, 35px) 15px; /* Deeper padding for visual weight */
                    box-sizing: border-box;
                }

                /* ── [ULTRA] PLAY CARD (Refined & Sophisticated) ── */
                .mm-card-play { 
                    background: linear-gradient(-45deg, #ff006e, #ff6b08, #ff006e, #ff6b08);
                    background-size: 400% 400%;
                    animation: mm-play-pulse 2.5s infinite ease-in-out, mm-play-gradient 6s infinite linear;
                    z-index: 100;
                    border: 2px solid rgba(255, 255, 255, 0.85) !important;
                    box-shadow: 0 15px 45px rgba(0, 0, 0, 0.5), 0 0 25px rgba(255, 0, 110, 0.4);
                    transform: scale(1.22);
                    margin: 0 clamp(10px, 2.2vw, 32px); /* Refined margin for tighter layout */
                }
                .mm-card-play:hover { 
                    transform: scale(1.3) translateY(-12px) !important; 
                    filter: brightness(1.15);
                    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6), 0 0 45px rgba(255, 0, 110, 0.7);
                    border-color: #fff !important;
                }

                /* Text Blinking & Pulse */
                .mm-card-play .mm-card-label {
                    animation: mm-play-blink 1s infinite alternate ease-in-out, mm-play-font-mega 1.5s infinite alternate ease-in-out;
                    font-family: 'Black Han Sans', sans-serif;
                    font-size: clamp(1.3rem, 2.8vh, 1.7rem) !important;
                    color: #fff !important;
                    text-shadow: 0 0 15px rgba(255,255,255,0.6), 0 4px 10px rgba(0,0,0,0.8);
                    -webkit-text-stroke: 1.2px #000;
                    paint-order: stroke fill;
                    letter-spacing: 1.5px;
                }

                @keyframes mm-play-gradient {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                @keyframes mm-play-pulse {
                    0%, 100% { transform: scale(1.2); box-shadow: 0 15px 40px rgba(0,0,0,0.5), 0 0 20px rgba(255, 0, 110, 0.3); }
                    50% { transform: scale(1.24); box-shadow: 0 20px 55px rgba(0,0,0,0.7), 0 0 40px rgba(255, 0, 110, 0.6); }
                }
                @keyframes mm-play-blink {
                    0% { opacity: 1; filter: drop-shadow(0 0 15px #fff); }
                    100% { opacity: 0.8; filter: drop-shadow(0 0 5px #fff); }
                }
                @keyframes mm-play-font-mega {
                    0% { transform: scale(1); }
                    100% { transform: scale(1.1); }
                }

                /* [MOBILE OPTIMIZATION] - RESTORED TO PREVIOUS PERFECT STATE v70 */
                @media (max-width: 850px) {
                    .mm-panel { width: 96vw; padding: 10px; border-radius: 25px; max-height: 48vh; }
                    .mm-card { 
                        aspect-ratio: 1.2 / 1 !important; 
                        border-radius: 18px; border-width: 2px; 
                        padding: clamp(10px, 2vh, 20px) 5px clamp(12px, 2.5vh, 25px) 5px !important;
                        gap: 4px !important;
                    }
                    .mm-card-play { 
                        transform: scale(1.12) !important; 
                        border-width: 2px !important; 
                        margin: 0 12px !important; 
                    } 
                    .mm-card-play:hover { transform: scale(1.18) translateY(-8px) !important; }
                    .mm-center { gap: clamp(8px, 2.5vw, 20px) !important; }
                    .mm-card-icon { font-size: 2rem !important; }
                    .mm-card-label { font-size: 0.85rem !important; }
                }

                .mm-card-editor { background: linear-gradient(135deg, rgba(255,200,0,1), rgba(180,255,0,1)); }
                .mm-card-ranking { background: linear-gradient(135deg, rgba(255,100,10,1), rgba(255,180,0,1)); }
                .mm-card-collection { background: linear-gradient(135deg, rgba(140,255,0,1), rgba(0,210,255,1)); }
                .mm-card-shop { background: linear-gradient(135deg, rgba(0,210,255,1), rgba(120,0,255,1)); }
                .mm-card:not(.mm-card-play):hover { transform: scale(1.06) translateY(-8px); border-color: white; box-shadow: 0 10px 30px rgba(255,255,255,0.2); }
                .mm-card-icon { font-size: clamp(2.2rem, 5vh, 3.2rem); filter: drop-shadow(0 4px 8px rgba(0,0,0,0.5)); }
                .mm-card-label { 
                    font-family: 'Black Han Sans', sans-serif; font-size: clamp(1rem, 2vh, 1.4rem); margin-top: 8px;
                    -webkit-text-stroke: 0.8px rgba(0,0,0,0.4);
                    paint-order: stroke fill;
                    text-shadow: 0 5px 12px rgba(0,0,0,1);
                }
                .mm-card-sub { 
                    font-size: clamp(0.55rem, 0.9vh, 0.7rem); opacity: 0.9; text-transform: uppercase; font-weight: 800; 
                    text-shadow: 0 2px 10px rgba(0,0,0,1); /* Sub Halo v56 */
                }

                .mm-bottom-nav {
                    flex: 0 0 auto; height: clamp(90px, 12vh, 120px); /* Fluid height with strict floor v52 */
                    padding-bottom: clamp(15px, 3vh, 30px); display: flex; justify-content: center; align-items: center;
                    gap: clamp(40px, 8vw, 100px); background: linear-gradient(to top, rgba(0,0,0,0.85), transparent);
                    flex-shrink: 0; /* Never squash the footer! v52 */
                }
                .mm-nav-item { display: flex; flex-direction: column; align-items: center; gap: 12px; cursor: pointer; opacity: 0.75; transition: 0.3s; }
                .mm-nav-item:hover { opacity: 1; transform: translateY(-8px); }
                .mm-nav-icon { font-size: clamp(2rem, 5vh, 2.8rem); filter: drop-shadow(0 4px 8px rgba(0,0,0,0.5)); }
                .mm-nav-label { 
                    font-size: 1rem; font-weight: 900; text-transform: uppercase; 
                    text-shadow: 0 6px 15px rgba(0,0,0,1); /* Footer Halo v56 */
                }

                .mm-lang-group { display: flex; gap: 25px; margin-left: 60px; border-left: 2px solid rgba(255,255,255,0.2); padding-left: 60px; }
                .mm-flag-btn { font-size: 2.5rem; cursor: pointer; opacity: 0.4; transition: 0.3s; }
                .mm-flag-btn.active, .mm-flag-btn:hover { opacity: 1; transform: scale(1.3) translateY(-4px); }
            </style>
        `;

        const hudHtml = `
            ${styles}
            <div class="mm-top-hud">
                <div class="mm-hud-left" id="mm-hud-left-container">
                    <!-- Coins and Progression will be here -->
                </div>
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
                <div class="mm-hud-right" style="justify-self: end;" id="mm-auth-container">
                    <!-- Auth content will be here -->
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
                            <div class="mm-card mm-card-editor" id="btn-editor">
                                <div class="mm-card-icon">💿</div>
                                <div class="mm-card-label">${t.editor}</div>
                                <div class="mm-card-sub">${t.editorDesc}</div>
                            </div>
                            <div class="mm-card mm-card-ranking" id="btn-ranking">
                                <div class="mm-card-icon">🏆</div>
                                <div class="mm-card-label">${t.ranking}</div>
                                <div class="mm-card-sub">${t.rankingDesc}</div>
                            </div>
                            <div class="mm-card mm-card-play" id="btn-rhythm">
                                <div class="mm-card-icon">🎮</div>
                                <div class="mm-card-label">${t.play}</div>
                                <div class="mm-card-sub">${t.playDesc}</div>
                            </div>
                            <div class="mm-card mm-card-collection" id="btn-collection">
                                <div class="mm-card-icon">📂</div>
                                <div class="mm-card-label">${t.collection}</div>
                                <div class="mm-card-sub">${t.collectionDesc}</div>
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
        
        // Auth and BGM initialization
        this.updateAuthUI();
        this.updateCurrencyUI();
        this.updateBGMText();
        if (this.themeUnsubscribe) this.themeUnsubscribe();
        this.themeUnsubscribe = ThemeManager.getInstance().subscribe(() => {
            this.updateBGMText();
        });

        // [NEW] Listen for auth changes to update HUD/UI (using named function for cleanup)
        window.removeEventListener('nexus-auth-changed', this.handleAuthChange);
        window.addEventListener('nexus-auth-changed', this.handleAuthChange);
    }

    private handleAuthChange = () => {
        this.updateCurrencyUI();
    };

    private attachListeners(): void {
        document.getElementById('btn-rhythm')?.addEventListener('click', () => {
            this.hideAll();
            this.onStartGame('rhythm');
        });
        document.getElementById('btn-editor')?.addEventListener('click', () => {
            this.hideAll();
            this.onStartGame('editor');
        });
        document.getElementById('btn-ranking')?.addEventListener('click', () => {
            this.showRanking();
        });
        document.getElementById('btn-collection')?.addEventListener('click', () => {
            this.showCollection();
        });
        document.getElementById('btn-shop')?.addEventListener('click', () => {
            this.showShop();
        });
        document.getElementById('btn-settings')?.addEventListener('click', () => {
            this.navigateWithTransition('Opening Settings...', async () => {
                this.hideMenuOnly();
                this.showSettings();
            });
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

        // Auth listeners (using delegation for dynamic #mm-auth-container)
        document.getElementById('mm-hud-left-container')?.addEventListener('click', async (e) => {
            const target = e.target as HTMLElement;
            if (target.closest('#mm-auth-container')) {
                const auth = AuthService.getInstance();
                if (auth.isSignedIn()) {
                    if (confirm('Do you want to sign out?')) {
                        await auth.signOut();
                        this.updateCurrencyUI();
                    }
                } else {
                    await auth.openSignIn();
                }
            }
        });
    }

    private updateCurrencyUI(): void {
        const leftContainer = document.getElementById('mm-hud-left-container');
        if (!leftContainer) return;

        const auth = AuthService.getInstance();
        const economy = EconomyManager.getInstance();
        const isSignedIn = auth.isSignedIn();

        // Left side content based on auth state v67
        if (isSignedIn) {
            leftContainer.innerHTML = `
                <div id="mm-progression-container"></div>
                <div class="mm-currency-badge gold">🪙 ${economy.getCoins().toLocaleString()}</div>
            `;
            if (this.updateProgressionUI) this.updateProgressionUI();
        } else {
            leftContainer.innerHTML = `
                <div class="mm-currency-badge" style="background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.2); color: rgba(255,255,255,0.8); cursor: default;">
                    SIGN IN TO SYNC YOUR DATA
                </div>
            `;
        }
        
        this.updateAuthUI();
    }

    private updateProgressionUI(): void {
        const container = document.getElementById('mm-progression-container');
        if (!container) return;

        const sm = ScoreManager.getInstance();
        const totalXP = sm.getTotalXP();
        const level = ExperienceSystem.getLevelFromXP(totalXP);
        const classInfo = DJClassSystem.getClassInfo(level);
        
        const makeUniqueSVG = (svg: string, suffix: string) => svg.replace(/id="([^"]+)"/g, `id="$1-${suffix}"`).replace(/url\(#([^)]+)\)/g, `url(#$1-${suffix})`);

        container.innerHTML = `
            <div class="mm-progression-badge" style="border-color: ${classInfo.color}44;">
                <div class="mm-auth-emblem-mini">
                    <div class="mm-auth-emblem-frame" style="color: ${classInfo.color}">${makeUniqueSVG(classInfo.frameSVG, 'hud')}</div>
                    <div class="mm-auth-emblem-icon">${makeUniqueSVG(classInfo.emblemSVG, 'hud')}</div>
                </div>
                <span class="mm-auth-level-mini">LV.${level}</span>
            </div>
        `;
    }

    private updateAuthUI(): void {
        const container = document.getElementById('mm-auth-container');
        if (!container) return;

        const auth = AuthService.getInstance();
        if (auth.isSignedIn()) {
            const name = auth.getUserName();
            const clerk = auth.getClerk();
            const avatar = clerk?.user?.imageUrl || '';
            
            container.onclick = async () => {
                ModalUI.getInstance().show(
                    'SIGN OUT',
                    'Are you sure you want to sign out? Your data is safe on the cloud.',
                    {
                        confirmLabel: 'SIGN OUT',
                        cancelLabel: 'CANCEL',
                        type: 'warning',
                        onConfirm: async () => {
                            await auth.signOut();
                            window.location.reload();
                        }
                    }
                );
            };

            container.innerHTML = `
                <div class="mm-auth-badge">
                    <img src="${avatar}" class="mm-auth-avatar-mini" style="width: clamp(20px, 2.8vh, 26px); height: clamp(20px, 2.8vh, 26px);" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random'"/>
                    <span class="mm-auth-name" style="font-size: clamp(0.7rem, 1.4vh, 0.85rem);">${name}</span>
                </div>
            `;
        } else {
            container.onclick = () => auth.openSignIn();
            container.innerHTML = `
                <div class="mm-auth-badge guest">
                    <span class="mm-auth-name">SIGN IN NOW</span>
                </div>
            `;
        }
    }

    private async showRanking(): Promise<void> {
        await this.navigateWithTransition('Fetching Rankings...', async () => {
            this.hide();
            const ranking = new RankingUI(() => {
                this.show();
            });
            await ranking.show();
        });
    }

    private async showCollection(): Promise<void> {
        await this.navigateWithTransition('Synchronizing Data...', async () => {
            this.hide();
            const collection = new CollectionUI(() => {
                this.show();
            });
            await collection.show();
        });
    }

    private async showShop(): Promise<void> {
        await this.navigateWithTransition('Entering Shop...', async () => {
            this.hideMenuOnly();
            this.shopUI = new ShopUI(() => {
                this.show();
            });
            await this.shopUI.show();
        });
    }

    private async navigateWithTransition(status: string, targetFn: () => Promise<void>): Promise<void> {
        const loading = LoadingOverlay.getInstance();
        loading.show(status);
        
        // Wait for the overlay to fully cover the screen (animation duration)
        await new Promise(r => setTimeout(r, 450));
        
        try {
            await targetFn();
        } finally {
            // Give the NEW UI a moment to be in the DOM
            await new Promise(r => setTimeout(r, 100));
            loading.hide();
        }
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
            if (action === 'back') {
                this.settingsUI?.destroy();
                this.show(); 
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
        window.removeEventListener('nexus-auth-changed', this.handleAuthChange);
        this.ui.hide('main-menu');
        this.ui.hide('global-hud');
    }

    public hide(): void {
        this.hideMenuOnly();
    }
}
