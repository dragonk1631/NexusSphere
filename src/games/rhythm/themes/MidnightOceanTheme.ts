import type { IThemeStrategy } from './IThemeStrategy';

export class MidnightOceanTheme implements IThemeStrategy {
    public readonly id = 'midnight-ocean';



    public renderHitZonePulse(ctx: CanvasRenderingContext2D, _lane: number, x: number, y: number, width: number, beatPhase: number): void {
        const pulseAlpha = Math.max(0, 1 - beatPhase) * 0.6;
        if (pulseAlpha <= 0) return;
        ctx.fillStyle = `rgba(191, 219, 56, ${pulseAlpha})`;
        ctx.fillRect(x, y - 2, width, 4);
    }

    public getColorForJudgment(judgment: string): string {
        switch (judgment) {
            case 'PERFECT': return '#BFDB38';
            case 'GREAT': return '#64ffda';
            case 'GOOD': return '#4dd0e1';
            case 'MISS': return '#FF5252';
            default: return '#BFDB38';
        }
    }
}
