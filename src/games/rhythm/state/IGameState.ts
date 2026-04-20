import { GameState } from '../types/GameTypes';

/**
 * Interface for all Game States in the RhythmGame.
 * This implements the State Pattern to decouple game logic by state.
 */
export interface IGameState {
    readonly id: GameState;

    /** Called when the state is entered. */
    enter(): void;

    /** Called when the state is exited. */
    exit(): void;

    /** Per-frame update logic. */
    update(delta: number): void;

    /** Per-frame rendering logic. */
    render(ctx: CanvasRenderingContext2D, alpha: number): void;

    /** Input Handling: Key Press */
    onKeyDown(code: string, modifiers: { shift: boolean, alt: boolean, ctrl: boolean }): void;

    /** Input Handling: Pointer Down */
    onPointerDown(x: number, y: number): void;

    /** Input Handling: Pointer Move */
    onPointerMove(x: number, y: number): void;

    /** Input Handling: Pointer Up */
    onPointerUp(x: number, y: number): void;

    /** Input Handling: Mouse Wheel */
    onWheel(delta: number): void;
}
