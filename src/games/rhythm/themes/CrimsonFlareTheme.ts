import type { IThemeStrategy } from './IThemeStrategy';

export class CrimsonFlareTheme implements IThemeStrategy {
    public readonly id = 'crimson-flare';

    public renderHitZonePulse(ctx: CanvasRenderingContext2D, _lane: number, x: number, y: number, width: number, beatPhase: number): void {
        const pulseAlpha = Math.max(0, 1 - beatPhase) * 0.8;
        if (pulseAlpha <= 0) return;
        const grad = ctx.createLinearGradient(x, y - 5, x, y + 5);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(0.5, `rgba(255, 100, 0, ${pulseAlpha})`);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(x, y - 5, width, 10);
    }

    public getColorForJudgment(judgment: string): string {
        switch (judgment) {
            case 'PERFECT': return '#FFCC00';
            case 'GREAT': return '#FF8C00';
            case 'GOOD': return '#FF3300';
            case 'MISS': return '#8E0000';
            default: return '#FFCC00';
        }
    }

    /**
     * Lava Eruption: Crimson/ember droplets arc upward in a fountain then fall
     * due to gravity, with a searing blast ring at impact point.
     */
    public renderHitEffect(ctx: CanvasRenderingContext2D, x: number, y: number, laneWidth: number, judgment: string, t: number): void {
        const ease = 1 - Math.pow(t, 2);
        const isPerfect = judgment === 'PERFECT';
        const dropCount = isPerfect ? 12 : 8;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // 1. Lava droplets: parabolic arcs (fountain pattern)
        for (let i = 0; i < dropCount; i++) {
            // Fan spread — symmetric on both sides
            const fanRatio = (i / (dropCount - 1)) - 0.5;
            const launchAngle = -Math.PI / 2 + fanRatio * 1.4; // -90° ± 40° spread
            const speed = 0.8 + Math.abs(fanRatio) * 0.4; // center drops go higher

            // Parabolic: horizontal constant, vertical = initial velocity - gravity
            const vx = Math.cos(launchAngle) * speed;
            const vy = Math.sin(launchAngle) * speed;
            const g = 1.8; // gravity constant

            const dt = t * 1.4; // time in flight
            const px = x + vx * dt * laneWidth * 1.5;
            const py = y + (vy * dt - 0.5 * g * dt * dt) * laneWidth * 1.3;

            if (py > y + 10) continue; // skip if fallen below hit line

            const dropAlpha = ease * (0.95 - Math.abs(fanRatio) * 0.2);
            const dropSize = (3 + (1 - Math.abs(fanRatio)) * 4) * ease;

            // Ember glow: bright core → fading orange rim
            const dropGrad = ctx.createRadialGradient(px, py, 0, px, py, dropSize * 2);
            dropGrad.addColorStop(0, `rgba(255, 240, 150, ${dropAlpha})`);
            dropGrad.addColorStop(0.4, `rgba(255, 80, 0, ${dropAlpha * 0.7})`);
            dropGrad.addColorStop(1, 'rgba(150, 0, 0, 0)');
            ctx.fillStyle = dropGrad;
            ctx.beginPath();
            ctx.arc(px, py, dropSize * 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // 2. Blast shockwave ring
        const blastR = laneWidth * (0.1 + t * 2.4);
        const blastGrad = ctx.createRadialGradient(x, y, blastR * 0.85, x, y, blastR);
        blastGrad.addColorStop(0, `rgba(255, 120, 0, ${ease * 0.6})`);
        blastGrad.addColorStop(1, 'rgba(180, 0, 0, 0)');
        ctx.fillStyle = blastGrad;
        ctx.beginPath();
        ctx.arc(x, y, blastR, 0, Math.PI * 2);
        ctx.fill();

        // 3. Blazing core
        const coreR = laneWidth * 0.45 * ease;
        const coreGrad = ctx.createRadialGradient(x, y, 0, x, y, coreR);
        coreGrad.addColorStop(0, `rgba(255, 255, 200, ${ease * 0.95})`);
        coreGrad.addColorStop(0.3, `rgba(255, 160, 0, ${ease * 0.7})`);
        coreGrad.addColorStop(0.8, `rgba(200, 30, 0, ${ease * 0.3})`);
        coreGrad.addColorStop(1, 'rgba(100, 0, 0, 0)');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(x, y, coreR, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
