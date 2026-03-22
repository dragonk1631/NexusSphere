import { BaseThemeStrategy } from './BaseThemeStrategy';
import { Judgment } from '../types/GameTypes';

/**
 * MarchenTheme provides a fairy-tale aesthetic.
 * Optimized: Uses BaseThemeStrategy for gradient caching and reduced context overhead.
 */
export class MarchenTheme extends BaseThemeStrategy {
    public readonly id = 'marchen';

    public renderHitZonePulse(ctx: CanvasRenderingContext2D, _lane: number, x: number, y: number, width: number, beatPhase: number): void {
        const pulseAlpha = Math.max(0, 1 - beatPhase) * 0.5;
        if (pulseAlpha <= 0) return;
        ctx.fillStyle = `rgba(249, 168, 212, ${pulseAlpha})`;
        ctx.beginPath();
        ctx.ellipse(x + width / 2, y, width / 2, 8, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    public getColorForJudgment(judgment: Judgment): string {
        switch (judgment) {
            case Judgment.PERFECT: return '#ff99cc'; // Sakura Pink
            case Judgment.GREAT: return '#ffcc99';  // Peach
            case Judgment.GOOD: return '#99ffcc';   // Mint
            case Judgment.MISS: return '#cc99ff';   // Soft Purple
            default: return '#ffffff';
        }
    }

    private getHeartSprite(hue: number): HTMLCanvasElement {
        const key = `heart_${Math.floor(hue / 10) * 10}`; // Cache every 10 degrees of hue to balance memory and quality
        return this.getCachedSprite(key, 64, (ctx, s) => {
            ctx.fillStyle = `hsla(${hue}, 80%, 75%, 1)`;
            this.drawHeart(ctx, s / 2, s / 2, s * 0.4);
        });
    }

    public renderHitEffect(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        laneWidth: number,
        _judgment: Judgment,
        t: number,
        _seed: number
    ): void {
        const ease = 1 - Math.pow(t, 1.3);
        const outEase = 1 - Math.pow(t, 2.2);

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // 1. Rainbow Concentric Bloom
        const ringCount = 3;
        for (let i = 0; i < ringCount; i++) {
            const progress = Math.pow(Math.max(0, t - i * 0.12), 0.7);
            if (progress >= 1.0) continue;

            const ringR = laneWidth * (0.3 + progress * 2.2);
            const alpha = (1 - progress) * 0.7;
            const hue = (i * 60 + t * 360) % 360;

            ctx.strokeStyle = `hsla(${hue}, 85%, 75%, ${alpha})`;
            ctx.lineWidth = (6 - i) * (1 - progress) * 2;
            ctx.beginPath();
            ctx.arc(x, y, ringR, 0, Math.PI * 2);
            ctx.stroke();

            // Inner pink core for extra shimmer
            ctx.strokeStyle = `rgba(255, 235, 245, ${alpha * 0.5})`;
            ctx.lineWidth = 1.5 * (1 - progress);
            ctx.stroke();
        }

        // 2. Enhanced Heart Particles
        const heartCount = 10;
        for (let i = 0; i < heartCount; i++) {
            const seedVal = (i * 0.38) % 1;
            const angle = (i / heartCount) * Math.PI * 2 + t * 1.2;
            const dist = laneWidth * (0.3 + t * 2.2);
            const px = x + Math.cos(angle) * dist;
            const py = y + Math.sin(angle) * dist * 0.85;

            const blink = Math.pow(Math.sin(t * 15 + i), 2);
            const hAlpha = ease * (0.5 + blink * 0.5);
            const hSize = (12 + seedVal * 16) * ease; 
            const hue = (seedVal * 360 + t * 80) % 360;

            const sprite = this.getHeartSprite(hue);
            
            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(angle + t * 3);
            ctx.globalAlpha = hAlpha;
            ctx.drawImage(sprite, -hSize, -hSize, hSize * 2, hSize * 2);
            
            // [MAGICAL] Add a tiny secondary sparkle core for "twinkle"
            if (blink > 0.9) {
                ctx.globalAlpha = (blink - 0.9) * 10.0 * ease * 0.5;
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
        ctx.globalAlpha = 1.0;

        // 3. Central Magical Bloom
        const bloomR = laneWidth * 0.65 * outEase;
        if (bloomR > 0) {
            const bloomGrad = this.getCachedRadialGradient(ctx, 'marchen_bloom', 0, 0, 0, 1, [
                { offset: 0, color: 'rgba(255, 220, 240, 0.95)' },
                { offset: 0.5, color: 'hsla(340, 100%, 90%, 0.6)' },
                { offset: 1, color: 'transparent' }
            ]);

            ctx.save();
            ctx.translate(x, y);
            ctx.scale(bloomR, bloomR);
            ctx.fillStyle = bloomGrad;
            ctx.globalAlpha = outEase;
            ctx.beginPath();
            ctx.arc(0, 0, 1, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        ctx.restore();
    }

    private drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
        const s = size * 0.6;
        ctx.beginPath();
        ctx.moveTo(x, y + s / 4);
        ctx.bezierCurveTo(x, y - s / 2, x - s, y - s / 2, x - s, y + s / 4);
        ctx.bezierCurveTo(x - s, y + s * 0.7, x, y + s, x, y + s * 1.2);
        ctx.bezierCurveTo(x, y + s, x + s, y + s * 0.7, x + s, y + s / 4);
        ctx.bezierCurveTo(x + s, y - s / 2, x, y - s / 2, x, y + s / 4);
        ctx.fill();
    }
}
