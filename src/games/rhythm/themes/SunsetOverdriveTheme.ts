import type { IThemeStrategy } from './IThemeStrategy';

export class SunsetOverdriveTheme implements IThemeStrategy {
    public readonly id = 'sunset-overdrive';



    public renderHitZonePulse(ctx: CanvasRenderingContext2D, _lane: number, x: number, y: number, width: number, beatPhase: number): void {
        const pulseAlpha = Math.max(0, 1 - beatPhase) * 0.7;
        if (pulseAlpha <= 0) return;
        ctx.fillStyle = `rgba(255, 215, 0, ${pulseAlpha})`;
        ctx.fillRect(x, y - 2, width, 4);
    }

    public getColorForJudgment(judgment: string): string {
        switch (judgment) {
            case 'PERFECT': return '#FFD700';
            case 'GREAT': return '#FF8E53';
            case 'GOOD': return '#FF416C';
            case 'MISS': return '#8B0000';
            default: return '#FFD700';
        }
    }
}
