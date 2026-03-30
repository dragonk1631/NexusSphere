import { type HighwayRenderState } from '../HighwayRenderer';
import { type PerspectiveCache } from './PerspectiveCache';
import { type IThemeStrategy } from '../../themes/IThemeStrategy';
import { type RenderCache } from '../../graphics/RenderCache';
import { LANE_COLORS } from '../../constants/GameConstants';

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

        // 0. Solid Chassis Backing Plate & Housing (REMOVED per user request)
        // Achieving 'Zero Shadow' - receptors now float purely above the neon-white frame.
        
        ctx.save();
        
        // Final Neon Border Seam (The 'Underline' - Handled by LaneRenderer for unity)
        // No additional drawing here to avoid double-processing.
        
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

            // 2b. PC KEY LABELS (User requested: Unified White, Lane Color Outline, Black Shadow)
            if (!state.isMobile && state.keyLabels[i]) {
                ctx.save();
                ctx.font = '900 21px "Orbitron"';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                const laneColor = LANE_COLORS[i % LANE_COLORS.length][0];
                
                // 1. Black Drop Shadow for maximum contrast
                ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
                ctx.shadowBlur = 3;
                ctx.shadowOffsetX = 1.5;
                ctx.shadowOffsetY = 1.5;
                
                // 2. Stroke (Lane-Synced Neon Color)
                ctx.strokeStyle = laneColor;
                ctx.lineWidth = 3;
                ctx.lineJoin = 'round';
                ctx.strokeText(state.keyLabels[i], centerLaneX, physicsY + drawH / 2);
                
                // 3. Fill (Unified Premium White)
                ctx.fillStyle = '#ffffff';
                if (isActive) {
                    // Accent glow when active
                    ctx.shadowColor = laneColor;
                    ctx.shadowBlur = 10;
                    ctx.shadowOffsetX = 0;
                    ctx.shadowOffsetY = 0;
                }
                
                ctx.fillText(state.keyLabels[i], centerLaneX, physicsY + drawH / 2);
                ctx.restore();
            }

            ctx.restore();
        }
    }
}
