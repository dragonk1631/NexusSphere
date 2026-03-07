import { ThemeManager, type ThemeConfig } from '../ThemeManager';
import { ScreenUtils } from '../utils/ScreenUtils';

interface Particle {
    x: number;
    y: number;
    z?: number; // Depth for parallax
    s?: number; // size/radius
    s2?: number; // secondary size
    vx?: number;
    vy?: number;
    a?: number;  // alpha/angle
    va?: number; // angular velocity
    c?: string;  // color
    layer?: number;
    phase?: number; // oscillation phase
    type?: string;
}

export class BackgroundRenderer {
    private static instance: BackgroundRenderer | null = null;
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private time: number = 0;

    private particles: Particle[] = [];
    private activePattern: string = '';

    private constructor() {
        this.canvas = document.getElementById('global-bg') as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d', { alpha: false })!;

        // Initial setup
        setTimeout(() => {
            this.resize();
            this.render = this.render.bind(this);
            requestAnimationFrame(this.render);
        }, 0);
    }

    public static getInstance(): BackgroundRenderer {
        if (!BackgroundRenderer.instance) {
            BackgroundRenderer.instance = new BackgroundRenderer();
        }
        return BackgroundRenderer.instance;
    }

    public resize() {
        if (!this.canvas) return;
        const { width, height } = ScreenUtils.getVirtualDimensions();
        this.canvas.width = width;
        this.canvas.height = height;
        // Force re-init of pattern on resize
        this.activePattern = '';
    }

    private initPattern(pattern: string, w: number, h: number) {
        this.activePattern = pattern;
        this.particles = [];

        switch (pattern) {
            case 'stars':
                // Matrix Standard: High Density Multi-layer (500+ particles)
                for (let layer = 0; layer < 4; layer++) {
                    const count = layer === 0 ? 400 : 150 - layer * 30; // Layer 0: fine space dust
                    for (let i = 0; i < count; i++) {
                        this.particles.push({
                            x: Math.random() * w,
                            y: Math.random() * h,
                            z: layer + 1,
                            s: layer === 0 ? Math.random() * 0.4 : (4 - layer) * 0.7 + Math.random(),
                            vy: (0.15 / (layer + 1)) + Math.random() * 0.04,
                            phase: Math.random() * Math.PI * 2,
                            layer: layer
                        });
                    }
                }
                break;
            case 'bubbles':
                for (let i = 0; i < 80; i++) {
                    const layer = Math.floor(Math.random() * 3);
                    this.particles.push({
                        x: Math.random() * w,
                        y: h + Math.random() * h,
                        s: (Math.random() * 30 + 5) * (1 - layer * 0.2),
                        vy: -(Math.random() * 1.5 + 0.5) * (1 - layer * 0.2),
                        vx: (Math.random() - 0.5) * 0.8,
                        a: Math.random() * Math.PI * 2,
                        phase: Math.random() * Math.PI * 2,
                        layer: layer
                    });
                }
                break;
            case 'embers':
                for (let i = 0; i < 200; i++) {
                    const layer = Math.floor(Math.random() * 3);
                    this.particles.push({
                        x: Math.random() * w,
                        y: h + Math.random() * h,
                        s: Math.random() * 3 + 1,
                        vy: -(Math.random() * 4 + 2) * (1 - layer * 0.2),
                        vx: (Math.random() - 0.5) * 3,
                        phase: Math.random() * Math.PI * 2,
                        layer: layer
                    });
                }
                break;
            case 'bokeh':
                // Matrix Standard: Volumetric Soft Focus (120+ particles)
                for (let i = 0; i < 120; i++) {
                    const layer = Math.floor(Math.random() * 3);
                    this.particles.push({
                        x: Math.random() * w,
                        y: Math.random() * h,
                        s: (Math.random() * 120 + 40) * (1 - layer * 0.25),
                        vx: (Math.random() - 0.5) * 0.4,
                        vy: (Math.random() - 0.5) * 0.4,
                        a: Math.random() * 0.3 + 0.05,
                        phase: Math.random() * Math.PI * 2,
                        layer: layer
                    });
                }
                break;
            case 'floating':
                // Matrix Standard: Atmospheric Flow (100+ particles)
                for (let i = 0; i < 100; i++) {
                    const layer = Math.floor(Math.random() * 3);
                    this.particles.push({
                        x: Math.random() * w,
                        y: Math.random() * h,
                        s: (Math.random() * 35 + 15) * (1 - layer * 0.22),
                        vx: (Math.random() * 0.8 + 0.5) * (1 - layer * 0.15),
                        vy: (Math.random() - 0.5) * 0.5,
                        a: Math.random() * Math.PI * 2,
                        va: (Math.random() - 0.5) * 0.03,
                        phase: Math.random() * Math.PI * 2,
                        layer: layer
                    });
                }
                break;
            case 'matrix':
                const cols = Math.floor(w / 22);
                for (let i = 0; i < cols; i++) {
                    this.particles.push({
                        x: i * 22,
                        y: Math.random() * h * 2 - h,
                        vy: Math.random() * 5 + 3,
                        s: Math.floor(Math.random() * 12 + 8),
                        layer: Math.floor(Math.random() * 3)
                    });
                }
                break;
            case 'grid3d':
                for (let i = 0; i < 40; i++) {
                    this.particles.push({
                        x: Math.random() * w,
                        y: Math.random() * h,
                        z: Math.random() * 500 + 50,
                        vy: Math.random() * 3 + 1,
                        s: Math.random() * 2 + 1,
                        layer: Math.floor(Math.random() * 2)
                    });
                }
                break;
            case 'scanlines':
                // For "Atmospheric Gliders" in Sunset theme
                for (let i = 0; i < 30; i++) {
                    this.particles.push({
                        x: Math.random() * w,
                        y: Math.random() * h * 0.5, // Only in sky
                        vx: Math.random() * 2 + 1,
                        s: Math.random() * 2 + 1,
                        layer: Math.floor(Math.random() * 3)
                    });
                }
                break;
            case 'snow':
                // Winter Snow: High density snowflakes and frost fog
                for (let i = 0; i < 150; i++) {
                    const layer = Math.floor(Math.random() * 3);
                    this.particles.push({
                        x: Math.random() * w,
                        y: Math.random() * h,
                        s: Math.random() * 3 + 1,
                        vy: (Math.random() * 1.5 + 0.5) * (1 - layer * 0.2),
                        vx: (Math.random() - 0.5) * 0.5,
                        phase: Math.random() * Math.PI * 2,
                        layer: layer
                    });
                }
                break;
        }
    }

    private applyAlpha(color: string, alpha: string): string {
        if (!color) return 'transparent';
        if (color.startsWith('rgba')) {
            const alphaFloat = (parseInt(alpha, 16) / 255).toFixed(2);
            return color.replace(/[\d.]+\)$/, `${alphaFloat})`);
        }
        if (color.startsWith('rgb')) {
            const alphaFloat = (parseInt(alpha, 16) / 255).toFixed(2);
            return color.replace('rgb', 'rgba').replace(')', `, ${alphaFloat})`);
        }
        // Assume hex
        return color.slice(0, 7) + alpha;
    }

    private render(timestamp: number) {
        this.time = timestamp * 0.001;
        if (!this.canvas || !this.ctx) return;

        const w = this.canvas.width;
        const h = this.canvas.height;
        const theme = ThemeManager.getInstance().getCurrentTheme();

        if (this.activePattern !== theme.pattern) {
            this.initPattern(theme.pattern, w, h);
        }

        // 1. Draw base gradient regardless of pattern
        const gradOffset = Math.sin(this.time * 0.5) * h * 0.2;
        const bgGrad = this.ctx.createLinearGradient(0, gradOffset, w, h - gradOffset);
        bgGrad.addColorStop(0, theme.color1);
        bgGrad.addColorStop(0.5, theme.color2);
        bgGrad.addColorStop(1, theme.color3);
        this.ctx.fillStyle = bgGrad;
        this.ctx.fillRect(0, 0, w, h);

        // 2. Draw active pattern
        this.ctx.save();
        switch (theme.pattern) {
            case 'stars': this.drawStars(h, theme); break;
            case 'grid3d': this.drawGrid3D(w, h, theme); break;
            case 'scanlines': this.drawScanlines(w, h, theme); break;
            case 'matrix': this.drawMatrix(h, theme); break;
            case 'waves': this.drawWaves(w, h, theme); break;
            case 'bubbles': this.drawBubbles(w, h, theme); break;
            case 'embers': this.drawEmbers(w, h, theme); break;
            case 'bokeh': this.drawBokeh(w, h, theme); break;
            case 'hexagons': this.drawHexagons(w, h, theme); break;
            case 'floating': this.drawFloating(w, h, theme); break;
            case 'snow': this.drawSnow(w, h, theme); break;
        }
        this.ctx.restore();
        requestAnimationFrame(this.render);
    }

    // --- Pattern Rendering Methods ---

    private drawStars(h: number, theme: ThemeConfig) {
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'lighter';

        // 1. Multi-layered Volumetric Nebula (Standard Matrix Depth)
        const w = this.canvas.width;
        for (let i = 0; i < 4; i++) {
            const nx = (this.time * 12 + i * 1200) % (w + 1000) - 500;
            const ny = h * (0.15 + i * 0.25);
            const nSize = 500 + i * 250;
            const nGrad = this.ctx.createRadialGradient(nx, ny, 0, nx, ny, nSize);
            const alphaVal = i % 2 === 0 ? '09' : '06';
            nGrad.addColorStop(0, this.applyAlpha(theme.color2, alphaVal));
            nGrad.addColorStop(0.5, this.applyAlpha(theme.color1, '03'));
            nGrad.addColorStop(1, 'transparent');

            this.ctx.fillStyle = nGrad;
            this.ctx.beginPath();
            this.ctx.arc(nx, ny, nSize, 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.particles.forEach(p => {
            // High-Precision Parallax based on Z
            p.y += p.vy! * (5 - p.z!);
            if (p.y > h) p.y = -20;

            const flicker = Math.sin(this.time * (1.5 + p.z!) + p.phase!) * 0.45 + 0.55;
            const depthAlpha = 0.08 + (4 - p.z!) * 0.22;

            this.ctx.fillStyle = theme.particleColor;
            this.ctx.globalAlpha = flicker * depthAlpha;

            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.s!, 0, Math.PI * 2);
            this.ctx.fill();

            // Shooting Star Trails (High Altitude - Layer 1 Only)
            if (p.z === 1 && Math.sin(this.time * 0.08 + p.x) > 0.9992) {
                const trailLen = 150;
                const grad = this.ctx.createLinearGradient(p.x, p.y, p.x - trailLen * 0.8, p.y + trailLen * 0.6);
                grad.addColorStop(0, '#FFFFFF');
                grad.addColorStop(0.2, theme.particleColor);
                grad.addColorStop(1, 'transparent');

                this.ctx.strokeStyle = grad;
                this.ctx.lineWidth = 1.5;
                this.ctx.beginPath();
                this.ctx.moveTo(p.x, p.y);
                this.ctx.lineTo(p.x - trailLen * 0.8, p.y + trailLen * 0.6);
                this.ctx.stroke();
            }
        });
        this.ctx.restore();
    }

    private drawGrid3D(w: number, h: number, theme: ThemeConfig) {
        const horizon = h * 0.45;
        const fov = 420;
        const speed = (this.time * 150) % 100;

        this.ctx.save();

        // 1. Sophisticated Atmospheric Scattering (Horizon Glow)
        const bloomLayers = 5;
        for (let i = 0; i < bloomLayers; i++) {
            const glowHeight = 40 >> i;
            const bloomGrad = this.ctx.createLinearGradient(0, horizon - glowHeight * 0.5, 0, horizon + glowHeight);
            const alpha = (0.2 / (i + 1)).toFixed(2);
            bloomGrad.addColorStop(0, 'transparent');
            bloomGrad.addColorStop(0.5, this.applyAlpha(theme.particleColor, Math.floor(255 * parseFloat(alpha)).toString(16).padStart(2, '0')));
            bloomGrad.addColorStop(1, 'transparent');

            this.ctx.globalCompositeOperation = 'lighter';
            this.ctx.fillStyle = bloomGrad;
            this.ctx.fillRect(0, horizon - glowHeight * 0.5, w, glowHeight * 1.5);
        }

        // 2. High-Precision Perspective Grid
        this.ctx.strokeStyle = this.applyAlpha(theme.gridColor, '44');
        this.ctx.lineWidth = 1.2;

        // Vertical lines (Converging to a vanishing point above horizon for depth)
        for (let x = -w * 1; x <= w * 2; x += 180) {
            this.ctx.beginPath();
            const startX = w / 2 + (x - w / 2) * 0.02;
            this.ctx.moveTo(startX, horizon);
            this.ctx.lineTo(x, h);
            this.ctx.stroke();
        }

        // Horizontal lines with exponential spacing (Perspective Distortion)
        for (let i = 0; i < 15; i++) {
            const z = ((i * 40 + speed) % 600);
            if (z <= 0) continue;

            const py = horizon + (fov / z) * (h - horizon);
            if (py > horizon && py < h) {
                const zAlpha = 1 - (z / 600);
                this.ctx.globalAlpha = zAlpha * 0.5;
                this.ctx.lineWidth = 0.5 + zAlpha * 1.5;
                this.ctx.beginPath();
                this.ctx.moveTo(0, py);
                this.ctx.lineTo(w, py);
                this.ctx.stroke();
            }
        }

        // 3. Sophisticated FUI Elements (Subtle Data Streams)
        this.ctx.font = '9px monospace';
        this.ctx.fillStyle = this.applyAlpha(theme.particleColor, '33');
        const scrollSpeed = this.time * 20;
        for (let i = 0; i < 5; i++) {
            const fx = (i * w / 4 + scrollSpeed) % w;
            const fy = horizon - 10;
            const hexCode = `0x${Math.floor(this.time * 1000 + i).toString(16).toUpperCase()}`;
            this.ctx.fillText(`SYS_SCAN_CORE: ${hexCode}`, fx, fy);
        }

        // 4. Data Packets with Motion Persistence (Trails)
        this.particles.forEach(p => {
            p.z! -= p.vy! * 2.5;
            if (p.z! <= 10) {
                p.z = 600;
                p.x = Math.random() * w;
            }

            const scale = fov / p.z!;
            const px = (p.x - w / 2) * scale + w / 2;
            const py = horizon + scale * (h - horizon);

            if (py > horizon && py < h) {
                const alpha = Math.min(1, 1 - (p.z! / 600));
                const size = scale * 5;

                this.ctx.save();
                this.ctx.globalCompositeOperation = 'lighter';

                // Motion Trail
                const trailGrad = this.ctx.createLinearGradient(px, py - size * 6, px, py);
                trailGrad.addColorStop(0, 'transparent');
                trailGrad.addColorStop(1, this.applyAlpha(theme.particleColor, '66'));
                this.ctx.fillStyle = trailGrad;
                this.ctx.globalAlpha = alpha * 0.6;
                this.ctx.fillRect(px - size * 0.5, py - size * 6, size, size * 6);

                // Core Head
                this.ctx.fillStyle = '#FFFFFF';
                this.ctx.globalAlpha = alpha;
                this.ctx.fillRect(px - size * 0.5, py - size * 0.5, size, size);

                // Subtle secondary glow
                this.ctx.shadowBlur = size * 2;
                this.ctx.shadowColor = theme.particleColor;
                this.ctx.fillRect(px - size * 0.3, py - size * 0.3, size * 0.6, size * 0.6);

                this.ctx.restore();
            }
        });

        this.ctx.restore();
    }

    private drawScanlines(w: number, h: number, theme: ThemeConfig) {
        const horizon = h * 0.55;
        const sunR = Math.min(w, h) * 0.35;
        const sunYPos = horizon; // Align sun center exactly to horizon

        this.ctx.save();

        // 1. Serene Pulsing Sun (Soft & Organic Half-Sun)
        const sunPulse = Math.sin(this.time * 0.8) * 0.03 + 1;
        const sunGlowGrad = this.ctx.createRadialGradient(w / 2, sunYPos, sunR * 0.2, w / 2, sunYPos, sunR * 1.5 * sunPulse);
        sunGlowGrad.addColorStop(0, this.applyAlpha(theme.color3, '66'));
        sunGlowGrad.addColorStop(0.5, this.applyAlpha(theme.color2, '22'));
        sunGlowGrad.addColorStop(1, 'transparent');

        this.ctx.globalCompositeOperation = 'screen';
        this.ctx.fillStyle = sunGlowGrad;
        this.ctx.fillRect(0, 0, w, horizon); // Restrict glow to sky area

        // Core Sun Body (Semicircle on horizon)
        const coreGrad = this.ctx.createLinearGradient(0, sunYPos - sunR, 0, sunYPos);
        coreGrad.addColorStop(0, theme.color3);
        coreGrad.addColorStop(1, theme.color2);
        this.ctx.globalAlpha = 0.9;
        this.ctx.beginPath();
        // Draw top half only: from PI to 0 (clockwise=false implies going from left to right over the top)
        this.ctx.arc(w / 2, sunYPos, sunR * sunPulse, Math.PI, 0, false);
        this.ctx.fillStyle = coreGrad;
        this.ctx.fill();

        // 2. Static Majestic Mountains (No movement)
        for (let layer = 2; layer >= 0; layer--) {
            const mHeight = h * (0.12 + layer * 0.08);
            const mCount = 3 + layer;
            const mWidth = w / mCount;

            this.ctx.save();
            const mountainGrad = this.ctx.createLinearGradient(0, horizon - mHeight, 0, horizon);
            mountainGrad.addColorStop(0, this.applyAlpha(theme.color2, '44'));
            mountainGrad.addColorStop(1, '#000000');

            this.ctx.fillStyle = mountainGrad;
            this.ctx.strokeStyle = this.applyAlpha(theme.gridColor, '33');
            this.ctx.lineWidth = 1;

            this.ctx.beginPath();
            this.ctx.moveTo(-100, horizon);

            for (let i = 0; i <= mCount; i++) {
                const mx = i * mWidth;
                const mSeed = (i + layer * 5) * 2.1;
                const mh = (Math.sin(mSeed) * 0.5 + 0.5) * mHeight;
                this.ctx.lineTo(mx, horizon - mh);
                this.ctx.lineTo(mx + mWidth * 0.5, horizon);
            }

            this.ctx.lineTo(w + 100, horizon);
            this.ctx.fill();
            this.ctx.stroke();
            this.ctx.restore();
        }

        // 3. Static Perspective Floor with Horizon Shimmer
        const floorY = horizon;

        // Soft Horizon Shimmer (Dynamic Light Scattering)
        const shimmerAlpha = (Math.sin(this.time * 1.5) * 0.05 + 0.15).toFixed(2);
        const shimmerGrad = this.ctx.createLinearGradient(0, floorY - 50, 0, floorY + 100);
        shimmerGrad.addColorStop(0, 'transparent');
        shimmerGrad.addColorStop(0.4, this.applyAlpha(theme.color3, Math.floor(255 * parseFloat(shimmerAlpha)).toString(16).padStart(2, '0')));
        shimmerGrad.addColorStop(1, 'transparent');
        this.ctx.globalCompositeOperation = 'lighter';
        this.ctx.fillStyle = shimmerGrad;
        this.ctx.fillRect(0, floorY - 50, w, 150);

        // Static Grid Lines
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.strokeStyle = this.applyAlpha(theme.gridColor, '22');

        // Verticals
        for (let x = -w * 0.5; x <= w * 1.5; x += 150) {
            this.ctx.beginPath();
            this.ctx.moveTo(w / 2 + (x - w / 2) * 0.1, floorY);
            this.ctx.lineTo(x, h);
            this.ctx.stroke();
        }

        // Horizontals (Static Perspective)
        for (let i = 0; i < 10; i++) {
            const py = floorY + Math.pow(i / 10, 2) * (h - floorY);
            const alpha = (i / 10) * 0.3;
            this.ctx.globalAlpha = alpha;
            this.ctx.beginPath();
            this.ctx.moveTo(0, py);
            this.ctx.lineTo(w, py);
            this.ctx.stroke();
        }

        // 4. Organic "Light Dust" Particles (Soft moving motes)
        this.particles.forEach(p => {
            if (p.vx) {
                // Organic drift
                p.x = (p.x + p.vx! * 0.3) % (w + 400);
                p.y += Math.sin(this.time * 0.5 + p.x * 0.01) * 0.2; // Vertical float

                const driftAlpha = (0.2 + (3 - p.layer!) * 0.1) * (0.7 + Math.sin(this.time * 0.8 + p.x * 0.005) * 0.3);
                this.ctx.fillStyle = theme.particleColor;
                this.ctx.globalAlpha = driftAlpha;

                const size = 2 + (3 - p.layer!) * 1.5;
                this.ctx.beginPath();
                this.ctx.arc(p.x - 200, p.y, size, 0, Math.PI * 2);
                this.ctx.fill();

                // Subtle Soft Glow
                this.ctx.globalAlpha = driftAlpha * 0.3;
                this.ctx.beginPath();
                this.ctx.arc(p.x - 200, p.y, size * 2.5, 0, Math.PI * 2);
                this.ctx.fill();
            }
        });

        this.ctx.restore();
    }

    private drawMatrix(h: number, theme: ThemeConfig) {
        this.ctx.font = 'bold 18px monospace';
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*";

        this.particles.forEach((p) => {
            p.y += p.vy! * (1 + (3 - p.layer!) * 0.2); // Speed variation by depth
            if (p.y > h + p.s! * 22) {
                p.y = -p.s! * 22;
                p.vy = Math.random() * 5 + 3;
            }

            const alphaScale = 1 - (p.layer! / 4); // Depth-based alpha

            for (let j = 0; j < p.s!; j++) {
                const charY = p.y - j * 22;
                if (charY > -20 && charY < h + 20) {
                    let char = chars[Math.floor(Math.random() * chars.length)];
                    if (Math.random() > 0.985) char = chars[Math.floor(Math.random() * chars.length)];

                    const charAlpha = 1 - (j / p.s!);

                    if (j === 0) {
                        this.ctx.save();
                        this.ctx.globalCompositeOperation = 'lighter';
                        const headGlow = this.ctx.createRadialGradient(p.x + 9, charY - 9, 0, p.x + 9, charY - 9, 20);
                        headGlow.addColorStop(0, '#FFFFFF');
                        headGlow.addColorStop(0.5, theme.particleColor + '66');
                        headGlow.addColorStop(1, 'transparent');
                        this.ctx.fillStyle = headGlow;
                        this.ctx.beginPath();
                        this.ctx.arc(p.x + 9, charY - 9, 20, 0, Math.PI * 2);
                        this.ctx.fill();
                        this.ctx.restore();

                        this.ctx.fillStyle = '#FFFFFF';
                        this.ctx.globalAlpha = alphaScale;
                    } else {
                        this.ctx.fillStyle = theme.particleColor;
                        this.ctx.globalAlpha = charAlpha * 0.7 * alphaScale;
                    }

                    this.ctx.fillText(char, p.x, charY);
                }
            }
        });
    }

    private drawWaves(w: number, h: number, theme: ThemeConfig) {
        this.ctx.save();
        const moonX = w * 0.8;
        const moonY = h * 0.25;
        const moonR = 120;

        const moonGrad = this.ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, moonR);
        moonGrad.addColorStop(0, theme.color3 + '88');
        moonGrad.addColorStop(0.7, theme.color2 + '44');
        moonGrad.addColorStop(1, 'transparent');

        this.ctx.globalCompositeOperation = 'lighter';
        this.ctx.fillStyle = moonGrad;
        this.ctx.beginPath();
        this.ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.globalCompositeOperation = 'screen';
        for (let i = 0; i < 6; i++) {
            const layerY = h * (0.35 + i * 0.1);
            const speed = this.time * (0.5 + i * 0.25);
            const amp = 10 + i * 15;
            const freq = 0.004 + i * 0.001;

            const waveGrad = this.ctx.createLinearGradient(0, layerY - amp, 0, layerY + amp * 2);
            waveGrad.addColorStop(0, this.applyAlpha(theme.gridColor, 'CC'));
            waveGrad.addColorStop(1, 'transparent');

            this.ctx.strokeStyle = waveGrad;
            this.ctx.lineWidth = 1 + i * 0.5;
            this.ctx.globalAlpha = 0.2 + (i * 0.12);
            this.ctx.beginPath();

            for (let x = 0; x <= w; x += 15) {
                const waveY = Math.sin((x * freq) + speed + (i * 1.2)) * amp;
                if (x === 0) this.ctx.moveTo(x, layerY + waveY);
                else this.ctx.lineTo(x, layerY + waveY);

                if (i > 2 && Math.sin(this.time * 6 + x * 0.05) > 0.985) {
                    this.ctx.save();
                    this.ctx.fillStyle = '#FFFFFF';
                    this.ctx.globalAlpha = 0.8;
                    const sparkleSize = 1.5 + Math.random();
                    this.ctx.fillRect(x, layerY + waveY - 1, sparkleSize, sparkleSize);
                    this.ctx.restore();
                }
            }
            this.ctx.stroke();
        }
        this.ctx.restore();
    }

    private drawBubbles(w: number, h: number, theme: ThemeConfig) {
        this.ctx.save();

        // 1. Surface Bloom (New High-Quality Boundary)
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'lighter';
        const surfaceGrad = this.ctx.createLinearGradient(0, 0, 0, h * 0.2);
        surfaceGrad.addColorStop(0, this.applyAlpha(theme.particleColor, 'AA'));
        surfaceGrad.addColorStop(0.5, this.applyAlpha(theme.particleColor, '33'));
        surfaceGrad.addColorStop(1, 'transparent');
        this.ctx.fillStyle = surfaceGrad;
        this.ctx.fillRect(0, 0, w, h * 0.2);
        this.ctx.restore();

        // 2. Matrix Standard Underwater Depth (Enhanced God Rays)
        this.ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 12; i++) {
            const angle = Math.sin(this.time * 0.1 + i) * 0.15 - 0.45;
            const xPos = w * (0.05 + i * 0.12);
            const rayWidth = 80 + Math.sin(this.time * 0.4 + i) * 50;

            const rayGrad = this.ctx.createLinearGradient(0, 0, 150, h);
            rayGrad.addColorStop(0, this.applyAlpha(theme.particleColor, '44'));
            rayGrad.addColorStop(0.5, this.applyAlpha(theme.particleColor, '15'));
            rayGrad.addColorStop(1, 'transparent');

            this.ctx.save();
            this.ctx.translate(xPos, -80);
            this.ctx.rotate(angle);
            this.ctx.fillStyle = rayGrad;
            this.ctx.fillRect(-rayWidth / 2, 0, rayWidth, h * 2.2);
            this.ctx.restore();
        }

        this.particles.forEach(p => {
            const depthFactor = (1 - p.layer! * 0.28);
            p.y += p.vy! * depthFactor;
            p.x += Math.sin(this.time * 1.8 + p.phase!) * 1.2 * depthFactor;

            if (p.y < -p.s!) {
                p.y = h + p.s!;
                p.x = Math.random() * w;
            }

            const bAlpha = (0.2 + Math.sin(this.time + p.phase!) * 0.08) * depthFactor;
            this.ctx.globalAlpha = bAlpha;
            this.ctx.strokeStyle = theme.particleColor;
            this.ctx.lineWidth = 0.8 + (1 - p.layer! * 0.2);

            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.s!, 0, Math.PI * 2);
            this.ctx.stroke();

            if (p.layer === 0) {
                this.ctx.save();
                this.ctx.globalAlpha = bAlpha * 0.85;
                this.ctx.fillStyle = '#FFFFFF';
                this.ctx.beginPath();
                this.ctx.ellipse(p.x - p.s! * 0.38, p.y - p.s! * 0.38, p.s! * 0.22, p.s! * 0.32, Math.PI / 4, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.restore();
            }
        });
        this.ctx.restore();
    }

    private drawEmbers(w: number, h: number, theme: ThemeConfig) {
        const heatWave = Math.sin(this.time * 2.0) * 0.05 + 0.08;
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'lighter';
        this.ctx.fillStyle = theme.color2;
        this.ctx.globalAlpha = heatWave;
        this.ctx.fillRect(0, 0, w, h);

        this.particles.forEach(p => {
            const depthFactor = (1 - p.layer! * 0.22);
            p.y += p.vy! * depthFactor;
            p.x += Math.sin(this.time * 1.6 + p.y * 0.008 + p.phase!) * p.vx! * depthFactor;

            if (p.y < -60) {
                p.y = h + 60;
                p.x = Math.random() * w;
            }

            const life = Math.pow(Math.max(0, p.y / h), 1.2);

            if (p.layer === 0) {
                const sSize = 50 + life * 40;
                const sGrad = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, sSize);
                sGrad.addColorStop(0, this.applyAlpha(theme.particleColor, '15'));
                sGrad.addColorStop(0.5, this.applyAlpha(theme.color3, '06'));
                sGrad.addColorStop(1, 'transparent');
                this.ctx.save();
                this.ctx.globalAlpha = life * 0.4;
                this.ctx.fillStyle = sGrad;
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, sSize, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.restore();
            }

            const flicker = Math.sin(this.time * 12 + p.phase!) * 0.35 + 0.65;
            this.ctx.save();
            this.ctx.globalCompositeOperation = 'lighter';
            const emberAlpha = life * flicker * depthFactor;
            this.ctx.fillStyle = life > 0.4 ? theme.particleColor : theme.color2;
            this.ctx.globalAlpha = emberAlpha;

            this.ctx.beginPath();
            const eSize = p.s! * (0.5 + life * 0.7) * (0.8 + flicker * 0.4);
            this.ctx.arc(p.x, p.y, eSize, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        });
        this.ctx.restore();
    }

    private drawBokeh(w: number, h: number, theme: ThemeConfig) {
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'lighter';

        this.particles.forEach(p => {
            p.x += p.vx!;
            p.y += p.vy!;
            if (p.x < -p.s!) p.x = w + p.s!;
            if (p.x > w + p.s!) p.x = -p.s!;
            if (p.y < -p.s!) p.y = h + p.s!;
            if (p.y > h + p.s!) p.y = -p.s!;

            const pulse = Math.sin(this.time * 0.4 + p.phase!) * 0.2 + 0.8;
            const currentSize = p.s! * pulse;
            const alpha = p.a! * (0.6 + Math.sin(this.time * 0.8 + p.phase!) * 0.4);

            const offset = currentSize * 0.06;
            this.ctx.globalAlpha = alpha * 0.4;

            // Blue/Red Aberration
            this.ctx.fillStyle = '#4488FF33';
            this.ctx.beginPath();
            this.ctx.arc(p.x + offset, p.y, currentSize, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.fillStyle = '#FF448833';
            this.ctx.beginPath();
            this.ctx.arc(p.x - offset, p.y, currentSize, 0, Math.PI * 2);
            this.ctx.fill();

            const grad = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, currentSize);
            grad.addColorStop(0, this.applyAlpha(theme.particleColor, '66'));
            grad.addColorStop(0.6, this.applyAlpha(theme.particleColor, '22'));
            grad.addColorStop(1, 'transparent');

            this.ctx.globalAlpha = alpha;
            this.ctx.fillStyle = grad;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, currentSize, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.restore();
    }

    private drawHexagons(w: number, h: number, theme: ThemeConfig) {
        const size = 60;
        const hStep = size * 1.5;
        const vStep = size * Math.sqrt(3);

        this.ctx.save();
        this.ctx.strokeStyle = this.applyAlpha(theme.gridColor, '55');
        this.ctx.lineWidth = 1.5;

        // Random Pattern Logic
        const pTime = (this.time * 0.125) % 3;
        const isRadial = pTime < 1;
        const isLinear = pTime >= 1 && pTime < 2;

        for (let x = -size; x < w + size; x += hStep) {
            const isOdd = Math.floor((x + size) / hStep) % 2 === 1;
            for (let y = -size; y < h + size; y += vStep) {
                const py = isOdd ? y + vStep / 2 : y;

                let pulse = 0;
                if (isRadial) {
                    const dist = Math.sqrt((x - w / 2) ** 2 + (py - h / 2) ** 2);
                    pulse = Math.sin(this.time * 3 - dist * 0.008) * 0.5 + 0.5;
                } else if (isLinear) {
                    pulse = Math.sin(this.time * 4 - (x + py) * 0.005) * 0.5 + 0.5;
                } else {
                    const seed = Math.sin(x * 0.05) * Math.cos(py * 0.05) * 2000;
                    pulse = Math.sin(this.time * 2.5 + seed) * 0.5 + 0.5;
                }

                if (pulse > 0.85) {
                    this.ctx.strokeStyle = this.applyAlpha(theme.particleColor, Math.floor(pulse * 255).toString(16).padStart(2, '0'));
                    this.ctx.lineWidth = 2.5;
                } else {
                    this.ctx.strokeStyle = this.applyAlpha(theme.gridColor, '22');
                    this.ctx.lineWidth = 1;
                }

                this.ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI / 3) * i;
                    const hx = x + Math.cos(angle) * size;
                    const hy = py + Math.sin(angle) * size;
                    if (i === 0) this.ctx.moveTo(hx, hy);
                    else this.ctx.lineTo(hx, hy);
                }
                this.ctx.closePath();
                this.ctx.stroke();

                if (pulse > 0.92) {
                    this.ctx.fillStyle = theme.particleColor;
                    this.ctx.globalAlpha = (pulse - 0.9) * 10;
                    this.ctx.beginPath();
                    this.ctx.arc(x, py, 3, 0, Math.PI * 2);
                    this.ctx.fill();
                }
            }
        }
        this.ctx.restore();
    }

    private drawFloating(w: number, h: number, theme: ThemeConfig) {
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'lighter';

        this.particles.forEach(p => {
            const depthFactor = (1 - p.layer! * 0.25);
            const wind = Math.sin(this.time * 0.3 + p.y * 0.001) * 15;
            p.x += (p.vx! + wind * 0.05) * depthFactor;
            p.y += (p.vy! + Math.cos(this.time * 0.2) * 0.2) * depthFactor;
            p.a! += p.va! || 0;

            if (p.x < -100) p.x = w + 100;
            if (p.x > w + 100) p.x = -100;
            if (p.y < -100) p.y = h + 100;
            if (p.y > h + 100) p.y = -100;

            const alpha = (0.3 + (1 - p.layer! * 0.2) * 0.5) * (0.7 + Math.sin(this.time + p.phase!) * 0.3);
            this.ctx.globalAlpha = alpha;

            const glowSize = p.s! * (1.2 + Math.sin(this.time * 2 + p.phase!) * 0.4);
            const glowGrad = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowSize);
            glowGrad.addColorStop(0, this.applyAlpha(theme.particleColor, 'CC'));
            glowGrad.addColorStop(1, 'transparent');

            this.ctx.fillStyle = glowGrad;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, glowSize, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.globalAlpha = alpha * 0.8;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.s! * 0.15, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.restore();
    }

    private drawSnow(w: number, h: number, theme: ThemeConfig) {
        this.ctx.save();
        const fogGrad = this.ctx.createLinearGradient(0, h * 0.6, 0, h);
        fogGrad.addColorStop(0, 'transparent');
        fogGrad.addColorStop(1, this.applyAlpha(theme.color3, '66'));
        this.ctx.fillStyle = fogGrad;
        this.ctx.fillRect(0, h * 0.6, w, h * 0.4);

        this.ctx.globalCompositeOperation = 'lighter';
        this.particles.forEach(p => {
            const depthFactor = (1 - p.layer! * 0.25);
            p.y += p.vy! * depthFactor;
            p.x += (p.vx! + Math.sin(this.time + p.phase!) * 0.5) * depthFactor;

            if (p.y > h + 20) {
                p.y = -20;
                p.x = Math.random() * w;
            }

            const alpha = (0.4 + (1 - p.layer! * 0.3) * 0.6) * (0.8 + Math.sin(this.time * 1.5 + p.phase!) * 0.2);
            this.ctx.globalAlpha = alpha;
            this.ctx.strokeStyle = theme.particleColor;
            this.ctx.lineWidth = 1.5 - p.layer! * 0.3;

            const size = p.s!;
            this.ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i;
                this.ctx.moveTo(p.x, p.y);
                this.ctx.lineTo(p.x + Math.cos(angle) * size, p.y + Math.sin(angle) * size);

                const bx = p.x + Math.cos(angle) * size * 0.6;
                const by = p.y + Math.sin(angle) * size * 0.6;
                const bAngle1 = angle + Math.PI / 4;
                const bAngle2 = angle - Math.PI / 4;
                this.ctx.moveTo(bx, by);
                this.ctx.lineTo(bx + Math.cos(bAngle1) * size * 0.3, by + Math.sin(bAngle1) * size * 0.3);
                this.ctx.moveTo(bx, by);
                this.ctx.lineTo(bx + Math.cos(bAngle2) * size * 0.3, by + Math.sin(bAngle2) * size * 0.3);
            }
            this.ctx.stroke();

            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.globalAlpha = alpha * 0.5;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, size * 0.2, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.restore();
    }
}
