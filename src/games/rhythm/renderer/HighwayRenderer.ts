import { RenderCache } from '../graphics/RenderCache';
import { ThemeManager } from '../../../core/ThemeManager';
import type { VisualNote } from '../NoteFactory';
import { RhythmInputManager } from '../input/RhythmInputManager';
import { JudgmentSystem } from '../systems/JudgmentSystem';
import { LANE_COLORS } from '../constants/GameConstants';
import * as PerspectiveUtils from './PerspectiveUtils';
import * as UIUtils from './UIUtils';

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

const HIGHWAY_CONFIG = {
    RAIL_WIDTH: 14,
    DIVIDER_ALPHA: 0.1,
    LOCKED_LANE_BG: 'rgba(10, 0, 0, 0.55)',
    LOCKED_TEXT_ALPHA: 'rgba(255, 50, 50, 0.4)',
    ACTIVE_LANE_ALPHA: 0.3,
    RECEPTOR_SCALE: 1.0,
    NOTE_LOOKAHEAD: 3.0,
    PERSPECTIVE_DEPTH: 4,
    HOLD_BODY_RATIO: 0.92,
    RECEPTOR_LOCKED_ALPHA: 0.1,
    NOTE_FADE_THRESHOLD: 0.1,
    BEAM_ALPHA_START: 0.4
} as const;

/**
 * HighwayRenderer handles all 3D-perspective rendering for the rhythm game highway.
 */
export class HighwayRenderer {
    private renderCache: RenderCache;
    private beamGradients: (CanvasGradient | null)[] = new Array(6).fill(null);
    private activeLaneGradients: (CanvasGradient | null)[] = new Array(6).fill(null);

    // Perspective Caches
    private perspectiveWidthCache: Float32Array = new Float32Array(200);
    private perspectiveXCache: Float32Array[] = Array.from({ length: 7 }, () => new Float32Array(200));

    constructor(renderCache: RenderCache, _judgmentSystem: JudgmentSystem) {
        this.renderCache = renderCache;
    }

    public onResize(ctx: CanvasRenderingContext2D, _laneCount: number, horizonY: number, hitLineY: number, state: HighwayRenderState): void {
        const beamRange = hitLineY - horizonY;
        const beamTopY = hitLineY - beamRange * 0.6; // Consistent 60% limit for both

        // 1. Pre-generate Beam Gradients (Held Notes)
        this.beamGradients = LANE_COLORS.map(colorSet => {
            const grad = ctx.createLinearGradient(0, hitLineY, 0, beamTopY);
            const color = colorSet[0];
            const r = parseInt(color.substring(1, 3), 16);
            const g = parseInt(color.substring(3, 5), 16);
            const b = parseInt(color.substring(5, 7), 16);

            const startAlpha = HIGHWAY_CONFIG.BEAM_ALPHA_START * 2.0; // Intensified start
            grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${startAlpha})`);
            grad.addColorStop(0.33, `rgba(${r}, ${g}, ${b}, ${startAlpha * 0.4})`); // 20% of highway: faint but visible
            grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.0)`); // Fully invisible at 60% point
            return grad;
        });

        // 2. Pre-generate Active Lane Gradients (Key Press Flash)
        this.activeLaneGradients = LANE_COLORS.map(colorSet => {
            const grad = ctx.createLinearGradient(0, hitLineY, 0, beamTopY);
            const color = colorSet[0];
            const r = parseInt(color.substring(1, 3), 16);
            const g = parseInt(color.substring(3, 5), 16);
            const b = parseInt(color.substring(5, 7), 16);

            const startAlpha = HIGHWAY_CONFIG.ACTIVE_LANE_ALPHA * 1.5;
            grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${startAlpha})`);
            grad.addColorStop(0.33, `rgba(${r}, ${g}, ${b}, ${startAlpha * 0.4})`); // 20% of highway: faint but visible
            grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.0)`); // 60% invisible
            return grad;
        });

        // 3. Build Perspective Cache Table
        this.buildPerspectiveCache(state);
    }

    private buildPerspectiveCache(state: HighwayRenderState): void {
        const steps = this.perspectiveWidthCache.length;
        const h = state.bottomY - state.horizonY;

        for (let i = 0; i < steps; i++) {
            const y = state.horizonY + (i / (steps - 1)) * h;
            this.perspectiveWidthCache[i] = this.getPerspectiveWidth(y, state);
            for (let lane = 0; lane <= state.laneCount; lane++) {
                this.perspectiveXCache[lane][i] = this.getPerspectiveX(lane, y, state);
            }
        }
    }

    private getCachedWidth(y: number, state: HighwayRenderState): number {
        const steps = this.perspectiveWidthCache.length;
        const normalizedY = ((y - state.horizonY) / (state.bottomY - state.horizonY)) * (steps - 1);
        const idx = Math.max(0, Math.min(steps - 1, Math.floor(normalizedY)));
        return this.perspectiveWidthCache[idx];
    }

    private getCachedX(lane: number, y: number, state: HighwayRenderState): number {
        const steps = this.perspectiveWidthCache.length;
        const normalizedY = ((y - state.horizonY) / (state.bottomY - state.horizonY)) * (steps - 1);
        const idx = Math.max(0, Math.min(steps - 1, Math.floor(normalizedY)));
        return this.perspectiveXCache[lane][idx];
    }

    private withAlpha(ctx: CanvasRenderingContext2D, alpha: number, fn: () => void): void {
        const prevAlpha = ctx.globalAlpha;
        ctx.globalAlpha *= alpha;
        fn();
        ctx.globalAlpha = prevAlpha;
    }

    public render(ctx: CanvasRenderingContext2D, state: HighwayRenderState, visualNotes: VisualNote[], lastNoteIndex: number, holdingLanes: (VisualNote | null)[], inputManager: RhythmInputManager): void {
        ctx.save();

        this.renderBackground(ctx, state);
        this.renderLockedLanes(ctx, state);
        this.renderActiveLanes(ctx, state, inputManager);
        this.renderHitZone(ctx, state, inputManager);
        this.renderNotes(ctx, state, visualNotes, lastNoteIndex, holdingLanes);

        // Render Lane Beams
        holdingLanes.forEach((note, lane) => {
            if (note) this.drawLaneBeam(ctx, lane, state);
        });

        ctx.restore();
    }


    private drawLaneBeam(ctx: CanvasRenderingContext2D, lane: number, state: HighwayRenderState): void {
        const beamTopY = state.hitLineY - (state.hitLineY - state.horizonY) * 0.6;
        const tl = { x: this.getCachedX(lane, beamTopY, state), y: beamTopY };
        const tr = { x: this.getCachedX(lane + 1, beamTopY, state), y: beamTopY };
        const bl = { x: this.getCachedX(lane, state.hitLineY, state), y: state.hitLineY };
        const br = { x: this.getCachedX(lane + 1, state.hitLineY, state), y: state.hitLineY };

        const grad = this.beamGradients[lane];
        if (grad) {
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(tl.x, tl.y); ctx.lineTo(tr.x, tr.y); ctx.lineTo(br.x, br.y); ctx.lineTo(bl.x, bl.y);
            ctx.fill();
        }
    }

    private renderBackground(ctx: CanvasRenderingContext2D, state: HighwayRenderState): void {
        const pulse = (Math.sin(state.cachedNow / 300) + 1) * 0.5;
        const theme = ThemeManager.getInstance().getCurrentTheme();

        // 1. Theme-specific Engine Background (Removed: Using global BackgroundRenderer)

        // 2. Atmosphere Integration (Skip on mobile for performance)
        if (!state.isMobile) {
            ctx.save();
            ctx.globalAlpha = 0.4 + pulse * 0.1;
            UIUtils.drawAtmosphere(ctx, state.width, state.height);
            ctx.restore();
        }

        // 3. Render Highway Road
        this.renderRoad(ctx, state);

        // 4. Render Dividers with Subtle Neon
        this.renderDividers(ctx, state, theme, pulse);

        // 5. Render Pulse Side Rails
        this.renderPulseRails(ctx, state, theme, pulse);
    }

    private renderRoad(ctx: CanvasRenderingContext2D, state: HighwayRenderState): void {
        const tl = { x: this.getCachedX(0, state.horizonY, state), y: state.horizonY };
        const tr = { x: this.getCachedX(state.laneCount, state.horizonY, state), y: state.horizonY };
        const bl = { x: this.getCachedX(0, state.bottomY, state), y: state.bottomY };
        const br = { x: this.getCachedX(state.laneCount, state.bottomY, state), y: state.bottomY };

        const roadGrad = ctx.createLinearGradient(0, state.horizonY, 0, state.bottomY);
        roadGrad.addColorStop(0, 'rgba(10, 10, 30, 0.4)');
        roadGrad.addColorStop(1, 'rgba(5, 5, 20, 0.9)');

        ctx.fillStyle = roadGrad;
        ctx.beginPath();
        ctx.moveTo(tl.x, tl.y); ctx.lineTo(tr.x, tr.y); ctx.lineTo(br.x, br.y); ctx.lineTo(bl.x, bl.y);
        ctx.fill();
    }

    private renderDividers(ctx: CanvasRenderingContext2D, state: HighwayRenderState, theme: any, pulse: number): void {
        ctx.save();
        for (let i = 1; i < state.laneCount; i++) {
            const topX = this.getCachedX(i, state.horizonY, state);
            const botX = this.getCachedX(i, state.bottomY, state);

            ctx.strokeStyle = `rgba(255, 255, 255, ${HIGHWAY_CONFIG.DIVIDER_ALPHA + pulse * 0.05})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(topX, state.horizonY); ctx.lineTo(botX, state.bottomY);
            ctx.stroke();

            if (pulse > 0.6) {
                ctx.strokeStyle = theme.color2 + '33';
                ctx.lineWidth = 3;
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    private renderPulseRails(ctx: CanvasRenderingContext2D, state: HighwayRenderState, theme: any, pulse: number): void {
        const tl = { x: this.getCachedX(0, state.horizonY, state), y: state.horizonY };
        const tr = { x: this.getCachedX(state.laneCount, state.horizonY, state), y: state.horizonY };
        const bl = { x: this.getCachedX(0, state.bottomY, state), y: state.bottomY };
        const br = { x: this.getCachedX(state.laneCount, state.bottomY, state), y: state.bottomY };
        const railW = HIGHWAY_CONFIG.RAIL_WIDTH;

        ctx.save();
        const lGrad = ctx.createLinearGradient(tl.x - railW, 0, tl.x, 0);
        lGrad.addColorStop(0, theme.color1);
        lGrad.addColorStop(0.5 + pulse * 0.2, theme.color2);
        lGrad.addColorStop(1, theme.color1);
        ctx.fillStyle = lGrad;
        ctx.shadowBlur = 12 * pulse;
        ctx.shadowColor = theme.color2;
        ctx.beginPath();
        ctx.moveTo(tl.x - railW, tl.y); ctx.lineTo(tl.x, tl.y); ctx.lineTo(bl.x, bl.y); ctx.lineTo(bl.x - railW * 2, bl.y);
        ctx.fill();

        const rGrad = ctx.createLinearGradient(tr.x, 0, tr.x + railW, 0);
        rGrad.addColorStop(0, theme.color1);
        rGrad.addColorStop(0.5 + pulse * 0.2, theme.color2);
        rGrad.addColorStop(1, theme.color1);
        ctx.fillStyle = rGrad;
        ctx.beginPath();
        ctx.moveTo(tr.x, tr.y); ctx.lineTo(tr.x + railW, tr.y); ctx.lineTo(br.x + railW * 2, br.y); ctx.lineTo(br.x, br.y);
        ctx.fill();
        ctx.restore();
    }

    private renderLockedLanes(ctx: CanvasRenderingContext2D, state: HighwayRenderState): void {
        if (state.keyMode === 4) {
            const lockedLanes = [0, 5];
            for (const lane of lockedLanes) {
                const lX1 = this.getCachedX(lane, state.horizonY, state);
                const rX1 = this.getCachedX(lane + 1, state.horizonY, state);
                const lX2 = this.getCachedX(lane, state.bottomY, state);
                const rX2 = this.getCachedX(lane + 1, state.bottomY, state);

                // 1. Fill base dark color
                ctx.beginPath();
                ctx.moveTo(lX1, state.horizonY); ctx.lineTo(rX1, state.horizonY);
                ctx.lineTo(rX2, state.bottomY); ctx.lineTo(lX2, state.bottomY);
                ctx.fillStyle = HIGHWAY_CONFIG.LOCKED_LANE_BG;
                ctx.fill();

                // 2. Draw warning stripes with clipping
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(lX1, state.horizonY); ctx.lineTo(rX1, state.horizonY);
                ctx.lineTo(rX2, state.bottomY); ctx.lineTo(lX2, state.bottomY);
                ctx.clip();

                ctx.lineWidth = 12;
                ctx.strokeStyle = 'rgba(255, 50, 50, 0.15)';
                const laneW = Math.max(rX1 - lX1, rX2 - lX2);
                for (let y = state.horizonY - laneW; y < state.bottomY + laneW; y += 50) {
                    ctx.beginPath();
                    ctx.moveTo(lX2 - laneW, y);
                    ctx.lineTo(rX2 + laneW, y + laneW * 2);
                    ctx.stroke();
                }
                ctx.restore();

                // 3. Render Text
                const textY = state.bottomY - 80;
                const textX = (this.getCachedX(lane, textY, state) + this.getCachedX(lane + 1, textY, state)) / 2;
                ctx.save();
                ctx.translate(textX, textY);
                ctx.rotate(-Math.PI / 2);
                ctx.font = 'bold 20px "Orbitron", sans-serif';
                ctx.fillStyle = HIGHWAY_CONFIG.LOCKED_TEXT_ALPHA;
                ctx.textAlign = 'center';
                ctx.letterSpacing = '8px';
                ctx.fillText('LOCKED', 0, 0);
                ctx.restore();
            }
        }
    }

    private renderActiveLanes(ctx: CanvasRenderingContext2D, state: HighwayRenderState, inputManager: RhythmInputManager): void {
        for (let i = 0; i < state.laneCount; i++) {
            if (inputManager.getKeyState(i)) {
                // Shortened flash area (60% of highway)
                const beamTopY = state.hitLineY - (state.hitLineY - state.horizonY) * 0.6;
                const tl = { x: this.getCachedX(i, beamTopY, state), y: beamTopY };
                const tr = { x: this.getCachedX(i + 1, beamTopY, state), y: beamTopY };
                const bl = { x: this.getCachedX(i, state.hitLineY, state), y: state.hitLineY };
                const br = { x: this.getCachedX(i + 1, state.hitLineY, state), y: state.hitLineY };

                const lightGrad = this.activeLaneGradients[i];
                if (lightGrad) {
                    ctx.beginPath();
                    ctx.moveTo(tl.x, tl.y); ctx.lineTo(tr.x, tr.y); ctx.lineTo(br.x, br.y); ctx.lineTo(bl.x, bl.y);
                    ctx.fillStyle = lightGrad;
                    ctx.fill();
                }
            }
        }
    }

    private renderHitZone(ctx: CanvasRenderingContext2D, state: HighwayRenderState, inputManager: RhythmInputManager): void {
        const laneW = this.getCachedWidth(state.hitLineY, state);
        const hitH = 50; // Base note height at the hitline (projectedProgress = 1)

        for (let i = 0; i < state.laneCount; i++) {
            const laneX = this.getCachedX(i, state.hitLineY, state);
            const isActive = inputManager.getKeyState(i);

            // RenderCache generates both states, but we need to retrieve the right one.
            const receptorImg = isActive ? this.renderCache.receptorsActive[i] : this.renderCache.receptors[i];

            if (receptorImg) {
                // Receptors have 20px padding on each side (total 40px)
                // Base NOTE_WIDTH is 100, meaning total canvas width is 140.
                // Standard notes only have 15px padding (total 30px, canvas 130).
                // To display the core 100px width at exactly `laneW`, we scale by (img.width / 100)
                const paddingRatioX = receptorImg.width / 100;
                const paddingRatioY = receptorImg.height / 50;

                // Removed the -4 inset to perfectly match the lane boundaries
                const drawW = laneW * paddingRatioX;
                const drawH = hitH * paddingRatioY;

                // Use precise coordinates from PerspectiveUtils
                const drawX = laneX + laneW / 2 - drawW / 2;
                const drawY = state.hitLineY - drawH / 2;

                const isLocked = state.keyMode === 4 && (i === 0 || i === 5);

                ctx.save();
                if (isLocked) {
                    ctx.globalAlpha = HIGHWAY_CONFIG.RECEPTOR_LOCKED_ALPHA * 0.5;
                } else {
                    // --- Improved Ground Light Effect ---
                    // Draw a soft glow beneath the receptor to anchor it to the lane
                    const laneHueColor = LANE_COLORS[i % LANE_COLORS.length][1];
                    const r = parseInt(laneHueColor.substring(1, 3), 16);
                    const g = parseInt(laneHueColor.substring(3, 5), 16);
                    const b = parseInt(laneHueColor.substring(5, 7), 16);

                    const groundGrad = ctx.createRadialGradient(
                        laneX + laneW / 2, state.hitLineY, 0,
                        laneX + laneW / 2, state.hitLineY, laneW * 0.8 // Reduced from 1.5
                    );

                    const glowAlpha = isActive ? 0.4 : 0.1; // Reduced from 0.6/0.2
                    groundGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${glowAlpha})`);
                    groundGrad.addColorStop(1, 'rgba(0,0,0,0)');

                    ctx.fillStyle = groundGrad;
                    ctx.save();
                    ctx.globalCompositeOperation = 'screen';
                    ctx.beginPath();
                    ctx.ellipse(laneX + laneW / 2, state.hitLineY, laneW * 0.7, hitH * 0.4, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }

                ctx.drawImage(receptorImg, drawX, drawY, drawW, drawH);
                ctx.restore();
            }
        }

        // Render Stable Full-Width Occlusion below the hit zone
        const occlusionTop = state.hitLineY + hitH / 2;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, occlusionTop, state.width, state.height - occlusionTop);
    }

    private renderNotes(ctx: CanvasRenderingContext2D, state: HighwayRenderState, visualNotes: VisualNote[], lastNoteIndex: number, _holdingLanes: (VisualNote | null)[]): void {
        const timeToReachHitLine = 2000 / state.scrollSpeed;
        const windowStart = state.currentTime - 500;
        const lookAheadMultiplier = HIGHWAY_CONFIG.NOTE_LOOKAHEAD;
        const windowEnd = state.currentTime + timeToReachHitLine * lookAheadMultiplier;

        const visibleIndices: number[] = [];
        for (let i = lastNoteIndex; i < visualNotes.length; i++) {
            const note = visualNotes[i];
            const noteTimeMs = note.time * 1000;
            const noteEndMs = note.isHold ? noteTimeMs + note.durationMs : noteTimeMs;
            if (noteTimeMs > windowEnd) break;
            if (note.isProcessed && !note.isHolding) continue;
            if (noteEndMs < windowStart) continue;
            visibleIndices.push(i);
        }

        // Draw furthest notes first (Back-to-Front)
        for (let j = visibleIndices.length - 1; j >= 0; j--) {
            const note = visualNotes[visibleIndices[j]];
            const noteTimeMs = note.time * 1000;
            const timeDiff = noteTimeMs - state.currentTime;
            let linearProgress = 1 - (timeDiff / timeToReachHitLine);
            if (note.isHold && linearProgress > 1) linearProgress = 1;

            const pDepth = HIGHWAY_CONFIG.PERSPECTIVE_DEPTH;
            const projectedProgress = linearProgress / (pDepth - (pDepth - 1) * linearProgress);
            const noteY = state.horizonY + (state.hitLineY - state.horizonY) * projectedProgress;
            if (noteY < state.horizonY) continue;

            const noteWidth = this.getCachedWidth(noteY, state);
            const noteX = this.getCachedX(note.lane, noteY, state);
            const noteHeight = 50 * projectedProgress;

            let alpha = 1.0;
            if (linearProgress < HIGHWAY_CONFIG.NOTE_FADE_THRESHOLD) alpha = Math.max(0, linearProgress / HIGHWAY_CONFIG.NOTE_FADE_THRESHOLD);

            if (note.isHold) {
                const tailTime = note.time + (note.durationMs / 1000);
                const timeDiffTail = (tailTime * 1000) - state.currentTime;
                let tailProgress = 1 - (timeDiffTail / timeToReachHitLine);
                if (tailProgress > 1) tailProgress = 1;
                const pTail = tailProgress / (pDepth - (pDepth - 1) * tailProgress);
                const tailY = state.horizonY + (state.hitLineY - state.horizonY) * pTail;
                const tailH = 50 * pTail;
                this.drawLongNote(ctx, state, note.lane, noteX, noteY, noteWidth, noteHeight, tailY, tailH, note.isHolding, alpha);
            } else {
                this.drawGelNote(ctx, noteX, noteY, noteWidth, noteHeight, note.lane, alpha);
            }
        }
    }

    private drawLongNote(ctx: CanvasRenderingContext2D, state: HighwayRenderState, lane: number, headX: number, headY: number, headW: number, headH: number, tailY: number, tailH: number, isHolding: boolean, globalAlpha: number): void {
        const bodyRatio = HIGHWAY_CONFIG.HOLD_BODY_RATIO;
        const visualTailY = Math.max(state.horizonY, tailY);
        const visualTailW = this.getCachedWidth(visualTailY, state);
        const visualTailX = this.getCachedX(lane, visualTailY, state);
        if (visualTailY > headY) return;

        // Body ends exactly at head center (headY) and tail center (visualTailY)
        const bodyTopY = visualTailY;
        const bodyBotY = headY;

        let alpha = isHolding ? 1.0 : 0.95;
        if (isHolding) alpha = Math.sin(state.cachedNow * 0.02) * 0.05 + 0.95;

        if (bodyTopY < bodyBotY) {
            this.withAlpha(ctx, alpha * globalAlpha, () => {
                const sliceCount = state.isMobile ? 16 : 48;
                const totalHeight = bodyBotY - bodyTopY;
                const laneColor = LANE_COLORS[lane % LANE_COLORS.length][0];
                // Idle: High desaturation (0.7) for a muted look. Holding: Full saturated/bright color.
                const baseColor = isHolding ? laneColor : UIUtils.desaturateColor(laneColor, 0.7);

                // 1. Create Body Path (Path2D for reuse)
                const bodyPath = new Path2D();
                for (let i = 0; i <= sliceCount; i++) {
                    const y = bodyTopY + (totalHeight * (i / sliceCount));
                    const w = this.getCachedWidth(y, state);
                    const halfW = (w * bodyRatio) * 0.5;
                    const x = this.getCachedX(lane, y, state) + w * 0.5;
                    if (i === 0) bodyPath.moveTo(x - halfW, y);
                    else bodyPath.lineTo(x - halfW, y);
                }
                for (let i = sliceCount; i >= 0; i--) {
                    const y = bodyTopY + (totalHeight * (i / sliceCount));
                    const w = this.getCachedWidth(y, state);
                    const halfW = (w * bodyRatio) * 0.5;
                    const x = this.getCachedX(lane, y, state) + w * 0.5;
                    bodyPath.lineTo(x + halfW, y);
                }
                bodyPath.closePath();

                // 2. Solid Base Fill (Force 1.0 opacity inside withAlpha)
                ctx.globalCompositeOperation = 'source-over';
                ctx.fillStyle = baseColor;
                ctx.fill(bodyPath);

                // 3. Central Spine (Returning as high-intensity guide)
                ctx.beginPath();
                for (let i = 0; i <= sliceCount; i++) {
                    const y = bodyTopY + (totalHeight * (i / sliceCount));
                    const w = this.getCachedWidth(y, state);
                    const x = this.getCachedX(lane, y, state) + w * 0.5;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
                ctx.lineWidth = 3.5;
                ctx.stroke();

                // 4. Vibrant Cylindrical Highlight
                const midY = (bodyTopY + bodyBotY) * 0.5;
                const midW = this.getCachedWidth(midY, state);
                const midCX = this.getCachedX(lane, midY, state) + midW * 0.5;
                const gW = midW * bodyRatio;

                const grad = ctx.createLinearGradient(midCX - gW * 0.5, 0, midCX + gW * 0.5, 0);
                grad.addColorStop(0, 'rgba(0, 0, 0, 0.4)');
                grad.addColorStop(0.2, 'rgba(0, 0, 0, 0.1)');
                grad.addColorStop(0.5, `rgba(255, 255, 255, ${alpha * 0.6})`);
                grad.addColorStop(0.8, 'rgba(0, 0, 0, 0.1)');
                grad.addColorStop(1, 'rgba(0, 0, 0, 0.4)');

                ctx.fillStyle = grad;
                ctx.fill(bodyPath);

                // 5. HD Boundary
                ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
                ctx.lineWidth = 1.5;
                ctx.stroke(bodyPath);
            });
        }

        // Draw caps
        const rHeadW = headW * bodyRatio;
        const srTailW = visualTailW * bodyRatio;
        const rHeadX = headX + (headW - rHeadW) * 0.5;
        const rTailX = visualTailX + (visualTailW - srTailW) * 0.5;

        // Draw body first, then caps (so caps are on top)
        // Body is drawn above via withAlpha... wait, the user wants body UNDER.
        // In drawLongNote, the withAlpha block for body happens before drawing caps.
        // So tail and head caps will naturally be ABOVE the body.
        if (tailY >= state.horizonY) {
            this.drawGelNote(ctx, rTailX, tailY, srTailW, tailH * 0.5, lane, globalAlpha); // Half height for tail distinguishing
        }
        this.drawGelNote(ctx, rHeadX, headY, rHeadW, headH, lane, globalAlpha);
    }

    private drawGelNote(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, lane: number, alpha: number): void {
        const noteImg = this.renderCache.notes[lane];
        if (noteImg) {
            this.withAlpha(ctx, alpha, () => {
                const paddingRatioX = noteImg.width / 100;
                const paddingRatioY = noteImg.height / 50;

                // Use simple scaling based on input w and h (matches renderHitZone logic)
                const drawW = Math.round(w * paddingRatioX);
                const drawH = Math.round(h * paddingRatioY);
                const drawX = Math.round((x + w / 2) - drawW / 2);
                const drawY = Math.round(y - drawH / 2);

                ctx.drawImage(noteImg, drawX, drawY, drawW, drawH);
            });
        }
    }

    private getPerspectiveX(laneIndex: number, y: number, state: HighwayRenderState): number {
        return PerspectiveUtils.getPerspectiveX(laneIndex, y, state);
    }

    private getPerspectiveWidth(y: number, state: HighwayRenderState): number {
        return PerspectiveUtils.getPerspectiveWidth(y, state);
    }

}
