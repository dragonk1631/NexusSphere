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
        const ease = 1 - Math.pow(t, 2);
        const isPerfect = judgment === Judgment.PERFECT;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // 1. Circuit trace branches (right-angle paths)
        const branchCount = isPerfect ? 8 : 5;
        const maxReach = laneWidth * (0.4 + ease * 2.0);

        ctx.lineWidth = 1.5;

        for (let i = 0; i < branchCount; i++) {
            const angle = (i / branchCount) * Math.PI * 2;
            const branchAlpha = ease * (0.8 - i * 0.06);
            ctx.strokeStyle = `rgba(240, 240, 240, ${branchAlpha})`;

            // L-shaped circuit path: go one direction then turn 90°
            const turnPoint = maxReach * 0.45;
            const dx1 = Math.cos(angle) * turnPoint;
            const dy1 = Math.sin(angle) * turnPoint;
            // 90° turn at the elbow
            const turnAngle = angle + Math.PI / 2;
            const dx2 = dx1 + Math.cos(turnAngle) * (maxReach - turnPoint) * (0.4 + (i % 3) * 0.3);
            const dy2 = dy1 + Math.sin(turnAngle) * (maxReach - turnPoint) * (0.4 + (i % 3) * 0.3);

            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + dx1, y + dy1);
            ctx.lineTo(x + dx2, y + dy2);
            ctx.stroke();

            // Node dot at endpoint
            ctx.beginPath();
            ctx.arc(x + dx2, y + dy2, 2.5 * ease, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${branchAlpha})`;
            ctx.fill();
        }

        // 2. Expanding hexagonal grid pulse (monochrome)
        const hexR = laneWidth * (0.2 + t * 1.6);
        ctx.beginPath();
        for (let i = 0; i <= 6; i++) {
            const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
            const px = x + Math.cos(a) * hexR;
            const py = y + Math.sin(a) * hexR;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = `rgba(200, 200, 200, ${ease * 0.5})`;
        ctx.lineWidth = 1.5 * ease;
        ctx.stroke();

        // 3. White core strobe
        const coreR = laneWidth * 0.3 * ease;
        const coreGrad = ctx.createRadialGradient(x, y, 0, x, y, coreR);
        coreGrad.addColorStop(0, `rgba(255, 255, 255, ${ease * 0.95})`);
        coreGrad.addColorStop(0.5, `rgba(200, 200, 200, ${ease * 0.4})`);
        coreGrad.addColorStop(1, 'rgba(100, 100, 100, 0)');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(x, y, coreR, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
