import type { IThemeStrategy } from './IThemeStrategy';
import { Judgment } from '../types/GameTypes';

interface RGB {
    r: number;
    g: number;
    b: number;
}

/**
 * VaporwaveTheme provides a retro-80s aesthetic with pinks, purples, and sun gradients.
 * Optimized with pre-calculated color values to avoid hex-to-rgb overhead in hit effects.
 */
export class VaporwaveTheme implements IThemeStrategy {
    public readonly id = 'vaporwave';
    private colorCache: Map<string, RGB> = new Map();

    constructor() {
        // Pre-cache primary theme colors
        this.cacheColor('#FF71CE');
        this.cacheColor('#01CDFE');
        this.cacheColor('#05FFA1');
        this.cacheColor('#FFFB96');
    }

    private cacheColor(hex: string): RGB {
        const rgb = hex.replace('#', '');
        const r = parseInt(rgb.substring(0, 2), 16);
        const g = parseInt(rgb.substring(2, 4), 16);
        const b = parseInt(rgb.substring(4, 6), 16);
        const val = { r, g, b };
        this.colorCache.set(hex, val);
        return val;
    }

    private getRGB(hex: string): RGB {
        return this.colorCache.get(hex) || this.cacheColor(hex);
    }

    public preWarm(_ctx: CanvasRenderingContext2D, _laneWidth: number): void {
        // Warm up common color lookups
        this.getRGB('#FF71CE');
        this.getRGB('#01CDFE');
        this.getRGB('#05FFA1');
        this.getRGB('#FFFB96');
        console.log("[VaporwaveTheme] Pre-warmed color cache.");
    }

    public renderHitZonePulse(ctx: CanvasRenderingContext2D, _lane: number, x: number, y: number, width: number, beatPhase: number): void {
        const pulseAlpha = Math.max(0, 1 - beatPhase) * 0.6;
        if (pulseAlpha <= 0) return;

        ctx.save();
        ctx.fillStyle = `rgba(255, 0, 255, ${pulseAlpha})`;
        ctx.fillRect(x, y - 5, width, 10);
        ctx.restore();
    }

    public getColorForJudgment(judgment: Judgment): string {
        switch (judgment) {
            case Judgment.PERFECT: return '#00ffcc'; // Neon Cyan
            case Judgment.GREAT: return '#ff71ce';  // Pink
            case Judgment.GOOD: return '#b967ff';   // Purple
            case Judgment.MISS: return '#ff0000';
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
        const ease = 1 - Math.pow(t, 1.8);
        const isPerfect = judgment === Judgment.PERFECT;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // 1. Vaporwave prism rings (3-color layered) using PRE-CALCULATED RGB
        const hexColors = ['#FF71CE', '#01CDFE', '#05FFA1', '#FFFB96'];
        const ringCount = isPerfect ? 4 : 3;
        for (let i = 0; i < ringCount; i++) {
            const delay = i * 0.12;
            const lt = Math.max(0, t - delay);
            if (lt <= 0) continue;
            const ringEase = 1 - lt;
            const r = laneWidth * (0.15 + lt * 1.8);

            const rgb = this.getRGB(hexColors[i % hexColors.length]);

            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${ringEase * 0.8})`;
            ctx.lineWidth = 3 * ringEase;
            ctx.stroke();
        }

        // 2. CRT Scanline flash (horizontal bands at center, quick fade)
        if (t < 0.4) {
            const scanAlpha = (0.4 - t) / 0.4 * 0.5;
            const scanW = laneWidth * 2.5;
            ctx.globalCompositeOperation = 'source-over';
            for (let i = -3; i <= 3; i++) {
                const sy = y + i * 5;
                ctx.fillStyle = `rgba(255, 113, 206, ${scanAlpha * (1 - Math.abs(i) * 0.2)})`;
                ctx.fillRect(x - scanW / 2, sy - 1, scanW, 2);
            }
            ctx.globalCompositeOperation = 'lighter';
        }

        // 3. Core gradient flash
        const coreR = laneWidth * 0.5 * ease;
        const coreGrad = ctx.createRadialGradient(x, y, 0, x, y, coreR);
        coreGrad.addColorStop(0, `rgba(255, 251, 150, ${ease * 0.95})`);
        coreGrad.addColorStop(0.5, `rgba(255, 113, 206, ${ease * 0.5})`);
        coreGrad.addColorStop(1, 'rgba(1, 205, 254, 0)');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(x, y, coreR, 0, Math.PI * 2);
        ctx.fill();

        // 4. Split prism lines for PERFECT
        if (isPerfect) {
            const prismHex = ['#FF71CE', '#01CDFE', '#FFFB96'];
            const offsets = [-3, 0, 3];
            for (let i = 0; i < 3; i++) {
                const pr = laneWidth * (0.25 + ease * 1.6);
                const rgb = this.getRGB(prismHex[i]);
                ctx.beginPath();
                ctx.arc(x + offsets[i], y, pr, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${ease * 0.4})`;
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
        }

        ctx.restore();
    }
}
