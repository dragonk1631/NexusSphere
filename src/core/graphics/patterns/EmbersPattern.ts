import type { IBackgroundPattern, PatternContext } from '../PatternRegistry';

export class EmbersPattern implements IBackgroundPattern {
    public readonly id = 'embers';

    public init(ctx: PatternContext): void {
        const { width, height, buffers, spawn } = ctx;
        const { px, py, vx, vy, size, phase, layer } = buffers;

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
    }

    public draw(ctx: PatternContext): void {
        const { ctx: context, height, time, theme, aliveCount, buffers, getCachedTexture, setCompositeOperation } = ctx;
        const { px, py, vx, vy, size, phase, layer } = buffers;

        const emberSprite = getCachedTexture('ember_spark', 32, c => {
            const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
            g.addColorStop(0, '#FFFFFF');
            g.addColorStop(0.4, theme.particleColor);
            g.addColorStop(1, 'transparent');
            c.fillStyle = g;
            c.fillRect(0, 0, 32, 32);
        });

        setCompositeOperation('lighter');
        for (let i = 0; i < aliveCount; i++) {
            py[i] += vy[i];
            px[i] += vx[i] + Math.sin(time * 2 + phase[i]) * 0.5;
            if (py[i] < -20) {
                py[i] = height + 20;
                px[i] = Math.random() * ctx.width;
            }

            const s = size[i] * (1.0 + Math.sin(time * 5 + phase[i]) * 0.3) * 2; // mult by 2 for sprite padding
            const alpha = (1.0 - (layer[i] * 0.25)) * (0.6 + Math.sin(time * 3 + phase[i]) * 0.4);
            
            context.globalAlpha = alpha;
            context.drawImage(emberSprite, px[i] - s, py[i] - s, s * 2, s * 2);
        }
    }
}
