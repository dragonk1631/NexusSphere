import { WorkletSynthesizer, Sequencer } from 'spessasynth_lib';
// @ts-ignore
import processorUrl from 'spessasynth_lib/dist/spessasynth_processor.min.js?url';

import { ScreenUtils } from '../utils/ScreenUtils';
import { AudioEngineLogger, LogLevel } from './AudioEngineLogger';
import { AudioMixer } from './AudioMixer';
import { TimeSyncController } from './TimeSyncController';
import { resolveAssetPath } from '../utils/PathUtils';
import { OfflineDownloadManager } from '../asset/OfflineDownloadManager';
import { BinaryVault } from '../asset/BinaryVault';
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

    // Hybrid Mode (MP3 + MIDI)
    private isHybridMode: boolean = false;
    private isStreamingMode: boolean = false;
    private mp3Buffer: AudioBuffer | null = null;
    private streamingPlayer: HTMLAudioElement | null = null;
    private mp3SourceNode: AudioBufferSourceNode | null = null;
    private mp3GainNode: GainNode;
    private autoNormalizationGain: number = 1.0;
    private userMetadataVolume: number = 1.0;
    private isPreviewLoop: boolean = false;
    private syncMonitorId: number | null = null;
    private lastHardCorrectionTime: number = 0;
    private basePlaybackRate: number = 1.0;
    private midiSilenceOffset: number = 0;

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

        // Initialize Hybrid Gain
        this.mp3GainNode = this.ctx.createGain();
        this.mixer.connectSource(this.mp3GainNode as any);

        AudioEngineLogger.setLevel(LogLevel.INFO);
        AudioEngineLogger.info("Engine Core initialized with 'balanced' latency.");
    }

    /**
     * Initializes the engine and loads the SoundFont.
     */
    public async init(soundFontUrl: string): Promise<void> {
        if (this.initializing) return this.initializing;

        const initTask = async () => {
            if (this.isReady) return;

            try {
                // 1. Load AudioWorklet Module
                await this.ctx.audioWorklet.addModule(processorUrl);

                const isMobile = ScreenUtils.isMobile();
                if (isMobile) {
                    AudioEngineLogger.info("Mobile optimization active: Reverb/Chorus disabled.");
                }

                // 2. Instantiate Synth
                this.synth = new WorkletSynthesizer(this.ctx, {
                    initializeReverbProcessor: !isMobile,
                    initializeChorusProcessor: !isMobile,
                    oneOutput: false,
                    enableEventSystem: true
                }) as unknown as ISynth;

                // 3. Connect Synth to Mixer
                this.mixer.connectSource(this.synth as ISynth);
                await this.synth.isReady;

                // 4. Load SoundFont (Priority Loading with Retry)
                let sfLoaded = false;
                for (let retry = 0; retry < 2; retry++) {
                    try {
                        const resolvedUrl = resolveAssetPath(soundFontUrl);
                        AudioEngineLogger.info(`Vault: Loading SoundFont (Attempt ${retry + 1})...`);
                        
                        let sfData: ArrayBuffer;
                        
                        // 1. IndexedDB(BinaryVault) 우선 확인 (서비스 워커 우회)
                        const binaryVault = BinaryVault.getInstance();
                        const normalizedSfPath = soundFontUrl.replace(/\\/g, '/').replace(/^\//, '');
                        console.log(`[Vault:LOAD] Attempting lookup in BinaryVault. Key: "${normalizedSfPath}"`);
                        const cachedBlob = await binaryVault.get(normalizedSfPath);
                        
                        if (cachedBlob) {
                            AudioEngineLogger.info(`Vault: SF2 "${normalizedSfPath}" found in BinaryVault.`);
                            sfData = await cachedBlob.arrayBuffer();
                        } else {
                            // 2. Fetch Fallback (Cache API or Network)
                            AudioEngineLogger.info(`Vault: "${normalizedSfPath}" not in BinaryVault, falling back to fetch: ${resolvedUrl}`);
                            const sfRes = await this.fetchWithTimeout(resolvedUrl);
                            sfData = await sfRes.arrayBuffer();
                        }

                        // Validate SoundFont Header (RIFF)
                        const header = new TextDecoder().decode(new Uint8Array(sfData.slice(0, 4)));
                        if (header.toLowerCase() !== 'riff') throw new Error("Invalid SoundFont binary (No RIFF header)");

                        await this.synth.soundBankManager.addSoundBank(sfData);
                        sfLoaded = true;
                        break;
                    } catch (err) {
                        AudioEngineLogger.warn(`Vault: SoundFont attempt ${retry + 1} failed: ${err}`);
                        if (retry < 1) await new Promise(r => setTimeout(r, 1000));
                    }
                }

                if (sfLoaded) {
                    this.sequencer = new Sequencer(this.synth as any) as unknown as ISequencer;
                    this.isReady = true;
                    this.isSoundFontLoaded = true;
                    AudioEngineLogger.info("Vault: Engine Ready with SoundFont.");
                } else {
                    AudioEngineLogger.warn("Vault: All SoundFont load attempts failed. Running in silent mode.");
                    this.sequencer = new Sequencer(this.synth as any) as unknown as ISequencer;
                    this.isReady = true;
                    this.isSoundFontLoaded = false;
                }
            } catch (e) {
                AudioEngineLogger.error("Vault: Critical Engine Init failed:", e);
                this.initializing = null; // Allow retry after critical failure
                throw e;
            }
        };

        this.initializing = initTask();
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

        // [CRITICAL FIX] Reset Hybrid State and restore channel volumes
        this.isHybridMode = false;
        this.mp3Buffer = null;
        this.autoNormalizationGain = 1.0;
        this.userMetadataVolume = 1.0;
        this.stopMp3();
        
        // Restore all midi synth channels (in case they were muted by a previous hybrid song)
        if (this.synth) {
            for (let i = 0; i < 16; i++) {
                this.setChannelVolume(i, 100);
            }
        }

        // Safe cleanup of legacy sequencer
        if (this.sequencer) {
            try {
                this.sequencer.pause();
                this.sequencer.eventHandler.removeEvent("songEnded", "engine-song-end");
            } catch (e) { }
            this.sequencer = null;
        }

        this.sequencer = new Sequencer(this.synth as any) as unknown as ISequencer;
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

    public async loadHybrid(midiBuffer: ArrayBuffer, audioData: AudioBuffer | HTMLAudioElement, normalizationGain?: number): Promise<void> {
        await this.loadMidi(midiBuffer);
        
        if (audioData instanceof AudioBuffer) {
            this.mp3Buffer = audioData;
            this.streamingPlayer = null;
            this.isStreamingMode = false;
            
            // AUTOMATED NORMALIZATION (Phase 4)
            if (normalizationGain !== undefined) {
                this.autoNormalizationGain = normalizationGain;
                AudioEngineLogger.info(`[CoreAudioEngine] Using pre-calculated normalization: ${normalizationGain}`);
            } else {
                const peakValue = this.scanPeakAmplitude(audioData);
                const targetPeak = 0.707; // -3dB
                this.autoNormalizationGain = peakValue > 0 ? targetPeak / peakValue : 1.0;
                AudioEngineLogger.info(`[CoreAudioEngine] Scanned normalization: ${this.autoNormalizationGain.toFixed(3)}`);
            }
        } else {
            this.mp3Buffer = null;
            this.streamingPlayer = audioData;
            this.isStreamingMode = true;
            
            // Apply external normalization for streaming if provided
            this.autoNormalizationGain = normalizationGain !== undefined ? normalizationGain : 1.0;
            if (normalizationGain !== undefined) {
                AudioEngineLogger.info(`[CoreAudioEngine] Using pre-calculated normalization for streaming: ${normalizationGain}`);
            }

            // Route streaming player through mixer
            if (this.bgmSource) this.bgmSource.disconnect();
            this.bgmSource = this.ctx.createMediaElementSource(audioData);
            this.bgmSource.connect(this.mp3GainNode);

            // [LOOP FIX] Support looping for streaming previews
            audioData.onended = () => {
                if (this.isPreviewLoop && this.isHybridMode && this.isStreamingMode) {
                    AudioEngineLogger.info("[CoreAudioEngine] Looping streaming preview...");
                    // Restart from the current sequencer time or 0
                    this.seek(this.sequencer?.currentTime || 0);
                    this.play();
                }
            };
        }

        this.isHybridMode = true;
        
        // Cap the gain to prevent extreme clipping for very quiet tracks (Dynamic mode only)
        if (normalizationGain === undefined && this.autoNormalizationGain > 3.0) {
            this.autoNormalizationGain = 3.0;
        }

        this.updateHybridGain();
    }

    private scanPeakAmplitude(buffer: AudioBuffer): number {
        let maxPeak = 0;
        // Scan first 2 channels for absolute peak
        for (let c = 0; c < Math.min(2, buffer.numberOfChannels); c++) {
            const data = buffer.getChannelData(c);
            // Optimization: Skip samples to speed up scan (1 in 50)
            for (let i = 0; i < data.length; i += 50) {
                const abs = Math.abs(data[i]);
                if (abs > maxPeak) maxPeak = abs;
            }
        }
        return maxPeak || 0.1; // Prevent division by zero
    }

    public async play(): Promise<void> {
        if (!this.isSoundFontLoaded) return;

        if (this.ctx.state === 'suspended') {
            AudioEngineLogger.warn("Attempting play while context is suspended. Make sure to resume() on user gesture.");
            try { await this.ctx.resume(); } catch (e) { }
        }

        const seqTime = this.sequencer ? this.sequencer.currentTime : 0;
        // PROFESSIONAL: Capture the exact hardware time at the moment of 'play' request
        const hardwareTime = this.ctx.currentTime;
        this.timer.resume(seqTime, hardwareTime);
        this.stopBGM(true); // PROFESSIONAL: Fade out menu music when MIDI starts
        
        if (this.isHybridMode) {
            // MP3 timeline starts at 0, but MIDI timeline starts at midiSilenceOffset.
            // Subtract the offset so MP3 plays at the correct corresponding position.
            const mp3Time = Math.max(0, seqTime - this.midiSilenceOffset);
            AudioEngineLogger.info(`[DIAG] play(): seqTime=${seqTime.toFixed(3)}, midiSilenceOffset=${this.midiSilenceOffset.toFixed(3)}, mp3Time=${mp3Time.toFixed(3)}, streaming=${this.isStreamingMode}`);
            if (this.isStreamingMode && this.streamingPlayer) {
                this.streamingPlayer.currentTime = mp3Time;
                this.streamingPlayer.play();
                this.startSyncMonitor();
            } else if (this.mp3Buffer) {
                this.startMp3At(mp3Time, hardwareTime);
            }

            // Mute all midi synth channels to favor MP3 audio
            for (let i = 0; i < 16; i++) {
                this.setChannelVolume(i, 0);
            }
        }

        this.sequencer?.play();
    }

    private startMp3At(time: number, anchor?: number): void {
        this.stopMp3();
        if (!this.mp3Buffer) return;

        this.mp3SourceNode = this.ctx.createBufferSource();
        this.mp3SourceNode.buffer = this.mp3Buffer;
        this.mp3SourceNode.playbackRate.value = this.sequencer?.playbackRate || 1;
        this.mp3SourceNode.connect(this.mp3GainNode);
        
        // PROFESSIONAL: Start the buffer at the precision anchor if provided
        const startAnchor = anchor !== undefined ? anchor : this.ctx.currentTime;
        
        // --- LOOP & FADE AUTOMATION (Phase 4) ---
        if (this.isPreviewLoop) {
            const now = startAnchor;
            const duration = this.mp3Buffer.duration;
            const finalGain = this.autoNormalizationGain * this.userMetadataVolume;
            
            // 1. Initial State: Full Volume (No Fade-in)
            this.mp3GainNode.gain.cancelScheduledValues(now);
            this.mp3GainNode.gain.setValueAtTime(finalGain, now);
            
            // 2. Sustain & Fade Out (1.5s - Optimal balance)
            const fadeOutDuration = 1.5;
            const fadeOutStart = now + (duration / (this.sequencer?.playbackRate || 1)) - fadeOutDuration;
            
            if (fadeOutStart > now) {
                this.mp3GainNode.gain.setValueAtTime(finalGain, fadeOutStart);
                this.mp3GainNode.gain.exponentialRampToValueAtTime(0.001, now + (duration / (this.sequencer?.playbackRate || 1)));
            }

            // 4. Recursive Loop
            this.mp3SourceNode.onended = () => {
                // Only loop if we are still in loop mode and the ID matches (not stopped/changed)
                if (this.isPreviewLoop && this.isPlaying()) {
                    AudioEngineLogger.info("[CoreAudioEngine] Looping preview...");
                    // [SYNC FIX] Seek back to 0 so the sequencer and clock match the audio restart.
                    // This eliminates the "Catastrophic drift" logs.
                    this.seek(0);
                    this.play(); 
                }
            };
        }

        this.mp3SourceNode.start(startAnchor, Math.max(0, time));
    }

    public setPreviewLoop(enabled: boolean): void {
        this.isPreviewLoop = enabled;
        if (!enabled) {
            // If disabling, ensure gain is reset
            this.updateHybridGain();
        }
    }

    private stopMp3(): void {
        this.stopSyncMonitor();

        if (this.mp3SourceNode) {
            try {
                this.mp3SourceNode.onended = null;
                this.mp3SourceNode.stop();
                this.mp3SourceNode.disconnect();
            } catch (e) {}
            this.mp3SourceNode = null;
        }

        if (this.streamingPlayer) {
            this.streamingPlayer.pause();
        }

        // PROFESSIONAL: Reset gain automation on stop
        if (this.mp3GainNode) {
            this.mp3GainNode.gain.cancelScheduledValues(this.ctx.currentTime);
            this.updateHybridGain();
        }
    }

    /**
     * [PHASE 3] Re-Anchor (Sync Correction) Logic
     * 오디오 스트리밍 타임과 절대적인 AudioContext 타임의 오차를 감시합니다.
     * v3.1: 프레임 드랍 방지를 위해 rAF 대신 setInterval(250ms)을 사용합니다.
     */
    private startSyncMonitor(): void {
        this.stopSyncMonitor();
        const monitorStartTime = Date.now();
        
        const monitor = () => {
            if (!this.isPlaying() || !this.streamingPlayer || !this.isStreamingMode) {
                this.stopSyncMonitor();
                return;
            }

            const audioTime = this.streamingPlayer.currentTime;

            // [IMPROVED] Stabilization Grace Period
            if (Date.now() - monitorStartTime < 2000) {
                return;
            }

            const masterTime = this.getPreciseTime();
            const drift = masterTime - audioTime; // Positive = Audio is behind, Negative = Audio is ahead
            const absDrift = Math.abs(drift);

            // 2. TIERED CORRECTION (Visual Follows Audio)
            const now = Date.now();
            
            // Level 1: < 20ms -> Perfect (Ignore)
            if (absDrift < 0.020) {
                this.timer.setVisualOffset(0);
                this.restorePlaybackRate();
            } 
            // Level 2: 20~50ms -> Visual Offset (Nudge notes, don't touch audio)
            else if (absDrift < 0.050) {
                this.timer.setVisualOffset(-drift); // Nudge renderer time to match audio
                this.restorePlaybackRate();
            }
            // Level 3: 50~100ms -> Dynamic Rate Adjustment (Micro-tuning)
            else if (absDrift < 0.100) {
                this.timer.setVisualOffset(0);
                // Adjust speed by ±1.0% to catch up/slow down
                const adj = drift > 0 ? 1.01 : 0.99;
                this.streamingPlayer.playbackRate = this.basePlaybackRate * adj;
                if (this.mp3SourceNode) this.mp3SourceNode.playbackRate.value = this.basePlaybackRate * adj;
            }
            // Level 4: > 100ms -> Emergency Sync
            else {
                // [COOLDOWN] Prevent repeated corrections within 1.5s
                if (now - this.lastHardCorrectionTime > 1500) {
                    this.lastHardCorrectionTime = now;
                    
                    if (this.isPreviewLoop || absDrift < 0.3) {
                        AudioEngineLogger.debug(`[SyncMonitor] Drift (${Math.round(absDrift * 1000)}ms). Silent Re-anchor.`);
                        this.timer.reAnchor(audioTime, audioTime);
                    } else {
                        // Massive drift in gameplay (>300ms) - still Seek as last resort
                        AudioEngineLogger.warn(`[SyncMonitor] Critical drift (${Math.round(absDrift * 1000)}ms). Hard Seek.`);
                        this.streamingPlayer.currentTime = masterTime;
                    }

                    this.timer.setVisualOffset(0);
                    this.restorePlaybackRate();
                }
            }
        };
        
        // 250ms (4Hz) is plenty for drift correction and saves main thread budget
        this.syncMonitorId = setInterval(monitor, 250) as any;
    }

    private restorePlaybackRate(): void {
        if (!this.streamingPlayer) return;
        if (Math.abs(this.streamingPlayer.playbackRate - this.basePlaybackRate) > 0.001) {
            this.streamingPlayer.playbackRate = this.basePlaybackRate;
            if (this.mp3SourceNode) this.mp3SourceNode.playbackRate.value = this.basePlaybackRate;
        }
    }

    private stopSyncMonitor(): void {
        if (this.syncMonitorId !== null) {
            clearInterval(this.syncMonitorId);
            this.syncMonitorId = null;
        }
    }

    /* -------------------------------------------
       Background Music (BGM)
       ------------------------------------------- */

    /**
     * Plays a looping background MP3/Audio file.
     * Routes through the mixer to respect master volume.
     */
    public playBGM(url: string, loop: boolean = true, volume: number = 1.0): void {
        if (this.bgmPlayer && this.bgmPlayer.src.includes(url)) {
            if (this.bgmPlayer.paused) this.bgmPlayer.play().catch(() => {});
            return;
        }

        this.stopBGM(false);
        this.stop(false); // PROFESSIONAL: Stop any MIDI before starting BGM

        const resolvedUrl = resolveAssetPath(url);
        
        // [Hardening] 오프라인 대응: Vault 캐시를 우선 확인하여 Blob URL 생성
        const vault = OfflineDownloadManager.getInstance();
        vault.getCachedResponse(url).then(async (response) => {
            let finalUrl = resolvedUrl;
            if (response) {
                const blob = await response.blob();
                finalUrl = URL.createObjectURL(blob);
            }
            
            this.bgmPlayer = new Audio(finalUrl);
            this.bgmPlayer.loop = loop;
            this.bgmPlayer.crossOrigin = "anonymous";
            
            // Route through WebAudio Mixer
            this.bgmSource = this.ctx.createMediaElementSource(this.bgmPlayer);
            this.mixer.connectSource(this.bgmSource as any);

            this.bgmPlayer.volume = volume;
            this.bgmPlayer.play().catch(e => {
                AudioEngineLogger.warn(`BGM Playback failed: ${e}. (Need user gesture?)`);
            });
            
            AudioEngineLogger.info(`BGM Started: ${url} ${response ? '(Vault)' : '(Network)'}`);
        });
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
    public playSFX(url: string, volume: number = 1.0): void {
        const resolvedUrl = resolveAssetPath(url);
        
        // [Hardening] 오프라인 대응: Vault 캐시를 우선 확인하여 Blob URL 생성
        const vault = OfflineDownloadManager.getInstance();
        vault.getCachedResponse(url).then(async (response) => {
            let finalUrl = resolvedUrl;
            if (response) {
                const blob = await response.blob();
                finalUrl = URL.createObjectURL(blob);
            }

            const sfx = new Audio(finalUrl);
            sfx.crossOrigin = "anonymous";
            
            const source = this.ctx.createMediaElementSource(sfx);
            this.mixer.connectSource(source as any);
            
            sfx.volume = volume;
            sfx.play().catch(e => {
                AudioEngineLogger.warn(`SFX Playback failed: ${e}`);
            });

            // Clean up source AND revoke object URL when audio ends
            sfx.onended = () => {
                source.disconnect();
                if (finalUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(finalUrl);
                }
            };
        });
    }

    /**
     * Plays a high-reliability synthetic tick sound using Web Audio Oscillator.
     * Guaranteed to work even if SoundFonts or Assets are still loading.
     */
    public triggerTick(volume: number = 0.3): void {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sine'; // Clean tech blip
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
        
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start(now);
        osc.stop(now + 0.1);
    }

    public isBGMPlaying(): boolean {
        // [STABILITY] Expanded definition of "BGM" to include MIDI sequencer and streaming players
        // This ensures callers correctly identify if ANY game audio is active.
        return (!!this.bgmPlayer && !this.bgmPlayer.paused) || 
               (!!this.sequencer && this.sequencer.playing) || 
               (!!this.streamingPlayer && !this.streamingPlayer.paused) ||
               (!!this.mp3SourceNode); // mp3SourceNode exists only while playing
    }

    public pause(): void {
        this.timer.pause(this.sequencer?.playbackRate || 1);
        this.sequencer?.pause();
        this.stopMp3();
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
                this.sequencer = new Sequencer(this.synth as any) as unknown as ISequencer;
                if (currentMidi) {
                     this.sequencer.loadNewSongList([{ binary: currentMidi }]);
                     this.sequencer.pause();
                     this.sequencer.currentTime = 0;
                }
                AudioEngineLogger.info("Hard Sequencer Reset triggered.");
            }
            
            AudioEngineLogger.info("Playback stopped and reset.");
        }
        this.stopMp3();
        if (fullReset) {
            this.isHybridMode = false;
            this.mp3Buffer = null;
            AudioEngineLogger.info("Hybrid Mode cleared.");
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

        // Capture silence offset when SpessaSynth has fully processed the MIDI.
        // At loadMidi() time, SpessaSynth returns 0. Only later seek(0) returns the real skip.
        if (time === 0 && seqTime > 0) {
            this.midiSilenceOffset = seqTime;
        }

        this.timer.seek(time, seqTime);

        if (this.isHybridMode && this.isPlaying()) {
            this.startMp3At(time);
        }
    }

    public setPlaybackRate(rate: number): void {
        this.basePlaybackRate = rate;
        if (this.sequencer) {
            this.sequencer.playbackRate = rate;
        }
        if (this.mp3SourceNode) {
            this.mp3SourceNode.playbackRate.value = rate;
        }
        if (this.streamingPlayer) {
            this.streamingPlayer.playbackRate = rate;
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

    public setHybridVolume(volume: number): void {
        this.userMetadataVolume = volume;
        this.updateHybridGain();
    }

    private updateHybridGain(): void {
        if (this.mp3GainNode) {
            const finalGain = this.autoNormalizationGain * this.userMetadataVolume;
            this.mp3GainNode.gain.setTargetAtTime(finalGain, this.ctx.currentTime, 0.05);
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

        try {
            const vault = OfflineDownloadManager.getInstance();
            const response = await vault.vaultFetch(url, { signal: controller.signal });
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
