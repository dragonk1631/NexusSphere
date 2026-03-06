import type { IThemeStrategy } from './IThemeStrategy';

/**
 * VaporwaveTheme provides a retro-80s aesthetic with pinks, purples, and sun gradients.
 */
export class VaporwaveTheme implements IThemeStrategy {
    public readonly id = 'vaporwave';





    public renderHitZonePulse(ctx: CanvasRenderingContext2D, _lane: number, x: number, y: number, width: number, beatPhase: number): void {
        const pulseAlpha = Math.max(0, 1 - beatPhase) * 0.6;
        if (pulseAlpha <= 0) return;

        ctx.save();
        ctx.fillStyle = `rgba(255, 0, 255, ${pulseAlpha})`;
        ctx.fillRect(x, y - 5, width, 10);
        ctx.restore();
    }

    public getColorForJudgment(judgment: string): string {
        switch (judgment) {
            case 'PERFECT': return '#FF71CE';
            case 'GREAT': return '#01CDFE';
            case 'GOOD': return '#05FFA1';
            case 'MISS': return '#B967FF';
            default: return '#FFFB96';
        }
    }
}
