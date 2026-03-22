import type { IBackgroundPattern, PatternContext } from '../PatternRegistry';

export class HexagonsPattern implements IBackgroundPattern {
    public readonly id = 'hexagons';

    public init(_ctx: PatternContext): void {}

    public draw(ctx: PatternContext): void {
        const { ctx: context, width, height, time, theme, getCachedTexture, setCompositeOperation } = ctx;
        const hexSize = 65;
        const hexH = hexSize * Math.sqrt(3);
        const hexW = hexSize * 2;
        
        const offsetX = (time * 35) % (hexW * 1.5);
        
        // 1. Optimized Base Grid using Tiled Caching
        const gridRefKey = `hex_grid_${theme.gridColor}`;
        const gridTile = getCachedTexture(gridRefKey, Math.ceil(hexW * 1.5), c => {
            c.strokeStyle = theme.gridColor;
            c.lineWidth = 1.2;
            c.globalAlpha = 0.5;
            this.drawHex(c, 0, 0, hexSize);
            this.drawHex(c, hexW * 0.75, hexH * 0.5, hexSize);
        });

        setCompositeOperation('source-over');
        context.globalAlpha = 1.0;
        
        // Draw cached grid tiled
        for (let x = -hexW * 1.5 - offsetX; x < width + hexW; x += hexW * 1.5) {
            for (let y = -hexH; y < height + hexH; y += hexH) {
                context.drawImage(gridTile, x, y);
            }
        }
        
        // 2. Optimized Glowing Pulse (Lighter pass)
        setCompositeOperation('lighter');
        context.strokeStyle = theme.particleColor;

        const cols = Math.ceil(width / (hexW * 1.5)) + 4;
        const rows = Math.ceil(height / hexH) + 2;

        for (let row = -1; row < rows; row++) {
            for (let col = -2; col < cols; col++) {
                const x = col * (hexW * 1.5) - offsetX;
                const y = row * hexH;
                
                // Seed based on logical grid position
                const hx = col;
                const hy = row;
                const seedVal = (Math.abs(Math.sin(hx * 12.9898 + hy * 78.233) * 43758.5453)) % 1;
                const speed = 1.5 + seedVal * 3.0;
                const pulse = Math.sin((time * speed) + seedVal * 10) * 0.5 + 0.5;
                
                if (pulse > 0.65) {
                    const power = Math.pow((pulse - 0.65) / 0.35, 2);
                    const alpha = power * 0.8;
                    
                    context.globalAlpha = alpha * 0.2;
                    context.lineWidth = 6.0;
                    this.drawHex(context, x, y, hexSize);
                    
                    context.globalAlpha = alpha;
                    context.lineWidth = 1.2;
                    this.drawHex(context, x, y, hexSize);
                }

                // Offset-row pulse
                const ox = x + hexW * 0.75;
                const oy = y + hexH * 0.5;
                const seedVal2 = (Math.abs(Math.sin((hx + 0.5) * 12.9898 + (hy + 0.5) * 78.233) * 43758.5453)) % 1;
                const speed2 = 1.5 + seedVal2 * 3.0;
                const pulse2 = Math.sin((time * speed2) + seedVal2 * 10) * 0.5 + 0.5;

                if (pulse2 > 0.65) {
                    const power = Math.pow((pulse2 - 0.65) / 0.35, 2);
                    const alpha = power * 0.8;
                    context.globalAlpha = alpha * 0.2;
                    context.lineWidth = 6.0;
                    this.drawHex(context, ox, oy, hexSize);
                    
                    context.globalAlpha = alpha;
                    context.lineWidth = 1.2;
                    this.drawHex(context, ox, oy, hexSize);
                }
            }
        }
    }

    private drawHex(ctx: any, x: number, y: number, size: number) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            ctx.lineTo(x + size * Math.cos(angle), y + size * Math.sin(angle));
        }
        ctx.closePath();
        ctx.stroke();
    }
}
