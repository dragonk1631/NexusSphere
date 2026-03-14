import { Judgment } from '../types/GameTypes';

/**
 * Interface for theme strategies.
 * Allows adding new visual themes without modifying the core renderer logic.
 */
export interface IThemeStrategy {
    id: string;

    /**
     * Optional: Renders judgment text. If not provided, HUDRenderer uses default logic.
     */
    renderJudgmentText?(ctx: CanvasRenderingContext2D, text: string, color: string, alpha: number, x: number, y: number): void;

    renderBackground?(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, alpha: number): void;
    renderHitZonePulse(ctx: CanvasRenderingContext2D, lane: number, x: number, y: number, width: number, beatPhase: number): void;

    /**
     * Returns a theme-appropriate color for a given judgment result.
     */
    getColorForJudgment(judgment: Judgment): string;

    /**
     * Optional: Pre-calculates expensive assets (gradients, color arrays, fonts)
     * before the song starts to avoid runtime hitches.
     */
    preWarm?(ctx: CanvasRenderingContext2D, laneWidth: number): void;

    /**
     * Optional: Renders a unique, theme-specific hit effect at the note's position.
     * Called by EffectsRenderer on each active HitEvent.
     * @param ctx Canvas context
     * @param x   Center X of the hit lane
     * @param y   Y of the hit line
     * @param laneWidth Width of the lane at hit position
     * @param judgment PERFECT | GREAT | GOOD
     * @param t  Normalized time [0..1], 0=just hit, 1=fully expired
     */
    renderHitEffect?(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        laneWidth: number,
        judgment: Judgment,
        t: number
    ): void;
}
