import type { IBackgroundPattern, PatternContext } from '../PatternRegistry';

export class StarsPattern implements IBackgroundPattern {
    public readonly id = 'stars';

    public init(ctx: PatternContext): void {
        const { width, height, isMobile, theme, buffers, spawn } = ctx;
        const { px, py, pz, vx, vy, size, life, phase, layer, custom2 } = buffers;
        const isDeepSpaceInit = theme.id === 'deep-space';
        const globalDensity = isMobile ? 1.4 : 2.4;

        for (let l = 0; l < 4; l++) {
            const count = Math.floor(globalDensity * (isMobile ? (l === 0 ? 250 : 60) : (l === 0 ? 500 : 200 - l * 40)));
            for (let i = 0; i < count; i++) {
                const id = spawn();
                if (id === -1) break;
                px[id] = Math.random() * width;
                py[id] = Math.random() * height;
                pz[id] = l + 1; // Parallax Layer
                
                if (isDeepSpaceInit) {
                    size[id] = l === 0 ? 0.1 + Math.random() * 0.4 : (4 - l) * 0.9 + Math.random() * 2.0;
                    vy[id] = (0.1 / (l + 1)) + Math.random() * 0.04;
                    custom2[id] = Math.floor(Math.random() * 5); // 5 Cosmic Colors
                    phase[id] = Math.random() * Math.PI * 2;
                    layer[id] = l;
                    life[id] = 0.4 + Math.random() * 0.6;
                    
                    if (Math.random() > 0.995) {
                        life[id] = -1.0; 
                        vx[id] = 6 + Math.random() * 6;
                    }
                } else {
                    size[id] = l === 0 ? Math.random() * 0.4 : (4 - l) * 0.7 + Math.random();
                    vy[id] = (0.15 / (l + 1)) + Math.random() * 0.04;
                    phase[id] = Math.random() * Math.PI * 2;
                    layer[id] = l;
                    life[id] = Math.random() * 0.5 + 0.5;
                }
            }
        }
    }

    public draw(ctx: PatternContext): void {
        const { ctx: context, width, height, time, theme, aliveCount, buffers, getCachedTexture, applyAlpha, setCompositeOperation } = ctx;
        const { px, py, pz, vx, vy, size, life, phase, custom2 } = buffers;
        const isDeepSpace = theme.id === 'deep-space';

        // 1. Stars Palette
        const starColors = ['#FFFFFF', '#B2EBF2', '#FFF176', '#FF8A80', '#D1C4E9']; 
        const starSprites = starColors.map((col, idx) => 
            getCachedTexture(`star_v3_${idx}`, 32, (c) => {
                const grad = c.createRadialGradient(16, 16, 0, 16, 16, 16);
                grad.addColorStop(0, '#FFFFFF');
                grad.addColorStop(0.2, applyAlpha(col, '88'));
                grad.addColorStop(1, 'transparent');
                c.fillStyle = grad;
                c.fillRect(0, 0, 32, 32);
            })
        );

        const starCrossSprite = getCachedTexture('star_cross_premium', 128, (c) => {
            const cx = 64, cy = 64;
            const g = c.createRadialGradient(cx, cy, 0, cx, cy, 64);
            g.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
            g.addColorStop(0.3, 'rgba(255, 255, 255, 0.15)');
            g.addColorStop(1, 'transparent');
            c.fillStyle = g; c.beginPath(); c.arc(cx, cy, 64, 0, Math.PI * 2); c.fill();
            c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1.2;
            c.beginPath(); 
            c.moveTo(cx, 0); c.lineTo(cx, 128); 
            c.moveTo(0, cy); c.lineTo(128, cy); 
            c.moveTo(cx-30, cy-30); c.lineTo(cx+30, cy+30);
            c.moveTo(cx+30, cy-30); c.lineTo(cx-30, cy+30);
            c.stroke();
        });

        const shootStarTex = getCachedTexture('shoot_star_v4_unified', 400, (c) => {
            const cx = 380, cy = 30; // Lead head position
            const trailGrad = c.createLinearGradient(0, cy, 400, cy);
            trailGrad.addColorStop(0, 'transparent');
            trailGrad.addColorStop(0.5, 'rgba(100, 150, 255, 0.2)');
            trailGrad.addColorStop(0.8, 'rgba(200, 230, 255, 0.6)');
            trailGrad.addColorStop(1, '#FFFFFF');
            c.fillStyle = trailGrad;
            c.beginPath();
            c.moveTo(0, cy);
            c.lineTo(cx, cy - 8);
            c.arc(cx, cy, 8, -Math.PI / 2, Math.PI / 2);
            c.lineTo(0, cy);
            c.fill();
            const headGrad = c.createRadialGradient(cx, cy, 0, cx, cy, 15);
            headGrad.addColorStop(0, '#FFFFFF');
            headGrad.addColorStop(0.4, '#FFD54F');
            headGrad.addColorStop(1, 'transparent');
            c.fillStyle = headGrad;
            c.beginPath(); c.arc(cx, cy, 15, 0, Math.PI * 2); c.fill();
        });

        const shootStarMist = getCachedTexture('shoot_star_mist_v2', 500, (c) => {
            const cx = 400, cy = 60;
            const grad = c.createRadialGradient(cx, cy, 0, cx, cy, 400);
            grad.addColorStop(0, 'rgba(120, 180, 255, 0.25)');
            grad.addColorStop(0.6, 'rgba(60, 60, 180, 0.03)');
            grad.addColorStop(1, 'transparent');
            c.fillStyle = grad;
            c.beginPath(); 
            c.ellipse(cx - 200, cy, 300, 60, 0, 0, Math.PI * 2); 
            c.fill();
        });

        setCompositeOperation('lighter');
        for (let i = 0; i < aliveCount; i++) {
            const isShooting = life[i] < 0;

            if (isShooting) {
                px[i] += vx[i];
                py[i] += vx[i] * 0.25;
                if (px[i] > width + 500) { px[i] = -500; py[i] = Math.random() * height; }
                
                context.save();
                context.translate(px[i], py[i]);
                const angle = Math.atan2(vx[i] * 0.25, vx[i]);
                context.rotate(angle);
                context.globalAlpha = 0.3;
                context.drawImage(shootStarMist, -500, -60, 500, 120);
                context.globalAlpha = 0.9;
                context.drawImage(shootStarTex, -400, -30, 400, 60);
                context.restore();
            } else {
                py[i] += vy[i] * (5 - pz[i]);
                if (py[i] > height) py[i] = -20;
                const shineSpeed = isDeepSpace ? 1.0 : 2.0;
                const blinkBase = Math.pow(Math.sin(time * shineSpeed + phase[i]), isDeepSpace ? 5 : 4);
                const twinkle = 0.4 + blinkBase * 0.6;
                context.globalAlpha = life[i] * twinkle; 
                const s = size[i] * twinkle;
                const colIdx = (custom2[i] || 0) % starSprites.length;
                if (isDeepSpace && pz[i] === 2 && size[i] > 3.5 && blinkBase > 0.92) {
                    const cs = s * 6;
                    context.drawImage(starCrossSprite, px[i] - cs, py[i] - cs, cs * 2, cs * 2);
                } else {
                    context.drawImage(starSprites[colIdx], px[i] - s, py[i] - s, s * 2, s * 2);
                }
            }
        }
    }
}
