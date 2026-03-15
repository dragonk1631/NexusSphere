import { type IParticleRenderData } from '../types/GameTypes';
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

    // Zero-GC Explosions
    private readonly MAX_E = 20;
    private ex = new Float32Array(20);
    private ey = new Float32Array(20);
    private er = new Float32Array(20); // Radius
    private ea = new Float32Array(20); // Alpha
    private ecIdx = new Int32Array(20); // Color index
    private activeECount: number = 0;

    constructor() {}

    public setMobile(isMobile: boolean): void {
        this.isMobile = isMobile;
    }

    /**
     * PROFESSIONAL OPTIMIZATION: Zero-allocation iteration.
     */
    public forEachActiveParticle(callback: (p: { x: number, y: number, alpha: number, size: number, color: string, rotation: number }) => void): void {
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

    public forEachActiveExplosion(callback: (e: { x: number, y: number, radius: number, alpha: number, color: string }) => void): void {
        const eProxy = { x: 0, y: 0, radius: 0, alpha: 0, color: '' };
        for (let i = 0; i < this.activeECount; i++) {
            eProxy.x = this.ex[i];
            eProxy.y = this.ey[i];
            eProxy.radius = this.er[i];
            eProxy.alpha = this.ea[i];
            eProxy.color = this.colorPalette[this.ecIdx[i]];
            callback(eProxy);
        }
    }

    public update(delta: number): void {
        const speedMultiplier = delta / 16.67;
        const fadeRate = this.isMobile ? 0.06 : 0.03;

        // 1. Update Particles
        for (let i = this.activeCount - 1; i >= 0; i--) {
            this.px[i] += this.pvx[i] * speedMultiplier;
            this.py[i] += this.pvy[i] * speedMultiplier;
            this.pvy[i] += (this.isMobile ? 0.25 : 0.2) * speedMultiplier; 
            this.palpha[i] -= fadeRate * speedMultiplier;
            this.prot[i] += this.protSpeed[i] * speedMultiplier;

            if (this.palpha[i] <= 0) {
                this.removeParticle(i);
            }
        }

        // 2. Update Explosions (Zero-GC)
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

    private getOrCreateColorIndex(color: string): number {
        let idx = this.colorPalette.indexOf(color);
        if (idx === -1) {
            idx = this.colorPalette.length;
            this.colorPalette.push(color);
        }
        return idx;
    }

    public triggerExplosion(x: number, y: number, color: string): void {
        const limit = this.isMobile ? 5 : this.MAX_E;
        if (this.activeECount >= limit) return;

        const idx = this.activeECount;
        this.ex[idx] = x;
        this.ey[idx] = y;
        this.er[idx] = 0;
        this.ea[idx] = 1.0;
        this.ecIdx[idx] = this.getOrCreateColorIndex(color);
        this.activeECount++;
    }

    public triggerShatter(x: number, y: number, color: string, isHold: boolean = false): void {
        let count = isHold ? 6 : 16; 
        if (this.isMobile) count = isHold ? 3 : 6; 

        const cIdx = this.getOrCreateColorIndex(color);

        for (let i = 0; i < count; i++) {
            if (this.activeCount >= (this.isMobile ? this.MAX_P / 2 : this.MAX_P)) break;

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
        this.activeECount = 0;
    }

    private updateExplosions(delta: number): void {
        const speedMultiplier = delta / 16.67;
        const radialSpeed = this.isMobile ? 10 : 6;
        const fadeSpeed = this.isMobile ? 0.15 : 0.08;

        for (let i = this.activeECount - 1; i >= 0; i--) {
            this.er[i] += radialSpeed * speedMultiplier;
            this.ea[i] -= fadeSpeed * speedMultiplier;

            if (this.ea[i] <= 0) {
                this.removeExplosion(i);
            }
        }
    }

    private removeExplosion(idx: number): void {
        this.activeECount--;
        if (idx < this.activeECount) {
            this.ex[idx] = this.ex[this.activeECount];
            this.ey[idx] = this.ey[this.activeECount];
            this.er[idx] = this.er[this.activeECount];
            this.ea[idx] = this.ea[this.activeECount];
            this.ecIdx[idx] = this.ecIdx[this.activeECount];
        }
    }
}
