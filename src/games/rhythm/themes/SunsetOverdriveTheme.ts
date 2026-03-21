import type { IThemeStrategy } from './IThemeStrategy';
import { Judgment } from '../types/GameTypes';

export class SunsetOverdriveTheme implements IThemeStrategy {
    public readonly id = 'sunset-overdrive';

    public renderHitZonePulse(ctx: CanvasRenderingContext2D, _lane: number, x: number, y: number, width: number, beatPhase: number): void {
        const pulseAlpha = Math.max(0, 1 - beatPhase) * 0.7;
        if (pulseAlpha <= 0) return;
        ctx.fillStyle = `rgba(227, 193, 161, ${pulseAlpha})`;
        ctx.fillRect(x, y - 2, width, 4);
    }

    public getColorForJudgment(judgment: Judgment): string {
        switch (judgment) {
            case Judgment.PERFECT: return '#ffaa00';
            case Judgment.GREAT: return '#ff6600';
            case Judgment.GOOD: return '#cc3300';
            case Judgment.MISS: return '#661100';
            default: return '#ffaa00';
        }
    }

    public preWarm(_ctx: CanvasRenderingContext2D, _laneWidth: number): void {
        console.log("[SunsetOverdriveTheme] Pre-warmed.");
    }

    /**
     * High-Quality Procedural Hit Effect:
     * Features concentric shockwaves, solar flares, and sunset dust.
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
        const isPerfect = judgment === Judgment.PERFECT;
        const colorMain = '#E3C1A1'; // Luminous Gold
        const colorAccent = '#8E4A42'; // Rose Crimson
        
        const easeOut = 1 - Math.pow(1 - t, 3);
        const easeIn = t * t;
        const opacity = 1 - Math.pow(t, 2);

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // 1. Concentric Shockwaves (Expanding Rings)
        const ringCount = isPerfect ? 2 : 1;
        for (let i = 0; i < ringCount; i++) {
            const ringT = Math.max(0, t - i * 0.1);
            if (ringT <= 0 || ringT >= 1) continue;
            
            const ringEase = 1 - Math.pow(1 - ringT, 2);
            const radius = laneWidth * (1.0 + ringEase * 2.5);
            const ringOpacity = (1 - ringT) * 0.6;
            
            ctx.strokeStyle = i === 0 ? this.applyAlpha(colorMain, Math.floor(ringOpacity * 255).toString(16).padStart(2, '0')) 
                                     : this.applyAlpha(colorAccent, Math.floor(ringOpacity * 255 * 0.7).toString(16).padStart(2, '0'));
            ctx.lineWidth = 3 * (1 - ringT);
            
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.stroke();
            
            // Subtle glow fill for the first ring
            if (i === 0) {
                ctx.fillStyle = this.applyAlpha(colorMain, Math.floor(ringOpacity * 40).toString(16).padStart(2, '0'));
                ctx.fill();
            }
        }

        // 2. Solar Flares (Ray bursts)
        if (isPerfect || judgment === Judgment.GREAT) {
            const flareCount = isPerfect ? 12 : 8;
            const flareLen = laneWidth * (0.8 + easeOut * 1.5);
            ctx.lineWidth = 2 * opacity;
            
            for (let i = 0; i < flareCount; i++) {
                const angle = (i / flareCount) * Math.PI * 2 + t * 0.5;
                const lx = Math.cos(angle);
                const ly = Math.sin(angle);
                
                const grad = ctx.createLinearGradient(x, y, x + lx * flareLen, y + ly * flareLen);
                grad.addColorStop(0, this.applyAlpha(colorMain, 'aa'));
                grad.addColorStop(1, 'transparent');
                
                ctx.strokeStyle = grad;
                ctx.beginPath();
                ctx.moveTo(x + lx * laneWidth * 0.2, y + ly * laneWidth * 0.2);
                ctx.lineTo(x + lx * flareLen, y + ly * flareLen);
                ctx.stroke();
            }
        }

        // 3. Central Glow
        const glowSize = laneWidth * (1.2 - easeIn * 0.4);
        const glowGrad = ctx.createRadialGradient(x, y, 0, x, y, glowSize);
        glowGrad.addColorStop(0, this.applyAlpha(colorMain, '88'));
        glowGrad.addColorStop(0.5, this.applyAlpha(colorAccent, '33'));
        glowGrad.addColorStop(1, 'transparent');
        
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(x, y, glowSize, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    private applyAlpha(color: string, alphaHex: string): string {
        if (color.startsWith('#')) {
            return color.substring(0, 7) + alphaHex;
        }
        return color;
    }
}
