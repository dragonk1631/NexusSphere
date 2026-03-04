import { type ITransitionRenderData } from '../types/GameTypes';

/**
 * TransitionSystem manages screen effects like fade and glitch.
 * It's used for switching between menu states and game states.
 */
export class TransitionSystem implements ITransitionRenderData {
    private alpha = 0;
    private direction: 'in' | 'out' = 'out';
    private style: 'fade' | 'glitch' = 'fade';
    private isBusy = false;
    private midpointCallback: (() => void) | null = null;

    /**
     * Starts a transition effect.
     * @param callback Function to call at the midpoint (when the screen is fully covered).
     * @param style 'fade' or 'glitch' effect style.
     */
    public start(callback: () => void, style: 'fade' | 'glitch' = 'fade'): void {
        if (this.isBusy) return;

        this.isBusy = true;
        this.midpointCallback = callback;
        this.style = style;
        this.direction = 'in';
        this.alpha = 0;
    }

    /**
     * Updates the transition animation progress.
     * @param delta Delta time in milliseconds.
     */
    public update(delta: number): void {
        if (!this.isBusy) return;

        const speed = 0.005 * delta;
        if (this.direction === 'in') {
            this.alpha += speed;
            if (this.alpha >= 1) {
                this.alpha = 1;
                if (this.midpointCallback) {
                    this.midpointCallback();
                    this.midpointCallback = null;
                }
                this.direction = 'out';
            }
        } else {
            this.alpha -= speed;
            if (this.alpha <= 0) {
                this.alpha = 0;
                this.isBusy = false;
            }
        }
    }

    public getAlpha(): number { return this.alpha; }
    public getStyle(): 'fade' | 'glitch' { return this.style; }
    public isTransitioning(): boolean { return this.isBusy; }
    public isActive(): boolean { return this.isBusy || this.alpha > 0; }

}
