import type { IThemeStrategy } from './IThemeStrategy';

export class WinterSnowTheme implements IThemeStrategy {
    public readonly id = 'winter-snow';



    public renderHitZonePulse(ctx: CanvasRenderingContext2D, _lane: number, x: number, y: number, width: number, beatPhase: number): void {
        const pulseAlpha = Math.max(0, 1 - beatPhase) * 0.6;
        if (pulseAlpha <= 0) return;
        ctx.fillStyle = `rgba(224, 247, 250, ${pulseAlpha})`;
        ctx.fillRect(x, y - 2, width, 4);
    }

    public getColorForJudgment(judgment: string): string {
        switch (judgment) {
            case 'PERFECT': return '#E0F7FA';
            case 'GREAT': return '#b2ebf2';
            case 'GOOD': return '#4fc3f7';
            case 'MISS': return '#F44336';
            default: return '#E0F7FA';
        }
    }
}
