import type { IThemeStrategy } from '../themes/IThemeStrategy';
import { Judgment, type IParticleRenderData, type ITransitionRenderData } from '../types/GameTypes';

const EFFECTS_CONFIG = {
    EXPLOSION_LINE_WIDTH_BASE: 4,
    EXPLOSION_INNER_RADIUS: 0.7,
    EXPLOSION_INNER_ALPHA: 0.3,
    GLITCH_SCANLINE_COUNT: 10,
    GLITCH_MAX_HEIGHT: 20,
    GLITCH_ALPHA_THRESHOLD: 0.2,
    HIT_EFFECT_DURATION: 500, // ms
    SHOCKWAVE_DURATION: 400,
    MAX_SHOCKWAVES: 5
} as const;

interface Shockwave {
    x: number;
    y: number;
    birthTime: number;
    isActive: boolean;
}

interface HitEvent {
    x: number;
    y: number;
    laneWidth: number;
    judgment: Judgment;
    birthTime: number;
}

/**
 * EffectsRenderer handles particles and screen effects.
 * Optimized: Zero-allocation loops and shadowBlur removal.
 */
export class EffectsRenderer {
    private particleData: IParticleRenderData;
    private transitionData: ITransitionRenderData;
    private glitchOffset: number = 0;
    private shockwaves: Shockwave[] = [];
    private hitEvents: HitEvent[] = [];

    constructor(particleData: IParticleRenderData, transitionData: ITransitionRenderData) {
        this.particleData = particleData;
        this.transitionData = transitionData;
        for (let i = 0; i < EFFECTS_CONFIG.MAX_SHOCKWAVES; i++) {
            this.shockwaves.push({ x: 0, y: 0, birthTime: 0, isActive: false });
        }
    }

    public addHitEvent(x: number, y: number, laneWidth: number, judgment: Judgment): void {
        this.hitEvents.push({ x, y, laneWidth, judgment, birthTime: performance.now() });
    }

    public triggerShockwave(x: number, y: number): void {
        const sw = this.shockwaves.find(s => !s.isActive);
        if (sw) {
            sw.x = x;
            sw.y = y;
            sw.birthTime = performance.now();
            sw.isActive = true;
        }
    }

    public render(ctx: CanvasRenderingContext2D, width: number, height: number, themeStrategy?: IThemeStrategy): void {
        ctx.save();
        this.renderParticles(ctx);
        this.renderExplosions(ctx);
        this.renderShockwaves(ctx);
        this.renderHitEffects(ctx, themeStrategy);
        this.renderTransition(ctx, width, height);
        ctx.restore();
    }

    private renderHitEffects(ctx: CanvasRenderingContext2D, themeStrategy?: IThemeStrategy): void {
        if (!themeStrategy?.renderHitEffect) {
            this.hitEvents = [];
            return;
        }

        const now = performance.now();
        const duration = EFFECTS_CONFIG.HIT_EFFECT_DURATION;

        // PROFESSIONAL OPTIMIZATION: Backward loop for safe removal without filter()
        for (let i = this.hitEvents.length - 1; i >= 0; i--) {
            const ev = this.hitEvents[i];
            const t = (now - ev.birthTime) / duration;

            if (t >= 1) {
                this.hitEvents.splice(i, 1);
                continue;
            }

            ctx.save();
            themeStrategy.renderHitEffect!(ctx, ev.x, ev.y, ev.laneWidth, ev.judgment, t);
            ctx.restore();
        }
    }

    private renderParticles(ctx: CanvasRenderingContext2D): void {
        // USE NEW ITERATOR TO AVOID ARRAY ALLOCATION
        this.particleData.forEachActiveParticle(p => {
            if (p.alpha <= 0.01) return;

            // PERFORMANCE: Manual transform is faster than save/restore
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);

            ctx.rotate(-p.rotation);
            ctx.translate(-p.x, -p.y);
        });
    }

    private renderExplosions(ctx: CanvasRenderingContext2D): void {
        const explosions = this.particleData.getExplosions();
        for (let i = 0; i < explosions.length; i++) {
            const exp = explosions[i];
            if (exp.alpha <= 0.01) continue;

            ctx.save();
            ctx.globalAlpha = exp.alpha;

            ctx.beginPath();
            ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
            ctx.strokeStyle = exp.color;
            ctx.lineWidth = EFFECTS_CONFIG.EXPLOSION_LINE_WIDTH_BASE * exp.alpha;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(exp.x, exp.y, exp.radius * EFFECTS_CONFIG.EXPLOSION_INNER_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = exp.color;
            ctx.globalAlpha = exp.alpha * EFFECTS_CONFIG.EXPLOSION_INNER_ALPHA;
            ctx.fill();
            ctx.restore();
        }
    }

    private renderShockwaves(ctx: CanvasRenderingContext2D): void {
        const now = performance.now();
        const duration = EFFECTS_CONFIG.SHOCKWAVE_DURATION;

        for (const sw of this.shockwaves) {
            if (!sw.isActive) continue;
            const t = (now - sw.birthTime) / duration;
            if (t >= 1) { sw.isActive = false; continue; }

            const alpha = 1 - t;
            const radius = t * 200;

            ctx.beginPath();
            ctx.arc(sw.x, sw.y, radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }

    private renderTransition(ctx: CanvasRenderingContext2D, width: number, height: number): void {
        if (!this.transitionData.isActive()) return;
        const alpha = this.transitionData.getAlpha();
        const style = this.transitionData.getStyle();

        if (style === 'glitch') {
            this.renderGlitch(ctx, width, height, alpha);
        } else {
            ctx.fillStyle = `rgba(10, 0, 20, ${alpha})`;
            ctx.fillRect(0, 0, width, height);
        }
    }

    private renderGlitch(ctx: CanvasRenderingContext2D, width: number, height: number, alpha: number): void {
        this.glitchOffset += 0.1;
        ctx.fillStyle = `rgba(30, 0, 50, ${alpha * 0.8})`;
        ctx.fillRect(0, 0, width, height);

        if (alpha > EFFECTS_CONFIG.GLITCH_ALPHA_THRESHOLD) {
            ctx.fillStyle = `rgba(0, 255, 255, ${alpha * 0.3})`;
            for (let i = 0; i < EFFECTS_CONFIG.GLITCH_SCANLINE_COUNT; i++) {
                const seed = (this.glitchOffset + i * 0.7) % 1000;
                const h = (Math.sin(seed) * 0.5 + 0.5) * EFFECTS_CONFIG.GLITCH_MAX_HEIGHT;
                const y = (Math.sin(seed * 1.3) * 0.5 + 0.5) * height;
                ctx.fillRect(0, y, width, h);
            }
        }
    }
}
