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
     * Fireworks Burst + Expanding Ring Hit Effect
     */
    public renderHitEffect(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        laneWidth: number,
        judgment: Judgment,
        t: number
    ): void {
        const ease = 1 - Math.pow(t, 2); // Fast out
        const alpha = ease;
        const color = this.getColorForJudgment(judgment);

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // 1. Expanding Ring (Shockwave)
        const ringR = laneWidth * (0.4 + t * 1.5);
        ctx.strokeStyle = applyAlpha(color, Math.floor(alpha * 128).toString(16).padStart(2, '0'));
        ctx.lineWidth = 3 * ease;
        ctx.beginPath();
        ctx.arc(x, y, ringR, 0, Math.PI * 2);
        ctx.stroke();

        // 2. Central Glow
        const coreR = laneWidth * 0.5 * ease;
        const coreGrad = ctx.createRadialGradient(x, y, 0, x, y, coreR);
        coreGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
        coreGrad.addColorStop(0.3, applyAlpha(color, Math.floor(alpha * 220).toString(16).padStart(2, '0')));
        coreGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = coreGrad;
        ctx.beginPath(); 
        ctx.arc(x, y, coreR, 0, Math.PI * 2); 
        ctx.fill();

        // 3. Fireworks Particle Burst
        const sparkCount = judgment === Judgment.PERFECT ? 16 : 10;
        for (let i = 0; i < sparkCount; i++) {
            const angle = (i / sparkCount) * Math.PI * 2 + (phaseSeed[i % 8] || 0);
            const speed = 1.0 + (i % 3) * 0.5;
            const dist = laneWidth * (0.2 + t * 3.5 * speed);
            const sx = x + Math.cos(angle) * dist;
            const sy = y + Math.sin(angle) * dist;
            
            // Traveling sparks with tail
            const tailLen = 10 * ease;
            const tx = sx - Math.cos(angle) * tailLen;
            const ty = sy - Math.sin(angle) * tailLen;

            ctx.strokeStyle = color;
            ctx.lineWidth = 2 * ease;
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(sx, sy);
            ctx.stroke();

            // Spark head
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(sx, sy, 1.5 * ease, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

const phaseSeed = [0.1, 0.8, 1.5, 2.2, 3.1, 4.0, 4.8, 5.5];

function applyAlpha(color: string, alphaHex: string): string {
    if (color.startsWith('#')) return color.substring(0, 7) + alphaHex;
    return color;
}
