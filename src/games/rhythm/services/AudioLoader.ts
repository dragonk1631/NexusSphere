import { ASSET_PATHS } from '../../../core/asset/AssetRegistry';
import { MidiParser, type ParsedMidi } from '../../../core/audio/MidiParser';
import { type BeatmapData } from '../types/BeatmapTypes';
import { type TransitionData } from '../types/GameTypes';
import { type CoreAudioEngine } from '../../../core/audio/CoreAudioEngine';
import { LocalSongStorage } from '../services/LocalSongStorage';
import { AssetLoader } from '../../../core/asset/AssetLoader';

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
        // Prevent concurrent identical loads
        if (this.loadingPromise) return this.loadingPromise;

        this.loadingPromise = (async () => {
            console.log("[AudioLoader] Loading assets...");

            // Reset current data
            this.beatmapData = null;

            // 0. Resolve MIDI Name for tracking/mapping
            const midiName = midiUrl.split('/').pop()?.replace(/\.mid$/i, '') || 'test';

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
                        const midiRes = await fetch(midiUrl);
                        if (!midiRes.ok) throw new Error(`MIDI fetch failed for ${midiName} at ${midiUrl} (Status: ${midiRes.status})`);
                        midiBuffer = await midiRes.arrayBuffer();
                    }

                    const parser = new MidiParser();
                    this.midiData = await parser.parse(midiBuffer);
                    await this.audioEngine.loadMidi(midiBuffer);

                    // Update Cache
                    this.cachedMidi = { url: midiUrl, buffer: midiBuffer, parsed: this.midiData };
                }
            }

            // 2. Hybrid Audio Check (MP3 + MIDI Sync)
            const mp3Path = `assets/audio/mp3/${midiName}.mp3`;
            const al = AssetLoader.getInstance();
            let isHybrid = false;
            
            if (await al.checkAssetExists(mp3Path)) {
                console.log(`[AudioLoader] Hybrid MP3 detected: ${mp3Path}`);
                isHybrid = true;
                try {
                    const mp3Buffer = await al.loadAudio(mp3Path);
                    const currentMidiBuffer = isTestMode && transitionData ? transitionData.midiBuffer : this.cachedMidi?.buffer;
                    if (currentMidiBuffer) {
                        await this.audioEngine.loadHybrid(currentMidiBuffer, mp3Buffer);
                        
                        // Apply Normalization Volume
                        let vol = 1.0;
                        if (transitionData && (transitionData as any).volume !== undefined) {
                            vol = (transitionData as any).volume;
                        } else if (this.beatmapData && (this.beatmapData as any).volume !== undefined) {
                            vol = (this.beatmapData as any).volume;
                        }
                        this.audioEngine.setHybridVolume(vol);
                        console.log(`[AudioLoader] Hybrid Volume set to: ${vol}`);
                    }
                } catch (e) {
                    console.warn(`[AudioLoader] Failed to load hybrid MP3: ${mp3Path}`, e);
                }
            }

            // Check LocalStorage First (User Settings Override)
            const safeName = midiName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const localConfigStr = localStorage.getItem(`beatmap_config_${safeName}`);

            // [Logic Fix] For Hybrid songs, we MUST prioritize the server-side generated beatmap
            // unless the user specifically wants their local edit. 
            // However, to fix the "0 notes" issue, we only use local if it results in valid notes (later check)
            // or we just skip local check for Hybrid songs for now.
            if (localConfigStr && !isHybrid) {
                try {
                    this.beatmapData = JSON.parse(localConfigStr);
                    console.log(`[AudioLoader] Loaded beatmap config from LocalStorage for ${midiName}`);
                } catch (e) {
                    console.warn(`[AudioLoader] Failed to parse local config for ${midiName}`, e);
                    this.beatmapData = null;
                }
            }

            // If no local override (or if Hybrid), check server
            if (!this.beatmapData) {
                const beatmapUrl = `${ASSET_PATHS.DATA.BEATMAPS}${midiName}.json`;
                try {
                    console.log(`[AudioLoader] Checking for beatmap at: ${beatmapUrl}`);
                    const res = await fetch(beatmapUrl);
                    const contentType = res.headers.get("content-type");

                    if (res.ok && contentType && contentType.includes("application/json")) {
                        this.beatmapData = await res.json();
                        console.log("[AudioLoader] Custom beatmap found and loaded from server.");
                    } else if (res.status === 404) {
                        // Explicitly null if 404, allowing AI fallback
                        this.beatmapData = null;
                        console.log(`[AudioLoader] No custom beatmap found for ${midiName} (404). Falling back to AI logic.`);
                    } else {
                        // Other errors (500, etc) should be warned
                        console.warn(`[AudioLoader] Beatmap lookup failed with status ${res.status}`);
                        this.beatmapData = null;
                    }
                } catch (e) {
                    this.beatmapData = null;
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
