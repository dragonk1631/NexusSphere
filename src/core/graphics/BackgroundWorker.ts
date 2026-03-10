import type { ThemeConfig } from '../ThemeManager';

// --- Worker State ---
let canvas: OffscreenCanvas;
let ctx: OffscreenCanvasRenderingContext2D;
let width = 800;
let height = 600;
let pixelRatio = 1;
let currentTheme: ThemeConfig | null = null;
let isRunning = false;
let time = 0;
let lastTimestamp = 0;

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
const custom1 = new Float32Array(MAX_PARTICLES); // For specific needs like 'va'

let aliveCount = 0;

function spawn(): number {
    if (aliveCount >= MAX_PARTICLES) return -1;
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
    return color.slice(0, 7) + alpha;
}

// --- Pattern Logic ---
function initPattern(pattern: string) {
    clearParticles();

    switch (pattern) {
        case 'stars':
            for (let l = 0; l < 4; l++) {
                const count = l === 0 ? 400 : 150 - l * 30;
                for (let i = 0; i < count; i++) {
                    const id = spawn();
                    if (id === -1) break;
                    px[id] = Math.random() * width;
                    py[id] = Math.random() * height;
                    pz[id] = l + 1;
                    size[id] = l === 0 ? Math.random() * 0.4 : (4 - l) * 0.7 + Math.random();
                    vy[id] = (0.15 / (l + 1)) + Math.random() * 0.04;
                    phase[id] = Math.random() * Math.PI * 2;
                    layer[id] = l;
                    life[id] = Math.random() * 0.5 + 0.5; // used for alpha
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
            for (let i = 0; i < 100; i++) {
                const id = spawn();
                if (id === -1) break;
                const l = Math.floor(Math.random() * 3);
                px[id] = Math.random() * width;
                py[id] = Math.random() * height;
                size[id] = (Math.random() * 35 + 15) * (1 - l * 0.22);
                vx[id] = (Math.random() * 0.8 + 0.5) * (1 - l * 0.15);
                vy[id] = (Math.random() - 0.5) * 0.5;
                custom1[id] = (Math.random() - 0.5) * 0.03; // angular velocity not used for circles, but kept if needed
                phase[id] = Math.random() * Math.PI * 2;
                layer[id] = l;
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
    // 1. Nebula Layers
    const nebTexture = getCachedTexture('nebula_cloud', 512, (c) => {
        const grad = c.createRadialGradient(256, 256, 0, 256, 256, 256);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
        grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
        grad.addColorStop(1, 'transparent');
        c.fillStyle = grad;
        c.fillRect(0, 0, 512, 512);
    });

    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 3; i++) {
        const shift = time * (0.02 + i * 0.01) + (i * 1.5);
        const nx = width * (0.3 + Math.sin(shift) * 0.2);
        const ny = height * (0.4 + Math.cos(shift * 0.8) * 0.1);
        const nSize = height * (0.8 + i * 0.2);

        ctx.globalAlpha = 0.4;
        ctx.fillStyle = i % 2 === 0 ? theme.color2 : theme.color1;
        ctx.drawImage(nebTexture, nx - nSize, ny - nSize, nSize * 2, nSize * 2);
    }

    // 2. Stars
    const starTexture = getCachedTexture('star_simple', 32, (c) => {
        const grad = c.createRadialGradient(16, 16, 0, 16, 16, 16);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.4)');
        grad.addColorStop(1, 'transparent');
        c.fillStyle = grad;
        c.fillRect(0, 0, 32, 32);
    });

    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < aliveCount; i++) {
        py[i] += vy[i] * (5 - pz[i]);
        if (py[i] > height) py[i] = -20;

        const blink = Math.sin(time * 2 + phase[i]) * 0.3 + 0.7;
        ctx.globalAlpha = life[i] * blink; // life acts as base alpha here
        const s = size[i] * blink;
        ctx.drawImage(starTexture, px[i] - s, py[i] - s, s * 2, s * 2);
    }
}

function drawGrid3D(theme: ThemeConfig) {
    const horizon = height * 0.45;
    const fov = 420;
    const speed = (time * 150) % 100;

    // 1. Horizon Glow
    const glowHeight = 40;
    const bloomGrad = ctx.createLinearGradient(0, horizon - glowHeight, 0, horizon + glowHeight);
    bloomGrad.addColorStop(0, 'transparent');
    bloomGrad.addColorStop(0.5, applyAlpha(theme.particleColor, '66'));
    bloomGrad.addColorStop(1, 'transparent');

    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = bloomGrad;
    ctx.fillRect(0, horizon - glowHeight, width, glowHeight * 2);

    // 2. Perspective Grid
    ctx.strokeStyle = applyAlpha(theme.gridColor, '44');
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
        grad.addColorStop(1, applyAlpha(theme.particleColor, 'aa'));
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
    ctx.font = 'bold 18px monospace';
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*";

    const headTex = getCachedTexture('matrix_head', 40, c => {
        const grad = c.createRadialGradient(20, 20, 0, 20, 20, 20);
        grad.addColorStop(0, '#FFFFFF');
        grad.addColorStop(0.5, theme.particleColor + '66');
        grad.addColorStop(1, 'transparent');
        c.fillStyle = grad;
        c.fillRect(0, 0, 40, 40);
    });

    for (let i = 0; i < aliveCount; i++) {
        py[i] += vy[i] * (1 + (3 - layer[i]) * 0.2);
        if (py[i] > height + size[i] * 22) {
            py[i] = -size[i] * 22;
            vy[i] = Math.random() * 5 + 3;
        }

        const alphaScale = 1 - (layer[i] / 4);

        for (let j = 0; j < size[i]; j++) {
            const charY = py[i] - j * 22;
            if (charY > -20 && charY < height + 20) {
                let char = chars[Math.floor(Math.random() * chars.length)];
                if (Math.random() > 0.985) char = chars[Math.floor(Math.random() * chars.length)];

                const charAlpha = 1 - (j / size[i]);

                if (j === 0) {
                    ctx.globalCompositeOperation = 'lighter';
                    ctx.drawImage(headTex, px[i] - 11, charY - 29, 40, 40);
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.fillStyle = '#FFFFFF';
                    ctx.globalAlpha = alphaScale;
                } else {
                    ctx.fillStyle = theme.particleColor;
                    ctx.globalAlpha = charAlpha * 0.7 * alphaScale;
                }
                ctx.fillText(char, px[i], charY);
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
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(moonTex, moonX - 120, moonY - 120, 240, 240);

    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 6; i++) {
        const layerY = height * (0.35 + i * 0.1);
        const speed = time * (0.5 + i * 0.25);
        const amp = 10 + i * 15;
        const freq = 0.004 + i * 0.001;

        const waveGrad = ctx.createLinearGradient(0, layerY - amp, 0, layerY + amp * 2);
        waveGrad.addColorStop(0, applyAlpha(theme.gridColor, 'CC'));
        waveGrad.addColorStop(1, 'transparent');

        ctx.strokeStyle = waveGrad;
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
        grad.addColorStop(0, applyAlpha(theme.particleColor, 'AA'));
        grad.addColorStop(0.5, applyAlpha(theme.particleColor, '33'));
        grad.addColorStop(1, 'transparent');
        c.fillStyle = grad;
        c.fillRect(0, 0, 200, 200);
    });

    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(surfaceGrad, 0, 0, width, height * 0.2);

    for (let i = 0; i < 12; i++) {
        const angle = Math.sin(time * 0.1 + i) * 0.15 - 0.45;
        const xPos = width * (0.05 + i * 0.12);
        const rayWidth = 80 + Math.sin(time * 0.4 + i) * 50;
        const rayGrad = getCachedTexture('god_ray', 150, c => {
            const grad = c.createLinearGradient(0, 0, 150, 150); // placeholder height
            grad.addColorStop(0, applyAlpha(theme.particleColor, '44'));
            grad.addColorStop(0.5, applyAlpha(theme.particleColor, '15'));
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
    ctx.globalCompositeOperation = 'lighter';
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

    ctx.globalCompositeOperation = 'lighter';
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

    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < aliveCount; i++) {
        const depthFactor = (1 - layer[i] * 0.25);
        const wind = Math.sin(time * 0.3 + py[i] * 0.001) * 15;
        px[i] += (vx[i] + wind * 0.05) * depthFactor;
        py[i] += (vy[i] + Math.cos(time * 0.2) * 0.2) * depthFactor;

        if (px[i] < -100) px[i] = width + 100;
        if (px[i] > width + 100) px[i] = -100;
        if (py[i] < -100) py[i] = height + 100;
        if (py[i] > height + 100) py[i] = -100;

        const alpha = (0.3 + (1 - layer[i] * 0.2) * 0.5) * (0.7 + Math.sin(time + phase[i]) * 0.3);
        ctx.globalAlpha = alpha;

        const glowSize = size[i] * (1.2 + Math.sin(time * 2 + phase[i]) * 0.4);
        ctx.drawImage(floatGlowTexture, px[i] - glowSize, py[i] - glowSize, glowSize * 2, glowSize * 2);

        ctx.globalAlpha = alpha * 0.8;
        const coreSize = size[i] * 0.15 * 2;
        ctx.drawImage(floatCoreTex, px[i] - coreSize * 0.5, py[i] - coreSize * 0.5, coreSize, coreSize);
    }
}

function drawSnow(theme: ThemeConfig) {
    const fogGrad = getCachedTexture('snow_fog', 256, c => {
        const grad = c.createLinearGradient(0, 0, 0, 256);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(1, applyAlpha(theme.color3, '66'));
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

    ctx.strokeStyle = applyAlpha(theme.gridColor, '55');
    ctx.lineWidth = 1.5;

    const pTime = (time * 0.125) % 3;
    const isRadial = pTime < 1;
    const isLinear = pTime >= 1 && pTime < 2;

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
                ctx.strokeStyle = applyAlpha(theme.particleColor, Math.floor(pulse * 255).toString(16).padStart(2, '0'));
                ctx.lineWidth = 2.5;
            } else {
                ctx.strokeStyle = applyAlpha(theme.gridColor, '22');
                ctx.lineWidth = 1;
            }

            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i;
                const hx = x + Math.cos(angle) * size_;
                const hy = py_ + Math.sin(angle) * size_;
                if (i === 0) ctx.moveTo(hx, hy);
                else ctx.lineTo(hx, hy);
            }
            ctx.closePath();
            ctx.stroke();

            if (pulse > 0.92) {
                ctx.fillStyle = theme.particleColor;
                ctx.globalAlpha = (pulse - 0.9) * 10;
                ctx.beginPath();
                ctx.arc(x, py_, 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1.0;
            }
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

    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(sunGlowGrad, width / 2 - sunR * 1.5 * sunPulse, horizon - sunR * 1.5 * sunPulse, sunR * 3 * sunPulse, sunR * 1.5 * sunPulse);

    const coreGrad = ctx.createLinearGradient(0, horizon - sunR, 0, horizon);
    coreGrad.addColorStop(0, theme.color3);
    coreGrad.addColorStop(1, theme.color2);
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(width / 2, horizon, sunR * sunPulse, Math.PI, 0, false);
    ctx.fillStyle = coreGrad;
    ctx.fill();

    for (let l = 2; l >= 0; l--) {
        const mHeight = height * (0.12 + l * 0.08);
        const mCount = 3 + l;
        const mWidth = width / mCount;

        const mountainGrad = ctx.createLinearGradient(0, horizon - mHeight, 0, horizon);
        mountainGrad.addColorStop(0, applyAlpha(theme.color2, '44'));
        mountainGrad.addColorStop(1, '#000000');

        ctx.fillStyle = mountainGrad;
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
    const shimmerAlpha = (Math.sin(time * 1.5) * 0.05 + 0.15).toFixed(2);
    const shimmerGrad = ctx.createLinearGradient(0, floorY - 50, 0, floorY + 100);
    shimmerGrad.addColorStop(0, 'transparent');
    shimmerGrad.addColorStop(0.4, applyAlpha(theme.color3, Math.floor(255 * parseFloat(shimmerAlpha)).toString(16).padStart(2, '0')));
    shimmerGrad.addColorStop(1, 'transparent');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = shimmerGrad;
    ctx.fillRect(0, floorY - 50, width, 150);

    ctx.globalCompositeOperation = 'source-over';
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
    if (!isRunning || !ctx || !currentTheme) return;

    // Calculate delta and time
    if (lastTimestamp === 0) lastTimestamp = timestamp;
    lastTimestamp = timestamp;
    time = timestamp * 0.001;

    // Base background gradient
    const gradOffset = Math.sin(time * 0.5) * height * 0.2;
    const bgGrad = ctx.createLinearGradient(0, gradOffset, width, height - gradOffset);
    bgGrad.addColorStop(0, currentTheme.color1);
    bgGrad.addColorStop(0.5, currentTheme.color2);
    bgGrad.addColorStop(1, currentTheme.color3);

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

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

    requestAnimationFrame(render);
}

// --- Message Listener ---
self.onmessage = (e: MessageEvent) => {
    const data = e.data;
    switch (data.type) {
        case 'INIT':
            canvas = data.canvas;
            ctx = canvas.getContext('2d', { alpha: false }) as OffscreenCanvasRenderingContext2D;
            width = data.width;
            height = data.height;
            pixelRatio = data.pixelRatio;
            canvas.width = width;
            canvas.height = height;
            ctx.scale(pixelRatio, pixelRatio);
            width /= pixelRatio;
            height /= pixelRatio;
            break;

        case 'RESIZE':
            width = data.width;
            height = data.height;
            if (canvas) {
                canvas.width = width;
                canvas.height = height;
                ctx.scale(pixelRatio, pixelRatio);
                width /= pixelRatio;
                height /= pixelRatio;
            }
            if (currentTheme) {
                initPattern(currentTheme.pattern); // Re-distribute particles on resize
            }
            break;

        case 'SET_THEME':
            currentTheme = data.theme;
            if (currentTheme) {
                initPattern(currentTheme.pattern);
                if (!isRunning) {
                    isRunning = true;
                    requestAnimationFrame(render);
                }
            }
            break;
    }
};

