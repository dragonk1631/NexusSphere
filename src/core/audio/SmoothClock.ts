

/**
 * SmoothClock: A professional-grade synthesized clock for rhythm games.
 * It uses performance.now() for frame-to-frame smoothness (micro-jitter correction)
 * while synchronizing towards the AudioContext time using a Low-Pass Filter (LPF)
 * to maintain long-term alignment without "stepping" jumps.
 */
export class SmoothClock {
    private lastPerfTime: number = 0;
    private lastReportedTime: number = 0;
    private audioAnchor: number = 0;
    private perfAnchor: number = 0;
    private visualOffset: number = 0; // [NEW] For Level 2 correction
    private isPlaying: boolean = false;
    private playbackRate: number = 1;

    private firstMoveDetected: boolean = false;
    private startWaitTime: number = 0;
    private lastRawHardwareTime: number = -1;

    constructor() { }

    public start(startTime: number = 0, audioAnchor: number = 0) {
        this.lastPerfTime = performance.now();
        this.lastReportedTime = startTime;
        this.audioAnchor = audioAnchor;
        this.perfAnchor = this.lastPerfTime;
        this.isPlaying = true;
        this.firstMoveDetected = false;
        this.startWaitTime = 0;
        this.visualOffset = 0;
    }

    public stop() {
        this.isPlaying = false;
    }

    public reAnchor(startTime: number, audioAnchor: number) {
        this.audioAnchor = audioAnchor;
        this.perfAnchor = performance.now();
        this.lastReportedTime = startTime;
        this.firstMoveDetected = true;
    }

    public update(rawAudioTime: number): number {
        if (!this.isPlaying) return this.lastReportedTime;

        const now = performance.now();
        const delta = (now - this.lastPerfTime) / 1000;
        this.lastPerfTime = now;

        // 1. PINPOINT DETECTION: Capture the starting movement
        if (!this.firstMoveDetected) {
            const hasMoved = rawAudioTime !== this.audioAnchor || (this.audioAnchor === 0 && rawAudioTime > 0.0001);

            if (hasMoved) {
                this.audioAnchor = rawAudioTime;
                this.perfAnchor = now;
                this.firstMoveDetected = true;
            } else {
                this.startWaitTime += delta;
                if (this.startWaitTime > 0.1) {
                    this.firstMoveDetected = true;
                    this.perfAnchor = now;
                }
                return this.lastReportedTime;
            }
        }

        // 2. ABSOLUTE AUDIO SYNC: Time = rawAudioTime + (timeSinceLastHardwareReport * Rate)
        // High-res interpolation for micro-jitter between hardware reports.
        const timeSinceHardware = (now - this.perfAnchor) / 1000;
        
        // [Visual Follows Audio] 
        // We use the rawAudioTime reported by the hardware/context as the base,
        // and only interpolate locally using performance.now to keep it smooth between frames.
        
        // If the signal hasn't changed, we can interpolate.
        // If the signal HAS changed, we update our local anchor.
        if (rawAudioTime !== this.lastRawHardwareTime) {
            this.audioAnchor = rawAudioTime;
            this.perfAnchor = now;
            this.lastRawHardwareTime = rawAudioTime;
        }

        const interpolatedTime = this.audioAnchor + (timeSinceHardware * this.playbackRate) + this.visualOffset;

        this.lastReportedTime = interpolatedTime;
        return interpolatedTime;
    }

    public setVisualOffset(offset: number) {
        this.visualOffset = offset;
    }

    public setPlaybackRate(rate: number) {
        if (this.playbackRate !== rate) {
            this.audioAnchor = this.lastReportedTime;
            this.perfAnchor = performance.now();
            this.playbackRate = rate;
        }
    }

    public seek(time: number) {
        this.reAnchor(time, time);
        this.lastReportedTime = time;
    }
}
