import type { IThemeStrategy } from './IThemeStrategy';

export class MonochromeTechTheme implements IThemeStrategy {
    public readonly id = 'monochrome-tech';



    public renderHitZonePulse(ctx: CanvasRenderingContext2D, _lane: number, x: number, y: number, width: number, beatPhase: number): void {
        const pulseAlpha = Math.max(0, 1 - beatPhase) * 0.4;
        if (pulseAlpha <= 0) return;
        ctx.strokeStyle = `rgba(255, 255, 255, ${pulseAlpha})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y - 1, width, 2);
    }

    public getColorForJudgment(judgment: string): string {
        switch (judgment) {
            case 'PERFECT': return '#DDDDDD';
            case 'GREAT': return '#AAAAAA';
            case 'GOOD': return '#888888';
            case 'MISS': return '#444444';
            default: return '#DDDDDD';
        }
    }
}
