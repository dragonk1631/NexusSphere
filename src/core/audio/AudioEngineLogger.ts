export const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4
} as const;

export type LogLevelType = typeof LogLevel[keyof typeof LogLevel];

/**
 * Centralized Logger for the Audio Engine.
 * Allows controlling verbosity and reducing performance impact of console calls.
 */
export class AudioEngineLogger {
    private static level: LogLevelType = LogLevel.WARN;
    public static VERBOSE_LOGS: boolean = false;

    public static setLevel(level: LogLevelType) {
        this.level = level;
    }

    public static debug(message: string, ...args: any[]) {
        if (this.level <= LogLevel.DEBUG) {
            console.debug(`[AudioEngine:DEBUG] ${message}`, ...args);
        }
    }

    public static info(message: string, ...args: any[]) {
        if (this.level <= LogLevel.INFO || this.VERBOSE_LOGS) {
            console.log(`[AudioEngine:INFO] ${message}`, ...args);
        }
    }

    public static warn(message: string, ...args: any[]) {
        if (this.level <= LogLevel.WARN || this.VERBOSE_LOGS) {
            console.warn(`[AudioEngine:WARN] ${message}`, ...args);
        }
    }

    public static error(message: string, ...args: any[]) {
        if (this.level <= LogLevel.ERROR) {
            console.error(`[AudioEngine:ERROR] ${message}`, ...args);
        }
    }

    /**
     * Specialized logging for performance metrics and system load.
     * Always logs regardless of current LogLevel (unless NONE).
     */
    public static metric(category: string, message: string, data?: any) {
        if (this.level === LogLevel.NONE) return;
        
        // Only log if verbose is ON, UNLESS it's a critical performance metric
        const isCritical = category.toUpperCase() === 'SYNC' || category.toUpperCase() === 'STALL';
        if (!this.VERBOSE_LOGS && !isCritical) return;
        
        const timestamp = performance.now().toFixed(2);
        const prefix = `[AudioPerf:${category.toUpperCase()}]`;
        if (data) {
            console.log(`${prefix} (${timestamp}ms) ${message}`, data);
        } else {
            console.log(`${prefix} (${timestamp}ms) ${message}`);
        }
    }
}
