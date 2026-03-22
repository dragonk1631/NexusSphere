import type { IBackgroundPattern, PatternContext } from '../PatternRegistry';

export class HexagonsPattern implements IBackgroundPattern {
    public readonly id = 'hexagons';

    public init(_ctx: PatternContext): void {}

    public draw(ctx: PatternContext): void {
        const { ctx: context, width, height, time, theme, setCompositeOperation } = ctx;
        const hexSize = 65;
        const hexH = hexSize * Math.sqrt(3);
        const hexW = hexSize * 2;
        
        const offsetX = (time * 35) % (hexW * 1.5); // Increased speed
        
        // 1. Base Grid
        setCompositeOperation('source-over');
        context.strokeStyle = theme.gridColor;
        context.lineWidth = 1.2;
        context.globalAlpha = 0.5;
        
        for (let y = -hexH; y < height + hexH; y += hexH) {
            for (let x = -hexW - offsetX; x < width + hexW; x += hexW * 1.5) {
                this.drawHex(context, x, y, hexSize);
                this.drawHex(context, x + hexW * 0.75, y + hexH * 0.5, hexSize);
            }
        }
        
        // 2. Randomized Glowing Pulse (Enhanced)
        setCompositeOperation('lighter');
        
        for (let y = -hexH; y < height + hexH; y += hexH) {
            for (let x = -hexW - offsetX; x < width + hexW; x += hexW * 1.5) {
                // [PROFESSIONAL] Seed-based per-hexagon speed and pattern
                const hx = Math.round((x + offsetX) / (hexW * 0.75));
                const hy = Math.round(y / (hexH * 0.5));
                const seedVal = (Math.abs(Math.sin(hx * 12.9898 + hy * 78.233) * 43758.5453)) % 1;
                
                // Varied speeds: some slow pulse, some fast flicker
                const speed = 1.2 + seedVal * 3.5;
                const phase = seedVal * Math.PI * 2;
                const pulse = Math.sin((time * speed) + phase) * 0.5 + 0.5;
                
                // Draw glow only for high-energy pulse states
                if (pulse > 0.6) {
                    const power = Math.pow((pulse - 0.6) / 0.4, 2);
                    const alpha = power * 0.8;
                    context.strokeStyle = theme.particleColor;
                    
                    // Layer 1: Ambient Outer Glow
                    context.lineWidth = 8.0;
                    context.globalAlpha = alpha * 0.2;
                    this.drawHex(context, x, y, hexSize);
                    
                    // Layer 2: Radiant Inner Glow
                    context.lineWidth = 3.5;
                    context.globalAlpha = alpha * 0.5;
                    this.drawHex(context, x, y, hexSize);

                    // Layer 3: High-Intensity Core
                    context.lineWidth = 1.2;
                    context.globalAlpha = alpha;
                    this.drawHex(context, x, y, hexSize);
                }
                
                // Cross-pattern for offset rows
                const ox = x + hexW * 0.75;
                const oy = y + hexH * 0.5;
                const seedVal2 = (Math.abs(Math.sin((hx + 1) * 12.9898 + (hy + 1) * 78.233) * 43758.5453)) % 1;
                const speed2 = 1.2 + seedVal2 * 3.5;
                const pulse2 = Math.sin((time * speed2) + seedVal2 * 10) * 0.5 + 0.5;
                
                if (pulse2 > 0.6) {
                    const power = Math.pow((pulse2 - 0.6) / 0.4, 2);
                    const alpha = power * 0.8;
                    context.strokeStyle = theme.particleColor;
                    context.lineWidth = 5.0;
                    context.globalAlpha = alpha * 0.3;
                    this.drawHex(context, ox, oy, hexSize);
                    
                    context.lineWidth = 1.5;
                    context.globalAlpha = alpha;
                    this.drawHex(context, ox, oy, hexSize);
                }
            }
        }
    }

    private drawHex(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number, size: number) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            const px = x + size * Math.cos(angle);
            const py = y + size * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
    }
}
