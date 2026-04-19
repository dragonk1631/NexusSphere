import { GameState } from '../types/GameTypes';
import { BaseGameState } from './BaseGameState';
import { ASSET_PATHS } from '../../../core/asset/AssetRegistry';

/**
 * State handled when the player has finished a song and is viewing the result screen.
 */
export class ResultState extends BaseGameState {
    public readonly id = GameState.RESULT;
    private backgroundUrl: string | null = null;
    private currentPhase: 'SCORE' | 'EXP' = 'SCORE';
    private enterTime: number = 0;

    public enter(): void {
        this.game.isNavigating = false; 
        this.currentPhase = 'SCORE';
        this.enterTime = performance.now();

        const currentSong = this.game.menuManager.getCurrentSong();
        this.backgroundUrl = currentSong?.backgroundUrl || null;
        
        try {
            this.game.audioEngine.stopBGM(false); 
            this.game.audioEngine.playBGM(ASSET_PATHS.AUDIO.UI.RESULT, true, 0.5);

            if (this.game.scoreManager.isFullCombo()) {
                this.game.audioEngine.playSFX(ASSET_PATHS.AUDIO.UI.CHEER, 0.5);
            }
        } catch (e) {
            console.warn("[ResultState] Audio playback blocked or failed:", e);
        }
    }

    public exit(): void {
        this.game.audioEngine.stopBGM(false);
    }

    public update(_delta: number): void { }

    public render(ctx: CanvasRenderingContext2D, alpha: number): void {
        const elapsed = performance.now() - this.enterTime;
        this.game.resultRenderer.render(
            ctx, 
            this.game.canvas.width, 
            this.game.canvas.height, 
            this.game.scoreManager, 
            this.backgroundUrl, 
            alpha,
            this.currentPhase,
            elapsed
        );
    }

    public onKeyDown(code: string): void {
        if (code === 'Enter' || code === 'Space' || code === 'Escape') {
            this.handleNavigation();
        }
    }

    public onPointerDown(_x: number, _y: number): void {
        this.handleNavigation();
    }

    private handleNavigation(): void {
        if (this.currentPhase === 'SCORE') {
            this.currentPhase = 'EXP';
            // Use CHEER gently as CLICK isn't in the registry yet
            this.game.audioEngine.playSFX(ASSET_PATHS.AUDIO.UI.CHEER, 0.2);
        } else {
            this.game.backToSongSelection();
        }
    }
}
