import { type HighwayRenderState } from '../HighwayRenderer';
import { type PerspectiveCache } from './PerspectiveCache';
import { type IThemeStrategy } from '../../themes/IThemeStrategy';
import { type RenderCache } from '../../graphics/RenderCache';

/**
 * ReceptorRenderer handles the hit zone receptors and the bottom occlusion mask.
 */
export class ReceptorRenderer {
    private renderCache: RenderCache;
    private groundGlowGradients: (CanvasGradient | null)[] = new Array(7).fill(null);

    constructor(renderCache: RenderCache) {
        this.renderCache = renderCache;
    }

    /**
     * Rebuilds glow gradients on resize.
     */
    public onResize(ctx: CanvasRenderingContext2D, state: HighwayRenderState, theme: IThemeStrategy): void {
        const laneW = state.laneBottomWidth;
        for (let i = 0; i < state.laneCount; i++) {
            const laneCol = theme.getColorForJudgment(0); // Perfect color as base
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, laneW * 0.8);
            g.addColorStop(0, laneCol + '66');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            this.groundGlowGradients[i] = g;
        }
    }

    /**
     * Renders all receptors and the final occlusion mask.
     */
    public render(ctx: CanvasRenderingContext2D, state: HighwayRenderState, cache: PerspectiveCache, inputStates: boolean[]): void {
        const hitH = 50; // TODO: Move to constants

        for (let i = 0; i < state.laneCount; i++) {
            const receptorImg = this.renderCache.receptors[i];
            if (!receptorImg) continue;

            const laneX = cache.getX(i, state.hitLineY, state);
            const laneW = cache.getWidth(state.hitLineY, state);
            const isActive = inputStates[i];

            ctx.save();
            const drawW = Math.round(laneW * (receptorImg.width / 100));
            const drawH = Math.round(hitH * (receptorImg.height / 50));
            const drawX = Math.round((laneX + laneW / 2) - drawW / 2);
            const drawY = Math.round(state.hitLineY - drawH / 2);

            if (isActive) {
                ctx.save();
                ctx.globalCompositeOperation = 'screen';
                ctx.beginPath();
                ctx.ellipse(laneX + laneW / 2, state.hitLineY, laneW * 0.7, hitH * 0.4, 0, 0, Math.PI * 2);
                ctx.fillStyle = this.groundGlowGradients[i] || 'rgba(255,255,255,0.2)';
                ctx.fill();
                ctx.restore();
            }

            ctx.drawImage(receptorImg, drawX, drawY, drawW, drawH);
            ctx.restore();
        }

        // Render Occlusion below the hit zone
        const occlusionTop = state.hitLineY + hitH / 2;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, occlusionTop, state.width, state.height - occlusionTop);
    }
}
