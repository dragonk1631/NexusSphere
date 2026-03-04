import { type IParticleRenderData, type ITransitionRenderData } from '../types/GameTypes';

/**
 * EffectsRenderer handles the drawing of particles, explosions,
 * and screen transition overlays.
 */
export class EffectsRenderer {
    private particleData: IParticleRenderData;
    private transitionData: ITransitionRenderData;

    constructor(
        particleData: IParticleRenderData,
        transitionData: ITransitionRenderData
    ) {
        this.particleData = particleData;
        this.transitionData = transitionData;
    }

    /**
     * Renders all visual effects (particles and transitions).
     */
    public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
        this.renderParticles(ctx);
        this.renderExplosions(ctx);
        this.renderTransition(ctx, width, height);
    }

    private renderParticles(ctx: CanvasRenderingContext2D): void {
        const particles = this.particleData.getParticles();
        for (const p of particles) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.shadowBlur = 10;
            ctx.shadowColor = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            ctx.restore();
        }
    }

    private renderExplosions(ctx: CanvasRenderingContext2D): void {
        const explosions = this.particleData.getExplosions();
        for (const exp of explosions) {
            ctx.beginPath();
            ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
            ctx.strokeStyle = exp.color;
            ctx.lineWidth = 4 * exp.alpha;
            ctx.globalAlpha = exp.alpha;
            ctx.stroke();

            // Inner fill
            ctx.beginPath();
            ctx.arc(exp.x, exp.y, exp.radius * 0.7, 0, Math.PI * 2);
            ctx.fillStyle = exp.color;
            ctx.globalAlpha = exp.alpha * 0.3;
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    private renderTransition(ctx: CanvasRenderingContext2D, width: number, height: number): void {
        if (!this.transitionData.isActive()) return;

        const alpha = this.transitionData.getAlpha();
        const style = this.transitionData.getStyle();

        ctx.save();
        if (style === 'glitch') {
            this.renderGlitch(ctx, width, height, alpha);
        } else {
            ctx.fillStyle = `rgba(10, 0, 20, ${alpha})`;
            ctx.fillRect(0, 0, width, height);
        }
        ctx.restore();
    }

    private renderGlitch(ctx: CanvasRenderingContext2D, width: number, height: number, alpha: number): void {
        ctx.fillStyle = `rgba(30, 0, 50, ${alpha * 0.8})`;
        ctx.fillRect(0, 0, width, height);

        if (alpha > 0.2) {
            ctx.fillStyle = `rgba(0, 255, 255, ${alpha * 0.3})`;
            for (let i = 0; i < 10; i++) {
                const h = Math.random() * 20;
                const y = Math.random() * height;
                ctx.fillRect(0, y, width, h);
            }
        }
    }
}
