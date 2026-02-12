import { BaseGame } from '../../core/BaseGame';
import { ASSET_PATHS } from '../../core/asset/AssetRegistry';
import { MidiParser } from '../../core/audio/MidiParser';
import type { ParsedMidi } from '../../core/audio/MidiParser';
import { NoteFactory } from './NoteFactory';
import type { VisualNote } from './NoteFactory';
import { ScoreManager } from '../../core/score/ScoreManager';
import { MelodyAnalyzer } from '../../core/audio/MelodyAnalyzer';

// Game States
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

    // Game State
    private currentState: GameState = GameState.MENU;
    private isPlaying = false;
    private scoreManager: ScoreManager | null = null;

    // Menu State
    private songList: SongEntry[] = [
        { name: 'Test Song', url: ASSET_PATHS.AUDIO.MIDI.TEST }
    ];
    private selectedSongIndex = 0;
    private previewTimeout: ReturnType<typeof setTimeout> | null = null;
    private speedOptions = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0];
    private selectedSpeedIndex = 3; // Default 2.0x
    private touchStartY = 0;
    private menuAnimationTimer = 0;
    private particles: { x: number, y: number, speed: number, alpha: number, size: number }[] = [];
    private explosions: Explosion[] = [];


    // Settings
    private scrollSpeed = 2.0; // Controlled by Menu
    private laneCount = 6;
    private endGameTimer = 0;

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

    // Visual Assets / Constants
    private readonly COLORS = {
        NOTE_Left: ['#ff0099', '#ff66cc'], // Pink
        NOTE_Right: ['#00ccff', '#66e0ff'], // Cyan
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
    }

    public async init(): Promise<void> {
        console.log("[RhythmGame] Initializing...");

        // Initial Resize
        this.resize(this.canvas.width, this.canvas.height);

        this.scoreManager = ScoreManager.getInstance();
        this.scoreManager.reset(); // Reset score/health on game start attempt (though init is called once, we might need to call reset on start)

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

        // Start Menu Animation Loop

        const menuLoop = () => {
            if (this.currentState === GameState.MENU) {
                this.menuAnimationTimer += 0.01;
                this.render(0);
                requestAnimationFrame(menuLoop);
            }
        };
        requestAnimationFrame(menuLoop);



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

        // 1. Check Start Button (Bottom Left Corner of Left Panel in new design)
        // Let's make the start button a large area at the bottom right of the screen
        // In new design: "START SYSTEM" is bottom right
        if (x > width * 0.7 && y > height * 0.85) {
            // Stop preview before starting
            if (this.previewTimeout) clearTimeout(this.previewTimeout);
            this.audioEngine.stop();

            this.currentState = GameState.PLAYING;
            this.scoreManager?.reset(); // Reset score for new game
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

    private checkHit(lane: number): void {
        const currentTime = this.audioEngine.currentTime * 1000;

        // Find the closest note in this lane that hasn't been hit yet
        // We only check notes that are close to the hit line (within +/- 200ms)
        const hitWindow = 200;

        const targetNote = this.visualNotes.find(n =>
            n.lane === lane &&
            !n.isProcessed &&
            Math.abs(n.time * 1000 - currentTime) < hitWindow
        );

        if (targetNote) {
            const diff = Math.abs(targetNote.time * 1000 - currentTime);
            let judgment = '';

            if (diff < 50) {
                judgment = 'PERFECT';
                this.scoreManager?.addHit(100);
            } else if (diff < 100) {
                judgment = 'GREAT';
                this.scoreManager?.addHit(80);
            } else {
                judgment = 'GOOD';
                this.scoreManager?.addHit(50);
            }

            console.log(`Hit Lane ${lane}: ${judgment} (${Math.round(diff)}ms)`);
            targetNote.isProcessed = true;

            // Explosion Effect
            this.triggerExplosion(targetNote.lane, targetNote.time * 1000);

        } else {
            // Miss logic (Clicked but no note - valid to ignore or punish? Usually ignore in mobile rhythm games unless strict)
        }
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
            if (res.ok) {
                this.beatmapData = await res.json();
                console.log("[RhythmGame] Beatmap loaded:", this.beatmapData);
            } else {
                console.warn("[RhythmGame] No beatmap found. Will use auto-generation.");
                this.beatmapData = null; // Clear old data
            }
        } catch (e) {
            console.warn("[RhythmGame] Failed to load beatmap:", e);
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

            // 2. Fallback: Auto-Detect Melody Channels
            if (targetChannels.length === 0) {
                console.log("[RhythmGame] Running Melody Analyzer (Channel-Based)...");
                const rankedChannels = MelodyAnalyzer.findMelodyChannels(this.midiData);
                if (rankedChannels.length > 0) {
                    targetChannels = rankedChannels.slice(0, 3); // Use top 3 channels
                    console.log(`[RhythmGame] Auto-Selected Channels: ${targetChannels.join(', ')}`);
                }
            }

            // 3. Last Resort: Channel with most notes
            if (targetChannels.length === 0) {
                const channelCounts = new Array(16).fill(0);
                this.midiData.tracks.forEach(t => {
                    if (!t.isDrum) channelCounts[t.channel] += t.noteCount;
                });
                let maxCh = 0;
                let maxCount = -1;
                channelCounts.forEach((count, ch) => {
                    if (count > maxCount) {
                        maxCount = count;
                        maxCh = ch;
                    }
                });
                targetChannels = [maxCh];
                console.log(`[RhythmGame] Fallback Selection (Most Notes): Channel ${maxCh}`);
            }

            // Generate Visual Notes
            this.visualNotes = NoteFactory.createNotes(this.midiData, this.laneCount, targetChannels);
            console.log(`[RhythmGame] Created ${this.visualNotes.length} notes.`);

            this.start();
        }
    }

    private async start() {
        await this.audioEngine.resume();
        this.audioEngine.play();
        this.isPlaying = true;
        this.endGameTimer = 0;
    }

    public update(_delta: number): void {
        if (this.currentState === GameState.MENU) {
            this.render(0);
            return;
        }

        if (this.currentState === GameState.RESULT) {
            this.render(0);
            // Handle Result Input elsewhere
            return;
        }

        if (!this.isPlaying) return;
        const currentTime = this.audioEngine.currentTime * 1000;

        // Check for Missed Notes

        this.visualNotes.forEach(note => {
            if (!note.isProcessed && note.time * 1000 < currentTime - 200) {
                // Note passed hit window
                this.onMiss(note);
            }
        });

        // Update Explosions
        this.explosions.forEach(exp => {
            exp.radius += 2;
            exp.alpha -= 0.05;
        });
        this.explosions = this.explosions.filter(exp => exp.alpha > 0);

        this.render(currentTime);

        // Check Game Over
        if (this.scoreManager?.isDead()) {
            this.finishGame();
            return;
        }

        if (this.midiData) {
            const durationMs = this.midiData.duration * 1000;
            if (currentTime >= durationMs - 100) {
                this.endGameTimer += _delta;
            }

            if (this.endGameTimer > 2000) {
                this.finishGame();
            }
        }
    }

    private onMiss(note: VisualNote): void {
        note.isProcessed = true;
        this.scoreManager?.resetCombo();
        this.scoreManager?.damage(10); // Damage on miss
        console.log("MISS!");
    }

    private triggerExplosion(lane: number, _time: number): void {
        const x = this.getPerspectiveX(lane, this.hitLineY) + this.getPerspectiveWidth(this.hitLineY) / 2;
        const colorSet = (lane === 1 || lane === 4) ? this.COLORS.NOTE_Right : this.COLORS.NOTE_Left;

        this.explosions.push({
            x: x,
            y: this.hitLineY,
            radius: 20,
            alpha: 1.0,
            color: colorSet[1]
        });
    }

    private finishGame(): void {
        this.isPlaying = false;
        this.currentState = GameState.RESULT;
        this.audioEngine.stop();
        console.log("[RhythmGame] Finished. Showing Results.");
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
        // Highway rendering logic (Same as before)
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

        // Active Lane
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

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(0, 0, width, height);

        // Title
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 60px "Orbitron"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#00ffff';
        ctx.fillText("RESULTS", width / 2, height * 0.15);
        ctx.shadowBlur = 0;

        // Panel
        const panelW = Math.min(600, width * 0.8);
        const panelH = height * 0.5;
        const panelX = (width - panelW) / 2;
        const panelY = height * 0.25;

        this.drawHolographicRect(panelX, panelY, panelW, panelH, '#00ffff');

        // Stats
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';

        ctx.font = '30px "Orbitron"';
        ctx.fillText("SCORE", width / 2, panelY + 60);
        ctx.font = 'bold 50px "Orbitron"';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#fff';
        ctx.fillText(Math.floor(score).toLocaleString(), width / 2, panelY + 110);
        ctx.shadowBlur = 0;

        ctx.font = '30px "Orbitron"';
        ctx.fillText("MAX COMBO", width / 2, panelY + 180);
        ctx.font = 'bold 50px "Orbitron"';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00ff00';
        ctx.fillText(maxCombo.toString(), width / 2, panelY + 230);
        ctx.shadowBlur = 0;

        // Grade
        let grade = 'F';
        if (score > 100000) grade = 'S';
        else if (score > 80000) grade = 'A';
        else if (score > 50000) grade = 'B';
        else if (score > 10000) grade = 'C';

        ctx.font = 'bold 100px "Orbitron"';
        ctx.shadowBlur = 20;
        ctx.fillStyle = grade === 'F' ? '#ff0000' : (grade === 'S' ? '#00ffff' : '#00ff00');
        ctx.shadowColor = ctx.fillStyle;
        ctx.fillText(grade, width / 2, panelY + 350);
        ctx.shadowBlur = 0;

        // Prompt
        const pulse = 0.5 + Math.sin(Date.now() * 0.005) * 0.5;
        ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + pulse * 0.7})`;
        ctx.font = '20px "Orbitron"';
        ctx.fillText("TAP OR PRESS ENTER TO CONTINUE", width / 2, height * 0.85);
    }

    private renderExplosions(): void {
        const ctx = this.ctx;
        this.explosions.forEach(exp => {
            ctx.save();
            ctx.globalAlpha = exp.alpha;
            ctx.fillStyle = exp.color;
            ctx.beginPath();
            ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
            ctx.fill();

            // Outer ring
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(exp.x, exp.y, exp.radius * 1.2, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        });
    }

    private renderHitZone(): void {
        const ctx = this.ctx;
        for (let i = 0; i < this.laneCount; i++) {
            const width = this.getPerspectiveWidth(this.hitLineY);
            const height = 25;
            const x = this.getPerspectiveX(i, this.hitLineY);
            const colorSet = (i === 1 || i === 4) ? this.COLORS.NOTE_Right : this.COLORS.NOTE_Left;
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
        const ctx = this.ctx;
        const colorSet = (lane === 1 || lane === 4) ? this.COLORS.NOTE_Right : this.COLORS.NOTE_Left;
        const baseColor = colorSet[1];
        const darkColor = colorSet[0];

        ctx.save();
        const grad = ctx.createLinearGradient(x, y, x, y + h);
        grad.addColorStop(0, baseColor);
        grad.addColorStop(1, darkColor);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, h / 3);
        ctx.fill();

        const innerGrad = ctx.createLinearGradient(x, y, x, y + h / 2);
        innerGrad.addColorStop(0, 'rgba(255,255,255,0.8)');
        innerGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = innerGrad;
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 2, w - 4, h / 2 - 2, h / 3);
        ctx.fill();

        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h * 0.3, w * 0.3, h * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
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
            ctx.shadowBlur = 20; ctx.shadowColor = '#00ffff';
            ctx.fillStyle = '#fff';
            ctx.font = 'italic bold 60px "Orbitron"'; ctx.fillText(`${combo}`, this.canvas.width / 2, 150);
            ctx.font = '20px "Orbitron"'; ctx.fillText("COMBO", this.canvas.width / 2, 210);
        }
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
        this.drawTechLabel("TRACK_DURATION", statsCenterX, statsTopY + 35, 'center');
        ctx.fillStyle = '#ccc';
        ctx.font = '20px "Orbitron"';
        ctx.shadowBlur = 0;
        const durMin = Math.floor((currentSong.duration || 120) / 60);
        const durSec = ((currentSong.duration || 120) % 60).toString().padStart(2, '0');
        ctx.fillText(`${durMin}:${durSec}`, statsCenterX, statsTopY + 60);

        // Speed Control
        const speedControlY = infoY + infoH - 40;

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
        } else if (e.code === 'Enter') {
            // Stop preview before starting
            if (this.previewTimeout) clearTimeout(this.previewTimeout);
            this.audioEngine.stop();

            this.currentState = GameState.PLAYING;
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
        this.isPlaying = false;
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
        this.canvas.removeEventListener('touchstart', this.handleTouchStart);
        this.canvas.removeEventListener('touchmove', this.handleTouchMove);
        this.canvas.removeEventListener('touchend', this.handleTouchEnd);
    }
}
