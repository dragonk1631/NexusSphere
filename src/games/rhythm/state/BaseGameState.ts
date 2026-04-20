import { GameState } from '../types/GameTypes';
import type { IGameState } from './IGameState';
import type { RhythmGame } from '../RhythmGame';

/**
 * Abstract Base Class for Game States.
 * Provides default implementations for optional handlers and stores the game context.
 */
export abstract class BaseGameState implements IGameState {
    public abstract readonly id: GameState;
    protected game: RhythmGame;

    constructor(game: RhythmGame) {
        this.game = game;
    }

    public enter(): void { }
    public exit(): void { }

    public abstract update(delta: number): void;
    /** Per-frame rendering logic. */
    public render(_ctx: CanvasRenderingContext2D, _alpha: number): void { }

    // Default implementations for input handlers (do nothing)
    public onKeyDown(_code: string, _modifiers: { shift: boolean, alt: boolean, ctrl: boolean }): void { }
    public onPointerDown(_x: number, _y: number): void { }
    public onPointerMove(_x: number, _y: number): void { }
    public onPointerUp(_x: number, _y: number): void { }
    public onWheel(_delta: number): void { }
}
