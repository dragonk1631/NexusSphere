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
     * Realistic Fireworks Burst + Expanding Ring Hit Effect
     * Features: Gravity, Friction, Multi-stage Color Transitions
     */
    public renderHitEffect(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        laneWidth: number,
        judgment: Judgment,
        t: number
    ): void {
        const alpha = 1 - t;
        const baseColor = this.getColorForJudgment(judgment);

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // 1. Expanding Ring (Shockwave) - Faster fade
        const ringAlpha = Math.max(0, 1 - t * 2);
        if (ringAlpha > 0) {
            const ringR = laneWidth * (0.4 + t * 1.8);
            ctx.strokeStyle = applyAlpha(baseColor, Math.floor(ringAlpha * 140).toString(16).padStart(2, '0'));
            ctx.lineWidth = 4 * ringAlpha;
            ctx.beginPath();
            ctx.arc(x, y, ringR, 0, Math.PI * 2);
            ctx.stroke();
        }

        // 2. Central Flash (The initial explosion)
        if (t < 0.3) {
            const flashAlpha = (1 - t / 0.3) * 0.8;
            const flashR = laneWidth * 0.6 * (1 + t);
            const grad = ctx.createRadialGradient(x, y, 0, x, y, flashR);
            grad.addColorStop(0, `rgba(255, 255, 255, ${flashAlpha})`);
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(x, y, flashR, 0, Math.PI * 2); ctx.fill();
        }

        // 3. Fireworks Particle Burst with Physics
        const sparkCount = judgment === Judgment.PERFECT ? 20 : 12;
        const gravity = t * t * 80; // Downward pull increases over time
        const friction = Math.pow(0.92, t * 15); // Velocity decay

        for (let i = 0; i < sparkCount; i++) {
            const angle = (i / sparkCount) * Math.PI * 2 + (phaseSeed[i % 8] || 0);
            const speed = (0.8 + (i % 5) * 0.4);
            const initialDist = laneWidth * 0.2;
            const travelDist = laneWidth * 4.0 * speed * friction * t;
            
            const sx = x + Math.cos(angle) * (initialDist + travelDist);
            const sy = y + Math.sin(angle) * (initialDist + travelDist) + gravity;
            
            // Dynamic Color Transition
            let sparkColor = baseColor;
            if (t < 0.15) sparkColor = '#ffffff'; // White hot start
            else if (t > 0.7) {
                // Cooling down to dark red/orange flicker
                const flicker = Math.sin(t * 50 + i) > 0 ? 1 : 0.3;
                sparkColor = applyAlpha('#ff4400', Math.floor(alpha * 255 * flicker).toString(16).padStart(2, '0'));
            }

            // Draw spark with trail
            const trailLen = 12 * (1 - t) * friction;
            const tx = sx - Math.cos(angle) * trailLen;
            const ty = sy - Math.sin(angle) * trailLen;

            ctx.strokeStyle = sparkColor;
            ctx.lineWidth = (2.5 - t * 1.5) * friction;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(sx, sy);
            ctx.stroke();

            // Head glow
            if (t < 0.6) {
                ctx.fillStyle = (t < 0.2) ? '#fff' : sparkColor;
                ctx.beginPath();
                ctx.arc(sx, sy, 1.5 * (1 - t), 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.restore();
    }
}

const phaseSeed = [0.1, 0.8, 1.5, 2.2, 3.1, 4.0, 4.8, 5.5];

function applyAlpha(color: string, alphaHex: string): string {
    if (color.startsWith('#')) return color.substring(0, 7) + alphaHex;
    return color;
}
