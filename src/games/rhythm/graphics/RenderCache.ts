import { NoteSkinManager } from '../../../core/NoteSkinManager';
import { AssetLoader } from '../../../core/asset/AssetLoader';
import { OfflineDownloadManager } from '../../../core/asset/OfflineDownloadManager';

export class RenderCache {
    private static instance: RenderCache;

    // Cached Canvases
    public notes: HTMLCanvasElement[] = [];
    public longNoteBodies: HTMLCanvasElement[] = [];
    public receptors: HTMLCanvasElement[] = [];
    public receptorsActive: HTMLCanvasElement[] = [];
    public particleGlow: HTMLCanvasElement | null = null;
    public highwayBackground: HTMLCanvasElement | null = null;
    private isMobile: boolean = false;

    // Constants
    private readonly NOTE_WIDTH = 100;
    private readonly NOTE_HEIGHT = 50;
    private readonly GLOW_RADIUS = 30;

    private readonly COLORS = [
        ['#ff0066', '#ff3385'], // Lane 0
        ['#ffcc00', '#ffdb4d'], // Lane 1
        ['#00ff99', '#33ffad'], // Lane 2
        ['#00e5ff', '#33ebff'], // Lane 3
        ['#2979ff', '#5393ff'], // Lane 4
        ['#aa00ff', '#bb33ff'], // Lane 5
    ];

    private currentSkinId: string | null = null;

    private constructor() { }

    public static getInstance(): RenderCache {
        if (!RenderCache.instance) {
            RenderCache.instance = new RenderCache();
        }
        return RenderCache.instance;
    }

    public setMobile(isMobile: boolean): void {
        this.isMobile = isMobile;
    }

    public init(): void {
        const skin = NoteSkinManager.getInstance().getCurrentSkin();
        if (this.currentSkinId === skin.id) return; // Guard: skip redundant generation

        console.log(`[RenderCache] Generating static assets for skin: ${skin.id}`);
        this.currentSkinId = skin.id;

        this.notes = this.COLORS.map(colors => this.createCachedNote(colors, skin.id));
        this.longNoteBodies = this.COLORS.map(colors => this.createLongNoteBody(colors, skin.id));

        this.receptors = this.COLORS.map(colors => this.createCachedReceptor(colors, skin.id, false));
        this.receptorsActive = this.COLORS.map(colors => this.createCachedReceptor(colors, skin.id, true));

        this.particleGlow = this.createGlowParticle();
    }

    /**
     * PRE-CONDITION: init() must be called first to initialize sprites.
     */
    public async warmup(width: number, height: number, horizonY: number, bottomY: number, laneCount: number, getPerspectiveX: (l: number, y: number) => number, color1: string, color2: string, hitLineY: number): Promise<void> {
        return new Promise((resolve) => {
            // Re-warm background persistent canvas
            this.renderHighwayBackground(width, height, horizonY, bottomY, laneCount, getPerspectiveX, color1, color2, hitLineY);

            // Minimal delay for GPU state sync
            setTimeout(resolve, 30);
        });
    }

    public createCachedNote(colors: string[], skinId: string): HTMLCanvasElement {
        const w = this.NOTE_WIDTH;
        const h = this.NOTE_HEIGHT;
        const padding = 15;
        const canvas = document.createElement('canvas');
        canvas.width = w + padding * 2;
        canvas.height = h + padding * 2;
        const ctx = canvas.getContext('2d')!;

        const x = padding;
        const y = padding;
        const baseColor = colors[1];
        const darkColor = colors[0];

        ctx.shadowBlur = this.isMobile ? 0 : 5;
        ctx.shadowColor = baseColor;
        ctx.lineJoin = 'round';

        switch (skinId) {
            case 'cyber-neon':
                ctx.strokeStyle = baseColor;
                ctx.lineWidth = 6;
                ctx.strokeRect(x, y, w, h);
                ctx.fillStyle = 'rgba(255,255,255,0.8)';
                ctx.fillRect(x + w * 0.2, y + h * 0.4, w * 0.6, h * 0.2);
                break;
            case 'retro-blocks':
                ctx.shadowBlur = 0;
                ctx.fillStyle = darkColor;
                ctx.fillRect(x, y, w, h);
                ctx.fillStyle = baseColor;
                ctx.fillRect(x + 5, y + 5, w - 10, h - 10);
                ctx.fillStyle = '#fff';
                ctx.fillRect(x + 10, y + 10, 15, 10);
                break;
            case 'orb-lights':
                ctx.fillStyle = baseColor;
                ctx.beginPath();
                ctx.ellipse(x + w / 2, y + h / 2, Math.min(w, h * 1.5) / 2, h / 2, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.globalAlpha = 0.5;
                ctx.beginPath();
                ctx.ellipse(x + w / 2, y + h * 0.3, Math.min(w, h * 1.5) * 0.3, h * 0.15, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1.0;
                break;
            case 'diamond-stars':
                ctx.fillStyle = baseColor;
                ctx.beginPath();
                ctx.moveTo(x + w / 2, y);
                ctx.lineTo(x + w, y + h / 2);
                ctx.lineTo(x + w / 2, y + h);
                ctx.lineTo(x, y + h / 2);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 3;
                ctx.stroke();
                break;
            case 'minimal-bars':
                ctx.fillStyle = baseColor;
                ctx.shadowBlur = 15;
                ctx.shadowColor = baseColor;
                ctx.fillRect(x, y + h * 0.3, w, h * 0.4);
                ctx.fillStyle = '#fff';
                ctx.fillRect(x, y + h * 0.4, w, h * 0.2);
                break;
            case 'glass-spheres':
                const radGrad = ctx.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, h);
                radGrad.addColorStop(0, 'rgba(255,255,255,0.9)');
                radGrad.addColorStop(0.3, baseColor);
                radGrad.addColorStop(1, darkColor);
                ctx.fillStyle = radGrad;
                ctx.beginPath();
                ctx.roundRect(x, y, w, h, h / 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.6)';
                ctx.beginPath();
                ctx.roundRect(x + w * 0.1, y + 2, w * 0.8, h * 0.3, h / 4);
                ctx.fill();
                break;
            case 'laser-blades':
                ctx.fillStyle = baseColor;
                ctx.beginPath();
                ctx.moveTo(x + 10, y + h / 2);
                ctx.lineTo(x + w / 2, y + 5);
                ctx.lineTo(x + w - 10, y + h / 2);
                ctx.lineTo(x + w / 2, y + h - 5);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(x, y + h / 2);
                ctx.lineTo(x + w, y + h / 2);
                ctx.stroke();
                break;
            case 'hologram':
                ctx.fillStyle = `rgba(${this.hexToRgbaParams(baseColor)}, 0.5)`;
                ctx.strokeStyle = baseColor;
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, w, h);
                for (let i = 0; i < h; i += 4) {
                    ctx.fillRect(x, y + i, w, 2);
                }
                break;
            case 'heart-beats':
                ctx.fillStyle = baseColor;
                ctx.beginPath();
                // Increase width to better fill the 100px lane. 
                // Previous Math.min(w, h * 1.5) was ~75px. 
                // Let's use 90% of the core width (w=100) -> 90px.
                const hw = w * 0.9;
                const hx = x + w / 2;
                const hl = hx - hw / 2, hr = hx + hw / 2;
                ctx.moveTo(hx, y + h * 0.3);
                ctx.bezierCurveTo(hx, y - h * 0.1, hl, y - h * 0.1, hl, y + h * 0.4);
                ctx.bezierCurveTo(hl, y + h * 0.8, hx, y + h * 0.9, hx, y + h);
                ctx.bezierCurveTo(hx, y + h * 0.9, hr, y + h * 0.8, hr, y + h * 0.4);
                ctx.bezierCurveTo(hr, y - h * 0.1, hx, y - h * 0.1, hx, y + h * 0.3);
                ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.5)';
                ctx.beginPath();
                ctx.ellipse(x + w * 0.3, y + h * 0.3, w * 0.1, h * 0.1, Math.PI / 4, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 'classic-gel':
            default:
                ctx.fillStyle = baseColor;
                ctx.beginPath();
                ctx.roundRect(x + 2, y + 2, w - 4, h - 4, h / 3);
                ctx.fill();
                const grad = ctx.createLinearGradient(x, y, x, y + h);
                grad.addColorStop(0, baseColor);
                grad.addColorStop(1, darkColor);
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.roundRect(x, y, w, h, h / 3);
                ctx.fill();
                const innerGrad = ctx.createLinearGradient(x, y, x, y + h / 2);
                innerGrad.addColorStop(0, 'rgba(255,255,255,0.95)');
                innerGrad.addColorStop(1, 'rgba(255,255,255,0.1)');
                ctx.fillStyle = innerGrad;
                ctx.beginPath();
                ctx.roundRect(x + 2, y + 2, w - 4, h / 2 - 2, h / 3);
                ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.95)';
                ctx.beginPath();
                ctx.ellipse(x + w / 2, y + h * 0.3, w * 0.4, h * 0.15, 0, 0, Math.PI * 2);
                ctx.fill();
                break;
        }

        return canvas;
    }

    public createCachedReceptor(colors: string[], skinId: string, isActive: boolean): HTMLCanvasElement {
        const w = this.NOTE_WIDTH;
        const h = this.NOTE_HEIGHT;
        const padding = 20;
        const canvas = document.createElement('canvas');
        canvas.width = w + padding * 2;
        canvas.height = h + padding * 2;
        const ctx = canvas.getContext('2d')!;

        const baseColor = colors[1];
        const darkColor = colors[0];

        ctx.lineJoin = 'round';

        // Match full lane width for seamless alignment
        const drawW = w;
        const drawH = h;
        const drawX = padding;
        const drawY = padding;

        if (isActive) {
            ctx.shadowBlur = 12;
            ctx.shadowColor = baseColor;
            ctx.globalAlpha = 1.0;
        } else {
            // Idle state: Sophisticated "Glass Frame"
            ctx.shadowBlur = 4;
            ctx.shadowColor = 'rgba(0,0,0,0.5)'; // Softer shadow
            ctx.globalAlpha = 0.7; // Slightly more transparent
        }

        const strokeColor = isActive ? '#ffffff' : baseColor;
        const lineWidth = isActive ? 3 : 2;
        const halfLine = lineWidth / 2;

        // Visual bounds adjustment for pixel-perfect alignment
        const vX = drawX + halfLine;
        const vY = drawY + halfLine;
        const vW = drawW - lineWidth;
        const vH = drawH - lineWidth;

        switch (skinId) {
            case 'cyber-neon':
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = lineWidth;
                ctx.strokeRect(vX, vY, vW, vH);

                // Add subtle inner pulse/glow even when idle
                const cnInnerAlpha = isActive ? 0.3 : 0.15;
                ctx.fillStyle = `rgba(${this.hexToRgbaParams(baseColor)}, ${cnInnerAlpha})`;
                ctx.fillRect(vX, vY, vW, vH);

                if (isActive) {
                    const cnGrad = ctx.createLinearGradient(vX, vY, vX, vY + vH);
                    cnGrad.addColorStop(0, darkColor);
                    cnGrad.addColorStop(1, baseColor);
                    ctx.fillStyle = cnGrad;
                    ctx.fillRect(vX, vY, vW, vH);
                    ctx.fillStyle = 'rgba(255,255,255,0.9)';
                    ctx.fillRect(vX + vW * 0.2, vY + vH * 0.4, vW * 0.6, vH * 0.2);
                } else {
                    // Glass highlight for cyber look
                    ctx.fillStyle = 'rgba(255,255,255,0.05)';
                    ctx.fillRect(vX, vY, vW, vH * 0.4);
                }
                break;
            case 'retro-blocks':
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = lineWidth;
                ctx.strokeRect(vX, vY, vW, vH);

                // Inner "TV Screen" fill
                const rbFillAlpha = isActive ? 0.4 : 0.2;
                ctx.fillStyle = `rgba(${this.hexToRgbaParams(darkColor)}, ${rbFillAlpha})`;
                ctx.fillRect(vX + 2, vY + 2, vW - 4, vH - 4);

                if (isActive) {
                    const rbGrad = ctx.createLinearGradient(drawX, drawY, drawX, drawY + drawH);
                    rbGrad.addColorStop(0, baseColor);
                    rbGrad.addColorStop(1, darkColor);
                    ctx.fillStyle = rbGrad;
                    ctx.fillRect(drawX + 4, drawY + 4, drawW - 8, drawH - 8);
                    ctx.fillStyle = '#fff';
                    ctx.fillRect(drawX + 8, drawY + 8, drawW * 0.3, drawH * 0.3);
                }
                break;
            case 'orb-lights':
                ctx.beginPath();
                ctx.ellipse(vX + vW / 2, vY + vH / 2, Math.min(vW, vH * 1.5) / 2, vH / 2, 0, 0, Math.PI * 2);
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = lineWidth;
                ctx.stroke();

                // Soft radial fill
                const orbFillAlpha = isActive ? 0.6 : 0.25;
                const orbFillGrad = ctx.createRadialGradient(vX + vW / 2, vY + vH / 2, 0, vX + vW / 2, vY + vH / 2, vH / 2);
                orbFillGrad.addColorStop(0, `rgba(${this.hexToRgbaParams(baseColor)}, ${orbFillAlpha})`);
                orbFillGrad.addColorStop(1, `rgba(${this.hexToRgbaParams(darkColor)}, 0.1)`);
                ctx.fillStyle = orbFillGrad;
                ctx.fill();

                if (isActive) {
                    const orbGrad = ctx.createRadialGradient(vX + vW / 2, vY + vH / 2, 0, vX + vW / 2, vY + vH / 2, vH);
                    orbGrad.addColorStop(0, '#fff');
                    orbGrad.addColorStop(1, baseColor);
                    ctx.fillStyle = orbGrad;
                    ctx.fill();

                    // Strong reflection for active state
                    ctx.fillStyle = '#fff';
                    ctx.globalAlpha = 0.8;
                    ctx.beginPath();
                    ctx.ellipse(vX + vW / 2, vY + vH * 0.3, Math.min(vW, vH * 1.5) * 0.3, vH * 0.15, 0, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    // Subtle glass highlight
                    ctx.fillStyle = 'rgba(255,255,255,0.15)';
                    ctx.beginPath();
                    ctx.ellipse(vX + vW / 2, vY + vH * 0.25, vW * 0.2, vH * 0.1, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
            case 'diamond-stars':
                ctx.beginPath();
                ctx.moveTo(vX + vW / 2, vY);
                ctx.lineTo(vX + vW, vY + vH / 2);
                ctx.lineTo(vX + vW / 2, vY + vH);
                ctx.lineTo(vX, vY + vH / 2);
                ctx.closePath();
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = lineWidth;
                ctx.stroke();

                // Faint inner fill
                const dsFillAlpha = isActive ? 0.5 : 0.2;
                ctx.fillStyle = `rgba(${this.hexToRgbaParams(baseColor)}, ${dsFillAlpha})`;
                ctx.fill();

                if (isActive) {
                    const dsGrad = ctx.createLinearGradient(vX, vY, vX, vY + vH);
                    dsGrad.addColorStop(0, '#fff');
                    dsGrad.addColorStop(1, darkColor);
                    ctx.fillStyle = dsGrad;
                    ctx.fill();

                    // Center star highlight
                    ctx.fillStyle = '#fff';
                    ctx.beginPath();
                    ctx.moveTo(vX + vW / 2, vY + vH * 0.3);
                    ctx.lineTo(vX + vW * 0.7, vY + vH / 2);
                    ctx.lineTo(vX + vW / 2, vY + vH * 0.7);
                    ctx.lineTo(vX + vW * 0.3, vY + vH / 2);
                    ctx.fill();
                } else {
                    // Small glimmer highlight
                    ctx.fillStyle = 'rgba(255,255,255,0.2)';
                    ctx.beginPath();
                    ctx.moveTo(vX + vW / 2, vY + 4);
                    ctx.lineTo(vX + vW / 2 + 10, vY + 14);
                    ctx.lineTo(vX + vW / 2, vY + 10);
                    ctx.lineTo(vX + vW / 2 - 10, vY + 14);
                    ctx.fill();
                }
                break;
            case 'minimal-bars':
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = lineWidth;
                ctx.strokeRect(vX, vY + vH * 0.3, vW, vH * 0.4);

                // Horizontal glow effect
                const mbFillAlpha = isActive ? 0.6 : 0.2;
                const mbGrad = ctx.createLinearGradient(vX, 0, vX + vW, 0);
                mbGrad.addColorStop(0, 'rgba(255,255,255,0)');
                mbGrad.addColorStop(0.5, `rgba(${this.hexToRgbaParams(baseColor)}, ${mbFillAlpha})`);
                mbGrad.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = mbGrad;
                ctx.fillRect(vX, vY + vH * 0.3, vW, vH * 0.4);

                if (isActive) {
                    const mbActiveGrad = ctx.createLinearGradient(vX, vY, vX, vY + vH);
                    mbActiveGrad.addColorStop(0, baseColor);
                    mbActiveGrad.addColorStop(1, darkColor);
                    ctx.fillStyle = mbActiveGrad;
                    ctx.fillRect(vX, vY + vH * 0.35, vW, vH * 0.3);
                    ctx.fillStyle = '#fff';
                    ctx.fillRect(vX, vY + vH * 0.45, vW, vH * 0.1);
                }
                break;
            case 'glass-spheres':
                ctx.beginPath();
                ctx.roundRect(vX, vY, vW, vH, vH / 2);
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = lineWidth;
                ctx.stroke();

                // Advanced glass fill
                const gsFillAlpha = isActive ? 0.6 : 0.25;
                const gsGradFill = ctx.createLinearGradient(vX, vY, vX, vY + vH);
                gsGradFill.addColorStop(0, `rgba(255, 255, 255, ${gsFillAlpha})`);
                gsGradFill.addColorStop(1, `rgba(${this.hexToRgbaParams(baseColor)}, 0.1)`);
                ctx.fillStyle = gsGradFill;
                ctx.fill();

                if (isActive) {
                    const gsGrad = ctx.createRadialGradient(vX + vW / 2, vY + vH / 2, 0, vX + vW / 2, vY + vH / 2, vH);
                    gsGrad.addColorStop(0, '#fff');
                    gsGrad.addColorStop(0.3, baseColor);
                    gsGrad.addColorStop(1, darkColor);
                    ctx.fillStyle = gsGrad;
                    ctx.fill();

                    // Polished highlight
                    ctx.fillStyle = 'rgba(255,255,255,0.8)';
                    ctx.beginPath();
                    ctx.roundRect(vX + vW * 0.1, vY + 4, vW * 0.8, vH * 0.3, vH / 4);
                    ctx.fill();
                } else {
                    // Subtle glass edge highlight
                    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
                break;
            case 'laser-blades':
                ctx.beginPath();
                ctx.moveTo(vX + 10, vY + vH / 2);
                ctx.lineTo(vX + vW / 2, vY + 5);
                ctx.lineTo(vX + vW - 10, vY + vH / 2);
                ctx.lineTo(vX + vW / 2, vY + vH - 5);
                ctx.closePath();
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = lineWidth;
                ctx.stroke();

                // Faint energy core
                const lbInnerAlpha = isActive ? 0.4 : 0.15;
                ctx.fillStyle = `rgba(${this.hexToRgbaParams(baseColor)}, ${lbInnerAlpha})`;
                ctx.fill();

                if (isActive) {
                    const lbGrad = ctx.createLinearGradient(vX, vY, vX, vY + vH);
                    lbGrad.addColorStop(0, baseColor);
                    lbGrad.addColorStop(1, darkColor);
                    ctx.fillStyle = lbGrad;
                    ctx.fill();

                    // Razor sharp highlight
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 4;
                    ctx.beginPath();
                    ctx.moveTo(vX, vY + vH / 2);
                    ctx.lineTo(vX + vW, vY + vH / 2);
                    ctx.stroke();
                } else {
                    // Pulsing line in core (center)
                    ctx.strokeStyle = `rgba(255, 255, 255, 0.3)`;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(vX + 15, vY + vH / 2);
                    ctx.lineTo(vX + vW - 15, vY + vH / 2);
                    ctx.stroke();
                }
                break;
            case 'hologram':
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = lineWidth;
                ctx.strokeRect(vX, vY, vW, vH);

                // Holographic scanlines
                const holoAlpha = isActive ? 0.6 : 0.25;
                ctx.fillStyle = `rgba(${this.hexToRgbaParams(baseColor)}, ${holoAlpha})`;
                for (let i = 0; i < vH; i += 4) {
                    ctx.fillRect(vX, vY + i, vW, 1.5);
                }

                if (isActive) {
                    // Bright flickering fill
                    ctx.fillStyle = `rgba(${this.hexToRgbaParams(baseColor)}, 0.5)`;
                    ctx.fillRect(vX, vY, vW, vH);

                    // Highlight scanline
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                    ctx.fillRect(vX, vY + (Math.sin(performance.now() / 100) + 1) * vH / 2, vW, 3);
                }
                break;
            case 'heart-beats':
                ctx.beginPath();
                // Increase width to match note (90px)
                const hw = vW * 0.9;
                const hx = vX + vW / 2;
                const hl = hx - hw / 2, hr = hx + hw / 2;
                ctx.moveTo(hx, vY + vH * 0.3);
                ctx.bezierCurveTo(hx, vY - vH * 0.1, hl, vY - vH * 0.1, hl, vY + vH * 0.4);
                ctx.bezierCurveTo(hl, vY + vH * 0.8, hx, vY + vH * 0.9, hx, vY + vH);
                ctx.bezierCurveTo(hx, vY + vH * 0.9, hr, vY + vH * 0.8, hr, vY + vH * 0.4);
                ctx.bezierCurveTo(hr, vY - vH * 0.1, hx, vY - vH * 0.1, hx, vY + vH * 0.3);
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = lineWidth;
                ctx.stroke();

                // Soft heart fill (Glazing effect)
                const hbFillAlpha = isActive ? 0.7 : 0.25;
                const hbFillGrad = ctx.createLinearGradient(hx, vY, hx, vY + vH);
                hbFillGrad.addColorStop(0, `rgba(${this.hexToRgbaParams(baseColor)}, ${hbFillAlpha})`);
                hbFillGrad.addColorStop(1, `rgba(${this.hexToRgbaParams(darkColor)}, ${hbFillAlpha * 0.5})`);
                ctx.fillStyle = hbFillGrad;
                ctx.fill();

                if (isActive) {
                    const hbGrad = ctx.createRadialGradient(vX + vW / 2, vY + vH / 2, 0, vX + vW / 2, vY + vH / 2, vH);
                    hbGrad.addColorStop(0, '#fff');
                    hbGrad.addColorStop(1, darkColor);
                    ctx.fillStyle = hbGrad;
                    ctx.fill();

                    // Vivid highlight
                    ctx.fillStyle = 'rgba(255,255,255,0.85)';
                    ctx.beginPath();
                    ctx.ellipse(vX + vW * 0.3, vY + vH * 0.3, vW * 0.13, vH * 0.13, Math.PI / 4, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    // Glass highlight (Reflection)
                    ctx.fillStyle = 'rgba(255,255,255,0.4)';
                    ctx.beginPath();
                    ctx.ellipse(vX + vW * 0.3, vY + vH * 0.3, vW * 0.08, vH * 0.08, Math.PI / 4, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
            case 'classic-gel':
            default:
                ctx.beginPath();
                ctx.roundRect(vX, vY, vW, vH, vH / 3);
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = lineWidth;
                ctx.stroke();

                // Inner glazing
                const cgFillAlpha = isActive ? 0.7 : 0.3;
                const cgFillGrad = ctx.createLinearGradient(vX, vY, vX, vY + vH);
                cgFillGrad.addColorStop(0, `rgba(${this.hexToRgbaParams(baseColor)}, ${cgFillAlpha})`);
                cgFillGrad.addColorStop(1, `rgba(${this.hexToRgbaParams(darkColor)}, ${cgFillAlpha * 0.5})`);
                ctx.fillStyle = cgFillGrad;
                ctx.fill();

                if (isActive) {
                    const cgActiveGrad = ctx.createLinearGradient(vX, vY, vX, vY + vH);
                    cgActiveGrad.addColorStop(0, '#fff');
                    cgActiveGrad.addColorStop(0.5, baseColor);
                    cgActiveGrad.addColorStop(1, darkColor);

                    ctx.fillStyle = cgActiveGrad;
                    ctx.beginPath();
                    ctx.roundRect(vX + 2, vY + 2, vW - 4, vH - 4, vH / 3);
                    ctx.fill();

                    const innerActiveGrad = ctx.createLinearGradient(vX, vY, vX, vY + vH / 2);
                    innerActiveGrad.addColorStop(0, 'rgba(255,255,255,0.95)');
                    innerActiveGrad.addColorStop(1, 'rgba(255,255,255,0.1)');
                    ctx.fillStyle = innerActiveGrad;
                    ctx.beginPath();
                    ctx.roundRect(vX + 2, vY + 2, vW - 4, vH / 2 - 2, vH / 3);
                    ctx.fill();
                } else {
                    // Subtle glossy highlight
                    ctx.fillStyle = 'rgba(255,255,255,0.2)';
                    ctx.beginPath();
                    ctx.ellipse(vX + vW / 2, vY + vH * 0.25, vW * 0.35, vH * 0.1, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
        }

        ctx.globalAlpha = 1.0;
        return canvas;
    }


    public createLongNoteBody(colors: string[], skinId: string): HTMLCanvasElement {
        const w = 64;
        const h = 256;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;

        const baseColor = colors[1];

        switch (skinId) {
            case 'hologram':
            case 'matrix-grid':
            default: {
                // 1. Base Fill
                ctx.fillStyle = baseColor;
                ctx.fillRect(0, 0, w, h);

                // 2. Original Highlight Gradient
                // Black 0.4 -> Black 0.1 -> White 0.6 -> Black 0.1 -> Black 0.4
                const grad = ctx.createLinearGradient(0, 0, w, 0);
                grad.addColorStop(0, 'rgba(0, 0, 0, 0.4)');
                grad.addColorStop(0.2, 'rgba(0, 0, 0, 0.1)');
                grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.6)');
                grad.addColorStop(0.8, 'rgba(0, 0, 0, 0.1)');
                grad.addColorStop(1, 'rgba(0, 0, 0, 0.4)');

                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, w, h);

                // 3. Original Spine (Strong White Line)
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.fillRect(w * 0.5 - 1.75, 0, 3.5, h);

                // 4. Original Stroke (Side Edges)
                ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.fillRect(0, 0, 1.5, h);
                ctx.fillRect(w - 1.5, 0, 1.5, h);
                break;
            }
        }

        return canvas;
    }

    private hexToRgbaParams(hex: string): string {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `${r}, ${g}, ${b}`;
    }

    public createGlowParticle(): HTMLCanvasElement {
        const r = this.GLOW_RADIUS;
        const canvas = document.createElement('canvas');
        canvas.width = r * 2;
        canvas.height = r * 2;
        const ctx = canvas.getContext('2d')!;

        const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.4, 'rgba(255, 255, 255, 0.2)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, r * 2, r * 2);

        return canvas;
    }

    public renderHighwayBackground(
        width: number,
        height: number,
        horizonY: number,
        bottomY: number,
        laneCount: number,
        getPerspectiveX: (lane: number, y: number) => number,
        themeColor1: string,
        themeColor2: string,
        hitLineY: number = bottomY
    ): HTMLCanvasElement {
        if (!this.highwayBackground) {
            this.highwayBackground = document.createElement('canvas');
        }
        
        const canvas = this.highwayBackground;
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }
        
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, width, height);

        const tl = { x: getPerspectiveX(0, horizonY), y: horizonY };
        const tr = { x: getPerspectiveX(laneCount, horizonY), y: horizonY };
        const bl = { x: getPerspectiveX(0, bottomY), y: bottomY };
        const br = { x: getPerspectiveX(laneCount, bottomY), y: bottomY };

        // --- Side Rails (enhanced with gradient + inner highlight) ---
        const railWidth = 14;

        // Left Rail
        const leftRailGrad = ctx.createLinearGradient(0, horizonY, 0, bottomY);
        leftRailGrad.addColorStop(0, themeColor1);
        leftRailGrad.addColorStop(0.4, themeColor2);
        leftRailGrad.addColorStop(1, themeColor1);
        ctx.fillStyle = leftRailGrad;
        ctx.beginPath();
        ctx.moveTo(tl.x - railWidth, tl.y); ctx.lineTo(tl.x, tl.y); ctx.lineTo(bl.x, bl.y); ctx.lineTo(bl.x - railWidth * 2, bl.y);
        ctx.fill();

        // Left Rail: inner edge highlight (bright line along the lane edge)
        const leftHlGrad = ctx.createLinearGradient(0, horizonY, 0, bottomY);
        leftHlGrad.addColorStop(0, 'rgba(255, 255, 255, 0.0)');
        leftHlGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0.6)');
        leftHlGrad.addColorStop(0.7, 'rgba(255, 255, 255, 0.8)');
        leftHlGrad.addColorStop(1, 'rgba(255, 255, 255, 0.5)');
        ctx.strokeStyle = leftHlGrad;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(tl.x, tl.y); ctx.lineTo(bl.x, bl.y);
        ctx.stroke();

        // Left Rail: outer border line (gradient)
        const leftOuterGrad = ctx.createLinearGradient(0, horizonY, 0, bottomY);
        leftOuterGrad.addColorStop(0, 'rgba(255, 255, 255, 0.0)');
        leftOuterGrad.addColorStop(0.3, themeColor2);
        leftOuterGrad.addColorStop(0.7, themeColor1);
        leftOuterGrad.addColorStop(1, 'rgba(255, 255, 255, 0.3)');
        ctx.strokeStyle = leftOuterGrad;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(tl.x - railWidth, tl.y); ctx.lineTo(bl.x - railWidth * 2, bl.y);
        ctx.stroke();

        // Right Rail
        const rightRailGrad = ctx.createLinearGradient(0, horizonY, 0, bottomY);
        rightRailGrad.addColorStop(0, themeColor1);
        rightRailGrad.addColorStop(0.4, themeColor2);
        rightRailGrad.addColorStop(1, themeColor1);
        ctx.fillStyle = rightRailGrad;
        ctx.beginPath();
        ctx.moveTo(tr.x, tr.y); ctx.lineTo(tr.x + railWidth, tr.y); ctx.lineTo(br.x + railWidth * 2, br.y); ctx.lineTo(br.x, br.y);
        ctx.fill();

        // Right Rail: inner edge highlight
        const rightHlGrad = ctx.createLinearGradient(0, horizonY, 0, bottomY);
        rightHlGrad.addColorStop(0, 'rgba(255, 255, 255, 0.0)');
        rightHlGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0.6)');
        rightHlGrad.addColorStop(0.7, 'rgba(255, 255, 255, 0.8)');
        rightHlGrad.addColorStop(1, 'rgba(255, 255, 255, 0.5)');
        ctx.strokeStyle = rightHlGrad;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(tr.x, tr.y); ctx.lineTo(br.x, br.y);
        ctx.stroke();

        // Right Rail: outer border line (gradient)
        const rightOuterGrad = ctx.createLinearGradient(0, horizonY, 0, bottomY);
        rightOuterGrad.addColorStop(0, 'rgba(255, 255, 255, 0.0)');
        rightOuterGrad.addColorStop(0.3, themeColor2);
        rightOuterGrad.addColorStop(0.7, themeColor1);
        rightOuterGrad.addColorStop(1, 'rgba(255, 255, 255, 0.3)');
        ctx.strokeStyle = rightOuterGrad;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(tr.x + railWidth, tr.y); ctx.lineTo(br.x + railWidth * 2, br.y);
        ctx.stroke();

        // Legacy Road Gradient removed - Handled by HighwayBackgroundRenderer or ThemeBackground


        // Dividers: fade from horizon and stop at hit line (no overlap with judgment area)
        ctx.lineWidth = 1.3;
        for (let i = 1; i < laneCount; i++) {
            const topX = getPerspectiveX(i, horizonY);
            const botX = getPerspectiveX(i, hitLineY);
            const divGrad = ctx.createLinearGradient(0, horizonY, 0, hitLineY);
            divGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
            divGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0.35)');
            divGrad.addColorStop(0.85, 'rgba(255, 255, 255, 0.25)');
            divGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.strokeStyle = divGrad;
            ctx.beginPath();
            ctx.moveTo(topX, horizonY); ctx.lineTo(botX, hitLineY);
            ctx.stroke();
        }

        this.highwayBackground = canvas;
        return canvas;
    }

    private themePreviews: Map<string, string> = new Map();
    private readonly STORAGE_KEY = 'nexus_theme_thumbnails_v7';

    /** New: Synchronous retrieval from memory cache (assumes pre-loaded) */
    public getBackgroundPreviewUrlLocal(themeId: string): string | undefined {
        return this.themePreviews.get(themeId);
    }

    public async getBackgroundPreview(themeId: string): Promise<string> {
        // 1. Memory Cache
        if (this.themePreviews.has(themeId)) return this.themePreviews.get(themeId)!;

        // 2. LocalStorage Persistence (v7 Optimized)
        try {
            const stored = localStorage.getItem(`${this.STORAGE_KEY}_${themeId}`);
            if (stored) {
                this.themePreviews.set(themeId, stored);
                return stored;
            }
        } catch (e) { /* ignore */ }

        // 3. Generation (Balanced Quality/Performance)
        // Standard search paths: Check small thumbnails FIRST, then full backgrounds
        const baseNames = ['thumb', 'preview', `bg_${themeId}`, 'bg', 'icon'];
        const extensions = ['webp', 'png', 'jpg', 'jpeg'];
        
        const iconPaths: string[] = [];
        for (const base of baseNames) {
            for (const ext of extensions) {
                iconPaths.push(`assets/images/background-themes/${themeId}/${base}.${ext}`);
            }
        }

        let img: HTMLImageElement | null = null;
        let isPreRendered = false;
        
        const vault = OfflineDownloadManager.getInstance();
        const al = AssetLoader.getInstance();

        for (const path of iconPaths) {
            try {
                // 1. Check Vault FIRST (Silent & Offline-Safe)
                if (await vault.isAssetCached(path)) {
                    img = await al.loadImage(path);
                    if (img) {
                        if (path.includes('/thumb.') || path.includes('/preview.')) {
                            isPreRendered = true;
                        }
                        break;
                    }
                }
            } catch (e) { /* continue */ }
        }

        // 2. Network Fallback (Only if not found in vault)
        if (!img) {
            for (const path of iconPaths) {
                try {
                    const res = await vault.vaultFetch(path, { method: 'HEAD' });
                    if (res.ok) {
                        img = await al.loadImage(path);
                        if (img) {
                            if (path.includes('/thumb.') || path.includes('/preview.')) {
                                isPreRendered = true;
                            }
                            break;
                        }
                    }
                } catch (e) { /* continue */ }
            }
        }

        if (!img) return "";

        // Balanced Resolution (400x225) - Native clarity for UI grid
        const targetW = 400;
        const targetH = 225;
        
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = targetW;
        thumbCanvas.height = targetH;
        const tCtx = thumbCanvas.getContext('2d')!;
        tCtx.imageSmoothingEnabled = true;
        tCtx.imageSmoothingQuality = 'high';

        if (isPreRendered) {
            // High-Performance direct draw
            const scale = Math.max(targetW / img.width, targetH / img.height);
            const nw = img.width * scale;
            const nh = img.height * scale;
            tCtx.drawImage(img, (targetW - nw) / 2, (targetH - nh) / 2, nw, nh);
        } else {
            // HIGH QUALITY ITERATIVE DOWN-SAMPLING (Reduces jaggy/aliasing)
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d')!;
            
            let curW = img.width;
            let curH = img.height;
            
            tempCanvas.width = curW;
            tempCanvas.height = curH;
            tempCtx.drawImage(img, 0, 0);

            // Reducing by 50% steps provides the best visual filter
            while (curW > targetW * 2) {
                const nextW = Math.floor(curW * 0.5);
                const nextH = Math.floor(curH * 0.5);
                
                const stepCanvas = document.createElement('canvas');
                stepCanvas.width = nextW;
                stepCanvas.height = nextH;
                const stepCtx = stepCanvas.getContext('2d')!;
                stepCtx.imageSmoothingEnabled = true;
                stepCtx.imageSmoothingQuality = 'high';
                stepCtx.drawImage(tempCanvas, 0, 0, curW, curH, 0, 0, nextW, nextH);
                
                curW = nextW;
                curH = nextH;
                tempCanvas.width = curW;
                tempCanvas.height = curH;
                tempCtx.drawImage(stepCanvas, 0, 0);
            }

            // Final scale to target
            const scale = Math.max(targetW / curW, targetH / curH);
            const nw = curW * scale;
            const nh = curH * scale;
            tCtx.drawImage(tempCanvas, (targetW - nw) / 2, (targetH - nh) / 2, nw, nh);
        }

        // WebP quality 0.8 (Optimal balance for small UI elements)
        const dataUrl = thumbCanvas.toDataURL('image/webp', 0.8);
        
        // Save to cache & storage
        this.themePreviews.set(themeId, dataUrl);
        try {
            localStorage.setItem(`${this.STORAGE_KEY}_${themeId}`, dataUrl);
        } catch (e) { 
            console.warn("[RenderCache] LocalStorage quota exceeded");
        }
        
        return dataUrl;
    }



    public getPreviewDataURL(skinId: string): string {
        // Use Lane 3 (Cyber Cyan) colors for preview mapping
        const colorSet = this.COLORS[3];
        const canvas = this.createCachedNote(colorSet, skinId);
        return canvas.toDataURL();
    }
}
