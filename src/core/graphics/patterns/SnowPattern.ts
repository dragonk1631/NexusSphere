import type { IBackgroundPattern, PatternContext } from '../PatternRegistry';

export class SnowPattern implements IBackgroundPattern {
    public readonly id = 'snow';

    public init(ctx: PatternContext): void {
        const { width, height, buffers, spawn } = ctx;
        const { px, py, size, vy, vx, phase, layer, life } = buffers;

        // Increased density for premium feel
        const count = ctx.isMobile ? 120 : 250;
        for (let i = 0; i < count; i++) {
            const id = spawn();
            if (id === -1) break;
            const l = Math.floor(Math.random() * 3);
            px[id] = Math.random() * width;
            py[id] = Math.random() * height;
            // Larger size for crystal detail visibility
            size[id] = (8 + Math.random() * 14) * (1 - l * 0.2); 
            vy[id] = (Math.random() * 1.5 + 0.8) * (1 - l * 0.2);
            vx[id] = (Math.random() - 0.5) * 0.5;
            phase[id] = Math.random() * Math.PI * 2;
            layer[id] = l;
            life[id] = 1.0;
        }
    }

    public draw(ctx: PatternContext): void {
        const { ctx: context, height, width, time, aliveCount, buffers, getCachedTexture, setCompositeOperation } = ctx;
        const { px, py, vx, vy, size, phase, layer } = buffers;

        // Pre-render a more distinct crystalline snowflake sprite
        const snowSprite = getCachedTexture('snow_crystal_rich', 128, c => {
            c.strokeStyle = '#FFFFFF';
            c.lineWidth = 4;
            c.lineCap = 'round';
            c.translate(64, 64);
            for (let i = 0; i < 6; i++) {
                c.beginPath();
                c.moveTo(0, 0);
                c.lineTo(0, -55);
                // Secondary branches (v-shape)
                c.moveTo(0, -35);
                c.lineTo(-18, -48);
                c.moveTo(0, -35);
                c.lineTo(18, -48);
                // Tertiary branches
                c.moveTo(0, -20);
                c.lineTo(-12, -28);
                c.moveTo(0, -20);
                c.lineTo(12, -28);
                c.stroke();
                c.rotate(Math.PI / 3);
            }
            // Add a small center glow
            const g = c.createRadialGradient(0,0,0,0,0,15);
            g.addColorStop(0, 'rgba(255,255,255,0.8)');
            g.addColorStop(1, 'transparent');
            c.fillStyle = g;
            c.beginPath(); c.arc(0,0,15,0,Math.PI*2); c.fill();
        });

        setCompositeOperation('source-over');
        for (let i = 0; i < aliveCount; i++) {
            py[i] += vy[i];
            px[i] += vx[i] + Math.sin(time * 0.8 + phase[i]) * 0.5;
            
            // Screen wrapping
            if (py[i] > height + 40) py[i] = -40;
            if (px[i] < -40) px[i] = width + 40;
            if (px[i] > width + 40) px[i] = -40;

            const s = size[i] * (1 + Math.sin(time * 2 + phase[i]) * 0.15);
            const alpha = (1.0 - layer[i] * 0.3) * (0.5 + Math.abs(Math.sin(time + phase[i])) * 0.5);
            
            context.globalAlpha = Math.max(0.15, alpha);
            context.save();
            context.translate(px[i], py[i]);
            context.rotate(time * 0.4 + phase[i]);
            context.drawImage(snowSprite, -s, -s, s * 2, s * 2);
            context.restore();
        }
    }
}
