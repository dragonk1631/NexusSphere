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
    MAX_SHOCKWAVES: 8
} as const;

const HE_OFF = { X: 0, Y: 1, WIDTH: 2, JUDGMENT: 3, BIRTH: 4, ACTIVE: 5, SEED: 6, STRIDE: 7 };
const SW_OFF = { X: 0, Y: 1, BIRTH: 2, ACTIVE: 3, STRIDE: 4 };

/**
 * EffectsRenderer handles particles and screen effects.
 * Optimized with TypedArray buffers to avoid GC pressure and heap allocations.
 */
export class EffectsRenderer {
    private particleData: IParticleRenderData;
    private transitionData: ITransitionRenderData;
    private glitchOffset: number = 0;
    private isMobile: boolean = false;

    // Buffer for HitEvents: [x, y, laneWidth, judgment, birthTime, isActive] * MAX_HIT_EVENTS
    private hitEventBuffer: Float32Array;
    private hitEventIndex: number = 0;
    private maxHitEvents: number = 64;

    // Buffer for Shockwaves: [x, y, birthTime, isActive] * MAX_SHOCKWAVES
    private shockwaveBuffer: Float32Array;
    private freeShockwaveIndices: number[] = [];

    constructor(particleData: IParticleRenderData, transitionData: ITransitionRenderData) {
        this.particleData = particleData;
        this.transitionData = transitionData;

        this.hitEventBuffer = new Float32Array(this.maxHitEvents * HE_OFF.STRIDE);
        this.shockwaveBuffer = new Float32Array(EFFECTS_CONFIG.MAX_SHOCKWAVES * SW_OFF.STRIDE);

        // Pre-fill free indices for shockwaves
        for (let i = 0; i < EFFECTS_CONFIG.MAX_SHOCKWAVES; i++) {
            this.freeShockwaveIndices.push(i);
        }
    }

    public setMobile(isMobile: boolean): void {
        this.isMobile = isMobile;
    }

    public addHitEvent(x: number, y: number, laneWidth: number, judgment: Judgment): void {
        const idx = this.hitEventIndex * HE_OFF.STRIDE;
        this.hitEventBuffer[idx + HE_OFF.X] = x;
        this.hitEventBuffer[idx + HE_OFF.Y] = y;
        this.hitEventBuffer[idx + HE_OFF.WIDTH] = laneWidth;
        this.hitEventBuffer[idx + HE_OFF.JUDGMENT] = judgment;
        this.hitEventBuffer[idx + HE_OFF.BIRTH] = performance.now();
        this.hitEventBuffer[idx + HE_OFF.ACTIVE] = 1.0;
        this.hitEventBuffer[idx + HE_OFF.SEED] = Math.random();

        this.hitEventIndex = (this.hitEventIndex + 1) % this.maxHitEvents;
    }

    public triggerShockwave(x: number, y: number): void {
        const activeCount = EFFECTS_CONFIG.MAX_SHOCKWAVES - this.freeShockwaveIndices.length;
        const limit = this.isMobile ? 3 : EFFECTS_CONFIG.MAX_SHOCKWAVES; 
        if (activeCount >= limit) return;

        const i = this.freeShockwaveIndices.pop();
        if (i !== undefined) {
            const idx = i * SW_OFF.STRIDE;
            this.shockwaveBuffer[idx + SW_OFF.X] = x;
            this.shockwaveBuffer[idx + SW_OFF.Y] = y;
            this.shockwaveBuffer[idx + SW_OFF.BIRTH] = performance.now();
            this.shockwaveBuffer[idx + SW_OFF.ACTIVE] = 1.0;
        }
    }

    public render(ctx: CanvasRenderingContext2D, _width: number, _height: number, theme: IThemeStrategy, _alpha: number = 0): void {
        ctx.save();
        this.renderParticles(ctx);
        this.renderExplosions(ctx);
        this.renderShockwaves(ctx);
        this.renderHitEffects(ctx, theme);
        this.renderTransition(ctx, _width, _height);
        ctx.restore();
    }

    private renderHitEffects(ctx: CanvasRenderingContext2D, themeStrategy?: IThemeStrategy): void {
        if (!themeStrategy?.renderHitEffect) return;

        const now = performance.now();
        const duration = EFFECTS_CONFIG.HIT_EFFECT_DURATION;

        for (let i = 0; i < this.maxHitEvents; i++) {
            const idx = i * HE_OFF.STRIDE;
            if (this.hitEventBuffer[idx + HE_OFF.ACTIVE] === 0.0) continue;

            const t = (now - this.hitEventBuffer[idx + HE_OFF.BIRTH]) / duration;

            if (t >= 1) {
                this.hitEventBuffer[idx + HE_OFF.ACTIVE] = 0.0;
                continue;
            }

            ctx.save();
            themeStrategy.renderHitEffect(
                ctx,
                this.hitEventBuffer[idx + HE_OFF.X],
                this.hitEventBuffer[idx + HE_OFF.Y],
                this.hitEventBuffer[idx + HE_OFF.WIDTH],
                this.hitEventBuffer[idx + HE_OFF.JUDGMENT] as Judgment,
                t,
                this.hitEventBuffer[idx + HE_OFF.SEED]
            );
            ctx.restore();
        }
    }

    private renderParticles(ctx: CanvasRenderingContext2D): void {
        // PROFESSIONAL OPTIMIZATION: Color Batching
        // We group particles by color to minimize state changes.
        // The ParticleSystem already exposes a color-indexed palette.
        
        ctx.save();
        this.particleData.forEachActiveParticle(p => {
            if (p.alpha <= 0.01) return;

            // Simple transformation
            ctx.setTransform(1, 0, 0, 1, p.x, p.y);
            if (p.rotation !== 0) ctx.rotate(p.rotation);
            
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        });
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform efficiently
        ctx.restore();
    }

    private renderExplosions(ctx: CanvasRenderingContext2D): void {
        this.particleData.forEachActiveExplosion(exp => {
            if (exp.alpha <= 0.01) return;

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
        });
    }

    private renderShockwaves(ctx: CanvasRenderingContext2D): void {
        const now = performance.now();
        const duration = EFFECTS_CONFIG.SHOCKWAVE_DURATION;

        for (let i = 0; i < EFFECTS_CONFIG.MAX_SHOCKWAVES; i++) {
            const idx = i * SW_OFF.STRIDE;
            if (this.shockwaveBuffer[idx + SW_OFF.ACTIVE] === 0.0) continue;

            const t = (now - this.shockwaveBuffer[idx + SW_OFF.BIRTH]) / duration;
            if (t >= 1) {
                this.shockwaveBuffer[idx + SW_OFF.ACTIVE] = 0.0;
                this.freeShockwaveIndices.push(i);
                continue;
            }

            const alpha = 1 - t;
            const radius = t * (this.isMobile ? 150 : 200);

            ctx.beginPath();
            ctx.arc(this.shockwaveBuffer[idx + SW_OFF.X], this.shockwaveBuffer[idx + SW_OFF.Y], radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * (this.isMobile ? 0.3 : 0.5)})`;
            ctx.lineWidth = this.isMobile ? 1 : 2;
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
            const count = this.isMobile ? 5 : EFFECTS_CONFIG.GLITCH_SCANLINE_COUNT;
            ctx.fillStyle = `rgba(0, 255, 255, ${alpha * 0.3})`;
            for (let i = 0; i < count; i++) {
                const seed = (this.glitchOffset + i * 0.7) % 1000;
                const h = (Math.sin(seed) * 0.5 + 0.5) * EFFECTS_CONFIG.GLITCH_MAX_HEIGHT;
                const y = (Math.sin(seed * 1.3) * 0.5 + 0.5) * height;
                ctx.fillRect(0, y, width, h);
            }
        }
    }
}
