import { BaseGame } from '../../core/BaseGame';
import { ASSET_PATHS } from '../../core/asset/AssetRegistry';
import { MidiParser } from '../../core/audio/MidiParser';
import type { ParsedMidi, GameNote } from '../../core/audio/MidiParser';
import { EditorUI } from './EditorUI';

const MIDI_FILES = [
    'assets/audio/midi/BL_popntwin_level7.mid',
    'assets/audio/midi/Bloody_Tears.mid',
    'assets/audio/midi/BublBobl_RK.mid',
    'assets/audio/midi/CV1-_Vampire_Killer.mid',
    'assets/audio/midi/Cammy_s.mid',
    "assets/audio/midi/DOOM - Robert C. Prince - E1M1 - At Doom's Gate.mid",
    'assets/audio/midi/DanceofGold.mid',
    'assets/audio/midi/DarkWoods.mid',
    'assets/audio/midi/ENIX_-_Dragon_Warrior_3_(_Overworld_BGM_).mid',
    'assets/audio/midi/FF6_The_Fierce_Battle_Xg.mid',
    'assets/audio/midi/Fighting.mid',
    'assets/audio/midi/GM01.mid',
    'assets/audio/midi/GM02.mid',
    'assets/audio/midi/GM03.mid',
    'assets/audio/midi/GM04.mid',
    'assets/audio/midi/GM05.mid',
    'assets/audio/midi/GM06.mid',
    'assets/audio/midi/GM07.mid',
    'assets/audio/midi/GM08.mid',
    'assets/audio/midi/GM09.mid',
    'assets/audio/midi/GM10.mid',
    'assets/audio/midi/GM11.mid',
    'assets/audio/midi/GokujyoParodius_Stage1.mid',
    'assets/audio/midi/GokujyoParodius_Stage2.mid',
    'assets/audio/midi/GokujyoParodius_Stage4.mid',
    'assets/audio/midi/GokujyoParodius_StageSpecial.mid',
    'assets/audio/midi/Human1gm.mid',
    'assets/audio/midi/Human2gm.mid',
    'assets/audio/midi/HyruleCastlePunkRockRemix.mid',
    'assets/audio/midi/IoGtown.mid',
    'assets/audio/midi/Ken2.mid',
    'assets/audio/midi/One-Winged_Angel.mid',
    'assets/audio/midi/PNTB_l41.mid',
    'assets/audio/midi/Parodius_-_Twinbees_Theme.mid',
    "assets/audio/midi/Pirates of the Caribbean - He's a Pirate (1).mid",
    'assets/audio/midi/Rage Against the Machine - Killing in the Name Of.mid',
    'assets/audio/midi/SMWTHEME.mid',
    'assets/audio/midi/Save_Them.mid',
    'assets/audio/midi/Stage00000.mid',
    'assets/audio/midi/Stage00001.mid',
    'assets/audio/midi/Stage00002.mid',
    'assets/audio/midi/Stage00003.mid',
    'assets/audio/midi/Stage00004.mid',
    'assets/audio/midi/Stage00005.mid',
    'assets/audio/midi/Stage00006.mid',
    'assets/audio/midi/Stage00007.mid',
    'assets/audio/midi/Stage00008.mid',
    'assets/audio/midi/Stage00009.mid',
    'assets/audio/midi/Stage00010.mid',
    'assets/audio/midi/Stage00011.mid',
    'assets/audio/midi/Stage00012.mid',
    'assets/audio/midi/Starcraft - Terran Theme 03 MIDI.mid',
    'assets/audio/midi/Still_More_Fighting.mid',
    'assets/audio/midi/Terranigma_-_Terranigma_-_Underworld.mid',
    'assets/audio/midi/Theme_of_Simon.mid',
    'assets/audio/midi/Trisection-1.mid',
    'assets/audio/midi/VP_BTL1.mid',
    'assets/audio/midi/Videogame_Tune_-_Ghouls_and_Ghosts_-_Level_1.mid',
    'assets/audio/midi/Wicked_Child_1.mid',
    'assets/audio/midi/Wicked_Child_DMC.mid',
    'assets/audio/midi/World1-1_Allstars.mid',
    'assets/audio/midi/Z3LightWorldDungeon_RockRemix.mid',
    'assets/audio/midi/Zenkusa_-_PopnTwinbee_Level2.mid',
    'assets/audio/midi/Zenkusa_-_PopnTwinbee_Level5.mid',
    'assets/audio/midi/ballade-pour-adeline.mid',
    'assets/audio/midi/begining.mid',
    'assets/audio/midi/ccoverworld2.mid',
    'assets/audio/midi/corazonazul_ff6boss.mid',
    'assets/audio/midi/cv5stg7c.mid',
    'assets/audio/midi/dw3_bt1.mid',
    'assets/audio/midi/dw5_town.mid',
    'assets/audio/midi/exryu.mid',
    'assets/audio/midi/fe3_main.mid',
    'assets/audio/midi/ff2bsbtl.mid',
    'assets/audio/midi/ff6_zozo_v2.mid',
    'assets/audio/midi/fft_211.mid',
    'assets/audio/midi/fft_apoplexy.mid',
    'assets/audio/midi/fftactics-midi_Chapel.mid',
    'assets/audio/midi/gtgm.mid',
    'assets/audio/midi/kefka.mid',
    'assets/audio/midi/livealive-killingfield.mid',
    'assets/audio/midi/melodies_of_life.mid',
    'assets/audio/midi/olrox.mid',
    'assets/audio/midi/overworld.mid',
    'assets/audio/midi/popntwinbee-staffroll.mid',
    'assets/audio/midi/popntwinbee-stage3.mid',
    'assets/audio/midi/popntwinbee-stage6.mid',
    'assets/audio/midi/requiem_02_[unknown].mid',
    'assets/audio/midi/ryusfa2mix.MID',
    'assets/audio/midi/sfa2ken.mid',
    'assets/audio/midi/sfa2saku.mid',
    'assets/audio/midi/sfa2zang.mid',
    'assets/audio/midi/som_maintheme.mid',
    'assets/audio/midi/stage00013.mid',
    'assets/audio/midi/stage00014.mid',
    'assets/audio/midi/stage00015.mid',
    'assets/audio/midi/sti1.mid',
    'assets/audio/midi/super_mario_world_pops_remix.mid',
    'assets/audio/midi/supertwinbeestage1.mid',
    'assets/audio/midi/t_ogre15.mid',
    'assets/audio/midi/teso_01.mid',
    'assets/audio/midi/teso_02.mid',
    'assets/audio/midi/test.mid',
    'assets/audio/midi/waopen.mid',
    'assets/audio/midi/wins1.mid',
    'assets/audio/midi/z3boss.mid',
    'assets/audio/midi/z3lightw.mid',
    'assets/audio/midi/zb_smw_rockroll2.mid',
    'assets/audio/midi/백조의호수.mid',
    'assets/audio/midi/에어울프.mid',
    'assets/audio/midi/터키행진곡.mid',
];

interface ChannelData {
    channel: number;
    notes: GameNote[];
    trackNames: string[];
    instrumentFamily: string;
    isDrum: boolean;
}

export class EditorGame extends BaseGame {
    private midiData: ParsedMidi | null = null;
    private ui: EditorUI | null = null;

    // Channel-Based Data Structure (16 MIDI Channels)
    private channelData: ChannelData[] = [];

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

    constructor(canvas: HTMLCanvasElement) {
        super(canvas);
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
            }
        );
        this.ui.init();
        this.ui.populateMidiSelector(MIDI_FILES);

        const container = this.ui.getTimelineContainer();
        if (container) {
            container.appendChild(this.canvas);
            this.canvas.style.position = 'absolute';
            this.canvas.style.top = '0';
            this.canvas.style.left = '0';
            this.canvas.width = container.clientWidth - 16;
            this.canvas.height = container.clientHeight - 16;

            new ResizeObserver(() => {
                this.canvas.width = container.clientWidth - 16;
                this.canvas.height = container.clientHeight - 16;
                this.updateTrackLayout();

                // Clamp scrollY after resize to prevent out-of-bounds
                const totalHeight = 16 * this.trackHeight;
                const maxScroll = Math.max(0, totalHeight - this.canvas.height);
                this.scrollY = Math.max(0, Math.min(maxScroll, this.scrollY));
            }).observe(container);
        }

        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });

        // Mouse Events
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        window.addEventListener('mouseup', () => this.handleMouseUp());

        // Touch Events (Fixed: Mobile support)
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault(); // Prevent scrolling
            this.handleMouseDown(e);
        }, { passive: false });

        window.addEventListener('touchmove', (e) => {
            if (this.isDraggingPlayhead) {
                e.preventDefault();
                this.handleMouseMove(e);
            }
        }, { passive: false });

        window.addEventListener('touchend', () => this.handleMouseUp());
        window.addEventListener('touchcancel', () => this.handleMouseUp());

        this.canvas.addEventListener('mouseenter', () => document.body.style.overflow = 'hidden');
        this.canvas.addEventListener('mouseleave', () => document.body.style.overflow = '');

        // Prevent sleep on mobile
        this.requestWakeLock();
        document.addEventListener('visibilitychange', () => {
            if (this.wakeLock !== null && document.visibilityState === 'visible') {
                this.requestWakeLock();
            }
        });
    }

    public async load(): Promise<void> {
        await this.audioEngine.init(ASSET_PATHS.AUDIO.SOUNDFONTS.DEFAULT);

        const trackPanel = document.getElementById('track-list-panel');
        if (trackPanel) {
            trackPanel.style.overflowY = 'hidden';
            trackPanel.style.pointerEvents = 'auto';
        }

        if (MIDI_FILES.length > 0) {
            await this.loadMidiFile(MIDI_FILES[0]);
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

    private async loadMidiFile(name: string, file?: File): Promise<void> {
        try {
            let buffer: ArrayBuffer;
            if (file) {
                buffer = await file.arrayBuffer();
            } else {
                const res = await fetch(name);
                buffer = await res.arrayBuffer();
            }

            const parser = new MidiParser();
            this.midiData = await parser.parse(buffer);
            await this.audioEngine.loadMidi(buffer);

            // Phase 1: Sequencer-First Synchronization - (REMOVED: activeTracks unused)
            // The sequencer logic is now handled via channelData aggregation below.

            this.originalBpm = this.midiData.bpm;
            this.ui?.setSelectedMidi(name);
            this.ui?.setBpm(this.midiData.bpm);
            this.ui?.setMidiMeta({ name: this.midiData.name });

            // Channel-Based Data Aggregation
            this.aggregateChannelData();

            this.updateTrackLayout();
            this.syncAudioStates();

            this.scrollX = 0;
            this.scrollY = 0;
            this.isPlaying = false;
            this.soloTrackIndices.clear();
            this.mutedTrackIndices.clear();
            this.audioEngine.stop();
            this.ui?.setPlayState(false);
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
            const ch = track.channel;
            if (ch >= 0 && ch < 16) {
                // Add all notes from this track to the channel
                this.channelData[ch].notes.push(...track.notes);

                // Track which track names contribute to this channel
                if (track.name && !this.channelData[ch].trackNames.includes(track.name)) {
                    this.channelData[ch].trackNames.push(track.name);
                }

                // Update instrument family (prefer non-drum instruments for non-channel-9)
                if (track.noteCount > 0) {
                    if (ch === 9) {
                        this.channelData[ch].instrumentFamily = 'Drums';
                        this.channelData[ch].isDrum = true;
                    } else if (this.channelData[ch].instrumentFamily === 'Unknown' ||
                        this.channelData[ch].notes.length < track.notes.length) {
                        this.channelData[ch].instrumentFamily = track.instrumentFamily;
                    }
                }
            }
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
            this.trackHeight = Math.floor(Math.max(40, h / 16)); // Fixed: Integer pixels to align with DOM

            // Initialize volumes for all 16 channels
            for (let ch = 0; ch < 16; ch++) {
                if (!this.trackVolumes.has(ch)) this.trackVolumes.set(ch, 100);
            }

            // Render 16 fixed channel headers
            this.ui?.renderChannelHeaders(this.channelData, this.trackHeight, this.soloTrackIndices, this.trackVolumes);
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

        // Channel-Based Audio Control (Direct MIDI Channel Mute/Solo)
        for (let ch = 0; ch < 16; ch++) {
            let isAudible = false;

            if (hasSolo) {
                // Solo mode: only soloed channels are audible
                isAudible = this.soloTrackIndices.has(ch);
            } else {
                // Normal mode: all non-muted channels are audible
                isAudible = !this.mutedTrackIndices.has(ch);
            }

            // Apply channel mute
            this.audioEngine.setChannelMute(ch, !isAudible);

            // MIDI Panic on mute to prevent hanging notes
            if (!isAudible) {
                this.audioEngine.stopChannelNotes(ch);
            }

            // Apply channel volume if audible
            if (isAudible) {
                const vol = this.trackVolumes.get(ch) ?? 100;
                this.audioEngine.setChannelVolume(ch, vol);
            }
        }

        console.log(`[Channel-Based Sync] Solos: ${hasSolo}, Active Channels: ${Array.from({ length: 16 }, (_, i) => i).filter(ch => hasSolo ? this.soloTrackIndices.has(ch) : !this.mutedTrackIndices.has(ch))}`);
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
                }
                this.ui?.setPlayState(this.isPlaying);
                break;
            case 'stop':
                this.audioEngine.stop();
                this.isPlaying = false;
                this.scrollX = 0;
                this.ui?.setPlayState(false);
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



    private handleWheel(e: WheelEvent): void {
        e.preventDefault();
        if (e.ctrlKey) {
            this.zoomX = Math.max(0.01, Math.min(0.19, this.zoomX - e.deltaY * 0.0001));
        } else if (e.shiftKey) {
            // Horizontal scroll via shift+wheel could be added here
        } else {
            // Fixed 16 channels for scroll calculation
            const totalHeight = 16 * this.trackHeight;
            const maxScroll = Math.max(0, totalHeight - this.canvas.height);
            this.scrollY = Math.max(0, Math.min(maxScroll, this.scrollY + e.deltaY));
            this.ui?.syncTrackScroll(this.scrollY);

            // Fixed: Sync scrollbar UI when scrolling with wheel
            if (maxScroll > 1) {
                this.ui?.syncControls(this.zoomX, this.scrollY / maxScroll);
            }
        }
    }

    private handleMouseDown(e: MouseEvent | TouchEvent): void {
        this.isDraggingPlayhead = true;
        this.audioEngine.pause();
        this.ui?.setPlayState(false);
        this.isPlaying = false;
        this.scrubTime = this.audioEngine.currentTime;
        this.seekAtMouse(e, false);
    }

    private handleMouseMove(e: MouseEvent | TouchEvent): void {
        if (this.isDraggingPlayhead) {
            this.seekAtMouse(e);
        }
    }

    private handleMouseUp(): void {
        if (this.isDraggingPlayhead) {
            this.isDraggingPlayhead = false;

            // Final seek on release to ensure engine is exactly at scrubTime
            this.audioEngine.seek(this.scrubTime);
            this.syncAudioStates();

            // 2. Play on release as requested
            this.audioEngine.resume().then(() => {
                this.audioEngine.play();
                this.isPlaying = true;
                this.ui?.setPlayState(true);
            });
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

    public update(_delta: number): void {
        const duration = this.audioEngine.duration;
        const currentTime = this.isDraggingPlayhead ? this.scrubTime : this.audioEngine.currentTime;
        this.ui?.updateProgress(currentTime, duration);

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
                const totalHeight = 16 * this.trackHeight;
                const maxScroll = Math.max(1, totalHeight - this.canvas.height);
                // Correct percentage: scrollY relative to scrollable range, not total height
                const scrollPercent = this.scrollY / maxScroll;
                this.ui.syncControls(this.zoomX, scrollPercent);
            }
        }

        this.render();
    }

    private render(): void {
        this.ctx.fillStyle = '#0a0a0a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Fixed 16 channels (0-15)
        const channelCount = 16;
        const startChannel = Math.max(0, Math.floor(this.scrollY / this.trackHeight));
        const endChannel = Math.min(channelCount, startChannel + Math.ceil(this.canvas.height / this.trackHeight) + 1);

        // Zebra Striping on Canvas
        for (let i = startChannel; i < endChannel; i++) {
            const channelTop = i * this.trackHeight - this.scrollY;
            if (i % 2 === 1) {
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
                this.ctx.fillRect(0, channelTop, this.canvas.width, this.trackHeight);
            }
        }

        // Grid
        // Grid (Tick-based)
        const ppq = this.midiData?.ppq || 480;
        const pixelsPerProcessedTick = this.zoomX;
        const startTick = Math.floor(this.scrollX / pixelsPerProcessedTick);
        const endTick = startTick + Math.ceil(this.canvas.width / pixelsPerProcessedTick) + 1;

        // Snap startTick to nearest beat (assuming 4/4)
        const tickStep = ppq; // 1 beat
        const alignedStartTick = Math.floor(startTick / tickStep) * tickStep;

        this.ctx.lineWidth = 1;
        for (let t = alignedStartTick; t <= endTick; t += tickStep) {
            const x = t * pixelsPerProcessedTick - this.scrollX;
            const isBar = (t / ppq) % 4 === 0; // Assuming 4/4
            this.ctx.strokeStyle = isBar ? '#444' : '#222';
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();

            if (isBar) {
                this.ctx.fillStyle = '#666';
                this.ctx.font = '9px monospace';
                const barNum = Math.round(t / (ppq * 4)) + 1;
                this.ctx.fillText(barNum.toString(), x + 4, 12);
            }
        }

        // Horizontal Grid Lines
        this.ctx.strokeStyle = '#1a1a1a';
        this.ctx.beginPath();
        for (let i = startChannel; i <= endChannel; i++) {
            const y = i * this.trackHeight - this.scrollY;
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
        }
        this.ctx.stroke();

        // Notes & Solo Highlighting (Channel-Based)
        const getChannelNoteColor = (channel: any) => {
            if (channel.isDrum) return '#bdc3c7'; // Silver/Grey
            const family = channel.instrumentFamily.toLowerCase();
            if (family.includes('piano')) return '#ffcc00'; // Yellow
            if (family.includes('guitar') || family.includes('bass')) return '#3498db'; // Azure
            if (family.includes('strings') || family.includes('ensemble')) return '#a29bfe'; // Purple
            if (family.includes('brass') || family.includes('reed') || family.includes('pipe')) return '#e17055'; // Coral
            if (family.includes('synth')) return '#55efc4'; // Mint
            return '#00d1b2'; // Teal
        };

        for (let ch = startChannel; ch < endChannel; ch++) {
            const channelInfo = this.channelData[ch];
            if (!channelInfo) continue;

            const channelTop = ch * this.trackHeight - this.scrollY;
            const isSoloed = this.soloTrackIndices.has(ch);

            const hasAnySolo = this.soloTrackIndices.size > 0;

            // Highlight Soloed Channel Row
            if (isSoloed) {
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
                this.ctx.fillRect(0, channelTop, this.canvas.width, this.trackHeight);

                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
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
                const noteColor = getChannelNoteColor(channelInfo);

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

                    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                    this.ctx.fillRect(x, y, w, 1);
                });
            }
            this.ctx.globalAlpha = 1.0;
        }

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
        this.releaseWakeLock();
        this.audioEngine.stop();
        this.isPlaying = false;
        this.ui?.destroy();
        document.body.style.overflow = '';
    }
}
