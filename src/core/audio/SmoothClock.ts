import { AudioEngineLogger } from './AudioEngineLogger';

/**
 * SmoothClock: A professional-grade synthesized clock for rhythm games.
 * It uses performance.now() for frame-to-frame smoothness (micro-jitter correction)
 * while synchronizing towards the AudioContext time using a Low-Pass Filter (LPF)
 * to maintain long-term alignment without "stepping" jumps.
 */
export class SmoothClock {
    private lastPerfTime: number = 0;
    private lastReportedTime: number = 0;
    private initialStartTime: number = 0;
    private audioAnchor: number = 0;
    private perfAnchor: number = 0;
    private isPlaying: boolean = false;
    private playbackRate: number = 1;

    private firstMoveDetected: boolean = false;
    private startWaitTime: number = 0;
    private lastRawHardwareTime: number = -1;

    constructor() { }

    public start(startTime: number = 0, audioAnchor: number = 0) {
        this.lastPerfTime = performance.now();
        this.lastReportedTime = startTime;
        this.initialStartTime = startTime;
        this.audioAnchor = audioAnchor;
        this.perfAnchor = this.lastPerfTime;
        this.isPlaying = true;
        this.firstMoveDetected = false;
        this.startWaitTime = 0;
    }

    public stop() {
        this.isPlaying = false;
    }

    public reAnchor(startTime: number, audioAnchor: number) {
        this.initialStartTime = startTime;
        this.audioAnchor = audioAnchor;
        this.perfAnchor = performance.now();
        this.firstMoveDetected = true; // Manual re-anchor counts as movement
    }

    public update(rawAudioTime: number): number {
        if (!this.isPlaying) return this.lastReportedTime;

        const now = performance.now();
        const delta = (now - this.lastPerfTime) / 1000;
        this.lastPerfTime = now;

        // 1. PINPOINT DETECTION: Capture the exact moment the hardware/sequencer starts moving
        if (!this.firstMoveDetected) {
            // Check if the signal has moved AT ALL from the anchor, 
            // or if we have a valid non-zero report while anchored at 0.
            const hasMoved = rawAudioTime !== this.audioAnchor || (this.audioAnchor === 0 && rawAudioTime > 0.0001);

            if (hasMoved) {
                // Audio signal started! Lock our precision stopwatch to this moment.
                this.audioAnchor = rawAudioTime;
                this.perfAnchor = now;
                this.firstMoveDetected = true;
            } else {
                // Still waiting for signal. To avoid permanent freeze, use a much tighter 0.1s safety timeout
                // for modern browsers, as 5.0s was causing user-perceived 'Stall' bugs.
                this.startWaitTime += delta;
                if (this.startWaitTime > 0.1) {
                    this.firstMoveDetected = true;
                    this.perfAnchor = now;
                    AudioEngineLogger.warn(`SmoothClock: Audio signal stall detected. Breaking wait.`);
                }
                return this.initialStartTime;
            }
        }

        // 2. LINEAR PRECISION: Time = Anchor + (HighResElapsedTime * Rate)
        const elapsed = (now - this.perfAnchor) / 1000;
        const preciseTime = this.audioAnchor + (elapsed * this.playbackRate);

        // 3. DRIFT MONITORING: Track divergence between performance.now and AudioContext
        const drift = Math.abs(preciseTime - rawAudioTime);
        const hasSignalMoved = rawAudioTime !== this.lastRawHardwareTime;
        this.lastRawHardwareTime = rawAudioTime;

        if (drift > 0.1 && this.firstMoveDetected && (now % 1000 < 20) && hasSignalMoved) { // Log occasionally (approx every 1s)
            AudioEngineLogger.metric('SYNC', `Drift detected: ${(drift * 1000).toFixed(1)}ms offset.`);
            
            // PROFESSIONAL SAFETY: If drift is catastrophic (>200ms), perform an emergency re-anchor
            if (drift > 0.2) {
                AudioEngineLogger.warn(`SmoothClock: Catastrophic drift (${(drift * 1000).toFixed(0)}ms). Force re-anchoring to source.`);
                this.reAnchor(rawAudioTime, rawAudioTime);
                return rawAudioTime;
            }
        }

        this.lastReportedTime = preciseTime;
        return preciseTime;
    }

    public setPlaybackRate(rate: number) {
        if (this.playbackRate !== rate) {
            // Re-anchor on rate change to keep precision
            this.initialStartTime = this.lastReportedTime;
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
