/**
 * Type definitions for SpessaSynth (v4.1.5+)
 */

export interface IAudioConnectable {
    connect(dest: AudioNode): void;
}

export interface ISynth extends IAudioConnectable {
    isReady: Promise<void>;
    soundBankManager: {
        addSoundBank(data: ArrayBuffer): Promise<void>;
    };
    noteOn(channel: number, midiNote: number, velocity: number): void;
    noteOff(channel: number, midiNote: number, force?: boolean): void;
    controllerChange(channel: number, controller: number, value: number): void;
    connect(dest: AudioNode): AudioNode;
    disconnect(dest?: AudioNode): void;
    setChannelMute(channel: number, mute: boolean): void;
    // v4.1.5 uses processors or master parameters for these
    reverbGain?: number;
    chorusGain?: number;
    // Helper to avoid 'as any' where possible
    [key: string]: any;
}

export interface ISequencer {
    loadNewSongList(songs: any[]): void;
    play(): void;
    pause(): void;
    stop?(): void;
    playing?: boolean;
    currentTime: number;
    duration: number;
    playbackRate: number;
    tracks?: any[];
    midiData?: {
        tracks: any[];
    };
    muteChannel?(channel: number, mute: boolean): void;
    eventHandler: {
        addEvent(type: string, id: string, callback: (event: any) => void): void;
        removeEvent(event: string, id: string): void;
    };
}
