import type { IThemeStrategy } from './IThemeStrategy';
import { Judgment } from '../types/GameTypes';

export class MonochromeTechTheme implements IThemeStrategy {
    public readonly id = 'monochrome-tech';

    public renderHitZonePulse(ctx: CanvasRenderingContext2D, _lane: number, x: number, y: number, width: number, beatPhase: number): void {
        const pulseAlpha = Math.max(0, 1 - beatPhase) * 0.4;
        if (pulseAlpha <= 0) return;
        ctx.strokeStyle = `rgba(255, 255, 255, ${pulseAlpha})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y - 1, width, 2);
    }

    public getColorForJudgment(judgment: Judgment): string {
        switch (judgment) {
            case Judgment.PERFECT: return '#ffffff';
            case Judgment.GREAT: return '#aaaaaa';
            case Judgment.GOOD: return '#666666';
            case Judgment.MISS: return '#444444';
            default: return '#ffffff';
        }
    }

    /**
     * Circuit Pulse: Orthogonal (right-angle) circuit traces branch outward from
     * the hit point, blinking white — like PCB signal propagation.
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
        const ease = 1 - t;
        const outEase = 1 - Math.pow(t, 3);
        const isPerfect = judgment === Judgment.PERFECT;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // 1. Concentric Expanding Hexagons (Optimized: Multi-stroke instead of shadowBlur)
        const hexCount = isPerfect ? 3 : 2;
        const baseR = laneWidth * 0.4;
        
        for (let j = 0; j < hexCount; j++) {
            const progress = Math.pow(Math.max(0, t - j * 0.15), 0.7);
            if (progress >= 1.0) continue;
            
            const r = baseR + progress * laneWidth * 1.5;
            const alpha = (1 - progress);
            
            // Outer glow stroke (Multi-layer simulation)
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.25})`;
            ctx.lineWidth = 12 * ease;
            this.drawHex(ctx, x, y, r);
            
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
            ctx.lineWidth = 2 * ease;
            this.drawHex(ctx, x, y, r);
        }

        // 2. Fragmented Circuit Core (Hexagonal - Optimized)
        const coreR = baseR * 0.5 * outEase;
        // Simple glow using multiple fills for core
        ctx.fillStyle = `rgba(255, 255, 255, ${outEase * 0.3})`;
        this.drawHex(ctx, x, y, coreR + 4 * outEase, true);
        ctx.fillStyle = `rgba(255, 255, 255, ${outEase * 0.9})`;
        this.drawHex(ctx, x, y, coreR, true);

        // 3. Optional: Subtle PCB traces (simplified)
        if (isPerfect) {
            ctx.lineWidth = 1;
            const traceAlpha = outEase * 0.3;
            ctx.strokeStyle = `rgba(255, 255, 255, ${traceAlpha})`;
            for (let i = 0; i < 4; i++) {
                const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
                const len = laneWidth * 0.8 * outEase;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
                ctx.stroke();
            }
        }

        ctx.restore();
    }

    private drawHex(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: boolean = false): void {
        ctx.beginPath();
        for (let i = 0; i <= 6; i++) {
            const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
            const px = x + Math.cos(a) * r;
            const py = y + Math.sin(a) * r;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        if (fill) ctx.fill(); else ctx.stroke();
    }
}
