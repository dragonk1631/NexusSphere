import { ScoreManager } from '../../../core/score/ScoreManager';
import { ThemeManager } from '../../../core/ThemeManager';
import { HUD_PALETTES } from '../constants/GameConstants';
import { ExperienceSystem } from '../../../core/score/ExperienceSystem';
import { EconomyManager } from '../../../core/score/EconomyManager';
import { AuthService } from '../../../services/auth/AuthService';
import {
    drawAtmosphere
} from './UIUtils';

/**
 * ResultRenderer handles the stage clear / result screen.
 * v4.3 Absolute Fit Polish: Auto-shrinking typography and strict boundary enforcement.
 */
export class ResultRenderer {
    public render(ctx: CanvasRenderingContext2D, width: number, height: number, scoreManager: ScoreManager, backgroundUrl: string | null, _alpha: number = 0) {
        const theme = ThemeManager.getInstance().getCurrentTheme();
        const pal = HUD_PALETTES[theme.id] || HUD_PALETTES['deep-space'];

        const score = scoreManager.getScore();
        const maxCombo = scoreManager.getMaxCombo();
        const accuracy = scoreManager.getAccuracy();
        const stats = scoreManager.getDetailedStats();
        const grade = scoreManager.getGrade();

        // 1. Universal Scaling Factor
        const isPortrait = height > width;
        const baseWidth = isPortrait ? 400 : 1200;
        const baseHeight = isPortrait ? 800 : 800;

        let scaleFactor = Math.min(width / baseWidth, height / baseHeight);
        const visibilityBoost = isPortrait ? 1.25 : 1.15;
        scaleFactor = Math.max(0.6, scaleFactor) * visibilityBoost;
        const sf = scaleFactor; // Reference shorthand

        this.drawBackground(ctx, width, height, backgroundUrl, theme);

        // 2. Title Section
        ctx.save();
        ctx.fillStyle = '#fff';
        const titleSize = Math.floor(58 * scaleFactor);
        ctx.font = `900 ${titleSize}px "Orbitron"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 30 * scaleFactor;
        ctx.shadowColor = pal.scorePanel;
        ctx.fillText("STAGE CLEAR", width / 2, Math.max(60, height * 0.08));
        ctx.restore();

        // [NEW] ALL COMBO Celebration Layer
        if (scoreManager.isFullCombo()) {
            this.renderCelebration(ctx, width, height);
        }

        // 3. Main Panel Geometry (Strict Safe Zones)
        const panelW = isPortrait ? width * 0.94 : Math.min(width * 0.88, 1080);
        const panelH = isPortrait ? height * 0.78 : Math.min(height * 0.72, 600);
        const panelX = (width - panelW) / 2;
        const panelY = (height - panelH) / 2 + (30 * scaleFactor);

        // Glassmorphism Panel
        ctx.save();
        ctx.fillStyle = 'rgba(5, 5, 12, 0.95)';
        ctx.strokeStyle = pal.scorePanel;
        ctx.lineWidth = 4 * scaleFactor;
        ctx.shadowBlur = 25 * scaleFactor;
        ctx.shadowColor = pal.scorePanel;

        const radius = 20 * scaleFactor;
        this.drawRoundedRect(ctx, panelX, panelY, panelW, panelH, radius);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // 4. Content Layout Navigation
        if (isPortrait) {
            this.renderPortraitLayout(ctx, panelX, panelY, panelW, panelH, score, maxCombo, accuracy, stats, grade, pal, scaleFactor);
        } else {
            this.renderLandscapeLayout(ctx, panelX, panelY, panelW, panelH, score, maxCombo, accuracy, stats, grade, pal, scaleFactor);
        }

        // 5. XP & Level System Panel (Login dependent)
        this.renderExperiencePanel(ctx, panelX, panelY, panelW, panelH, scoreManager, sf);

        // 6. Action Hint
        ctx.save();
        const hintSize = Math.max(14, 18 * sf);
        ctx.font = `400 ${hintSize}px "Orbitron"`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.textAlign = 'center';
        ctx.fillText("CLICK ANYWHERE OR PRESS ENTER TO CONTINUE", width / 2, height - (35 * sf));
        ctx.restore();
    }

    private renderLandscapeLayout(ctx: CanvasRenderingContext2D, px: number, py: number, pw: number, ph: number, score: number, maxCombo: number, accuracy: number, stats: any, grade: string, pal: any, sf: number) {
        const leftX = px + pw * 0.3;
        const rightX = px + pw * 0.52;
        const statW = pw * 0.43;

        this.drawGrade(ctx, grade, leftX, py + ph * 0.4, sf * 1.25, pal.scorePanel);
        this.drawAccuracy(ctx, accuracy, leftX, py + ph * 0.78, sf * 1.25, pal.scorePanel);

        const startY = py + ph * 0.15;
        const rowH = ph * 0.135;
        this.renderStats(ctx, stats, score, maxCombo, rightX, startY, rowH, statW, sf, pal.scorePanel);
    }

    private renderPortraitLayout(ctx: CanvasRenderingContext2D, px: number, py: number, pw: number, ph: number, score: number, maxCombo: number, accuracy: number, stats: any, grade: string, pal: any, sf: number) {
        const centerX = px + pw / 2;
        const statW = pw * 0.88;
        const statX = px + (pw - statW) / 2;

        this.drawGrade(ctx, grade, centerX, py + ph * 0.2, sf * 1.1, pal.scorePanel);
        this.drawAccuracy(ctx, accuracy, centerX, py + ph * 0.38, sf * 1.1, pal.scorePanel);

        const startY = py + ph * 0.55;
        const rowH = ph * 0.085;
        this.renderStats(ctx, stats, score, maxCombo, statX, startY, rowH, statW, sf * 0.95, pal.scorePanel);
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

    private renderStats(ctx: CanvasRenderingContext2D, stats: any, score: number, maxCombo: number, x: number, y: number, rowH: number, statW: number, sf: number, accent: string) {
        this.renderStatRow(ctx, "PERFECT", stats.perfect, '#55efc4', y, x, statW, sf, false);
        this.renderStatRow(ctx, "GREAT", stats.great, '#74b9ff', y + rowH, x, statW, sf, false);
        this.renderStatRow(ctx, "GOOD", stats.good, '#ffeaa7', y + rowH * 2, x, statW, sf, false);
        this.renderStatRow(ctx, "MISS", stats.miss, '#ff7675', y + rowH * 3, x, statW, sf, false);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.moveTo(x, y + rowH * 3.8);
        ctx.lineTo(x + statW, y + rowH * 3.8);
        ctx.stroke();

        this.renderStatRow(ctx, "MAX COMBO", maxCombo, accent, y + rowH * 4.7, x, statW, sf, true);
        this.renderStatRow(ctx, "FINAL SCORE", Math.floor(score), '#fff', y + rowH * 6.0, x, statW, sf, true);
    }

    private renderStatRow(ctx: CanvasRenderingContext2D, label: string, value: number | string, color: string, y: number, x: number, sw: number, sf: number, isLarge: boolean) {
        ctx.save();
        ctx.textBaseline = 'middle';

        let baseLabelSize = Math.floor((isLarge ? 32 : 24) * sf);
        let baseValueSize = Math.floor((isLarge ? 42 : 30) * sf);
        const minGap = 40 * sf;
        const valueStr = value.toString();

        // 1. Initial Measurement
        ctx.font = `${isLarge ? 700 : 400} ${baseLabelSize}px "Orbitron"`;
        let labelW = ctx.measureText(label).width;
        ctx.font = `900 ${baseValueSize}px "Orbitron"`;
        let valueW = ctx.measureText(valueStr).width;

        // 2. Auto-Fit (Font Shrinking)
        // Ensure total width fits within the allotted sw (stat container width)
        let totalW = labelW + minGap + valueW;
        if (totalW > sw) {
            const shrinkFactor = sw / totalW;
            baseLabelSize = Math.floor(baseLabelSize * shrinkFactor);
            baseValueSize = Math.floor(baseValueSize * shrinkFactor);

            // Re-measure with shrunk fonts
            ctx.font = `${isLarge ? 700 : 400} ${baseLabelSize}px "Orbitron"`;
            labelW = ctx.measureText(label).width;
            ctx.font = `900 ${baseValueSize}px "Orbitron"`;
            valueW = ctx.measureText(valueStr).width;
        }

        // 3. Strict Boundary Enforcement
        // Final X for value: pinned to sw right-edge, but never exceeding it
        const finalValueX = x + sw;

        // Draw Label
        ctx.font = `${isLarge ? 700 : 400} ${baseLabelSize}px "Orbitron"`;
        ctx.fillStyle = color;
        ctx.textAlign = 'left';
        ctx.fillText(label, x, y);

        // Draw Value
        ctx.font = `900 ${baseValueSize}px "Orbitron"`;
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'right';
        ctx.fillText(valueStr, finalValueX, y);

        // Decorator Line
        if (!isLarge) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 1 * sf;
            ctx.beginPath();
            ctx.moveTo(x, y + (16 * sf));
            ctx.lineTo(finalValueX, y + (16 * sf));
            ctx.stroke();
        }
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

    private renderExperiencePanel(ctx: CanvasRenderingContext2D, px: number, py: number, pw: number, ph: number, sm: ScoreManager, sf: number) {
        const auth = AuthService.getInstance();
        const isSignedIn = auth.isSignedIn();
        
        // --- 1. LOGIN GATE: Hide panel if not signed in ---
        if (!isSignedIn) return;

        const barW = pw * 0.8;
        const barH = 24 * sf;
        const barX = px + (pw - barW) / 2;
        const barY = py + ph - (60 * sf); // Positioned near bottom of panel

        ctx.save();
        
        // 1. Label
        ctx.font = `700 ${Math.floor(16 * sf)}px "Orbitron"`;
        ctx.textAlign = 'left';
        ctx.fillStyle = '#fff';
        
        const username = auth.getUserName();
        const level = sm.getCurrentLevel();
        const title = ExperienceSystem.getPlayerTitle(level);
        const labelText = `[${title}] ${username} - LEVEL ${level}`;
        ctx.fillText(labelText, barX, barY - (10 * sf));
        
        // --- 2. Economy Info Display (Coin) ---
        const economy = EconomyManager.getInstance();
        const totalCoins = economy.getCoins();
        const gainedCoin = sm.getLastGainedCoin();
        
        ctx.textAlign = 'right';
        ctx.font = `900 ${Math.floor(14 * sf)}px "Orbitron"`;
        ctx.fillStyle = '#ffd700'; // Golden for Coin
        ctx.fillText(`+${gainedCoin} Coin`, barX + barW, barY - (28 * sf));
        
        ctx.font = `600 ${Math.floor(12 * sf)}px "Outfit"`;
        ctx.fillStyle = 'rgba(255, 215, 0, 0.6)';
        ctx.fillText(`TOTAL: ${totalCoins.toLocaleString()} Coin`, barX + barW, barY - (10 * sf));

        // 2. Bar Container (Glassmorphism)
        ctx.beginPath();
        this.drawRoundedRect(ctx, barX, barY, barW, barH, barH / 2);
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fill();
        ctx.strokeStyle = isSignedIn ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1 * sf;
        ctx.stroke();

        if (isSignedIn) {
            const totalXP = sm.getTotalXP();
            const gainedXP = sm.getLastGainedXP();
            const prevXP = totalXP - gainedXP;
            
            // Animation logic based on time
            const startTime = 1000; // Delay before fill
            const duration = 2000; // 2 seconds to fill
            const elapsed = performance.now() % 10000; // Simple timer for now, real state should track entry time
            // NOTE: In a production environment, entryTime would be passed from the state.
            // Using a heuristic for the demo.
            const progress = Math.min(1, Math.max(0, (elapsed - startTime) / duration));
            
            const currentVisXP = prevXP + (gainedXP * progress);
            const level = ExperienceSystem.getLevelFromXP(currentVisXP);
            const nextThreshold = ExperienceSystem.getXPThresholdForLevel(level + 1);
            const currentThreshold = ExperienceSystem.getXPThresholdForLevel(level);
            const levelProgress = (currentVisXP - currentThreshold) / (nextThreshold - currentThreshold);
            
            // 3. XP Fill
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
            
            // Inner Glow
            ctx.shadowBlur = 15 * sf;
            ctx.shadowColor = '#00d2ff';
            ctx.fillRect(barX, barY, fillW, barH);
            ctx.restore();

            // 4. Percentage Text
            ctx.font = `900 ${Math.floor(12 * sf)}px "Orbitron"`;
            ctx.textAlign = 'center';
            ctx.fillStyle = '#fff';
            ctx.fillText(`${(levelProgress * 100).toFixed(1)}%`, barX + barW / 2, barY + barH / 2 + 1);

            // 5. Level Up Trigger
            const hasLeveledUp = level > ExperienceSystem.getLevelFromXP(prevXP);
            if (hasLeveledUp && progress > 0.8) {
                this.renderLevelUpCelebration(ctx, px + pw / 2, py + ph / 2, sf);
            }
        } else {
            // Disabled Bar Style
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.textAlign = 'center';
            ctx.font = `700 ${Math.floor(10 * sf)}px "Orbitron"`;
            ctx.fillText("LOCKED", barX + barW / 2, barY + barH / 2 + 1);
        }

        ctx.restore();
    }

    private renderLevelUpCelebration(ctx: CanvasRenderingContext2D, cx: number, cy: number, sf: number) {
        const time = performance.now() * 0.001;
        ctx.save();
        
        // 1. Golden Sunburst
        const rays = 16;
        ctx.translate(cx, cy);
        for (let i = 0; i < rays; i++) {
            ctx.rotate((Math.PI * 2) / rays + time);
            const grad = ctx.createLinearGradient(0, 0, 0, 500 * sf);
            grad.addColorStop(0, 'rgba(255, 215, 0, 0.4)');
            grad.addColorStop(1, 'rgba(255, 215, 0, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-20 * sf, 500 * sf);
            ctx.lineTo(20 * sf, 500 * sf);
            ctx.fill();
        }
        ctx.restore();

        // 2. LEVEL UP Text
        ctx.save();
        const bounce = Math.abs(Math.sin(time * 10)) * 10 * sf;
        ctx.font = `900 ${Math.floor(82 * sf)}px "Orbitron"`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 30 * sf;
        ctx.shadowColor = '#ffd700';
        ctx.fillText("LEVEL UP", cx, cy - 100 * sf - bounce);
        
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 4 * sf;
        ctx.strokeText("LEVEL UP", cx, cy - 100 * sf - bounce);
        ctx.restore();
    }

    /**
     * Renders a splendid golden celebration for All Combo achievement.
     */
    private renderCelebration(ctx: CanvasRenderingContext2D, width: number, height: number) {
        ctx.save();
        
        // 1. Rotating Sunburst Background
        const centerX = width / 2;
        const centerY = height * 0.35; // Positioned behind the Grade section
        const time = performance.now() * 0.001;
        const rays = 12;
        
        ctx.translate(centerX, centerY);
        ctx.rotate(time * 0.2); // Slow rotation
        
        for (let i = 0; i < rays; i++) {
            ctx.rotate((Math.PI * 2) / rays);
            const gradient = ctx.createLinearGradient(0, 0, 0, width * 0.8);
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
        const grad = ctx.createLinearGradient(0, height * 0.45, 0, height * 0.55);
        grad.addColorStop(0, '#fff');
        grad.addColorStop(0.5, '#ffd700'); // Gold
        grad.addColorStop(1, '#ff8c00'); // Dark Orange
        
        ctx.fillStyle = grad;
        ctx.shadowBlur = 25;
        ctx.shadowColor = '#ffd700';
        
        // Position below the Grade but above Accuracy
        const textY = height * 0.48;
        ctx.fillText("ALL COMBO", width / 2, textY);
        
        // Reflection/Glow
        ctx.globalAlpha = 0.3;
        ctx.fillText("ALL COMBO", width / 2, textY + 4);
        ctx.restore();
    }

    private drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number, backgroundUrl: string | null, theme: any) {
        ctx.clearRect(0, 0, width, height);

        if (backgroundUrl) {
            const img = new Image();
            img.src = backgroundUrl;
            if (img.complete) {
                // Blur effect via filter (expensive but high quality)
                ctx.save();
                ctx.filter = 'blur(15px)';
                
                // Cover behavior
                const imgRatio = img.width / img.height;
                const canvasRatio = width / height;
                let drawW, drawH, drawX, drawY;

                if (imgRatio > canvasRatio) {
                    drawH = height;
                    drawW = height * imgRatio;
                    drawX = (width - drawW) / 2;
                    drawY = 0;
                } else {
                    drawW = width;
                    drawH = width / imgRatio;
                    drawX = 0;
                    drawY = (height - drawH) / 2;
                }

                ctx.drawImage(img, drawX, drawY, drawW, drawH);
                ctx.restore();
            } else {
                drawAtmosphere(ctx, width, height);
            }
        } else {
            drawAtmosphere(ctx, width, height);
        }

        // Overlay with theme-aware tint
        // Use a color inspired by the theme but darkened
        const overlayColor = theme.id === 'cyber-neon' ? 'rgba(10, 0, 20, 0.7)' : 'rgba(0, 0, 5, 0.75)';
        ctx.fillStyle = overlayColor;
        ctx.fillRect(0, 0, width, height);
    }
}
