import { type MenuLayoutResult } from '../MenuLayout';
import { type MenuRenderState, type SongEntry } from '../../types/GameTypes';
import { MENU_LAYOUT } from '../MenuLayoutConfig';
import { MidiEQRenderer } from '../MidiEQRenderer';
import {
    drawPremiumPanel,
    drawPremiumTypography
} from '../MenuUIUtils';

export class SongInfoPanelRenderer {
    public render(ctx: CanvasRenderingContext2D, layout: MenuLayoutResult, state: MenuRenderState, currentSong: SongEntry | null, sf: number, c1: string, c2: string, bpm: number, eqRenderer: MidiEQRenderer) {
        const { visPanelY, leftPanelWidth, visPanelH, padding } = layout;

        // Unified 2.5px Blur for Info Panel
        drawPremiumPanel(ctx, padding, visPanelY, leftPanelWidth, visPanelH, "INFO", c1, c2, sf);

        if (!currentSong) {
            const cx = Math.floor(padding + leftPanelWidth / 2);
            const cy = Math.floor(visPanelY + visPanelH / 2);
            drawPremiumTypography(ctx, "ELEVATING DATA", cx, cy - 10 * sf, 'center', 24 * sf, '#fff', true, c1, leftPanelWidth * 0.8);
            drawPremiumTypography(ctx, "NO TRACK DETECTED", cx, cy + 20 * sf, 'center', 10 * sf, 'rgba(255,255,255,0.4)', false, 'transparent', leftPanelWidth * 0.8);
            return;
        }

        const cx = Math.floor(padding + leftPanelWidth / 2);
        const headerH = MENU_LAYOUT.HEADER_HEIGHT * sf;
        const innerY = visPanelY + headerH;
        const innerH = visPanelH - headerH;

        // Visualizer Area (Top 65%)
        const eqH = Math.floor(innerH * 0.65);
        const eqAreaY = innerY;

        ctx.save();
        ctx.translate(cx - (leftPanelWidth - 24 * sf) / 2, eqAreaY);
        eqRenderer.update(state.previewMidi ?? null, state.previewTime ?? 0);
        eqRenderer.render(ctx, 0, 0, leftPanelWidth - 24 * sf, eqH, sf, c1, bpm, state.previewTime ?? 0);
        ctx.restore();

        // ── 4-Column Table Row (Bottom 35%) ──
        const gap = 8 * sf;
        const infoAreaY = eqAreaY + eqH + gap;
        const infoAreaH = innerH - eqH - gap * 2;
        
        const sidePad = 12 * sf;
        const totalW = leftPanelWidth - sidePad * 2;
        const unitW = (totalW - gap * 3) / 5; // 2 (Score) + 1 (Rank) + 1 (Speed) + 1 (Length) = 5 units

        const scoreW = unitW * 2 + gap; // Combined width for score
        const otherW = unitW;

        const currentHighScore = state.scoreManager?.getHighScore(currentSong.url)?.score || 0;
        const scoreStr = currentHighScore.toString().padStart(7, '0');
        const rank = state.scoreManager?.getHighScore(currentSong.url)?.grade || 'F';
        const speedStr = `${state.scrollSpeed.toFixed(1)}x`;
        const duration = currentSong.duration || 0;
        const lengthStr = `${Math.floor(duration / 60)}:${Math.floor(duration % 60).toString().padStart(2, '0')}`;

        let currentX = padding + sidePad;

        // 1. BEST SCORE (Double Width)
        this.renderSmallMetaBox(ctx, currentX, infoAreaY, scoreW, infoAreaH, "BEST SCORE", scoreStr, sf, c1, c2, true);
        currentX += scoreW + gap;

        // 2. RANK
        this.renderSmallMetaBox(ctx, currentX, infoAreaY, otherW, infoAreaH, "RANK", rank, sf, c1, c2);
        currentX += otherW + gap;

        // 3. SPEED
        this.renderSmallMetaBox(ctx, currentX, infoAreaY, otherW, infoAreaH, "SPEED", speedStr, sf, c1, c2);
        currentX += otherW + gap;

        // 4. LENGTH
        this.renderSmallMetaBox(ctx, currentX, infoAreaY, otherW, infoAreaH, "TIME", lengthStr, sf, c1, c2);
    }

    private renderSmallMetaBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, label: string, value: string, sf: number, c1: string, c2: string, isScore = false) {
        ctx.save();
        ctx.translate(x, y);

        // Glass Box with Unified Blur v2.5
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, 'rgba(255,255,255,0.07)');
        grad.addColorStop(1, 'rgba(255,255,255,0.02)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.roundRect(0, 0, w, h, 6 * sf); ctx.fill();

        // Border
        const borderGrad = ctx.createLinearGradient(0, 0, w, 0);
        borderGrad.addColorStop(0, c1); borderGrad.addColorStop(1, c2);
        ctx.strokeStyle = borderGrad; ctx.lineWidth = 1.2 * sf; ctx.stroke();

        // Label
        const labelSize = Math.floor(9 * sf);
        ctx.font = `700 ${labelSize}px "Orbitron"`;
        ctx.fillStyle = c1;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(label, w / 2, 6 * sf);

        // Value
        const valueSize = isScore ? Math.floor(22 * sf) : Math.floor(18 * sf);
        const valueY = h * (isScore ? 0.62 : 0.65);
        
        // Special color for Rank
        let vColor = '#fff';
        if (label === "RANK") {
            const colors: Record<string, string> = { 'S': '#f9ca24', 'A': '#6ab04c', 'B': '#4834d4', 'C': '#eb4d4b', 'F': '#535c68' };
            vColor = colors[value] || '#fff';
        }

        ctx.font = `900 ${valueSize}px "Orbitron"`;
        ctx.fillStyle = vColor;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        
        // Add subtle glow for importance
        if (isScore || label === "RANK") {
            ctx.shadowBlur = 10 * sf;
            ctx.shadowColor = (label === "RANK") ? vColor : c1;
        }
        
        ctx.fillText(value, w / 2, valueY);
        ctx.restore();
    }
}
