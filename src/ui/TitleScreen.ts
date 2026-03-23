import { ScreenUtils } from '../core/utils/ScreenUtils';
import { MenuMusicManager } from '../core/audio/MenuMusicManager';

/**
 * CONFIG: Centralized Design System for Title Screen
 * Ensures zero "magic numbers" in the rendering logic.
 */
const CONFIG = {
    BRANDING: {
        TOP_SIZE: 140,
        BOT_SIZE: 180,
        GAP: 20,
        OUTLINE: 6,
        SHADOW_BLUR: 25,
        SHADOW_Y: 12,
        FONT: '900 px "Black Han Sans"'
    },
    GLOW: {
        RADIUS_BASE: 20,
        RADIUS_MAX: 100, // (20 + 80)
        AURA_COLOR: 'rgba(160, 210, 255, ',
        BLOOM_COLOR: 'rgba(255, 255, 255, '
    },
    MOTION: {
        TEMPO: 2.0,
        INTENSITY: 2.5, // Tanh multiplier
        PROMPT_TEMPO: 3.0
    },
    INTERACTION: {
        BTN_WIDTH_MAX: 280,
        BTN_HEIGHT: 50,
        BTN_RADIUS: 25,
        BTN_Y_RATIO: 0.85,
        PROMPT_OUTLINE: 4
    },
    COLORS: {
        METALLIC_TOP: ['#ffffff', '#bbd4ff', '#e2d5ff'],
        METALLIC_BOT: ['#ffffff', '#f0f4ff', '#cadbff'],
        ACCENT_CYAN: 'rgba(0, 188, 212, ',
        BTN_GRADIENT: ['rgba(0, 229, 255, ', 'rgba(0, 100, 255, ', 'rgba(0, 229, 255, ']
    }
};

export class TitleScreen {
    private container: HTMLDivElement;
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private onStart: () => void;
    
    // Logic State
    private time: number = 0;
    private width: number = 0;
    private height: number = 0;
    private dpr: number = 1;
    private isTransitioning: boolean = false;
    private lastAlpha: number = 0;
    private logoCache: HTMLCanvasElement | null = null;
    
    // Listeners for cleanup
    private boundHandleStart: (e: PointerEvent) => void;
    private boundUnlockAudio: () => void;

    constructor(onStart: () => void) {
        this.onStart = onStart;
        this.container = document.createElement('div');
        this.container.id = 'title-screen';

        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D;
        this.container.appendChild(this.canvas);

        this.applyStyles();
        
        // Initial state: hidden for flicker-free entry
        this.container.style.opacity = '0';
        this.container.style.transition = 'opacity 0.5s ease-out';
        document.body.appendChild(this.container);

        // Binding listeners for cleanup
        this.boundHandleStart = this.handleStart.bind(this);
        this.container.addEventListener('pointerdown', this.boundHandleStart as any);

        this.boundUnlockAudio = () => {
            if (!this.isTransitioning) {
                MenuMusicManager.getInstance().playMusic('title');
            }
            window.removeEventListener('pointerdown', this.boundUnlockAudio);
            window.removeEventListener('keydown', this.boundUnlockAudio);
        };
        window.addEventListener('pointerdown', this.boundUnlockAudio);
        window.addEventListener('keydown', this.boundUnlockAudio);

        this.resize();
        this.initFontGuard();
    }

    private applyStyles() {
        if (document.getElementById('title-screen-style')) return;
        const style = document.createElement('style');
        style.id = 'title-screen-style';
        style.textContent = `
            #title-screen {
                position: absolute;
                top: 0; left: 0;
                width: 100%; height: 100%;
                background: linear-gradient(135deg, #0a0a14 0%, #1a1a2e 100%);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 1000;
                cursor: pointer;
                overflow: hidden;
            }
            #title-screen canvas {
                display: block;
                width: 100%;
                height: 100%;
            }
        `;
        document.head.appendChild(style);
    }

    private initFontGuard() {
        const brandingFont = '900 24px "Black Han Sans"';
        document.fonts.load(brandingFont).then(() => {
            if (document.fonts.check(brandingFont)) {
                this.logoCache = null; 
                this.container.style.opacity = '1';
            } else {
                this.container.style.opacity = '1';
            }
        }).catch(() => {
            this.container.style.opacity = '1';
        });
    }

    public resize() {
        const { width, height } = ScreenUtils.getVirtualDimensions();
        this.dpr = window.devicePixelRatio || 1;
        this.width = width;
        this.height = height;
        
        // High-DPI Resolution setup
        this.canvas.width = width * this.dpr;
        this.canvas.height = height * this.dpr;
        
        // Reset logo cache for new resolution
        this.logoCache = null; 
    }

    private handleStart() {
        if (this.isTransitioning) return;
        this.isTransitioning = true;
        
        this.container.style.transition = 'opacity 0.8s ease-in-out, transform 1.2s ease-in';
        this.container.style.opacity = '0';
        this.container.style.transform = 'scale(1.1) translateZ(0)';
        
        setTimeout(() => {
            this.destroy();
            this.onStart();
        }, 800);
    }

    /**
     * Engine-Grade Game Loop Split
     */
    public updateAndRender(_timestamp: number, alpha: number) {
        if (this.isTransitioning) return;
        
        // 1. Update Logic (Fixed Delta for stability, though real DT is preferred)
        const dt = 0.016; 
        this.time += dt;
        this.lastAlpha = alpha;
        
        // 2. Render View
        this.render();
    }

    private render() {
        const { ctx, width: w, height: h, dpr, time } = this;
        
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, w, h);

        this.drawVersion(ctx);
        this.drawBranding(ctx);
        this.drawInteraction(ctx);

        ctx.restore();
    }

    private drawVersion(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.font = '900 12px "Orbitron"';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText('v1.0.0 EARLY ACCESS', 20, 30);
        ctx.restore();
    }

    private preRenderLogo() {
        if (this.logoCache) return;

        const { width: w, height: h, dpr } = this;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = w * dpr;
        tempCanvas.height = h * dpr;
        const tctx = tempCanvas.getContext('2d') as CanvasRenderingContext2D;

        tctx.scale(dpr, dpr);
        tctx.textAlign = 'center';
        tctx.textBaseline = 'middle';
        
        const title1 = "NexusSphere:";
        const title2 = "RHYTHM";

        // Calculate Scale
        tctx.font = `900 ${CONFIG.BRANDING.TOP_SIZE}px "Black Han Sans"`;
        const w1 = tctx.measureText(title1).width;
        tctx.font = `900 ${CONFIG.BRANDING.BOT_SIZE}px "Black Han Sans"`;
        const w2 = tctx.measureText(title2).width;

        const scale = Math.min(1, (w * 0.9) / Math.max(w1, w2));
        const sizeTop = CONFIG.BRANDING.TOP_SIZE * scale;
        const sizeBot = CONFIG.BRANDING.BOT_SIZE * scale;
        const centerY = Math.floor(h * 0.4);
        const gap = Math.round(CONFIG.BRANDING.GAP * scale);
        const totalTextH = sizeTop + sizeBot + gap;

        tctx.save();
        tctx.shadowColor = 'rgba(0,0,0,0.95)';
        tctx.shadowOffsetY = CONFIG.BRANDING.SHADOW_Y;
        tctx.shadowBlur = CONFIG.BRANDING.SHADOW_BLUR;

        // Title 1
        const y1 = Math.round(centerY - sizeBot / 2 - gap / 2);
        const grad1 = tctx.createLinearGradient(0, y1 - sizeTop/2, 0, y1 + sizeTop/2);
        CONFIG.COLORS.METALLIC_TOP.forEach((c, i) => grad1.addColorStop(i * 0.5, c));

        tctx.font = `900 ${sizeTop}px "Black Han Sans"`;
        tctx.strokeStyle = 'rgba(0,0,0,0.8)';
        tctx.lineWidth = CONFIG.BRANDING.OUTLINE;
        tctx.strokeText(title1, w / 2, y1);
        tctx.fillStyle = grad1;
        tctx.fillText(title1, w / 2, y1);
        
        // Title 2
        const y2 = Math.round(centerY + sizeTop / 2 + gap / 2);
        const grad2 = tctx.createLinearGradient(0, y2 - sizeBot/2, 0, y2 + sizeBot/2);
        CONFIG.COLORS.METALLIC_BOT.forEach((c, i) => grad2.addColorStop(i * 0.5, c));

        tctx.font = `900 ${sizeBot}px "Black Han Sans"`;
        tctx.strokeText(title2, w / 2, y2);
        tctx.fillStyle = grad2;
        tctx.fillText(title2, w / 2, y2);
        
        tctx.restore();
        this.logoCache = tempCanvas;
    }

    private drawBranding(ctx: CanvasRenderingContext2D) {
        this.preRenderLogo();
        if (!this.logoCache) return;

        const { width: w, height: h, time, lastAlpha } = this;
        
        // Pulse Logic
        const cycle = CONFIG.MOTION.TEMPO;
        const rawSin = Math.sin(time * cycle);
        const prevRawSin = Math.sin((time - 0.016) * cycle);
        const interpSin = prevRawSin + (rawSin - prevRawSin) * lastAlpha;
        const smoothed = Math.tanh(interpSin * CONFIG.MOTION.INTENSITY);
        const glowFactor = smoothed * 0.5 + 0.5;

        ctx.save();
        ctx.translate(w / 2, h * 0.4); 

        // 1. Glow (Behind)
        ctx.globalCompositeOperation = 'lighter';
        ctx.shadowColor = `${CONFIG.GLOW.AURA_COLOR}${0.4 * glowFactor})`; 
        ctx.shadowBlur = CONFIG.GLOW.RADIUS_BASE + glowFactor * 80; 
        ctx.drawImage(this.logoCache, 0, 0, w * dpr, h * dpr, -w / 2, -h * 0.4, w, h);

        ctx.shadowColor = `${CONFIG.GLOW.BLOOM_COLOR}${0.3 * glowFactor})`;
        ctx.shadowBlur = 10 + glowFactor * 30;
        ctx.drawImage(this.logoCache, 0, 0, w * dpr, h * dpr, -w / 2, -h * 0.4, w, h);
        
        // 2. Sharp Logo (Top)
        ctx.globalCompositeOperation = 'source-over';
        ctx.shadowColor = 'transparent'; 
        ctx.shadowBlur = 0;
        ctx.drawImage(this.logoCache, 0, 0, w * dpr, h * dpr, -w / 2, -h * 0.4, w, h);
        
        ctx.restore();
    }

    private drawInteraction(ctx: CanvasRenderingContext2D) {
        const { width: w, height: h, time, lastAlpha } = this;
        
        const cycle = CONFIG.MOTION.PROMPT_TEMPO;
        const rawSin = Math.sin(time * cycle);
        const prevRawSin = Math.sin((time - 0.016) * cycle);
        const interpSin = prevRawSin + (rawSin - prevRawSin) * lastAlpha;
        const intensity = Math.tanh(interpSin * 2.0) * 0.5 + 0.5;

        const btnW = Math.min(w * 0.6, CONFIG.INTERACTION.BTN_WIDTH_MAX);
        const btnH = CONFIG.INTERACTION.BTN_HEIGHT;
        const promptY = h * CONFIG.INTERACTION.BTN_Y_RATIO;
        const r = CONFIG.INTERACTION.BTN_RADIUS;

        ctx.save();
        
        // Button Shape
        ctx.shadowColor = `${CONFIG.COLORS.ACCENT_CYAN}${0.5 + intensity * 0.4})`;
        ctx.shadowBlur = 20 + intensity * 15;
        
        const grad = ctx.createLinearGradient(w/2 - btnW/2, 0, w/2 + btnW/2, 0);
        CONFIG.COLORS.BTN_GRADIENT.forEach((c, i) => grad.addColorStop(i * 0.5, `${c}${0.85 + (i===1?0.05:0) + intensity * 0.15})`));
        
        ctx.fillStyle = grad;
        this.helpDrawRoundedRect(ctx, w/2 - btnW/2, promptY - btnH/2, btnW, btnH, r);
        ctx.fill();

        // Button Outline
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.6 + intensity * 0.4})`;
        ctx.lineWidth = 3.5;
        ctx.stroke();

        // Button Text
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowOffsetY = 4;
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 24px "Black Han Sans"';
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.lineWidth = CONFIG.INTERACTION.PROMPT_OUTLINE;
        ctx.strokeText('PUSH START', w / 2, promptY);
        ctx.fillText('PUSH START', w / 2, promptY);
        ctx.restore();
        
        ctx.restore();
    }

    private helpDrawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    public destroy() {
        if (this.container && this.container.parentNode) {
            this.container.removeEventListener('pointerdown', this.boundHandleStart as any);
            document.body.removeChild(this.container);
        }
        window.removeEventListener('pointerdown', this.boundUnlockAudio);
        window.removeEventListener('keydown', this.boundUnlockAudio);
        
        const style = document.getElementById('title-screen-style');
        if (style && style.parentNode) {
            style.parentNode.removeChild(style);
        }
    }
}
