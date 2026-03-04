import { RenderCache } from '../graphics/RenderCache';
import { ThemeManager } from '../../../core/ThemeManager';
import { HIT_LINE_GLOW } from '../constants/GameConstants';
import type { VisualNote } from '../NoteFactory';
import { RhythmInputManager } from '../input/RhythmInputManager';
import type { IThemeStrategy } from '../themes/IThemeStrategy';
import { JudgmentSystem } from '../systems/JudgmentSystem';

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
}

/**
 * HighwayRenderer handles all 3D-perspective rendering for the rhythm game highway.
 */
export class HighwayRenderer {
    private renderCache: RenderCache;
    private themeStrategy: IThemeStrategy;
    private beamGradients: (CanvasGradient | null)[] = new Array(6).fill(null);

    constructor(renderCache: RenderCache, _judgmentSystem: JudgmentSystem, themeStrategy: IThemeStrategy) {
        this.renderCache = renderCache;
        this.themeStrategy = themeStrategy;
    }

    public onResize(ctx: CanvasRenderingContext2D, _laneCount: number, horizonY: number, hitLineY: number): void {
        const LANE_COLORS: string[][] = [
            ['#FF3366', '#FF3366'],
            ['#33CCFF', '#33CCFF'],
            ['#FFFF33', '#FFFF33'],
            ['#33FF33', '#33FF33'],
            ['#FF9933', '#FF9933'],
            ['#CC33FF', '#CC33FF']
        ];

        this.beamGradients = LANE_COLORS.map(colorSet => {
            const grad = ctx.createLinearGradient(0, hitLineY, 0, horizonY);
            const color = colorSet[1];
            grad.addColorStop(0, `rgba(${parseInt(color.substring(1, 3), 16)}, ${parseInt(color.substring(3, 5), 16)}, ${parseInt(color.substring(5, 7), 16)}, 0.3)`);
            grad.addColorStop(1, `rgba(${parseInt(color.substring(1, 3), 16)}, ${parseInt(color.substring(3, 5), 16)}, ${parseInt(color.substring(5, 7), 16)}, 0.0)`);
            return grad;
        });
    }

    public render(ctx: CanvasRenderingContext2D, state: HighwayRenderState, inputManager: RhythmInputManager, visualNotes: VisualNote[], holdingLanes: (VisualNote | null)[], lastNoteIndex: number): void {
        this.renderBackground(ctx, state);
        this.renderLockedLanes(ctx, state);
        this.renderActiveLanes(ctx, state, inputManager);
        this.renderHitZone(ctx, state);
        this.renderNotes(ctx, state, visualNotes, lastNoteIndex, holdingLanes);

        // Render Lane Beams
        holdingLanes.forEach((note, lane) => {
            if (note) this.drawLaneBeam(ctx, lane, state);
        });
    }

    private drawLaneBeam(ctx: CanvasRenderingContext2D, lane: number, state: HighwayRenderState): void {
        const tl = { x: this.getPerspectiveX(lane, state.horizonY, state), y: state.horizonY };
        const tr = { x: this.getPerspectiveX(lane + 1, state.horizonY, state), y: state.horizonY };
        const bl = { x: this.getPerspectiveX(lane, state.hitLineY, state), y: state.hitLineY };
        const br = { x: this.getPerspectiveX(lane + 1, state.hitLineY, state), y: state.hitLineY };

        const grad = this.beamGradients[lane];
        if (grad) {
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(tl.x, tl.y); ctx.lineTo(tr.x, tr.y); ctx.lineTo(br.x, br.y); ctx.lineTo(bl.x, bl.y);
            ctx.fill();
        }
    }

    private renderBackground(ctx: CanvasRenderingContext2D, state: HighwayRenderState): void {
        this.themeStrategy.renderBackground(ctx, state.width, state.height, state.horizonY, state.bottomY);

        // Render existing cached background rails if they exist (legacy support)
        if (this.renderCache && this.renderCache.highwayBackground) {
            ctx.globalAlpha = 0.5; // Lower alpha as it's now layered
            ctx.drawImage(this.renderCache.highwayBackground, 0, 0);
            ctx.globalAlpha = 1.0;
        } else {
            const tl = { x: this.getPerspectiveX(0, state.horizonY, state), y: state.horizonY };
            const bl = { x: this.getPerspectiveX(0, state.bottomY, state), y: state.bottomY };

            const railWidth = 14;
            const theme = ThemeManager.getInstance().getCurrentTheme();

            // Left Rail
            const leftGrad = ctx.createLinearGradient(0, state.horizonY, 0, state.bottomY);
            leftGrad.addColorStop(0, theme.color2);
            leftGrad.addColorStop(0.4, theme.color3);
            leftGrad.addColorStop(1, theme.color2);
            ctx.fillStyle = leftGrad;
            ctx.beginPath();
            ctx.moveTo(tl.x - railWidth, tl.y); ctx.lineTo(tl.x, tl.y); ctx.lineTo(bl.x, bl.y); ctx.lineTo(bl.x - railWidth * 2, bl.y);
            ctx.fill();

            // Dividers
            ctx.lineWidth = 1;
            for (let i = 1; i < state.laneCount; i++) {
                const topX = this.getPerspectiveX(i, state.horizonY, state);
                const botX = this.getPerspectiveX(i, state.bottomY, state);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.beginPath();
                ctx.moveTo(topX, state.horizonY); ctx.lineTo(botX, state.bottomY);
                ctx.stroke();
            }
        }
    }

    private renderLockedLanes(ctx: CanvasRenderingContext2D, state: HighwayRenderState): void {
        if (state.keyMode === 4) {
            const lockedLanes = [0, 5];
            for (const lane of lockedLanes) {
                const lX1 = this.getPerspectiveX(lane, state.horizonY, state);
                const rX1 = this.getPerspectiveX(lane + 1, state.horizonY, state);
                const lX2 = this.getPerspectiveX(lane, state.bottomY, state);
                const rX2 = this.getPerspectiveX(lane + 1, state.bottomY, state);

                ctx.save();
                ctx.beginPath();
                ctx.moveTo(lX1, state.horizonY); ctx.lineTo(rX1, state.horizonY);
                ctx.lineTo(rX2, state.bottomY); ctx.lineTo(lX2, state.bottomY);
                ctx.fillStyle = 'rgba(10, 0, 0, 0.55)';
                ctx.fill();
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

                const textY = state.bottomY - 80;
                const textX = (this.getPerspectiveX(lane, textY, state) + this.getPerspectiveX(lane + 1, textY, state)) / 2;
                ctx.font = 'bold 20px "Orbitron", sans-serif';
                ctx.fillStyle = 'rgba(255, 50, 50, 0.4)';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.rotate(-Math.PI / 2);
                // Note: rotation needs local coordinates or careful translation
                ctx.restore();

                // Simplified text for modular version to avoid complex matrix math here
                ctx.save();
                ctx.translate(textX, textY);
                ctx.rotate(-Math.PI / 2);
                ctx.font = 'bold 20px "Orbitron", sans-serif';
                ctx.fillStyle = 'rgba(255, 50, 50, 0.4)';
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
                const lX1 = this.getPerspectiveX(i, state.horizonY, state);
                const rX1 = this.getPerspectiveX(i + 1, state.horizonY, state);
                const lX2 = this.getPerspectiveX(i, state.bottomY, state);
                const rX2 = this.getPerspectiveX(i + 1, state.bottomY, state);
                ctx.beginPath();
                ctx.moveTo(lX1, state.horizonY); ctx.lineTo(rX1, state.horizonY); ctx.lineTo(rX2, state.bottomY); ctx.lineTo(lX2, state.bottomY);
                const lightGrad = ctx.createLinearGradient(0, state.hitLineY, 0, state.horizonY);
                lightGrad.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
                lightGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
                ctx.fillStyle = lightGrad;
                ctx.fill();
            }
        }
    }

    private renderHitZone(ctx: CanvasRenderingContext2D, state: HighwayRenderState): void {
        const leftX = this.getPerspectiveX(0, state.hitLineY, state);
        const rightX = this.getPerspectiveX(state.laneCount, state.hitLineY, state);

        ctx.save();
        // High-quality hit line with glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = HIT_LINE_GLOW;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(leftX, state.hitLineY);
        ctx.lineTo(rightX, state.hitLineY);
        ctx.stroke();

        // Subtle secondary line for depth
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(leftX, state.hitLineY + 2);
        ctx.lineTo(rightX, state.hitLineY + 2);
        ctx.stroke();
        ctx.restore();

        const laneW = this.getPerspectiveWidth(state.hitLineY, state);
        const drawW = laneW * 1.45; // Ensuring it's clearly larger than the notes (1.25x)
        const drawH = 50 * 1.45;    // Corresponding height scale
        const drawY = state.hitLineY - drawH * 0.5;

        for (let i = 0; i < state.laneCount; i++) {
            const laneX = this.getPerspectiveX(i, state.hitLineY, state);
            // Center receptor on the calculated lane width
            const drawX = (laneX + laneW / 2) - drawW / 2;
            const receptorImg = this.renderCache.receptors[i];
            if (receptorImg) {
                const isLocked = state.keyMode === 4 && (i === 0 || i === 5);
                ctx.save();
                if (isLocked) {
                    ctx.globalAlpha = 0.15;
                    ctx.filter = 'grayscale(100%) brightness(50%)';
                }
                ctx.drawImage(receptorImg, drawX, drawY, drawW, drawH);
                ctx.restore();
            }
        }
    }

    private renderNotes(ctx: CanvasRenderingContext2D, state: HighwayRenderState, visualNotes: VisualNote[], lastNoteIndex: number, _holdingLanes: (VisualNote | null)[]): void {
        const timeToReachHitLine = 2000 / state.scrollSpeed;
        const windowStart = state.currentTime - 500;
        const lookAheadMultiplier = 3.0;
        const windowEnd = state.currentTime + timeToReachHitLine * lookAheadMultiplier;

        for (let i = lastNoteIndex; i < visualNotes.length; i++) {
            const note = visualNotes[i];
            const noteTimeMs = note.time * 1000;
            const noteEndMs = note.isHold ? noteTimeMs + note.durationMs : noteTimeMs;

            if (noteTimeMs > windowEnd) break;
            if (note.isProcessed && !note.isHolding) continue;
            if (noteEndMs < windowStart) continue;

            const timeDiff = noteTimeMs - state.currentTime;
            let linearProgress = 1 - (timeDiff / timeToReachHitLine);
            if (note.isHold && linearProgress > 1) linearProgress = 1;

            const perspectiveDepth = 4;
            const projectedProgress = linearProgress / (perspectiveDepth - (perspectiveDepth - 1) * linearProgress);
            const noteY = state.horizonY + (state.hitLineY - state.horizonY) * projectedProgress;
            if (noteY < state.horizonY) continue;

            const noteWidth = this.getPerspectiveWidth(noteY, state);
            const noteX = this.getPerspectiveX(note.lane, noteY, state);
            const noteHeight = 50 * projectedProgress;

            let alpha = 1.0;
            if (linearProgress < 0.1) alpha = Math.max(0, linearProgress / 0.1);

            if (note.isHold) {
                const tailTime = note.time + (note.durationMs / 1000);
                const timeDiffTail = (tailTime * 1000) - state.currentTime;
                let tailProgress = 1 - (timeDiffTail / timeToReachHitLine);
                if (tailProgress > 1) tailProgress = 1;
                const pTail = tailProgress / (perspectiveDepth - (perspectiveDepth - 1) * tailProgress);
                const tailY = state.horizonY + (state.hitLineY - state.horizonY) * pTail;
                const tailH = 50 * pTail;
                this.drawLongNote(ctx, state, note.lane, noteX, noteY, noteWidth, noteHeight, tailY, tailH, note.isHolding, alpha);
            } else {
                this.drawGelNote(ctx, noteX, noteY, noteWidth, noteHeight, note.lane, alpha);
            }
        }
    }

    private drawLongNote(ctx: CanvasRenderingContext2D, state: HighwayRenderState, lane: number, headX: number, headY: number, headW: number, headH: number, tailY: number, tailH: number, isHolding: boolean, globalAlpha: number): void {
        if (tailY > headY) return;
        const tailW = this.getPerspectiveWidth(tailY, state);
        const tailX = this.getPerspectiveX(lane, tailY, state);
        const bodyRatio = 0.92;
        const tailCenterY = tailY + tailH * 0.5;
        const headCenterY = headY + headH * 0.5;
        const bodyTopY = tailCenterY;
        const bodyBotY = headCenterY;

        let alpha = isHolding ? 0.9 : 0.6;
        if (isHolding) alpha = Math.sin(state.cachedNow * 0.02) * 0.1 + 0.9;

        if (bodyTopY < bodyBotY) {
            const bTopW = this.getPerspectiveWidth(bodyTopY, state);
            const bBotW = this.getPerspectiveWidth(bodyBotY, state);
            const topCenterX = tailX + tailW * 0.5;
            const botCenterX = headX + headW * 0.5;
            const halfTop = (bTopW * bodyRatio) * 0.5;
            const halfBot = (bBotW * bodyRatio) * 0.5;
            const pTopLeft = topCenterX - halfTop;
            const pTopRight = topCenterX + halfTop;
            const pBotLeft = botCenterX - halfBot;
            const pBotRight = botCenterX + halfBot;

            ctx.save();
            ctx.globalAlpha = alpha * globalAlpha;
            const cachedBody = this.renderCache.longNoteBodies[lane];
            if (cachedBody) {
                ctx.beginPath();
                ctx.moveTo(pBotLeft, bodyBotY); ctx.lineTo(pBotRight, bodyBotY); ctx.lineTo(pTopRight, bodyTopY); ctx.lineTo(pTopLeft, bodyTopY);
                ctx.closePath();
                ctx.clip();
                const minX = Math.min(pTopLeft, pBotLeft);
                const maxX = Math.max(pTopRight, pBotRight);
                ctx.drawImage(cachedBody, minX, bodyTopY, maxX - minX, bodyBotY - bodyTopY);
            }
            ctx.restore();
        }
        this.drawGelNote(ctx, tailX, tailY + (tailH * 0.3), tailW, tailH * 0.4, lane, globalAlpha);
        this.drawGelNote(ctx, headX, headY, headW, headH, lane, globalAlpha);
    }

    private drawGelNote(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, lane: number, alpha: number): void {
        const noteImg = this.renderCache.notes[lane];
        if (noteImg) {
            const oldAlpha = ctx.globalAlpha;
            ctx.globalAlpha = alpha * oldAlpha;

            // Define drawing dimensions based on perspective width and height
            // We want to center the note image on the perspective coordinates (x + w/2, y)
            const drawW = w * 1.25; // Note is slightly wider than the lane for better visibility
            const drawH = h * 1.25;
            const drawX = (x + w / 2) - drawW / 2;
            const drawY = y - drawH / 2;

            ctx.drawImage(noteImg, drawX, drawY, drawW, drawH);
            ctx.globalAlpha = oldAlpha;
        }
    }

    private getPerspectiveX(laneIndex: number, y: number, state: HighwayRenderState): number {
        const progress = (y - state.horizonY) / (state.bottomY - state.horizonY);
        const totalWidthAtY = state.laneTopWidth * state.laneCount * (1 - progress) +
            state.laneBottomWidth * state.laneCount * progress;
        const laneWidthAtY = totalWidthAtY / state.laneCount;
        const startX = (state.width - totalWidthAtY) / 2;
        return startX + (laneIndex * laneWidthAtY);
    }

    private getPerspectiveWidth(y: number, state: HighwayRenderState): number {
        const progress = (y - state.horizonY) / (state.bottomY - state.horizonY);
        return state.laneTopWidth * (1 - progress) + state.laneBottomWidth * progress;
    }

}
