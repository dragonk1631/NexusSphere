import type { IThemeStrategy } from './IThemeStrategy';

export class MarchenTheme implements IThemeStrategy {
    public readonly id = 'marchen';

    public renderHitZonePulse(ctx: CanvasRenderingContext2D, _lane: number, x: number, y: number, width: number, beatPhase: number): void {
        const pulseAlpha = Math.max(0, 1 - beatPhase) * 0.5;
        if (pulseAlpha <= 0) return;
        ctx.fillStyle = `rgba(249, 168, 212, ${pulseAlpha})`;
        ctx.beginPath();
        ctx.ellipse(x + width / 2, y, width / 2, 8, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    public getColorForJudgment(judgment: string): string {
        switch (judgment) {
            case 'PERFECT': return '#F9A8D4';
            case 'GREAT': return '#f8c8da';
            case 'GOOD': return '#ce93d8';
            case 'MISS': return '#880e4f';
            default: return '#F9A8D4';
        }
    }

    /**
     * Fairy Stardust: Sparkle shards in pink/lavender drift like butterflies —
     * each moves on a sine-wave path away from the hit point.
     */
    public renderHitEffect(ctx: CanvasRenderingContext2D, x: number, y: number, laneWidth: number, judgment: string, t: number): void {
        const ease = 1 - Math.pow(t, 1.5);
        const isPerfect = judgment === 'PERFECT';
        const sparkCount = isPerfect ? 14 : 9;

        ctx.save();

        for (let i = 0; i < sparkCount; i++) {
            // Seeded orbit-like scatter
            const baseAngle = (i / sparkCount) * Math.PI * 2;
            // Organic sine drift for butterfly feel
            const drift = Math.sin(t * Math.PI * 2 + i) * 0.4;
            const angle = baseAngle + drift;
            const radius = laneWidth * 0.2 + t * laneWidth * (1.4 + (i % 3) * 0.5);

            const sx = x + Math.cos(angle) * radius;
            const sy = y + Math.sin(angle) * radius * 0.6 - t * laneWidth * 0.3; // float upward

            const alpha = ease * (0.6 + (i % 2) * 0.4);
            const size = (2 + (i % 3)) * ease;

            // Alternate between pink and lavender
            const colors = ['rgba(249, 168, 212', 'rgba(206, 147, 216', 'rgba(248, 200, 218'];
            const color = colors[i % colors.length];

            // Each particle: small star shape (4 points)
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(t * Math.PI * 4 + i); // spin slowly
            ctx.fillStyle = `${color}, ${alpha})`;
            ctx.shadowBlur = 6;
            ctx.shadowColor = '#F9A8D4';

            // Draw 4-point star
            ctx.beginPath();
            for (let j = 0; j < 8; j++) {
                const r = j % 2 === 0 ? size * 1.8 : size * 0.7;
                const a = (j / 8) * Math.PI * 2;
                const px = Math.cos(a) * r;
                const py = Math.sin(a) * r;
                if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        // Soft core blush glow
        const coreR = laneWidth * 0.5 * ease;
        const coreGrad = ctx.createRadialGradient(x, y, 0, x, y, coreR);
        coreGrad.addColorStop(0, `rgba(255, 220, 235, ${ease * 0.8})`);
        coreGrad.addColorStop(0.6, `rgba(249, 168, 212, ${ease * 0.3})`);
        coreGrad.addColorStop(1, 'transparent');
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(x, y, coreR, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
