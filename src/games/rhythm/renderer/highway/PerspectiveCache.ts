import * as PerspectiveUtils from '../PerspectiveUtils';
import { type HighwayRenderState } from '../HighwayRenderer';
import { HIGHWAY_CONFIG } from '../../constants/GameConstants';

/**
 * PerspectiveCache provides O(1) lookup for lane geometry by pre-calculating
 * width and X-coordinates across a quantized vertical range.
 */
export class PerspectiveCache {
    private widthCache: Float32Array;
    private xCache: Float32Array[];
    private resolution: number;

    constructor(resolution: number = 400) {
        this.resolution = resolution;
        this.widthCache = new Float32Array(resolution);
        this.xCache = Array.from({ length: 9 }, () => new Float32Array(resolution));
    }

    /**
     * Updates the resolution and re-allocates buffers if necessary.
     */
    public setResolution(newResolution: number): void {
        if (newResolution === this.resolution) return;
        this.resolution = newResolution;
        this.widthCache = new Float32Array(newResolution);
        for (let i = 0; i < this.xCache.length; i++) {
            this.xCache[i] = new Float32Array(newResolution);
        }
    }

    /**
     * Rebuilds the cache table based on the current highway geometry.
     */
    public build(state: HighwayRenderState): void {
        // Professionals adapt resolution to height (1 tick per 2 pixels approx)
        const targetRes = Math.max(200, Math.ceil((state.bottomY - state.horizonY) / 2));
        this.setResolution(targetRes);

        const h = state.bottomY - state.horizonY;
        if (h <= 0) return;

        for (let i = 0; i < this.resolution; i++) {
            const y = state.horizonY + (i / (this.resolution - 1)) * h;
            this.widthCache[i] = PerspectiveUtils.getPerspectiveWidth(y, state);
            for (let lane = 0; lane <= state.laneCount; lane++) {
                this.xCache[lane][i] = PerspectiveUtils.getPerspectiveX(lane, y, state);
            }
        }
    }

    /**
     * Gets the perspective width at height y.
     */
    public getWidth(y: number, state: HighwayRenderState): number {
        const idx = this.getIndex(y, state);
        return this.widthCache[idx];
    }

    /**
     * Gets the perspective X coordinate for a specific lane boundary at height y.
     */
    public getX(lane: number, y: number, state: HighwayRenderState): number {
        const idx = this.getIndex(y, state);
        // Clamp lane index to safety
        const safeLane = Math.max(0, Math.min(lane, this.xCache.length - 1));
        return this.xCache[safeLane][idx];
    }

    /**
     * Gets the projected Y coordinate based on linear progress.
     */
    public getProjectedY(linearProgress: number, state: HighwayRenderState): number {
        return PerspectiveUtils.getProjectedY(
            linearProgress,
            state.horizonY,
            state.hitLineY,
            HIGHWAY_CONFIG.PERSPECTIVE_DEPTH
        );
    }

    /**
     * Quantizes a Y coordinate into a cache index.
     */
    private getIndex(y: number, state: HighwayRenderState): number {
        const h = state.bottomY - state.horizonY;
        if (h <= 0) return 0;

        const normalized = (y - state.horizonY) / h;
        return Math.max(0, Math.min(this.resolution - 1, Math.floor(normalized * (this.resolution - 1))));
    }
}
