import type { ThemeConfig } from '../ThemeManager';

// --- Worker State ---
let canvas: OffscreenCanvas;
let ctx: OffscreenCanvasRenderingContext2D;
let width = 800;
let height = 600;
let pixelRatio = 1;
let currentTheme: ThemeConfig | null = null;
let isRunning = false;
// let rafId: number = 0; // Passive renderer
let time = 0;
let bgImageBitmap: ImageBitmap | null = null;
// let lastDrawTime = 0; // Managed by main loop
// const TARGET_INTERVAL = 1000 / 60; // Managed by main loop
let isMobile = false;
let dynamicMaxParticles = 2500;

// --- Cached gradient for background (avoid per-frame allocation) ---
let cachedBgGrad: CanvasGradient | null = null;
let cachedBgColors: string = '';

// --- High-Performance Color Cache (Pre-computed strings) ---
const colorCache = {
    particle: '',
    particleAlpha50: '',
    particleAlpha20: '',
    grid: '',
    gridAlpha50: '',
    gridAlpha20: '',
    color1Alpha: (a: string) => applyAlpha(currentTheme?.color1 || '#000', a), // fallback
};

// --- Alpha-Lookup Cache (Zero-string-allocations) ---
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

// --- Cached wave gradients for drawWaves (rebuilt on resize/theme change) ---
let cachedWaveGrads: (CanvasGradient | null)[] = [];
let cachedWaveGridColor: string = '';
let cachedWaveHeight: number = 0;

// --- Cached scanlines gradients (rebuilt on resize/theme change) ---
let cachedScanlinesCoreGrad: CanvasGradient | null = null;
let cachedScanlinesMountainGrads: (CanvasGradient | null)[] = [];
let cachedScanlinesShimmerGrad: CanvasGradient | null = null;
let cachedScanlinesKey: string = '';

// --- Cached grid3d glow gradient ---
let cachedGrid3DBloomGrad: CanvasGradient | null = null;
let cachedGrid3DKey: string = '';

function invalidateAllCaches(full: boolean = false) {
    cachedBgGrad = null;
    cachedBgColors = '';
    cachedWaveGrads = [];
    cachedWaveGridColor = '';
    cachedWaveHeight = 0;
    cachedScanlinesCoreGrad = null;
    cachedScanlinesMountainGrads = [];
    cachedScanlinesShimmerGrad = null;
    cachedScanlinesKey = '';
    cachedGrid3DBloomGrad = null;
    cachedGrid3DKey = '';
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
const custom2 = new Float32Array(MAX_PARTICLES); // For star color indexing
const pulseSpeed = new Float32Array(MAX_PARTICLES);
const pulseMag = new Float32Array(MAX_PARTICLES);
const hx1 = new Float32Array(MAX_PARTICLES);
const hy1 = new Float32Array(MAX_PARTICLES);
const hx2 = new Float32Array(MAX_PARTICLES);
const hy2 = new Float32Array(MAX_PARTICLES);
const hx3 = new Float32Array(MAX_PARTICLES);
const hy3 = new Float32Array(MAX_PARTICLES);
const hx4 = new Float32Array(MAX_PARTICLES);
const hy4 = new Float32Array(MAX_PARTICLES);

let aliveCount = 0;

function spawn(): number {
    if (aliveCount >= dynamicMaxParticles) return -1;
    const id = aliveCount;
    aliveCount++;
    return id;
}

// @ts-ignore
function kill(id: number) {
    if (aliveCount <= 0 || id >= aliveCount) return;
    aliveCount--;
    if (id !== aliveCount) {
        px[id] = px[aliveCount];
        py[id] = py[aliveCount];
        pz[id] = pz[aliveCount];
        vx[id] = vx[aliveCount];
        vy[id] = vy[aliveCount];
        size[id] = size[aliveCount];
        life[id] = life[aliveCount];
        phase[id] = phase[aliveCount];
        layer[id] = layer[aliveCount];
        custom1[id] = custom1[aliveCount];
        custom2[id] = custom2[aliveCount];
        pulseSpeed[id] = pulseSpeed[aliveCount];
        pulseMag[id] = pulseMag[aliveCount];
        hx1[id] = hx1[aliveCount];
        hy1[id] = hy1[aliveCount];
        hx2[id] = hx2[aliveCount];
        hy2[id] = hy2[aliveCount];
        hx3[id] = hx3[aliveCount];
        hy3[id] = hy3[aliveCount];
        hx4[id] = hx4[aliveCount];
        hy4[id] = hy4[aliveCount];
    }
}

function clearParticles() {
    aliveCount = 0;
}

// --- Sprite Caching ---
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
    if (color.startsWith('rgba')) {
        const alphaFloat = (parseInt(alpha, 16) / 255).toFixed(2);
        return color.replace(/[\d.]+\)$/, `${alphaFloat})`);
    }
    if (color.startsWith('rgb')) {
        const alphaFloat = (parseInt(alpha, 16) / 255).toFixed(2);
        return color.replace('rgb', 'rgba').replace(')', `, ${alphaFloat})`);
    }
    // Optimization: Fallback to hex append if possible
    if (color.length === 7) return color + alpha;
    return color.slice(0, 7) + alpha;
}

function setCompositeOperation(op: string) {
    if (!ctx) return;
    // Mobile optimization: Skip expensive blending modes
    if (isMobile && (op === 'lighter' || op === 'screen')) {
        ctx.globalCompositeOperation = 'source-over';
    } else {
        ctx.globalCompositeOperation = op as GlobalCompositeOperation;
    }
}

// --- Pattern Logic ---
function initPattern(pattern: string) {
    clearParticles();

    switch (pattern) {
        case 'stars':
            const isDeepSpaceInit = currentTheme?.id === 'deep-space';
            // Scale density for more "epic" feel
            const globalDensity = isMobile ? 0.7 : 1.2;
            
            for (let l = 0; l < 4; l++) {
                const count = Math.floor(globalDensity * (isMobile ? (l === 0 ? 250 : 60) : (l === 0 ? 500 : 200 - l * 40)));
                for (let i = 0; i < count; i++) {
                    const id = spawn();
                    if (id === -1) break;
                    px[id] = Math.random() * width;
                    py[id] = Math.random() * height;
                    pz[id] = l + 1; // Parallax Layer
                    
                    if (isDeepSpaceInit) {
                        // Deep Space: Mixed sizing for realistic depth
                        // Layer 0 is the "infinite dust" background
                        size[id] = l === 0 ? 0.1 + Math.random() * 0.4 : (4 - l) * 0.9 + Math.random() * 2.0;
                        vy[id] = (0.1 / (l + 1)) + Math.random() * 0.04;
                        custom2[id] = Math.floor(Math.random() * 5); // 5 Cosmic Colors
                        phase[id] = Math.random() * Math.PI * 2;
                        layer[id] = l;
                        life[id] = 0.4 + Math.random() * 0.6;
                        
                        // Rare Shooting Star (0.5% chance)
                        if (Math.random() > 0.995) {
                            life[id] = -1.0; 
                            vx[id] = 6 + Math.random() * 6; // Slower, more graceful speed
                        }
                    } else {
                        size[id] = l === 0 ? Math.random() * 0.4 : (4 - l) * 0.7 + Math.random();
                        vy[id] = (0.15 / (l + 1)) + Math.random() * 0.04;
                        phase[id] = Math.random() * Math.PI * 2;
                        layer[id] = l;
                        life[id] = Math.random() * 0.5 + 0.5;
                    }
                }
            }
            break;
        case 'bubbles':
            for (let i = 0; i < 80; i++) {
                const id = spawn();
                if (id === -1) break;
                const l = Math.floor(Math.random() * 3);
                px[id] = Math.random() * width;
                py[id] = height + Math.random() * height;
                size[id] = (Math.random() * 30 + 5) * (1 - l * 0.2);
                vy[id] = -(Math.random() * 1.5 + 0.5) * (1 - l * 0.2);
                vx[id] = (Math.random() - 0.5) * 0.8;
                phase[id] = Math.random() * Math.PI * 2;
                layer[id] = l;
            }
            break;
        case 'embers':
            for (let i = 0; i < 200; i++) {
                const id = spawn();
                if (id === -1) break;
                const l = Math.floor(Math.random() * 3);
                px[id] = Math.random() * width;
                py[id] = height + Math.random() * height;
                size[id] = Math.random() * 3 + 1;
                vy[id] = -(Math.random() * 4 + 2) * (1 - l * 0.2);
                vx[id] = (Math.random() - 0.5) * 3;
                phase[id] = Math.random() * Math.PI * 2;
                layer[id] = l;
            }
            break;
        case 'bokeh':
            for (let i = 0; i < 120; i++) {
                const id = spawn();
                if (id === -1) break;
                const l = Math.floor(Math.random() * 3);
                px[id] = Math.random() * width;
                py[id] = Math.random() * height;
                size[id] = (Math.random() * 120 + 40) * (1 - l * 0.25);
                vx[id] = (Math.random() - 0.5) * 0.4;
                vy[id] = (Math.random() - 0.5) * 0.4;
                life[id] = Math.random() * 0.3 + 0.05; // alpha
                phase[id] = Math.random() * Math.PI * 2;
                layer[id] = l;
            }
            break;
        case 'floating':
            const isMarchenInit = currentTheme?.id === 'marchen';
            const pCount = isMarchenInit ? 270 : 100; // 1.5x increase for richer background (180 -> 270)
            for (let i = 0; i < pCount; i++) {
                const id = spawn();
                if (id === -1) break;
                
                if (isMarchenInit) {
                    // Visionary Initialization: Start all over the screen but as "Seeds"
                    life[id] = Math.random(); 
                    px[id] = Math.random() * width;
                    py[id] = Math.random() * height;
                    vx[id] = px[id]; // Origin X
                    vy[id] = py[id]; // Origin Y
                    custom1[id] = Math.random() * Math.PI * 2; // Phase Offset
                    custom2[id] = Math.floor(Math.random() * 5); // 5 Colors
                    phase[id] = Math.random() * Math.PI * 2; // Spiral Offset
                    size[id] = 0.5 + Math.random() * 1.5;
                    pulseSpeed[id] = 1.2 + Math.random() * 2.8;
                    pulseMag[id] = 0.15 + Math.random() * 0.35;
                    // Fix: Immediate visibility (no negative value)
                    life[id] = Math.random(); 
                    hx1[id] = hx2[id] = hx3[id] = hx4[id] = px[id];
                    hy1[id] = hy2[id] = hy3[id] = hy4[id] = py[id];
                } else {
                    const l = Math.floor(Math.random() * 3);
                    px[id] = Math.random() * width;
                    py[id] = Math.random() * height;
                    size[id] = (Math.random() * 35 + 15) * (1 - l * 0.22);
                    vx[id] = (Math.random() * 0.8 + 0.5) * (1 - l * 0.15);
                    vy[id] = (Math.random() - 0.5) * 0.5;
                    custom1[id] = (Math.random() - 0.5) * 0.03; 
                    phase[id] = Math.random() * Math.PI * 2;
                    layer[id] = l;
                }
            }
            break;
        case 'matrix':
            const cols = Math.floor(width / 22);
            for (let i = 0; i < cols; i++) {
                const id = spawn();
                if (id === -1) break;
                px[id] = i * 22;
                py[id] = Math.random() * height * 2 - height;
                vy[id] = Math.random() * 5 + 3;
                size[id] = Math.floor(Math.random() * 12 + 8);
                layer[id] = Math.floor(Math.random() * 3);
            }
            break;
        case 'grid3d':
            for (let i = 0; i < 40; i++) {
                const id = spawn();
                if (id === -1) break;
                px[id] = Math.random() * width;
                py[id] = Math.random() * height;
                pz[id] = Math.random() * 500 + 50;
                vy[id] = Math.random() * 3 + 1;
                size[id] = Math.random() * 2 + 1;
                layer[id] = Math.floor(Math.random() * 2);
            }
            break;
        case 'scanlines':
            for (let i = 0; i < 30; i++) {
                const id = spawn();
                if (id === -1) break;
                px[id] = Math.random() * width;
                py[id] = Math.random() * height * 0.5;
                vx[id] = Math.random() * 2 + 1;
                size[id] = Math.random() * 2 + 1;
                layer[id] = Math.floor(Math.random() * 3);
            }
            break;
        case 'snow':
            for (let i = 0; i < 150; i++) {
                const id = spawn();
                if (id === -1) break;
                const l = Math.floor(Math.random() * 3);
                px[id] = Math.random() * width;
                py[id] = Math.random() * height;
                size[id] = Math.random() * 3 + 1;
                vy[id] = (Math.random() * 1.5 + 0.5) * (1 - l * 0.2);
                vx[id] = (Math.random() - 0.5) * 0.5;
                phase[id] = Math.random() * Math.PI * 2;
                layer[id] = l;
            }
            break;
        case 'waves':
        case 'hexagons':
            // These don't use the particle array heavily, pure math/geometry and cached gradients
            break;
    }
}


function drawStars(theme: ThemeConfig) {
    const isDeepSpace = theme.id === 'deep-space';

    if (!bgImageBitmap && isDeepSpace) {
        // --- Fallback Nebula (only if no image) ---
        const staticBase = getCachedTexture('deep_space_master_base_v1', width, (c) => {
            for (let i = 0; i < 4000; i++) {
                c.fillStyle = `rgba(150, 180, 255, ${Math.random() * 0.05})`;
                c.fillRect(Math.random() * width, Math.random() * height, 1, 1);
            }
        });
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(staticBase, 0, 0);
    }

    // 3. Stars Palette
    const starColors = ['#FFFFFF', '#B2EBF2', '#FFF176', '#FF8A80', '#D1C4E9']; 
    const starSprites = starColors.map((col, idx) => 
        getCachedTexture(`star_v3_${idx}`, 32, (c) => {
            const grad = c.createRadialGradient(16, 16, 0, 16, 16, 16);
            grad.addColorStop(0, '#FFFFFF');
            grad.addColorStop(0.2, applyAlpha(col, '88'));
            grad.addColorStop(1, 'transparent');
            c.fillStyle = grad;
            c.fillRect(0, 0, 32, 32);
        })
    );

    const starCrossSprite = getCachedTexture('star_cross_premium', 128, (c) => {
        const cx = 64, cy = 64;
        const g = c.createRadialGradient(cx, cy, 0, cx, cy, 64);
        g.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        g.addColorStop(0.3, 'rgba(255, 255, 255, 0.15)');
        g.addColorStop(1, 'transparent');
        c.fillStyle = g; c.beginPath(); c.arc(cx, cy, 64, 0, Math.PI * 2); c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1.2;
        c.beginPath(); 
        c.moveTo(cx, 0); c.lineTo(cx, 128); 
        c.moveTo(0, cy); c.lineTo(128, cy); 
        // Diagonal spikes
        c.moveTo(cx-30, cy-30); c.lineTo(cx+30, cy+30);
        c.moveTo(cx+30, cy-30); c.lineTo(cx-30, cy+30);
        c.stroke();
    });

    const shootStarTex = getCachedTexture('shoot_star_v4_unified', 400, (c) => {
        const cx = 380, cy = 30; // Lead head position
        
        // --- 1. The Tail (Single Unified Tapered Shape) ---
        const trailGrad = c.createLinearGradient(0, cy, 400, cy);
        trailGrad.addColorStop(0, 'transparent');
        trailGrad.addColorStop(0.5, 'rgba(100, 150, 255, 0.2)'); // Distant tail
        trailGrad.addColorStop(0.8, 'rgba(200, 230, 255, 0.6)'); // Approaching head
        trailGrad.addColorStop(1, '#FFFFFF');
        
        c.fillStyle = trailGrad;
        c.beginPath();
        c.moveTo(0, cy); // Start from a point to avoid "two-line" base
        c.lineTo(cx, cy - 8);
        c.arc(cx, cy, 8, -Math.PI / 2, Math.PI / 2);
        c.lineTo(0, cy);
        c.fill();
        
        // --- 2. Central Hot Core (Unifies the look) ---
        const coreGrad = c.createLinearGradient(150, cy, 400, cy);
        coreGrad.addColorStop(0, 'transparent');
        coreGrad.addColorStop(1, 'rgba(255, 255, 255, 0.8)');
        c.strokeStyle = coreGrad;
        c.lineWidth = 2;
        c.lineCap = 'round';
        c.beginPath(); c.moveTo(150, cy); c.lineTo(cx, cy); c.stroke();

        // --- 3. Glowy Head ---
        const headGrad = c.createRadialGradient(cx, cy, 0, cx, cy, 15);
        headGrad.addColorStop(0, '#FFFFFF');
        headGrad.addColorStop(0.4, '#FFD54F'); // Golden spark
        headGrad.addColorStop(1, 'transparent');
        c.fillStyle = headGrad;
        c.beginPath(); c.arc(cx, cy, 15, 0, Math.PI * 2); c.fill();
    });

    const shootStarMist = getCachedTexture('shoot_star_mist_v2', 500, (c) => {
        const cx = 400, cy = 60;
        const grad = c.createRadialGradient(cx, cy, 0, cx, cy, 400);
        grad.addColorStop(0, 'rgba(120, 180, 255, 0.25)'); // Softer blue
        grad.addColorStop(0.6, 'rgba(60, 60, 180, 0.03)');
        grad.addColorStop(1, 'transparent');
        c.fillStyle = grad;
        c.beginPath(); 
        // Elongated mist trail
        c.ellipse(cx - 200, cy, 300, 60, 0, 0, Math.PI * 2); 
        c.fill();
    });

    setCompositeOperation('lighter');
    for (let i = 0; i < aliveCount; i++) {
        const isShooting = life[i] < 0;

        if (isShooting) {
            px[i] += vx[i];
            py[i] += vx[i] * 0.25;
            if (px[i] > width + 500) { px[i] = -500; py[i] = Math.random() * height; }
            
            ctx.save();
            ctx.translate(px[i], py[i]);
            const angle = Math.atan2(vx[i] * 0.25, vx[i]);
            ctx.rotate(angle);
            
            // 1. Surrounding Mist (Background)
            ctx.globalAlpha = 0.3;
            ctx.drawImage(shootStarMist, -500, -60, 500, 120);
            
            // 2. The Main Epic Body
            ctx.globalAlpha = 0.9;
            ctx.drawImage(shootStarTex, -400, -30, 400, 60);
            ctx.restore();
        } else {
            py[i] += vy[i] * (5 - pz[i]);
            if (py[i] > height) py[i] = -20;

            const shineSpeed = isDeepSpace ? 0.7 : 2.0; // Slower, natural breathing
            const blinkBase = Math.pow(Math.sin(time * shineSpeed + phase[i]), isDeepSpace ? 7 : 4);
            const twinkle = 0.6 + blinkBase * 0.4;
            
            ctx.globalAlpha = life[i] * twinkle; 
            const s = size[i] * twinkle;
            const colIdx = (custom2[i] || 0) % starSprites.length;
            
            if (isDeepSpace && pz[i] === 2 && size[i] > 3.5 && blinkBase > 0.92) {
                const cs = s * 6;
                ctx.drawImage(starCrossSprite, px[i] - cs, py[i] - cs, cs * 2, cs * 2);
            } else {
                ctx.drawImage(starSprites[colIdx], px[i] - s, py[i] - s, s * 2, s * 2);
            }
        }
    }
}


function drawGrid3D(theme: ThemeConfig) {
    const horizon = height * 0.45;
    const fov = 420;
    const speed = (time * 150) % 100;

    // 1. Horizon Glow
    const grid3DKey = theme.particleColor + height;
    if (cachedGrid3DKey !== grid3DKey) {
        cachedGrid3DKey = grid3DKey;
        const glowHeight = 40;
        cachedGrid3DBloomGrad = ctx.createLinearGradient(0, horizon - glowHeight, 0, horizon + glowHeight);
        cachedGrid3DBloomGrad.addColorStop(0, 'transparent');
        // Use pre-computed alpha hex for gradient stops (66 = 0.4 alpha approx)
        cachedGrid3DBloomGrad.addColorStop(0.5, theme.particleColor.slice(0, 7) + '66');
        cachedGrid3DBloomGrad.addColorStop(1, 'transparent');
    }

    setCompositeOperation('lighter');
    ctx.fillStyle = cachedGrid3DBloomGrad!;
    ctx.fillRect(0, horizon - 40, width, 80);

    // 2. Perspective Grid
    const gArr = themeAlphaCache.grid;
    ctx.strokeStyle = gArr[51]; // 20% alpha (0.2 * 255 = 51)
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let x = -width * 1; x <= width * 2; x += 180) {
        const startX = width / 2 + (x - width / 2) * 0.02;
        ctx.moveTo(startX, horizon);
        ctx.lineTo(x, height);
    }
    ctx.stroke();

    ctx.beginPath();
    for (let i = 0; i < 15; i++) {
        const z = ((i * 40 + speed) % 600);
        if (z <= 0) continue;
        const py_ = horizon + (fov / z) * (height - horizon);
        if (py_ > horizon && py_ < height) {
            ctx.moveTo(0, py_);
            ctx.lineTo(width, py_);
        }
    }
    ctx.stroke();

    // 3. Data Packets
    const trailTex = getCachedTexture('grid_trail', 64, c => {
        const grad = c.createLinearGradient(32, 0, 32, 64);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(1, theme.particleColor.slice(0, 7) + '80'); // 50%
        c.fillStyle = grad;
        c.fillRect(0, 0, 64, 64);
    });

    for (let i = 0; i < aliveCount; i++) {
        pz[i] -= vy[i] * 2.5;
        if (pz[i] <= 10) {
            pz[i] = 600;
            px[i] = Math.random() * width;
        }

        const scale = fov / pz[i];
        const cx = (px[i] - width / 2) * scale + width / 2;
        const cy = horizon + scale * (height - horizon);

        if (cy > horizon && cy < height) {
            const alpha = Math.min(1, 1 - (pz[i] / 600));
            const s = scale * 5;

            ctx.globalAlpha = alpha * 0.6;
            ctx.drawImage(trailTex, cx - s * 0.5, cy - s * 6, s, s * 6);

            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(cx - s * 0.5, cy - s * 0.5, s, s);
        }
    }
}


function drawMatrix(theme: ThemeConfig) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*";
    const charH = 22;
    const charW = 16;
    
    // 1. Pre-render Glyph Sheet
    const glyphSheet = getCachedTexture('matrix_glyphs', 512, c => {
        c.font = 'bold 18px monospace';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        chars.split('').forEach((char, idx) => {
            const x = (idx % 16) * 32 + 16;
            const y = Math.floor(idx / 16) * 32 + 16;
            c.fillStyle = '#FFFFFF';
            c.fillText(char, x, y);
            c.fillStyle = theme.particleColor;
            c.fillText(char, x, y + 64);
        });
    });

    const headTex = getCachedTexture('matrix_head', 40, c => {
        const grad = c.createRadialGradient(20, 20, 0, 20, 20, 20);
        grad.addColorStop(0, '#FFFFFF');
        grad.addColorStop(0.5, theme.particleColor.slice(0, 7) + '66');
        grad.addColorStop(1, 'transparent');
        c.fillStyle = grad;
        c.fillRect(0, 0, 40, 40);
    });

    const compOp = isMobile ? 'source-over' : 'lighter';

    for (let i = 0; i < aliveCount; i++) {
        py[i] += vy[i] * (1 + (3 - layer[i]) * 0.2);
        if (py[i] > height + size[i] * charH) {
            py[i] = -size[i] * charH;
            vy[i] = Math.random() * 5 + 3;
        }

        const alphaScale = 1 - (layer[i] / 4);

        for (let j = 0; j < size[i]; j++) {
            const charY = py[i] - j * charH;
            if (charY > -charH && charY < height + charH) {
                const seed = Math.floor(px[i] + Math.floor(charY / charH) * 123);
                let charIdx = seed % chars.length;
                if (Math.random() > 0.985) charIdx = Math.floor(Math.random() * chars.length);

                const charAlpha = 1 - (j / size[i]);
                const gx = (charIdx % 16) * 32 + (32 - charW) / 2;
                const gy = Math.floor(charIdx / 16) * 32 + (32 - charH) / 2;

                if (j === 0) {
                    ctx.globalCompositeOperation = compOp;
                    ctx.drawImage(headTex, px[i] - 20 - charW/2 + 11, charY - 20, 40, 40);
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.globalAlpha = alphaScale;
                    ctx.drawImage(glyphSheet, gx, gy, charW, charH, px[i] - charW/2, charY - charH/2, charW, charH);
                } else {
                    ctx.globalAlpha = charAlpha * 0.7 * alphaScale;
                    ctx.drawImage(glyphSheet, gx, gy + 64, charW, charH, px[i] - charW/2, charY - charH/2, charW, charH);
                }
            }
        }
    }
}

function drawWaves(theme: ThemeConfig) {
    const moonX = width * 0.8;
    const moonY = height * 0.25;

    const moonTex = getCachedTexture('waves_moon', 240, c => {
        const grad = c.createRadialGradient(120, 120, 0, 120, 120, 120);
        grad.addColorStop(0, theme.color3 + '88');
        grad.addColorStop(0.7, theme.color2 + '44');
        grad.addColorStop(1, 'transparent');
        c.fillStyle = grad;
        c.fillRect(0, 0, 240, 240);
    });
    setCompositeOperation('lighter');
    ctx.drawImage(moonTex, moonX - 120, moonY - 120, 240, 240);

    // Rebuild wave gradients only when height or theme color changes
    if (cachedWaveGrads.length !== 6 || cachedWaveGridColor !== theme.gridColor || cachedWaveHeight !== height) {
        cachedWaveGrads = [];
        cachedWaveGridColor = theme.gridColor;
        cachedWaveHeight = height;
        for (let i = 0; i < 6; i++) {
            const layerY = height * (0.35 + i * 0.1);
            const amp = 10 + i * 15;
            const g = ctx.createLinearGradient(0, layerY - amp, 0, layerY + amp * 2);
            g.addColorStop(0, colorCache.gridAlpha50); // Using grid 50% for waves
            g.addColorStop(1, 'transparent');
            cachedWaveGrads.push(g);
        }
    }

    setCompositeOperation('screen');
    for (let i = 0; i < 6; i++) {
        const layerY = height * (0.35 + i * 0.1);
        const speed = time * (0.5 + i * 0.25);
        const amp = 10 + i * 15;
        const freq = 0.004 + i * 0.001;

        ctx.strokeStyle = cachedWaveGrads[i]!;
        ctx.lineWidth = 1 + i * 0.5;
        ctx.globalAlpha = 0.2 + (i * 0.12);
        ctx.beginPath();

        for (let x = 0; x <= width; x += 30) {
            const waveY = Math.sin((x * freq) + speed + (i * 1.2)) * amp;
            if (x === 0) ctx.moveTo(x, layerY + waveY);
            else ctx.lineTo(x, layerY + waveY);
        }
        ctx.stroke();
    }
}


function drawBubbles(theme: ThemeConfig) {
    const surfaceGrad = getCachedTexture('surface_bloom', 200, c => {
        const grad = c.createLinearGradient(0, 0, 0, 200);
        grad.addColorStop(0, colorCache.particleAlpha50);
        grad.addColorStop(0.5, colorCache.particleAlpha20);
        grad.addColorStop(1, 'transparent');
        c.fillStyle = grad;
        c.fillRect(0, 0, 200, 200);
    });

    setCompositeOperation('lighter');
    ctx.drawImage(surfaceGrad, 0, 0, width, height * 0.2);

    for (let i = 0; i < 12; i++) {
        const angle = Math.sin(time * 0.1 + i) * 0.15 - 0.45;
        const xPos = width * (0.05 + i * 0.12);
        const rayWidth = 80 + Math.sin(time * 0.4 + i) * 50;
        const rayGrad = getCachedTexture('god_ray', 150, c => {
            const grad = c.createLinearGradient(0, 0, 150, 150);
            grad.addColorStop(0, colorCache.particleAlpha20);
            grad.addColorStop(0.5, applyAlpha(theme.particleColor, '15')); // Custom alpha for rays
            grad.addColorStop(1, 'transparent');
            c.fillStyle = grad;
            c.fillRect(0, 0, 150, 150);
        });

        ctx.save();
        ctx.translate(xPos, -80);
        ctx.rotate(angle);
        ctx.drawImage(rayGrad, -rayWidth / 2, 0, rayWidth, height * 2.2);
        ctx.restore();
    }

    const bubbleTexture = getCachedTexture('bubble_ring', 64, c => {
        c.strokeStyle = '#FFFFFF';
        c.lineWidth = 2;
        c.beginPath();
        c.arc(32, 32, 28, 0, Math.PI * 2);
        c.stroke();
        const highlight = c.createRadialGradient(22, 22, 0, 22, 22, 10);
        highlight.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        highlight.addColorStop(1, 'transparent');
        c.fillStyle = highlight;
        c.beginPath();
        c.arc(22, 22, 10, 0, Math.PI * 2);
        c.fill();
    });

    for (let i = 0; i < aliveCount; i++) {
        const depthFactor = (1 - layer[i] * 0.28);
        py[i] += vy[i] * depthFactor;
        px[i] += Math.sin(time * 1.8 + phase[i]) * 1.2 * depthFactor;

        if (py[i] < -size[i]) {
            py[i] = height + size[i];
            px[i] = Math.random() * width;
        }

        const bAlpha = (0.2 + Math.sin(time + phase[i]) * 0.08) * depthFactor;
        ctx.globalAlpha = bAlpha;
        const s = size[i];
        ctx.drawImage(bubbleTexture, px[i] - s, py[i] - s, s * 2, s * 2);
    }
}

function drawEmbers(theme: ThemeConfig) {
    const heatWave = Math.sin(time * 2.0) * 0.05 + 0.08;
    setCompositeOperation('lighter');
    ctx.fillStyle = theme.color2;
    ctx.globalAlpha = heatWave;
    ctx.fillRect(0, 0, width, height);

    const emberGlowTexture = getCachedTexture('ember_glow', 100, c => {
        const grad = c.createRadialGradient(50, 50, 0, 50, 50, 50);
        grad.addColorStop(0, 'rgba(255, 100, 0, 0.4)');
        grad.addColorStop(0.5, 'rgba(255, 50, 0, 0.1)');
        grad.addColorStop(1, 'transparent');
        c.fillStyle = grad;
        c.fillRect(0, 0, 100, 100);
    });

    const emberPointTex = getCachedTexture('ember_point', 16, c => {
        c.fillStyle = '#FFFFFF';
        c.beginPath();
        c.arc(8, 8, 8, 0, Math.PI * 2);
        c.fill();
    });

    for (let i = 0; i < aliveCount; i++) {
        const depthFactor = (1 - layer[i] * 0.22);
        py[i] += vy[i] * depthFactor;
        px[i] += Math.sin(time * 1.6 + py[i] * 0.008 + phase[i]) * vx[i] * depthFactor;

        let lf = 1 - (py[i] / (height * 1.5));
        if (py[i] < -50 || lf <= 0) {
            py[i] = height + 60;
            px[i] = Math.random() * width;
            lf = 1 - (py[i] / (height * 1.5));
        }
        lf = Math.max(0.01, lf);

        if (layer[i] === 0) {
            const sSize = 50 + lf * 40;
            ctx.globalAlpha = Math.min(1, lf * 0.4);
            ctx.drawImage(emberGlowTexture, px[i] - sSize, py[i] - sSize, sSize * 2, sSize * 2);
        }

        const flicker = Math.sin(time * 12 + phase[i]) * 0.35 + 0.65;
        const emberAlpha = lf * flicker * depthFactor;

        ctx.globalAlpha = Math.min(1, emberAlpha);
        const eSize = size[i] * (0.5 + lf * 0.7) * (0.8 + flicker * 0.4);

        if (lf > 0.4) {
            // Hot ember
            ctx.drawImage(emberPointTex, px[i] - eSize, py[i] - eSize, eSize * 2, eSize * 2);
        } else {
            // Cold ember - just use fillRect to save arc calls
            ctx.fillStyle = theme.color2;
            ctx.fillRect(px[i] - eSize, py[i] - eSize, eSize * 2, eSize * 2);
        }
    }
}

function drawBokeh(_theme: ThemeConfig) {
    const bokehTexture = getCachedTexture('bokeh_glow', 128, c => {
        const grad = c.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
        grad.addColorStop(0.6, 'rgba(255, 255, 255, 0.1)');
        grad.addColorStop(1, 'transparent');
        c.fillStyle = grad;
        c.fillRect(0, 0, 128, 128);
    });

    setCompositeOperation('lighter');
    for (let i = 0; i < aliveCount; i++) {
        px[i] += vx[i];
        py[i] += vy[i];
        const s = size[i];

        if (px[i] < -s) px[i] = width + s;
        if (px[i] > width + s) px[i] = -s;
        if (py[i] < -s) py[i] = height + s;
        if (py[i] > height + s) py[i] = -s;

        const pulse = Math.sin(time * 0.4 + phase[i]) * 0.2 + 0.8;
        const currentSize = s * pulse;
        const alpha = life[i] * (0.6 + Math.sin(time * 0.8 + phase[i]) * 0.4);

        ctx.globalAlpha = alpha;
        ctx.drawImage(bokehTexture, px[i] - currentSize, py[i] - currentSize, currentSize * 2, currentSize * 2);
    }
}


function drawFloating(_theme: ThemeConfig) {
    const floatGlowTexture = getCachedTexture('float_glow', 64, c => {
        const grad = c.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
        grad.addColorStop(1, 'transparent');
        c.fillStyle = grad;
        c.fillRect(0, 0, 64, 64);
    });

    const floatCoreTex = getCachedTexture('float_core', 16, c => {
        c.fillStyle = '#FFFFFF';
        c.beginPath();
        c.arc(8, 8, 8, 0, Math.PI * 2);
        c.fill();
    });

    // --- Pre-render 5 Varied Colored & Shaped Stars (v4) ---
    const starColors = ['#FFFFFF', '#FFB7D5', '#FFE082', '#B2FFD8', '#E8B2FF']; 
    const magicStars = starColors.map((col, idx) => 
        getCachedTexture(`magic_star_v4_${idx}`, 96, c => {
            const cx = 48, cy = 48;
            const bloom = c.createRadialGradient(cx, cy, 0, cx, cy, 48);
            bloom.addColorStop(0, applyAlpha(col, '44'));
            bloom.addColorStop(0.5, applyAlpha(col, '11'));
            bloom.addColorStop(1, 'transparent');
            c.fillStyle = bloom;
            c.beginPath(); c.arc(cx, cy, 48, 0, Math.PI * 2); c.fill();

            c.strokeStyle = '#FFFFFF';
            c.lineWidth = 1.2;
            c.beginPath();
            
            // Mix: Odd indices get a 4-point Cross star, Even get 8-point
            const isFourPoint = idx % 2 !== 0;
            const points = isFourPoint ? 8 : 16;
            for (let i = 0; i < points; i++) {
                const angle = (i / points) * Math.PI * 2;
                let r = 8;
                if (isFourPoint) {
                    r = i % 2 === 0 ? 32 : 6; // Long thin rays for cross
                } else {
                    r = i % 2 === 0 ? 25 : 8; // Standard star
                }
                const x = cx + Math.cos(angle) * r;
                const y = cy + Math.sin(angle) * r;
                if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
            }
            c.closePath();
            c.fillStyle = col; 
            c.globalAlpha = 1.0;
            c.fill();
            c.stroke();
        })
    );

    const softBloomTex = getCachedTexture('soft_bloom_pink', 128, c => {
        const grad = c.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0, applyAlpha(currentTheme?.color2 || '#ec407a', '28'));
        grad.addColorStop(0.7, applyAlpha(currentTheme?.color3 || '#ff80ab', '05'));
        grad.addColorStop(1, 'transparent');
        c.fillStyle = grad;
        c.fillRect(0, 0, 128, 128);
    });

    const isMarchen = currentTheme?.id === 'marchen';

    if (isMarchen) {
        // --- 1. Global Breathing Atmosphere ---
        const breathing = Math.sin(time * 0.8) * 0.5 + 0.5;
        const pulseAlpha = 0.3 + breathing * 0.4;
        
        ctx.save();
        setCompositeOperation('screen');
        const rayCount = 2; // Reduced from 3
        for (let i = 0; i < rayCount; i++) {
            const rayP = time * 0.1 + i * 2.0;
            const rX = width * (0.4 + i * 0.2 + Math.sin(rayP) * 0.05);
            const rW = 150 + Math.cos(rayP * 0.5) * 40; // Smaller rays
            const rG = ctx.createLinearGradient(rX - rW, 0, rX + rW, 0);
            rG.addColorStop(0, 'transparent');
            // Even lower alpha for 'moderate' effect
            rG.addColorStop(0.5, applyAlpha(currentTheme?.color2 || '#FFF', Math.floor(pulseAlpha * 15).toString(16).padStart(2, '0')));
            rG.addColorStop(1, 'transparent');
            ctx.fillStyle = rG;
            ctx.rotate(0.1 + Math.sin(time * 0.3) * 0.03);
            ctx.fillRect(rX - rW, -height, rW * 2, height * 3);
        }

        // --- 2. Floating Breathing Orbs (Subtle Depth) ---
        for (let i = 0; i < 2; i++) { // Reduced from 4
            const oP = time * 0.05 + i * 2.5;
            const ox = width * (0.5 + Math.sin(oP) * 0.35);
            const oy = height * (0.5 + Math.cos(oP * 0.8) * 0.25);
            const os = height * (1.2 + Math.sin(time * 0.4 + i) * 0.2);
            ctx.globalAlpha = 0.15 + Math.sin(time * 0.8 + i) * 0.1;
            ctx.drawImage(softBloomTex, ox - os, oy - os, os * 2, os * 2);
        }
        ctx.restore();
    }

    if (isMarchen) {
        // Parametrically managed spirits
    }

    setCompositeOperation('lighter');
    for (let i = 0; i < aliveCount; i++) {
        const depthFactor = (1 - layer[i] * 0.25);
        let alpha = 0;
        
        if (isMarchen) {
            // --- 3. Balanced Star Weaving (Zero-GC Optimized) ---
            const isMainSpirit = i < (isMobile ? 45 : 90); // 1.5x increase (60 -> 90), reduced for mobile
            
            // Ultra-Slow life cycle for stable, relaxed atmosphere
            life[i] += 0.0002 * size[i] * (isMainSpirit ? 1.0 : 0.6); 
            if (life[i] >= 1.0) {
                life[i] = 0; // Immediate respawn
                vx[i] = Math.random() * width;
                vy[i] = Math.random() * height;
                custom2[i] = Math.floor(Math.random() * magicStars.length); 
                pulseSpeed[i] = 1.2 + Math.random() * 2.8;
                pulseMag[i] = 0.15 + Math.random() * 0.35;
            }

            if (life[i] < 0) return; 

            const t_ = life[i];
            const weavingScale = (isMainSpirit ? 80 : 30) * (Math.sin(time * 0.08 + custom1[i]) * 0.5 + 1.0);
            const wX = Math.cos(t_ * Math.PI * 1.5 + custom1[i]) * weavingScale;
            const wY = Math.sin(t_ * Math.PI * 2 + phase[i]) * (weavingScale * 0.4);
            
            px[i] = vx[i] + wX;
            py[i] = vy[i] + wY;

            // Dynamic, Multi-layered Shining/Twinkle Effect (requested)
            const shineSpeed = 1.2 + (pulseSpeed[i] * 0.4); 
            const blink = Math.pow(Math.sin(time * shineSpeed + phase[i]), 6); // Sharper brightness peaks
            const twinkle = 0.5 + blink * 0.5; // Wider alpha variation (50% to 100%)
            const alphaVal = Math.sin(t_ * Math.PI) * (isMainSpirit ? 0.85 : 0.5) * twinkle;
            ctx.globalAlpha = alphaVal;

            if (isMainSpirit) {
                // Randomized High-Frequency Pulse (requested)
                const pulse = Math.sin(time * pulseSpeed[i] + phase[i]) * pulseMag[i];
                const starSize = (10 + size[i] * 12 * (1 + pulse + blink * 0.25)) * alphaVal;
                
                // Pure White Trail for clarity
                const aIdx = Math.floor(alphaVal * 40);
                const colorIdx = (custom2[i] || 0) % magicStars.length; // Use assigned texture index
                ctx.strokeStyle = themeAlphaCache.color1[aIdx]; // Using white/color1 cache
                ctx.lineWidth = 1.2;
                ctx.beginPath(); ctx.moveTo(hx1[i], hy1[i]); ctx.lineTo(px[i], py[i]); ctx.stroke();
                hx1[i] = px[i]; hy1[i] = py[i];

                ctx.save();
                ctx.translate(px[i], py[i]);
                ctx.rotate(time * (0.8 + blink * 0.7) + phase[i]); // Spin faster when shining
                ctx.drawImage(magicStars[colorIdx], -starSize, -starSize, starSize * 2, starSize * 2);
                ctx.restore();
            } else {
                // Dimmer, softer background dust
                const dustSize = size[i] * 2.0 * alphaVal; // Slightly larger dust
                ctx.fillStyle = themeAlphaCache.particle[Math.floor(alphaVal * 80)];
                ctx.fillRect(px[i] - dustSize, py[i] - dustSize, dustSize * 2, dustSize * 2);
            }
        } else {
            // Standard Floating Movement
            const wind = Math.sin(time * 0.3 + py[i] * 0.001) * 15;
            px[i] += (vx[i] + wind * 0.05) * depthFactor;
            py[i] += (vy[i] + Math.cos(time * 0.2) * 0.2) * depthFactor;

            if (px[i] < -150) px[i] = width + 150;
            if (px[i] > width + 150) px[i] = -150;
            if (py[i] < -150) py[i] = height + 150;
            if (py[i] > height + 150) py[i] = -150;

            alpha = (0.2 + (1 - layer[i] * 0.2) * 0.5) * (0.7 + Math.sin(time + phase[i]) * 0.3);
            ctx.globalAlpha = alpha;

            const glowSize = size[i] * (1.2 + Math.sin(time * 2 + phase[i]) * 0.4);
            ctx.drawImage(floatGlowTexture, px[i] - glowSize, py[i] - glowSize, glowSize * 2, glowSize * 2);
            ctx.globalAlpha = alpha * 0.8;
            const coreSize = size[i] * 0.15 * 2;
            ctx.drawImage(floatCoreTex, px[i] - coreSize * 0.5, py[i] - coreSize * 0.5, coreSize, coreSize);
        }
    }

    // Vignetting removed for performance optimization (requested 60fps)
}

function drawSnow(theme: ThemeConfig) {
    const fogGrad = getCachedTexture('snow_fog', 256, c => {
        const grad = c.createLinearGradient(0, 0, 0, 256);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(1, applyAlpha(theme.color3, '66')); // Keep specialized one
        c.fillStyle = grad;
        c.fillRect(0, 0, 256, 256);
    });
    ctx.drawImage(fogGrad, 0, height * 0.6, width, height * 0.4);

    const snowFlakeTex = getCachedTexture('snowflake', 64, c => {
        c.strokeStyle = theme.particleColor;
        c.lineWidth = 1.5;
        const s = 16;
        const cx = 32, cy = 32;
        c.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            c.moveTo(cx, cy);
            c.lineTo(cx + Math.cos(angle) * s, cy + Math.sin(angle) * s);
            const bx = cx + Math.cos(angle) * s * 0.6;
            const by = cy + Math.sin(angle) * s * 0.6;
            const bAngle1 = angle + Math.PI / 4;
            const bAngle2 = angle - Math.PI / 4;
            c.moveTo(bx, by);
            c.lineTo(bx + Math.cos(bAngle1) * s * 0.3, by + Math.sin(bAngle1) * s * 0.3);
            c.moveTo(bx, by);
            c.lineTo(bx + Math.cos(bAngle2) * s * 0.3, by + Math.sin(bAngle2) * s * 0.3);
        }
        c.stroke();
        c.fillStyle = '#FFFFFF';
        c.globalAlpha = 0.5;
        c.beginPath();
        c.arc(cx, cy, s * 0.2, 0, Math.PI * 2);
        c.fill();
    });

    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < aliveCount; i++) {
        const depthFactor = (1 - layer[i] * 0.25);
        py[i] += vy[i] * depthFactor;
        px[i] += (vx[i] + Math.sin(time + phase[i]) * 0.5) * depthFactor;

        if (py[i] > height + 20) {
            py[i] = -20;
            px[i] = Math.random() * width;
        }

        const alpha = (0.4 + (1 - layer[i] * 0.3) * 0.6) * (0.8 + Math.sin(time * 1.5 + phase[i]) * 0.2);
        ctx.globalAlpha = alpha;

        const s = size[i] * (1.5 - layer[i] * 0.3); // Adjust relative scale
        ctx.drawImage(snowFlakeTex, px[i] - s * 2, py[i] - s * 2, s * 4, s * 4);
    }
}


function drawHexagons(theme: ThemeConfig) {
    const size_ = 60;
    const hStep = size_ * 1.5;
    const vStep = size_ * Math.sqrt(3);

    const pTime = (time * 0.125) % 3;
    const isRadial = pTime < 1;
    const isLinear = pTime >= 1 && pTime < 2;

    // 1. Draw static/low-alpha grid in ONE batch
    ctx.strokeStyle = colorCache.gridAlpha20;
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    
    const pulseList: {x: number, y: number, alpha: number}[] = [];

    for (let x = -size_; x < width + size_; x += hStep) {
        const isOdd = Math.floor((x + size_) / hStep) % 2 === 1;
        for (let y = -size_; y < height + size_; y += vStep) {
            const py_ = isOdd ? y + vStep / 2 : y;

            let pulse = 0;
            if (isRadial) {
                const dist = Math.sqrt((x - width / 2) ** 2 + (py_ - height / 2) ** 2);
                pulse = Math.sin(time * 3 - dist * 0.008) * 0.5 + 0.5;
            } else if (isLinear) {
                pulse = Math.sin(time * 4 - (x + py_) * 0.005) * 0.5 + 0.5;
            } else {
                const seed = Math.sin(x * 0.05) * Math.cos(py_ * 0.05) * 2000;
                pulse = Math.sin(time * 2.5 + seed) * 0.5 + 0.5;
            }

            if (pulse > 0.85) {
                pulseList.push({x, y: py_, alpha: pulse});
            } else {
                // Add to main batch path (Pre-calculated angles/offsets for performance)
                // 30, 90, 150, 210, 270, 330 degrees (Hexagon vertices)
                const s = size_;
                ctx.moveTo(x + s, py_); // 0 deg
                ctx.lineTo(x + s * 0.5, py_ + s * 0.866); // 60 deg (approx sqrt(3)/2)
                ctx.lineTo(x - s * 0.5, py_ + s * 0.866); // 120 deg
                ctx.lineTo(x - s, py_); // 180 deg
                ctx.lineTo(x - s * 0.5, py_ - s * 0.866); // 240 deg
                ctx.lineTo(x + s * 0.5, py_ - s * 0.866); // 300 deg
                ctx.lineTo(x + s, py_); // Close
            }
        }
    }
    ctx.stroke();

    // 2. Draw highlighted/pulsing hexagons (Few per frame)
    const pArr = themeAlphaCache.particle;
    for (let i = 0; i < pulseList.length; i++) {
        const p = pulseList[i];
        const alphaIdx = Math.floor(p.alpha * 255);
        ctx.strokeStyle = pArr[alphaIdx];
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        const s = size_;
        ctx.moveTo(p.x + s, p.y);
        ctx.lineTo(p.x + s * 0.5, p.y + s * 0.866);
        ctx.lineTo(p.x - s * 0.5, p.y + s * 0.866);
        ctx.lineTo(p.x - s, p.y);
        ctx.lineTo(p.x - s * 0.5, p.y - s * 0.866);
        ctx.lineTo(p.x + s * 0.5, p.y - s * 0.866);
        ctx.closePath();
        ctx.stroke();

        if (p.alpha > 0.92) {
            ctx.fillStyle = theme.particleColor;
            ctx.globalAlpha = (p.alpha - 0.9) * 10;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }
    }
}

function drawScanlines(theme: ThemeConfig) {
    const horizon = height * 0.55;
    const sunR = Math.min(width, height) * 0.35;
    const sunPulse = Math.sin(time * 0.8) * 0.03 + 1;

    const sunGlowGrad = getCachedTexture('sun_glow', 512, c => {
        const grad = c.createRadialGradient(256, 256, 128 * 0.2, 256, 256, 128 * 1.5);
        grad.addColorStop(0, applyAlpha(theme.color3, '66'));
        grad.addColorStop(0.5, applyAlpha(theme.color2, '22'));
        grad.addColorStop(1, 'transparent');
        c.fillStyle = grad;
        c.fillRect(0, 0, 512, 512);
    });

    setCompositeOperation('screen');
    ctx.drawImage(sunGlowGrad, width / 2 - sunR * 1.5 * sunPulse, horizon - sunR * 1.5 * sunPulse, sunR * 3 * sunPulse, sunR * 1.5 * sunPulse);

    // --- Rebuild cached gradients only on theme/size change ---
    const scanlinesKey = theme.color2 + theme.color3 + width + height;
    if (cachedScanlinesKey !== scanlinesKey) {
        cachedScanlinesKey = scanlinesKey;

        // Sun core gradient (horizon depends on height)
        cachedScanlinesCoreGrad = ctx.createLinearGradient(0, horizon - sunR, 0, horizon);
        cachedScanlinesCoreGrad.addColorStop(0, theme.color3);
        cachedScanlinesCoreGrad.addColorStop(1, theme.color2);

        // Mountain gradients (3 layers)
        cachedScanlinesMountainGrads = [];
        for (let l = 2; l >= 0; l--) {
            const mHeight = height * (0.12 + l * 0.08);
            const g = ctx.createLinearGradient(0, horizon - mHeight, 0, horizon);
            g.addColorStop(0, applyAlpha(theme.color2, '44'));
            g.addColorStop(1, '#000000');
            cachedScanlinesMountainGrads[l] = g;
        }

        // Shimmer gradient (position is fixed, only alpha varies via globalAlpha)
        const floorY = horizon;
        cachedScanlinesShimmerGrad = ctx.createLinearGradient(0, floorY - 50, 0, floorY + 100);
        cachedScanlinesShimmerGrad.addColorStop(0, 'transparent');
        cachedScanlinesShimmerGrad.addColorStop(0.4, theme.color3);
        cachedScanlinesShimmerGrad.addColorStop(1, 'transparent');
    }

    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(width / 2, horizon, sunR * sunPulse, Math.PI, 0, false);
    ctx.fillStyle = cachedScanlinesCoreGrad!;
    ctx.fill();

    for (let l = 2; l >= 0; l--) {
        const mHeight = height * (0.12 + l * 0.08);
        const mCount = 3 + l;
        const mWidth = width / mCount;

        ctx.fillStyle = cachedScanlinesMountainGrads[l]!;
        ctx.strokeStyle = applyAlpha(theme.gridColor, '33');
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.moveTo(-100, horizon);
        for (let i = 0; i <= mCount; i++) {
            const mx = i * mWidth;
            const mSeed = (i + l * 5) * 2.1;
            const mh = (Math.sin(mSeed) * 0.5 + 0.5) * mHeight;
            ctx.lineTo(mx, horizon - mh);
            ctx.lineTo(mx + mWidth * 0.5, horizon);
        }
        ctx.lineTo(width + 100, horizon);
        ctx.fill();
        ctx.stroke();
    }

    const floorY = horizon;
    // Shimmer alpha animates, but we avoid a per-frame gradient allocation by varying globalAlpha
    const shimmerAlphaVal = Math.sin(time * 1.5) * 0.05 + 0.15;
    setCompositeOperation('lighter');
    ctx.globalAlpha = shimmerAlphaVal;
    ctx.fillStyle = cachedScanlinesShimmerGrad!;
    ctx.fillRect(0, floorY - 50, width, 150);

    setCompositeOperation('source-over');
    ctx.strokeStyle = applyAlpha(theme.gridColor, '22');
    for (let x = -width * 0.5; x <= width * 1.5; x += 150) {
        ctx.beginPath();
        ctx.moveTo(width / 2 + (x - width / 2) * 0.1, floorY);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
    for (let i = 0; i < 10; i++) {
        const py_ = floorY + Math.pow(i / 10, 2) * (height - floorY);
        const alpha = (i / 10) * 0.3;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.moveTo(0, py_);
        ctx.lineTo(width, py_);
        ctx.stroke();
    }

    const moteTex = getCachedTexture('scanline_mote', 16, c => {
        const grad = c.createRadialGradient(8, 8, 0, 8, 8, 8);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        grad.addColorStop(1, 'transparent');
        c.fillStyle = grad;
        c.fillRect(0, 0, 16, 16);
    });

    for (let i = 0; i < aliveCount; i++) {
        px[i] = (px[i] + vx[i] * 0.3) % (width + 400);
        py[i] += Math.sin(time * 0.5 + px[i] * 0.01) * 0.2;

        const driftAlpha = (0.2 + (3 - layer[i]) * 0.1) * (0.7 + Math.sin(time * 0.8 + px[i] * 0.005) * 0.3);
        ctx.globalAlpha = driftAlpha;
        const s = 2 + (3 - layer[i]) * 1.5;

        ctx.drawImage(moteTex, px[i] - 200 - s * 2.5, py[i] - s * 2.5, s * 5, s * 5);
    }
}

// --- Main Render Loop ---


function render(timestamp: number) {
    if (!ctx || !currentTheme) return;
    
    const frameStart = performance.now();
    time = timestamp * 0.001;

    // Base background gradient
    const bgColorKey = currentTheme.color1 + currentTheme.color2 + currentTheme.color3;
    if (cachedBgColors !== bgColorKey || !cachedBgGrad) {
        cachedBgColors = bgColorKey;
        // Use logic width/height for gradient to match coordinates
        cachedBgGrad = ctx.createLinearGradient(0, 0, width, height);
        cachedBgGrad.addColorStop(0, currentTheme.color1);
        cachedBgGrad.addColorStop(0.5, currentTheme.color2);
        cachedBgGrad.addColorStop(1, currentTheme.color3);
    }

    if (bgImageBitmap) {
        // Force draw to full physical canvas size to avoid transformation/scaling issues
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset to physical pixels
        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = 'source-over';
        
        // Fill the actual physical canvas dimensions
        const physW = canvas.width;
        const physH = canvas.height;
        ctx.drawImage(bgImageBitmap, 0, 0, physW, physH);
        ctx.restore();
    } else {
        // Clear to solid black for testing
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);
    }

    ctx.save();
    switch (currentTheme.pattern) {
        case 'stars': drawStars(currentTheme); break;
        case 'grid3d': drawGrid3D(currentTheme); break;
        case 'scanlines': drawScanlines(currentTheme); break;
        case 'matrix': drawMatrix(currentTheme); break;
        case 'waves': drawWaves(currentTheme); break;
        case 'bubbles': drawBubbles(currentTheme); break;
        case 'embers': drawEmbers(currentTheme); break;
        case 'bokeh': drawBokeh(currentTheme); break;
        case 'hexagons': drawHexagons(currentTheme); break;
        case 'floating': drawFloating(currentTheme); break;
        case 'snow': drawSnow(currentTheme); break;
    }
    ctx.restore();

    const frameEnd = performance.now();
    updateDynamicResolution(frameEnd - frameStart);
}

// --- Dynamic Resolution & Performance State ---
let renderResolutionScale = 1.0;
let frameTimeHistory: number[] = [];

function updateDynamicResolution(duration: number) {
    if (!isMobile) return; // Desktop is usually fine

    frameTimeHistory.push(duration);
    if (frameTimeHistory.length > 30) frameTimeHistory.shift();

    const avg = frameTimeHistory.reduce((a, b) => a + b, 0) / frameTimeHistory.length;
    
    // Target duration for 60fps is 16.6ms. 
    // If background takes more than 8ms, it's eating too much of the budget.
    let targetScale = renderResolutionScale;
    if (avg > 8.5) {
        targetScale = Math.max(0.65, renderResolutionScale - 0.05);
    } else if (avg < 5.0 && renderResolutionScale < 1.0) {
        targetScale = Math.min(1.0, renderResolutionScale + 0.02);
    }

    if (Math.abs(targetScale - renderResolutionScale) > 0.04) {
        renderResolutionScale = targetScale;
        applyResolution();
    }

    // Report performance back (throttled)
    if (Math.random() < 0.02) {
        self.postMessage({ type: 'PERF', duration: avg });
    }
}

function applyResolution() {
    if (!canvas || !ctx) return;
    canvas.width = Math.floor(width * pixelRatio * renderResolutionScale);
    canvas.height = Math.floor(height * pixelRatio * renderResolutionScale);
    ctx.setTransform(pixelRatio * renderResolutionScale, 0, 0, pixelRatio * renderResolutionScale, 0, 0);
    invalidateAllCaches();
}

self.onmessage = (e: MessageEvent) => {
    const data = e.data;

    // High-performance path for synchronized draw calls (Array [0, timestamp])
    if (Array.isArray(data)) {
        if (data[0] === 0 && isRunning) {
            render(data[1]);
        }
        return;
    }

    // Standard path for configuration
    switch (data.type) {
        case 'INIT':
            canvas = data.canvas;
            isMobile = data.isMobile || false;
            ctx = canvas.getContext('2d', { 
                alpha: false, 
                desynchronized: isMobile 
            }) as OffscreenCanvasRenderingContext2D;
            width = data.width;
            height = data.height;
            pixelRatio = data.pixelRatio;
            dynamicMaxParticles = isMobile ? 1000 : 2500;
            applyResolution();
            break;

        case 'RESIZE':
            width = data.width;
            height = data.height;
            applyResolution();
            if (currentTheme) {
                initPattern(currentTheme.pattern);
            }
            break;

        case 'SET_THEME':
            const newTheme = data.theme as ThemeConfig;
            const themeChanged = !currentTheme || currentTheme.id !== newTheme.id;
            currentTheme = newTheme;
            colorCache.particle = currentTheme.particleColor;
            colorCache.particleAlpha50 = applyAlpha(currentTheme.particleColor, '80');
            colorCache.particleAlpha20 = applyAlpha(currentTheme.particleColor, '33');
            colorCache.grid = currentTheme.gridColor;
            colorCache.gridAlpha50 = applyAlpha(currentTheme.gridColor, '80');
            colorCache.gridAlpha20 = applyAlpha(currentTheme.gridColor, '33');
            invalidateAllCaches(themeChanged);
            if (currentTheme) {
                initPattern(currentTheme.pattern);
                isRunning = true;
            } else {
                isRunning = false;
            }
            break;

        case 'SET_BG_IMAGE':
            bgImageBitmap = data.bitmap;
            if (bgImageBitmap) {
                console.log(`[BackgroundWorker] 🖼️ ImageBitmap received: ${bgImageBitmap.width}x${bgImageBitmap.height}`);
            } else {
                console.log(`[BackgroundWorker] 🌑 Background image cleared`);
            }
            break;

        case 'START':
            isRunning = true;
            break;

        case 'STOP':
            isRunning = false;
            break;
    }
};

