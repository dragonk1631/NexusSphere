import { type HighwayRenderState } from '../HighwayRenderer';
import { type PerspectiveCache } from './PerspectiveCache';
import { type IThemeStrategy } from '../../themes/IThemeStrategy';
import { LANE_COLORS } from '../../constants/GameConstants';

/**
 * LaneRenderer handles the dynamic and structural lane visuals (dividers, rails, active states).
 */
export class LaneRenderer {
    private railGradient: CanvasGradient | null = null;
    private sideRailGradient: CanvasGradient | null = null;
    private activeGlowGradients: (CanvasGradient | null)[] = new Array(7).fill(null);

    /**
     * Rebuilds gradients during resize or initialization.
     */
    public onResize(ctx: CanvasRenderingContext2D, state: HighwayRenderState, theme: IThemeStrategy): void {
        const laneW = state.laneBottomWidth;
        const totalW = laneW * state.laneCount;
        const centerX = state.width / 2;

        // 1. Rail Gradient (Hit Line)
        const railGrad = ctx.createLinearGradient(centerX - totalW / 2, 0, centerX + totalW / 2, 0);
        railGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        railGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)');
        railGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        this.railGradient = railGrad;

        // 2. Side Rail Gradient (Vertical Edges)
        const sideCol = theme.getColorForJudgment(0); // Perfect color base
        const sGrad = ctx.createLinearGradient(0, state.horizonY, 0, state.bottomY);
        sGrad.addColorStop(0, 'transparent');
        sGrad.addColorStop(0.2, sideCol + '66');
        sGrad.addColorStop(0.8, sideCol + 'CC');
        sGrad.addColorStop(1, sideCol + 'FF');
        this.sideRailGradient = sGrad;

        // 3. Active Glow Gradients
        for (let i = 0; i < state.laneCount; i++) {
            const laneCol = theme.getColorForJudgment(0);
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, state.laneBottomWidth);
            g.addColorStop(0, laneCol + '44');
            g.addColorStop(1, laneCol + '00');
            this.activeGlowGradients[i] = g;
        }
    }

    /**
     * Renders lane dividers and boundaries.
     */
    public renderDividers(ctx: CanvasRenderingContext2D, state: HighwayRenderState, cache: PerspectiveCache): void {
        ctx.save();

        for (let i = 0; i <= state.laneCount; i++) {
            const topX = cache.getX(i, state.horizonY, state);
            const botX = cache.getX(i, state.bottomY, state);
            const isEdge = (i === 0 || i === state.laneCount);

            if (isEdge) {
                // PREMIUM SIDE RAIL: Multi-pass glow
                ctx.save();
                ctx.strokeStyle = this.sideRailGradient || 'white';

                // Pass 1: Outer soft glow
                ctx.lineWidth = 12;
                ctx.globalAlpha = 0.2;
                ctx.beginPath();
                ctx.moveTo(topX, state.horizonY);
                ctx.lineTo(botX, state.bottomY);
                ctx.stroke();

                // Pass 2: Inner core glow
                ctx.lineWidth = 6;
                ctx.globalAlpha = 0.5;
                ctx.stroke();

                // Pass 3: Sharp core line
                ctx.lineWidth = 2;
                ctx.globalAlpha = 1.0;
                ctx.stroke();
                ctx.restore();
            } else {
                // NORMAL DIVIDER
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(topX, state.horizonY);
                ctx.lineTo(botX, state.bottomY);
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    /**
     * Renders the hit line and pulse rails.
     */
    public renderPulseRails(ctx: CanvasRenderingContext2D, state: HighwayRenderState, cache: PerspectiveCache): void {
        const pulse = (Math.sin(state.cachedNow * 0.005) + 1) * 0.5;

        ctx.save();
        if (this.railGradient) ctx.strokeStyle = this.railGradient;
        ctx.lineWidth = 2 + pulse * 2;
        ctx.globalAlpha = 0.3 + pulse * 0.2;

        const leftX = cache.getX(0, state.hitLineY, state);
        const rightX = cache.getX(state.laneCount, state.hitLineY, state);

        ctx.beginPath();
        ctx.moveTo(leftX, state.hitLineY);
        ctx.lineTo(rightX, state.hitLineY);
        ctx.stroke();
        ctx.restore();
    }

    /**
     * Renders active lane highlights when a key is pressed.
     */
    public renderActiveLanes(ctx: CanvasRenderingContext2D, state: HighwayRenderState, cache: PerspectiveCache, inputStates: boolean[]): void {
        for (let i = 0; i < state.laneCount; i++) {
            if (!inputStates[i]) continue;

            const tlX = cache.getX(i, state.horizonY, state);
            const trX = cache.getX(i + 1, state.horizonY, state);
            const blX = cache.getX(i, state.bottomY, state);
            const brX = cache.getX(i + 1, state.bottomY, state);

            ctx.save();
            const laneCol = LANE_COLORS[i % LANE_COLORS.length][0];
            const grad = ctx.createLinearGradient(0, state.horizonY, 0, state.bottomY);
            grad.addColorStop(0, 'transparent');
            grad.addColorStop(1, laneCol + '33');

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(tlX, state.horizonY);
            ctx.lineTo(trX, state.horizonY);
            ctx.lineTo(brX, state.bottomY);
            ctx.lineTo(blX, state.bottomY);
            ctx.fill();
            ctx.restore();
        }
    }
}
