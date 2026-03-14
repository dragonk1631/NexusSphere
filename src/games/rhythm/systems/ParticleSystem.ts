import { type Explosion, type IParticleRenderData } from '../types/GameTypes';
import { MAX_PARTICLES } from '../constants/GameConstants';

/**
 * ParticleSystem manages visual feedback for hits and misses.
 * It includes explosions and shatter effects.
 */
export class ParticleSystem implements IParticleRenderData {
    private isMobile: boolean = false;

    // PROFESSIONAL OPTIMIZATION: Pure TypedArray Architecture (Zero-GC)
    private readonly MAX_P = MAX_PARTICLES;
    private px = new Float32Array(MAX_PARTICLES);
    private py = new Float32Array(MAX_PARTICLES);
    private pvx = new Float32Array(MAX_PARTICLES);
    private pvy = new Float32Array(MAX_PARTICLES);
    private palpha = new Float32Array(MAX_PARTICLES);
    private psize = new Float32Array(MAX_PARTICLES);
    private prot = new Float32Array(MAX_PARTICLES);
    private protSpeed = new Float32Array(MAX_PARTICLES);
    private pcolorIdx = new Int32Array(MAX_PARTICLES); // Reference to a color palette
    
    private colorPalette: string[] = [];
    private activeCount: number = 0;

    private explosions: Explosion[] = [];

    constructor() {}

    public setMobile(isMobile: boolean): void {
        this.isMobile = isMobile;
    }

    /**
     * PROFESSIONAL OPTIMIZATION: Zero-allocation iteration.
     */
    public forEachActiveParticle(callback: (p: any) => void): void {
        // We use a temporary object but reuse it to avoid GC
        const pProxy = { x: 0, y: 0, alpha: 0, size: 0, color: '', rotation: 0 };
        for (let i = 0; i < this.activeCount; i++) {
            pProxy.x = this.px[i];
            pProxy.y = this.py[i];
            pProxy.alpha = this.palpha[i];
            pProxy.size = this.psize[i];
            pProxy.color = this.colorPalette[this.pcolorIdx[i]];
            pProxy.rotation = this.prot[i];
            callback(pProxy);
        }
    }

    public getParticles(): any[] {
        const particles: any[] = [];
        for (let i = 0; i < this.activeCount; i++) {
            particles.push({
                x: this.px[i],
                y: this.py[i],
                alpha: this.palpha[i],
                size: this.psize[i],
                color: this.colorPalette[this.pcolorIdx[i]],
                rotation: this.prot[i]
            });
        }
        return particles;
    }

    public getExplosions(): ReadonlyArray<Explosion> { return this.explosions; }

    public update(delta: number): void {
        const speedMultiplier = delta / 16.67;
        const fadeRate = this.isMobile ? 0.06 : 0.03;

        for (let i = this.activeCount - 1; i >= 0; i--) {
            this.px[i] += this.pvx[i] * speedMultiplier;
            this.py[i] += this.pvy[i] * speedMultiplier;
            this.pvy[i] += (this.isMobile ? 0.25 : 0.2) * speedMultiplier; // Slightly faster gravity on mobile
            this.palpha[i] -= fadeRate * speedMultiplier;
            this.prot[i] += this.protSpeed[i] * speedMultiplier;

            if (this.palpha[i] <= 0) {
                this.removeParticle(i);
            }
        }

        this.updateExplosions(delta);
    }

    private removeParticle(idx: number): void {
        this.activeCount--;
        if (idx < this.activeCount) {
            this.px[idx] = this.px[this.activeCount];
            this.py[idx] = this.py[this.activeCount];
            this.pvx[idx] = this.pvx[this.activeCount];
            this.pvy[idx] = this.pvy[this.activeCount];
            this.palpha[idx] = this.palpha[this.activeCount];
            this.psize[idx] = this.psize[this.activeCount];
            this.prot[idx] = this.prot[this.activeCount];
            this.protSpeed[idx] = this.protSpeed[this.activeCount];
            this.pcolorIdx[idx] = this.pcolorIdx[this.activeCount];
        }
    }

    public triggerExplosion(x: number, y: number, color: string): void {
        const limit = this.isMobile ? 2 : 8; // Drastically reduced for mobile
        if (this.explosions.length >= limit) return;
        this.explosions.push({ x, y, radius: 0, alpha: 1, color });
    }

    public triggerShatter(x: number, y: number, color: string, isHold: boolean = false): void {
        let count = isHold ? 6 : 16; 
        if (this.isMobile) count = isHold ? 3 : 6; // Optimized counts

        // Map color to palette to avoid string storage per particle
        let cIdx = this.colorPalette.indexOf(color);
        if (cIdx === -1) {
            cIdx = this.colorPalette.length;
            this.colorPalette.push(color);
        }

        for (let i = 0; i < count; i++) {
            if (this.activeCount >= (this.isMobile ? this.MAX_P / 2 : this.MAX_P)) break; // Respect mobile limit

            const idx = this.activeCount;
            const angle = Math.random() * Math.PI * 2;
            const speed = (isHold ? 2 : 5) + Math.random() * 8;

            this.px[idx] = x;
            this.py[idx] = y;
            this.pvx[idx] = Math.cos(angle) * speed;
            this.pvy[idx] = Math.sin(angle) * speed - 4;
            this.palpha[idx] = 1.0;
            this.psize[idx] = (isHold ? 2 : 3) + Math.random() * 5;
            this.pcolorIdx[idx] = cIdx;
            this.prot[idx] = Math.random() * Math.PI * 2;
            this.protSpeed[idx] = (Math.random() - 0.5) * 0.4;

            this.activeCount++;
        }
    }

    public clear(): void {
        this.activeCount = 0;
        this.explosions = [];
    }

    private updateExplosions(delta: number): void {
        const speedMultiplier = delta / 16.67;
        const radialSpeed = this.isMobile ? 10 : 6; // Faster on mobile
        const fadeSpeed = this.isMobile ? 0.15 : 0.08;

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
