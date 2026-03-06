/**
 * UIUtils provides common drawing helpers for the rhythm game's UI.
 * These functions are stateless and take the CanvasRenderingContext2D as their first argument.
 */

// ─────────────────────────────────────────────────────────────────────────────
// UI Utils: Generic drawing helpers
// ─────────────────────────────────────────────────────────────────────────────

export function drawAtmosphere(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.clearRect(0, 0, width, height);

    // 1. Deep Space Radial Gradient
    const cx = width / 2;
    const cy = height / 2;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.9);
    grad.addColorStop(0, '#0a0a1f'); // Dark Midnight Blue
    grad.addColorStop(1, '#020205'); // Near Black

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // 2. Subtle Tech Grid Floor
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.03)';
    ctx.lineWidth = 1;
    const gridSize = 50;
    for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
    ctx.restore();

    // 3. Ambient Noise / Scanline Texture
    ctx.save();
    ctx.globalAlpha = 0.02;
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 50; i++) {
        const rx = Math.random() * width;
        const ry = Math.random() * height;
        ctx.fillRect(rx, ry, 2, 2);
    }
    ctx.restore();
}

export function drawCuteTile(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    color: string | CanvasGradient,
    isActive: boolean = false,
    shadowColor?: string
): void {
    ctx.save();
    ctx.fillStyle = color;
    const effectiveShadowColor = shadowColor || (typeof color === 'string' ? color : 'rgba(0, 0, 0, 0.4)');
    ctx.shadowColor = isActive ? effectiveShadowColor : 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = isActive ? 15 : 6;
    ctx.shadowOffsetY = 2;

    ctx.beginPath(); ctx.roundRect(x, y, w, h, isActive ? 20 : 12); ctx.fill();

    if (isActive) {
        ctx.lineWidth = 4; ctx.strokeStyle = 'white'; ctx.shadowColor = 'transparent';
    } else {
        ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'; ctx.shadowColor = 'transparent';
    }
    ctx.stroke();
    ctx.restore();
}

export function drawCuteLabel(
    ctx: CanvasRenderingContext2D,
    text: string, x: number, y: number,
    align: CanvasTextAlign = 'left', size: number = 14,
    color: string = '#636e72', outline: boolean = false,
    fontFam: string = '"Nunito", sans-serif'
): void {
    ctx.save();
    ctx.font = `800 ${size}px ${fontFam}`;
    ctx.textAlign = align; ctx.textBaseline = 'middle';
    if (outline) {
        ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 3;
        ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.lineJoin = 'round';
        ctx.strokeText(text, x, y);
    } else {
        ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 2;
    }
    ctx.fillStyle = color; ctx.fillText(text, x, y);
    ctx.restore();
}

export function drawVisualizer(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, radius: number,
    time: number, color: string, bpm: number
): void {
    ctx.save();
    ctx.translate(cx, cy);
    // Layer 1: Base Ring
    ctx.rotate(time * -0.2);
    ctx.strokeStyle = 'white'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, radius * 1.2, 0, Math.PI * 2); ctx.stroke();

    // Layer 2: Main Data Ring (Pulsing)
    const pulse = Math.sin(time * (bpm / 60) * Math.PI);
    ctx.rotate(time * 0.4);
    ctx.strokeStyle = color; ctx.lineWidth = 6;
    ctx.shadowBlur = 10; ctx.shadowColor = color;
    ctx.beginPath(); ctx.arc(0, 0, radius + pulse * 5, 0, Math.PI * 2); ctx.stroke();

    // Layer 3: Reactive Bars
    const bars = 24;
    for (let i = 0; i < bars; i++) {
        const angle = (Math.PI * 2 / bars) * i;
        const barLen = 10 + Math.abs(Math.sin(time * 4 + i)) * 20 * (pulse + 1);
        ctx.save(); ctx.rotate(angle); ctx.fillStyle = color;
        ctx.beginPath(); ctx.roundRect(radius + 15, -4, barLen, 8, 4); ctx.fill();
        ctx.restore();
    }
    ctx.restore();
}

export function getSeededColor(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = 160 + Math.abs(hash % 160);
    const saturation = 80 + Math.abs(hash % 20);
    const lightness = 60 + Math.abs(hash % 20);
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Adjusts the brightness of a hex color.
 * positive percent to brighten, negative to darken.
 */
export function adjustColor(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const r = (num >> 16) + amt;
    const b = ((num >> 8) & 0x00FF) + amt;
    const g = (num & 0x0000FF) + amt;

    return '#' + (0x1000000 +
        (r < 255 ? (r < 1 ? 0 : r) : 255) * 0x10000 +
        (b < 255 ? (b < 1 ? 0 : b) : 255) * 0x100 +
        (g < 255 ? (g < 1 ? 0 : g) : 255)
    ).toString(16).slice(1);
}

/**
 * Desaturates a hex color by mixing it with a gray of similar luminosity.
 * amount: 0 to 1 (1 is fully grayscale)
 */
export function desaturateColor(hex: string, amount: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    // Simplistic desaturation: mix with average luminosity
    const L = 0.3 * r + 0.59 * g + 0.11 * b;
    const newR = Math.round(r + amount * (L - r));
    const newG = Math.round(g + amount * (L - g));
    const newB = Math.round(b + amount * (L - b));

    const toHex = (c: number) => c.toString(16).padStart(2, '0');
    return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
}
