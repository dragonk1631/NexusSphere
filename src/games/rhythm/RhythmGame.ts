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

    // Settings
    private scrollSpeed = 2.0; // Controlled by Menu
    private laneCount = 6;

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
        const totalHighwayWidthBottom = Math.min(800, width * 1.0);
        const totalHighwayWidthTop = totalHighwayWidthBottom * 0.2;

        this.laneBottomWidth = totalHighwayWidthBottom / this.laneCount;
        this.laneTopWidth = totalHighwayWidthTop / this.laneCount;
    }

    public async init(): Promise<void> {
        console.log("[RhythmGame] Initializing...");

        // Initial Resize
        this.resize(this.canvas.width, this.canvas.height);

        this.scoreManager = ScoreManager.getInstance();

        // Input Handling
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);

        // Mobile Touch Support
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });



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
        // Touch logic not implemented for menu yet, just valid for game
        if (this.currentState === GameState.MENU) return;

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
        // Simple Touch Zones: Bottom 30% of screen, divided horizontally
        if (y < this.canvas.height * 0.7) return -1;

        const zoneWidth = this.canvas.width / this.laneCount;
        const lane = Math.floor(x / zoneWidth);
        return Math.max(0, Math.min(lane, this.laneCount - 1));
    }

    // Input States
    private keyState: boolean[] = [false, false, false, false, false, false];

    private handleKeyDown(e: KeyboardEvent): void {
        if (this.currentState === GameState.MENU) {
            this.handleMenuInput(e);
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

            // TODO: Trigger Visual Feedback (Explosion/Text)
        } else {
            // Miss logic
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
    }

    public update(_delta: number): void {
        if (this.currentState === GameState.MENU) {
            this.render(0);
            return;
        }

        if (!this.isPlaying) return;
        const currentTime = this.audioEngine.currentTime * 1000;

        this.render(currentTime);

        if (this.midiData && currentTime > this.midiData.duration * 1000 + 2000) {
            this.isPlaying = false;
            // Transition to RESULT state in future
            this.currentState = GameState.MENU; // Reset to Menu for now
            console.log("[RhythmGame] Finished.");
        }
    }

    private render(currentTime: number): void {
        const ctx = this.ctx;

        if (this.currentState === GameState.MENU) {
            this.renderMenu();
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

        // 5. HUD
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

        const hpPercent = 1.0;
        const fillW = (hpWidth - 20) * hpPercent;
        const hpGrad = ctx.createLinearGradient(hpX, hpY, hpX + hpWidth, hpY);
        hpGrad.addColorStop(0, '#ff0000'); hpGrad.addColorStop(0.5, '#ffff00'); hpGrad.addColorStop(1, '#00ff00');
        ctx.fillStyle = hpGrad;
        ctx.beginPath();
        ctx.moveTo(hpX + 2, hpY + 2); ctx.lineTo(hpX + fillW, hpY + 2); ctx.lineTo(hpX + fillW - 20 * hpPercent, hpY + hpHeight - 2); ctx.lineTo(hpX + 2, hpY + hpHeight - 2);
        ctx.fill();
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

        // 1. Background (Darker, High-Tech)
        ctx.fillStyle = '#0a0a10'; // Very dark blue-gray
        ctx.fillRect(0, 0, width, height);

        // Grid overlay
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        const gridSize = 50;
        ctx.beginPath();
        for (let x = 0; x < width; x += gridSize) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
        for (let y = 0; y < height; y += gridSize) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
        ctx.stroke();

        // Layout Constants
        const splitX = width * 0.4;

        // --- LEFT PANEL (Info) ---
        // Album Art Box
        const artSize = 300;
        const artX = (splitX - artSize) / 2;
        const artY = 100;

        // Procedural Album Art (Gradient based on name)
        const currentSong = this.songList[this.selectedSongIndex];
        const artColor = this.getSeededColor(currentSong.name);

        const artGrad = ctx.createLinearGradient(artX, artY, artX + artSize, artY + artSize);
        artGrad.addColorStop(0, artColor);
        artGrad.addColorStop(1, '#000');

        ctx.fillStyle = artGrad;
        ctx.shadowBlur = 20;
        ctx.shadowColor = artColor;
        ctx.fillRect(artX, artY, artSize, artSize);
        ctx.shadowBlur = 0;

        // Art Border
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(artX, artY, artSize, artSize);

        // Title Info
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';

        // Title
        ctx.font = 'bold 28px "Orbitron"';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00ffff';
        ctx.fillText(currentSong.name, splitX / 2, artY + artSize + 50);
        ctx.shadowBlur = 0;

        // BPM / Difficulty (Real)
        const bpm = currentSong.bpm || 120;
        const noteCount = currentSong.noteCount || 0;
        const duration = currentSong.duration || 60; // Avoid division by zero

        const nps = noteCount / duration;
        // Map NPS to 1-5 Stars (Adjusted for total MIDI notes, divisor 4)
        const difficulty = Math.min(5, Math.max(1, Math.floor(nps / 4) + 1));
        const stars = '★'.repeat(difficulty) + '☆'.repeat(5 - difficulty);

        ctx.fillStyle = '#aaa';
        ctx.font = '20px "Orbitron"';
        // Display NPS with 1 decimal place
        ctx.fillText(`BPM: ${bpm}   NPS: ${nps.toFixed(1)}   DIFF: ${stars}`, splitX / 2, artY + artSize + 85);

        // Speed Setting
        const speedY = artY + artSize + 140;
        ctx.fillStyle = '#ff0099'; // Pink Highlight
        ctx.font = 'bold 36px "Orbitron"';
        ctx.fillText(`SPEED ${this.scrollSpeed.toFixed(1)}`, splitX / 2, speedY);

        // Navigation Hints
        ctx.fillStyle = '#666';
        ctx.font = '14px "Orbitron"';
        ctx.fillText("◀ SPEED ▶", splitX / 2, speedY + 25);


        // --- RIGHT PANEL (Song List) ---
        // Panel Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(splitX, 0, width - splitX, height);

        // List Logic
        const listX = splitX + 50;
        const itemHeight = 80;
        const visibleCount = 7;
        const halfVisible = Math.floor(visibleCount / 2);

        let startIndex = this.selectedSongIndex - halfVisible;
        if (startIndex < 0) startIndex = 0;
        if (startIndex > this.songList.length - visibleCount) startIndex = Math.max(0, this.songList.length - visibleCount);
        const endIndex = Math.min(this.songList.length, startIndex + visibleCount);

        ctx.textAlign = 'left';

        for (let i = startIndex; i < endIndex; i++) {
            const song = this.songList[i];
            const relativeIndex = i - startIndex;
            const y = 100 + relativeIndex * itemHeight; // Start Y at 100

            // Selection Highlight
            if (i === this.selectedSongIndex) {
                // Gradient Bar
                const barGrad = ctx.createLinearGradient(splitX, y, width, y);
                barGrad.addColorStop(0, 'rgba(0, 255, 255, 0.5)'); // Cyan
                barGrad.addColorStop(1, 'rgba(0, 255, 255, 0)');
                ctx.fillStyle = barGrad;
                ctx.fillRect(splitX, y, width - splitX, itemHeight);

                // Active Text
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 24px "Orbitron"';
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#00ffff';
                ctx.fillText(song.name, listX + 20, y + itemHeight / 2 + 8); // +20 indent
                ctx.shadowBlur = 0;

                // Indicator
                ctx.fillStyle = '#00ffff';
                ctx.fillRect(splitX, y, 5, itemHeight);
            } else {
                // Inactive Text
                ctx.fillStyle = '#666';
                ctx.font = '20px "Orbitron"';
                ctx.fillText(song.name, listX, y + itemHeight / 2 + 8);
            }
        }

        // Scroll Bar (Simple)
        const scrollBarX = width - 10;
        const scrollBarHeight = (visibleCount / this.songList.length) * (height - 200);
        const scrollBarY = 100 + (startIndex / this.songList.length) * (height - 200);

        ctx.fillStyle = '#333';
        ctx.fillRect(scrollBarX, 100, 5, height - 200); // Track
        ctx.fillStyle = '#00ffff';
        ctx.fillRect(scrollBarX, scrollBarY, 5, scrollBarHeight); // Thumb

        // Start Prompt (Bottom Right)
        if (Math.floor(Date.now() / 500) % 2 === 0) {
            ctx.textAlign = 'right';
            ctx.fillStyle = '#ffff00';
            ctx.font = 'bold 24px "Orbitron"';
            ctx.fillText("[ENTER] START", width - 50, height - 50);
        }
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
        const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
        return '#' + '00000'.substring(0, 6 - c.length) + c;
    }

    public destroy(): void {
        this.audioEngine.stop();
        this.isPlaying = false;
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
        this.canvas.removeEventListener('touchstart', this.handleTouchStart);
        this.canvas.removeEventListener('touchend', this.handleTouchEnd);
    }
}
