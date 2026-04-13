export interface TransitionData {
    source: 'editor' | 'menu' | 'rhythm';
    midiBuffer: ArrayBuffer;
    midiName: string;
    midiUrl?: string; // Optional URL for restoration
    forcedChannels?: number[];
    settings: {
        mutedChannels: Set<number>;
        soloChannels?: Set<number>;
        speed: number;
        volume: number;
        difficulty?: string;
        measureConfig?: [number, number][]; // Array of [MeasureIndex, PrimaryChannel]
        song?: any; // Add song property to fix type error in loaders
        songList?: any[]; // Optional list of songs for restoration (e.g. folder contents)
    };
}

export class GameTransition {
    private static data: TransitionData | null = null;

    public static set(data: TransitionData): void {
        this.data = data;
    }

    public static get(): TransitionData | null {
        return this.data;
    }

    public static clear(): void {
        this.data = null;
    }

    public static hasData(): boolean {
        return this.data !== null;
    }
}
