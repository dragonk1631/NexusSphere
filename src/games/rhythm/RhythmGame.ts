import { BaseGame } from '../../core/BaseGame';
import { ThemeManager } from '../../core/ThemeManager';
import { ScoreManager } from '../../core/score/ScoreManager';
import type { ParsedMidi } from '../../core/audio/MidiParser';
import { NoteFactory, type VisualNote } from './NoteFactory';
import { RenderCache } from './graphics/RenderCache';
import { GameTransition, type TransitionData } from '../../core/GameTransition';
import {
    GameState,
    Judgment,
    type MenuRenderState,
    type LoadingRenderState,
    type PauseRenderState
} from './types/GameTypes';
import {
    LAYOUT,
    ASSETS,
    HORIZON_Y_RATIO,
    BOTTOM_Y_RATIO,
    HIT_LINE_Y_RATIO,
    SPEED_OPTIONS,
    DIFFICULTY_OPTIONS
} from './constants/GameConstants';
import { AudioLoader } from './services/AudioLoader';
import { MenuManager } from './state/MenuManager';
import { RhythmInputManager, type IGameInputHandler } from './input/RhythmInputManager';
import { TransitionSystem } from './systems/TransitionSystem';
import { ParticleSystem } from './systems/ParticleSystem';
import { JudgmentSystem, type IJudgmentEventHandler } from './systems/JudgmentSystem';
import { HighwayRenderer, type HighwayRenderState } from './renderer/HighwayRenderer';
import { ResultRenderer } from './renderer/ResultRenderer';
import { HUDRenderer, type HUDRenderState } from './renderer/HUDRenderer';
import { MenuRenderer } from './renderer/MenuRenderer';
import { GameOverRenderer, type GameOverRenderState } from './renderer/GameOverRenderer';
import { EffectsRenderer } from './renderer/EffectsRenderer';
import { GameplayManager } from './state/GameplayManager';
import type { IThemeStrategy } from './themes/IThemeStrategy';
import { DefaultTheme } from './themes/DefaultTheme';
import { CyberNeonTheme } from './themes/CyberNeonTheme';
import { MatrixGridTheme } from './themes/MatrixGridTheme';
import { DeepSpaceTheme } from './themes/DeepSpaceTheme';
import { VaporwaveTheme } from './themes/VaporwaveTheme';
import { MidnightOceanTheme } from './themes/MidnightOceanTheme';
import { CrimsonFlareTheme } from './themes/CrimsonFlareTheme';
import { MarchenTheme } from './themes/MarchenTheme';
import { MonochromeTechTheme } from './themes/MonochromeTechTheme';
import { WinterSnowTheme } from './themes/WinterSnowTheme';
import { SunsetOverdriveTheme } from './themes/SunsetOverdriveTheme';
import * as PerspectiveUtils from './renderer/PerspectiveUtils';
import { ASSET_PATHS } from '../../core/asset/AssetRegistry';
import { PauseRenderer } from './renderer/PauseRenderer';
import { LoadingRenderer } from './renderer/LoadingRenderer';
import type { IGameState } from './state/IGameState';
import { MenuState } from './state/MenuState';
import { LoadingState } from './state/LoadingState';
import { PlayingState } from './state/PlayingState';
import { PausedState } from './state/PausedState';
import { ResultState } from './state/ResultState';
import { GameOverState } from './state/GameOverState';


/**
 * RhythmGame Orchestrator (Refactored v3 Stage 4-Final)
 * Goal: Pure FAÇADE coordinating independent systems.
 */
export class RhythmGame extends BaseGame implements IGameInputHandler, IJudgmentEventHandler {
    public audioLoader: AudioLoader;
    public menuManager: MenuManager;
    public menuRenderer: MenuRenderer;
    public scoreManager: ScoreManager;
    public renderCache: RenderCache;
    public inputManager: RhythmInputManager;
    public transitionSystem: TransitionSystem;
    public particleSystem: ParticleSystem;
    public effectsRenderer: EffectsRenderer;
    public themeStrategy: IThemeStrategy;
    public judgmentSystem: JudgmentSystem;
    public highwayRenderer: HighwayRenderer;
    public resultRenderer: ResultRenderer;
    public hudRenderer: HUDRenderer;
    public gameOverRenderer: GameOverRenderer;
    public pauseRenderer: PauseRenderer;
    public loadingRenderer: LoadingRenderer;
    public gameplayManager: GameplayManager;

    private currentState: GameState = GameState.MENU;
    private shouldAutoStart = false;
    public midiData: ParsedMidi | null = null;
    public visualNotes: VisualNote[] = [];
    public transitionData: TransitionData | null = null;
    private currentFrameTime: number = 0; // Performance Optimization: Cache per frame
    public isMobile: boolean = false;
    public isTestMode: boolean = false;
    public horizonY = 0;
    public bottomY = 0;
    public hitLineY = 0;
    public laneBottomWidth = 120;
    public laneTopWidth = 10;
    public laneCount = 6;
    public scrollSpeed = 1.0;
    public keyMode: 4 | 6 = 4;
    private startTimeout: ReturnType<typeof setTimeout> | null = null;
    public pauseSelectedButtonIndex: number = 0;
    public pauseAnimationTimer: number = 0;
    public lastRenderTime = 0;
    public unifiedCurrentTime = 0;

    public loadingProgress: number = 0;
    public loadingStatus: string = "Initializing...";
    public highwayRenderState: HighwayRenderState = {} as HighwayRenderState;
    public hudRenderState: HUDRenderState = {} as HUDRenderState;
    public gameOverRenderState: GameOverRenderState = {} as GameOverRenderState;
    public menuRenderState: MenuRenderState = {} as MenuRenderState;
    public loadingRenderState: LoadingRenderState = {} as LoadingRenderState;
    public pauseRenderState: PauseRenderState = {} as PauseRenderState;

    private stateMap: Map<GameState, IGameState>;
    private currentStateObj: IGameState;

    constructor(canvas: HTMLCanvasElement) {
        super(canvas);
        this.scoreManager = ScoreManager.getInstance();
        this.renderCache = RenderCache.getInstance();
        this.audioLoader = new AudioLoader(this.audioEngine);
        this.menuRenderer = new MenuRenderer(this.scoreManager);
        this.inputManager = new RhythmInputManager(this.canvas, this);
        this.transitionSystem = new TransitionSystem();
        this.particleSystem = new ParticleSystem();
        this.judgmentSystem = new JudgmentSystem(this);
        this.resultRenderer = new ResultRenderer();
        this.hudRenderer = new HUDRenderer();
        this.gameOverRenderer = new GameOverRenderer();
        this.pauseRenderer = new PauseRenderer();
        this.loadingRenderer = new LoadingRenderer();
        this.themeStrategy = this.initThemeStrategy();
        this.highwayRenderer = new HighwayRenderer(this.renderCache, this.judgmentSystem);
        this.effectsRenderer = new EffectsRenderer(this.particleSystem, this.transitionSystem);
        this.gameplayManager = new GameplayManager(this.audioEngine, this.scoreManager, this.particleSystem, this.judgmentSystem);
        this.menuManager = new MenuManager(this.audioEngine, {
            onPlayRequested: () => this.handlePlayRequest(),
            onReturnToMainMenu: () => this.returnToMainMenu()
        });
        this.inputManager.register();

        // State Machine Initialization
        this.stateMap = new Map<GameState, IGameState>([
            [GameState.MENU, new MenuState(this)],
            [GameState.LOADING, new LoadingState(this)],
            [GameState.PLAYING, new PlayingState(this)],
            [GameState.PAUSED, new PausedState(this)],
            [GameState.RESULT, new ResultState(this)],
            [GameState.GAMEOVER, new GameOverState(this)]
        ]);
        this.currentStateObj = this.stateMap.get(GameState.MENU)!;

        this.loadFonts();
    }

    public setState(state: GameState): void {
        if (this.currentState === state) return;

        this.currentStateObj.exit();
        this.currentState = state;
        this.currentStateObj = this.stateMap.get(state)!;
        this.currentStateObj.enter();

        console.log(`[RhythmGame] State Changed: ${state}`);
    }

    public getCurrentState = () => this.currentState;

    private initThemeStrategy(): IThemeStrategy {
        const themeId = ThemeManager.getInstance().getCurrentTheme().id;
        const themeMap: Record<string, new () => IThemeStrategy> = {
            'cyber-neon': CyberNeonTheme,
            'matrix-grid': MatrixGridTheme,
            'deep-space': DeepSpaceTheme,
            'vaporwave': VaporwaveTheme,
            'midnight-ocean': MidnightOceanTheme,
            'crimson-flare': CrimsonFlareTheme,
            'marchen': MarchenTheme,
            'monochrome-tech': MonochromeTechTheme,
            'winter-snow': WinterSnowTheme,
            'sunset-overdrive': SunsetOverdriveTheme
        };

        const ThemeClass = themeMap[themeId];
        return ThemeClass ? new ThemeClass() : new DefaultTheme();
    }

    public loadFonts() {
        const fontId = ASSETS.FONT_ID;
        if (document.getElementById(fontId)) return;

        const fontLink = document.createElement('link');
        fontLink.id = fontId;
        fontLink.href = ASSETS.FONT_URL;
        fontLink.rel = 'stylesheet';
        document.head.appendChild(fontLink);
    }

    public async init(): Promise<void> {
        this.renderCache.init();
        this.detectEnvironment();
        await this.handleInitialState();
        this.resize(this.canvas.width, this.canvas.height);
        if (this.currentState === GameState.MENU && !this.isTestMode) this.menuManager.playPreview();
    }

    private detectEnvironment() {
        this.isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        this.particleSystem.setMobile(this.isMobile);
        console.log(`[RhythmGame] Environment: ${this.isMobile ? 'Mobile' : 'Desktop'}`);
    }

    private async handleInitialState() {
        const transition = GameTransition.get();
        if (transition?.source === 'editor' && transition.midiBuffer) {
            this.isTestMode = true;
            this.transitionData = transition;
            if (transition.settings) {
                this.scrollSpeed = transition.settings.speed || 1.0;
                this.menuManager.scrollSpeed = this.scrollSpeed;
                this.inputManager.updateKeyMode(this.keyMode);
            }
        } else {
            await this.loadSongList();
        }
    }

    private async loadSongList() {
        try {
            const res = await fetch('assets/data/midi_list.json');
            if (res.ok) {
                const list = await res.json();
                if (Array.isArray(list)) { this.menuManager.songList = list; this.menuManager.sortSongList(); }
            }
        } catch (e) { console.warn("[RhythmGame] Failed to load song list:", e); }
    }

    public resize(width: number, height: number): void {
        super.resize(width, height);
        this.horizonY = height * HORIZON_Y_RATIO;
        this.bottomY = height * BOTTOM_Y_RATIO;
        this.hitLineY = height * HIT_LINE_Y_RATIO;

        // --- Synchronize Lane Width with Receptors using Utils ---
        const layout = PerspectiveUtils.calculateLayout(
            this.hitLineY,
            this.horizonY,
            this.bottomY,
            LAYOUT.DEFAULT_NOTE_WIDTH,
            LAYOUT.LANE_TOP_RATIO
        );

        this.laneBottomWidth = layout.laneBottomWidth;
        this.laneTopWidth = layout.laneTopWidth;

        this.inputManager.updateLayout(this.laneCount, this.laneBottomWidth);
        this.updateHighwayRenderState();
        this.highwayRenderer.onResize(this.ctx, this.laneCount, this.horizonY, this.hitLineY, this.highwayRenderState, this.themeStrategy);
        this.hudRenderer.onResize(this.ctx, width, height);
        if (this.renderCache) {
            this.renderCache.renderHighwayBackground(width, height, this.horizonY, this.bottomY, this.laneCount,
                (l, y) => this.getPerspectiveX(l, y), ThemeManager.getInstance().getCurrentTheme().color1,
                ThemeManager.getInstance().getCurrentTheme().color2, this.hitLineY);
        }
    }

    public async handlePlayRequest() {
        this.setState(GameState.LOADING);
        this.loadingProgress = 0;
        this.loadingStatus = "Connecting to Audio Engine...";

        try {
            // Step 1: Initialize Audio Engine & Theme Strategy
            this.themeStrategy = this.initThemeStrategy();


            await this.audioEngine.resume();
            this.loadingProgress = 0.2;
            this.loadingStatus = "Loading MIDI & Audio Assets...";

            // Step 2: Load MIDI
            await this.load();
            this.loadingProgress = 0.5;
            this.loadingStatus = "Generating Note Data...";

            // Step 3: Create Game Objects
            await this.create();
            this.loadingProgress = 0.7;
            this.loadingStatus = "Warming up Render Cache...";

            // Step 4: Pre-warm Renderer & Theme (Reduce JIT lag)
            if (this.themeStrategy.preWarm) {
                this.themeStrategy.preWarm(this.ctx, this.laneBottomWidth);
            }

            await this.renderCache.warmup(
                this.canvas.width, this.canvas.height,
                this.horizonY, this.bottomY, this.laneCount,
                (l, y) => this.getPerspectiveX(l, y),
                ThemeManager.getInstance().getCurrentTheme().color1,
                ThemeManager.getInstance().getCurrentTheme().color2,
                this.hitLineY
            );
            this.loadingProgress = 0.9;
            this.loadingStatus = "Activating Audio Context...";

            // Step 5: Pre-warm Audio Engine (Silent Note pulse)
            await this.audioEngine.warmup();

            this.loadingProgress = 1.0;
            this.loadingStatus = "Ready!";

            // Final Transition to Game
            this.transitionSystem.start(() => {
                this.start();
            }, 'fade');

        } catch (e) {
            console.error("[RhythmGame] Loading Failed:", e);
            this.loadingStatus = "Error! Returning to Menu...";
            setTimeout(() => this.backToSongSelection(), 2000);
        }
    }

    public async load(): Promise<void> {
        this.audioEngine.resetTimeState();
        await this.audioEngine.init(ASSET_PATHS.AUDIO.SOUNDFONTS.DEFAULT);
        const song = this.menuManager.getCurrentSong();
        await this.audioLoader.load(song.url, this.isTestMode, this.transitionData);
        this.midiData = this.audioLoader.getMidiData();
    }

    public async create(): Promise<void> {
        if (!this.midiData) return;

        // Ensure Audio Engine is fully ready before creating objects
        await this.audioEngine.ensureReady();

        const difficulty = this.transitionData?.settings?.difficulty || this.menuManager.getCurrentDifficulty() || 'NORMAL';
        this.visualNotes = NoteFactory.createNotes(this.midiData, this.keyMode, null, difficulty, null);
        const totalJudgments = this.visualNotes.reduce((acc, note) => acc + (note.isHold ? 2 : 1), 0);
        this.scoreManager.setTotalNotes(totalJudgments);

        if (this.isTestMode && this.transitionData?.settings) {
            this.gameplayManager.enforceMuteCompliance(this.transitionData);
            // In test mode, we might want to skip the full loading screen or handle it differently
            // but for now, we'll keep the direct start if requested by the editor.
            if (this.shouldAutoStart) {
                this.shouldAutoStart = false;
                this.start();
            }
        }
    }

    private start() {
        this.audioEngine.stop();
        this.audioEngine.seek(0);
        this.inputManager.resetStates();
        this.inputManager.updateKeyMode(this.keyMode);
        this.scoreManager?.reset();
        this.gameplayManager.reset();
        this.gameplayManager.start(this.visualNotes, this.scrollSpeed);
        this.judgmentSystem.setLatency(this.audioEngine.getOutputLatency() * 1000);
        this.lastRenderTime = 0;
        this.setState(GameState.PLAYING);
    }

    public update(delta: number): void {
        this.currentFrameTime = performance.now();
        this.transitionSystem.update(delta);
        this.particleSystem.update(delta);

        if (delta > 200) this.judgmentSystem.setLagInvincibility(500);
        else this.judgmentSystem.update(delta);

        this.currentStateObj.update(delta);
    }

    public render(): void {
        const ctx = this.ctx;
        const { width, height } = this.canvas;
        if (height > width) { this.renderRotateRequest(ctx, width, height); return; }

        this.currentStateObj.render(ctx);
        this.effectsRenderer.render(ctx, width, height, this.themeStrategy);
    }

    public renderRotateRequest(ctx: CanvasRenderingContext2D, width: number, height: number) {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 24px "Orbitron"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText("PLEASE ROTATE YOUR DEVICE", width / 2, height / 2);
    }

    public updateHighwayRenderState(): void {
        const s = this.highwayRenderState;
        const currentTime = this.currentFrameTime;
        s.width = this.canvas.width;
        s.height = this.canvas.height;
        s.horizonY = this.horizonY;
        s.bottomY = this.bottomY;
        s.hitLineY = this.hitLineY;
        s.laneCount = this.laneCount;
        s.laneTopWidth = this.laneTopWidth;
        s.laneBottomWidth = this.laneBottomWidth;
        s.keyMode = this.keyMode;
        s.scrollSpeed = this.scrollSpeed;
        s.currentTime = this.unifiedCurrentTime;
        s.cachedNow = currentTime;
        s.bpm = this.midiData?.bpm || 120;
        s.isMobile = this.isMobile;
    }

    public updateGameOverRenderState(): void {
        const s = this.gameOverRenderState;
        s.width = this.canvas.width;
        s.height = this.canvas.height;
        s.isMobile = this.isMobile;
        s.cachedNow = performance.now();
        s.transitionStyle = this.transitionSystem.getStyle();
        s.transitionAlpha = this.transitionSystem.getAlpha();
    }

    public getPerspectiveX(lane: number, y: number): number {
        return PerspectiveUtils.getPerspectiveX(lane, y, {
            width: this.canvas.width,
            horizonY: this.horizonY,
            bottomY: this.bottomY,
            laneCount: this.laneCount,
            laneTopWidth: this.laneTopWidth,
            laneBottomWidth: this.laneBottomWidth
        });
    }

    public getPerspectiveWidth(y: number): number {
        return PerspectiveUtils.getPerspectiveWidth(y, {
            width: this.canvas.width,
            horizonY: this.horizonY,
            bottomY: this.bottomY,
            laneCount: this.laneCount,
            laneTopWidth: this.laneTopWidth,
            laneBottomWidth: this.laneBottomWidth
        });
    }

    public updateMenuRenderState(): void {
        const s = this.menuRenderState;
        s.menuAnimationTimer = this.menuManager.menuAnimationTimer;
        s.songList = this.menuManager.songList;
        s.selectedSongIndex = this.menuManager.selectedSongIndex;
        s.currentSortMode = this.menuManager.currentSortMode;
        s.difficultyOptions = DIFFICULTY_OPTIONS;
        s.selectedDifficultyIndex = this.menuManager.selectedDifficultyIndex;
        s.speedOptions = SPEED_OPTIONS;
        s.selectedSpeedIndex = this.menuManager.selectedSpeedIndex;
        s.scrollSpeed = this.menuManager.scrollSpeed;
        s.keyMode = this.menuManager.keyMode;
        s.isTestMode = this.isTestMode;
        s.isMobile = this.isMobile;
        s.width = this.canvas.width;
        s.height = this.canvas.height;
        s.transitionData = this.transitionData;
        s.scoreManager = this.scoreManager;
        s.previewMidi = this.menuManager.previewMidi;
        s.previewTime = this.audioEngine.getPreciseTime() - this.audioEngine.getOutputLatency();
    }

    public updateLoadingRenderState(): void {
        const s = this.loadingRenderState;
        s.width = this.canvas.width;
        s.height = this.canvas.height;
        s.progress = this.loadingProgress;
        s.song = this.menuManager.getCurrentSong();
        s.statusText = this.loadingStatus;
        s.cachedNow = this.currentFrameTime;
    }

    public updatePauseRenderState(): void {
        const s = this.pauseRenderState;
        s.width = this.canvas.width;
        s.height = this.canvas.height;
        s.selectedButtonIndex = this.pauseSelectedButtonIndex;
        s.animationTimer = this.pauseAnimationTimer;
    }

    public renderGameplay(ctx: CanvasRenderingContext2D, width: number, height: number) {
        ctx.clearRect(0, 0, width, height);
        this.updateHighwayRenderState();
        this.highwayRenderer.renderBackground(ctx, this.highwayRenderState);
        this.highwayRenderer.renderDynamic(ctx, this.highwayRenderState, this.visualNotes, this.gameplayManager.lastNoteIndex, this.gameplayManager.holdingLanes, this.inputManager);

        const hud = this.hudRenderState;
        hud.width = width;
        hud.height = height;
        hud.comboAnim = this.gameplayManager.comboAnim;
        hud.lastJudgment = this.judgmentSystem.getLastJudgment();
        hud.cachedNow = performance.now();
        hud.isMobile = this.isMobile;

        this.hudRenderer.render(ctx, hud, this.scoreManager, this.themeStrategy, (l, y) => this.getPerspectiveX(l, y));
    }

    // -- IGameInputHandler Implementation --
    public onLanePress = (l: number, _t: number) => {
        if (this.currentState === GameState.PLAYING && this.gameplayManager.preGameTimer <= 0) {
            const currentTimeMs = this.audioEngine.getPreciseTime() * 1000 - this.judgmentSystem.getLatency();
            this.judgmentSystem.checkHit(l, currentTimeMs, this.visualNotes);
        }
    };
    public onLaneRelease = (l: number, _t: number) => {
        this.currentStateObj.onPointerUp(l, 0); // Reuse logic if needed, or stick to systems
        if (this.currentState === GameState.PLAYING) {
            const currentTimeMs = this.audioEngine.getPreciseTime() * 1000 - this.judgmentSystem.getLatency();
            this.judgmentSystem.processRelease(l, currentTimeMs);
        }
    };

    public onMenuPointerDown = (x: number, y: number) => {
        this.currentStateObj.onPointerDown(x, y);
    };

    public onMenuPointerMove = (x: number, y: number) => {
        this.currentStateObj.onPointerMove(x, y);
    };

    public onMenuPointerUp = (x: number, y: number) => {
        this.currentStateObj.onPointerUp(x, y);
    };

    public onMenuKey = (code: string) => {
        this.currentStateObj.onKeyDown(code);
    };

    public backToSongSelection() {
        this.transitionSystem.start(() => {
            this.audioEngine.stop();
            this.isTestMode = false;
            GameTransition.clear();
            this.setState(GameState.MENU);
        }, 'fade');
    }

    public handleRetry() {
        this.transitionSystem.start(async () => {
            this.audioEngine.stop();
            await this.load();
            this.create();
            this.start();
        }, 'fade');
    }
    public onGameOverPointer = (x: number, y: number) => {
        this.currentStateObj.onPointerDown(x, y);
    };
    public onGameOverKey = (code: string) => {
        this.currentStateObj.onKeyDown(code);
    };
    public onResultKey = (code: string) => {
        this.currentStateObj.onKeyDown(code);
    };
    public onResultPointer = (x: number, y: number) => {
        this.currentStateObj.onPointerDown(x, y);
    };
    public onWheel = (delta: number) => {
        this.currentStateObj.onWheel(delta);
    };


    // -- IJudgmentEventHandler Implementation --
    public onJudgment = (l: number, j: Judgment, _d: number) => {
        const combo = this.scoreManager.getCombo();
        const judgmentText = this.getJudgmentText(j);
        const color = this.themeStrategy.getColorForJudgment(j);

        this.judgmentSystem.setJudgment(judgmentText, color, this.currentFrameTime);
        this.scoreManager.addHit(100, j);

        if (j !== Judgment.MISS) {
            const laneCenter = this.getPerspectiveX(l, this.hitLineY) + this.getPerspectiveWidth(this.hitLineY) / 2;
            const laneWidth = this.getPerspectiveWidth(this.hitLineY);
            this.particleSystem.triggerShatter(laneCenter, this.hitLineY, color);
            // Theme-specific hit effect
            this.effectsRenderer.addHitEvent(laneCenter, this.hitLineY, laneWidth, j);
            if (j === Judgment.PERFECT || j === Judgment.GREAT) {
                this.particleSystem.triggerExplosion(laneCenter, this.hitLineY, color);
            }
        }

        if (combo >= 10 && combo % 10 === 0 && j !== Judgment.MISS) {
            this.effectsRenderer.triggerShockwave(this.getPerspectiveX(l, this.hitLineY), this.hitLineY);
        }
    };

    public onHoldStart = (l: number, n: VisualNote) => {
        n.isHolding = true;
        this.gameplayManager.setHoldingLane(l, n);
    };

    public onHoldEffect = (l: number) => {
        const laneCenter = this.getPerspectiveX(l, this.hitLineY) + this.getPerspectiveWidth(this.hitLineY) / 2;
        const laneWidth = this.getPerspectiveWidth(this.hitLineY);
        // Continuous effect uses PERFECT for maximum visual feedback
        this.effectsRenderer.addHitEvent(laneCenter, this.hitLineY, laneWidth, Judgment.PERFECT);
    };

    public onHoldEnd = (l: number) => {
        this.gameplayManager.clearHoldingLane(l);
    };

    private getJudgmentText(j: Judgment): string {
        switch (j) {
            case Judgment.PERFECT: return 'PERFECT';
            case Judgment.GREAT: return 'GREAT';
            case Judgment.GOOD: return 'GOOD';
            case Judgment.MISS: return 'MISS';
            default: return '';
        }
    }

    public returnToEditor = () => { this.audioEngine.stop(); window.dispatchEvent(new CustomEvent('switch-game', { detail: { targetMode: 'editor' } })); };
    public returnToMainMenu = () => {
        this.transitionSystem.start(() => {
            this.audioEngine.stop();
            this.isTestMode = false;
            GameTransition.clear();
            // Dispatch completely out of RhythmGame back to global launcher UI
            window.dispatchEvent(new CustomEvent('switch-game', { detail: { targetMode: 'main' } }));
        }, 'fade');
    };

    public destroy(): void {
        this.inputManager.unregister();
        if (this.startTimeout) clearTimeout(this.startTimeout);
        this.menuManager?.destroy();
        this.audioEngine.stop();
    }
}
