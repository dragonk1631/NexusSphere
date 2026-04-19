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
            const laneCol = LANE_COLORS[i % LANE_COLORS.length][0];

            ctx.save();
            
            if (isLocked) {
                ctx.save();
                
                // 1. Dimm and Grayscale the base receptor
                ctx.globalAlpha = 0.25;
                ctx.filter = 'grayscale(100%) brightness(0.6) contrast(1.1)';
                ctx.drawImage(receptorImg, drawX, physicsY, drawW, drawH);
                ctx.restore();

                // 2. DRAW UNIFIED SECURITY OVERLAY (X + LOCKED)
                ctx.save();
                const pulse = (Math.sin(state.cachedNow * 0.003) + 1) * 0.5;
                const xMargin = drawW * 0.25;
                const yMargin = drawH * 0.25;
                
                // --- 2a. THE 'X' MARK (Neon Hazard Style) ---
                ctx.strokeStyle = `rgba(255, 50, 50, ${0.4 + pulse * 0.4})`;
                ctx.lineWidth = 6;
                ctx.lineCap = 'round';
                
                ctx.beginPath();
                ctx.moveTo(drawX + xMargin, physicsY + yMargin);
                ctx.lineTo(drawX + drawW - xMargin, physicsY + drawH - yMargin);
                ctx.moveTo(drawX + drawW - xMargin, physicsY + yMargin);
                ctx.lineTo(drawX + xMargin, physicsY + drawH - yMargin);
                ctx.stroke();

                // Core Highlight for X
                ctx.strokeStyle = '#ffffff';
                ctx.globalAlpha = 0.3 + pulse * 0.2;
                ctx.lineWidth = 1.2;
                ctx.stroke();

                // --- 2b. 'LOCKED' TEXT & FORBIDDEN SYMBOL (Integrated Minimalist Design) ---
                // Move text INSIDE the receptor area for a unified sleek look
                const textY = physicsY + (drawH / 2);
                
                // --- SUBTLE FORBIDDEN ICON (Extra-Large Scale) ---
                ctx.save();
                ctx.translate(centerLaneX, textY);
                ctx.globalAlpha = 0.2; 
                ctx.strokeStyle = '#ff3333';
                ctx.lineWidth = 2.5; 
                const iconSize = 32; // Further scaled up
                ctx.beginPath();
                ctx.arc(0, 0, iconSize, 0, Math.PI * 2);
                ctx.moveTo(-iconSize * 0.7, -iconSize * 0.7);
                ctx.lineTo(iconSize * 0.7, iconSize * 0.7);
                ctx.stroke();

                // --- PROCEDURAL LOCK ICON (Doubled Size) ---
                // Drawing a significant, bold lock icon centered over the receptor
                ctx.save();
                ctx.globalAlpha = 0.5 + pulse * 0.3;
                ctx.translate(0, -10); // Offset adjusted for larger scale
                ctx.fillStyle = '#ff8888';
                ctx.strokeStyle = '#ff8888';
                ctx.lineWidth = 3; // Thicker shackle
                
                // 1. Lock Body (Doubled: 10->20 wide, 8->16 high)
                ctx.beginPath();
                ctx.roundRect(-10, 0, 20, 16, 4); 
                ctx.fill();
                
                // 2. Lock Shackle (Doubled: Radius 3.5 -> 7)
                ctx.beginPath();
                ctx.arc(0, 0, 7, Math.PI, 0); 
                ctx.stroke();
                
                // 3. Keyhole Detail (Doubled: 1.2 -> 2.4)
                ctx.fillStyle = '#000000';
                ctx.beginPath(); ctx.arc(0, 8, 2.5, 0, Math.PI*2); ctx.fill();
                ctx.restore();

                ctx.restore();

                ctx.font = '900 12px "Orbitron"';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                // Shadow for Legibility
                ctx.fillStyle = '#000000';
                ctx.fillText('LOCKED', centerLaneX + 1, textY + 1);

                // Main Text (Red Pulse)
                ctx.fillStyle = `rgba(255, 100, 100, ${0.8 + pulse * 0.2})`;
                ctx.fillText('LOCKED', centerLaneX, textY);
                
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
