import { MENU_LAYOUT } from './MenuLayoutConfig';

/**
 * Common color and typography utilities for the premium menu.
 * These are stateless pure functions extracted to ensure reusability
 * and separation of concerns across different panel renderers.
 */

// --- Caches for Performance Optimization (Step 3) ---
const colorCache = new Map<string, string>();
const lerpColorCache = new Map<string, string>();
const textWidthCache = new Map<string, number>();

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

export function drawTrackedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, tracking: number, color: string, align: 'left' | 'center' | 'right', strokeColor: string = 'transparent') {
    ctx.font = `900 ${Math.floor(size)}px "Orbitron"`;
    ctx.fillStyle = color;
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';

    let totalW = 0;
    for (let i = 0; i < text.length; i++) {
        totalW += getCachedTextWidth(ctx, text[i]) + tracking;
    }
    totalW -= tracking;

    let startX = x;
    if (align === 'center') startX = x - totalW / 2;
    if (align === 'right') startX = x - totalW;

    for (let i = 0; i < text.length; i++) {
        if (strokeColor !== 'transparent') {
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 3 * (size / 15);
            ctx.strokeText(text[i], startX, y);
        }
        ctx.fillText(text[i], startX, y);
        startX += getCachedTextWidth(ctx, text[i]) + tracking;
    }
}

export function drawPremiumTypography(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, align: CanvasTextAlign, size: number, color: string, isBold: boolean, glowColor: string, maxW: number, strokeColor: string = 'transparent') {
    ctx.save();
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';

    ctx.font = `${isBold ? 900 : 400} ${Math.floor(size)}px "Orbitron"`;
    const textW = getCachedTextWidth(ctx, text);
    const finalScale = textW > maxW ? maxW / textW : 1;

    if (finalScale < 1) {
        ctx.font = `${isBold ? 900 : 400} ${Math.floor(size * finalScale)}px "Orbitron"`;
    }

    if (glowColor !== 'transparent') {
        ctx.shadowBlur = 10 * (size / 30); ctx.shadowColor = glowColor;
    } else {
        ctx.shadowBlur = 0;
    }

    if (strokeColor !== 'transparent') {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2 * (size / 24);
        ctx.strokeText(text, x, y);
    }

    ctx.fillStyle = color;
    ctx.fillText(text, x, y);

    if (isBold) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillText(text, x, y);
    }

    ctx.restore();
}

export function drawPremiumPanel(ctx: CanvasRenderingContext2D, px: number, py: number, pw: number, ph: number, tabLabel: string, c1: string, c2: string, sf: number, glassBg: string = 'rgba(12, 12, 28, 0.45)') {
    ctx.save();
    ctx.shadowBlur = 50 * sf; ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.fillStyle = glassBg;
    ctx.beginPath(); ctx.roundRect(px, py, pw, ph, MENU_LAYOUT.PANEL_BORDER_RADIUS * sf); ctx.fill();
    ctx.shadowBlur = 0;

    const borderGrad = ctx.createLinearGradient(px, py, px + pw, py + ph);
    borderGrad.addColorStop(0, `rgba(${hexToRgb(c1)}, 0.5)`);
    borderGrad.addColorStop(1, `rgba(${hexToRgb(c2)}, 0.4)`);
    ctx.strokeStyle = borderGrad;
    ctx.lineWidth = 2.5 * sf;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 0.5 * sf;
    ctx.beginPath(); ctx.roundRect(px + 3 * sf, py + 3 * sf, pw - 6 * sf, ph - 6 * sf, 7 * sf); ctx.stroke();

    const headerH = MENU_LAYOUT.HEADER_HEIGHT * sf;
    const hGrad = ctx.createLinearGradient(px, py, px, py + headerH);
    hGrad.addColorStop(0, `rgba(${hexToRgb(c1)}, 0.65)`);
    hGrad.addColorStop(1, `rgba(12, 12, 18, 0.95)`);

    ctx.fillStyle = hGrad;
    ctx.beginPath();
    ctx.roundRect(px, py, pw, headerH, [MENU_LAYOUT.PANEL_HEADER_RADIUS[0] * sf, MENU_LAYOUT.PANEL_HEADER_RADIUS[1] * sf, 0, 0]);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 10 * sf; ctx.shadowColor = '#fff';
    drawTrackedText(ctx, tabLabel, px + 20 * sf, py + headerH / 2 + 1 * sf, 15 * sf, 4 * sf, '#fff', 'left', 'rgba(0,0,0,0.6)');

    ctx.restore();
}

export function drawScanlines(ctx: CanvasRenderingContext2D, w: number, h: number, time: number) {
    ctx.save();
    ctx.globalAlpha = 0.04;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
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
