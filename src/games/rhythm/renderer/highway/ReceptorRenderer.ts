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

            const isLocked = state.keyMode === 4 && (i === 0 || i === state.laneCount - 1);

            ctx.save();
            
            if (isLocked) {
                ctx.save();
                ctx.globalAlpha = 0.4;
                ctx.filter = 'grayscale(100%) contrast(1.2)';
                ctx.drawImage(receptorImg, drawX, physicsY, drawW, drawH);
                ctx.restore();

                // Draw small crossing chains over the receptor v57
                ctx.save();
                const chainSize = drawH * 0.4;
                ctx.strokeStyle = '#222222';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(drawX, physicsY); ctx.lineTo(drawX + drawW, physicsY + drawH);
                ctx.moveTo(drawX + drawW, physicsY); ctx.lineTo(drawX, physicsY + drawH);
                ctx.stroke();
                
                // Metallic detailing on the cross
                ctx.strokeStyle = '#555555';
                ctx.lineWidth = 1.5;
                ctx.stroke();

                ctx.font = '900 10px "Orbitron"';
                ctx.fillStyle = '#ff3300';
                ctx.textAlign = 'center';
                ctx.fillText('SEALED', centerLaneX, physicsY + drawH/2);
                ctx.restore();
            } else {
                // Hit Animation Glow (Optional, Mobile Optimized)
                if (isActive) {
                    ctx.globalCompositeOperation = 'screen';
                    ctx.globalAlpha = 0.5;
                    ctx.beginPath();
                    ctx.ellipse(centerLaneX, state.hitLineY, laneW * 0.9, drawH * 0.5, 0, 0, Math.PI * 2);
                    ctx.fillStyle = this.groundGlowGradients[i] || 'rgba(255,255,255,0.2)';
                    ctx.fill();
                }

                // 1. Draw receptor image
                ctx.drawImage(receptorImg, drawX, physicsY, drawW, drawH);
                
                // 1b. PREMIUM AMBIENT PULSE (Multi-layered 'Living' Bloom)
                const pulse = (Math.sin(state.cachedNow * 0.01) + 1) * 0.5;
                const laneCol = LANE_COLORS[i % LANE_COLORS.length][0];
                
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                
                // Layer 1: Base High-Intensity Glow (More vivid)
                ctx.globalAlpha = 0.2 + pulse * 0.4; 
                if (!state.isMobile) {
                    ctx.shadowColor = laneCol;
                    ctx.shadowBlur = 10 + pulse * 15;
                }
                ctx.drawImage(receptorImg, drawX, physicsY, drawW, drawH);
                
                // Layer 2: Secondary Wide-Area Aura (Spectacular Shimmer)
                if (pulse > 0.4) {
                    ctx.globalAlpha = (pulse - 0.4) * 0.3; // Ramps up during peak pulse
                    if (!state.isMobile) {
                        ctx.shadowBlur = 25; // Wide atmospheric bloom
                    }
                    ctx.drawImage(receptorImg, drawX, physicsY, drawW, drawH);
                }
                ctx.restore();
                
                // Pressed Glow Effect (More Noticeable Hit Feedback)
                if (isActive) {
                    ctx.globalCompositeOperation = 'lighter';
                    ctx.globalAlpha = 0.8; // Increased from 0.6
                    ctx.drawImage(receptorImg, drawX, physicsY, drawW, drawH);
                    
                    ctx.fillStyle = '#ffffff';
                    ctx.globalAlpha = 0.35; // Increased from 0.2
                    ctx.beginPath();
                    ctx.ellipse(centerLaneX, physicsY + drawH/2, drawW * 0.35, drawH * 0.18, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // 2b. PC KEY LABELS (User requested: Unified White, Lane Color Outline, Black Shadow)
            if (!state.isMobile && state.keyLabels[i] && !isLocked) {
                ctx.save();
                ctx.font = '900 21px "Orbitron"';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                // laneCol is defined in section 1b
                
                // 1. Black Drop Shadow for maximum contrast
                ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
                ctx.shadowBlur = 3;
                ctx.shadowOffsetX = 1.5;
                ctx.shadowOffsetY = 1.5;
                
                // 2. Stroke (Lane-Synced Neon Color)
                ctx.strokeStyle = laneCol;
                ctx.lineWidth = 3;
                ctx.lineJoin = 'round';
                ctx.strokeText(state.keyLabels[i], centerLaneX, physicsY + drawH / 2);
                
                // 3. Fill (Unified Premium White)
                ctx.fillStyle = '#ffffff';
                if (isActive) {
                    // Accent glow when active
                    ctx.shadowColor = laneCol;
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
