

export class RenderCache {
    private static instance: RenderCache;

    // Cached Canvases
    public notes: HTMLCanvasElement[] = []; // Expanded for per-lane coloring
    public particleGlow: HTMLCanvasElement | null = null;
    public highwayBackground: HTMLCanvasElement | null = null;

    // Constants (Must match Game Logic)
    private readonly NOTE_WIDTH = 100; // Max width reference
    private readonly NOTE_HEIGHT = 50; // Increased from 40 for better visibility
    private readonly GLOW_RADIUS = 30;

    private readonly COLORS = [
        ['#ff0099', '#ff66cc'], // Lane 0: Pink
        ['#ff9900', '#ffcc00'], // Lane 1: Orange/Yellow
        ['#00ff00', '#66ff66'], // Lane 2: Green
        ['#00ffff', '#66ffff'], // Lane 3: Cyan
        ['#0066ff', '#66a3ff'], // Lane 4: Blue
        ['#cc00ff', '#e666ff'], // Lane 5: Purple
    ];

    private constructor() { }

    public static getInstance(): RenderCache {
        if (!RenderCache.instance) {
            RenderCache.instance = new RenderCache();
        }
        return RenderCache.instance;
    }

    public init(): void {
        console.log("[RenderCache] Generating static assets...");

        // 1. Cache Notes for all 6 lanes
        this.notes = this.COLORS.map(colors => this.createCachedNote(colors));

        // 2. Cache Particles (Generic White Glow)
        this.particleGlow = this.createGlowParticle();

        // 3. Cache Highway (Optional: Needs lane config, passing generic for now)
        // For dynamic resizing, highway might need re-generation on resize.
        // We will implement a method to generate it on demand.
    }

    private createCachedNote(colors: string[]): HTMLCanvasElement {
        const w = this.NOTE_WIDTH;
        const h = this.NOTE_HEIGHT;
        const padding = 20; // For glow
        const canvas = document.createElement('canvas');
        canvas.width = w + padding * 2;
        canvas.height = h + padding * 2;
        const ctx = canvas.getContext('2d')!;

        const x = padding;
        const y = padding;
        const baseColor = colors[1];
        const darkColor = colors[0];

        // 1. Outer Glow (Baked)
        ctx.shadowBlur = 15;
        ctx.shadowColor = baseColor;
        ctx.fillStyle = baseColor;
        // Draw a rect for shadow base
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 2, w - 4, h - 4, h / 3);
        ctx.fill();
        ctx.shadowBlur = 0; // Reset

        // 2. Base Body (Gradient)
        const grad = ctx.createLinearGradient(x, y, x, y + h);
        grad.addColorStop(0, baseColor);
        grad.addColorStop(1, darkColor);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, h / 3);
        ctx.fill();

        // 3. Glass Shine (Top Half)
        const innerGrad = ctx.createLinearGradient(x, y, x, y + h / 2);
        innerGrad.addColorStop(0, 'rgba(255,255,255,0.9)');
        innerGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = innerGrad;
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 2, w - 4, h / 2 - 2, h / 3);
        ctx.fill();

        // 4. Core Highlight (Ellipse)
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h * 0.3, w * 0.4, h * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();

        return canvas;
    }

    private createGlowParticle(): HTMLCanvasElement {
        const r = this.GLOW_RADIUS;
        const canvas = document.createElement('canvas');
        canvas.width = r * 2;
        canvas.height = r * 2;
        const ctx = canvas.getContext('2d')!;

        // Radial Gradient for soft glow
        const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.4, 'rgba(255, 255, 255, 0.2)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, r * 2, r * 2);

        return canvas;
    }

    /**
     * Generates a static image of the highway. 
     * call this on resize or init.
     */
    public renderHighwayToCache(
        width: number,
        height: number,
        horizonY: number,
        bottomY: number,
        laneCount: number,
        getPerspectiveX: (lane: number, y: number) => number
    ): HTMLCanvasElement {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;

        // Reuse the drawing logic from RhythmGame (minus active lane)
        const tl = { x: getPerspectiveX(0, horizonY), y: horizonY };
        const tr = { x: getPerspectiveX(laneCount, horizonY), y: horizonY };
        const bl = { x: getPerspectiveX(0, bottomY), y: bottomY };
        const br = { x: getPerspectiveX(laneCount, bottomY), y: bottomY };

        // 1. Side Rails
        const railWidth = 20;
        const outerGrad = ctx.createLinearGradient(0, horizonY, 0, bottomY);
        outerGrad.addColorStop(0, '#555');
        outerGrad.addColorStop(1, '#aaa');
        ctx.fillStyle = outerGrad;
        ctx.beginPath();
        ctx.moveTo(tl.x - railWidth, tl.y); ctx.lineTo(tl.x, tl.y); ctx.lineTo(bl.x, bl.y); ctx.lineTo(bl.x - railWidth * 3, bl.y);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(tr.x, tr.y); ctx.lineTo(tr.x + railWidth, tr.y); ctx.lineTo(br.x + railWidth * 3, br.y); ctx.lineTo(br.x, br.y);
        ctx.fill();

        // 2. Road Body
        const roadGrad = ctx.createLinearGradient(0, horizonY, 0, bottomY);
        roadGrad.addColorStop(0, 'rgba(0,0,0,0.8)');
        roadGrad.addColorStop(1, 'rgba(20,20,40, 0.9)');
        ctx.fillStyle = roadGrad;
        ctx.beginPath();
        ctx.moveTo(tl.x, tl.y); ctx.lineTo(tr.x, tr.y); ctx.lineTo(br.x, br.y); ctx.lineTo(bl.x, bl.y);
        ctx.fill();

        // 3. Dividers
        ctx.lineWidth = 2;
        for (let i = 1; i < laneCount; i++) {
            const topX = getPerspectiveX(i, horizonY);
            const botX = getPerspectiveX(i, bottomY);
            const divGrad = ctx.createLinearGradient(0, horizonY, 0, bottomY);
            divGrad.addColorStop(0, 'rgba(0, 255, 255, 0)');
            divGrad.addColorStop(0.5, 'rgba(0, 255, 255, 0.5)');
            divGrad.addColorStop(1, 'rgba(0, 255, 255, 0)');
            ctx.strokeStyle = divGrad;
            ctx.beginPath();
            ctx.moveTo(topX, horizonY); ctx.lineTo(botX, bottomY);
            ctx.stroke();
        }

        this.highwayBackground = canvas;
        return canvas;
    }
}
