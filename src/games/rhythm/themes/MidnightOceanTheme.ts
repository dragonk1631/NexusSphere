import type { IThemeStrategy } from './IThemeStrategy';

export class MidnightOceanTheme implements IThemeStrategy {
    public readonly id = 'midnight-ocean';

    public renderHitZonePulse(ctx: CanvasRenderingContext2D, _lane: number, x: number, y: number, width: number, beatPhase: number): void {
        const pulseAlpha = Math.max(0, 1 - beatPhase) * 0.6;
        if (pulseAlpha <= 0) return;
        ctx.fillStyle = `rgba(191, 219, 56, ${pulseAlpha})`;
        ctx.fillRect(x, y - 2, width, 4);
    }

    public getColorForJudgment(judgment: string): string {
        switch (judgment) {
            case 'PERFECT': return '#BFDB38';
            case 'GREAT': return '#64ffda';
            case 'GOOD': return '#4dd0e1';
            case 'MISS': return '#FF5252';
            default: return '#BFDB38';
        }
    }

    /**
     * Water Ripple: Oval ripples expand like water surface disturbance,
     * with water droplets arcing upward then falling back (gravity arc).
     */
    public renderHitEffect(ctx: CanvasRenderingContext2D, x: number, y: number, laneWidth: number, judgment: string, t: number): void {
        const ease = 1 - Math.pow(t, 2);
        const isPerfect = judgment === 'PERFECT';

        ctx.save();

        // 1. Expanding oval water ripples (staggered)
        const rippleCount = isPerfect ? 3 : 2;
        for (let i = 0; i < rippleCount; i++) {
            const delay = i * 0.15;
            const lt = Math.max(0, t - delay);
            if (lt <= 0) continue;
            const ripEase = 1 - Math.pow(lt, 1.5);
            const rw = laneWidth * (0.3 + lt * 2.8);
            const rh = rw * 0.25; // flat oval for water surface feel

            ctx.beginPath();
            ctx.ellipse(x, y, rw, rh, 0, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(100, 255, 218, ${ripEase * (0.7 - i * 0.2)})`;
            ctx.lineWidth = 2.5 * ripEase;
            ctx.stroke();
        }

        // 2. Water droplets arcing upward (gravity parabola)
        const dropCount = isPerfect ? 8 : 5;
        for (let i = 0; i < dropCount; i++) {
            // Each drop has a unique lateral spread seed
            const spreadAngle = (-Math.PI / 2) + (i - (dropCount - 1) / 2) * 0.38;
            // Parabolic motion: horizontal=constant speed, vertical=decelerate then fall
            const dropT = t * 1.3; // faster than global t
            const dist = laneWidth * 0.8 * Math.sin(dropT * Math.PI * 0.5);
            const dx = x + Math.cos(spreadAngle) * dist * 1.4;
            // Upward then gravity: y = -v*t + 0.5*g*t²
            const dy = y - (laneWidth * 1.2 * t) + (laneWidth * 1.8 * t * t);

            if (dy > y + laneWidth * 0.5) continue; // clamp below hit line

            const dropAlpha = ease * (0.9 - i * 0.08);
            const dropSize = (2 + i % 2) * ease;

            ctx.beginPath();
            ctx.arc(dx, dy, dropSize, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(100, 255, 218, ${dropAlpha})`;
            ctx.shadowBlur = 6;
            ctx.shadowColor = '#64ffda';
            ctx.fill();
        }

        // 3. Bioluminescent core glow
        ctx.shadowBlur = 0;
        const coreGrad = ctx.createRadialGradient(x, y, 0, x, y, laneWidth * 0.45 * ease);
        coreGrad.addColorStop(0, `rgba(255, 255, 255, ${ease * 0.85})`);
        coreGrad.addColorStop(0.4, `rgba(100, 255, 218, ${ease * 0.5})`);
        coreGrad.addColorStop(1, 'rgba(0, 100, 130, 0)');
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(x, y, laneWidth * 0.45 * ease, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
