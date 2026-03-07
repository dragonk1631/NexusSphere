import type { IThemeStrategy } from './IThemeStrategy';

export class MarchenTheme implements IThemeStrategy {
    public readonly id = 'marchen';

    public renderHitZonePulse(ctx: CanvasRenderingContext2D, _lane: number, x: number, y: number, width: number, beatPhase: number): void {
        const pulseAlpha = Math.max(0, 1 - beatPhase) * 0.5;
        if (pulseAlpha <= 0) return;
        ctx.fillStyle = `rgba(249, 168, 212, ${pulseAlpha})`;
        ctx.beginPath();
        ctx.ellipse(x + width / 2, y, width / 2, 8, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    public getColorForJudgment(judgment: string): string {
        switch (judgment) {
            case 'PERFECT': return '#F9A8D4';
            case 'GREAT': return '#f8c8da';
            case 'GOOD': return '#ce93d8';
            case 'MISS': return '#880e4f';
            default: return '#F9A8D4';
        }
    }

    /**
     * Enhanced Fairy Bloom: Adds a magic circle flash at the core, 
     * increases stardust particle count and density for a punchier feel.
     */
    public renderHitEffect(ctx: CanvasRenderingContext2D, x: number, y: number, laneWidth: number, judgment: string, t: number): void {
        const ease = 1 - Math.pow(t, 1.5);
        const isPerfect = judgment === 'PERFECT';
        const sparkCount = isPerfect ? 24 : 16; // Increased density

        ctx.save();

        // 1. Magic Circle Flash (Core Impact)
        if (t < 0.4) {
            const mAlpha = (1 - t / 0.4) * 0.7;
            const mSize = laneWidth * (0.4 + t * 1.5);
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(t * Math.PI);
            ctx.strokeStyle = `rgba(255, 200, 230, ${mAlpha})`;
            ctx.lineWidth = 2;
            // Draw a basic magic circle (ring + hex)
            ctx.beginPath();
            ctx.arc(0, 0, mSize, 0, Math.PI * 2);
            ctx.stroke();

            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2;
                const px = Math.cos(a) * mSize;
                const py = Math.sin(a) * mSize;
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.stroke();
            ctx.restore();
        }

        // 2. High-density Fairy Stardust
        for (let i = 0; i < sparkCount; i++) {
            const baseAngle = (i / sparkCount) * Math.PI * 2 + (i % 2) * 0.2;
            const drift = Math.sin(t * Math.PI * 3 + i) * 0.5;
            const angle = baseAngle + drift;
            const radius = laneWidth * 0.15 + t * laneWidth * (2.2 + (i % 5) * 0.4);

            const sx = x + Math.cos(angle) * radius;
            const sy = y + Math.sin(angle) * radius * 0.5 - t * laneWidth * 0.6;

            const alpha = ease * (0.7 + (i % 3) * 0.3);
            const size = (2.5 + (i % 4)) * ease;

            const colors = ['rgba(249, 168, 212', 'rgba(206, 147, 216', 'rgba(255, 220, 240'];
            const color = colors[i % colors.length];

            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(t * Math.PI * 6 + i);
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = `${color}, ${alpha})`;
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#F9A8D4';

            ctx.beginPath();
            for (let j = 0; j < 8; j++) {
                const r = j % 2 === 0 ? size * 2.2 : size * 0.8;
                const a = (j / 8) * Math.PI * 2;
                ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            }
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        // 3. Radiant Pink Core
        const coreR = laneWidth * (isPerfect ? 0.9 : 0.6) * ease;
        const coreGrad = ctx.createRadialGradient(x, y, 0, x, y, coreR);
        coreGrad.addColorStop(0, `rgba(255, 255, 255, ${ease * 1.0})`);
        coreGrad.addColorStop(0.4, `rgba(249, 168, 212, ${ease * 0.7})`);
        coreGrad.addColorStop(1, 'transparent');

        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(x, y, coreR, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
