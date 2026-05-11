import { drawAtmosphere, drawCuteTile, drawCuteLabel } from './UIUtils';

export interface GameOverRenderState {
    width: number;
    height: number;
    isMobile: boolean;
    cachedNow: number;
    transitionStyle: string;
    transitionAlpha: number;
    characterImage?: HTMLImageElement;
}

/**
 * Cinematic Frame-less Game Over Screen v6
 * Features: Massive Hero Portrait, Clean Side-by-Side layout, High-impact Typography
 */
export class GameOverRenderer {
    public render(ctx: CanvasRenderingContext2D, state: GameOverRenderState, _alpha: number = 0): void {
        const { width, height } = state;
        const now = state.cachedNow;

        // ═══════════════════════════════════════════
        // LAYER 1: ATMOSPHERE & BACKGROUND
        // ═══════════════════════════════════════════
        drawAtmosphere(ctx, width, height);

        // Deeper, more atmospheric vignette
        const vignette = ctx.createRadialGradient(width / 2, height / 2, width * 0.05, width / 2, height / 2, width * 0.9);
        vignette.addColorStop(0, 'rgba(50, 5, 20, 0.4)');
        vignette.addColorStop(0.5, 'rgba(15, 2, 8, 0.85)');
        vignette.addColorStop(1, 'rgba(0, 0, 0, 0.98)');
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, width, height);

        this.renderBackgroundEffects(ctx, width, height, now);

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // ═══════════════════════════════════════════
        // LAYER 2: TITLE (TOP)
        // ═══════════════════════════════════════════
        const titleY = height * 0.16;
        const titleSize = state.isMobile ? 54 : 96;
        ctx.font = `900 italic ${titleSize}px "Orbitron", sans-serif`;
        const tGrad = ctx.createLinearGradient(0, titleY - titleSize/2, 0, titleY + titleSize/2);
        tGrad.addColorStop(0, '#ffffff'); tGrad.addColorStop(0.4, '#ff1744'); tGrad.addColorStop(1, '#2f3542');
        ctx.shadowBlur = 30; ctx.shadowColor = 'rgba(255, 71, 87, 0.6)';
        ctx.fillStyle = tGrad; ctx.fillText("GAME OVER", width / 2, titleY);
        ctx.shadowBlur = 0;

        // ═══════════════════════════════════════════
        // LAYER 3: CLEAN SIDE-BY-SIDE LAYOUT (NO FRAMES)
        // ═══════════════════════════════════════════
        const sf = state.isMobile ? 0.85 : 1.0;
        
        // Portrait Configuration (Balanced: Larger for Mobile, Moderate for PC)
        const portraitH = height * (state.isMobile ? 0.675 : 0.45); 
        const btnW = state.isMobile ? 240 : 340;
        const btnH = state.isMobile ? 56 : 68;
        const btnGap = state.isMobile ? 16 : 24;
        
        const spacing = state.isMobile ? 30 : 60;
        
        // Calculate dynamic width based on image ratio
        let portraitW = portraitH * 0.75; 
        if (state.characterImage && state.characterImage.complete && state.characterImage.naturalWidth > 0) {
            const sw = state.characterImage.naturalWidth / 2;
            const sh = state.characterImage.naturalHeight / 2;
            portraitW = portraitH * (sw / sh);
        }
        
        const totalContentW = portraitW + spacing + btnW;
        const startX = (width - totalContentW) / 2;
        const centerY = height * 0.52;

        // 3a. Hero Character Portrait (LEFT)
        if (state.characterImage && state.characterImage.complete && state.characterImage.naturalWidth > 0) {
            const sw = state.characterImage.naturalWidth / 2;
            const sh = state.characterImage.naturalHeight / 2;
            const drawX = startX;
            const drawY = centerY - portraitH / 2;

            ctx.save();
            ctx.filter = 'drop-shadow(0px 0px 40px rgba(255, 0, 0, 0.35)) brightness(1.05)';
            ctx.drawImage(state.characterImage, sw, sh, sw, sh, drawX, drawY, portraitW, portraitH);
            ctx.restore();
        }

        // 3b. Action Buttons (RIGHT)
        const btnX = startX + portraitW + spacing;
        const retryY = centerY - (btnH + btnGap) / 2;
        const selectY = centerY + (btnH + btnGap) / 2;

        // RETRY
        const rGrad = ctx.createLinearGradient(btnX, 0, btnX + btnW, 0);
        rGrad.addColorStop(0, '#ff1744'); rGrad.addColorStop(1, '#b71c1c');
        ctx.save(); ctx.shadowBlur = 25; ctx.shadowColor = 'rgba(255, 0, 0, 0.5)';
        drawCuteTile(ctx, btnX, retryY - btnH / 2, btnW, btnH, rGrad, true, '#ffffff');
        drawCuteLabel(ctx, "RETRY", btnX + btnW / 2, retryY, 'center', state.isMobile ? 24 : 28, '#fff', true);
        ctx.restore();

        // SONG SELECT
        const sGrad = ctx.createLinearGradient(btnX, 0, btnX + btnW, 0);
        sGrad.addColorStop(0, '#37474f'); sGrad.addColorStop(1, '#102027');
        ctx.save();
        drawCuteTile(ctx, btnX, selectY - btnH / 2, btnW, btnH, sGrad, true, 'rgba(255, 255, 255, 0.4)');
        drawCuteLabel(ctx, "SONG SELECT", btnX + btnW / 2, selectY, 'center', state.isMobile ? 20 : 24, 'rgba(255, 255, 255, 0.95)', true);
        ctx.restore();

        // ═══════════════════════════════════════════
        // LAYER 4: HIGH-IMPACT SUBTITLE (BOTTOM)
        // ═══════════════════════════════════════════
        const subY = height * 0.88;
        const subSize = state.isMobile ? 26 : 38;
        ctx.font = `900 italic ${subSize}px "Orbitron"`;
        const msgs = ["NEVER GIVE UP", "STAY DETERMINED", "SYSTEM FAILURE", "LIMIT BREAK...", "TRY AGAIN"];
        const activeMsg = msgs[Math.floor((now / 5000) % msgs.length)];

        ctx.save();
        ctx.lineWidth = 10 * sf; ctx.strokeStyle = '#000000'; ctx.lineJoin = 'round';
        ctx.strokeText(activeMsg, width / 2, subY);
        ctx.shadowBlur = 30; ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
        const subGrad = ctx.createLinearGradient(0, subY - subSize/2, 0, subY + subSize/2);
        subGrad.addColorStop(0, '#ffffff'); subGrad.addColorStop(1, '#999999');
        ctx.fillStyle = subGrad; ctx.fillText(activeMsg, width / 2, subY);
        ctx.restore();

        ctx.restore();
    }

    public getButtonAt(x: number, y: number, width: number, height: number, isMobile: boolean): number {
        const portraitH = height * (isMobile ? 0.675 : 0.45); 
        const btnW = isMobile ? 240 : 340;
        const btnH = isMobile ? 56 : 68;
        const btnGap = isMobile ? 16 : 24;
        
        const spacing = isMobile ? 30 : 60;
        const portraitW = portraitH * 0.75; // Approximation for hit detection
        const totalContentW = portraitW + spacing + btnW;
        const startX = (width - totalContentW) / 2;
        const centerY = height * 0.52;
        
        const btnX = startX + portraitW + spacing;
        const retryY = centerY - (btnH + btnGap) / 2;
        const selectY = centerY + (btnH + btnGap) / 2;
        
        if (x >= btnX && x <= btnX + btnW && y >= retryY - btnH / 2 && y <= retryY + btnH / 2) return 0;
        if (x >= btnX && x <= btnX + btnW && y >= selectY - btnH / 2 && y <= selectY + btnH / 2) return 1;
        
        return -1;
    }

    private renderBackgroundEffects(ctx: CanvasRenderingContext2D, w: number, h: number, now: number) {
        ctx.save();
        for (let i = 0; i < 22; i++) {
            const s = i * 789.12;
            const x = (s % 1) * w + Math.sin(now * 0.0006 + s) * 60;
            const y = h - ((now * 0.14 + s * h) % (h + 100));
            ctx.fillStyle = '#ff1744'; ctx.globalAlpha = 0.3 * (y / h);
            ctx.beginPath(); ctx.arc(x, y, (s % 1) * 4 + 1, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }
}
