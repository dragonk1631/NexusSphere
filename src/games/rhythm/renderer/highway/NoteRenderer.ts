import { type RenderCache } from '../../graphics/RenderCache';

/**
 * NoteRenderer handles the specialized rendering of tap notes (GelNotes).
 */
export class NoteRenderer {
    private renderCache: RenderCache;

    constructor(renderCache: RenderCache) {
        this.renderCache = renderCache;
    }

    /**
     * Renders a single tap note.
     */
    public renderTapNote(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, lane: number, alpha: number): void {
        const noteImg = this.renderCache.notes[lane];
        if (!noteImg) return;

        // Optimization: Set alpha directly (main loop must handle restoration if needed)
        ctx.globalAlpha = alpha;

        const paddingRatioX = noteImg.width / 100;
        const paddingRatioY = noteImg.height / 50;

        const drawW = Math.round(w * paddingRatioX);
        const drawH = Math.round(h * paddingRatioY);
        const drawX = Math.round((x + w / 2) - drawW / 2);
        const drawY = Math.round(y - drawH / 2);

        ctx.drawImage(noteImg, drawX, drawY, drawW, drawH);
    }
}
