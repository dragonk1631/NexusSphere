import type { IBackgroundPattern, PatternContext } from '../PatternRegistry';

export class SunsetPattern implements IBackgroundPattern {
    public readonly id = 'sunset';

    public init(ctx: PatternContext): void {
        const { width, height, buffers, spawn } = ctx;
        const { px, py, size, vx, vy, phase, custom1 } = buffers;

        for (let i = 0; i < 24; i++) {
            const id = spawn();
            if (id === -1) break;
            px[id] = Math.random() * width;
            py[id] = Math.random() * (height * 0.7);
            size[id] = 200 + Math.random() * 450;
            vx[id] = 0.25 + Math.random() * 0.75; 
            phase[id] = Math.random() * Math.PI * 2;
            custom1[id] = 0; // Cloud-like blobs
        }
        for (let i = 0; i < 100; i++) {
            const id = spawn();
            if (id === -1) break;
            px[id] = Math.random() * width;
            py[id] = Math.random() * height;
            size[id] = 1.5 + Math.random() * 6.5;
            vx[id] = 1.5 + Math.random() * 8.0;
            vy[id] = (Math.random() - 0.5) * 0.4;
            phase[id] = Math.random() * Math.PI * 2;
            custom1[id] = 1; // Speed lines/particles
        }
    }

    public draw(ctx: PatternContext): void {
        const { ctx: context, width, theme, aliveCount, buffers, setCompositeOperation } = ctx;
        const { px, py, vx, size, phase, custom1 } = buffers;

        setCompositeOperation('source-over');
        for (let i = 0; i < aliveCount; i++) {
            if (custom1[i] === 0) {
                px[i] += vx[i];
                if (px[i] > width + size[i]) px[i] = -size[i];
                const s = size[i];
                // Increased opacity (0.12 - 0.22 range) for better visibility
                const alpha = 0.12 + Math.sin(ctx.time * 0.2 + phase[i]) * 0.1;
                context.globalAlpha = alpha;
                context.fillStyle = theme.color2; 
                context.beginPath();
                context.ellipse(px[i], py[i], s, s * 0.35, 0, 0, Math.PI * 2);
                context.fill();
            } else {
                px[i] += vx[i];
                if (px[i] > width + 15) px[i] = -15;
                // Sustained visibility for speed lines
                context.globalAlpha = 0.35;
                context.fillStyle = theme.color3;
                context.fillRect(px[i], py[i], size[i], size[i] * 0.25);
            }
        }
    }
}
