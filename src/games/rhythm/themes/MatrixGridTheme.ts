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
     * Code Overload: Enhanced matrix impact with high-density character streams,
     * horizontal glitch bars, and a powerful neon flare.
     */
    public renderHitEffect(ctx: CanvasRenderingContext2D, x: number, y: number, laneWidth: number, judgment: string, t: number): void {
        const ease = 1 - Math.pow(t, 2);
        const isPerfect = judgment === 'PERFECT';
        const chars = '01ABXZ%$#@!&*?/\\|ｦｱｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ';
        const streamCount = isPerfect ? 12 : 8;
        const charSize = Math.max(10, laneWidth * 0.18);

        ctx.save();
        ctx.font = `bold ${charSize}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // 1. High-density Code Cascade
        for (let i = 0; i < streamCount; i++) {
            const spreadSeed = (i / (streamCount - 1) - 0.5) * laneWidth * 2.2;
            const cx = x + spreadSeed;
            const riseBase = laneWidth * 0.4 + t * laneWidth * 4.5;

            const innerCharCount = isPerfect ? 5 : 3;
            for (let j = 0; j < innerCharCount; j++) {
                const charY = y - riseBase - j * charSize * 1.2;
                const charAlpha = ease * (1 - j * 0.2) * (0.5 + (i % 2) * 0.5);

                if (j === 0) {
                    ctx.fillStyle = `rgba(220, 255, 230, ${charAlpha})`;
                    ctx.shadowBlur = 12;
                    ctx.shadowColor = '#00FF46';
                } else {
                    ctx.fillStyle = `rgba(0, 255, 70, ${charAlpha * 0.7})`;
                    ctx.shadowBlur = 0;
                }

                const char = chars[Math.floor((i * 13 + j * 7 + t * 30) % chars.length)];
                ctx.fillText(char, cx, charY);
            }
        }

        // 2. Horizontal Glitch Bars (New for impact)
        if (t < 0.3) {
            const glitchAlpha = (0.3 - t) / 0.3 * 0.8;
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 4; i++) {
                const gw = laneWidth * (2 + Math.random() * 2);
                const gh = 2 + Math.random() * 4;
                const gx = x - gw / 2 + (Math.random() - 0.5) * 20;
                const gy = y + (Math.random() - 0.5) * 30;
                ctx.fillStyle = `rgba(0, 255, 70, ${glitchAlpha * 0.6})`;
                ctx.fillRect(gx, gy, gw, gh);
            }
        }

        // 3. Powerful Green Core Flare
        ctx.shadowBlur = 0;
        const flareR = laneWidth * (isPerfect ? 1.0 : 0.7) * ease;
        const coreGrad = ctx.createRadialGradient(x, y, 0, x, y, flareR);
        coreGrad.addColorStop(0, `rgba(200, 255, 210, ${ease * 1.0})`);
        coreGrad.addColorStop(0.3, `rgba(0, 255, 70, ${ease * 0.8})`);
        coreGrad.addColorStop(0.6, `rgba(0, 100, 30, ${ease * 0.4})`);
        coreGrad.addColorStop(1, 'rgba(0, 40, 10, 0)');

        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(x, y, flareR, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
