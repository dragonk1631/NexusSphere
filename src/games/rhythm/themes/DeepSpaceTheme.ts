import type { IThemeStrategy } from './IThemeStrategy';
import { Judgment } from '../types/GameTypes';

/**
 * DeepSpaceTheme provides a dark, cosmic aesthetic.
 */
export class DeepSpaceTheme implements IThemeStrategy {
    public readonly id = 'deep-space';

    public renderHitZonePulse(ctx: CanvasRenderingContext2D, _lane: number, x: number, y: number, width: number, beatPhase: number): void {
        const pulseAlpha = Math.max(0, 1 - beatPhase) * 0.6;
        if (pulseAlpha <= 0) return;
        ctx.fillStyle = `rgba(100, 140, 255, ${pulseAlpha})`;
        ctx.beginPath();
        ctx.ellipse(x + width / 2, y, width / 2, 5, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    public getColorForJudgment(judgment: Judgment): string {
        switch (judgment) {
            case Judgment.PERFECT: return '#e0e0ff';
            case Judgment.GREAT: return '#b0b0ff';
            case Judgment.GOOD: return '#8080ff';
            case Judgment.MISS: return '#ff5050';
            default: return '#ffffff';
        }
    }

    /**
     * Interstellar Shockwave: 3 concentric rings expand at staggered times,
     * with stellar debris scattered outward.
     */
    public renderHitEffect(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        laneWidth: number,
        _judgment: Judgment,
        t: number
    ): void {
        const ease = 1 - Math.pow(t, 1.5);
        const starCount = 12;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // 1. Cosmic Swirl Stars (8-pointed)
        for (let i = 0; i < starCount; i++) {
            const seed = (i * 123.45) % 1;
            const baseAngle = (i / starCount) * Math.PI * 2;
            const swirl = t * Math.PI * 5;
            const radius = laneWidth * (0.25 + (i % 4) * 0.3) * (0.4 + t * 2.2);
            
            const sx = x + Math.cos(baseAngle + swirl) * radius;
            const sy = y + Math.sin(baseAngle + swirl) * radius * 0.55;

            const alpha = ease * (0.7 + seed * 0.3);
            const currentSize = (3 + seed * 4) * ease; // Increased size

            // Light Trail
            ctx.strokeStyle = `rgba(140, 200, 255, ${alpha * 0.4})`; 
            ctx.lineWidth = currentSize * 0.4;
            ctx.beginPath();
            const prevT = Math.max(0, t - 0.04);
            const prevSwirl = prevT * Math.PI * 5;
            const prevRadius = laneWidth * (0.25 + (i % 4) * 0.3) * (0.4 + prevT * 2.2);
            ctx.moveTo(x + Math.cos(baseAngle + prevSwirl) * prevRadius, y + Math.sin(baseAngle + prevSwirl) * prevRadius * 0.55);
            ctx.lineTo(sx, sy);
            ctx.stroke();

            // Cosmic 8-pointed Star Point
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(t * Math.PI * 8 + i);
            
            const colors = [
                'rgba(255, 255, 255', // White
                'rgba(140, 200, 255', // Blue
                'rgba(180, 255, 240', // Cyan
                'rgba(160, 160, 255'  // Indigo
            ]; 
            ctx.fillStyle = `${colors[Math.floor(seed * colors.length)]}, ${alpha})`;

            ctx.beginPath();
            for (let j = 0; j < 16; j++) {
                const r = j % 2 === 0 ? currentSize * 2.5 : currentSize * 0.8;
                const a = (j / 16) * Math.PI * 2;
                ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            }
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        // 2. Interstellar Shockwave (Single additive ripple)
        const progress = t;
        const ringAlpha = (1 - progress) * 0.5;
        const ringR = laneWidth * (0.35 + progress * 3.0);
        
        ctx.strokeStyle = `rgba(140, 200, 255, ${ringAlpha})`;
        ctx.lineWidth = 2 * (1 - progress);
        ctx.beginPath();
        ctx.arc(x, y, ringR, 0, Math.PI * 2);
        ctx.stroke();

        // 3. Core Pulse
        const coreR = laneWidth * 0.6 * (1 - t);
        const coreGrad = ctx.createRadialGradient(x, y, 0, x, y, coreR);
        coreGrad.addColorStop(0, `rgba(255, 255, 255, ${(1 - t) * 0.95})`);
        coreGrad.addColorStop(0.5, `rgba(140, 200, 255, ${(1 - t) * 0.7})`);
        coreGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = coreGrad;
        ctx.beginPath(); ctx.arc(x, y, coreR, 0, Math.PI * 2); ctx.fill();

        ctx.restore();
    }
}
