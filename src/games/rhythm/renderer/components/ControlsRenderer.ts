import { type MenuLayoutResult } from '../MenuLayout';
import { drawTrackedText } from '../MenuUIUtils';

export class ControlsRenderer {
    public renderPlayButton(ctx: CanvasRenderingContext2D, layout: MenuLayoutResult, time: number, sf: number, c1: string, c2: string) {
        const { btnX, btnY, btnW, btnH } = layout;
        const pulse = 0.5 + Math.sin(time * 4) * 0.5;

        ctx.save();
        // 1. Base Gradient
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

        // 3. Inner Border
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1 * sf;
        ctx.stroke();

        // -- Text & Icon Group (Group Centering) --
        const fontSize = 28 * sf;
        const tracking = 4 * sf;
        ctx.font = `900 ${Math.floor(fontSize)}px "Orbitron"`;
        const textStr = "PLAY";
        
        // Correct tracked width calculation
        const chars = textStr.split('');
        const textW = chars.reduce((acc, char) => acc + ctx.measureText(char).width + tracking, 0) - tracking;
        
        const iconSize = btnH * 0.45;
        const spacing = 35 * sf; 
        const totalW = textW + spacing + iconSize;
        
        // Unified Pulse Animation (Faster & More Dynamic)
        const btnPulse = 1.0 + Math.sin(time * 6.5) * 0.035;
        
        const centerX = btnX + btnW / 2;
        const centerY = btnY + btnH / 2;
        
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.scale(btnPulse, btnPulse);
        ctx.translate(-centerX, -centerY);

        // Group start for perfect centering
        const startX = btnX + (btnW - totalW) / 2;
        const tx = startX;
        const ty = centerY + fontSize * 0.35;
        const ix = startX + textW + spacing + iconSize / 2;

        // 1. Draw Text
        drawTrackedText(ctx, textStr, tx, ty, fontSize, tracking, '#fff', 'left', 'rgba(0,0,0,0.5)');

        // 2. Draw Solid Triangle Icon
        ctx.save();
        ctx.translate(ix, centerY);
        ctx.shadowBlur = 15 * sf; ctx.shadowColor = '#fff';
        
        ctx.beginPath();
        ctx.moveTo(-iconSize * 0.4, -iconSize * 0.5);
        ctx.lineTo(iconSize * 0.6, 0);
        ctx.lineTo(-iconSize * 0.4, iconSize * 0.5);
        ctx.closePath();
        
        ctx.fillStyle = '#fff'; ctx.fill();
        ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5 * sf; ctx.stroke();
        
        ctx.restore();
        ctx.restore();
        ctx.restore();
    }

    public renderBackButton(ctx: CanvasRenderingContext2D, layout: MenuLayoutResult, sf: number, time: number) {
        const { backBtnX: bx, backBtnY: by, backBtnW: bw, backBtnH: bh } = layout;

        ctx.save();
        // 1. Premium Red Gradient
        const grad = ctx.createLinearGradient(bx, by, bx, by + bh);
        grad.addColorStop(0, '#ff3333'); 
        grad.addColorStop(1, '#880000');
        ctx.fillStyle = grad;
        ctx.shadowBlur = 25 * sf; ctx.shadowColor = '#ff3333';
        ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 14 * sf); ctx.fill();

        // 2. Glossy Overlay
        const gloss = ctx.createLinearGradient(bx, by, bx, by + bh * 0.4);
        gloss.addColorStop(0, 'rgba(255,255,255,0.2)');
        gloss.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gloss;
        ctx.beginPath(); ctx.roundRect(bx + 4 * sf, by + 2 * sf, bw - 8 * sf, bh * 0.35, 10 * sf); ctx.fill();

        // 3. Arrow & Text (Group Centering)
        const iconSize = bh * 0.38;
        const fontSize = 18 * sf; 
        const tracking = 4 * sf;
        ctx.font = `900 ${Math.floor(fontSize)}px "Orbitron"`;
        const textStr = "BACK";

        // Correct tracked width calculation
        const chars = textStr.split('');
        const textW = chars.reduce((acc, char) => acc + ctx.measureText(char).width + tracking, 0) - tracking;
        
        const spacing = 18 * sf; 
        const totalW = iconSize + spacing + textW;
        
        // Unified Pulse (Consistent with Play)
        const btnPulse = 1.0 + Math.sin(time * 3.5) * 0.02;

        const centerX = bx + bw / 2;
        const centerY = by + bh / 2;

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.scale(btnPulse, btnPulse);
        ctx.translate(-centerX, -centerY);

        // Group start for perfect centering
        const startX = bx + (bw - totalW) / 2;
        const ix = startX + iconSize / 2;
        const tx = startX + iconSize + spacing;
        const ty = centerY + fontSize * 0.35;

        // Draw Solid Back Arrow (Left)
        ctx.save();
        ctx.translate(ix, centerY);
        ctx.shadowBlur = 10 * sf; ctx.shadowColor = '#fff';
        
        ctx.beginPath();
        ctx.moveTo(iconSize * 0.5, -iconSize * 0.5);
        ctx.lineTo(-iconSize * 0.5, 0);
        ctx.lineTo(iconSize * 0.5, iconSize * 0.5);
        ctx.closePath();
        
        ctx.fillStyle = '#fff'; ctx.fill();
        ctx.strokeStyle = '#000'; ctx.lineWidth = 1.2 * sf; ctx.stroke();
        ctx.restore();

        drawTrackedText(ctx, textStr, tx, ty, fontSize, tracking, '#fff', 'left', 'rgba(0,0,0,0.5)');
        ctx.restore(); // Scale
        ctx.restore(); // Initial save
    }
}
