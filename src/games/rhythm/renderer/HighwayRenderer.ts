import { RenderCache } from '../graphics/RenderCache';
import type { VisualNote } from '../NoteFactory';
import { RhythmInputManager } from '../input/RhythmInputManager';
import { JudgmentSystem } from '../systems/JudgmentSystem';
import { LANE_COLORS, HIGHWAY_CONFIG } from '../constants/GameConstants';
import * as UIUtils from './UIUtils';

// Modular Renderers
import { PerspectiveCache } from './highway/PerspectiveCache';
import { HighwayBackgroundRenderer } from './highway/HighwayBackgroundRenderer';
import { LaneRenderer } from './highway/LaneRenderer';
import { NoteRenderer } from './highway/NoteRenderer';
import { HoldNoteRenderer } from './highway/HoldNoteRenderer';
import { ReceptorRenderer } from './highway/ReceptorRenderer';
import type { IThemeStrategy } from '../themes/IThemeStrategy';

export interface HighwayRenderState {
    width: number;
    height: number;
    horizonY: number;
    bottomY: number;
    hitLineY: number;
    laneCount: number;
    laneTopWidth: number;
    laneBottomWidth: number;
    keyMode: 4 | 6;
    scrollSpeed: number;
    currentTime: number;
    cachedNow: number;
    isMobile: boolean;
}

/**
 * HighwayRenderer orchestrates the high-performance rendering pipeline.
 * It delegates specific tasks to modular sub-renderers to maintain SRP and performance.
 */
export class HighwayRenderer {
    private cache: PerspectiveCache;
    private bgRenderer: HighwayBackgroundRenderer;
    private laneRenderer: LaneRenderer;
    private noteRenderer: NoteRenderer;
    private holdRenderer: HoldNoteRenderer;
    private receptorRenderer: ReceptorRenderer;

    private beamGradients: (CanvasGradient | null)[] = new Array(7).fill(null);
    private desaturatedLaneColors: string[] = new Array(7).fill('');

    // GC Optimization: Pre-allocated buffer for note indices
    private visibleIndices: Uint32Array = new Uint32Array(2000);
    private visibleNoteCount: number = 0;

    constructor(renderCache: RenderCache, _judgmentSystem: JudgmentSystem) {
        this.cache = new PerspectiveCache(200);
        this.bgRenderer = new HighwayBackgroundRenderer();
        this.laneRenderer = new LaneRenderer();
        this.noteRenderer = new NoteRenderer(renderCache);
        this.receptorRenderer = new ReceptorRenderer(renderCache);

        LANE_COLORS.forEach((colorSet, i) => {
            this.desaturatedLaneColors[i] = UIUtils.desaturateColor(colorSet[0], 0.7);
        });

        this.holdRenderer = new HoldNoteRenderer(this.noteRenderer, this.desaturatedLaneColors);
    }

    public onResize(ctx: CanvasRenderingContext2D, _laneCount: number, horizonY: number, hitLineY: number, state: HighwayRenderState, theme: IThemeStrategy): void {
        this.cache.build(state);
        this.bgRenderer.onResize(ctx, state);
        this.laneRenderer.onResize(ctx, state, theme);
        this.receptorRenderer.onResize(ctx, state, theme);

        // Pre-generate Beam Gradients
        const beamRange = hitLineY - horizonY;
        const beamTopY = hitLineY - beamRange * 0.6;
        this.beamGradients = LANE_COLORS.map(colorSet => {
            const grad = ctx.createLinearGradient(0, hitLineY, 0, beamTopY);
            const color = colorSet[0];
            const r = parseInt(color.substring(1, 3), 16);
            const g = parseInt(color.substring(3, 5), 16);
            const b = parseInt(color.substring(5, 7), 16);
            grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${HIGHWAY_CONFIG.BEAM_ALPHA_START * 2.0})`);
            grad.addColorStop(0.33, `rgba(${r}, ${g}, ${b}, ${HIGHWAY_CONFIG.BEAM_ALPHA_START * 0.4})`);
            grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.0)`);
            return grad;
        });
    }

    public renderBackground(ctx: CanvasRenderingContext2D, state: HighwayRenderState): void {
        this.bgRenderer.render(ctx, state, this.cache);
    }

    public renderDynamic(ctx: CanvasRenderingContext2D, state: HighwayRenderState, visualNotes: VisualNote[], lastNoteIndex: number, holdingLanes: (VisualNote | null)[], inputManager: RhythmInputManager): void {
        const inputStates = inputManager.getLaneStates();

        this.laneRenderer.renderDividers(ctx, state, this.cache);
        this.laneRenderer.renderActiveLanes(ctx, state, this.cache, inputStates);
        this.laneRenderer.renderPulseRails(ctx, state, this.cache);
        this.receptorRenderer.render(ctx, state, this.cache, inputStates);

        this.renderNotes(ctx, state, visualNotes, lastNoteIndex);

        holdingLanes.forEach((note, lane) => {
            if (note) this.drawLaneBeam(ctx, lane, state);
        });
    }

    private renderNotes(ctx: CanvasRenderingContext2D, state: HighwayRenderState, visualNotes: VisualNote[], lastNoteIndex: number): void {
        const timeToReachHitLine = 2000 / state.scrollSpeed;
        const windowStart = state.currentTime - 500;
        const windowEnd = state.currentTime + timeToReachHitLine * HIGHWAY_CONFIG.NOTE_LOOKAHEAD;

        let count = 0;
        for (let i = lastNoteIndex; i < visualNotes.length; i++) {
            const note = visualNotes[i];
            const noteTimeMs = note.time * 1000;
            const noteEndMs = note.isHold ? noteTimeMs + note.durationMs : noteTimeMs;
            if (noteTimeMs > windowEnd) break;
            if (note.isProcessed && !note.isHolding) continue;
            if (noteEndMs < windowStart) continue;

            if (count < this.visibleIndices.length) {
                this.visibleIndices[count++] = i;
            }
        }
        this.visibleNoteCount = count;

        const pDepth = HIGHWAY_CONFIG.PERSPECTIVE_DEPTH;
        const horizon = state.horizonY;
        const hitLine = state.hitLineY;

        for (let j = this.visibleNoteCount - 1; j >= 0; j--) {
            const note = visualNotes[this.visibleIndices[j]];
            const noteTimeMs = note.time * 1000;
            const timeDiff = noteTimeMs - state.currentTime;
            let linearProgress = 1 - (timeDiff / timeToReachHitLine);
            if (note.isHold && linearProgress > 1) linearProgress = 1;

            const projectedProgress = linearProgress / (pDepth - (pDepth - 1) * linearProgress);
            const noteY = horizon + (hitLine - horizon) * projectedProgress;
            if (noteY < horizon) continue;

            const nW = this.cache.getWidth(noteY, state);
            const nX = this.cache.getX(note.lane, noteY, state);
            const nH = 50 * projectedProgress;

            let alpha = 1.0;
            if (linearProgress < HIGHWAY_CONFIG.NOTE_FADE_THRESHOLD) alpha = Math.max(0, linearProgress / HIGHWAY_CONFIG.NOTE_FADE_THRESHOLD);

            if (note.isHold) {
                const tailTime = note.time + (note.durationMs / 1000);
                const timeDiffTail = (tailTime * 1000) - state.currentTime;
                let tailProgress = 1 - (timeDiffTail / timeToReachHitLine);
                if (tailProgress > 1) tailProgress = 1;

                const pTail = tailProgress / (pDepth - (pDepth - 1) * tailProgress);
                const tailY = horizon + (hitLine - horizon) * pTail;
                const tailH = 50 * pTail;

                this.holdRenderer.renderHoldNote(ctx, state, this.cache, note.lane, nX, noteY, nW, nH, tailY, tailH, note.isHolding, alpha);
            } else {
                this.noteRenderer.renderTapNote(ctx, nX, noteY, nW, nH, note.lane, alpha);
            }
        }
    }

    private drawLaneBeam(ctx: CanvasRenderingContext2D, lane: number, state: HighwayRenderState): void {
        const beamGrad = this.beamGradients[lane];
        if (!beamGrad) return;

        const tlX = this.cache.getX(lane, state.horizonY, state);
        const trX = this.cache.getX(lane + 1, state.horizonY, state);
        const blX = this.cache.getX(lane, state.bottomY, state);
        const brX = this.cache.getX(lane + 1, state.bottomY, state);

        ctx.save();
        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(tlX, state.horizonY);
        ctx.lineTo(trX, state.horizonY);
        ctx.lineTo(brX, state.bottomY);
        ctx.lineTo(blX, state.bottomY);
        ctx.fill();
        ctx.restore();
    }

    /** @deprecated Use renderBackground and renderDynamic for layered rendering */
    public render(ctx: CanvasRenderingContext2D, state: HighwayRenderState, visualNotes: VisualNote[], lastNoteIndex: number, holdingLanes: (VisualNote | null)[], inputManager: RhythmInputManager): void {
        this.renderBackground(ctx, state);
        this.renderDynamic(ctx, state, visualNotes, lastNoteIndex, holdingLanes, inputManager);
    }
}
