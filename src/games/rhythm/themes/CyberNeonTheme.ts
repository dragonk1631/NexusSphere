import type { IThemeStrategy } from './IThemeStrategy';

/**
 * CyberNeonTheme provides a high-contrast, glowing neon aesthetic.
 */
export class CyberNeonTheme implements IThemeStrategy {
    public readonly id = 'cyber-neon';



    public renderHitZonePulse(ctx: CanvasRenderingContext2D, _lane: number, x: number, y: number, width: number, beatPhase: number): void {
        const pulseAlpha = Math.max(0, 1 - beatPhase);
        if (pulseAlpha <= 0) return;

        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00ffff';
        ctx.strokeStyle = `rgba(0, 255, 255, ${pulseAlpha})`;
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 2, y - 5, width - 4, 10);
        ctx.restore();
    }

    public getColorForJudgment(judgment: string): string {
        switch (judgment) {
            case 'PERFECT': return '#00FFFF';
            case 'GREAT': return '#FF00FF';
            case 'GOOD': return '#FFFF00';
            case 'MISS': return '#FF0000';
            default: return '#FFFFFF';
        }
    }
}
