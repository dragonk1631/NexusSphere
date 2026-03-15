import { type MenuLayoutResult } from '../MenuLayout';
import { type MenuRenderState, type SongEntry } from '../../types/GameTypes';
import {
    hexToRgb,
    lerpColor,
    drawPremiumPanel,
    drawPremiumTypography
} from '../MenuUIUtils';

export class SongListRenderer {
    public render(ctx: CanvasRenderingContext2D, layout: MenuLayoutResult, state: MenuRenderState, sf: number, c1: string, c2: string, time: number) {
        const { listX, listW, listH, listInnerY, itemHeight, visibleCount, padding } = layout;

        // "TRACK SELECTION" Panel
        const panelY = padding;
        const panelH = listH + (layout.listY - padding);
        drawPremiumPanel(ctx, listX, panelY, listW, panelH, "", c2, c1, sf);

        // ── Render Filter Tabs ──
        const { tabAreaX, tabAreaY, tabAreaH, tabWidth, uploadBtnX, uploadBtnY, uploadBtnW, uploadBtnH } = layout;
        const filters: Array<MenuRenderState['currentFilter']> = ['all', 'official', 'custom'];
        const labels = ['ALL', 'OFFICIAL', 'MY SONGS'];

        filters.forEach((f, i) => {
            const tx = tabAreaX + i * tabWidth;
            const isSelected = state.currentFilter === f;
            
            ctx.save();
            if (isSelected) {
                const grad = ctx.createLinearGradient(tx, tabAreaY, tx, tabAreaY + tabAreaH);
                grad.addColorStop(0, c1);
                grad.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = grad;
                ctx.beginPath(); ctx.roundRect(tx, tabAreaY, tabWidth - 4 * sf, tabAreaH, 4 * sf); ctx.fill();
                ctx.strokeStyle = c1;
                ctx.lineWidth = 1 * sf;
                ctx.stroke();
            } else {
                ctx.fillStyle = 'rgba(255,255,255,0.05)';
                ctx.beginPath(); ctx.roundRect(tx, tabAreaY, tabWidth - 4 * sf, tabAreaH, 4 * sf); ctx.fill();
            }

            ctx.font = `600 ${Math.floor(12 * sf)}px "Orbitron"`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = isSelected ? '#fff' : 'rgba(255,255,255,0.4)';
            ctx.fillText(labels[i], tx + tabWidth / 2 - 2 * sf, tabAreaY + tabAreaH / 2);
            ctx.restore();
        });

        // ── Render Upload Button ──
        ctx.save();
        const upGrad = ctx.createLinearGradient(uploadBtnX, uploadBtnY, uploadBtnX, uploadBtnY + uploadBtnH);
        upGrad.addColorStop(0, '#ff00ff');
        upGrad.addColorStop(1, '#7a007a');
        ctx.fillStyle = upGrad;
        ctx.shadowBlur = 10 * sf; ctx.shadowColor = '#ff00ff';
        ctx.beginPath(); ctx.roundRect(uploadBtnX, uploadBtnY, uploadBtnW, uploadBtnH, 4 * sf); ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1 * sf;
        ctx.stroke();

        ctx.font = `900 ${Math.floor(18 * sf)}px "Orbitron"`;
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText("+", uploadBtnX + uploadBtnW / 2, uploadBtnY + uploadBtnH / 2);
        ctx.restore();

        if (state.songList.length === 0) return;

        const Math_max = Math.max;
        const Math_min = Math.min;
        const startIndex = Math_max(0, Math_min(state.selectedSongIndex - Math.floor(visibleCount / 2), state.songList.length - visibleCount));
        const endIndex = Math_min(state.songList.length, startIndex + visibleCount);

        const contentAreaH = panelH - (listInnerY - panelY) - (20 * sf);

        ctx.save();
        ctx.beginPath();
        ctx.rect(listX, listInnerY, listW, contentAreaH);
        ctx.clip();

        for (let i = startIndex; i < endIndex; i++) {
            const song = state.songList[i];
            const isSelected = i === state.selectedSongIndex;
            const y = listInnerY + (i - startIndex) * itemHeight;

            this.renderPremiumSongItem(ctx, song, i, listX + (20 * sf), y, listW - (60 * sf), itemHeight, isSelected, sf, time, c1, c2);
        }
        ctx.restore();

        // ── Scrollbar ──
        const scrollbarW = 10 * sf;
        const scrollbarX = listX + listW - scrollbarW - (8 * sf);
        const scrollbarY = listInnerY;
        const scrollbarTrackH = contentAreaH;

        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.beginPath(); ctx.roundRect(scrollbarX, scrollbarY, scrollbarW, scrollbarTrackH, 5 * sf); ctx.fill();
        ctx.strokeStyle = `rgba(${hexToRgb(c1)}, 0.35)`;
        ctx.lineWidth = 1.5 * sf;
        ctx.stroke();

        const thumbH = Math_max(scrollbarTrackH * (visibleCount / Math_max(1, state.songList.length)), 40 * sf);
        const scrollRange = scrollbarTrackH - thumbH;
        const scrollProgress = state.songList.length > 1 ? state.selectedSongIndex / (state.songList.length - 1) : 0;
        const thumbY = scrollbarY + (scrollProgress * scrollRange);

        const thumbGrad = ctx.createLinearGradient(scrollbarX, thumbY, scrollbarX, thumbY + thumbH);
        thumbGrad.addColorStop(0, c1);
        thumbGrad.addColorStop(1, c2);

        ctx.save();
        ctx.shadowBlur = 16 * sf; ctx.shadowColor = c1;
        ctx.fillStyle = thumbGrad;
        ctx.beginPath(); ctx.roundRect(scrollbarX, thumbY, scrollbarW, thumbH, 5 * sf);
        ctx.fill();
        ctx.strokeStyle = c2;
        ctx.lineWidth = 1.5 * sf;
        ctx.stroke();
        ctx.restore();
    }

    private renderPremiumSongItem(ctx: CanvasRenderingContext2D, song: SongEntry, index: number, x: number, y: number, contentW: number, itemHeight: number, isSelected: boolean, sf: number, time: number, c1: string, c2: string) {
        ctx.save();
        ctx.translate(x, y);

        const innerH = itemHeight - 12 * sf;
        const innerY = 6 * sf;

        if (isSelected) {
            const pulse = 0.9 + Math.sin(time * 8) * 0.1;
            ctx.shadowBlur = 25 * sf * pulse; ctx.shadowColor = `rgba(${hexToRgb(c1)}, 0.5)`;
            const activeGrad = ctx.createLinearGradient(0, 0, contentW, 0);
            activeGrad.addColorStop(0, c1);
            activeGrad.addColorStop(0.5, lerpColor(c1, '#000', 0.8));
            activeGrad.addColorStop(1, 'rgba(0,0,0,0.4)');
            ctx.fillStyle = activeGrad;
            ctx.beginPath(); ctx.roundRect(0, innerY, contentW, innerH, 8 * sf); ctx.fill();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = c2;
            ctx.lineWidth = 2 * sf;
            ctx.stroke();
        } else {
            const idleGrad = ctx.createLinearGradient(0, 0, contentW, 0);
            idleGrad.addColorStop(0, 'rgba(255,255,255,0.08)');
            idleGrad.addColorStop(1, 'rgba(255,255,255,0.02)');
            ctx.fillStyle = idleGrad;
            ctx.beginPath(); ctx.roundRect(0, innerY, contentW, innerH, 6 * sf); ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.40)';
            ctx.lineWidth = 1.2 * sf;
            ctx.stroke();
        }

        const indexStr = (index + 1).toString().padStart(2, '0');
        const itemX = 35 * sf;
        const itemY = itemHeight * 0.5;
        if (isSelected) {
            drawPremiumTypography(ctx, indexStr, itemX, itemY, 'center', itemHeight * 0.36, '#fff', true, c1, 60 * sf, 'rgba(0,0,0,0.65)');
        } else {
            ctx.save();
            ctx.font = `800 ${Math.floor(itemHeight * 0.32)}px "Orbitron"`;
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(indexStr, itemX, itemY);
            ctx.restore();
        }

        const name = song.name.toUpperCase();
        const maxW = contentW - 140 * sf;
        const textX = 85 * sf;
        const textY = itemHeight * 0.6; // Slightly lowered to make space for badge
        
        if (isSelected) {
            drawPremiumTypography(ctx, name, textX, textY, 'left', itemHeight * 0.36, '#fff', true, c1, maxW, 'rgba(0,0,0,0.7)');
        } else {
            ctx.save();
            ctx.font = `700 ${Math.floor(itemHeight * 0.32)}px "Orbitron"`;
            ctx.fillStyle = 'rgba(255,255,255,0.75)';
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillText(name, textX, textY, maxW);
            ctx.restore();
        }

        // ── Badges and Delete Button ──
        const badgeX = 85 * sf;
        const badgeY = innerY + 12 * sf;

        if (song.isCustom) {
            ctx.fillStyle = 'rgba(255, 0, 255, 0.2)';
            ctx.strokeStyle = '#ff00ff';
            ctx.lineWidth = 1 * sf;
            const bW = 60 * sf;
            const bH = 16 * sf;
            ctx.beginPath(); ctx.roundRect(badgeX, badgeY - bH/2, bW, bH, 4 * sf); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#ff00ff';
            ctx.font = `900 ${Math.floor(9 * sf)}px "Orbitron"`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText("CUSTOM", badgeX + bW/2, badgeY);

            const delW = 24 * sf;
            const delX = contentW - delW - 15 * sf;
            const delY = itemHeight * 0.5;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.beginPath(); ctx.arc(delX, delY, 10 * sf, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#ff3333';
            ctx.lineWidth = 2 * sf;
            ctx.beginPath();
            ctx.moveTo(delX - 4 * sf, delY - 4 * sf); ctx.lineTo(delX + 4 * sf, delY + 4 * sf);
            ctx.moveTo(delX + 4 * sf, delY - 4 * sf); ctx.lineTo(delX - 4 * sf, delY + 4 * sf);
            ctx.stroke();
        } else {
            ctx.fillStyle = `rgba(${hexToRgb(c1)}, 0.2)`;
            ctx.strokeStyle = c1;
            ctx.lineWidth = 1 * sf;
            const bW = 60 * sf;
            const bH = 16 * sf;
            ctx.beginPath(); ctx.roundRect(badgeX, badgeY - bH/2, bW, bH, 4 * sf); ctx.fill(); ctx.stroke();
            ctx.fillStyle = c1;
            ctx.font = `900 ${Math.floor(9 * sf)}px "Orbitron"`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText("OFFICIAL", badgeX + bW/2, badgeY);
        }

        if (isSelected) {
            const shift = Math.sin(time * 12) * 4 * sf;
            ctx.fillStyle = c2; ctx.font = `900 ${Math.floor(18 * sf)}px "Orbitron"`;
            ctx.shadowBlur = 10 * sf; ctx.shadowColor = c2;
            ctx.fillText("»", contentW - 40 * sf + shift, itemHeight * 0.5);
        }

        ctx.restore();
    }
}
