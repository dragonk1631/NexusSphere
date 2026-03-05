import { type MenuLayoutResult } from '../MenuLayout';
import { type MenuRenderState, type SongEntry } from '../../types/GameTypes';
import { MENU_LAYOUT } from '../MenuLayoutConfig';
import { drawMidiChannelEQ } from '../UIUtils';
import {
    drawPremiumPanel,
    drawPremiumTypography
} from '../MenuUIUtils';

export class SongInfoPanelRenderer {
    public render(ctx: CanvasRenderingContext2D, layout: MenuLayoutResult, state: MenuRenderState, currentSong: SongEntry, sf: number, c1: string, c2: string, bpm: number) {
        const { visPanelY, leftPanelWidth, visPanelH, padding } = layout;

        drawPremiumPanel(ctx, padding, visPanelY, leftPanelWidth, visPanelH, "INFO", c1, c2, sf);

        const cx = Math.floor(padding + leftPanelWidth / 2);

        // ── Top-Down & Proportional Layout (7:3 Split) ──
        const headerH = MENU_LAYOUT.HEADER_HEIGHT * sf; // Space for the "[ SONG_DATA ]" header
        const innerY = visPanelY + headerH;
        const innerH = visPanelH - headerH;

        // Equal Spacing Layout (Batch 5)
        const eqH = Math.floor(innerH * MENU_LAYOUT.INFO_EQ_RATIO);
        const infoH = innerH - eqH;
        const itemGap = Math.floor(infoH * MENU_LAYOUT.INFO_ITEM_GAP_RATIO); // Gap based on config
        const usableInfoH = infoH - itemGap * 2;

        const eqAreaY = innerY;
        const eqAreaH = eqH;

        ctx.save();
        ctx.translate(cx - (leftPanelWidth - 24 * sf) / 2, eqAreaY);
        drawMidiChannelEQ(
            ctx,
            0, 0, leftPanelWidth - 24 * sf, eqAreaH,
            state.previewMidi ?? null,
            state.previewTime ?? 0,
            c1, c2, sf,
            state.songList[state.selectedSongIndex]?.bpm ?? 120
        );
        ctx.restore();

        const infoAreaY = eqAreaY + eqAreaH + itemGap;

        // Split info space: upper 40% for Score, lower 60% for Meta boxes
        // ── Zone B: Score Box (evenly sized) ──
        const scoreBoxH = Math.floor(usableInfoH * MENU_LAYOUT.SCORE_BOX_HEIGHT_RATIO);
        const scoreBoxY = infoAreaY;
        const scoreBoxPad = MENU_LAYOUT.SCORE_BOX_PADDING * sf;

        // Score Glass Box
        ctx.save();
        const scoreGrad = ctx.createLinearGradient(padding + scoreBoxPad, scoreBoxY, padding + leftPanelWidth - scoreBoxPad, scoreBoxY + scoreBoxH);
        scoreGrad.addColorStop(0, 'rgba(255,255,255,0.08)');
        scoreGrad.addColorStop(1, 'rgba(255,255,255,0.02)');
        ctx.fillStyle = scoreGrad;
        ctx.beginPath(); ctx.roundRect(padding + scoreBoxPad, scoreBoxY, leftPanelWidth - scoreBoxPad * 2, scoreBoxH, 8 * sf); ctx.fill();
        // Colorful border
        const borderGrad = ctx.createLinearGradient(padding + scoreBoxPad, scoreBoxY, padding + leftPanelWidth - scoreBoxPad, scoreBoxY);
        borderGrad.addColorStop(0, c1); borderGrad.addColorStop(1, c2);
        ctx.strokeStyle = borderGrad; ctx.lineWidth = 1.5 * sf; ctx.stroke();
        ctx.restore();

        // Much larger fonts for better mobile visibility
        const scoreFontSize = Math.min(30 * sf, scoreBoxH * 0.65);
        const rankFontSize = Math.min(26 * sf, scoreBoxH * 0.68);
        const lblFontSize = Math.max(9 * sf, scoreFontSize * 0.32);

        // Get score manager instance from state or pass it (TODO: we might need ScoreManager passed in)
        // Let's pass the score & grade as parameters or compute it in MenuRenderer
        const currentHighScoreStr = state.scoreManager?.getHighScore(currentSong.url)?.score.toString().padStart(7, '0') || '0000000';
        const rank = state.scoreManager?.getHighScore(currentSong.url)?.grade || null;

        ctx.save();
        ctx.font = `600 ${Math.floor(lblFontSize)}px "Orbitron"`;
        ctx.fillStyle = c1; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.shadowBlur = 6 * sf; ctx.shadowColor = c1;
        ctx.fillText("BEST", Math.floor(padding + scoreBoxPad + 12 * sf), scoreBoxY + scoreBoxH * 0.35);
        ctx.fillStyle = c2; ctx.shadowColor = c2;
        ctx.fillText("RECORD", Math.floor(padding + scoreBoxPad + 12 * sf), scoreBoxY + scoreBoxH * 0.65);
        ctx.restore();

        drawPremiumTypography(ctx, currentHighScoreStr, cx, scoreBoxY + scoreBoxH / 2, 'center', scoreFontSize, '#fff', true, c1, leftPanelWidth * 0.5);

        if (rank) {
            // Need getGradeColor, let's import it or re-implement
            const colors: Record<string, string> = { 'S': '#f9ca24', 'A': '#6ab04c', 'B': '#4834d4', 'C': '#eb4d4b', 'F': '#535c68' };
            const gradeColor = colors[rank] || '#fff';

            ctx.save();
            const badgeR = Math.min(rankFontSize * 0.7, scoreBoxH * 0.55);
            const badgeX = Math.floor(padding + leftPanelWidth - scoreBoxPad - badgeR);
            const badgeY = Math.floor(scoreBoxY + scoreBoxH / 2);
            ctx.fillStyle = `rgba(${(parseInt(gradeColor.slice(1, 3), 16))}, ${parseInt(gradeColor.slice(3, 5), 16)}, ${parseInt(gradeColor.slice(5, 7), 16)}, 0.15)`; // basic hexToRgb
            ctx.strokeStyle = gradeColor; ctx.lineWidth = 2 * sf;
            ctx.shadowBlur = 15 * sf; ctx.shadowColor = gradeColor;
            ctx.beginPath(); ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.font = `900 ${Math.floor(rankFontSize * 0.76)}px "Orbitron"`;
            ctx.fillStyle = gradeColor;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(rank, badgeX, badgeY);
            ctx.restore();
        }

        // ── Zone C: Meta boxes (evenly spaced) ──
        const metaGap = MENU_LAYOUT.META_BOX_GAP * sf;
        const metaH = Math.floor(usableInfoH * MENU_LAYOUT.META_BOX_HEIGHT_RATIO);
        const metaY = scoreBoxY + scoreBoxH + itemGap;
        const boxW = Math.floor((leftPanelWidth - scoreBoxPad * 2 - metaGap) / 2);

        this.renderMetaBox(ctx, Math.floor(padding + scoreBoxPad + boxW / 2), metaY + metaH / 2, boxW, metaH, "BPM", bpm.toString(), sf, c1, c2);

        const duration = currentSong.duration || 0;
        const timeStr = `${Math.floor(duration / 60)} : ${Math.floor(duration % 60).toString().padStart(2, '0')}`;
        this.renderMetaBox(ctx, Math.floor(padding + scoreBoxPad + boxW + metaGap + boxW / 2), metaY + metaH / 2, boxW, metaH, "LENGTH", timeStr, sf, c1, c2);
    }

    private renderMetaBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, label: string, value: string, sf: number, c1: string, c2: string) {
        ctx.save();
        ctx.translate(x - w / 2, y - h / 2);

        // Glass box
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, 'rgba(255,255,255,0.08)');
        grad.addColorStop(1, 'rgba(255,255,255,0.02)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.roundRect(0, 0, w, h, 8 * sf); ctx.fill();

        // Colorful border (Matching Score Box)
        const borderGrad = ctx.createLinearGradient(0, 0, w, 0);
        borderGrad.addColorStop(0, c1); borderGrad.addColorStop(1, c2);
        ctx.strokeStyle = borderGrad; ctx.lineWidth = 1.5 * sf; ctx.stroke();

        const labelSize = Math.floor(Math.min(13 * sf, h * 0.32));
        ctx.font = `700 ${labelSize}px "Orbitron"`;
        ctx.fillStyle = c1;
        ctx.shadowBlur = 5 * sf; ctx.shadowColor = c1;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(label, 12 * sf, h / 2 + 1 * sf);
        ctx.shadowBlur = 0;

        const valueSize = Math.floor(Math.min(36 * sf, h * 0.78));
        drawPremiumTypography(ctx, value, w - 12 * sf, h / 2, 'right', valueSize, '#fff', true, c1, w * 0.65);
        ctx.restore();
    }
}
