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

        const resolvedPath = resolveAssetPath(path);
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.imageCache.set(path, img);
                this.logCacheStatus(resolvedPath, 'IMAGE');
                resolve(img);
            };
            img.onerror = () => reject(`Failed to load image: ${path}`);
            img.src = resolvedPath;
        });
    }

    /**
     * 에셋 매니페스트를 로드합니다. (무소음 점검의 핵심)
     */
    public async loadManifest(): Promise<void> {
        if (this.manifestLoaded) return;
        try {
            const url = resolveAssetPath('assets_manifest.json');
            const res = await fetch(url);
            if (res.ok) {
                const list = await res.json();
                this.manifest = new Set(list);
                this.manifestLoaded = true;
                this.logCacheStatus(url, 'MANIFEST');
                console.log(`[AssetLoader] Assets synchronization initialized with ${this.manifest.size} entries.`);
            }
        } catch (e) {
            console.warn("[AssetLoader] Failed to load manifest, falling back to network probes.", e);
        }
    }

    /**
     * 오디오 파일을 로드하여 AudioBuffer로 변환하고 캐싱합니다. (Web Worker 사용)
     */
    public async loadAudio(path: string): Promise<AudioBuffer> {
        if (this.audioBufferCache.has(path)) {
            return this.audioBufferCache.get(path)!;
        }

        const resolvedPath = resolveAssetPath(path);
        
        // [PHASE 3] Web Worker를 사용한 비동기 로딩 (Main thread 부하 방지)
        const arrayBuffer = await this.fetchWithWorker(resolvedPath);
        
        // decodeAudioData는 브라우저 내부 스레드에서 돌아가지만, 
        // 큰 파일의 경우 완료 시점에 메인 스레드 순각 점유가 발생할 수 있으므로 주의
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

        this.audioBufferCache.set(path, audioBuffer);
        return audioBuffer;
    }

    /**
     * [PHASE 3] 오디오 스트리밍을 위해 HTMLAudioElement를 반환합니다.
     */
    public loadAudioStreaming(path: string): HTMLAudioElement {
        const resolvedPath = resolveAssetPath(path);
        const audio = new Audio(resolvedPath);
        audio.crossOrigin = "anonymous";
        audio.preload = "auto";
        return audio;
    }

    private async fetchWithWorker(url: string): Promise<ArrayBuffer> {
        return new Promise((resolve, reject) => {
            const worker = new Worker(new URL('../audio/workers/AudioLoader.worker.ts', import.meta.url), { type: 'module' });
            
            worker.onmessage = (e) => {
                const { success, buffer, error } = e.data;
                if (success) {
                    this.logCacheStatus(url, 'AUDIO');
                    resolve(buffer);
                } else {
                    reject(new Error(error));
                }
                worker.terminate();
            };

            worker.onerror = (e) => {
                reject(new Error("Worker error: " + e.message));
                worker.terminate();
            };

            worker.postMessage({ url });
        });
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
            this.logCacheStatus(resolvedPath, 'PROBE');
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

    /**
     * 캐시 상태를 분석하여 콘솔에 시각적으로 출력합니다. (R2 최적화 점검용)
     */
    private logCacheStatus(url: string, type: string) {
        // 성능 데이터가 기록될 때까지 잠시 대기
        setTimeout(() => {
            const entries = performance.getEntriesByName(url);
            if (entries.length === 0) return;
            
            const entry = entries[entries.length - 1] as PerformanceResourceTiming;
            let status = 'NETWORK (200)';
            let color = '#00ffcc'; // 네온 싸이언 (네트워크)
            
            // 1. TransferSize가 0이면 브라우저 메모리/디스크 캐시에서 완전 적중 (0ms)
            // 2. TransferSize가 매우 작고 기간이 짧으면 304 Not Modified (R2 검증 완료)
            if (entry.transferSize === 0) {
                status = '⚡ FULL CACHE HIT (0ms)';
                color = '#ff00ff'; // 네온 핑크 (캐시 히트)
            } else if (entry.transferSize < 1000) { 
                status = '☁️ R2 VERIFIED (304)';
                color = '#ffff00'; // 네온 옐로우 (304 검증)
            }
            
            console.log(
                `%c[AssetLoader:${type}] %c${status} %c${url} (%c${Math.round(entry.duration)}ms%c)`,
                'color: #888;',
                `color: ${color}; font-weight: bold;`,
                'color: #aaa;',
                'color: #fff;',
                'color: #aaa;'
            );
        }, 200);
    }

    public getAudioContext(): AudioContext {
        return this.audioContext;
    }
}
