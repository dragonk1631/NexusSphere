import type { IThemeStrategy } from './IThemeStrategy';
import { Judgment } from '../types/GameTypes';

/**
 * DefaultTheme implements the standard visual style for the rhythm game.
 */
export class DefaultTheme implements IThemeStrategy {
    public readonly id = 'default';

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

    public getColorForJudgment(judgment: Judgment): string {
        switch (judgment) {
            case Judgment.PERFECT: return '#FFEB3B';
            case Judgment.GREAT: return '#4CAF50';
            case Judgment.GOOD: return '#2196F3';
            case Judgment.MISS: return '#F44336';
            default: return '#FFFFFF';
        }
    }
}
