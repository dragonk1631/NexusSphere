import { type IParticleRenderData, type ITransitionRenderData } from '../types/GameTypes';
import type { IThemeStrategy } from '../themes/IThemeStrategy';

const EFFECTS_CONFIG = {
    PARTICLE_SHADOW_BLUR: 10,
    EXPLOSION_LINE_WIDTH_BASE: 4,
    EXPLOSION_INNER_RADIUS: 0.7,
    EXPLOSION_INNER_ALPHA: 0.3,
    GLITCH_SCANLINE_COUNT: 10,
    GLITCH_MAX_HEIGHT: 20,
    GLITCH_ALPHA_THRESHOLD: 0.2,
    HIT_EFFECT_DURATION: 500 // ms
} as const;

/** A single note-hit event that drives theme-specific visual feedback. */
interface HitEvent {
    x: number;
    y: number;
    laneWidth: number;
    judgment: string;
    birthTime: number; // performance.now() timestamp
}

/**
 * EffectsRenderer handles the drawing of particles, explosions,
 * screen transition overlays, and theme-specific hit effects.
 */
export class EffectsRenderer {
    private particleData: IParticleRenderData;
    private transitionData: ITransitionRenderData;
    private glitchOffset: number = 0;

    /** Queue of active hit events, cleared as they expire. */
    private hitEvents: HitEvent[] = [];

    constructor(
        particleData: IParticleRenderData,
        transitionData: ITransitionRenderData
    ) {
        this.particleData = particleData;
        this.transitionData = transitionData;
    }

    /**
     * Called from RhythmGame when a note is successfully hit.
     */
    public addHitEvent(x: number, y: number, laneWidth: number, judgment: string): void {
        this.hitEvents.push({ x, y, laneWidth, judgment, birthTime: performance.now() });
    }

    /**
     * Renders all visual effects (particles, explosions, hit effects, and transitions).
     */
    public render(ctx: CanvasRenderingContext2D, width: number, height: number, themeStrategy?: IThemeStrategy): void {
        ctx.save();
        this.renderParticles(ctx);
        this.renderExplosions(ctx);
        this.renderHitEffects(ctx, themeStrategy);
        this.renderTransition(ctx, width, height);
        ctx.restore();
    }

    private renderHitEffects(ctx: CanvasRenderingContext2D, themeStrategy?: IThemeStrategy): void {
        if (!themeStrategy?.renderHitEffect) {
            this.hitEvents = []; // purge if no theme effect registered
            return;
        }

        const now = performance.now();
        const duration = EFFECTS_CONFIG.HIT_EFFECT_DURATION;

        this.hitEvents = this.hitEvents.filter(ev => {
            const t = (now - ev.birthTime) / duration;
            if (t >= 1) return false; // expired
            ctx.save();
            themeStrategy.renderHitEffect!(ctx, ev.x, ev.y, ev.laneWidth, ev.judgment, t);
            ctx.restore();
            return true;
        });
    }

    private renderParticles(ctx: CanvasRenderingContext2D): void {
        const particles = this.particleData.getParticles();
        const visibleParticles = particles.filter(p => p.alpha > 0.01 && p.size > 0.1);

        if (visibleParticles.length === 0) return;

        for (const p of visibleParticles) {
            // Apply transform manually to avoid expensive save/restore per particle
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);

            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.shadowBlur = EFFECTS_CONFIG.PARTICLE_SHADOW_BLUR;
            ctx.shadowColor = p.color;

            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);

            // Revert transform
            ctx.rotate(-p.rotation);
            ctx.translate(-p.x, -p.y);
        }
    }

    private renderExplosions(ctx: CanvasRenderingContext2D): void {
        const explosions = this.particleData.getExplosions();
        for (const exp of explosions) {
            if (exp.alpha <= 0.01) continue;

            ctx.beginPath();
            ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
            ctx.strokeStyle = exp.color;
            ctx.lineWidth = EFFECTS_CONFIG.EXPLOSION_LINE_WIDTH_BASE * exp.alpha;
            ctx.globalAlpha = exp.alpha;
            ctx.stroke();

            // Inner fill
            ctx.beginPath();
            ctx.arc(exp.x, exp.y, exp.radius * EFFECTS_CONFIG.EXPLOSION_INNER_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = exp.color;
            ctx.globalAlpha = exp.alpha * EFFECTS_CONFIG.EXPLOSION_INNER_ALPHA;
            ctx.fill();
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
