import { AudioEngineLogger } from './AudioEngineLogger';
import { SmoothClock } from './SmoothClock';

/**
 * TimeSyncController: Encapsulates the Dual-Clock precise timing logic.
 * v3.0: Uses SmoothClock (PLL) for jitter-free mobile performance.
 */
export class TimeSyncController {
    private ctx: AudioContext;
    private smoothClock: SmoothClock;
    private pausedTime: number = 0;
    private isPlaying: boolean = false;

    constructor(ctx: AudioContext) {
        this.ctx = ctx;
        this.smoothClock = new SmoothClock();
    }

    public start(offset: number = 0, anchor: number = 0) {
        this.pausedTime = offset;
        this.smoothClock.start(offset, anchor);
        this.isPlaying = true;
        AudioEngineLogger.info(`TimeSync started at ${offset.toFixed(3)}s (anchor: ${anchor.toFixed(3)})`);
    }

    public pause(playbackRate: number = 1) {
        if (!this.isPlaying) return;
        this.pausedTime = this.getPreciseTime(playbackRate);
        this.smoothClock.stop();
        this.isPlaying = false;
        AudioEngineLogger.info(`TimeSync paused at ${this.pausedTime.toFixed(3)}s`);
    }

    public resume(offset: number = 0, anchor?: number) {
        if (this.isPlaying) return;
        const finalAnchor = anchor !== undefined ? anchor : this.ctx.currentTime;
        this.smoothClock.start(offset, finalAnchor);
        this.isPlaying = true;
        AudioEngineLogger.info(`TimeSync resumed at ${offset.toFixed(3)}s (anchor: ${finalAnchor.toFixed(3)})`);
    }

    public seek(time: number, anchor?: number) {
        this.pausedTime = time;
        const finalAnchor = anchor !== undefined ? anchor : (this.ctx.state === 'running' ? this.ctx.currentTime : 0);
        this.smoothClock.reAnchor(time, finalAnchor);
    }

    /**
     * Instantly aligns the clock to a new audio anchor.
     */
    public reAnchor(time: number, anchor: number) {
        this.smoothClock.reAnchor(time, anchor);
        this.pausedTime = time;
    }

    public reset() {
        this.isPlaying = false;
        this.pausedTime = 0;
        this.smoothClock.stop();
        this.smoothClock.seek(0);
        AudioEngineLogger.info('TimeSync state reset to 0');
    }

    public getPreciseTime(playbackRate: number = 1, rawHardwareTime?: number): number {
        if (!this.isPlaying) return this.pausedTime;

        this.smoothClock.setPlaybackRate(playbackRate);

        // If rawHardwareTime is provided (e.g. from Sequencer), use it.
        // Otherwise fallback to global AudioContext time.
        const signal = rawHardwareTime !== undefined ? rawHardwareTime : this.ctx.currentTime;
        return this.smoothClock.update(signal);
    }

    public getIsPlaying() { return this.isPlaying; }

    public setVisualOffset(offset: number) {
        this.smoothClock.setVisualOffset(offset);
    }
}
