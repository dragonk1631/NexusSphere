import type { IBackgroundPattern, PatternContext } from '../PatternRegistry';

export class WavesPattern implements IBackgroundPattern {
    public readonly id = 'waves';
    private eqCurrentHeights: Float32Array = new Float32Array(32);
    private eqPeaks: Float32Array = new Float32Array(32);
    private eqPeakVels: Float32Array = new Float32Array(32);
    private lastBeatHit: number = 0;

    public init(_ctx: PatternContext): void {
        this.eqCurrentHeights.fill(0);
        this.eqPeaks.fill(0);
        this.eqPeakVels.fill(0);
    }

    public draw(ctx: PatternContext): void {
        const { ctx: context, width, height, time, theme, setCompositeOperation } = ctx;
        const barCount = 32;
        const padding = 6;
        const barW = (width / barCount) - padding;
        const horizon = height * 0.85;
        
        const beatInterval = 60 / 128; 
        const currentBeat = Math.floor(time / beatInterval);
        const beatPhase = (time % beatInterval) / beatInterval;
        
        if (currentBeat !== this.lastBeatHit) {
            this.lastBeatHit = currentBeat;
            for (let i = 0; i < barCount; i++) {
                if (Math.random() > 0.35) {
                    const surge = Math.random() * (height * 0.38);
                    this.eqCurrentHeights[i] = Math.max(this.eqCurrentHeights[i], surge);
                }
            }
        }

        const centerY = height * 0.52;
        const waveAmpRoot = (height * 0.12) * (Math.exp(-beatPhase * 2.5) + 0.15);
        const wavePoints = 120;
        
        context.save();
        setCompositeOperation('lighter');
        context.fillStyle = theme.color3; 
        context.globalAlpha = 0.7;
        
        for (let i = 0; i < wavePoints; i++) {
            const wx = (i / wavePoints) * width;
            const t = time * 20 + i;
            const noise = (Math.sin(t * 0.5) * 0.5 + Math.sin(t * 1.2) * 0.3 + Math.sin(t * 3.5) * 0.2);
            const wh = Math.abs(noise) * waveAmpRoot * 0.8;
            context.fillRect(wx, centerY - wh, 2, wh * 2);
        }
        
        context.fillStyle = theme.color2;
        context.globalAlpha = 0.35;
        for (let i = 0; i < wavePoints; i++) {
            const wx = (i / wavePoints) * width + 2;
            const t = time * 20 + i + 10;
            const noise = (Math.sin(t * 0.5) * 0.5 + Math.sin(t * 1.2) * 0.3);
            const wh = Math.abs(noise) * waveAmpRoot * 0.8;
            context.fillRect(wx, centerY - wh, 1, wh * 2);
        }
        context.restore();

        for (let i = 0; i < barCount; i++) {
            this.eqCurrentHeights[i] *= 0.98;
            const h = this.eqCurrentHeights[i];
            const x = i * (barW + padding) + padding / 2;
            
            if (h > this.eqPeaks[i]) {
                this.eqPeaks[i] = h;
                this.eqPeakVels[i] = 0;
            } else {
                this.eqPeakVels[i] += 0.45;
                this.eqPeaks[i] -= this.eqPeakVels[i];
                if (this.eqPeaks[i] < 0) this.eqPeaks[i] = 0;
            }

            context.globalAlpha = 0.05; 
            const reflGrad = context.createLinearGradient(0, horizon, 0, horizon + h * 0.8);
            reflGrad.addColorStop(0, theme.color2 + '88');
            reflGrad.addColorStop(1, 'transparent');
            context.fillStyle = reflGrad;
            context.fillRect(x, horizon, barW, h * 0.8);

            context.globalAlpha = 0.7;
            const barGrad = context.createLinearGradient(0, horizon - h, 0, horizon);
            barGrad.addColorStop(0, theme.color3); 
            barGrad.addColorStop(0.6, theme.color2);
            barGrad.addColorStop(1, theme.color2 + '22');
            context.fillStyle = barGrad;
            context.fillRect(x, horizon - h, barW, h);

            if (this.eqPeaks[i] > 2) {
                context.globalAlpha = 0.8;
                context.fillStyle = '#fff';
                context.fillRect(x, horizon - this.eqPeaks[i] - 1, barW, 1);
            }
        }
    }
}
