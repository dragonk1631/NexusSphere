import { ThemeManager, type ThemeConfig } from '../ThemeManager';
import { ScreenUtils } from '../utils/ScreenUtils';
import { PerformanceMonitor } from '../utils/PerformanceMonitor';
import { resolveAssetPath } from '../utils/PathUtils';
import { OfflineDownloadManager } from '../asset/OfflineDownloadManager';

export class BackgroundRenderer {
    private static instance: BackgroundRenderer | null = null;
    private canvas: HTMLCanvasElement;
    private worker: Worker;
    private currentInstanceThemeId: string = "";

    private constructor() {
        this.canvas = document.getElementById('global-bg') as HTMLCanvasElement;

        // Spawn the worker
        this.worker = new Worker(new URL('./BackgroundWorker.ts', import.meta.url), { type: 'module' });

        // Listen for feedback from worker
        this.worker.onmessage = (e) => {
            const data = e.data;
            if (data.type === 'PERF') {
                PerformanceMonitor.recordWorkerDuration(data.duration);
            }
        };

        // Transfer control to worker
        const offscreen = this.canvas.transferControlToOffscreen();

        const { width, height } = ScreenUtils.getVirtualDimensions();
        this.worker.postMessage({
            type: 'INIT',
            canvas: offscreen,
            width,
            height,
            pixelRatio: ScreenUtils.getPixelRatio(),
            isMobile: ScreenUtils.isMobile()
        }, [offscreen]);

        // Subscribe to theme changes
        ThemeManager.getInstance().subscribe((theme) => {
            this.setTheme(theme);
        });

        // Initial setup
        setTimeout(() => {
            this.resize();
            const initialTheme = ThemeManager.getInstance().getCurrentTheme();
            this.setTheme(initialTheme);
        }, 0);
    }

    public static getInstance(): BackgroundRenderer {
        if (!BackgroundRenderer.instance) {
            BackgroundRenderer.instance = new BackgroundRenderer();
        }
        return BackgroundRenderer.instance;
    }

    public resize() {
        if (!this.canvas) return;
        const { width, height } = ScreenUtils.getVirtualDimensions();
        // Just send resize to worker. The canvas element size is styled by CSS,
        // but the internal resolution is handled by the worker.
        this.worker.postMessage({
            type: 'RESIZE',
            width,
            height
        });
    }

    private pendingLoad: Promise<void> | null = null;
    private lastProgress: number = 0;
    private progressObservers: Set<(p: number) => void> = new Set();

    private emitProgress(p: number) {
        this.lastProgress = p;
        this.progressObservers.forEach(cb => cb(p));
    }

    public async setTheme(theme: ThemeConfig, onProgress?: (p: number) => void) {
        if (onProgress) this.progressObservers.add(onProgress);

        if (this.currentInstanceThemeId === theme.id && this.pendingLoad) {
            return this.pendingLoad;
        }

        this.currentInstanceThemeId = theme.id;
        
        this.pendingLoad = this.loadThemeInternal(theme);

        try {
            await this.pendingLoad;
        } finally {
            if (onProgress) this.progressObservers.delete(onProgress);
        }
        return this.pendingLoad;
    }

    private async loadThemeInternal(theme: ThemeConfig) {
        this.emitProgress(0);
        
        // 1. Send theme config to worker
        this.worker.postMessage({
            type: 'SET_THEME',
            theme: JSON.parse(JSON.stringify(theme))
        });

        // 2. Attempt to load background image (PRIORITY: Manifest -> Smart Fallback)
        try {
            const fallbackPath = `assets/images/background-themes/${theme.id}/bg_${theme.id}.jpg`;
            let url = theme.bgImage ? resolveAssetPath(theme.bgImage) : resolveAssetPath(fallbackPath);

            let loadedBitmap: ImageBitmap | null = null;
            
            if (url) {
                this.emitProgress(0.5);
                try {
                    const vault = OfflineDownloadManager.getInstance();
                    const primaryPath = theme.bgImage || fallbackPath;
                    const response = await vault.vaultFetch(primaryPath);
                    
                    if (response.ok) {
                        const blob = await response.blob();
                        loadedBitmap = await createImageBitmap(blob);
                    } else {
                        // If explicit/primary JPG fails, try ONE common alternate extension SILENTLY
                        const altPath = primaryPath.replace(/\.jpg$/i, '.webp');
                        if (altPath !== primaryPath) {
                            const altRes = await vault.vaultFetch(altPath);
                            if (altRes.ok) {
                                const blob = await altRes.blob();
                                loadedBitmap = await createImageBitmap(blob);
                            }
                        }
                    }
                } catch (e) {
                    console.warn(`[BackgroundRenderer] Fallback attempt for ${url}`, e);
                }
            }

            if (loadedBitmap) {
                this.worker.postMessage({
                    type: 'SET_BG_IMAGE',
                    bitmap: loadedBitmap
                }, [loadedBitmap]);
            } else {
                this.worker.postMessage({
                    type: 'SET_BG_IMAGE',
                    bitmap: null
                });
            }
        } catch (error) {
            console.error("[BackgroundRenderer] Failed to load background image:", error);
        }
        this.emitProgress(1.0);
    }

    /**
     * Returns a promise that resolves when the current theme's background 
     * assets (images) are fully loaded and sent to the worker.
     */
    public async waitForReady(onProgress?: (p: number) => void) {
        if (onProgress) {
            this.progressObservers.add(onProgress);
            onProgress(this.lastProgress);
        }

        if (this.pendingLoad) {
            await this.pendingLoad;
        }

        if (onProgress) {
            onProgress(1.0);
            this.progressObservers.delete(onProgress);
        }
    }

    /**
     * Signals the worker to render a single frame synchronized with the main loop.
     */
    public requestFrame(timestamp: number) {
        // Optimization: Use a typed array or 1-indexed codes for types to reduce serialization cost
        this.worker.postMessage([0, timestamp]); // 0 = DRAW_FRAME
    }
}
