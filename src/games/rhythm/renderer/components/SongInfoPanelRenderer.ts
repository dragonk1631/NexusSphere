import { type MenuLayoutResult } from '../MenuLayout';
import { type MenuRenderState, type SongEntry } from '../../types/GameTypes';
import { MENU_LAYOUT } from '../MenuLayoutConfig';
import { MidiEQRenderer } from '../MidiEQRenderer';
import {
    hexToRgb,
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

        const currentDifficulty = state.difficultyOptions[state.selectedDifficultyIndex] || 'NORMAL';
        const record = state.scoreManager?.getHighScore(currentSong.url, state.keyMode, currentDifficulty);
        const hasRecord = !!record;
        
        const scoreStr = hasRecord ? record.score.toString().padStart(7, '0') : "-------";
        const rank = hasRecord ? record.grade : "---";
        const bpmStr = Math.round(bpm).toString(); // Removed redundant 'BPM'
        const duration = currentSong.duration || 0;
        const lengthStr = `${Math.floor(duration / 60)}:${Math.floor(duration % 60).toString().padStart(2, '0')}`;

        let currentX = padding + sidePad;

        // 1. BEST SCORE (Double Width)
        this.renderSmallMetaBox(ctx, currentX, infoAreaY, scoreW, infoAreaH, "BEST SCORE", scoreStr, sf, c1, c2, true);
        currentX += scoreW + gap;

        // 2. RANK
        this.renderSmallMetaBox(ctx, currentX, infoAreaY, otherW, infoAreaH, "RANK", rank, sf, c1, c2);
        currentX += otherW + gap;

        // 3. BPM
        this.renderSmallMetaBox(ctx, currentX, infoAreaY, otherW, infoAreaH, "BPM", bpmStr, sf, c1, c2);
        currentX += otherW + gap;

        // 4. LENGTH
        this.renderSmallMetaBox(ctx, currentX, infoAreaY, otherW, infoAreaH, "TIME", lengthStr, sf, c1, c2);
    }

    private renderSmallMetaBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, label: string, value: string, sf: number, c1: string, c2: string, isScore = false) {
        ctx.save();
        ctx.translate(x, y);

        const tabH = 22 * sf; // Increased from 18
        const boxH = h - tabH;

        // ── 1. HEADER TAB ──
        const tabGrad = ctx.createLinearGradient(0, 0, 0, tabH);
        tabGrad.addColorStop(0, `rgba(${hexToRgb(c1)}, 0.45)`);
        tabGrad.addColorStop(1, `rgba(10, 10, 20, 0.9)`);
        
        ctx.fillStyle = tabGrad;
        ctx.beginPath();
        ctx.roundRect(0, 0, w, tabH, [6 * sf, 6 * sf, 0, 0]);
        ctx.fill();

        // Tab Border
        ctx.strokeStyle = `rgba(${hexToRgb(c1)}, 0.5)`;
        ctx.lineWidth = 1 * sf;
        ctx.stroke();

        // Label Typography
        ctx.font = `700 ${Math.floor(14 * sf)}px "Orbitron"`;
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        
        // 1. STROKE FIRST (no shadow — shadow on stroke causes upward artifact)
        ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; ctx.shadowColor = 'transparent';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2.5 * sf;
        ctx.strokeText(label, w / 2, tabH / 2 + 1 * sf);
        
        // 2. FILL SECOND (downward drop shadow)
        ctx.shadowBlur = 4 * sf; ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 2.5 * sf;
        ctx.fillText(label, w / 2, tabH / 2 + 1 * sf);

        // ── 2. VALUE BOX ──
        const boxY = tabH;
        const boxGrad = ctx.createLinearGradient(0, boxY, 0, boxY + boxH);
        boxGrad.addColorStop(0, 'rgba(255,255,255,0.07)');
        boxGrad.addColorStop(1, 'rgba(255,255,255,0.02)');
        
        ctx.shadowBlur = 0;
        ctx.fillStyle = boxGrad;
        ctx.beginPath();
        ctx.roundRect(0, boxY, w, boxH, [0, 0, 6 * sf, 6 * sf]);
        ctx.fill();

        // Main Border (Unified with Panel Style)
        const borderGrad = ctx.createLinearGradient(0, boxY, w, boxY);
        borderGrad.addColorStop(0, c1); borderGrad.addColorStop(1, c2);
        ctx.strokeStyle = borderGrad; ctx.lineWidth = 1.2 * sf;
        ctx.stroke();

        // Divider line between tab and box
        ctx.strokeStyle = `rgba(${hexToRgb(c1)}, 0.3)`;
        ctx.lineWidth = 0.5 * sf;
        ctx.beginPath(); ctx.moveTo(0, boxY); ctx.lineTo(w, boxY); ctx.stroke();

        // Value Typography (Significantly increased size)
        const valueSize = isScore ? Math.floor(28 * sf) : Math.floor(24 * sf);
        const isEmpty = value === "---" || value === "-------";
        
        let vColor = isEmpty ? 'rgba(255, 255, 255, 0.35)' : '#fff';
        if (!isEmpty && label === "RANK") {
            const colors: Record<string, string> = { 'S+': '#ffea00', 'S': '#f9ca24', 'A': '#6ab04c', 'B': '#4834d4', 'C': '#eb4d4b', 'F': '#535c68' };
            vColor = colors[value] || '#fff';
        }

        ctx.font = `700 ${valueSize}px "Orbitron"`;
        ctx.fillStyle = vColor;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

        // 1. STROKE FIRST (no shadow — shadow on stroke causes upward artifact)
        ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; ctx.shadowColor = 'transparent';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2.5 * sf;
        ctx.strokeText(value, w / 2, boxY + boxH / 2 + 2 * sf);
        
        // 2. FILL SECOND (clean downward drop shadow)
        ctx.shadowBlur = 6 * sf; ctx.shadowColor = 'rgba(0,0,0,1)';
        ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 3.5 * sf;
        ctx.fillText(value, w / 2, boxY + boxH / 2 + 2 * sf);
        ctx.restore();
    }
}
