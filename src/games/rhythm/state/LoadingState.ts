import { GameState } from '../types/GameTypes';
import { BaseGameState } from './BaseGameState';

/**
 * State handled when the game is loading assets and preparing for gameplay.
 */
export class LoadingState extends BaseGameState {
    public readonly id = GameState.LOADING;

    public update(_delta: number): void {
        // Loading progress is updated via handlePlayRequest in RhythmGame
    }

    public render(ctx: CanvasRenderingContext2D, alpha: number): void {
        this.game.updateLoadingRenderState();
        this.game.loadingRenderer.render(ctx, this.game.loadingRenderState, alpha);
    }
}
