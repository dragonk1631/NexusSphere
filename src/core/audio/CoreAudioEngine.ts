import { WorkletSynthesizer, Sequencer } from 'spessasynth_lib';
// @ts-ignore
import processorUrl from 'spessasynth_lib/dist/spessasynth_processor.min.js?url';

import { ScreenUtils } from '../utils/ScreenUtils';
import { AudioEngineLogger, LogLevel } from './AudioEngineLogger';
import { AudioMixer } from './AudioMixer';
import { TimeSyncController } from './TimeSyncController';
import { resolveAssetPath } from '../utils/PathUtils';
import type { ISynth, ISequencer } from './AudioTypes';

/**
 * Core Audio Engine 2.0 - Encapsulated MIDI Engine
 * v2.0 Architecture: Modular Facade with Type-Safe SpessaSynth integration.
 */
export class CoreAudioEngine {

    // Core Modules
    private ctx: AudioContext;
    private mixer: AudioMixer;
    private timer: TimeSyncController;

    // Library Components
    private synth: ISynth | null = null;
    private sequencer: ISequencer | null = null;
    private bgmPlayer: HTMLAudioElement | null = null;
    private bgmSource: MediaElementAudioSourceNode | null = null;

    // Internal State
    private isReady: boolean = false;
    private isSoundFontLoaded: boolean = false;
    private initializing: Promise<void> | null = null;

    public constructor() {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)({
            latencyHint: 'balanced'
        });
        this.mixer = new AudioMixer(this.ctx);
        this.timer = new TimeSyncController(this.ctx);

        AudioEngineLogger.setLevel(LogLevel.INFO);
        AudioEngineLogger.info("Engine Core initialized with 'balanced' latency.");
    }

    /**
     * Initializes the engine and loads the SoundFont.
     */
    public async init(soundFontUrl: string): Promise<void> {
        if (this.initializing) return this.initializing;

        this.initializing = (async () => {
            if (this.isReady) return;

            try {
                // Load AudioWorklet Module
                await this.ctx.audioWorklet.addModule(processorUrl);

                const isMobile = ScreenUtils.isMobile();
                if (isMobile) {
                    AudioEngineLogger.info("Mobile optimization active: Reverb/Chorus disabled, polyphony capped.");
                }

                // Instantiate Synth
                this.synth = new WorkletSynthesizer(this.ctx, {
                    initializeReverbProcessor: !isMobile,
                    initializeChorusProcessor: !isMobile,
                    oneOutput: false,
                    enableEventSystem: true
                }) as unknown as ISynth;

                // Connect Synth to Mixer
                this.mixer.connectSource(this.synth as ISynth);

                await this.synth.isReady;

                // Load SoundFont
                try {
                    const sfRes = await this.fetchWithTimeout(soundFontUrl);

                    const sfData = await sfRes.arrayBuffer();

                    // Validate RIFF
                    const header = new TextDecoder().decode(new Uint8Array(sfData.slice(0, 4)));
                    if (header.toLowerCase() !== 'riff') throw new Error("Invalid SoundFont header");

                    await this.synth.soundBankManager.addSoundBank(sfData);
                    this.sequencer = new Sequencer(this.synth as any) as ISequencer;
                    this.isReady = true;
                    this.isSoundFontLoaded = true;
                    AudioEngineLogger.info("Engine Ready with SoundFont");
                } catch (sfError) {
                    AudioEngineLogger.warn(`SoundFont load failed: ${sfError}. Running in silent mode.`);
                    this.sequencer = new Sequencer(this.synth as any) as ISequencer;
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
        // Safe cleanup of legacy sequencer to prevent resource leakage
        if (this.sequencer) {
            try {
                this.sequencer.pause();
                this.sequencer.eventHandler.removeEvent("songEnded", "engine-song-end");
            } catch (e) { }
            this.sequencer = null;
        }

        this.sequencer = new Sequencer(this.synth as any) as ISequencer;
        this.timer.reset();

        // Add Diagnostics
        this.sequencer.eventHandler.addEvent("songEnded", "engine-song-end", () => {
            AudioEngineLogger.info(`Song ended at ${this.currentTime.toFixed(2)}s`);
            this.pause(); // PROFESSIONAL: Stop internal clocks when hardware stops
        });

        await this.sequencer.loadNewSongList([{ binary: buffer }]);

        this.sequencer.pause();
        this.sequencer.currentTime = 0;
        const seqTime = this.sequencer ? this.sequencer.currentTime : 0;
        this.timer.seek(0, seqTime);

        // SpessaSynth duration might take a tick to update or is in midiData
        const duration = this.sequencer.duration || (this.sequencer as any).midiData?.duration || 0;
        if (duration > 0) {
            AudioEngineLogger.metric('LOAD', `MIDI Loaded. Duration: ${duration.toFixed(2)}s`);
        } else {
            // If still 0, the monitor will catch it or we log it on first play
            AudioEngineLogger.metric('LOAD', `MIDI Loaded. (Duration pending)`);
        }

        // One-time HEALTH check on load
        if (this.synth) {
            const voices = (this.synth as any).voicesAmount || 0;
            const loadPercent = Math.min(100, (voices / 200) * 100).toFixed(1);
            AudioEngineLogger.metric('HEALTH', `Initial Voices: ${voices} (Load: ${loadPercent}%)`);
        }
    }

    public async play(): Promise<void> {
        if (!this.isSoundFontLoaded) return;

        if (this.ctx.state === 'suspended') {
            AudioEngineLogger.warn("Attempting play while context is suspended. Make sure to resume() on user gesture.");
            try { await this.ctx.resume(); } catch (e) { }
        }

        const seqTime = this.sequencer ? this.sequencer.currentTime : 0;
        this.timer.resume(seqTime);
        this.stopBGM(true); // PROFESSIONAL: Fade out menu music when MIDI starts
        this.sequencer?.play();
    }

    /* -------------------------------------------
       Background Music (BGM)
       ------------------------------------------- */

    /**
     * Plays a looping background MP3/Audio file.
     * Routes through the mixer to respect master volume.
     */
    public playBGM(url: string, loop: boolean = true): void {
        if (this.bgmPlayer && this.bgmPlayer.src.includes(url)) {
            if (this.bgmPlayer.paused) this.bgmPlayer.play().catch(() => {});
            return;
        }

        this.stopBGM(false);
        this.stop(false); // PROFESSIONAL: Stop any MIDI before starting BGM

        const resolvedUrl = resolveAssetPath(url);
        this.bgmPlayer = new Audio(resolvedUrl);
        this.bgmPlayer.loop = loop;
        this.bgmPlayer.crossOrigin = "anonymous";
        
        // Route through WebAudio Mixer
        this.bgmSource = this.ctx.createMediaElementSource(this.bgmPlayer);
        this.mixer.connectSource(this.bgmSource as any);

        this.bgmPlayer.play().catch(e => {
            AudioEngineLogger.warn(`BGM Playback failed: ${e}. (Need user gesture?)`);
        });
        
        AudioEngineLogger.info(`BGM Started: ${url}`);
    }

    /**
     * Stops the background music, optionally with a fade-out.
     */
    public stopBGM(fadeOut: boolean = true): void {
        if (!this.bgmPlayer) return;

        if (fadeOut) {
            const player = this.bgmPlayer;
            const startVol = player.volume;
            let currentVol = startVol;
            const step = 0.05;
            const interval = setInterval(() => {
                currentVol -= step;
                if (currentVol <= 0) {
                    clearInterval(interval);
                    player.pause();
                    player.src = "";
                } else {
                    player.volume = currentVol;
                }
            }, 30);
        } else {
            this.bgmPlayer.pause();
            this.bgmPlayer.src = "";
        }
        
        this.bgmPlayer = null;
        this.bgmSource = null;
        AudioEngineLogger.info("BGM Stopped.");
    }

    /**
     * Plays a one-shot sound effect (SFX) routed through the mixer.
     * Use for non-looping UI sounds or feedback.
     */
    public playSFX(url: string): void {
        const resolvedUrl = resolveAssetPath(url);
        const sfx = new Audio(resolvedUrl);
        sfx.crossOrigin = "anonymous";
        
        const source = this.ctx.createMediaElementSource(sfx);
        this.mixer.connectSource(source as any);
        
        sfx.play().catch(e => {
            AudioEngineLogger.warn(`SFX Playback failed: ${e}`);
        });

        // Clean up source when audio ends
        sfx.onended = () => {
            source.disconnect();
        };
    }

    public isBGMPlaying(): boolean {
        return !!this.bgmPlayer && !this.bgmPlayer.paused;
    }

    public pause(): void {
        this.timer.pause(this.sequencer?.playbackRate || 1);
        this.sequencer?.pause();
    }

    public stop(fullReset: boolean = false): void {
        if (this.sequencer) {
            this.timer.pause();
            this.sequencer.pause();
            this.sequencer.currentTime = 0;
            this.stopAllNotes();
            this.timer.seek(0);
            
            if (fullReset) {
                // HARD RESET: Fully destroy and recreate the sequencer to clear internal SpessaSynth state
                try { this.sequencer.eventHandler.removeEvent("songEnded", "engine-song-end"); } catch (e) {}
                const currentMidi = (this.sequencer as any).midiData?.binary;
                this.sequencer = new Sequencer(this.synth as any) as ISequencer;
                if (currentMidi) {
                     this.sequencer.loadNewSongList([{ binary: currentMidi }]);
                     this.sequencer.pause();
                     this.sequencer.currentTime = 0;
                }
                AudioEngineLogger.info("Hard Sequencer Reset triggered.");
            }
            
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
        }
        const seqTime = this.sequencer ? this.sequencer.currentTime : 0;
        this.timer.seek(time, seqTime);
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
        if (this.synth) {
            this.synth.muteChannel(channel, mute);
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
        return this.sequencer?.midiData?.tracks || [];
    }

    public setMasterVolume(volume: number): void {
        this.mixer.setMasterVolume(volume);
    }

    public setEQ(type: 'low' | 'mid' | 'high', gain: number): void {
        this.mixer.setEQ(type, gain);
    }

    public setReverbDepth(depth: number): void {
        if (this.synth) (this.synth as any).setMasterParameter('reverbGain', depth);
    }

    public setChorusDepth(depth: number): void {
        if (this.synth) (this.synth as any).setMasterParameter('chorusGain', depth);
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
        // PROFESSIONAL: Standardize to AudioContext clock
        const seqTime = this.sequencer ? this.sequencer.currentTime : undefined;
        return this.timer.getPreciseTime(this.sequencer?.playbackRate || 1, seqTime);
    }

    public startPreciseTime(offset: number = 0): void {
        const seqTime = this.sequencer ? this.sequencer.currentTime : 0;
        this.timer.start(offset, seqTime);
    }

    public pausePreciseTime(): void {
        this.timer.pause(this.sequencer?.playbackRate || 1);
    }

    public resumePreciseTime(): void {
        const seqTime = this.sequencer ? this.sequencer.currentTime : 0;
        this.timer.resume(seqTime);
    }

    public setPreciseTime(time: number): void {
        const seqTime = this.sequencer ? this.sequencer.currentTime : 0;
        this.timer.seek(time, seqTime);
    }

    public reAnchorTime(time: number): void {
        const seqTime = this.sequencer ? this.sequencer.currentTime : 0;
        this.timer.reAnchor(time, seqTime);
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

    /**
     * Warms up the audio context by playing a silent note.
     * This ensures the audio graph is fully active before the actual start.
     */
    public async warmup(): Promise<void> {
        await this.ensureReady();
        if (this.synth) {
            // Play a silent note on an unused channel
            this.synth.noteOn(15, 0, 0);
            setTimeout(() => this.synth?.noteOff(15, 0), 50);
        }
        return new Promise(resolve => setTimeout(resolve, 100));
    }


    /**
     * Helper for fetching with a timeout and AbortController.
     */
    private async fetchWithTimeout(url: string, timeoutMs: number = 10000): Promise<Response> {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeoutMs);

        const resolvedUrl = resolveAssetPath(url);
        try {
            const response = await fetch(resolvedUrl, { signal: controller.signal });
            clearTimeout(id);
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            return response;
        } catch (e) {
            clearTimeout(id);
            if (e instanceof Error && e.name === 'AbortError') {
                throw new Error(`Fetch timed out after ${timeoutMs}ms: ${url}`);
            }
            throw e;
        }
    }
}
