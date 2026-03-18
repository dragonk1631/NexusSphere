import type { IThemeStrategy } from './IThemeStrategy';
import { Judgment } from '../types/GameTypes';

/**
 * MarchenTheme provides a fairy-tale aesthetic.
 * Optimized: Removed shadowBlur from stardust effects.
 */
export class MarchenTheme implements IThemeStrategy {
    public readonly id = 'marchen';

    public preWarm(_ctx: CanvasRenderingContext2D, _laneWidth: number): void {
        console.log("[MarchenTheme] Pre-warmed.");
    }

    public renderHitZonePulse(ctx: CanvasRenderingContext2D, _lane: number, x: number, y: number, width: number, beatPhase: number): void {
        const pulseAlpha = Math.max(0, 1 - beatPhase) * 0.5;
        if (pulseAlpha <= 0) return;
        ctx.fillStyle = `rgba(249, 168, 212, ${pulseAlpha})`;
        ctx.beginPath();
        ctx.ellipse(x + width / 2, y, width / 2, 8, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    public getColorForJudgment(judgment: Judgment): string {
        switch (judgment) {
            case Judgment.PERFECT: return '#ff99cc'; // Sakura Pink
            case Judgment.GREAT: return '#ffcc99';  // Peach
            case Judgment.GOOD: return '#99ffcc';   // Mint
            case Judgment.MISS: return '#cc99ff';   // Soft Purple
            default: return '#ffffff';
        }
    }

    public renderHitEffect(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        laneWidth: number,
        judgment: Judgment,
        t: number
    ): void {
        const ease = 1 - Math.pow(t, 1.5);
        const sparkCount = 12; // Far fewer for clarity

        ctx.save();
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';

        // 1. Magic Circle Flash (Ultra Glowing Pink)
        if (t < 0.4) {
            const mAlpha = (1 - t / 0.4) * 0.9;
            const mSize = laneWidth * (0.4 + t * 1.5);
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(t * Math.PI);
            ctx.strokeStyle = `rgba(255, 209, 232, ${mAlpha})`; // Ultra Light Pink
            ctx.lineWidth = 4; // Thicker for clarity
            ctx.beginPath(); ctx.arc(0, 0, mSize, 0, Math.PI * 2); ctx.stroke();

            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2;
                if (i === 0) ctx.moveTo(Math.cos(a) * mSize, Math.sin(a) * mSize);
                else ctx.lineTo(Math.cos(a) * mSize, Math.sin(a) * mSize);
            }
            ctx.closePath(); ctx.stroke();
            ctx.restore();
        }

        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < sparkCount; i++) {
            const seed = (i * 123.45) % 1;

            const baseAngle = (i / sparkCount) * Math.PI * 2;
            const swirl = t * Math.PI * 4.5;
            const radius = laneWidth * (0.2 + (i % 5) * 0.25) * (0.5 + t * 2.0);
            
            const sx = x + Math.cos(baseAngle + swirl) * radius;
            const sy = y + Math.sin(baseAngle + swirl) * radius * 0.6;

            const prevT = Math.max(0, t - 0.05);
            const prevSwirl = prevT * Math.PI * 4.5;
            const prevRadius = laneWidth * (0.2 + (i % 5) * 0.25) * (0.5 + prevT * 2.0);
            const psx = x + Math.cos(baseAngle + prevSwirl) * prevRadius;
            const psy = y + Math.sin(baseAngle + prevSwirl) * prevRadius * 0.6;

            const alpha = ease * (0.8 + seed * 0.2);
            // Smaller, capped size: base 1.5 + (0..2.5) -> Max ~4
            const currentSize = (1.5 + seed * 2.5) * ease * (0.7 + seed * 0.6);

            // Trail Line - neon glow but thinner
            ctx.strokeStyle = `rgba(255, 138, 197, ${alpha * 0.6})`; 
            ctx.lineWidth = currentSize * 0.8;
            ctx.beginPath(); ctx.moveTo(psx, psy); ctx.lineTo(sx, sy); ctx.stroke();

            // Sparkle Point - DIVERSE Colors requested
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(t * Math.PI * 25 + i); // Faster rotation
            
            const colors = [
                'rgba(255, 255, 255', // White
                'rgba(255, 209, 232', // Pink
                'rgba(200, 255, 240', // Mint
                'rgba(220, 200, 255', // Lavender
                'rgba(255, 240, 150'  // Gold
            ]; 
            ctx.fillStyle = `${colors[Math.floor(seed * colors.length)]}, ${alpha})`;

            ctx.beginPath();
            for (let j = 0; j < 8; j++) {
                const r = j % 2 === 0 ? currentSize * 2.5 : currentSize * 0.8;
                const a = (j / 8) * Math.PI * 2;
                ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            }
            ctx.closePath();
            ctx.fill();
            ctx.restore(); // CRITICAL FIX: restore context stack
        }

        // 3. Subtle Radiant Core (Small & Intense)
        const coreEase = Math.pow(ease, 2); // Faster decay
        const coreR = laneWidth * 0.45 * coreEase;
        if (coreR > 0) {
            const coreGrad = ctx.createRadialGradient(x, y, 0, x, y, coreR);
            coreGrad.addColorStop(0, `rgba(255, 255, 255, ${coreEase * 0.9})`);
            coreGrad.addColorStop(0.5, `rgba(255, 209, 232, ${coreEase * 0.75})`);
            coreGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = coreGrad;
            ctx.beginPath(); ctx.arc(x, y, coreR, 0, Math.PI * 2); ctx.fill();
        }

        ctx.restore();
    }
}
