import { type MenuLayoutResult } from '../MenuLayout';
import { type MenuRenderState } from '../../types/GameTypes';
import { MENU_LAYOUT } from '../MenuLayoutConfig';
import { ThemeManager } from '../../../../core/ThemeManager';
import {
    hexToRgb,
    drawTrackedText,
    drawPremiumPanel,
    drawPremiumTypography
} from '../MenuUIUtils';

export class OptionsPanelRenderer {
    public render(ctx: CanvasRenderingContext2D, layout: MenuLayoutResult, state: MenuRenderState, sf: number, c1: string, c2: string) {
        const { padding, infoY, infoH, leftPanelWidth, col1CenterX, col2CenterX, col3CenterX, row1CenterY, hitWidth } = layout;

        // "OPTIONS" Panel - Use infoH to match bottom height of Song List
        drawPremiumPanel(ctx, padding, infoY, leftPanelWidth, infoH, "OPTION", c1, c2, sf);

        // Use theme's semantic palette for full tone-and-manner cohesion (Batch 18)
        const theme = ThemeManager.getInstance().getCurrentTheme();
        const sem = theme.semantic;

        const getDifficultyColor = (diff: string) => {
            if (diff === 'EASY') return sem.levelEasy;
            if (diff === 'NORMAL') return sem.levelNormal;
            if (diff === 'HARD') return sem.levelHard;
            if (diff === 'EXPERT') return sem.levelExpert;
            return '#c8d6e5';
        };

        const items = [
            { label: "LEVEL", value: state.difficultyOptions[state.selectedDifficultyIndex], color: getDifficultyColor(state.difficultyOptions[state.selectedDifficultyIndex]) },
            { label: "SPEED", value: state.scrollSpeed.toFixed(1) + "X", color: sem.speedOption },
            { label: "MODE", value: state.keyMode + "KEYS", color: sem.modeOption }
        ];

        const centers = [col1CenterX, col2CenterX, col3CenterX];

        items.forEach((item, i) => {
            const cx = centers[i];
            const tw = hitWidth * 1.8;
            const th = MENU_LAYOUT.OPTION_TILE_HEIGHT * sf;
            const tabH = MENU_LAYOUT.OPTION_TAB_HEIGHT * sf;
            const itemTotalH = th + tabH;
            const baseY = row1CenterY - itemTotalH / 2;
            const tabW = tw;

            ctx.save();

            // ── 1. TITLE TAB (colored with item's accent) ──
            const tabY = baseY;
            const tabGrad = ctx.createLinearGradient(0, tabY, 0, tabY + tabH);
            // Batch 15: Deep Sophisticated Gradient (Eye-friendly & Premium)
            tabGrad.addColorStop(0, `rgba(${hexToRgb(c1)}, 0.4)`);
            tabGrad.addColorStop(1, `rgba(15, 15, 25, 0.85)`);

            ctx.fillStyle = tabGrad;
            ctx.lineWidth = 1 * sf;
            ctx.strokeStyle = `rgba(${hexToRgb(c1)}, 0.8)`;
            ctx.beginPath();
            ctx.roundRect(cx - tabW / 2, tabY, tabW, tabH, 4 * sf);
            ctx.fill();
            ctx.stroke();

            // Centralized Header Text (Batch 5)
            drawTrackedText(ctx, item.label, cx, tabY + tabH / 2 + 1 * sf, 11 * sf, 4 * sf, '#fff', 'center', 'rgba(0,0,0,0.5)');

            // ── 2. INTERACTIVE MAIN TILE (Aligned with Theme Colors)
            const boxY = tabY + tabH;
            const grad = ctx.createLinearGradient(cx - tw / 2, boxY, cx + tw / 2, boxY + th);
            grad.addColorStop(0, `rgba(${hexToRgb(item.color)}, 0.25)`);
            grad.addColorStop(0.5, `rgba(${hexToRgb(item.color)}, 0.1)`);
            grad.addColorStop(1, 'rgba(255, 255, 255, 0.05)');

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.roundRect(cx - tw / 2, boxY, tw, th, [0, 0, 11 * sf, 11 * sf]);
            ctx.fill();

            // Selected Glow (Matched with Theme - simplified to always pulse on options)
            const pulse = Math.sin(Date.now() / 300 + i * 1.5) * 0.5 + 0.5;
            ctx.save();
            ctx.shadowBlur = 10 * sf + (pulse * 20 * sf);
            ctx.shadowColor = item.color;
            ctx.strokeStyle = item.color;
            ctx.lineWidth = 1 * sf;
            ctx.beginPath();
            ctx.roundRect(cx - tw / 2, boxY, tw, th, [0, 0, 11 * sf, 11 * sf]);
            ctx.stroke();
            ctx.restore();

            // 3D Bevel & Theme Outline
            ctx.save();
            ctx.globalAlpha = 0.55;
            ctx.strokeStyle = item.color;
            ctx.lineWidth = 1.8 * sf;
            ctx.stroke();
            ctx.restore();

            // Inner Highlight
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'; ctx.lineWidth = 0.5 * sf;
            ctx.beginPath(); ctx.moveTo(cx - tw / 2 + 8 * sf, boxY + 1 * sf); ctx.lineTo(cx + tw / 2 - 8 * sf, boxY + 1 * sf); ctx.stroke();

            let valSize = 25 * sf;
            if (i === 1) valSize = 22 * sf;
            ctx.font = `800 ${Math.floor(valSize)}px "Orbitron"`;
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // 4. Value Typography — upper portion of the box
            ctx.shadowBlur = 0;
            const valueY = boxY + th * 0.38;   // upper area
            drawPremiumTypography(ctx, item.value, cx, valueY, 'center', valSize, '#fff', true, item.color, tw * 0.6);

            // 5. Tactical Arrows — lower portion of the box (well below value text)
            const arrowY = boxY + th * 0.78;
            const arrowSpacing = tw * 0.36;
            const bounce = Math.sin(performance.now() * 0.008) * 2 * sf;
            ctx.fillStyle = item.color;
            ctx.font = `900 ${Math.floor(20 * sf)}px "Orbitron"`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowBlur = 14 * sf; ctx.shadowColor = item.color;

            ctx.fillText("◀", cx - arrowSpacing + bounce, arrowY);
            ctx.fillText("▶", cx + arrowSpacing - bounce, arrowY);

            ctx.restore();
        });
    }
}
