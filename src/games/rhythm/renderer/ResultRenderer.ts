import { ScoreManager } from '../../../core/score/ScoreManager';
import { ThemeManager } from '../../../core/ThemeManager';
import { HUD_PALETTES } from '../constants/GameConstants';
import {
    drawAtmosphere
} from './UIUtils';

/**
 * ResultRenderer handles the stage clear / result screen.
 * v4.3 Absolute Fit Polish: Auto-shrinking typography and strict boundary enforcement.
 */
export class ResultRenderer {
    public render(ctx: CanvasRenderingContext2D, width: number, height: number, scoreManager: ScoreManager, _alpha: number = 0) {
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

        drawAtmosphere(ctx, width, height);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(0, 0, width, height);

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

        // 5. Action Hint
        ctx.save();
        const hintSize = Math.max(14, 18 * scaleFactor);
        ctx.font = `400 ${hintSize}px "Orbitron"`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.textAlign = 'center';
        ctx.fillText("CLICK ANYWHERE OR PRESS ENTER TO CONTINUE", width / 2, height - (35 * scaleFactor));
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
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
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
}
