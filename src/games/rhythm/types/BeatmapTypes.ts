export interface BeatmapData {
    version: string;
    metadata?: {
        title: string;
        bpm: number;
        duration: number;
    };
    measureConfig?: [number, number][];
    channelConfig?: any;
    gameChannels?: number[];
}
