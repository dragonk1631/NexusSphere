import { type MenuLayoutResult } from '../MenuLayout';
import { type MenuRenderState } from '../../types/GameTypes';
import { MENU_LAYOUT } from '../MenuLayoutConfig';
import {
    hexToRgb,
    drawTrackedText,
    drawPremiumPanel,
    drawPremiumTypography,
    drawPremiumPlate
} from '../MenuUIUtils';

export class OptionsPanelRenderer {
    public render(ctx: CanvasRenderingContext2D, layout: MenuLayoutResult, state: MenuRenderState, sf: number, c1: string, c2: string) {
        const { padding, infoY, infoH, leftPanelWidth, col1CenterX, col2CenterX, col3CenterX, row1CenterY, hitWidth } = layout;

        // "OPTIONS" Panel - Use Premium Plate for CHAIN combo
        const comboValue = state.scoreManager?.getCombo() || 0;
        drawPremiumPanel(ctx, padding, infoY, leftPanelWidth, infoH, "OPTION", c1, c2, sf);

        if (comboValue > 0) {
            const pulse = Math.sin(Date.now() / 400) * 0.1 + 1.0;
            const badgeFontSize = 16 * sf;
            
            ctx.font = `900 ${Math.floor(badgeFontSize)}px "Orbitron"`;
            const labelText = "CHAIN";
            const valText = comboValue.toLocaleString();
            const labelW = ctx.measureText(labelText).width;
            const valW = ctx.measureText(valText).width;
            
            const platePadding = 12 * sf;
            const plateW = platePadding + labelW + 6 * sf + valW + platePadding;
            const plateH = 28 * sf;
            const plateX = padding + leftPanelWidth - plateW - 12 * sf;
            const plateY = infoY + (MENU_LAYOUT.HEADER_HEIGHT * sf - plateH) / 2;
            
            const tx = plateX + platePadding;
            const ty = plateY + plateH / 2 + 1 * sf;

            // Draw Plate
            drawPremiumPlate(ctx, plateX, plateY, plateW, plateH, c1, '#ffdd00', sf, pulse);
            
            // Draw Text
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2.5 * sf;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.strokeText(labelText, tx, ty);
            ctx.fillText(labelText, tx, ty);
            
            ctx.fillStyle = '#ffdd00';
            ctx.strokeText(valText, tx + labelW + 6 * sf, ty);
            ctx.fillText(valText, tx + labelW + 6 * sf, ty);
        }

        // Theme-independent Colors (Value-based)
        const getDifficultyColor = (diff: string) => {
            if (diff === 'EASY') return '#2ecc71';   // Green
            if (diff === 'NORMAL') return '#3498db'; // Blue
            if (diff === 'HARD') return '#e74c3c';   // Red
            if (diff === 'EXTREME') return '#ff0055'; // Deep Pink / Neon Fusion
            return '#c8d6e5';
        };

        const getSpeedColor = (speed: number) => {
            if (speed < 2.0) return '#1abc9c'; // Teal
            if (speed < 5.0) return '#f1c40f'; // Yellow
            return '#e67e22'; // Orange
        };

        const getModeColor = (mode: number) => {
            if (mode === 4) return '#00d2d3'; // Cyan for 4K
            if (mode === 6) return '#ff9ff3'; // Pink for 6K
            return '#feca57'; // Yellow for others
        };

        const speedValue = state.scrollSpeed;
        const modeValue = state.keyMode;

        const items = [
            { label: "LEVEL", value: state.difficultyOptions[state.selectedDifficultyIndex], color: getDifficultyColor(state.difficultyOptions[state.selectedDifficultyIndex]) },
            { label: "SPEED", value: speedValue.toFixed(1) + "X", color: getSpeedColor(speedValue) },
            { label: "MODE", value: modeValue + "KEYS", color: getModeColor(modeValue) }
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

            // ── 1. TITLE TAB (matched with redesigned main headers) ──
            const tabY = baseY;
            const tabGrad = ctx.createLinearGradient(0, tabY, 0, tabY + tabH);
            tabGrad.addColorStop(0, `rgba(${hexToRgb(c1)}, 0.4)`);
            tabGrad.addColorStop(0.15, `rgba(${hexToRgb(c1)}, 0.55)`);
            tabGrad.addColorStop(1, `rgba(15, 15, 25, 0.9)`);

            ctx.fillStyle = tabGrad;
            ctx.lineWidth = 1 * sf;
            ctx.strokeStyle = `rgba(${hexToRgb(c1)}, 0.7)`;
            ctx.beginPath();
            ctx.roundRect(cx - tabW / 2, tabY, tabW, tabH, 4 * sf);
            ctx.fill();
            ctx.stroke();

            // Divider Line consistent with panels
            ctx.strokeStyle = `rgba(${hexToRgb(c1)}, 0.25)`;
            ctx.lineWidth = 0.5 * sf;
            ctx.beginPath(); ctx.moveTo(cx - tabW / 2, tabY + tabH); ctx.lineTo(cx + tabW / 2, tabY + tabH); ctx.stroke();

            // Centralized Header Text (Increased to 14)
            drawTrackedText(ctx, item.label, cx, tabY + tabH / 2 + 1 * sf, 14 * sf, 4 * sf, '#fff', 'center', 'rgba(0,0,0,0.6)');

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

            // Selected Glow
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

            // Standardized Typography Size
            const valSize = 24 * sf;

            ctx.font = `900 ${Math.floor(valSize)}px "Orbitron"`;
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // 4. Value Typography
            ctx.shadowBlur = 10 * sf;
            ctx.shadowColor = item.color;
            const valueY = boxY + th * 0.38;
            drawPremiumTypography(ctx, item.value, cx, valueY, 'center', valSize, '#fff', true, item.color, tw * 0.75);

            // 5. Tactical Arrows
            const arrowY = boxY + th * 0.78;
            const arrowSpacing = tw * 0.36;
            const bounce = Math.sin(performance.now() * 0.008) * 2 * sf;
            ctx.fillStyle = item.color;
            ctx.font = `900 ${Math.floor(20 * sf)}px "Orbitron"`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            ctx.save();
            ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2.5 * sf;
            ctx.strokeText("◀", cx - arrowSpacing + bounce, arrowY);
            ctx.strokeText("▶", cx + arrowSpacing - bounce, arrowY);
            
            ctx.shadowBlur = 6 * sf; ctx.shadowColor = 'rgba(0,0,0,1)';
            ctx.shadowOffsetX = 1.6 * sf; ctx.shadowOffsetY = 3.5 * sf;
            ctx.fillText("◀", cx - arrowSpacing + bounce, arrowY);
            ctx.fillText("▶", cx + arrowSpacing - bounce, arrowY);
            ctx.restore();

            ctx.restore();
        });
    }
}
