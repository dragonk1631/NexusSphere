import type { IThemeStrategy } from './IThemeStrategy';

/**
 * MatrixGridTheme provides a digital, grid-based aesthetic inspired by classic sci-fi.
 */
export class MatrixGridTheme implements IThemeStrategy {
    public readonly id = 'matrix-grid';





    public renderHitZonePulse(ctx: CanvasRenderingContext2D, _lane: number, x: number, y: number, width: number, beatPhase: number): void {
        const pulseAlpha = Math.max(0, 1 - beatPhase) * 0.5;
        if (pulseAlpha <= 0) return;

        ctx.save();
        ctx.fillStyle = `rgba(0, 255, 0, ${pulseAlpha})`;
        for (let i = 0; i < width; i += 10) {
            ctx.fillRect(x + i, y - 2, 5, 4);
        }
        ctx.restore();
    }

    public getColorForJudgment(judgment: string): string {
        switch (judgment) {
            case 'PERFECT': return '#00FF41';
            case 'GREAT': return '#00FF41';
            case 'GOOD': return '#008F11';
            case 'MISS': return '#FF0000';
            default: return '#00FF41';
        }
    }
}
