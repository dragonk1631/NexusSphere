import { GameState } from '../types/GameTypes';
import { BaseGameState } from './BaseGameState';

/**
 * State handled when the game is paused.
 */
export class PausedState extends BaseGameState {
    public readonly id = GameState.PAUSED;

    public enter(): void {
        this.game.audioEngine.pause();
        this.game.pauseAnimationTimer = 0;
        this.game.pauseSelectedButtonIndex = 0;
    }

    public update(delta: number): void {
        this.game.pauseAnimationTimer += delta / 1000;
    }

    public render(ctx: CanvasRenderingContext2D, alpha: number): void {
        const game = this.game;
        // Playing state usually renders behind the pause menu
        // But for simplicity in this refactor, we let RhythmGame handle the layering if needed
        // Or we can just call game.renderGameplay here if we want to see the frozen game.
        game.updatePauseRenderState();
        game.pauseRenderer.render(ctx, game.pauseRenderState, alpha);
    }

    public onKeyDown(code: string): void {
        const game = this.game;
        if (code === 'Escape') {
            game.gameplayManager.resumeCountdown = 3.0; // Professional Resume Only
            game.setState(GameState.PLAYING);
        }
        else if (code === 'ArrowUp') game.pauseSelectedButtonIndex = (game.pauseSelectedButtonIndex + 2) % 3;
        else if (code === 'ArrowDown') game.pauseSelectedButtonIndex = (game.pauseSelectedButtonIndex + 1) % 3;
        else if (code === 'Enter') this.handlePauseAction(game.pauseSelectedButtonIndex);
    }

    public onPointerDown(x: number, y: number): void {
        const game = this.game;
        const btnIndex = game.pauseRenderer.getButtonAt(x, y, game.canvas.width, game.canvas.height);
        if (btnIndex !== -1) {
            game.pauseSelectedButtonIndex = btnIndex;
            this.handlePauseAction(btnIndex);
        }
    }

    private handlePauseAction(index: number) {
        const game = this.game;
        if (index === 0) {
            game.gameplayManager.resumeCountdown = 3.0; // Professional Resume Only
            game.setState(GameState.PLAYING); // RESUME
        }
        else if (index === 1) game.handleRetry();         // RESTART
        else if (index === 2) game.backToSongSelection(); // SONG SELECTION
    }

    public exit(): void {
        // Audio unpausing is now handled by PlayingState's countdown logic
        // This exit hook is kept for future side-effects if needed.
    }
}
