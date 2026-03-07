import type { IThemeStrategy } from './IThemeStrategy';

/**
 * MatrixGridTheme provides a digital rain / code aesthetic.
 */
export class MatrixGridTheme implements IThemeStrategy {
    public readonly id = 'matrix-grid';

    public renderHitZonePulse(ctx: CanvasRenderingContext2D, _lane: number, x: number, y: number, width: number, beatPhase: number): void {
        const pulseAlpha = Math.max(0, 1 - beatPhase) * 0.8;
        if (pulseAlpha <= 0) return;
        ctx.strokeStyle = `rgba(0, 255, 70, ${pulseAlpha})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y - 4, width, 8);
    }

    public getColorForJudgment(judgment: string): string {
        switch (judgment) {
            case 'PERFECT': return '#00FF46';
            case 'GREAT': return '#00CC38';
            case 'GOOD': return '#009926';
            case 'MISS': return '#FF0000';
            default: return '#00FF46';
        }
    }

    /**
     * Code Cascade: Random matrix characters rain upward from hit point,
     * fading as they rise — like data disintegrating into the feed.
     */
    public renderHitEffect(ctx: CanvasRenderingContext2D, x: number, y: number, laneWidth: number, judgment: string, t: number): void {
        const ease = 1 - Math.pow(t, 2);
        const isPerfect = judgment === 'PERFECT';
        const chars = '01ABXZ%$#@!&*?/\\|';
        const streamCount = isPerfect ? 8 : 5;
        const charSize = Math.max(8, laneWidth * 0.15);

        ctx.save();
        ctx.font = `${charSize}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let i = 0; i < streamCount; i++) {
            // Seeded spread from lane center
            const spreadSeed = (i / streamCount - 0.5) * laneWidth * 1.8;
            const cx = x + spreadSeed;
            const riseBase = laneWidth * 0.6 + t * laneWidth * 3.5;

            // Each stream has 3 characters at staggered heights
            for (let j = 0; j < 3; j++) {
                const charY = y - riseBase - j * charSize * 1.4;
                const charAlpha = ease * (1 - j * 0.3) * (0.6 + (i % 2) * 0.4);

                // Lead character (brighter)
                if (j === 0) {
                    ctx.fillStyle = `rgba(200, 255, 210, ${charAlpha})`;
                    ctx.shadowBlur = 8;
                    ctx.shadowColor = '#00FF46';
                } else {
                    ctx.fillStyle = `rgba(0, 200, 60, ${charAlpha * 0.6})`;
                    ctx.shadowBlur = 0;
                }

                const char = chars[Math.floor((i * 7 + j * 3 + t * 20) % chars.length)];
                ctx.fillText(char, cx, charY);
            }
        }

        // Green core flash
        ctx.shadowBlur = 0;
        const coreGrad = ctx.createRadialGradient(x, y, 0, x, y, laneWidth * 0.5 * ease);
        coreGrad.addColorStop(0, `rgba(180, 255, 180, ${ease * 0.9})`);
        coreGrad.addColorStop(0.5, `rgba(0, 255, 70, ${ease * 0.4})`);
        coreGrad.addColorStop(1, 'rgba(0, 255, 70, 0)');
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(x, y, laneWidth * 0.5 * ease, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
