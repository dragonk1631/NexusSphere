import { ScreenUtils } from '../core/utils/ScreenUtils';
import { MenuMusicManager } from '../core/audio/MenuMusicManager';

export class TitleScreen {
    private container: HTMLDivElement;
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private onStart: () => void;
    private time: number = 0;
    private width: number = 0;
    private height: number = 0;
    private isTransitioning: boolean = false;
    private logoCache: HTMLCanvasElement | null = null;
    private lastAlpha: number = 0;

    constructor(onStart: () => void) {
        this.onStart = onStart;
        this.container = document.createElement('div');
        this.container.id = 'title-screen';

        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D;
        this.container.appendChild(this.canvas);

        this.applyStyles();
        // Hide initially for perfect loading
        this.container.style.opacity = '0';
        this.container.style.transition = 'opacity 0.5s ease-out';
        document.body.appendChild(this.container);

        this.resize();

        this.container.addEventListener('pointerdown', this.handleStart.bind(this));

        const unlockAudio = () => {
            if (!this.isTransitioning) {
                MenuMusicManager.getInstance().playMusic('title');
            }
            window.removeEventListener('pointerdown', unlockAudio);
            window.removeEventListener('keydown', unlockAudio);
        };
        window.addEventListener('pointerdown', unlockAudio);
        window.addEventListener('keydown', unlockAudio);

        // Fonts are LOCAL now - load resolves almost instantly.
        // Still wait to ensure canvas engine has the font before rendering.
        const brandingFont = '900 24px "Black Han Sans"';
        document.fonts.load(brandingFont).then(() => {
            this.preRenderLogo();
            requestAnimationFrame(() => {
                this.container.style.opacity = '1';
            });
        }).catch(() => {
            // Failsafe: show anyway
            this.preRenderLogo();
            this.container.style.opacity = '1';
        });
    }

    public resize() {
        const { width, height } = ScreenUtils.getVirtualDimensions();
        this.width = width;
        this.height = height;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.logoCache = null; // Invalidate cache on resize
    }

    private applyStyles() {
        if (document.getElementById('title-screen-style')) return;
        const style = document.createElement('style');
        style.id = 'title-screen-style';
        style.textContent = `
            #title-screen {
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                z-index: 10000; cursor: pointer; user-select: none;
                font-family: 'Nunito', sans-serif;
            }
            #title-screen canvas {
                display: block; width: 100%; height: 100%;
            }
        `;
        document.head.appendChild(style);
        // Fonts are now served locally via index.html @font-face — no CDN needed.
    }

    private handleStart(e: Event) {
        e.preventDefault();
        if (this.isTransitioning) return;
        this.isTransitioning = true;

        const flash = document.createElement('div');
        flash.style.position = 'fixed';
        flash.style.top = '0'; flash.style.left = '0';
        flash.style.width = '100vw'; flash.style.height = '100vh';
        flash.style.backgroundColor = 'white';
        flash.style.opacity = '0';
        flash.style.transition = 'opacity 0.4s ease-in, transform 0.4s ease-in';
        flash.style.zIndex = '10001';
        flash.style.transform = 'scale(1)';
        document.body.appendChild(flash);

        void flash.offsetWidth;
        flash.style.opacity = '1';
        flash.style.transform = 'scale(1.05)';

        setTimeout(() => {
            this.destroy();
            this.onStart();
            setTimeout(() => {
                flash.style.opacity = '0';
                setTimeout(() => flash.remove(), 400);
            }, 100);
        }, 400);
    }

    public updateAndRender(_timestamp: number, alpha: number) {
        if (this.isTransitioning) return;
        this.lastAlpha = alpha;
        this.time += 0.016; 
        this.render();
    }

    private preRenderLogo() {
        if (this.logoCache) return;
        const { width: w, height: h } = this;
        
        // Massive High-Impact Sizes
        const logoSizeTopBase = Math.min(w * 0.15, h * 0.15, 140);
        const logoSizeBotBase = Math.min(w * 0.2, h * 0.2, 180);
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = w;
        tempCanvas.height = h;
        const tempCtx = tempCanvas.getContext('2d')!;
        tempCtx.textAlign = 'center';
        tempCtx.textBaseline = 'middle';
        
        const title1 = "NexusSphere:";
        const title2 = "RHYTHM";

        tempCtx.font = `900 ${logoSizeTopBase}px "Black Han Sans"`;
        const width1Base = tempCtx.measureText(title1).width;
        tempCtx.font = `900 ${logoSizeBotBase}px "Black Han Sans"`;
        const width2Base = tempCtx.measureText(title2).width;

        const scale = Math.min(1, (w * 0.9) / Math.max(width1Base, width2Base));

        const logoSizeTop = logoSizeTopBase * scale;
        const logoSizeBot = logoSizeBotBase * scale;
        const centerY = Math.floor(h * 0.4);
        const gap = Math.round(20 * scale);
        const totalTextH = logoSizeTop + logoSizeBot + gap;

        tempCtx.save();
        // Deeper, Thicker Shadows for Cinematic Depth
        tempCtx.shadowColor = 'rgba(0,0,0,0.95)';
        tempCtx.shadowOffsetY = 12;
        tempCtx.shadowBlur = 25;

        // Title 1 Rendering
        tempCtx.font = `900 ${logoSizeTop}px "Black Han Sans"`;
        const topGrad = tempCtx.createLinearGradient(0, centerY - totalTextH/2, 0, centerY);
        topGrad.addColorStop(0, '#ffffff');
        topGrad.addColorStop(0.5, '#f0f4ff');
        topGrad.addColorStop(1, '#cadbff');
        const y1 = Math.round(centerY - logoSizeBot / 2 - gap / 2);
        tempCtx.strokeStyle = 'rgba(0,0,0,0.8)';
        tempCtx.lineWidth = 6;
        tempCtx.strokeText(title1, Math.round(w / 2), y1);
        tempCtx.fillStyle = topGrad;
        tempCtx.fillText(title1, Math.round(w / 2), y1);
        
        // Title 2 Rendering
        tempCtx.font = `900 ${logoSizeBot}px "Black Han Sans"`;
        const botGrad = tempCtx.createLinearGradient(0, centerY, 0, centerY + totalTextH/2);
        botGrad.addColorStop(0, '#ffffff');
        botGrad.addColorStop(0.5, '#f0f4ff');
        botGrad.addColorStop(1, '#cadbff');
        const y2 = Math.round(centerY + logoSizeTop / 2 + gap / 2);
        tempCtx.strokeText(title2, Math.round(w / 2), y2);
        tempCtx.fillStyle = botGrad;
        tempCtx.fillText(title2, Math.round(w / 2), y2);
        
        tempCtx.restore();
        this.logoCache = tempCanvas;
    }

    private render() {
        const { ctx, width: w, height: h, time, lastAlpha } = this;
        ctx.clearRect(0, 0, w, h);

        // 1. Version Badge
        ctx.save();
        ctx.font = '900 12px "Orbitron"';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText('v1.0.0 EARLY ACCESS', 20, 30);
        ctx.restore();

        // 2. Main Logo (Cinematic Saturating Glow Pulse)
        this.preRenderLogo();
        const cycleTempo = 2.0; 
        const rawSin = Math.sin(time * cycleTempo);
        const prevRawSin = Math.sin((time - 0.016) * cycleTempo);
        const interpolatedRawSin = prevRawSin + (rawSin - prevRawSin) * lastAlpha;
        
        // Use tanh for a "saturated" hold at peaks/troughs
        const smoothedSin = Math.tanh(interpolatedRawSin * 2.5);
        const glowFactor = (smoothedSin * 0.5 + 0.5);

        if (this.logoCache) {
            ctx.save();
            ctx.translate(w / 2, h * 0.4); 

            // DRAWING ORDER: Glows First, Base Logo Last (for absolute clarity)
            
            // Layer 1: Pulsing Aura Glow (Lighter/Additive Bloom)
            ctx.globalCompositeOperation = 'lighter';
            ctx.shadowColor = `rgba(160, 210, 255, ${0.4 * glowFactor})`; 
            ctx.shadowBlur = 20 + glowFactor * 80; 
            ctx.drawImage(this.logoCache, -w / 2, -h * 0.4);

            // Layer 2: Inner Core Brightness
            ctx.shadowColor = `rgba(255, 255, 255, ${0.3 * glowFactor})`;
            ctx.shadowBlur = 10 + glowFactor * 30;
            ctx.drawImage(this.logoCache, -w / 2, -h * 0.4);
            
            // Layer 3: Base Sharp Logo (Drawn on top)
            ctx.globalCompositeOperation = 'source-over';
            ctx.shadowColor = 'transparent'; 
            ctx.shadowBlur = 0;
            ctx.drawImage(this.logoCache, -w / 2, -h * 0.4);
            
            ctx.restore();
        }

        // 3. Interaction Prompt (Matching Pulse Style)
        const promptRawSin = Math.sin(time * 3);
        const prevPromptRawSin = Math.sin((time - 0.016) * 3);
        const interpolatedPromptRaw = prevPromptRawSin + (promptRawSin - prevPromptRawSin) * lastAlpha;
        const smoothedPromptSin = Math.tanh(interpolatedPromptRaw * 2.0);
        const interpolatedPulse = (smoothedPromptSin * 0.5 + 0.5);

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const btnW = Math.min(w * 0.6, 280);
        const btnH = 50;
        const promptY = h * 0.85;

        ctx.shadowColor = `rgba(0, 188, 212, ${0.5 + interpolatedPulse * 0.4})`;
        ctx.shadowBlur = 20 + interpolatedPulse * 15;
        const btnGrad = ctx.createLinearGradient(w/2 - btnW/2, 0, w/2 + btnW/2, 0);
        btnGrad.addColorStop(0, `rgba(0, 229, 255, ${0.85 + interpolatedPulse * 0.15})`);
        btnGrad.addColorStop(0.5, `rgba(0, 100, 255, ${0.9 + interpolatedPulse * 0.1})`);
        btnGrad.addColorStop(1, `rgba(0, 229, 255, ${0.85 + interpolatedPulse * 0.15})`);
        ctx.fillStyle = btnGrad;
        ctx.beginPath();
        ctx.roundRect(w/2 - btnW/2, promptY - btnH/2, btnW, btnH, btnH/2);
        ctx.fill();
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.6 + interpolatedPulse * 0.4})`;
        ctx.lineWidth = 3.5;
        ctx.stroke();

        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowOffsetY = 4;
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 24px "Black Han Sans"';
        ctx.letterSpacing = '1px';
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.lineWidth = 4;
        ctx.strokeText('PUSH START', w / 2, promptY);
        ctx.fillText('PUSH START', w / 2, promptY);
        ctx.restore();
        ctx.restore();
    }

    public destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        const style = document.getElementById('title-screen-style');
        if (style && style.parentNode) {
            style.parentNode.removeChild(style);
        }
    }
}
