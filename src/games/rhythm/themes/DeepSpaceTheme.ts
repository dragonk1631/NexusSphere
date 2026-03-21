import type { IThemeStrategy } from './IThemeStrategy';
import { Judgment } from '../types/GameTypes';

/**
 * DeepSpaceTheme provides a dark, cosmic aesthetic.
 */
export class DeepSpaceTheme implements IThemeStrategy {
    public readonly id = 'deep-space';

    public renderHitZonePulse(ctx: CanvasRenderingContext2D, _lane: number, x: number, y: number, width: number, beatPhase: number): void {
        const pulseAlpha = Math.max(0, 1 - beatPhase) * 0.6;
        if (pulseAlpha <= 0) return;
        ctx.fillStyle = `rgba(100, 140, 255, ${pulseAlpha})`;
        ctx.beginPath();
        ctx.ellipse(x + width / 2, y, width / 2, 5, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    public getColorForJudgment(judgment: Judgment): string {
        switch (judgment) {
            case Judgment.PERFECT: return '#e0e0ff';
            case Judgment.GREAT: return '#b0b0ff';
            case Judgment.GOOD: return '#8080ff';
            case Judgment.MISS: return '#ff5050';
            default: return '#ffffff';
        }
    }

    /**
     * Interstellar Shockwave: 3 concentric rings expand at staggered times,
     * with stellar debris scattered outward.
     */
    public renderHitEffect(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        laneWidth: number,
        _judgment: Judgment,
        t: number,
        _seed: number
    ): void {
        const ease = 1 - Math.pow(t, 1.4);
        const outEase = 1 - Math.pow(t, 2.0);
        const starCount = 8; // Slightly more for impact

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // 1. Radial Cosmic Stars (Straight lines, Randomized Large Sizes)
        for (let i = 0; i < starCount; i++) {
            const seed = (i * 0.789) % 1;
            const angle = (i / starCount) * Math.PI * 2 + (seed * 0.5 - 0.25);
            // Straight radial movement (No swirl)
            const dist = laneWidth * (0.3 + t * 2.8);
            const px = x + Math.cos(angle) * dist;
            const py = y + Math.sin(angle) * dist * 0.65;

            const alpha = ease * (0.8 + seed * 0.2);
            // Larger randomized size (Min 5px, Max ~17px)
            const hSize = (5 + seed * 12) * ease;
            
            // Pulsing Cosmic Colors
            const starHue = 200 + seed * 40; // Cyan to Deep Blue
            ctx.fillStyle = `hsla(${starHue}, 100%, 80%, ${alpha})`;

            // Draw non-rotating 4-pointed cross star
            ctx.save();
            ctx.translate(px, py);
            // No rotation requested for stars themselves
            ctx.beginPath();
            for (let j = 0; j < 8; j++) {
                const r = j % 2 === 0 ? hSize * 2.5 : hSize * 0.6;
                const a = (j / 8) * Math.PI * 2;
                ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            }
            ctx.closePath();
            ctx.fill();
            
            // Add a small glow to each star
            const starGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, hSize * 3);
            starGlow.addColorStop(0, `hsla(${starHue}, 100%, 90%, ${alpha * 0.4})`);
            starGlow.addColorStop(1, 'transparent');
            ctx.fillStyle = starGlow;
            ctx.beginPath(); ctx.arc(0, 0, hSize * 3, 0, Math.PI * 2); ctx.fill();
            
            ctx.restore();
        }

        // 2. Sharp Glowing Shockwaves (Multi-layered rings)
        const ringCount = 2;
        for (let i = 0; i < ringCount; i++) {
            const progress = Math.pow(Math.max(0, t - i * 0.1), 0.7);
            if (progress >= 1.0) continue;

            const ringR = laneWidth * (0.4 + progress * 2.5);
            const rAlpha = (1 - progress) * 0.8;

            // Surrounding Outer Glow
            ctx.strokeStyle = `rgba(100, 180, 255, ${rAlpha * 0.3})`;
            ctx.lineWidth = 12 * (1 - progress);
            ctx.beginPath(); ctx.arc(x, y, ringR, 0, Math.PI * 2); ctx.stroke();

            // Sharp Inner Edge
            ctx.strokeStyle = `rgba(200, 235, 255, ${rAlpha})`;
            ctx.lineWidth = 2.5 * (1 - progress);
            ctx.beginPath(); ctx.arc(x, y, ringR, 0, Math.PI * 2); ctx.stroke();
        }

        // 3. Supernova Central Bloom (Glow feedback)
        const bloomR = laneWidth * 0.7 * outEase;
        const bloomGrad = ctx.createRadialGradient(x, y, 0, x, y, bloomR);
        bloomGrad.addColorStop(0, `rgba(255, 255, 255, ${outEase * 0.9})`);
        bloomGrad.addColorStop(0.4, `rgba(100, 200, 255, ${outEase * 0.5})`);
        bloomGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = bloomGrad;
        ctx.beginPath(); ctx.arc(x, y, bloomR, 0, Math.PI * 2); ctx.fill();

        ctx.restore();
    }
}
