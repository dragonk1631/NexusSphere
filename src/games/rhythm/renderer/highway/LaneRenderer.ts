import { type HighwayRenderState } from '../HighwayRenderer';
import { type PerspectiveCache } from './PerspectiveCache';
import { type IThemeStrategy } from '../../themes/IThemeStrategy';
import { LANE_COLORS } from '../../constants/GameConstants';

/**
 * LaneRenderer handles the dynamic and structural lane visuals (dividers, rails, active states).
 */
export class LaneRenderer {
    private railGradient: CanvasGradient | null = null;
    private leftSideRailGradient: CanvasGradient | null = null;
    private rightSideRailGradient: CanvasGradient | null = null;
    private activeGlowGradients: (CanvasGradient | null)[] = new Array(7).fill(null);

    /**
     * Rebuilds gradients during resize or initialization.
     */
    public onResize(ctx: CanvasRenderingContext2D, state: HighwayRenderState, theme: IThemeStrategy): void {
        const laneW = state.laneBottomWidth;
        const totalW = laneW * state.laneCount;
        const centerX = state.width / 2;
        const leftE = centerX - totalW / 2;
        const rightE = centerX + totalW / 2;

        // 1. Rail Gradient (Hit Line)
        const railGrad = ctx.createLinearGradient(leftE, 0, rightE, 0);
        railGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        railGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)');
        railGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        this.railGradient = railGrad;

        // 2. Horizontal "Glass Bar" Gradients (Internal look - narrowed to 20px)
        const sideCol = theme.getColorForJudgment(0); // Perfect color base
        const maxBarWidth = 20;

        // Left Rail: Muted alpha for lower saturation feel
        const lGrad = ctx.createLinearGradient(leftE - maxBarWidth, 0, leftE, 0);
        lGrad.addColorStop(0, sideCol + '00');
        lGrad.addColorStop(0.4, sideCol + '44');
        lGrad.addColorStop(0.8, sideCol + '88');
        lGrad.addColorStop(1, sideCol + 'BB'); // Muted peak
        this.leftSideRailGradient = lGrad;

        // Right Rail: Muted alpha for lower saturation feel
        const rGrad = ctx.createLinearGradient(rightE, 0, rightE + maxBarWidth, 0);
        rGrad.addColorStop(0, sideCol + 'BB'); // Muted peak
        rGrad.addColorStop(0.2, sideCol + '88');
        rGrad.addColorStop(0.6, sideCol + '44');
        rGrad.addColorStop(1, sideCol + '00');
        this.rightSideRailGradient = rGrad;

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
        const { bpm, cachedNow } = state;
        // BPM Pulse calculation: 60000ms / BPM = duration of 1 beat
        const msPerBeat = 60000 / bpm;
        const beatProgress = (cachedNow % msPerBeat) / msPerBeat;
        // Ease-out pulse: sharp start, smooth fade
        const pulse = Math.pow(1 - beatProgress, 1.5);
        const sparkle = (Math.random() > 0.8 ? 1.2 : 1.0); // Subtle high-frequency jitter

        ctx.save();

        for (let i = 0; i <= state.laneCount; i++) {
            const topX = cache.getX(i, state.horizonY, state);
            const botX = cache.getX(i, state.bottomY, state);
            const isEdge = (i === 0 || i === state.laneCount);

            if (isEdge) {
                // TAPERED GEOMETRIC RAIL: Polygon-based 3D Perspective
                ctx.save();
                const isLeft = (i === 0);
                const sideDir = isLeft ? -1 : 1;
                const grad = isLeft ? this.leftSideRailGradient : this.rightSideRailGradient;

                // Perspective Widths (Subtler: 20px -> 8px)
                const botBarW = (20 + pulse * 6);
                const topBarW = (8 + pulse * 3);

                const outerTopX = topX + topBarW * sideDir;
                const outerBotX = botX + botBarW * sideDir;

                // 1. Tapered Geometric Rail (Internal Glow Fill - Lower Intensity)
                if (grad) {
                    ctx.fillStyle = grad;
                    ctx.globalAlpha = 0.5 + pulse * 0.3; // Muted overall
                    ctx.beginPath();
                    ctx.moveTo(topX, state.horizonY);
                    ctx.lineTo(outerTopX, state.horizonY);
                    ctx.lineTo(outerBotX, state.bottomY);
                    ctx.lineTo(botX, state.bottomY);
                    ctx.closePath();
                    ctx.fill();
                }

                // 2. Sharp "Inner Edge" Outline
                ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 + pulse * 0.2})`;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(topX, state.horizonY);
                ctx.lineTo(botX, state.bottomY);
                ctx.stroke();

                // 3. Tapered Specular Core (Subtler Glass Effect)
                ctx.strokeStyle = '#ffffff';
                ctx.globalAlpha = 0.15 * (0.5 + pulse * 0.5);
                ctx.lineWidth = 4 + pulse * 2;

                const coreTopX = topX + (topBarW / 2) * sideDir;
                const coreBotX = botX + (botBarW / 2) * sideDir;

                ctx.beginPath();
                ctx.moveTo(coreTopX, state.horizonY);
                ctx.lineTo(coreBotX, state.bottomY);
                ctx.stroke();

                ctx.restore();
            } else {
                // NORMAL DIVIDER - Keep very subtle for performance
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
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

            // Ultra-High-Intensity Hotspot Gradient
            grad.addColorStop(0, 'transparent');
            grad.addColorStop(0.75, laneCol + '33'); // Ambient
            grad.addColorStop(0.9, laneCol + '88');  // Strong
            grad.addColorStop(1, laneCol + 'EE');   // Extreme Hotspot Peak

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(tlX, state.horizonY);
            ctx.lineTo(trX, state.horizonY);
            ctx.lineTo(brX, state.bottomY);
            ctx.lineTo(blX, state.bottomY);
            ctx.fill();

            // Stronger Additive bloom peak at the very bottom
            ctx.globalAlpha = 0.5; // Increased intensity
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            const h = (state.bottomY - state.horizonY) * 0.12; // Bottom 12% height
            ctx.moveTo(cache.getX(i, state.bottomY - h, state), state.bottomY - h);
            ctx.lineTo(cache.getX(i + 1, state.bottomY - h, state), state.bottomY - h);
            ctx.lineTo(brX, state.bottomY);
            ctx.lineTo(blX, state.bottomY);
            ctx.fill();

            ctx.restore();
        }
    }
}
