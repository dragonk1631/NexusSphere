import { BaseGame } from '../../core/BaseGame';
import { ASSET_PATHS } from '../../core/asset/AssetRegistry';
import { MidiParser } from '../../core/audio/MidiParser';
import type { ParsedMidi } from '../../core/audio/MidiParser';
import { NoteFactory } from './NoteFactory';
import type { VisualNote } from './NoteFactory';
import { ScoreManager } from '../../core/score/ScoreManager';
import { MelodyAnalyzer } from '../../core/audio/MelodyAnalyzer';
import { RenderCache } from './graphics/RenderCache';

// Game States
const GameState = {
    MENU: 0,
    PLAYING: 1,
    RESULT: 2
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

    private currentState: GameState = GameState.MENU;
    private shouldAutoStart = false; // Prevents auto-start on boot
    private scoreManager: ScoreManager | null = null;

    // Menu State
    private songList: SongEntry[] = [
        { name: 'Test Song', url: ASSET_PATHS.AUDIO.MIDI.TEST }
    ];
    private selectedSongIndex = 0;
    private previewTimeout: ReturnType<typeof setTimeout> | null = null;
    private speedOptions = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0];
    private selectedSpeedIndex = 1; // Default 1.0x
    private difficultyOptions = ['EASY', 'NORMAL', 'HARD'];
    private selectedDifficultyIndex = 1; // Default NORMAL
    private touchStartY = 0;
    private menuAnimationTimer = 0;
    private particles: { x: number, y: number, speed: number, alpha: number, size: number }[] = [];
    private explosions: Explosion[] = [];


    // Settings
    private scrollSpeed = 1.0; // Default 1.0x
    private laneCount = 6;
    private endGameTimer = 0;
    private lastCombo = 0;
    private comboAnim = 0; // 0 to 1 anim factor
    private preGameTimer = 0;
    private isAudioStarted = false;

    // FPS Counter
    private lastFpsTime = 0;
    private frameCount = 0;
    private currentFps = 0;

    // Perspective Configuration
    private readonly horizonYRatio = 0.0; // Horizon at top (Maximize Highway)
    private readonly bottomYRatio = 1.0;  // Highway ends at bottom
    private readonly hitLineYRatio = 0.9; // Hit line near bottom

    private horizonY = 0;
    private bottomY = 0;
    private hitLineY = 0;

    // Highway Widths
    private laneBottomWidth = 100; // Calculated in init
    private laneTopWidth = 10;     // Narrow at horizon

    private renderCache: RenderCache | null = null;

    // Visual Assets / Constants
    private readonly COLORS = {
        LANES: [
            ['#ff0099', '#ff66cc'], // Lane 0: Pink
            ['#ff9900', '#ffcc00'], // Lane 1: Orange/Yellow
            ['#00ff00', '#66ff66'], // Lane 2: Green
            ['#00ffff', '#66ffff'], // Lane 3: Cyan
            ['#0066ff', '#66a3ff'], // Lane 4: Blue
            ['#cc00ff', '#e666ff'], // Lane 5: Purple
        ],
        LANE_BORDER: '#444444',
        HIT_LINE_GLOW: '#00ffff',
        HUD_BG: 'rgba(0, 0, 0, 0.7)',
        TEXT_GLOW: '#ffffff'
    };

    constructor(canvas: HTMLCanvasElement) {
        super(canvas);
        // Bind input methods properly
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        this.handleTouchStart = this.handleTouchStart.bind(this);
        this.handleTouchMove = this.handleTouchMove.bind(this);
        this.handleTouchEnd = this.handleTouchEnd.bind(this);

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

        // Re-generate Highway Cache on resize
        if (this.renderCache) {
            this.renderCache.renderHighwayToCache(
                width, height,
                this.horizonY, this.bottomY,
                this.laneCount,
                this.getPerspectiveX.bind(this)
            );
        }
    }

    public async init(): Promise<void> {
        console.log("[RhythmGame] Initializing...");

        // Initial Resize
        this.resize(this.canvas.width, this.canvas.height);

        this.scoreManager = ScoreManager.getInstance();
        this.scoreManager.reset(); // Reset score/health on game start attempt (though init is called once, we might need to call reset on start)

        // Initialize RenderCache
        this.renderCache = RenderCache.getInstance();
        this.renderCache.init();

        // Input Handling
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);

        // Mobile Touch Support
        this.canvas.addEventListener('touchstart', this.handleTouchStart, { passive: false });
        this.canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
        this.canvas.addEventListener('touchend', this.handleTouchEnd, { passive: false });

        // Create Initial Particles
        for (let i = 0; i < 30; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                speed: 0.2 + Math.random() * 0.5,
                alpha: Math.random(),
                size: Math.random() * 2
            });
        }

        // Start Menu Animation Loop - REMOVED (Handled by Main Loop)
        // ensure main loop handles calculation




        // Load Song List
        try {
            const res = await fetch('assets/data/midi_list.json');
            if (res.ok) {
                const list = await res.json();
                if (Array.isArray(list) && list.length > 0) {
                    this.songList = list;
                    console.log(`[RhythmGame] Loaded ${list.length} songs.`);
                }
            }
        } catch (e) {
            console.warn('[RhythmGame] Failed to load song list, using default.', e);
        }

        // Load Default Song Data (Load first song or selected)
        await this.load();
    }

    // Touch Handling
    private handleTouchStart(e: TouchEvent): void {
        e.preventDefault();

        if (this.currentState === GameState.MENU) {
            this.handleMenuTouch(e);
            return;
        }

        if (this.currentState === GameState.RESULT) {
            this.currentState = GameState.MENU;
            this.scoreManager?.reset();
            return;
        }

        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            const lane = this.getLaneFromTouch(touch.clientX, touch.clientY);
            // Trigger Hit Check if lane is valid and not already held
            if (lane !== -1 && !this.keyState[lane]) {
                this.keyState[lane] = true;
                this.checkHit(lane);
            }
        }
    }

    private handleMenuTouch(e: TouchEvent): void {
        const touch = e.changedTouches[0]; // Handle single touch for menu
        this.touchStartY = touch.clientY;
        const x = touch.clientX;
        const y = touch.clientY;
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Layout Config (Must match renderMenu)
        const padding = 20;
        const leftPanelWidth = width * 0.45;
        const rightPanelX = width * 0.5;

        // Panel 2: Info & Speed
        const visPanelH = height * 0.55;
        const visY = padding;
        const infoY = visY + visPanelH + padding;
        const infoH = height - infoY - padding;
        const speedControlY = infoY + infoH - 50;

        if (x > width * 0.7 && y > height * 0.85) {
            // Stop preview before starting
            if (this.previewTimeout) clearTimeout(this.previewTimeout);
            this.audioEngine.stop();

            this.shouldAutoStart = true;
            this.load().then(() => this.create());
            return;
        }

        // 2. Check Speed Controls (Bottom Left Panel)
        // Hitbox around the "SPEED" text and arrows
        if (x < leftPanelWidth && y > speedControlY - 20 && y < speedControlY + 60) {
            const centerX = padding + (leftPanelWidth - 2 * padding) * 0.5;
            if (x < centerX) {
                // Slower
                this.selectedSpeedIndex = Math.max(0, this.selectedSpeedIndex - 1);
            } else {
                // Faster
                this.selectedSpeedIndex = Math.min(this.speedOptions.length - 1, this.selectedSpeedIndex + 1);
            }
            this.scrollSpeed = this.speedOptions[this.selectedSpeedIndex];
            return;
        }

        // 3. Check Song List (Right Panel)
        const listY = padding;
        const listH = height - 2 * padding;
        const listInnerY = listY + 10;
        const itemHeight = (listH - 20) / 7;
        const visibleCount = 7;

        if (x > rightPanelX + 10 && x < width - padding - 10 && y > listInnerY && y < listInnerY + (itemHeight * visibleCount)) {

            const relativeY = y - listInnerY;
            const clickedIndexOffset = Math.floor(relativeY / itemHeight);

            // Determine start index based on scroll (centering selected but clamped)
            let startIndex = this.selectedSongIndex - Math.floor(visibleCount / 2);
            if (startIndex < 0) startIndex = 0;
            if (startIndex > this.songList.length - visibleCount) startIndex = Math.max(0, this.songList.length - visibleCount);

            if (clickedIndexOffset >= 0 && clickedIndexOffset < visibleCount) {
                const targetIndex = startIndex + clickedIndexOffset;
                if (targetIndex >= 0 && targetIndex < this.songList.length) {
                    this.selectedSongIndex = targetIndex;
                    this.playPreview();
                }
            }
        }
    }

    private handleTouchMove(e: TouchEvent): void {
        e.preventDefault();
        if (this.currentState === GameState.MENU) {
            const touch = e.changedTouches[0];
            const diffY = touch.clientY - this.touchStartY;
            const threshold = 50; // Pixel threshold for swipe action

            if (Math.abs(diffY) > threshold) {
                if (diffY > 0) {
                    // Swipe Down -> List moves down (Selection Up)
                    this.selectedSongIndex = (this.selectedSongIndex - 1 + this.songList.length) % this.songList.length;
                } else {
                    // Swipe Up -> List moves up (Selection Down)
                    this.selectedSongIndex = (this.selectedSongIndex + 1) % this.songList.length;
                }
                this.touchStartY = touch.clientY; // Reset start to allow continuous scrolling
                this.playPreview();
            }
        }
    }

    private handleTouchEnd(e: TouchEvent): void {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            const lane = this.getLaneFromTouch(touch.clientX, touch.clientY);
            if (lane !== -1) {
                this.keyState[lane] = false;
            }
        }
    }

    private getLaneFromTouch(x: number, y: number): number {
        // Perspective-based Touch Zones
        // We match visual lanes at the bottom (hit line) area
        const totalWidthBottom = this.laneBottomWidth * this.laneCount;
        const startX = (this.canvas.width - totalWidthBottom) / 2;

        if (y < this.canvas.height * 0.5) return -1; // Ignore top half

        // Map x to lane index based on bottom width (widest point)
        // This is a simplification but works well for the "near hit line" interaction
        if (x < startX || x > startX + totalWidthBottom) return -1;

        const lane = Math.floor((x - startX) / this.laneBottomWidth);
        return Math.max(0, Math.min(lane, this.laneCount - 1));
    }

    // Input States
    private keyState: boolean[] = [false, false, false, false, false, false];

    private handleKeyDown(e: KeyboardEvent): void {
        if (this.currentState === GameState.MENU) {
            this.handleMenuInput(e);
            return;
        }

        if (this.currentState === GameState.RESULT) {
            if (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape') {
                this.currentState = GameState.MENU;
                this.scoreManager?.reset();
            }
            return;
        }

        if (e.repeat) return; // Prevent hold trigger

        const lane = this.getLaneFromKey(e.code);
        if (lane !== -1 && !this.keyState[lane]) {
            this.keyState[lane] = true;
            this.checkHit(lane); // Trigger Hit Check
        }
    }

    private handleKeyUp(e: KeyboardEvent): void {
        const lane = this.getLaneFromKey(e.code);
        if (lane !== -1) {
            this.keyState[lane] = false;
        }
    }

    private getLaneFromKey(code: string): number {
        const keyMap: { [key: string]: number } = {
            'KeyS': 0, 'KeyD': 1, 'KeyF': 2,
            'KeyJ': 3, 'KeyK': 4, 'KeyL': 5
        };
        return keyMap.hasOwnProperty(code) ? keyMap[code] : -1;
    }

    // Judgement State
    private lastJudgment: { text: string, color: string, time: number } | null = null;
    private readonly JUDGMENT_DURATION = 500; // ms

    private checkHit(lane: number): void {
        const currentTime = this.audioEngine.currentTime * 1000;
        const hitWindow = 200; // ms

        const candidates = this.visualNotes.filter(n =>
            n.lane === lane &&
            !n.isProcessed &&
            Math.abs(n.time * 1000 - currentTime) < hitWindow
        );

        if (candidates.length > 0) {
            // Find closest note (accuracy)
            candidates.sort((a, b) => Math.abs(a.time * 1000 - currentTime) - Math.abs(b.time * 1000 - currentTime));
            const targetNote = candidates[0];

            const diff = Math.abs(targetNote.time * 1000 - currentTime);
            let judgmentText = '';
            let judgmentColor = '';
            let score = 0;

            if (diff < 40) {
                judgmentText = 'PERFECT';
                judgmentColor = '#00ffff'; // Cyan
                score = 100;
            } else if (diff < 100) {
                judgmentText = 'GREAT';
                judgmentColor = '#00ff00'; // Green
                score = 80;
            } else {
                judgmentText = 'GOOD';
                judgmentColor = '#ffff00'; // Yellow
                score = 50;
            }

            // Apply Score & Effects
            if (this.scoreManager) this.scoreManager.addHit(score, judgmentText as any);
            this.showJudgment(judgmentText, judgmentColor);

            targetNote.isProcessed = true;
            this.triggerExplosion(targetNote.lane, currentTime);
            console.log(`Hit Lane ${lane}: ${judgmentText} (${Math.round(diff)}ms)`);

        } else {
            // Empty Hit (Ghost Tap) - Optional: Decrease health or just ignore
            // For this style of game, often ignored or treated as a slight penalty logic, keeping simple for now.
        }
    }

    private triggerMiss(note: VisualNote): void {
        note.isProcessed = true;
        if (this.scoreManager) {
            this.scoreManager.addHit(0, 'MISS');
        }
        this.showJudgment('MISS', '#ff0000');
    }

    private showJudgment(text: string, color: string): void {
        this.lastJudgment = {
            text: text,
            color: color,
            time: performance.now()
        };
    }

    // --- In Update Loop ---
    // We need to check for missed notes
    private updateMissedNotes(currentTime: number): void {
        const missThreshold = 200; // If note passes by 200ms, it's a miss

        this.visualNotes.forEach(note => {
            if (!note.isProcessed) {
                const noteTimeMs = note.time * 1000;
                if (currentTime > noteTimeMs + missThreshold) {
                    this.triggerMiss(note);
                }
            }
        });
    }

    // --- In Render Method ---
    private renderJudgment(ctx: CanvasRenderingContext2D, width: number, height: number): void {
        if (!this.lastJudgment) return;

        const now = performance.now();
        const age = now - this.lastJudgment.time;

        if (age > this.JUDGMENT_DURATION) {
            this.lastJudgment = null;
            return;
        }

        const alpha = 1 - (age / this.JUDGMENT_DURATION);
        const scale = 1 + (1 - alpha) * 0.5; // Pop out effect

        ctx.save();
        ctx.translate(width / 2, height * 0.45);
        ctx.scale(scale, scale);
        ctx.globalAlpha = alpha;

        ctx.fillStyle = this.lastJudgment.color;
        ctx.shadowColor = this.lastJudgment.color;
        ctx.shadowBlur = 20;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Use a thick, cool font
        ctx.font = 'italic 900 60px "Orbitron", sans-serif';
        ctx.fillText(this.lastJudgment.text, 0, 0);

        // Stroke for readability
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeText(this.lastJudgment.text, 0, 0);

        ctx.restore();
    }


    public async load(): Promise<void> {
        console.log("[RhythmGame] Loading assets...");
        await this.audioEngine.init(ASSET_PATHS.AUDIO.SOUNDFONTS.DEFAULT);

        // Load Default Song
        const midiUrl = this.songList[this.selectedSongIndex].url; // Use selected song
        const midiRes = await fetch(midiUrl);
        const midiBuffer = await midiRes.arrayBuffer();

        const parser = new MidiParser();
        this.midiData = await parser.parse(midiBuffer);
        await this.audioEngine.loadMidi(midiBuffer);

        // Attempt to load Beatmap JSON
        const midiName = midiUrl.split('/').pop()?.replace(/\.mid$/i, '') || 'test';
        const beatmapUrl = `${ASSET_PATHS.DATA.BEATMAPS}${midiName}.json`;

        try {
            console.log(`[RhythmGame] Checking for beatmap at: ${beatmapUrl}`);
            const res = await fetch(beatmapUrl);

            // Check for successful response AND correct content type
            const contentType = res.headers.get("content-type");
            if (res.ok && contentType && contentType.includes("application/json")) {
                this.beatmapData = await res.json();
                console.log("[RhythmGame] Custom beatmap found and loaded.");
            } else {
                // Soft 404 (Server returns 200 OK HTML for missing files) or actual 404
                // This is EXPECTED behavior for auto-generated songs.
                console.log(`[RhythmGame] No custom beatmap found (Server Status: ${res.status}, Type: ${contentType}). Proceeding with Smart Charting Engine.`);
                this.beatmapData = null;
            }
        } catch (e) {
            console.warn("[RhythmGame] Error checking beatmap (Safe to ignore if using auto-gen):", e);
            this.beatmapData = null;
        }
    }

    public create(): void {
        console.log("[RhythmGame] Creating Game Objects...");

        if (this.midiData) {
            let targetChannels: number[] = [];

            // 1. Check Beatmap Data for Channel (User Input: 1-based -> Internal: 0-based)
            if (this.beatmapData && this.beatmapData.gameChannels && this.beatmapData.gameChannels.length > 0) {
                targetChannels = this.beatmapData.gameChannels.map((ch: number) => ch - 1);
                console.log(`[RhythmGame] Using Beatmap Channels (Adjusted): ${targetChannels.join(', ')}`);
            }

            // 2. Fallback
            if (targetChannels.length === 0) {
                console.log("[RhythmGame] Running Melody Analyzer (Channel-Based)...");
                // ... rest of logic
                const rankedChannels = MelodyAnalyzer.findMelodyChannels(this.midiData);
                if (rankedChannels.length > 0) {
                    targetChannels = rankedChannels.slice(0, 3);
                    console.log(`[RhythmGame] Auto-Selected Channels: ${targetChannels.join(', ')}`);
                }
            }

            // 3. Last Resort
            if (targetChannels.length === 0) {
                // ... existing last resort logic
                const channelCounts = new Array(16).fill(0);
                this.midiData.tracks.forEach(t => {
                    if (!t.isDrum) channelCounts[t.channel] += t.noteCount;
                });
                // ... find max
                let maxCh = 0; let maxCount = -1;
                channelCounts.forEach((count, ch) => {
                    if (count > maxCount) { maxCount = count; maxCh = ch; }
                });
                targetChannels = [maxCh];
            }

            // Generate Visual Notes
            const difficulty = this.difficultyOptions[this.selectedDifficultyIndex];
            this.visualNotes = NoteFactory.createNotes(this.midiData, this.laneCount, targetChannels, difficulty);

            console.log(`[RhythmGame] Created ${this.visualNotes.length} notes.`);
            if (this.scoreManager) {
                this.scoreManager.setTotalNotes(this.visualNotes.length);
            }

            // Only start if explicitly requested (e.g. from Menu)
            if (this.midiData && this.shouldAutoStart) {
                this.shouldAutoStart = false; // Reset
                this.start();
            }
        }
    }

    private async start() {
        // 1. Prepare Audio
        this.audioEngine.stop(); // Stop any pending previews/remnants
        this.audioEngine.seek(0);
        await this.audioEngine.resume();

        // 2. Reset Game State
        this.scoreManager?.reset();
        this.lastCombo = 0;
        this.comboAnim = 0;
        this.endGameTimer = 0;
        this.preGameTimer = -2000; // Start with 2 seconds lead-in (negative time)
        this.isAudioStarted = false;

        // 3. Set state to PLAYING but don't call play() yet
        // The update loop will handle the countdown
        this.currentState = GameState.PLAYING;
        console.log("[RhythmGame] Game Started with 2s lead-in.");
    }

    public update(delta: number): void {
        // FPS Calculation
        const now = performance.now();
        if (now - this.lastFpsTime >= 1000) {
            this.currentFps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsTime = now;
        }
        this.frameCount++;

        if (this.currentState === GameState.MENU) {
            this.menuAnimationTimer += delta * 0.001; // Use delta for smooth animation
            this.render(0);
            return;
        }

        if (this.currentState === GameState.RESULT) {
            this.render(0);
            // Handle Result Input elsewhere
            return;
        }

        if (this.currentState !== GameState.PLAYING) return;

        // Lead-In Logic
        let currentTime = 0;
        if (!this.isAudioStarted) {
            this.preGameTimer += delta;
            currentTime = this.preGameTimer;
            if (this.preGameTimer >= 0) {
                this.audioEngine.play();
                this.isAudioStarted = true;
                // Avoid tiny jump: currentTime remains 0 or slight positive
            }
        } else {
            currentTime = this.audioEngine.currentTime * 1000;
        }

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

        // Update Explosions
        this.explosions.forEach(exp => {
            exp.radius += 2;
            exp.alpha -= 0.05;
        });
        this.explosions = this.explosions.filter(exp => exp.alpha > 0);

        this.render(currentTime);

        // Check Game Over (with 2s protection + 2s lead-in = 4s total safety)
        if (this.scoreManager?.isDead()) {
            if (currentTime > 2000) {
                this.finishGame("HP Depleted (Health <= 0)");
                return;
            }
        }

        if (this.midiData) {
            const durationMs = this.midiData.duration * 1000;
            if (currentTime >= durationMs - 100) {
                this.endGameTimer += delta;
            }

            if (this.endGameTimer > 2000) {
                this.finishGame("Song Completed Normally");
            }
        }
    }



    private triggerExplosion(lane: number, _time: number): void {
        const x = this.getPerspectiveX(lane, this.hitLineY) + this.getPerspectiveWidth(this.hitLineY) / 2;
        const colorSet = this.COLORS.LANES[lane] || this.COLORS.LANES[0];

        this.explosions.push({
            x: x,
            y: this.hitLineY,
            radius: 25, // Slightly larger explosions
            alpha: 1.0,
            color: colorSet[1]
        });
    }

    private finishGame(reason: string = "Unknown"): void {
        this.currentState = GameState.RESULT;
        this.audioEngine.stop();
        console.log(`[RhythmGame] Finished. Reason: ${reason}`);
    }

    private render(currentTime: number): void {
        const ctx = this.ctx;

        if (this.currentState === GameState.MENU) {
            this.renderMenu();
            return;
        }

        if (this.currentState === GameState.RESULT) {
            this.renderResult();
            return;
        }

        // 0. Mobile Orientation Check
        if (this.canvas.height > this.canvas.width) {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText("Please Rotate Device ⟳", this.canvas.width / 2, this.canvas.height / 2);
            return;
        }

        // 1. Warp Speed Background
        const bgGrad = ctx.createRadialGradient(
            this.canvas.width / 2, this.canvas.height / 2, 0,
            this.canvas.width / 2, this.canvas.height / 2, this.canvas.height
        );
        bgGrad.addColorStop(0, '#1a0033'); // Deep Center
        bgGrad.addColorStop(0.4, '#440066'); // Mid Purple
        bgGrad.addColorStop(1, '#000000'); // Black edges
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Speed Lines (Warp Effect)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 20; i++) {
            const angle = (Date.now() * 0.0005 + i * 0.5) % (Math.PI * 2);
            const x1 = this.canvas.width / 2 + Math.cos(angle) * 50;
            const y1 = this.canvas.height / 2 + Math.sin(angle) * 50;
            const x2 = this.canvas.width / 2 + Math.cos(angle) * 800;
            const y2 = this.canvas.height / 2 + Math.sin(angle) * 800;
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
        }
        ctx.stroke();

        // 2. Draw Perspective Highway
        this.renderHighway();

        // 3. Draw Hit Zone (Glowing Pads)
        this.renderHitZone();

        // 4. Render Notes
        this.renderNotes(currentTime);

        // 5. Explosions
        this.renderExplosions();

        // 6. HUD
        this.renderHUD();

        // 7. FPS Counter (Top Right)
        ctx.save();
        ctx.fillStyle = this.currentFps >= 55 ? '#00ff00' : '#ff0000';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.shadowBlur = 0;
        ctx.fillText(`FPS: ${this.currentFps}`, this.canvas.width - 10, 10);
        ctx.restore();
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

        // 1. Draw Static Highway from Cache
        if (this.renderCache && this.renderCache.highwayBackground) {
            ctx.drawImage(this.renderCache.highwayBackground, 0, 0);
        } else {
            // Fallback: Dynamic Rendering (if cache is missing)
            const tl = { x: this.getPerspectiveX(0, this.horizonY), y: this.horizonY };
            const tr = { x: this.getPerspectiveX(this.laneCount, this.horizonY), y: this.horizonY };
            const bl = { x: this.getPerspectiveX(0, this.bottomY), y: this.bottomY };
            const br = { x: this.getPerspectiveX(this.laneCount, this.bottomY), y: this.bottomY };

            // Side Rails
            const railWidth = 20;
            const outerGrad = ctx.createLinearGradient(0, this.horizonY, 0, this.bottomY);
            outerGrad.addColorStop(0, '#555');
            outerGrad.addColorStop(1, '#aaa');
            ctx.fillStyle = outerGrad;
            ctx.beginPath();
            ctx.moveTo(tl.x - railWidth, tl.y); ctx.lineTo(tl.x, tl.y); ctx.lineTo(bl.x, bl.y); ctx.lineTo(bl.x - railWidth * 3, bl.y);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(tr.x, tr.y); ctx.lineTo(tr.x + railWidth, tr.y); ctx.lineTo(br.x + railWidth * 3, br.y); ctx.lineTo(br.x, br.y);
            ctx.fill();

            // Road
            const roadGrad = ctx.createLinearGradient(0, this.horizonY, 0, this.bottomY);
            roadGrad.addColorStop(0, 'rgba(0,0,0,0.8)');
            roadGrad.addColorStop(1, 'rgba(20,20,40, 0.9)');
            ctx.fillStyle = roadGrad;
            ctx.beginPath();
            ctx.moveTo(tl.x, tl.y); ctx.lineTo(tr.x, tr.y); ctx.lineTo(br.x, br.y); ctx.lineTo(bl.x, bl.y);
            ctx.fill();

            // Dividers
            ctx.lineWidth = 2;
            for (let i = 1; i < this.laneCount; i++) {
                const topX = this.getPerspectiveX(i, this.horizonY);
                const botX = this.getPerspectiveX(i, this.bottomY);
                const divGrad = ctx.createLinearGradient(0, this.horizonY, 0, this.bottomY);
                divGrad.addColorStop(0, 'rgba(0, 255, 255, 0)');
                divGrad.addColorStop(0.5, 'rgba(0, 255, 255, 0.5)');
                divGrad.addColorStop(1, 'rgba(0, 255, 255, 0)');
                ctx.strokeStyle = divGrad;
                ctx.beginPath();
                ctx.moveTo(topX, this.horizonY); ctx.lineTo(botX, this.bottomY);
                ctx.stroke();
            }

            // Try to force cache generation for next frame
            if (this.renderCache && this.laneBottomWidth > 0) {
                this.renderCache.renderHighwayToCache(
                    this.canvas.width, this.canvas.height,
                    this.horizonY, this.bottomY,
                    this.laneCount,
                    this.getPerspectiveX.bind(this)
                );
            }
        }

        // Active Lane (Dynamic - must be drawn each frame)
        for (let i = 0; i < this.laneCount; i++) {
            if (this.keyState[i]) {
                const lX1 = this.getPerspectiveX(i, this.horizonY);
                const rX1 = this.getPerspectiveX(i + 1, this.horizonY);
                const lX2 = this.getPerspectiveX(i, this.bottomY);
                const rX2 = this.getPerspectiveX(i + 1, this.bottomY);
                const lightGrad = ctx.createLinearGradient(0, this.hitLineY, 0, this.horizonY);
                lightGrad.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
                lightGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
                ctx.fillStyle = lightGrad;
                ctx.beginPath();
                ctx.moveTo(lX1, this.horizonY); ctx.lineTo(rX1, this.horizonY); ctx.lineTo(rX2, this.bottomY); ctx.lineTo(lX2, this.bottomY);
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
        ctx.font = 'bold 48px "Orbitron"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 25;
        ctx.shadowColor = '#00ffff';
        ctx.fillText("DATA RETRIEVAL COMPLETE", width / 2, height * 0.12);
        ctx.shadowBlur = 0;

        // 3. Layout Constants (Responsive)
        const panelW = Math.min(width * 0.9, 850);
        const panelH = height * 0.65;
        const panelX = (width - panelW) / 2;
        const panelY = height * 0.22;

        this.drawHolographicRect(panelX, panelY, panelW, panelH, '#00ffff');

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

        const gradeColor = (grade === 'F' || grade === 'D') ? '#ff3333' : (grade.includes('S') ? '#00ffff' : '#33ff33');

        ctx.textAlign = 'center';
        ctx.font = 'bold 180px "Orbitron"';
        ctx.fillStyle = gradeColor;
        ctx.shadowBlur = 40 + Math.sin(Date.now() * 0.005) * 10;
        ctx.shadowColor = gradeColor;
        ctx.fillText(grade, leftAreaX, panelY + panelH * 0.4);
        ctx.shadowBlur = 0;

        // Percent Accuracy
        ctx.font = 'bold 42px "Orbitron"';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`${accuracy.toFixed(2)}%`, leftAreaX, panelY + panelH * 0.68);
        ctx.font = '16px "Orbitron"';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillText("SYNCHRONIZATION RATE", leftAreaX, panelY + panelH * 0.76);

        // 5. Right Section: Detailed Judgments
        const rightAreaX = panelX + panelW * 0.55;
        const startY = panelY + panelH * 0.18;
        const rowHeight = 45;

        const renderStatRow = (label: string, value: number | string, color: string, y: number, isLarge = false) => {
            ctx.textAlign = 'left';
            ctx.font = `bold ${isLarge ? '20' : '18'}px "Orbitron"`; // Reduced large label font to prevent overlap
            ctx.fillStyle = color;
            ctx.fillText(label, rightAreaX, y);

            ctx.textAlign = 'right';
            ctx.font = `bold ${isLarge ? '36' : '22'}px "Orbitron"`;
            ctx.fillStyle = '#ffffff';
            ctx.fillText(value.toString(), rightAreaX + panelW * 0.38, y); // Increased offset to 0.38

            // Subtle Divider
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.beginPath();
            ctx.moveTo(rightAreaX, y + 12);
            ctx.lineTo(rightAreaX + panelW * 0.38, y + 12);
            ctx.stroke();
        };

        renderStatRow("PERFECT", stats.perfect, '#00ffff', startY);
        renderStatRow("GREAT", stats.great, '#33ff33', startY + rowHeight);
        renderStatRow("GOOD", stats.good, '#ffff33', startY + rowHeight * 2);
        renderStatRow("MISS", stats.miss, '#ff3333', startY + rowHeight * 3);

        // Score & Max Combo
        renderStatRow("TOTAL SCORE", Math.floor(score).toLocaleString(), '#ffffff', startY + rowHeight * 4.5, true);
        renderStatRow("MAX COMBO", maxCombo, '#33ff33', startY + rowHeight * 6.2, true);

        // 6. Footer Prompt
        const pulse = 0.5 + Math.sin(Date.now() * 0.005) * 0.5;
        ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + pulse * 0.7})`;
        ctx.font = 'bold 22px "Orbitron"';
        ctx.fillText("TAP OR PRESS ANY KEY TO DISCONNECT", width / 2, height * 0.93 + Math.sin(Date.now() * 0.003) * 5);
    }

    private renderExplosions(): void {
        const ctx = this.ctx;
        const particleImg = this.renderCache?.particleGlow;

        if (!particleImg) return;

        this.explosions.forEach(exp => {
            ctx.save();
            ctx.globalAlpha = exp.alpha;
            // Draw cached glow particle
            const size = exp.radius * 4;
            ctx.translate(exp.x, exp.y);
            ctx.drawImage(particleImg, -size / 2, -size / 2, size, size);
            ctx.restore();
        });
    }

    private renderHitZone(): void {
        const ctx = this.ctx;
        for (let i = 0; i < this.laneCount; i++) {
            const width = this.getPerspectiveWidth(this.hitLineY);
            const height = 35; // Increased from 25 for better visibility
            const x = this.getPerspectiveX(i, this.hitLineY);
            const colorSet = this.COLORS.LANES[i] || this.COLORS.LANES[0];
            const baseColor = colorSet[1];

            if (this.keyState[i]) {
                ctx.fillStyle = baseColor;
                ctx.strokeStyle = '#fff';
                ctx.shadowBlur = 30;
                ctx.shadowColor = baseColor;
                ctx.beginPath();
                ctx.roundRect(x, this.hitLineY, width, height, height / 3);
                ctx.fill();
                ctx.stroke();
            } else {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.shadowBlur = 0;
                ctx.beginPath();
                ctx.roundRect(x, this.hitLineY, width, height, height / 3);
                ctx.fill();
                ctx.stroke();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.roundRect(x + 4, this.hitLineY + 4, width - 8, height - 8, height / 3);
                ctx.stroke();
            }
        }
        ctx.shadowBlur = 0;
    }

    private renderNotes(currentTime: number): void {
        const timeToReachHitLine = 2000 / this.scrollSpeed;

        this.visualNotes.forEach(note => {
            if (note.isProcessed) return; // Don't draw hit/missed notes

            const timeDiff = note.time * 1000 - currentTime;
            if (timeDiff > -200 && timeDiff < timeToReachHitLine) {
                // Linear progress (0 to 1) based on time
                const linearProgress = 1 - (timeDiff / timeToReachHitLine);

                // Perspective Projection (Z-axis)
                // Maps constant speed in 3D to accelerating 2D movement
                const perspectiveDepth = 4; // Higher = stronger perspective acceleration
                const projectedProgress = linearProgress / (perspectiveDepth - (perspectiveDepth - 1) * linearProgress);

                const noteY = this.horizonY + (this.hitLineY - this.horizonY) * projectedProgress;
                if (noteY < this.horizonY) return;

                const noteWidth = this.getPerspectiveWidth(noteY);
                const noteX = this.getPerspectiveX(note.lane, noteY);

                // Height also scales with perspective (1/z)
                const noteHeight = 25 * projectedProgress; // Height grows as it approaches
                this.drawGelNote(noteX, noteY, noteWidth, noteHeight, note.lane);
            }
        });
    }

    private drawGelNote(x: number, y: number, w: number, h: number, lane: number): void {
        // High-Performance Cache Rendering
        if (!this.renderCache) return;

        const noteImg = this.renderCache.notes[lane];
        if (noteImg) {
            this.ctx.drawImage(noteImg, x, y, w, h);
        }
    }

    private renderHUD(): void {
        if (!this.scoreManager) return;
        const ctx = this.ctx;
        const score = Math.floor(this.scoreManager.getScore());
        const combo = this.scoreManager.getCombo();

        ctx.save();
        ctx.font = 'bold 24px "Orbitron", sans-serif';
        ctx.textBaseline = 'top';

        // HP Bar
        const hpX = 20, hpY = 20, hpWidth = 300, hpHeight = 30;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.moveTo(hpX, hpY); ctx.lineTo(hpX + hpWidth, hpY); ctx.lineTo(hpX + hpWidth - 20, hpY + hpHeight); ctx.lineTo(hpX, hpY + hpHeight);
        ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();

        const maxHp = this.scoreManager.getMaxHealth();
        const currentHp = this.scoreManager.getHealth();
        const hpPercent = currentHp / maxHp;

        const fillW = (hpWidth - 20) * hpPercent;
        if (fillW > 0) {
            const hpGrad = ctx.createLinearGradient(hpX, hpY, hpX + hpWidth, hpY);
            if (hpPercent < 0.3) {
                hpGrad.addColorStop(0, '#ff0000'); hpGrad.addColorStop(1, '#880000');
            } else {
                hpGrad.addColorStop(0, '#ff0000'); hpGrad.addColorStop(0.5, '#ffff00'); hpGrad.addColorStop(1, '#00ff00');
            }

            ctx.fillStyle = hpGrad;
            ctx.beginPath();
            ctx.moveTo(hpX + 2, hpY + 2); ctx.lineTo(hpX + fillW, hpY + 2); ctx.lineTo(hpX + fillW - 20 * hpPercent, hpY + hpHeight - 2); ctx.lineTo(hpX + 2, hpY + hpHeight - 2);
            ctx.fill();
        }
        ctx.fillStyle = '#fff'; ctx.font = 'italic bold 20px "Orbitron"'; ctx.fillText("HP", hpX + 5, hpY + 40);

        // Score
        ctx.textAlign = 'right';
        ctx.shadowBlur = 10; ctx.shadowColor = this.COLORS.TEXT_GLOW;
        ctx.fillStyle = '#fff'; ctx.font = 'italic 20px "Orbitron"'; ctx.fillText("SCORE", this.canvas.width - 20, 25);
        ctx.font = 'italic bold 36px "Orbitron"'; ctx.fillText(score.toLocaleString(), this.canvas.width - 20, 50);

        // Combo
        if (combo > 0) {
            ctx.textAlign = 'center';
            ctx.shadowBlur = 20 + this.comboAnim * 20;
            ctx.shadowColor = '#00ffff';
            ctx.fillStyle = '#fff';

            const scale = 1 + this.comboAnim * 0.4;
            ctx.save();
            ctx.translate(this.canvas.width / 2, this.canvas.height * 0.15);
            ctx.scale(scale, scale);

            // Combo Count
            ctx.font = 'italic bold 70px "Orbitron"';
            ctx.fillText(`${combo}`, 0, 0);

            // "COMBO" Label
            ctx.font = '20px "Orbitron"';
            ctx.fillText("COMBO", 0, 65);
            ctx.restore();
        }

        // Render Judgement Text (Perfect/Good/Miss)
        this.renderJudgment(ctx, this.canvas.width, this.canvas.height);

        ctx.restore();
    }

    private renderMenu(): void {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const time = this.menuAnimationTimer;

        // 1. Atmosphere & Background
        this.drawAtmosphere(width, height);

        // Digital Grid Floor (Subtle)
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        const horizon = height * 0.4;
        const gridSize = 100;

        // Vertical lines
        for (let x = 0; x <= width; x += gridSize) {
            ctx.moveTo(x, horizon);
            ctx.lineTo((x - width / 2) * 4 + width / 2, height);
        }
        // Horizontal lines (moving)
        for (let y = horizon; y < height; y += gridSize * 0.5) {
            const progress = (y - horizon) / (height - horizon);
            const yPos = horizon + Math.pow(progress, 2) * (height - horizon);
            ctx.moveTo(0, yPos);
            ctx.lineTo(width, yPos);
        }
        ctx.stroke();
        ctx.restore();


        // Current Song Info
        const currentSong = this.songList[this.selectedSongIndex];
        const seedColor = this.getSeededColor(currentSong.name);
        const bpm = currentSong.bpm || 120;

        // Layout Config
        const padding = 20;
        const leftPanelWidth = width * 0.45;
        const rightPanelX = width * 0.5;

        // Panel 1: Visualizer (Top-Left)
        const visPanelH = height * 0.55;
        const visY = padding;

        // Panel 2: Info & Speed (Bottom-Left)
        const infoY = visY + visPanelH + padding;
        const infoH = height - infoY - padding;

        // Panel 3: Song List (Right)
        const listY = padding;
        const listH = height - 2 * padding;

        // Draw Holographic Panels
        this.drawHolographicRect(padding, visY, leftPanelWidth - 2 * padding, visPanelH, '#00ffff'); // Cyan
        this.drawHolographicRect(padding, infoY, leftPanelWidth - 2 * padding, infoH, '#ff00ff');   // Magenta
        this.drawHolographicRect(rightPanelX, listY, width - rightPanelX - padding, listH, '#ffffff'); // White

        // Tech Labels
        this.drawTechLabel("VISUAL_CORE.SYS", padding + 10, visY + 15);
        this.drawTechLabel("DATA_STREAM.LOG", rightPanelX + 10, listY + 15);
        this.drawTechLabel("SYS.CONFIG", padding + 10, infoY + 15);

        // --- CONTENT: VISUALIZER ---
        const cx = padding + (leftPanelWidth - 2 * padding) * 0.5;
        const cy = visY + visPanelH * 0.5;
        const radius = Math.min(leftPanelWidth, visPanelH) * 0.35;

        // 1. Data Ring Visualizer
        this.drawVisualizer(cx, cy, radius, time, seedColor, bpm);

        ctx.save();
        ctx.translate(cx, cy);

        // Kinetic Typography: Title
        ctx.rotate(-0.05 * Math.sin(time * 0.5)); // Gentle sway
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 20;
        ctx.shadowColor = seedColor;

        // Main Title
        const titleSize = Math.min(40, radius * 0.5);
        ctx.fillStyle = '#fff';
        ctx.font = `900 ${titleSize}px "Orbitron"`;
        ctx.fillText(currentSong.name.toUpperCase(), 0, 0);

        // Glitch Effect Layer
        if (Math.random() > 0.95) {
            ctx.fillStyle = '#0ff';
            ctx.fillText(currentSong.name.toUpperCase(), 2, 0);
            ctx.fillStyle = '#f0f';
            ctx.fillText(currentSong.name.toUpperCase(), -2, 0);
        }

        ctx.restore();


        // --- CONTENT: INFO & SPEED ---
        const statsCenterX = padding + (leftPanelWidth - 2 * padding) * 0.5;
        const statsTopY = infoY + 40;

        ctx.textAlign = 'center';

        // BPM Display
        this.drawTechLabel("BEATS_PER_MINUTE", statsCenterX, statsTopY - 25, 'center');
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 32px "Orbitron"';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#0ff';
        ctx.fillText(`${bpm}`, statsCenterX, statsTopY + 5);

        // Duration Display
        this.drawTechLabel("TRACK_DURATION", statsCenterX, statsTopY + 25, 'center');
        ctx.fillStyle = '#ccc';
        ctx.font = '20px "Orbitron"';
        ctx.shadowBlur = 0;
        const durMin = Math.floor((currentSong.duration || 120) / 60);
        const durSec = ((currentSong.duration || 120) % 60).toString().padStart(2, '0');
        ctx.fillText(`${durMin}:${durSec}`, statsCenterX, statsTopY + 45);

        // Difficulty Control
        const difficultyY = infoY + 160;
        const currentDiff = this.difficultyOptions[this.selectedDifficultyIndex];

        let diffColor = '#ffffff';
        if (currentDiff === 'EASY') diffColor = '#00ff00';      // Green
        else if (currentDiff === 'NORMAL') diffColor = '#ffff00'; // Yellow
        else if (currentDiff === 'HARD') diffColor = '#ff3333';   // Red

        ctx.fillStyle = diffColor;
        ctx.font = 'bold 32px "Orbitron"';
        ctx.shadowBlur = 15;
        ctx.shadowColor = diffColor;
        ctx.fillText(currentDiff, statsCenterX, difficultyY);

        this.drawTechLabel("DIFFICULTY_LEVEL", statsCenterX, difficultyY - 35, 'center');

        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '12px "Orbitron"';
        ctx.shadowBlur = 0;
        ctx.fillText("Q  SELECT  E", statsCenterX, difficultyY + 25);

        // Speed Control
        const speedControlY = infoY + infoH - 35;

        ctx.fillStyle = '#ff00ff';
        ctx.font = 'bold 40px "Orbitron"';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#f0f';
        ctx.fillText(`x${this.scrollSpeed.toFixed(1)}`, statsCenterX, speedControlY);

        this.drawTechLabel("SCROLL_SPEED_MOD", statsCenterX, speedControlY - 35, 'center');

        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '14px "Orbitron"';
        ctx.shadowBlur = 0;
        ctx.fillText("◀  ADJUST  ▶", statsCenterX, speedControlY + 25);


        // --- CONTENT: DATA LIST ---
        const listInnerX = rightPanelX + 10; // Padding inside panel
        const listInnerY = listY + 10;
        const listInnerW = width - rightPanelX - padding - 20;
        const itemHeight = (listH - 20) / 7; // Exact fit for 7 items
        const visibleCount = 7;

        ctx.save();
        ctx.translate(listInnerX, listInnerY);

        // Clamp start index to always show full list if possible
        let visibleStartIndex = this.selectedSongIndex - Math.floor(visibleCount / 2);
        if (visibleStartIndex < 0) visibleStartIndex = 0;
        if (visibleStartIndex > this.songList.length - visibleCount) visibleStartIndex = Math.max(0, this.songList.length - visibleCount);

        for (let i = 0; i < visibleCount; i++) {
            const index = visibleStartIndex + i;
            // Ensure we render empty slots if songList is smaller than visibleCount (optional, or just stop)
            if (index >= this.songList.length) break;

            const song = this.songList[index];
            const y = i * itemHeight;
            const isSelected = (index === this.selectedSongIndex);

            // Table Row Panel
            ctx.save();
            ctx.translate(0, y);

            if (isSelected) {
                // Active Holographic Highlight
                this.drawHolographicRect(0, 0, listInnerW, itemHeight - 2, '#00ffff', true);
            } else {
                // Inactive Glass Row
                ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                ctx.fillRect(0, 0, listInnerW, itemHeight - 2);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.lineWidth = 1;
                ctx.strokeRect(0, 0, listInnerW, itemHeight - 2);
            }

            // Index Number
            ctx.save();
            ctx.fillStyle = isSelected ? '#00ffff' : '#444';
            ctx.font = 'bold 16px "Orbitron"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText((index + 1).toString().padStart(2, '0'), 30, (itemHeight - 2) / 2);
            ctx.restore();

            // Title
            ctx.save();
            ctx.fillStyle = isSelected ? '#ffffff' : '#888';
            ctx.font = isSelected ? 'bold 20px "Orbitron"' : '18px "Orbitron"';
            ctx.textAlign = 'left';
            ctx.shadowBlur = isSelected ? 10 : 0;
            ctx.shadowColor = '#00ffff';
            ctx.fillText(song.name, 60, (itemHeight - 2) / 2 + 5);
            ctx.restore();

            if (isSelected) {
                this.drawTechLabel("<< ACTIVE", listInnerW - 20, (itemHeight - 2) / 2 + 3, 'right');
            }
            ctx.restore();
        }
        ctx.restore();

        // Footer Prompts
        const footerY = height - 30;
        ctx.textAlign = 'right';
        // Pulse between Cyan and White
        const pulse = 0.5 + Math.sin(time * 5) * 0.5;
        ctx.fillStyle = `rgba(${255 * (1 - pulse)}, 255, 255, ${0.5 + pulse * 0.5})`;
        ctx.font = 'bold 28px "Orbitron"';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00ffff';
        ctx.fillText("INITIALIZE SYSTEM [START]", width - 40, footerY);
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

        this.previewTimeout = setTimeout(async () => {
            if (this.currentState !== GameState.MENU) return;

            try {
                const song = this.songList[this.selectedSongIndex];
                console.log(`[RhythmGame] Loading preview: ${song.name}`);

                // Load MIDI for preview
                const res = await fetch(song.url);
                if (this.currentState !== GameState.MENU) return; // Double check after fetch

                const buffer = await res.arrayBuffer();
                await this.audioEngine.loadMidi(buffer);

                if (this.currentState === GameState.MENU) {
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
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }

    // --- High-Fidelity Rendering Helpers ---

    private drawAtmosphere(width: number, height: number): void {
        const ctx = this.ctx;

        // 1. Deep Vignette Background
        const grad = ctx.createRadialGradient(width / 2, height / 2, height * 0.2, width / 2, height / 2, height * 0.8);
        grad.addColorStop(0, '#0a0a1a'); // Deep Blue-Black center
        grad.addColorStop(1, '#000000'); // Pure Black edges
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // 2. Floating Particles
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        this.particles.forEach(p => {
            p.y -= p.speed;
            p.x += Math.sin(this.menuAnimationTimer * 0.5 + p.y * 0.01) * 0.2;

            if (p.y < 0) {
                p.y = height;
                p.x = Math.random() * width;
            }

            const flicker = Math.random() > 0.95 ? 0 : p.alpha;
            ctx.globalAlpha = flicker;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1.0;
    }

    private drawHolographicRect(x: number, y: number, w: number, h: number, color: string, isActive: boolean = false): void {
        const ctx = this.ctx;
        ctx.save();

        // Glass Background (Gradient)
        const grad = ctx.createLinearGradient(x, y, x, y + h);
        grad.addColorStop(0, isActive ? 'rgba(0, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)');
        grad.addColorStop(1, isActive ? 'rgba(0, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.4)');
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, w, h);

        // Scanline Texture Overlay
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        for (let i = y; i < y + h; i += 4) {
            ctx.fillRect(x, i, w, 1);
        }

        // Glow Border
        ctx.strokeStyle = isActive ? '#00ffff' : color;
        ctx.lineWidth = isActive ? 2 : 1;
        ctx.shadowBlur = isActive ? 15 : 5;
        ctx.shadowColor = isActive ? '#00ffff' : color;
        ctx.strokeRect(x, y, w, h);

        // Tech Corners (Accents)
        const cornerSize = 10;
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#fff';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        // Top-Left
        ctx.moveTo(x, y + cornerSize); ctx.lineTo(x, y); ctx.lineTo(x + cornerSize, y);
        // Bottom-Right
        ctx.moveTo(x + w, y + h - cornerSize); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - cornerSize, y + h);
        ctx.stroke();

        ctx.restore();
    }

    private drawTechLabel(text: string, x: number, y: number, align: CanvasTextAlign = 'left'): void {
        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '10px "Orbitron"';
        ctx.textAlign = align;
        ctx.fillText(text, x, y);
        ctx.restore();
    }

    private drawVisualizer(cx: number, cy: number, radius: number, time: number, color: string, bpm: number): void {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(cx, cy);

        // Layer 1: Base Ring (Counter-Rotating)
        ctx.rotate(time * -0.2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.setLineDash([10, 20]);
        ctx.beginPath();
        ctx.arc(0, 0, radius * 1.2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Layer 2: Main Data Ring (Pulsing)
        const pulse = Math.sin(time * (bpm / 60) * Math.PI);
        ctx.rotate(time * 0.4);
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 15;
        ctx.shadowColor = color;
        ctx.beginPath();
        ctx.arc(0, 0, radius + pulse * 5, 0, Math.PI * 2);
        ctx.stroke();

        // Layer 3: Reactive Bars
        const bars = 32;
        for (let i = 0; i < bars; i++) {
            const angle = (Math.PI * 2 / bars) * i;
            const barLen = 10 + Math.abs(Math.sin(time * 4 + i)) * 40 * (pulse + 1);

            ctx.save();
            ctx.rotate(angle);
            ctx.fillStyle = color;
            ctx.fillRect(radius + 10, -2, barLen, 2); // Thinner bars
            ctx.restore();
        }

        // Layer 4: Inner Core Hexagon
        ctx.rotate(time * 0.1);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.05 + pulse * 0.1})`;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 / 6) * i;
            const hx = Math.cos(angle) * (radius * 0.4);
            const hy = Math.sin(angle) * (radius * 0.4);
            if (i === 0) ctx.moveTo(hx, hy);
            else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

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
    }
}
