import { type MenuLayoutResult } from '../MenuLayout';
import { drawTrackedText } from '../MenuUIUtils';

export class ControlsRenderer {
    public renderPlayButton(ctx: CanvasRenderingContext2D, layout: MenuLayoutResult, time: number, sf: number, c1: string, c2: string) {
        const { btnX, btnY, btnW, btnH } = layout;
        const pulse = 0.5 + Math.sin(time * 4) * 0.5;

        ctx.save();
        
        // 1. Neon Outer Ring (Highly Visible)
        ctx.save();
        ctx.strokeStyle = c1;
        ctx.lineWidth = 4 * sf;
        ctx.shadowBlur = 15 * sf + (20 * sf * pulse);
        ctx.shadowColor = c1;
        ctx.beginPath();
        ctx.roundRect(btnX - 2 * sf, btnY - 2 * sf, btnW + 4 * sf, btnH + 4 * sf, 16 * sf);
        ctx.stroke();
        ctx.restore();

        // 2. Base Gradient (Premium 3-Stop Vibrant)
        const grad = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnH);
        grad.addColorStop(0, '#ffffff'); 
        grad.addColorStop(0.3, c1);
        grad.addColorStop(1, '#000000');
        ctx.fillStyle = grad;
        ctx.shadowBlur = 35 * sf * pulse; ctx.shadowColor = c2;
        ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH, 14 * sf); ctx.fill();

        // 3. Shimmer Sweep (Faster & Sharper)
        const shimmerPos = ((time * 1.4) % 3) - 1.5;
        const sGrad = ctx.createLinearGradient(btnX + btnW * shimmerPos, btnY, btnX + btnW * (shimmerPos + 0.15), btnY + btnH);
        sGrad.addColorStop(0, 'rgba(255,255,255,0)');
        sGrad.addColorStop(0.5, 'rgba(255,255,255,0.4)');
        sGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sGrad;
        ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH, 14 * sf); ctx.fill();

        // 4. Inner Bevel Highlight
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.5 * sf;
        ctx.beginPath(); ctx.roundRect(btnX + 2*sf, btnY + 2*sf, btnW - 4*sf, btnH - 4*sf, 12 * sf); ctx.stroke();

        // -- Text & Icon Group (Group Centering) --
        const fontSize = 40 * sf; 
        const tracking = 2 * sf; 
        ctx.font = `900 ${Math.floor(fontSize)}px "Black Han Sans"`;
        const textStr = "PLAY";
        
        const chars = textStr.split('');
        const textW = chars.reduce((acc, char) => acc + ctx.measureText(char).width + tracking, 0) - tracking;
        
        const iconSize = btnH * 0.52; 
        const spacing = 30 * sf; 
        const totalW = textW + spacing + iconSize;
        
        // Unified Pulse Animation (Pronounced)
        const btnPulse = 1.0 + Math.sin(time * 7.5) * 0.045;
        const textFlicker = 0.7 + Math.sin(time * 15) * 0.3; // High-frequency neon flicker
        
        const centerX = btnX + btnW / 2;
        const centerY = btnY + btnH / 2;
        
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.scale(btnPulse, btnPulse);
        ctx.translate(-centerX, -centerY);

        const startX = btnX + (btnW - totalW) / 2;
        const tx = startX;
        const ty = centerY + fontSize * 0.35;
        const ix = startX + textW + spacing + iconSize / 2;

        // 1. Draw Text with Flickering Glow
        ctx.save();
        ctx.shadowBlur = 20 * sf * textFlicker;
        ctx.shadowColor = '#fff';
        drawTrackedText(ctx, textStr, tx, ty, fontSize, tracking, '#fff', 'left', 'rgba(0,0,0,0.9)', '"Black Han Sans"', 7 * sf, 9 * sf);
        ctx.restore();

        // 2. Draw Solid Triangle Icon
        ctx.save();
        ctx.translate(ix, centerY);
        ctx.shadowBlur = 20 * sf * textFlicker; ctx.shadowColor = '#fff';
        
        ctx.beginPath();
        ctx.moveTo(-iconSize * 0.4, -iconSize * 0.5);
        ctx.lineTo(iconSize * 0.6, 0);
        ctx.lineTo(-iconSize * 0.4, iconSize * 0.5);
        ctx.closePath();
        
        ctx.fillStyle = '#fff'; ctx.fill();
        ctx.strokeStyle = '#000'; ctx.lineWidth = 2 * sf; ctx.stroke();
        
        ctx.restore();
        ctx.restore();
        ctx.restore();
    }

    public renderBackButton(ctx: CanvasRenderingContext2D, layout: MenuLayoutResult, sf: number, time: number) {
        const { backBtnX: bx, backBtnY: by, backBtnW: bw, backBtnH: bh } = layout;

        ctx.save();
        // 1. Premium Red Gradient (CollectionUI Reference)
        const grad = ctx.createLinearGradient(bx, by, bx, by + bh);
        grad.addColorStop(0, '#ff4757'); 
        grad.addColorStop(1, '#990000');
        ctx.fillStyle = grad;
        
        // 2. 3px White Border (Scaled)
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3 * sf;
        
        ctx.shadowBlur = 15 * sf; ctx.shadowColor = 'rgba(255, 71, 87, 0.4)';
        
        ctx.beginPath(); 
        ctx.roundRect(bx, by, bw, bh, 10 * sf); 
        ctx.fill();
        ctx.stroke();

        // 3. Text Centering (No Arrow for Consistency)
        const fontSize = 18 * sf; 
        const tracking = 3 * sf;
        ctx.font = `700 ${Math.floor(fontSize)}px "Goldman"`;
        const textStr = "BACK";

        // Pulse Animation
        const btnPulse = 1.0 + Math.sin(time * 3.5) * 0.02;

        const centerX = bx + bw / 2;
        const centerY = by + bh / 2;

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.scale(btnPulse, btnPulse);
        ctx.translate(-centerX, -centerY);

        const ty = centerY + fontSize * 0.35;
        drawTrackedText(ctx, textStr, centerX, ty, fontSize, tracking, '#fff', 'center', 'rgba(0,0,0,0.5)', '"Goldman"');
        
        ctx.restore();
        ctx.restore();
    }
}
