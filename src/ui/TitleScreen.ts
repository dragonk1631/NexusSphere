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
    private logoCache: OffscreenCanvas | null = null;
    private lastAlpha: number = 0;

    constructor(onStart: () => void) {
        this.onStart = onStart;
        this.container = document.createElement('div');
        this.container.id = 'title-screen';

        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D;
        this.container.appendChild(this.canvas);

        this.applyStyles();
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
        if (!document.getElementById('title-screen-style')) document.head.appendChild(style);

        const fontLink = document.createElement('link');
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Nunito:wght@800;900&display=swap';
        fontLink.rel = 'stylesheet';
        document.head.appendChild(fontLink);
    }

    private handleStart(e: Event) {
        e.preventDefault();
        if (this.isTransitioning) return;
        this.isTransitioning = true;

        // Flash white effect
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

    private preRenderLogo() {
        if (this.logoCache) return;
        
        const { width: w, height: h } = this;
        
        // Approximate bubble bounds
        const logoSizeTopBase = Math.min(w * 0.10, h * 0.10, 90);
        const logoSizeBotBase = Math.min(w * 0.14, h * 0.14, 120);
        
        const tempCtx = new OffscreenCanvas(w, h).getContext('2d')!;
        tempCtx.textAlign = 'center';
        tempCtx.textBaseline = 'middle';
        
        const title1 = "NexusSphere:";
        const title2 = "RHYTHM";

        tempCtx.font = `900 ${logoSizeTopBase}px "Nunito"`;
        const width1Base = tempCtx.measureText(title1).width;
        tempCtx.font = `900 ${logoSizeBotBase}px "Nunito"`;
        const width2Base = tempCtx.measureText(title2).width;

        const maxWidth = w * 0.9;
        const maxTextWidth = Math.max(width1Base, width2Base);
        const scale = maxTextWidth > maxWidth ? maxWidth / maxTextWidth : 1;

        const logoSizeTop = logoSizeTopBase * scale;
        const logoSizeBot = logoSizeBotBase * scale;

        tempCtx.font = `900 ${logoSizeTop}px "Nunito"`;
        const width1 = tempCtx.measureText(title1).width;
        tempCtx.font = `900 ${logoSizeBot}px "Nunito"`;
        const width2 = tempCtx.measureText(title2).width;

        const padX = w > 600 ? 50 * scale : (20 + w * 0.02) * scale;
        const padY = padX * 0.6;

        const centerY = h * 0.4; // Local center for caching
        const textTop = centerY - logoSizeTop * 1.0;
        const textBottom = centerY + logoSizeBot * 1.0;

        const bubbleW = Math.max(width1, width2) + padX * 2;
        const bubbleH = (textBottom - textTop) + padY * 2;
        const bubbleX = w / 2 - bubbleW / 2;
        const bubbleY = textTop - padY;

        // Draw Speech Bubble
        tempCtx.save();
        tempCtx.shadowColor = 'rgba(0,0,0,0.8)';
        tempCtx.shadowOffsetY = 15;
        tempCtx.shadowBlur = 15;

        const bubbleGrad = tempCtx.createLinearGradient(0, bubbleY, 0, bubbleY + bubbleH + 30);
        bubbleGrad.addColorStop(0, 'rgba(40, 20, 60, 0.25)');
        bubbleGrad.addColorStop(1, 'rgba(15, 5, 30, 0.1)');
        tempCtx.fillStyle = bubbleGrad;
        tempCtx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        tempCtx.lineWidth = 8;

        const r = Math.min(40, bubbleH / 4);
        tempCtx.beginPath();
        tempCtx.roundRect(bubbleX, bubbleY, bubbleW, bubbleH, r);
        
        // Tail
        const tailSize = Math.min(35, h * 0.08);
        tempCtx.moveTo(w / 2 + 25, bubbleY + bubbleH);
        tempCtx.lineTo(w / 2, bubbleY + bubbleH + tailSize);
        tempCtx.lineTo(w / 2 - 25, bubbleY + bubbleH);
        
        tempCtx.fill();
        tempCtx.stroke();
        tempCtx.restore();

        // Draw Texts (Optimized gradient & stroke)
        tempCtx.save();
        tempCtx.font = `900 ${logoSizeTop}px "Nunito"`;
        const topGrad = tempCtx.createLinearGradient(0, centerY - logoSizeTop, 0, centerY);
        topGrad.addColorStop(0, '#ff9a9e');
        topGrad.addColorStop(1, '#fede7f');
        tempCtx.fillStyle = topGrad;
        tempCtx.shadowColor = 'rgba(0,0,0,0.5)';
        tempCtx.shadowOffsetY = 5;
        tempCtx.shadowBlur = 10;
        tempCtx.fillText(title1, w / 2, centerY - logoSizeTop * 0.4);
        
        tempCtx.font = `900 ${logoSizeBot}px "Nunito"`;
        const botGrad = tempCtx.createLinearGradient(0, centerY, 0, centerY + logoSizeBot);
        botGrad.addColorStop(0, '#fdcb6e');
        botGrad.addColorStop(1, '#ffeaa7');
        tempCtx.fillStyle = botGrad;
        tempCtx.fillText(title2, w / 2, centerY + logoSizeBot * 0.5);
        tempCtx.restore();

        this.logoCache = tempCtx.canvas as OffscreenCanvas;
    }

    public updateAndRender(_timestamp: number, alpha: number) {
        if (this.isTransitioning) return;
        this.lastAlpha = alpha;
        this.time += 0.016; 
        this.render();
    }

    private render() {
        const { ctx, width: w, height: h, time, lastAlpha } = this;
        ctx.clearRect(0, 0, w, h);

        // 1. Version Badge
        ctx.save();
        ctx.font = '800 14px "Nunito"';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText('v1.0.0 EARLY ACCESS', 20, 30);
        ctx.restore();

        // 2. Main Logo (Interpolated Y)
        this.preRenderLogo();
        const currentSin = Math.sin(time * 1.5);
        const prevSin = Math.sin((time - 0.016) * 1.5);
        const interpolatedSin = prevSin + (currentSin - prevSin) * lastAlpha;
        const centerYOffset = interpolatedSin * 10;

        if (this.logoCache) {
            ctx.drawImage(this.logoCache, 0, centerYOffset);
        }

        // 3. Interaction Prompt (Interpolated Pulse)
        const currentPulseSin = Math.sin(time * 3);
        const prevPulseSin = Math.sin((time - 0.016) * 3);
        const interpolatedPulse = ((prevPulseSin + (currentPulseSin - prevPulseSin) * lastAlpha) * 0.5 + 0.5);

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const btnW = Math.min(w * 0.6, 280);
        const btnH = 50;
        const promptY = h * 0.85;

        ctx.shadowColor = `rgba(0, 188, 212, ${0.3 + interpolatedPulse * 0.3})`;
        ctx.shadowBlur = 15 + interpolatedPulse * 10;
        ctx.fillStyle = `rgba(0, 188, 212, ${0.05 + interpolatedPulse * 0.1})`;
        ctx.beginPath();
        ctx.roundRect(w/2 - btnW/2, promptY - btnH/2, btnW, btnH, btnH/2);
        ctx.fill();
        ctx.strokeStyle = `rgba(0, 234, 255, ${0.3 + interpolatedPulse * 0.5})`;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = '800 20px "Nunito"';
        ctx.letterSpacing = '1px';
        ctx.fillText('TAP TO START', w / 2, promptY);
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
