import { ScoreManager } from '../../../core/score/ScoreManager';
import { ThemeManager } from '../../../core/ThemeManager';
import {
    HUD_PALETTES,
    HUD_BG,
    JUDGMENT_DURATION
} from '../constants/GameConstants';
import type { IThemeStrategy } from '../themes/IThemeStrategy';
import { Judgment } from '../types/GameTypes';

export interface HUDRenderState {
    width: number;
    height: number;
    comboAnim: number;
    lastJudgment: { text: string, color: string, time: number, value: Judgment } | null;
    cachedNow: number;
    isMobile: boolean;
    songTitle?: string;
    currentTime?: number;
    duration?: number;
    keyMode?: number;
    difficulty?: string;
    speed?: number;
    resumeCountdown?: number;
    isTestMode?: boolean;
    beatPhase?: number;
}

export class HUDRenderer {
    private cachedThemeId: string | null = null;
    private cachedHudPalette: typeof HUD_PALETTES[string] | null = null;
    private hpGradient: CanvasGradient | null = null;
    private comboGradient: CanvasGradient | null = null;
    
    // Lazy UI Gradients
    private panelGrad: CanvasGradient | null = null;
    private edgeGrad: CanvasGradient | null = null;
    private lastIsMobile: boolean | null = null;

    public onResize(ctx: CanvasRenderingContext2D, _width: number, _height: number): void {
        const theme = ThemeManager.getInstance().getCurrentTheme();
        const pal = HUD_PALETTES[theme.id] || HUD_PALETTES['deep-space'];

        // HP Bar Gradient
        const hpGrad = ctx.createLinearGradient(10, 0, 400, 0); // Approx max width
        hpGrad.addColorStop(0, pal.hpBarStart);
        hpGrad.addColorStop(0.5, pal.hpBarMid);
        hpGrad.addColorStop(1, pal.hpBarEnd);
        this.hpGradient = hpGrad;

        // Combo Gradient
        const comboGrad = ctx.createLinearGradient(0, -36, 0, 36);
        comboGrad.addColorStop(0, pal.comboGradTop);
        comboGrad.addColorStop(0.5, pal.comboFill);
        comboGrad.addColorStop(1, pal.comboGradBot);
        this.comboGradient = comboGrad;
    }

    public render(ctx: CanvasRenderingContext2D, state: HUDRenderState, scoreManager: ScoreManager, theme: IThemeStrategy, getPerspectiveX: (lane: number, y: number) => number, alpha: number = 0): void {
        const pal = this.getHudPalette();
        const score = Math.floor(scoreManager.getScore());
        const combo = scoreManager.getCombo();

        if (state.isTestMode) {
            this.renderTestModeLabel(ctx, state, pal);
        } else {
            this.renderPanels(ctx, state, pal, getPerspectiveX);
            this.renderHPBar(ctx, state, pal, scoreManager, getPerspectiveX);
            this.renderScore(ctx, state, pal, score);
        }

        this.renderSongInfo(ctx, state, pal, getPerspectiveX);
        this.renderGameInfo(ctx, state);
        this.renderCombo(ctx, state, pal, combo);
        this.renderJudgment(ctx, state, theme, alpha);
        this.renderResumeCountdown(ctx, state, pal);
    }

    private getHudPalette(): typeof HUD_PALETTES[string] {
        const theme = ThemeManager.getInstance().getCurrentTheme();
        if (this.cachedThemeId !== theme.id) {
            this.cachedThemeId = theme.id;
            this.cachedHudPalette = HUD_PALETTES[theme.id] || HUD_PALETTES['deep-space'];
        }
        return this.cachedHudPalette!;
    }

    private renderPanels(ctx: CanvasRenderingContext2D, state: HUDRenderState, pal: any, getPerspectiveX: (lane: number, y: number) => number): void {
        ctx.save();
        const panelTopY = 10;
        const panelBotY = 70;
        const hMargin = 20;

        // Left Panel (HP)
        let hpInnerTopX = getPerspectiveX(0, panelTopY) - hMargin;
        let hpInnerBotX = getPerspectiveX(0, panelBotY) - hMargin;

        if (hpInnerBotX > state.width * 0.45) {
            const diff = hpInnerBotX - state.width * 0.45;
            hpInnerBotX -= diff; hpInnerTopX -= diff;
        }

        ctx.fillStyle = HUD_BG;
        ctx.strokeStyle = pal.hpPanel;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, panelTopY);
        ctx.lineTo(hpInnerTopX, panelTopY);
        ctx.lineTo(hpInnerBotX, panelBotY);
        ctx.lineTo(0, panelBotY);
        ctx.fill();
        ctx.stroke();

        // Right Panel (Score)
        let scoreInnerTopX = getPerspectiveX(6, panelTopY) + hMargin;
        let scoreInnerBotX = getPerspectiveX(6, panelBotY) + hMargin;

        if (scoreInnerBotX < state.width * 0.55) {
            const diff = state.width * 0.55 - scoreInnerBotX;
            scoreInnerBotX += diff; scoreInnerTopX += diff;
        }

        ctx.strokeStyle = pal.scorePanel;
        ctx.beginPath();
        ctx.moveTo(state.width, panelTopY);
        ctx.lineTo(scoreInnerTopX, panelTopY);
        ctx.lineTo(scoreInnerBotX, panelBotY);
        ctx.lineTo(state.width, panelBotY);
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    }

    private formatTime(seconds: number): string {
        if (!seconds || isNaN(seconds)) return "0:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    private renderSongInfo(ctx: CanvasRenderingContext2D, state: HUDRenderState, pal: any, getPerspectiveX: (lane: number, y: number) => number): void {
        const title = state.songTitle || "Unknown Track";
        const currentTime = Math.max(0, state.currentTime || 0);
        const duration = state.duration || 0;
        
        // Mobile scaling & Layout Config
        const isMobile = state.isMobile;
        const panelTopY = 85; 
        const panelBotY = isMobile ? 125 : 145; 
        
        // GAP REFINEMENT: Clear separation from the highway
        const hMargin = isMobile ? 18 : 35;
        
        if (this.lastIsMobile !== isMobile) {
            this.panelGrad = null;
            this.edgeGrad = null;
            this.lastIsMobile = isMobile;
        }

        // PERSPECTIVE SYNC: Match the leftmost lane's slope exactly.
        const minWidth = isMobile ? 160 : 200;
        let leftInnerTopX = Math.max(minWidth, getPerspectiveX(0, panelTopY) - hMargin);
        let leftInnerBotX = Math.max(minWidth - (isMobile ? 15 : 30), getPerspectiveX(0, panelBotY) - hMargin);

        if (leftInnerBotX > state.width * 0.42) {
            const diff = leftInnerBotX - state.width * 0.42;
            leftInnerBotX -= diff; leftInnerTopX -= diff;
        }

        ctx.save();
        
        // 1. Panel Background & Edge (Glassmorphism: Lower opacity)
        if (!this.panelGrad) {
            this.panelGrad = ctx.createLinearGradient(0, panelTopY, 0, panelBotY);
            this.panelGrad.addColorStop(0, 'rgba(20, 25, 35, 0.7)');
            this.panelGrad.addColorStop(1, 'rgba(5, 10, 15, 0.75)');
        }
        if (!this.edgeGrad) {
            this.edgeGrad = ctx.createLinearGradient(0, panelTopY, 0, panelBotY);
            this.edgeGrad.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
            this.edgeGrad.addColorStop(0.5, 'rgba(100, 200, 255, 0.2)');
            this.edgeGrad.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
        }

        ctx.fillStyle = this.panelGrad;
        ctx.strokeStyle = this.edgeGrad;
        ctx.lineWidth = 1.5;
        
        ctx.beginPath();
        ctx.moveTo(0, panelTopY);
        ctx.lineTo(leftInnerTopX, panelTopY);
        ctx.lineTo(leftInnerBotX, panelBotY);
        ctx.lineTo(0, panelBotY);
        ctx.fill();
        ctx.stroke();

        // 2. Responsive Text Layout
        const paddingX = isMobile ? 12 : 24;
        const textY = panelTopY + (isMobile ? 16 : 22);
        
        // Time Data (Top Right - Anchored safely with consistent padding)
        const timeStr = `${this.formatTime(currentTime)} / ${this.formatTime(duration)}`;
        ctx.font = isMobile ? '600 11px "Rajdhani"' : '600 15px "Rajdhani", "Orbitron"';
        ctx.fillStyle = '#e0e8f0'; // Slightly brighter for contrast
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        // Increase padding for PC/Mobile consistency (User requested more gap)
        const timeX = leftInnerTopX - paddingX - (isMobile ? 8 : 20);
        ctx.fillText(timeStr, timeX, textY);

        // Title Text (Top Left - Truncated if necessary)
        const timeWidth = ctx.measureText(timeStr).width;
        const titleFont = isMobile ? 'bold 12px' : 'bold 16px';
        ctx.font = `${titleFont} "Exo 2", "Rajdhani"`;
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = pal.glowColor || 'rgba(0, 240, 255, 0.4)';
        ctx.shadowBlur = 6;
        
        const availableTitleWidth = timeX - paddingX - timeWidth - 10;
        let finalTitle = title;
        if (ctx.measureText(title).width > availableTitleWidth) {
            // Simple truncation
            for (let i = title.length; i > 0; i--) {
                const truncated = title.substring(0, i) + "...";
                if (ctx.measureText(truncated).width <= availableTitleWidth) {
                    finalTitle = truncated;
                    break;
                }
            }
        }
        ctx.fillText(finalTitle, paddingX, textY);

        // 3. Premium Progress Bar (Bottom)
        const barLeft = paddingX;
        const barH = isMobile ? 8 : 12;
        const barBottom = panelBotY - (isMobile ? 10 : 18);
        const barRightX = leftInnerBotX - (isMobile ? 20 : 40);
        const barW = barRightX - barLeft;
        
        if (barW > 0) {
            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.beginPath();
            ctx.moveTo(barLeft, barBottom - barH);
            ctx.lineTo(barRightX, barBottom - barH);
            ctx.lineTo(barRightX - (isMobile ? 2 : 5), barBottom);
            ctx.lineTo(barLeft - (isMobile ? 2 : 5), barBottom);
            ctx.fill();
            
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = 1;
            ctx.stroke();

            const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
            if (progress > 0) {
                const fillW = barW * progress;
                const fillColor = pal.hpBarMid || '#00f0ff';
                ctx.fillStyle = fillColor;
                ctx.shadowBlur = 12;
                ctx.shadowColor = fillColor;
                ctx.beginPath();
                ctx.moveTo(barLeft, barBottom - barH + 1);
                ctx.lineTo(barLeft + fillW, barBottom - barH + 1);
                ctx.lineTo(barLeft + fillW - (isMobile ? 2 : 5), barBottom - 1);
                ctx.lineTo(barLeft - (isMobile ? 2 : 5), barBottom - 1);
                ctx.fill();

                ctx.shadowBlur = 0;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
                ctx.fillRect(barLeft, barBottom - barH + 1, fillW, (isMobile ? 1.5 : 2.5));
            }

            ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.lineWidth = 1.5;
            const segments = isMobile ? 6 : 12;
            for(let i=1; i<segments; i++) {
                const sx = barLeft + (barW / segments) * i;
                ctx.beginPath();
                ctx.moveTo(sx, barBottom - barH);
                ctx.lineTo(sx - (isMobile ? 2 : 5), barBottom);
                ctx.stroke();
            }
        }
        
        ctx.restore();
    }

    private renderGameInfo(ctx: CanvasRenderingContext2D, state: HUDRenderState): void {
        const lineStr = state.keyMode ? state.keyMode.toString() : '6';
        const modeStr = state.difficulty ? state.difficulty.substring(0, 2).toUpperCase() : 'NM';
        const speedStr = state.speed ? `x${state.speed.toFixed(1)}` : 'x1.0';
        
        const isMobile = state.isMobile;
        const pal = this.getHudPalette();

        // 1. Geometry Config
        const totalBoxW = isMobile ? 180 : 280; 
        const baseBoxH = isMobile ? 40 : 50;
        const topY = 85; 
        const rightEdge = state.width - (isMobile ? 15 : 30); 
        const cardGap = isMobile ? 5 : 10;
        
        // 1.5x Width for Pause: 3 normal slots (1 unit) + 1 pause slot (1.5 units) = 4.5 units
        const unitW = (totalBoxW - (cardGap * 3)) / 4.5;
        const pulse = (Math.sin(state.cachedNow * 0.01) + 1) * 0.5;

        ctx.save();
        
        const options = [
            { label: "LINE", value: lineStr, type: 'text' },
            { label: "MODE", value: modeStr, type: 'text' },
            { label: "SPEED", value: speedStr, type: 'text' },
            { label: "PAUSE", value: null, type: 'pause' }
        ];

        let currentX = rightEdge - totalBoxW;

        options.forEach((opt, _i) => {
            const isPause = opt.type === 'pause';
            const cardW = isPause ? unitW * 1.5 : unitW;
            const boxH = isPause ? baseBoxH * 1.15 : baseBoxH; 
            const x = currentX;
            currentX += cardW + cardGap;
            
            // ADJUST Y for tall pause button if needed to keep it aligned at the bottom
            const y = isPause ? topY - (boxH - baseBoxH) : topY;

            // DRAW CARD BACKGROUND
            ctx.fillStyle = isPause ? 'rgba(40, 20, 25, 0.75)' : 'rgba(15, 20, 30, 0.7)';
            ctx.strokeStyle = isPause ? (pal.hpPanel || '#ff0055') : (pal.scorePanel || '#00f0ff');
            ctx.lineWidth = isPause ? 4 : 1;

            // Pulsing shadow for Pause only
            if (isPause) {
                ctx.shadowColor = pal.hpPanel || '#ff0055';
                ctx.shadowBlur = 8 + pulse * 14;
            } else {
                ctx.shadowBlur = 0;
            }

            ctx.beginPath();
            if ((ctx as any).roundRect) {
                (ctx as any).roundRect(x, y, cardW, boxH, 6);
            } else {
                ctx.rect(x, y, cardW, boxH);
            }
            ctx.fill();
            ctx.stroke();

            // ACCENT BOTTOM BORDER
            ctx.shadowBlur = 0;
            ctx.fillStyle = isPause ? (pal.hpPanel || '#ff0055') : (pal.scorePanel || '#00f0ff');
            ctx.globalAlpha = isPause ? 0.9 : 0.6;
            ctx.fillRect(x + 5, y + boxH - 4, cardW - 10, 2.5);
            ctx.globalAlpha = 1.0;

            if (opt.type === 'text') {
                // LABEL
                ctx.fillStyle = '#6ab8ff';
                ctx.font = isMobile ? 'bold 9px "Rajdhani"' : 'bold 11px "Exo 2", "Rajdhani"';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillText(opt.label, x + cardW / 2, y + (isMobile ? 6 : 10));

                // VALUE
                ctx.fillStyle = '#ffffff';
                ctx.font = isMobile ? '800 13px "Rajdhani"' : '800 18px "Rajdhani", "Orbitron"';
                ctx.shadowBlur = 4;
                ctx.shadowColor = pal.scorePanel || '#00f0ff';
                ctx.fillText(opt.value!, x + cardW / 2, y + (isMobile ? 18 : 24));
                ctx.shadowBlur = 0;
            } else if (opt.type === 'pause') {
                // PAUSE ICON
                ctx.fillStyle = '#ffffff';
                ctx.shadowBlur = 10 + pulse * 10;
                ctx.shadowColor = pal.hpPanel || '#ff0055';
                
                const pW = isMobile ? 4 : 5;
                const pH = isMobile ? 12 : 16;
                const centerX = x + cardW / 2;
                const centerY = y + boxH / 2 + 2;
                ctx.fillRect(centerX - (pW + 2), centerY - pH/2, pW, pH);
                ctx.fillRect(centerX + 2, centerY - pH/2, pW, pH);
                ctx.shadowBlur = 0;
                
                // Distinct PAUSE Label
                ctx.fillStyle = pal.hpPanel || '#ff0055';
                ctx.font = isMobile ? 'bold 8px "Rajdhani"' : 'bold 10px "Rajdhani", "Orbitron"';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillText("PAUSE", centerX, y + (isMobile ? 4 : 6));
            }
        });

        ctx.restore();
    }

    private renderHPBar(ctx: CanvasRenderingContext2D, state: HUDRenderState, pal: any, scoreManager: ScoreManager, getPerspectiveX: (lane: number, y: number) => number): void {
        const panelTopY = 10;
        const panelBotY = 70;
        const hMargin = 15;
        const hpBgTopY = panelTopY + 10;
        const hpBgBotY = panelBotY - 10;
        const hpBarInset = 10;

        let hpInnerTopX = getPerspectiveX(0, panelTopY) - hMargin;
        let hpInnerBotX = getPerspectiveX(0, panelBotY) - hMargin;
        if (hpInnerBotX > state.width * 0.45) {
            const diff = hpInnerBotX - state.width * 0.45;
            hpInnerBotX -= diff; hpInnerTopX -= diff;
        }

        const hpBarLeftX = hpBarInset;
        const panelSlope = (hpInnerBotX - hpInnerTopX) / (panelBotY - panelTopY);
        const hpBarRightTopX = hpInnerTopX + panelSlope * (hpBgTopY - panelTopY) - hpBarInset;
        const hpBarRightBotX = hpInnerTopX + panelSlope * (hpBgBotY - panelTopY) - hpBarInset;

        ctx.beginPath();
        ctx.moveTo(hpBarLeftX, hpBgTopY);
        ctx.lineTo(hpBarRightTopX, hpBgTopY);
        ctx.lineTo(hpBarRightBotX, hpBgBotY);
        ctx.lineTo(hpBarLeftX, hpBgBotY);
        ctx.closePath();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const maxHp = scoreManager.getMaxHealth();
        const currentHp = scoreManager.getHealth();
        const hpPercent = Math.max(0, Math.min(1, currentHp / maxHp));

        if (hpPercent > 0) {
            const fillRightTopX = hpBarLeftX + (hpBarRightTopX - hpBarLeftX) * hpPercent;
            const fillRightBotX = hpBarLeftX + (hpBarRightBotX - hpBarLeftX) * hpPercent;
            ctx.fillStyle = this.hpGradient || pal.hpBarMid;
            ctx.beginPath();
            ctx.moveTo(hpBarLeftX + 2, hpBgTopY + 2);
            ctx.lineTo(fillRightTopX - 2, hpBgTopY + 2);
            ctx.lineTo(fillRightBotX - 2, hpBgBotY - 2);
            ctx.lineTo(hpBarLeftX + 2, hpBgBotY - 2);
            ctx.closePath();
            ctx.fill();
        }

        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.shadowBlur = 4;
        ctx.shadowColor = pal.labelShadow;
        ctx.fillStyle = pal.labelFill;
        ctx.font = 'bold 12px "Orbitron"';
        ctx.letterSpacing = '2px';
        ctx.fillText("HP SYSTEM", 10, panelTopY + 2);
        ctx.restore();
    }

    private renderScore(ctx: CanvasRenderingContext2D, state: HUDRenderState, pal: any, score: number): void {
        const panelTopY = 10;
        ctx.save();

        // 1. Value
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 8;
        ctx.shadowColor = pal.scoreGlow;
        ctx.fillStyle = '#ffffff';
        ctx.font = 'italic bold 44px "Orbitron"';
        ctx.fillText(score.toLocaleString(), state.width - 20, 48);

        // 2. Label
        ctx.shadowBlur = 4;
        ctx.shadowColor = pal.labelShadow;
        ctx.fillStyle = pal.labelFill;
        ctx.font = 'bold 12px "Orbitron"';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.letterSpacing = '2px';
        ctx.fillText("TOTAL SCORE", state.width - 20, panelTopY + 2);

        ctx.restore();
    }

    private renderCombo(ctx: CanvasRenderingContext2D, state: HUDRenderState, pal: any, combo: number): void {
        if (combo <= 0) return;
        ctx.save();
        ctx.translate(state.width / 2, state.height * 0.15);
        const scale = 1 + state.comboAnim * 0.4;
        ctx.scale(scale, scale);

        const comboText = `${combo}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'italic 900 64px "Orbitron", sans-serif';

        ctx.lineWidth = 10;
        ctx.strokeStyle = pal.comboOutline;
        ctx.strokeText(comboText, 0, 0);

        ctx.shadowBlur = 14 + state.comboAnim * 14;
        ctx.strokeStyle = pal.comboGlow;
        ctx.lineWidth = 3;
        ctx.strokeText(comboText, 0, 0);

        ctx.shadowBlur = 0;
        ctx.fillStyle = this.comboGradient || pal.comboFill;
        ctx.fillText(comboText, 0, 0);

        ctx.font = 'italic 900 18px "Orbitron", sans-serif';
        ctx.letterSpacing = '6px';
        ctx.strokeStyle = pal.comboOutline;
        ctx.lineWidth = 4;
        ctx.strokeText('C O M B O', 0, 42);
        ctx.fillStyle = pal.comboGlow;
        ctx.fillText('C O M B O', 0, 42);
        ctx.restore();
    }

    private renderJudgment(ctx: CanvasRenderingContext2D, state: HUDRenderState, theme: IThemeStrategy, interpolationAlpha: number = 0): void {
        const judgment = state.lastJudgment;
        if (!judgment) return;
        
        // Use interpolationAlpha for sub-frame aging
        const age = (state.cachedNow + interpolationAlpha * (1000/60)) - judgment.time;
        if (age > JUDGMENT_DURATION) return;

        const alpha = 1 - (age / JUDGMENT_DURATION);
        const x = state.width / 2;
        const y = state.height * 0.42;

        // [핵심] 테마에 특수한 구현이 있다면 사용하고, 없으면 표준 고퀄리티 로직 적용
        if (theme.renderJudgmentText) {
            const color = theme.getColorForJudgment(judgment.value);
            theme.renderJudgmentText(ctx, judgment.text, color, alpha, x, y);
        } else {
            this.renderDefaultJudgmentText(ctx, judgment.text, judgment.color, alpha, x, y);
        }
    }

    /**
     * [통합 렌더링 로직] 모든 테마에서 동일하게 적용되는 판정 문자 디자인
     */
    private renderDefaultJudgmentText(ctx: CanvasRenderingContext2D, text: string, color: string, alpha: number, x: number, y: number): void {
        const scale = 0.9 + alpha * 0.25;
        ctx.save();
        ctx.globalAlpha = Math.max(0, alpha * 0.85);
        ctx.translate(x, y);
        ctx.scale(scale, scale);

        // [글로벌 정책] 대형 화면에서도 압도적인 가독성을 제공하도록 44px로 상향 조정
        ctx.font = '900 italic 44px "Orbitron", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // 1. 공통 외곽선 효과
        ctx.lineWidth = 6;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.lineJoin = 'round';
        ctx.strokeText(text, 0, 0);

        // 2. 테마 색상 기반 네온 효과
        ctx.shadowBlur = 10;
        ctx.shadowColor = color;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.strokeText(text, 0, 0);

        // 3. 입체감 있는 그라데이션 필
        const grad = ctx.createLinearGradient(0, -12, 0, 12);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.4, color);
        grad.addColorStop(1, color);

        ctx.shadowBlur = 0;
        ctx.fillStyle = grad;
        ctx.fillText(text, 0, 0);

        ctx.restore();
    }
    
    private renderResumeCountdown(ctx: CanvasRenderingContext2D, state: HUDRenderState, pal: any): void {
        const countdown = state.resumeCountdown || 0;
        if (countdown <= 0) return;

        const val = Math.ceil(countdown);
        const text = val.toString();
        
        // Progress within the current second [0, 1]
        const progress = countdown % 1.0 || 1.0; 
        const pulse = Math.pow(progress, 2); // Accelerating pulse for intensity
        
        ctx.save();
        ctx.translate(state.width / 2, state.height / 2);
        
        // Dynamic scaling: Numbers 'shrink' or 'grow' into position
        const scale = 0.5 + (1 - pulse) * 1.5;
        ctx.scale(scale, scale);
        
        // Global styling: Massive Orbitron 900
        ctx.font = '900 italic 120px "Orbitron"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // 1. Shadow/Glow (Neon style)
        ctx.globalAlpha = pulse; 
        ctx.shadowBlur = 40 * pulse;
        ctx.shadowColor = pal.glowColor || pal.hpPanel;
        ctx.strokeStyle = pal.hpPanel;
        ctx.lineWidth = 4;
        ctx.strokeText(text, 0, 0);
        
        // 2. White Core
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(text, 0, 0);
        
        ctx.restore();
    }

    private renderTestModeLabel(ctx: CanvasRenderingContext2D, state: HUDRenderState, _pal: any): void {
        const x = state.width / 2;
        const y = 40;
        
        // Sync with the beat (sharp pulse like judgment line)
        const beatPhase = state.beatPhase || 0;
        const beatPulse = Math.max(0, 1 - beatPhase); // Peaks at 1 on beat, decays

        ctx.save();
        ctx.translate(x, y);

        // 1. Original Simple Badge Design
        ctx.fillStyle = 'rgba(255, 0, 85, 0.2)';
        ctx.strokeStyle = `rgba(255, 0, 85, ${0.4 + beatPulse * 0.4})`; // Brightens on beat
        ctx.lineWidth = 2;
        
        const labelText = "● TEST MODE ACTIVE";
        ctx.font = '900 18px "Orbitron"';
        const metrics = ctx.measureText(labelText);
        const paddingH = 20;
        const w = metrics.width + paddingH * 2;
        const h = 30;

        ctx.beginPath();
        if ((ctx as any).roundRect) {
            (ctx as any).roundRect(-w / 2, -h / 2, w, h, 4);
        } else {
            ctx.rect(-w / 2, -h / 2, w, h);
        }
        ctx.fill();
        ctx.stroke();

        // 2. Original Simple Text with Beat-Synced Glow
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Color is mainly white, but glows with the beat
        ctx.shadowBlur = 5 + beatPulse * 15;
        ctx.shadowColor = '#ff0055';
        ctx.fillStyle = '#ffffff';
        
        // Subtle flicker: combine beat pulse and global pulse
        ctx.globalAlpha = 0.7 + beatPulse * 0.3;
        
        ctx.fillText(labelText, 0, 0);

        ctx.restore();
    }
}
