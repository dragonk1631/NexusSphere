import type { IBackgroundPattern, PatternContext } from '../PatternRegistry';

export class BubblesPattern implements IBackgroundPattern {
    public readonly id = 'bubbles';

    public init(ctx: PatternContext): void {
        const { width, height, buffers, spawn } = ctx;
        const { px, py, vx, vy, size, phase, layer, life } = buffers;

        for (let i = 0; i < 128; i++) {
            const id = spawn();
            if (id === -1) break;
            px[id] = Math.random() * width;
            py[id] = Math.random() * height;
            // Slightly smaller base but clearer sprites
            size[id] = (Math.random() * 20 + 8); 
            vy[id] = -(Math.random() * 0.8 + 0.3);
            vx[id] = (Math.random() - 0.5) * 0.4;
            phase[id] = Math.random() * Math.PI * 2;
            layer[id] = Math.floor(Math.random() * 3);
            life[id] = 1.0;
        }
    }

    public draw(ctx: PatternContext): void {
        const { ctx: context, width, height, time, theme, aliveCount, buffers, getCachedTexture, applyAlpha, setCompositeOperation } = ctx;
        const { px, py, vx, vy, size, phase } = buffers;

        // 1. High-Res Surface Light (Increased from 400 to 800)
        const surfaceGrad = getCachedTexture('ocean_surface_800', 800, c => {
            const grad = c.createRadialGradient(400, 0, 0, 400, 0, 800);
            grad.addColorStop(0, applyAlpha(theme.color3, 'AA')); // Slightly denser
            grad.addColorStop(0.5, applyAlpha(theme.color3, '33'));
            grad.addColorStop(1, 'transparent');
            c.fillStyle = grad;
            c.fillRect(0, 0, 800, 800);
        });
        setCompositeOperation('lighter');
        context.globalAlpha = 0.8;
        context.drawImage(surfaceGrad, width * 0.5 - 400, -100, 800, 600);

        // 2. Bubbles
        setCompositeOperation('source-over');
        
        // Single optimized High-Res Bubble Sprite (reduced key count for stability)
        const bubbleSprite = getCachedTexture('ocean_bubble_hi', 128, (c) => {
            c.strokeStyle = 'rgba(255, 255, 255, 0.45)';
            c.lineWidth = 3.0; // Scaled for 128x128
            c.beginPath();
            c.arc(64, 64, 58, 0, Math.PI * 2);
            c.stroke();
            const g = c.createRadialGradient(48, 48, 0, 64, 64, 64);
            g.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
            g.addColorStop(1, 'transparent');
            c.fillStyle = g;
            c.fill();
            // Subtle specular highlight
            c.beginPath();
            c.arc(45, 45, 12, 0, Math.PI * 2);
            c.fillStyle = 'rgba(255, 255, 255, 0.5)';
            c.fill();
        });
        
        for (let i = 0; i < aliveCount; i++) {
            py[i] += vy[i];
            px[i] += vx[i] + Math.sin(time * 0.8 + phase[i]) * 0.25;
            
            if (py[i] < -size[i] * 2) py[i] = height + size[i] * 2;
            if (px[i] < -size[i] * 2) px[i] = width + size[i] * 2;
            if (px[i] > width + size[i] * 2) px[i] = -size[i] * 2;

            const s = size[i] * (1 + Math.sin(time * 2 + i) * 0.05); // Subtle pulse
            const alpha = 0.4 + Math.sin(time + phase[i]) * 0.2;
            
            context.globalAlpha = alpha;
            context.drawImage(bubbleSprite, px[i] - s, py[i] - s, s * 2, s * 2);
        }
    }
}
