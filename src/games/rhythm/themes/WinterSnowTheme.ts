import type { IThemeStrategy } from './IThemeStrategy';
import { Judgment } from '../types/GameTypes';

export class WinterSnowTheme implements IThemeStrategy {
    public readonly id = 'winter-snow';

    public renderHitZonePulse(ctx: CanvasRenderingContext2D, _lane: number, x: number, y: number, width: number, beatPhase: number): void {
        const pulseAlpha = Math.max(0, 1 - beatPhase) * 0.6;
        if (pulseAlpha <= 0) return;
        ctx.fillStyle = `rgba(224, 247, 250, ${pulseAlpha})`;
        ctx.fillRect(x, y - 2, width, 4);
    }

    public getColorForJudgment(judgment: Judgment): string {
        switch (judgment) {
            case Judgment.PERFECT: return '#e0ffff';
            case Judgment.GREAT: return '#afeeee';
            case Judgment.GOOD: return '#7fffd4';
            case Judgment.MISS: return '#40e0d0';
            default: return '#ffffff';
        }
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
        const ease = 1 - Math.pow(t, 1.4);
        const outEase = 1 - Math.pow(t, 3);
        const isPerfect = judgment === Judgment.PERFECT;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // 1. Expanding Snowflake Bloom (Static orientation, like a concentric wave)
        const snowflakeCount = isPerfect ? 3 : 2;
        const baseR = laneWidth * 0.45;

        for (let j = 0; j < snowflakeCount; j++) {
            const progress = Math.pow(Math.max(0, t - j * 0.12), 0.7);
            if (progress >= 1.0) continue;

            const r = baseR + progress * laneWidth * 1.6;
            const alpha = (1 - progress) * 0.7;

            ctx.save();
            ctx.translate(x, y);
            // No rotation - keep it steady and natural like a frozen bloom
            
            // a. Prism Glow (Cyan glow)
            ctx.strokeStyle = `rgba(178, 235, 242, ${alpha * 0.4})`;
            ctx.lineWidth = 10 * ease;
            this.drawSnowflake(ctx, 0, 0, r);
            
            // b. Main Structure (White core)
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.lineWidth = 2.5 * ease;
            this.drawSnowflake(ctx, 0, 0, r);
            
            ctx.restore();
        }

        // 2. Fragmented Ice Core (Hexagonal Structure)
        const coreR = baseR * 0.5 * outEase;
        ctx.fillStyle = `rgba(224, 247, 250, ${outEase * 0.7})`;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
            ctx.lineTo(x + Math.cos(a) * coreR, y + Math.sin(a) * coreR);
        }
        ctx.closePath();
        ctx.fill();
        
        // Inner core stroke
        ctx.strokeStyle = `rgba(255, 255, 255, ${outEase})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 3. Ambient Frost "Shards" (Expanding slowly)
        if (isPerfect) {
            const pCount = 10;
            for (let i = 0; i < pCount; i++) {
                const angle = (i / pCount) * Math.PI * 2 + (i % 2 === 0 ? t : -t) * 0.5;
                const dist = laneWidth * 0.9 * (0.2 + t * 1.8);
                const px = x + Math.cos(angle) * dist;
                const py = y + Math.sin(angle) * dist;
                const pSize = (4 + (i % 3) * 2) * ease;
                
                ctx.save();
                ctx.translate(px, py);
                // Subtle individual rotation for shards is okay, but hit core stays static
                ctx.rotate(angle + t * 2); 
                ctx.strokeStyle = `rgba(255, 255, 255, ${ease * 0.5})`;
                ctx.lineWidth = 1;
                this.drawSnowflake(ctx, 0, 0, pSize);
                ctx.restore();
            }
        }

        ctx.restore();
    }

    private drawSnowflake(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            
            // Main arm
            ctx.moveTo(x, y);
            ctx.lineTo(x + cos * r, y + sin * r);
            
            // 1. Outer branches (V-shape)
            const b1Pos = r * 0.72;
            const b1Size = r * 0.28;
            ctx.moveTo(x + cos * b1Pos, y + sin * b1Pos);
            ctx.lineTo(x + Math.cos(angle - 0.75) * (b1Pos + b1Size), y + Math.sin(angle - 0.75) * (b1Pos + b1Size));
            ctx.moveTo(x + cos * b1Pos, y + sin * b1Pos);
            ctx.lineTo(x + Math.cos(angle + 0.75) * (b1Pos + b1Size), y + Math.sin(angle + 0.75) * (b1Pos + b1Size));

            // 2. Inner branches (Simple ticks)
            const b2Pos = r * 0.42;
            const b2Size = r * 0.18;
            ctx.moveTo(x + cos * b2Pos, y + sin * b2Pos);
            ctx.lineTo(x + Math.cos(angle - 0.8) * (b2Pos + b2Size), y + Math.sin(angle - 0.8) * (b2Pos + b2Size));
            ctx.moveTo(x + cos * b2Pos, y + sin * b2Pos);
            ctx.lineTo(x + Math.cos(angle + 0.8) * (b2Pos + b2Size), y + Math.sin(angle + 0.8) * (b2Pos + b2Size));
        }
        ctx.stroke();
    }
}
