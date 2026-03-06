/**
 * Type definitions for SpessaSynth (v4.0.20)
 * These interfaces provide type-safety for a library that doesn't have official types.
 */

export interface ISynth {
    isReady: Promise<void>;
    soundBankManager: {
        addSoundBank(data: ArrayBuffer): Promise<void>;
    };
    noteOn(channel: number, midiNote: number, velocity: number): void;
    noteOff(channel: number, midiNote: number): void;
    controllerChange(channel: number, controller: number, value: number): void;
    connect(dest: AudioNode): void;
    disconnect(dest?: AudioNode): void;
    reverbGain: number;
    chorusGain: number;
    setChannelMute?(channel: number, mute: boolean): void;
    // Add other members as needed
}

export interface ISequencer {
    loadNewSongList(songs: { binary: ArrayBuffer }[]): Promise<void>;
    play(): void;
    pause(): void;
    stop?(): void;
    currentTime: number;
    duration: number;
    playbackRate: number;
    tracks: any[];
    song?: {
        tracks: any[];
    };
    muteChannel?(channel: number, mute: boolean): void;
    eventHandler: {
        addEvent(type: string, id: string, callback: (event: any) => void): void;
        removeEvent(id: string): void;
    };
}
