import type { IThemeStrategy } from './IThemeStrategy';

/**
 * DefaultTheme implements the standard visual style for the rhythm game.
 */
export class DefaultTheme implements IThemeStrategy {
    public readonly id = 'default';

    public renderBackground(ctx: CanvasRenderingContext2D, width: number, _height: number, horizonY: number, bottomY: number): void {
        const roadGrad = ctx.createLinearGradient(0, horizonY, 0, bottomY);
        roadGrad.addColorStop(0, 'rgba(0, 10, 30, 0.95)');
        roadGrad.addColorStop(0.5, 'rgba(10, 30, 80, 0.9)');
        roadGrad.addColorStop(1, 'rgba(0, 50, 120, 0.95)');

        ctx.fillStyle = roadGrad;
        ctx.fillRect(0, horizonY, width, bottomY - horizonY);
    }


    public renderHitZonePulse(ctx: CanvasRenderingContext2D, _lane: number, x: number, y: number, width: number, beatPhase: number): void {
        const pulseAlpha = Math.max(0, 1 - beatPhase) * 0.4;
        if (pulseAlpha <= 0) return;

        ctx.save();
        const grad = ctx.createLinearGradient(x, y, x, y - 50);
        grad.addColorStop(0, `rgba(255, 255, 255, ${pulseAlpha})`);
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = grad;
        // Draw a pulse bar above the hit line
        ctx.fillRect(x, y - 20, width, 20);
        ctx.restore();
    }

    public getColorForJudgment(judgment: string): string {
        switch (judgment) {
            case 'PERFECT': return '#FFEB3B';
            case 'GREAT': return '#4CAF50';
            case 'GOOD': return '#2196F3';
            case 'MISS': return '#F44336';
            default: return '#FFFFFF';
        }
    }
}
