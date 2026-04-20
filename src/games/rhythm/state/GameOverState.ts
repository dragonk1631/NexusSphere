import { GameState } from '../types/GameTypes';
import { BaseGameState } from './BaseGameState';
import { ASSET_PATHS } from '../../../core/asset/AssetRegistry';

/**
 * State handled when the player has failed the song.
 */
export class GameOverState extends BaseGameState {
    public readonly id = GameState.GAMEOVER;

    public enter(): void {
        this.game.audioEngine.stopBGM(false); // Stop any menu music immediately
        this.game.audioEngine.playBGM(ASSET_PATHS.AUDIO.UI.GAME_OVER, true);
    }

    public exit(): void {
        this.game.audioEngine.stopBGM(false);
    }

    public update(_delta: number): void { }

    public render(ctx: CanvasRenderingContext2D, alpha: number): void {
        this.game.updateGameOverRenderState();
        this.game.gameOverRenderer.render(ctx, this.game.gameOverRenderState, alpha);
    }

    public onKeyDown(code: string, _modifiers: { shift: boolean, alt: boolean, ctrl: boolean }): void {
        if (code === 'Enter') {
            this.game.handleRetry();
        } else if (code === 'Escape') {
            this.game.backToSongSelection();
        }
    }

    public onPointerDown(x: number, y: number): void {
        const game = this.game;
        const btnIndex = game.gameOverRenderer.getButtonAt(x, y, game.canvas.width, game.canvas.height, game.isMobile);

        if (btnIndex === 0) {
            game.handleRetry();
        } else if (btnIndex === 1) {
            game.backToSongSelection();
        }
    }
}
