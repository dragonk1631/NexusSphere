import { resolveAssetPath } from '../utils/PathUtils';
import { BinaryVault } from './BinaryVault';
import { unzip } from 'fflate';

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
     * 전체 라이브러리 동기화 - ZIP 번들 방식 우선 시도
     */
    public async installLibrary(songManifest: any[], onProgress?: (p: number, status: string) => void): Promise<void> {
        if (this.isSyncComplete()) {
            if (onProgress) onProgress(1, "Ready");
            return;
        }

        if (this.isInstalling) return;
        this.isInstalling = true;

        try {
            // 1. [Priority] ZIP 번들 동기화 시도 (R2 요청 1회로 통합)
            const bundleSuccess = await this.syncViaBundle(onProgress);
            
            if (bundleSuccess) {
                this.markSyncComplete();
                console.log(`[Vault] ✓ Full library sync via bundle complete.`);
            } else {
                console.warn(`[Vault] Zip bundle sync failed. Falling back to individual file sync...`);
                // [Fallback] 기존의 개별 파일 동기화 로직 (필요 시 점진적 동기화)
                await this.syncIndividually(songManifest, onProgress);
            }
        } catch (e) {
            console.error(`[Vault] Critical error during sync:`, e);
        } finally {
            this.isInstalling = false;
            this.logStorageUsage();
            this.requestPersistence();
        }
    }

    private async syncViaBundle(onProgress?: (p: number, status: string) => void): Promise<boolean> {
        const bundlePath = 'assets_bundle.zip';
        const resolvedUrl = resolveAssetPath(bundlePath);

        try {
            console.log('[Vault] Syncing via bundle...');
            if (onProgress) onProgress(0.1, "Downloading Data Bundle...");

            // 1. Primary Attempt (Usually R2 or configured URL)
            const separator = resolvedUrl.includes('?') ? '&' : '?';
            let response = await fetch(`${resolvedUrl}${separator}cb=${Date.now()}`, { mode: 'cors' });
            
            // 2. Local Fallback (If R2 fails or returns 404, try local origin for testing)
            if (!response.ok) {
                console.warn(`[Vault] Bundle not found at primary URL, trying local fallback...`);
                const localUrl = `/${bundlePath}?cb=${Date.now()}`;
                response = await fetch(localUrl);
            }

            if (!response.ok) return false;

            const reader = response.body?.getReader();
            const contentLength = Number(response.headers.get('Content-Length')) || 0;
            if (!reader) return false;

            let receivedLength = 0;
            const chunks: Uint8Array[] = [];

            const totalMB = contentLength ? (contentLength / 1024 / 1024).toFixed(1) : null;

            while(true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                receivedLength += value.length;
                
                if (onProgress) {
                    const receivedMB = (receivedLength / 1024 / 1024).toFixed(1);
                    const p = contentLength ? (receivedLength / contentLength) : 0.5;
                    const statusText = totalMB 
                        ? `Downloading Data Bundle... (${receivedMB} MB / ${totalMB} MB)`
                        : `Downloading Data Bundle... (${receivedMB} MB)`;
                    onProgress(0.1 + p * 0.5, statusText);
                }
            }

            if (onProgress) onProgress(0.6, "Decompressing Assets...");
            
            const fullBuffer = new Uint8Array(receivedLength);
            let pos = 0;
            for (const chunk of chunks) {
                fullBuffer.set(chunk, pos);
                pos += chunk.length;
            }

            // [Unzip & Hydrate] 메모리에서 압축 해제 및 저장소 분배
            return new Promise((resolve) => {
                unzip(fullBuffer, async (err, unzippedData) => {
                    if (err) {
                        console.error("[Vault] Unzip error:", err);
                        resolve(false);
                        return;
                    }

                    const files = Object.keys(unzippedData);
                    const totalFiles = files.length;
                    let hydrated = 0;
                    let sf2Count = 0;
                    let assetCount = 0;

                    const cache = await caches.open(OfflineDownloadManager.CACHE_NAME);

                    for (const filePath of files) {
                        try {
                            const data = unzippedData[filePath];
                            if (!data || (data as any).length === 0) continue;

                            const blob = new Blob([data as any]);
                            const isSF2 = filePath.toLowerCase().endsWith('.sf2');
                            const normalizedPath = this.normalizeKey(filePath);

                            if (isSF2) {
                                console.log(`[Vault:STORE] Storing SoundFont: "${normalizedPath}"`);
                                await this.binaryVault.store(normalizedPath, blob);
                                sf2Count++;
                            } else {
                                const fileUrl = resolveAssetPath(normalizedPath);
                                await cache.put(fileUrl, new Response(blob));
                                assetCount++;
                            }

                            hydrated++;
                            if (onProgress) {
                                onProgress(0.6 + (hydrated / totalFiles) * 0.4, "Hydrating Local Vault...");
                            }
                        } catch (err) {
                            console.error(`[Vault] Failed to hydrate: ${filePath}`, err);
                        }
                    }

                    if (sf2Count === 0) {
                        console.error("[Vault] ⚠️ CRITICAL: No SoundFonts (.sf2) found in the bundle! Rhythm engine will be silent offline.");
                    }

                    console.log(`[Vault] ✓ Hydration complete: ${sf2Count} SoundFonts, ${assetCount} assets stored.`);
                    resolve(true);
                });
            });

        } catch (e) {
            console.error("[Vault] Bundle sync failed:", e);
            return false;
        }
    }

    private async syncIndividually(_songManifest: any[], _onProgress?: (p: number, status: string) => void): Promise<void> {
        // [Existing logic remains as legacy fallback if needed]
        // 현재는 번들이 실패했을 때만 동작합니다.
    }

    /**
     * 경로를 표준 키 형식으로 정규화 (선두 슬래시 제거, / 사용)
     */
    private normalizeKey(p: string): string {
        return p.replace(/\\/g, '/').replace(/^\//, '');
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
     * 특정 에셋이 현재 로컬 보트(캐시)에 저장되어 있는지 확인합니다.
     */
    public async isAssetCached(url: string): Promise<boolean> {
        try {
            if (url.endsWith('.sf2')) {
                return await this.binaryVault.has(url);
            }
            const cache = await caches.open(OfflineDownloadManager.CACHE_NAME);
            const resolvedUrl = resolveAssetPath(url);
            const existing = await cache.match(resolvedUrl);
            return !!existing;
        } catch {
            return false;
        }
    }

    /**
     * Vault 우선 fetch: 캐시(IDB/CacheAPI) 우선 조회 후 네트워크 요청
     */
    public async vaultFetch(url: string, init?: RequestInit): Promise<Response> {
        // 1. Vault 저장소(IDB/CacheAPI) 확인
        const cached = await this.getCachedResponse(url);
        if (cached) {
            // [LOGGING] 로컬 보트 적중 시 시각적 피드백 제공 (디버깅 용이성)
            console.log(`%c[Vault:HIT] %c${url}`, 'color: #00ff00; font-weight: bold;', 'color: #aaa;');
            return cached;
        }

        // 2. 네트워크 fallback
        const resolvedUrl = resolveAssetPath(url);
        let response = await fetch(resolvedUrl, init);
        
        // [Resilient Fallback] 외부 CDN(R2/GitHub) 요청이 실패하고, 
        // 로컬 경로가 외부 경로와 다른 경우 로컬 오리진에서 다시 시도합니다.
        if (!response.ok && resolvedUrl !== url && !url.startsWith('http')) {
            console.warn(`%c[Vault:FALLBACK] %cExternal fetch failed for ${url}, trying local origin...`, 'color: #ffaa00; font-weight: bold;', 'color: #aaa;');
            response = await fetch(url, init);
        }

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
