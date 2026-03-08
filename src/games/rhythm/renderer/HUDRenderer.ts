import { ScoreManager } from '../../../core/score/ScoreManager';
import { ThemeManager } from '../../../core/ThemeManager';
import {
    HUD_PALETTES,
    HUD_BG,
    JUDGMENT_DURATION
} from '../constants/GameConstants';
import type { IThemeStrategy } from '../themes/IThemeStrategy';

export interface HUDRenderState {
    width: number;
    height: number;
    comboAnim: number;
    lastJudgment: { text: string, color: string, time: number } | null;
    cachedNow: number;
    isMobile: boolean;
}

export class HUDRenderer {
    private cachedThemeId: string | null = null;
    private cachedHudPalette: typeof HUD_PALETTES[string] | null = null;
    private hpGradient: CanvasGradient | null = null;
    private comboGradient: CanvasGradient | null = null;

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

    public render(ctx: CanvasRenderingContext2D, state: HUDRenderState, scoreManager: ScoreManager, themeStrategy: IThemeStrategy, getPerspectiveX: (lane: number, y: number) => number): void {
        const pal = this.getHudPalette();
        const score = Math.floor(scoreManager.getScore());
        const combo = scoreManager.getCombo();

        this.renderPanels(ctx, state, pal, getPerspectiveX);
        this.renderHPBar(ctx, state, pal, scoreManager, getPerspectiveX);
        this.renderScore(ctx, state, pal, score);
        this.renderCombo(ctx, state, pal, combo);
        this.renderJudgment(ctx, state, themeStrategy);
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

        // Pause Button Area (Square below score panel)
        const pauseBtnSize = 50;
        const pauseBtnX = state.width - 65;
        const pauseBtnY = 100;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.strokeStyle = pal.scorePanel;
        ctx.beginPath();
        ctx.roundRect(pauseBtnX, pauseBtnY, pauseBtnSize, pauseBtnSize, 5);
        ctx.fill();
        ctx.stroke();

        // Pause Icon (Two vertical bars)
        ctx.fillStyle = '#ffffff';
        const barW = 6;
        const barH = 20;
        ctx.fillRect(pauseBtnX + pauseBtnSize / 2 - 8, pauseBtnY + pauseBtnSize / 2 - 10, barW, barH);
        ctx.fillRect(pauseBtnX + pauseBtnSize / 2 + 2, pauseBtnY + pauseBtnSize / 2 - 10, barW, barH);

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

    private renderJudgment(ctx: CanvasRenderingContext2D, state: HUDRenderState, themeStrategy: IThemeStrategy): void {
        const judgment = state.lastJudgment;
        if (!judgment) return;
        const age = state.cachedNow - judgment.time;
        if (age > JUDGMENT_DURATION) return;

        const alpha = 1 - (age / JUDGMENT_DURATION);
        const x = state.width / 2;
        const y = state.height * 0.42;

        // [핵심] 테마에 특수한 구현이 있다면 사용하고, 없으면 표준 고퀄리티 로직 적용
        if (themeStrategy.renderJudgmentText) {
            themeStrategy.renderJudgmentText(ctx, judgment.text, judgment.color, alpha, x, y);
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

        // [글로벌 정책] 가독성과 디자인의 균형을 맞춘 26px
        ctx.font = '900 italic 26px "Orbitron", sans-serif';
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
