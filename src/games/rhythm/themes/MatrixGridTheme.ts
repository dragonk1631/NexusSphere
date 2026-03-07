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
     * Refined: Hits are now centered exactly on the judgment line to avoid gaps.
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

        // 1. High-density Code Cascade (Starting exactly from Y)
        for (let i = 0; i < streamCount; i++) {
            const spreadSeed = (i / (streamCount - 1) - 0.5) * laneWidth * 2.2;
            const cx = x + spreadSeed;
            const riseBase = t * laneWidth * 5.0; // Starts from 0 offset

            const innerCharCount = isPerfect ? 5 : 3;
            for (let j = 0; j < innerCharCount; j++) {
                const charY = y - riseBase - j * charSize * 1.2;
                const charAlpha = ease * (1 - j * 0.2) * (0.5 + (i % 2) * 0.5);

                if (charY > y + 5) continue;

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

        // 2. Immediate Glitch Artifacts (Fills the gap at the hit line)
        if (t < 0.25) {
            const sAlpha = (0.25 - t) / 0.25;
            ctx.fillStyle = `rgba(0, 255, 70, ${sAlpha * 0.8})`;
            for (let i = 0; i < 6; i++) {
                const sw = laneWidth * (0.1 + Math.random() * 0.3);
                const sh = 2 + Math.random() * 10;
                const sx = x + (Math.random() - 0.5) * laneWidth * 1.2;
                const sy = y + (Math.random() - 0.5) * 10;
                ctx.fillRect(sx - sw / 2, sy - sh / 2, sw, sh);
            }
        }

        // 3. Horizontal Glitch Bars
        if (t < 0.35) {
            const glitchAlpha = (0.35 - t) / 0.35 * 0.8;
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 4; i++) {
                const gw = laneWidth * (2.5 + Math.random() * 2);
                const gh = 2 + Math.random() * 4;
                const gx = x - gw / 2 + (Math.random() - 0.5) * 15;
                const gy = y + (Math.random() - 0.5) * 20;
                ctx.fillStyle = `rgba(0, 255, 70, ${glitchAlpha * 0.7})`;
                ctx.fillRect(gx, gy, gw, gh);
            }
        }

        // 4. Powerful Green Core Flare
        ctx.shadowBlur = 0;
        const flareR = laneWidth * (isPerfect ? 1.1 : 0.8) * ease;
        const coreGrad = ctx.createRadialGradient(x, y, 0, x, y, flareR);
        coreGrad.addColorStop(0, `rgba(220, 255, 230, ${ease * 1.0})`);
        coreGrad.addColorStop(0.2, `rgba(0, 255, 70, ${ease * 0.9})`);
        coreGrad.addColorStop(0.5, `rgba(0, 100, 30, ${ease * 0.5})`);
        coreGrad.addColorStop(1, 'rgba(0, 40, 10, 0)');

        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(x, y, flareR, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
