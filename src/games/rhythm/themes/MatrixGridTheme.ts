import type { IThemeStrategy } from './IThemeStrategy';

/**
 * MatrixGridTheme provides a digital, grid-based aesthetic inspired by classic sci-fi.
 */
export class MatrixGridTheme implements IThemeStrategy {
    public readonly id = 'matrix-grid';

    public renderBackground(ctx: CanvasRenderingContext2D, width: number, _height: number, horizonY: number, bottomY: number): void {
        // Dark Green gradient
        const bgGrad = ctx.createLinearGradient(0, horizonY, 0, bottomY);
        bgGrad.addColorStop(0, '#000800');
        bgGrad.addColorStop(1, '#001a00');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, horizonY, width, bottomY - horizonY);

        // Falling matrix characters effect (static representation)
        ctx.fillStyle = 'rgba(0, 255, 70, 0.05)';
        for (let i = 0; i < 20; i++) {
            const x = Math.random() * width;
            const h = Math.random() * (bottomY - horizonY);
            ctx.fillRect(x, horizonY + Math.random() * h, 2, h);
        }
    }



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
