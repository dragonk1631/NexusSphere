

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

    renderHitZonePulse(ctx: CanvasRenderingContext2D, lane: number, x: number, y: number, width: number, beatPhase: number): void;

    /**
     * Returns a theme-appropriate color for a given judgment result.
     */
    getColorForJudgment(judgment: string): string;
}
