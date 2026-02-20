export interface TransitionData {
    source: 'editor' | 'menu' | 'rhythm';
    midiBuffer: ArrayBuffer;
    midiName: string;
    forcedChannels?: number[];
    settings: {
        mutedChannels: Set<number>;
        soloChannels?: Set<number>;
        speed: number;
        volume: number;
        difficulty?: string;
        channelConfig?: { primary: number[], secondary: number[], third: number[], drum: number[] };
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
