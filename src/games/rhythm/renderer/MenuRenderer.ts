import { type ScoreManager } from '../../../core/score/ScoreManager';
import { computeMenuLayout } from './MenuLayout';
import { type MenuRenderState } from '../types/GameTypes';
import { HUD_PALETTES } from '../constants/GameConstants';
import { ThemeManager } from '../../../core/ThemeManager';
import {
    drawPremiumTypography,
    drawScanlines
} from './MenuUIUtils';

import { SongInfoPanelRenderer } from './components/SongInfoPanelRenderer';
import { OptionsPanelRenderer } from './components/OptionsPanelRenderer';
import { SongListRenderer } from './components/SongListRenderer';
import { ControlsRenderer } from './components/ControlsRenderer';
import { MidiEQRenderer } from './MidiEQRenderer';

/**
 * MenuRenderer handles the song selection screen.
 * v5.0 Masterpiece: Premium High-Fidelity Overhaul.
 * Refactored for Zero-Visual-Change & High Performance.
 */
export class MenuRenderer {
    private scoreManager: ScoreManager;
    private width: number = 0;
    private height: number = 0;

    // Components modularized across single responsibilities
    private songInfoRenderer = new SongInfoPanelRenderer();
    private optionsRenderer = new OptionsPanelRenderer();
    private songListRenderer = new SongListRenderer();
    private controlsRenderer = new ControlsRenderer();
    private midiEQRenderer = new MidiEQRenderer();

    private cachedLayout: any = null;

    constructor(scoreManager: ScoreManager) {
        this.scoreManager = scoreManager;
    }

    public onResize(_ctx: CanvasRenderingContext2D, _width: number, _height: number): void {
        this.cachedLayout = null;
    }


    public render(ctx: CanvasRenderingContext2D, state: MenuRenderState, _alpha: number = 0): void {
        const time = performance.now() * 0.001;
        
        // 1. Layout Caching
        if (!this.cachedLayout || this.width !== state.width || this.height !== state.height) {
            this.width = state.width;
            this.height = state.height;
            this.cachedLayout = computeMenuLayout(this.width, this.height, state.isMobile);
        }
        const layout = this.cachedLayout;
        const sf = layout.scaleFactor;

        // 2. Theme Colors
        const theme = ThemeManager.getInstance().getCurrentTheme();
        const pal = HUD_PALETTES[theme.id] || HUD_PALETTES['deep-space']; 
        const c1 = (pal as any).scorePanel || '#00e5ff';
        const c2 = (pal as any).comboGlow || (pal as any).scoreGlow || '#ffffff';

        if (state.isTestMode) {
            ctx.save();
            drawScanlines(ctx, this.width, this.height, time);
            this.renderTestMode(ctx, state, time, sf);
            ctx.restore();
            return;
        }

        const currentSong = state.songList[state.selectedSongIndex] || null;
        if (!state.scoreManager) (state as any).scoreManager = this.scoreManager;

        ctx.save();
        
        // 3. Render stationary & dynamic components directly
        // Individual panel caching in MenuUIUtils handles performance.
        this.optionsRenderer.render(ctx, layout, state, sf, c1, c2);

        // 5. Draw Dynamic Elements (Animations, EQ, Scanlines)
        drawScanlines(ctx, this.width, this.height, time);
        
        // Dynamic Song Info
        this.songInfoRenderer.render(ctx, layout, state, currentSong, sf, c1, c2, currentSong?.bpm || 120, this.midiEQRenderer);
        
        // Dynamic Song List
        this.songListRenderer.render(ctx, layout, state, sf, c1, c2, time);
        
        // Dynamic Controls (Pulsing buttons)
        this.controlsRenderer.renderPlayButton(ctx, layout, time, sf, c1, c2);
        this.controlsRenderer.renderBackButton(ctx, layout, sf, time);

        ctx.restore();
    }


    private renderTestMode(ctx: CanvasRenderingContext2D, state: any, time: number, sf: number) {
        const pulse = 0.8 + Math.sin(time * 3) * 0.2;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        drawPremiumTypography(ctx, state.transitionData?.midiName || 'TEST PLAY', this.width / 2, this.height / 2 - (40 * sf), 'center', 42 * sf, '#fff', true, '#fff', this.width * 0.8);
        drawPremiumTypography(ctx, 'INITIALIZING GAMEPLAY', this.width / 2, this.height / 2, 'center', 54 * sf, `rgba(255,255,255,${pulse})`, true, '#fff', this.width * 0.8);
        ctx.restore();
    }
}
