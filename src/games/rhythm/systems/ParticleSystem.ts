import { type ParticleData, type Explosion, type IParticleRenderData } from '../types/GameTypes';
import { MAX_PARTICLES } from '../constants/GameConstants';

/**
 * ParticleSystem manages visual feedback for hits and misses.
 * It includes explosions and shatter effects.
 */
export class ParticleSystem implements IParticleRenderData {
    private particles: ParticleData[] = [];
    private explosions: Explosion[] = [];

    public getParticles(): ReadonlyArray<ParticleData> { return this.particles; }
    public getExplosions(): ReadonlyArray<Explosion> { return this.explosions; }

    /**
     * Updates all particles and explosions.
     * @param delta Delta time in milliseconds.
     */
    public update(delta: number): void {
        this.updateParticles(delta);
        this.updateExplosions(delta);
    }


    public triggerExplosion(x: number, y: number, color: string): void {
        this.explosions.push({ x, y, radius: 0, alpha: 1, color });
    }

    public triggerShatter(x: number, y: number, color: string, isHold: boolean = false): void {
        const count = isHold ? 8 : 24; // Doubled count for impact
        for (let i = 0; i < count; i++) {
            if (this.particles.length >= MAX_PARTICLES) break;
            const angle = Math.random() * Math.PI * 2;
            // Higher initial speed, with strong upward bias (jump out effect)
            const speed = (isHold ? 3 : 5) + Math.random() * 8;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed - 4; // Substantial upward burst
            this.particles.push({
                x, y,
                vx, vy,
                alpha: 1,
                size: (isHold ? 1.5 : 2.5) + Math.random() * 5,
                color,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.4
            });
        }
    }

    public clear(): void {
        this.particles = [];
        this.explosions = [];
    }

    private updateParticles(delta: number): void {
        const speedMultiplier = delta / 16.67;
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * speedMultiplier;
            p.y += p.vy * speedMultiplier;
            p.vy += 0.15 * speedMultiplier; // Gravity
            p.alpha -= 0.02 * speedMultiplier;
            p.rotation += p.rotationSpeed * speedMultiplier;

            if (p.alpha <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    private updateExplosions(delta: number): void {
        const speedMultiplier = delta / 16.67;
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const exp = this.explosions[i];
            exp.radius += 5.5 * speedMultiplier; // Snappier expansion
            exp.alpha -= 0.05 * speedMultiplier; // Quicker fade for "pop" effect

            if (exp.alpha <= 0) {
                this.explosions.splice(i, 1);
            }
        }
    }

}
