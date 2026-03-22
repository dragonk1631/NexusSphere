import type { IBackgroundPattern, PatternContext } from '../PatternRegistry';

export class FireworksPattern implements IBackgroundPattern {
    public readonly id = 'fireworks';

    public init(ctx: PatternContext): void {
        const { width, height, buffers, spawn } = ctx;
        const { px, py, vx, vy, size, life, layer, custom1, custom2, phase } = buffers;

        for (let i = 0; i < 200; i++) {
            const id = spawn();
            if (id === -1) break;
            
            if (i < 8) {
                px[id] = Math.random() * width;
                py[id] = height + Math.random() * 800;
                vx[id] = (Math.random() - 0.5) * 2;
                vy[id] = -(Math.random() * 6 + 10);
                custom1[id] = 0; // LAUNCH
                custom2[id] = 1.0 + Math.random() * 1.5; 
            } else if (i < 115) {
                custom1[id] = -1; // INACTIVE
            } else {
                px[id] = Math.random() * width;
                py[id] = Math.random() * (height * 0.6);
                custom1[id] = 2; // STAR
                phase[id] = Math.random() * Math.PI * 2;
            }
            
            size[id] = 1.2 + Math.random() * 2.5;
            life[id] = 1.0;
            layer[id] = Math.floor(Math.random() * 3);
        }
    }

    public draw(ctx: PatternContext): void {
        const { ctx: context, width, height, time, aliveCount, buffers, setCompositeOperation } = ctx;
        const { px, py, vx, vy, size, life, custom1, custom2, phase } = buffers;

        const starColors = ['#FFFFFF', '#FFD000', '#FF006E', '#00F5FF', '#A020F0'];
        const starSprites = starColors.map((col, idx) => ctx.getCachedTexture(`fw_star_${idx}`, 16, c => {
            const g = c.createRadialGradient(8, 8, 0, 8, 8, 8);
            g.addColorStop(0, '#FFF');
            g.addColorStop(0.3, col);
            g.addColorStop(1, 'transparent');
            c.fillStyle = g;
            c.fillRect(0, 0, 16, 16);
        }));

        setCompositeOperation('lighter');
        for (let i = 0; i < aliveCount; i++) {
            if (custom1[i] === 0) { // ROCKET
                px[i] += vx[i];
                py[i] += vy[i];
                vy[i] += 0.15; // Small gravity

                if (vy[i] >= 0) {
                    this.triggerBurst(i, ctx);
                    py[i] = height + Math.random() * 1200;
                    vy[i] = -(Math.random() * 6 + 10);
                    px[i] = Math.random() * width;
                }

                context.globalAlpha = 0.8;
                context.drawImage(starSprites[1], px[i] - size[i] * 2, py[i] - size[i] * 2, size[i] * 4, size[i] * 4);
            } else if (custom1[i] === 1) { // SHRAPNEL
                px[i] += vx[i];
                py[i] += vy[i];
                vx[i] *= 0.96;
                vy[i] *= 0.96; // Slower decay for better pacing
                life[i] -= 0.015;
                if (life[i] <= 0) custom1[i] = -1;

                context.globalAlpha = life[i];
                const s = size[i] * custom2[i] * life[i] * 3;
                context.drawImage(starSprites[Math.floor(phase[i] * 5) % 5], px[i] - s, py[i] - s, s * 2, s * 2);
            } else if (custom1[i] === 2) { // AMBIENT STAR
                const twinkle = 0.3 + Math.sin(time * 3 + phase[i]) * 0.7;
                context.globalAlpha = twinkle * 0.5;
                context.drawImage(starSprites[0], px[i] - size[i], py[i] - size[i], size[i] * 2, size[i] * 2);
            }
        }
    }

    private triggerBurst(rocketId: number, ctx: PatternContext): void {
        const { buffers, aliveCount } = ctx;
        const { px, py, vx, vy, life, custom1, custom2, phase } = buffers;
        const rx = px[rocketId];
        const ry = py[rocketId];
        const rScale = custom2[rocketId];

        let spawned = 0;
        for (let i = 0; i < aliveCount && spawned < 20; i++) {
            if (custom1[i] === -1) {
                custom1[i] = 1;
                px[i] = rx;
                py[i] = ry;
                const angle = Math.random() * Math.PI * 2;
                const speed = (2 + Math.random() * 5) * rScale;
                vx[i] = Math.cos(angle) * speed;
                vy[i] = Math.sin(angle) * speed;
                life[i] = 1.0;
                custom2[i] = rScale;
                phase[i] = Math.random();
                spawned++;
            }
        }
    }
}
