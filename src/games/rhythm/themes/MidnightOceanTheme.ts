import { BaseThemeStrategy } from './BaseThemeStrategy';
import { Judgment } from '../types/GameTypes';

export class MidnightOceanTheme extends BaseThemeStrategy {
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

    private getBubbleSprite(): HTMLCanvasElement {
        return this.getCachedSprite('midnight_bubble_premium', 64, (c, s) => {
            const bx = s / 2;
            const by = s / 2;
            const bSize = (s / 2) - 4;

            // 1. Bubble Shell (Crisp edge)
            c.beginPath();
            c.arc(bx, by, bSize, 0, Math.PI * 2);
            c.strokeStyle = 'rgba(255, 255, 255, 0.95)';
            c.lineWidth = 2.0;
            c.stroke();
            
            // 2. Translucent Fill (Depth)
            c.fillStyle = 'rgba(180, 255, 255, 0.18)';
            c.fill();
            
            // 3. Specular Highlight (Bloom)
            const hlSize = bSize * 0.45;
            const hlGrad = c.createRadialGradient(
                bx - bSize * 0.35, by - bSize * 0.35, 0,
                bx - bSize * 0.35, by - bSize * 0.35, hlSize
            );
            hlGrad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
            hlGrad.addColorStop(1, 'transparent');
            c.fillStyle = hlGrad;
            c.beginPath();
            c.arc(bx - bSize * 0.35, by - bSize * 0.35, hlSize, 0, Math.PI * 2);
            c.fill();

            // 4. Subtle Outer Rim Glow
            const rimGrad = c.createRadialGradient(bx, by, bSize * 0.8, bx, by, bSize);
            rimGrad.addColorStop(0, 'transparent');
            rimGrad.addColorStop(1, 'rgba(255, 255, 255, 0.4)');
            c.fillStyle = rimGrad;
            c.fill();
        });
    }

    public renderHitEffect(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        laneWidth: number,
        judgment: Judgment,
        t: number,
        _seed: number
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
        const bubbleCount = isPerfect ? 16 : 9;
        
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < bubbleCount; i++) {
            const seedVal = i * 123.456;
            const startX = x + (Math.sin(seedVal) * laneWidth * 0.4);
            const sway = Math.sin(t * 8 + seedVal) * 15;
            const bx = startX + sway;
            const riseSpeed = laneWidth * (isPerfect ? 2.5 : 1.6);
            const by = y - (t * riseSpeed) - (Math.cos(seedVal) * 20);
            const wobble = 1 + Math.sin(t * 12 + seedVal) * 0.1;
            const bBaseSize = (4.5 + Math.abs(Math.sin(seedVal * 2)) * 8);
            const bSize = bBaseSize * wobble * ease;
            
            ctx.globalAlpha = ease * (0.85 + Math.abs(Math.cos(seedVal)) * 0.1);
            ctx.drawImage(bubbleSprite, bx - bSize, by - bSize, bSize * 2, bSize * 2);
        }

        // 3. Core Pulse (Cached Gradient)
        const glowSize = laneWidth * 1.1 * ease;
        if (glowSize > 0) {
            const coreGrad = this.getCachedRadialGradient(ctx, 'ocean_core', 0, 0, 0, 1, [
                { offset: 0, color: 'rgba(255, 255, 255, 0.9)' },
                { offset: 0.3, color: 'rgba(100, 255, 218, 0.6)' },
                { offset: 0.6, color: 'rgba(0, 150, 200, 0.2)' },
                { offset: 1, color: 'transparent' }
            ]);

            ctx.save();
            ctx.translate(x, y);
            ctx.scale(glowSize, glowSize);
            ctx.fillStyle = coreGrad;
            ctx.globalAlpha = ease;
            ctx.beginPath();
            ctx.arc(0, 0, 1, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        ctx.restore();
    }
}
