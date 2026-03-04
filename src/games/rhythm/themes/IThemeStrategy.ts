/**
 * Interface for theme strategies.
 * Allows adding new visual themes without modifying the core renderer logic.
 */
export interface IThemeStrategy {
    id: string;

    /**
     * Renders the background for the highway.
     */
    renderBackground(ctx: CanvasRenderingContext2D, width: number, height: number, horizonY: number, bottomY: number): void;

    /**
     * Optional: Renders judgment text. If not provided, HUDRenderer uses default logic.
     */
    renderJudgmentText?(ctx: CanvasRenderingContext2D, text: string, color: string, alpha: number, x: number, y: number): void;

    renderHitZonePulse(ctx: CanvasRenderingContext2D, lane: number, x: number, y: number, width: number, beatPhase: number): void;

    /**
     * Returns a theme-appropriate color for a given judgment result.
     */
    getColorForJudgment(judgment: string): string;
}
