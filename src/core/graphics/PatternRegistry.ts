import type { ThemeConfig } from '../ThemeManager';

export interface PatternContext {
    ctx: OffscreenCanvasRenderingContext2D;
    width: number;
    height: number;
    time: number;
    isMobile: boolean;
    theme: ThemeConfig;
    aliveCount: number;
    spawn: () => number;
    kill: (id: number) => void;
    // Shared buffers (TypedArrays) passed from the main worker
    buffers: {
        px: Float32Array;
        py: Float32Array;
        pz: Float32Array;
        vx: Float32Array;
        vy: Float32Array;
        size: Float32Array;
        life: Float32Array;
        phase: Float32Array;
        layer: Float32Array;
        custom1: Float32Array;
        custom2: Float32Array;
        pulseSpeed: Float32Array;
        pulseMag: Float32Array;
    };
    getCachedTexture: (id: string, s: number, drawFn: (c: OffscreenCanvasRenderingContext2D) => void) => OffscreenCanvas;
    applyAlpha: (color: string, alpha: string) => string;
    setCompositeOperation: (op: string) => void;
}

export interface IBackgroundPattern {
    id: string;
    init(context: PatternContext): void;
    draw(context: PatternContext): void;
}

export class PatternRegistry {
    private static patterns: Map<string, IBackgroundPattern> = new Map();

    public static register(pattern: IBackgroundPattern) {
        this.patterns.set(pattern.id, pattern);
    }

    public static get(id: string): IBackgroundPattern | undefined {
        return this.patterns.get(id);
    }
}
