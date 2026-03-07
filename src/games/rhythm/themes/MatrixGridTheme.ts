import type { IThemeStrategy } from './IThemeStrategy';

/**
 * MatrixGridTheme provides a digital rain / code aesthetic.
 * Now using an improved particle-based hit effect based on the Marchen structure.
 */
export class MatrixGridTheme implements IThemeStrategy {
    public readonly id = 'matrix-grid';

    public renderHitZonePulse(ctx: CanvasRenderingContext2D, _lane: number, x: number, y: number, width: number, beatPhase: number): void {
        const pulseAlpha = Math.max(0, 1 - beatPhase) * 0.8;
        if (pulseAlpha <= 0) return;
        ctx.strokeStyle = `rgba(0, 255, 70, ${pulseAlpha})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y - 4, width, 8);
    }

    public getColorForJudgment(judgment: string): string {
        switch (judgment) {
            case 'PERFECT': return '#00FF46';
            case 'GREAT': return '#00CC38';
            case 'GOOD': return '#009926';
            case 'MISS': return '#FF0000';
            default: return '#00FF46';
        }
    }

    /**
     * Matrix Glitch Bloom: Re-uses the Marchen logic but swaps artifacts 
     * for digital blocks and green code characters.
     */
    public renderHitEffect(ctx: CanvasRenderingContext2D, x: number, y: number, laneWidth: number, judgment: string, t: number): void {
        const ease = 1 - Math.pow(t, 1.5);
        const isPerfect = judgment === 'PERFECT';
        const glitchCount = isPerfect ? 24 : 16;
        const chars = '01ABXZ%$#@!&*?/\\|ｦｱｳｴｵ';

        ctx.save();

        // 1. Digital Grid Flash (Based on Marchen's Magic Circle)
        if (t < 0.4) {
            const mAlpha = (1 - t / 0.4) * 0.7;
            const mSize = laneWidth * (0.4 + t * 1.5);
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(t * Math.PI * 0.5);
            ctx.strokeStyle = `rgba(0, 255, 70, ${mAlpha})`;
            ctx.lineWidth = 2;

            // Draw a square grid-like flash
            ctx.strokeRect(-mSize, -mSize, mSize * 2, mSize * 2);
            ctx.beginPath();
            ctx.moveTo(-mSize, 0); ctx.lineTo(mSize, 0);
            ctx.moveTo(0, -mSize); ctx.lineTo(0, mSize);
            ctx.stroke();

            // Outer diamond
            ctx.rotate(Math.PI / 4);
            ctx.strokeRect(-mSize * 0.7, -mSize * 0.7, mSize * 1.4, mSize * 1.4);
            ctx.restore();
        }

        // 2. Glitch Particle Bloom (Based on Marchen's Stardust)
        for (let i = 0; i < glitchCount; i++) {
            const baseAngle = (i / glitchCount) * Math.PI * 2;
            // More erratic movement for glitch
            const drift = Math.sin(t * Math.PI * 5 + i) * 0.4;
            const angle = baseAngle + drift;
            const radius = laneWidth * 0.1 + t * laneWidth * (2.0 + (i % 4) * 0.5);

            const sx = x + Math.cos(angle) * radius;
            const sy = y + Math.sin(angle) * radius * 0.6; // Slightly flattened

            const alpha = ease * (0.6 + (i % 3) * 0.4);

            ctx.save();
            ctx.translate(sx, sy);
            ctx.globalCompositeOperation = 'lighter';
            ctx.shadowBlur = 5;
            ctx.shadowColor = '#00FF46';

            if (i % 2 === 0) {
                // Draw a code character
                const char = chars[Math.floor((i + t * 20) % chars.length)];
                ctx.font = `${Math.max(10, (10 + (i % 5)) * ease)}px monospace`;
                ctx.fillStyle = `rgba(0, 255, 70, ${alpha})`;
                ctx.fillText(char, 0, 0);
            } else {
                // Draw a glitchy rectangle
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

        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(x, y, coreR, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
