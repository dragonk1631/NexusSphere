import { drawAtmosphere, drawCuteTile, drawCuteLabel } from './UIUtils';

export interface GameOverRenderState {
    width: number;
    height: number;
    isMobile: boolean;
    cachedNow: number;
    transitionStyle: string;
    transitionAlpha: number;
}

export class GameOverRenderer {
    public render(ctx: CanvasRenderingContext2D, state: GameOverRenderState, alpha: number = 0): void {
        const { width, height } = state;

        drawAtmosphere(ctx, width, height);

        // 1. Full-screen Vignette for drama
        const vignette = ctx.createRadialGradient(width / 2, height / 2, width * 0.1, width / 2, height / 2, width * 0.8);
        vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vignette.addColorStop(1, 'rgba(20, 0, 10, 0.85)');
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, width, height);

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // High-Quality Glitchy "GAME OVER"
        const glitchVal = state.transitionStyle === 'glitch' ? state.transitionAlpha : Math.sin(Date.now() * 0.01) * 0.2;
        const xOffset = (Math.random() - 0.5) * 15 * glitchVal;

        const textY = height * (state.isMobile ? 0.30 : 0.35);
        const fontSize = state.isMobile ? 62 : 108;
        ctx.font = `900 italic ${fontSize}px "Orbitron", sans-serif`;

        // Sophisticated Gradient for "GAME OVER"
        const textGrad = ctx.createLinearGradient(0, textY - fontSize / 2, 0, textY + fontSize / 2);
        textGrad.addColorStop(0, '#ffffff'); // Gleaming top
        textGrad.addColorStop(0.3, '#ff0055'); // Hot neon
        textGrad.addColorStop(0.7, '#ff0055');
        textGrad.addColorStop(1, '#6a00ff');   // Purple depth

        ctx.shadowBlur = 45;
        ctx.shadowColor = 'rgba(255, 0, 85, 0.6)';
        ctx.lineWidth = state.isMobile ? 12 : 18;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.strokeText("GAME OVER", width / 2 + xOffset, textY);

        ctx.shadowBlur = 0;
        ctx.fillStyle = textGrad;
        ctx.fillText("GAME OVER", width / 2 + xOffset, textY);

        // Scanline interference (Sophisticated thin lines)
        ctx.globalAlpha = 0.05;
        ctx.fillStyle = '#ff0055';
        const seed = Math.floor(state.cachedNow / 40);
        for (let i = 0; i < height; i += 4) {
            const lineRand = Math.sin(i * 0.8 + seed) * 10000;
            if (lineRand - Math.floor(lineRand) > 0.6) ctx.fillRect(0, i, width, 1);
        }
        ctx.globalAlpha = 1.0;

        // --- Interactive Buttons ---
        const btnW = state.isMobile ? Math.min(width * 0.85, 300) : 420;
        const btnH = state.isMobile ? 55 : 64;
        const centerX = width / 2;

        const minGap = state.isMobile ? 15 : 20;
        const spacing = btnH + minGap;
        const baseY = height * (state.isMobile ? 0.65 : 0.68);
        const retryY = baseY;
        const selectY = baseY + spacing;

        // Button Styles
        const retryGrad = ctx.createLinearGradient(centerX - btnW / 2, 0, centerX + btnW / 2, 0);
        retryGrad.addColorStop(0, '#ff0055');
        retryGrad.addColorStop(1, '#ff4d4d');

        const selectGrad = ctx.createLinearGradient(centerX - btnW / 2, 0, centerX + btnW / 2, 0);
        selectGrad.addColorStop(0, '#1a1a2e');
        selectGrad.addColorStop(1, '#16213e');

        // Draw Retry
        ctx.save();
        ctx.shadowBlur = 20;
        ctx.shadowColor = 'rgba(255, 0, 85, 0.4)';
        drawCuteTile(ctx, centerX - btnW / 2, retryY - btnH / 2, btnW, btnH, retryGrad, true, '#ffffff');
        drawCuteLabel(ctx, "RETRY (Enter)", centerX, retryY, 'center', state.isMobile ? 22 : 26, '#fff', true);
        ctx.restore();

        // Draw Select
        ctx.save();
        drawCuteTile(ctx, centerX - btnW / 2, selectY - btnH / 2, btnW, btnH, selectGrad, true, 'rgba(255, 255, 255, 0.3)');
        drawCuteLabel(ctx, "SONG SELECTION (Esc)", centerX, selectY, 'center', state.isMobile ? 20 : 24, 'rgba(255, 255, 255, 0.8)', true);
        ctx.restore();

        ctx.restore();
    }

    public getButtonAt(x: number, y: number, width: number, height: number, isMobile: boolean): number {
        const btnW = isMobile ? Math.min(width * 0.85, 300) : 420;
        const btnH = isMobile ? 55 : 64;
        const centerX = width / 2;
        const minGap = isMobile ? 15 : 20;
        const spacing = btnH + minGap;
        const baseY = height * (isMobile ? 0.65 : 0.68);

        const retryLeft = centerX - btnW / 2;
        const retryRight = centerX + btnW / 2;
        const retryTop = baseY - btnH / 2;
        const retryBottom = baseY + btnH / 2;

        if (x >= retryLeft && x <= retryRight && y >= retryTop && y <= retryBottom) {
            return 0; // RETRY
        }

        const selectTop = (baseY + spacing) - btnH / 2;
        const selectBottom = (baseY + spacing) + btnH / 2;
        if (x >= retryLeft && x <= retryRight && y >= selectTop && y <= selectBottom) {
            return 1; // SONG SELECTION
        }

        return -1;
    }
}
