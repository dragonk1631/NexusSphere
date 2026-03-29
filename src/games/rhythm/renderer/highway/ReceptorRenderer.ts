import { type HighwayRenderState } from '../HighwayRenderer';
import { type PerspectiveCache } from './PerspectiveCache';
import { type IThemeStrategy } from '../../themes/IThemeStrategy';
import { type RenderCache } from '../../graphics/RenderCache';

/**
 * ReceptorRenderer handles the hit zone receptors and the bottom console housing.
 * Optimized for Mobile: Zero shadowBlur, single-pass faceplate rendering.
 */
export class ReceptorRenderer {
    private renderCache: RenderCache;
    private groundGlowGradients: (CanvasGradient | null)[] = new Array(7).fill(null);

    constructor(renderCache: RenderCache) {
        this.renderCache = renderCache;
    }

    public onResize(ctx: CanvasRenderingContext2D, state: HighwayRenderState, theme: IThemeStrategy): void {
        const laneW = state.laneBottomWidth;
        for (let i = 0; i < state.laneCount; i++) {
            const laneCol = theme.getColorForJudgment(0);
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, laneW * 0.7);
            g.addColorStop(0, laneCol + '44');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            this.groundGlowGradients[i] = g;
        }
    }

    public render(ctx: CanvasRenderingContext2D, state: HighwayRenderState, cache: PerspectiveCache, inputStates: boolean[]): void {
        const hitH = 48; 
        const pressDepth = 6;
        const extendedBotY = state.hitLineY + 60; // Bulky frame unified with LaneRenderer
        const neonBotY = state.hitLineY + 24;     // Neon underline unified with LaneRenderer

        // 0. Solid Chassis Backing Plate (REFINED - BELOW NOTES ONLY)
        // This anchors the hardware to the bottom of the receptors without cluttering the hit zone.
        const bgTopY = state.hitLineY + 24; // Starts exactly at the bottom of receptors
        const leftBgX = cache.getX(0, bgTopY, state) - 15;
        const rightBgX = cache.getX(state.laneCount, bgTopY, state) + 15;
        const blBgX = cache.getX(0, extendedBotY, state) - 15;
        const brBgX = cache.getX(state.laneCount, extendedBotY, state) + 15;

        ctx.save();
        ctx.fillStyle = '#0a0d14'; // Dense Dark Matte
        ctx.beginPath();
        ctx.moveTo(leftBgX, bgTopY);
        ctx.lineTo(rightBgX, bgTopY);
        ctx.lineTo(brBgX, extendedBotY);
        ctx.lineTo(blBgX, extendedBotY);
        ctx.closePath();
        ctx.fill();
        
        // Final Neon Border Seam (The 'Underline')
        ctx.strokeStyle = '#2d3748';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cache.getX(0, neonBotY, state), neonBotY);
        ctx.lineTo(cache.getX(state.laneCount, neonBotY, state), neonBotY);
        ctx.stroke();
        ctx.restore();

        // 1. Sleek Console Slot (Minimalist Housing)
        // This anchors the buttons into a thin, recessed strip at the deck horizon.
        const leftEdgeX = cache.getX(0, extendedBotY, state) - 12;
        const rightEdgeX = cache.getX(state.laneCount, extendedBotY, state) + 12;
        const faceplateH = 14; // Matches the LaneRenderer accent height
        const faceplateY = extendedBotY;

        ctx.save();
        // Recessed Slot
        ctx.fillStyle = '#050a14';
        ctx.beginPath();
        ctx.roundRect(leftEdgeX, faceplateY, rightEdgeX - leftEdgeX, faceplateH, 4);
        ctx.fill();
        
        // Inner Bevel
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();

        // 2. Individual Receptors
        for (let i = 0; i < state.laneCount; i++) {
            const receptorImg = this.renderCache.receptors[i];
            if (!receptorImg) continue;

            const laneX = cache.getX(i, state.hitLineY, state);
            const laneW = cache.getWidth(state.hitLineY, state);
            const isActive = inputStates[i];

            const drawW = Math.round(laneW * (receptorImg.width / 100));
            const drawH = Math.round(hitH * (receptorImg.height / 50));
            const centerLaneX = Math.round(laneX + laneW / 2);
            const drawX = Math.round(centerLaneX - drawW / 2);
            const physicsY = isActive ? (state.hitLineY - drawH / 2) + pressDepth : (state.hitLineY - drawH / 2);

            ctx.save();
            
            // Hit Animation Glow (Optional, Mobile Optimized)
            if (isActive) {
                ctx.globalCompositeOperation = 'screen';
                ctx.globalAlpha = 0.5;
                ctx.beginPath();
                ctx.ellipse(centerLaneX, state.hitLineY, laneW * 0.9, drawH * 0.5, 0, 0, Math.PI * 2);
                ctx.fillStyle = this.groundGlowGradients[i] || 'rgba(255,255,255,0.2)';
                ctx.fill();
            }

            // Draw receptor image
            ctx.drawImage(receptorImg, drawX, physicsY, drawW, drawH);
            
            // Pressed Glow Effect (Simpler, no shadowBlur)
            if (isActive) {
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = 0.6;
                ctx.drawImage(receptorImg, drawX, physicsY, drawW, drawH);
                
                ctx.fillStyle = '#ffffff';
                ctx.globalAlpha = 0.2;
                ctx.beginPath();
                ctx.ellipse(centerLaneX, physicsY + drawH/2, drawW * 0.3, drawH * 0.15, 0, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }
    }
}
