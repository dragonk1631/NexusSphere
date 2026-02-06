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
    private scrollSpeed = 0.5; // px per ms
    private hitLineY = 500;
    private laneWidth = 80;
    private laneCount = 4;
    private isPlaying = false;
    private selectedTrack: GameTrack | null = null;
    private scoreManager: ScoreManager | null = null;

    constructor(canvas: HTMLCanvasElement) {
        super(canvas);
        // Removed Mixer/Editor toggles
    }

    public async init(): Promise<void> {
        console.log("[RhythmGame] Initializing...");
        this.laneWidth = Math.min(100, this.canvas.width / this.laneCount);
        this.scoreManager = ScoreManager.getInstance();
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
        this.ctx.fillStyle = '#111';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Lanes
        this.ctx.strokeStyle = '#333';
        this.ctx.setLineDash([]);
        for (let i = 1; i < this.laneCount; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(i * this.laneWidth, 0);
            this.ctx.lineTo(i * this.laneWidth, this.canvas.height);
            this.ctx.stroke();
        }

        // Hit Line
        this.ctx.strokeStyle = '#00ffcc';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.hitLineY);
        this.ctx.lineTo(this.canvas.width, this.hitLineY);
        this.ctx.stroke();
        this.ctx.lineWidth = 1;

        // Notes
        this.ctx.fillStyle = '#ff3366';
        this.visualNotes.forEach(note => {
            const timeDiff = note.time * 1000 - currentTime;

            if (timeDiff > -500 && timeDiff < 2000) {
                const x = note.lane * this.laneWidth + 10;
                const y = this.hitLineY - (timeDiff * this.scrollSpeed);

                this.ctx.fillRect(x, y - 20, this.laneWidth - 20, 20);

                if (note.duration > 0) {
                    const tailHeight = note.duration * 1000 * this.scrollSpeed;
                    this.ctx.globalAlpha = 0.5;
                    this.ctx.fillRect(x, y - 20 - tailHeight, this.laneWidth - 20, tailHeight);
                    this.ctx.globalAlpha = 1.0;
                }

                // Auto-Play
                if (y > this.hitLineY && !note.isProcessed) {
                    if (y < this.hitLineY + 50) {
                        this.scoreManager?.addHit();
                        note.isProcessed = true;
                    }
                }
            }
        });

        this.renderHUD();
    }

    private renderHUD(): void {
        if (!this.scoreManager) return;
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '20px Inter';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Score: ${Math.floor(this.scoreManager.getScore())}`, 20, 40);
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`${this.scoreManager.getCombo()} COMBO`, this.canvas.width / 2, 100);
    }

    public destroy(): void {
        this.audioEngine.stop();
        this.isPlaying = false;
    }
}
