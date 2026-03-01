import { BaseGame } from '../../core/BaseGame';
import { ThemeManager } from '../../core/ThemeManager';
import { ASSET_PATHS } from '../../core/asset/AssetRegistry';
import { MidiParser } from '../../core/audio/MidiParser';
import type { ParsedMidi } from '../../core/audio/MidiParser';
import { NoteFactory } from './NoteFactory';
import type { VisualNote } from './NoteFactory';
import { ScoreManager } from '../../core/score/ScoreManager';
import { RenderCache } from './graphics/RenderCache';
import { GameTransition } from '../../core/GameTransition';

// Game States
const GameState = {
    MENU: 0,
    PLAYING: 1,
    RESULT: 2,
    GAMEOVER: 3
} as const;
type GameState = typeof GameState[keyof typeof GameState];

interface Explosion {
    x: number;
    y: number;
    radius: number;
    alpha: number;
    color: string;
}

interface SongEntry {
    name: string;
    url: string;
    bpm?: number;
    duration?: number;
    noteCount?: number;
}

export class RhythmGame extends BaseGame {
    private midiData: ParsedMidi | null = null;
    private beatmapData: any | null = null;
    private visualNotes: VisualNote[] = [];
    private cachedMidi: { url: string, buffer: ArrayBuffer, parsed: ParsedMidi } | null = null;
    private loadingPromise: Promise<void> | null = null; // Guard against concurrent loads

    private currentState: GameState = GameState.MENU;
    private shouldAutoStart = false; // Prevents auto-start on boot
    private scoreManager: ScoreManager | null = null;

    // Menu State
    private songList: SongEntry[] = [
        { name: 'Test Song', url: ASSET_PATHS.AUDIO.MIDI.TEST }
    ];
    private currentSortMode: 'name' | 'bpm' | 'duration' | 'noteCount' = 'name';
    private selectedSongIndex = 0;
    private previewTimeout: ReturnType<typeof setTimeout> | null = null;
    private speedOptions = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0];
    private selectedSpeedIndex = 1; // Default 1.0x
    private difficultyOptions = ['EASY', 'NORMAL', 'HARD'];
    private selectedDifficultyIndex = 1; // Default NORMAL
    private touchStartY = 0;
    private menuAnimationTimer = 0;
    private particles: {
        x: number, y: number, vx: number, vy: number,
        alpha: number, size: number, color: string,
        rotation: number, rotationSpeed: number
    }[] = [];
    private explosions: Explosion[] = [];
    private holdingLanes: (VisualNote | null)[] = [null, null, null, null, null, null];

    // Transition State
    private transitionAlpha: number = 0;
    private transitionDirection: 'in' | 'out' = 'out';
    private transitionStyle: 'fade' | 'glitch' = 'fade';
    private isTransitioning: boolean = false;
    private onTransitionMidpoint: (() => void) | null = null;


    // Settings
    private scrollSpeed = 1.0; // Default 1.0x
    private laneCount = 6;
    private keyMode: 4 | 6 = 4; // 4K or 6K mode
    private endGameTimer = 0;
    private lastCombo = 0;
    private comboAnim = 0; // 0 to 1 anim factor
    private preGameTimer = 0;
    private targetStartTime = 0; // Target audio start time to sync visuals
    private isAudioStarted = false;
    private lastNoteIndex = 0;
    private beamGradients: (CanvasGradient | null)[] = new Array(6).fill(null);

    // FPS Counter
    private lastFpsTime = 0;
    private frameCount = 0;
    // currentFps is tracked globally in main.ts (FPS overlay div)

    // Perspective Configuration
    private readonly horizonYRatio = 0.0; // Horizon at top (Maximize Highway)
    private readonly bottomYRatio = 1.0;  // Highway ends at bottom
    private readonly hitLineYRatio = 0.85; // Hit line moved up slightly to avoid mobile cutoffs

    private horizonY = 0;
    private bottomY = 0;
    private hitLineY = 0;

    // Highway Widths
    private laneBottomWidth = 100; // Calculated in init
    private laneTopWidth = 10;     // Narrow at horizon

    private renderCache: RenderCache | null = null;
    private _cachedHudPalette: typeof RhythmGame.HUD_PALETTES[string] | null = null;
    private _cachedThemeId: string = '';

    // Visual Assets / Constants
    private readonly COLORS = {
        LANES: [
            ['#ff0066', '#ff3385'], // Lane 0: Neon Pink
            ['#ffcc00', '#ffdb4d'], // Lane 1: Electric Gold
            ['#00ff99', '#33ffad'], // Lane 2: Spring Green
            ['#00e5ff', '#33ebff'], // Lane 3: Cyber Cyan
            ['#2979ff', '#5393ff'], // Lane 4: Azure Blue
            ['#aa00ff', '#bb33ff'], // Lane 5: Electric Purple
        ],
        LANE_BORDER: '#444444',
        HIT_LINE_GLOW: '#00ffff',
        HUD_BG: 'rgba(0, 0, 0, 0.7)',
        TEXT_GLOW: '#ffffff'
    };

    private isTestMode: boolean = false;
    private isMobile: boolean = false; // Cached mobile flag
    private transitionData: any = null;

    // Optimization: Index-based windowing to avoid O(N) iteration
    // Tracks the index of the first note that hasn't been fully processed/missed yet.
    private lastMissCheckIndex: number = 0;

    // Mobile Stability: Track last valid render time to prevent visual reversal
    // Mobile Stability
    private lastRenderTime: number = 0;
    private muteEnforceCounter: number = 0;

    // RGBA Cache optimization - Use a Map for faster lookup and less string fragmentation
    private rgbaCache: Map<string, string> = new Map();

    // Pre-calculated Gradients to avoid per-frame allocation
    private cachedHpGradient: CanvasGradient | null = null;
    private cachedScoreGradient: CanvasGradient | null = null;
    private cachedComboGradient: CanvasGradient | null = null;

    // Mobile performance: hard cap on simultaneous particles to avoid GC spikes
    private readonly MAX_PARTICLES = 300; // Restored high-quality particle cap

    // Touch Tracking (PointerID -> Lane Index)
    private pointerLanes: Map<number, number> = new Map();

    // Zombie Audio Protection: Cancellation token for playPreview
    private currentPreviewId: number = 0;

    // Audio Latency Calibration
    // Measured once at game start from AudioContext.outputLatency + baseLatency.
    // Used to shift the judgment window so that visual and audio are perceptually aligned.
    // Example: if outputLatencyMs = 50ms, a note played at t=1000ms is HEARD at t=1050ms.
    // We shift the judgment window forward by 50ms so the player can hit on what they hear.
    private outputLatencyMs: number = 0;

    // effectiveStartTime stores the ACTUAL position where audio playback starts.
    private effectiveStartTime: number = 0;

    // Performance & Lag Protection
    private lagSpikeInvincibility: number = 0; // ms remaining
    private cachedNow: number = 0; // performance.now() cached once per frame

    constructor(canvas: HTMLCanvasElement) {
        super(canvas);

        // Bind input methods properly
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        this.handleTouchStart = this.handleTouchStart.bind(this);
        this.handleTouchMove = this.handleTouchMove.bind(this);
        this.handleTouchEnd = this.handleTouchEnd.bind(this);
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleWheel = this.handleWheel.bind(this);

        // Load Sci-Fi Font
        const fontLink = document.createElement('link');
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap';
        fontLink.rel = 'stylesheet';
        document.head.appendChild(fontLink);
    }

    public resize(width: number, height: number): void {
        super.resize(width, height);

        // Responsive Layout calculations
        this.horizonY = height * this.horizonYRatio;
        this.bottomY = height * this.bottomYRatio;
        this.hitLineY = height * this.hitLineYRatio;

        // Calculate lane widths based on screen width
        // Mobile Optimization: Use up to 95% of width on small screens, max 800px
        const totalHighwayWidthBottom = Math.min(800, width * 0.95);
        const totalHighwayWidthTop = totalHighwayWidthBottom * 0.2;

        this.laneBottomWidth = totalHighwayWidthBottom / this.laneCount;
        this.laneTopWidth = totalHighwayWidthTop / this.laneCount;


        const ctxPre = this.ctx;
        this.beamGradients = this.COLORS.LANES.map(colorSet => {
            const grad = ctxPre.createLinearGradient(0, this.hitLineY, 0, this.horizonY);
            const color = colorSet[1];
            grad.addColorStop(0, this.hexToRgba(color, 0.3));
            grad.addColorStop(1, this.hexToRgba(color, 0.0));
            return grad;
        });

        // Pre-calculate HUD Gradients (Avoid per-frame allocation)
        const pal = this.getHudPalette();

        // HP Bar Gradient
        const hpGrad = ctxPre.createLinearGradient(10, 0, 400, 0); // Approx max width
        hpGrad.addColorStop(0, pal.hpBarStart);
        hpGrad.addColorStop(0.5, pal.hpBarMid);
        hpGrad.addColorStop(1, pal.hpBarEnd);
        this.cachedHpGradient = hpGrad;

        // Score Panel Gradient
        const scoreGrad = ctxPre.createLinearGradient(width - 400, 0, width - 10, 0);
        scoreGrad.addColorStop(0, pal.scoreFill);
        scoreGrad.addColorStop(1, pal.scoreGlow);
        this.cachedScoreGradient = scoreGrad;

        // Combo Gradient
        const comboGrad = ctxPre.createLinearGradient(0, -36, 0, 36);
        comboGrad.addColorStop(0, pal.comboGradTop);
        comboGrad.addColorStop(0.5, pal.comboFill);
        comboGrad.addColorStop(1, pal.comboGradBot);
        this.cachedComboGradient = comboGrad;

        // Re-generate Highway Cache on resize
        if (this.renderCache) {
            this.renderCache.renderHighwayBackground(
                width, height,
                this.horizonY, this.bottomY,
                this.laneCount,
                this.getPerspectiveX.bind(this),
                ThemeManager.getInstance().getCurrentTheme().color1,
                ThemeManager.getInstance().getCurrentTheme().color2,
                this.hitLineY
            );
        }
    }

    public async init(): Promise<void> {
        console.log("[RhythmGame] Initializing...");

        // Detect Mobile Environment Once
        this.isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        console.log(`[RhythmGame] Environment: ${this.isMobile ? 'Mobile' : 'Desktop'}`);

        // Initialize RenderCache FIRST
        this.renderCache = RenderCache.getInstance();
        this.renderCache.init();

        // Score Manager
        this.scoreManager = ScoreManager.getInstance();
        if (this.scoreManager) this.scoreManager.reset();

        // Reset Logic Index
        this.lastMissCheckIndex = 0;

        // Initial Resize (Now RenderCache is ready to generate textures)
        this.resize(this.canvas.width, this.canvas.height);

        // Initial Resize (Now RenderCache is ready to generate textures)
        this.resize(this.canvas.width, this.canvas.height);


        // Create Initial Particles
        for (let i = 0; i < 30; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * 1,
                vy: (Math.random() - 0.5) * 1,
                alpha: Math.random(),
                size: Math.random() * 2,
                color: '#ffffff',
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.1
            });
        }

        // Check for Game Transition Data (Test Play from Editor)
        if (GameTransition.hasData()) {
            console.log("[RhythmGame] Transition Data Found. Entering TEST MODE.");
            const data = GameTransition.get();
            if (data) {
                this.isTestMode = true;
                this.transitionData = data;
                // Data is stored. launchGame will call load() → create() through the normal path.
                console.log("[RhythmGame] Test Mode data stored. Proceeding with normal load sequence.");
                return;
            }
        }

        // Load Song List
        try {
            const res = await fetch('assets/data/midi_list.json');
            if (res.ok) {
                const list = await res.json();
                if (Array.isArray(list) && list.length > 0) {
                    this.songList = list;
                    this.sortSongList();
                    console.log(`[RhythmGame] Loaded ${list.length} songs.`);
                }
            }
        } catch (e) {
            console.warn('[RhythmGame] Failed to load song list, using default.', e);
        }

        // Load Default Song Data (Load first song or selected)
        await this.load();
    }

    private sortSongList(): void {
        const previousTargetUrl = this.songList[this.selectedSongIndex]?.url;
        this.songList.sort((a, b) => {
            switch (this.currentSortMode) {
                case 'name':
                    return a.name.localeCompare(b.name);
                case 'bpm':
                    return (b.bpm || 0) - (a.bpm || 0);
                case 'duration':
                    return (b.duration || 0) - (a.duration || 0);
                case 'noteCount':
                    return (b.noteCount || 0) - (a.noteCount || 0);
                default:
                    return a.name.localeCompare(b.name);
            }
        });

        // Try to maintain the selection
        if (previousTargetUrl) {
            const newIndex = this.songList.findIndex(s => s.url === previousTargetUrl);
            if (newIndex !== -1) this.selectedSongIndex = newIndex;
            else this.selectedSongIndex = 0;
        } else {
            this.selectedSongIndex = 0;
        }
    }

    // Touch Handling (Pointer-Based)
    private isTouchDown: boolean = false;

    private handleTouchStart(e: TouchEvent): void {
        e.preventDefault();

        if (this.currentState === GameState.GAMEOVER) {
            const touch = e.changedTouches[0];
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            this.handleGameOverPointer((touch.clientX - rect.left) * scaleX, (touch.clientY - rect.top) * scaleY);
            return;
        }

        if (this.currentState === GameState.MENU) {
            if (this.isTestMode && this.shouldAutoStart) {
                // Test Mode: First touch unlocks audio and starts the game (same as normal mode START button)
                this.audioEngine.resume().then(() => {
                    console.log(`[RhythmGame] Test Mode: Audio unlocked. Starting game...`);
                    this.shouldAutoStart = false;
                    this.start();
                });
            } else {
                // Normal Mode: Handle menu touch (includes audio unlock for START button)
                const touch = e.changedTouches[0];
                const rect = this.canvas.getBoundingClientRect();
                const scaleX = this.canvas.width / rect.width;
                const scaleY = this.canvas.height / rect.height;
                const x = (touch.clientX - rect.left) * scaleX;
                const y = (touch.clientY - rect.top) * scaleY;

                this.isTouchDown = true;
                this.touchStartY = y;
                this.handleMenuPointer(x, y);
            }
            return;
        }

        if (this.currentState === GameState.RESULT) {
            if (this.isTransitioning) return;

            this.startTransition(() => {
                if (this.isTestMode) {
                    this.returnToEditor();
                } else {
                    this.currentState = GameState.MENU;
                    this.scoreManager?.reset();
                    this.playPreview();
                }
            });
            return;
        }

        // Gameplay Touch — audio is already unlocked at this point
        // Block hits during lead-in (preGameTimer > 0): notes aren't active yet
        if (this.preGameTimer > 0) return;

        // INPUT LATENCY COMPENSATION:
        // e.timeStamp is the DOMHighResTimeStamp of when the touch actually occurred.
        // By the time this handler runs, some time may have passed (JS event queue delay).
        // We subtract that delay from the current game time to get the true hit time.
        const handlerTime = performance.now();
        const inputDelay = Math.max(0, Math.min(handlerTime - e.timeStamp, 100)); // clamp 0-100ms
        const currentTimeMs = this.audioEngine.getPreciseTime() * 1000 - inputDelay;
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            const lane = this.getLaneFromTouch(touch.clientX, touch.clientY);

            // Track this pointer
            this.pointerLanes.set(touch.identifier, lane);

            if (lane !== -1) {
                if (!this.keyState[lane]) {
                    this.keyState[lane] = true;
                    this.checkHit(lane, currentTimeMs);
                }
            }
        }
    }

    // Mouse Handling (Pointer-Based)
    private isMouseDown: boolean = false;
    private mouseLane: number = -1;

    private handleMouseDown(e: MouseEvent): void {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        if (this.currentState === GameState.GAMEOVER) {
            this.handleGameOverPointer(x, y);
            return;
        }

        if (this.currentState === GameState.MENU) {
            if (this.isTestMode && this.shouldAutoStart) {
                this.audioEngine.resume().then(() => {
                    this.shouldAutoStart = false;
                    this.start();
                });
            } else {
                this.isMouseDown = true;
                this.touchStartY = y;
                this.handleMenuPointer(x, y);
            }
            return;
        }

        if (this.currentState === GameState.RESULT) {
            if (this.isTransitioning) return;

            this.startTransition(() => {
                if (this.isTestMode) {
                    this.returnToEditor();
                } else {
                    this.currentState = GameState.MENU;
                    this.scoreManager?.reset();
                    this.playPreview();
                }
            });
            return;
        }

        if (this.preGameTimer > 0) return;

        this.isMouseDown = true;
        const handlerTime = performance.now();
        const inputDelay = Math.max(0, Math.min(handlerTime - e.timeStamp, 100));
        const currentTimeMs = this.audioEngine.getPreciseTime() * 1000 - inputDelay;

        const lane = this.getLaneFromTouch(e.clientX, e.clientY);
        this.mouseLane = lane;
        if (lane !== -1 && !this.keyState[lane]) {
            this.keyState[lane] = true;
            this.checkHit(lane, currentTimeMs);
        }
    }

    private handleMouseMove(e: MouseEvent): void {
        const rect = this.canvas.getBoundingClientRect();
        const scaleY = this.canvas.height / rect.height;
        const y = (e.clientY - rect.top) * scaleY;

        if (this.currentState === GameState.MENU && this.isMouseDown) {
            const diffY = y - this.touchStartY;
            // Simple 30px threshold for snappy scrolling that matches finger speed
            const threshold = 30;
            const shift = Math.trunc(diffY / threshold);
            if (shift !== 0) {
                this.selectedSongIndex = (this.selectedSongIndex + shift) % this.songList.length;
                if (this.selectedSongIndex < 0) this.selectedSongIndex += this.songList.length;
                this.touchStartY = y - (diffY % threshold);
                this.playPreview();
            }
            return;
        }

        if (!this.isMouseDown || this.preGameTimer > 0) return;

        const currentTimeMs = this.audioEngine.getPreciseTime() * 1000;
        const newLane = this.getLaneFromTouch(e.clientX, e.clientY);
        const oldLane = this.mouseLane;

        if (newLane !== oldLane) {
            if (oldLane !== -1) {
                this.keyState[oldLane] = false;
                this.processLaneRelease(oldLane, currentTimeMs);
            }
            if (newLane !== -1) {
                this.keyState[newLane] = true;
                this.checkHit(newLane, currentTimeMs);
            }
            this.mouseLane = newLane;
        }
    }

    private handleMouseUp(_e: MouseEvent): void {
        this.isMouseDown = false;
        if (this.mouseLane !== -1) {
            this.keyState[this.mouseLane] = false;
            this.processLaneRelease(this.mouseLane, this.audioEngine.getPreciseTime() * 1000);
            this.mouseLane = -1;
        }
    }

    private handleWheel(e: WheelEvent): void {
        if (this.currentState !== GameState.MENU) return;
        e.preventDefault();
        if (e.deltaY > 0) {
            this.selectedSongIndex = Math.min(this.songList.length - 1, this.selectedSongIndex + 1);
        } else {
            this.selectedSongIndex = Math.max(0, this.selectedSongIndex - 1);
        }
        this.playPreview();
    }

    private handleMenuPointer(x: number, y: number): void {
        console.log(`[MenuPointer] touch(${x.toFixed(0)},${y.toFixed(0)})`);
        const width = this.canvas.width;
        const height = this.canvas.height;
        const padding = Math.min(width * 0.02, 20);

        const leftPanelWidth = width * 0.46;
        const rightPanelX = width * 0.5;
        const visPanelH = height * 0.48;
        const infoY = visPanelH + padding + 10;
        const infoH = height - infoY - padding; // match renderMenu line 2691

        // MUST exactly match renderMenu (lines 2693-2697)
        const listX = rightPanelX - 25;       // rendering: rightPanelX - 25
        const listY = padding;
        const listW = width - listX - padding; // rendering: width - listX - padding
        const listH = height - listY - padding; // rendering: height - listY - padding

        // CRITICAL: Must match renderMenu exactly (line 2949 in rendering)
        // listInnerY = listY + TAB_H(26) + 10 (below tab)
        const listInnerY = listY + 26 + 10;

        // Song list layout — must match renderMenu exactly
        const visibleCount = 7;
        const btnAreaH = Math.max(60, height * 0.09);
        const listBtnGap = Math.max(10, height * 0.015);
        const listAvailH = listH - 26 - 10 - listBtnGap - btnAreaH - 8;
        const itemHeight = listAvailH / visibleCount;

        // Play Now Button position — must match renderMenu exactly (lines 3076-3082)
        const btnMargin = 6;
        const btnH2 = btnAreaH;
        const btnX2 = listX + btnMargin;
        const btnW2 = listW - btnMargin * 2;
        const btnY2Natural = listInnerY + visibleCount * itemHeight + listBtnGap;
        const btnY2Max = listY + listH - btnH2 - btnMargin;
        const btnY2 = Math.min(btnY2Natural, btnY2Max);

        // 0. Main Menu Button Hitbox (Top Right)
        console.log(`[MenuPointer] btn hitbox y(${btnY2.toFixed(0)}-${(btnY2 + btnH2).toFixed(0)}) listInnerY=${listInnerY.toFixed(0)} itemH=${itemHeight.toFixed(1)}`);
        if (x >= width - padding - 116 && x <= width - padding && y >= 0 && y <= 40) {
            this.returnToMainMenu();
            return;
        }

        // 1. Play Now Button
        if (x >= btnX2 && x <= btnX2 + btnW2 && y >= btnY2 && y <= btnY2 + btnH2) {
            console.log(`[MenuPointer] PLAY BUTTON HIT! touch(${x.toFixed(0)},${y.toFixed(0)})`);
            if (this.previewTimeout) clearTimeout(this.previewTimeout);
            this.currentPreviewId++; // Invalidate any pending background previews
            this.audioEngine.stop();

            this.audioEngine.resume().then(() => {
                console.log(`[RhythmGame] Audio unlocked. Loading song...`);
                this.shouldAutoStart = true;
                this.load().then(() => this.create());
            });
            return;
        }

        // 2. Difficulty, Speed & Mode Controls
        const padUI = Math.min((infoH - 26) * 0.045, 12);
        const numRows = 3; // Matched with renderMenu
        const numCols = 2;
        const optH = ((infoH - 26) - padUI * (numRows + 1)) / numRows;

        const innerW = (leftPanelWidth - padding) - 2 * padUI; // panel width minus equal side margins
        const optW = (innerW - (numCols - 1) * padUI) / numCols;

        // Centers of the columns
        const col1CenterX = padding + padUI + optW / 2;
        const col2CenterX = col1CenterX + optW + padUI;

        // Centers of the rows
        const row1CenterY = infoY + 26 + padUI + optH / 2;
        const row2CenterY = row1CenterY + optH + padUI;
        const row3CenterY = row2CenterY + optH + padUI;

        const hitWidth = optW * 0.45; // Generous hit width within the frame
        const hitHeight = optH * 0.45; // Generous hit height within the frame

        // Difficulty (Row 2, Col 1)
        if (Math.abs(y - row2CenterY) < hitHeight) {
            if (Math.abs(x - (col1CenterX - hitWidth)) < hitWidth * 0.5) {
                this.selectedDifficultyIndex = Math.max(0, this.selectedDifficultyIndex - 1);
                this.playPreview();
                return;
            } else if (Math.abs(x - (col1CenterX + hitWidth)) < hitWidth * 0.5) {
                this.selectedDifficultyIndex = Math.min(this.difficultyOptions.length - 1, this.selectedDifficultyIndex + 1);
                this.playPreview();
                return;
            }
        }

        // Speed (Row 2, Col 2)
        if (Math.abs(y - row2CenterY) < hitHeight) {
            if (Math.abs(x - (col2CenterX - hitWidth)) < hitWidth * 0.5) {
                this.selectedSpeedIndex = Math.max(0, this.selectedSpeedIndex - 1);
                this.scrollSpeed = this.speedOptions[this.selectedSpeedIndex];
                return;
            } else if (Math.abs(x - (col2CenterX + hitWidth)) < hitWidth * 0.5) {
                this.selectedSpeedIndex = Math.min(this.speedOptions.length - 1, this.selectedSpeedIndex + 1);
                this.scrollSpeed = this.speedOptions[this.selectedSpeedIndex];
                return;
            }
        }

        // Mode: 4K / 6K toggle (Row 3, Col 1)
        if (Math.abs(y - row3CenterY) < hitHeight) {
            if (Math.abs(x - col1CenterX) < hitWidth) {
                this.keyMode = this.keyMode === 4 ? 6 : 4;
                return;
            }
        }

        // 3. Sort Button
        if (y > listY && y < listY + 30 && x > listX + listW - 100) {
            const modes: ('name' | 'bpm' | 'duration' | 'noteCount')[] = ['name', 'bpm', 'duration', 'noteCount'];
            const idx = modes.indexOf(this.currentSortMode);
            this.currentSortMode = modes[(idx + 1) % modes.length];
            this.sortSongList();
            this.playPreview();
            return;
        }

        // 4. Song List (Click to select)
        // Match rendering: content starts at listInnerX = listX + scrollbarW(28) + 14
        const scrollbarW = 28;
        const listContentX = listX + scrollbarW + 14;
        const listHitMaxX = listX + listW - 10;
        const maxScrollOffset = Math.max(0, this.songList.length - visibleCount);

        if (x > listContentX && x < listHitMaxX && y > listInnerY && y < listInnerY + (itemHeight * visibleCount)) {
            const relativeY = y - listInnerY;
            const clickedIndexOffset = Math.floor(relativeY / itemHeight);

            let visibleStartIndex = this.selectedSongIndex - Math.floor(visibleCount / 2);
            if (visibleStartIndex < 0) visibleStartIndex = 0;
            if (visibleStartIndex > maxScrollOffset) visibleStartIndex = maxScrollOffset;

            if (clickedIndexOffset >= 0 && clickedIndexOffset < visibleCount) {
                const targetIndex = visibleStartIndex + clickedIndexOffset;
                if (targetIndex >= 0 && targetIndex < this.songList.length) {
                    this.selectedSongIndex = targetIndex;
                    this.playPreview();
                    return;
                }
            }
        }
    }

    private handleTouchMove(e: TouchEvent): void {
        e.preventDefault();

        if (this.currentState === GameState.MENU) {
            if (!this.isTouchDown) return; // Prevent phantom scroll from lingering touches

            const touch = e.changedTouches[0];
            const rect = this.canvas.getBoundingClientRect();
            const scaleY = this.canvas.height / rect.height;
            const y = (touch.clientY - rect.top) * scaleY;

            const diffY = y - this.touchStartY;
            // Simple 30px threshold for snappy scrolling that matches finger speed
            const threshold = 30;
            const shift = Math.trunc(diffY / threshold);
            if (shift !== 0) {
                this.selectedSongIndex = (this.selectedSongIndex + shift) % this.songList.length;
                if (this.selectedSongIndex < 0) this.selectedSongIndex += this.songList.length;
                this.touchStartY = y - (diffY % threshold);
                this.playPreview();
            }
            return;
        }

        // Gameplay Slide Logic — block during lead-in
        if (this.preGameTimer > 0) return;
        const currentTimeMs = this.audioEngine.getPreciseTime() * 1000;
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            const newLane = this.getLaneFromTouch(touch.clientX, touch.clientY);
            const oldLane = this.pointerLanes.get(touch.identifier) ?? -1;

            // If lane changed
            if (newLane !== oldLane) {
                if (oldLane !== -1) {
                    this.keyState[oldLane] = false;
                    this.processLaneRelease(oldLane, currentTimeMs);
                }

                // 2. Press New Lane
                if (newLane !== -1) {
                    this.keyState[newLane] = true;
                    this.checkHit(newLane, currentTimeMs);
                }

                // Update tracking
                this.pointerLanes.set(touch.identifier, newLane);
            }
        }
    }

    private handleTouchEnd(e: TouchEvent): void {
        e.preventDefault();
        this.isTouchDown = false;
        const currentTimeMs = this.audioEngine.getPreciseTime() * 1000;
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            const lane = this.pointerLanes.get(touch.identifier);

            if (lane !== undefined && lane !== -1) {
                this.keyState[lane] = false;
                this.processLaneRelease(lane, currentTimeMs);
            }

            this.pointerLanes.delete(touch.identifier);
        }
    }

    // Helper to deduplicate release logic (shared with handleKeyUp)
    // currentTimeMs: pass update() loop's currentTime to ensure consistent time source.
    // If called from an event handler (outside update loop), pass getPreciseTime() * 1000.
    private processLaneRelease(lane: number, currentTimeMs: number): void {
        const heldNote = this.holdingLanes[lane];
        if (heldNote) {
            const endTime = heldNote.time * 1000 + heldNote.durationMs;
            const diff = currentTimeMs - endTime;

            if (Math.abs(diff) <= 200) {
                this.triggerJudgment(lane, 'PERFECT', Math.abs(diff));
                this.scoreManager?.addScore(100);
                heldNote.isProcessed = true;
            } else if (diff < -200) {
                this.triggerJudgment(lane, 'MISS', Math.abs(diff));
                heldNote.isProcessed = true;
            } else {
                this.triggerJudgment(lane, 'MISS', Math.abs(diff));
                heldNote.isProcessed = true;
            }

            heldNote.isHolding = false;
            this.holdingLanes[lane] = null;
        }
    }

    private getLaneFromTouch(x: number, y: number): number {
        // Perspective-based Touch Zones
        // We match visual lanes at the bottom (hit line) area

        // Correct for scaled canvas on mobile
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        const canvasX = (x - rect.left) * scaleX;
        const canvasY = (y - rect.top) * scaleY;

        const totalWidthBottom = this.laneBottomWidth * this.laneCount;
        const startX = (this.canvas.width - totalWidthBottom) / 2;

        if (canvasY < this.canvas.height * 0.5) return -1; // Ignore top half

        // Map canvasX to lane index based on bottom width (widest point)
        if (canvasX < startX || canvasX > startX + totalWidthBottom) return -1;

        const lane = Math.floor((canvasX - startX) / this.laneBottomWidth);
        return Math.max(0, Math.min(lane, this.laneCount - 1));
    }

    // Input States
    private keyState: boolean[] = [false, false, false, false, false, false];

    private handleKeyDown(event: KeyboardEvent): void {
        if (this.currentState === GameState.GAMEOVER) {
            if (event.code === 'Enter' || event.code === 'Space') {
                this.handleGameOverPointer(this.canvas.width / 2, this.canvas.height * 0.62); // Retry
            } else if (event.code === 'Escape' || event.code === 'Backspace') {
                this.handleGameOverPointer(this.canvas.width / 2, this.canvas.height * 0.77); // Select
            }
            return;
        }

        if (this.currentState === GameState.MENU) {
            if (this.isTestMode && this.shouldAutoStart) {
                // Test Mode: Space or Enter starts the game (desktop equivalent of TAP TO START)
                if (event.code === 'Space' || event.code === 'Enter') {
                    this.shouldAutoStart = false;
                    this.start();
                }
                return;
            }
            this.handleMenuInput(event);
            return;
        }

        if (this.currentState === GameState.RESULT) {
            if (event.code === 'Enter' || event.code === 'Space' || event.code === 'Escape') {
                if (this.isTransitioning) return;

                this.startTransition(() => {
                    if (this.isTestMode) {
                        this.returnToEditor();
                    } else {
                        this.currentState = GameState.MENU;
                        this.scoreManager?.reset();
                        this.playPreview();
                    }
                });
            }
            return;
        }

        if (event.repeat) return; // Prevent hold trigger
        if (this.preGameTimer > 0) return; // Block hits during lead-in

        const lane = this.getLaneFromKey(event.code);
        if (lane !== -1) {
            this.keyState[lane] = true;
            // INPUT LATENCY COMPENSATION for keyboard:
            // event.timeStamp is when the key was physically pressed.
            const handlerTime = performance.now();
            const inputDelay = Math.max(0, Math.min(handlerTime - event.timeStamp, 100));
            const currentTimeMs = this.audioEngine.getPreciseTime() * 1000 - inputDelay;
            this.checkHit(lane, currentTimeMs);
        }
    }

    private handleKeyUp(event: KeyboardEvent): void {
        const lane = this.getLaneFromKey(event.code);
        if (lane !== -1) {
            this.keyState[lane] = false;
            this.processLaneRelease(lane, this.audioEngine.getPreciseTime() * 1000);
        }
    }

    private getLaneFromKey(code: string): number {
        if (this.keyMode === 4) {
            const keyMap4: { [key: string]: number } = {
                'KeyD': 1, 'KeyF': 2, 'KeyJ': 3, 'KeyK': 4
            };
            return keyMap4.hasOwnProperty(code) ? keyMap4[code] : -1;
        }

        const keyMap6: { [key: string]: number } = {
            'KeyS': 0, 'KeyD': 1, 'KeyF': 2,
            'KeyJ': 3, 'KeyK': 4, 'KeyL': 5
        };
        return keyMap6.hasOwnProperty(code) ? keyMap6[code] : -1;
    }

    // Judgement State
    private lastJudgment: { text: string, color: string, time: number } | null = null;
    private readonly JUDGMENT_DURATION = 500; // ms

    private checkHit(lane: number, currentTime: number): VisualNote | null {
        // currentTime (ms): the precise game time at the moment of input.
        // Already compensated for event.timeStamp delay by the caller.
        //
        // OUTPUT LATENCY SHIFT:
        // The player hears the audio outputLatencyMs AFTER the game time.
        // So when they tap "on the beat" they are actually tapping outputLatencyMs late.
        // We shift currentTime forward by outputLatencyMs to compensate.
        const adjustedTime = currentTime - this.outputLatencyMs;

        // JUDGMENT WINDOWS (ms from note center, after latency compensation):
        //   PERFECT: ±70ms  — excellent timing (Relaxed from 50)
        //   GREAT:   ±120ms — good timing (Relaxed from 100)
        //   GOOD:    ±160ms — acceptable timing (Relaxed from 150)
        //   MISS:    >160ms — too late or too early
        const PERFECT_WINDOW = 70;
        const GREAT_WINDOW = 120;
        const GOOD_WINDOW = 160;
        const hitWindow = 170;

        // Optimization: Windowed Search (O(1) average)
        const candidates: VisualNote[] = [];

        // We start searching a bit before the known "miss" index to be safe against slight timing jitter
        // or out-of-order lane processing, but generally lastMissCheckIndex is a good lower bound 
        // for "active" notes. To be extra safe, we can clamp it.
        // However, for hit detection, we might want to hit a note that is slightly "past" the miss line 
        // if we are lenient (though updateMissedNotes should have caught it).
        // Let's iterate forward from lastMissCheckIndex.

        for (let i = this.lastMissCheckIndex; i < this.visualNotes.length; i++) {
            const n = this.visualNotes[i];

            // 1. If note is already processed, skip
            if (n.isProcessed && !n.isHolding) continue;

            const noteTime = n.time * 1000;

            // 2. Window Exit Condition: If note is too far in the future (> window), STOP.
            // Notes are sorted by time, so no need to check further.
            if (noteTime > currentTime + hitWindow) break;

            // 3. Check Lane & Time Window
            if (n.lane === lane && Math.abs(noteTime - currentTime) < hitWindow) {
                candidates.push(n);
            }
        }

        if (candidates.length > 0) {
            // Find closest note (accuracy)
            candidates.sort((a, b) => Math.abs(a.time * 1000 - adjustedTime) - Math.abs(b.time * 1000 - adjustedTime));
            const targetNote = candidates[0];

            const diff = Math.abs(targetNote.time * 1000 - adjustedTime);
            let judgmentText = '';
            let judgmentColor = '';
            let score = 0;

            if (diff < PERFECT_WINDOW) {
                judgmentText = 'PERFECT';
                judgmentColor = '#00ffff'; // Cyan
                score = 100;
            } else if (diff < GREAT_WINDOW) {
                judgmentText = 'GREAT';
                judgmentColor = '#00ff00'; // Green
                score = 80;
            } else if (diff <= GOOD_WINDOW) {
                judgmentText = 'GOOD';
                judgmentColor = '#ffff00'; // Yellow
                score = 50;
            } else {
                return null;
            }

            // Apply Score & Effects
            if (targetNote.isHold) {
                // Long Note Head: Combo Only, No Stats
                if (this.scoreManager) this.scoreManager.increaseCombo(1);
                this.showJudgment(judgmentText, judgmentColor);
                this.holdingLanes[targetNote.lane] = targetNote;
                targetNote.isHolding = true;
            } else {
                // Single Note: Full Stats
                if (this.scoreManager) this.scoreManager.addHit(score, judgmentText as any);
                this.showJudgment(judgmentText, judgmentColor);
                targetNote.isProcessed = true;
            }

            this.triggerExplosion(targetNote.lane, currentTime);

            // Shatter Effect (Use Note Color, not Judgment Color)
            const laneColor = this.COLORS.LANES[targetNote.lane] ? this.COLORS.LANES[targetNote.lane][1] : '#ffffff';
            this.createShatterEffect(
                this.getPerspectiveX(targetNote.lane, this.hitLineY) + this.getPerspectiveWidth(this.hitLineY) / 2,
                this.hitLineY,
                laneColor
            );

            return targetNote;
        } else {
            return null;
        }
    }

    public triggerMiss(note: VisualNote, noDamage: boolean = false): void {
        if (note.isProcessed) return;
        note.isProcessed = true;
        note.isHolding = false;

        if (this.scoreManager && !noDamage) {
            this.scoreManager.addHit(0, 'MISS');
        }

        this.showJudgment('MISS', '#ff0000');
    }

    private showJudgment(text: string, color: string): void {
        this.lastJudgment = {
            text: text,
            color: color,
            time: this.cachedNow || performance.now()
        };
    }

    private triggerJudgment(lane: number, judgment: string, _diff: number): void {
        let score = 0;
        let color = '#fff';
        const theme = ThemeManager.getInstance().getCurrentTheme();

        switch (judgment) {
            case 'PERFECT':
                score = 100;
                color = theme.particleColor;
                break;
            case 'GREAT':
                score = 80;
                color = theme.color2;
                break;
            case 'GOOD':
                score = 50;
                color = theme.color3;
                break;
            case 'MISS':
                score = 0;
                color = '#ff3333';
                break;
        }

        if (this.scoreManager) {
            this.scoreManager.addHit(score, judgment as any);
        }
        this.showJudgment(judgment, color);

        if (judgment !== 'MISS') {
            this.triggerExplosion(lane, 0);
        }
    }

    // --- In Update Loop ---
    // We need to check for missed notes
    private updateMissedNotes(currentTime: number): void {
        const missThreshold = 160; // If note passes by 160ms (GOOD window end), it's a miss
        let missCountThisFrame = 0;

        // Optimization: Start from the last checked index (Windowing)
        // We iterate until we find a note that is in the future (beyond miss threshold)
        for (let i = this.lastMissCheckIndex; i < this.visualNotes.length; i++) {
            const note = this.visualNotes[i];

            // 1. If this note is already processed (Hit or Hold released), we can advance the start index
            // ONLY if it is the note at the current cursor. this ensures the cursor always points
            // to the first unprocessed note.
            if ((note.isProcessed && !note.isHolding)) {
                if (i === this.lastMissCheckIndex) {
                    this.lastMissCheckIndex++;
                }
                continue;
            }

            const noteTimeMs = note.time * 1000;

            // 2. Exit Condition: If note is in the future relative to miss line, STOP.
            // Notes are sorted, so we don't need to check the rest.
            if (noteTimeMs > currentTime + missThreshold) {
                break;
            }

            // 3. Process Miss logic if time condition met
            // currentTime already has latency compensated in the update loop
            if (currentTime > noteTimeMs + missThreshold) {
                // Double check processed state (though loop header handles it, the continue above handles processed ones)
                if (!note.isProcessed && !note.isHolding) {
                    // Safety: Limit number of misses per frame to prevent instant Game Over 
                    // on huge clock jumps (Sync Catch-up).
                    if (missCountThisFrame < 10) {
                        this.triggerMiss(note, this.lagSpikeInvincibility > 0);
                        missCountThisFrame++;
                    } else {
                        // Silent Process: Just mark as processed without damaging further
                        // This prevents the "Storm of Death" while keeping the chart clean.
                        note.isProcessed = true;
                    }
                }
            }
        }
    }

    // --- In Render Method ---
    private renderJudgment(ctx: CanvasRenderingContext2D, width: number, height: number): void {
        if (!this.lastJudgment) return;

        const now = this.cachedNow || performance.now();
        const age = now - this.lastJudgment.time;

        if (age > this.JUDGMENT_DURATION) {
            this.lastJudgment = null;
            return;
        }

        const theme = ThemeManager.getInstance().getCurrentTheme();
        const alpha = 1 - (age / this.JUDGMENT_DURATION);

        // Elastic "Bounce-Pop" Scale
        let scale = 1.0;
        const entryTime = 180;
        if (age < entryTime) {
            const t = age / entryTime;
            scale = 1.0 + Math.sin(t * Math.PI) * 0.35;
        }

        ctx.save();
        ctx.translate(width / 2, height * 0.42);
        ctx.scale(scale, scale);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const baseColor = this.lastJudgment.color;
        const text = this.lastJudgment.text;

        ctx.globalAlpha = alpha;

        // --- THEME-SPECIFIC CLEAN RENDERING ---
        switch (theme.id) {
            case 'cyber-neon':
                // Neon Glitch
                ctx.font = '900 italic 34px "Orbitron", sans-serif';
                ctx.shadowColor = baseColor;
                ctx.shadowBlur = 15;
                ctx.strokeStyle = baseColor;
                ctx.lineWidth = 4;
                ctx.strokeText(text, 0, 0);

                if (Math.random() > 0.85) {
                    ctx.fillStyle = '#ff007b';
                    ctx.fillText(text, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 4);
                }

                ctx.shadowBlur = 0;
                ctx.fillStyle = '#ffffff';
                ctx.fillText(text, 0, 0);
                break;

            case 'matrix-grid':
                // Digital Terminal
                ctx.font = '900 32px "Courier New", monospace';
                ctx.fillStyle = baseColor;
                ctx.shadowColor = baseColor;
                ctx.shadowBlur = 10;
                ctx.fillText(text, 0, 0);

                ctx.globalAlpha = alpha * 0.3;
                ctx.fillStyle = '#ffffff';
                for (let i = -16; i < 16; i += 4) {
                    ctx.fillRect(-80, i, 160, 1);
                }
                break;

            case 'deep-space':
                // Ethereal Starfield
                ctx.font = '200 italic 36px "Orbitron", sans-serif';
                ctx.letterSpacing = '10px';
                ctx.shadowColor = baseColor;
                ctx.shadowBlur = 25;
                ctx.fillStyle = '#ffffff';
                ctx.fillText(text, 0, 0);

                ctx.shadowBlur = 0;
                ctx.strokeStyle = 'rgba(255,255,255,0.5)';
                ctx.lineWidth = 1;
                ctx.strokeText(text, 0, 0);
                break;

            case 'vaporwave':
                // Dreamy Duotone
                ctx.font = '900 italic 36px "Orbitron", sans-serif';
                ctx.fillStyle = '#ff00ff';
                ctx.fillText(text, -3, -1);
                ctx.fillStyle = '#00ffff';
                ctx.fillText(text, 3, 1);
                ctx.fillStyle = '#ffffff';
                ctx.fillText(text, 0, 0);
                break;

            default:
                // Premium Sharp
                ctx.font = '900 italic 36px "Orbitron", sans-serif';
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 6;
                ctx.strokeText(text, 0, 0);

                const grad = ctx.createLinearGradient(0, -15, 0, 15);
                grad.addColorStop(0, '#ffffff');
                grad.addColorStop(0.5, baseColor);
                grad.addColorStop(1, this.hexToRgba(baseColor, 0.7));
                ctx.fillStyle = grad;
                ctx.fillText(text, 0, 0);
                break;
        }

        ctx.restore();
    }


    public async load(): Promise<void> {
        // Prevent concurrent identical loads
        if (this.loadingPromise) return this.loadingPromise;

        this.loadingPromise = (async () => {
            console.log("[RhythmGame] Loading assets...");

            // CRITICAL FIX: Prevent Data Leak between songs.
            // Clear any previous beatmap data or transition data so the new song doesn't use old configs.
            this.beatmapData = null;
            if (!this.isTestMode) {
                this.transitionData = null;
            }

            // CRITICAL: Reset time state before init.
            // CoreAudioEngine is a singleton — if EditorGame was playing (e.g. at t=45s),
            // lastReportedTime stays at 45s. Without this reset, getPreciseTime() returns 45s
            // at game start, causing all notes (starting at t=0) to be MISS'd immediately.
            this.audioEngine.resetTimeState();
            await this.audioEngine.init(ASSET_PATHS.AUDIO.SOUNDFONTS.DEFAULT);

            // Test Mode: Load from transition buffer instead of URL
            if (this.isTestMode && this.transitionData) {
                console.log("[RhythmGame] Test Mode: Loading MIDI from transition buffer.");
                const parser = new MidiParser();
                this.midiData = await parser.parse(this.transitionData.midiBuffer);
                await this.audioEngine.loadMidi(this.transitionData.midiBuffer);
                GameTransition.clear();
                return;
            }

            // Normal Mode: Load from song list URL
            const midiUrl = this.songList[this.selectedSongIndex].url;

            // 1. Check Cache for MIDI
            if (this.cachedMidi && this.cachedMidi.url === midiUrl) {
                console.log("[RhythmGame] Using cached MIDI data.");
                this.midiData = this.cachedMidi.parsed;
                await this.audioEngine.loadMidi(this.cachedMidi.buffer);
            } else {
                const midiRes = await fetch(midiUrl);
                const midiBuffer = await midiRes.arrayBuffer();

                const parser = new MidiParser();
                this.midiData = await parser.parse(midiBuffer);
                await this.audioEngine.loadMidi(midiBuffer);

                // Update Cache
                this.cachedMidi = { url: midiUrl, buffer: midiBuffer, parsed: this.midiData };
            }

            // 2. Beatmap Check
            const midiName = midiUrl.split('/').pop()?.replace(/\.mid$/i, '') || 'test';

            // Check LocalStorage First (User Settings Override)
            const safeName = midiName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const localConfigStr = localStorage.getItem(`beatmap_config_${safeName}`);

            if (localConfigStr) {
                try {
                    this.beatmapData = JSON.parse(localConfigStr);
                    console.log(`[RhythmGame] Loaded beatmap config from LocalStorage for ${midiName}`);
                } catch (e) {
                    console.warn(`[RhythmGame] Failed to parse local config for ${midiName}`, e);
                    this.beatmapData = null;
                }
            }

            // If no local override, check server
            if (!this.beatmapData) {
                const beatmapUrl = `${ASSET_PATHS.DATA.BEATMAPS}${midiName}.json`;
                try {
                    console.log(`[RhythmGame] Checking for beatmap at: ${beatmapUrl}`);
                    const res = await fetch(beatmapUrl);
                    const contentType = res.headers.get("content-type");

                    if (res.ok && contentType && contentType.includes("application/json")) {
                        this.beatmapData = await res.json();
                        console.log("[RhythmGame] Custom beatmap found and loaded from server.");
                    } else {
                        this.beatmapData = null;
                    }
                } catch (e) {
                    this.beatmapData = null;
                }
            }
        })();

        try {
            await this.loadingPromise;
        } finally {
            this.loadingPromise = null;
        }
    }

    public create(): void {
        console.log("[RhythmGame] Creating Game Objects...");

        if (this.midiData) {
            let forcedChannels: number[] | null = null;
            let measureConfig: [number, number][] | null = null;

            if (this.transitionData?.settings?.measureConfig) {
                measureConfig = this.transitionData.settings.measureConfig;
                console.log(`[RhythmGame] Using Transition MeasureConfig`);
            } else if (this.transitionData?.forcedChannels) {
                forcedChannels = this.transitionData.forcedChannels;
            } else if (this.beatmapData?.version === "1.2" && this.beatmapData?.measureConfig) {
                measureConfig = this.beatmapData.measureConfig;
                console.log(`[RhythmGame] Using Beatmap MeasureConfig`);
            } else if (this.beatmapData?.channelConfig) {
                console.debug(`[RhythmGame] Old beatmap channelConfig ignored. Using Smart Analysis.`);
            } else if (this.beatmapData?.gameChannels && this.beatmapData.gameChannels.length > 0) {
                console.debug(`[RhythmGame] Old beatmap v1.0 gameChannels ignored. Using Smart Analysis.`);
                // forcedChannels remains null, forcing NoteFactory to use MelodyAnalyzer
            }

            let difficulty = this.transitionData?.settings?.difficulty;

            // If normal mode and no override applied, use the internal menu's selected difficulty
            if (!this.isTestMode && !difficulty) {
                difficulty = this.difficultyOptions[this.selectedDifficultyIndex];
            }

            // Fallback
            if (!difficulty) difficulty = 'NORMAL';

            // Generate Visual Notes through NoteFactory (Smart Charting inside if forcedChannels is null)
            this.visualNotes = NoteFactory.createNotes(this.midiData, this.keyMode, forcedChannels, difficulty, measureConfig);

            console.log(`[RhythmGame] Created ${this.visualNotes.length} notes on ${difficulty} difficulty.`);
            if (this.scoreManager) {
                this.scoreManager.setTotalNotes(this.visualNotes.length);
            }

            // Test Mode: Apply audio settings, then wait for first touch (same as normal mode)
            if (this.isTestMode && this.transitionData?.settings) {
                const soloChannels = this.transitionData.settings.soloChannels;
                const hasSolo = soloChannels && soloChannels.size > 0;

                if (hasSolo) {
                    for (let ch = 0; ch < 16; ch++) {
                        this.audioEngine.setChannelMute(ch, !soloChannels.has(ch));
                    }
                    console.log(`[RhythmGame] Test Mode: Applied Solo for Channels: ${Array.from(soloChannels as Set<number>).map((c: number) => c + 1).join(', ')}`);
                } else if (this.transitionData.settings.mutedChannels) {
                    (this.transitionData.settings.mutedChannels as Set<number>).forEach((ch: number) => {
                        this.audioEngine.setChannelMute(ch, true);
                    });
                    console.log(`[RhythmGame] Test Mode: Applied Mute for Channels: ${Array.from(this.transitionData.settings.mutedChannels as Set<number>).map((c: number) => c + 1).join(', ')}`);
                }

                // Stay in MENU state — wait for first touch to unlock audio (same as normal mode).
                // This prevents the resume() call during gameplay from corrupting the preciseTime anchor.
                this.shouldAutoStart = true;
                this.currentState = GameState.MENU;
                console.log("[RhythmGame] Test Mode: Waiting for first touch to start (audio unlock required).");
            }

            // Only start if explicitly requested (e.g. from Menu — NOT test mode, which waits for touch)
            if (this.midiData && this.shouldAutoStart && !this.isTestMode) {
                this.shouldAutoStart = false; // Reset

                // MAIN MODE SYNC FIX:
                // SpessaSynth's AudioWorklet takes a few milliseconds to process the MIDI 
                // asynchronously after `loadMidi()`. If we `start()` and `seek(0)` instantly,
                // the worklet hasn't initialized the lead-in/silence skipping, returning 0
                // for `effectiveStartTime`. We wait 150ms before starting to guarantee sync.
                console.log("[RhythmGame] Delaying start() by 150ms to allow AudioWorklet init...");
                setTimeout(() => {
                    this.start();
                }, 150);
            }
        }

        // --- Post-Creation Input Handling ---
        // Register listeners ONLY after assets (SoundFont, RenderCache) and game objects are ready.
        // This prevents early user gestures from triggering "Sequencer not initialized" errors.
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
        this.canvas.addEventListener('touchstart', this.handleTouchStart, { passive: false });
        this.canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
        this.canvas.addEventListener('touchend', this.handleTouchEnd, { passive: false });
        this.canvas.addEventListener('mousedown', this.handleMouseDown);
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        this.canvas.addEventListener('mouseup', this.handleMouseUp);
        this.canvas.addEventListener('mouseleave', this.handleMouseUp);
        this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });

        this.renderHUD();

        // Auto-play the first song preview when entering Menu Mode manually
        if (this.currentState === GameState.MENU && !this.isTestMode) {
            this.playPreview();
        }
    }

    private start() {
        console.log("[RhythmGame] start() called.");
        // 1. Prepare Audio (context is already unlocked from menu touch)
        this.audioEngine.stop();
        this.audioEngine.seek(0);
        console.log(`[RhythmGame] Audio Context state: ${this.audioEngine.isAudioUnlocked() ? 'running' : 'suspended'}`);

        // 2. Reset Game State
        this.scoreManager?.reset();
        this.lastCombo = 0;
        this.comboAnim = 0;
        this.endGameTimer = 0;

        // Always start the target at 0 so we don't skip intro music and avoid seek de-sync
        this.targetStartTime = 0;

        // DRY SEEK: Detect if the synthesizer will skip leading silence (common in SpessaSynth)
        // By seeking now, we can see where the playhead ACTUALLY lands.
        this.audioEngine.seek(this.targetStartTime);
        this.effectiveStartTime = this.audioEngine.currentTime;
        console.log(`[RhythmGame] Dry Seek: Target ${this.targetStartTime}s -> Effective ${this.effectiveStartTime}s`);

        // Pre-calculate latency early
        this.outputLatencyMs = this.audioEngine.getOutputLatency() * 1000;

        // Dynamic Lead-in: Start exactly when notes appear at horizon (plus tiny buffer)
        const approachTime = 2000 / this.scrollSpeed;
        this.preGameTimer = approachTime + 500; // 0.5s ready time -> then notes appear

        this.isAudioStarted = false;
        this.lastNoteIndex = 0;
        this.lastRenderTime = 0;
        this.muteEnforceCounter = 0;
        this.lastMissCheckIndex = 0;

        // 3. Set state to PLAYING (countdown handled in update loop)
        this.currentState = GameState.PLAYING;
        console.log(`[RhythmGame] Game Started. PreGameTimer: ${this.preGameTimer.toFixed(0)}ms`);
    }

    public update(delta: number): void {
        this.cachedNow = performance.now();
        const now = this.cachedNow;

        // --- 0. Handle System Transitions ---
        if (this.isTransitioning) {
            const step = delta * 0.0025; // ~400ms duration
            if (this.transitionDirection === 'out') {
                this.transitionAlpha += step;
                if (this.transitionAlpha >= 1.0) {
                    this.transitionAlpha = 1.0;
                    this.transitionDirection = 'in';
                    if (this.onTransitionMidpoint) {
                        this.onTransitionMidpoint();
                        this.onTransitionMidpoint = null;
                    }
                }
            } else {
                this.transitionAlpha -= step;
                if (this.transitionAlpha <= 0) {
                    this.transitionAlpha = 0;
                    this.isTransitioning = false;
                }
            }
        }

        // Lag Spike Protection: If delta > 200ms, start 500ms invincibility
        if (delta > 200) {
            this.lagSpikeInvincibility = 500;
        } else if (this.lagSpikeInvincibility > 0) {
            this.lagSpikeInvincibility -= delta;
        }

        // REMOVED: delta capping (delta > 100 ? 16)
        // Capping delta causes "Cumulative Lag" where logic falls behind audio permanently.
        // We now rely on 'missCountThisFrame' cap and lagSpikeInvincibility for safety.

        // FPS Calculation (counted here, displayed via main.ts global overlay)
        if (now - this.lastFpsTime >= 1000) {
            this.frameCount = 0;
            this.lastFpsTime = now;
        }
        this.frameCount++;

        if (this.currentState === GameState.MENU) {
            this.menuAnimationTimer += delta * 0.001; // Use delta for smooth animation
            // this.render(0); // Render handled by main loop
            return;
        }

        if (this.currentState === GameState.RESULT) {
            // this.render(0); // Render handled by main loop
            // Handle Result Input elsewhere
            return;
        }

        if (this.currentState !== GameState.PLAYING) return;

        // BRUTE FORCE PROTECTION: Enforce Mute State Check (Same as Editor)
        // Throttle to every 15 frames (~4x/sec at 60fps) to reduce mobile overhead
        if (this.isTestMode && this.isAudioStarted) {
            this.muteEnforceCounter++;
            if (this.muteEnforceCounter >= 15) {
                this.enforceMuteCompliance();
                this.muteEnforceCounter = 0;
            }
        }

        // Time Logic
        let currentTime = 0;
        if (this.preGameTimer > 0) {
            this.preGameTimer -= delta;

            if (this.preGameTimer <= 0) {
                console.log(`[RhythmGame] Lead-in finished. Seeking Audio to target startTime: ${this.targetStartTime.toFixed(3)}s`);
                // Measure output latency NOW (AudioContext must be running at this point)
                this.outputLatencyMs = this.audioEngine.getOutputLatency() * 1000;
                console.log(`[RhythmGame] Output latency: ${this.outputLatencyMs.toFixed(1)}ms`);

                // FORCE AUDIO TO SYNC WITH VISUAL TARGET
                // We seek to the exact time the pregame visual countdown was aiming for.
                // This eliminates unpredictable jump intervals from SpessaSynth silence skipping.
                this.audioEngine.seek(this.targetStartTime);
                this.audioEngine.play();

                const actualStartTime = this.audioEngine.currentTime;
                this.audioEngine.startPreciseTime(actualStartTime);

                this.isAudioStarted = true;
                // Use actualStartTime going forward in case it varied by a microsecond.
                // Apply outputLatencyMs here as well to match the subsequent loop frames.
                currentTime = (actualStartTime * 1000) - this.outputLatencyMs;
            } else {
                // Unified visualTime Formula:
                // Align the countdown to end exactly at (effectiveStartTime - outputLatencyMs).
                // This ensures the visual notes are exactly where the audio will be heard.
                currentTime = (this.effectiveStartTime * 1000 - this.outputLatencyMs) - this.preGameTimer;
            }
        } else if (!this.isAudioStarted) {
            // Safety fallback if preGameTimer was 0 or skipped
            console.log("[RhythmGame] Starting Audio immediately (No lead-in).");
            this.outputLatencyMs = this.audioEngine.getOutputLatency() * 1000;
            console.log(`[RhythmGame] Output latency: ${this.outputLatencyMs.toFixed(1)}ms`);

            this.audioEngine.seek(0);
            this.audioEngine.play();

            // FIX: Sync here as well
            const actualStartTime = this.audioEngine.currentTime;
            this.audioEngine.startPreciseTime(actualStartTime);

            this.isAudioStarted = true;
            currentTime = (actualStartTime * 1000) - this.outputLatencyMs;
        } else {
            // Offset by outputLatencyMs so visual/miss logic aligns with what user hears
            currentTime = (this.audioEngine.getPreciseTime() * 1000) - this.outputLatencyMs;

            // Mobile Anti-Reversal: Never let game time go backwards
            if (currentTime < this.lastRenderTime - 5) {
                // Time reversed — hold at previous value (5ms tolerance for rounding)
                currentTime = this.lastRenderTime;
            }
            this.lastRenderTime = currentTime;
        }

        // Long Note Tick Scoring & Logic
        this.holdingLanes.forEach((note, lane) => {
            if (note) {
                const endTime = note.time * 1000 + note.durationMs;

                // 1. Check for Miss (Overholding / Late Release)
                // If current time passes end time + window and still holding -> Miss
                if (currentTime > endTime + 200) {
                    this.triggerJudgment(lane, 'MISS', currentTime - endTime);
                    note.isHolding = false;
                    note.isProcessed = true;
                    this.holdingLanes[lane] = null;
                    return;
                }

                // 2. Visual Update
                note.isHolding = true;

                // 3. Tick Combo (6 Combo / Sec)
                // Initialize accumulator if undefined
                if (typeof note.accumulatedHoldTime === 'undefined') note.accumulatedHoldTime = 0;

                note.accumulatedHoldTime += delta;
                const tickInterval = 166; // approx 166ms = 6 combo/sec

                if (note.accumulatedHoldTime >= tickInterval) {
                    if (this.scoreManager) {
                        this.scoreManager.increaseCombo(1);
                        this.scoreManager.addScore(10);
                    }
                    note.accumulatedHoldTime -= tickInterval;
                    this.comboAnim = 0.5;
                }

                // Restored continuous hold particles for all devices
                if (this.frameCount % 4 === 0) { // Slightly increased density (was 8)
                    const laneX = this.getPerspectiveX(lane, this.hitLineY) + this.getPerspectiveWidth(this.hitLineY) / 2;
                    const centerY = this.hitLineY + (this.laneBottomWidth * 0.2);
                    const color = this.COLORS.LANES[lane] ? this.COLORS.LANES[lane][1] : '#ffffff';
                    this.createShatterEffect(laneX, centerY, color, true);
                }
            }
        });

        // Combo Animation Decay
        if (this.comboAnim > 0) {
            this.comboAnim -= delta * 0.005; // Quick decay
            if (this.comboAnim < 0) this.comboAnim = 0;
        }

        if (this.scoreManager) {
            const currentCombo = this.scoreManager.getCombo();
            if (currentCombo > this.lastCombo) {
                this.comboAnim = 1.0; // Trigger Pop
            }
            this.lastCombo = currentCombo;
        }

        // Check for Missed Notes
        this.updateMissedNotes(currentTime);

        // Optimized Explosion Update (Swap-and-Pop)
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const exp = this.explosions[i];
            exp.radius += 4; // Expand faster
            exp.alpha -= 0.08; // Fade faster for quick "pop"


            if (exp.alpha <= 0) {
                // Replace current with last and pop
                if (i < this.explosions.length - 1) {
                    this.explosions[i] = this.explosions[this.explosions.length - 1];
                }
                this.explosions.pop();
            }
        }

        // Optimized Particle Update (Swap-and-Pop)
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.9; // Friction
            p.rotation += p.rotationSpeed;
            p.vy += 0.2; // Gravity
            p.alpha -= 0.04; // Fade

            if (p.alpha <= 0) {
                // Replace current with last and pop
                if (i < this.particles.length - 1) {
                    this.particles[i] = this.particles[this.particles.length - 1];
                }
                this.particles.pop();
            }
        }

        // this.render(currentTime); // Render is now called by main loop separate from update
        // NOTE: Second particle loop was removed here — it was a copy-paste duplicate causing double physics updates.

        // Check Game Over (with 3s protection + 2s lead-in = 5s total safety)
        if (this.scoreManager?.isDead()) {
            // Safety: No HP Game Over and during lead-in or the first 3 seconds of the song
            // This prevents premature endings due to sync jumps.
            if (this.isAudioStarted && currentTime > 3000) {
                this.finishGame("HP Depleted (Health <= 0)");
                return;
            }
        }

        if (this.midiData) {
            const durationMs = this.midiData.duration * 1000;

            // Safety: Only allow natural end if the audio has been playing for a bit
            // and the duration is reasonable (> 2s)
            if (this.isAudioStarted && currentTime >= durationMs - 100 && durationMs > 2000) {
                this.endGameTimer += delta;
            }

            if (this.endGameTimer > 2000) {
                this.finishGame("Song Completed Normally");
                return;
            }
        }
    }

    private triggerExplosion(lane: number, _time: number): void {
        const x = this.getPerspectiveX(lane, this.hitLineY) + this.getPerspectiveWidth(this.hitLineY) / 2;
        // Move Y slightly down so it overlaps the center of the drawn receptor diamond
        const y = this.hitLineY + (this.laneBottomWidth * 0.2);
        const theme = ThemeManager.getInstance().getCurrentTheme();
        const colorSet = this.COLORS.LANES[lane] || this.COLORS.LANES[0];

        // Explode color should be a mix of lane color and theme particle color
        const explosionColor = this.hexToRgba(colorSet[1], 0.8);

        this.explosions.push({
            x: x,
            y: y,
            radius: 40,
            alpha: 1.0,
            color: explosionColor
        });

        // Add extra theme-specific decorative particles
        const particleColor = theme.particleColor;
        this.createShatterEffect(x, y, particleColor, false);
    }

    private finishGame(reason: string = "Unknown"): void {
        // Prevent double finish OR overlapping transition
        if (this.currentState === GameState.RESULT || this.currentState === GameState.GAMEOVER || this.isTransitioning) return;

        const isGameOver = reason.includes("HP Depleted");
        const style = isGameOver ? 'glitch' : 'fade';
        const targetState = isGameOver ? GameState.GAMEOVER : GameState.RESULT;

        this.startTransition(() => {
            this.currentState = targetState;
            this.audioEngine.stop();

            // Save High Score (Only if NOT in Test Mode/Death)
            if (!isGameOver && this.scoreManager && !this.isTestMode) {
                const currentSong = this.songList[this.selectedSongIndex];
                const isNewRecord = this.scoreManager.saveHighScore(currentSong.url);
                if (isNewRecord) {
                    console.log("[RhythmGame] New High Score Saved!");
                }
            }
        }, style);

        console.log(`[RhythmGame] Finishing. Reason: ${reason}`);

        if (this.isTestMode) {
            // Simple timeout for test mode
            setTimeout(() => {
                this.returnToEditor();
            }, 3000);
        }
    }

    private startTransition(midpointCallback: () => void, style: 'fade' | 'glitch' = 'fade'): void {
        this.isTransitioning = true;
        this.transitionAlpha = 0;
        this.transitionDirection = 'out';
        this.transitionStyle = style;
        this.onTransitionMidpoint = midpointCallback;
    }

    private returnToEditor(): void {
        this.audioEngine.stop();
        if (this.previewTimeout) clearTimeout(this.previewTimeout);

        if (this.visualNotes.length > 0 && this.transitionData?.midiBuffer) {
            GameTransition.set({
                ...this.transitionData,
                source: 'rhythm'
            });
        }

        window.dispatchEvent(new CustomEvent('switch-game', {
            detail: { targetMode: 'editor' }
        }));
    }

    private returnToMainMenu(): void {
        console.log("[RhythmGame] Returning to Main Menu...");
        if (this.previewTimeout) clearTimeout(this.previewTimeout);
        this.currentPreviewId++; // Invalidate any pending background previews
        this.audioEngine.stop();

        // CRITICAL FIX: Ensure clean state when returning to menu. 
        // Prevents getting stuck in 'Test Mode' visually or logically.
        this.isTestMode = false;
        this.beatmapData = null;
        this.transitionData = null;
        GameTransition.clear();

        window.dispatchEvent(new CustomEvent('switch-game', {
            detail: { targetMode: 'menu' }
        }));
    }

    private enforceMuteCompliance(): void {
        if (!this.transitionData?.settings) return;

        const soloChannels = this.transitionData.settings.soloChannels;
        const mutedChannels = this.transitionData.settings.mutedChannels;
        const hasSolo = soloChannels && soloChannels.size > 0;

        for (let ch = 0; ch < 16; ch++) {
            let isAudible = false;
            if (hasSolo) {
                isAudible = soloChannels.has(ch);
            } else {
                isAudible = !mutedChannels?.has(ch);
            }

            if (!isAudible) {
                // FORCE SILENCE via same mechanism as editor
                this.audioEngine.overrideChannelVolume(ch, 0);
            }
        }
    }

    public render(): void {
        const rawAudioTime = this.audioEngine.getPreciseTime() * 1000;

        // Delay visual rendering by outputLatencyMs so note reaches bottom exactly when audio hits speaker
        // Use the raw actual game time (without lead-in override yet)
        let currentTime = rawAudioTime - this.outputLatencyMs;

        if (this.preGameTimer > 0) {
            // UNIFIED SYNC: Matches update() loop's lead-in calculation exactly.
            // (Target start point - latency offset) minus remaining countdown.
            currentTime = (this.effectiveStartTime * 1000 - this.outputLatencyMs) - this.preGameTimer;
        }
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;

        // 0. Mobile Orientation Check (Global)
        if (height > width) {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, width, height);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 24px "Orbitron"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText("PLEASE ROTATE YOUR DEVICE", width / 2, height / 2);
            return;
        }

        let _p0 = 0, _p1 = 0, _p2 = 0, _p3 = 0, _p4 = 0;

        if (this.currentState === GameState.MENU) {
            this.renderMenu();
        } else if (this.currentState === GameState.RESULT) {
            this.renderResult();
        } else if (this.currentState === GameState.GAMEOVER) {
            this.renderGameOver();
        } else {
            // Gameplay Rendering Logic
            _p0 = performance.now();
            ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.renderHighway();
            _p1 = performance.now();
            this.holdingLanes.forEach((note, lane) => {
                if (note) this.drawLaneBeam(lane);
            });
            this.renderHitZone(currentTime);
            _p2 = performance.now();
            this.renderNotes(currentTime);
            _p3 = performance.now();
            this.renderExplosions();
            _p4 = performance.now();
            this.renderParticles(ctx);
            this.renderHUD();
        }
        const _p5 = performance.now();

        // 7. Transition Overlay
        if (this.isTransitioning || this.transitionAlpha > 0) {
            if (this.transitionStyle === 'glitch') {
                this.renderGlitchTransition(ctx, width, height, this.transitionAlpha);
            } else {
                ctx.fillStyle = `rgba(10, 0, 20, ${this.transitionAlpha})`;
                ctx.fillRect(0, 0, width, height);
            }
        }

        // === RENDER PROFILE (exposed to main.ts profiler) ===
        if (this.currentState === GameState.PLAYING) {
            (this as any)._lastRenderProfile =
                `Hwy:${(_p1 - _p0).toFixed(1)} Hit:${(_p2 - _p1).toFixed(1)} ` +
                `Notes:${(_p3 - _p2).toFixed(1)} Exp:${(_p4 - _p3).toFixed(1)} ` +
                `HUD:${(_p5 - _p4).toFixed(1)} Total:${(_p5 - _p0).toFixed(1)}ms`;
        }
    }

    private getPerspectiveX(laneIndex: number, y: number): number {
        const progress = (y - this.horizonY) / (this.bottomY - this.horizonY);
        const totalWidthAtY = this.laneTopWidth * this.laneCount * (1 - progress) +
            this.laneBottomWidth * this.laneCount * progress;
        const laneWidthAtY = totalWidthAtY / this.laneCount;
        const centerX = this.canvas.width / 2;
        const startX = centerX - (totalWidthAtY / 2);
        return startX + (laneIndex * laneWidthAtY);
    }

    private getPerspectiveWidth(y: number): number {
        const progress = (y - this.horizonY) / (this.bottomY - this.horizonY);
        return this.laneTopWidth * (1 - progress) + this.laneBottomWidth * progress;
    }

    private renderHighway(): void {
        const ctx = this.ctx;

        // 1. Draw Static Highway from Cache (slightly transparent to let background peek through)
        if (this.renderCache && this.renderCache.highwayBackground) {
            ctx.globalAlpha = 0.78;
            ctx.drawImage(this.renderCache.highwayBackground, 0, 0);
            ctx.globalAlpha = 1.0;
        } else {
            // Fallback: Dynamic Rendering (if cache is missing)
            const tl = { x: this.getPerspectiveX(0, this.horizonY), y: this.horizonY };
            const tr = { x: this.getPerspectiveX(this.laneCount, this.horizonY), y: this.horizonY };
            const bl = { x: this.getPerspectiveX(0, this.bottomY), y: this.bottomY };
            const br = { x: this.getPerspectiveX(this.laneCount, this.bottomY), y: this.bottomY };

            // Side Rails (enhanced with gradient + highlight)
            const railWidth = 14;
            const theme = ThemeManager.getInstance().getCurrentTheme();

            // Left Rail
            const leftGrad = ctx.createLinearGradient(0, this.horizonY, 0, this.bottomY);
            leftGrad.addColorStop(0, theme.color2);
            leftGrad.addColorStop(0.4, theme.color3);
            leftGrad.addColorStop(1, theme.color2);
            ctx.fillStyle = leftGrad;
            ctx.beginPath();
            ctx.moveTo(tl.x - railWidth, tl.y); ctx.lineTo(tl.x, tl.y); ctx.lineTo(bl.x, bl.y); ctx.lineTo(bl.x - railWidth * 2, bl.y);
            ctx.fill();
            // Left highlight
            const leftHl = ctx.createLinearGradient(0, this.horizonY, 0, this.bottomY);
            leftHl.addColorStop(0, 'rgba(255,255,255,0)');
            leftHl.addColorStop(0.3, 'rgba(255,255,255,0.6)');
            leftHl.addColorStop(0.7, 'rgba(255,255,255,0.8)');
            leftHl.addColorStop(1, 'rgba(255,255,255,0.5)');
            ctx.strokeStyle = leftHl; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(tl.x, tl.y); ctx.lineTo(bl.x, bl.y); ctx.stroke();
            // Left outer border
            ctx.strokeStyle = theme.color1;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(tl.x - railWidth, tl.y); ctx.lineTo(bl.x - railWidth * 2, bl.y); ctx.stroke();

            // Right Rail
            const rightGrad = ctx.createLinearGradient(0, this.horizonY, 0, this.bottomY);
            rightGrad.addColorStop(0, theme.color2);
            rightGrad.addColorStop(0.4, theme.color3);
            rightGrad.addColorStop(1, theme.color2);
            ctx.fillStyle = rightGrad;
            ctx.beginPath();
            ctx.moveTo(tr.x, tr.y); ctx.lineTo(tr.x + railWidth, tr.y); ctx.lineTo(br.x + railWidth * 2, br.y); ctx.lineTo(br.x, br.y);
            ctx.fill();
            // Right highlight
            const rightHl = ctx.createLinearGradient(0, this.horizonY, 0, this.bottomY);
            rightHl.addColorStop(0, 'rgba(255,255,255,0)');
            rightHl.addColorStop(0.3, 'rgba(255,255,255,0.6)');
            rightHl.addColorStop(0.7, 'rgba(255,255,255,0.8)');
            rightHl.addColorStop(1, 'rgba(255,255,255,0.5)');
            ctx.strokeStyle = rightHl; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(tr.x, tr.y); ctx.lineTo(br.x, br.y); ctx.stroke();
            // Right outer border
            ctx.strokeStyle = theme.color1;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(tr.x + railWidth, tr.y); ctx.lineTo(br.x + railWidth * 2, br.y); ctx.stroke();

            // Road (Cyberpunk DJMax Style)
            // Brighter, more vibrant, less muddy
            const roadGrad = ctx.createLinearGradient(0, this.horizonY, 0, this.bottomY);
            roadGrad.addColorStop(0, 'rgba(0, 10, 30, 0.95)');
            roadGrad.addColorStop(0.5, 'rgba(10, 30, 80, 0.9)');
            roadGrad.addColorStop(1, 'rgba(0, 50, 120, 0.95)');  // Vibrant bright blue
            ctx.fillStyle = roadGrad;
            ctx.beginPath();
            ctx.moveTo(tl.x, tl.y); ctx.lineTo(tr.x, tr.y); ctx.lineTo(br.x, br.y); ctx.lineTo(bl.x, bl.y);
            ctx.fill();

            // Dividers (Brighter and stronger)
            ctx.lineWidth = 2; // Increased back to 2 for pop
            for (let i = 1; i < this.laneCount; i++) {
                const topX = this.getPerspectiveX(i, this.horizonY);
                const botX = this.getPerspectiveX(i, this.bottomY);
                const divGrad = ctx.createLinearGradient(0, this.horizonY, 0, this.bottomY);
                divGrad.addColorStop(0, 'rgba(0, 255, 255, 0)');
                divGrad.addColorStop(0.3, 'rgba(0, 255, 255, 0.8)'); // Brighter earlier
                divGrad.addColorStop(1, 'rgba(255, 255, 255, 0.5)'); // White near player
                ctx.strokeStyle = divGrad;
                ctx.beginPath();
                ctx.moveTo(topX, this.horizonY); ctx.lineTo(botX, this.bottomY);
                ctx.stroke();
            }

            // Try to force cache generation for next frame
            if (this.renderCache && this.laneBottomWidth > 0) {
                this.renderCache.renderHighwayBackground(
                    this.canvas.width, this.canvas.height,
                    this.horizonY, this.bottomY,
                    this.laneCount,
                    this.getPerspectiveX.bind(this),
                    ThemeManager.getInstance().getCurrentTheme().color1,
                    ThemeManager.getInstance().getCurrentTheme().color2,
                    this.hitLineY
                );
            }
        }

        // Locked Lanes Overlay (4K Mode)
        if (this.keyMode === 4) {
            const lockedLanes = [0, 5];
            for (const lane of lockedLanes) {
                const lX1 = this.getPerspectiveX(lane, this.horizonY);
                const rX1 = this.getPerspectiveX(lane + 1, this.horizonY);
                const lX2 = this.getPerspectiveX(lane, this.bottomY);
                const rX2 = this.getPerspectiveX(lane + 1, this.bottomY);

                ctx.save();
                ctx.beginPath();
                ctx.moveTo(lX1, this.horizonY); ctx.lineTo(rX1, this.horizonY);
                ctx.lineTo(rX2, this.bottomY); ctx.lineTo(lX2, this.bottomY);

                // Dark tint
                ctx.fillStyle = 'rgba(10, 0, 0, 0.55)';
                ctx.fill();

                // Clip for stripes & text
                ctx.clip();

                // Diagonal warning stripes
                ctx.lineWidth = 12;
                ctx.strokeStyle = 'rgba(255, 50, 50, 0.15)';
                const laneW = Math.max(rX1 - lX1, rX2 - lX2);
                for (let y = this.horizonY - laneW; y < this.bottomY + laneW; y += 50) {
                    ctx.beginPath();
                    // Draw diagonal line across the clipped area
                    ctx.moveTo(lX2 - laneW, y);
                    ctx.lineTo(rX2 + laneW, y + laneW * 2);
                    ctx.stroke();
                }

                // "LOCKED" Text near the bottom
                const textY = this.bottomY - 80;
                // For x, we interpolate between left and right boundaries at textY
                const lTextX = this.getPerspectiveX(lane, textY);
                const rTextX = this.getPerspectiveX(lane + 1, textY);
                const textX = (lTextX + rTextX) / 2;

                ctx.font = 'bold 20px "Orbitron", sans-serif';
                ctx.fillStyle = 'rgba(255, 50, 50, 0.4)';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                // Rotate text slightly to match perspective if we wanted, 
                // but direct text is fine and readable.
                // We'll draw it vertically along the lane
                ctx.translate(textX, textY);
                ctx.rotate(-Math.PI / 2);
                ctx.letterSpacing = '8px';
                ctx.fillText('LOCKED', 0, 0);

                ctx.restore();
            }
        }

        // Active Lane (Dynamic - must be drawn each frame)
        for (let i = 0; i < this.laneCount; i++) {
            if (this.keyState[i]) {
                const lX1 = this.getPerspectiveX(i, this.horizonY);
                const rX1 = this.getPerspectiveX(i + 1, this.horizonY);
                const lX2 = this.getPerspectiveX(i, this.bottomY);
                const rX2 = this.getPerspectiveX(i + 1, this.bottomY);
                ctx.beginPath();
                ctx.moveTo(lX1, this.horizonY); ctx.lineTo(rX1, this.horizonY); ctx.lineTo(rX2, this.bottomY); ctx.lineTo(lX2, this.bottomY);
                // Restored high-quality lane beam gradient (was simplified to flat white on mobile)
                const lightGrad = ctx.createLinearGradient(0, this.hitLineY, 0, this.horizonY);
                lightGrad.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
                lightGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
                ctx.fillStyle = lightGrad;
                ctx.fill();
            }
        }
    }

    private renderResult(): void {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const score = this.scoreManager?.getScore() || 0;
        const maxCombo = this.scoreManager?.getMaxCombo() || 0;
        const accuracy = this.scoreManager?.getAccuracy() || 0;
        const stats = this.scoreManager?.getDetailedStats() || { perfect: 0, great: 0, good: 0, miss: 0, total: 0 };

        // 1. Futuristic Background
        this.drawAtmosphere(width, height);

        // 2. Title Section
        ctx.fillStyle = '#fff';
        ctx.font = '900 48px "Nunito"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowOffsetY = 4;
        ctx.fillText("STAGE CLEAR!", width / 2, height * 0.12);
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        // 3. Layout Constants (Responsive)
        const panelW = Math.min(width * 0.9, 850);
        const panelH = height * 0.65;
        const panelX = (width - panelW) / 2;
        const panelY = height * 0.22;

        this.drawCuteTile(panelX, panelY, panelW, panelH, '#74b9ff', true);

        // 4. Left Section: Rank and Accuracy
        const leftAreaX = panelX + panelW * 0.3;

        // Grade Letter (Animated Glow)
        let grade = 'F';
        if (accuracy >= 98) grade = 'S+';
        else if (accuracy >= 95) grade = 'S';
        else if (accuracy >= 90) grade = 'A';
        else if (accuracy >= 80) grade = 'B';
        else if (accuracy >= 70) grade = 'C';
        else if (accuracy >= 50) grade = 'D';

        const gradeColor = (grade === 'F' || grade === 'D') ? '#ff7675' : (grade.includes('S') ? '#74b9ff' : '#55efc4');

        ctx.textAlign = 'center';
        ctx.font = '900 180px "Nunito"';
        ctx.fillStyle = gradeColor;
        ctx.lineWidth = 10;
        ctx.strokeStyle = 'white';
        ctx.lineJoin = 'round';
        ctx.strokeText(grade, leftAreaX, panelY + panelH * 0.4);
        ctx.fillText(grade, leftAreaX, panelY + panelH * 0.4);

        // Percent Accuracy
        this.drawCuteLabel(`${accuracy.toFixed(2)}% `, leftAreaX, panelY + panelH * 0.68, 'center', 42, '#fff', true);
        this.drawCuteLabel("ACCURACY", leftAreaX, panelY + panelH * 0.76, 'center', 16, '#e6628c');

        // 5. Right Section: Detailed Judgments
        const rightAreaX = panelX + panelW * 0.52;
        const startY = panelY + panelH * 0.18;
        const rowHeight = 45;

        const renderStatRow = (label: string, value: number | string, color: string, y: number, isLarge = false) => {
            this.drawCuteLabel(label, rightAreaX, y, 'left', isLarge ? 24 : 18, color, true);

            const valueX = rightAreaX + panelW * 0.41;
            this.drawCuteLabel(value.toString(), valueX, y, 'right', isLarge ? 36 : 22, '#fff', true);

            // Subtle Divider
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.beginPath();
            ctx.moveTo(rightAreaX, y + 15);
            ctx.lineTo(valueX, y + 15);
            ctx.stroke();
        };

        renderStatRow("PERFECT", stats.perfect, '#74b9ff', startY);
        renderStatRow("GREAT", stats.great, '#55efc4', startY + rowHeight);
        renderStatRow("GOOD", stats.good, '#ffeaa7', startY + rowHeight * 2);
        renderStatRow("MISS", stats.miss, '#ff7675', startY + rowHeight * 3);

        // Score & Max Combo
        renderStatRow("TOTAL SCORE", Math.floor(score).toLocaleString(), '#ff9a9e', startY + rowHeight * 4.5, true);
        renderStatRow("MAX COMBO", maxCombo, '#fdcb6e', startY + rowHeight * 6.2, true);

        // 6. Footer Prompt
        const pulse = 0.5 + Math.sin(Date.now() * 0.005) * 0.5;
        ctx.globalAlpha = 0.5 + pulse * 0.5;
        this.drawCuteLabel("TAP OR PRESS ANY KEY TO DISCONNECT", width / 2, height * 0.92, 'center', 24, '#fff', true);
        ctx.globalAlpha = 1.0;
    }

    private renderGameOver(): void {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;

        this.drawAtmosphere(width, height);

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // High-Quality Glitchy "GAME OVER"
        const glitchVal = this.transitionStyle === 'glitch' ? this.transitionAlpha : Math.sin(Date.now() * 0.01) * 0.2;
        const xOffset = (Math.random() - 0.5) * 15 * glitchVal;

        ctx.font = '900 italic 82px "Orbitron", sans-serif';
        ctx.shadowBlur = 25;
        ctx.shadowColor = '#ff003c';
        ctx.lineWidth = 14;
        ctx.strokeStyle = '#000';
        ctx.strokeText("GAME OVER", width / 2 + xOffset, height * 0.38);

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ff4757';
        ctx.fillText("GAME OVER", width / 2 + xOffset, height * 0.38);

        // Scanline interference
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = '#ff7675';
        for (let i = 0; i < height; i += 6) {
            if (Math.random() > 0.45) ctx.fillRect(0, i, width, 2);
        }
        ctx.globalAlpha = 1.0;

        // Interactive Options
        const btnW = 320;
        const btnH = 65;
        const centerX = width / 2;
        const retryY = height * 0.62;
        const selectY = height * 0.77;

        // Button Styles
        this.drawCuteTile(centerX - btnW / 2, retryY - btnH / 2, btnW, btnH, '#2ed573', true);
        this.drawCuteLabel("RETRY (Enter)", centerX, retryY, 'center', 26, '#fff', true);

        this.drawCuteTile(centerX - btnW / 2, selectY - btnH / 2, btnW, btnH, '#1e90ff', true);
        this.drawCuteLabel("SONG SELECTION (Esc)", centerX, selectY, 'center', 26, '#fff', true);

        ctx.restore();
    }

    private handleGameOverPointer(x: number, y: number): void {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const btnW = 320;
        const btnH = 65;
        const centerX = width / 2;
        const retryY = height * 0.62;
        const selectY = height * 0.77;

        // Retry Flow: Smooth transition back into gameplay
        if (x >= centerX - btnW / 2 && x <= centerX + btnW / 2 && y >= retryY - btnH / 2 && y <= retryY + btnH / 2) {
            if (this.isTransitioning) return;
            this.shouldAutoStart = true; // CRITICAL: Ensure game starts after load
            this.startTransition(() => {
                this.scoreManager?.reset();
                this.load().then(() => this.create());
            }, 'fade');
        }

        // Return Flow: Return to list
        if (x >= centerX - btnW / 2 && x <= centerX + btnW / 2 && y >= selectY - btnH / 2 && y <= selectY + btnH / 2) {
            if (this.isTransitioning) return;
            this.startTransition(() => {
                this.currentState = GameState.MENU;
                this.scoreManager?.reset();
                this.playPreview();
            }, 'fade');
        }
    }

    private renderGlitchTransition(ctx: CanvasRenderingContext2D, width: number, height: number, alpha: number): void {
        // Severe tinting
        ctx.fillStyle = `rgba(215, 0, 40, ${alpha * 0.5})`;
        ctx.fillRect(0, 0, width, height);

        // Chaos horizontal slices
        const sliceCount = Math.floor(alpha * 25);
        for (let i = 0; i < sliceCount; i++) {
            const h = Math.random() * 25 + 5;
            const y = Math.random() * (height - h);
            const xShift = (Math.random() - 0.5) * 120 * alpha;

            ctx.fillStyle = `rgba(0, 240, 255, ${0.3 * alpha})`; // Cyan split
            ctx.fillRect(xShift, y, width, h);

            ctx.fillStyle = `rgba(255, 255, 255, ${0.15 * alpha})`; // Brightness pop
            ctx.fillRect(0, y, width, h / 2);
        }

        if (alpha > 0.96) {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, width, height);
        }
    }

    private renderExplosions(): void {
        const ctx = this.ctx;
        const particleImg = this.renderCache?.particleGlow;

        if (!particleImg) return;

        ctx.save();
        // Additive blending for that extremely bright, overlapping "pop" effect
        ctx.globalCompositeOperation = 'lighter';

        this.explosions.forEach(exp => {
            // Draw cached glow particle
            ctx.globalAlpha = exp.alpha * 1.5; // Boost alpha slightly due to additive blending
            const size = exp.radius * 6; // Larger initial burst
            ctx.translate(exp.x, exp.y);
            ctx.drawImage(particleImg, -size / 2, -size / 2, size, size);

            // Draw a second tight core for intense brightness
            const coreSize = size * 0.4;
            ctx.globalAlpha = exp.alpha;
            ctx.drawImage(particleImg, -coreSize / 2, -coreSize / 2, coreSize, coreSize);

            ctx.translate(-exp.x, -exp.y); // Reset translate instead of rapid save/restore
        });
        ctx.restore();
    }

    private renderHitZone(currentTime: number): void {
        const ctx = this.ctx;
        const width = this.canvas.width;

        // --- GLOBAL HIT ZONE PULSE (BPM Sync) ---
        // Assuming 120 BPM average (500ms per beat) for consistent pulsing if we don't have exact live BPM easily available here
        const beatCycle = (currentTime % 500) / 500; // 0.0 to 1.0
        // Quick flash on beat, slow fade
        const pulseAlpha = Math.max(0, 1 - (beatCycle * 1.5));

        ctx.save();
        const theme = ThemeManager.getInstance().getCurrentTheme();
        const pal = this.getHudPalette();

        // Draw a glowing energy band behind the hit zone matching theme
        const bandHeight = 70;
        const colorBase = theme.color2; // Mid gradient for glow color
        const bandGrad = ctx.createLinearGradient(0, this.hitLineY - bandHeight / 2, 0, this.hitLineY + bandHeight / 2);
        bandGrad.addColorStop(0, 'rgba(0,0,0,0)');
        bandGrad.addColorStop(0.5, this.hexToRgba(colorBase, 0.15 + pulseAlpha * 0.35));
        bandGrad.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = bandGrad;
        ctx.fillRect(0, this.hitLineY - bandHeight / 2, width, bandHeight);

        // Strong glowing line directly under the hit zone
        const lineGrad = ctx.createLinearGradient(0, 0, width, 0);
        lineGrad.addColorStop(0, pal.hpPanel);
        lineGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.95)');
        lineGrad.addColorStop(1, pal.scorePanel);

        ctx.strokeStyle = lineGrad;
        ctx.lineWidth = 2 + pulseAlpha * 4;
        ctx.shadowBlur = 10 + pulseAlpha * 25;
        ctx.shadowColor = theme.particleColor;
        ctx.beginPath();
        ctx.moveTo(0, this.hitLineY + 25);
        ctx.lineTo(width, this.hitLineY + 25);
        ctx.stroke();
        ctx.shadowBlur = 0;

        for (let i = 0; i < this.laneCount; i++) {
            const laneWidth = this.getPerspectiveWidth(this.hitLineY);
            const height = 50;
            const x = this.getPerspectiveX(i, this.hitLineY);

            const receptorImg = this.keyState[i]
                ? this.renderCache?.receptorsActive[i]
                : this.renderCache?.receptors[i];

            if (receptorImg) {
                // Scale based on RenderCache configuration (NOTE_WIDTH=100, NOTE_HEIGHT=50, Padding=20)
                const scaleX = laneWidth / 100;
                const scaleY = height / 50;
                const drawW = receptorImg.width * scaleX;
                const drawH = receptorImg.height * scaleY;
                const drawX = x - 20 * scaleX;
                const drawY = this.hitLineY - 20 * scaleY;

                ctx.globalAlpha = this.keyState[i] ? 1.0 : (0.7 + pulseAlpha * 0.3);

                // If 4K mode and it's an outer lane, draw it very dimly
                const isLocked = this.keyMode === 4 && (i === 0 || i === 5);
                if (isLocked) {
                    ctx.globalAlpha = 0.2;
                }

                ctx.drawImage(receptorImg, drawX, drawY, drawW, drawH);

                // Draw Locked Overlay on Receptor
                if (isLocked) {
                    ctx.save();
                    ctx.strokeStyle = 'rgba(255, 50, 50, 0.4)';
                    ctx.lineWidth = 2;
                    ctx.fillStyle = 'rgba(10, 0, 0, 0.6)';

                    // Draw a pill-shape over the receptor
                    ctx.beginPath();
                    ctx.roundRect(drawX + 10 * scaleX, drawY + 10 * scaleY, drawW - 20 * scaleX, drawH - 20 * scaleY, 10);
                    ctx.fill();
                    ctx.stroke();

                    // Tiny "LOCKED" text inside the pill
                    ctx.font = `bold ${10 * scaleX}px "Orbitron", sans-serif`;
                    ctx.fillStyle = 'rgba(255, 50, 50, 0.6)';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.letterSpacing = '3px';
                    ctx.fillText('LOCKED', drawX + drawW / 2, drawY + drawH / 2);
                    ctx.restore();
                }

                ctx.globalAlpha = 1.0;
            }
        }
        ctx.restore();
    }

    private renderNotes(currentTime: number): void {
        const timeToReachHitLine = 2000 / this.scrollSpeed;
        const windowStart = currentTime - 500; // Miss buffer
        // Restored high-quality draw distance (3.0x lookahead)
        const lookAheadMultiplier = 3.0;
        const windowEnd = currentTime + timeToReachHitLine * lookAheadMultiplier;

        // OPTIMIZATION: Advance lastNoteIndex to skip notes that are completely passed
        while (this.lastNoteIndex < this.visualNotes.length) {
            const note = this.visualNotes[this.lastNoteIndex];
            const noteTimeMs = note.time * 1000;
            const noteEndMs = note.isHold ? noteTimeMs + note.durationMs : noteTimeMs;

            if (note.isProcessed && noteEndMs < windowStart) {
                this.lastNoteIndex++;
            } else {
                break;
            }
        }

        for (let i = this.lastNoteIndex; i < this.visualNotes.length; i++) {
            const note = this.visualNotes[i];
            const noteTimeMs = note.time * 1000;
            const noteEndMs = note.isHold ? noteTimeMs + note.durationMs : noteTimeMs;

            // Stop loop since sorted
            if (noteTimeMs > windowEnd) break;

            // Skip notes that already passed or are fully processed
            if (note.isProcessed) continue;
            if (noteEndMs < windowStart) continue;

            const timeDiff = noteTimeMs - currentTime;
            // Linear progress (0 to 1) based on time
            let linearProgress = 1 - (timeDiff / timeToReachHitLine);

            // For Long Notes, clamp Head to Hit Line if it has passed
            if (note.isHold && linearProgress > 1) linearProgress = 1;

            const perspectiveDepth = 4;
            const projectedProgress = linearProgress / (perspectiveDepth - (perspectiveDepth - 1) * linearProgress);

            const noteY = this.horizonY + (this.hitLineY - this.horizonY) * projectedProgress;
            if (noteY < this.horizonY) continue;

            const noteWidth = this.getPerspectiveWidth(noteY);
            const noteX = this.getPerspectiveX(note.lane, noteY);
            // Height matches the new 50px hit zone size
            const noteHeight = 50 * projectedProgress;

            // FADE-IN LOGIC: Smoothly fade in notes as they emerge from Horizon
            // Prevents hard pop-in when linearProgress crosses 0.
            let alpha = 1.0;
            if (linearProgress < 0.1) {
                alpha = Math.max(0, linearProgress / 0.1);
            }

            if (note.isHold) {
                // Determine Tail Position
                // Recalculate tail time based on simple duration addition for safety/speed
                const tailTime = note.time + (note.durationMs / 1000);
                const timeDiffTail = (tailTime * 1000) - currentTime;

                let tailProgress = 1 - (timeDiffTail / timeToReachHitLine);
                // Clamp tail to bottom (hit line) if it's passed
                if (tailProgress > 1) tailProgress = 1;

                // Calculate Tail Y
                const pTail = tailProgress / (perspectiveDepth - (perspectiveDepth - 1) * tailProgress);
                const tailY = this.horizonY + (this.hitLineY - this.horizonY) * pTail;
                const tailH = 50 * pTail;

                this.drawLongNote(note.lane, noteX, noteY, noteWidth, noteHeight, tailY, tailH, note.isHolding, alpha);
            } else {
                this.drawGelNote(noteX, noteY, noteWidth, noteHeight, note.lane, alpha);
            }
        }
    }

    private drawLongNote(lane: number, headX: number, headY: number, headW: number, headH: number, tailY: number, tailH: number, isHolding: boolean, globalAlpha: number = 1.0): void {
        const ctx = this.ctx;
        if (!this.renderCache) return;

        // Check Visibility: Head is at higher Y (bottom), Tail at lower Y (top)
        if (tailY > headY) return;

        const tailW = this.getPerspectiveWidth(tailY);
        const tailX = this.getPerspectiveX(lane, tailY);

        // === BODY: as wide as notes, perfectly centered to notes ===
        const bodyRatio = 0.92; // Widened to closely match the note width without leaking past rounded corners

        // Perfectly target the exact visual centers of the rendered 2D notes to fix leaning
        const tailCenterY = tailY + tailH * 0.5;
        const headCenterY = headY + headH * 0.5;

        // Give a slight margin inside so the flat end stays fully masked by the note's opaque center
        // e.g. instead of going exactly center, go slightly past center if drawing underneath?
        // Actually, exactly center is best to prevent leaking on the other end.
        const bodyTopY = tailCenterY;
        const bodyBotY = headCenterY;

        let alpha = isHolding ? 0.9 : 0.6;
        if (isHolding) {
            const flash = Math.sin((this.cachedNow || performance.now()) * 0.02) * 0.1 + 0.9;
            alpha = flash;
        }

        // If notes overlap cleanly (very short hold), skip body
        if (bodyTopY < bodyBotY) {
            // Calculate widths based on depth to maintain perspective tapering
            const bTopW = this.getPerspectiveWidth(bodyTopY);
            const bBotW = this.getPerspectiveWidth(bodyBotY);

            // Calculate the exact horizontal center of the drawn 2D note image
            const topCenterX = tailX + tailW * 0.5;
            const botCenterX = headX + headW * 0.5;

            // Half-widths of the body at top and bottom
            const halfTop = (bTopW * bodyRatio) * 0.5;
            const halfBot = (bBotW * bodyRatio) * 0.5;

            // Trapezoid points ensuring perfect centered alignment with the notes
            const pTopLeft = topCenterX - halfTop;
            const pTopRight = topCenterX + halfTop;
            const pBotLeft = botCenterX - halfBot;
            const pBotRight = botCenterX + halfBot;

            const laneColors = this.COLORS.LANES[lane] || this.COLORS.LANES[0];

            ctx.save();
            ctx.globalAlpha = alpha * globalAlpha;

            // Main body fill (simple trapezoid)
            ctx.beginPath();
            ctx.moveTo(pBotLeft, bodyBotY);
            ctx.lineTo(pBotRight, bodyBotY);
            ctx.lineTo(pTopRight, bodyTopY);
            ctx.lineTo(pTopLeft, bodyTopY);
            ctx.closePath();

            // Use high-performance RenderCache for long note bodies instead of per-frame gradients
            const cachedBody = this.renderCache.longNoteBodies[lane];
            if (cachedBody) {
                // Scaling calculation to map the cached (patterned) texture to the trapezoid area
                const drawH = bodyBotY - bodyTopY;

                // Draw stretched patterned body (cached texture is much more performant than per-frame gradients)
                // We use a trapezoid path clip to maintain perspective
                ctx.beginPath();
                ctx.moveTo(pBotLeft, bodyBotY);
                ctx.lineTo(pBotRight, bodyBotY);
                ctx.lineTo(pTopRight, bodyTopY);
                ctx.lineTo(pTopLeft, bodyTopY);
                ctx.closePath();
                ctx.clip();

                // Note: pTopLeft and pBotLeft are centers, no, they are actual left bounds.
                // Draw stretched from top-most left bound to bottom-most right bound in a bounding box, then clipped.
                const minX = Math.min(pTopLeft, pBotLeft);
                const maxX = Math.max(pTopRight, pBotRight);
                ctx.drawImage(cachedBody, minX, bodyTopY, maxX - minX, drawH);
            } else {
                // Fallback to basic gradient if cache missing (shouldn't happen)
                const bodyGrad = ctx.createLinearGradient(0, bodyTopY, 0, bodyBotY);
                bodyGrad.addColorStop(0, this.hexToRgba(laneColors[0], 0.35));
                bodyGrad.addColorStop(0.5, this.hexToRgba(laneColors[1], 0.65));
                bodyGrad.addColorStop(1, this.hexToRgba(laneColors[0], 0.85));
                ctx.fillStyle = bodyGrad;
                ctx.fill();
            }

            // Edge glow lines
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = this.hexToRgba(laneColors[1], isHolding ? 0.7 : 0.35);
            ctx.beginPath();
            ctx.moveTo(pBotLeft, bodyBotY);
            ctx.lineTo(pTopLeft, bodyTopY);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(pBotRight, bodyBotY);
            ctx.lineTo(pTopRight, bodyTopY);
            ctx.stroke();

            // White center highlight (narrower trapezoid)
            const hlHalfTop = (bTopW * 0.1) * 0.5;
            const hlHalfBot = (bBotW * 0.1) * 0.5;

            ctx.beginPath();
            ctx.moveTo(botCenterX - hlHalfBot, bodyBotY);
            ctx.lineTo(botCenterX + hlHalfBot, bodyBotY);
            ctx.lineTo(topCenterX + hlHalfTop, bodyTopY);
            ctx.lineTo(topCenterX - hlHalfTop, bodyTopY);
            ctx.closePath();

            // Performance Optimized Highlight
            const hlGrad = ctx.createLinearGradient(0, bodyTopY, 0, bodyBotY);
            hlGrad.addColorStop(0, 'rgba(255, 255, 255, 0.0)');
            hlGrad.addColorStop(0.5, `rgba(255, 255, 255, ${isHolding ? 0.4 : 0.15})`);
            hlGrad.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
            ctx.fillStyle = hlGrad;
            ctx.fill();

            ctx.restore();
        }

        // Draw Tail Note ON TOP (covers body top edge completely, opaque to hide body end)
        // Make the tail visually distinct by reducing its height (squashing it)
        const distinctTailH = tailH * 0.4;
        const distinctTailY = tailY + (tailH * 0.3); // Maintain the visual center alignment
        this.drawGelNote(tailX, distinctTailY, tailW, distinctTailH, lane, globalAlpha);

        // Draw Head Note ON TOP (covers body bottom edge completely)
        this.drawGelNote(headX, headY, headW, headH, lane, globalAlpha);
    }

    private hexToRgba(hex: string, alpha: number): string {
        // Fast path: avoid string templates if possible
        const key = hex + alpha;
        const cached = this.rgbaCache.get(key);
        if (cached) return cached;

        const r = parseInt(hex.substring(1, 3), 16);
        const g = parseInt(hex.substring(3, 5), 16);
        const b = parseInt(hex.substring(5, 7), 16);
        const val = 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';

        // Cap cache size to avoid memory leak if alpha is highly variable
        if (this.rgbaCache.size > 200) this.rgbaCache.clear();

        this.rgbaCache.set(key, val);
        return val;
    }

    private drawGelNote(x: number, y: number, w: number, h: number, lane: number, alpha: number = 1.0): void {
        // High-Performance Cache Rendering
        if (!this.renderCache) return;

        const noteImg = this.renderCache.notes[lane];
        if (noteImg) {
            // Optimization: Skip save/restore for the most frequent draw call in the game.
            // Bypassing the state stack significantly reduces CPU overhead on mobile.
            const oldAlpha = this.ctx.globalAlpha;
            if (alpha !== oldAlpha) this.ctx.globalAlpha = alpha;

            // Pad compensation: NOTE_WIDTH=100, NOTE_HEIGHT=50, padding=15
            const scaleX = w / 100;
            const scaleY = h / 50;
            const drawW = noteImg.width * scaleX;
            const drawH = noteImg.height * scaleY;
            const drawX = x - 15 * scaleX;
            const drawY = y - 15 * scaleY;

            this.ctx.drawImage(noteImg, drawX, drawY, drawW, drawH);

            // Restore alpha only if changed
            if (alpha !== oldAlpha) this.ctx.globalAlpha = oldAlpha;
        }
    }

    // --- Curated HUD Color Palettes ---
    // Each theme gets a hand-picked palette designed using color theory principles:
    // - Complementary/Split-complementary accents for panel borders
    // - High-contrast label colors against their respective backgrounds
    // - HP bar gradients that flow naturally within the palette
    // - Combo text with proper outline + glow for maximum impact
    private static readonly HUD_PALETTES: Record<string, {
        hpPanel: string;       // Left panel border (HP side)
        scorePanel: string;    // Right panel border (Score side)
        hpBarMid: string;      // HP bar gradient midpoint
        hpBarEnd: string;      // HP bar gradient endpoint
        hpBarStart: string;    // HP bar gradient start (added)
        labelFill: string;     // "HP" and "SCORE" label text fill
        labelShadow: string;   // Label text shadow/glow color
        comboFill: string;     // Combo number text fill
        comboOutline: string;  // Combo thick outline
        comboGlow: string;     // Combo neon glow color
        comboGradTop: string;  // Combo gradient top color
        comboGradBot: string;  // Combo gradient bottom color
        scoreFill: string;     // Score number text fill inside dark panel
        scoreGlow: string;     // Score number glow
    }> = {
            'deep-space': {
                hpPanel: '#e056a0',      // Rose pink — warm accent against cold indigo
                scorePanel: '#00e5ff',   // Electric cyan — complementary pop
                hpBarMid: '#e056a0', hpBarEnd: '#00e5ff', hpBarStart: '#4a6cf7',
                labelFill: '#e8daef', labelShadow: '#9b59b6',
                comboFill: '#ffffff', comboOutline: '#1a1a2e', comboGlow: '#00e5ff',
                comboGradTop: '#00e5ff', comboGradBot: '#e056a0',
                scoreFill: '#ffffff', scoreGlow: '#00e5ff',
            },
            'cyber-neon': {
                hpPanel: '#FF0055',      // Hot magenta — on-theme
                scorePanel: '#00F0FF',   // Cyan — on-theme complementary
                hpBarMid: '#FF0055', hpBarEnd: '#00F0FF', hpBarStart: '#7000FF',
                labelFill: '#e0e0e0', labelShadow: '#FF0055',
                comboFill: '#ffffff', comboOutline: '#0a0a1a', comboGlow: '#00F0FF',
                comboGradTop: '#00F0FF', comboGradBot: '#FF0055',
                scoreFill: '#ffffff', scoreGlow: '#00F0FF',
            },
            'sunset-overdrive': {
                hpPanel: '#FF416C',      // Coral rose — warm on-theme
                scorePanel: '#FFD700',   // Gold — triadic accent
                hpBarMid: '#FF6B6B', hpBarEnd: '#FFD700', hpBarStart: '#FF8E53',
                labelFill: '#fff5e6', labelShadow: '#FF416C',
                comboFill: '#ffffff', comboOutline: '#2d1b2e', comboGlow: '#FFD700',
                comboGradTop: '#FFD700', comboGradBot: '#FF416C',
                scoreFill: '#ffffff', scoreGlow: '#FFD700',
            },
            'matrix-grid': {
                hpPanel: '#00CC66',      // Matrix green — on-theme saturated
                scorePanel: '#00FF00',   // Neon green — on-theme bright
                hpBarMid: '#00CC66', hpBarEnd: '#00FF00', hpBarStart: '#003300',
                labelFill: '#b8f5d0', labelShadow: '#009933',
                comboFill: '#00FF00', comboOutline: '#001a00', comboGlow: '#00FF00',
                comboGradTop: '#88FF88', comboGradBot: '#00CC00',
                scoreFill: '#00FF00', scoreGlow: '#00FF00',
            },
            'vaporwave': {
                hpPanel: '#FF80CC',      // Soft pink — on-theme
                scorePanel: '#00FFFF',   // Cyan — classic vaporwave complement
                hpBarMid: '#b388ff', hpBarEnd: '#00FFFF', hpBarStart: '#FF00FF',
                labelFill: '#e8d5f5', labelShadow: '#9c27b0',
                comboFill: '#ffffff', comboOutline: '#1a0a2e', comboGlow: '#00FFFF',
                comboGradTop: '#00FFFF', comboGradBot: '#FF80CC',
                scoreFill: '#ffffff', scoreGlow: '#00FFFF',
            },
            'midnight-ocean': {
                hpPanel: '#1F8A70',      // Teal — analogous to deep ocean
                scorePanel: '#BFDB38',   // Lime — split-complementary pop
                hpBarMid: '#1F8A70', hpBarEnd: '#BFDB38', hpBarStart: '#004D40',
                labelFill: '#d4efdf', labelShadow: '#117a65',
                comboFill: '#ffffff', comboOutline: '#001a12', comboGlow: '#BFDB38',
                comboGradTop: '#BFDB38', comboGradBot: '#1F8A70',
                scoreFill: '#ffffff', scoreGlow: '#BFDB38',
            },
            'crimson-flare': {
                hpPanel: '#FF6600',      // Deep orange — analogous warm
                scorePanel: '#FFCC00',   // Amber gold — triadic warm accent
                hpBarMid: '#FF6600', hpBarEnd: '#FFCC00', hpBarStart: '#8B0000',
                labelFill: '#ffe0b2', labelShadow: '#bf360c',
                comboFill: '#ffffff', comboOutline: '#1a0000', comboGlow: '#FFCC00',
                comboGradTop: '#FFCC00', comboGradBot: '#FF6600',
                scoreFill: '#ffffff', scoreGlow: '#FFCC00',
            },
            'golden-hour': {
                hpPanel: '#C96123',      // Burnt sienna — on-theme
                scorePanel: '#FFCA3A',   // Gold — on-theme bright
                hpBarMid: '#e67e22', hpBarEnd: '#FFCA3A', hpBarStart: '#6D2B05',
                labelFill: '#2c1810', labelShadow: 'rgba(255, 202, 58, 0.6)',
                comboFill: '#2c1810', comboOutline: '#ffffff', comboGlow: '#FFCA3A',
                comboGradTop: '#FFCA3A', comboGradBot: '#C96123',
                scoreFill: '#ffffff', scoreGlow: '#FFCA3A',
            },
            'monochrome-tech': {
                hpPanel: '#888888',      // Mid gray — on-theme
                scorePanel: '#DDDDDD',   // Light gray — high contrast
                hpBarMid: '#888888', hpBarEnd: '#DDDDDD', hpBarStart: '#333333',
                labelFill: '#cccccc', labelShadow: '#555555',
                comboFill: '#ffffff', comboOutline: '#111111', comboGlow: '#DDDDDD',
                comboGradTop: '#ffffff', comboGradBot: '#999999',
                scoreFill: '#ffffff', scoreGlow: '#DDDDDD',
            },
            'bubblegum-pop': {
                hpPanel: '#D63384',      // Deep rose — high contrast vs pastel pink bg
                scorePanel: '#4A6CF7',   // Royal blue — complementary to warm pastels
                hpBarMid: '#D63384', hpBarEnd: '#4A6CF7', hpBarStart: '#681D43',
                labelFill: '#2b1055', labelShadow: 'rgba(255, 255, 255, 0.7)',
                comboFill: '#2b1055', comboOutline: '#ffffff', comboGlow: '#D63384',
                comboGradTop: '#D63384', comboGradBot: '#4A6CF7',
                scoreFill: '#ffffff', scoreGlow: '#4A6CF7',
            },
        };

    private getHudPalette(): typeof RhythmGame.HUD_PALETTES[string] {
        const theme = ThemeManager.getInstance().getCurrentTheme();
        if (this._cachedThemeId !== theme.id) {
            this._cachedThemeId = theme.id;
            this._cachedHudPalette = RhythmGame.HUD_PALETTES[theme.id] || RhythmGame.HUD_PALETTES['deep-space'];
        }
        return this._cachedHudPalette!;
    }

    private renderHUD(): void {
        if (!this.scoreManager) return;
        const ctx = this.ctx;
        const width = this.canvas.width;
        const score = Math.floor(this.scoreManager.getScore());
        const combo = this.scoreManager.getCombo();

        const pal = this.getHudPalette();

        ctx.save();
        ctx.font = 'bold 24px "Orbitron", sans-serif';
        ctx.textBaseline = 'top';

        // --- HUD BACKGROUND PANELS (Cyberpunk Arcade Style) ---
        const panelTopY = 10;
        const panelBotY = 70;

        // Margin from the actual lane edge
        const hMargin = 15;

        // Left Panel (HP) coordinates
        let hpInnerTopX = this.getPerspectiveX(0, panelTopY) - hMargin;
        let hpInnerBotX = this.getPerspectiveX(0, panelBotY) - hMargin;

        // Fallback for extremely narrow screens or excessive tilt
        if (hpInnerBotX > width * 0.45) {
            const diff = hpInnerBotX - width * 0.45;
            hpInnerBotX -= diff;
            hpInnerTopX -= diff;
        }

        ctx.fillStyle = 'rgba(10, 10, 20, 0.88)';
        ctx.strokeStyle = pal.hpPanel;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, panelTopY);
        ctx.lineTo(hpInnerTopX, panelTopY);
        ctx.lineTo(hpInnerBotX, panelBotY);
        ctx.lineTo(0, panelBotY);
        ctx.fill();
        ctx.stroke();

        // Right Panel (Score) coordinates
        let scoreInnerTopX = this.getPerspectiveX(this.laneCount, panelTopY) + hMargin;
        let scoreInnerBotX = this.getPerspectiveX(this.laneCount, panelBotY) + hMargin;

        if (scoreInnerBotX < width * 0.55) {
            const diff = width * 0.55 - scoreInnerBotX;
            scoreInnerBotX += diff;
            scoreInnerTopX += diff;
        }

        ctx.fillStyle = 'rgba(10, 10, 20, 0.88)';
        ctx.strokeStyle = pal.scorePanel;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(width, panelTopY);
        ctx.lineTo(scoreInnerTopX, panelTopY);
        ctx.lineTo(scoreInnerBotX, panelBotY);
        ctx.lineTo(width, panelBotY);
        ctx.fill();
        ctx.stroke();

        // --- HP Bar ---
        // Use ratio-based positioning so bar angle matches panel angle exactly
        const hpBgTopY = panelTopY + 10;
        const hpBgBotY = panelBotY - 10;
        const hpBarInset = 10; // Inset from panel edges

        // HP bar left edge: straight vertical (flush with screen left + inset)
        const hpBarLeftX = hpBarInset;

        // HP bar right edge: interpolate panel inner edge at bar's top/bottom Y
        // This ensures the bar's right angle exactly matches the panel's slope
        const panelSlope = (hpInnerBotX - hpInnerTopX) / (panelBotY - panelTopY);
        const hpBarRightTopX = hpInnerTopX + panelSlope * (hpBgTopY - panelTopY) - hpBarInset;
        const hpBarRightBotX = hpInnerTopX + panelSlope * (hpBgBotY - panelTopY) - hpBarInset;

        // Background track (Parallelogram with angle matching panel exactly)
        ctx.beginPath();
        ctx.moveTo(hpBarLeftX, hpBgTopY);
        ctx.lineTo(hpBarRightTopX, hpBgTopY);
        ctx.lineTo(hpBarRightBotX, hpBgBotY);
        ctx.lineTo(hpBarLeftX, hpBgBotY);
        ctx.closePath();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const maxHp = this.scoreManager.getMaxHealth();
        const currentHp = this.scoreManager.getHealth();
        const hpPercent = Math.max(0, Math.min(1, currentHp / maxHp));

        if (hpPercent > 0) {
            // Angled fill: lerp between left and right edges by hpPercent
            const fillRightTopX = hpBarLeftX + (hpBarRightTopX - hpBarLeftX) * hpPercent;
            const fillRightBotX = hpBarLeftX + (hpBarRightBotX - hpBarLeftX) * hpPercent;

            // Restored high-quality HP bar gradient
            ctx.fillStyle = this.cachedHpGradient || pal.hpBarMid;
            ctx.beginPath();
            ctx.moveTo(hpBarLeftX + 2, hpBgTopY + 2);
            ctx.lineTo(fillRightTopX - 2, hpBgTopY + 2);
            ctx.lineTo(fillRightBotX - 2, hpBgBotY - 2);
            ctx.lineTo(hpBarLeftX + 2, hpBgBotY - 2);
            ctx.closePath();
            ctx.fill();
        }

        // HP label: below panel, left-aligned
        ctx.textAlign = 'left';
        ctx.shadowBlur = 6;
        ctx.shadowColor = pal.labelShadow;
        ctx.fillStyle = pal.labelFill;
        ctx.font = 'italic bold 20px "Orbitron"';
        ctx.fillText("HP", 10, panelBotY + 8);
        ctx.shadowBlur = 0;

        // Score number: right-aligned inside the dark panel
        ctx.textAlign = 'right';
        // Restored high-quality score number shadow and gradient
        ctx.shadowBlur = 12;
        ctx.shadowColor = pal.scoreGlow;
        ctx.fillStyle = this.cachedScoreGradient || pal.scoreFill;
        ctx.font = 'italic bold 32px "Orbitron"';
        ctx.fillText(score.toLocaleString(), width - 20, (panelTopY + panelBotY) / 2 - 10);
        ctx.shadowBlur = 0;

        // SCORE label: below panel, right-aligned
        ctx.textAlign = 'right';
        ctx.shadowBlur = 6;
        ctx.shadowColor = pal.labelShadow;
        ctx.fillStyle = pal.labelFill;
        ctx.font = 'italic bold 20px "Orbitron"';
        ctx.fillText("SCORE", width - 10, panelBotY + 8);
        ctx.shadowBlur = 0;

        // Combo
        if (combo > 0) {
            ctx.save();
            ctx.translate(this.canvas.width / 2, this.canvas.height * 0.15);

            const scale = 1 + this.comboAnim * 0.4;
            ctx.scale(scale, scale);

            // --- Number ---
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = 'italic 900 64px "Orbitron", sans-serif';

            const comboText = `${combo}`;

            // 1. Thick dark outline (crisp edge definition)
            ctx.lineJoin = 'round';
            ctx.miterLimit = 2;
            ctx.lineWidth = 10;
            ctx.strokeStyle = pal.comboOutline;
            // Restored high-quality combo outline shadow
            ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
            ctx.shadowOffsetY = 4;
            ctx.shadowBlur = 8;
            ctx.strokeText(comboText, 0, 0);

            // 2. Thin glow accent outline (neon rim)
            // Restored high-quality combo glow outline
            ctx.shadowOffsetY = 0;
            ctx.shadowColor = pal.comboGlow;
            ctx.shadowBlur = 14 + this.comboAnim * 14;
            ctx.lineWidth = 3;
            ctx.strokeStyle = pal.comboGlow;
            ctx.strokeText(comboText, 0, 0);

            // 3. Gradient fill (fully opaque, vivid)
            ctx.shadowBlur = 0;
            // Restored high-quality combo fill gradient
            ctx.fillStyle = this.cachedComboGradient || pal.comboFill;
            ctx.fillText(comboText, 0, 0);

            // --- "COMBO" sublabel ---
            ctx.font = 'italic 900 18px "Orbitron", sans-serif';
            ctx.letterSpacing = '6px';
            // Outline for sublabel
            ctx.lineWidth = 4;
            ctx.strokeStyle = pal.comboOutline;
            // Restored high-quality combo sublabel shadow
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowOffsetY = 2;
            ctx.shadowBlur = 4;
            ctx.strokeText('C O M B O', 0, 42);
            // Glow fill for sublabel
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;
            ctx.fillStyle = pal.comboGlow;
            ctx.fillText('C O M B O', 0, 42);

            ctx.restore();
        }

        // Render Judgement Text (Perfect/Good/Miss)
        this.renderJudgment(ctx, this.canvas.width, this.canvas.height);

        ctx.restore();
    }

    // --- Visual Helpers ---

    public createShatterEffect(x: number, y: number, color: string, isSmall: boolean = false): void {
        const count = isSmall ? 10 : 35; // Increased slightly for impact
        const cap = this.MAX_PARTICLES;
        const theme = ThemeManager.getInstance().getCurrentTheme();

        // Explosion Logic remains (visual ring)
        this.explosions.push({
            x: x,
            y: y,
            radius: isSmall ? 12 : 25,
            alpha: 1.0,
            color: color
        });

        for (let i = 0; i < count; i++) {
            // Optimized cap check: Avoid shift() O(N). If full, don't spawn.
            if (this.particles.length >= cap) break;

            const isSpark = Math.random() > 0.6;

            // PHYSICS TWEAK: Increase upward initial velocity for "cheerful" pop
            // vy: -6 to -15 for large, -3 to -8 for small
            const vyBase = isSmall ? -3 - Math.random() * 5 : -6 - Math.random() * 9;
            const vxBase = (Math.random() - 0.5) * (isSmall ? 5 : 10);

            this.particles.push({
                x: x,
                y: y,
                vx: vxBase,
                vy: vyBase,
                alpha: 1.0 + Math.random() * 0.4, // Over-bright alpha for sparkle
                size: Math.random() * (isSmall ? 2.5 : (isSpark ? 5 : 4)) + 1.5,
                color: isSpark ? '#ffffff' : color,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 2.0, // Faster rotation for energetic feel
            });

            // Extra Sparkle Bits for Deep Space or Neon
            if (!isSmall && (theme.id === 'deep-space' || theme.id === 'cyber-neon') && Math.random() > 0.8) {
                this.particles.push({
                    x: x,
                    y: y,
                    vx: vxBase * 1.5,
                    vy: vyBase * 0.5,
                    alpha: 0.8,
                    size: 1.5,
                    color: '#fff',
                    rotation: 0,
                    rotationSpeed: 0
                });
            }
        }
    }


    private drawLaneBeam(lane: number): void {
        const ctx = this.ctx;
        const tl = { x: this.getPerspectiveX(lane, this.horizonY), y: this.horizonY };
        const tr = { x: this.getPerspectiveX(lane + 1, this.horizonY), y: this.horizonY };
        const bl = { x: this.getPerspectiveX(lane, this.hitLineY), y: this.hitLineY };
        const br = { x: this.getPerspectiveX(lane + 1, this.hitLineY), y: this.hitLineY };

        const grad = this.beamGradients[lane];
        if (grad) {
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(tl.x, tl.y);
            ctx.lineTo(tr.x, tr.y);
            ctx.lineTo(br.x, br.y);
            ctx.lineTo(bl.x, bl.y);
            ctx.fill();
        }
    }

    private renderParticles(ctx: CanvasRenderingContext2D): void {
        // Optimization: Save base transform once
        ctx.save();
        const baseTransform = ctx.getTransform();

        const theme = ThemeManager.getInstance().getCurrentTheme();
        const isRetro = theme.id === 'sunset-overdrive' || theme.id === 'retro-blocks';
        const isMatrix = theme.id === 'matrix-grid';
        const isDeep = theme.id === 'deep-space';

        this.particles.forEach(p => {
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;

            ctx.setTransform(baseTransform);
            ctx.translate(p.x, p.y);

            // Motion-relative tilt for dynamic look
            const motionAngle = Math.atan2(p.vy, p.vx) * 0.1;
            ctx.rotate(p.rotation + motionAngle);

            ctx.beginPath();
            if (isRetro) {
                ctx.rect(-p.size, -p.size, p.size * 2, p.size * 2);
            } else if (isMatrix) {
                ctx.rect(-p.size * 0.25, -p.size * 1.5, p.size * 0.5, p.size * 3);
            } else if (isDeep) {
                ctx.rect(-p.size, -p.size * 0.2, p.size * 2, p.size * 0.4);
                ctx.rect(-p.size * 0.2, -p.size, p.size * 0.4, p.size * 2);
            } else {
                ctx.moveTo(0, -p.size * 1.2);
                ctx.lineTo(p.size, p.size * 0.8);
                ctx.lineTo(-p.size, p.size * 0.8);
            }
            ctx.fill();

            // Add a small glow outline for premium look
            if (!this.isMobile && p.alpha > 0.5) {
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        });

        // Restore to base transform and cleanup
        ctx.setTransform(baseTransform);
        ctx.restore();
        ctx.globalAlpha = 1.0;
    }

    private renderMenu(): void {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const padding = Math.min(width * 0.02, 20); // Define padding here for scope
        const time = this.menuAnimationTimer;

        // Test Mode: Show a simple "TAP TO START" screen instead of the full menu
        if (this.isTestMode) {
            ctx.fillStyle = '#0a0015';
            ctx.fillRect(0, 0, width, height);

            // Pulsing glow effect
            const pulse = Math.sin(performance.now() * 0.003) * 0.3 + 0.7;

            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Song name
            const songName = this.transitionData?.midiName || 'TEST PLAY';
            ctx.font = `bold ${Math.min(width * 0.04, 28)}px "Orbitron", sans-serif`;
            ctx.fillStyle = `rgba(0, 255, 255, ${pulse})`;
            ctx.shadowColor = '#00ffff';
            ctx.shadowBlur = 20;
            ctx.fillText(songName.toUpperCase(), width / 2, height * 0.38);

            // TAP TO START
            ctx.font = `900 ${Math.min(width * 0.06, 48)}px "Orbitron", sans-serif`;
            ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 30 * pulse;
            ctx.fillText('TAP TO START', width / 2, height / 2);

            // Subtitle
            ctx.font = `${Math.min(width * 0.025, 18)}px "Orbitron", sans-serif`;
            ctx.fillStyle = `rgba(180, 180, 255, ${pulse * 0.8})`;
            ctx.shadowBlur = 0;
            ctx.fillText('[ EDITOR TEST MODE ]', width / 2, height * 0.62);

            ctx.restore();
            return;
        }

        // 1. Atmosphere & Background
        this.drawAtmosphere(width, height);

        const currentSong = this.songList[this.selectedSongIndex];
        const seedColor = this.getSeededColor(currentSong.name);
        const bpm = currentSong.bpm || 120;

        // Layout Config (Landscape Only)
        const leftPanelWidth = width * 0.46;
        const rightPanelX = width * 0.5;

        // Panel Sizes
        const visPanelH = height * 0.48;
        const infoY = visPanelH + padding + 10;
        const infoH = height - infoY - padding;

        // SONG LIST: start 25px left of rightPanelX to close the gap, scrollbar lives inside its left edge
        const listX = rightPanelX - 25;
        const listY = padding;
        const listW = width - listX - padding;
        const listH = height - listY - padding;

        // --- DRAW PANELS WITH COLORED OUTLINES ---
        const TAB_H = 26; // tab height that sticks above the frame

        const drawPanelWithTab = (
            px: number, py: number, pw: number, ph: number,
            tabLabel: string, outlineColor: string
        ) => {
            ctx.save();

            // Panel background
            ctx.fillStyle = 'rgba(15, 15, 30, 0.65)';
            ctx.shadowColor = 'rgba(0,0,0,0.4)';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.roundRect(px, py, pw, ph, 12);
            ctx.fill();

            // Colored outline
            ctx.shadowColor = outlineColor;
            ctx.shadowBlur = 6;
            ctx.lineWidth = 2;
            ctx.strokeStyle = outlineColor;
            ctx.stroke();
            ctx.shadowColor = 'transparent';

            // --- Tab (outside, above top-left corner) ---
            ctx.font = `800 14px "Nunito", sans-serif`;
            const tabW = ctx.measureText(tabLabel).width + 20;
            // Tab sits flush with left of panel, bottom edge at py-1 (connected to panel top)
            const tabX = px + 12;
            const tabY = py - TAB_H + 2;
            ctx.fillStyle = outlineColor;
            ctx.beginPath();
            // Rounded only on top corners
            ctx.roundRect(tabX, tabY, tabW, TAB_H, [8, 8, 0, 0]);
            ctx.fill();
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.stroke();

            // Tab text — stroke first for outline, then fill white
            ctx.font = `800 14px "Nunito", sans-serif`;
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'left';
            // Black outline
            ctx.shadowColor = 'rgba(0,0,0,0.9)';
            ctx.shadowBlur = 5;
            ctx.shadowOffsetY = 2;
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(0,0,0,0.85)';
            ctx.lineJoin = 'round';
            ctx.strokeText(tabLabel, tabX + 10, tabY + TAB_H / 2);
            // White fill
            ctx.shadowColor = 'transparent';
            ctx.fillStyle = '#fff';
            ctx.fillText(tabLabel, tabX + 10, tabY + TAB_H / 2);
            ctx.restore();
        };

        const PANEL_Y_OFFSET = 12; // Adjusted for better screen utilization
        drawPanelWithTab(padding, padding + PANEL_Y_OFFSET, leftPanelWidth - padding, visPanelH - PANEL_Y_OFFSET, 'SONG INFO', '#FFD700');
        drawPanelWithTab(padding, infoY + PANEL_Y_OFFSET, leftPanelWidth - padding, infoH - PANEL_Y_OFFSET, 'OPTIONS', '#e91e8c');
        drawPanelWithTab(listX, listY + PANEL_Y_OFFSET, listW, listH - PANEL_Y_OFFSET, 'SONG LIST', '#00bcd4');

        // Sort Text (right side of song list panel)
        const sortText = `SORT: ${this.currentSortMode.toUpperCase()}`;
        this.drawCuteLabel(sortText, listX + listW - 20, listY + TAB_H + 16, 'right', 12, '#74b9ff', false);


        // --- CONTENT: VISUALIZER ---
        const cx = padding + (leftPanelWidth - padding) * 0.5;
        const cy = (padding + PANEL_Y_OFFSET) + (visPanelH - PANEL_Y_OFFSET) * 0.5 + 8;
        const radius = Math.min(leftPanelWidth * 0.4, (visPanelH - PANEL_Y_OFFSET) * 0.35);

        this.drawVisualizer(cx, cy, radius, time, seedColor, bpm);

        ctx.save();
        ctx.translate(cx, cy);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        let titleSizeActual = Math.min(width * 0.06, radius * 0.7);
        ctx.font = `900 ${titleSizeActual}px "Nunito"`;

        const MAX_TITLE_CHARS = 20;
        // Title may fill the full SONG INFO panel width, not just the inner circle
        const maxTitleWidth = (leftPanelWidth - padding) * 0.88;

        // Build lines: split by spaces, keep original case
        const rawName = currentSong.name; // original case preserved
        const rawWords = rawName.split(' ');
        const buildLines: string[] = [];
        let curLine = '';

        for (let i = 0; i < rawWords.length; i++) {
            const test = curLine ? curLine + ' ' + rawWords[i] : rawWords[i];
            if ((ctx.measureText(test).width > maxTitleWidth || test.length > MAX_TITLE_CHARS) && curLine) {
                buildLines.push(curLine);
                curLine = rawWords[i];
            } else {
                curLine = test;
            }
        }
        if (curLine) buildLines.push(curLine);

        // Clamp to 2 lines, hard-truncate each to MAX_TITLE_CHARS
        const lines = buildLines.slice(0, 2).map((l, idx) => {
            if (l.length > MAX_TITLE_CHARS) {
                return l.substring(0, MAX_TITLE_CHARS - 3) + '...';
            }
            if (idx === 1 && buildLines.length > 2) {
                return l.substring(0, MAX_TITLE_CHARS - 3) + '...';
            }
            return l;
        });

        // Auto-shrink font until all lines fit within the circle
        while (titleSizeActual > 10) {
            ctx.font = `900 ${titleSizeActual}px "Nunito"`;
            const allFit = lines.every(l => ctx.measureText(l).width <= maxTitleWidth);
            if (allFit) break;
            titleSizeActual -= 1;
        }
        ctx.font = `900 ${titleSizeActual}px "Nunito"`;

        const lineHeight = titleSizeActual * 1.2;
        const startY = -(lines.length - 1) * lineHeight / 2;

        for (let i = 0; i < lines.length; i++) {
            const yOffset = startY + i * lineHeight;

            ctx.save(); // isolate per-line state

            // Per-line gradient: each line has its own full gradient from top to bottom
            const lineGrad = ctx.createLinearGradient(0, yOffset - titleSizeActual * 0.6, 0, yOffset + titleSizeActual * 0.6);
            lineGrad.addColorStop(0, '#c0001a');  // deep crimson at top
            lineGrad.addColorStop(0.3, '#ff3a00');  // vivid orange-red
            lineGrad.addColorStop(0.65, '#ffd700');  // gold
            lineGrad.addColorStop(1, '#ffffff');   // white at bottom

            // Black shadow outer stroke (no color cycling)
            ctx.shadowColor = 'rgba(0,0,0,0.9)';
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 6;
            ctx.shadowBlur = 12;
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 10;
            ctx.lineJoin = 'round';
            ctx.strokeText(lines[i], 0, yOffset);

            // White mid stroke
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;
            ctx.strokeStyle = 'rgba(255,255,255,0.9)';
            ctx.lineWidth = 4;
            ctx.strokeText(lines[i], 0, yOffset);

            // Per-line gradient fill
            ctx.fillStyle = lineGrad;
            ctx.fillText(lines[i], 0, yOffset);

            ctx.restore();
        }
        ctx.restore();

        // --- CONTENT: INFO & SPEED ---
        // options panel starts below its tab
        const infoPanelY = infoY + /* TAB_H from drawPanelWithTab */ 26;
        const infoPanelH = infoH - 26;

        const pad = Math.min(infoPanelH * 0.045, 12);

        // 3x2 Grid Layout (3 rows, 2 columns)
        const numRows = 3;
        const numCols = 2;
        const optH = (infoPanelH - pad * (numRows + 1)) / numRows;

        // Two columns that strictly fit within left panel width minus outer padding
        const innerW = (leftPanelWidth - padding) - 2 * pad; // panel width minus equal side margins
        const optW = (innerW - (numCols - 1) * pad) / numCols;

        const col1X = padding + pad;
        const col2X = col1X + optW + pad;

        const row1Y = infoPanelY + pad;
        const row2Y = row1Y + optH + pad;
        const row3Y = row2Y + optH + pad;

        const c1X = col1X + optW / 2;
        const c2X = col2X + optW / 2;

        const valueSize = Math.max(14, optH * 0.38);
        const labelSize = Math.max(10, optH * 0.24);

        // Pink gradient option frames matching OPTIONS badge color
        const drawOptFrame = (fx: number, fy: number, fw: number, fh: number) => {
            ctx.save();
            const g = ctx.createLinearGradient(fx, fy, fx + fw, fy + fh);
            g.addColorStop(0, 'rgba(233, 30, 140, 0.25)');
            g.addColorStop(1, 'rgba(156, 39, 176, 0.15)');
            ctx.fillStyle = g;
            ctx.shadowColor = 'rgba(233,30,140,0.2)';
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.roundRect(fx, fy, fw, fh, 8);
            ctx.fill();
            ctx.lineWidth = 1.2;
            ctx.strokeStyle = 'rgba(233, 30, 140, 0.5)';
            ctx.shadowColor = 'transparent';
            ctx.stroke();
            ctx.restore();
        };

        // Row 1: BPM, DUR
        drawOptFrame(col1X, row1Y, optW, optH);
        drawOptFrame(col2X, row1Y, optW, optH);

        // Row 2: DIFFICULTY, SPEED
        drawOptFrame(col1X, row2Y, optW, optH);
        drawOptFrame(col2X, row2Y, optW, optH);

        // Row 3: KEY SETTING, BEST RECORD
        drawOptFrame(col1X, row3Y, optW, optH);
        drawOptFrame(col2X, row3Y, optW, optH);

        // High contrast values — vertically centered within each frame as a group
        // Total text block height is approx (valueSize + labelSize). Center the block in optH.
        const labelYOffset = optH * 0.32;
        const textYOffset = optH * 0.70;

        // BPM (Row 1, Col 1)
        this.drawCuteLabel(`${bpm} `, c1X, row1Y + textYOffset, 'center', valueSize, '#fff', true);
        this.drawCuteLabel("BPM", c1X, row1Y + labelYOffset, 'center', labelSize, '#ffd32a', true);

        // DUR (Row 1, Col 2)
        const totalSeconds = Math.floor(currentSong.duration || 120);
        const durMin = Math.floor(totalSeconds / 60);
        const durSec = (totalSeconds % 60).toString().padStart(2, '0');
        this.drawCuteLabel(`${durMin}:${durSec} `, c2X, row1Y + textYOffset, 'center', valueSize, '#fff', true);
        this.drawCuteLabel("DUR", c2X, row1Y + labelYOffset, 'center', labelSize, '#ffd32a', true);

        // Difficulty (Row 2, Col 1)
        const currentDiff = this.difficultyOptions[this.selectedDifficultyIndex];
        let diffColor = (currentDiff === 'HARD') ? '#ff7675' : (currentDiff === 'EASY' ? '#55efc4' : '#ffeaa7');

        this.drawCuteLabel(`◀  ${currentDiff}  ▶`, c1X, row2Y + textYOffset, 'center', valueSize, diffColor, true);
        this.drawCuteLabel("DIFFICULTY", c1X, row2Y + labelYOffset, 'center', labelSize, '#ffd32a', true);

        // Speed (Row 2, Col 2)
        this.drawCuteLabel(`◀  x${this.scrollSpeed.toFixed(1)}  ▶`, c2X, row2Y + textYOffset, 'center', valueSize, '#a29bfe', true);
        this.drawCuteLabel("SPEED", c2X, row2Y + labelYOffset, 'center', labelSize, '#ffd32a', true);

        // Mode (4K / 6K) (Row 3, Col 1)
        const modeColor = this.keyMode === 4 ? '#00cec9' : '#e84393';
        this.drawCuteLabel(`◀  ${this.keyMode}K  ▶`, c1X, row3Y + textYOffset, 'center', valueSize, modeColor, true);
        this.drawCuteLabel("KEY SETTING", c1X, row3Y + labelYOffset, 'center', labelSize, '#ffd32a', true);

        // High Score (Row 3, Col 2)
        const highScore = this.scoreManager?.getHighScore(currentSong.url);

        if (highScore) {
            const gradeColor = (highScore.grade === 'F' || highScore.grade === 'D') ? '#ff7675' : (highScore.grade.includes('S') ? '#74b9ff' : '#55efc4');

            // Draw grade + score as a single centered group
            const scoreStr = highScore.score.toLocaleString();

            // Measure text widths to build a centered composite layout
            ctx.save();
            ctx.font = `bold ${valueSize}px "Orbitron", sans-serif`;
            const gradeW = ctx.measureText(highScore.grade).width;
            const gapW = valueSize * 0.4;
            const scoreW = ctx.measureText(scoreStr).width;
            const totalW = gradeW + gapW + scoreW;
            const startX = c2X - totalW / 2;
            ctx.restore();

            this.drawCuteLabel(highScore.grade, startX + gradeW / 2, row3Y + textYOffset, 'center', valueSize, gradeColor, true);
            this.drawCuteLabel(scoreStr, startX + gradeW + gapW + scoreW / 2, row3Y + textYOffset, 'center', valueSize * 0.9, '#fff', true);
            this.drawCuteLabel("BEST RECORD", c2X, row3Y + labelYOffset, 'center', labelSize, '#ffd32a', true);
        } else {
            this.drawCuteLabel("NO DATA", c2X, row3Y + textYOffset, 'center', valueSize * 0.8, '#b2bec3', true);
            this.drawCuteLabel("BEST RECORD", c2X, row3Y + labelYOffset, 'center', labelSize, '#ffd32a', true);
        }

        const listInnerY = listY + 26 + 10; // below tab
        // Song list: 7 items + bottom play button
        const visibleCount = 7;
        const btnAreaH = Math.max(60, height * 0.09);
        const listBtnGap = Math.max(10, height * 0.015); // gap between last item and play button
        // listAvailH accounts for tab(26+10), gap, and button area so itemHeight is correct
        const listAvailH = listH - 26 - 10 - listBtnGap - btnAreaH - 8;
        const itemHeight = listAvailH / visibleCount;

        // Scrollbar: top = listInnerY, bottom = bottom of last item (same as list items)
        const scrollbarW = 28;
        const scrollbarX = listX + 6;
        const scrollbarY = listInnerY;
        const scrollbarH = visibleCount * itemHeight; // exactly same height as song list

        const listInnerX = listX + scrollbarW + 14; // content starts after scrollbar
        const listInnerW = listW - (scrollbarW + 14) - 10;

        const maxScrollOffset = Math.max(0, this.songList.length - visibleCount);
        let visibleStartIndex = this.selectedSongIndex - Math.floor(visibleCount / 2);
        if (visibleStartIndex < 0) visibleStartIndex = 0;
        if (visibleStartIndex > maxScrollOffset) visibleStartIndex = maxScrollOffset;

        // Scrollbar: inside song list left edge
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(scrollbarX, scrollbarY, scrollbarW, scrollbarH, 7);
        ctx.fill();
        ctx.stroke();

        // Thumb: reactive size based on song count
        const thumbRatio = Math.min(1, visibleCount / Math.max(1, this.songList.length));
        const thumbH = Math.max(28, scrollbarH * thumbRatio);
        const scrollProgress = maxScrollOffset > 0 ? visibleStartIndex / maxScrollOffset : 0;
        const thumbY = scrollbarY + scrollProgress * (scrollbarH - thumbH);

        const thumbGrad = ctx.createLinearGradient(scrollbarX, thumbY, scrollbarX + scrollbarW, thumbY + thumbH);
        thumbGrad.addColorStop(0, '#38bdf8');   // sky blue
        thumbGrad.addColorStop(0.5, '#0ea5e9'); // ocean blue
        thumbGrad.addColorStop(1, '#2563eb');   // deep blue
        ctx.fillStyle = thumbGrad;
        ctx.shadowColor = 'rgba(14, 165, 233, 0.6)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 0;
        ctx.beginPath();
        ctx.roundRect(scrollbarX, thumbY, scrollbarW, thumbH, 7);
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        // Reset ALL shadow state before stroke and further draws to prevent flicker
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.shadowOffsetX = 0;
        ctx.stroke();
        ctx.restore();

        // Draw List Content
        const listContentX = listInnerX;
        const listContentW = listInnerW;

        ctx.save();
        ctx.translate(listContentX, listInnerY);

        for (let i = 0; i < visibleCount; i++) {
            const index = visibleStartIndex + i;
            if (index >= this.songList.length) break;

            const song = this.songList[index];
            const y = i * itemHeight;
            const isSelected = (index === this.selectedSongIndex);

            ctx.save();
            ctx.translate(0, y);

            if (isSelected) {
                this.drawCuteTile(0, 5, listContentW, itemHeight - 10, '#1a73e8', true);
            } else {
                // Premium gradient row styling
                ctx.save();
                const rowGrad = ctx.createLinearGradient(0, 5, listContentW, itemHeight - 5);
                rowGrad.addColorStop(0, 'rgba(100, 120, 200, 0.35)');
                rowGrad.addColorStop(1, 'rgba(60, 80, 160, 0.15)');
                ctx.fillStyle = rowGrad;
                ctx.shadowColor = 'rgba(100, 140, 255, 0.2)';
                ctx.shadowBlur = 6;
                ctx.beginPath();
                ctx.roundRect(0, 5, listContentW, itemHeight - 10, 10);
                ctx.fill();
                ctx.lineWidth = 1;
                ctx.strokeStyle = 'rgba(160, 190, 255, 0.35)';
                ctx.shadowColor = 'transparent';
                ctx.stroke();
                ctx.restore();
            }

            // Index number - proportional to itemHeight
            const idxFontSize = itemHeight * 0.38;
            const idxW = idxFontSize * 2.2; // Width budget for the index column
            const idxColor = isSelected ? '#fff' : 'rgba(160, 185, 255, 0.7)';
            this.drawCuteLabel((index + 1).toString().padStart(2, '0'), idxW / 2 + 6, itemHeight * 0.5, 'center', idxFontSize, idxColor, false, '"Nunito", sans-serif');

            let songTitle = song.name;
            const titleX = idxW + 18; // Song name starts right after the number column with a gap
            const maxTitleW = listContentW * (isSelected ? 0.6 : 0.82) - titleX;

            // Critical fix: set sophisticated font before measuring
            const titleFontSize = itemHeight * 0.45;
            ctx.font = `700 ${titleFontSize}px "Nunito", sans-serif`;

            if (ctx.measureText(songTitle).width > maxTitleW) {
                while (ctx.measureText(songTitle + "...").width > maxTitleW && songTitle.length > 0) {
                    songTitle = songTitle.substring(0, songTitle.length - 1);
                }
                songTitle += "...";
            }

            const songColor = isSelected ? '#fff' : 'rgba(220, 230, 255, 0.95)';
            this.drawCuteLabel(songTitle, titleX, itemHeight * 0.5, 'left', titleFontSize, songColor, isSelected, '"Nunito", sans-serif');

            if (isSelected) {
                const animOffset = Math.sin(time * 6) * 4; // Bobs left and right
                this.drawCuteLabel("▶▶", listContentW - 24 + animOffset, itemHeight * 0.5, 'right', itemHeight * 0.40, '#fff', false, '"Nunito", sans-serif');
            }
            ctx.restore();
        }
        ctx.restore();
        // PLAY NOW button: full width inside SONG LIST panel, clamped to stay inside frame
        const btnMargin = 6;
        const btnH2 = btnAreaH;
        const btnX2 = listX + btnMargin;
        const btnW2 = listW - btnMargin * 2;
        const btnY2Natural = listInnerY + visibleCount * itemHeight + listBtnGap;
        const btnY2Max = listY + listH - btnH2 - btnMargin;
        const btnY2 = Math.min(btnY2Natural, btnY2Max);

        const pulse = 0.5 + Math.sin(time * 4) * 0.5;
        const shimmer = (Math.sin(time * 3) + 1) / 2;

        ctx.save();
        const btnGrad2 = ctx.createLinearGradient(btnX2, btnY2, btnX2 + btnW2, btnY2 + btnH2);
        btnGrad2.addColorStop(0, `hsl(${270 + shimmer * 30}, 80%, 60%)`);
        btnGrad2.addColorStop(0.5, '#f9ca24');
        btnGrad2.addColorStop(1, '#f0932b');
        ctx.fillStyle = btnGrad2;
        ctx.shadowBlur = 12 + pulse * 18;
        ctx.shadowColor = `rgba(249, 202, 36, ${0.5 + pulse * 0.4})`;
        ctx.shadowOffsetY = 3;
        ctx.beginPath();
        ctx.roundRect(btnX2, btnY2, btnW2, btnH2, 16);
        ctx.fill();

        // Fully reset shadow so gloss + border are not tainted
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.shadowOffsetX = 0;

        // Top gloss
        const gloss2 = ctx.createLinearGradient(btnX2, btnY2, btnX2, btnY2 + btnH2 * 0.55);
        gloss2.addColorStop(0, `rgba(255,255,255,${0.3 + shimmer * 0.2})`);
        gloss2.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gloss2;
        ctx.beginPath();
        ctx.roundRect(btnX2, btnY2, btnW2, btnH2 * 0.55, [16, 16, 0, 0]);
        ctx.fill();

        // Border
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = `rgba(255,255,255,0.8)`;
        ctx.beginPath();
        ctx.roundRect(btnX2, btnY2, btnW2, btnH2, 16);
        ctx.stroke();

        const fontSize2 = Math.min(24, Math.max(16, btnH2 * 0.45));
        this.drawCuteLabel('PLAY NOW', btnX2 + btnW2 / 2, btnY2 + btnH2 / 2, 'center', fontSize2, '#fff', true);
        ctx.restore();

        // --- DRAW BACK BUTTON (Top Right) ---
        // 최상단 렌더링을 위해 메서드 끝에서 실행
        ctx.save();
        const backBtnW = 116;
        const backBtnH = 24;
        const backBtnX = width - padding - backBtnW;
        const backBtnY = 6;

        // Compact Neon Glow Effect
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(255, 0, 255, 0.6)';
        ctx.fillStyle = 'rgba(20, 0, 40, 0.85)';
        ctx.strokeStyle = '#ff00ff';
        ctx.lineWidth = 1.8;

        ctx.beginPath();
        ctx.roundRect(backBtnX, backBtnY, backBtnW, backBtnH, 6);
        ctx.fill();
        ctx.stroke();

        // Compact font for the smaller button
        ctx.shadowBlur = 3;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.fillStyle = '#fff';
        ctx.font = '900 12px "Orbitron", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🏠 MAIN MENU', backBtnX + backBtnW / 2, backBtnY + backBtnH / 2 + 1);
        ctx.restore();
    }
    private handleMenuInput(e: KeyboardEvent): void {
        let selectionChanged = false;
        if (e.code === 'ArrowUp') {
            this.selectedSongIndex = (this.selectedSongIndex - 1 + this.songList.length) % this.songList.length;
            selectionChanged = true;
        } else if (e.code === 'ArrowDown') {
            this.selectedSongIndex = (this.selectedSongIndex + 1) % this.songList.length;
            selectionChanged = true;
        } else if (e.code === 'ArrowLeft') {
            this.selectedSpeedIndex = Math.max(0, this.selectedSpeedIndex - 1);
            this.scrollSpeed = this.speedOptions[this.selectedSpeedIndex];
        } else if (e.code === 'ArrowRight') {
            this.selectedSpeedIndex = Math.min(this.speedOptions.length - 1, this.selectedSpeedIndex + 1);
            this.scrollSpeed = this.speedOptions[this.selectedSpeedIndex];
        } else if (e.code === 'KeyQ') {
            this.selectedDifficultyIndex = Math.max(0, this.selectedDifficultyIndex - 1);
        } else if (e.code === 'KeyE') {
            this.selectedDifficultyIndex = Math.min(this.difficultyOptions.length - 1, this.selectedDifficultyIndex + 1);
        } else if (e.code === 'Enter') {
            // Stop preview before starting
            if (this.previewTimeout) clearTimeout(this.previewTimeout);
            this.audioEngine.stop();

            this.shouldAutoStart = true; // Request start after load
            this.load().then(() => this.create());
        }

        if (selectionChanged) {
            this.playPreview();
        }
    }

    private playPreview(): void {
        if (this.previewTimeout) clearTimeout(this.previewTimeout);
        this.audioEngine.stop();

        // Increment Token: Any previous playPreview tasks will now be considered 'stale'
        const myId = ++this.currentPreviewId;

        this.previewTimeout = setTimeout(async () => {
            if (this.currentState !== GameState.MENU || this.currentPreviewId !== myId) return;

            try {
                const song = this.songList[this.selectedSongIndex];
                console.log(`[RhythmGame] Loading preview: ${song.name} (id:${myId})`);

                // 1. Check Cache
                if (this.cachedMidi && this.cachedMidi.url === song.url) {
                    console.log(`[RhythmGame] Preview using cache: ${song.name}`);
                    await this.audioEngine.loadMidi(this.cachedMidi.buffer);
                } else {
                    const res = await fetch(song.url);
                    // Check if stale after fetch
                    if (this.currentState !== GameState.MENU || this.currentPreviewId !== myId) return;

                    const buffer = await res.arrayBuffer();
                    // Check if stale after arrayBuffer
                    if (this.currentState !== GameState.MENU || this.currentPreviewId !== myId) return;

                    await this.audioEngine.loadMidi(buffer);

                    // Parse and Cache for subsequent Start
                    const parser = new MidiParser();
                    const parsed = await parser.parse(buffer);
                    // Final check before committing to cache and playing
                    if (this.currentState !== GameState.MENU || this.currentPreviewId !== myId) return;

                    this.cachedMidi = { url: song.url, buffer: buffer, parsed: parsed };
                }

                if (this.currentState === GameState.MENU && this.currentPreviewId === myId) {
                    this.audioEngine.play();
                }
            } catch (e) {
                console.warn("[RhythmGame] Preview load failed:", e);
            }
        }, 500); // 500ms debounce
    }

    private getSeededColor(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        // HSL Color Generaton for "Cool Sci-Fi" Theme
        // Hue: 160 (Cyan) to 320 (Magenta) -> Avoids Yellow/Orange/Brown
        const hue = 160 + Math.abs(hash % 160);
        const saturation = 80 + Math.abs(hash % 20); // 80-100%
        const lightness = 60 + Math.abs(hash % 20);  // 60-80%
        return `hsl(${hue}, ${saturation} %, ${lightness} %)`;
    }

    // --- High-Fidelity Rendering Helpers ---

    private drawAtmosphere(width: number, height: number): void {
        const ctx = this.ctx;
        // Background layer is now managed by global BackgroundRenderer
        // We just clear this canvas so it shows through
        ctx.clearRect(0, 0, width, height);
    }

    private drawCuteTile(x: number, y: number, w: number, h: number, color: string, isActive: boolean = false): void {
        const ctx = this.ctx;
        ctx.save();

        ctx.fillStyle = color; // Trust the provided color including alpha

        ctx.shadowColor = isActive ? color : 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = isActive ? 15 : 6;
        ctx.shadowOffsetY = 2;

        ctx.beginPath();
        ctx.roundRect(x, y, w, h, isActive ? 20 : 12);
        ctx.fill();

        // Glowing border
        if (isActive) {
            ctx.lineWidth = 4;
            ctx.strokeStyle = 'white';
            ctx.shadowColor = 'transparent';
        } else {
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.shadowColor = 'transparent';
        }
        ctx.stroke();

        ctx.restore();
    }

    private drawCuteLabel(text: string, x: number, y: number, align: CanvasTextAlign = 'left', size: number = 14, color: string = '#636e72', outline: boolean = false, fontFam: string = '"Nunito", sans-serif'): void {
        const ctx = this.ctx;
        ctx.save();
        ctx.font = `800 ${size}px ${fontFam}`;
        ctx.textAlign = align;
        ctx.textBaseline = 'middle';

        if (outline) {
            // Full outline stroke: black shadow + stroke, then fill
            ctx.shadowColor = 'rgba(0,0,0,0.85)';
            ctx.shadowBlur = 6;
            ctx.shadowOffsetY = 3;
            ctx.shadowOffsetX = 0;
            ctx.lineWidth = 3.5;
            ctx.strokeStyle = 'rgba(0,0,0,0.75)';
            ctx.lineJoin = 'round';
            ctx.strokeText(text, x, y);
        } else {
            // Lightweight: just a soft drop-shadow on the fill, no strokeText (perf)
            ctx.shadowColor = 'rgba(0,0,0,0.6)';
            ctx.shadowBlur = 3;
            ctx.shadowOffsetY = 2;
            ctx.shadowOffsetX = 0;
        }

        ctx.fillStyle = color;
        ctx.fillText(text, x, y);

        // Always reset shadow to avoid leaking into subsequent draws
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.restore();
    }

    private drawVisualizer(cx: number, cy: number, radius: number, time: number, color: string, bpm: number): void {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(cx, cy);

        // Layer 1: Base Ring 
        ctx.rotate(time * -0.2);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 4;
        ctx.shadowColor = 'rgba(0,0,0,0.1)';
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 1.2, 0, Math.PI * 2);
        ctx.stroke();

        // Layer 2: Main Data Ring (Pulsing)
        const pulse = Math.sin(time * (bpm / 60) * Math.PI);
        ctx.rotate(time * 0.4);
        ctx.strokeStyle = color;
        ctx.lineWidth = 6;
        ctx.shadowBlur = 10;
        ctx.shadowColor = color;
        ctx.beginPath();
        ctx.arc(0, 0, radius + pulse * 5, 0, Math.PI * 2);
        ctx.stroke();

        // Layer 3: Reactive Bars (Cute Rounded)
        const bars = 24;
        for (let i = 0; i < bars; i++) {
            const angle = (Math.PI * 2 / bars) * i;
            const barLen = 10 + Math.abs(Math.sin(time * 4 + i)) * 20 * (pulse + 1);

            ctx.save();
            ctx.rotate(angle);
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.roundRect(radius + 15, -4, barLen, 8, 4);
            ctx.fill();
            ctx.restore();
        }

        ctx.restore();
    }

    public destroy(): void {
        this.audioEngine.stop();
        this.currentState = GameState.MENU;
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
        this.canvas.removeEventListener('touchstart', this.handleTouchStart);
        this.canvas.removeEventListener('touchmove', this.handleTouchMove);
        this.canvas.removeEventListener('touchend', this.handleTouchEnd);
        this.canvas.removeEventListener('mousedown', this.handleMouseDown);
        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        this.canvas.removeEventListener('mouseup', this.handleMouseUp);
        this.canvas.removeEventListener('mouseleave', this.handleMouseUp);
    }
}
