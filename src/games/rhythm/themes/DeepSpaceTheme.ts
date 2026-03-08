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
        judgment: Judgment,
        t: number
    ): void {
        const isPerfect = judgment === Judgment.PERFECT;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // 1. Triple Concentric Shockwaves
        const ringCount = isPerfect ? 3 : 2;
        for (let i = 0; i < ringCount; i++) {
            const delay = i * 0.18;
            const lt = Math.max(0, t - delay);
            if (lt <= 0) continue;
            const ringEase = 1 - Math.pow(lt, 1.8);
            const ringR = laneWidth * 0.2 + lt * laneWidth * (1.5 + i * 0.7);

            ctx.beginPath();
            ctx.arc(x, y, ringR, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(140, 170, 255, ${ringEase * (0.8 - i * 0.25)})`;
            ctx.lineWidth = (3 - i) * ringEase;
            ctx.stroke();
        }

        // 2. Stellar debris (small bright dots that scatter outward)
        const debrisCount = isPerfect ? 12 : 7;
        const maxDebrisR = laneWidth * (0.3 + t * 2.5);
        for (let i = 0; i < debrisCount; i++) {
            const angle = (i / debrisCount) * Math.PI * 2;
            const dist = maxDebrisR * (0.5 + (i % 3) * 0.2);
            const dx = x + Math.cos(angle) * dist;
            const dy = y + Math.sin(angle) * dist * 0.5;
            const debrisAlpha = (1 - t) * (i % 2 === 0 ? 0.9 : 0.5);
            const size = (1 + (i % 3)) * (1 - t);

            ctx.beginPath();
            ctx.arc(dx, dy, size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(200, 220, 255, ${debrisAlpha})`;
            ctx.fill();

            if (i % 3 === 0) {
                ctx.beginPath();
                ctx.arc(dx, dy, size * 2.5, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(120, 150, 255, ${debrisAlpha * 0.3})`;
                ctx.fill();
            }
        }

        // 3. Core nebula flash
        const coreR = laneWidth * 0.4 * (1 - t);
        const coreGrad = ctx.createRadialGradient(x, y, 0, x, y, coreR);
        coreGrad.addColorStop(0, `rgba(255, 255, 255, ${(1 - t) * 0.9})`);
        coreGrad.addColorStop(0.3, `rgba(160, 196, 255, ${(1 - t) * 0.6})`);
        coreGrad.addColorStop(1, 'rgba(80, 100, 200, 0)');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(x, y, coreR, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
