import type { IBackgroundPattern, PatternContext } from '../PatternRegistry';

export class BokehPattern implements IBackgroundPattern {
    public readonly id = 'bokeh';

    public init(ctx: PatternContext): void {
        const { width, height, buffers, spawn } = ctx;
        const { px, py, size, vx, vy, life, phase, layer } = buffers;
        for (let i = 0; i < 120; i++) {
            const id = spawn();
            if (id === -1) break;
            const l = Math.floor(Math.random() * 3);
            px[id] = Math.random() * width;
            py[id] = Math.random() * height;
            size[id] = (Math.random() * 120 + 40) * (1 - l * 0.25);
            vx[id] = (Math.random() - 0.5) * 0.4;
            vy[id] = (Math.random() - 0.5) * 0.4;
            life[id] = Math.random() * 0.3 + 0.05; 
            phase[id] = Math.random() * Math.PI * 2;
            layer[id] = l;
        }
    }

    public draw(ctx: PatternContext): void {
        const { ctx: context, width, height, time, theme, aliveCount, buffers, setCompositeOperation } = ctx;
        const { px, py, vx, vy, size, life, phase } = buffers;

        setCompositeOperation('lighter');
        for (let i = 0; i < aliveCount; i++) {
            px[i] += vx[i];
            py[i] += vy[i];
            if (px[i] < -size[i]) px[i] = width + size[i];
            if (px[i] > width + size[i]) px[i] = -size[i];
            if (py[i] < -size[i]) py[i] = height + size[i];
            if (py[i] > height + size[i]) py[i] = -size[i];

            const alpha = life[i] * (0.5 + Math.sin(time + phase[i]) * 0.5);
            context.globalAlpha = alpha;
            context.fillStyle = theme.particleColor;
            context.beginPath();
            context.arc(px[i], py[i], size[i], 0, Math.PI * 2);
            context.fill();
        }
    }
}
