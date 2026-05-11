import { ScoreManager } from '../../../core/score/ScoreManager';
import { ThemeManager } from '../../../core/ThemeManager';
import { HUD_PALETTES } from '../constants/GameConstants';
import { ExperienceSystem } from '../../../core/score/ExperienceSystem';
import { AuthService } from '../../../services/auth/AuthService';
import type { SongEntry } from '../types/GameTypes';
import { ASSET_PATHS } from '../../../core/asset/AssetRegistry';
import type { CoreAudioEngine } from '../../../core/audio/CoreAudioEngine';

/**
 * ResultRenderer handles the stage clear / result screen.
 * v4.3 Absolute Fit Polish: Auto-shrinking typography and strict boundary enforcement.
 */
export class ResultRenderer {
    private playedRows: Set<number> = new Set();
    private lastTickElapsed: number = 0;
    private hasPlayedLevelUp: boolean = false;

    public render(ctx: CanvasRenderingContext2D, width: number, height: number, scoreManager: ScoreManager, song: SongEntry | null, _alpha: number = 0, phase: 'SCORE' | 'EXP' = 'SCORE', elapsed: number = 0, difficultyLabel: string = 'NORMAL', audioEngine?: CoreAudioEngine, charImage: HTMLImageElement | null = null) {
        const theme = ThemeManager.getInstance().getCurrentTheme();
        const pal = HUD_PALETTES[theme.id] || HUD_PALETTES['deep-space'];

        const score = scoreManager.getScore();
        const maxCombo = scoreManager.getMaxCombo();
        const accuracy = scoreManager.getAccuracy();
        const stats = scoreManager.getDetailedStats();
        const grade = scoreManager.getGrade();

        // [NEW] Premium Tech Colors (Inspired by reference)
        const JUDGE_COLORS: Record<string, string> = {
            PERFECT: '#FF00A0', // Neon Pink
            GREAT: '#FFD700',   // Gold
            GOOD: '#00F0FF',    // Cyan/Blue
            MISS: '#FF8000'     // Orange
        };

        // 1. Universal Scaling Factor (Refined for extreme aspect ratios)
        const isPortrait = height > width;
        const aspectRatio = width / height;
        const baseWidth = isPortrait ? 400 : 1200;
        const baseHeight = isPortrait ? 800 : 800;

        let scaleFactor = Math.min(width / baseWidth, height / baseHeight);
        
        // [POLISH] Adaptive Clamp: Reduce scale slightly on extremely thin/wide screens to ensure content fits
        if (aspectRatio > 2.0 || aspectRatio < 0.5) scaleFactor *= 0.9;
        
        const visibilityBoost = isPortrait ? 1.25 : 1.15;
        scaleFactor = Math.max(0.6, scaleFactor) * visibilityBoost;
        const sf = scaleFactor; 

        // [POLISH] Do NOT clearRect here. Let the engine's background (Blurred cover art) show through the 0.7 alpha panels.
        // this.drawBackground(ctx, width, height, song?.backgroundUrl || null, sf);

        // 2. Main Frame Geometry (Safe Height & Balanced Shift)
        const panelW = isPortrait ? width * 0.94 : width * 0.92;
        const panelH = isPortrait ? height * 0.82 : height * 0.80; // Slightly reduced to ensure margins
        const panelX = (width - panelW) / 2;
        // [POLISH] Balanced shift: Enough to clear header, but not too much to clip bottom
        const panelY = (height - panelH) / 2 + (isPortrait ? 20 * scaleFactor : 25 * scaleFactor);

        // 3. TECH HEADER (Top-Right "RESULT" - Snapped to Panel Right Edge)
        ctx.save();
        
        // [POLISH] Align headerX perfectly with the main panel's right border
        const headerX = panelX + panelW;
        // [POLISH] Safety Clamp: Ensure at least 50px from top and 30px above panel
        const headerY = Math.max(50 * sf, panelY - 30 * sf); 
        
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom'; 
        
        ctx.strokeStyle = this.getGradeColor(grade);
        ctx.lineWidth = 2 * sf;
        ctx.beginPath();
        ctx.moveTo(headerX, headerY - (5 * sf));
        ctx.lineTo(headerX - (100 * sf), headerY - (5 * sf));
        ctx.stroke();

        ctx.font = `900 ${Math.floor(42 * sf)}px "Orbitron"`;
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 15 * sf;
        ctx.shadowColor = this.getGradeColor(grade);
        ctx.fillText("RESULT", headerX, headerY - (5 * sf)); // Reduced text-to-line gap
        
        ctx.font = `400 ${Math.floor(10 * sf)}px "Orbitron"`;
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText("OVER RAPID SYSTEM / CORE ENGINE v4.5C", headerX, headerY + (12 * sf)); 
        ctx.restore();

        // Celebration layer is rendered at the very end of this method for front-layer visibility.

        // Glassmorphism Panel (Polish: More transparent + Multi-layer glow)
        ctx.save();
        
        // Layer 1: Deep shadow
        ctx.shadowBlur = 40 * scaleFactor;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        
        // Layer 2: Glass base (0.7 Alpha for background visibility)
        ctx.fillStyle = 'rgba(5, 7, 15, 0.7)'; 
        ctx.strokeStyle = pal.scorePanel;
        ctx.lineWidth = 4 * scaleFactor;
        
        const radius = 24 * scaleFactor;
        this.drawRoundedRect(ctx, panelX, panelY, panelW, panelH, radius);
        ctx.fill();
        
        // Layer 3: Edge Glow
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = pal.scorePanel;
        ctx.globalAlpha = 0.4;
        ctx.stroke();
        
        ctx.restore();

        // 4. Content Layout Navigation (SCORE Phase)
        if (isPortrait) {
            this.renderPortraitLayout(ctx, panelX, panelY, panelW, panelH, maxCombo, accuracy, stats, grade, pal, scaleFactor, JUDGE_COLORS, song, difficultyLabel, score);
        } else {
            this.renderLandscapeLayout(ctx, panelX, panelY, panelW, panelH, score, maxCombo, stats, grade, pal, scaleFactor, JUDGE_COLORS, song, charImage);
        }

        // 5. XP & Level System Panel (EXP Phase Popup)
        if (phase === 'EXP') {
            this.renderXPPopup(ctx, width, height, scoreManager, sf, elapsed, audioEngine);
        }

        // 6. Action Hint Removed as per user request to gain height
        
        // 7. Celebration Layer (Always on TOP)
        const isFC = scoreManager.isFullCombo();
        this.renderConfetti(ctx, width, height, elapsed, sf, isFC);
        
        if (isFC) {
            this.renderCelebration(ctx, width, height);
        }
    }

    private renderLandscapeLayout(ctx: CanvasRenderingContext2D, px: number, py: number, pw: number, ph: number, score: number, maxCombo: number, stats: any, grade: string, pal: any, sf: number, judgeColors: any, song: SongEntry | null, charImage: HTMLImageElement | null) {
        const colW = pw / 3;
        const margin = 30 * sf;
        const footerH = 100 * sf;
        const contentH = ph - footerH - margin;

        // 1. Song & Char (Left)
        this.renderSongSection(ctx, px + margin, py + margin, colW - margin * 1.5, contentH, song, sf, this.getGradeColor(grade), charImage);

        // 2. Score & Rank (Center)
        const centerX = px + colW;
        this.renderRankSection(ctx, centerX + margin/2, py + margin, colW - margin, contentH, grade, score, sf, stats);

        // 3. Judge & Max Combo (Right)
        const rightX = px + colW * 2;
        this.renderStatsSection(ctx, rightX + margin/2, py + margin, colW - margin * 1.5, contentH, stats, maxCombo, judgeColors, pal, sf);

        // --- Bottom Row: Rewards ---
        const bottomY = py + ph - (75 * sf);
        this.renderRewardBar(ctx, px + margin, bottomY, pw - margin * 2, 60 * sf, sf, this.getGradeColor(grade));
    }

    private renderSongSection(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, song: SongEntry | null, sf: number, accent: string, charImage: HTMLImageElement | null) {
        ctx.save();
        this.drawTechBorder(ctx, x, y, w, h, accent, sf, "CHARACTER");
        
        // 1. Grouped Content Height Calculation for Vertical Centering
        const innerMargin = 15 * sf;
        const artSize = Math.min(w - innerMargin * 3, h * 0.50); 
        const titleBoxH = 65 * sf;
        const gap = 15 * sf;
        const totalContentH = artSize + gap + titleBoxH;
        
        const contentStartY = y + (h - totalContentH) / 2;
        
        const artX = x + (w - artSize) / 2;
        const artY = contentStartY;

        // 3. Character Sprite
        ctx.save();
        ctx.shadowBlur = 20 * sf;
        ctx.shadowColor = accent;
        this.drawTechBorder(ctx, artX, artY, artSize, artSize, accent, sf);
        
        if (charImage && charImage.complete && charImage.naturalWidth > 0) {
            const sw = charImage.naturalWidth / 2;
            const sh = charImage.naturalHeight / 2;
            const ratio = sw / sh;
            const drawHeight = artSize - 8 * sf;
            const drawWidth = drawHeight * ratio;
            const drawX = artX + (artSize - drawWidth) / 2;
            const drawY = artY + 4 * sf;
            
            ctx.drawImage(charImage, 0, 0, sw, sh, drawX, drawY, drawWidth, drawHeight);
        } else {
            this.drawProceduralCover(ctx, artX + 4 * sf, artY + 4 * sf, artSize - 8 * sf, song?.name || "??", sf);
        }
        ctx.restore();

        // 4. Metadata Block: Framed Song Title (Auto-shrink to fit)
        const fullName = (song?.name || "Unknown Track").replace('.mp3', '');
        const centerX = x + w / 2;
        const titleY = artY + artSize + gap;
        const titleBoxW = w - (innerMargin * 2);

        ctx.save();
        // Title Frame Box
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1 * sf;
        this.drawRoundedRect(ctx, x + innerMargin, titleY, titleBoxW, titleBoxH, 10 * sf);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        
        // Auto-shrink Logic
        let currentFontSize = Math.floor(22 * sf);
        const maxWidth = titleBoxW - (20 * sf); // Padding
        ctx.font = `900 ${currentFontSize}px "Orbitron"`;
        
        while (ctx.measureText(fullName).width > maxWidth && currentFontSize > 10 * sf) {
            currentFontSize -= 1;
            ctx.font = `900 ${currentFontSize}px "Orbitron"`;
        }
        
        ctx.fillText(fullName, centerX, titleY + titleBoxH * 0.5);
        
        ctx.restore();
        ctx.restore();
    }

    private drawProceduralCover(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, title: string, _sf: number) {
        ctx.save();
        // Simple hash for seed
        let hash = 0;
        for (let i = 0; i < title.length; i++) hash = title.charCodeAt(i) + ((hash << 5) - hash);
        
        const hue = Math.abs(hash % 360);
        ctx.fillStyle = `hsl(${hue}, 40%, 15%)`;
        ctx.fillRect(x, y, size, size);
        
        // Abstract geometric shapes
        for (let i = 0; i < 5; i++) {
            ctx.fillStyle = `hsl(${(hue + i * 40) % 360}, 60%, 40%)`;
            ctx.globalAlpha = 0.2;
            const s = (0.2 + (Math.abs((hash >> i) % 10) / 10)) * size;
            const ox = (Math.abs((hash >> (i + 2)) % 10) / 10) * size;
            const oy = (Math.abs((hash >> (i + 4)) % 10) / 10) * size;
            ctx.beginPath();
            ctx.arc(x + ox, y + oy, s / 2, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Abbreviated Title (Improved for non-spaced titles like Korean)
        ctx.globalAlpha = 1;
        ctx.font = `900 ${Math.floor(size * 0.2)}px "Orbitron"`;
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const nameParts = title.split(' ');
        let abbr = '';
        if (nameParts.length > 1) {
            abbr = nameParts.map(w => w[0]).join('').substring(0, 3).toUpperCase();
        } else {
            // Unspaced titles: Take first 2 characters
            abbr = title.substring(0, 2).toUpperCase();
        }
        ctx.fillText(abbr, x + size / 2, y + size / 2);
        
        // Tech Grid overlay
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
            const gp = (i + 1) * (size / 5);
            ctx.beginPath(); ctx.moveTo(x + gp, y); ctx.lineTo(x + gp, y + size); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x, y + gp); ctx.lineTo(x + size, y + gp); ctx.stroke();
        }
        ctx.restore();
    }

    private renderRankSection(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, grade: string, score: number, sf: number, stats: any) {
        ctx.save();
        const accent = this.getGradeColor(grade);
        this.drawTechBorder(ctx, x, y, w, h, accent, sf, "SCORE & RANK");
        
        // Premium Spacing (Increased Gaps for airy feel)
        const gradeFontSize = Math.floor(135 * sf);
        const scoreFontSize = Math.floor(40 * sf);
        const gap = 50 * sf; 
        const badgeGap = 35 * sf;
        
        // Safety Top Margin: Ensure it never touches the "SCORE & RANK" tab header
        const safetyTopMargin = 45 * sf;
        
        const totalContentH = (gradeFontSize * 0.8) + gap + scoreFontSize + (stats.perfect > 0 ? badgeGap + 24 * sf : 0); 
        // Centering within the REMAINING space after the safety margin
        const startY = y + safetyTopMargin + (h - safetyTopMargin - totalContentH) / 2;

        const centerX = x + w / 2;

        ctx.font = `900 ${gradeFontSize}px "Orbitron"`;
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.shadowBlur = 60 * sf;
        ctx.shadowColor = accent;
        ctx.fillText(grade, centerX, startY);
        
        // Score
        ctx.font = `900 ${scoreFontSize}px "Orbitron"`; 
        ctx.shadowBlur = 20 * sf;
        const scoreStr = Math.floor(score).toString().padStart(7, '0');
        const scoreY = startY + (gradeFontSize * 0.8) + gap;
        ctx.fillText(scoreStr, centerX, scoreY);
        
        // NEW RECORD - Button Style Badge
        if (stats.perfect > (stats.totalNotes || 0) * 0.9 || score > 0) {
            ctx.save();
            const label = "NEW RECORD!";
            ctx.font = `900 ${Math.floor(14 * sf)}px "Orbitron"`;
            const badgeW = ctx.measureText(label).width + 30 * sf;
            const badgeH = 26 * sf;
            const badgeX = centerX - badgeW / 2;
            const badgeY = scoreY + scoreFontSize + badgeGap;
            
            ctx.fillStyle = 'rgba(255, 215, 0, 0.2)';
            ctx.beginPath();
            this.drawRoundedRect(ctx, badgeX, badgeY - badgeH / 2, badgeW, badgeH, 6 * sf);
            ctx.fill();
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 1.5 * sf;
            ctx.stroke();
            
            ctx.fillStyle = '#ffd700';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, centerX, badgeY);
            ctx.restore();
        }
        ctx.restore();
    }

    private renderStatsSection(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, stats: any, maxCombo: number, colors: any, pal: any, sf: number) {
        ctx.save();
        this.drawTechBorder(ctx, x, y, w, h, pal.scorePanel, sf, "JUDGE");

        const rows = [
            { label: "PERFECT", val: stats.perfect, color: colors.PERFECT },
            { label: "GREAT", val: stats.great, color: colors.GREAT },
            { label: "GOOD", val: stats.good, color: colors.GOOD },
            { label: "MISS", val: stats.miss, color: colors.MISS }
        ];
        
        const labelSize = Math.floor(26 * sf); 
        const valSize = Math.floor(26 * sf);   
        
        // Split box: Top 65% for Judge list, Bottom 35% for Max Combo
        const judgeH = h * 0.65;
        const comboH = h * 0.35;
        
        const rowH = Math.min(65 * sf, (judgeH - (20 * sf)) / rows.length);
        const totalRowsH = rows.length * rowH;
        const startY = y + (judgeH - totalRowsH) / 2 + (10 * sf);

        rows.forEach((row, i) => {
            const rowY = startY + i * rowH;
            const innerMargin = 30 * sf;
            
            ctx.font = `900 ${labelSize}px "Orbitron"`;
            ctx.fillStyle = row.color;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(row.label, x + innerMargin, rowY + rowH / 2);
            
            ctx.font = `900 ${valSize}px "Orbitron"`;
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(row.val.toString(), x + w - innerMargin, rowY + rowH / 2);
        });

        // --- Independent MAX COMBO (Inside the same box, but separated) ---
        const comboY = y + judgeH;
        const centerX = x + w / 2;
        
        // Separator line (Subtle)
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 20 * sf, comboY);
        ctx.lineTo(x + w - 20 * sf, comboY);
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Label on top
        ctx.font = `900 ${Math.floor(16 * sf)}px "Orbitron"`;
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText("MAX COMBO", centerX, comboY + comboH * 0.35);

        // Value on bottom
        ctx.font = `900 ${Math.floor(40 * sf)}px "Orbitron"`;
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 20 * sf;
        ctx.shadowColor = pal.scorePanel;
        ctx.fillText(maxCombo.toString(), centerX, comboY + comboH * 0.7);

        ctx.restore();
    }

    // Removed standalone renderMaxComboSection as it's now integrated

    private renderRewardBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, sf: number, accent: string) {
        ctx.save();
        this.drawTechBorder(ctx, x, y, w, h, accent, sf);
        
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const centerX = x + w / 2;

        // Professional Single Line Reward Display
        ctx.font = `900 ${Math.floor(16 * sf)}px "Orbitron"`;
        const label = "REWARD: ";
        const labelW = ctx.measureText(label).width;
        
        ctx.font = `700 ${Math.floor(15 * sf)}px "Orbitron"`;
        const content = "FULL COMBO +50 / PERFECT CLEAR +200";
        const contentW = ctx.measureText(content).width;
        
        const totalW = labelW + contentW;
        const startX = centerX - totalW / 2;
        
        ctx.textAlign = 'left';
        ctx.font = `900 ${Math.floor(16 * sf)}px "Orbitron"`;
        ctx.fillStyle = accent;
        ctx.fillText(label, startX, y + h / 2);
        
        ctx.font = `700 ${Math.floor(15 * sf)}px "Orbitron"`;
        ctx.fillStyle = '#fff';
        ctx.fillText(content, startX + labelW, y + h / 2);
        
        ctx.restore();
    }


    private drawTechBorder(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, sf: number, title?: string) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2 * sf;
        ctx.globalAlpha = 0.8;
        
        // Main outline
        ctx.strokeRect(x, y, w, h);
        
        // 1. Tab-style Header (Trading Card style)
        if (title) {
            ctx.save();
            const tabH = 28 * sf;
            const tabW = w * 0.65;
            const tabX = x + (w - tabW) / 2;
            const tabY = y - tabH / 2;
            
            // Tab Background
            ctx.fillStyle = 'rgba(10, 15, 30, 0.95)';
            ctx.strokeStyle = color;
            ctx.lineWidth = 2 * sf;
            ctx.globalAlpha = 1;
            this.drawRoundedRect(ctx, tabX, tabY, tabW, tabH, 6 * sf);
            ctx.fill();
            ctx.stroke();
            
            // Tab Title
            ctx.font = `900 ${Math.floor(13 * sf)}px "Orbitron"`;
            ctx.fillStyle = color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowBlur = 10 * sf;
            ctx.shadowColor = color;
            ctx.fillText(title, x + w/2, tabY + tabH / 2);
            ctx.restore();
        }

        // Corner accents
        const s = 15 * sf;
        ctx.lineWidth = 4 * sf;
        ctx.globalAlpha = 1;
        
        // Top Left
        ctx.beginPath(); ctx.moveTo(x + s, y); ctx.lineTo(x, y); ctx.lineTo(x, y + s); ctx.stroke();
        // Top Right
        ctx.beginPath(); ctx.moveTo(x + w - s, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + s); ctx.stroke();
        // Bottom Left
        ctx.beginPath(); ctx.moveTo(x, y + h - s); ctx.lineTo(x, y + h); ctx.lineTo(x + s, y + h); ctx.stroke();
        // Bottom Right
        ctx.beginPath(); ctx.moveTo(x + w - s, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - s); ctx.stroke();
        
        ctx.restore();
    }

    private getGradeColor(grade: string): string {
        const g = grade.toUpperCase();
        if (g.includes('S+')) return '#f1c40f'; // Golden
        if (g === 'S') return '#ff4757'; // Red
        if (g.includes('A')) return '#2ecc71'; // Green
        return '#3498db'; // Blue (Fallback for anything B and below)
    }

    private renderPortraitLayout(ctx: CanvasRenderingContext2D, px: number, py: number, pw: number, ph: number, maxCombo: number, accuracy: number, stats: any, grade: string, pal: any, sf: number, judgeColors: any, song: SongEntry | null, difficultyLabel: string, score: number) {
        const centerX = px + pw / 2;
        const rankColor = this.getGradeColor(grade);

        // [POLISH] Shifted Rank down to 0.38 for a much more balanced, centered look on mobile
        this.drawGrade(ctx, grade, centerX, py + ph * 0.38, sf * 1.0, rankColor);
        
        // NEW RECORD - Added Portrait Support (Centered above Accuracy)
        if (accuracy > 90 || score > 0) {
            ctx.save();
            ctx.font = `900 ${Math.floor(14 * sf)}px "Orbitron"`;
            const label = "NEW RECORD!";
            const badgeW = ctx.measureText(label).width + 20 * sf;
            const badgeX = centerX - badgeW / 2;
            const badgeY = py + ph * 0.46; // Shifted relative to Rank
            ctx.fillStyle = 'rgba(255, 215, 0, 0.2)';
            ctx.beginPath();
            this.drawRoundedRect(ctx, badgeX, badgeY - 12 * sf, badgeW, 18 * sf, 3 * sf);
            ctx.fill();
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 1;
            ctx.stroke();
            
            ctx.fillStyle = '#ffd700';
            ctx.textAlign = 'center';
            ctx.fillText("NEW RECORD!", centerX, badgeY);
            ctx.restore();
        }

        this.drawAccuracy(ctx, accuracy, centerX, py + ph * 0.54, sf * 1.1, rankColor);

        // Portrait specific difficulty info
        const totalNotes = (song as any)?.noteCount || 500;
        const duration = (song as any)?.duration || 120;
        const nps = totalNotes / (duration || 60);
        let level = song?.difficulty || Math.floor(Math.max(1, Math.min(20, nps * 1.5)));

        ctx.font = `900 ${Math.floor(18 * sf)}px "Orbitron"`;
        ctx.fillStyle = '#ff4757';
        ctx.textAlign = 'center';
        ctx.fillText(`${difficultyLabel} Lv.${level}`, centerX, py + ph * 0.62);

        const tableY = py + ph * 0.68;
        this.renderStatsSection(ctx, centerX - pw * 0.45, tableY, pw * 0.9, ph * 0.32, stats, maxCombo, judgeColors, pal, sf);
    }

    private drawGrade(ctx: CanvasRenderingContext2D, grade: string, x: number, y: number, sf: number, color: string) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const fontSize = Math.floor(180 * sf);
        ctx.font = `900 ${fontSize}px "Orbitron"`;
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 50 * sf;
        ctx.shadowColor = color;
        ctx.fillText(grade, x, y);
        ctx.strokeStyle = color;
        ctx.lineWidth = 5 * sf;
        ctx.strokeText(grade, x, y);
        ctx.restore();
    }

    private drawAccuracy(ctx: CanvasRenderingContext2D, acc: number, x: number, y: number, sf: number, color: string) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `700 ${Math.floor(62 * sf)}px "Orbitron"`;
        ctx.fillStyle = '#fff';
        ctx.fillText(`${acc.toFixed(2)}%`, x, y);
        ctx.font = `900 ${Math.floor(20 * sf)}px "Orbitron"`;
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.9;
        ctx.fillText("ACCURACY", x, y + (42 * sf));
        ctx.restore();
    }

    private drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(x, y, w, h, r);
        } else {
            // Fallback for older environments
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + w - r, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + r);
            ctx.lineTo(x + w, y + h - r);
            ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            ctx.lineTo(x + r, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - r);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
        }
        ctx.closePath();
    }

    private renderXPPopup(ctx: CanvasRenderingContext2D, width: number, height: number, sm: ScoreManager, sf: number, elapsed: number, audioEngine?: CoreAudioEngine) {
        // Reset sound state on fresh start
        if (elapsed < 100) {
            this.playedRows.clear();
            this.lastTickElapsed = 0;
            this.hasPlayedLevelUp = false;
            
            // [REVISED] Sound state reset
            if (audioEngine) {
                console.log("[ResultRenderer] Initializing XP sequence audio context...");
            }
        }

        const auth = AuthService.getInstance();
        if (!auth.isSignedIn()) return;

        const popupW = Math.min(width * 0.9, 800 * sf);
        const popupH = Math.min(height * 0.9, 500 * sf);
        const px = (width - popupW) / 2;
        const py = (height - popupH) / 2;

        // 1. Dark Backdrop Blur Layer
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, width, height);
        ctx.restore();

        // 2. Main XP Glass Frame
        ctx.save();
        ctx.fillStyle = 'rgba(10, 15, 25, 0.95)';
        this.drawTechBorder(ctx, px, py, popupW, popupH, '#00d2ff', sf);
        ctx.fill();
        ctx.restore();

        // 3. Header: EXP GAINED
        ctx.save();
        const pulse = (Math.sin(performance.now() * 0.005) + 1) * 0.5;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `900 ${Math.floor(42 * sf)}px "Orbitron"`;
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = (20 + pulse * 10) * sf;
        ctx.shadowColor = '#00d2ff';
        ctx.fillText("EXPERIENCE GAINED", width / 2, py + (60 * sf));
        ctx.restore();

        // 4. Data Calculation
        const breakdownX = px + (40 * sf);
        const breakdownY = py + (120 * sf);
        const bRowH = 32 * sf;
        const bValX = px + popupW - (40 * sf);

        const isFC = sm.isFullCombo();
        const isAP = sm.getAccuracy() === 100;
        const bd = ExperienceSystem.calculateXPBreakdown(sm.getMaxCombo(), sm.getGrade(), 'HARD', isFC, isAP);
        const gainedCoin = ExperienceSystem.calculateGainedCoin(sm.getMaxCombo(), sm.getGrade());

        const rows = [
            { label: "BASE CLEAR XP", val: `+${bd.base}` },
            { label: "COMBO BONUS", val: `+${bd.comboBonus}` },
            { label: "DIFFICULTY MULTIPLIER", val: `x${bd.difficultyMultiplier.toFixed(2)}` },
            { label: "GRADE MULTIPLIER", val: `x${bd.rankMultiplier.toFixed(2)}` }
        ];

        if (bd.achievementBonus > 0) {
            rows.push({ label: isAP ? "ALL PERFECT BONUS" : "FULL COMBO BONUS", val: `+${bd.achievementBonus}` });
        }

        // 5. Animation Timing Constants (Cinematic Sequential)
        const STAGE_FRAME = 600;
        const STAGE_ROWS_DELAY = 300; // Delay between rows
        const STAGE_BAR_START = STAGE_FRAME + (rows.length * STAGE_ROWS_DELAY) + 400;
        const STAGE_BAR_DURATION = 2000;
        const STAGE_LEVELUP_DELAY = STAGE_BAR_START + STAGE_BAR_DURATION + 200;

        // Overlay with Fade
        ctx.save();
        ctx.globalAlpha = Math.min(1, elapsed / 500);

        // 4b. XP Breakdown Details (Sequential)
        ctx.save();
        rows.forEach((row, i) => {
            const rowStartTime = STAGE_FRAME + (i * STAGE_ROWS_DELAY);
            const rowProgress = Math.min(1, Math.max(0, (elapsed - rowStartTime) / 400));
            
            if (rowProgress > 0) {
                // SFX: Trigger when row starts appearing
                if (audioEngine && !this.playedRows.has(i)) {
                    console.log(`[ResultRenderer] Triggering Row Tick: ${i}`);
                    audioEngine.triggerTick(0.4); 
                    this.playedRows.add(i);
                }
                
                ctx.globalAlpha = rowProgress;
                // Slight upward puff animation
                const yOffset = (1.0 - rowProgress) * 10 * sf;
                
                ctx.font = `700 ${Math.floor(16 * sf)}px "Orbitron"`;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                ctx.textAlign = 'left';
                ctx.fillText(row.label, breakdownX, (breakdownY + (bRowH * i)) + yOffset);
                
                ctx.fillStyle = '#fff';
                ctx.textAlign = 'right';
                ctx.fillText(row.val, bValX, (breakdownY + (bRowH * i)) + yOffset);
            }
        });
        ctx.restore();

        // 5. Total XP Earned Accent (Appears with Bar)
        const totalProgress = Math.min(1, Math.max(0, (elapsed - STAGE_BAR_START) / 500));
        if (totalProgress > 0) {
            ctx.save();
            ctx.globalAlpha = totalProgress;
            ctx.font = `900 ${Math.floor(28 * sf)}px "Orbitron"`;
            ctx.fillStyle = '#00d2ff';
            ctx.textAlign = 'center';
            ctx.fillText(`TOTAL GAINED: ${bd.total} XP`, width / 2, breakdownY + (rows.length * bRowH) + (30 * sf));
            ctx.restore();
        }

        // 6. Central XP Bar
        const barW = popupW * 0.85;
        const barH = 34 * sf;
        const barX = px + (popupW - barW) / 2;
        const barY = py + popupH - (110 * sf);

        const totalXP = sm.getTotalXP();
        const gainedXP = bd.total;
        const prevXP = totalXP - gainedXP;
        
        // Revised Animation Timeline
        const progress = Math.min(1, Math.max(0, (elapsed - STAGE_BAR_START) / STAGE_BAR_DURATION));
        
        const currentVisXP = prevXP + (gainedXP * progress);
        const level = ExperienceSystem.getLevelFromXP(currentVisXP);
        const nextThreshold = ExperienceSystem.getXPThresholdForLevel(level + 1);
        const currentThreshold = ExperienceSystem.getXPThresholdForLevel(level);
        const levelProgress = (currentVisXP - currentThreshold) / (nextThreshold - currentThreshold);

        // SFX: Meter Charging Tick
        if (audioEngine && elapsed > STAGE_BAR_START && elapsed < STAGE_BAR_START + STAGE_BAR_DURATION) {
            const tickInterval = 120; // Slightly faster for charging feel
            if (elapsed - this.lastTickElapsed > tickInterval) {
                console.log("[ResultRenderer] Meter Tick");
                audioEngine.triggerTick(0.25);
                this.lastTickElapsed = elapsed;
            }
        }

        // Bar Container
        ctx.save();
        ctx.beginPath();
        this.drawRoundedRect(ctx, barX, barY, barW, barH, barH / 2);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.stroke();

        // XP Fill
        const fillW = Math.max(barH, barW * levelProgress);
        ctx.save();
        ctx.beginPath();
        this.drawRoundedRect(ctx, barX, barY, fillW, barH, barH / 2);
        ctx.clip();
        
        const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
        grad.addColorStop(0, '#00d2ff');
        grad.addColorStop(1, '#3a7bd5');
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();

        // Info Text
        ctx.font = `900 ${Math.floor(18 * sf)}px "Orbitron"`;
        ctx.textAlign = 'left';
        ctx.fillStyle = '#fff';
        ctx.fillText(`LEVEL ${level}`, barX + (10 * sf), barY - (12 * sf));

        ctx.textAlign = 'right';
        ctx.font = `700 ${Math.floor(14 * sf)}px "Outfit"`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillText(`${currentThreshold} / ${nextThreshold} XP`, barX + barW - (10 * sf), barY - (12 * sf));

        // 7. Coin Earned Display (Premium Animation)
        if (totalProgress > 0) {
            ctx.save();
            ctx.globalAlpha = totalProgress;
            
            const coinX = width / 2;
            const coinY = barY + barH + (45 * sf);
            
            // Count-up animation linked to the progress of the XP bar
            const displayCoin = Math.floor(gainedCoin * progress);
            
            ctx.textAlign = 'center';
            ctx.shadowBlur = 15 * sf;
            ctx.shadowColor = 'rgba(255, 215, 0, 0.5)';
            
            // Coin Symbol (Golden Circle)
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.arc(coinX - (65 * sf), coinY - (8 * sf), 10 * sf, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#000';
            ctx.font = `900 ${Math.floor(12 * sf)}px "Orbitron"`;
            ctx.fillText("N", coinX - (65 * sf), coinY - (4 * sf));

            // Coin Amount
            ctx.font = `900 ${Math.floor(28 * sf)}px "Orbitron"`;
            ctx.fillStyle = '#FFD700';
            ctx.fillText(`+ ${displayCoin} NC`, coinX, coinY);
            
            ctx.font = `400 ${Math.floor(12 * sf)}px "Orbitron"`;
            ctx.fillStyle = 'rgba(255, 215, 0, 0.7)';
            ctx.fillText("NEXUS CREDITS AWARDED", coinX, coinY + (22 * sf));
            ctx.restore();
        }

        // Level Up Trigger: Strict sequencing (Wait until bar finish)
        const prevLevel = ExperienceSystem.getLevelFromXP(prevXP);
        if (level > prevLevel && elapsed > STAGE_LEVELUP_DELAY) {
            this.renderLevelUpCelebration(ctx, width / 2, height / 2, sf);
            
            // SFX: Level Up Cheer
            if (audioEngine && !this.hasPlayedLevelUp) {
                console.log("[ResultRenderer] Level Up! Playing Cheer SFX");
                audioEngine.playSFX(ASSET_PATHS.AUDIO.UI.CHEER, 0.6);
                this.hasPlayedLevelUp = true;
            }
        }

        ctx.restore(); // Restore globalAlpha save at frame start
        ctx.restore(); // Restore XP frame clip if needed (though usually it's save-restore pair)
    }

    private renderLevelUpCelebration(ctx: CanvasRenderingContext2D, cx: number, cy: number, sf: number) {
        const time = performance.now() * 0.001;
        ctx.save();
        
        // 1. Golden Sunburst
        const rays = 24;
        ctx.translate(cx, cy);
        for (let i = 0; i < rays; i++) {
            ctx.rotate((Math.PI * 2) / rays + time * 0.5);
            const grad = ctx.createLinearGradient(0, 0, 0, 800 * sf);
            grad.addColorStop(0, 'rgba(255, 215, 0, 0.5)');
            grad.addColorStop(1, 'rgba(255, 215, 0, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-30 * sf, 800 * sf);
            ctx.lineTo(30 * sf, 800 * sf);
            ctx.fill();
        }
        ctx.restore();

        // 2. LEVEL UP Text
        ctx.save();
        const bounce = Math.abs(Math.sin(time * 12)) * 15 * sf;
        ctx.font = `900 ${Math.floor(110 * sf)}px "Orbitron"`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 50 * sf;
        ctx.shadowColor = '#ffd700';
        ctx.fillText("LEVEL UP!", cx, cy - (50 * sf) - bounce);
        
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 6 * sf;
        ctx.strokeText("LEVEL UP!", cx, cy - (50 * sf) - bounce);
        ctx.restore();
    }

    private renderConfetti(ctx: CanvasRenderingContext2D, width: number, height: number, elapsed: number, sf: number, isFC: boolean = false) {
        ctx.save();
        const time = elapsed * 0.001;
        const colors = ['#FFD700', '#FF00A0', '#00F0FF', '#FFFFFF', '#FF4757', '#FFEA00', '#00FF9D'];
        
        // Increased particle density for FC
        const count = isFC ? 150 : 75;
        
        for (let i = 0; i < count; i++) {
            // High-entropy seeds for chaotic natural movement
            const seed = (i * 137.456 + Math.sin(i)) % 100;
            const sizeSeed = (i * 789.12 + Math.cos(i)) % 1;
            const speedSeed = (i * 245.67 + Math.tan(i)) % 1;
            const windSeed = (i * 456.78) % 1;
            
            // 1. Graceful Gravity Fall (Much slower for paper-like feel)
            const fallSpeed = (70 + speedSeed * 100) * (isFC ? 1.2 : 1.0);
            const startY = -120; 
            const y = (startY + time * fallSpeed + seed * height) % (height + 240) - 120;
            
            // 2. Wide Horizontal Sway (Flutter effect)
            const swayAmplitude = (60 + windSeed * 100);
            const swayFrequency = 1.0 + windSeed * 1.5;
            const initialX = (seed / 100) * width; 
            const x = initialX + Math.sin(time * swayFrequency + seed) * swayAmplitude;
            
            // 3. Random Size & Slower Rotation
            const size = (8 + sizeSeed * 12) * (isFC ? 1.2 : 1.0) * sf;
            const rotationSpeed = (seed - 50) * 0.05; // Halved rotation speed
            const rotation = time * rotationSpeed + seed;
            
            // 4. Elegant 3D Flip (Slower flip speed)
            const flipPhase = seed * 5;
            const flipSpeed = 2 + speedSeed * 3;
            const flipWidth = size * Math.cos(time * flipSpeed + flipPhase);
            
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(rotation);
            
            ctx.globalAlpha = 0.85;
            ctx.fillStyle = colors[i % colors.length];
            
            // Paper fragment with flip width
            ctx.fillRect(-flipWidth / 2, -size / 2, flipWidth, size / 2);
            
            // Enhanced Highlight for FC
            if (isFC && i % 3 === 0) {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.lineWidth = 0.5 * sf;
                ctx.strokeRect(-flipWidth / 2, -size / 2, flipWidth, size / 2);
            }
            
            ctx.restore();
        }
        ctx.restore();
    }

    /**
     * Renders a splendid golden celebration for All Combo achievement.
     */
    private renderCelebration(ctx: CanvasRenderingContext2D, width: number, height: number) {
        ctx.save();
        
        // 1. Rotating Sunburst Background
        const centerX = width / 2;
        const centerY = height * 0.08; // Higher positioning for better balance
        const time = performance.now() * 0.001;
        const rays = 12;
        
        ctx.translate(centerX, centerY);
        ctx.rotate(time * 0.2); // Slow rotation
        
        for (let i = 0; i < rays; i++) {
            ctx.rotate((Math.PI * 2) / rays);
            const gradient = ctx.createLinearGradient(0, 0, 0, width * 0.3);
            gradient.addColorStop(0, 'rgba(255, 215, 0, 0.2)'); // Gold
            gradient.addColorStop(0.5, 'rgba(255, 165, 0, 0.05)'); // Orange-ish
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-40, width);
            ctx.lineTo(40, width);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();

        // 2. ALL COMBO Floating Text
        ctx.save();
        const pulse = Math.sin(time * 5) * 5;
        const fontSize = Math.floor(48 + pulse);
        ctx.font = `900 ${fontSize}px "Orbitron"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Golden Gradient Text
        const grad = ctx.createLinearGradient(0, height * 0.1, 0, height * 0.2);
        grad.addColorStop(0, '#fff');
        grad.addColorStop(0.5, '#ffd700'); // Gold
        grad.addColorStop(1, '#ff8c00'); // Dark Orange
        
        ctx.fillStyle = grad;
        ctx.shadowBlur = 25;
        ctx.shadowColor = '#ffd700';
        
        // Position far TOP
        const textY = height * 0.08;
        ctx.fillText("ALL COMBO", width / 2, textY);
        
        // Reflection/Glow
        ctx.globalAlpha = 0.3;
        ctx.fillText("ALL COMBO", width / 2, textY + 4);
        ctx.restore();
    }

}
