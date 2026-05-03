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
            case 'winter-snowflakes':
                const sfCx = x + w / 2;
                const sfCy = y + h / 2;
                const sfSize = w * 0.8;
                
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2.5;
                ctx.lineCap = 'round';
                ctx.shadowBlur = 12;
                ctx.shadowColor = baseColor;
                
                // Draw complex crystalline structure
                for (let i = 0; i < 6; i++) {
                    const angle = (i * Math.PI) / 3;
                    ctx.save();
                    ctx.translate(sfCx, sfCy);
                    ctx.rotate(angle);
                    
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(0, -sfSize / 2);
                    
                    // Main branches (Diamond tips)
                    const tipY = -sfSize / 2;
                    ctx.moveTo(0, tipY);
                    ctx.lineTo(-5, tipY + 8);
                    ctx.lineTo(5, tipY + 8);
                    ctx.closePath();
                    ctx.fillStyle = '#fff';
                    ctx.fill();

                    // Side branches (Ice needles)
                    ctx.moveTo(0, -sfSize * 0.25);
                    ctx.lineTo(-12, -sfSize * 0.4);
                    ctx.moveTo(0, -sfSize * 0.25);
                    ctx.lineTo(12, -sfSize * 0.4);
                    
                    ctx.stroke();
                    ctx.restore();
                }
                // Center crystal hex
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const a = (i * Math.PI) / 3;
                    const hx = sfCx + Math.cos(a) * 8;
                    const hy = sfCy + Math.sin(a) * 8;
                    if (i === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
                }
                ctx.closePath();
                ctx.fillStyle = `rgba(${this.hexToRgbaParams(baseColor)}, 0.5)`;
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1.5;
                ctx.stroke();
                break;
            case 'pill-capsules':
                ctx.beginPath();
                ctx.roundRect(x, y, w, h, h / 2);
                ctx.save();
                ctx.clip();
                // Left half (color)
                ctx.fillStyle = baseColor;
                ctx.fillRect(x, y, w / 2, h);
                // Right half (white/light) - Added depth
                const pGradRight = ctx.createLinearGradient(x + w / 2, y, x + w / 2, y + h);
                pGradRight.addColorStop(0, '#fff');
                pGradRight.addColorStop(1, '#ccc');
                ctx.fillStyle = pGradRight;
                ctx.fillRect(x + w / 2, y, w / 2, h);
                ctx.restore();
                
                // Better Center band
                ctx.strokeStyle = 'rgba(0,0,0,0.3)';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(x + w / 2, y);
                ctx.lineTo(x + w / 2, y + h);
                ctx.stroke();

                // High-gloss 3D highlight (Refined)
                const pillGrad = ctx.createLinearGradient(x, y, x, y + h);
                pillGrad.addColorStop(0, 'rgba(255,255,255,0.9)');
                pillGrad.addColorStop(0.3, 'rgba(255,255,255,0.2)');
                pillGrad.addColorStop(0.5, 'rgba(255,255,255,0)');
                pillGrad.addColorStop(0.8, 'rgba(0,0,0,0.1)');
                pillGrad.addColorStop(1, 'rgba(0,0,0,0.3)');
                ctx.fillStyle = pillGrad;
                ctx.beginPath();
                ctx.roundRect(x, y, w, h, h / 2);
                ctx.fill();
                break;
            case 'cat-face':
                const fCx = x + w / 2;
                const fCy = y + h / 2;
                const headW = w * 0.42;
                const headH = h * 0.45;
                
                // 1. Ears
                ctx.fillStyle = darkColor;
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 3;
                
                // Left Ear
                ctx.beginPath();
                ctx.moveTo(fCx - headW * 0.8, fCy - headH * 0.4);
                ctx.lineTo(fCx - headW * 1.0, fCy - headH * 1.1);
                ctx.lineTo(fCx - headW * 0.3, fCy - headH * 0.8);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                
                // Right Ear
                ctx.beginPath();
                ctx.moveTo(fCx + headW * 0.8, fCy - headH * 0.4);
                ctx.lineTo(fCx + headW * 1.0, fCy - headH * 1.1);
                ctx.lineTo(fCx + headW * 0.3, fCy - headH * 0.8);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // 2. Head Base
                const headGrad = ctx.createRadialGradient(fCx - 10, fCy - 10, 0, fCx, fCy, headW * 1.2);
                headGrad.addColorStop(0, '#fff');
                headGrad.addColorStop(0.3, baseColor);
                headGrad.addColorStop(1, darkColor);
                ctx.fillStyle = headGrad;
                ctx.beginPath();
                ctx.ellipse(fCx, fCy, headW * 1.1, headH, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 3;
                ctx.stroke();
                
                // 3. Eyes
                ctx.fillStyle = '#000';
                ctx.beginPath();
                ctx.arc(fCx - headW * 0.4, fCy - 2, 4, 0, Math.PI * 2);
                ctx.arc(fCx + headW * 0.4, fCy - 2, 4, 0, Math.PI * 2);
                ctx.fill();
                
                // 4. Blush (Cute detail)
                ctx.fillStyle = 'rgba(255, 100, 150, 0.4)';
                ctx.beginPath();
                ctx.arc(fCx - headW * 0.55, fCy + 5, 4, 0, Math.PI * 2);
                ctx.arc(fCx + headW * 0.55, fCy + 5, 4, 0, Math.PI * 2);
                ctx.fill();
                
                // 5. Whiskers
                ctx.strokeStyle = 'rgba(255,255,255,0.7)';
                ctx.lineWidth = 1.5;
                // Left whiskers
                ctx.beginPath();
                ctx.moveTo(fCx - headW * 0.8, fCy + 2); ctx.lineTo(fCx - headW * 1.3, fCy - 3);
                ctx.moveTo(fCx - headW * 0.8, fCy + 7); ctx.lineTo(fCx - headW * 1.3, fCy + 12);
                // Right whiskers
                ctx.moveTo(fCx + headW * 0.8, fCy + 2); ctx.lineTo(fCx + headW * 1.3, fCy - 3);
                ctx.moveTo(fCx + headW * 0.8, fCy + 7); ctx.lineTo(fCx + headW * 1.3, fCy + 12);
                ctx.stroke();
                
                // 6. Mouth (Small W)
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(fCx - 3, fCy + 8, 3, 0, Math.PI);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(fCx + 3, fCy + 8, 3, 0, Math.PI);
                ctx.stroke();
                break;
            case 'shining-stars':
                const sSpikes = 5;
                const sOuter = h * 0.72; // Reduced to prevent clipping
                const sInner = h * 0.32;
                const sCx = x + w / 2;
                const sCy = y + h / 2;

                ctx.beginPath();
                for (let i = 0; i < sSpikes * 2; i++) {
                    const radius = i % 2 === 0 ? sOuter : sInner;
                    const angle = (i * Math.PI) / sSpikes - Math.PI / 2;
                    // Horizontal scale: stay safely within 100px lane
                    const sx = sCx + Math.cos(angle) * radius * 1.3;
                    const sy = sCy + Math.sin(angle) * radius;
                    if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
                }
                ctx.closePath();
                
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 4;
                ctx.stroke();

                const sGrad = ctx.createRadialGradient(sCx, sCy, 0, sCx, sCy, sOuter * 1.5);
                sGrad.addColorStop(0, '#fff');
                sGrad.addColorStop(0.4, baseColor);
                sGrad.addColorStop(1, darkColor);
                ctx.fillStyle = sGrad;
                ctx.fill();

                // Inner Star Detail
                ctx.strokeStyle = 'rgba(255,255,255,0.3)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                for (let i = 0; i < sSpikes; i++) {
                    const a = (i * Math.PI * 2) / sSpikes - Math.PI / 2;
                    ctx.moveTo(sCx, sCy);
                    ctx.lineTo(sCx + Math.cos(a) * sOuter * 1.2, sCy + Math.sin(a) * sOuter * 0.8);
                }
                ctx.stroke();

                ctx.shadowBlur = 15;
                ctx.shadowColor = baseColor;
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(sCx, sCy, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                break;
            case 'diamond-gems':
                const dCx = x + w / 2;
                const dCy = y + h / 2;
                const dw = w * 0.95;
                const dh = h * 1.0; 

                // 1. MAIN BODY PATH (Define once)
                const defineDiamondPath = () => {
                    ctx.beginPath();
                    ctx.moveTo(dCx - dw * 0.28, dCy - dh * 0.45); 
                    ctx.lineTo(dCx + dw * 0.28, dCy - dh * 0.45); 
                    ctx.lineTo(dCx + dw * 0.5, dCy + dh * 0.0);   
                    ctx.lineTo(dCx, dCy + dh * 0.5);             
                    ctx.lineTo(dCx - dw * 0.5, dCy + dh * 0.0);   
                    ctx.closePath();
                };

                // FILL BODY
                defineDiamondPath();
                const dGrad = ctx.createLinearGradient(dCx, dCy - dh * 0.5, dCx, dCy + dh * 0.5);
                dGrad.addColorStop(0, '#fff');
                dGrad.addColorStop(0.4, baseColor);
                dGrad.addColorStop(1, darkColor);
                ctx.fillStyle = dGrad;
                ctx.fill();

                // 2. CROWN FACETS (Internal)
                ctx.strokeStyle = 'rgba(255,255,255,0.7)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(dCx - dw * 0.28, dCy - dh * 0.45);
                ctx.lineTo(dCx - dw * 0.18, dCy - dh * 0.15);
                ctx.lineTo(dCx + dw * 0.18, dCy - dh * 0.15);
                ctx.lineTo(dCx + dw * 0.28, dCy - dh * 0.45);
                ctx.moveTo(dCx - dw * 0.18, dCy - dh * 0.15);
                ctx.lineTo(dCx - dw * 0.5, dCy + dh * 0.0);
                ctx.moveTo(dCx + dw * 0.18, dCy - dh * 0.15);
                ctx.lineTo(dCx + dw * 0.5, dCy + dh * 0.0);
                ctx.moveTo(dCx - dw * 0.18, dCy - dh * 0.15);
                ctx.lineTo(dCx, dCy + dh * 0.5);
                ctx.moveTo(dCx + dw * 0.18, dCy - dh * 0.15);
                ctx.lineTo(dCx, dCy + dh * 0.5);
                ctx.stroke();

                // 3. CORE HIGHLIGHT
                ctx.fillStyle = 'rgba(255,255,255,0.4)';
                ctx.beginPath();
                ctx.moveTo(dCx - dw * 0.28, dCy - dh * 0.45);
                ctx.lineTo(dCx + dw * 0.28, dCy - dh * 0.45);
                ctx.lineTo(dCx, dCy - dh * 0.15);
                ctx.fill();
                
                // Central sparkle
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(dCx, dCy - dh * 0.15, 3, 0, Math.PI * 2);
                ctx.fill();

                // 4. OUTER BORDER (Re-define path to stroke)
                defineDiamondPath();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 4;
                ctx.stroke();
                break;
            case 'minimal-bars':
                ctx.fillStyle = baseColor;
                ctx.shadowBlur = 10;
                ctx.shadowColor = baseColor;
                ctx.fillRect(x, y + h * 0.3, w, h * 0.4);
                
                const barGrad = ctx.createLinearGradient(x, y + h * 0.3, x, y + h * 0.7);
                barGrad.addColorStop(0, 'rgba(255,255,255,0.6)');
                barGrad.addColorStop(0.5, 'rgba(255,255,255,0)');
                barGrad.addColorStop(1, 'rgba(0,0,0,0.3)');
                ctx.fillStyle = barGrad;
                ctx.fillRect(x, y + h * 0.3, w, h * 0.4);
                
                ctx.fillStyle = '#fff';
                ctx.globalAlpha = 0.7;
                ctx.fillRect(x, y + h * 0.45, w, h * 0.1);
                ctx.globalAlpha = 1.0;
                break;
            case 'crown':
                const crCx = x + w / 2;
                const crCy = y + h / 2;
                const crW = w * 0.45;
                const crH = h * 0.45;

                // 1. Crown Base
                const crGrad = ctx.createLinearGradient(crCx - crW, 0, crCx + crW, 0);
                crGrad.addColorStop(0, darkColor);
                crGrad.addColorStop(0.5, '#fff');
                crGrad.addColorStop(1, darkColor);
                
                ctx.fillStyle = crGrad;
                ctx.beginPath();
                ctx.roundRect(crCx - crW, crCy + crH * 0.2, crW * 2, crH * 0.5, 4);
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.stroke();

                // 2. Crown Points (3 points)
                ctx.beginPath();
                // Left point
                ctx.moveTo(crCx - crW, crCy + crH * 0.2);
                ctx.lineTo(crCx - crW * 0.9, crCy - crH * 0.6);
                ctx.lineTo(crCx - crW * 0.4, crCy + crH * 0.2);
                // Center point
                ctx.moveTo(crCx - crW * 0.3, crCy + crH * 0.2);
                ctx.lineTo(crCx, crCy - crH * 0.9);
                ctx.lineTo(crCx + crW * 0.3, crCy + crH * 0.2);
                // Right point
                ctx.moveTo(crCx + crW * 0.4, crCy + crH * 0.2);
                ctx.lineTo(crCx + crW * 0.9, crCy - crH * 0.6);
                ctx.lineTo(crCx + crW, crCy + crH * 0.2);
                ctx.fill();
                ctx.stroke();

                // 3. Ornaments (Tips)
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(crCx - crW * 0.9, crCy - crH * 0.6, 5, 0, Math.PI * 2);
                ctx.arc(crCx, crCy - crH * 0.9, 6, 0, Math.PI * 2);
                ctx.arc(crCx + crW * 0.9, crCy - crH * 0.6, 5, 0, Math.PI * 2);
                ctx.fill();
                
                // Extra inner jewel
                ctx.fillStyle = baseColor;
                ctx.beginPath();
                ctx.arc(crCx, crCy + crH * 0.45, 4, 0, Math.PI * 2);
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
                
                const bladeGrad = ctx.createLinearGradient(x, y, x + w, y);
                bladeGrad.addColorStop(0, 'rgba(255,255,255,0)');
                bladeGrad.addColorStop(0.5, 'rgba(255,255,255,0.9)');
                bladeGrad.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.strokeStyle = bladeGrad;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(x + 5, y + h / 2);
                ctx.lineTo(x + w - 5, y + h / 2);
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
                const hx = x + w / 2;
                const hy = y + h / 2;
                // Natural heart shape: not too wide
                const hw = w * 0.85; 
                const hh = h * 1.0;
                
                ctx.save();
                ctx.translate(hx, hy);
                
                // Outer Border
                ctx.beginPath();
                this.drawHeartShape(ctx, 0, 0, hw, hh);
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 5;
                ctx.stroke();
                ctx.fillStyle = '#fff';
                ctx.fill();
                
                // Inner Content
                ctx.beginPath();
                this.drawHeartShape(ctx, 0, 2, hw - 10, hh - 10);
                const hGrad = ctx.createLinearGradient(0, -hh/2, 0, hh/2);
                hGrad.addColorStop(0, '#fff');
                hGrad.addColorStop(0.3, baseColor);
                hGrad.addColorStop(1, darkColor);
                ctx.fillStyle = hGrad;
                ctx.fill();
                
                // Glossy Highlight (Better position)
                ctx.fillStyle = 'rgba(255,255,255,0.6)';
                ctx.beginPath();
                ctx.ellipse(-hw * 0.18, -hh * 0.22, hw * 0.12, hh * 0.08, Math.PI / 4, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.restore();
                break;
            case 'classic-gel':
            default:
                const gelGrad = ctx.createLinearGradient(x, y, x, y + h);
                gelGrad.addColorStop(0, baseColor);
                gelGrad.addColorStop(1, darkColor);
                ctx.fillStyle = gelGrad;
                ctx.beginPath();
                ctx.roundRect(x, y, w, h, h / 3);
                ctx.fill();
                
                // Outer highlight
                ctx.strokeStyle = 'rgba(255,255,255,0.4)';
                ctx.lineWidth = 2;
                ctx.stroke();

                // Advanced internal glazing
                const innerGrad = ctx.createLinearGradient(x, y, x, y + h * 0.6);
                innerGrad.addColorStop(0, 'rgba(255,255,255,0.9)');
                innerGrad.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = innerGrad;
                ctx.beginPath();
                ctx.roundRect(x + 3, y + 3, w - 6, h * 0.45, h / 4);
                ctx.fill();

                // Focal point highlight
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.ellipse(x + w * 0.3, y + h * 0.25, w * 0.15, h * 0.1, -Math.PI / 10, 0, Math.PI * 2);
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
            case 'winter-snowflakes':
                const rCx = vX + vW / 2;
                const rCy = vY + vH / 2;
                const sfRSize = vW * 0.75; 
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = lineWidth;
                ctx.lineCap = 'round';
                
                for (let i = 0; i < 6; i++) {
                    const angle = (i * Math.PI) / 3;
                    ctx.save();
                    ctx.translate(rCx, rCy);
                    ctx.rotate(angle);
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(0, -sfRSize / 2);
                    
                    // MATCH NOTE DESIGN EXACTLY: Diamond tips and needles
                    const tipY = -sfRSize / 2;
                    ctx.moveTo(0, tipY);
                    ctx.lineTo(-5, tipY + 8);
                    ctx.lineTo(5, tipY + 8);
                    ctx.closePath();
                    ctx.fillStyle = strokeColor;
                    ctx.fill();

                    ctx.moveTo(0, -sfRSize * 0.25);
                    ctx.lineTo(-10, -sfRSize * 0.4);
                    ctx.moveTo(0, -sfRSize * 0.25);
                    ctx.lineTo(10, -sfRSize * 0.4);
                    ctx.stroke();
                    ctx.restore();
                }
                const sfFillAlpha = isActive ? 0.5 : 0.2;
                ctx.fillStyle = `rgba(${this.hexToRgbaParams(baseColor)}, ${sfFillAlpha})`;
                ctx.beginPath();
                ctx.arc(rCx, rCy, 6, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 'pill-capsules':
                ctx.beginPath();
                ctx.roundRect(vX, vY, vW, vH, vH / 2);
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = lineWidth;
                ctx.stroke();

                const pillRFillAlpha = isActive ? 0.3 : 0.1;
                ctx.fillStyle = `rgba(${this.hexToRgbaParams(baseColor)}, ${pillRFillAlpha})`;
                ctx.fill();

                if (isActive) {
                    // Pill split highlight
                    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
                    ctx.beginPath();
                    ctx.moveTo(vX + vW / 2, vY);
                    ctx.lineTo(vX + vW / 2, vY + vH);
                    ctx.stroke();
                }
                break;
            case 'cat-face':
                const rfCx = vX + vW / 2;
                const rfCy = vY + vH / 2;
                const rHeadW = vW * 0.4;
                const rHeadH = vH * 0.42;
                
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = lineWidth;
                
                // Head outline
                ctx.beginPath();
                ctx.ellipse(rfCx, rfCy, rHeadW * 1.1, rHeadH, 0, 0, Math.PI * 2);
                ctx.stroke();
                
                // Ears outline
                ctx.beginPath();
                ctx.moveTo(rfCx - rHeadW * 0.8, rfCy - rHeadH * 0.4);
                ctx.lineTo(rfCx - rHeadW * 1.0, rfCy - rHeadH * 1.1);
                ctx.lineTo(rfCx - rHeadW * 0.3, rfCy - rHeadH * 0.8);
                ctx.moveTo(rfCx + rHeadW * 0.8, rfCy - rHeadH * 0.4);
                ctx.lineTo(rfCx + rHeadW * 1.0, rfCy - rHeadH * 1.1);
                ctx.lineTo(rfCx + rHeadW * 0.3, rfCy - rHeadH * 0.8);
                ctx.stroke();
                
                const cfFillAlpha = isActive ? 0.6 : 0.2;
                ctx.fillStyle = `rgba(${this.hexToRgbaParams(baseColor)}, ${cfFillAlpha})`;
                ctx.fill();
                break;
            case 'shining-stars':
                const sSpikes = 5;
                const sOuter = vH * 0.72; // Further reduced to avoid all clipping
                const sInner = vH * 0.32;
                const sCx = vX + vW / 2;
                const sCy = vY + vH / 2;

                ctx.beginPath();
                for (let i = 0; i < sSpikes * 2; i++) {
                    const radius = i % 2 === 0 ? sOuter : sInner;
                    const angle = (i * Math.PI) / sSpikes - Math.PI / 2;
                    // Scale: Stay within lane width
                    const sx = sCx + Math.cos(angle) * radius * 1.25;
                    const sy = sCy + Math.sin(angle) * radius;
                    if (i === 0) ctx.moveTo(sx, sy);
                    else ctx.lineTo(sx, sy);
                }
                ctx.closePath();
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = lineWidth;
                ctx.stroke();

                const sFillAlpha = isActive ? 0.6 : 0.2;
                ctx.fillStyle = `rgba(${this.hexToRgbaParams(baseColor)}, ${sFillAlpha})`;
                ctx.fill();

                if (isActive) {
                    ctx.fillStyle = '#fff';
                    ctx.beginPath();
                    ctx.arc(sCx, sCy, 4, 0, Math.PI * 2);
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
            case 'crown':
                const rcrCx = vX + vW / 2;
                const rcrCy = vY + vH / 2;
                const rcrW = vW * 0.45;
                const rcrH = vH * 0.45;

                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = lineWidth;
                
                // Base
                ctx.strokeRect(rcrCx - rcrW, rcrCy + rcrH * 0.2, rcrW * 2, rcrH * 0.5);
                
                // Points
                ctx.beginPath();
                ctx.moveTo(rcrCx - rcrW, rcrCy + rcrH * 0.2);
                ctx.lineTo(rcrCx - rcrW * 0.9, rcrCy - rcrH * 0.6);
                ctx.lineTo(rcrCx - rcrW * 0.4, rcrCy + rcrH * 0.2);
                ctx.moveTo(rcrCx - rcrW * 0.3, rcrCy + rcrH * 0.2);
                ctx.lineTo(rcrCx, rcrCy - rcrH * 0.9);
                ctx.lineTo(rcrCx + rcrW * 0.3, rcrCy + rcrH * 0.2);
                ctx.moveTo(rcrCx + rcrW * 0.4, rcrCy + rcrH * 0.2);
                ctx.lineTo(rcrCx + rcrW * 0.9, rcrCy - rcrH * 0.6);
                ctx.lineTo(rcrCx + rcrW, rcrCy + rcrH * 0.2);
                ctx.stroke();

                const crFillAlpha = isActive ? 0.6 : 0.25;
                ctx.fillStyle = `rgba(${this.hexToRgbaParams(baseColor)}, ${crFillAlpha})`;
                ctx.fill();
                break;

            case 'diamond-gems':
                const rdCx = vX + vW / 2;
                const rdCy = vY + vH / 2;
                const rdw = vW * 0.95;
                const rdh = vH * 1.0;

                const defineReceptorPath = () => {
                    ctx.beginPath();
                    ctx.moveTo(rdCx - rdw * 0.28, rdCy - rdh * 0.45);
                    ctx.lineTo(rdCx + rdw * 0.28, rdCy - rdh * 0.45);
                    ctx.lineTo(rdCx + rdw * 0.5, rdCy + rdh * 0.0);
                    ctx.lineTo(rdCx, rdCy + rdh * 0.5);
                    ctx.lineTo(rdCx - rdw * 0.5, rdCy + rdh * 0.0);
                    ctx.closePath();
                };

                // Fill
                defineReceptorPath();
                const dFillAlpha = isActive ? 0.6 : 0.2;
                ctx.fillStyle = `rgba(${this.hexToRgbaParams(baseColor)}, ${dFillAlpha})`;
                ctx.fill();

                // Stroke (Re-define path)
                defineReceptorPath();
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = lineWidth + 2; 
                ctx.stroke();

                // Internal lines
                ctx.beginPath();
                ctx.moveTo(rdCx - rdw * 0.28, rdCy - rdh * 0.45);
                ctx.lineTo(rdCx, rdCy - rdh * 0.15);
                ctx.lineTo(rdCx + rdw * 0.28, rdCy - rdh * 0.45);
                ctx.moveTo(rdCx, rdCy - rdh * 0.15);
                ctx.lineTo(rdCx, rdCy + rdh * 0.5);
                ctx.stroke();
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
                const rHx = vX + vW / 2;
                const rHy = vY + vH / 2;
                const rHw = vW * 0.85;
                const rHh = vH * 1.0;
                
                ctx.save();
                ctx.translate(rHx, rHy);
                ctx.beginPath();
                this.drawHeartShape(ctx, 0, 0, rHw, rHh);
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = lineWidth;
                ctx.stroke();

                const hFillAlpha = isActive ? 0.6 : 0.2;
                ctx.fillStyle = `rgba(${this.hexToRgbaParams(baseColor)}, ${hFillAlpha})`;
                ctx.fill();
                ctx.restore();
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
        const skins = NoteSkinManager.SKINS;
        const index = skins.findIndex(s => s.id === skinId);
        
        let colorSet = index === -1 ? this.COLORS[3] : this.COLORS[index % this.COLORS.length];

        // Specific color overrides for shop preview (requested by user)
        if (skinId === 'cat-face') {
            colorSet = ['#5D2E0C', '#8B4513']; // Brown
        } else if (skinId === 'heart-beats') {
            colorSet = ['#C71585', '#FF69B4']; // Pink
        }

        const canvas = this.createCachedNote(colorSet, skinId);
        return canvas.toDataURL();
    }

    private drawHeartShape(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
        const topY = y - h / 2;
        ctx.moveTo(x, topY + h * 0.3);
        ctx.bezierCurveTo(x, topY, x - w / 2, topY, x - w / 2, topY + h * 0.4);
        ctx.bezierCurveTo(x - w / 2, topY + h * 0.75, x, topY + h * 0.9, x, topY + h);
        ctx.bezierCurveTo(x, topY + h * 0.9, x + w / 2, topY + h * 0.75, x + w / 2, topY + h * 0.4);
        ctx.bezierCurveTo(x + w / 2, topY, x, topY, x, topY + h * 0.3);
    }
}
