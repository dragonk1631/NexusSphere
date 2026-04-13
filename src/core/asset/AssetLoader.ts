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
    private manifest: Set<string> = new Set();
    private manifestLoaded: boolean = false;

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
     * 에셋 매니페스트를 로드합니다. (무소음 점검의 핵심)
     */
    public async loadManifest(): Promise<void> {
        if (this.manifestLoaded) return;
        try {
            const res = await fetch(resolveAssetPath('assets_manifest.json'));
            if (res.ok) {
                const list = await res.json();
                this.manifest = new Set(list);
                this.manifestLoaded = true;
                console.log(`[AssetLoader] Manifest loaded with ${this.manifest.size} entries.`);
            }
        } catch (e) {
            console.warn("[AssetLoader] Failed to load manifest, falling back to network probes.", e);
        }
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
     * Checks if a specific asset (e.g. mp3) exists using the manifest (Silent).
     */
    public async checkAssetExists(path: string): Promise<boolean> {
        // Normalize path to match manifest entry (relative to public/)
        const normalizedPath = path.replace(/\\/g, '/').replace(/^\//, '');

        if (this.manifestLoaded) {
            if (this.manifest.has(normalizedPath)) return true;
            
            // Try NFD/NFC normalization for international filenames
            const nfc = normalizedPath.normalize('NFC');
            if (this.manifest.has(nfc)) return true;
            
            const nfd = normalizedPath.normalize('NFD');
            if (this.manifest.has(nfd)) return true;

            const decoded = decodeURI(normalizedPath);
            if (this.manifest.has(decoded.normalize('NFC'))) return true;
            if (this.manifest.has(decoded.normalize('NFD'))) return true;

            return false;
        }

        // Fallback to noisy network probe only if manifest failed
        const resolvedPath = resolveAssetPath(path);
        try {
            const response = await fetch(resolvedPath, { method: 'HEAD' });
            return response.ok;
        } catch (e) {
            return false;
        }
    }

    /**
     * Checks if a JSON file exists using the manifest (Silent).
     */
    public async checkJsonExists(path: string): Promise<boolean> {
        return this.checkAssetExists(path);
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
