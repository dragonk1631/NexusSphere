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

    public render(ctx: CanvasRenderingContext2D, width: number, height: number, scoreManager: ScoreManager, song: SongEntry | null, _alpha: number = 0, phase: 'SCORE' | 'EXP' = 'SCORE', elapsed: number = 0, difficultyLabel: string = 'NORMAL', audioEngine?: CoreAudioEngine) {
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

        // 2. TECH HEADER (Top-Right "RESULT" - Safe Area Aware)
        ctx.save();
        const headerPadding = 20 * sf;
        const headerX = width - headerPadding;
        const headerY = Math.max(40, height * 0.04);
        
        // Ensure header doesn't overlap the main panel boundary
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        
        // Small tech lines
        ctx.strokeStyle = this.getGradeColor(grade);
        ctx.lineWidth = 2 * sf;
        ctx.beginPath();
        ctx.moveTo(headerX, headerY + (45 * sf));
        ctx.lineTo(headerX - (120 * sf), headerY + (45 * sf));
        ctx.stroke();

        ctx.font = `900 ${Math.floor(42 * sf)}px "Orbitron"`;
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 15 * sf;
        ctx.shadowColor = this.getGradeColor(grade);
        ctx.fillText("RESULT", headerX, headerY);
        
        ctx.font = `400 ${Math.floor(10 * sf)}px "Orbitron"`;
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText("OVER RAPID SYSTEM / CORE ENGINE v4.5C", headerX, headerY + (50 * sf));
        ctx.restore();

        // [NEW] ALL COMBO Celebration Layer
        if (scoreManager.isFullCombo()) {
            this.renderCelebration(ctx, width, height);
        }

        // 3. Main Frame Geometry (Landscape Optimized 3-Column)
        const panelW = isPortrait ? width * 0.94 : width * 0.92;
        const panelH = isPortrait ? height * 0.82 : height * 0.72; // Increased portrait height slightly
        const panelX = (width - panelW) / 2;
        // Shift panel slightly lower in portrait to avoid clashing with RESULT header
        const panelY = (height - panelH) / 2 + (isPortrait ? 40 * scaleFactor : 15 * scaleFactor);

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
            this.renderLandscapeLayout(ctx, panelX, panelY, panelW, panelH, score, maxCombo, stats, grade, pal, scaleFactor, JUDGE_COLORS, song, difficultyLabel);
        }

        // 5. XP & Level System Panel (EXP Phase Popup)
        if (phase === 'EXP') {
            this.renderXPPopup(ctx, width, height, scoreManager, sf, elapsed, audioEngine);
        }

        // 6. Action Hint
        ctx.save();
        const hintSize = Math.max(14, 18 * sf);
        ctx.font = `400 ${hintSize}px "Orbitron"`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.textAlign = 'center';
        const hintText = phase === 'SCORE' ? "CLICK TO VIEW EXPERIENCE" : "CLICK ANYWHERE TO CONTINUE";
        ctx.fillText(hintText, width / 2, height - (35 * sf));
        ctx.restore();
    }

    private renderLandscapeLayout(ctx: CanvasRenderingContext2D, px: number, py: number, pw: number, ph: number, score: number, maxCombo: number, stats: any, grade: string, pal: any, sf: number, judgeColors: any, song: SongEntry | null, difficultyLabel: string) {
        const colW = pw / 3;
        const margin = 30 * sf; // [AIR-FLOW] Increased horizontal margin between columns
        
        // Content area excludes the bottom action area to prevent overlaps
        const footerH = 100 * sf;
        const contentH = ph - footerH - margin;

        // --- Left Column: Song Info & Album Art ---
        const leftX = px + margin;
        this.renderSongSection(ctx, leftX, py + margin, colW - margin * 2, contentH, song, sf, this.getGradeColor(grade), difficultyLabel);

        // --- Center Column: Rank & Score ---
        const centerX = px + colW;
        this.renderRankSection(ctx, centerX + margin, py + margin, colW - margin * 2, contentH, grade, score, pal, sf, stats);

        // --- Right Column: Stats ---
        const rightX = px + colW * 2;
        this.renderStatsSection(ctx, rightX + margin, py + margin, colW - margin * 2, contentH, stats, maxCombo, judgeColors, pal, sf);

        // --- Bottom Row: Rewards & Buttons (Anchored to the absolute bottom area) ---
        const bottomY = py + ph - (75 * sf);
        this.renderRewardBar(ctx, px + margin, bottomY, pw * 0.6, 60 * sf, sf, this.getGradeColor(grade));
        this.renderActionButtons(ctx, px + pw - (380 * sf), bottomY, 360 * sf, 60 * sf, sf, this.getGradeColor(grade));
    }

    private renderSongSection(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, song: SongEntry | null, sf: number, accent: string, difficultyLabel: string) {
        ctx.save();
        this.drawTechBorder(ctx, x, y, w, h, accent, sf);
        
        const innerMargin = 20 * sf; // Increased inner padding
        const artSize = Math.min(w - innerMargin * 2, h * 0.38); // [AIR-FLOW] Slightly smaller art for more text room
        const artX = x + (w - artSize) / 2;
        const artY = y + (50 * sf);

        // 2. Album Art Case
        ctx.save();
        ctx.shadowBlur = 20 * sf;
        ctx.shadowColor = accent;
        this.drawTechBorder(ctx, artX, artY, artSize, artSize, accent, sf);
        
        const backgroundUrl = song?.backgroundUrl || null;
        if (backgroundUrl) {
            const img = new Image();
            img.src = backgroundUrl;
            if (img.complete) {
                ctx.drawImage(img, artX + 4 * sf, artY + 4 * sf, artSize - 8 * sf, artSize - 8 * sf);
            } else {
                this.drawProceduralCover(ctx, artX + 4 * sf, artY + 4 * sf, artSize - 8 * sf, song?.name || "??", sf);
            }
        } else {
            this.drawProceduralCover(ctx, artX + 4 * sf, artY + 4 * sf, artSize - 8 * sf, song?.name || "??", sf);
        }
        ctx.restore();

        // 3. Metadata Header
        ctx.font = `700 ${Math.floor(18 * sf)}px "Orbitron"`;
        ctx.fillStyle = accent;
        ctx.textAlign = 'left';
        ctx.fillText("TRACK INFO", x + (15 * sf), y + (25 * sf));

        // 4. Grouped Metadata Block
        const textY = artY + artSize + (35 * sf);
        const centerX = x + w / 2;
        const fullName = song?.name || "Unknown Track";
        const parts = fullName.split(' - ');
        const artist = parts.length > 1 ? parts[0] : "Various Artists";
        const title = (parts.length > 1 ? parts.slice(1).join(' - ') : fullName).replace('.mp3', '');

        ctx.textAlign = 'center';
        
        // Title (Strict Absolute Fit: Shrink to prevent any border clash)
        const maxTitleW = w - innerMargin * 1.5;
        let titleSize = Math.floor(22 * sf);
        ctx.font = `900 ${titleSize}px "Orbitron"`;
        while(ctx.measureText(title).width > maxTitleW && titleSize > 10 * sf) {
            titleSize -= 0.5;
            ctx.font = `900 ${titleSize}px "Orbitron"`;
        }
        ctx.fillStyle = '#fff';
        ctx.fillText(title, centerX, textY);
        
        // Artist (Strict Absolute Fit)
        let artistSize = Math.floor(14 * sf);
        ctx.font = `400 ${artistSize}px "Orbitron"`;
        while(ctx.measureText(artist).width > maxTitleW && artistSize > 8 * sf) {
            artistSize -= 0.5;
            ctx.font = `400 ${artistSize}px "Orbitron"`;
        }
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText(artist, centerX, textY + (titleSize < 16 * sf ? 18 * sf : 22 * sf));

        // [POLISH] Difficulty & Level (Now safely placed inside the container)
        const totalNotes = (song as any)?.noteCount || 500;
        const duration = (song as any)?.duration || 120;
        const nps = totalNotes / (duration || 60);
        let level = song?.difficulty || Math.floor(Math.max(1, Math.min(20, nps * 1.5)));

        const diffY = textY + (50 * sf);
        ctx.font = `900 ${Math.floor(18 * sf)}px "Orbitron"`;
        ctx.fillStyle = '#ff4757';
        ctx.fillText(`${difficultyLabel}  -  Lv.${level}`, centerX, diffY);
        
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

    private renderRankSection(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, grade: string, score: number, pal: any, sf: number, stats: any) {
        ctx.save();
        const accent = this.getGradeColor(grade);
        this.drawTechBorder(ctx, x, y, w, h, accent, sf);
        
        const centerX = x + w / 2;
        const centerY = y + h * 0.4;

        // Label
        ctx.font = `700 ${Math.floor(18 * sf)}px "Orbitron"`;
        ctx.fillStyle = pal.scorePanel;
        ctx.textAlign = 'left';
        ctx.fillText("SCORE & RANK", x + (15 * sf), y + (25 * sf));

        // Grade
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `900 ${Math.floor(180 * sf)}px "Orbitron"`;
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 60 * sf;
        ctx.shadowColor = accent;
        ctx.fillText(grade, centerX, centerY);
        
        // Score
        ctx.font = `900 ${Math.floor(52 * sf)}px "Orbitron"`;
        ctx.shadowBlur = 20 * sf;
        const scoreStr = Math.floor(score).toString().padStart(7, '0');
        ctx.fillText(scoreStr, centerX, y + h * 0.72);
        
        // NEW RECORD - Improved Position (Anchored below Score)
        if (stats.perfect > (stats.totalNotes || 0) * 0.9 || score > 0) {
            ctx.save();
            ctx.font = `900 ${Math.floor(14 * sf)}px "Orbitron"`;
            const badgeW = ctx.measureText("NEW RECORD!").width + 20 * sf;
            const badgeX = centerX - badgeW / 2;
            const badgeY = y + h * 0.82;
            
            ctx.fillStyle = 'rgba(255, 215, 0, 0.2)';
            ctx.beginPath();
            this.drawRoundedRect(ctx, badgeX, badgeY - 14 * sf, badgeW, 20 * sf, 4 * sf);
            ctx.fill();
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 1;
            ctx.stroke();
            
            ctx.fillStyle = '#ffd700';
            ctx.textAlign = 'center';
            ctx.fillText("NEW RECORD!", centerX, badgeY);
            ctx.restore();
        }
        ctx.restore();
    }

    private renderStatsSection(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, stats: any, maxCombo: number, colors: any, pal: any, sf: number) {
        ctx.save();
        // [AIR-FLOW] Border covers the main stat area with clear bottom breathing room
        const borderH = Math.min(h, 340 * sf);
        this.drawTechBorder(ctx, x, y, w, borderH, pal.scorePanel, sf);

        ctx.font = `700 ${Math.floor(18 * sf)}px "Orbitron"`;
        ctx.fillStyle = pal.scorePanel;
        ctx.textAlign = 'left';
        ctx.fillText("JUDGE", x + (20 * sf), y + (28 * sf));

        const startY = y + (75 * sf);
        const rows = [
            { label: "PERFECT", val: stats.perfect, color: colors.PERFECT },
            { label: "GREAT", val: stats.great, color: colors.GREAT },
            { label: "GOOD", val: stats.good, color: colors.GOOD },
            { label: "MISS", val: stats.miss, color: colors.MISS },
            { label: "MAX COMBO", val: maxCombo, color: '#fff' }
        ];
        
        // [AIR-FLOW] Dynamic row spacing based on available height
        const availableH = borderH - (85 * sf);
        const rowH = Math.min(48 * sf, availableH / rows.length);

        rows.forEach((row, i) => {
            const rowY = startY + i * rowH;
            
            // Label (Slightly smaller for better hierarchy)
            ctx.font = `700 ${Math.floor(16 * sf)}px "Orbitron"`;
            ctx.fillStyle = row.color;
            ctx.textAlign = 'left';
            ctx.fillText(row.label, x + (25 * sf), rowY);
            
            // Value (Larger and bolder numerical emphasis)
            ctx.font = `900 ${Math.floor(24 * sf)}px "Orbitron"`;
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'right';
            ctx.fillText(row.val.toString(), x + w - (25 * sf), rowY);
        });
        ctx.restore();
    }

    private renderRewardBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, sf: number, accent: string) {
        ctx.save();
        this.drawTechBorder(ctx, x, y, w, h, accent, sf);
        ctx.font = `900 ${Math.floor(16 * sf)}px "Orbitron"`;
        ctx.fillStyle = accent;
        ctx.fillText("REWARD", x + (15 * sf), y + h / 2 + (6 * sf));
        
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2 * sf;
        ctx.beginPath(); ctx.moveTo(x + (100 * sf), y + (10 * sf)); ctx.lineTo(x + (100 * sf), y + h - (10 * sf)); ctx.stroke();
        
        ctx.font = `700 ${Math.floor(14 * sf)}px "Orbitron"`;
        ctx.fillStyle = '#fff';
        ctx.fillText("FULL COMBO +50 / PERFECT CLEAR +200", x + (120 * sf), y + h / 2 + (6 * sf));
        ctx.restore();
    }

    private renderActionButtons(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, sf: number, accent: string) {
        const btnW = (w - (20 * sf)) / 3;
        this.drawActionButtonVisual(ctx, x, y, btnW, h, "MULTI", accent, sf);
        this.drawActionButtonVisual(ctx, x + btnW + (10 * sf), y, btnW, h, "RETRY", accent, sf);
        this.drawActionButtonVisual(ctx, x + (btnW + (10 * sf)) * 2, y, btnW, h, "NEXT", accent, sf);
    }

    private drawActionButtonVisual(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, label: string, accent: string, sf: number) {
        ctx.save();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2 * sf;
        ctx.strokeRect(x, y, w, h);
        
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(x, y, w, h);
        
        ctx.font = `900 ${Math.floor(16 * sf)}px "Orbitron"`;
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x + w / 2, y + h / 2);
        ctx.restore();
    }

    private drawTechBorder(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, sf: number) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2 * sf;
        ctx.globalAlpha = 0.8;
        
        // Main outline
        ctx.strokeRect(x, y, w, h);
        
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
        if (g.includes('S')) return '#FFD700'; // Golden
        if (g.includes('A')) return '#00FFCC'; // Cyan
        if (g.includes('B')) return '#AAFF00'; // Lime
        if (g.includes('C')) return '#FF8800'; // Orange
        return '#FF4444'; // Red for D/F
    }

    private renderPortraitLayout(ctx: CanvasRenderingContext2D, px: number, py: number, pw: number, ph: number, maxCombo: number, accuracy: number, stats: any, grade: string, pal: any, sf: number, judgeColors: any, song: SongEntry | null, difficultyLabel: string, score: number) {
        const centerX = px + pw / 2;
        const rankColor = this.getGradeColor(grade);

        // [POLISH] Reduced Rank size and shifted slightly to prevent clashing with metadata
        this.drawGrade(ctx, grade, centerX, py + ph * 0.18, sf * 1.0, rankColor);
        
        // NEW RECORD - Added Portrait Support (Centered above Accuracy)
        if (accuracy > 90 || score > 0) {
            ctx.save();
            ctx.font = `900 ${Math.floor(12 * sf)}px "Orbitron"`;
            const badgeW = ctx.measureText("NEW RECORD!").width + 16 * sf;
            const badgeX = centerX - badgeW / 2;
            const badgeY = py + ph * 0.31; // Positioned between Grade and Accuracy
            
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

        this.drawAccuracy(ctx, accuracy, centerX, py + ph * 0.38, sf * 1.05, rankColor);

        // Portrait specific difficulty info
        const totalNotes = (song as any)?.noteCount || 500;
        const duration = (song as any)?.duration || 120;
        const nps = totalNotes / (duration || 60);
        let level = song?.difficulty || Math.floor(Math.max(1, Math.min(20, nps * 1.5)));

        ctx.font = `900 ${Math.floor(18 * sf)}px "Orbitron"`;
        ctx.fillStyle = '#ff4757';
        ctx.textAlign = 'center';
        ctx.fillText(`${difficultyLabel} Lv.${level}`, centerX, py + ph * 0.46);

        const tableY = py + ph * 0.52;
        this.renderStatsSection(ctx, centerX - pw * 0.45, tableY, pw * 0.9, ph * 0.45, stats, maxCombo, judgeColors, pal, sf);
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
