import { CoreAudioEngine } from './audio/CoreAudioEngine';
import { AssetLoader } from './asset/AssetLoader';

/**
 * NexusSphere BaseGame
 * 모든 게임 모듈의 최상위 추상 클래스입니다.
 */
export abstract class BaseGame {
    public audioEngine: CoreAudioEngine;
    public assetLoader: AssetLoader;
    public canvas: HTMLCanvasElement;
    public ctx: CanvasRenderingContext2D;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;

        // Android Chrome can be unstable with desynchronized: true
        const isAndroid = /Android/i.test(navigator.userAgent);

        try {
            // Optimization: Use desynchronized: true for lowest latency (bypasses compositor)
            // But disable for Android as it can cause flickering/broken rendering in some Chrome versions
            this.ctx = canvas.getContext('2d', {
                desynchronized: !isAndroid
            })!;
        } catch (e) {
            console.warn("[BaseGame] Desynchronized context failed, falling back to standard.");
            this.ctx = canvas.getContext('2d')!;
        }

        this.audioEngine = CoreAudioEngine.getInstance();
        this.assetLoader = AssetLoader.getInstance();
    }

    /**
     * 게임 초기화 (에셋 로드 전)
     */
    public abstract init(): Promise<void>;

    /**
     * 에셋 로딩 로직
     */
    public abstract load(): Promise<void>;

    /**
     * 게임 객체 생성 및 설정
     */
    public abstract create(): void;

    /**
     * 매 프레임 업데이트 및 렌더링
     * @param delta 이전 프레임으로부터의 경과 시간 (ms)
     */
    public abstract update(delta: number): void;

    /**
     * 게임 종료 및 자원 해제
     */
    public abstract destroy(): void;

    /**
     * 메인 렌더링 루프 (Update와 분리됨)
     */
    public abstract render(): void;

    /**
     * 캔버스 크기 조절 대응
     */
    public resize(width: number, height: number): void {
        this.canvas.width = width;
        this.canvas.height = height;
    }
}
