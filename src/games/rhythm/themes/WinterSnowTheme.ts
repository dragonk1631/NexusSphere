import type { IThemeStrategy } from './IThemeStrategy';
import { Judgment } from '../types/GameTypes';

export class WinterSnowTheme implements IThemeStrategy {
    public readonly id = 'winter-snow';

    public renderHitZonePulse(ctx: CanvasRenderingContext2D, _lane: number, x: number, y: number, width: number, beatPhase: number): void {
        const pulseAlpha = Math.max(0, 1 - beatPhase) * 0.6;
        if (pulseAlpha <= 0) return;
        ctx.fillStyle = `rgba(224, 247, 250, ${pulseAlpha})`;
        ctx.fillRect(x, y - 2, width, 4);
    }

    public getColorForJudgment(judgment: Judgment): string {
        switch (judgment) {
            case Judgment.PERFECT: return '#e0ffff';
            case Judgment.GREAT: return '#afeeee';
            case Judgment.GOOD: return '#7fffd4';
            case Judgment.MISS: return '#40e0d0';
            default: return '#ffffff';
        }
    }

    /**
     * Ice Crystal Shatter: A hexagonal ice shard fracture pattern blooms from the
     * hit point — 6 symmetric crystal shards burst outward, rotating as they fly.
     */
    public renderHitEffect(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        laneWidth: number,
        judgment: Judgment,
        t: number
    ): void {
        const ease = 1 - Math.pow(t, 1.6);
        const isPerfect = judgment === Judgment.PERFECT;
        const shardCount = isPerfect ? 12 : 6;

        ctx.save();

        // 1. Ice crystal shards (hexagonal points, rotate as they fly)
        for (let i = 0; i < shardCount; i++) {
            const baseAngle = (i / shardCount) * Math.PI * 2;
            const radius = laneWidth * (0.2 + t * 1.8);
            const cx = x + Math.cos(baseAngle) * radius;
            const cy = y + Math.sin(baseAngle) * radius;
            const rotation = baseAngle + t * Math.PI; // spin as they fly
            const shardAlpha = ease * (0.9 - (i % 3) * 0.15);
            const shardSize = (4 + (i % 2) * 3) * ease;

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(rotation);
            ctx.globalAlpha = shardAlpha;

            // Draw hexagonal shard (6-pointed crystal)
            ctx.beginPath();
            for (let j = 0; j < 6; j++) {
                const a = (j / 6) * Math.PI * 2;
                const r = j % 2 === 0 ? shardSize : shardSize * 0.5;
                const px = Math.cos(a) * r;
                const py = Math.sin(a) * r;
                if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fillStyle = 'rgba(220, 248, 255, 0.9)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(180, 230, 255, 0.6)';
            ctx.lineWidth = 0.8;
            ctx.stroke();

            ctx.restore();
        }

        // 2. Frost ring
        const frostR = laneWidth * (0.15 + t * 2.2);
        ctx.beginPath();
        ctx.arc(x, y, frostR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(200, 240, 255, ${ease * 0.6})`;
        ctx.lineWidth = 2 * ease;
        ctx.globalAlpha = 1;
        ctx.stroke();

        // 3. Core icy flash
        ctx.globalCompositeOperation = 'lighter';
        const coreR = laneWidth * 0.4 * ease;
        const coreGrad = ctx.createRadialGradient(x, y, 0, x, y, coreR);
        coreGrad.addColorStop(0, `rgba(255, 255, 255, ${ease * 0.95})`);
        coreGrad.addColorStop(0.4, `rgba(178, 235, 242, ${ease * 0.5})`);
        coreGrad.addColorStop(1, 'rgba(79, 195, 247, 0)');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(x, y, coreR, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
