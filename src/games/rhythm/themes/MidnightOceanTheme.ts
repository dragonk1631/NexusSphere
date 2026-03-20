import type { IThemeStrategy } from './IThemeStrategy';
import { Judgment } from '../types/GameTypes';

export class MidnightOceanTheme implements IThemeStrategy {
    public readonly id = 'midnight-ocean';

    public renderHitZonePulse(ctx: CanvasRenderingContext2D, _lane: number, x: number, y: number, width: number, beatPhase: number): void {
        const pulseAlpha = Math.max(0, 1 - beatPhase) * 0.6;
        if (pulseAlpha <= 0) return;
        ctx.fillStyle = `rgba(191, 219, 56, ${pulseAlpha})`;
        ctx.fillRect(x, y - 2, width, 4);
    }

    public getColorForJudgment(judgment: Judgment): string {
        switch (judgment) {
            case Judgment.PERFECT: return '#cce0ff';
            case Judgment.GREAT: return '#a1c4fd';
            case Judgment.GOOD: return '#66a6ff';
            case Judgment.MISS: return '#ff6b6b';
            default: return '#ffffff';
        }
    }

    private static bubbleSprite: HTMLCanvasElement | null = null;

    private getBubbleSprite(): HTMLCanvasElement {
        if (MidnightOceanTheme.bubbleSprite) return MidnightOceanTheme.bubbleSprite;
        
        const s = 64;
        const canvas = document.createElement('canvas');
        canvas.width = s;
        canvas.height = s;
        const c = canvas.getContext('2d')!;
        
        // High-Fidelity Professional Bubble Style
        const bx = s / 2;
        const by = s / 2;
        const bSize = (s / 2) - 4;

        c.beginPath();
        c.arc(bx, by, bSize, 0, Math.PI * 2);
        
        // 1. Sharp white outline
        c.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        c.lineWidth = 2.0;
        c.stroke();
        
        // 2. Very subtle cyan glow inside
        c.fillStyle = 'rgba(180, 255, 255, 0.15)';
        c.fill();
        
        // 3. Prominent highlight dot (top-left)
        const hlSize = bSize * 0.4;
        const hlGrad = c.createRadialGradient(
            bx - bSize * 0.35, by - bSize * 0.35, 0,
            bx - bSize * 0.35, by - bSize * 0.35, hlSize
        );
        hlGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        hlGrad.addColorStop(1, 'transparent');
        c.fillStyle = hlGrad;
        c.beginPath();
        c.arc(bx - bSize * 0.35, by - bSize * 0.35, hlSize, 0, Math.PI * 2);
        c.fill();

        MidnightOceanTheme.bubbleSprite = canvas;
        return canvas;
    }

    public renderHitEffect(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        laneWidth: number,
        judgment: Judgment,
        t: number
    ): void {
        const ease = 1 - Math.pow(t, 2);
        const isPerfect = judgment === Judgment.PERFECT;

        ctx.save();

        // 1. Optimized Ripples
        const rippleCount = isPerfect ? 3 : 2;
        ctx.lineWidth = 2.5;
        for (let i = 0; i < rippleCount; i++) {
            const delay = i * 0.12;
            const lt = Math.max(0, t - delay);
            if (lt <= 0) continue;
            
            const ripEase = 1 - Math.pow(lt, 2);
            const radius = laneWidth * 0.5 * (1 + lt * 2.5);

            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(100, 255, 218, ${ripEase * (0.8 - i * 0.25)})`;
            ctx.stroke();
        }

        // 2. Sprite-Based Bubbles (High Performance)
        const bubbleSprite = this.getBubbleSprite();
        const bubbleCount = isPerfect ? 16 : 9; // Reduced count for cleaner look
        
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < bubbleCount; i++) {
            const seed = i * 123.456;
            const startX = x + (Math.sin(seed) * laneWidth * 0.4);
            const sway = Math.sin(t * 8 + seed) * 15;
            const bx = startX + sway;
            
            // Reduced rise speed and height as requested
            const riseSpeed = laneWidth * (isPerfect ? 2.5 : 1.6);
            const by = y - (t * riseSpeed) - (Math.cos(seed) * 20);
            
            const wobble = 1 + Math.sin(t * 12 + seed) * 0.1;
            const bBaseSize = (4.5 + Math.abs(Math.sin(seed * 2)) * 8); // 4.5 ~ 12.5px
            const bSize = bBaseSize * wobble * ease;
            
            ctx.globalAlpha = ease * (0.85 + Math.abs(Math.cos(seed)) * 0.1);
            ctx.drawImage(bubbleSprite, bx - bSize, by - bSize, bSize * 2, bSize * 2);
        }

        // 3. Core Pulse
        const glowSize = laneWidth * 1.1 * ease;
        const coreGrad = ctx.createRadialGradient(x, y, 0, x, y, glowSize);
        coreGrad.addColorStop(0, `rgba(255, 255, 255, 0.9)`);
        coreGrad.addColorStop(0.3, `rgba(100, 255, 218, 0.6)`);
        coreGrad.addColorStop(0.6, `rgba(0, 150, 200, 0.2)`);
        coreGrad.addColorStop(1, 'transparent');

        ctx.globalAlpha = ease;
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(x, y, glowSize, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
