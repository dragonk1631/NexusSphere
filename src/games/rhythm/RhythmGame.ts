import { BaseGame } from '../../core/BaseGame';
import { ASSET_PATHS } from '../../core/asset/AssetRegistry';
import { MidiParser } from '../../core/audio/MidiParser';
import type { ParsedMidi, GameTrack } from '../../core/audio/MidiParser';
import { NoteFactory } from './NoteFactory';
import type { VisualNote } from './NoteFactory';
import { ScoreManager } from '../../core/score/ScoreManager';

export class RhythmGame extends BaseGame {
    private midiData: ParsedMidi | null = null;
    private visualNotes: VisualNote[] = [];

    // Game State
    private isPlaying = false;
    private selectedTrack: GameTrack | null = null;
    private scoreManager: ScoreManager | null = null;

    // Settings
    private scrollSpeed = 0.5; // Base speed (can be adjusted)
    private laneCount = 4;

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

    public async init(): Promise<void> {
        console.log("[RhythmGame] Initializing...");

        // Wait for font? Not strictly necessary, canvas will swap.

        // Responsive Layout calculations
        this.horizonY = this.canvas.height * this.horizonYRatio;
        this.bottomY = this.canvas.height * this.bottomYRatio;
        this.hitLineY = this.canvas.height * this.hitLineYRatio;

        // Calculate lane widths based on screen width
        // The reference has a VERY wide bottom highway.
        const totalHighwayWidthBottom = Math.min(800, this.canvas.width * 1.0); // Wider
        const totalHighwayWidthTop = totalHighwayWidthBottom * 0.2; // 20% width at top (less aggressive convergence)

        this.laneBottomWidth = totalHighwayWidthBottom / this.laneCount;
        this.laneTopWidth = totalHighwayWidthTop / this.laneCount;

        this.scoreManager = ScoreManager.getInstance();

        // Input Handling
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);

        // Mobile Touch Support
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
    }

    // Touch Handling
    private handleTouchStart(e: TouchEvent): void {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            const lane = this.getLaneFromTouch(touch.clientX, touch.clientY);
            // Trigger Hit Check if lane is valid and not already held
            if (lane !== -1 && !this.keyState[lane]) {
                this.keyState[lane] = true;
                // TODO: Trigger Hit Check logic here
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
    private keyState: boolean[] = [false, false, false, false];

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
                this.scoreManager?.addHit(100); // Assuming 100 is base score
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
            // Miss (Pressed but no note) - Optional: Good to punish mashing?
            // this.scoreManager?.resetCombo();
        }
    }

    private handleKeyDown(e: KeyboardEvent): void {
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
        switch (code) {
            case 'KeyD': return 0;
            case 'KeyF': return 1;
            case 'KeyJ': return 2;
            case 'KeyK': return 3;
            default: return -1;
        }
    }

    public async load(): Promise<void> {
        console.log("[RhythmGame] Loading assets...");
        await this.audioEngine.init(ASSET_PATHS.AUDIO.SOUNDFONTS.DEFAULT);

        // Load Default Song
        const midiRes = await fetch(ASSET_PATHS.AUDIO.MIDI.TEST);
        const midiBuffer = await midiRes.arrayBuffer();

        const parser = new MidiParser();
        this.midiData = await parser.parse(midiBuffer);
        await this.audioEngine.loadMidi(midiBuffer);
    }

    public create(): void {
        console.log("[RhythmGame] Ready!");

        if (this.midiData) {
            // Auto-select the track with most notes for gameplay demo
            // In future, this would come from a "Level Selection" screen config
            const sortedTracks = [...this.midiData.tracks].sort((a, b) => b.noteCount - a.noteCount);
            if (sortedTracks.length > 0) {
                this.onTrackSelected(sortedTracks[0]);
            }
        }
    }

    private onTrackSelected(track: GameTrack): void {
        console.log("[RhythmGame] Auto-Selected Track:", track.name);
        this.selectedTrack = track;
        this.visualNotes = NoteFactory.createNotes(this.midiData!, this.laneCount, this.selectedTrack);
        this.start();
    }

    private async start() {
        // Add a small delay/countdown here in real game
        await this.audioEngine.resume();
        this.audioEngine.play();
        this.isPlaying = true;
    }

    public update(_delta: number): void {
        if (!this.isPlaying) return;
        const currentTime = this.audioEngine.currentTime * 1000;

        this.render(currentTime);

        if (this.midiData && currentTime > this.midiData.duration * 1000 + 2000) {
            this.isPlaying = false;
            console.log("[RhythmGame] Finished.");
        }
    }

    private render(currentTime: number): void {
        const ctx = this.ctx;

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

    /**
     * Projects a lane index and Y-position (0 to canvas.height) to Screen X
     * This creates the trapezoidal perspective.
     */
    private getPerspectiveX(laneIndex: number, y: number): number {
        // Simplified Approach: Linear interpolation between Top Width and Bottom Width based on Y
        const progress = (y - this.horizonY) / (this.bottomY - this.horizonY);
        // progress: 0 (at horizon) -> 1 (at bottom)

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

        // Draw Highway Base (Black Glass)
        const tl = { x: this.getPerspectiveX(0, this.horizonY), y: this.horizonY };
        const tr = { x: this.getPerspectiveX(this.laneCount, this.horizonY), y: this.horizonY };
        const bl = { x: this.getPerspectiveX(0, this.bottomY), y: this.bottomY };
        const br = { x: this.getPerspectiveX(this.laneCount, this.bottomY), y: this.bottomY };

        // Side Rails (Metallic)
        const railWidth = 20;
        const outerGrad = ctx.createLinearGradient(0, this.horizonY, 0, this.bottomY);
        outerGrad.addColorStop(0, '#555');
        outerGrad.addColorStop(1, '#aaa');

        // Left Rail
        ctx.fillStyle = outerGrad;
        ctx.beginPath();
        ctx.moveTo(tl.x - railWidth, tl.y);
        ctx.lineTo(tl.x, tl.y);
        ctx.lineTo(bl.x, bl.y);
        ctx.lineTo(bl.x - railWidth * 3, bl.y); // Wider at bottom
        ctx.fill();

        // Right Rail
        ctx.beginPath();
        ctx.moveTo(tr.x, tr.y);
        ctx.lineTo(tr.x + railWidth, tr.y);
        ctx.lineTo(br.x + railWidth * 3, br.y);
        ctx.lineTo(br.x, br.y);
        ctx.fill();

        // Main Road
        const roadGrad = ctx.createLinearGradient(0, this.horizonY, 0, this.bottomY);
        roadGrad.addColorStop(0, 'rgba(0,0,0,0.8)');
        roadGrad.addColorStop(1, 'rgba(20,20,40, 0.9)');
        ctx.fillStyle = roadGrad;
        ctx.beginPath();
        ctx.moveTo(tl.x, tl.y);
        ctx.lineTo(tr.x, tr.y);
        ctx.lineTo(br.x, br.y);
        ctx.lineTo(bl.x, bl.y);
        ctx.fill();

        // Lane Dividers (Laser Beams)
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
            ctx.moveTo(topX, this.horizonY);
            ctx.lineTo(botX, this.bottomY);
            ctx.stroke();
        }

        // Active Lane Lighting (Press Effect)
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
                ctx.moveTo(lX1, this.horizonY);
                ctx.lineTo(rX1, this.horizonY);
                ctx.lineTo(rX2, this.bottomY);
                ctx.lineTo(lX2, this.bottomY);
                ctx.fill();
            }
        }
    }

    private renderHitZone(): void {
        const ctx = this.ctx;

        for (let i = 0; i < this.laneCount; i++) {
            const width = this.getPerspectiveWidth(this.hitLineY);
            // Height matches note height at this position approx
            const height = 25;
            const x = this.getPerspectiveX(i, this.hitLineY);

            ctx.shadowBlur = 10;
            ctx.shadowColor = this.COLORS.HIT_LINE_GLOW;
            ctx.lineWidth = 3;

            const colorSet = (i === 1 || i === 2) ? this.COLORS.NOTE_Right : this.COLORS.NOTE_Left;
            const baseColor = colorSet[1];

            if (this.keyState[i]) {
                // PRESSED: Filled Glow
                ctx.fillStyle = baseColor;
                ctx.strokeStyle = '#fff';
                ctx.shadowBlur = 30;
                ctx.shadowColor = baseColor;

                ctx.beginPath();
                ctx.roundRect(x, this.hitLineY, width, height, height / 3);
                ctx.fill();
                ctx.stroke();
            } else {
                // IDLE: Empty Slot (Outline)
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.shadowBlur = 0;

                ctx.beginPath();
                ctx.roundRect(x, this.hitLineY, width, height, height / 3);
                ctx.fill();
                ctx.stroke();

                // Add inner "slot" detail
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.roundRect(x + 4, this.hitLineY + 4, width - 8, height - 8, height / 3);
                ctx.stroke();
            }
        }

        ctx.shadowBlur = 0;
    }

    private drawGelNote(x: number, y: number, w: number, h: number, lane: number): void {
        const ctx = this.ctx;
        const colorSet = (lane === 1 || lane === 2) ? this.COLORS.NOTE_Right : this.COLORS.NOTE_Left; // Inner Blue, Outer Pink
        const baseColor = colorSet[1];
        const darkColor = colorSet[0];

        ctx.save();

        // 1. Base Body (Vertical Gradient)
        const grad = ctx.createLinearGradient(x, y, x, y + h);
        grad.addColorStop(0, baseColor);
        grad.addColorStop(1, darkColor);
        ctx.fillStyle = grad;

        ctx.beginPath();
        ctx.roundRect(x, y, w, h, h / 3);
        ctx.fill();

        // 2. Inner Highlight (Bevel Top)
        const innerGrad = ctx.createLinearGradient(x, y, x, y + h / 2);
        innerGrad.addColorStop(0, 'rgba(255,255,255,0.8)');
        innerGrad.addColorStop(1, 'rgba(255,255,255,0)');

        ctx.fillStyle = innerGrad;
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 2, w - 4, h / 2 - 2, h / 3);
        ctx.fill();

        // 3. Specular Note (Glossy Oval at top)
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h * 0.3, w * 0.3, h * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();

        // 4. Border Glow
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
    }

    private renderNotes(currentTime: number): void {
        // Perspective Speed: Time needed to travel layout
        // Higher scrollSpeed = Lower timeToReachHitLine (Faster approach)
        // Base: 2000ms at 1.0 speed
        const timeToReachHitLine = 2000 / this.scrollSpeed;

        this.visualNotes.forEach(note => {
            const timeDiff = note.time * 1000 - currentTime;

            // Only draw notes in visible range
            if (timeDiff > -200 && timeDiff < timeToReachHitLine) {
                // Map timeDiff to Screen Y
                const progress = 1 - (timeDiff / timeToReachHitLine);
                // 0 (Horizon) -> 1 (HitLine)

                const noteY = this.horizonY + (this.hitLineY - this.horizonY) * progress;

                if (noteY < this.horizonY) return;

                const noteWidth = this.getPerspectiveWidth(noteY);
                const noteX = this.getPerspectiveX(note.lane, noteY);
                // Notes also get thinner/fatter with perspective, but height should scale too
                const noteHeight = 25 * (0.5 + 0.5 * progress);

                this.drawGelNote(noteX, noteY, noteWidth, noteHeight, note.lane);
            }
        });
    }

    private renderHUD(): void {
        if (!this.scoreManager) return;
        const ctx = this.ctx;
        const score = Math.floor(this.scoreManager.getScore());
        const combo = this.scoreManager.getCombo();

        ctx.save();
        ctx.font = 'bold 24px "Orbitron", sans-serif';
        ctx.textBaseline = 'top';

        // 1. HP Bar (Top Left) - Angled
        const hpWidth = 300;
        const hpHeight = 30;
        const hpX = 20;
        const hpY = 20;

        // HP Container (Grey)
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.moveTo(hpX, hpY);
        ctx.lineTo(hpX + hpWidth, hpY);
        ctx.lineTo(hpX + hpWidth - 20, hpY + hpHeight); // Slant left
        ctx.lineTo(hpX, hpY + hpHeight);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // HP Fill (Gradient)
        // Mock HP for now (100%)
        const hpPercent = 1.0;
        const fillW = (hpWidth - 20) * hpPercent;

        const hpGrad = ctx.createLinearGradient(hpX, hpY, hpX + hpWidth, hpY);
        hpGrad.addColorStop(0, '#ff0000');
        hpGrad.addColorStop(0.5, '#ffff00');
        hpGrad.addColorStop(1, '#00ff00');

        ctx.fillStyle = hpGrad;
        ctx.beginPath();
        ctx.moveTo(hpX + 2, hpY + 2);
        ctx.lineTo(hpX + fillW, hpY + 2);
        ctx.lineTo(hpX + fillW - 20 * (hpPercent), hpY + hpHeight - 2); // Approximate slant
        ctx.lineTo(hpX + 2, hpY + hpHeight - 2);
        ctx.fill();

        // HP Label
        ctx.fillStyle = '#fff';
        ctx.font = 'italic bold 20px "Orbitron"';
        ctx.fillText("HP", hpX + 5, hpY + 40);

        // 2. Score (Top Right)
        ctx.textAlign = 'right';
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.COLORS.TEXT_GLOW;
        ctx.fillStyle = '#fff';
        ctx.font = 'italic 20px "Orbitron"';
        ctx.fillText("SCORE", this.canvas.width - 20, 25);

        ctx.font = 'italic bold 36px "Orbitron"';
        ctx.fillText(score.toLocaleString(), this.canvas.width - 20, 50);

        // 3. Combo (Center)
        if (combo > 0) {
            ctx.textAlign = 'center';
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#00ffff';
            ctx.fillStyle = '#fff';

            ctx.font = 'italic bold 60px "Orbitron"';
            ctx.fillText(`${combo}`, this.canvas.width / 2, 150);

            ctx.font = '20px "Orbitron"';
            ctx.fillText("COMBO", this.canvas.width / 2, 210);
        }

        ctx.restore();
    }

    public destroy(): void {
        this.audioEngine.stop();
        this.isPlaying = false;

        // Remove Listeners
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
        this.canvas.removeEventListener('touchstart', this.handleTouchStart);
        this.canvas.removeEventListener('touchend', this.handleTouchEnd);
    }
}
