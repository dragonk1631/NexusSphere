import { type MenuLayoutResult } from '../MenuLayout';
import {
    hexToRgb,
    drawTrackedText
} from '../MenuUIUtils';

export class ControlsRenderer {
    public renderPlayButton(ctx: CanvasRenderingContext2D, layout: MenuLayoutResult, time: number, sf: number, c1: string, c2: string) {
        const { btnX, btnY, btnW, btnH } = layout;
        const pulse = 0.5 + Math.sin(time * 4) * 0.5;

        ctx.save();
        // 1. Base Gradient (Batch 13: Soft Pastel Blend)
        const grad = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnH);
        grad.addColorStop(0, `rgba(255, 255, 255, 0.45)`);
        grad.addColorStop(1, c1);
        ctx.fillStyle = grad;
        ctx.shadowBlur = 30 * sf * pulse; ctx.shadowColor = c2;
        ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH, 14 * sf); ctx.fill();

        // 2. Shimmer Sweep
        const shimmerPos = ((time * 0.9) % 3) - 1.5;
        const sGrad = ctx.createLinearGradient(btnX + btnW * shimmerPos, btnY, btnX + btnW * (shimmerPos + 0.1), btnY + btnH);
        sGrad.addColorStop(0, 'rgba(255,255,255,0)');
        sGrad.addColorStop(0.5, 'rgba(255,255,255,0.25)');
        sGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sGrad;
        ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH, 14 * sf); ctx.fill();

        // 3. Inner Border & Text
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1 * sf;
        ctx.shadowBlur = 0; ctx.stroke();

        ctx.beginPath(); ctx.roundRect(btnX + (2 * sf), btnY + (2 * sf), btnW - (4 * sf), btnH - (4 * sf), 12 * sf);
        ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.stroke();

        drawTrackedText(ctx, "PLAY", btnX + btnW / 2, btnY + btnH * 0.58, 22 * sf, 8 * sf, '#fff', 'center', 'rgba(0,0,0,0.5)');
        ctx.restore();
    }

    public renderExitButton(ctx: CanvasRenderingContext2D, layout: MenuLayoutResult, sf: number, c1: string) {
        const { mainMenuBtnX: ex, mainMenuBtnY: ey, mainMenuBtnW: ew, mainMenuBtnH: eh } = layout;
        ctx.save();

        const grad = ctx.createLinearGradient(ex, ey, ex, ey + eh);
        grad.addColorStop(0, `rgba(255, 255, 255, 0.5)`);
        grad.addColorStop(1.0, `rgba(${hexToRgb(c1)}, 0.85)`);

        ctx.fillStyle = grad;
        ctx.shadowBlur = 25 * sf; ctx.shadowColor = 'rgba(0,0,0,0.7)';
        ctx.beginPath(); ctx.roundRect(ex, ey, ew, eh, 8 * sf); ctx.fill();

        const glossGrad = ctx.createLinearGradient(ex, ey, ex, ey + eh * 0.4);
        glossGrad.addColorStop(0, 'rgba(255,255,255,0.15)');
        glossGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = glossGrad;
        ctx.beginPath(); ctx.roundRect(ex + 4 * sf, ey + 2 * sf, ew - 8 * sf, eh * 0.35, 6 * sf); ctx.fill();

        ctx.beginPath(); ctx.roundRect(ex, ey, ew, eh, 8 * sf);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.8 * sf;
        ctx.stroke();

        ctx.strokeStyle = `rgba(${hexToRgb(c1)}, 1.0)`;
        ctx.lineWidth = 1 * sf;
        ctx.beginPath(); ctx.roundRect(ex + 1 * sf, ey + 1 * sf, ew - 2 * sf, eh - 2 * sf, 7 * sf); ctx.stroke();

        drawTrackedText(ctx, "← MENU", ex + ew / 2, ey + eh / 2 + 1 * sf, 13 * sf, 3 * sf, '#fff', 'center', 'rgba(0,0,0,0.6)');

        ctx.restore();
    }
}
