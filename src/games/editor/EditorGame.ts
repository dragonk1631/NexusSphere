import { BaseGame } from '../../core/BaseGame';
import { CoreAudioEngine } from '../../core/audio/CoreAudioEngine';
import { ASSET_PATHS } from '../../core/asset/AssetRegistry';
import { MidiParser } from '../../core/audio/MidiParser';
import type { ParsedMidi, GameNote } from '../../core/audio/MidiParser';
import { EditorUI } from './EditorUI';
import { GameTransition } from '../../core/GameTransition';
import { MelodyAnalyzer } from '../../core/audio/MelodyAnalyzer';
import { LocalSongStorage } from '../rhythm/services/LocalSongStorage';

export interface SongEntry {
    id?: string;
    name: string;
    url: string;
    bpm?: number;
    duration?: number;
    noteCount?: number;
    isCustom?: boolean;
}

interface ChannelData {
    channel: number;
    notes: GameNote[];
    trackNames: string[];
    instrumentFamily: string;
    isDrum: boolean;
}

const CHANNEL_COLORS = [
    '#FF5252', // Ch 1 Red
    '#FF4081', // Ch 2 Pink
    '#E040FB', // Ch 3 Purple
    '#7C4DFF', // Ch 4 Deep Purple
    '#536DFE', // Ch 5 Indigo
    '#448AFF', // Ch 6 Blue
    '#40C4FF', // Ch 7 Light Blue
    '#18FFFF', // Ch 8 Cyan
    '#64FFDA', // Ch 9 Teal
    '#69F0AE', // Ch 10 Green
    '#B2FF59', // Ch 11 Light Green
    '#EEFF41', // Ch 12 Lime
    '#FFFF00', // Ch 13 Yellow
    '#FFD740', // Ch 14 Amber
    '#FFAB40', // Ch 15 Orange
    '#FF6E40'  // Ch 16 Deep Orange
];

export class EditorGame extends BaseGame {
    private midiData: ParsedMidi | null = null;
    private ui: EditorUI | null = null;
    private resizeObserver: ResizeObserver | null = null;

    // Channel-Based Data Structure (16 MIDI Channels)
    private channelData: ChannelData[] = [];
    private rawMidiBuffer: ArrayBuffer | null = null;
    private measureConfig = new Map<number, number>(); // Map<MeasureIndex, PrimaryChannel>
    private currentMidiFileName: string = 'test';
    private currentMidiFileUrl: string = ''; // Keep track of the actual URL exactly as passed

    // Song List State
    private songList: SongEntry[] = [];
    private currentSortMode: string = 'name';
    private storage = new LocalSongStorage();

    // Viewport State
    private scrollX = 0;
    private scrollY = 0;
    private zoomX = 0.1;
    private trackHeight = 60;

    // Playback State
    private isPlaying = false;
    private isLooping = false;
    private metronomeEnabled = false;
    private lastMetronomeBeat = -1;
    private soloTrackIndices = new Set<number>();
    private mutedTrackIndices = new Set<number>();
    private originalBpm = 120;
    private trackVolumes = new Map<number, number>(); // uiIndex -> volume (0-127)
    private isDraggingPlayhead: boolean = false;
    private scrubTime: number = 0;
    private lastSeekTime: number = 0;
    private wakeLock: any = null;

    // Bound event handlers — stored so they can be removed in destroy()
    private _boundMouseMove: (e: MouseEvent | TouchEvent) => void;
    private _boundMouseUp: () => void;
    private _boundTouchMove: (e: TouchEvent) => void;
    private _boundTouchEnd: () => void;
    private _boundTouchCancel: () => void;
    private _boundVisibilityChange: () => void;
    private _boundWheel: (e: WheelEvent) => void;
    private _boundMouseDown: (e: MouseEvent) => void;
    private _boundCanvasTouchStart: (e: TouchEvent) => void;
    private _boundMouseEnter: () => void;
    private _boundMouseLeave: () => void;

    // --- Measure Selection State ---
    private isDraggingMeasureRange: boolean = false;
    private selectedMeasures = new Set<number>();
    private lastDragMeasure: number | null = null;
    private dragSelectionMode: 'select' | 'deselect' | null = null;

    constructor(canvas: HTMLCanvasElement, audioEngine: CoreAudioEngine) {
        super(canvas, audioEngine);
        this.selectedMeasures = new Set<number>();
        this._boundMouseMove = (e) => this.handleMouseMove(e as MouseEvent);
        this._boundMouseUp = () => this.handleMouseUp();
        this._boundTouchMove = (e) => {
            if (this.isDraggingPlayhead || this.isDraggingMeasureRange) {
                e.preventDefault();
                this.handleMouseMove(e);
            }
        };
        this._boundTouchEnd = () => this.handleMouseUp();
        this._boundTouchCancel = () => this.handleMouseUp();
        this._boundVisibilityChange = () => {
            if (this.wakeLock !== null && document.visibilityState === 'visible') {
                this.requestWakeLock();
            }
        };
        this._boundWheel = (e) => this.handleWheel(e);
        this._boundMouseDown = (e) => this.handleMouseDown(e);
        this._boundCanvasTouchStart = (e) => {
            e.preventDefault();
            this.handleMouseDown(e);
        };
        this._boundMouseEnter = () => { document.body.style.overflow = 'hidden'; };
        this._boundMouseLeave = () => { document.body.style.overflow = ''; };
    }

    public async init(): Promise<void> {
        this.ui = new EditorUI(
            (action) => this.handleTransport(action),
            (idx, muted) => this.handleMute(idx, muted),
            (idx, soloed) => this.handleSolo(idx, soloed),
            (level) => { this.zoomX = level; },
            (percent) => {
                const totalHeight = 16 * this.trackHeight; // Fixed 16 channels
                this.scrollY = percent * Math.max(0, totalHeight - this.canvas.height);
                this.ui?.syncTrackScroll(this.scrollY); // Fixed: Sync track view immediately
            },
            (filename, file) => this.loadMidiFile(filename, file),
            (files) => this.handleFolderSelect(files),
            () => this.handleRefresh(),
            (bpm) => this.handleBpmChange(bpm),
            (percent) => this.seekToPercent(percent),
            (vol) => this.audioEngine.setMasterVolume(vol),
            (idx, vol) => this.handleTrackVolume(idx, vol),
            (type, val) => this.audioEngine.setEQ(type, val),
            (type, val) => {
                if (type === 'reverb') this.audioEngine.setReverbDepth(val);
                if (type === 'chorus') this.audioEngine.setChorusDepth(val);
            },
            (sortBy) => this.handleSortChange(sortBy),
            () => this.handleSaveConfig(),
            (idx: number) => this.handleTrackHeaderClick(idx),
            () => this.handleToggleAllMeasures(),
            () => this.handleMagicAnalyze(),
            () => this.handleResetConfig()
        );
        this.ui.init();

        const container = this.ui.getTimelineContainer();
        if (container) {
            container.appendChild(this.canvas);
            this.canvas.style.position = 'absolute';
            this.canvas.style.top = '0';
            this.canvas.style.left = '0';
            this.canvas.width = container.clientWidth - 16;
            this.canvas.height = container.clientHeight - 16;

            this.resizeObserver = new ResizeObserver(() => {
                if (!container.clientWidth || !container.clientHeight) return; // Prevention
                this.canvas.width = container.clientWidth - 16;
                this.canvas.height = container.clientHeight - 16;
                this.updateTrackLayout();

                // Clamp scrollY after resize to prevent out-of-bounds
                const totalHeight = 16 * this.trackHeight + 24;
                const maxScroll = Math.max(0, totalHeight - this.canvas.height);
                this.scrollY = Math.max(0, Math.min(maxScroll, this.scrollY));
            });
            this.resizeObserver.observe(container);
        }

        this.canvas.addEventListener('wheel', this._boundWheel, { passive: false });

        // UI Cleanups
        this.selectedMeasures.clear();

        // Mouse Events
        this.canvas.addEventListener('mousedown', this._boundMouseDown);
        window.addEventListener('mousemove', this._boundMouseMove);
        window.addEventListener('mouseup', this._boundMouseUp);

        // Touch Events
        this.canvas.addEventListener('touchstart', this._boundCanvasTouchStart, { passive: false });
        window.addEventListener('touchmove', this._boundTouchMove, { passive: false });
        window.addEventListener('touchend', this._boundTouchEnd);
        window.addEventListener('touchcancel', this._boundTouchCancel);

        this.canvas.addEventListener('mouseenter', this._boundMouseEnter);
        this.canvas.addEventListener('mouseleave', this._boundMouseLeave);

        // Prevent sleep on mobile
        this.requestWakeLock();
        document.addEventListener('visibilitychange', this._boundVisibilityChange);
    }

    public async load(): Promise<void> {
        // 1. Check for transition data immediately
        const transitionData = GameTransition.hasData() ? GameTransition.get() : null;

        // 2. Init Audio
        await this.audioEngine.init(ASSET_PATHS.AUDIO.SOUNDFONTS.DEFAULT);

        // Fetch Song List (Official + Custom)
        try {
            // 1. Fetch Official List
            const res = await fetch('assets/data/midi_list.json');
            let official: SongEntry[] = [];
            if (res.ok) {
                official = await res.json();
            }

            // 2. Fetch Custom List from IndexedDB
            const customMetas = await this.storage.getAllMetadata();
            const custom: SongEntry[] = customMetas.map(m => ({
                id: m.id,
                name: `[USER] ${m.title}`,
                url: `user://${m.blobKey}`,
                bpm: m.bpm,
                duration: m.duration,
                isCustom: true
            }));

            this.songList = [...official, ...custom];
            console.log(`[EditorGame] Loaded ${official.length} official and ${custom.length} custom songs.`);

        } catch (e) {
            console.warn('[EditorGame] Failed to load song list.', e);
        }

        this.sortSongList();

        // 3. Populate MIDI Selector
        this.ui?.populateMidiSelector(this.songList);

        const trackPanel = document.getElementById('track-list-panel');
        if (trackPanel) {
            trackPanel.style.overflowY = 'hidden';
            trackPanel.style.pointerEvents = 'auto';
        }

        // 4. Restore from Transition Data (Returning from Test Play)
        if (transitionData && (transitionData.source === 'rhythm' || transitionData.source === 'editor')) {
            const restoreUrl = transitionData.midiUrl || transitionData.midiName;
            console.log(`[EditorGame] Restoring previous state: ${restoreUrl}`);

            // Restore Song List first if available (especially for folders)
            if (transitionData.settings?.songList) {
                this.songList = transitionData.settings.songList;
                this.ui?.populateMidiSelector(this.songList);
            }

            this.currentMidiFileUrl = restoreUrl;
            this.ui?.setSelectedMidi(restoreUrl);

            await this.loadMidiFile(restoreUrl, undefined, transitionData.midiBuffer);
            this.ui?.show();
            GameTransition.clear();
            return;
        }

        if (this.songList.length > 0) {
            await this.loadMidiFile(this.songList[0].url);
            this.ui?.show();
        }
    }

    private sortSongList(): void {
        this.songList.sort((a, b) => {
            switch (this.currentSortMode) {
                case 'name':
                    return a.name.localeCompare(b.name);
                case 'bpm':
                    return (b.bpm || 0) - (a.bpm || 0);
                case 'duration':
                    return (b.duration || 0) - (a.duration || 0);
                case 'noteCount':
                    return (b.noteCount || 0) - (a.noteCount || 0);
                default:
                    return a.name.localeCompare(b.name);
            }
        });
    }

    private handleSortChange(sortBy: string): void {
        this.currentSortMode = sortBy;
        this.sortSongList();
        this.ui?.populateMidiSelector(this.songList);

        // Ensure the currently active file is still selected in the dropdown
        if (this.currentMidiFileUrl) {
            this.ui?.setSelectedMidi(this.currentMidiFileUrl);
        }
    }

    private handleFolderSelect(fileList: FileList): void {
        const midis = Array.from(fileList).filter(f => f.name.toLowerCase().endsWith('.mid') || f.name.toLowerCase().endsWith('.midi'));
        if (midis.length > 0) {
            this.ui?.populateMidiSelector(midis);
            this.loadMidiFile(midis[0].name, midis[0]);
        }
    }

    private handleRefresh(): void {
        this.ui?.triggerFolderPicker();
    }

    private async loadMidiFile(name: string, file?: File, existingBuffer?: ArrayBuffer): Promise<void> {
        try {
            // CRITICAL: Set currentMidiFileName BEFORE any logic that uses it (like safeName generation)
            this.currentMidiFileName = name.split('/').pop()?.replace(/\.mid$/i, '') || 'test';
            this.currentMidiFileUrl = name;

            let buffer: ArrayBuffer;
            if (existingBuffer) {
                buffer = existingBuffer;
            } else if (file) {
                buffer = await file.arrayBuffer();
            } else if (name.startsWith('user://')) {
                // Fetch from IndexedDB
                const blobKey = name.replace('user://', '');
                const blob = await this.storage.getSongBlob(blobKey);
                if (!blob) throw new Error(`Custom MIDI blob not found: ${blobKey}`);
                buffer = await blob.arrayBuffer();
                console.log(`[EditorGame] Loaded user-uploaded MIDI from storage: ${name}`);
            } else {
                const res = await fetch(name);
                buffer = await res.arrayBuffer();
            }
            this.rawMidiBuffer = buffer;

            const parser = new MidiParser();
            this.midiData = await parser.parse(buffer, this.currentMidiFileName);
            await this.audioEngine.loadMidi(buffer);


            // DEBUG: Analyze Track Structure for "Pollution"
            console.groupCollapsed(`[MIDI Analysis] ${name}`);
            this.midiData.tracks.forEach((t, i) => {
                const isConductor = i === 0;
                const hasNotes = t.noteCount > 0;
                const hasAuto = t.hasAutomation;

                // Check if Track 0 has Channel Events (Pollution)
                let status = 'Normal';
                if (isConductor && (hasNotes || hasAuto)) status = 'POLLUTED CONDUCTOR (Leak Risk!)';
                else if (!hasNotes && hasAuto) status = 'Automation Only';
                else if (!hasNotes && !hasAuto) status = 'Empty/Meta';

                console.log(`Track ${i} [Ch ${t.channel}]: ${t.name} | Notes: ${t.noteCount} | Auto: ${hasAuto} | Status: ${status}`);
            });
            console.groupEnd();

            // Reset ALL Audio & View Settings ON LOAD
            this.soloTrackIndices.clear();
            this.mutedTrackIndices.clear();
            this.trackVolumes.clear();
            this.scrollX = 0;
            this.scrollY = 0;
            this.isPlaying = false;

            // Reset EQ & FX to Defaults
            this.audioEngine.setEQ('low', 0);
            this.audioEngine.setEQ('mid', 0);
            this.audioEngine.setEQ('high', 0);
            this.audioEngine.setReverbDepth(0.3);
            this.audioEngine.setChorusDepth(0.2);
            this.audioEngine.setMasterVolume(80);

            // Reset UI
            this.ui?.setPlayState(false);
            this.ui?.resetControls();

            this.audioEngine.stop(); // Ensure engine is stopped

            this.originalBpm = this.midiData.bpm;
            this.ui?.setSelectedMidi(name);
            this.ui?.setBpm(this.midiData.bpm);
            this.ui?.setMidiMeta({ name: this.midiData.name });

            // Channel-Based Data Aggregation (MUST be called before updateTrackLayout uses channelData)
            this.aggregateChannelData();

            // --- Game Measure Analysis (Measure Default setup) ---
            this.measureConfig.clear();

            const strippedName = this.currentMidiFileName.replace(/\.mid$/i, '');
            const safeName = strippedName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const savedConfigStr = localStorage.getItem(`beatmap_config_${safeName}`);
            let loadedFromLocal = false;

            if (savedConfigStr) {
                try {
                    const savedConfig = JSON.parse(savedConfigStr);
                    // [FORCE UPGRADE] v1.3 Standardizes on MIDI Channels. 
                    // Older versions (v1.2) containing Track Indices are discarded to ensure a perfect state.
                    if (savedConfig.version === "1.3" && savedConfig.measureConfig) {
                        const entries = savedConfig.measureConfig;
                        entries.forEach((entry: [number, number]) => {
                            this.measureConfig.set(Number(entry[0]), Number(entry[1]));
                        });
                        loadedFromLocal = true;
                        console.log(`[EditorGame] Loaded validated v1.3 config for ${this.midiData.name}`);
                    } else {
                        console.warn(`[EditorGame] Outdated config version (${savedConfig.version || 'none'}). Forcing fresh Magic Analysis...`);
                    }
                } catch (err) {
                    console.warn(`[EditorGame] Failed to parse local config:`, err);
                }
            }

            if (!loadedFromLocal) {
                // Apply strategic Magic Analyze (Gap Filling) as default if no valid v1.3 config exists
                this.handleMagicAnalyze();
                console.log(`[EditorGame] Perfect State Guaranteed: Strategic Magic Analysis applied on load.`);
            }

            // Render Layout with RESET state (which relies on measureConfig and channelData)
            this.updateTrackLayout();
            this.syncAudioStates();

        } catch (err) {
            console.error(`[EditorGame] Failed to load MIDI: ${err}`);
        }
    }

    /**
     * Convert Audio Time (Seconds) to MIDI Tick using Tempo Map
     */
    private getTickFromTime(time: number): number {
        if (!this.midiData || !this.midiData.tempos || this.midiData.tempos.length === 0) {
            return time * (this.midiData?.bpm || 120) / 60 * (this.midiData?.ppq || 480);
        }

        const tempos = this.midiData.tempos;
        // Find the latest tempo change before 'time'
        let lastTempo = tempos[0];
        for (let i = 0; i < tempos.length; i++) {
            if (time >= tempos[i].time) {
                lastTempo = tempos[i];
            } else {
                break;
            }
        }

        const timeSinceTempo = time - lastTempo.time;
        const ticksSinceTempo = timeSinceTempo * (lastTempo.bpm / 60) * (this.midiData.ppq || 480);
        return lastTempo.ticks + ticksSinceTempo;
    }

    /**
     * Convert MIDI Tick to Audio Time (Seconds) using Tempo Map
     */
    private getTimeFromTick(tick: number): number {
        if (!this.midiData || !this.midiData.tempos || this.midiData.tempos.length === 0) {
            return tick / (this.midiData?.ppq || 480) * 60 / (this.midiData?.bpm || 120);
        }

        const tempos = this.midiData.tempos;
        // Find the latest tempo change before 'tick'
        let lastTempo = tempos[0];
        for (let i = 0; i < tempos.length; i++) {
            if (tick >= tempos[i].ticks) {
                lastTempo = tempos[i];
            } else {
                break;
            }
        }

        const ticksSinceTempo = tick - lastTempo.ticks;
        const timeSinceTempo = ticksSinceTempo / (this.midiData.ppq || 480) * 60 / lastTempo.bpm;
        return lastTempo.time + timeSinceTempo;
    }

    /**
     * Aggregate all notes by MIDI channel (0-15)
     * Creates 16 fixed channel data structures
     */
    private aggregateChannelData(): void {
        if (!this.midiData) return;

        // Initialize 16 channels
        this.channelData = Array.from({ length: 16 }, (_, i) => ({
            channel: i,
            notes: [],
            trackNames: [],
            instrumentFamily: i === 9 ? 'Drums' : 'Unknown',
            isDrum: i === 9
        }));

        // Aggregate notes from all tracks by channel
        this.midiData.tracks.forEach(track => {
            track.notes.forEach(note => {
                const ch = note.channel;
                if (ch >= 0 && ch < 16) {
                    // Deduplicate notes to prevent additive render overlapping (glitch visuals)
                    const isDuplicate = this.channelData[ch].notes.some(existing =>
                        Math.abs(existing.ticks - note.ticks) < 5 && existing.midi === note.midi
                    );
                    if (!isDuplicate) {
                        this.channelData[ch].notes.push(note);
                    }

                    // Track which track names contribute to this channel
                    if (track.name && !this.channelData[ch].trackNames.includes(track.name)) {
                        this.channelData[ch].trackNames.push(track.name);
                    }

                    // Update instrument family (prefer non-drum instruments for non-channel-9)
                    if (ch === 9) {
                        this.channelData[ch].instrumentFamily = 'Drums';
                        this.channelData[ch].isDrum = true;
                    } else if (this.channelData[ch].instrumentFamily === 'Unknown') {
                        this.channelData[ch].instrumentFamily = track.instrumentFamily;
                    }
                }
            });
        });

        // Sort notes by time for each channel
        this.channelData.forEach(ch => {
            ch.notes.sort((a, b) => a.time - b.time);
        });

        console.log('[EditorGame] Channel data aggregated:', this.channelData.map(ch =>
            `Ch${ch.channel}: ${ch.notes.length} notes, ${ch.trackNames.join(', ')}`
        ));
    }

    private updateTrackLayout(): void {
        const container = this.ui?.getTimelineContainer();
        if (container) {
            const h = container.clientHeight - 16;
            this.trackHeight = Math.floor(Math.max(40, h / 16));

            // Initialize volumes for all 16 channels
            for (let ch = 0; ch < 16; ch++) {
                if (!this.trackVolumes.has(ch)) this.trackVolumes.set(ch, 100);
            }

            // Calculate effective mutes for initial render
            const hasSolo = this.soloTrackIndices.size > 0;
            const effectiveMutes = new Set<number>();
            for (let ch = 0; ch < 16; ch++) {
                const isAudible = hasSolo ? this.soloTrackIndices.has(ch) : !this.mutedTrackIndices.has(ch);
                if (!isAudible) effectiveMutes.add(ch);
            }

            // Find the true global MAIN channel using the comprehensive MelodyAnalyzer
            let bestMainChannel = -1;
            if (this.midiData) {
                const rankedChannels = MelodyAnalyzer.findMelodyChannels(this.midiData);
                if (rankedChannels.length > 0) {
                    bestMainChannel = rankedChannels[0];
                }
            }

            const mainChannels = new Set<number>();
            if (bestMainChannel !== -1) {
                mainChannels.add(bestMainChannel);
            }

            // Render 16 fixed channel headers with COLORS
            this.ui?.renderChannelHeaders(this.channelData, this.trackHeight, this.soloTrackIndices, this.trackVolumes, effectiveMutes, CHANNEL_COLORS, mainChannels);
        }
    }

    private handleBpmChange(bpm: number): void {
        if (this.midiData && this.originalBpm > 0) {
            this.midiData.bpm = bpm;
            const rate = bpm / this.originalBpm;
            this.audioEngine.setPlaybackRate(rate);
        }
    }

    private syncAudioStates(): void {
        if (!this.audioEngine || !this.midiData) return;

        const hasSolo = this.soloTrackIndices.size > 0;
        const visualMutedIndices = new Set<number>();

        // 1. Channel-Based Audio Control
        for (let ch = 0; ch < 16; ch++) {
            let isAudible = false;

            if (hasSolo) {
                isAudible = this.soloTrackIndices.has(ch);
            } else {
                isAudible = !this.mutedTrackIndices.has(ch);
            }

            if (!isAudible) {
                visualMutedIndices.add(ch);
            }

            // Still keep channel mute as a backup/reinforcement
            this.audioEngine.setChannelMute(ch, !isAudible);

            if (!isAudible) {
                this.audioEngine.stopChannelNotes(ch);
            }

            if (isAudible) {
                const vol = this.trackVolumes.get(ch) ?? 100;
                this.audioEngine.setChannelVolume(ch, vol);
            }
        }

        // 2. Track-Level Muting (The Robust Fix)
        // We iterate through ALL tracks and "Disable" them if they belong to a muted channel.
        // This stops the sequencer from processing events -> No more volume automation leaks.
        this.midiData.tracks.forEach((track, trackIndex) => {
            // CRITICAL: Protection for Conductor/Meta Tracks
            // 1. ALWAYS protect Track 0 (Standard Conductor Track with Tempo/TimeSig).
            //    Muting Track 0 usually kills the Tempo Map.
            // 2. Protect tracks with 0 notes AND NO AUTOMATION (Pure Meta Tracks).
            //    If a track has 0 notes BUT has Automation (CC), it is an "Automation Track".
            //    We MUST allow invalidating it to prevent volume leakage.
            const isConductorTrack = (trackIndex === 0) || (track.noteCount === 0 && !track.hasAutomation);

            if (isConductorTrack) {
                // Always Enable Conductor
                this.audioEngine.setTrackMute(trackIndex, false);
                return;
            }

            // Normal Logic for Note Tracks & Automation Tracks
            let isTrackAudible = false;
            if (hasSolo) {
                isTrackAudible = this.soloTrackIndices.has(track.channel);
            } else {
                isTrackAudible = !this.mutedTrackIndices.has(track.channel);
            }

            // "Mute" here means "Disable Track in Sequencer"
            this.audioEngine.setTrackMute(trackIndex, !isTrackAudible);
        });

        // Update UI Mute Buttons based on effective state
        this.ui?.updateMuteUI(visualMutedIndices);

        console.log(`[Audio Sync] Solos: ${hasSolo}, Mutes: ${visualMutedIndices.size}, Tracks Updated: ${this.midiData.tracks.length}`);
    }

    private syncViewport(time: number, forceCenter: boolean = false): void {
        if (!this.midiData) return;
        const currentTick = this.getTickFromTime(time);
        const playheadX = currentTick * this.zoomX;
        const viewWidth = this.canvas.width;

        if (forceCenter) {
            this.scrollX = Math.max(0, playheadX - viewWidth * 0.5);
        } else {
            // Lazy Follow (Forward): Only shift if playhead is past 95% of screen
            if (playheadX > this.scrollX + viewWidth * 0.95) {
                this.scrollX = playheadX - viewWidth * 0.2;
            }
            // Lazy Follow (Backward): Only shift if playhead is off-screen to the left
            else if (playheadX < this.scrollX) {
                this.scrollX = Math.max(0, playheadX - viewWidth * 0.2);
            }
        }
    }

    public create(): void { }

    private handleTransport(action: string): void {
        switch (action) {
            case 'toggle':
                if (this.isPlaying) {
                    this.audioEngine.pause();
                    this.isPlaying = false;
                } else {
                    this.audioEngine.resume();
                    this.audioEngine.play();
                    this.isPlaying = true;
                    this.playStartTime = performance.now(); // Start sync window
                    // Fix: Re-apply Solo/Mute states after starting playback
                    this.syncAudioStates();
                }
                this.ui?.setPlayState(this.isPlaying);
                break;
            case 'stop':
                this.audioEngine.stop();
                this.isPlaying = false;
                this.scrollX = 0;
                this.ui?.setPlayState(false);
                break;
            case 'test':
                if (this.midiData && this.audioEngine) {
                    // 1. Stop Playback
                    this.audioEngine.stop();

                    if (this.rawMidiBuffer) {
                        let targetChannels: number[] | undefined;

                        if (this.soloTrackIndices.size > 0) {
                            // If user has SOLOED channels, use them as forced channels for the game
                            targetChannels = Array.from(this.soloTrackIndices);
                            console.log(`[EditorGame] Test Play: Using Solo Channels: ${targetChannels.map(c => c + 1).join(', ')}`);
                        } else {
                            // Treat test-mode exactly like normal mode, allowing
                            // NoteFactory to use secondary channels for gap-filling.
                            targetChannels = undefined;
                        }

                        // Convert measureConfig Map to Array for passing via GameTransition
                        const measureObj = Array.from(this.measureConfig.entries());

                        GameTransition.set({
                            source: 'editor',
                            midiBuffer: this.rawMidiBuffer!,
                            midiName: (this.midiData?.name) || this.currentMidiFileName || 'Test Song',
                            midiUrl: this.currentMidiFileUrl || '',
                            forcedChannels: targetChannels,
                            settings: {
                                mutedChannels: new Set(this.mutedTrackIndices),
                                soloChannels: new Set(this.soloTrackIndices),
                                speed: 1.0,
                                volume: 1.0,
                                difficulty: this.ui?.getTestDifficulty() || 'NORMAL',
                                measureConfig: measureObj,
                                songList: this.songList
                            }
                        });
                        console.log("[EditorGame] GameTransition set. Dispatching switch-game...");

                        window.dispatchEvent(new CustomEvent('switch-game', {
                            detail: { targetMode: 'rhythm' }
                        }));
                    } else {
                        console.warn("[Editor] No MIDI buffer available for test play.");
                    }
                }
                break;
            case 'start':
                this.audioEngine.seek(0);
                this.syncAudioStates();
                this.syncViewport(0, true);
                break;
            case 'end':
                if (this.midiData) {
                    const time = this.midiData.duration - 0.1;
                    this.audioEngine.seek(time);
                    this.syncAudioStates();
                    this.syncViewport(time, true);
                }
                break;
        }
    }

    private seekToPercent(percent: number): void {
        if (this.midiData) {
            const time = percent * this.midiData.duration;
            this.audioEngine.seek(time);
            this.syncAudioStates();
            this.syncViewport(time, true);
        }
    }

    private handleMute(index: number, muted: boolean): void {
        if (muted) {
            this.mutedTrackIndices.add(index);
        } else {
            this.mutedTrackIndices.delete(index);
        }
        this.syncAudioStates();
    }

    private handleSolo(index: number, soloed: boolean): void {
        if (soloed) {
            this.soloTrackIndices.add(index);
        } else {
            this.soloTrackIndices.delete(index);
        }

        this.syncAudioStates();
        this.ui?.updateSoloUI(this.soloTrackIndices);
    }

    private handleTrackVolume(channelIndex: number, volume: number): void {
        this.trackVolumes.set(channelIndex, volume);
        // Channel index IS the MIDI channel (0-15)
        this.audioEngine.setChannelVolume(channelIndex, volume);
        this.ui?.updateTrackVolumeUI(channelIndex, volume);
    }

    // Auto Roles and Channel Role changing logic is removed.

    public handleSaveConfig(showFeedback: boolean = true): void {
        if (!this.midiData) return;

        // Convert Map to Array of [MeasureIdx, PrimaryChannel] for JSON
        const measureObj = Array.from(this.measureConfig.entries());

        const outputData = {
            version: "1.3",
            metadata: {
                title: this.midiData.name,
                bpm: this.midiData.bpm,
                duration: this.midiData.duration
            },
            measureConfig: measureObj
        };

        const strippedName = this.currentMidiFileName.replace(/\.mid$/i, '');
        const safeName = strippedName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        localStorage.setItem(`beatmap_config_${safeName}`, JSON.stringify(outputData));
        console.log(`[EditorGame] Saved config to localStorage for ${safeName}`);

        if (showFeedback) {
            alert(`Measure configuration for '${this.midiData.name}' saved to local storage!`);
        }
    }

    private handleWheel(e: WheelEvent): void {
        e.preventDefault();
        if (e.ctrlKey) {
            this.zoomX = Math.max(0.01, Math.min(0.19, this.zoomX - e.deltaY * 0.0001));
        } else if (e.shiftKey) {
            // Horizontal scroll via shift+wheel could be added here
        } else {
            // Fixed 16 channels for scroll calculation
            const totalHeight = 16 * this.trackHeight + 24;
            const maxScroll = Math.max(0, totalHeight - this.canvas.height);
            this.scrollY = Math.max(0, Math.min(maxScroll, this.scrollY + e.deltaY));
            this.ui?.syncTrackScroll(this.scrollY);

            // Fixed: Sync scrollbar UI when scrolling with wheel
            if (maxScroll > 1) {
                this.ui?.syncControls(this.zoomX, this.scrollY / maxScroll);
            }
        }
    }

    public handleResetConfig(): void {
        console.log('[EditorGame] Resetting all configurations...');

        // Wipe all from storage
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.includes('beatmap_config')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));

        // Clear memory
        this.measureConfig.clear();

        // Re-run Magic Analyze to get back to best-auto state
        this.handleMagicAnalyze();

        alert("All manual configurations have been deleted. Re-analyzing with Magic...");
    }

    private wasPlaying = false; // Add state to track playback before drag

    private handleMouseDown(e: MouseEvent | TouchEvent): void {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        // --- Handle Measure Header Click & Drag ---
        const headerHeight = 24;
        if (y <= headerHeight) {
            // Calculate which measure was clicked
            const ppq = this.midiData?.ppq || 480;
            const pixelsPerTick = this.zoomX;
            const clickedTick = (x + this.scrollX) / pixelsPerTick;
            const measureIdx = Math.floor(clickedTick / (ppq * 4)); // assuming 4/4 time

            this.isDraggingMeasureRange = true;
            this.lastDragMeasure = measureIdx;

            // Toggle selection for initial click
            if (this.selectedMeasures.has(measureIdx)) {
                this.selectedMeasures.delete(measureIdx);
                this.dragSelectionMode = 'deselect';
            } else {
                this.selectedMeasures.add(measureIdx);
                this.dragSelectionMode = 'select';
            }

            this.render(); // Update selection visual
            return; // Prevent seek logic
        }

        // --- Handle Canvas Body Click (Channel Assignment when measures selected) ---
        if (this.selectedMeasures.size > 0 && y > headerHeight) {
            const ppq = this.midiData?.ppq || 480;
            const pixelsPerTick = this.zoomX;
            const clickedTick = (x + this.scrollX) / pixelsPerTick;
            const clickedMeasureIdx = Math.floor(clickedTick / (ppq * 4));

            // Only assign if clicking inside one of the selected measures
            if (this.selectedMeasures.has(clickedMeasureIdx)) {
                const channelIdx = Math.floor((y - headerHeight + this.scrollY) / this.trackHeight);
                if (channelIdx >= 0 && channelIdx < 16) {
                    this.handleTrackHeaderClick(channelIdx);
                    return; // Prevent seek logic
                }
            }
        }

        // --- Normal Seek Logic ---
        this.isDraggingPlayhead = true;
        this.wasPlaying = this.isPlaying; // Store previous state
        this.audioEngine.pause();
        this.ui?.setPlayState(false);
        this.isPlaying = false;
        this.scrubTime = this.audioEngine.currentTime;
        this.seekAtMouse(e, false);
    }

    private handleMouseMove(e: MouseEvent | TouchEvent): void {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        void y;

        if (this.isDraggingMeasureRange && this.lastDragMeasure !== null) {
            const ppq = this.midiData?.ppq || 480;
            const pixelsPerTick = this.zoomX;
            const clickedTick = (x + this.scrollX) / pixelsPerTick;
            const measureIdx = Math.floor(Math.max(0, clickedTick) / (ppq * 4));

            if (this.lastDragMeasure !== measureIdx) {
                // Range select/deselect between lastDragMeasure and measureIdx
                const start = Math.min(this.lastDragMeasure, measureIdx);
                const end = Math.max(this.lastDragMeasure, measureIdx);

                for (let m = start; m <= end; m++) {
                    if (this.dragSelectionMode === 'select') {
                        this.selectedMeasures.add(m);
                    } else if (this.dragSelectionMode === 'deselect') {
                        this.selectedMeasures.delete(m);
                    }
                }

                this.lastDragMeasure = measureIdx;
                this.render(); // 렌더링을 갱신해서 범위 시각화를 업데이트
            }
            return;
        }

        if (this.isDraggingPlayhead) {
            this.seekAtMouse(e);
        }
    }

    private handleMouseUp(_e?: MouseEvent | TouchEvent): void {
        if (this.isDraggingMeasureRange) {
            this.isDraggingMeasureRange = false;
            this.lastDragMeasure = null;
            this.dragSelectionMode = null;
            return;
        }

        if (this.isDraggingPlayhead) {
            this.isDraggingPlayhead = false;

            // Final seek on release to ensure engine is exactly at scrubTime
            this.audioEngine.seek(this.scrubTime);
            this.syncAudioStates();

            // Fix: Only resume if it was playing before drag
            if (this.wasPlaying) {
                this.audioEngine.resume().then(() => {
                    this.audioEngine.play();
                    this.isPlaying = true;
                    this.playStartTime = performance.now(); // Start sync window
                    this.ui?.setPlayState(true);
                });
            }
        }
    }

    private seekAtMouse(e: MouseEvent | TouchEvent, forceSyncView: boolean = false): void {
        if (!this.midiData) return;

        const rect = this.canvas.getBoundingClientRect();
        let clientX = 0;

        if (e instanceof MouseEvent) {
            clientX = e.clientX;
        } else if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
        } else if (e.changedTouches && e.changedTouches.length > 0) {
            clientX = e.changedTouches[0].clientX;
        } else {
            return;
        }

        const mouseX = clientX - rect.left;
        const tick = (mouseX + this.scrollX) / this.zoomX; // X to Tick
        const time = this.getTimeFromTick(tick); // Tick to Time
        this.scrubTime = Math.max(0, Math.min(this.midiData.duration, time));

        // Unified Viewport Sync
        this.syncViewport(this.scrubTime, forceSyncView);

        // Throttled Audio Engine Seek (Performance Fix)
        const now = performance.now();
        if (now - this.lastSeekTime > 100) { // 10Hz limit
            this.audioEngine.seek(this.scrubTime);
            this.syncAudioStates();
            this.lastSeekTime = now;
        }
    }

    private playStartTime: number = 0;

    public update(_delta: number): void {
        const duration = this.audioEngine.duration;
        const currentTime = this.isDraggingPlayhead ? this.scrubTime : this.audioEngine.currentTime;
        this.ui?.updateProgress(currentTime, duration);

        // Fix: Force sync audio states for the first few frames of playback
        if (this.isPlaying && performance.now() - this.playStartTime < 200) {
            this.syncAudioStates();
        }

        // BRUTE FORCE PROTECTION: Enforce Mute State Check Every Frame
        // This fights against "Polluted Conductor Tracks" that send Volume Automation (CC7)
        // even when we think the channel should be muted.
        if (this.isPlaying) {
            this.enforceMuteCompliance();
        }

        if (!this.isDraggingPlayhead && currentTime >= duration && this.isPlaying) {
            if (this.isLooping) {
                this.audioEngine.seek(0);
            } else {
                this.isPlaying = false;
                this.ui?.setPlayState(false);
            }
        }

        if (this.isPlaying && this.metronomeEnabled) {
            const beatWidth = 0.5; // 120 BPM
            const currentBeat = Math.floor(currentTime / beatWidth);
            if (currentBeat !== this.lastMetronomeBeat) {
                this.lastMetronomeBeat = currentBeat;
                this.audioEngine.triggerNoteOn(9, 37, 80);
            }
        }

        if (this.isPlaying) {
            this.syncViewport(currentTime);
        }

        if (this.ui && this.midiData) {
            // Optimization: Throttled sync (only if playing or dragging)
            if (this.isPlaying || this.isDraggingPlayhead) {
                const totalHeight = 16 * this.trackHeight + 24;
                const maxScroll = Math.max(1, totalHeight - this.canvas.height);
                // Correct percentage: scrollY relative to scrollable range, not total height
                const scrollPercent = this.scrollY / maxScroll;
                this.ui.syncControls(this.zoomX, scrollPercent);
            }
        }

        // this.render(); // Render handled by main loop
    }

    /**
     * Emnforce Mute Compliance (The "Hammer" Fix)
     * Checks all channels every frame. If a channel is supposed to be muted,
     * absolutely FORCE it to be silent, overriding any leaked MIDI events.
     */
    private enforceMuteCompliance(): void {
        const hasSolo = this.soloTrackIndices.size > 0;

        for (let ch = 0; ch < 16; ch++) {
            let isAudible = false;

            if (hasSolo) {
                isAudible = this.soloTrackIndices.has(ch);
            } else {
                isAudible = !this.mutedTrackIndices.has(ch);
            }

            if (!isAudible) {
                // FORCE SILENCE (Optimized)
                // Use overrideChannelVolume to only send CC7=0, identifying the intent as "Maintenance"
                // rather than "Panic". This avoids sending CC 120/123 every frame.
                this.audioEngine.overrideChannelVolume(ch, 0);
            }
        }
    }

    public render(): void {
        this.ctx.fillStyle = '#0a0a0a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const headerHeight = 24; // Measure Header Height

        // Fixed 16 channels (0-15)
        const channelCount = 16;
        const startChannel = Math.max(0, Math.floor(this.scrollY / this.trackHeight));
        // Add +1 to endChannel to cover lower boundary visibility perfectly
        const endChannel = Math.min(channelCount, startChannel + Math.ceil((this.canvas.height - headerHeight) / this.trackHeight) + 1);

        // Colored Striping on Canvas
        for (let i = startChannel; i < endChannel; i++) {
            const channelTop = headerHeight + i * this.trackHeight - this.scrollY;

            // Channel Background Tint - FAINT
            this.ctx.fillStyle = CHANNEL_COLORS[i];
            this.ctx.globalAlpha = 0.03;
            this.ctx.fillRect(0, channelTop, this.canvas.width, this.trackHeight);
            this.ctx.globalAlpha = 1.0;

            // Zebra: High Contrast Grayscale
            if (i % 2 === 1) {
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'; // Increased to 0.1
                this.ctx.fillRect(0, channelTop, this.canvas.width, this.trackHeight);
            } else {
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; // Much darker even rows
                this.ctx.fillRect(0, channelTop, this.canvas.width, this.trackHeight);
            }
        }

        // Helper: Get measure's primary channel (fallback to previous measure if not set)
        const getMeasurePrimaryChannel = (measureIdx: number): number | null => {
            let ch = null;
            for (let i = measureIdx; i >= 0; i--) {
                if (this.measureConfig.has(i)) {
                    ch = this.measureConfig.get(i)!;
                    break;
                }
            }
            return ch;
        };

        // Grid (Tick-based)
        const ppq = this.midiData?.ppq || 480;
        const pixelsPerProcessedTick = this.zoomX;
        const startTick = Math.floor(this.scrollX / pixelsPerProcessedTick);
        const endTick = startTick + Math.ceil(this.canvas.width / pixelsPerProcessedTick) + 1;

        // Snap startTick to nearest beat
        const tickStep = ppq; // 1 beat
        const alignedStartTick = Math.floor(startTick / tickStep) * tickStep;

        // Opaque background for measure header to hide scrolling channels
        this.ctx.fillStyle = '#0a0a0a';
        this.ctx.fillRect(0, 0, this.canvas.width, headerHeight);
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(0, headerHeight);
        this.ctx.lineTo(this.canvas.width, headerHeight);
        this.ctx.stroke();

        this.ctx.lineWidth = 1;
        for (let t = alignedStartTick; t <= endTick; t += tickStep) {
            const x = t * pixelsPerProcessedTick - this.scrollX;
            const isBar = (t / ppq) % 4 === 0; // Assuming 4/4
            this.ctx.strokeStyle = isBar ? '#444' : '#222';

            this.ctx.beginPath();
            // Start drawing line below header region
            this.ctx.moveTo(x, headerHeight);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();

            // Draw Measure Header Block
            if (isBar) {
                const measureIdx = Math.round(t / (ppq * 4));
                const barNum = measureIdx + 1;

                // Draw measure number
                this.ctx.fillStyle = '#666';
                this.ctx.font = '9px monospace';
                this.ctx.fillText(barNum.toString(), x + 4, headerHeight - 12);

                // Draw configured primary channel for this measure
                const primaryCh = getMeasurePrimaryChannel(measureIdx);
                if (primaryCh !== null) {
                    const color = CHANNEL_COLORS[primaryCh] || '#888';
                    this.ctx.fillStyle = color;
                    this.ctx.font = 'bold 10px sans-serif';
                    this.ctx.fillText(`CH ${primaryCh + 1}`, x + 4, headerHeight - 2);

                    // Optional: Draw a subtle colored background for the measure header
                    const nextBarX = (t + ppq * 4) * pixelsPerProcessedTick - this.scrollX;
                    const w = nextBarX - x;
                    this.ctx.fillStyle = `${color}22`; // 22 is slight opacity hex
                    this.ctx.fillRect(x, 0, w, headerHeight);
                }
            }
        }

        // --- Render Selection Range (Vertical Highlights) ---
        if (this.selectedMeasures.size > 0) {
            this.ctx.fillStyle = 'rgba(76, 175, 80, 0.1)'; // Very subtle green fill for the whole lane
            this.ctx.strokeStyle = 'rgba(76, 175, 80, 0.8)'; // Strong Green outline
            this.ctx.lineWidth = 1.5;

            this.selectedMeasures.forEach(mIdx => {
                const startX = (mIdx * ppq * 4) * pixelsPerProcessedTick - this.scrollX;
                const width = (ppq * 4) * pixelsPerProcessedTick;

                // Only draw if visible
                if (startX + width > 0 && startX < this.canvas.width) {
                    // Fill whole vertical lane
                    this.ctx.fillStyle = 'rgba(76, 175, 80, 0.1)';
                    this.ctx.fillRect(startX, headerHeight, width, this.canvas.height - headerHeight);

                    // Draw outer border (left/right) to make it look like a selection
                    this.ctx.beginPath();
                    this.ctx.moveTo(startX, 0);
                    this.ctx.lineTo(startX, this.canvas.height);
                    this.ctx.moveTo(startX + width, 0);
                    this.ctx.lineTo(startX + width, this.canvas.height);
                    this.ctx.stroke();

                    // Fill Header separately with a bit more opacity
                    this.ctx.fillStyle = 'rgba(76, 175, 80, 0.3)';
                    this.ctx.fillRect(startX, 0, width, headerHeight);
                }
            });
        }

        // Horizontal Separator Lines (High Contrast)
        this.ctx.strokeStyle = '#555'; // Brighter
        this.ctx.lineWidth = 1.2;      // Adjusted to 1.2
        this.ctx.beginPath();
        for (let i = startChannel; i <= endChannel; i++) {
            const y = headerHeight + i * this.trackHeight - this.scrollY;
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
        }
        this.ctx.stroke();

        // Clip area for notes so they don't draw over the measure header when scrolling up
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(0, headerHeight, this.canvas.width, this.canvas.height - headerHeight);
        this.ctx.clip();

        for (let ch = startChannel; ch < endChannel; ch++) {
            const channelInfo = this.channelData[ch];
            if (!channelInfo) continue;

            const channelTop = headerHeight + ch * this.trackHeight - this.scrollY;
            const isSoloed = this.soloTrackIndices.has(ch);
            const hasAnySolo = this.soloTrackIndices.size > 0;

            // Highlight Soloed Channel Row
            if (isSoloed) {
                this.ctx.fillStyle = CHANNEL_COLORS[ch];
                this.ctx.globalAlpha = 0.1;
                this.ctx.fillRect(0, channelTop, this.canvas.width, this.trackHeight);
                this.ctx.globalAlpha = 1.0;

                this.ctx.strokeStyle = CHANNEL_COLORS[ch];
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(0, channelTop, this.canvas.width, this.trackHeight);
            }

            // Alpha logic: Solo takes priority
            if (hasAnySolo && !isSoloed) {
                this.ctx.globalAlpha = 0.15;
            } else {
                this.ctx.globalAlpha = 1.0;
            }

            if (channelInfo.notes.length > 0) {
                // Use Channel Color
                const noteColor = CHANNEL_COLORS[ch];

                channelInfo.notes.forEach((note: GameNote) => {
                    const x = note.ticks * this.zoomX - this.scrollX;
                    const w = Math.max(4, note.durationTicks * this.zoomX);
                    if (x + w < 0 || x > this.canvas.width) return;

                    // Visualization
                    const effectiveMidi = Math.min(108, Math.max(21, note.midi));
                    const pitchNorm = 1 - (Math.min(96, Math.max(36, effectiveMidi)) - 36) / 60;
                    const y = channelTop + 6 + pitchNorm * (this.trackHeight - 16);
                    const h = 5;

                    this.ctx.fillStyle = noteColor;
                    this.ctx.fillRect(x, y, w, h);

                    // Check if note is in the main channel for its measure
                    const ppq = this.midiData?.ppq || 480;
                    const measureIdx = Math.floor(note.ticks / (ppq * 4));
                    const isMainChannel = getMeasurePrimaryChannel(measureIdx) === ch;

                    if (isMainChannel) {
                        this.ctx.save();
                        this.ctx.strokeStyle = '#ffffff';
                        this.ctx.lineWidth = 1.5;
                        this.ctx.shadowBlur = 8;
                        this.ctx.shadowColor = '#ffffff';
                        this.ctx.strokeRect(x, y, w, h);
                        this.ctx.restore();
                    }

                    // Lighter top edge for 3D effect
                    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                    this.ctx.fillRect(x, y, w, 1);
                });
            }
            this.ctx.globalAlpha = 1.0;
        }

        this.ctx.restore(); // Remove clipping region

        // Playhead (Tick-based)
        const displayTime = this.isDraggingPlayhead ? this.scrubTime : this.audioEngine.currentTime;
        const currentTick = this.getTickFromTime(displayTime);
        const playheadX = currentTick * this.zoomX - this.scrollX;
        if (playheadX >= 0 && playheadX <= this.canvas.width) {
            if (this.isDraggingPlayhead) {
                this.ctx.shadowBlur = 15;
                this.ctx.shadowColor = '#00ffcc';
                this.ctx.strokeStyle = '#00ffcc';
                this.ctx.lineWidth = 6;
            } else {
                this.ctx.strokeStyle = '#ffffff';
                this.ctx.lineWidth = 4;
            }
            this.ctx.beginPath();
            this.ctx.moveTo(playheadX, 0);
            this.ctx.lineTo(playheadX, this.canvas.height);
            this.ctx.stroke();

            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath();
            this.ctx.moveTo(playheadX - 8, 0);
            this.ctx.lineTo(playheadX + 8, 0);
            this.ctx.lineTo(playheadX, 10);
            this.ctx.fill();

            this.ctx.shadowBlur = 0; // Reset
        }
    }

    private async requestWakeLock(): Promise<void> {
        if ('wakeLock' in navigator) {
            try {
                this.wakeLock = await (navigator as any).wakeLock.request('screen');
                console.log('[EditorGame] Screen Wake Lock is active.');
            } catch (err) {
                console.warn(`[EditorGame] Wake Lock failed: ${err}`);
            }
        }
    }

    private releaseWakeLock(): void {
        if (this.wakeLock) {
            this.wakeLock.release().then(() => {
                this.wakeLock = null;
                console.log('[EditorGame] Screen Wake Lock released.');
            });
        }
    }

    public destroy(): void {
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
        this.releaseWakeLock();
        this.audioEngine.stop();
        this.isPlaying = false;

        // Remove ALL event listeners — canvas AND window level
        // Canvas listeners MUST be removed: RhythmGame reuses the same canvas,
        // so EditorGame's touchstart/mousedown would fire on RhythmGame touches.
        this.canvas.removeEventListener('wheel', this._boundWheel);
        this.canvas.removeEventListener('mousedown', this._boundMouseDown);
        this.canvas.removeEventListener('touchstart', this._boundCanvasTouchStart);
        this.canvas.removeEventListener('mouseenter', this._boundMouseEnter);
        this.canvas.removeEventListener('mouseleave', this._boundMouseLeave);
        window.removeEventListener('mousemove', this._boundMouseMove);
        window.removeEventListener('mouseup', this._boundMouseUp);
        window.removeEventListener('touchmove', this._boundTouchMove);
        window.removeEventListener('touchend', this._boundTouchEnd);
        window.removeEventListener('touchcancel', this._boundTouchCancel);
        document.removeEventListener('visibilitychange', this._boundVisibilityChange);
        console.log('[EditorGame] All event listeners removed.');

        this.ui?.destroy();
        document.body.style.overflow = '';

        // Restore Canvas to Game Container
        const gameContainer = document.getElementById('game-container');
        if (gameContainer && this.canvas.parentElement !== gameContainer) {
            gameContainer.appendChild(this.canvas);
            this.canvas.style.position = '';
            this.canvas.style.top = '';
            this.canvas.style.left = '';
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            console.log('[EditorGame] Canvas restored to #game-container.');
        }
    }

    private handleTrackHeaderClick(channelIndex: number): void {
        if (this.selectedMeasures.size === 0) {
            return;
        }

        // --- Prevent Leakage ---
        // Before applying, find the next measure after our selection range
        // and "seal" it with its CURRENT inherited primary channel so it doesn't change.
        let maxMeasureIdx = -1;
        this.selectedMeasures.forEach(mIdx => {
            if (mIdx > maxMeasureIdx) maxMeasureIdx = mIdx;
        });

        const nextMeasureIdx = maxMeasureIdx + 1;
        const ppq = this.midiData?.ppq || 480;
        const totalTicks = this.midiData?.durationTicks || 0;
        const maxSongMeasure = Math.ceil(totalTicks / (ppq * 4));

        if (nextMeasureIdx < maxSongMeasure && !this.measureConfig.has(nextMeasureIdx)) {
            // How to find what it was inheriting? We have getMeasurePrimaryChannel inside render,
            // let's define a helper or just do it here.
            let inheritedCh: number | null = null;
            for (let i = nextMeasureIdx; i >= 0; i--) {
                if (this.measureConfig.has(i)) {
                    inheritedCh = this.measureConfig.get(i)!;
                    break;
                }
            }
            if (inheritedCh !== null) {
                this.measureConfig.set(nextMeasureIdx, inheritedCh);
            }
        }

        // Apply channelIndex as primary channel to all selected measures
        this.selectedMeasures.forEach(mIdx => {
            this.measureConfig.set(mIdx, channelIndex);
        });

        this.handleSaveConfig(false);
        this.updateTrackLayout();
        this.render();
    }

    public handleToggleAllMeasures(): void {
        if (!this.midiData) return;
        const ppq = this.midiData.ppq || 480;
        const totalTicks = this.midiData.durationTicks || 0;
        const totalMeasures = Math.ceil(totalTicks / (ppq * 4));

        if (this.selectedMeasures.size >= totalMeasures) {
            // Already all selected, so deselect all
            this.selectedMeasures.clear();
        } else {
            // Select all
            for (let i = 0; i < totalMeasures; i++) {
                this.selectedMeasures.add(i);
            }
        }
        this.render();
    }

    private handleMagicAnalyze(): void {
        if (!this.midiData) return;

        console.log('[EditorGame] Executing Magic Auto-Analyze (Gap Filling)...');
        const autoTrackConfig = MelodyAnalyzer.suggestGapFilling(this.midiData);

        if (autoTrackConfig.size > 0) {
            // Clear current map and apply auto-generated one
            this.measureConfig.clear();
            autoTrackConfig.forEach((tIdx, mIdx) => {
                // [FIX] Map Suggested Track Index back to MIDI Channel Number (0-15)
                // This ensures measureConfig strictly contains Channel indices for the UI & Factory.
                const track = this.midiData!.tracks[tIdx];
                if (track) {
                    this.measureConfig.set(mIdx, track.channel);
                }
            });

            this.handleSaveConfig(false);
            this.updateTrackLayout();
            this.render();
            console.log(`[EditorGame] Magic Analyze complete. Applied ${autoTrackConfig.size} strategic channel assignments.`);
        }
    }
}
