/**
 * SmoothClock: A professional-grade synthesized clock for rhythm games.
 * It uses performance.now() for frame-to-frame smoothness (micro-jitter correction)
 * while synchronizing towards the AudioContext time using a Low-Pass Filter (LPF)
 * to maintain long-term alignment without "stepping" jumps.
 */
export class SmoothClock {
    private lastPerfTime: number = 0;
    private lastReportedTime: number = 0;
    private audioAnchor: number = 0; // The AudioContext.currentTime at start
    private isPlaying: boolean = false;
    private playbackRate: number = 1;

    // Configuration
    private readonly LPF_GAIN = 0.05;
    private readonly MAX_ADJUST = 0.01; // Slightly increased for faster convergence

    constructor() {
    }

    /**
     * @param startTime The game-time to start from (e.g. 0)
     * @param audioAnchor The raw AudioContext.currentTime at this moment
     */
    public start(startTime: number = 0, audioAnchor: number = 0) {
        this.lastPerfTime = performance.now();
        this.lastReportedTime = startTime;
        this.audioAnchor = audioAnchor;
        this.isPlaying = true;
    }

    public stop() {
        this.isPlaying = false;
    }

    /**
     * Gets the current time, smoothed and synchronized.
     * @param audioCurrentTime The raw time from the audio hardware/sequencer.
     * @returns A synthesized smooth time in seconds.
     */
    public update(rawAudioTime: number): number {
        if (!this.isPlaying) return this.lastReportedTime;

        const now = performance.now();
        const delta = (now - this.lastPerfTime) / 1000;
        this.lastPerfTime = now;

        // 1. Predict next time based on internal high-res timer
        let predicted = this.lastReportedTime + (delta * this.playbackRate);

        // 2. Calculate relative audio time
        const audioCurrentTime = rawAudioTime - this.audioAnchor;

        // 3. Calculate error vs Audio Hardware
        const error = audioCurrentTime - predicted;

        // 4. Apply smooth correction
        if (Math.abs(error) > 0.005) {
            const correction = error * this.LPF_GAIN;
            const limitedCorrection = Math.max(-this.MAX_ADJUST * delta, Math.min(this.MAX_ADJUST * delta, correction));
            predicted += limitedCorrection;
        }

        // 5. Force hard sync if drift is too extreme (>200ms)
        if (Math.abs(error) > 0.2) {
            predicted = audioCurrentTime;
        }

        // 6. Monotonic guard
        if (predicted < this.lastReportedTime) {
            predicted = this.lastReportedTime;
        }

        this.lastReportedTime = predicted;
        return predicted;
    }

    public setPlaybackRate(rate: number) {
        this.playbackRate = rate;
    }

    public seek(time: number) {
        this.lastReportedTime = time;
        this.lastPerfTime = performance.now();
    }
}
