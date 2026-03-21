import type { IThemeStrategy } from './IThemeStrategy';
import { Judgment } from '../types/GameTypes';

export class CrimsonFlareTheme implements IThemeStrategy {
    public readonly id = 'crimson-flare';

    public renderHitZonePulse(ctx: CanvasRenderingContext2D, _lane: number, x: number, y: number, width: number, beatPhase: number): void {
        const pulseAlpha = Math.max(0, 1 - beatPhase) * 0.8;
        if (pulseAlpha <= 0) return;
        const grad = ctx.createLinearGradient(x, y - 5, x, y + 5);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(0.5, `rgba(255, 100, 0, ${pulseAlpha})`);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(x, y - 5, width, 10);
    }

    public getColorForJudgment(judgment: Judgment): string {
        switch (judgment) {
            case Judgment.PERFECT: return '#ffaa00';
            case Judgment.GREAT: return '#ff5500';
            case Judgment.GOOD: return '#aa2200';
            case Judgment.MISS: return '#550000';
            default: return '#ffaa00';
        }
    }

    private static dropletSprite: HTMLCanvasElement | null = null;

    private getDropletSprite(): HTMLCanvasElement {
        if (CrimsonFlareTheme.dropletSprite) return CrimsonFlareTheme.dropletSprite;
        
        const s = 48; // Size for the sprite
        const canvas = document.createElement('canvas');
        canvas.width = s;
        canvas.height = s;
        const c = canvas.getContext('2d')!;
        
        const cx = s / 2;
        const cy = s / 2;
        const radius = (s / 2) - 2;

        const grad = c.createRadialGradient(cx, cy, 0, cx, cy, radius);
        grad.addColorStop(0, 'rgba(255, 240, 150, 1.0)'); // White-hot core
        grad.addColorStop(0.4, 'rgba(255, 100, 0, 0.8)'); // Bright orange
        grad.addColorStop(0.7, 'rgba(200, 20, 0, 0.3)');  // Deep red glow
        grad.addColorStop(1, 'rgba(150, 0, 0, 0)');
        
        c.fillStyle = grad;
        c.beginPath();
        c.arc(cx, cy, radius, 0, Math.PI * 2);
        c.fill();

        CrimsonFlareTheme.dropletSprite = canvas;
        return canvas;
    }

    /**
     * Lava Eruption: Crimson/ember droplets arc upward in a fountain then fall
     * due to gravity, with a searing blast ring at impact point.
     */
    public renderHitEffect(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        laneWidth: number,
        judgment: Judgment,
        t: number,
        seed: number // Added seed parameter
    ): void {
        const ease = 1 - Math.pow(t, 2);
        const isPerfect = judgment === Judgment.PERFECT;
        const dropCount = isPerfect ? 12 : 8;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // 1. Lava droplets: Upward random movement (Ember-style)
        const sprite = this.getDropletSprite();
        for (let i = 0; i < dropCount; i++) {
            // Incorporate the global hit seed into the per-particle seed
            const pSeed = i * 123.456 + seed * 678.910;
            const randVX = (Math.sin(pSeed) * 2 - 1) * 0.4; // Initial horizontal spread
            const upwardSpeed = 1.8 + Math.abs(Math.cos(pSeed)) * 2.2; // 1.8 to 4.0
            const swayAmp = Math.sin(pSeed * 2) * 25; // Sway amplitude
            const swayFreq = 10 + Math.cos(pSeed) * 3; // Sway frequency

            const dt = t * 1.2; 
            const px = x + (randVX * laneWidth) + (Math.sin(t * swayFreq + pSeed) * swayAmp * t);
            const py = y - (dt * upwardSpeed * laneWidth * 1.1);

            if (py < -50) continue; // Skip if off-screen top

            const dropAlpha = ease * (0.95 - Math.abs(randVX) * 0.2);
            const dropSize = (3 + Math.abs(Math.sin(pSeed)) * 5) * ease;

            ctx.globalAlpha = dropAlpha;
            ctx.drawImage(sprite, px - dropSize * 2, py - dropSize * 2, dropSize * 4, dropSize * 4);
        }
        ctx.globalAlpha = 1.0;

        // 2. Blast shockwave ring
        const blastR = laneWidth * (0.1 + t * 2.4);
        const blastGrad = ctx.createRadialGradient(x, y, blastR * 0.85, x, y, blastR);
        blastGrad.addColorStop(0, `rgba(255, 120, 0, ${ease * 0.6})`);
        blastGrad.addColorStop(1, 'rgba(180, 0, 0, 0)');
        ctx.fillStyle = blastGrad;
        ctx.beginPath();
        ctx.arc(x, y, blastR, 0, Math.PI * 2);
        ctx.fill();

        // 3. Blazing core - Slightly more vibrant to stand out against background
        const coreR = laneWidth * 0.5 * ease;
        const coreGrad = ctx.createRadialGradient(x, y, 0, x, y, coreR);
        coreGrad.addColorStop(0, `rgba(255, 255, 220, ${ease * 1.0})`); // Whiter core
        coreGrad.addColorStop(0.3, `rgba(255, 200, 0, ${ease * 0.8})`); // Brighter yellow/orange
        coreGrad.addColorStop(0.8, `rgba(220, 50, 0, ${ease * 0.4})`);
        coreGrad.addColorStop(1, 'rgba(100, 0, 0, 0)');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(x, y, coreR, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
