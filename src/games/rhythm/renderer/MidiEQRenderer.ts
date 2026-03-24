import type { ParsedMidi } from '../../../core/audio/MidiParser';

const EQ_CONFIG = {
    NUM_CHANNELS: 16,
    DECAY_RATE: 0.003,
    PEAK_HOLD_MS: 600,
    PEAK_DECAY_RATE: 0.002,
    BAR_GAP_RATIO: 0.20,
    SEGMENT_COUNT: 40,
    SEGMENT_GAP_RATIO: 0.15,
    REFLECTION_RATIO: 0.20,
    REFLECTION_ALPHA: 0.70,
    BG_BAR_ALPHA: 0.10,
    PEAK_COLOR: 'rgba(255, 255, 255, 0.95)',
};

/**
 * MidiEQRenderer: A high-performance, encapsulated MIDI Visualizer Engine.
 * Features: Zero-allocation loops, O(1) note tracking, and GPU-cached layers.
 */
export class MidiEQRenderer {
    // Buffers: Zero-allocation by pre-allocating typed arrays
    private barHeights = new Float32Array(EQ_CONFIG.NUM_CHANNELS);
    private peakHeights = new Float32Array(EQ_CONFIG.NUM_CHANNELS);
    private peakTimers = new Float32Array(EQ_CONFIG.NUM_CHANNELS);
    private targets = new Float32Array(EQ_CONFIG.NUM_CHANNELS);
    private trackCursors: Int32Array | null = null;

    // State Tracking
    private lastMidiRef: ParsedMidi | null = null;
    private lastPlayhead: number = -1;
    private lastFrameTime: number = 0;

    // Cache: Pre-calculated CSS strings to avoid heap allocation in render loop
    private channelColors: string[] = [];
    private reflectionColors: string[] = [];
    private topColors: string[] = [];

    // GPU Cache
    private bgCacheCanvas: HTMLCanvasElement | null = null;
    private bgCacheSig: string = "";

    constructor() {
        this.precalculateColors();
    }

    private precalculateColors() {
        for (let ch = 0; ch < EQ_CONFIG.NUM_CHANNELS; ch++) {
            const hue = (270 + ch * (330 / 15)) % 360;
            const h = Math.floor(hue);
            this.channelColors[ch] = `hsl(${h}, 100%, 60%)`;
            this.topColors[ch] = `hsl(${h}, 100%, 80%)`;
            this.reflectionColors[ch] = `hsla(${h}, 70%, 45%, ${EQ_CONFIG.REFLECTION_ALPHA})`;
        }
    }

    /**
     * Updates the physical state of the EQ bars based on audio time.
     * Separated from draw calls (SRP).
     */
    public update(midi: ParsedMidi | null, playheadSec: number) {
        const now = performance.now();
        const delta = this.lastFrameTime > 0 ? now - this.lastFrameTime : 16;
        this.lastFrameTime = now;

        // 1. Strict Reference Reset Check
        if (midi !== this.lastMidiRef || playheadSec < this.lastPlayhead) {
            this.lastMidiRef = midi;
            if (midi) {
                this.trackCursors = new Int32Array(midi.tracks.length);
            } else {
                this.trackCursors = null;
            }
        }
        this.lastPlayhead = playheadSec;

        // 2. Logic: Target Calculation (O(1) with cursors)
        this.targets.fill(0);
        if (midi && this.trackCursors) {
            const numTracks = Math.min(midi.tracks.length, EQ_CONFIG.NUM_CHANNELS);
            for (let i = 0; i < numTracks; i++) {
                const track = midi.tracks[i];
                const ch = track.channel;
                if (ch < 0 || ch >= EQ_CONFIG.NUM_CHANNELS) continue;

                let cursor = this.trackCursors[i];
                while (cursor < track.notes.length) {
                    const note = track.notes[cursor];
                    if (note.time > playheadSec) break;

                    const noteEnd = note.time + note.duration;
                    if (noteEnd < playheadSec) {
                        cursor++;
                        this.trackCursors[i] = cursor;
                        continue;
                    }

                    // Active note math
                    let v = note.velocity / 127;
                    const playedFor = playheadSec - note.time;
                    v *= Math.max(0.1, 1 - (playedFor * 3));
                    if (v > this.targets[ch]) this.targets[ch] = v;

                    // We do NOT increment cursor here because current note is still active
                    break;
                }
            }
        }

        // 3. Logic: Physics / Decay
        for (let ch = 0; ch < EQ_CONFIG.NUM_CHANNELS; ch++) {
            const target = midi ? this.targets[ch] : 0.05 + Math.abs(Math.sin(now * 0.001 + ch * 0.4)) * 0.1;

            if (target > this.barHeights[ch]) {
                this.barHeights[ch] = target;
                if (target > this.peakHeights[ch]) {
                    this.peakHeights[ch] = target;
                    this.peakTimers[ch] = 0;
                }
            } else {
                this.barHeights[ch] = Math.max(0, this.barHeights[ch] - EQ_CONFIG.DECAY_RATE * delta);
            }

            this.peakTimers[ch] += delta;
            if (this.peakTimers[ch] > EQ_CONFIG.PEAK_HOLD_MS) {
                this.peakHeights[ch] = Math.max(0, this.peakHeights[ch] - EQ_CONFIG.PEAK_DECAY_RATE * delta);
            }
        }
    }

    /**
     * Renders the calculated state to the canvas.
     */
    public render(
        ctx: CanvasRenderingContext2D,
        x: number, y: number, w: number, h: number,
        sf: number, c1: string, bpm: number,
        playheadSec: number
    ) {
        // 1. Layout Math
        const innerPadX = 12 * sf;
        const innerPadY = 6 * sf;
        const plotX = x + innerPadX;
        const plotY = y + innerPadY;
        const plotW = w - innerPadX * 2;
        const plotH = h - innerPadY * 2;

        const N = EQ_CONFIG.NUM_CHANNELS;
        const totalGap = plotW * EQ_CONFIG.BAR_GAP_RATIO;
        const barW = (plotW - totalGap) / N;
        const colGap = totalGap / (N - 1);
        const mainH = plotH * (1 - EQ_CONFIG.REFLECTION_RATIO);

        const numSeg = EQ_CONFIG.SEGMENT_COUNT;
        const totalSegGap = mainH * EQ_CONFIG.SEGMENT_GAP_RATIO;
        const segGap = totalSegGap / (numSeg - 1);
        const segH = (mainH - totalSegGap) / numSeg;
        const cornerR = Math.min(2 * sf, segH * 0.3);

        ctx.save();

        // Background & Border
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath(); ctx.roundRect(x, y, w, h, 6 * sf); ctx.fill();
        ctx.strokeStyle = c1; ctx.lineWidth = 2 * sf; ctx.stroke();

        // 2. Cached Background (GPU Fix)
        const currentSig = `${Math.floor(plotW)}_${Math.floor(plotH)}_${sf}`;
        if (!this.bgCacheCanvas || this.bgCacheSig !== currentSig) {
            this.generateBackgroundCache(plotW, plotH, mainH, barW, colGap, segH, segGap, cornerR);
            this.bgCacheSig = currentSig;
        }
        ctx.drawImage(this.bgCacheCanvas!, plotX, plotY);

        // 3. Dynamic Foreground & Reflections
        const reflectBasline = plotY + mainH + segGap * 1.5;

        for (let ch = 0; ch < N; ch++) {
            const bx = plotX + ch * (barW + colGap);
            const activeSegs = Math.ceil(this.barHeights[ch] * numSeg);
            const peakSegIdx = Math.min(numSeg - 1, Math.floor(this.peakHeights[ch] * numSeg));

            // Main Bars (Batched per channel for performance)
            if (activeSegs > 0) {
                ctx.fillStyle = this.channelColors[ch];
                ctx.beginPath();
                for (let i = 0; i < activeSegs; i++) {
                    const sy = plotY + mainH - (i + 1) * segH - i * segGap;
                    ctx.rect(bx, sy, barW, segH); // Use rect for batching
                }
                ctx.fill();

                // Top "Glow" block (Solid color, no shadow)
                const topY = plotY + mainH - (activeSegs) * segH - (activeSegs - 1) * segGap;
                ctx.fillStyle = this.topColors[ch];
                ctx.fillRect(bx, topY, barW, segH);
            }

            // Peak Indicator
            if (this.peakHeights[ch] > 0.02 && peakSegIdx >= activeSegs) {
                const py = plotY + mainH - (peakSegIdx + 1) * segH - peakSegIdx * segGap;
                ctx.fillStyle = EQ_CONFIG.PEAK_COLOR;
                ctx.fillRect(bx, py, barW, segH);
            }

            // Simplified Reflection (Single fill with gradient instead of individual segments)
            if (activeSegs > 0) {
                ctx.save();
                const reflectH = Math.min(plotH - (reflectBasline - plotY), activeSegs * (segH + segGap));
                if (reflectH > 0) {
                    const grad = ctx.createLinearGradient(0, reflectBasline, 0, reflectBasline + reflectH);
                    grad.addColorStop(0, this.reflectionColors[ch]);
                    grad.addColorStop(1, 'rgba(0,0,0,0)');
                    ctx.fillStyle = grad;
                    ctx.fillRect(bx, reflectBasline, barW, reflectH);
                }
                ctx.restore();
            }
        }

        // 4. Separator Line
        this.drawSeparator(ctx, plotX, plotW, reflectBasline, segGap, bpm, playheadSec, sf);

        ctx.restore();
    }

    private generateBackgroundCache(pw: number, ph: number, mh: number, bw: number, cg: number, sh: number, sg: number, cr: number) {
        this.bgCacheCanvas = document.createElement('canvas');
        this.bgCacheCanvas.width = pw;
        this.bgCacheCanvas.height = ph;
        const bgCtx = this.bgCacheCanvas.getContext('2d')!;
        bgCtx.fillStyle = `rgba(255,255,255,${EQ_CONFIG.BG_BAR_ALPHA})`;
        bgCtx.beginPath();
        for (let ch = 0; ch < EQ_CONFIG.NUM_CHANNELS; ch++) {
            const bx = ch * (bw + cg);
            for (let i = 0; i < EQ_CONFIG.SEGMENT_COUNT; i++) {
                const sy = mh - (i + 1) * sh - i * sg;
                bgCtx.roundRect(bx, sy, bw, sh, cr);
            }
        }
        bgCtx.fill();
    }

    private drawSeparator(ctx: CanvasRenderingContext2D, px: number, pw: number, rb: number, sg: number, bpm: number, time: number, sf: number) {
        ctx.save();
        const beatPulse = Math.pow(Math.max(0, Math.sin(time * (bpm / 60) * Math.PI)), 4);
        
        // Cheap Glow: Multiple transparent lines instead of shadowBlur
        const y = rb - sg / 1.5;
        const alpha = 0.4 + beatPulse * 0.6;
        
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.2})`;
        ctx.lineWidth = 10 * sf;
        ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px + pw, y); ctx.stroke();
        
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
        ctx.lineWidth = 4 * sf;
        ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px + pw, y); ctx.stroke();
        
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.lineWidth = 1 * sf;
        ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px + pw, y); ctx.stroke();
        
        ctx.restore();
    }
}
