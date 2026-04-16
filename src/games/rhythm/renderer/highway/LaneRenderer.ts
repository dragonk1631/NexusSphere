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
        const borderY = state.height * HIT_LINE_Y_RATIO;
        
        // Dynamic Pulse for Dividers
        const pulse = (Math.sin(state.cachedNow * 0.005) + 1) * 0.5;
        const glowAlpha = 0.05 + pulse * 0.15;
        const coreAlpha = 0.2 + pulse * 0.2;

        for (let i = 1; i < state.laneCount; i++) {
            const topX = cache.getX(i, state.horizonY, state);
            const botX = cache.getX(i, borderY, state); 

            // 1. Shining Pulse Glow (Reduced to 2.5px for a sharper look)
            ctx.strokeStyle = `rgba(255, 255, 255, ${glowAlpha})`;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(topX, state.horizonY);
            ctx.lineTo(botX, borderY);
            ctx.stroke();

            // 2. Main Divider Line (Fixed to 1.3px)
            ctx.strokeStyle = `rgba(255, 255, 255, ${coreAlpha})`;
            ctx.lineWidth = 1.3;
            ctx.stroke();

            // 3. High-Intensity Core (Reduced to 0.4px for precision)
            ctx.strokeStyle = `rgba(255, 255, 255, ${coreAlpha * 1.5})`;
            ctx.lineWidth = 0.4;
            ctx.stroke();
        }
        ctx.restore();
    }

    /**
     * Renders high-fidelity vertical rails that plug directly into the hardware deck.
     */
    public renderPulseRails(ctx: CanvasRenderingContext2D, state: HighwayRenderState, cache: PerspectiveCache): void {
        const pulse = (Math.sin(state.cachedNow * 0.01) + 1) * 0.5;
        const leftTopX = cache.getX(0, state.horizonY, state);
        const rightTopX = cache.getX(state.laneCount, state.horizonY, state);
        const borderY = state.height * HIT_LINE_Y_RATIO;

        const drawContinuousFrame = () => {
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

            // 2. Mode-Specific Glow (6px)
            // 4K: Cyan (Focused/Sharp), 6K: Purple (Grand/Complex)
            const glowColor = state.keyMode === 6 
                ? `rgba(180, 0, 255, ${0.4 + pulse * 0.3})` 
                : `rgba(0, 180, 255, ${0.4 + pulse * 0.3})`;
            ctx.strokeStyle = glowColor;
            ctx.lineWidth = 6;
            ctx.stroke();

            // 3. High-Intensity Core (1.3px)
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.3;
            ctx.stroke();
        };

        // [6K EXCLUSIVE] Side Wings - Expands the highway visually without affecting lane hitbox
        if (state.keyMode === 6) {
            ctx.save();
            const wingOffset = 25; // How much it fans out
            const wingPulse = (Math.cos(state.cachedNow * 0.008) + 1) * 0.5;
            
            ctx.strokeStyle = `rgba(255, 200, 0, ${0.2 + wingPulse * 0.2})`; // Gold accent
            ctx.lineWidth = 4;
            ctx.beginPath();
            
            // Left Wing
            const lX_Bot = cache.getX(0, borderY, state) - wingOffset;
            ctx.moveTo(leftTopX - 5, state.horizonY);
            ctx.lineTo(lX_Bot, borderY);
            
            // Right Wing
            const rX_Bot = cache.getX(state.laneCount, borderY, state) + wingOffset;
            ctx.moveTo(rightTopX + 5, state.horizonY);
            ctx.lineTo(rX_Bot, borderY);
            
            ctx.stroke();
            ctx.restore();
        }

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

    /**
     * Renders a sophisticated "Cyber-Security Seal" for inactive 4K lanes.
     * Replaces the old chain effect with a high-fidelity holographic barrier.
     */
    public renderCyberDashboard(ctx: CanvasRenderingContext2D, state: HighwayRenderState, cache: PerspectiveCache): void {
        if (state.keyMode !== 4) return;

        const lockedLanes = [0, state.laneCount - 1]; 
        const borderY = Math.round(state.height * HIT_LINE_Y_RATIO);
        const pulse = (Math.sin(state.cachedNow * 0.003) + 1) * 0.5;
        const glitch = Math.random() > 0.98 ? 1.5 : 0; // Occasional digital flicker

        for (const lane of lockedLanes) {
            const tlX = cache.getX(lane, state.horizonY, state);
            const trX = cache.getX(lane + 1, state.horizonY, state);
            const blX = cache.getX(lane, borderY, state);
            const brX = cache.getX(lane + 1, borderY, state);

            ctx.save();
            
            // --- 1. PREMIUM BACKGROUND: Frosted Cyber-Glass ---
            const bgGrad = ctx.createLinearGradient(0, state.horizonY, 0, borderY);
            bgGrad.addColorStop(0, '#0a0505');
            bgGrad.addColorStop(0.5, '#1a0a0a');
            bgGrad.addColorStop(1, '#0f0505');
            
            ctx.fillStyle = bgGrad;
            ctx.globalAlpha = 0.85;
            ctx.beginPath();
            ctx.moveTo(tlX, state.horizonY); ctx.lineTo(trX, state.horizonY); ctx.lineTo(brX, borderY); ctx.lineTo(blX, borderY);
            ctx.fill();

            // --- 2. HOLOGRAPHIC GRID: Dynamic Hex/Tech Texture ---
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(tlX, state.horizonY); ctx.lineTo(trX, state.horizonY); ctx.lineTo(brX, borderY); ctx.lineTo(blX, borderY);
            ctx.clip();
            
            ctx.strokeStyle = `rgba(255, 50, 50, ${0.05 + pulse * 0.05})`;
            ctx.lineWidth = 1;
            const gridSize = 40;
            for (let y = state.horizonY; y < borderY; y += gridSize) {
                const ratio = (y - state.horizonY) / (borderY - state.horizonY);
                const curW = tlX + (blX - tlX) * ratio;
                const endW = trX + (brX - trX) * ratio;
                ctx.beginPath(); ctx.moveTo(curW, y); ctx.lineTo(endW, y); ctx.stroke();
            }
            ctx.restore();

            // --- 3. HIGH-FIDELITY SEAL ICON: Procedural "No Entry" Hologram ---
            // Position at lower-middle for maximum visibility (75% depth)
            const iconY = state.horizonY + (borderY - state.horizonY) * 0.7 + (Math.sin(state.cachedNow * 0.002) * 8);
            
            // [LAYOUT OPTIMIZATION] Individually tune icon and text for perspective balance
            // Text stays biased outward (0.28/0.72) for playability; Icon moves even closer to center (0.46/0.54).
            const textBias = lane === 0 ? 0.28 : 0.72;
            const iconBias = lane === 0 ? 0.46 : 0.54;
            
            const centerIconX = cache.getX(lane + iconBias, iconY, state) + glitch;
            const textX = cache.getX(lane + textBias, iconY, state) + glitch;
            const iconSize = cache.getWidth(iconY, state) * 0.40;

            this.drawSecuritySeal(ctx, centerIconX, iconY, iconSize, pulse);

            // --- 4. PROFESSIONAL TYPOGRAPHY: LOCKED ---
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Primary Warning
            const textAlpha = 0.6 + pulse * 0.4;
            
            ctx.fillStyle = `rgba(255, 80, 80, ${textAlpha})`;
            ctx.font = '900 14px "Orbitron"'; 
            ctx.fillText('LOCKED', textX, iconY + iconSize + 25);
            
            // Secondary Meta-info (Commercial Detail)
            ctx.fillStyle = `rgba(255, 255, 255, ${0.15 + pulse * 0.05})`;
            ctx.font = '600 8px "Rajdhani"'; // Reduced from 10px
            ctx.fillText(`LANE_SECURE_ID: 0x${(lane + 1).toString(16).toUpperCase()}FF`, centerIconX, iconY + iconSize + 42);

            ctx.restore();
        }
    }

    /**
     * Draws a high-fidelity, glowing "No-Entry" security seal.
     */
    private drawSecuritySeal(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, pulse: number): void {
        ctx.save();
        ctx.translate(x, y);

        // 1. Outer Glow
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.2);
        glow.addColorStop(0, 'rgba(255, 0, 0, 0.2)');
        glow.addColorStop(1, 'rgba(255, 0, 0, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(0, 0, size * 1.2, 0, Math.PI * 2); ctx.fill();

        // 2. Main Red Circle (Deep Gradient)
        const circleGrad = ctx.createRadialGradient(0, -size*0.2, 0, 0, 0, size);
        circleGrad.addColorStop(0, '#ff4d4d');
        circleGrad.addColorStop(1, '#990000');
        ctx.fillStyle = circleGrad;
        ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * 2); ctx.fill();

        // 3. Inner Glossy Rim
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, size - 3, 0, Math.PI * 2); ctx.stroke();

        // 4. THE BAR (No-Entry Sign)
        const barW = size * 1.3;
        const barH = size * 0.38;
        
        // Bar Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.roundRect(-barW/2 + 2, -barH/2 + 2, barW, barH, 8); ctx.fill();

        // Main Bar (High-Contrast White)
        const barGrad = ctx.createLinearGradient(0, -barH/2, 0, barH/2);
        barGrad.addColorStop(0, '#ffffff');
        barGrad.addColorStop(1, '#e0e0e0');
        ctx.fillStyle = barGrad;
        ctx.beginPath();
        ctx.roundRect(-barW/2, -barH/2, barW, barH, 8);
        ctx.fill();

        // 5. Digital Interference / Tech Details
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-barW * 0.4, 0); ctx.lineTo(barW * 0.4, 0);
        ctx.stroke();

        ctx.restore();
    }
}
