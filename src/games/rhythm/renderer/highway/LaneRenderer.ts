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

            // 1. Shining Pulse Glow
            ctx.strokeStyle = `rgba(255, 255, 255, ${glowAlpha})`;
            ctx.lineWidth = 4.5;
            ctx.beginPath();
            ctx.moveTo(topX, state.horizonY);
            ctx.lineTo(botX, borderY);
            ctx.stroke();

            // 2. Main Divider Line (Fixed to 1.5px)
            ctx.strokeStyle = `rgba(255, 255, 255, ${coreAlpha})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // 3. High-Intensity Core (Optional but adds 'shine')
            ctx.strokeStyle = `rgba(255, 255, 255, ${coreAlpha * 1.5})`;
            ctx.lineWidth = 0.6;
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

            // 3. High-Intensity Core (1.5px)
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
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
     * Renders a high-performance "Cyber Dashboard" in unused 4K lanes.
     * PERFORMANCE-FIRST: All logic batches geometric draws into single paths.
     */
    public renderCyberDashboard(ctx: CanvasRenderingContext2D, state: HighwayRenderState, cache: PerspectiveCache): void {
        if (state.keyMode !== 4) return;

        const lockedLanes = [0, state.laneCount - 1]; 
        const borderY = Math.round(state.height * HIT_LINE_Y_RATIO);
        
        ctx.save();
        
        // 1. Beat-Sync Calculation (Once per frame)
        const beatProg = (state.cachedNow * (state.bpm / 60000)) % 1;
        const pulse = (Math.sin(beatProg * Math.PI * 2) + 1) * 0.5;

        for (const lane of lockedLanes) {
            const tlX = Math.round(cache.getX(lane, state.horizonY, state));
            const trX = Math.round(cache.getX(lane + 1, state.horizonY, state));
            const blX = Math.round(cache.getX(lane, borderY, state));
            const brX = Math.round(cache.getX(lane + 1, borderY, state));

            // A. Dark Minimalist Base
            ctx.fillStyle = 'rgba(5, 5, 15, 0.85)';
            ctx.beginPath();
            ctx.moveTo(tlX, state.horizonY);
            ctx.lineTo(trX, state.horizonY);
            ctx.lineTo(brX, borderY);
            ctx.lineTo(blX, borderY);
            ctx.fill();

            // B. Batch Render: Circuitry + Spectrum (Single Drawing Pass)
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(tlX, state.horizonY); ctx.lineTo(trX, state.horizonY); ctx.lineTo(brX, borderY); ctx.lineTo(blX, borderY);
            ctx.clip();

            ctx.strokeStyle = `rgba(0, 200, 255, ${0.1 + pulse * 0.1})`;
            ctx.lineWidth = 1;
            ctx.beginPath();

            // 1. Spectrum Analyzer Bars (Fake but beat-synced)
            const numBars = 6;
            const barW = Math.round((brX - blX) / (numBars + 2));
            const barGap = 4;
            for (let j = 0; j < numBars; j++) {
                const barH = 20 + (Math.sin(state.cachedNow * 0.01 + j) * 15) * pulse;
                const barX = blX + (j + 1) * (barW + barGap);
                const barY = borderY - 40;
                ctx.moveTo(barX, barY);
                ctx.lineTo(barX, barY - barH);
                ctx.moveTo(barX + barW, barY);
                ctx.lineTo(barX + barW, barY - barH);
                ctx.rect(barX, barY - barH, barW, 2); // Cap
            }

            // 2. Vertical Data Lines (Subtle perspective rails)
            for (let k = 0; k < 3; k++) {
                const lx = blX + (k + 1) * (barW * 2);
                ctx.moveTo(lx, borderY);
                ctx.lineTo(lx - (borderY - state.horizonY) * 0.2, state.horizonY);
            }

            ctx.stroke();
            ctx.restore();

            // 3. Status Nodes (Tiny pips)
            ctx.fillStyle = pulse > 0.8 ? 'rgba(0, 255, 150, 0.4)' : 'rgba(0, 255, 150, 0.1)';
            const nodeX = Math.round((blX + brX) / 2);
            const nodeY = borderY - 80;
            ctx.fillRect(nodeX - 2, nodeY - 2, 4, 4);
        }

        ctx.restore();
    }
}
