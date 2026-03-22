import type { IThemeStrategy } from './IThemeStrategy';
import { Judgment } from '../types/GameTypes';

/**
 * BaseThemeStrategy provides shared utilities for gradient and sprite caching
 * to ensure high performance while maintaining visual quality.
 */
export abstract class BaseThemeStrategy implements IThemeStrategy {
    public abstract id: string;

    protected gradientCache: Map<string, CanvasGradient> = new Map();
    protected spriteCache: Map<string, HTMLCanvasElement> = new Map();

    public abstract renderHitZonePulse(ctx: CanvasRenderingContext2D, lane: number, _x: number, _y: number, width: number, beatPhase: number): void;
    public abstract getColorForJudgment(judgment: Judgment): string;

    /**
     * Shared utility for creating or retrieving a cached radial gradient.
     */
    protected getCachedRadialGradient(
        ctx: CanvasRenderingContext2D,
        key: string,
        _x: number,
        _y: number,
        r0: number,
        r1: number,
        stops: { offset: number; color: string }[]
    ): CanvasGradient {
        // Note: Gradients are context-dependent in some browsers, but generally reusable 
        // if the coordinates match. For hit effects, coordinates change every frame,
        // so we often need to translate the context instead of caching the gradient with fixed coords.
        // HOWEVER, a 0-centered gradient can be cached and reused via ctx.translate.
        
        if (this.gradientCache.has(key)) {
            return this.gradientCache.get(key)!;
        }

        const grad = ctx.createRadialGradient(0, 0, r0, 0, 0, r1);
        stops.forEach(s => grad.addColorStop(s.offset, s.color));
        this.gradientCache.set(key, grad);
        return grad;
    }

    /**
     * Shared utility for creating or retrieving a cached sprite (Canvas-based).
     */
    protected getCachedSprite(
        key: string,
        size: number,
        drawFn: (ctx: CanvasRenderingContext2D, s: number) => void
    ): HTMLCanvasElement {
        if (this.spriteCache.has(key)) {
            return this.spriteCache.get(key)!;
        }

        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        drawFn(ctx, size);
        this.spriteCache.set(key, canvas);
        return canvas;
    }

    public abstract renderHitEffect?(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        laneWidth: number,
        judgment: Judgment,
        t: number,
        seed: number
    ): void;

    /**
     * Clear caches on pre-warm or resize if necessary.
     */
    public preWarm(_ctx: CanvasRenderingContext2D, _laneWidth: number): void {
        this.gradientCache.clear();
        this.spriteCache.clear();
    }
}
