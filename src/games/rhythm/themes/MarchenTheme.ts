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
        judgment: Judgment,
        t: number
    ): void {
        const ease = 1 - Math.pow(t, 1.5);
        const isPerfect = judgment === Judgment.PERFECT;
        const sparkCount = isPerfect ? 20 : 12;

        ctx.save();

        // 1. Magic Circle Flash
        if (t < 0.4) {
            const mAlpha = (1 - t / 0.4) * 0.7;
            const mSize = laneWidth * (0.4 + t * 1.5);
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(t * Math.PI);
            ctx.strokeStyle = `rgba(255, 200, 230, ${mAlpha})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, mSize, 0, Math.PI * 2);
            ctx.stroke();

            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2;
                if (i === 0) ctx.moveTo(Math.cos(a) * mSize, Math.sin(a) * mSize);
                else ctx.lineTo(Math.cos(a) * mSize, Math.sin(a) * mSize);
            }
            ctx.closePath();
            ctx.stroke();
            ctx.restore();
        }

        // 2. Fairy Stardust (Static Twinkle)
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < sparkCount; i++) {
            const baseAngle = (i / sparkCount) * Math.PI * 2;
            const radius = laneWidth * (0.2 + (i % 5) * 0.15); // Fixed radii, no 't' in size
            const sx = x + Math.cos(baseAngle) * radius;
            const sy = y + Math.sin(baseAngle) * radius * 0.5;

            const alpha = ease * (0.8 + (i % 3) * 0.2);
            const size = (3.0 + (i % 4)) * ease;

            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(t * Math.PI * 4); // Faster rotation for magic impact

            const colors = ['rgba(255, 255, 255', 'rgba(255, 242, 117', 'rgba(236, 64, 122']; // White, Gold, Pink
            ctx.fillStyle = `${colors[i % colors.length]}, ${alpha})`;

            ctx.beginPath();
            for (let j = 0; j < 8; j++) {
                const r = j % 2 === 0 ? size * 2.2 : size * 0.8;
                const a = (j / 8) * Math.PI * 2;
                ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            }
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        // 3. Radiant Core
        const coreR = laneWidth * (isPerfect ? 0.9 : 0.6) * ease;
        const coreGrad = ctx.createRadialGradient(x, y, 0, x, y, coreR);
        coreGrad.addColorStop(0, `rgba(255, 255, 255, ${ease * 1.0})`);
        coreGrad.addColorStop(0.4, `rgba(249, 168, 212, ${ease * 0.7})`);
        coreGrad.addColorStop(1, 'transparent');

        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(x, y, coreR, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
