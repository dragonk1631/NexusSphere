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

        // "TRACK SELECTION" Panel - Use padding for py to align perfectly with top
        const panelY = padding;
        const panelH = listH + (layout.listY - padding);
        drawPremiumPanel(ctx, listX, panelY, listW, panelH, "LIST", c2, c1, sf);

        if (state.songList.length === 0) return;

        const Math_max = Math.max;
        const Math_min = Math.min;
        const startIndex = Math_max(0, Math_min(state.selectedSongIndex - Math.floor(visibleCount / 2), state.songList.length - visibleCount));
        const endIndex = Math_min(state.songList.length, startIndex + visibleCount);

        // Content Area with precise clipping
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

        // Premium Scrollbar
        const scrollbarW = 10 * sf;
        const scrollbarX = listX + listW - scrollbarW - (8 * sf);
        const scrollbarY = listInnerY;
        const scrollbarTrackH = contentAreaH;

        // Track - Darker bg, stronger border
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.beginPath(); ctx.roundRect(scrollbarX, scrollbarY, scrollbarW, scrollbarTrackH, 5 * sf); ctx.fill();
        ctx.strokeStyle = `rgba(${hexToRgb(c1)}, 0.35)`;
        ctx.lineWidth = 1.5 * sf;
        ctx.stroke();

        // Thumb
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

        // Thumb outline
        ctx.strokeStyle = c2;
        ctx.lineWidth = 1.5 * sf;
        ctx.stroke();

        // Centre grip line
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(scrollbarX + scrollbarW * 0.25, thumbY + thumbH * 0.42, scrollbarW * 0.5, thumbH * 0.16);
        ctx.restore();
    }

    private renderPremiumSongItem(ctx: CanvasRenderingContext2D, song: SongEntry, index: number, x: number, y: number, contentW: number, itemHeight: number, isSelected: boolean, sf: number, time: number, c1: string, c2: string) {
        ctx.save();
        ctx.translate(x, y);

        const innerH = itemHeight - 12 * sf;
        const innerY = 6 * sf;

        if (isSelected) {
            // High-End Selected Slat
            const pulse = 0.9 + Math.sin(time * 8) * 0.1;
            ctx.shadowBlur = 25 * sf * pulse; ctx.shadowColor = `rgba(${hexToRgb(c1)}, 0.5)`;

            const activeGrad = ctx.createLinearGradient(0, 0, contentW, 0);
            activeGrad.addColorStop(0, c1);
            activeGrad.addColorStop(0.5, lerpColor(c1, '#000', 0.8));
            activeGrad.addColorStop(1, 'rgba(0,0,0,0.4)');

            ctx.fillStyle = activeGrad;
            ctx.beginPath(); ctx.roundRect(0, innerY, contentW, innerH, 8 * sf); ctx.fill();

            // Bevel Highlights
            ctx.shadowBlur = 0;
            ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 0.5 * sf;
            ctx.beginPath(); ctx.moveTo(5 * sf, innerY + 1 * sf); ctx.lineTo(contentW - 5 * sf, innerY + 1 * sf); ctx.stroke();

            // Interactive Scanning Sweep
            // Active Slat
            const sGrad = ctx.createLinearGradient(0, innerY, contentW, innerY);
            sGrad.addColorStop(0, c1);
            sGrad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
            sGrad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = sGrad;
            ctx.beginPath(); ctx.roundRect(0, innerY, contentW, innerH, 8 * sf); ctx.fill();

            // Outline for clear selected item separation
            ctx.strokeStyle = c2;
            ctx.lineWidth = 2 * sf;
            ctx.stroke();

            // Glowing Indicator
            ctx.fillStyle = c2;
            ctx.shadowBlur = 15 * sf; ctx.shadowColor = c2;
            ctx.fillRect(2 * sf, innerY + 12 * sf, 3 * sf, innerH - 24 * sf);
        } else {
            // Idle Slat - Richer background
            const idleGrad = ctx.createLinearGradient(0, 0, contentW, 0);
            idleGrad.addColorStop(0, 'rgba(255,255,255,0.08)');
            idleGrad.addColorStop(1, 'rgba(255,255,255,0.02)');
            ctx.fillStyle = idleGrad;
            ctx.beginPath(); ctx.roundRect(0, innerY, contentW, innerH, 6 * sf); ctx.fill();

            // Subtle indicator for idle items too
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.fillRect(2 * sf, innerY + 15 * sf, 2 * sf, innerH - 30 * sf);

            // Stronger distinct outline for idle items
            ctx.strokeStyle = 'rgba(255,255,255,0.40)';
            ctx.lineWidth = 1.2 * sf;
            ctx.stroke();
        }

        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const indexStr = (index + 1).toString().padStart(2, '0');

        const itemX = 35 * sf;
        const itemY = itemHeight * 0.5;
        if (isSelected) {
            const textFontSize = itemHeight * 0.36;
            drawPremiumTypography(ctx, indexStr, itemX, itemY, 'center', textFontSize, '#fff', true, c1, 60 * sf, 'rgba(0,0,0,0.65)');
        } else {
            ctx.save();
            ctx.font = `800 ${Math.floor(itemHeight * 0.32)}px "Orbitron"`;
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.fillText(indexStr, itemX, itemY);
            ctx.restore();
        }

        if (isSelected) {
            const textX = 85 * sf;
            const textY = itemHeight * 0.5;
            const textFontSize = itemHeight * 0.36;
            const maxW = contentW - 140 * sf;
            const name = song.name.toUpperCase();

            ctx.save();
            ctx.font = `900 ${Math.floor(textFontSize)}px "Orbitron"`;
            const rawW = ctx.measureText(name).width;

            if (rawW > maxW && name.includes(' ')) {
                // Multi-line rendering: Split by space if too long
                const words = name.split(' ');
                const mid = Math.ceil(words.length / 2);
                const line1 = words.slice(0, mid).join(' ');
                const line2 = words.slice(mid).join(' ');

                drawPremiumTypography(ctx, line1, textX, textY - 8 * sf, 'left', textFontSize, '#fff', true, c1, maxW, 'rgba(0,0,0,0.7)');
                drawPremiumTypography(ctx, line2, textX, textY + 12 * sf, 'left', textFontSize * 0.65, '#fff', false, c2, maxW, 'rgba(0,0,0,0.5)');
            } else {
                const scale = Math.min(1.0, maxW / rawW);
                const finalFontSize = textFontSize * scale;
                const finalW = ctx.measureText(name).width * scale;
                ctx.font = `900 ${Math.floor(finalFontSize)}px "Orbitron"`;

                const tgrad = ctx.createLinearGradient(textX, 0, textX + finalW, 0);
                tgrad.addColorStop(0, c1);
                tgrad.addColorStop(0.5, '#ffffff');
                tgrad.addColorStop(1, c2);

                ctx.textBaseline = 'middle';
                ctx.textAlign = 'left';
                ctx.strokeStyle = 'rgba(0,0,0,0.65)';
                ctx.lineWidth = 3 * (finalFontSize / 24);
                ctx.shadowColor = c1; ctx.shadowBlur = 18 * sf;
                ctx.strokeText(name, textX, textY);
                ctx.shadowColor = c1; ctx.shadowBlur = 12 * sf;
                ctx.fillStyle = tgrad;
                ctx.fillText(name, textX, textY);
            }
            ctx.restore();
        } else {
            const songColor = 'rgba(255,255,255,0.75)';
            const name = song.name.toUpperCase();
            const maxW = contentW - 140 * sf;

            ctx.save();
            ctx.font = `700 ${Math.floor(itemHeight * 0.32)}px "Orbitron"`;
            const rawW = ctx.measureText(name).width;

            if (rawW > maxW) {
                ctx.font = `700 ${Math.floor(itemHeight * 0.28)}px "Orbitron"`;
                ctx.fillStyle = songColor;
                ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
                ctx.fillText(name, 85 * sf, itemHeight * 0.5, maxW);
            } else {
                drawPremiumTypography(ctx, name, 85 * sf, itemHeight * 0.5, 'left', itemHeight * 0.36, songColor, false, 'transparent', maxW, 'rgba(0,0,0,0.35)');
            }
            ctx.restore();
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
