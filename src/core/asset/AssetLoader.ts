import { resolveAssetPath } from '../utils/PathUtils';
import { OfflineDownloadManager } from './OfflineDownloadManager';

/**
 * NexusSphere Asset Loader
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

    public async loadImage(path: string): Promise<HTMLImageElement> {
        if (this.imageCache.has(path)) {
            return this.imageCache.get(path)!;
        }
        const vault = OfflineDownloadManager.getInstance();
        try {
            const response = await vault.vaultFetch(path);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const blob = await response.blob();
            const finalSrc = URL.createObjectURL(blob);
            return new Promise((resolve, reject) => {
                const img = new Image();
                // [Hardening] Explicit CORS for blob sources to ensure consistency across browsers
                img.crossOrigin = "anonymous";
                img.onload = () => {
                    this.imageCache.set(path, img);
                    resolve(img);
                };
                img.onerror = () => reject(`Failed to decode image blob: ${path}`);
                img.src = finalSrc;
            });
        } catch (e) {
            console.error(`[AssetLoader] Failed to load image: ${path}`, e);
            throw e;
        }
    }

    public async loadManifest(force: boolean = false): Promise<void> {
        if (this.manifestLoaded && !force) return;
        try {
            const res = await OfflineDownloadManager.getInstance().vaultFetch('assets_manifest.json');
            if (res.ok) {
                const list = await res.json();
                this.manifest = new Set(list);
                this.manifestLoaded = true;
                console.log(`[AssetLoader] Manifest ${force ? 'reloaded' : 'loaded'} with ${this.manifest.size} entries.`);
            }
        } catch (e) {
            console.warn("[AssetLoader] Failed to load manifest.", e);
        }
    }

    public getManifest(): Set<string> | null {
        return this.manifestLoaded ? this.manifest : null;
    }

    public async loadAudio(path: string): Promise<AudioBuffer> {
        if (this.audioBufferCache.has(path)) {
            return this.audioBufferCache.get(path)!;
        }
        const resolvedPath = resolveAssetPath(path);
        const arrayBuffer = await this.fetchWithWorker(resolvedPath);
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        this.audioBufferCache.set(path, audioBuffer);
        return audioBuffer;
    }

    public loadAudioStreaming(path: string): HTMLAudioElement {
        const resolvedPath = resolveAssetPath(path);
        const audio = new Audio();
        audio.crossOrigin = "anonymous";
        audio.preload = "auto";
        const vault = OfflineDownloadManager.getInstance();
        vault.getCachedResponse(path).then(async (response) => {
            if (response) {
                const blob = await response.blob();
                audio.src = URL.createObjectURL(blob);
            } else {
                audio.src = resolvedPath;
            }
        });
        return audio;
    }

    private async fetchWithWorker(url: string): Promise<ArrayBuffer> {
        const vault = OfflineDownloadManager.getInstance();
        const cachedResponse = await vault.getCachedResponse(url);
        if (cachedResponse) return await cachedResponse.arrayBuffer();

        return new Promise((resolve, reject) => {
            const worker = new Worker(new URL('../audio/workers/AudioLoader.worker.ts', import.meta.url), { type: 'module' });
            worker.onmessage = (e) => {
                const { success, buffer, error } = e.data;
                if (success) {
                    this.logCacheStatus(url, 'AUDIO');
                    vault.vaultFetch(url).catch(() => {});
                    resolve(buffer);
                } else {
                    console.error(`[AssetLoader] Worker load failed for: ${url}`, error);
                    reject(new Error(`Worker Failed: ${error}`));
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
     * Finds the correct MP3 path for a song by checking multiple fallback locations.
     * Supports intelligent suffix stripping (e.g., " (MP3)") and character normalization.
     */
    public async findAudioPath(songName: string): Promise<string | null> {
        // [STEP 1] Cleanup Song Name (Remove UI suffixes)
        const cleanName = songName
            .replace(/\s*\(MP3\)\s*/gi, '')
            .replace(/\s*\(Preview\)\s*/gi, '')
            .trim();

        // [STEP 2] Check default location first with clean name
        const defaultPath = `assets/audio/mp3/${cleanName}.mp3`;
        if (await this.checkAssetExists(defaultPath)) return defaultPath;

        // [STEP 3] Intelligent Search in Theme Folders using Manifest
        if (this.manifestLoaded) {
            const themeBase = 'assets/audio/ui/themes/';
            
            // Normalize query for fuzzy matching (Lowercase, No Spaces, No Underscores)
            const simplify = (s: string) => s.toLowerCase().replace(/[\s_]/g, '').normalize('NFC');
            const targetKey = simplify(cleanName);
            const targetKeyNFD = simplify(cleanName).normalize('NFD');

            for (const path of this.manifest) {
                if (path.startsWith(themeBase) && path.toLowerCase().endsWith('.mp3')) {
                    // Extract filename without extension
                    const filename = path.split('/').pop()?.split('.')[0] || '';
                    const fileKey = simplify(filename);
                    const fileKeyNFD = simplify(filename).normalize('NFD');

                    if (fileKey === targetKey || fileKey === targetKeyNFD || 
                        fileKeyNFD === targetKey || fileKeyNFD === targetKeyNFD) {
                        console.log(`[AssetLoader] Intelligent-matched audio: "${songName}" -> ${path}`);
                        return path;
                    }
                }
            }
        }

        return null;
    }

    public async checkAssetExists(path: string): Promise<boolean> {
        const normalizedPath = path.replace(/\\/g, '/').replace(/^\//, '');
        if (this.manifestLoaded) {
            if (this.manifest.has(normalizedPath)) return true;
            const nfc = normalizedPath.normalize('NFC');
            if (this.manifest.has(nfc)) return true;
            const nfd = normalizedPath.normalize('NFD');
            if (this.manifest.has(nfd)) return true;
            const decoded = decodeURI(normalizedPath);
            if (this.manifest.has(decoded.normalize('NFC'))) return true;
            if (this.manifest.has(decoded.normalize('NFD'))) return true;
            const vault = OfflineDownloadManager.getInstance();
            if (await vault.isAssetCached(path)) return true;
            return false;
        }
        const vault = OfflineDownloadManager.getInstance();
        if (await vault.isAssetCached(path)) return true;
        try {
            const response = await vault.vaultFetch(path, { method: 'HEAD' });
            return response.ok;
        } catch (e) {
            return false;
        }
    }

    public async checkJsonExists(path: string): Promise<boolean> {
        return this.checkAssetExists(path);
    }

    public validateMidi(buffer: ArrayBuffer): boolean {
        if (buffer.byteLength < 4) return false;
        const view = new Uint8Array(buffer);
        return view[0] === 0x4D && view[1] === 0x54 && view[2] === 0x68 && view[3] === 0x64;
    }

    public async loadBatch(imagePaths: string[], audioPaths: string[] = []): Promise<void> {
        const promises = [
            ...imagePaths.map(path => this.loadImage(path)),
            ...audioPaths.map(path => this.loadAudio(path))
        ];
        await Promise.all(promises);
    }

    private logCacheStatus(url: string, type: string) {
        setTimeout(() => {
            const entries = performance.getEntriesByName(url);
            if (entries.length === 0) return;
            const entry = entries[entries.length - 1] as PerformanceResourceTiming;
            let status = entry.transferSize === 0 ? '⚡ FULL CACHE HIT' : 'NETWORK';
            console.log(`[AssetLoader:${type}] ${status} ${url}`);
        }, 200);
    }

    public getAudioContext(): AudioContext {
        return this.audioContext;
    }
}
