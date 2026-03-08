import { type HighwayRenderState } from '../HighwayRenderer';
import { type PerspectiveCache } from './PerspectiveCache';
import { type NoteRenderer } from './NoteRenderer';
import { LANE_COLORS, HIGHWAY_CONFIG } from '../../constants/GameConstants';

/**
 * HoldNoteRenderer implements the high-performance Quad-rendering for long notes.
 */
export class HoldNoteRenderer {
    private noteRenderer: NoteRenderer;
    private desaturatedLaneColors: string[];

    constructor(noteRenderer: NoteRenderer, desaturatedLaneColors: string[]) {
        this.noteRenderer = noteRenderer;
        this.desaturatedLaneColors = desaturatedLaneColors;
    }

    /**
     * Renders a long note (body + cap).
     */
    public renderHoldNote(
        ctx: CanvasRenderingContext2D,
        state: HighwayRenderState,
        cache: PerspectiveCache,
        lane: number,
        headX: number,
        headY: number,
        headW: number,
        headH: number,
        tailY: number,
        tailH: number,
        isHolding: boolean,
        globalAlpha: number
    ): void {
        const bodyRatio = HIGHWAY_CONFIG.HOLD_BODY_RATIO;
        const visualTailY = Math.max(state.horizonY, tailY);
        const visualTailW = cache.getWidth(visualTailY, state);
        const visualTailX = cache.getX(lane, visualTailY, state);

        if (visualTailY > headY) return;

        // 1. Alpha Logic
        let alpha = isHolding ? 1.0 : 0.95;
        if (isHolding) alpha = Math.sin(state.cachedNow * 0.02) * 0.05 + 0.95;
        const finalAlpha = alpha * globalAlpha;

        // 2. Geometry calculations (Quad points)
        const topCX = visualTailX + visualTailW * 0.5;
        const botCX = headX + headW * 0.5;
        const topHalfW = (visualTailW * bodyRatio) * 0.5;
        const botHalfW = (headW * bodyRatio) * 0.5;

        const tlX = topCX - topHalfW, tlY = visualTailY;
        const trX = topCX + topHalfW, trY = visualTailY;
        const brX = botCX + botHalfW, brY = headY;
        const blX = botCX - botHalfW, blY = headY;

        ctx.save();
        ctx.globalAlpha *= finalAlpha;

        const laneColor = LANE_COLORS[lane % LANE_COLORS.length][0];
        const baseColor = isHolding ? laneColor : this.desaturatedLaneColors[lane % this.desaturatedLaneColors.length];

        // 3. Render Body
        ctx.beginPath();
        ctx.moveTo(tlX, tlY);
        ctx.lineTo(trX, trY);
        ctx.lineTo(brX, brY);
        ctx.lineTo(blX, blY);
        ctx.closePath();

        ctx.fillStyle = baseColor;
        ctx.fill();

        // 4. Highlight Gradient (Reusable Path)
        const midY = (visualTailY + headY) * 0.5;
        const midW = cache.getWidth(midY, state);
        const midCX = cache.getX(lane, midY, state) + midW * 0.5;
        const gW = midW * bodyRatio;

        const grad = ctx.createLinearGradient(midCX - gW * 0.5, 0, midCX + gW * 0.5, 0);
        grad.addColorStop(0, 'rgba(0, 0, 0, 0.4)');
        grad.addColorStop(0.2, 'rgba(0, 0, 0, 0.1)');
        grad.addColorStop(0.5, `rgba(255, 255, 255, ${alpha * 0.6})`);
        grad.addColorStop(0.8, 'rgba(0, 0, 0, 0.1)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0.4)');

        ctx.fillStyle = grad;
        ctx.fill();

        // 5. Stroke & Spine
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(topCX, visualTailY);
        ctx.lineTo(botCX, headY);
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
        ctx.lineWidth = 3.5;
        ctx.stroke();

        ctx.restore();

        // 6. Draw Caps
        const rHeadW = headW * bodyRatio;
        const rTailW = visualTailW * bodyRatio;
        const rHeadX = headX + (headW - rHeadW) * 0.5;
        const rTailX = visualTailX + (visualTailW - rTailW) * 0.5;

        if (tailY >= state.horizonY) {
            this.noteRenderer.renderTapNote(ctx, rTailX, tailY, rTailW, tailH * 0.5, lane, globalAlpha);
        }
        this.noteRenderer.renderTapNote(ctx, rHeadX, headY, rHeadW, headH, lane, globalAlpha);
    }
}
