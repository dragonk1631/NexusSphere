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
        _judgment: Judgment,
        t: number
    ): void {
        const ease = 1 - Math.pow(t, 1.2);
        const petalCount = 8;
        const dustCount = 15;

        ctx.save();
        ctx.globalCompositeOperation = 'screen';

        // 1. Ethereal Petals (Soft Pink/Red)
        for (let i = 0; i < petalCount; i++) {
            const seed = (i * 0.78) % 1;
            const angle = (i / petalCount) * Math.PI * 2 + t * 2;
            const dist = laneWidth * (0.3 + t * 1.8);
            const px = x + Math.cos(angle) * dist;
            const py = y + Math.sin(angle) * dist * 0.7;

            const size = (4 + seed * 6) * ease;
            const alpha = ease * 0.8;

            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(angle + t * 5);
            ctx.fillStyle = `rgba(255, 120, 180, ${alpha})`;
            
            // Draw a soft petal shape (elliptical heart-ish)
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(-size, -size, -size * 1.5, size / 2, 0, size);
            ctx.bezierCurveTo(size * 1.5, size / 2, size, -size, 0, 0);
            ctx.fill();
            ctx.restore();
        }

        // 2. Pixie Dust (Sparkling Gold/White)
        for (let i = 0; i < dustCount; i++) {
            const seed = (i * 0.33) % 1;
            const angle = seed * Math.PI * 2;
            const dist = laneWidth * seed * 1.5 * (0.5 + t * 1.2);
            const dx = x + Math.cos(angle) * dist;
            const dy = y + Math.sin(angle) * dist * 1.2;
            
            const alpha = Math.max(0, (1 - t * 1.2)) * (0.5 + Math.sin(t * 20 + i) * 0.5);
            const dSize = (1 + seed * 2) * (1 - t);

            ctx.fillStyle = i % 2 === 0 ? `rgba(255, 230, 150, ${alpha})` : `rgba(255, 255, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(dx, dy, dSize, 0, Math.PI * 2);
            ctx.fill();
        }

        // 3. Soft Magic Glow
        const bloomR = laneWidth * 0.6 * ease;
        const bloomGrad = ctx.createRadialGradient(x, y, 0, x, y, bloomR);
        bloomGrad.addColorStop(0, `rgba(255, 210, 230, ${ease * 0.6})`);
        bloomGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = bloomGrad;
        ctx.beginPath(); ctx.arc(x, y, bloomR, 0, Math.PI * 2); ctx.fill();

        ctx.restore();
    }
}
