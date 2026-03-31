import { GameState } from '../types/GameTypes';
import { BaseGameState } from './BaseGameState';

/**
 * State handled when the player has finished a song and is viewing the result screen.
 */
export class ResultState extends BaseGameState {
    public readonly id = GameState.RESULT;

    public enter(): void {
        this.game.isNavigating = false; // Reset guard
        
        try {
            this.game.audioEngine.stopBGM(false); 
            this.game.audioEngine.playBGM('/assets/audio/ui/result.mp3', true);

            if (this.game.scoreManager.isFullCombo()) {
                this.game.audioEngine.playSFX('/assets/audio/ui/cheer.mp3');
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
        this.game.resultRenderer.render(ctx, this.game.canvas.width, this.game.canvas.height, this.game.scoreManager, alpha);
    }

    public onKeyDown(code: string): void {
        if (code === 'Enter' || code === 'Space' || code === 'Escape') {
            this.game.backToSongSelection();
        }
    }

    public onPointerDown(_x: number, _y: number): void {
        this.game.backToSongSelection();
    }
}
