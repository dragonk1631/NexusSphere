import { BaseGame } from '../../core/BaseGame';
import { ASSET_PATHS } from '../../core/asset/AssetRegistry';
import { MidiParser } from '../../core/audio/MidiParser';
import type { ParsedMidi } from '../../core/audio/MidiParser';
import { NoteFactory } from './NoteFactory';
import type { VisualNote } from './NoteFactory';

export class RhythmGame extends BaseGame {
    private midiData: ParsedMidi | null = null;
    private visualNotes: VisualNote[] = [];
    private scrollSpeed = 0.5; // px per ms
    private hitLineY = 500;
    private laneWidth = 80;
    private laneCount = 4;
    private isPlaying = false;

    constructor(canvas: HTMLCanvasElement) {
        super(canvas);
    }

    public async init(): Promise<void> {
        console.log("[RhythmGame] Initializing...");
        this.laneWidth = this.canvas.width / this.laneCount;
    }

    public async load(): Promise<void> {
        console.log("[RhythmGame] Loading assets...");

        // 1. 사운드폰트 로드
        await this.audioEngine.init(ASSET_PATHS.AUDIO.SOUNDFONTS.DEFAULT);

        // 2. MIDI 파일 로드
        const midiRes = await fetch(ASSET_PATHS.AUDIO.MIDI.TEST);
        const midiBuffer = await midiRes.arrayBuffer();

        // 3. MIDI 파싱 (인스턴스 생성 필)
        const parser = new MidiParser();
        this.midiData = await parser.parse(midiBuffer);

        // 4. 비주얼 노트 생성
        this.visualNotes = NoteFactory.createNotes(this.midiData, this.laneCount);

        // 5. 오디오 엔진에 MIDI 로드
        await this.audioEngine.loadMidi(midiBuffer);
    }

    public create(): void {
        console.log("[RhythmGame] Ready! Click to start.");
        this.renderStartScreen();

        const startHandler = () => {
            this.start();
            this.canvas.removeEventListener('click', startHandler);
        };
        this.canvas.addEventListener('click', startHandler);
    }

    private async start() {
        await this.audioEngine.resume();
        this.audioEngine.play();
        this.isPlaying = true;
        console.log("[RhythmGame] Started playback.");
    }

    public update(_delta: number): void {
        if (!this.isPlaying) return;

        const currentTime = this.audioEngine.currentTime * 1000; // ms

        // 1. 렌더링
        this.render(currentTime);

        // 2. 종료 체크
        if (this.midiData && currentTime > this.midiData.duration * 1000 + 2000) {
            this.isPlaying = false;
            console.log("[RhythmGame] Finished.");
        }
    }

    private render(currentTime: number): void {
        this.ctx.fillStyle = '#111';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.strokeStyle = '#333';
        this.ctx.setLineDash([]);
        for (let i = 1; i < this.laneCount; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(i * this.laneWidth, 0);
            this.ctx.lineTo(i * this.laneWidth, this.canvas.height);
            this.ctx.stroke();
        }

        this.ctx.strokeStyle = '#00ffcc';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.hitLineY);
        this.ctx.lineTo(this.canvas.width, this.hitLineY);
        this.ctx.stroke();
        this.ctx.lineWidth = 1;

        this.ctx.fillStyle = '#ff3366';
        this.visualNotes.forEach(note => {
            const timeDiff = note.time * 1000 - currentTime;

            if (timeDiff > -500 && timeDiff < 2000) {
                const x = note.lane * this.laneWidth + 10;
                const y = this.hitLineY - (timeDiff * this.scrollSpeed);
                const width = this.laneWidth - 20;
                const height = 20;

                this.ctx.fillRect(x, y - height, width, height);

                if (note.duration > 0) {
                    const tailHeight = note.duration * 1000 * this.scrollSpeed;
                    this.ctx.globalAlpha = 0.5;
                    this.ctx.fillRect(x, y - height - tailHeight, width, tailHeight);
                    this.ctx.globalAlpha = 1.0;
                }
            }
        });
    }

    private renderStartScreen(): void {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '30px Inter';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Click to Start Rhythm Game', this.canvas.width / 2, this.canvas.height / 2);
    }

    public destroy(): void {
        this.audioEngine.stop();
        this.isPlaying = false;
        console.log("[RhythmGame] Destroyed.");
    }
}
