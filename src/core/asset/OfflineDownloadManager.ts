import { resolveAssetPath } from '../utils/PathUtils';
import { BinaryVault } from './BinaryVault';

/**
 * OfflineDownloadManager (Vault)
 * 대용량 자산(120MB+)을 브라우저의 전용 Cache Storage 및 IndexedDB에 영구 설치하고 관리합니다.
 */
export class OfflineDownloadManager {
    private static instance: OfflineDownloadManager;
    private static readonly CACHE_NAME = 'nexussphere-asset-vault';
    private static readonly SYNC_KEY = 'nexus-vault-sync-v1'; 
    private isInstalling = false;
    private knownAssets: Set<string> | null = null;
    private binaryVault = BinaryVault.getInstance();

    private constructor() {}

    public static getInstance(): OfflineDownloadManager {
        if (!OfflineDownloadManager.instance) {
            OfflineDownloadManager.instance = new OfflineDownloadManager();
        }
        return OfflineDownloadManager.instance;
    }

    public setKnownAssets(manifest: Set<string>): void {
        this.knownAssets = manifest;
    }

    private isAssetKnown(relativePath: string): boolean {
        if (!this.knownAssets) return true;
        const normalized = relativePath.replace(/\\/g, '/').replace(/^\//, '');
        if (this.knownAssets.has(normalized)) return true;
        return false;
    }

    private isSyncComplete(): boolean {
        try {
            return localStorage.getItem(OfflineDownloadManager.SYNC_KEY) === 'done';
        } catch {
            return false;
        }
    }

    private markSyncComplete(): void {
        try {
            localStorage.setItem(OfflineDownloadManager.SYNC_KEY, 'done');
        } catch { /* ignore */ }
    }

    /**
     * 특정 URL을 영구 저장소에 설치합니다.
     * SF2와 같은 대형 파일은 IndexedDB(BinaryVault)에 스트리밍 방식으로 저장합니다.
     */
    public async installAsset(url: string, retryCount = 1, onProgress?: (p: number) => void): Promise<boolean> {
        if (!this.isAssetKnown(url)) return false;

        const resolvedUrl = resolveAssetPath(url);
        const isSF2 = url.endsWith('.sf2');

        // 1. 이미 저장되어 있는지 확인
        if (isSF2) {
            if (await this.binaryVault.has(url)) return true;
        } else {
            const cache = await caches.open(OfflineDownloadManager.CACHE_NAME);
            const existing = await cache.match(resolvedUrl);
            if (existing) return true;
        }

        for (let attempt = 0; attempt <= retryCount; attempt++) {
            try {
                // [Versioning] 타임스탬프 대신 쿼리 파라미터를 최소화하여 CDN 효율성 유지
                const syncUrl = attempt > 0 ? `${resolvedUrl}${resolvedUrl.includes('?') ? '&' : '?'}v_retry=${Date.now()}` : resolvedUrl;
                
                const headers: HeadersInit = {
                    // [Hardening] 브라우저의 추측성 Range 요청을 방지하고 전체 파일을 강제합니다.
                    'Range': 'bytes=0-'
                };

                const response = await fetch(syncUrl, { 
                    mode: 'cors',
                    headers,
                    cache: 'default'
                });

                if (!response.ok || response.status === 206) {
                    // 206 응답은 Range 요청이 부분적으로만 처리된 것이므로, 
                    // BinaryVault 저장을 위해 다시 시도하거나 에러 처리합니다.
                    if (response.status === 206 && !isSF2) {
                         throw new Error('206 Partial Content (Incompatible with Cache API)');
                    }
                }

                if (isSF2) {
                    // [Resilient Streaming] 대용량 파일은 스트림으로 읽어들여 신뢰성 확보
                    const reader = response.body?.getReader();
                    const contentLength = Number(response.headers.get('Content-Length')) || 0;
                    
                    if (!reader) throw new Error('ReadableStream not supported');

                    let receivedLength = 0;
                    const chunks: Uint8Array[] = [];

                    while(true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        chunks.push(value);
                        receivedLength += value.length;
                        
                        if (onProgress && contentLength) {
                            onProgress(receivedLength / contentLength);
                        }
                    }

                    const blob = new Blob(chunks as BlobPart[]);
                    await this.binaryVault.store(url, blob);
                } else {
                    const cache = await caches.open(OfflineDownloadManager.CACHE_NAME);
                    // 일반 파일은 Cache API 저장
                    await cache.put(resolvedUrl, response.clone());
                }
                
                return true;
            } catch (error) {
                if (attempt === retryCount) {
                    console.warn(`[Vault] ✗ ${url}: ${(error as Error).message}`);
                }
                await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); 
            }
        }
        return false;
    }

    /**
     * 전체 라이브러리 동기화
     */
    public async installLibrary(_songManifest: any[], onProgress?: (p: number) => void): Promise<void> {
        if (this.isSyncComplete()) {
            if (onProgress) onProgress(1);
            return;
        }

        if (this.isInstalling) return;
        this.isInstalling = true;

        const sf2Path = 'assets/audio/soundfonts/default.sf2';
        const normalize = (p: string) => p.replace(/\\/g, '/').replace(/^\//, '');
        
        let allUrls: string[] = [];
        if (this.knownAssets) {
            const targetSf2 = normalize(sf2Path);
            allUrls = Array.from(this.knownAssets).filter(u => normalize(u) !== targetSf2);
        }

        const total = allUrls.length + 1;
        let processedCount = 0;
        let successCount = 0;

        // 1. [Priority] 사운드폰트 스트리밍 설치
        console.log('[Vault] Phase 1: Streaming Priority Asset (SoundFont)...');
        const sf2Success = await this.installAsset(sf2Path, 3, (p) => {
            // SF2 내부 진행도를 전체 진행도에 반영 (0~1/total 사이)
            if (onProgress) onProgress((p * 0.9) / total);
        });

        if (sf2Success) successCount++;
        processedCount++;
        if (onProgress) onProgress(processedCount / total);

        // 2. [Batch] 나머지 일반 에셋 설치
        console.log('[Vault] Phase 2: Syncing remaining assets...');
        const BATCH_SIZE = 5;
        for (let i = 0; i < allUrls.length; i += BATCH_SIZE) {
            const batch = allUrls.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(async (url) => {
                if (await this.installAsset(url)) successCount++;
                processedCount++;
                if (onProgress) onProgress(processedCount / total);
            }));
        }

        this.isInstalling = false;

        if (successCount === total) {
            this.markSyncComplete();
            console.log(`[Vault] ✓ Full library sync complete.`);
        } else {
            console.log(`[Vault] ⚠ Partial sync: ${successCount}/${total}.`);
        }
        
        this.logStorageUsage();
        this.requestPersistence();
    }

    private async logStorageUsage() {
        if (navigator.storage && navigator.storage.estimate) {
            const estimate = await navigator.storage.estimate();
            const usedMB = ((estimate.usage || 0) / 1024 / 1024).toFixed(2);
            const quotaMB = ((estimate.quota || 0) / 1024 / 1024).toFixed(2);
            console.log(`[Vault] Storage Usage: ${usedMB} MB / ${quotaMB} MB (${(Number(usedMB)/Number(quotaMB)*100).toFixed(1)}%)`);
        }
    }

    public async getCachedResponse(url: string): Promise<Response | undefined> {
        try {
            // 사운드폰트인 경우 IDB에서 직접 조회하여 반환
            if (url.endsWith('.sf2')) {
                const blob = await this.binaryVault.get(url);
                if (blob) return new Response(blob);
            }

            const cache = await caches.open(OfflineDownloadManager.CACHE_NAME);
            const resolvedUrl = resolveAssetPath(url);
            return await cache.match(resolvedUrl);
        } catch {
            return undefined;
        }
    }

    /**
     * Vault 우선 fetch: 캐시(IDB/CacheAPI) 우선 조회 후 네트워크 요청
     */
    public async vaultFetch(url: string, init?: RequestInit): Promise<Response> {
        const resolvedUrl = resolveAssetPath(url);

        // 1. Vault 저장소(IDB/CacheAPI) 확인
        const cached = await this.getCachedResponse(url);
        if (cached) return cached;

        // 2. 네트워크 fallback
        const response = await fetch(resolvedUrl, init);
        
        // 자동 저장 (백그라운드)
        if (response.ok && response.status !== 206) {
            const clone = response.clone();
            const isSF2 = url.endsWith('.sf2');
            if (isSF2) {
                clone.blob().then(blob => this.binaryVault.store(url, blob));
            } else {
                caches.open(OfflineDownloadManager.CACHE_NAME).then(cache => cache.put(resolvedUrl, clone));
            }
        }
        
        return response;
    }

    private async requestPersistence() {
        if (navigator.storage && navigator.storage.persist) {
            const isPersisted = await navigator.storage.persist();
            console.log(`[Vault] Storage persistence ${isPersisted ? '✓ granted' : '✗ denied'}.`);
        }
    }
}
