import { type ScoreManager } from '../../../core/score/ScoreManager';
import { computeMenuLayout } from './MenuLayout';
import { type MenuRenderState } from '../types/GameTypes';
import { HUD_PALETTES } from '../constants/GameConstants';
import { ThemeManager } from '../../../core/ThemeManager';
import {
    drawPremiumTypography,
    drawScanlines,
    drawScreenCornerDecals
} from './MenuUIUtils';

import { SongInfoPanelRenderer } from './components/SongInfoPanelRenderer';
import { OptionsPanelRenderer } from './components/OptionsPanelRenderer';
import { SongListRenderer } from './components/SongListRenderer';
import { ControlsRenderer } from './components/ControlsRenderer';

/**
 * MenuRenderer handles the song selection screen.
 * v5.0 Masterpiece: Premium High-Fidelity Overhaul.
 * Refactored for Zero-Visual-Change & High Performance.
 */
export class MenuRenderer {
    private scoreManager: ScoreManager;

    // Components modularized across single responsibilities
    private songInfoRenderer = new SongInfoPanelRenderer();
    private optionsRenderer = new OptionsPanelRenderer();
    private songListRenderer = new SongListRenderer();
    private controlsRenderer = new ControlsRenderer();

    constructor(scoreManager: ScoreManager) {
        this.scoreManager = scoreManager;
    }

    public render(ctx: CanvasRenderingContext2D, state: MenuRenderState) {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        const time = performance.now() * 0.001;
        const layout = computeMenuLayout(width, height, state.isMobile);
        const sf = layout.scaleFactor; // Global sizing basis

        // Dynamic theme palette integration
        const theme = ThemeManager.getInstance().getCurrentTheme();
        const pal = HUD_PALETTES[theme.id];
        const c1 = (pal as any).scorePanel || '#00e5ff';
        const c2 = (pal as any).comboGlow || (pal as any).scoreGlow || '#ffffff';

        ctx.save();
        ctx.clearRect(0, 0, width, height);

        drawScanlines(ctx, width, height, time);
        drawScreenCornerDecals(ctx, width, height, sf, time, c1);

        if (state.isTestMode) {
            this.renderTestMode(ctx, state, width, height, time, sf);
            ctx.restore();
            return;
        }

        const currentSong = state.songList[state.selectedSongIndex];
        if (currentSong) {
            // Assign score manager dynamically if state lacks it, though ideally it should be inside state (or here)
            if (!state.scoreManager) {
                // Keep backward compatibility injection if needed
                (state as any).scoreManager = this.scoreManager;
            }
            this.songInfoRenderer.render(ctx, layout, state, currentSong, sf, c1, c2, state.songList[state.selectedSongIndex].bpm || 120);
        }

        this.optionsRenderer.render(ctx, layout, state, sf, c1, c2);
        this.songListRenderer.render(ctx, layout, state, sf, c1, c2, time);
        this.controlsRenderer.renderPlayButton(ctx, layout, time, sf, c1, c2);
        this.controlsRenderer.renderExitButton(ctx, layout, sf, c1);

        ctx.restore();
    }

    private renderTestMode(ctx: CanvasRenderingContext2D, state: any, width: number, height: number, time: number, sf: number) {
        const pulse = 0.8 + Math.sin(time * 3) * 0.2;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        drawPremiumTypography(ctx, state.transitionData?.midiName || 'TEST PLAY', width / 2, height / 2 - (40 * sf), 'center', 42 * sf, '#fff', true, '#fff', width * 0.8);
        drawPremiumTypography(ctx, 'INITIALIZING GAMEPLAY', width / 2, height / 2, 'center', 54 * sf, `rgba(255,255,255,${pulse})`, true, '#fff', width * 0.8);
        ctx.restore();
    }
}
