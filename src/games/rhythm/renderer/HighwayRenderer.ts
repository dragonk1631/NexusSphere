import { RenderCache } from '../graphics/RenderCache';
import type { VisualNote } from '../NoteFactory';
import { RhythmInputManager } from '../input/RhythmInputManager';
import { JudgmentSystem } from '../systems/JudgmentSystem';
import { LANE_COLORS, HIGHWAY_CONFIG, LAYOUT } from '../constants/GameConstants';
import * as UIUtils from './UIUtils';

// Modular Renderers
import { PerspectiveCache } from './highway/PerspectiveCache';
import { HighwayBackgroundRenderer } from './highway/HighwayBackgroundRenderer';
import { LaneRenderer } from './highway/LaneRenderer';
import { NoteRenderer } from './highway/NoteRenderer';
import { HoldNoteRenderer } from './highway/HoldNoteRenderer';
import { ReceptorRenderer } from './highway/ReceptorRenderer';
import type { IThemeStrategy } from '../themes/IThemeStrategy';
import { Judgment } from '../types/GameTypes';

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
    bpm: number;
    isMobile: boolean;
    keyLabels: string[];
    characterImage?: HTMLImageElement;
    comboAnim?: number;
    lastJudgment?: Judgment | null;
}

/**
 * HighwayRenderer orchestrates the high-performance rendering pipeline.
 * PERFORMANCE RESCUE: Removed shadowBlur and expensive clips for 60FPS mobile.
 */
export class HighwayRenderer {
    private cache: PerspectiveCache;
    private bgRenderer: HighwayBackgroundRenderer;
    private laneRenderer: LaneRenderer;
    private noteRenderer: NoteRenderer;
    private holdRenderer: HoldNoteRenderer;
    private receptorRenderer: ReceptorRenderer;

    private beamGradients: (CanvasGradient | null)[] = [];
    private desaturatedLaneColors: string[] = [];

    // GC Optimization: Pre-allocated buffer for note indices
    private visibleIndices: Uint32Array = new Uint32Array(2000);
    private visibleNoteCount: number = 0;

    constructor(renderCache: RenderCache, _judgmentSystem: JudgmentSystem) {
        this.cache = new PerspectiveCache(200);
        this.bgRenderer = new HighwayBackgroundRenderer();
        this.laneRenderer = new LaneRenderer();
        this.noteRenderer = new NoteRenderer(renderCache);
        this.receptorRenderer = new ReceptorRenderer(renderCache);

        for (let i = 0; i < LANE_COLORS.length; i++) {
            this.desaturatedLaneColors[i] = UIUtils.desaturateColor(LANE_COLORS[i][0], 0.7);
        }

        this.holdRenderer = new HoldNoteRenderer(this.noteRenderer, this.desaturatedLaneColors);
    }

    public onResize(ctx: CanvasRenderingContext2D, _laneCount: number, horizonY: number, hitLineY: number, state: HighwayRenderState, theme: IThemeStrategy): void {
        this.cache.build(state);
        this.bgRenderer.onResize(ctx, state);
        this.laneRenderer.onResize(ctx, state, theme);
        this.receptorRenderer.onResize(ctx, state, theme);

        this.beamGradients = new Array(state.laneCount);
        for (let i = 0; i < state.laneCount; i++) {
            const colorSet = LANE_COLORS[i % LANE_COLORS.length];
            const grad = ctx.createLinearGradient(0, hitLineY, 0, horizonY);
            const color = colorSet[0];
            const r = parseInt(color.substring(1, 3), 16);
            const g = parseInt(color.substring(3, 5), 16);
            const b = parseInt(color.substring(5, 7), 16);

            // Narrower, atmospheric bloom alpha
            grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.6)`);
            grad.addColorStop(0.1, `rgba(${r}, ${g}, ${b}, 0.2)`);
            grad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.05)`);
            grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
            this.beamGradients[i] = grad;
        }
    }

    public renderBackground(ctx: CanvasRenderingContext2D, state: HighwayRenderState): void {
        this.bgRenderer.render(ctx, state, this.cache);
    }

    public renderDynamic(ctx: CanvasRenderingContext2D, state: HighwayRenderState, visualNotes: VisualNote[], lastNoteIndex: number, inputManager: RhythmInputManager, alpha: number = 0): void {
        const inputStates = inputManager.getLaneStates();

        // 1. Structural Chassis (Optimized)
        this.laneRenderer.renderDividers(ctx, state, this.cache);
        this.laneRenderer.renderPulseRails(ctx, state, this.cache);

        // 1b. [NEW] Character Overlay (Lane Center)
        this.renderCharacterOverlay(ctx, state);

        // 2. Gameplay (Falling Notes)
        this.renderNotes(ctx, state, visualNotes, lastNoteIndex, alpha);

        // [4K EXCLUSIVE] Cyber Dashboard for unused lanes
        this.laneRenderer.renderCyberDashboard(ctx, state, this.cache);

        // 3. Hardware Console Housing (Unified Bar + Individual Buttons)
        // Draw the console body FIRST so buttons sit INSIDE it.
        this.laneRenderer.renderHardwareDeck(ctx, state, this.cache);
        this.receptorRenderer.render(ctx, state, this.cache, inputStates);

        // 4. Hit Effects (Optimized Bloom)
        // High-Intensity Beam/Glow (Zero Clip for Performance, relies on exact coordinates)
        ctx.save();
        
        // Floor Glow
        this.laneRenderer.renderActiveLanes(ctx, state, this.cache, inputStates);

        // Natural Vertical Bloom Beams
        ctx.globalCompositeOperation = 'lighter';
        ctx.save(); // Batch beam state
        for (let i = 0; i < state.laneCount; i++) {
            if (inputStates[i]) {
                this.drawLaneBeam(ctx, i, state);
            }
        }
        ctx.restore();
        
        ctx.restore();
    }

    private renderCharacterOverlay(ctx: CanvasRenderingContext2D, state: HighwayRenderState): void {
        const { characterImage, comboAnim, width, horizonY, hitLineY } = state;
        if (!characterImage || !characterImage.complete || characterImage.naturalWidth === 0) return;

        ctx.save();
        
        // Position: Centered between Horizon and Hitline
        const centerX = width / 2;
        const centerY = horizonY + (hitLineY - horizonY) * 0.65; // Slightly lower for better visibility
        
        const highwayHeight = hitLineY - horizonY;
        const pulse = comboAnim || 0;
        const baseSize = highwayHeight * 0.55;
        const size = baseSize * (1 + pulse * 0.12);
        
        ctx.globalAlpha = 0.35; // Semi-transparent
        
        // Emotion logic
        let emotionX = 0; // IDLE
        let emotionY = 0;
        
        if (state.lastJudgment === Judgment.MISS) {
            emotionX = 0; emotionY = 1; // SAD
        } else if (pulse > 0.01) {
            emotionX = 1; emotionY = 0; // HAPPY
        }
        
        const sw = characterImage.naturalWidth / 2;
        const sh = characterImage.naturalHeight / 2;
        const ratio = sw / sh;
        
        // Letterbox 모드: 세로를 기준으로 꽉 채우고 가로 비율을 맞춤
        const drawHeight = size;
        const drawWidth = size * ratio;
        const drawX = centerX - drawWidth / 2;
        const drawY = centerY - drawHeight / 2;
        
        ctx.drawImage(
            characterImage,
            emotionX * sw, emotionY * sh, sw, sh,
            drawX, drawY, drawWidth, drawHeight
        );
        
        ctx.restore();
    }

    private renderNotes(ctx: CanvasRenderingContext2D, state: HighwayRenderState, visualNotes: VisualNote[], lastNoteIndex: number, alpha: number = 0): void {
        const timeToReachHitLine = 2000 / state.scrollSpeed;
        const FIXED_STEP = 1000 / 60;
        const interpolatedTime = state.currentTime + (FIXED_STEP * alpha);
        const windowStart = interpolatedTime - 500;
        const windowEnd = interpolatedTime + timeToReachHitLine * HIGHWAY_CONFIG.NOTE_LOOKAHEAD;

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

        if (this.visibleNoteCount === 0) return;

        const horizonY = state.horizonY;
        const hitLineY = state.hitLineY;
        const baseNoteH = (HIGHWAY_CONFIG as any).NOTE_HEIGHT || LAYOUT.DEFAULT_NOTE_WIDTH / 2;
        const hRangeInv = 1 / (hitLineY - horizonY);

        ctx.save(); 

        for (let j = this.visibleNoteCount - 1; j >= 0; j--) {
            const note = visualNotes[this.visibleIndices[j]];
            const noteTimeMs = note.time * 1000;
            const timeDiff = noteTimeMs - interpolatedTime;
            let linearProgress = 1 - (timeDiff / timeToReachHitLine);
            if (note.isHold && linearProgress > 1) linearProgress = 1;

            const noteY = this.cache.getProjectedY(linearProgress, state);
            if (noteY < horizonY) continue;

            const projectedScale = (noteY - horizonY) * hRangeInv;
            const nW = this.cache.getWidth(noteY, state);
            const nX = this.cache.getX(note.lane, noteY, state);
            const nH = baseNoteH * projectedScale;

            let noteAlpha = 1.0;
            if (linearProgress < HIGHWAY_CONFIG.NOTE_FADE_THRESHOLD) {
                noteAlpha = Math.max(0, linearProgress / HIGHWAY_CONFIG.NOTE_FADE_THRESHOLD);
            }

            if (note.isHold) {
                const tailTime = note.time + (note.durationMs / 1000);
                const timeDiffTail = (tailTime * 1000) - interpolatedTime;
                let tailProgress = 1 - (timeDiffTail / timeToReachHitLine);
                if (tailProgress > 1) tailProgress = 1;

                const tailY = this.cache.getProjectedY(tailProgress, state);
                const tailScale = (tailY - horizonY) * hRangeInv;
                const tailH = baseNoteH * tailScale;

                this.holdRenderer.renderHoldNote(ctx, state, this.cache, note.lane, nX, noteY, nW, nH, tailY, tailH, note.isHolding, noteAlpha);
            } else {
                this.noteRenderer.renderTapNote(ctx, nX, noteY, nW, nH, note.lane, noteAlpha);
            }
        }
        ctx.restore();
    }

    /**
     * Optimized Lane Beam: Draws a vertical atmospheric glow centered on the lane.
     * Prevents "blocky trapezoid" look and improves performance.
     */
    private drawLaneBeam(ctx: CanvasRenderingContext2D, lane: number, state: HighwayRenderState): void {
        const beamGrad = this.beamGradients[lane];
        if (!beamGrad) return;

        // Draw a centralized atmospheric column rather than filling the whole lane width trapezoid
        const midXTop = this.cache.getX(lane + 0.5, state.horizonY, state);
        const midXBot = this.cache.getX(lane + 0.5, state.hitLineY, state);
        const beamHalfW = this.cache.getWidth(state.hitLineY, state) * 0.45;

        ctx.save();
        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        // Slightly flare toward bottom to follow perspective naturally
        ctx.moveTo(midXTop - 2, state.horizonY);
        ctx.lineTo(midXTop + 2, state.horizonY);
        ctx.lineTo(midXBot + beamHalfW, state.hitLineY);
        ctx.lineTo(midXBot - beamHalfW, state.hitLineY);
        ctx.fill();
        ctx.restore();
    }

    /** @deprecated Use renderBackground and renderDynamic for layered rendering */
    public render(ctx: CanvasRenderingContext2D, state: HighwayRenderState, visualNotes: VisualNote[], lastNoteIndex: number, _holdingLanes: (VisualNote | null)[], inputManager: RhythmInputManager): void {
        this.renderBackground(ctx, state);
        this.renderDynamic(ctx, state, visualNotes, lastNoteIndex, inputManager);
    }
}
