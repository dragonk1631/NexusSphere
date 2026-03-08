import * as UIUtils from '../UIUtils';
import { type HighwayRenderState } from '../HighwayRenderer';
import { type PerspectiveCache } from './PerspectiveCache';

/**
 * HighwayBackgroundRenderer handles the "road" itself and the ambient atmosphere.
 */
export class HighwayBackgroundRenderer {
    private roadGradient: CanvasGradient | null = null;

    /**
     * Caches gradients on resize to prevent per-frame allocation.
     */
    public onResize(ctx: CanvasRenderingContext2D, state: HighwayRenderState): void {
        const roadGrad = ctx.createLinearGradient(0, state.horizonY, 0, state.bottomY);
        roadGrad.addColorStop(0, 'rgba(10, 10, 30, 0.4)');
        roadGrad.addColorStop(1, 'rgba(5, 5, 20, 0.9)');
        this.roadGradient = roadGrad;
    }

    /**
     * Renders the atmospheric background and the main highway road.
     */
    public render(ctx: CanvasRenderingContext2D, state: HighwayRenderState, cache: PerspectiveCache): void {
        // 1. Atmosphere (Skip on mobile for performance)
        if (!state.isMobile) {
            const pulse = (Math.sin(state.cachedNow / 300) + 1) * 0.5;
            ctx.save();
            ctx.globalAlpha = 0.4 + pulse * 0.1;
            UIUtils.drawAtmosphere(ctx, state.width, state.height);
            ctx.restore();
        }

        // 2. Render Road
        if (this.roadGradient) {
            const tlX = cache.getX(0, state.horizonY, state);
            const trX = cache.getX(state.laneCount, state.horizonY, state);
            const blX = cache.getX(0, state.bottomY, state);
            const brX = cache.getX(state.laneCount, state.bottomY, state);

            ctx.fillStyle = this.roadGradient;
            ctx.beginPath();
            ctx.moveTo(tlX, state.horizonY);
            ctx.lineTo(trX, state.horizonY);
            ctx.lineTo(brX, state.bottomY);
            ctx.lineTo(blX, state.bottomY);
            ctx.fill();
        }
    }
}
