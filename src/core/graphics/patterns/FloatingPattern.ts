import type { IBackgroundPattern, PatternContext } from '../PatternRegistry';

export class FloatingPattern implements IBackgroundPattern {
    public readonly id = 'floating';

    public init(ctx: PatternContext): void {
        const { width, height, theme, buffers, spawn } = ctx;
        const { px, py, vx, vy, size, custom1, phase, pulseSpeed, life } = buffers;
        const isMarchen = theme.id === 'marchen';

        if (isMarchen) {
            // 150 Golden Sparkle Clusters
            for (let i = 0; i < 150; i++) {
                const id = spawn(); if (id === -1) break;
                px[id] = Math.random() * width;
                py[id] = Math.random() * height;
                vx[id] = (Math.random() - 0.5) * 0.2;  // Slight drift
                vy[id] = -(Math.random() * 0.4 + 0.1); // Slowly float up
                size[id] = 0.5 + Math.random() * 1.5;  
                phase[id] = Math.random() * Math.PI * 2;
                pulseSpeed[id] = 0.5 + Math.random() * 1.0; 
                custom1[id] = Math.floor(Math.random() * 3); // Sprite index (0, 1, 2)
                life[id] = 1.0;
            }
        } else {
            for (let i = 0; i < 100; i++) {
                const id = spawn(); if (id === -1) break;
                px[id] = Math.random() * width;
                py[id] = Math.random() * height;
                vx[id] = (Math.random() - 0.5) * 0.5;
                vy[id] = (Math.random() - 0.5) * 0.5;
                size[id] = Math.random() * 2 + 1;
                phase[id] = Math.random() * Math.PI * 2;
                life[id] = 1.0;
            }
        }
    }

    public draw(ctx: PatternContext): void {
        const { ctx: context, width, height, time, theme, aliveCount, buffers, setCompositeOperation } = ctx;
        const { px, py, vx, vy, size, phase } = buffers;

        if (theme.id === 'marchen') {
            this.drawMarchen(ctx);
            return;
        }

        setCompositeOperation('lighter');
        for (let i = 0; i < aliveCount; i++) {
            px[i] += vx[i];
            py[i] += vy[i];
            if (px[i] < 0 || px[i] > width) vx[i] *= -1;
            if (py[i] < 0 || py[i] > height) vy[i] *= -1;

            const s = size[i] * (1 + Math.sin(time + phase[i]) * 0.3);
            context.globalAlpha = 0.6;
            context.fillStyle = theme.particleColor;
            context.beginPath();
            context.arc(px[i], py[i], s, 0, Math.PI * 2);
            context.fill();
        }
    }

    private drawMarchen(ctx: PatternContext): void {
        const { ctx: context, width, height, time, aliveCount, buffers, getCachedTexture, setCompositeOperation } = ctx;
        const { px, py, vx, vy, size, phase, pulseSpeed, custom1 } = buffers;

        // Custom function to perfectly draw the sharp 'astroid' stars from the reference image
        const drawAstroid = (c: any, x: number, y: number, rx: number, ry: number) => {
            c.beginPath();
            c.moveTo(x, y - ry);
            c.quadraticCurveTo(x, y, x + rx, y);
            c.quadraticCurveTo(x, y, x, y + ry);
            c.quadraticCurveTo(x, y, x - rx, y);
            c.quadraticCurveTo(x, y, x, y - ry);
            c.fill();
        };

        const sprites = [0, 1, 2].map(idx => getCachedTexture(`m_golden_sparkle_${idx}`, 128, c => {
            c.translate(64, 64);
            
            // Premium Golden colors strictly matching the image
            const g = c.createRadialGradient(0, 0, 0, 0, 0, 60);
            g.addColorStop(0, '#FFF59D'); // Light yellow core
            g.addColorStop(0.4, '#FFD54F'); // Golden yellow body
            g.addColorStop(1, '#FFB300'); // Deep amber edges
            c.fillStyle = g;

            // Very faint soft glow so it doesn't look totally flat on dark backgrounds
            c.shadowColor = 'rgba(255, 213, 79, 0.4)';
            c.shadowBlur = 10;

            if (idx === 0) {
                // Variation 1: Balanced star with two tiny ones
                drawAstroid(c, 0, 0, 45, 45);
                drawAstroid(c, 30, -30, 12, 16);
                drawAstroid(c, -20, 25, 8, 8);
            } else if (idx === 1) {
                // Variation 2: Chubby star with scattered diamonds
                drawAstroid(c, 0, 0, 35, 35);
                drawAstroid(c, -30, -20, 12, 12);
                drawAstroid(c, 40, 10, 10, 10);
            } else {
                // Variation 3: Tall thin cross with 4 surrounding tiny stars
                drawAstroid(c, 0, 0, 20, 50);
                drawAstroid(c, -25, -20, 8, 8);
                drawAstroid(c, 25, -25, 6, 6);
                drawAstroid(c, -15, 30, 10, 10);
                drawAstroid(c, 20, 25, 7, 7);
            }
        }));

        // Use source-over instead of lighter to maintain the solid, crisp vector aesthetic of the image
        setCompositeOperation('source-over'); 

        for (let i = 0; i < aliveCount; i++) {
            px[i] += vx[i];
            py[i] += vy[i];
            
            if (py[i] < -80) py[i] = height + 80;
            if (px[i] < -80) px[i] = width + 80;
            if (px[i] > width + 80) px[i] = -80;

            const sprite = sprites[custom1[i]];
            
            // Slower, smooth twinkling
            const twinkle = Math.pow(Math.abs(Math.sin(time * pulseSpeed[i] + phase[i])), 2.0);
            if (twinkle < 0.05) continue; 

            // Scale bounds it to appropriate sizes
            const s = size[i] * 16 * (0.7 + twinkle * 0.3);
            const alpha = twinkle * 0.95;

            context.save();
            context.translate(px[i], py[i]);
            // Purposely NO rotation to match the strictly horizontal/vertical alignment in the reference image
            context.globalAlpha = alpha;
            context.drawImage(sprite, -s, -s, s * 2, s * 2);
            context.restore();
        }
    }
}
