import { type HighwayRenderState } from '../HighwayRenderer';
import { type PerspectiveCache } from './PerspectiveCache';
import { type IThemeStrategy } from '../../themes/IThemeStrategy';
import { LANE_COLORS } from '../../constants/GameConstants';

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
            const laneGrad = ctx.createLinearGradient(0, state.horizonY, 0, state.bottomY);
            laneGrad.addColorStop(0, 'transparent');
            laneGrad.addColorStop(0.85, laneCol + '22');
            laneGrad.addColorStop(1, laneCol + '55');
            this.activeLaneGradients.push(laneGrad);
        }
    }

    public renderDividers(ctx: CanvasRenderingContext2D, state: HighwayRenderState, cache: PerspectiveCache): void {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 1; i < state.laneCount; i++) {
            const topX = cache.getX(i, state.horizonY, state);
            const botX = cache.getX(i, state.hitLineY + 24, state); // Connect to neon underline
            ctx.moveTo(topX, state.horizonY);
            ctx.lineTo(botX, state.hitLineY + 24);
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
        const neonBotY = state.hitLineY + 24; // Exact bottom of receptors
        const outerLeftHitX = cache.getX(0, neonBotY, state);
        const outerRightHitX = cache.getX(state.laneCount, neonBotY, state);

        ctx.save();

        const drawVerticalRail = (x1: number, x2: number) => {
            // Dark Base
            ctx.lineWidth = 12;
            ctx.strokeStyle = '#0a0f1a';
            ctx.beginPath(); ctx.moveTo(x1, state.horizonY); ctx.lineTo(x2, neonBotY); ctx.stroke();
            
            // Neon Glow (Simulated with alpha, no shadowBlur)
            ctx.lineWidth = 6;
            ctx.strokeStyle = `rgba(0, 180, 255, ${0.5 + pulse * 0.3})`;
            ctx.stroke();
            
            // White Core
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();
        };

        drawVerticalRail(leftTopX, outerLeftHitX);
        drawVerticalRail(rightTopX, outerRightHitX);

        // 2. Horizontal Underline (MATCH DESIGN OF RAILS)
        const styleNeon = `rgba(0, 180, 255, ${0.4 + pulse * 0.3})`;
        ctx.beginPath();
        ctx.moveTo(outerLeftHitX, neonBotY);
        ctx.lineTo(outerRightHitX, neonBotY);
        
        ctx.strokeStyle = styleNeon;
        ctx.lineWidth = 6; // Matching Rail Thickness
        ctx.stroke();
        
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5; // Matching Rail Core
        ctx.stroke();

        ctx.restore();
    }

    /**
     * Renders a sleek, minimalist hardware rim for 3D depth.
     * Replaces the bulky deck with a subtle mechanical "point".
     */
    public renderHardwareDeck(ctx: CanvasRenderingContext2D, state: HighwayRenderState, cache: PerspectiveCache): void {
        const pulse = (Math.sin(state.cachedNow * 0.01) + 1) * 0.5;
        const extendedBotY = state.hitLineY + 60; // Bulky frame moved further down
        const deckHeight = 14; // Minimalist accent height
        
        const deckTopL = cache.getX(0, extendedBotY, state) - 15;
        const deckTopR = cache.getX(state.laneCount, extendedBotY, state) + 15;
        const deckBotL = cache.getX(0, extendedBotY + deckHeight, state) - 18;
        const deckBotR = cache.getX(state.laneCount, extendedBotY + deckHeight, state) + 18;
        
        ctx.save();
        
        // 1. Accent Body (High-End Brushed Metal)
        ctx.beginPath();
        ctx.moveTo(deckTopL, extendedBotY);
        ctx.lineTo(deckTopR, extendedBotY);
        ctx.lineTo(deckBotR, extendedBotY + deckHeight);
        ctx.lineTo(deckBotL, extendedBotY + deckHeight);
        ctx.closePath();
        
        const metalGrad = ctx.createLinearGradient(deckTopL, extendedBotY, deckTopR, extendedBotY);
        metalGrad.addColorStop(0, '#0a0f1d');
        metalGrad.addColorStop(0.2, '#1e293b');
        metalGrad.addColorStop(0.5, '#0f172a');
        metalGrad.addColorStop(0.8, '#1e293b');
        metalGrad.addColorStop(1, '#0a0f1d');
        ctx.fillStyle = metalGrad;
        ctx.fill();

        // Horizontal Machine Trim - Dark
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 3. Status LED Accent (Nano-Strip)
        const ledW = (deckTopR - deckTopL) * 0.45;
        const ledX = (deckTopL + deckTopR) / 2 - ledW / 2;
        const ledY = extendedBotY + (deckHeight * 0.45);
        
        ctx.fillStyle = `rgba(0, 240, 255, ${0.4 + pulse * 0.4})`;
        ctx.fillRect(ledX, ledY, ledW, 1.5);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(ledX + (ledW * 0.2), ledY + 0.5, ledW * 0.6, 0.5);

        // 4. Subtle Bottom Rivets
        const rivetX = [deckTopL + 8, deckTopR - 8];
        ctx.fillStyle = '#1e293b';
        for (const rx of rivetX) {
            ctx.beginPath(); ctx.arc(rx, ledY, 2.5, 0, Math.PI * 2); ctx.fill();
        }

        ctx.restore();
    }

    public renderActiveLanes(ctx: CanvasRenderingContext2D, state: HighwayRenderState, cache: PerspectiveCache, inputStates: boolean[]): void {
        const glowH = 80;
        for (let i = 0; i < state.laneCount; i++) {
            if (!inputStates[i]) continue;
            const blX = cache.getX(i, state.hitLineY + 24, state);
            const brX = cache.getX(i + 1, state.hitLineY + 24, state);
            const tlX = cache.getX(i, state.hitLineY - glowH, state);
            const trX = cache.getX(i + 1, state.hitLineY - glowH, state);

            ctx.save();
            const grad = this.activeLaneGradients[i];
            if (grad) {
                ctx.fillStyle = grad;
                ctx.globalAlpha = 0.4;
                ctx.beginPath();
                ctx.moveTo(tlX, state.hitLineY - glowH);
                ctx.lineTo(trX, state.hitLineY - glowH);
                ctx.lineTo(brX, state.hitLineY + 24);
                ctx.lineTo(blX, state.hitLineY + 24);
                ctx.fill();
            }
            ctx.restore();
        }
    }
}
