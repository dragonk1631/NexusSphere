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
}

export class HUDRenderer {
    private cachedThemeId: string | null = null;
    private cachedHudPalette: typeof HUD_PALETTES[string] | null = null;
    private hpGradient: CanvasGradient | null = null;
    private comboGradient: CanvasGradient | null = null;
    
    // Lazy UI Gradients
    private panelGrad: CanvasGradient | null = null;
    private edgeGrad: CanvasGradient | null = null;
    private gamePanelGrad: CanvasGradient | null = null;
    private gameEdgeGrad: CanvasGradient | null = null;
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

        this.renderPanels(ctx, state, pal, getPerspectiveX);
        this.renderHPBar(ctx, state, pal, scoreManager, getPerspectiveX);
        this.renderSongInfo(ctx, state, pal, getPerspectiveX);
        this.renderScore(ctx, state, pal, score);
        this.renderGameInfo(ctx, state);
        this.renderCombo(ctx, state, pal, combo);
        this.renderJudgment(ctx, state, theme, alpha);
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

        // Pause Button Area
        const pauseBtnSize = 40;
        const pauseBtnX = state.width - 55;
        const pauseBtnY = 85;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.strokeStyle = pal.scorePanel;
        ctx.beginPath();
        ctx.roundRect(pauseBtnX, pauseBtnY, pauseBtnSize, pauseBtnSize, 4);
        ctx.fill();
        ctx.stroke();

        // Pause Icon
        ctx.fillStyle = '#ffffff';
        const barW = 5;
        const barH = 16;
        ctx.fillRect(pauseBtnX + pauseBtnSize / 2 - 6, pauseBtnY + pauseBtnSize / 2 - 8, barW, barH);
        ctx.fillRect(pauseBtnX + pauseBtnSize / 2 + 1, pauseBtnY + pauseBtnSize / 2 - 8, barW, barH);

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
        
        // Mobile scaling
        const isMobile = state.isMobile;
        const panelTopY = 85; // Aligned with Pause Button
        const panelBotY = isMobile ? 120 : 135; 
        const hMargin = isMobile ? 10 : 20;
        
        // Invalidate cache if mobile state flips
        if (this.lastIsMobile !== isMobile) {
            this.panelGrad = null;
            this.edgeGrad = null;
            this.lastIsMobile = isMobile;
        }

        let leftInnerTopX = getPerspectiveX(0, panelTopY) - hMargin;
        let leftInnerBotX = getPerspectiveX(0, panelBotY) - hMargin;

        if (leftInnerBotX > state.width * 0.45) {
            const diff = leftInnerBotX - state.width * 0.45;
            leftInnerBotX -= diff; leftInnerTopX -= diff;
        }

        ctx.save();
        
        // Lazy Evaluation of Gradients for Performance
        if (!this.panelGrad) {
            this.panelGrad = ctx.createLinearGradient(0, panelTopY, 0, panelBotY);
            this.panelGrad.addColorStop(0, 'rgba(20, 25, 35, 0.9)');
            this.panelGrad.addColorStop(0.5, 'rgba(10, 15, 25, 0.85)');
            this.panelGrad.addColorStop(1, 'rgba(5, 10, 15, 0.95)');
        }
        if (!this.edgeGrad) {
            this.edgeGrad = ctx.createLinearGradient(0, panelTopY, 0, panelBotY);
            this.edgeGrad.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
            this.edgeGrad.addColorStop(1, 'rgba(200, 200, 200, 0.1)');
        }

        ctx.fillStyle = this.panelGrad;
        ctx.strokeStyle = this.edgeGrad;
        ctx.lineWidth = 1.5;
        
        ctx.beginPath();
        ctx.moveTo(0, panelTopY);
        ctx.lineTo(leftInnerTopX, panelTopY);
        ctx.lineTo(leftInnerBotX - (isMobile ? 5 : 10), panelBotY - (isMobile ? 5 : 10));
        ctx.lineTo(leftInnerBotX - (isMobile ? 15 : 25), panelBotY);
        ctx.lineTo(0, panelBotY);
        ctx.fill();
        ctx.stroke();

        const titleFont = isMobile ? 'bold 12px' : 'bold 15px';
        const titleY = panelTopY + (isMobile ? 14 : 18);

        // High-Tech Title Text
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = pal.glowColor || 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 4;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = `${titleFont} "Exo 2", "Rajdhani", "Orbitron"`;
        ctx.fillText(title, isMobile ? 10 : 20, titleY);

        // Time Data
        const timeStr = `${this.formatTime(currentTime)} / ${this.formatTime(duration)}`;
        ctx.font = isMobile ? '600 10px "Rajdhani"' : '600 12px "Rajdhani", "Orbitron"';
        ctx.fillStyle = '#a0aab5';
        const slope = (leftInnerBotX - leftInnerTopX) / (panelBotY - panelTopY);
        ctx.textAlign = 'right';
        ctx.fillText(timeStr, leftInnerTopX + slope * (isMobile ? 15 : 25) - (isMobile ? 10 : 20), titleY + (isMobile ? 14 : 18));

        // Segmented Tech Progress Bar
        const barLeft = isMobile ? 10 : 20;
        const barBottom = panelBotY - (isMobile ? 8 : 15);
        const barRightX = leftInnerBotX - (isMobile ? 20 : 30);
        const barW = barRightX - barLeft;
        
        if (barW > 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            const h = isMobile ? 4 : 6;
            ctx.beginPath();
            ctx.moveTo(barLeft, barBottom - h);
            ctx.lineTo(barRightX, barBottom - h);
            ctx.lineTo(barRightX - (isMobile ? 2 : 4), barBottom);
            ctx.lineTo(barLeft - (isMobile ? 2 : 4), barBottom);
            ctx.fill();

            const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
            if (progress > 0) {
                const fillW = barW * progress;
                ctx.fillStyle = pal.hpBarMid || '#00f0ff';
                ctx.shadowBlur = 10;
                ctx.shadowColor = pal.hpBarMid || '#00f0ff';
                ctx.beginPath();
                ctx.moveTo(barLeft, barBottom - h + 1);
                ctx.lineTo(barLeft + fillW, barBottom - h + 1);
                ctx.lineTo(barLeft + fillW - (isMobile ? 2 : 4), barBottom - 1);
                ctx.lineTo(barLeft - (isMobile ? 2 : 4), barBottom - 1);
                ctx.fill();
            }

            ctx.strokeStyle = 'rgba(10, 15, 25, 0.8)';
            ctx.lineWidth = 1.5;
            ctx.shadowBlur = 0;
            const segments = isMobile ? 5 : 10;
            for(let i=1; i<segments; i++) {
                const sx = barLeft + (barW / segments) * i;
                ctx.beginPath();
                ctx.moveTo(sx, barBottom - h);
                ctx.lineTo(sx - (isMobile ? 2 : 4), barBottom);
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
        const boxW = isMobile ? 110 : 160;
        const boxH = isMobile ? 40 : 46;
        const topY = 85; // Aligned with Pause Button
        const rightEdge = state.width - (isMobile ? 55 : 100); 

        // Invalidate cache if mobile state flipped (checked in renderSongInfo already, but safe to sync)
        if (this.lastIsMobile !== isMobile) {
            this.gamePanelGrad = null;
            this.gameEdgeGrad = null;
        }

        ctx.save();
        
        if (!this.gamePanelGrad) {
            this.gamePanelGrad = ctx.createLinearGradient(0, topY, 0, topY + boxH);
            this.gamePanelGrad.addColorStop(0, 'rgba(25, 30, 40, 0.95)');
            this.gamePanelGrad.addColorStop(1, 'rgba(10, 15, 20, 0.9)');
        }
        ctx.fillStyle = this.gamePanelGrad;
        
        if (!this.gameEdgeGrad) {
            this.gameEdgeGrad = ctx.createLinearGradient(0, topY, 0, topY + boxH);
            this.gameEdgeGrad.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
            this.gameEdgeGrad.addColorStop(0.2, 'rgba(100, 200, 255, 0.3)');
            this.gameEdgeGrad.addColorStop(1, 'rgba(255, 255, 255, 0.1)');
        }
        ctx.strokeStyle = this.gameEdgeGrad;
        ctx.lineWidth = 1.5;
        
        const slant = isMobile ? 6 : 8;
        const deepSlant = isMobile ? 8 : 12;

        ctx.beginPath();
        ctx.moveTo(rightEdge - boxW, topY);
        ctx.lineTo(rightEdge, topY);
        ctx.lineTo(rightEdge - slant, topY + boxH/2);
        ctx.lineTo(rightEdge, topY + boxH);
        ctx.lineTo(rightEdge - boxW - deepSlant, topY + boxH);
        ctx.lineTo(rightEdge - boxW, topY + boxH/2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = 'rgba(150, 200, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        const third = boxW / 3;
        ctx.moveTo(rightEdge - boxW + third - 4, topY + (isMobile ? 5 : 8));
        ctx.lineTo(rightEdge - boxW + third - 6, topY + boxH - (isMobile ? 5 : 8));
        ctx.moveTo(rightEdge - boxW + third * 2 - 4, topY + (isMobile ? 5 : 8));
        ctx.lineTo(rightEdge - boxW + third * 2 - 6, topY + boxH - (isMobile ? 5 : 8));
        ctx.stroke();

        ctx.fillStyle = '#6ab8ff';
        ctx.font = isMobile ? 'bold 8px "Rajdhani"' : 'bold 10px "Exo 2", "Rajdhani", "Orbitron"';
        ctx.letterSpacing = '1px';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const center1 = rightEdge - boxW + (third / 2) - 1;
        const center2 = rightEdge - boxW + third + (third / 2) - 3;
        const center3 = rightEdge - boxW + third * 2 + (third / 2) - 5;

        ctx.fillText("LINE", center1, topY + (isMobile ? 4 : 7));
        ctx.fillText("MODE", center2, topY + (isMobile ? 4 : 7));
        ctx.fillText("SPEED", center3, topY + (isMobile ? 4 : 7));

        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = isMobile ? 4 : 6;
        ctx.shadowColor = '#00f0ff';
        ctx.font = isMobile ? '800 13px "Rajdhani"' : '800 17px "Rajdhani", "Orbitron"';
        ctx.fillText(lineStr, center1, topY + (isMobile ? 15 : 20));
        ctx.fillText(modeStr, center2, topY + (isMobile ? 15 : 20));
        ctx.fillText(speedStr, center3, topY + (isMobile ? 15 : 20));

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
}
