import { BaseGame } from '../../core/BaseGame';
import { ThemeManager } from '../../core/ThemeManager';
import { ScoreManager } from '../../core/score/ScoreManager';
import type { ParsedMidi } from '../../core/audio/MidiParser';
import { NoteFactory, type VisualNote } from './NoteFactory';
import { RenderCache } from './graphics/RenderCache';
import { GameTransition, type TransitionData } from '../../core/GameTransition';
import { GameState, type MenuRenderState } from './types/GameTypes';
import {
    LANE_COLORS,
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

/**
 * RhythmGame Orchestrator (Refactored v3 Stage 4-Final)
 * Goal: Pure FAÇADE coordinating independent systems.
 */
export class RhythmGame extends BaseGame implements IGameInputHandler, IJudgmentEventHandler {
    private audioLoader: AudioLoader;
    private menuManager: MenuManager;
    private menuRenderer: MenuRenderer;
    private scoreManager: ScoreManager;
    private renderCache: RenderCache;
    private inputManager: RhythmInputManager;
    private transitionSystem: TransitionSystem;
    private particleSystem: ParticleSystem;
    private effectsRenderer: EffectsRenderer;
    private themeStrategy: IThemeStrategy;
    private judgmentSystem: JudgmentSystem;
    private highwayRenderer: HighwayRenderer;
    private resultRenderer: ResultRenderer;
    private hudRenderer: HUDRenderer;
    private gameOverRenderer: GameOverRenderer;
    private pauseRenderer: PauseRenderer;
    private loadingRenderer: LoadingRenderer;
    private gameplayManager: GameplayManager;

    private currentState: GameState = GameState.MENU;
    private shouldAutoStart = false;
    private midiData: ParsedMidi | null = null;
    private visualNotes: VisualNote[] = [];
    private transitionData: TransitionData | null = null;
    private isMobile: boolean = false;
    private isTestMode: boolean = false;
    private horizonY = 0;
    private bottomY = 0;
    private hitLineY = 0;
    private laneBottomWidth = 120;
    private laneTopWidth = 10;
    private laneCount = 6;
    private scrollSpeed = 1.0;
    private keyMode: 4 | 6 = 4;
    private lastRenderTime = 0;
    private unifiedCurrentTime = 0;
    private startTimeout: ReturnType<typeof setTimeout> | null = null;

    private pauseSelectedButtonIndex: number = 0;
    private pauseAnimationTimer: number = 0;

    private loadingProgress: number = 0;
    private loadingStatus: string = "Initializing...";

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
        this.loadFonts();
    }

    private initThemeStrategy(): IThemeStrategy {
        const themeId = ThemeManager.getInstance().getCurrentTheme().id;
        if (themeId === 'cyber-neon') return new CyberNeonTheme();
        if (themeId === 'matrix-grid') return new MatrixGridTheme();
        if (themeId === 'deep-space') return new DeepSpaceTheme();
        if (themeId === 'vaporwave') return new VaporwaveTheme();
        if (themeId === 'midnight-ocean') return new MidnightOceanTheme();
        if (themeId === 'crimson-flare') return new CrimsonFlareTheme();
        if (themeId === 'marchen') return new MarchenTheme();
        if (themeId === 'monochrome-tech') return new MonochromeTechTheme();
        if (themeId === 'winter-snow') return new WinterSnowTheme();
        if (themeId === 'sunset-overdrive') return new SunsetOverdriveTheme();
        return new DefaultTheme();
    }

    private loadFonts() {
        const fontLink = document.createElement('link');
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap';
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

        // --- Synchronize Lane Width with Receptors ---
        // We want the lane width at hitLineY to be exactly 100px (NOTE_WIDTH).
        // t is the interpolation factor at hitLineY (usually ~0.88).
        const t = (this.hitLineY - this.horizonY) / (this.bottomY - this.horizonY);
        const topRatio = 0.20; // Original deep 3D perspective tilt

        // Single Lane Math: 100 = laneBottomWidth * topRatio + (laneBottomWidth - laneBottomWidth * topRatio) * t
        // 100 = laneBottomWidth * (topRatio + (1 - topRatio) * t)
        this.laneBottomWidth = 100 / (topRatio + (1 - topRatio) * t);
        this.laneTopWidth = this.laneBottomWidth * topRatio;

        this.inputManager.updateLayout(this.laneCount, this.laneBottomWidth);
        const highwayState = this.getHighwayRenderState();
        this.highwayRenderer.onResize(this.ctx, this.laneCount, this.horizonY, this.hitLineY, highwayState);
        this.hudRenderer.onResize(this.ctx, width, height);
        if (this.renderCache) {
            this.renderCache.renderHighwayBackground(width, height, this.horizonY, this.bottomY, this.laneCount,
                (l, y) => this.getPerspectiveX(l, y), ThemeManager.getInstance().getCurrentTheme().color1,
                ThemeManager.getInstance().getCurrentTheme().color2, this.hitLineY);
        }
    }

    private async handlePlayRequest() {
        this.currentState = GameState.LOADING;
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

            // Step 4: Pre-warm Renderer (Reduce JIT lag)
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
        this.currentState = GameState.PLAYING;
    }

    public update(delta: number): void {
        this.transitionSystem.update(delta);
        this.particleSystem.update(delta);
        if (delta > 200) this.judgmentSystem.setLagInvincibility(500);
        else this.judgmentSystem.update(delta);

        if (this.currentState === GameState.MENU) { this.menuManager.update(delta); return; }
        if (this.currentState === GameState.LOADING) return;

        if (this.currentState === GameState.PAUSED) {
            this.pauseAnimationTimer += delta / 1000;
            return;
        }

        if (this.currentState !== GameState.PLAYING) return;

        if (this.isTestMode) {
            this.gameplayManager.muteEnforceCounter++;
            if (this.gameplayManager.muteEnforceCounter >= 15) { this.gameplayManager.enforceMuteCompliance(this.transitionData); this.gameplayManager.muteEnforceCounter = 0; }
        }
        this.lastRenderTime = this.gameplayManager.syncTime(this.judgmentSystem.getLatency(), this.lastRenderTime, delta);

        // UNIFIED SNAPSHOT: Save time for rendering
        this.unifiedCurrentTime = this.lastRenderTime;

        this.gameplayManager.update(
            delta,
            this.lastRenderTime,
            this.horizonY,
            this.hitLineY,
            this.laneBottomWidth,
            (l, y) => this.getPerspectiveX(l, y),
            (y) => PerspectiveUtils.getPerspectiveWidth(y, {
                width: this.canvas.width,
                horizonY: this.horizonY,
                bottomY: this.bottomY,
                laneCount: this.laneCount,
                laneTopWidth: this.laneTopWidth,
                laneBottomWidth: this.laneBottomWidth
            })
        );

        if (this.transitionSystem.isActive()) return;
        if (this.gameplayManager.isGameOver()) {
            this.transitionSystem.start(() => {
                this.currentState = GameState.GAMEOVER;
                this.audioEngine.stop();
            }, 'glitch');
        } else if (this.gameplayManager.isSongCompleted(this.lastRenderTime, this.midiData?.duration ? this.midiData.duration * 1000 : 0, delta)) {
            this.transitionSystem.start(() => {
                this.currentState = GameState.RESULT;
                this.audioEngine.stop();
                if (!this.isTestMode && this.scoreManager) {
                    this.scoreManager.saveHighScore(this.menuManager.getCurrentSong().url);
                }
            }, 'fade');
        }
    }

    public render(): void {
        const ctx = this.ctx;
        const { width, height } = this.canvas;
        if (height > width) { this.renderRotateRequest(ctx, width, height); return; }

        if (this.currentState === GameState.MENU) this.menuRenderer.render(ctx, this.getMenuRenderState());
        else if (this.currentState === GameState.LOADING) {
            this.loadingRenderer.render(ctx, {
                width, height,
                progress: this.loadingProgress,
                song: this.menuManager.getCurrentSong(),
                statusText: this.loadingStatus,
                cachedNow: performance.now()
            });
        }
        else if (this.currentState === GameState.RESULT) this.resultRenderer.render(ctx, width, height, this.scoreManager);
        else if (this.currentState === GameState.GAMEOVER) this.gameOverRenderer.render(ctx, this.getGameOverRenderState());
        else {
            this.renderGameplay(ctx, width, height);
            if (this.currentState === GameState.PAUSED) {
                this.pauseRenderer.render(ctx, {
                    width, height,
                    selectedButtonIndex: this.pauseSelectedButtonIndex,
                    animationTimer: this.pauseAnimationTimer
                });
            }
        }

        this.effectsRenderer.render(ctx, width, height, this.themeStrategy);
    }

    private renderRotateRequest(ctx: CanvasRenderingContext2D, width: number, height: number) {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 24px "Orbitron"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText("PLEASE ROTATE YOUR DEVICE", width / 2, height / 2);
    }

    private getHighwayRenderState(): HighwayRenderState {
        return {
            width: this.canvas.width,
            height: this.canvas.height,
            horizonY: this.horizonY,
            bottomY: this.bottomY,
            hitLineY: this.hitLineY,
            laneCount: this.laneCount,
            laneTopWidth: this.laneTopWidth,
            laneBottomWidth: this.laneBottomWidth,
            keyMode: this.keyMode,
            scrollSpeed: this.scrollSpeed,
            currentTime: this.unifiedCurrentTime,
            cachedNow: performance.now(),
            isMobile: this.isMobile
        };
    }

    private getGameOverRenderState(): GameOverRenderState {
        return {
            width: this.canvas.width,
            height: this.canvas.height,
            isMobile: this.isMobile,
            cachedNow: performance.now(),
            transitionStyle: this.transitionSystem.getStyle(),
            transitionAlpha: this.transitionSystem.getAlpha()
        };
    }

    private getPerspectiveX(lane: number, y: number): number {
        return PerspectiveUtils.getPerspectiveX(lane, y, {
            width: this.canvas.width,
            horizonY: this.horizonY,
            bottomY: this.bottomY,
            laneCount: this.laneCount,
            laneTopWidth: this.laneTopWidth,
            laneBottomWidth: this.laneBottomWidth
        });
    }

    private getPerspectiveWidth(y: number): number {
        return PerspectiveUtils.getPerspectiveWidth(y, {
            width: this.canvas.width,
            horizonY: this.horizonY,
            bottomY: this.bottomY,
            laneCount: this.laneCount,
            laneTopWidth: this.laneTopWidth,
            laneBottomWidth: this.laneBottomWidth
        });
    }

    private getMenuRenderState(): MenuRenderState {
        return {
            menuAnimationTimer: this.menuManager.menuAnimationTimer,
            songList: this.menuManager.songList,
            selectedSongIndex: this.menuManager.selectedSongIndex,
            currentSortMode: this.menuManager.currentSortMode,
            difficultyOptions: DIFFICULTY_OPTIONS,
            selectedDifficultyIndex: this.menuManager.selectedDifficultyIndex,
            speedOptions: SPEED_OPTIONS,
            selectedSpeedIndex: this.menuManager.selectedSpeedIndex,
            scrollSpeed: this.menuManager.scrollSpeed,
            keyMode: this.menuManager.keyMode,
            isTestMode: this.isTestMode,
            isMobile: this.isMobile,
            width: this.canvas.width,
            height: this.canvas.height,
            transitionData: this.transitionData,
            scoreManager: this.scoreManager,
            previewMidi: this.menuManager.previewMidi,
            previewTime: this.audioEngine.getPreciseTime() - this.audioEngine.getOutputLatency()
        };
    }

    private renderGameplay(ctx: CanvasRenderingContext2D, width: number, height: number) {
        ctx.clearRect(0, 0, width, height);
        const highwayState = this.getHighwayRenderState();
        this.highwayRenderer.render(ctx, highwayState, this.visualNotes, this.gameplayManager.lastNoteIndex, this.gameplayManager.holdingLanes, this.inputManager);
        const hudState: HUDRenderState = {
            width, height,
            comboAnim: this.gameplayManager.comboAnim,
            lastJudgment: this.judgmentSystem.getLastJudgment(),
            cachedNow: performance.now()
        };
        this.hudRenderer.render(ctx, hudState, this.scoreManager, this.themeStrategy, (l, y) => this.getPerspectiveX(l, y));
    }

    // -- IGameInputHandler Implementation --
    public getCurrentState = () => this.currentState;
    public onLanePress = (l: number, _t: number) => {
        if (this.currentState === GameState.PLAYING && this.gameplayManager.preGameTimer <= 0) {
            const currentTimeMs = this.audioEngine.getPreciseTime() * 1000 - this.judgmentSystem.getLatency();
            this.judgmentSystem.checkHit(l, currentTimeMs, this.visualNotes);
        }
    };
    public onLaneRelease = (l: number, _t: number) => {
        if (this.currentState === GameState.PLAYING) {
            const currentTimeMs = this.audioEngine.getPreciseTime() * 1000 - this.judgmentSystem.getLatency();
            this.judgmentSystem.processRelease(l, currentTimeMs);
        }
    };
    public onMenuPointerDown = (x: number, y: number) => {
        if (this.currentState === GameState.PAUSED) {
            const btnIndex = this.pauseRenderer.getButtonAt(x, y, this.canvas.width, this.canvas.height);
            if (btnIndex !== -1) {
                this.pauseSelectedButtonIndex = btnIndex;
                this.handlePauseAction(btnIndex);
            }
            return;
        }

        if (this.currentState === GameState.PLAYING) {
            // Check for Pause Button click
            const pauseBtnSize = 50;
            const pauseBtnX = this.canvas.width - 65;
            const pauseBtnY = 100;
            if (x >= pauseBtnX && x <= pauseBtnX + pauseBtnSize && y >= pauseBtnY && y <= pauseBtnY + pauseBtnSize) {
                this.togglePause();
            }
            return;
        }

        this.menuManager.handlePointerDown(x, y, this.canvas.width, this.canvas.height, this.isMobile);
        this.keyMode = this.menuManager.getKeyMode();
        this.scrollSpeed = this.menuManager.getScrollSpeed();
        this.inputManager.updateKeyMode(this.keyMode);
    };
    public onMenuPointerMove = (x: number, y: number) => {
        this.menuManager.handlePointerMove(x, y, this.canvas.width, this.canvas.height, this.isMobile);
    };
    public onMenuPointerUp = (x: number, y: number) => {
        this.menuManager.handlePointerUp(x, y, this.canvas.width, this.canvas.height, this.isMobile);
    };

    public onMenuKey = (code: string) => {
        if (this.isTestMode && this.shouldAutoStart && (code === 'Enter' || code === 'Space')) {
            this.shouldAutoStart = false;
            this.start();
        } else if (this.currentState === GameState.PLAYING && code === 'Escape') {
            this.togglePause();
        } else if (this.currentState === GameState.PAUSED) {
            if (code === 'Escape') this.togglePause();
            else if (code === 'ArrowUp') this.pauseSelectedButtonIndex = (this.pauseSelectedButtonIndex + 2) % 3;
            else if (code === 'ArrowDown') this.pauseSelectedButtonIndex = (this.pauseSelectedButtonIndex + 1) % 3;
            else if (code === 'Enter') this.handlePauseAction(this.pauseSelectedButtonIndex);
        } else {
            this.menuManager.handleKeyboardInput(code);
            this.keyMode = this.menuManager.getKeyMode();
        }
    };

    private backToSongSelection() {
        this.transitionSystem.start(() => {
            this.audioEngine.stop();
            this.isTestMode = false;
            GameTransition.clear();
            this.currentState = GameState.MENU;
            this.menuManager.playPreview();
        }, 'fade');
    }

    private togglePause() {
        if (this.currentState === GameState.PLAYING) {
            this.currentState = GameState.PAUSED;
            this.audioEngine.pause();
            this.pauseAnimationTimer = 0;
            this.pauseSelectedButtonIndex = 0;
        } else if (this.currentState === GameState.PAUSED) {
            this.currentState = GameState.PLAYING;
            this.audioEngine.play();
        }
    }

    private handlePauseAction(index: number) {
        if (index === 0) this.togglePause();           // RESUME
        else if (index === 1) this.handleRetry();           // RESTART
        else if (index === 2) this.backToSongSelection(); // SONG SELECTION
    }
    public onGameOverPointer = (x: number, y: number) => {
        const { width, height } = this.canvas;
        const btnW = this.isMobile ? Math.min(width * 0.85, 300) : 360;
        const btnH = this.isMobile ? 55 : 68;
        const centerX = width / 2;
        const minGap = this.isMobile ? 15 : 25;
        const spacing = btnH + minGap;
        const baseY = height * (this.isMobile ? 0.65 : 0.62);

        const retryYLeft = centerX - btnW / 2;
        const retryYRight = centerX + btnW / 2;
        const retryYTop = baseY - btnH / 2;
        const retryYBottom = baseY + btnH / 2;

        if (x >= retryYLeft && x <= retryYRight && y >= retryYTop && y <= retryYBottom) {
            this.handleRetry();
            return;
        }

        const selectYTop = (baseY + spacing) - btnH / 2;
        const selectYBottom = (baseY + spacing) + btnH / 2;
        if (x >= retryYLeft && x <= retryYRight && y >= selectYTop && y <= selectYBottom) {
            this.backToSongSelection();
            return;
        }
    };
    public onGameOverKey = (code: string) => {
        if (code === 'Enter') this.handleRetry();
        else if (code === 'Escape') this.backToSongSelection();
    };
    public onResultKey = (code: string) => {
        if (code === 'Enter' || code === 'Space' || code === 'Escape') this.backToSongSelection();
    };
    public onResultPointer = () => { this.backToSongSelection(); };
    public onWheel = (delta: number) => { if (this.currentState === GameState.MENU) this.menuManager.handleWheel(delta); };

    private handleRetry() {
        this.transitionSystem.start(async () => {
            this.audioEngine.stop();
            await this.load();
            this.create();
            this.start();
        }, 'fade');
    }

    // -- IJudgmentEventHandler Implementation --
    public onJudgment = (l: number, j: string, _d: number) => {
        this.scoreManager.addHit(100, j as 'PERFECT' | 'GREAT' | 'GOOD' | 'MISS');
        this.judgmentSystem.setJudgment(j, this.themeStrategy.getColorForJudgment(j), performance.now());
        if (j !== 'MISS') {
            const laneCenter = this.getPerspectiveX(l, this.hitLineY) + this.getPerspectiveWidth(this.hitLineY) / 2;
            const laneWidth = this.getPerspectiveWidth(this.hitLineY);
            const pColor = LANE_COLORS[l % LANE_COLORS.length][0];
            this.particleSystem.triggerShatter(laneCenter, this.hitLineY, pColor);
            // Theme-specific hit effect
            this.effectsRenderer.addHitEvent(laneCenter, this.hitLineY, laneWidth, j);
            if (j === 'PERFECT' || j === 'GREAT') {
                this.particleSystem.triggerExplosion(laneCenter, this.hitLineY, pColor);
            }
        }
    };
    public onHoldStart = (l: number, n: VisualNote) => { n.isHolding = true; this.gameplayManager.setHoldingLane(l, n); };
    public onHoldEnd = (l: number) => { this.gameplayManager.clearHoldingLane(l); };

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
