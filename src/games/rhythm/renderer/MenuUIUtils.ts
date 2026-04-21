import { MENU_LAYOUT, VISUAL_TUNING_CONFIG } from './MenuLayoutConfig';

/**
 * Common color and typography utilities for the premium menu.
 * These are stateless pure functions extracted to ensure reusability
 * and separation of concerns across different panel renderers.
 */

// --- Caches for Performance Optimization (Step 3) ---
const colorCache = new Map<string, string>();
const lerpColorCache = new Map<string, string>();
const textWidthCache = new Map<string, number>();
const panelCache = new Map<string, HTMLCanvasElement>();

function getCachedTextWidth(ctx: CanvasRenderingContext2D, text: string): number {
    const key = `${ctx.font}|${text}`;
    let w = textWidthCache.get(key);
    if (w === undefined) {
        w = ctx.measureText(text).width;
        if (textWidthCache.size > 2000) textWidthCache.clear();
        textWidthCache.set(key, w);
    }
    return w;
}

export function hexToRgb(color: string): string {
    if (colorCache.has(color)) return colorCache.get(color)!;

    let result = "255, 255, 255";
    if (color.startsWith('hsl')) {
        const match = color.match(/hsl\((\d+),\s*([\d.]+)%,\s*([\d.]+)%\)/);
        if (match) {
            const h = parseInt(match[1]) / 360;
            const s = parseInt(match[2]) / 100;
            const l = parseInt(match[3]) / 100;
            let r, g, b;
            if (s === 0) {
                r = g = b = l;
            } else {
                const hue2rgb = (p: number, q: number, t: number) => {
                    if (t < 0) t += 1;
                    if (t > 1) t -= 1;
                    if (t < 1 / 6) return p + (q - p) * 6 * t;
                    if (t < 1 / 2) return q;
                    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                    return p;
                };
                const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                const p = 2 * l - q;
                r = hue2rgb(p, q, h + 1 / 3);
                g = hue2rgb(p, q, h);
                b = hue2rgb(p, q, h - 1 / 3);
            }
            result = `${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}`;
        }
    } else {
        const bigint = parseInt(color.replace('#', ''), 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        result = `${r}, ${g}, ${b}`;
    }

    if (colorCache.size > 500) colorCache.clear();
    colorCache.set(color, result);
    return result;
}

export function lerpColor(a: string, b: string, t: number): string {
    const key = `${a}|${b}|${t.toFixed(3)}`;
    if (lerpColorCache.has(key)) return lerpColorCache.get(key)!;

    const ah = parseInt(a.replace('#', ''), 16);
    const bh = parseInt(b.replace('#', ''), 16);
    const ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff;
    const br = (bh >> 16) & 0xff, bg = (bh >> 8) & 0xff, bb = bh & 0xff;
    const rr = Math.round(ar + (br - ar) * t);
    const rg = Math.round(ag + (bg - ag) * t);
    const rb = Math.round(ab + (bb - ab) * t);

    const result = `#${((1 << 24) + (rr << 16) + (rg << 8) + rb).toString(16).slice(1)}`;
    if (lerpColorCache.size > 2000) lerpColorCache.clear();
    lerpColorCache.set(key, result);
    return result;
}

export function getGradeColor(grade: string): string {
    const colors: Record<string, string> = { 'S': '#f9ca24', 'A': '#6ab04c', 'B': '#4834d4', 'C': '#eb4d4b', 'F': '#535c68' };
    return colors[grade] || '#fff';
}

export function drawTrackedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, tracking: number, color: string, align: 'left' | 'center' | 'right', strokeColor: string = 'rgba(0,0,0,0.8)', fontFamily: string = '"Orbitron"', customLineWidth?: number, shadowY?: number) {
    ctx.font = `900 ${Math.floor(size)}px ${fontFamily}`;
    ctx.fillStyle = color;
    ctx.shadowBlur = 4 * (size / 18);
    ctx.textAlign = 'left';

    const chars = text.split('');
    const widths = chars.map(c => getCachedTextWidth(ctx, c));
    const fullW = widths.reduce((a, b) => a + b, 0) + (chars.length - 1) * tracking;

    let startX = x;
    if (align === 'center') startX = x - fullW / 2;
    else if (align === 'right') startX = x - fullW;

    ctx.save();
    // 1. STROKE FIRST (No shadow)
    ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = customLineWidth ?? (size * 0.12);
    let curX = startX;
    chars.forEach((char, i) => {
        ctx.strokeText(char, curX, y);
        curX += widths[i] + tracking;
    });

    // 2. FILL SECOND (With intentional downward shadow)
    ctx.shadowBlur = (shadowY ? 12 : 7) * (size / 18);
    ctx.shadowColor = 'rgba(0, 0, 0, 1.0)';
    ctx.shadowOffsetX = (shadowY ? 4 : 2.0) * (size / 18);
    ctx.shadowOffsetY = (shadowY ?? 4.5) * (size / 18); // Definite Downward
    
    curX = startX;
    chars.forEach((char, i) => {
        ctx.fillText(char, curX, y);
        curX += widths[i] + tracking;
    });
    ctx.restore();
}

/**
 * Premium typography with optional glow and standard black outline.
 * Refactored for 'Stroke First' pattern to ensure downward shadow clarity.
 */
export function drawPremiumTypography(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, align: CanvasTextAlign, size: number, color: string, isBold: boolean, glowColor: string, maxW: number, strokeColor: string = 'rgba(0,0,0,0.8)') {
    ctx.save();
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;

    const baseFont = `"Orbitron", sans-serif`;
    ctx.font = `${isBold ? 900 : 400} ${Math.floor(size)}px ${baseFont}`;

    // Fit check
    const metrics = ctx.measureText(text);
    if (metrics.width > maxW) {
        const finalScale = maxW / metrics.width;
        ctx.font = `${isBold ? 900 : 400} ${Math.floor(size * finalScale)}px ${baseFont}`;
    }

    // 1. STROKE FIRST
    if (strokeColor !== 'transparent') {
        ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = size * 0.12;
        ctx.strokeText(text, x, y, maxW);
    }

    // 2. FILL SECOND (With intentional downward shadow)
    if (glowColor !== 'transparent') {
        ctx.shadowBlur = 10 * (size / 30); ctx.shadowColor = glowColor;
        ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    } else {
        ctx.shadowBlur = 4 * (size / 24); ctx.shadowColor = 'rgba(0,0,0,1)';
        ctx.shadowOffsetX = 2 * (size / 24); ctx.shadowOffsetY = 4 * (size / 24); // Downward
    }
    
    ctx.fillText(text, x, y, maxW);
    ctx.restore();
}

export function drawPremiumPanel(ctx: CanvasRenderingContext2D, px: number, py: number, pw: number, ph: number, tabLabel: string, c1: string, c2: string, sf: number, rightLabel?: string, rightValue?: string) {
    // Use theme color for glass tint instead of plain white
    const alpha = VISUAL_TUNING_CONFIG.PANEL_INNER_ALPHA;
    const blurPx = VISUAL_TUNING_CONFIG.BACKDROP_BLUR;
    const cacheKey = `v12|${pw}|${ph}|${tabLabel}|${rightLabel}|${rightValue}|${c1}|${c2}|${sf}|${alpha}|${blurPx}`;
    const ox = 50 * sf;
    const oy = 50 * sf;

    if (panelCache.has(cacheKey)) {
        ctx.drawImage(panelCache.get(cacheKey)!, px - ox, py - oy);
        return;
    }

    const offCanvas = document.createElement('canvas');
    offCanvas.width = pw + ox * 2;
    offCanvas.height = ph + oy * 2;
    const offCtx = offCanvas.getContext('2d', { alpha: true })!;

    // 1. Shadow Layer
    offCtx.save();
    offCtx.shadowBlur = 35 * sf;
    offCtx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    offCtx.shadowOffsetX = 2 * sf;
    offCtx.shadowOffsetY = 4 * sf;
    offCtx.fillStyle = '#000';
    offCtx.beginPath(); offCtx.roundRect(ox, oy, pw, ph, MENU_LAYOUT.PANEL_BORDER_RADIUS * sf); offCtx.fill();
    offCtx.restore();

    // 2. Theme-colored Glass Background (c1→c2 gradient tint)
    offCtx.save();
    // Clip to panel shape so blur doesn't bleed outside
    offCtx.beginPath();
    offCtx.roundRect(ox, oy, pw, ph, MENU_LAYOUT.PANEL_BORDER_RADIUS * sf);
    offCtx.clip();
    // Apply blur BEFORE filling – this blurs the fill itself for a frosted look
    if (blurPx > 0 && typeof (offCtx as any).filter === 'string') {
        (offCtx as any).filter = `blur(${blurPx}px)`;
    }
    // Diagonal gradient from c1 to c2 for a richer colored panel
    const glassGrad = offCtx.createLinearGradient(ox, oy, ox + pw, oy + ph);
    glassGrad.addColorStop(0, `rgba(${hexToRgb(c1)}, ${Math.min(alpha + 0.04, 0.3)})`);
    glassGrad.addColorStop(1, `rgba(${hexToRgb(c2)}, ${Math.max(alpha - 0.02, 0.04)})`);
    offCtx.fillStyle = glassGrad;
    offCtx.fillRect(ox - blurPx * 2, oy - blurPx * 2, pw + blurPx * 4, ph + blurPx * 4);
    (offCtx as any).filter = 'none';
    offCtx.restore();

    // 3. Borders & Details
    const borderGrad = offCtx.createLinearGradient(ox, oy, ox + pw, oy + ph);
    borderGrad.addColorStop(0, `rgba(${hexToRgb(c1)}, 0.8)`);
    borderGrad.addColorStop(1, `rgba(${hexToRgb(c2)}, 0.6)`);
    offCtx.strokeStyle = borderGrad;
    offCtx.lineWidth = 1.8 * sf;
    offCtx.stroke();

    offCtx.strokeStyle = 'rgba(0,0,0,0.3)';
    offCtx.lineWidth = 0.5 * sf;
    offCtx.strokeRect(ox + 1 * sf, oy + 1 * sf, pw - 2 * sf, ph - 2 * sf);

    const headerH = MENU_LAYOUT.HEADER_HEIGHT * sf;
    const hGrad = offCtx.createLinearGradient(ox, oy, ox, oy + headerH);
    hGrad.addColorStop(0, `rgba(${hexToRgb(c1)}, 0.45)`);
    hGrad.addColorStop(0.15, `rgba(${hexToRgb(c1)}, 0.6)`);
    hGrad.addColorStop(1, `rgba(10, 10, 20, 0.9)`);

    offCtx.fillStyle = hGrad;
    offCtx.beginPath();
    offCtx.roundRect(ox, oy, pw, headerH, [MENU_LAYOUT.PANEL_HEADER_RADIUS[0] * sf, MENU_LAYOUT.PANEL_HEADER_RADIUS[1] * sf, 0, 0]);
    offCtx.fill();

    offCtx.strokeStyle = `rgba(${hexToRgb(c1)}, 0.3)`;
    offCtx.lineWidth = 1 * sf;
    offCtx.beginPath(); offCtx.moveTo(ox, oy + headerH); offCtx.lineTo(ox + pw, oy + headerH); offCtx.stroke();

    offCtx.fillStyle = '#fff';
    offCtx.shadowBlur = 10 * sf; offCtx.shadowColor = '#fff';
    drawTrackedText(offCtx as CanvasRenderingContext2D, tabLabel, ox + 20 * sf, oy + headerH / 2 + 1 * sf, 18 * sf, 4 * sf, '#fff', 'left', 'rgba(0,0,0,0.6)');

    if (rightLabel && rightValue) {
        // Render Label (Solid White for maximum clarity)
        const labelW = getCachedTextWidth(offCtx as CanvasRenderingContext2D, rightLabel);
        offCtx.shadowBlur = 0;
        drawTrackedText(offCtx as CanvasRenderingContext2D, rightLabel, ox + pw - 20 * sf - (labelW + 25 * sf), oy + headerH / 2 + 1 * sf, 14 * sf, 2 * sf, '#fff', 'right', 'rgba(0,0,0,0.8)');

        // Render Divider //
        drawTrackedText(offCtx as CanvasRenderingContext2D, "//", ox + pw - 20 * sf - (labelW + 5 * sf), oy + headerH / 2 + 1 * sf, 14 * sf, 2 * sf, 'rgba(255,255,255,0.4)', 'right', 'rgba(0,0,0,0.5)');

        // Render Value (High-Visibility Amber/Yellow with Intense Contrast)
        const vibrantGold = '#FFEB3B'; 
        offCtx.shadowBlur = 18 * sf; offCtx.shadowColor = 'rgba(0,0,0,1)'; // Dark shadow first for separation
        offCtx.shadowOffsetX = 0; offCtx.shadowOffsetY = 2 * sf;
        
        // Use a much brighter, separate glow
        ctx.save();
        offCtx.shadowBlur = 20 * sf; offCtx.shadowColor = vibrantGold;
        drawTrackedText(offCtx as CanvasRenderingContext2D, rightValue, ox + pw - 20 * sf, oy + headerH / 2 + 1 * sf, 24 * sf, 1 * sf, vibrantGold, 'right', '#000');
        ctx.restore();
    }

    // Cache the rendered off-screen canvas
    panelCache.set(cacheKey, offCanvas);

    ctx.drawImage(offCanvas, px - ox, py - oy);
}


export function drawScanlines(ctx: CanvasRenderingContext2D, w: number, h: number, time: number) {
    ctx.save();
    ctx.globalAlpha = 0.04;
    ctx.fillStyle = '#fff'; // Use fillStyle for the pattern
    const gap = 6;
    const offset = (time * 20) % gap;
    for (let y = offset; y < h; y += gap) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    ctx.restore();
}

export function drawScreenCornerDecals(ctx: CanvasRenderingContext2D, w: number, h: number, sf: number, time: number, color: string) {
    ctx.save();
    ctx.globalAlpha = 0.3 + Math.sin(time * 2) * 0.1;
    ctx.strokeStyle = color; ctx.lineWidth = 2 * sf;
    const s = 50 * sf;
    const p = 15 * sf;
    ctx.strokeRect(p, p, s, 2 * sf); ctx.strokeRect(p, p, 2 * sf, s);
    ctx.strokeRect(w - p - s, h - p - 2 * sf, s, 2 * sf); ctx.strokeRect(w - p - 2 * sf, h - p - s, 2 * sf, s);
    ctx.restore();
}
