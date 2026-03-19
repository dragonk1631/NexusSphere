import type { IThemeStrategy } from './IThemeStrategy';
import { Judgment } from '../types/GameTypes';

/**
 * FireworksTheme (formerly Technika Pink)
 * Provides a festive, high-contrast aesthetic with bright pink, gold, and warm plum tones.
 */
export class FireworksTheme implements IThemeStrategy {
    public readonly id = 'fireworks';

    public renderHitZonePulse(ctx: CanvasRenderingContext2D, _lane: number, x: number, y: number, width: number, beatPhase: number): void {
        const pulseAlpha = Math.max(0, 1 - beatPhase);
        if (pulseAlpha <= 0) return;

        ctx.strokeStyle = `rgba(255, 208, 0, ${pulseAlpha * 0.8})`; // Technika Gold
        ctx.lineWidth = 4;
        ctx.strokeRect(x + 2, y - 5, width - 4, 10);
    }

    public getColorForJudgment(judgment: Judgment): string {
        switch (judgment) {
            case Judgment.PERFECT: return '#FFD000'; // Gold
            case Judgment.GREAT: return '#FF006E'; // Pink
            case Judgment.GOOD: return '#FF8040'; // Orange
            case Judgment.MISS: return '#FF0000'; // Red
            default: return '#ffffff';
        }
    }

    /**
     * Fireworks Burst Hit Effect
     */
    public renderHitEffect(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        laneWidth: number,
        judgment: Judgment,
        t: number
    ): void {
        const ease = 1 - Math.pow(t, 2);
        const alpha = ease;
        const color = this.getColorForJudgment(judgment);

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // 1. Central Fireworks Spark (Core)
        const coreR = laneWidth * 0.4 * ease;
        const coreGrad = ctx.createRadialGradient(x, y, 0, x, y, coreR);
        coreGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
        coreGrad.addColorStop(0.5, applyAlpha(color, Math.floor(alpha * 200).toString(16).padStart(2, '0')));
        coreGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = coreGrad;
        ctx.beginPath(); ctx.arc(x, y, coreR, 0, Math.PI * 2); ctx.fill();

        // 2. Sparkling Shrapnel (Simulated Fireworks)
        const sparkCount = judgment === Judgment.PERFECT ? 12 : 8;
        for (let i = 0; i < sparkCount; i++) {
            const angle = (i / sparkCount) * Math.PI * 2 + t * 2;
            const dist = laneWidth * (0.3 + t * 2.5);
            const sx = x + Math.cos(angle) * dist;
            const sy = y + Math.sin(angle) * dist;
            
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(sx, sy, 2 * ease, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

function applyAlpha(color: string, alphaHex: string): string {
    if (color.startsWith('#')) return color.substring(0, 7) + alphaHex;
    return color;
}
