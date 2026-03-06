import type { IThemeStrategy } from './IThemeStrategy';

/**
 * DeepSpaceTheme provides a minimalist, vast space aesthetic.
 */
export class DeepSpaceTheme implements IThemeStrategy {
    public readonly id = 'deep-space';





    public renderHitZonePulse(ctx: CanvasRenderingContext2D, _lane: number, x: number, y: number, width: number, beatPhase: number): void {
        const pulseAlpha = Math.max(0, 1 - beatPhase) * 0.3;
        if (pulseAlpha <= 0) return;

        ctx.save();
        const radGrad = ctx.createRadialGradient(x + width / 2, y, 0, x + width / 2, y, width / 2);
        radGrad.addColorStop(0, `rgba(255, 255, 255, ${pulseAlpha})`);
        radGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = radGrad;
        ctx.fillRect(x, y - 30, width, 30);
        ctx.restore();
    }

    public getColorForJudgment(judgment: string): string {
        switch (judgment) {
            case 'PERFECT': return '#E3F2FD';
            case 'GREAT': return '#90CAF9';
            case 'GOOD': return '#42A5F5';
            case 'MISS': return '#5C6BC0';
            default: return '#E3F2FD';
        }
    }
}
