import { type ParticleData, type Explosion, type IParticleRenderData } from '../types/GameTypes';
import { MAX_PARTICLES } from '../constants/GameConstants';

/**
 * ParticleSystem manages visual feedback for hits and misses.
 * It includes explosions and shatter effects.
 */
export class ParticleSystem implements IParticleRenderData {
    private particles: ParticleData[] = [];
    private explosions: Explosion[] = [];

    // PROFESSIONAL OPTIMIZATION: Object Pooling
    // Instead of creating/destroying objects, we reuse them to avoid Garbage Collection (GC) spikes.
    private particlePool: ParticleData[] = [];
    private readonly POOL_SIZE = MAX_PARTICLES;

    constructor() {
        // Pre-allocate pool
        for (let i = 0; i < this.POOL_SIZE; i++) {
            this.particlePool.push({
                x: 0, y: 0, vx: 0, vy: 0, alpha: 0, size: 0, color: '', rotation: 0, rotationSpeed: 0
            });
        }
    }

    public getParticles(): ReadonlyArray<ParticleData> {
        // Only return active particles
        return this.particles;
    }

    public getExplosions(): ReadonlyArray<Explosion> { return this.explosions; }

    public update(delta: number): void {
        this.updateParticles(delta);
        this.updateExplosions(delta);
    }

    public triggerExplosion(x: number, y: number, color: string): void {
        // Limit explosions to avoid performance drops
        if (this.explosions.length > 5) return;
        this.explosions.push({ x, y, radius: 0, alpha: 1, color });
    }

    public triggerShatter(x: number, y: number, color: string, isHold: boolean = false): void {
        // LAG GATING: If too many particles already exist, skip new ones
        if (this.particles.length > MAX_PARTICLES * 0.8) return;

        const count = isHold ? 4 : 12; // Reduced for baseline mobile stability
        for (let i = 0; i < count; i++) {
            // Pick from pool
            const p = this.particlePool.find(item => item.alpha <= 0);
            if (!p) break;

            const angle = Math.random() * Math.PI * 2;
            const speed = (isHold ? 2 : 4) + Math.random() * 6;

            p.x = x;
            p.y = y;
            p.vx = Math.cos(angle) * speed;
            p.vy = Math.sin(angle) * speed - 3;
            p.alpha = 1;
            p.size = (isHold ? 1.5 : 2.5) + Math.random() * 4;
            p.color = color;
            p.rotation = Math.random() * Math.PI * 2;
            p.rotationSpeed = (Math.random() - 0.5) * 0.3;

            if (!this.particles.includes(p)) {
                this.particles.push(p);
            }
        }
    }

    public clear(): void {
        this.particles.forEach(p => p.alpha = 0);
        this.particles = [];
        this.explosions = [];
    }

    private updateParticles(delta: number): void {
        const speedMultiplier = delta / 16.67;
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * speedMultiplier;
            p.y += p.vy * speedMultiplier;
            p.vy += 0.2 * speedMultiplier; // Gravity
            p.alpha -= 0.03 * speedMultiplier; // Faster fade for mobile
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
            exp.radius += 6 * speedMultiplier;
            exp.alpha -= 0.08 * speedMultiplier;

            if (exp.alpha <= 0) {
                this.explosions.splice(i, 1);
            }
        }
    }
}
