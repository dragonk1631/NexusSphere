import { type ParticleData, type Explosion, type IParticleRenderData } from '../types/GameTypes';
import { MAX_PARTICLES } from '../constants/GameConstants';

/**
 * ParticleSystem manages visual feedback for hits and misses.
 * It includes explosions and shatter effects.
 */
export class ParticleSystem implements IParticleRenderData {
    private explosions: Explosion[] = [];
    private isMobile: boolean = false;

    // PROFESSIONAL OPTIMIZATION: Object Pooling with Index Stack
    private particlePool: ParticleData[] = [];
    private freeIndices: number[] = [];
    private activeIndices: Set<number> = new Set();
    private readonly POOL_SIZE = MAX_PARTICLES;

    constructor() {
        // Pre-allocate pool
        for (let i = 0; i < this.POOL_SIZE; i++) {
            this.particlePool.push({
                x: 0, y: 0, vx: 0, vy: 0, alpha: 0, size: 0, color: '', rotation: 0, rotationSpeed: 0
            });
            this.freeIndices.push(i);
        }
    }

    public setMobile(isMobile: boolean): void {
        this.isMobile = isMobile;
        console.log(`[ParticleSystem] Mobile optimization: ${isMobile ? 'ON' : 'OFF'}`);
    }

    public getParticles(): ReadonlyArray<ParticleData> {
        // Return only active particles efficiently
        const active: ParticleData[] = [];
        this.activeIndices.forEach(idx => active.push(this.particlePool[idx]));
        return active;
    }

    public getExplosions(): ReadonlyArray<Explosion> { return this.explosions; }

    public update(delta: number): void {
        this.updateParticles(delta);
        this.updateExplosions(delta);
    }

    public triggerExplosion(x: number, y: number, color: string): void {
        // Limit explosions strictly on mobile
        const limit = 6;
        if (this.explosions.length >= limit) return;
        this.explosions.push({ x, y, radius: 0, alpha: 1, color });
    }

    public triggerShatter(x: number, y: number, color: string, isHold: boolean = false): void {
        const maxParticles = MAX_PARTICLES;
        if (this.activeIndices.size >= maxParticles) return;

        let count = isHold ? 4 : 12;

        for (let i = 0; i < count; i++) {
            const idx = this.freeIndices.pop();
            if (idx === undefined) break;

            const p = this.particlePool[idx];
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

            this.activeIndices.add(idx);
        }
    }

    public clear(): void {
        this.activeIndices.forEach(idx => {
            this.particlePool[idx].alpha = 0;
            this.freeIndices.push(idx);
        });
        this.activeIndices.clear();
        this.explosions = [];
    }

    private updateParticles(delta: number): void {
        const speedMultiplier = delta / 16.67;
        const fadeRate = 0.03;

        this.activeIndices.forEach(idx => {
            const p = this.particlePool[idx];
            p.x += p.vx * speedMultiplier;
            p.y += p.vy * speedMultiplier;
            p.vy += 0.2 * speedMultiplier;
            p.alpha -= fadeRate * speedMultiplier;
            p.rotation += p.rotationSpeed * speedMultiplier;

            if (p.alpha <= 0) {
                this.activeIndices.delete(idx);
                this.freeIndices.push(idx);
            }
        });
    }

    private updateExplosions(delta: number): void {
        const speedMultiplier = delta / 16.67;
        const radialSpeed = 6;
        const fadeSpeed = 0.08;

        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const exp = this.explosions[i];
            exp.radius += radialSpeed * speedMultiplier;
            exp.alpha -= fadeSpeed * speedMultiplier;

            if (exp.alpha <= 0) {
                this.explosions.splice(i, 1);
            }
        }
    }
}
