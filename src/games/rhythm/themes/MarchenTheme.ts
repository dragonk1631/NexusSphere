import type { IThemeStrategy } from './IThemeStrategy';

export class MarchenTheme implements IThemeStrategy {
    public readonly id = 'marchen';



    public renderHitZonePulse(ctx: CanvasRenderingContext2D, _lane: number, x: number, y: number, width: number, beatPhase: number): void {
        const pulseAlpha = Math.max(0, 1 - beatPhase) * 0.5;
        if (pulseAlpha <= 0) return;
        ctx.fillStyle = `rgba(249, 168, 212, ${pulseAlpha})`;
        ctx.beginPath();
        ctx.ellipse(x + width / 2, y, width / 2, 8, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    public getColorForJudgment(judgment: string): string {
        switch (judgment) {
            case 'PERFECT': return '#F9A8D4';
            case 'GREAT': return '#f8c8da';
            case 'GOOD': return '#ce93d8';
            case 'MISS': return '#880e4f';
            default: return '#F9A8D4';
        }
    }
}
