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

    public start(offset: number = 0) {
        this.pausedTime = offset;
        const anchor = this.ctx.state === 'running' ? this.ctx.currentTime : 0;
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

    public resume() {
        if (this.isPlaying) return;
        const anchor = this.ctx.state === 'running' ? this.ctx.currentTime : 0;
        this.smoothClock.start(this.pausedTime, anchor);
        this.isPlaying = true;
        AudioEngineLogger.info(`TimeSync resumed at ${this.pausedTime.toFixed(3)}s (anchor: ${anchor.toFixed(3)})`);
    }

    public seek(time: number) {
        this.pausedTime = time;
        const anchor = this.ctx.state === 'running' ? this.ctx.currentTime : 0;
        this.smoothClock.seek(time);
        // We also need to re-anchor on seek
        this.smoothClock.start(time, anchor);
    }

    public reset() {
        this.isPlaying = false;
        this.pausedTime = 0;
        this.smoothClock.stop();
        this.smoothClock.seek(0);
        AudioEngineLogger.info('TimeSync state reset to 0');
    }

    public getPreciseTime(playbackRate: number = 1): number {
        if (!this.isPlaying) return this.pausedTime;

        this.smoothClock.setPlaybackRate(playbackRate);

        // Use AudioContext.currentTime as the anchor for the SmoothClock update
        // On mobile, this will be steppy, but SmoothClock will interpolate it smoothly.
        return this.smoothClock.update(this.calculateRawTime(playbackRate));
    }

    private calculateRawTime(_playbackRate: number): number {
        // This is the "noisy" anchor time
        if (this.ctx.state === 'running') {
            return this.ctx.currentTime;
        } else {
            return this.pausedTime;
        }
    }

    public getIsPlaying() { return this.isPlaying; }
}
