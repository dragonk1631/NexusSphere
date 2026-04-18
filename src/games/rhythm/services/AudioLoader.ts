import { ASSET_PATHS } from '../../../core/asset/AssetRegistry';
import { MidiParser, type ParsedMidi } from '../../../core/audio/MidiParser';
import { type BeatmapData } from '../types/BeatmapTypes';
import { type TransitionData } from '../types/GameTypes';
import { type CoreAudioEngine } from '../../../core/audio/CoreAudioEngine';
import { LocalSongStorage } from './LocalSongStorage';
import { AssetLoader } from '../../../core/asset/AssetLoader';
import { OfflineDownloadManager } from '../../../core/asset/OfflineDownloadManager';

/**
 * AudioLoader handles MIDI and beatmap asset loading and caching.
 * It encapsulates the logic of fetching files from URLs or buffers and parsing them.
 */
export class AudioLoader {
    private midiData: ParsedMidi | null = null;
    private beatmapData: BeatmapData | null = null;
    private cachedMidi: { url: string, buffer: ArrayBuffer, parsed: ParsedMidi } | null = null;
    private loadingPromise: Promise<void> | null = null;
    private audioEngine: CoreAudioEngine;
    private storage = new LocalSongStorage();
    private currentAbortController: AbortController | null = null;

    constructor(audioEngine: CoreAudioEngine) {
        this.audioEngine = audioEngine;
    }

    public getMidiData(): ParsedMidi | null { return this.midiData; }
    public getBeatmapData(): BeatmapData | null { return this.beatmapData; }

    public clearMidiData(): void { this.midiData = null; }
    public clearBeatmapData(): void { this.beatmapData = null; }

    /**
     * Loads the MIDI and beatmap for the given URL or transition data.
     */
    public async load(midiUrl: string, isTestMode: boolean, transitionData: TransitionData | null): Promise<void> {
        // [NEW] Abort previous load if any
        if (this.currentAbortController) {
            this.currentAbortController.abort();
        }
        this.currentAbortController = new AbortController();
        const signal = this.currentAbortController.signal;

        this.loadingPromise = (async () => {
            // [NEW] Optional Debounce for non-test loads (like previews)
            if (!isTestMode) {
                await new Promise(r => setTimeout(r, 50));
                if (signal.aborted) return;
            }

            console.log("[AudioLoader] Loading assets...");

            // Reset current data
            this.beatmapData = null;

            // 0. Resolve MIDI Name for tracking/mapping
            const decodedUrl = decodeURI(midiUrl);
            const midiName = decodedUrl.split('/').pop()?.replace(/\.mid$/i, '') || 'test';

            // 1. MIDI Loading & Parsing
            if (isTestMode && transitionData) {
                console.log("[AudioLoader] Test Mode: Loading MIDI from transition buffer.");
                const parser = new MidiParser();
                this.midiData = await parser.parse(transitionData.midiBuffer, transitionData.midiName);
                await this.audioEngine.loadMidi(transitionData.midiBuffer);
                
                // [FIX] If transitionData has measureConfig, treat it as the active beatmapData
                if (transitionData.settings?.measureConfig) {
                    this.beatmapData = {
                        version: "1.2",
                        metadata: {
                            title: transitionData.midiName,
                            bpm: 120, // Default for synth
                            duration: 0
                        },
                        measureConfig: transitionData.settings.measureConfig
                    };
                    console.log("[AudioLoader] Test Mode: Using measureConfig from Editor transition.");
                }
            } else {
                // Normal Mode: Check Cache for MIDI
                if (this.cachedMidi && this.cachedMidi.url === midiUrl) {
                    console.log("[AudioLoader] Using cached MIDI data.");
                    this.midiData = this.cachedMidi.parsed;
                    await this.audioEngine.loadMidi(this.cachedMidi.buffer);
                } else {
                    let midiBuffer: ArrayBuffer;
                    
                    if (midiUrl.startsWith('file_')) {
                        // Custom Song from Storage
                        const blob = await this.storage.getSongBlob(midiUrl);
                        if (!blob) throw new Error("Custom MIDI file not found.");
                        midiBuffer = await blob.arrayBuffer();
                    } else {
                        // Normal Server Song
                        const midiRes = await OfflineDownloadManager.getInstance().vaultFetch(midiUrl);
                        midiBuffer = await midiRes.arrayBuffer();
                    }

                    const parser = new MidiParser();
                    this.midiData = await parser.parse(midiBuffer);
                    await this.audioEngine.loadMidi(midiBuffer);

                    // Update Cache
                    this.cachedMidi = { url: midiUrl, buffer: midiBuffer, parsed: this.midiData };
                }
            }

            // 2. Hybrid Audio Loading - Deterministic Strategy
            // PRIORITY: Manifest/TransitionData -> Smart Fallback
            const song = transitionData?.settings?.song || (transitionData as any)?.song;
            const al = AssetLoader.getInstance();
            let isHybrid = false;
            
            // Priority 1: Explicit URL from Manifest
            let mp3Path = song?.audioUrl; 
            
            // Priority 2: Smart Guessing Fallback (For legacy/vast library support)
            if (!mp3Path && !midiUrl.startsWith('file_')) {
                mp3Path = await al.findAudioPath(midiName) || `assets/audio/mp3/${midiName}.mp3`;
            }

            if (mp3Path) {
                try {
                    // SILENT PROBE: Only load if it's really an audio file (Avoids excessive 404 noise)
                    if (await al.checkAssetExists(mp3Path)) {
                        isHybrid = true;
                        const mp3Buffer = await al.loadAudio(mp3Path);
                        const currentMidiBuffer = isTestMode && transitionData ? transitionData.midiBuffer : this.cachedMidi?.buffer;
                        if (currentMidiBuffer) {
                            await this.audioEngine.loadHybrid(currentMidiBuffer, mp3Buffer);
                            
                            // Apply Normalization Volume from Manifest
                            let vol = song?.volume !== undefined ? song.volume : 1.0;
                            this.audioEngine.setHybridVolume(vol);
                        }
                    }
                } catch (e) {
                    console.warn(`[AudioLoader] MP3 loading failed, continuing with MIDI-only: ${mp3Path}`);
                }
            }

            // 3. Beatmap Configuration Loading
            // Use already resolved names
            const safeName = midiName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const localConfigStr = localStorage.getItem(`beatmap_config_${safeName}`);

            // Prioritize LocalStorage if not in Hybrid Mode
            if (localConfigStr && !isHybrid) {
                try {
                    this.beatmapData = JSON.parse(localConfigStr);
                } catch (e) {
                    this.beatmapData = null;
                }
            }

            // PRIORITY: Explicit Manifest -> Smart Fallback Guess
            if (!this.beatmapData) {
                let beatmapUrl = song?.beatmapUrl;
                if (!beatmapUrl) {
                    beatmapUrl = `${ASSET_PATHS.DATA.BEATMAPS}${midiName}.json`;
                }

                if (beatmapUrl) {
                    try {
                        if (await AssetLoader.getInstance().checkJsonExists(beatmapUrl)) {
                            const res = await OfflineDownloadManager.getInstance().vaultFetch(beatmapUrl);
                            if (res.ok) {
                                this.beatmapData = await res.json();
                                console.log("[AudioLoader] Custom beatmap loaded successfully.");
                            }
                        }
                    } catch (e) {
                        this.beatmapData = null;
                    }
                }
            }
        })();

        try {
            await this.loadingPromise;
        } finally {
            this.loadingPromise = null;
        }
    }
}
