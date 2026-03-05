/**
/**
 * UIUtils provides common drawing helpers for the rhythm game's UI.
 * These functions are stateless and take the CanvasRenderingContext2D as their first argument.
 */

import type { ParsedMidi, GameNote } from '../../../core/audio/MidiParser';

// ─────────────────────────────────────────────────────────────────────────────
// EQ Visualizer: per-channel bar state (module-level for smooth decay across frames)
// ─────────────────────────────────────────────────────────────────────────────
const _eqBarHeights = new Float32Array(16);   // current displayed height  (0-1)
const _eqPeakHeights = new Float32Array(16);  // peak indicator heights
const _eqPeakTimers = new Float32Array(16);   // time since peak was set (ms)
let _eqLastFrame = 0; // timestamp for delta calculation

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG — easy to tweak without touching the drawing logic
// ─────────────────────────────────────────────────────────────────────────────
const EQ_CONFIG = {
    NUM_CHANNELS: 16,
    DECAY_RATE: 0.003,        // bar height decay per millisecond (faster for snappier look)
    PEAK_HOLD_MS: 600,        // how long peak indicator stays at top
    PEAK_DECAY_RATE: 0.002,   // peak indicator decay per ms after hold
    BAR_GAP_RATIO: 0.20,      // reduced gap for wider columns (was 0.35)
    SEGMENT_COUNT: 40,        // increased segments for high density (was 24)
    SEGMENT_GAP_RATIO: 0.15,  // reduced vertical gap for 'packed' look (was 0.25)
    REFLECTION_RATIO: 0.20,   // 8:2 split (was 0.42)
    REFLECTION_ALPHA: 0.70,   // restored higher opacity for reflection feel
    BG_BAR_ALPHA: 0.10,       // faint unlit blocks in background (Batch 3)
    PEAK_COLOR: 'rgba(255, 255, 255, 0.95)',
};

/**
 * Draws a 16-channel MIDI graphic equalizer.
 * Automatically decays bars between calls. Pass null for midi when no song is loaded.
 *
 * @param ctx   Canvas context
 * @param x     Left edge of the EQ area
 * @param y     Top edge of the EQ area
 * @param w     Total width of the EQ area
 * @param h     Total height of the EQ area
 * @param midi  Parsed MIDI data (null = idle animation)
 * @param playheadSec  Current playback position in seconds
 * @param c1    Theme color 1
 * @param c2    Theme color 2
 * @param sf    Global scale factor
 */
export function drawMidiChannelEQ(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    midi: ParsedMidi | null,
    playheadSec: number,
    _c1: string, _c2: string,
    sf: number,
    bpm: number = 120
): void {
    const now = performance.now();
    const delta = _eqLastFrame > 0 ? now - _eqLastFrame : 16;
    _eqLastFrame = now;

    // ── 1. Draw Separator Outline & Background Box ──
    ctx.save();
    // Inner dark background to make colors pop
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6 * sf);
    ctx.fill();

    // Crisp high-tech border
    ctx.strokeStyle = _c1; // Use theme color to make it pop
    ctx.lineWidth = 2 * sf;
    ctx.stroke();

    // Inner padding for bars
    const innerPadX = 12 * sf;
    const innerPadY = 6 * sf; // Reduced padding to fill space
    const plotX = x + innerPadX;
    const plotY = y + innerPadY;
    const plotW = w - innerPadX * 2;
    const plotH = h - innerPadY * 2;

    const N = EQ_CONFIG.NUM_CHANNELS;
    const totalGap = plotW * EQ_CONFIG.BAR_GAP_RATIO;
    const barW = (plotW - totalGap) / N;
    const colGap = totalGap / (N - 1);

    // Split height: Main vs Reflection
    const mainH = plotH * (1 - EQ_CONFIG.REFLECTION_RATIO);

    // Segment math
    const numSeg = EQ_CONFIG.SEGMENT_COUNT;
    const totalSegGap = mainH * EQ_CONFIG.SEGMENT_GAP_RATIO;
    const segGap = totalSegGap / (numSeg - 1);
    const segH = (mainH - totalSegGap) / numSeg;
    const cornerR = Math.min(2 * sf, segH * 0.3);

    // ── 2. Build target heights with simulated ADSR Envelope ──
    const targets = new Float32Array(N);
    if (midi) {
        for (const track of midi.tracks) {
            const ch = track.channel;
            if (ch < 0 || ch >= N) continue;
            for (const note of track.notes as GameNote[]) {
                if (note.time > playheadSec) break; // notes sorted by time
                const noteEnd = note.time + note.duration;
                if (noteEnd >= playheadSec) {
                    // Note is active: simulate decay envelope
                    let v = note.velocity / 127;

                    // How long has the note been playing?
                    // Audio usually strikes hard then decays. Even if a MIDI note is long, 
                    // a visualizer looks best when it "bounces".
                    const playedFor = playheadSec - note.time;

                    // Fast attack, exponential decay based on duration
                    // Decay curve: fast drop initially, then holds a sustain level
                    const decayFactor = Math.max(0.1, 1 - (playedFor * 3)); // Rapid volume drop
                    v = v * decayFactor;

                    if (v > targets[ch]) targets[ch] = v;
                }
            }
        }
    }

    // ── 3. Smooth logic update ──
    for (let ch = 0; ch < N; ch++) {
        // Idle ripple if no midi
        const target = midi ? targets[ch] : 0.05 + Math.abs(Math.sin(now * 0.001 + ch * 0.4)) * 0.1;

        if (target > _eqBarHeights[ch]) {
            _eqBarHeights[ch] = target;
            if (target > _eqPeakHeights[ch]) {
                _eqPeakHeights[ch] = target;
                _eqPeakTimers[ch] = 0;
            }
        } else {
            _eqBarHeights[ch] = Math.max(0, _eqBarHeights[ch] - EQ_CONFIG.DECAY_RATE * delta);
        }

        _eqPeakTimers[ch] += delta;
        if (_eqPeakTimers[ch] > EQ_CONFIG.PEAK_HOLD_MS) {
            _eqPeakHeights[ch] = Math.max(0, _eqPeakHeights[ch] - EQ_CONFIG.PEAK_DECAY_RATE * delta);
        }
    }

    // ── 4. Draw Segmented Bars ──
    for (let ch = 0; ch < N; ch++) {
        const bx = plotX + ch * (barW + colGap);

        // Rainbow Hue Mapping: Purple(270) -> Red(0) -> Green(120) -> Blue(240)
        // Wraps perfectly across the 16 channels to map the visual spectrum.
        const hue = (270 + ch * (330 / 15)) % 360;
        const colorStr = `hsl(${Math.floor(hue)}, 100%, 60%)`;

        const activeSegs = Math.ceil(_eqBarHeights[ch] * numSeg);
        const peakSegIdx = Math.min(numSeg - 1, Math.floor(_eqPeakHeights[ch] * numSeg));

        // Draw unlit background segments
        ctx.fillStyle = `rgba(255,255,255,${EQ_CONFIG.BG_BAR_ALPHA})`;
        for (let i = 0; i < numSeg; i++) {
            if (i < activeSegs) continue; // Will be drawn lit
            const sy = plotY + mainH - (i + 1) * segH - i * segGap;
            ctx.beginPath(); ctx.roundRect(bx, sy, barW, segH, cornerR); ctx.fill();
        }

        // Draw lit active segments
        if (activeSegs > 0) {
            ctx.fillStyle = colorStr;
            ctx.shadowColor = colorStr;
            for (let i = 0; i < activeSegs; i++) {
                const sy = plotY + mainH - (i + 1) * segH - i * segGap;
                // Add stronger glow to the top block
                ctx.shadowBlur = (i === activeSegs - 1) ? 15 * sf : Math.max(1, 4 * sf);
                ctx.beginPath(); ctx.roundRect(bx, sy, barW, segH, cornerR); ctx.fill();
            }
        }

        // Draw falling peak block
        if (_eqPeakHeights[ch] > 0.02 && peakSegIdx >= activeSegs) {
            const py = plotY + mainH - (peakSegIdx + 1) * segH - peakSegIdx * segGap;
            ctx.fillStyle = EQ_CONFIG.PEAK_COLOR;
            ctx.shadowColor = '#fff';
            ctx.shadowBlur = 8 * sf;
            ctx.beginPath(); ctx.roundRect(bx, py, barW, segH, cornerR); ctx.fill();
        }

        ctx.shadowBlur = 0;

        // Draw Reflection (mirrored downwards below mainH)
        // Reflection base is separated by a tiny gap
        // reflection baseline moved further down to accommodate the 8:2 split and separator
        const reflectBasline = plotY + mainH + segGap * 1.5;

        // ── Batch 7: Beat-Responsive Separation Line ──
        if (ch === 0) {
            ctx.save();
            // Constant line opacity, pulsating bloom (Batch 8)
            const beatPulse = Math.pow(Math.max(0, Math.sin(playheadSec * (bpm / 60) * Math.PI)), 4);

            ctx.strokeStyle = `rgba(255, 255, 255, 0.5)`; // Constant brightness
            ctx.lineWidth = 1 * sf;

            // Fluorescent lamp pulsating effect around the line
            ctx.shadowBlur = (8 + beatPulse * 15) * sf;
            const bloomAlpha = 0.4 + beatPulse * 0.6;
            ctx.shadowColor = `rgba(255, 255, 255, ${bloomAlpha})`;

            ctx.beginPath();
            ctx.moveTo(plotX, plotY + mainH + segGap);
            ctx.lineTo(plotX + plotW, plotY + mainH + segGap);
            ctx.stroke();
            ctx.restore();
        }

        for (let i = 0; i < activeSegs; i++) {
            const ry = reflectBasline + i * (segH + segGap);
            // Stop if reflection overflows the plot area
            if (ry + segH > plotY + plotH) break;

            // Opacity fades out the further down it goes
            const fade = Math.max(0, 1 - (i / (numSeg * EQ_CONFIG.REFLECTION_RATIO)));
            if (fade <= 0) break;

            // Reduced saturation (70%) and slightly darker lightness (45%) for a pure "shadow reflection" look
            ctx.fillStyle = `hsla(${Math.floor(hue)}, 70%, 45%, ${EQ_CONFIG.REFLECTION_ALPHA * fade})`;
            ctx.beginPath(); ctx.roundRect(bx, ry, barW, segH, cornerR); ctx.fill();
        }
    } // end for(ch)

    ctx.restore();
}

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
    x: number,
    y: number,
    w: number,
    h: number,
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

    ctx.beginPath();
    ctx.roundRect(x, y, w, h, isActive ? 20 : 12);
    ctx.fill();

    if (isActive) {
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'white';
        ctx.shadowColor = 'transparent';
    } else {
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.shadowColor = 'transparent';
    }
    ctx.stroke();
    ctx.restore();
}

export function drawCuteLabel(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    align: CanvasTextAlign = 'left',
    size: number = 14,
    color: string = '#636e72',
    outline: boolean = false,
    fontFam: string = '"Nunito", sans-serif'
): void {
    ctx.save();
    ctx.font = `800 ${size}px ${fontFam}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';

    if (outline) {
        ctx.shadowColor = 'rgba(0,0,0,0.85)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 3;
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        ctx.lineJoin = 'round';
        ctx.strokeText(text, x, y);
    } else {
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetY = 2;
    }

    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.restore();
}

export function drawVisualizer(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    time: number,
    color: string,
    bpm: number
): void {
    ctx.save();
    ctx.translate(cx, cy);

    // Layer 1: Base Ring
    ctx.rotate(time * -0.2);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.2, 0, Math.PI * 2);
    ctx.stroke();

    // Layer 2: Main Data Ring (Pulsing)
    const pulse = Math.sin(time * (bpm / 60) * Math.PI);
    ctx.rotate(time * 0.4);
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.shadowBlur = 10;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.arc(0, 0, radius + pulse * 5, 0, Math.PI * 2);
    ctx.stroke();

    // Layer 3: Reactive Bars
    const bars = 24;
    for (let i = 0; i < bars; i++) {
        const angle = (Math.PI * 2 / bars) * i;
        const barLen = 10 + Math.abs(Math.sin(time * 4 + i)) * 20 * (pulse + 1);

        ctx.save();
        ctx.rotate(angle);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(radius + 15, -4, barLen, 8, 4);
        ctx.fill();
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
