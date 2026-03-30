import { type HighwayRenderState } from '../HighwayRenderer';
import { type PerspectiveCache } from './PerspectiveCache';
import { type IThemeStrategy } from '../../themes/IThemeStrategy';
import { LANE_COLORS, HIT_LINE_Y_RATIO } from '../../constants/GameConstants';

/**
 * LaneRenderer handles the dynamic and structural lane visuals.
 * Optimised for Mobile 60FPS: No shadowBlur, no nested texturing loops.
 */
export class LaneRenderer {
    private activeLaneGradients: (CanvasGradient | null)[] = [];

    public onResize(ctx: CanvasRenderingContext2D, state: HighwayRenderState, _theme: IThemeStrategy): void {
        this.activeLaneGradients = [];
        for (let i = 0; i < state.laneCount; i++) {
            const laneCol = LANE_COLORS[i % LANE_COLORS.length][0];
            const laneGrad = ctx.createLinearGradient(0, state.horizonY, 0, state.hitLineY + 30);
            laneGrad.addColorStop(0, 'transparent');
            laneGrad.addColorStop(0.5, 'transparent'); // Keep the top half clean
            laneGrad.addColorStop(0.9, laneCol + '44'); 
            laneGrad.addColorStop(1, laneCol + 'cc'); 
            this.activeLaneGradients.push(laneGrad);
        }
    }

    public renderDividers(ctx: CanvasRenderingContext2D, state: HighwayRenderState, cache: PerspectiveCache): void {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let i = 1; i < state.laneCount; i++) {
            const borderY = state.height * HIT_LINE_Y_RATIO;
            const topX = cache.getX(i, state.horizonY, state);
            const botX = cache.getX(i, borderY, state); // Tighter connection to footer path
            ctx.moveTo(topX, state.horizonY);
            ctx.lineTo(botX, borderY);
        }
        ctx.stroke();
        ctx.restore();
    }

    /**
     * Renders high-fidelity vertical rails that plug directly into the hardware deck.
     */
    public renderPulseRails(ctx: CanvasRenderingContext2D, state: HighwayRenderState, cache: PerspectiveCache): void {
        const pulse = (Math.sin(state.cachedNow * 0.01) + 1) * 0.5;
        const leftTopX = cache.getX(0, state.horizonY, state);
        const rightTopX = cache.getX(state.laneCount, state.horizonY, state);
        const drawContinuousFrame = () => {
            const borderY = state.height * HIT_LINE_Y_RATIO;
            
            // Corner Coordinates
            const cL_X = cache.getX(0, borderY, state) - 1.5;
            const cR_X = cache.getX(state.laneCount, borderY, state) + 1.5;

            // 1. Dark Base (10px)
            ctx.strokeStyle = '#050a14';
            ctx.lineWidth = 10;
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(leftTopX, state.horizonY);
            ctx.lineTo(cL_X, borderY);
            ctx.lineTo(cR_X, borderY);
            ctx.lineTo(rightTopX, state.horizonY);
            ctx.stroke();

            // 2. Neon Glow (6px)
            ctx.strokeStyle = `rgba(0, 180, 255, ${0.4 + pulse * 0.3})`;
            ctx.lineWidth = 6;
            ctx.stroke();

            // 3. High-Intensity Core (1.5px)
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        };

        drawContinuousFrame();
        ctx.restore();
    }

    /**
     * Renders a sleek, minimalist hardware rim for 3D depth.
     * Replaces the bulky deck with a subtle mechanical "point".
     */
    public renderHardwareDeck(_ctx: CanvasRenderingContext2D, _state: HighwayRenderState, _cache: PerspectiveCache): void {
        // Disabled per user request: "Remove black shadow/bulky frame"
    }

    public renderActiveLanes(ctx: CanvasRenderingContext2D, state: HighwayRenderState, cache: PerspectiveCache, inputStates: boolean[]): void {
        const glowH = 250; // Increased significantly for a smoother fade
        for (let i = 0; i < state.laneCount; i++) {
            if (!inputStates[i]) continue;
            const borderY = state.height * HIT_LINE_Y_RATIO;
            const blX = cache.getX(i, borderY, state);
            const brX = cache.getX(i + 1, borderY, state);
            const tlX = cache.getX(i, state.hitLineY - glowH, state);
            const trX = cache.getX(i + 1, state.hitLineY - glowH, state);

            ctx.save();
            const grad = this.activeLaneGradients[i];
            if (grad) {
                ctx.fillStyle = grad;
                ctx.globalAlpha = 0.65;
                ctx.beginPath();
                ctx.moveTo(tlX, state.hitLineY - glowH);
                ctx.lineTo(trX, state.hitLineY - glowH);
                ctx.lineTo(brX, state.hitLineY + 28);
                ctx.lineTo(blX, state.hitLineY + 28);
                ctx.fill();
            }
            ctx.restore();
        }
    }
}
