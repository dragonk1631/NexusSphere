import type { ThemeConfig } from '../ThemeManager';
import { PatternRegistry, type PatternContext } from './PatternRegistry';

// Import patterns
import { StarsPattern } from './patterns/StarsPattern';
import { BubblesPattern } from './patterns/BubblesPattern';
import { EmbersPattern } from './patterns/EmbersPattern';
import { MatrixPattern } from './patterns/MatrixPattern';
import { Grid3DPattern } from './patterns/Grid3DPattern';
import { FloatingPattern } from './patterns/FloatingPattern';
import { FireworksPattern } from './patterns/FireworksPattern';
import { SnowPattern } from './patterns/SnowPattern';
import { SunsetPattern } from './patterns/SunsetPattern';
import { BokehPattern } from './patterns/BokehPattern';
import { WavesPattern } from './patterns/WavesPattern';
import { ScanlinesPattern } from './patterns/ScanlinesPattern';
import { HexagonsPattern } from './patterns/HexagonsPattern';

// Register patterns
PatternRegistry.register(new StarsPattern());
PatternRegistry.register(new BubblesPattern());
PatternRegistry.register(new EmbersPattern());
PatternRegistry.register(new MatrixPattern());
PatternRegistry.register(new Grid3DPattern());
PatternRegistry.register(new FloatingPattern());
PatternRegistry.register(new FireworksPattern());
PatternRegistry.register(new SnowPattern());
PatternRegistry.register(new SunsetPattern());
PatternRegistry.register(new BokehPattern());
PatternRegistry.register(new WavesPattern());
PatternRegistry.register(new ScanlinesPattern());
PatternRegistry.register(new HexagonsPattern());

// --- Worker State ---
let canvas: OffscreenCanvas;
let ctx: OffscreenCanvasRenderingContext2D;
let width = 800;
let height = 600;
let currentTheme: ThemeConfig | null = null;
let time = 0;
let bgImageBitmap: ImageBitmap | null = null;
let isMobile = false;
let dynamicMaxParticles = 2500;

// --- Performance Optimization Cache ---
let cachedBgGrad: CanvasGradient | null = null;
let cachedBgColors: string = '';

const alphaHexSlice = new Array(256);
for (let i = 0; i < 256; i++) {
    alphaHexSlice[i] = i.toString(16).padStart(2, '0');
}

let themeAlphaCache = {
    particle: new Array(256),
    grid: new Array(256),
    color1: new Array(256)
};

function rebuildAlphaCache() {
    if (!currentTheme) return;
    const p = currentTheme.particleColor.slice(0, 7);
    const g = currentTheme.gridColor.slice(0, 7);
    const c1 = currentTheme.color1.slice(0, 7);
    for (let i = 0; i < 256; i++) {
        const hex = alphaHexSlice[i];
        themeAlphaCache.particle[i] = p + hex;
        themeAlphaCache.grid[i] = g + hex;
        themeAlphaCache.color1[i] = c1 + hex;
    }
}

function invalidateAllCaches(full: boolean = false) {
    cachedBgGrad = null;
    cachedBgColors = '';
    if (full) {
        textureCache.clear();
        rebuildAlphaCache();
    }
}

// --- TypedArray Particle Pool ---
const MAX_PARTICLES = 2500;
const px = new Float32Array(MAX_PARTICLES);
const py = new Float32Array(MAX_PARTICLES);
const pz = new Float32Array(MAX_PARTICLES);
const vx = new Float32Array(MAX_PARTICLES);
const vy = new Float32Array(MAX_PARTICLES);
const size = new Float32Array(MAX_PARTICLES);
const life = new Float32Array(MAX_PARTICLES);
const phase = new Float32Array(MAX_PARTICLES);
const layer = new Float32Array(MAX_PARTICLES);
const custom1 = new Float32Array(MAX_PARTICLES); 
const custom2 = new Float32Array(MAX_PARTICLES);
const pulseSpeed = new Float32Array(MAX_PARTICLES);
const pulseMag = new Float32Array(MAX_PARTICLES);

let aliveCount = 0;

/**
 * Robust spawn with recycling.
 * Scans for particles with life <= 0 or custom1 === -1 (inactive flag used by some patterns)
 */
function spawn(): number {
    // 1. Try to find a dead particle in the already "allocated" pool
    for (let i = 0; i < aliveCount; i++) {
        if (life[i] <= 0) {
            // Reset ALL state for the new user to prevent state leaks from previous patterns
            life[i] = 1.0;
            custom1[i] = 0;
            custom2[i] = 0;
            vx[i] = 0;
            vy[i] = 0;
            phase[i] = 0;
            pulseSpeed[i] = 0;
            return i;
        }
    }
    // 2. Expand pool if below limit
    if (aliveCount < dynamicMaxParticles) {
        const id = aliveCount++;
        life[id] = 1.0;
        custom1[id] = 0;
        custom2[id] = 0;
        return id;
    }
    return -1;
}

function clearParticles() {
    aliveCount = 0;
    life.fill(0);
    custom1.fill(-1); // Mark as inactive for patterns that use it
}

const textureCache = new Map<string, OffscreenCanvas>();

function getCachedTexture(id: string, s: number, drawFn: (c: OffscreenCanvasRenderingContext2D) => void): OffscreenCanvas {
    const key = `${currentTheme?.id}_${id}_${s}`;
    if (textureCache.has(key)) return textureCache.get(key)!;
    const c = new OffscreenCanvas(s, s);
    const context = c.getContext('2d')!;
    drawFn(context);
    textureCache.set(key, c);
    return c;
}

function applyAlpha(color: string, alpha: string): string {
    if (!color) return 'transparent';
    if (color.length === 7) return color + alpha;
    return color.slice(0, 7) + alpha;
}

function setCompositeOperation(op: string) {
    if (!ctx) return;
    if (isMobile && (op === 'lighter' || op === 'screen')) {
        ctx.globalCompositeOperation = 'source-over';
    } else {
        ctx.globalCompositeOperation = op as GlobalCompositeOperation;
    }
}

function getPatternContext(): PatternContext {
    return {
        ctx, width, height, time, isMobile, theme: currentTheme!,
        aliveCount, spawn, kill: (id: number) => { life[id] = 0; custom1[id] = -1; },
        buffers: { px, py, pz, vx, vy, size, life, phase, layer, custom1, custom2, pulseSpeed, pulseMag },
        getCachedTexture, applyAlpha, setCompositeOperation
    };
}

function initPattern(patternId: string) {
    clearParticles();
    const pattern = PatternRegistry.get(patternId);
    if (pattern) {
        pattern.init(getPatternContext());
    }
}

function render() {
    if (!ctx || !currentTheme) return;

    // 1. Clear & Background
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1.0;

    if (bgImageBitmap) {
        // Draw the image as the main background, completely opaque.
        ctx.drawImage(bgImageBitmap, 0, 0, width, height);
    } else {
        // Fallback to gradient if no image
        const bgKey = currentTheme.color1 + currentTheme.color2;
        if (cachedBgColors !== bgKey) {
            cachedBgColors = bgKey;
            cachedBgGrad = ctx.createLinearGradient(0, 0, 0, height);
            cachedBgGrad.addColorStop(0, currentTheme.color1);
            cachedBgGrad.addColorStop(1, currentTheme.color2);
        }
        ctx.fillStyle = cachedBgGrad!;
        ctx.fillRect(0, 0, width, height);
    }

    // 2. Pattern Draw
    const pattern = PatternRegistry.get(currentTheme.pattern);
    if (pattern) {
        pattern.draw(getPatternContext());
    }

    // 3. Performance Feedback
    if (Math.floor(time) % 60 === 0 && Math.random() < 0.02) {
        // @ts-ignore
        self.postMessage({ type: 'PERF', alive: aliveCount });
    }
}

let startTime = 0;

self.onmessage = (e) => {
    const data = e.data;
    if (Array.isArray(data)) {
        if (data[0] === 0) { // DRAW_FRAME
            // data[1] is the timestamp in ms
            if (startTime === 0) startTime = data[1];
            time = (data[1] - startTime) * 0.001;
            render();
        }
        return;
    }

    switch (data.type) {
        case 'INIT':
            canvas = data.canvas;
            ctx = canvas.getContext('2d')!;
            width = data.width;
            height = data.height;
            isMobile = data.isMobile;
            dynamicMaxParticles = isMobile ? 1200 : 2500;
            break;
        case 'RESIZE':
            width = data.width;
            height = data.height;
            if (canvas) { canvas.width = width; canvas.height = height; }
            invalidateAllCaches();
            if (currentTheme) initPattern(currentTheme.pattern);
            break;
        case 'SET_THEME':
            currentTheme = data.theme;
            invalidateAllCaches(true);
            if (currentTheme) initPattern(currentTheme.pattern);
            break;
        case 'SET_BG_IMAGE':
            bgImageBitmap = data.bitmap;
            break;
    }
};

