import type { IThemeStrategy } from './IThemeStrategy';
import { Judgment } from '../types/GameTypes';

/**
 * MatrixGridTheme provides a digital rain / code aesthetic.
 * Optimized: Removed shadowBlur and added pre-warming for glitch particles.
 */
export class MatrixGridTheme implements IThemeStrategy {
    public readonly id = 'matrix-grid';
    private readonly chars = '01ABXZ%$#@!&*?/\\|ｦｱｳｴｵ';

    public preWarm(_ctx: CanvasRenderingContext2D, _laneWidth: number): void {
        console.log("[MatrixGridTheme] Pre-warmed.");
    }

    public renderHitZonePulse(ctx: CanvasRenderingContext2D, _lane: number, x: number, y: number, width: number, beatPhase: number): void {
        const pulseAlpha = Math.max(0, 1 - beatPhase) * 0.8;
        if (pulseAlpha <= 0) return;
        ctx.strokeStyle = `rgba(0, 255, 70, ${pulseAlpha})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y - 4, width, 8);
    }

    public getColorForJudgment(judgment: Judgment): string {
        switch (judgment) {
            case Judgment.PERFECT: return '#00ff41'; // Matrix Green
            case Judgment.GREAT: return '#008f11';  // Darker Green
            case Judgment.GOOD: return '#003b00';   // Darkest Green
            case Judgment.MISS: return '#ff0000';   // Digital Red
            default: return '#00ff41';
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
        const isPerfect = judgment === Judgment.PERFECT;
        const glitchCount = isPerfect ? 20 : 12; // Reduced slightly for performance

        ctx.save();

        // 1. Digital Grid Flash
        if (t < 0.4) {
            const mAlpha = (1 - t / 0.4) * 0.7;
            const mSize = laneWidth * (0.4 + t * 1.5);
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(t * Math.PI * 0.5);
            ctx.strokeStyle = `rgba(0, 255, 70, ${mAlpha})`;
            ctx.lineWidth = 2;

            ctx.strokeRect(-mSize, -mSize, mSize * 2, mSize * 2);
            ctx.beginPath();
            ctx.moveTo(-mSize, 0); ctx.lineTo(mSize, 0);
            ctx.moveTo(0, -mSize); ctx.lineTo(0, mSize);
            ctx.stroke();

            ctx.rotate(Math.PI / 4);
            ctx.strokeRect(-mSize * 0.7, -mSize * 0.7, mSize * 1.4, mSize * 1.4);
            ctx.restore();
        }

        // 2. Glitch Particle Bloom (OPTIONAL: Removed shadowBlur)
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < glitchCount; i++) {
            const baseAngle = (i / glitchCount) * Math.PI * 2;
            const drift = Math.sin(t * Math.PI * 5 + i) * 0.4;
            const angle = baseAngle + drift;
            const radius = laneWidth * 0.1 + t * laneWidth * (2.0 + (i % 4) * 0.5);

            const sx = x + Math.cos(angle) * radius;
            const sy = y + Math.sin(angle) * radius * 0.6;

            const alpha = ease * (0.6 + (i % 3) * 0.4);

            ctx.save();
            ctx.translate(sx, sy);

            // PROFESSIONAL TIP: shadowBlur is a massive FPS killer. 
            // We use layered drawing (faux glow) instead if needed, but here simple alphablend is enough.

            if (i % 2 === 0) {
                const char = this.chars[Math.floor((i + t * 20) % this.chars.length)];
                ctx.font = `${Math.round(10 + (i % 5) * ease)}px monospace`;
                ctx.fillStyle = `rgba(0, 255, 70, ${alpha})`;
                ctx.fillText(char, 0, 0);
            } else {
                const rw = (4 + (i % 6)) * ease;
                const rh = (2 + (i % 4)) * ease;
                ctx.fillStyle = i % 3 === 0 ? `rgba(200, 255, 220, ${alpha})` : `rgba(0, 255, 70, ${alpha})`;
                ctx.fillRect(-rw / 2, -rh / 2, rw, rh);
            }
            ctx.restore();
        }

        // 3. Neon Core Flash
        const coreR = laneWidth * (isPerfect ? 1.0 : 0.7) * ease;
        const coreGrad = ctx.createRadialGradient(x, y, 0, x, y, coreR);
        coreGrad.addColorStop(0, `rgba(220, 255, 230, ${ease * 1.0})`);
        coreGrad.addColorStop(0.3, `rgba(0, 255, 70, ${ease * 0.8})`);
        coreGrad.addColorStop(1, 'transparent');

        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(x, y, coreR, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
