import { type MenuLayoutResult } from '../MenuLayout';
import { type MenuRenderState, type SongEntry } from '../../types/GameTypes';
import {
    hexToRgb,
    drawPremiumPanel
} from '../MenuUIUtils';

export class SongListRenderer {
    public render(ctx: CanvasRenderingContext2D, layout: MenuLayoutResult, state: MenuRenderState, sf: number, c1: string, c2: string, time: number) {
        const { listX, listW, listH, listInnerY, itemHeight, visibleCount, padding } = layout;

        // "TRACK SELECTION" Panel
        const panelY = padding;
        const panelH = listH + (layout.listY - padding);
        drawPremiumPanel(ctx, listX, panelY, listW, panelH, "", c2, c1, sf);

        // ── Render Filter Tabs ──
        const { tabAreaX, tabAreaY, tabAreaH, tabWidth } = layout;
        const filters: Array<MenuRenderState['currentFilter']> = ['all', 'official', 'custom', 'favorite'];
        const labels = ['ALL', 'OFFICIAL', 'USER', 'FAVORITES'];

        filters.forEach((f, i) => {
            const tx = tabAreaX + i * tabWidth;
            const isSelected = state.currentFilter === f;
            
            ctx.save();
            if (isSelected) {
                // Selected: Theme Glow & Gradient
                ctx.shadowBlur = 15 * sf;
                ctx.shadowColor = c1;
                
                const grad = ctx.createLinearGradient(tx, tabAreaY, tx, tabAreaY + tabAreaH);
                grad.addColorStop(0, c1);
                grad.addColorStop(1, 'rgba(0,0,0,0.6)');
                ctx.fillStyle = grad;
                
                ctx.beginPath(); 
                ctx.roundRect(tx, tabAreaY, tabWidth - 4 * sf, tabAreaH, 4 * sf); 
                ctx.fill();
                
                // Bright white border for emphasis
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2 * sf;
                ctx.stroke();
            } else {
                // Unselected: Clearly distinguish with a greyish base
                ctx.fillStyle = 'rgba(50, 50, 50, 0.4)';
                ctx.beginPath(); 
                ctx.roundRect(tx, tabAreaY, tabWidth - 4 * sf, tabAreaH, 4 * sf); 
                ctx.fill();
                
                // Dimmer border for inactive state
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.lineWidth = 1 * sf;
                ctx.stroke();
            }

            ctx.font = `800 ${Math.floor(13 * sf)}px "Orbitron"`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Subtle off-white for USER tab to avoid being "too much"
            const isUserTab = labels[i] === 'USER';
            const accentColor = isUserTab ? '#e0f0ff' : '#fff';
            ctx.fillStyle = isSelected ? accentColor : 'rgba(255,255,255,0.85)';
            
            // 1. Stroke (No shadow — prevents upward shadow artifact)
            ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; ctx.shadowColor = 'transparent';
            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            ctx.lineWidth = 2 * sf;
            ctx.strokeText(labels[i], tx + tabWidth / 2, tabAreaY + tabAreaH / 2);
            // 2. Fill (Downward shadow)
            ctx.shadowBlur = 4 * sf; ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 1.5 * sf;
            ctx.fillText(labels[i], tx + tabWidth / 2, tabAreaY + tabAreaH / 2);
            ctx.restore();
        });

          // ── Render Upload Button (FOLDER) ──
        if (state.currentFilter === 'custom') {
            const { folderBtnX, folderBtnY, folderBtnW, folderBtnH } = layout;
            
            // Compact Folder Button (Icon Only)
            ctx.save();
            const fldGrad = ctx.createLinearGradient(folderBtnX, folderBtnY, folderBtnX, folderBtnY + folderBtnH);
            fldGrad.addColorStop(0, '#00d2ff');
            fldGrad.addColorStop(1, '#0072ff');
            ctx.fillStyle = fldGrad;
            ctx.shadowBlur = 10 * sf; ctx.shadowColor = '#00d2ff';
            ctx.beginPath(); ctx.roundRect(folderBtnX, folderBtnY, folderBtnW, folderBtnH, 6 * sf); ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 1 * sf; ctx.stroke();

            ctx.font = `900 ${Math.floor(20 * sf)}px "Orbitron"`; // Larger icon
            ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText("📂+", folderBtnX + folderBtnW / 2, folderBtnY + folderBtnH / 2);
            ctx.restore();
        }

        if (state.songList.length === 0) {
            if (state.currentFilter === 'custom') {
                this.renderEmptyUserPlaceholder(ctx, listX, listInnerY, listW, listH * 0.5, sf, c1);
            }
            return;
        }

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

            // Enforce a strict gap: item width is list width minus scrollbar and extra margin
            const safeItemW = listW - layout.scrollbarW - 25 * sf;
            this.renderPremiumSongItem(ctx, song, listX + (10 * sf), y, safeItemW, itemHeight, isSelected, sf, time, c1, c2);
        }
        ctx.restore();

        // ── Scrollbar ──
        const scrollbarW = layout.scrollbarW;
        const scrollbarX = listX + listW - scrollbarW - (8 * sf);
        const scrollbarY = listInnerY + 6 * sf;
        const scrollbarTrackH = layout.scrollbarTrackH;

        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.beginPath(); ctx.rect(scrollbarX, scrollbarY, scrollbarW, scrollbarTrackH); ctx.fill(); // Rect is faster than roundRect
        ctx.strokeStyle = `rgba(${hexToRgb(c1)}, 0.35)`;
        ctx.lineWidth = 1 * sf;
        ctx.stroke();

        const thumbH = Math_max(scrollbarTrackH * (visibleCount / Math_max(1, state.songList.length)), 40 * sf);
        const scrollRange = scrollbarTrackH - thumbH;
        const scrollProgress = state.songList.length > 1 ? state.selectedSongIndex / (state.songList.length - 1) : 0;
        const thumbY = scrollbarY + (scrollProgress * scrollRange);

        ctx.save();
        // Cheap Glow: Solid opaque color instead of shadowBlur
        ctx.fillStyle = c1;
        ctx.beginPath(); ctx.roundRect(scrollbarX, thumbY, scrollbarW, thumbH, 4 * sf); ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1 * sf;
        ctx.stroke();
        ctx.restore();

        // ── Render Toast ──
        if (state.toastMessage) {
            this.renderToast(ctx, state.toastMessage, listX, panelY, listW, sf, c1, state.toastTimer || 0);
        }
    }

    private renderToast(ctx: CanvasRenderingContext2D, message: string, listX: number, panelY: number, listW: number, sf: number, color: string, timer: number) {
        // Animation Logic: Fade in/out and Slide up
        let alpha = 1;
        let yOffset = 0;
        const duration = 2000;
        const animTime = 300;

        if (timer > duration - animTime) {
            const p = (duration - timer) / animTime;
            alpha = p;
            yOffset = (1 - p) * 15 * sf;
        } else if (timer < animTime) {
            const p = timer / animTime;
            alpha = p;
            yOffset = (p - 1) * 15 * sf;
        }

        ctx.save();
        ctx.globalAlpha = alpha;
        
        const toastW = listW * 0.8;
        const toastH = 55 * sf;
        const toastX = listX + (listW - toastW) / 2;
        const toastY = panelY + 120 * sf + yOffset; 

        ctx.fillStyle = 'rgba(0,0,0,0.92)';
        ctx.shadowBlur = 30 * sf; ctx.shadowColor = color;
        ctx.shadowOffsetX = 2 * sf; ctx.shadowOffsetY = 2 * sf;
        ctx.beginPath(); ctx.roundRect(toastX, toastY, toastW, toastH, 12 * sf); ctx.fill();
        ctx.strokeStyle = color; ctx.lineWidth = 3 * sf; ctx.stroke();

        ctx.font = `900 ${Math.floor(22 * sf)}px "Orbitron"`;
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(message, toastX + toastW / 2, toastY + toastH / 2);
        ctx.restore();
    }

    private renderPremiumSongItem(ctx: CanvasRenderingContext2D, song: SongEntry, x: number, y: number, contentW: number, itemHeight: number, isSelected: boolean, sf: number, time: number, c1: string, c2: string) {
        ctx.save();
        ctx.translate(x, y);

        const innerH = itemHeight - 12 * sf;
        const innerY = 6 * sf;

        if (isSelected) {
            const pulse = 0.9 + Math.sin(time * 8) * 0.1;
            // Removed expensive shadowBlur every frame
            const activeGrad = ctx.createLinearGradient(0, 0, contentW, 0);
            activeGrad.addColorStop(0, `rgba(${hexToRgb(c1)}, ${pulse})`);
            activeGrad.addColorStop(1, 'rgba(0,0,0,0.4)');
            ctx.fillStyle = activeGrad;
            ctx.beginPath(); ctx.rect(0, innerY, contentW, innerH); ctx.fill();
            ctx.strokeStyle = c2;
            ctx.lineWidth = 2 * sf;
            ctx.stroke();
        } else {
            // Unselected items: Solid flat color is faster than gradients
            ctx.fillStyle = 'rgba(255,255,255,0.06)';
            ctx.beginPath(); ctx.rect(0, innerY, contentW, innerH); ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.lineWidth = 1 * sf;
            ctx.stroke();
        }

        // ── Favorite Star Box ──
        const boxSize = innerH - 12 * sf;
        const boxX = 8 * sf; // Constant offset within the item
        const boxY = innerY + (innerH - boxSize) / 2;
        
        ctx.save();
        // Star Box Background
        ctx.fillStyle = isSelected ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.05)';
        ctx.beginPath(); ctx.roundRect(boxX, boxY, boxSize, boxSize, 4 * sf); ctx.fill();
        ctx.strokeStyle = isSelected ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1 * sf;
        ctx.stroke();

        // Star Icon (Favorite)
        const starX = boxX + boxSize / 2;
        const starY = boxY + boxSize / 2;
        const starSize = boxSize * 0.35;
        
        ctx.save();
        ctx.translate(starX, starY);
        if (song.isFavorite) {
            ctx.fillStyle = '#ffcc00'; // Gold
            ctx.shadowBlur = 15 * sf; ctx.shadowColor = '#ffcc00';
            ctx.shadowOffsetX = 2 * sf; ctx.shadowOffsetY = 2 * sf;
            this.drawStar(ctx, 0, 0, 5, starSize, starSize * 0.5);
            ctx.fill();
        } else {
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.lineWidth = 1.5 * sf;
            this.drawStar(ctx, 0, 0, 5, starSize, starSize * 0.5);
            ctx.stroke();
        }
        ctx.restore();
        ctx.restore(); // Restores from Star Box translate/save

        const name = song.name.toUpperCase();
        const baseFontSize = itemHeight * 0.35; // Unified font size for all states
        const gutter = 10 * sf;
        const maxW = contentW - boxSize - 25 * sf - gutter; // Increased width to prevent shrinking
        const textX = boxX + boxSize + 18 * sf; 
        const textY = itemHeight * 0.6; 
        
        if (isSelected) {
            ctx.save();
            ctx.font = `900 ${Math.floor(baseFontSize)}px "Orbitron"`;
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            // 1. Stroke (No shadow — prevents upward shadow artifact)
            ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; ctx.shadowColor = 'transparent';
            ctx.strokeStyle = 'rgba(0,0,0,0.9)';
            ctx.lineWidth = 3.5 * sf;
            ctx.strokeText(name, textX, textY, maxW);
            
            // 2. Fill (With intense downward shadow/glow)
            ctx.shadowBlur = 8 * sf; 
            ctx.shadowColor = song.isCustom ? 'rgba(255, 0, 255, 0.8)' : 'rgba(0,0,0,1)';
            ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 4 * sf; // Downward drop
            ctx.fillStyle = song.isCustom ? '#e0f0ff' : '#fff';
            ctx.fillText(name, textX, textY, maxW);
            ctx.restore();
        } else {
            ctx.save();
            ctx.font = `700 ${Math.floor(baseFontSize)}px "Orbitron"`;
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            // 1. Stroke (No shadow — prevents upward shadow artifact)
            ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; ctx.shadowColor = 'transparent';
            ctx.strokeStyle = 'rgba(0,0,0,0.7)';
            ctx.lineWidth = 2.2 * sf;
            ctx.strokeText(name, textX, textY, maxW);
            
            // 2. Fill (Downward shadow/glow)
            ctx.shadowBlur = 5 * sf; 
            ctx.shadowColor = song.isCustom ? 'rgba(255, 0, 255, 0.6)' : 'rgba(0,0,0,0.9)';
            ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 2.5 * sf;
            ctx.fillStyle = song.isCustom ? '#e0f0ff' : 'rgba(255,255,255,0.75)';
            ctx.fillText(name, textX, textY, maxW);
            ctx.restore();
        }

        // ── Badges and Delete Button ──
        const badgeX = textX;
        const badgeY = innerY + 12 * sf;

        if (song.isCustom) {
            const bW = 60 * sf;
            const bH = 16 * sf;
            ctx.fillStyle = 'rgba(255, 0, 255, 0.2)';
            ctx.strokeStyle = '#ff00ff';
            ctx.lineWidth = 1 * sf;
            ctx.beginPath(); ctx.roundRect(badgeX, badgeY - bH/2, bW, bH, 4 * sf); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#ff00ff';
            ctx.font = `900 ${Math.floor(9 * sf)}px "Orbitron"`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 2 * sf;
            ctx.strokeText("CUSTOM", badgeX + bW/2, badgeY);
            ctx.fillText("CUSTOM", badgeX + bW/2, badgeY);

            // Trash can icon - only for selected item
            if (isSelected) {
                const delW = 34 * sf;
                const delX = contentW - delW/2 - 10 * sf;
                const delY = innerH * 0.5 + innerY;
                
                ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
                ctx.beginPath(); ctx.arc(delX, delY, 14 * sf, 0, Math.PI * 2); ctx.fill();
                
                this.drawTrashIcon(ctx, delX, delY, sf);
            }
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
            ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 2 * sf;
            ctx.strokeText("OFFICIAL", badgeX + bW/2, badgeY);
            ctx.fillText("OFFICIAL", badgeX + bW/2, badgeY);
        }

        // Indicator removed as requested to keep font size consistent

        ctx.restore();
    }

    private renderEmptyUserPlaceholder(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, sf: number, color: string) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Icon/Illustration (Simplified)
        ctx.font = `${Math.floor(40 * sf)}px "Orbitron"`;
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillText("🎹", x + w/2, y + h/2 - 30 * sf);

        ctx.font = `700 ${Math.floor(22 * sf)}px "Orbitron"`;
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText("NO USER SONGS FOUND", x + w/2, y + h/2 + 20 * sf);
        
        ctx.font = `500 ${Math.floor(12 * sf)}px "Orbitron"`;
        ctx.fillStyle = color;
        ctx.fillText("CLICK THE ADD FOLDER BUTTON OR DRAG MIDI FILES HERE", x + w/2, y + h/2 + 45 * sf);
        ctx.restore();
    }

    private drawTrashIcon(ctx: CanvasRenderingContext2D, x: number, y: number, sf: number) {
        ctx.save();
        ctx.translate(x, y);
        
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 1.5 * sf;
        
        // Trash Can Body
        ctx.beginPath();
        ctx.moveTo(-5 * sf, -3 * sf);
        ctx.lineTo(-4 * sf, 6 * sf);
        ctx.lineTo(4 * sf, 6 * sf);
        ctx.lineTo(5 * sf, -3 * sf);
        ctx.closePath();
        ctx.stroke();

        // Trash Can Lid
        ctx.beginPath();
        ctx.moveTo(-7 * sf, -4 * sf);
        ctx.lineTo(7 * sf, -4 * sf);
        ctx.stroke();

        // Lid Handle
        ctx.beginPath();
        ctx.moveTo(-2 * sf, -4 * sf);
        ctx.lineTo(-2 * sf, -6 * sf);
        ctx.lineTo(2 * sf, -6 * sf);
        ctx.lineTo(2 * sf, -4 * sf);
        ctx.stroke();

        // Vertical lines in body
        ctx.beginPath(); ctx.moveTo(-2 * sf, -1 * sf); ctx.lineTo(-1.5 * sf, 4 * sf); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0 * sf, -1 * sf); ctx.lineTo(0 * sf, 4 * sf); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(2 * sf, -1 * sf); ctx.lineTo(1.5 * sf, 4 * sf); ctx.stroke();

        ctx.restore();
    }

    private drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number) {
        let rot = Math.PI / 2 * 3;
        let x = cx;
        let y = cy;
        const step = Math.PI / spikes;

        ctx.beginPath();
        ctx.moveTo(cx, cy - outerRadius);
        for (let i = 0; i < spikes; i++) {
            x = cx + Math.cos(rot) * outerRadius;
            y = cy + Math.sin(rot) * outerRadius;
            ctx.lineTo(x, y);
            rot += step;

            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            ctx.lineTo(x, y);
            rot += step;
        }
        ctx.lineTo(cx, cy - outerRadius);
        ctx.closePath();
    }
}
