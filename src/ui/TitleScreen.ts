import { ScreenUtils } from '../core/utils/ScreenUtils';

export class TitleScreen {
    private container: HTMLDivElement;
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private onStart: () => void;
    private rafId: number = 0;
    private time: number = 0;
    private width: number = 0;
    private height: number = 0;
    private isTransitioning: boolean = false;

    constructor(onStart: () => void) {
        this.onStart = onStart;
        this.container = document.createElement('div');
        this.container.id = 'title-screen';

        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D; // Make it transparent
        this.container.appendChild(this.canvas);

        this.applyStyles();
        document.body.appendChild(this.container);

        this.resize();

        this.container.addEventListener('pointerdown', this.handleStart.bind(this));

        // removed particle init

        this.loop();
    }

    public resize() {
        const { width, height } = ScreenUtils.getVirtualDimensions();
        this.width = width;
        this.height = height;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
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

    private loop() {
        this.time += 0.016;
        this.render();
        if (!this.isTransitioning) {
            this.rafId = requestAnimationFrame(this.loop.bind(this));
        }
    }

    private render() {
        const { ctx, width: w, height: h, time } = this;

        // Clear the canvas to show the global background behind it
        ctx.clearRect(0, 0, w, h);

        // 4. Version Badge (Top Left)
        ctx.save();
        ctx.font = '800 16px "Nunito"';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.textAlign = 'left';
        ctx.fillText('v1.0.0 EARLY ACCESS', 20, 30);
        ctx.restore();

        // 5. Main Logo Render
        const centerY = h * 0.4 + Math.sin(time * 1.5) * 10;

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Set up variables for text to compute bubble size
        // Limit font sizes by BOTH width and height to prevent bleeding on short/wide screens
        const logoSizeTopBase = Math.min(w * 0.10, h * 0.10, 90);
        const title1 = "NexusSphere:";
        const logoSizeBotBase = Math.min(w * 0.14, h * 0.14, 120);
        const title2 = "RHYTHM";

        ctx.font = `900 ${logoSizeTopBase}px "Nunito"`;
        const width1Base = ctx.measureText(title1).width;
        ctx.font = `900 ${logoSizeBotBase}px "Nunito"`;
        const width2Base = ctx.measureText(title2).width;

        // Scale factors to ensure text fits within 90% of screen width (esp for portrait)
        const maxWidth = w * 0.9;
        const maxTextWidth = Math.max(width1Base, width2Base);
        const scale = maxTextWidth > maxWidth ? maxWidth / maxTextWidth : 1;

        const logoSizeTop = logoSizeTopBase * scale;
        const logoSizeBot = logoSizeBotBase * scale;

        ctx.font = `900 ${logoSizeTop}px "Nunito"`;
        const width1 = ctx.measureText(title1).width;
        ctx.font = `900 ${logoSizeBot}px "Nunito"`;
        const width2 = ctx.measureText(title2).width;

        const padX = w > 600 ? 50 * scale : (20 + w * 0.02) * scale;
        const padY = padX * 0.6; // Vertical padding for stability

        const textTop = centerY - logoSizeTop * 1.0;
        const textBottom = centerY + logoSizeBot * 1.0;

        const bubbleW = Math.max(width1, width2) + padX * 2;
        const bubbleH = (textBottom - textTop) + padY * 2;
        const bubbleX = w / 2 - bubbleW / 2;
        const bubbleY = textTop - padY;

        // 5a. Draw Speech Bubble Background (Glassmorphism)
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.95)'; // Stronger drop shadow
        ctx.shadowOffsetY = 25;
        ctx.shadowBlur = 20;

        const bubbleGrad = ctx.createLinearGradient(0, bubbleY, 0, bubbleY + bubbleH + 35);
        // Higher transparency
        bubbleGrad.addColorStop(0, 'rgba(40, 20, 60, 0.20)');
        bubbleGrad.addColorStop(1, 'rgba(15, 5, 30, 0.05)');
        ctx.fillStyle = bubbleGrad;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 10;

        const r = Math.min(40, bubbleH / 4);
        ctx.beginPath();
        ctx.moveTo(bubbleX + r, bubbleY);
        ctx.lineTo(bubbleX + bubbleW - r, bubbleY);
        ctx.quadraticCurveTo(bubbleX + bubbleW, bubbleY, bubbleX + bubbleW, bubbleY + r);
        ctx.lineTo(bubbleX + bubbleW, bubbleY + bubbleH - r);
        ctx.quadraticCurveTo(bubbleX + bubbleW, bubbleY + bubbleH, bubbleX + bubbleW - r, bubbleY + bubbleH);

        // Tail
        const tailSize = Math.min(35, h * 0.08); // Responsive tail size
        ctx.lineTo(w / 2 + 25, bubbleY + bubbleH);
        ctx.lineTo(w / 2, bubbleY + bubbleH + tailSize); // Point of the tail
        ctx.lineTo(w / 2 - 25, bubbleY + bubbleH);

        ctx.lineTo(bubbleX + r, bubbleY + bubbleH);
        ctx.quadraticCurveTo(bubbleX, bubbleY + bubbleH, bubbleX, bubbleY + bubbleH - r);
        ctx.lineTo(bubbleX, bubbleY + r);
        ctx.quadraticCurveTo(bubbleX, bubbleY, bubbleX + r, bubbleY);
        ctx.closePath();

        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // --- NexusSphere ---
        ctx.font = `900 ${logoSizeTop}px "Nunito"`;

        // Deep drop shadow for NexusSphere
        ctx.shadowColor = 'rgba(0,0,0,0.95)';
        ctx.shadowOffsetY = 15;
        ctx.shadowBlur = 25;

        // Gradient Fill
        const topGrad = ctx.createLinearGradient(0, centerY - logoSizeTop, 0, centerY);
        topGrad.addColorStop(0, '#ff9a9e');
        topGrad.addColorStop(0.5, '#fecfef');
        topGrad.addColorStop(1, '#fede7f');
        ctx.fillStyle = topGrad;

        // Heavy inner glow/stroke trick without black outline
        ctx.lineWidth = 12;
        ctx.strokeStyle = 'rgba(233, 30, 140, 0.4)';
        ctx.lineJoin = 'round';
        ctx.strokeText(title1, w / 2, centerY - logoSizeTop * 0.4);

        ctx.shadowColor = 'transparent';
        ctx.fillText(title1, w / 2, centerY - logoSizeTop * 0.4);

        // White core highlight
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.strokeText(title1, w / 2, centerY - logoSizeTop * 0.4);

        // --- Rhythm ---
        ctx.font = `900 ${logoSizeBot}px "Nunito"`;

        ctx.shadowColor = 'rgba(0,0,0,0.95)';
        ctx.shadowOffsetY = 15;
        ctx.shadowBlur = 25;

        const botGrad = ctx.createLinearGradient(0, centerY, 0, centerY + logoSizeBot);
        botGrad.addColorStop(0, '#fdcb6e');
        botGrad.addColorStop(1, '#ffeaa7');
        ctx.fillStyle = botGrad;

        ctx.lineWidth = 10;
        ctx.strokeStyle = 'rgba(240, 147, 43, 0.5)';
        ctx.strokeText(title2, w / 2, centerY + logoSizeBot * 0.5);

        ctx.shadowColor = 'transparent';
        ctx.fillText(title2, w / 2, centerY + logoSizeBot * 0.5);

        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.strokeText(title2, w / 2, centerY + logoSizeBot * 0.5);

        ctx.restore();

        // 6. Interaction Prompt (Press Start)
        const promptPulse = Math.sin(time * 3) * 0.5 + 0.5; // 0 to 1

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Glowing pill background
        const btnW = Math.min(w * 0.6, 300);
        const btnH = Math.min(60, h * 0.12); // Responsive button height

        // Ensure promptY doesn't overlap bubble
        const bubbleBottom = (centerY + logoSizeBot * 1.0 + padY) + tailSize;

        // dynamic positioning between bubble and bottom of screen
        const availableSpace = h - bubbleBottom;
        let finalPromptY = bubbleBottom + availableSpace * 0.5;

        // At minimum, be somewhat below the bubble, at maximum don't go off screen
        finalPromptY = Math.max(finalPromptY, bubbleBottom + btnH);
        finalPromptY = Math.min(finalPromptY, h - btnH * 0.8);

        const btnX = w / 2 - btnW / 2;
        const btnY = finalPromptY - btnH / 2;

        ctx.shadowColor = `rgba(0, 188, 212, ${0.4 + promptPulse * 0.4})`;
        ctx.shadowBlur = 20 + promptPulse * 15;
        ctx.fillStyle = `rgba(0, 188, 212, ${0.1 + promptPulse * 0.1})`;
        ctx.beginPath();
        ctx.roundRect(btnX, btnY, btnW, btnH, btnH / 2);
        ctx.fill();

        ctx.lineWidth = 2;
        ctx.strokeStyle = `rgba(0, 234, 255, ${0.4 + promptPulse * 0.6})`;
        ctx.stroke();

        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 2;
        ctx.fillStyle = '#ffffff';
        const fontSize = Math.min(24, btnH * 0.45);
        ctx.font = `800 ${fontSize}px "Nunito"`;
        ctx.letterSpacing = '2px';
        ctx.fillText('TAP TO START', w / 2, finalPromptY);

        ctx.restore();
    }

    public destroy() {
        cancelAnimationFrame(this.rafId);
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        const style = document.getElementById('title-screen-style');
        if (style && style.parentNode) {
            style.parentNode.removeChild(style);
        }
    }
}
