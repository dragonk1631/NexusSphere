import { ScreenUtils } from '../utils/ScreenUtils';
import { AudioEngineLogger, LogLevel } from './AudioEngineLogger';
import { AudioMixer } from './AudioMixer';
import { TimeSyncController } from './TimeSyncController';
import type { ISynth, ISequencer } from './AudioTypes';

const SPESSA_LIB_URL = 'https://esm.sh/spessasynth_lib@4.0.20';
const PROCESSOR_URL = 'https://esm.sh/spessasynth_lib@4.0.20/dist/spessasynth_processor.min.js';

/**
 * Core Audio Engine 2.0 - Encapsulated MIDI Engine
 * v2.0 Architecture: Modular Facade with Type-Safe SpessaSynth integration.
 */
export class CoreAudioEngine {
    private static instance: CoreAudioEngine;

    // Core Modules
    private ctx: AudioContext;
    private mixer: AudioMixer;
    private timer: TimeSyncController;

    // Library Components
    private synth: ISynth | null = null;
    private sequencer: ISequencer | null = null;

    // Internal State
    private isReady: boolean = false;
    private isSoundFontLoaded: boolean = false;
    private initializing: Promise<void> | null = null;

    private constructor() {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)({
            latencyHint: 'balanced'
        });
        this.mixer = new AudioMixer(this.ctx);
        this.timer = new TimeSyncController(this.ctx);

        AudioEngineLogger.setLevel(LogLevel.INFO);
        AudioEngineLogger.info("Engine Core initialized with 'balanced' latency.");
    }

    public static getInstance(): CoreAudioEngine {
        if (!CoreAudioEngine.instance) {
            CoreAudioEngine.instance = new CoreAudioEngine();
        }
        return CoreAudioEngine.instance;
    }

    /**
     * Initializes the engine and loads the SoundFont.
     */
    public async init(soundFontUrl: string): Promise<void> {
        if (this.initializing) return this.initializing;

        this.initializing = (async () => {
            if (this.isReady) return;

            try {
                // Dynamic Load SpessaSynth
                const { WorkletSynthesizer, Sequencer } = await import(SPESSA_LIB_URL);
                await this.ctx.audioWorklet.addModule(PROCESSOR_URL);

                const isMobile = ScreenUtils.isMobile();
                if (isMobile) {
                    AudioEngineLogger.info("Mobile optimization active: Reverb/Chorus disabled, polyphony capped.");
                }

                // Instantiate Synth
                this.synth = new WorkletSynthesizer(this.ctx, {
                    reverbEnabled: !isMobile,
                    chorusEnabled: !isMobile,
                    voicesAmount: isMobile ? 100 : 400,
                    interpolationType: 'linear',
                    sampleRate: this.ctx.sampleRate
                }) as ISynth;

                // Connect Synth to Mixer
                this.mixer.connectSource(this.synth as any);

                await this.synth.isReady;

                // Load SoundFont
                try {
                    const sfRes = await fetch(soundFontUrl);
                    if (!sfRes.ok) throw new Error(`HTTP ${sfRes.status}`);

                    const sfData = await sfRes.arrayBuffer();

                    // Validate RIFF
                    const header = new TextDecoder().decode(new Uint8Array(sfData.slice(0, 4)));
                    if (header.toLowerCase() !== 'riff') throw new Error("Invalid SoundFont header");

                    await this.synth.soundBankManager.addSoundBank(sfData);
                    this.sequencer = new Sequencer(this.synth) as ISequencer;
                    this.isReady = true;
                    this.isSoundFontLoaded = true;
                    AudioEngineLogger.info("Engine Ready with SoundFont");
                } catch (sfError) {
                    AudioEngineLogger.warn(`SoundFont load failed: ${sfError}. Running in silent mode.`);
                    this.sequencer = new Sequencer(this.synth) as ISequencer;
                    this.isReady = true;
                    this.isSoundFontLoaded = false;
                }
            } catch (e) {
                AudioEngineLogger.error("Critical Engine Init failed:", e);
                throw e;
            }
        })();

        return this.initializing;
    }

    /**
     * Precise initialization guard using the initPromise directly. (GC Friendly)
     */
    public async ensureReady(): Promise<void> {
        if (this.initializing) return this.initializing;
        if (!this.isReady) throw new Error("Audio Engine must be initialized first.");
    }

    /**
     * Loads a MIDI binary and prepares the sequencer.
     */
    public async loadMidi(buffer: ArrayBuffer): Promise<void> {
        await this.ensureReady();

        // Safe cleanup of legacy sequencer
        if (this.sequencer) {
            try { this.sequencer.pause(); } catch (e) { }
        }

        const { Sequencer } = await import(SPESSA_LIB_URL);
        this.sequencer = new Sequencer(this.synth) as ISequencer;
        this.timer.reset();

        // Add Diagnostics
        this.sequencer.eventHandler.addEvent("songEnded", "engine-song-end", () => {
            AudioEngineLogger.info(`Song ended at ${this.currentTime.toFixed(2)}s`);
        });

        await this.sequencer.loadNewSongList([{ binary: buffer }]);
        this.sequencer.pause();
        this.sequencer.currentTime = 0;
        this.timer.seek(0);

        AudioEngineLogger.info(`MIDI Loaded. Duration: ${this.duration.toFixed(2)}s`);
    }

    public async play(): Promise<void> {
        if (!this.isSoundFontLoaded) return;

        if (this.ctx.state === 'suspended') {
            AudioEngineLogger.warn("Attempting play while context is suspended. Make sure to resume() on user gesture.");
            try { await this.ctx.resume(); } catch (e) { }
        }

        this.timer.resume();
        this.sequencer?.play();
    }

    public pause(): void {
        this.timer.pause(this.sequencer?.playbackRate || 1);
        this.sequencer?.pause();
    }

    public stop(): void {
        if (this.sequencer) {
            this.timer.pause();
            this.sequencer.pause();
            this.sequencer.currentTime = 0;
            this.stopAllNotes();
            this.timer.seek(0);
            AudioEngineLogger.info("Playback stopped and reset.");
        }
    }

    public stopAllNotes(): void {
        if (!this.synth || !this.isReady) return;
        for (let i = 0; i < 16; i++) {
            this.stopChannelNotes(i);
        }
    }

    public stopChannelNotes(channel: number): void {
        if (this.synth) {
            this.synth.controllerChange(channel, 120, 0); // All Sound Off
            this.synth.controllerChange(channel, 123, 0); // All Notes Off
        }
    }

    public seek(time: number): void {
        if (this.sequencer) {
            this.sequencer.currentTime = time;
            this.timer.seek(time);
        }
    }

    public setPlaybackRate(rate: number): void {
        if (this.sequencer) {
            this.sequencer.playbackRate = rate;
        }
    }

    /* -------------------------------------------
       Synth Interaction
       ------------------------------------------- */

    public triggerNoteOn(channel: number, pitch: number, velocity: number = 100): void {
        if (this.synth && this.isReady && this.isSoundFontLoaded) {
            this.synth.noteOn(channel, pitch, Math.max(30, velocity));
        }
    }

    public triggerNoteOff(channel: number, pitch: number): void {
        if (this.synth) this.synth.noteOff(channel, pitch);
    }

    /* -------------------------------------------
       Mixer & Channel Management
       ------------------------------------------- */

    public setChannelVolume(channel: number, volume: number): void {
        if (this.synth) {
            this.synth.controllerChange(channel, 7, volume);
            if (volume === 0) this.stopChannelNotes(channel);
        }
    }

    public overrideChannelVolume(channel: number, volume: number): void {
        if (this.synth) this.synth.controllerChange(channel, 7, volume);
    }

    public setChannelMute(channel: number, mute: boolean): void {
        if (this.synth?.setChannelMute) {
            this.synth.setChannelMute(channel, mute);
        } else if (this.sequencer?.muteChannel) {
            this.sequencer.muteChannel(channel, mute);
        } else {
            this.setChannelVolume(channel, mute ? 0 : 100);
        }
    }

    public setTrackMute(trackIndex: number, mute: boolean): void {
        const tracks = this.getSequencerTracks();
        const track = tracks[trackIndex];
        if (track) {
            track.userMute = mute;
            track.disabled = mute;
            if (mute) this.stopChannelNotes(track.channel);
            this.updateChannelMuteState(track.channel);
        }
    }

    private updateChannelMuteState(channel: number): void {
        const tracks = this.getSequencerTracks();
        const channelTracks = tracks.filter((t: any) => t.channel === channel);
        const allMuted = channelTracks.every((t: any) => t.userMute || t.disabled);
        this.setChannelMute(channel, allMuted);
    }

    public getSequencerTracks(): any[] {
        return this.sequencer?.tracks || this.sequencer?.song?.tracks || [];
    }

    public setMasterVolume(volume: number): void {
        this.mixer.setMasterVolume(volume);
    }

    public setEQ(type: 'low' | 'mid' | 'high', gain: number): void {
        this.mixer.setEQ(type, gain);
    }

    public setReverbDepth(depth: number): void {
        if (this.synth) this.synth.reverbGain = depth;
    }

    public setChorusDepth(depth: number): void {
        if (this.synth) this.synth.chorusGain = depth;
    }

    /* -------------------------------------------
       Timing & Sync (Delegated to TimeSyncController)
       ------------------------------------------- */

    public async resume(): Promise<void> {
        if (this.ctx.state === 'running') return;
        AudioEngineLogger.info("Attempting to resume AudioContext...");
        await this.ctx.resume();
    }

    public isAudioUnlocked(): boolean { return this.ctx.state === 'running'; }
    public isPlaying(): boolean { return this.timer.getIsPlaying(); }
    public get currentTime(): number { return this.sequencer?.currentTime || 0; }
    public get duration(): number { return this.sequencer?.duration || 0; }

    public getPreciseTime(): number {
        return this.timer.getPreciseTime(this.sequencer?.playbackRate || 1);
    }

    public startPreciseTime(offset: number = 0): void {
        this.timer.start(offset);
    }

    public pausePreciseTime(): void {
        this.timer.pause(this.sequencer?.playbackRate || 1);
    }

    public resumePreciseTime(): void {
        this.timer.resume();
    }

    public setPreciseTime(time: number): void {
        this.timer.seek(time);
    }

    public getOutputLatency(): number {
        const base = this.ctx.baseLatency || 0;
        const output = (this.ctx as any).outputLatency || 0;
        return base + output;
    }

    public resetTimeState(): void {
        this.timer.reset();
    }

    public getAudioContext(): AudioContext { return this.ctx; }
}
