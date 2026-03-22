import { LoadingRenderer, type LoadingRenderState } from './LoadingRenderer';

export class LoadingOverlay {
    private static instance: LoadingOverlay | null = null;
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private renderer: LoadingRenderer;
    private state: LoadingRenderState;
    private isVisible: boolean = false;
    private animationId: number | null = null;

    private constructor() {
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'global-loading-overlay';
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100vw';
        this.canvas.style.height = '100vh';
        this.canvas.style.zIndex = '20000';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.transition = 'opacity 0.4s ease';
        this.canvas.style.opacity = '0';
        this.canvas.style.display = 'none';
        
        this.ctx = this.canvas.getContext('2d')!;
        this.renderer = new LoadingRenderer();
        
        this.state = {
            width: window.innerWidth,
            height: window.innerHeight,
            progress: 0,
            song: null,
            statusText: "LOADING...",
            cachedNow: 0
        };

        document.body.appendChild(this.canvas);
        window.addEventListener('resize', () => this.resize());
        this.resize();
    }

    public static getInstance() {
        if (!LoadingOverlay.instance) LoadingOverlay.instance = new LoadingOverlay();
        return LoadingOverlay.instance;
    }

    private resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.state.width = this.canvas.width;
        this.state.height = this.canvas.height;
    }

    public show(status: string = "LOADING...") {
        this.state.statusText = status;
        this.state.progress = 0;
        this.isVisible = true;
        this.canvas.style.display = 'block';
        void this.canvas.offsetWidth;
        this.canvas.style.opacity = '1';
        this.canvas.style.pointerEvents = 'auto';
        
        if (this.animationId === null) {
            this.loop();
        }
    }

    public updateProgress(p: number) {
        this.state.progress = p;
    }

    public hide() {
        this.canvas.style.opacity = '0';
        this.canvas.style.pointerEvents = 'none';
        this.isVisible = false;
        setTimeout(() => {
            if (!this.isVisible) {
                this.canvas.style.display = 'none';
                if (this.animationId !== null) {
                    cancelAnimationFrame(this.animationId);
                    this.animationId = null;
                }
            }
        }, 500);
    }

    private loop() {
        if (!this.isVisible && this.canvas.style.opacity === '0') return;
        
        this.state.cachedNow = performance.now();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.renderer.render(this.ctx, this.state);
        
        this.animationId = requestAnimationFrame(() => this.loop());
    }
}
