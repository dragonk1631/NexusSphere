import type { IThemeStrategy } from './IThemeStrategy';

/**
 * VaporwaveTheme provides a retro-80s aesthetic with pinks, purples, and sun gradients.
 */
export class VaporwaveTheme implements IThemeStrategy {
    public readonly id = 'vaporwave';

    public renderBackground(ctx: CanvasRenderingContext2D, width: number, _height: number, horizonY: number, bottomY: number): void {
        // Purple to Pink gradient
        const bgGrad = ctx.createLinearGradient(0, horizonY, 0, bottomY);
        bgGrad.addColorStop(0, '#2e004f');
        bgGrad.addColorStop(1, '#ff0080');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, horizonY, width, bottomY - horizonY);

        // Retro sun (partial)
        const sunX = width / 2;
        const sunY = horizonY + 50;
        const sunR = 100;
        const sunGrad = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
        sunGrad.addColorStop(0, '#ffcc00');
        sunGrad.addColorStop(1, '#ff0066');
        ctx.fillStyle = sunGrad;
        ctx.beginPath();
        ctx.arc(sunX, sunY, sunR, Math.PI, 0); // Semi circle
        ctx.fill();
    }



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
