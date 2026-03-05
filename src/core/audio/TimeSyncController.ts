import { AudioEngineLogger } from './AudioEngineLogger';

/**
 * TimeSyncController: Encapsulates the Dual-Clock precise timing logic.
 * Handles primary clock (AudioContext) and fallback clock (performance.now).
 */
export class TimeSyncController {
    private ctx: AudioContext;
    private anchorCtxTime: number = 0;
    private anchorPerfTime: number = 0;
    private pausedTime: number = 0;
    private lastReported: number = 0;
    private isPlaying: boolean = false;

    constructor(ctx: AudioContext) {
        this.ctx = ctx;
    }

    public start(offset: number = 0) {
        this.anchorCtxTime = this.ctx.currentTime;
        this.anchorPerfTime = performance.now();
        this.pausedTime = offset;
        this.lastReported = offset;
        this.isPlaying = true;
        AudioEngineLogger.info(`TimeSync started at ${offset.toFixed(3)}s`);
    }

    public pause(playbackRate: number = 1) {
        if (!this.isPlaying) return;
        this.pausedTime = this.calculateCurrentTime(playbackRate);
        this.isPlaying = false;
        AudioEngineLogger.info(`TimeSync paused at ${this.pausedTime.toFixed(3)}s`);
    }

    public resume() {
        if (this.isPlaying) return;
        this.anchorCtxTime = this.ctx.currentTime;
        this.anchorPerfTime = performance.now();
        this.lastReported = this.pausedTime;
        this.isPlaying = true;
        AudioEngineLogger.info(`TimeSync resumed at ${this.pausedTime.toFixed(3)}s`);
    }

    public seek(time: number) {
        this.pausedTime = time;
        this.anchorCtxTime = this.ctx.currentTime;
        this.anchorPerfTime = performance.now();
        this.lastReported = time;
    }

    public reset() {
        this.isPlaying = false;
        this.anchorCtxTime = 0;
        this.anchorPerfTime = 0;
        this.pausedTime = 0;
        this.lastReported = 0;
        AudioEngineLogger.info('TimeSync state reset to 0');
    }

    public getPreciseTime(playbackRate: number = 1): number {
        if (!this.isPlaying) return this.pausedTime;
        const time = this.calculateCurrentTime(playbackRate);

        // Safety guard against time reversal
        if (time < this.lastReported - 0.001) {
            return this.lastReported;
        }

        this.lastReported = time;
        return time;
    }

    private calculateCurrentTime(playbackRate: number): number {
        if (this.ctx.state === 'running') {
            const elapsed = (this.ctx.currentTime - this.anchorCtxTime) * playbackRate;
            return this.pausedTime + elapsed;
        } else {
            // Fallback for suspended context
            const elapsed = (performance.now() - this.anchorPerfTime) / 1000;
            return this.pausedTime + (elapsed * playbackRate);
        }
    }

    public getIsPlaying() { return this.isPlaying; }
}
