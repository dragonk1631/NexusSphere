import { ThemeManager, type ThemeConfig } from '../ThemeManager';

interface Particle {
    x: number;
    y: number;
    s?: number; // size/radius
    s2?: number; // secondary size
    vx?: number;
    vy?: number;
    a?: number;  // alpha/angle
    va?: number; // angular velocity
    c?: string;  // color
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
        this.ctx = this.canvas.getContext('2d')!;

        window.addEventListener('resize', this.resize.bind(this));

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

    private resize() {
        if (!this.canvas) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        // Force re-init of pattern on resize
        this.activePattern = '';
    }

    private initPattern(pattern: string, w: number, h: number) {
        this.activePattern = pattern;
        this.particles = [];

        switch (pattern) {
            case 'stars':
                for (let i = 0; i < 150; i++) {
                    this.particles.push({
                        x: Math.random() * w,
                        y: Math.random() * h,
                        s: Math.random() * 2 + 0.5,
                        vy: Math.random() * 0.5 + 0.1
                    });
                }
                break;
            case 'bubbles':
                for (let i = 0; i < 40; i++) {
                    this.particles.push({
                        x: Math.random() * w,
                        y: h + Math.random() * h,
                        s: Math.random() * 40 + 10,
                        vy: -(Math.random() * 1.5 + 0.5),
                        vx: (Math.random() - 0.5) * 1.0,
                        a: Math.random() * Math.PI * 2
                    });
                }
                break;
            case 'embers':
                for (let i = 0; i < 100; i++) {
                    this.particles.push({
                        x: Math.random() * w,
                        y: h + Math.random() * h,
                        s: Math.random() * 4 + 1,
                        vy: -(Math.random() * 3 + 1),
                        vx: (Math.random() - 0.5) * 2
                    });
                }
                break;
            case 'bokeh':
                for (let i = 0; i < 30; i++) {
                    this.particles.push({
                        x: Math.random() * w,
                        y: Math.random() * h,
                        s: Math.random() * 100 + 50,
                        vx: (Math.random() - 0.5) * 0.5,
                        vy: (Math.random() - 0.5) * 0.5,
                        a: Math.random() * 0.5 + 0.1 // target alpha
                    });
                }
                break;
            case 'floating':
                for (let i = 0; i < 20; i++) {
                    this.particles.push({
                        x: Math.random() * w,
                        y: Math.random() * h,
                        s: Math.random() * 60 + 30,
                        vx: (Math.random() - 0.5) * 1,
                        vy: (Math.random() - 0.5) * 1,
                        a: Math.random() * Math.PI * 2,
                        va: (Math.random() - 0.5) * 0.02
                    });
                }
                break;
            case 'matrix':
                const cols = Math.floor(w / 20);
                for (let i = 0; i < cols; i++) {
                    this.particles.push({
                        x: i * 20,
                        y: Math.random() * h * 2 - h,
                        vy: Math.random() * 5 + 2,
                        s: Math.random() * 10 + 10 // length of trail
                    });
                }
                break;
        }
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
        }
        this.ctx.restore();
        requestAnimationFrame(this.render);
    }

    // --- Pattern Rendering Methods ---

    private drawStars(h: number, theme: ThemeConfig) {
        this.ctx.fillStyle = theme.particleColor;
        this.particles.forEach(p => {
            p.y += p.vy!;
            if (p.y > h) p.y = 0;
            const flicker = Math.sin(this.time * 5 + p.x) * 0.5 + 0.5;
            this.ctx.globalAlpha = flicker * 0.8 + 0.2;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.s!, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }

    private drawGrid3D(w: number, h: number, theme: ThemeConfig) {
        this.ctx.strokeStyle = theme.gridColor;
        this.ctx.lineWidth = 2;
        const horizon = h * 0.4;
        const fov = 300;

        // Vertical lines
        this.ctx.beginPath();
        for (let x = -w * 2; x <= w * 3; x += 100) {
            this.ctx.moveTo(w / 2, horizon);
            this.ctx.lineTo(x, h);
        }
        this.ctx.stroke();

        // Horizontal moving lines
        const speed = (this.time * 200) % 50;
        for (let z = 10; z < 500; z += 50) {
            const scaledZ = z - speed;
            if (scaledZ <= 0) continue;
            const py = horizon + (fov / scaledZ) * (h - horizon);
            if (py > horizon && py <= h) {
                this.ctx.beginPath();
                this.ctx.moveTo(0, py);
                this.ctx.lineTo(w, py);
                this.ctx.stroke();
            }
        }
    }

    private drawScanlines(w: number, h: number, theme: ThemeConfig) {
        this.ctx.fillStyle = theme.gridColor;
        const lineH = 4;
        const gap = 4;
        const offset = (this.time * 30) % (lineH + gap);
        for (let y = -offset; y < h; y += lineH + gap) {
            this.ctx.fillRect(0, y, w, lineH);
        }

        // Sun
        this.ctx.globalAlpha = 0.5;
        const grad = this.ctx.createLinearGradient(0, h * 0.2, 0, h * 0.6);
        grad.addColorStop(0, theme.color2);
        grad.addColorStop(1, 'transparent');
        this.ctx.fillStyle = grad;
        this.ctx.beginPath();
        this.ctx.arc(w / 2, h * 0.5, Math.min(w, h) * 0.3, 0, Math.PI * 2);
        this.ctx.fill();
    }

    private drawMatrix(h: number, theme: ThemeConfig) {
        this.ctx.fillStyle = theme.particleColor;
        this.ctx.font = '16px monospace';
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*";

        this.particles.forEach((p) => {
            p.y += p.vy!;
            if (p.y > h + p.s! * 20) {
                p.y = -p.s! * 20;
                p.vy = Math.random() * 5 + 2;
            }

            for (let j = 0; j < p.s!; j++) {
                const charY = p.y - j * 20;
                if (charY > 0 && charY < h) {
                    const char = chars[Math.floor(Math.random() * chars.length)];
                    this.ctx.globalAlpha = 1 - (j / p.s!);
                    this.ctx.fillText(char, p.x, charY);
                }
            }
        });
    }

    private drawWaves(w: number, h: number, theme: ThemeConfig) {
        this.ctx.strokeStyle = theme.gridColor;
        this.ctx.lineWidth = 3;
        for (let y = h * 0.2; y < h * 0.8; y += 40) {
            this.ctx.beginPath();
            for (let x = 0; x <= w; x += 20) {
                const waveY = Math.sin((x * 0.01) + this.time + (y * 0.01)) * 30;
                if (x === 0) this.ctx.moveTo(x, y + waveY);
                else this.ctx.lineTo(x, y + waveY);
            }
            this.ctx.stroke();
        }
    }

    private drawBubbles(w: number, h: number, theme: ThemeConfig) {
        this.ctx.strokeStyle = theme.particleColor;
        this.ctx.lineWidth = 2;
        this.particles.forEach(p => {
            p.y += p.vy!;
            p.x += Math.sin(this.time * p.vy! + p.s!) * 0.5; // gentle sway

            if (p.y < -p.s!) {
                p.y = h + p.s!;
                p.x = Math.random() * w;
            }

            this.ctx.globalAlpha = 0.4;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.s!, 0, Math.PI * 2);
            this.ctx.stroke();
            // Inner highlight
            this.ctx.beginPath();
            this.ctx.arc(p.x - p.s! * 0.3, p.y - p.s! * 0.3, p.s! * 0.2, 0, Math.PI * 2);
            this.ctx.fillStyle = theme.particleColor;
            this.ctx.globalAlpha = 0.2;
            this.ctx.fill();
        });
    }

    private drawEmbers(w: number, h: number, theme: ThemeConfig) {
        this.ctx.fillStyle = theme.particleColor;
        this.particles.forEach(p => {
            p.y += p.vy!;
            p.x += Math.sin(this.time * 2 + p.y * 0.01) * p.vx!;

            if (p.y < -10) {
                p.y = h + 10;
                p.x = Math.random() * w;
            }

            const life = p.y / h; // 1 at bottom, 0 at top
            this.ctx.globalAlpha = life;

            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.s! * life, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }

    private drawBokeh(w: number, h: number, theme: ThemeConfig) {
        this.particles.forEach(p => {
            p.x += p.vx!;
            p.y += p.vy!;
            if (p.x < -p.s! || p.x > w + p.s!) p.vx! *= -1;
            if (p.y < -p.s! || p.y > h + p.s!) p.vy! *= -1;

            const grad = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.s!);
            grad.addColorStop(0, theme.particleColor);
            grad.addColorStop(1, 'transparent');

            // Breathe alpha
            const alpha = p.a! + Math.sin(this.time * 0.5 + p.x) * 0.1;
            this.ctx.globalAlpha = Math.max(0.05, Math.min(0.6, alpha));

            this.ctx.fillStyle = grad;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.s!, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }

    private drawHexagons(w: number, h: number, theme: ThemeConfig) {
        this.ctx.strokeStyle = theme.gridColor;
        this.ctx.lineWidth = 2;

        const size = 40;
        const hexW = Math.sqrt(3) * size;
        const hexH = 2 * size;
        const ySpace = 3 / 4 * hexH;

        const offset = (this.time * 20) % hexH;

        this.ctx.globalAlpha = 0.5;
        for (let r = -2; r < h / ySpace + 2; r++) {
            for (let c = -2; c < w / hexW + 2; c++) {
                let x = c * hexW;
                let y = r * ySpace + offset;
                if (r % 2 !== 0) x += hexW / 2;

                // Pulsate specific hexes
                const isPulsing = Math.sin(r * 2 + c * 3 + this.time * 2) > 0.8;

                this.ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = Math.PI / 3 * i - Math.PI / 6;
                    const hx = x + size * Math.cos(angle);
                    const hy = y + size * Math.sin(angle);
                    if (i === 0) this.ctx.moveTo(hx, hy);
                    else this.ctx.lineTo(hx, hy);
                }
                this.ctx.closePath();

                if (isPulsing) {
                    this.ctx.fillStyle = theme.gridColor;
                    this.ctx.fill();
                } else {
                    this.ctx.stroke();
                }
            }
        }
    }

    private drawFloating(w: number, h: number, theme: ThemeConfig) {
        this.ctx.fillStyle = theme.particleColor;
        this.particles.forEach(p => {
            p.x += p.vx!;
            p.y += p.vy!;
            p.a! += p.va!;

            if (p.x < -p.s!) p.x = w + p.s!;
            if (p.x > w + p.s!) p.x = -p.s!;
            if (p.y < -p.s!) p.y = h + p.s!;
            if (p.y > h + p.s!) p.y = -p.s!;

            this.ctx.save();
            this.ctx.translate(p.x, p.y);
            this.ctx.rotate(p.a!);

            this.ctx.globalAlpha = 0.2;

            // Draw rotated rects
            this.ctx.beginPath();
            this.ctx.roundRect(-p.s! / 2, -p.s! / 2, p.s!, p.s!, p.s! * 0.2);
            this.ctx.fill();

            this.ctx.restore();
        });
    }
}
