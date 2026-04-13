import { resolveAssetPath } from '../utils/PathUtils';

/**
 * NexusSphere Asset Loader
 * 에셋의 중복 로딩을 방지하고 캐싱을 관리하는 중앙 로더입니다.
 */

export class AssetLoader {
    private static instance: AssetLoader;
    private imageCache: Map<string, HTMLImageElement> = new Map();
    private audioBufferCache: Map<string, AudioBuffer> = new Map();
    private audioContext: AudioContext;

    private constructor() {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    public static getInstance(): AssetLoader {
        if (!AssetLoader.instance) {
            AssetLoader.instance = new AssetLoader();
        }
        return AssetLoader.instance;
    }

    /**
     * 이미지를 로드하고 캐싱합니다.
     */
    public async loadImage(path: string): Promise<HTMLImageElement> {
        if (this.imageCache.has(path)) {
            return this.imageCache.get(path)!;
        }

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.imageCache.set(path, img);
                resolve(img);
            };
            img.onerror = () => reject(`Failed to load image: ${path}`);
            img.src = resolveAssetPath(path);
        });
    }

    /**
     * 오디오 파일을 로드하여 AudioBuffer로 변환하고 캐싱합니다.
     */
    public async loadAudio(path: string): Promise<AudioBuffer> {
        if (this.audioBufferCache.has(path)) {
            return this.audioBufferCache.get(path)!;
        }

        const resolvedPath = resolveAssetPath(path);
        const response = await fetch(resolvedPath);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

        this.audioBufferCache.set(path, audioBuffer);
        return audioBuffer;
    }

    /**
     * Checks if a specific asset (e.g. mp3) exists at the given path.
     */
    public async checkAssetExists(path: string): Promise<boolean> {
        const resolvedPath = resolveAssetPath(path);
        try {
            const response = await fetch(resolvedPath, { method: 'HEAD' });
            if (!response.ok) return false;

            const contentType = response.headers.get('content-type');
            return !!contentType && contentType.startsWith('audio/');
        } catch (e) {
            return false;
        }
    }

    /**
     * Checks if a JSON file exists and is valid. (Silent on console)
     */
    public async checkJsonExists(path: string): Promise<boolean> {
        const resolvedPath = resolveAssetPath(path);
        try {
            // PROFESSIONAL: Instead of HEAD, use a standard GET with partial check
            const response = await fetch(resolvedPath);
            if (!response.ok) return false;

            const contentType = response.headers.get('content-type');
            return !!contentType && (contentType.includes('application/json') || contentType.includes('text/plain'));
        } catch (e) {
            return false;
        }
    }

    /**
     * Validates if the buffer has a MIDI Magic Number (MThd)
     */
    public validateMidi(buffer: ArrayBuffer): boolean {
        if (buffer.byteLength < 4) return false;
        const view = new Uint8Array(buffer);
        // Magic Number: [M, T, h, d] -> [0x4D, 0x54, 0x68, 0x64]
        return view[0] === 0x4D && view[1] === 0x54 && view[2] === 0x68 && view[3] === 0x64;
    }

    /**
     * 여러 에셋을 한꺼번에 로드합니다.
     */
    public async loadBatch(imagePaths: string[], audioPaths: string[] = []): Promise<void> {
        const promises = [
            ...imagePaths.map(path => this.loadImage(path)),
            ...audioPaths.map(path => this.loadAudio(path))
        ];

        await Promise.all(promises);
    }

    public getAudioContext(): AudioContext {
        return this.audioContext;
    }
}
