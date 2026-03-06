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
}
