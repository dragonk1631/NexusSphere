import type { IBackgroundPattern, PatternContext } from '../PatternRegistry';

export class MatrixPattern implements IBackgroundPattern {
    public readonly id = 'matrix';

    public init(ctx: PatternContext): void {
        const { width, height, buffers, spawn } = ctx;
        const { px, py, vy, size, layer } = buffers;
        const cols = Math.floor(width / 22);
        for (let i = 0; i < cols; i++) {
            const id = spawn();
            if (id === -1) break;
            px[id] = i * 22;
            py[id] = Math.random() * height * 2 - height;
            vy[id] = Math.random() * 5 + 3;
            size[id] = Math.floor(Math.random() * 12 + 8);
            layer[id] = Math.floor(Math.random() * 3);
        }
    }

    public draw(ctx: PatternContext): void {
        const { ctx: context, height, theme, aliveCount, buffers, getCachedTexture, isMobile } = ctx;
        const { px, py, vy, size, layer } = buffers;

        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*";
        const charH = 22;
        const charW = 16;
        
        const glyphSheet = getCachedTexture('matrix_glyphs', 512, c => {
            c.font = 'bold 18px monospace';
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            chars.split('').forEach((char, idx) => {
                const x = (idx % 16) * 32 + 16;
                const y = Math.floor(idx / 16) * 32 + 16;
                c.fillStyle = '#FFFFFF';
                c.fillText(char, x, y);
                c.fillStyle = theme.particleColor;
                c.fillText(char, x, y + 64);
            });
        });

        const headTex = getCachedTexture('matrix_head', 40, c => {
            const grad = c.createRadialGradient(20, 20, 0, 20, 20, 20);
            grad.addColorStop(0, '#FFFFFF');
            grad.addColorStop(0.5, theme.particleColor.slice(0, 7) + '66');
            grad.addColorStop(1, 'transparent');
            c.fillStyle = grad;
            c.fillRect(0, 0, 40, 40);
        });

        const compOp = isMobile ? 'source-over' : 'lighter';

        for (let i = 0; i < aliveCount; i++) {
            py[i] += vy[i] * (1 + (3 - layer[i]) * 0.2);
            if (py[i] > height + size[i] * charH) {
                py[i] = -size[i] * charH;
                vy[i] = Math.random() * 5 + 3;
            }

            const alphaScale = 1 - (layer[i] / 4);

            for (let j = 0; j < size[i]; j++) {
                const charY = py[i] - j * charH;
                if (charY > -charH && charY < height + charH) {
                    const seed = Math.floor(px[i] + Math.floor(charY / charH) * 123);
                    let charIdx = seed % chars.length;
                    if (Math.random() > 0.985) charIdx = Math.floor(Math.random() * chars.length);

                    const charAlpha = 1 - (j / size[i]);
                    const gx = (charIdx % 16) * 32 + (32 - charW) / 2;
                    const gy = Math.floor(charIdx / 16) * 32 + (32 - charH) / 2;

                    if (j === 0) {
                        context.globalCompositeOperation = compOp as GlobalCompositeOperation;
                        context.drawImage(headTex, px[i] - 20 - charW/2 + 11, charY - 20, 40, 40);
                        context.globalCompositeOperation = 'source-over';
                        context.globalAlpha = alphaScale;
                        context.drawImage(glyphSheet, gx, gy, charW, charH, px[i] - charW/2, charY - charH/2, charW, charH);
                    } else {
                        context.globalAlpha = charAlpha * 0.7 * alphaScale;
                        context.drawImage(glyphSheet, gx, gy + 64, charW, charH, px[i] - charW/2, charY - charH/2, charW, charH);
                    }
                }
            }
        }
    }
}
