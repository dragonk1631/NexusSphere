import type { IBackgroundPattern, PatternContext } from '../PatternRegistry';

export class Grid3DPattern implements IBackgroundPattern {
    public readonly id = 'grid3d';
    private cachedGrid3DBloomGrad: CanvasGradient | null = null;
    private cachedGrid3DKey: string = '';

    public init(ctx: PatternContext): void {
        const { width, height, buffers, spawn } = ctx;
        const { px, py, pz, vy, size, layer } = buffers;
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
    }

    public draw(ctx: PatternContext): void {
        const { ctx: context, width, height, time, theme, buffers, getCachedTexture, setCompositeOperation } = ctx;
        const { px, pz, vy } = buffers;

        const horizon = height * 0.45;
        const fov = 420;
        const speed = (time * 150) % 100;

        // 1. Horizon Glow
        const grid3DKey = theme.particleColor + height;
        if (this.cachedGrid3DKey !== grid3DKey) {
            this.cachedGrid3DKey = grid3DKey;
            const glowHeight = 40;
            this.cachedGrid3DBloomGrad = context.createLinearGradient(0, horizon - glowHeight, 0, horizon + glowHeight);
            this.cachedGrid3DBloomGrad.addColorStop(0, 'transparent');
            this.cachedGrid3DBloomGrad.addColorStop(0.5, theme.particleColor.slice(0, 7) + '66');
            this.cachedGrid3DBloomGrad.addColorStop(1, 'transparent');
        }

        setCompositeOperation('lighter');
        context.fillStyle = this.cachedGrid3DBloomGrad!;
        context.fillRect(0, horizon - 40, width, 80);

        // 2. Perspective Grid
        context.strokeStyle = theme.gridColor.slice(0, 7) + '33'; 
        context.lineWidth = 1.2;
        context.beginPath();
        for (let x = -width * 1; x <= width * 2; x += 180) {
            const startX = width / 2 + (x - width / 2) * 0.02;
            context.moveTo(startX, horizon);
            context.lineTo(x, height);
        }
        context.stroke();

        context.beginPath();
        for (let i = 0; i < 15; i++) {
            const z = ((i * 40 + speed) % 600);
            if (z <= 0) continue;
            const py_ = horizon + (fov / z) * (height - horizon);
            if (py_ > horizon && py_ < height) {
                context.moveTo(0, py_);
                context.lineTo(width, py_);
            }
        }
        context.stroke();

        // 3. Data Packets
        const trailTex = getCachedTexture('grid_trail', 64, c => {
            const grad = c.createLinearGradient(32, 0, 32, 64);
            grad.addColorStop(0, 'transparent');
            grad.addColorStop(1, theme.particleColor.slice(0, 7) + '80');
            c.fillStyle = grad;
            c.fillRect(0, 0, 64, 64);
        });

        for (let i = 0; i < ctx.aliveCount; i++) {
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

                context.globalAlpha = alpha * 0.6;
                context.drawImage(trailTex, cx - s * 0.5, cy - s * 6, s, s * 6);

                context.globalAlpha = alpha;
                context.fillStyle = '#FFFFFF';
                context.fillRect(cx - s * 0.5, cy - s * 0.5, s, s);
            }
        }
    }
}
