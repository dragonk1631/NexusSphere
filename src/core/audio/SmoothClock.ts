
/**
 * SmoothClock: A professional-grade, Phase-Locked Loop (PLL) based clock.
 * Designed for rhythm games to provide frame-perfect visual smoothness 
 * while maintaining strict long-term alignment with the AudioContext clock.
 * 
 * v4.0 architecture:
 * - Proportional Gain (K_P): Phase/Position correction
 * - Integral Gain (K_I): Frequency/Velocity correction
 */
export class SmoothClock {
    private lastPerfTime: number = 0;
    private lastReportedTime: number = 0;
    
    private smoothTime: number = 0;
    private velocity: number = 1.0; // P-I Controller Internal Velocity
    
    private isPlaying: boolean = false;
    private playbackRate: number = 1;
    private firstMoveDetected: boolean = false;
    private startWaitTime: number = 0;
    private audioAnchor: number = 0;

    // PLL Constants (Tuned for 60Hz - 144Hz displays)
    private readonly K_P = 0.12;  // Phase correction gain
    private readonly K_I = 0.001; // Frequency correction gain (conservative)

    constructor() { }

    public start(startTime: number = 0, audioAnchor: number = 0) {
        this.lastPerfTime = performance.now();
        this.smoothTime = startTime;
        this.lastReportedTime = startTime;
        this.audioAnchor = audioAnchor;
        this.velocity = 1.0;
        this.isPlaying = true;
        this.firstMoveDetected = false;
        this.startWaitTime = 0;
    }

    public stop() {
        this.isPlaying = false;
    }

    /**
     * Hard Reset / Seek
     */
    public reAnchor(startTime: number, audioAnchor: number) {
        this.audioAnchor = audioAnchor;
        this.lastPerfTime = performance.now();
        this.smoothTime = startTime;
        this.lastReportedTime = startTime;
        this.velocity = 1.0;
        this.firstMoveDetected = true;
    }

    public update(rawAudioTime: number): number {
        if (!this.isPlaying) return this.lastReportedTime;

        const now = performance.now();
        const dt = (now - this.lastPerfTime) / 1000;
        this.lastPerfTime = now;

        // 1. PINPOINT DETECTION: Capture the starting movement
        if (!this.firstMoveDetected) {
            const hasMoved = rawAudioTime !== this.audioAnchor || (this.audioAnchor === 0 && rawAudioTime > 0.0001);

            if (hasMoved) {
                this.audioAnchor = rawAudioTime;
                this.smoothTime = rawAudioTime;
                this.firstMoveDetected = true;
                this.velocity = 1.0;
            } else {
                this.startWaitTime += dt;
                // Timeout fallback if hardware doesn't report immediately
                if (this.startWaitTime > 0.1) {
                    this.firstMoveDetected = true;
                    this.smoothTime = this.lastReportedTime;
                }
                return this.lastReportedTime;
            }
        }

        // 2. PLL CALCULATIONS
        // The error is the delta between where the audio hardware says we are
        // and where our smooth internal clock currently sits.
        const error = rawAudioTime - this.smoothTime;

        // [I] Integral: Adjust the internal velocity to catch up with the frequency drift
        // Clamp it to avoid extreme speed-up/slow-down on lag spikes
        this.velocity += error * this.K_I;
        this.velocity = Math.max(0.95, Math.min(1.05, this.velocity));

        // [P] Proportional + Velocity: Advance the time
        // Note: dt * this.velocity provides the pure LINEAR progression tied to CPU time (perf.now)
        //       + (error * this.K_P) provides the sub-frame phase correction to stay synced
        this.smoothTime += (dt * this.velocity * this.playbackRate) + (error * this.K_P);

        // 3. SAFETY GUARDS
        // Monotonicity: Time must never go backwards for the renderer
        if (this.smoothTime < this.lastReportedTime) {
            this.smoothTime = this.lastReportedTime;
        }

        // Hard Limit: If we desync more than 250ms, the PLL has failed (e.g. backgrounding).
        // Trigger a hard jump to recover instantly.
        if (Math.abs(error) > 0.25) {
            this.smoothTime = rawAudioTime;
            this.velocity = 1.0;
        }

        this.lastReportedTime = this.smoothTime;
        return this.smoothTime;
    }

    public setPlaybackRate(rate: number) {
        this.playbackRate = rate;
    }

    public setVisualOffset(offset: number) {
        // In the PLL version, visualOffset should be added to the output
        // or handled by adjusting the smoothTime. 
        // For professional use, shifting the smoothTime slightly is better.
        this.smoothTime += offset;
    }

    public seek(time: number) {
        this.reAnchor(time, time);
    }
}
