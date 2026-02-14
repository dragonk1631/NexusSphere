export interface TransitionData {
    source: 'editor' | 'menu' | 'rhythm';
    midiBuffer: ArrayBuffer;
    midiName: string;
    settings: {
        mutedChannels: Set<number>;
        speed: number;
        volume: number;
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
