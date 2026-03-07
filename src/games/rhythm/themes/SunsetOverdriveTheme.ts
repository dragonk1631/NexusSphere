import type { IThemeStrategy } from './IThemeStrategy';

export class SunsetOverdriveTheme implements IThemeStrategy {
    public readonly id = 'sunset-overdrive';

    public renderHitZonePulse(ctx: CanvasRenderingContext2D, _lane: number, x: number, y: number, width: number, beatPhase: number): void {
        const pulseAlpha = Math.max(0, 1 - beatPhase) * 0.7;
        if (pulseAlpha <= 0) return;
        ctx.fillStyle = `rgba(227, 193, 161, ${pulseAlpha})`;
        ctx.fillRect(x, y - 2, width, 4);
    }

    public getColorForJudgment(judgment: string): string {
        switch (judgment) {
            case 'PERFECT': return '#E3C1A1';
            case 'GREAT': return '#DFCBBD';
            case 'GOOD': return '#8E4A42';
            case 'MISS': return '#5D2E29';
            default: return '#E3C1A1';
        }
    }

    /**
     * Golden Flame Pillar: A lance of sunset fire shoots upward + oval horizon ripple
     */
    public renderHitEffect(ctx: CanvasRenderingContext2D, x: number, y: number, laneWidth: number, judgment: string, t: number): void {
        const ease = 1 - Math.pow(t, 2);
        const isPerfect = judgment === 'PERFECT';

        ctx.save();

        // 1. Upward flame pillar
        const pHeight = laneWidth * 1.5 + ease * laneWidth * 4;
        const pWidth = laneWidth * (0.3 + ease * 0.2);
        const flameGrad = ctx.createLinearGradient(x, y, x, y - pHeight);
        flameGrad.addColorStop(0, `rgba(255, 200, 100, ${ease * 0.95})`);
        flameGrad.addColorStop(0.4, `rgba(227, 140, 60, ${ease * 0.7})`);
        flameGrad.addColorStop(0.8, `rgba(142, 74, 66, ${ease * 0.3})`);
        flameGrad.addColorStop(1, 'transparent');

        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = flameGrad;
        ctx.beginPath();
        ctx.ellipse(x, y - pHeight * 0.4, pWidth * 0.5, pHeight * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();

        // 2. Horizontal sunset ripple (oval wave)
        const rippleW = laneWidth * (0.5 + t * 3.5);
        const rippleH = laneWidth * 0.18;
        ctx.strokeStyle = `rgba(227, 193, 161, ${ease * 0.8})`;
        ctx.lineWidth = 2 * ease;
        ctx.beginPath();
        ctx.ellipse(x, y, rippleW, rippleH, 0, 0, Math.PI * 2);
        ctx.stroke();

        // 3. Perfect burst — extra warm gold spray
        if (isPerfect) {
            for (let i = 0; i < 6; i++) {
                const angle = -Math.PI / 2 + (i - 2.5) * 0.3;
                const len = laneWidth * (0.4 + ease * 1.2);
                ctx.strokeStyle = `rgba(255, 220, 140, ${ease * 0.7})`;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
                ctx.stroke();
            }
        }

        ctx.restore();
    }
}
