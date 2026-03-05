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
    private static level: LogLevelType = LogLevel.INFO;

    public static setLevel(level: LogLevelType) {
        this.level = level;
    }

    public static debug(message: string, ...args: any[]) {
        if (this.level <= LogLevel.DEBUG) {
            console.debug(`[AudioEngine:DEBUG] ${message}`, ...args);
        }
    }

    public static info(message: string, ...args: any[]) {
        if (this.level <= LogLevel.INFO) {
            console.log(`[AudioEngine:INFO] ${message}`, ...args);
        }
    }

    public static warn(message: string, ...args: any[]) {
        if (this.level <= LogLevel.WARN) {
            console.warn(`[AudioEngine:WARN] ${message}`, ...args);
        }
    }

    public static error(message: string, ...args: any[]) {
        if (this.level <= LogLevel.ERROR) {
            console.error(`[AudioEngine:ERROR] ${message}`, ...args);
        }
    }
}
