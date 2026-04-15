import { ScreenUtils } from '../core/utils/ScreenUtils';
import { MenuMusicManager } from '../core/audio/MenuMusicManager';
import { ThemeManager } from '../core/ThemeManager';

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
    private fontReady: boolean = false;
    private isSyncing: boolean = false;
    private progress: number = 0;
    private status: string = "";
    private bgImage: HTMLImageElement | null = null;
    private tips: string[] = [
        "NEXUSSPHERE: ALL MUSIC IS STORED AS PURE DATA.",
        "CHECK YOUR LATENCY SETTINGS FOR OPTIMAL TIMING.",
        "FEVER MODE DOUBLES YOUR SCORE MULTIPLIER.",
        "PERFECT JUDGMENTS INCREASE YOUR COMBO EXPONENTIALLY.",
        "YOU CAN PLAY OFFLINE ONCE THE SYNC IS COMPLETE.",
        "THE SPHERE OBSERVES YOUR RHYTHM.",
        "DRINK WATER TO IMPROVE YOUR REACTION TIME."
    ];
    private currentTip: string = "";
    private tipTimer: number = 0;

    constructor(onStart: () => void) {
        this.onStart = onStart;
        this.container = document.createElement('div');
        this.container.id = 'title-screen';

        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D;
        this.container.appendChild(this.canvas);

        this.applyStyles();
        this.container.style.opacity = '0';
        this.container.style.transition = 'opacity 0.8s ease-out';
        document.body.appendChild(this.container);

        this.resize();

        // 1. Prepare Background Image with Fallback
        this.bgImage = new Image();
        const showUI = () => {
            requestAnimationFrame(() => {
                this.container.style.opacity = '1';
            });
        };

        this.bgImage.onload = showUI;
        this.bgImage.onerror = () => {
            console.error("[TitleScreen] Background image failed to load.");
            showUI(); // Show UI even without background
        };
        this.bgImage.src = 'assets/images/ui/loading_bg.png';

        // 2. Extra safety timeout: Show UI after 2.5s regardless of asset state
        setTimeout(showUI, 2500);

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

        this.currentTip = this.tips[Math.floor(Math.random() * this.tips.length)];

        const brandingFont = '900 24px "Black Han Sans"';
        // Add font loading timeout safety
        const fontTimeout = setTimeout(() => {
            console.warn("[TitleScreen] Font load timeout, using fallback.");
            this.fontReady = true;
            this.preRenderLogo();
        }, 2000);

        document.fonts.load(brandingFont).then(() => {
            clearTimeout(fontTimeout);
            this.fontReady = true;
            this.preRenderLogo();
        }).catch(() => {
            clearTimeout(fontTimeout);
            this.fontReady = true;
            this.preRenderLogo();
        });
    }

    public setProgress(p: number) {
        this.progress = Math.max(0, Math.min(1, p));
        // Force isSyncing = true if we have any active progress that's not 0 or 1
        this.isSyncing = (this.progress > 0.001 && this.progress < 0.999);
    }

    public setStatus(text: string) {
        this.status = text.toUpperCase();
    }

    public resize() {
        const { width, height } = ScreenUtils.getVirtualDimensions();
        this.width = width;
        this.height = height;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.logoCache = null;
    }

    private applyStyles() {
        if (document.getElementById('title-screen-style')) return;
        const style = document.createElement('style');
        style.id = 'title-screen-style';
        style.textContent = `
            #title-screen {
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                z-index: 10000; cursor: pointer; user-select: none;
                background-color: #000;
            }
            #title-screen canvas {
                display: block; width: 100%; height: 100%;
            }
        `;
        document.head.appendChild(style);
    }

    private handleStart(e: Event) {
        e.preventDefault();
        // Prevent starting while syncing critical files
        if (this.isTransitioning || this.isSyncing) return;
        this.isTransitioning = true;

        const flash = document.createElement('div');
        flash.style.position = 'fixed';
        flash.style.top = '0'; flash.style.left = '0';
        flash.style.width = '100vw'; flash.style.height = '100vh';
        flash.style.backgroundColor = 'white';
        flash.style.opacity = '0';
        flash.style.transition = 'opacity 0.4s ease-in';
        flash.style.zIndex = '10001';
        document.body.appendChild(flash);

        void flash.offsetWidth;
        flash.style.opacity = '1';

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
        
        // Update Tip Timer
        this.tipTimer += 0.016;
        if (this.tipTimer > 5) {
            this.tipTimer = 0;
            this.currentTip = this.tips[Math.floor(Math.random() * this.tips.length)];
        }

        this.render();
    }

    private preRenderLogo() {
        if (this.logoCache) return;
        const { width: w, height: h } = this;
        
        // Restore to Massive High-Impact Sizes (Original scale)
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
        const centerY = Math.floor(h * 0.4); // Original Center
        const gap = Math.round(20 * scale);
        const totalTextH = logoSizeTop + logoSizeBot + gap;

        tempCtx.save();
        tempCtx.shadowColor = 'rgba(0,0,0,0.95)';
        tempCtx.shadowOffsetY = 12;
        tempCtx.shadowBlur = 25;

        const theme = ThemeManager.getInstance().getCurrentTheme();
        const adaptiveMid = this.lerpColor('#aeaeae', theme.color2, 0.45);

        // Title 1
        tempCtx.font = `900 ${logoSizeTop}px "Black Han Sans"`;
        const topGrad = tempCtx.createLinearGradient(0, centerY - totalTextH/2, 0, centerY);
        topGrad.addColorStop(0, '#ffffff');
        topGrad.addColorStop(0.45, '#d8d8d8');
        topGrad.addColorStop(0.6, adaptiveMid);
        topGrad.addColorStop(1, '#444444');
        const y1 = Math.round(centerY - logoSizeBot / 2 - gap / 2);
        tempCtx.strokeStyle = 'rgba(0,0,0,0.8)';
        tempCtx.lineWidth = 6;
        tempCtx.strokeText(title1, Math.round(w / 2), y1);
        tempCtx.fillStyle = topGrad;
        tempCtx.fillText(title1, Math.round(w / 2), y1);
        
        // Title 2
        tempCtx.font = `900 ${logoSizeBot}px "Black Han Sans"`;
        const botGrad = tempCtx.createLinearGradient(0, centerY, 0, centerY + totalTextH/2);
        botGrad.addColorStop(0, '#ffffff');
        botGrad.addColorStop(0.45, '#d8d8d8');
        botGrad.addColorStop(0.6, adaptiveMid);
        botGrad.addColorStop(1, '#444444');
        const y2 = Math.round(centerY + logoSizeTop / 2 + gap / 2);
        tempCtx.strokeText(title2, Math.round(w / 2), y2);
        tempCtx.fillStyle = botGrad;
        tempCtx.fillText(title2, Math.round(w / 2), y2);
        
        tempCtx.restore();
        this.logoCache = tempCanvas;
    }

    private render() {
        const { ctx, width: w, height: h, time, lastAlpha } = this;
        const theme = ThemeManager.getInstance().getCurrentTheme();
        ctx.clearRect(0, 0, w, h);

        // 1. Draw Cinematic Background
        if (this.bgImage) {
            const imgAspect = this.bgImage.width / this.bgImage.height;
            const screenAspect = w / h;
            let drawW, drawH, drawX, drawY;

            if (screenAspect > imgAspect) {
                drawW = w;
                drawH = w / imgAspect;
                drawX = 0;
                drawY = (h - drawH) / 2;
            } else {
                drawH = h;
                drawW = h * imgAspect;
                drawX = (w - drawW) / 2;
                drawY = 0;
            }
            ctx.drawImage(this.bgImage, drawX, drawY, drawW, drawH);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fillRect(0, 0, w, h);
        }

        // 2. Version Label
        ctx.save();
        ctx.font = '900 12px "Orbitron"';
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillText('NEXUS CORE v1.0.0', 25, 30);
        ctx.restore();

        // 3. Main Logo (Always Rendered at original position with a balanced "Deep Pulse" effect)
        if (this.fontReady) this.preRenderLogo();
        
        // Balanced speed for a rhythmic feel
        const cycleTempo = 1.3; 
        const rawSin = Math.sin(time * cycleTempo);
        const prevRawSin = Math.sin((time - 0.016) * cycleTempo);
        const interpolatedRawSin = prevRawSin + (rawSin - prevRawSin) * lastAlpha;
        
        // Use a more dynamic wave for the pulse
        const glowFactor = (Math.sin(interpolatedRawSin * Math.PI / 1.5) * 0.5 + 0.5);

        if (this.logoCache) {
            ctx.save();
            ctx.translate(w / 2, h * 0.4); 
            
            // Subtle Scale Pulse (1.0 to 1.04)
            const scaleFactor = 1.0 + (glowFactor * 0.04);
            ctx.scale(scaleFactor, scaleFactor);

            ctx.globalCompositeOperation = 'lighter';
            // Dramatic shadow alpha and blur variation
            const shadowAlpha = Math.floor((0.3 + glowFactor * 0.6) * 255).toString(16).padStart(2, '0');
            ctx.shadowColor = theme.color2 + shadowAlpha;
            ctx.shadowBlur = 20 + glowFactor * 100; // Expanded blur range
            ctx.drawImage(this.logoCache, -w / 2, -h * 0.4);
            
            ctx.globalCompositeOperation = 'source-over';
            ctx.shadowBlur = 0;
            ctx.drawImage(this.logoCache, -w / 2, -h * 0.4);
            ctx.restore();
        }

        // 4. Interaction or Sync Progress
        if (this.isSyncing) {
            this.renderSyncProgress(ctx, w, h, theme);
        } else {
            this.renderStartPrompt(ctx, w, h, theme, time, lastAlpha);
        }
    }

    private renderSyncProgress(ctx: CanvasRenderingContext2D, w: number, h: number, theme: any) {
        ctx.save();
        
        // 1. High-End Glassmorphism Panel
        const panelW = Math.min(w * 0.9, 650);
        const panelH = 160;
        const panelX = w / 2 - panelW / 2;
        const panelY = h * 0.8 - panelH / 2;

        ctx.save();
        // Deep Drop Shadow for floating effect
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 40;
        ctx.shadowOffsetY = 15;
        
        // Sophisticated Semi-Transparent Gradient (True Glass Look)
        const panelGrad = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
        panelGrad.addColorStop(0, 'rgba(15, 15, 25, 0.4)'); // Lightly tinted
        panelGrad.addColorStop(0.5, 'rgba(10, 10, 20, 0.6)');
        panelGrad.addColorStop(1, 'rgba(5, 5, 15, 0.8)');
        
        ctx.fillStyle = panelGrad;
        ctx.beginPath();
        ctx.roundRect(panelX, panelY, panelW, panelH, 12);
        ctx.fill();
        
        // Top Rim Light (Glass Edge)
        ctx.strokeStyle = `rgba(255, 255, 255, 0.15)`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Subtle Inner Glow
        ctx.strokeStyle = `rgba(255, 255, 255, 0.05)`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.roundRect(panelX + 2, panelY + 2, panelW - 4, panelH - 4, 10);
        ctx.stroke();
        ctx.restore();

        // 2. Elements Centering Logic
        const centerX = w / 2;
        const topY = panelY + 45;
        const barY = panelY + 85;
        const bottomY = panelY + 125;

        // Status Label (Perfect Center)
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.font = '900 16px "Black Han Sans"';
        ctx.letterSpacing = '2px';
        const statusLabel = this.status || 'SYNCING WITH NEXUS...';
        
        ctx.save();
        ctx.shadowColor = theme.color2;
        ctx.shadowBlur = 10;
        ctx.fillText(statusLabel, centerX, topY);
        ctx.restore();

        // 3. Premium Progress Bar
        const barW = panelW * 0.85;
        const barH = 12;
        const barX = centerX - barW / 2;

        // Bar Track (Metallic/Glass Inset)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.beginPath();
        ctx.roundRect(barX, barY - barH/2, barW, barH, barH / 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Progress Fill
        const fillW = barW * this.progress;
        if (fillW > 0) {
            ctx.save();
            const grad = ctx.createLinearGradient(barX, 0, barX + fillW, 0);
            grad.addColorStop(0, theme.color2);
            grad.addColorStop(1, theme.color3);
            ctx.fillStyle = grad;
            
            // Multiple layers of glow for "Source Light" effect
            ctx.shadowColor = theme.color2;
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.roundRect(barX, barY - barH/2, fillW, barH, barH / 2);
            ctx.fill();
            
            ctx.shadowColor = theme.color3;
            ctx.shadowBlur = 30;
            ctx.fill();

            // Internal Shine (Cyberpunk Detail)
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.beginPath();
            ctx.roundRect(barX, barY - barH/2 + 2, fillW, 2, 1);
            ctx.fill();

            // Animated Flare Head
            const flareSize = 5 + Math.sin(this.time * 8) * 3;
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 20;
            ctx.beginPath();
            ctx.arc(barX + fillW, barY, barH/2 + flareSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Percentage Text (Clean Digital Font)
        ctx.font = '900 20px "Orbitron"';
        ctx.fillStyle = '#ffffff';
        const pText = `${Math.floor(this.progress * 100)}%`;
        ctx.fillText(pText, centerX, bottomY);

        ctx.restore();
    }

    private renderStartPrompt(ctx: CanvasRenderingContext2D, w: number, h: number, theme: any, time: number, lastAlpha: number) {
        const promptRawSin = Math.sin(time * 3);
        const prevPromptRawSin = Math.sin((time - 0.016) * 3);
        const interpolatedRaw = prevPromptRawSin + (promptRawSin - prevPromptRawSin) * lastAlpha;
        const pulse = (Math.tanh(interpolatedRaw * 2.0) * 0.5 + 0.5);

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const btnW = 320;
        const btnH = 60;
        const centerX = w / 2;
        const promptY = h * 0.8;

        // Button Outer Glow
        ctx.shadowColor = theme.color2 + Math.floor((0.4 + pulse * 0.4) * 255).toString(16).padStart(2, '0');
        ctx.shadowBlur = 25 + pulse * 15;
        
        // Button Background (Refined Gradient)
        const btnGrad = ctx.createLinearGradient(centerX - btnW/2, 0, centerX + btnW/2, 0);
        btnGrad.addColorStop(0, theme.color2);
        btnGrad.addColorStop(0.5, theme.color3);
        btnGrad.addColorStop(1, theme.color2);
        
        ctx.fillStyle = btnGrad;
        ctx.beginPath();
        ctx.roundRect(centerX - btnW/2, promptY - btnH/2, btnW, btnH, btnH/2);
        ctx.fill();
        
        // Button Border (Neon White)
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.6 + pulse * 0.4})`;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Text (Crisp & Heavy)
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 26px "Black Han Sans"';
        ctx.letterSpacing = '2px';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 10;
        ctx.fillText('PRESS START', centerX, promptY + 2);
        
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

    private lerpColor(a: string, b: string, amount: number): string {
        const ah = parseInt(a.replace(/#/g, ''), 16),
            ar = ah >> 16, ag = (ah >> 8) & 0xff, ab = ah & 0xff,
            bh = parseInt(b.replace(/#/g, ''), 16),
            br = bh >> 16, bg = (bh >> 8) & 0xff, bb = bh & 0xff,
            rr = ar + amount * (br - ar),
            rg = ag + amount * (bg - ag),
            rb = ab + amount * (bb - ab);

        return '#' + ((1 << 24) + (Math.round(rr) << 16) + (Math.round(rg) << 8) + Math.round(rb)).toString(16).slice(1);
    }
}
