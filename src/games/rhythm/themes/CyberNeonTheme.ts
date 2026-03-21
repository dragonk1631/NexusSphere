import type { IThemeStrategy } from './IThemeStrategy';
import { Judgment } from '../types/GameTypes';

/**
 * CyberNeonTheme provides a high-contrast, glowing neon aesthetic.
 */
export class CyberNeonTheme implements IThemeStrategy {
    public readonly id = 'cyber-neon';

    public renderHitZonePulse(ctx: CanvasRenderingContext2D, _lane: number, x: number, y: number, width: number, beatPhase: number): void {
        const pulseAlpha = Math.max(0, 1 - beatPhase);
        if (pulseAlpha <= 0) return;

        ctx.strokeStyle = `rgba(0, 255, 255, ${pulseAlpha})`;
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 2, y - 5, width - 4, 10);
    }

    public getColorForJudgment(judgment: Judgment): string {
        switch (judgment) {
            case Judgment.PERFECT: return '#00f3ff';
            case Judgment.GREAT: return '#ff00ff';
            case Judgment.GOOD: return '#fffb00';
            case Judgment.MISS: return '#ff0000';
            default: return '#ffffff';
        }
    }

    /**
     * Digital Ray Burst: 6 angular rays shoot from hit point + hexagonal shockwave
     */
    public renderHitEffect(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        laneWidth: number,
        judgment: Judgment,
        t: number,
        _seed: number
    ): void {
        const ease = 1 - Math.pow(t, 2); // ease-out
        const alpha = ease;

        const color = this.getColorForJudgment(judgment);
        const isPerfect = judgment === Judgment.PERFECT;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // 1. Digital Ray Burst (6 directions, angular)
        const rayCount = isPerfect ? 8 : 6;
        const rayLength = laneWidth * (0.8 + ease * 2.5);
        ctx.lineWidth = isPerfect ? 2.5 : 1.5;

        for (let i = 0; i < rayCount; i++) {
            const angle = (i / rayCount) * Math.PI * 2 - Math.PI / 2;
            const r = parseInt(color.substring(1, 3), 16);
            const g = parseInt(color.substring(3, 5), 16);
            const b = parseInt(color.substring(5, 7), 16);

            ctx.beginPath();
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.9})`;
            ctx.moveTo(x + Math.cos(angle) * laneWidth * 0.3, y + Math.sin(angle) * laneWidth * 0.3);
            ctx.lineTo(x + Math.cos(angle) * rayLength * 0.5, y + Math.sin(angle) * rayLength * 0.5);
            ctx.stroke();
        }

        // 2. Angular Shockwave (hexagonal-ish)
        const hexR = laneWidth * 0.3 + ease * laneWidth * 1.8;
        ctx.beginPath();
        for (let i = 0; i <= 6; i++) {
            const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
            const px = x + Math.cos(a) * hexR;
            const py = y + Math.sin(a) * hexR;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = `rgba(0, 255, 255, ${alpha * 0.7})`;
        ctx.lineWidth = 2 * ease;
        ctx.stroke();

        // 3. Core flash
        const coreR = laneWidth * 0.25 * ease;
        const coreGrad = ctx.createRadialGradient(x, y, 0, x, y, coreR);
        coreGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
        coreGrad.addColorStop(0.4, `rgba(0, 255, 255, ${alpha * 0.6})`);
        coreGrad.addColorStop(1, 'rgba(0, 255, 255, 0)');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(x, y, coreR, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
