import type { IThemeStrategy } from './IThemeStrategy';
import { Judgment } from '../types/GameTypes';

export class MidnightOceanTheme implements IThemeStrategy {
    public readonly id = 'midnight-ocean';

    public renderHitZonePulse(ctx: CanvasRenderingContext2D, _lane: number, x: number, y: number, width: number, beatPhase: number): void {
        const pulseAlpha = Math.max(0, 1 - beatPhase) * 0.6;
        if (pulseAlpha <= 0) return;
        ctx.fillStyle = `rgba(191, 219, 56, ${pulseAlpha})`;
        ctx.fillRect(x, y - 2, width, 4);
    }

    public getColorForJudgment(judgment: Judgment): string {
        switch (judgment) {
            case Judgment.PERFECT: return '#cce0ff';
            case Judgment.GREAT: return '#a1c4fd';
            case Judgment.GOOD: return '#66a6ff';
            case Judgment.MISS: return '#ff6b6b';
            default: return '#ffffff';
        }
    }

    /**
     * Vertical Water Burst: Oval ripples expand vertically (along lane axis),
     * with water droplets arcing upward in a narrow column.
     */
    public renderHitEffect(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        laneWidth: number,
        judgment: Judgment,
        t: number
    ): void {
        const ease = 1 - Math.pow(t, 2);
        const isPerfect = judgment === Judgment.PERFECT;

        ctx.save();

        // 1. Expanding vertical water ripples (narrow width, long height)
        const rippleCount = isPerfect ? 3 : 2;
        for (let i = 0; i < rippleCount; i++) {
            const delay = i * 0.15;
            const lt = Math.max(0, t - delay);
            if (lt <= 0) continue;
            const ripEase = 1 - Math.pow(lt, 1.5);
            const rw = laneWidth * 0.4 * (1 + lt * 1.5);
            const rh = laneWidth * (0.6 + lt * 4.5); // long vertically

            ctx.beginPath();
            ctx.ellipse(x, y, rw, rh, 0, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(100, 255, 218, ${ripEase * (0.7 - i * 0.2)})`;
            ctx.lineWidth = 3 * ripEase;
            ctx.stroke();
        }

        // 2. Vertical water splashes
        const dropCount = isPerfect ? 12 : 8;
        for (let i = 0; i < dropCount; i++) {
            const spreadY = (Math.random() - 0.5) * laneWidth * 0.2;
            const dropT = t * 1.25;
            const dy = y + spreadY - (laneWidth * 1.8 * dropT) + (laneWidth * 2.5 * dropT * dropT);
            const dx = x + (Math.random() - 0.5) * laneWidth * 0.5;

            if (dy > y + laneWidth * 1.5) continue;

            const dropAlpha = ease * (0.9 - (i / dropCount) * 0.3);
            const dropSize = (2.5 + Math.random() * 2) * ease;

            ctx.beginPath();
            ctx.arc(dx, dy, dropSize, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(100, 255, 218, ${dropAlpha})`;
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#64ffda';
            ctx.fill();
        }

        // 3. Deep sea core glow (elongated vertically)
        ctx.shadowBlur = 0;
        const glowW = laneWidth * 0.5 * ease;
        const glowH = laneWidth * 1.2 * ease;
        const coreGrad = ctx.createRadialGradient(x, y, 0, x, y, glowH);
        coreGrad.addColorStop(0, `rgba(255, 255, 255, ${ease * 0.9})`);
        coreGrad.addColorStop(0.4, `rgba(100, 255, 218, ${ease * 0.6})`);
        coreGrad.addColorStop(1, 'rgba(0, 100, 130, 0)');

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.scale(glowW / glowH, 1); // stretch vertically
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(x * (glowH / glowW), y, glowH, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.restore();
    }
}
