import { ThemeManager, type ThemeConfig } from '../ThemeManager';
import { ScreenUtils } from '../utils/ScreenUtils';
import { PerformanceMonitor } from '../utils/PerformanceMonitor';

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

    public async setTheme(theme: ThemeConfig) {
        if (this.currentInstanceThemeId !== theme.id) {
            this.currentInstanceThemeId = theme.id;
            
            // 1. Send theme config to worker
            this.worker.postMessage({
                type: 'SET_THEME',
                theme: JSON.parse(JSON.stringify(theme))
            });

            // 2. Attempt to load background image
            try {
                // Determine potential image paths
                // Priority: bg_space.png (for deep-space), bg.png, bg.jpg, bg.webp
                const extensions = ['png', 'jpg', 'webp'];
                const baseNames = [`bg_${theme.id}`, 'bg', 'bg_matrix', 'bg_space', 'bg_sunset', 'bg_marchen', 'bg_fireworks'];
                
                let loadedBitmap: ImageBitmap | null = null;
                
                for (const base of baseNames) {
                    for (const ext of extensions) {
                        const pathVariants = [
                            `/assets/images/background-themes/${theme.id}/${base}.${ext}`,
                            `assets/images/background-themes/${theme.id}/${base}.${ext}`,
                            `./assets/images/background-themes/${theme.id}/${base}.${ext}`
                        ];
                        
                        for (const url of pathVariants) {
                            try {
                                const response = await fetch(url);
                                if (response.ok) {
                                    console.log(`[BackgroundRenderer] ✅ Found image! URL: ${url}`);
                                    const blob = await response.blob();
                                    loadedBitmap = await createImageBitmap(blob);
                                    break;
                                }
                            } catch (e) {
                                // Silent retry
                            }
                        }
                        if (loadedBitmap) break;
                    }
                    if (loadedBitmap) break;
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
