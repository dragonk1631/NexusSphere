import type { IThemeStrategy } from './IThemeStrategy';
import { Judgment } from '../types/GameTypes';

/**
 * MarchenTheme provides a fairy-tale aesthetic.
 * Optimized: Removed shadowBlur from stardust effects.
 */
export class MarchenTheme implements IThemeStrategy {
    public readonly id = 'marchen';

    public preWarm(_ctx: CanvasRenderingContext2D, _laneWidth: number): void {
        console.log("[MarchenTheme] Pre-warmed.");
    }

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

        // 1. Rainbow Concentric Bloom (Expanding color-shifting rings)
        const ringCount = 3;
        for (let i = 0; i < ringCount; i++) {
            const progress = Math.pow(Math.max(0, t - i * 0.12), 0.7);
            if (progress >= 1.0) continue;

            const ringR = laneWidth * (0.3 + progress * 2.2);
            const alpha = (1 - progress) * 0.7;
            const hue = (i * 60 + t * 360) % 360; // Shifting rainbow hue

            ctx.strokeStyle = `hsla(${hue}, 85%, 75%, ${alpha})`;
            ctx.lineWidth = (6 - i) * (1 - progress) * 2;
            ctx.beginPath();
            ctx.arc(x, y, ringR, 0, Math.PI * 2);
            ctx.stroke();

            // Inner pink core for extra shimmer (formerly white)
            ctx.strokeStyle = `rgba(255, 235, 245, ${alpha * 0.5})`;
            ctx.lineWidth = 1.5 * (1 - progress);
            ctx.stroke();
        }

        // 2. Enhanced Heart Particles (1.5x Larger, Half speed rotation)
        const heartCount = 10;
        for (let i = 0; i < heartCount; i++) {
            const seed = (i * 0.38) % 1;
            const angle = (i / heartCount) * Math.PI * 2 + t * 1.2;
            const dist = laneWidth * (0.3 + t * 2.2);
            const px = x + Math.cos(angle) * dist;
            const py = y + Math.sin(angle) * dist * 0.85;

            const blink = Math.pow(Math.sin(t * 15 + i), 2);
            const hAlpha = ease * (0.5 + blink * 0.5);
            // 1.5x larger than old petals (old average ~11, new average ~18)
            const hSize = (12 + seed * 16) * ease; 
            const hue = (seed * 360 + t * 80) % 360;

            ctx.save();
            ctx.translate(px, py);
            // Half rotation speed (formerly t*6 in original petal logic)
            ctx.rotate(angle + t * 3); 
            ctx.fillStyle = `hsla(${hue}, 80%, 75%, ${hAlpha})`;
            this.drawHeart(ctx, 0, 0, hSize);
            ctx.restore();
        }

        // 3. Central Magical Bloom (Glow feedback)
        const bloomR = laneWidth * 0.65 * outEase;
        const bloomGrad = ctx.createRadialGradient(x, y, 0, x, y, bloomR);
        // Changed center from white to pink
        bloomGrad.addColorStop(0, `rgba(255, 220, 240, ${outEase * 0.95})`);
        bloomGrad.addColorStop(0.5, `hsla(340, 100%, 90%, ${outEase * 0.6})`);
        bloomGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = bloomGrad;
        ctx.beginPath();
        ctx.arc(x, y, bloomR, 0, Math.PI * 2);
        ctx.fill();

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
