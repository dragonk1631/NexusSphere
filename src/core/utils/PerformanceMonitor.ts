export interface PerformanceSnapshot {
    fps: number;
    jitter: number;
    longTasks: number;
    frameTime: number;
    workDuration: number; // Pure JS execution time per frame
    workerDuration: number; // Background worker render time
}

/**
 * PerformanceMonitor: Tracks advanced metrics like frame jitter and long tasks.
 */
export class PerformanceMonitor {
    private static lastTime = performance.now();
    private static frameTimes: number[] = [];
    private static longTaskCount = 0;
    private static observer: PerformanceObserver | null = null;
    
    private static frameStartTime = 0;
    private static workDurations: number[] = [];
    private static workerDurations: number[] = [];

    public static start() {
        this.lastTime = performance.now();
        
        // Track Long Tasks (Main thread stalls > 50ms)
        try {
            this.observer = new PerformanceObserver((list) => {
                this.longTaskCount += list.getEntries().length;
            });
            this.observer.observe({ entryTypes: ['longtask'] });
        } catch (e) {
            console.warn("[PerfMonitor] PerformanceObserver not supported");
        }
    }

    public static recordFrame() {
        const now = performance.now();
        const delta = now - this.lastTime;
        this.lastTime = now;
        
        this.frameTimes.push(delta);
        if (this.frameTimes.length > 60) {
            this.frameTimes.shift();
        }
    }

    public static beginFrame() {
        this.frameStartTime = performance.now();
    }

    public static endFrame() {
        const duration = performance.now() - this.frameStartTime;
        this.workDurations.push(duration);
        if (this.workDurations.length > 60) {
            this.workDurations.shift();
        }
    }

    public static recordWorkerDuration(duration: number) {
        this.workerDurations.push(duration);
        if (this.workerDurations.length > 60) {
            this.workerDurations.shift();
        }
    }

    public static getSnapshot(currentFps: number): PerformanceSnapshot {
        const frameTime = this.frameTimes.length > 0 
            ? this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length 
            : 0;
            
        // Jitter: Standard deviation of frame times
        const jitter = this.frameTimes.length > 1
            ? Math.sqrt(this.frameTimes.map(t => Math.pow(t - frameTime, 2)).reduce((a, b) => a + b, 0) / this.frameTimes.length)
            : 0;

        const avgWork = this.workDurations.length > 0
            ? this.workDurations.reduce((a, b) => a + b, 0) / this.workDurations.length
            : 0;

        const avgWorker = this.workerDurations.length > 0
            ? this.workerDurations.reduce((a, b) => a + b, 0) / this.workerDurations.length
            : 0;

        const snapshot = {
            fps: currentFps,
            jitter: parseFloat(jitter.toFixed(2)),
            longTasks: this.longTaskCount,
            frameTime: parseFloat(frameTime.toFixed(2)),
            workDuration: parseFloat(avgWork.toFixed(2)),
            workerDuration: parseFloat(avgWorker.toFixed(2))
        };

        // Reset long task count after snapshot if needed, or keep cumulative
        return snapshot;
    }
    
    public static resetLongTasks() {
        this.longTaskCount = 0;
    }
}
