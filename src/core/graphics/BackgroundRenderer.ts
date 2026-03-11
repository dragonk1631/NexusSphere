import { ThemeManager, type ThemeConfig } from '../ThemeManager';
import { ScreenUtils } from '../utils/ScreenUtils';

export class BackgroundRenderer {
    private static instance: BackgroundRenderer | null = null;
    private canvas: HTMLCanvasElement;
    private worker: Worker;
    private currentInstanceThemeId: string = "";

    private constructor() {
        this.canvas = document.getElementById('global-bg') as HTMLCanvasElement;

        // Spawn the worker
        this.worker = new Worker(new URL('./BackgroundWorker.ts', import.meta.url), { type: 'module' });

        // Transfer control to worker
        const offscreen = this.canvas.transferControlToOffscreen();

        const { width, height } = ScreenUtils.getVirtualDimensions();
        this.worker.postMessage({
            type: 'INIT',
            canvas: offscreen,
            width,
            height,
            pixelRatio: Math.min(window.devicePixelRatio, 1.5),
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

    public setTheme(theme: ThemeConfig) {
        if (this.currentInstanceThemeId !== theme.id) {
            this.currentInstanceThemeId = theme.id;
            // Send POJO theme config to worker
            this.worker.postMessage({
                type: 'SET_THEME',
                theme: JSON.parse(JSON.stringify(theme))
            });
        }
    }
}
