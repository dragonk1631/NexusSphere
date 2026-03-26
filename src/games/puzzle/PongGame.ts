import { BaseGame } from '../../core/BaseGame';
import { CoreAudioEngine } from '../../core/audio/CoreAudioEngine';
import { ASSET_PATHS } from '../../core/asset/AssetRegistry';

export class PongGame extends BaseGame {
    private paddleWidth = 10;
    private paddleHeight = 80;
    private ballSize = 10;

    private playerY: number = 0;
    private aiY: number = 0;
    private ballX: number = 0;
    private ballY: number = 0;
    private ballSpeedX: number = 4;
    private ballSpeedY: number = 3;

    private keys: Set<string> = new Set();

    constructor(canvas: HTMLCanvasElement, audioEngine: CoreAudioEngine) {
        super(canvas, audioEngine);
    }

    public async init(): Promise<void> {
        console.log("[PongGame] Initializing...");
        this.playerY = this.canvas.height / 2 - this.paddleHeight / 2;
        this.aiY = this.canvas.height / 2 - this.paddleHeight / 2;
        this.ballX = this.canvas.width / 2;
        this.ballY = this.canvas.height / 2;

        window.addEventListener('keydown', (e) => this.keys.add(e.code));
        window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    }

    public async load(): Promise<void> {
        console.log("[PongGame] Loading assets (if any)...");
        try {
            await this.audioEngine.init(ASSET_PATHS.AUDIO.SOUNDFONTS.DEFAULT);
        } catch (e) {
            console.warn("[PongGame] Audio initialization failed, continuing in silent mode.");
        }
    }

    public create(): void {
        console.log("[PongGame] Created and starting loop.");
    }

    public update(delta: number): void {
        // 1. 입력 처리 (속도 보정)
        const moveSpeed = 0.5 * delta;
        if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) {
            this.playerY -= moveSpeed;
        }
        if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) {
            this.playerY += moveSpeed;
        }

        // 2. 패들 범위 제한
        this.playerY = Math.max(0, Math.min(this.canvas.height - this.paddleHeight, this.playerY));

        // 3. AI 로직 (간단한 추적)
        const aiSpeed = 0.3 * delta;
        if (this.aiY + this.paddleHeight / 2 < this.ballY) {
            this.aiY += aiSpeed;
        } else {
            this.aiY -= aiSpeed;
        }
        this.aiY = Math.max(0, Math.min(this.canvas.height - this.paddleHeight, this.aiY));

        // 4. 공 물리
        this.ballX += (this.ballSpeedX / 16) * delta;
        this.ballY += (this.ballSpeedY / 16) * delta;

        // 상하 벽 충돌
        if (this.ballY <= 0 || this.ballY >= this.canvas.height) {
            this.ballSpeedY *= -1;
            this.triggerHitSound(60); // MIDI note 60 (C4)
        }

        // 패들 충돌
        if (
            (this.ballX <= this.paddleWidth && this.ballY >= this.playerY && this.ballY <= this.playerY + this.paddleHeight) ||
            (this.ballX >= this.canvas.width - this.paddleWidth && this.ballY >= this.aiY && this.ballY <= this.aiY + this.paddleHeight)
        ) {
            this.ballSpeedX *= -1.1; // 속도 증가
            this.triggerHitSound(72); // MIDI note 72 (C5)
        }

        // 득점 및 초기화
        if (this.ballX < 0 || this.ballX > this.canvas.width) {
            this.ballX = this.canvas.width / 2;
            this.ballY = this.canvas.height / 2;
            this.ballSpeedX = (this.ballX < 0 ? 4 : -4);
            this.triggerHitSound(48); // MIDI note 48 (C3)
        }

        // this.render();
    }

    public render(): void {
        // 배경
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 패들
        this.ctx.fillStyle = '#fff';
        this.ctx.fillRect(0, this.playerY, this.paddleWidth, this.paddleHeight);
        this.ctx.fillRect(this.canvas.width - this.paddleWidth, this.aiY, this.paddleWidth, this.paddleHeight);

        // 공
        this.ctx.fillRect(this.ballX - this.ballSize / 2, this.ballY - this.ballSize / 2, this.ballSize, this.ballSize);

        // 중앙선
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeStyle = '#fff';
        this.ctx.beginPath();
        this.ctx.moveTo(this.canvas.width / 2, 0);
        this.ctx.lineTo(this.canvas.width / 2, this.canvas.height);
        this.ctx.stroke();
    }

    private triggerHitSound(note: number): void {
        this.audioEngine.triggerNoteOn(0, note, 100);
        setTimeout(() => this.audioEngine.triggerNoteOff(0, note), 100);
    }

    public pause(): void {
        super.pause();
        this.audioEngine.pause();
    }

    public resume(): void {
        super.resume();
        this.audioEngine.resume();
    }

    public destroy(): void {
        console.log("[PongGame] Destroyed.");
        // 이벤트 리스너 해제 등 (실제 구현 시 필요)
    }
}
