import type { IBackgroundPattern, PatternContext } from '../PatternRegistry';

export class ScanlinesPattern implements IBackgroundPattern {
    public readonly id = 'scanlines';

    public init(ctx: PatternContext): void {
        const { width, height, buffers, spawn } = ctx;
        const { px, py, vx, size, layer } = buffers;
        for (let i = 0; i < 30; i++) {
            const id = spawn();
            if (id === -1) break;
            px[id] = Math.random() * width;
            py[id] = Math.random() * height * 0.5;
            vx[id] = Math.random() * 2 + 1;
            size[id] = Math.random() * 2 + 1;
            layer[id] = Math.floor(Math.random() * 3);
        }
    }

    public draw(ctx: PatternContext): void {
        const { ctx: context, width, height, theme, aliveCount, buffers, setCompositeOperation } = ctx;
        const { px, py, vx, size, layer } = buffers;

        setCompositeOperation('lighter');
        for (let i = 0; i < aliveCount; i++) {
            px[i] += vx[i];
            if (px[i] > width) px[i] = -width;
            
            context.globalAlpha = 0.1 * (1.0 - (layer[i] * 0.2));
            context.fillStyle = theme.particleColor;
            context.fillRect(px[i], py[i], width, size[i]);
            context.fillRect(px[i] - width, py[i] + height * 0.5, width, size[i]);
        }
    }
}
