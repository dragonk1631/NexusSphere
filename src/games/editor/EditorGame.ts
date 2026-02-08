import { BaseGame } from '../../core/BaseGame';
import { ASSET_PATHS } from '../../core/asset/AssetRegistry';
import { MidiParser } from '../../core/audio/MidiParser';
import type { ParsedMidi, GameTrack } from '../../core/audio/MidiParser';
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

export class EditorGame extends BaseGame {
    private midiData: ParsedMidi | null = null;
    private ui: EditorUI | null = null;
    private activeTracks: GameTrack[] = [];

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
                const totalHeight = this.activeTracks.length * this.trackHeight;
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

            // Phase 1: Sequencer-First Synchronization
            // UI 트랙 리스트를 시퀀서의 실제 트랙 상태와 강제로 동기화합니다.
            const seqTracks = this.audioEngine.getSequencerTracks();
            if (seqTracks.length > 0) {
                // 시퀀서 정보를 바탕으로 activeTracks 재구성
                this.activeTracks = seqTracks.map((st: any, i: number) => {
                    // 기존 파서 데이터에서 대응하는 트랙 정보 찾기 (이름이나 노트 수 기반)
                    const parsedTrack = this.midiData?.tracks.find(t => t.channel === st.channel && t.name === st.name)
                        || this.midiData?.tracks[i];

                    return {
                        name: st.name || parsedTrack?.name || `Track ${i}`,
                        channel: st.channel,
                        originalIndex: i, // 시퀀서 인덱스를 직접 사용
                        isDrum: st.channel === 9 || (st.name && st.name.toLowerCase().includes('drum')),
                        instrumentFamily: parsedTrack?.instrumentFamily || 'Unknown',
                        noteCount: parsedTrack?.noteCount || 0,
                        notes: parsedTrack?.notes || []
                    };
                });
            } else {
                this.activeTracks = this.midiData.tracks.filter(t => t.noteCount > 0);
            }

            this.originalBpm = this.midiData.bpm;
            this.ui?.setSelectedMidi(name);
            this.ui?.setBpm(this.midiData.bpm);
            this.ui?.setMidiMeta({ name: this.midiData.name });

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

    private updateTrackLayout(): void {
        const container = this.ui?.getTimelineContainer();
        if (container) {
            const h = container.clientHeight - 16;
            this.trackHeight = Math.max(40, h / 10);

            this.activeTracks.forEach((_, i) => {
                if (!this.trackVolumes.has(i)) this.trackVolumes.set(i, 100);
            });

            this.ui?.renderTrackHeaders(this.activeTracks, this.trackHeight, this.soloTrackIndices, this.trackVolumes);
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

        // Phase 1: Robust Muting with MIDI Panic
        this.activeTracks.forEach((track, uiIndex) => {
            let isAudible = false;
            if (hasSolo) {
                if (this.soloTrackIndices.has(uiIndex)) isAudible = true;
            } else {
                if (!this.mutedTrackIndices.has(uiIndex)) isAudible = true;
            }

            const wasAudible = !this.audioEngine.getSequencerTracks()[track.originalIndex]?.userMute;

            // 만약 소리가 들리다가 꺼지는 경우, MIDI Panic을 즉시 호출하여 잔향 제거
            if (wasAudible && !isAudible) {
                this.audioEngine.stopChannelNotes(track.channel);
            }

            this.audioEngine.setTrackMute(track.originalIndex, !isAudible);

            if (isAudible) {
                const vol = this.trackVolumes.get(uiIndex) ?? 100;
                this.audioEngine.setChannelVolume(track.channel, vol);
            }
        });

        // 채널 레벨에서도 이중으로 뮤트 확인 (안정성 강화)
        const audibleChannels = new Set<number>();
        this.activeTracks.forEach((track, uiIndex) => {
            const isAudible = hasSolo ? this.soloTrackIndices.has(uiIndex) : !this.mutedTrackIndices.has(uiIndex);
            if (isAudible) audibleChannels.add(track.channel);
        });

        for (let ch = 0; ch < 16; ch++) {
            const shouldMute = !audibleChannels.has(ch);
            this.audioEngine.setChannelMute(ch, shouldMute);
            if (shouldMute) this.audioEngine.stopChannelNotes(ch);
        }

        console.log(`[Phase 1] Sync Complete. Solos: ${hasSolo}, Mutes: ${this.mutedTrackIndices.size}`);
    }

    private syncViewport(time: number, forceCenter: boolean = false): void {
        if (!this.midiData) return;
        const playheadX = time * 1000 * this.zoomX;
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

    private handleTrackVolume(index: number, volume: number): void {
        this.trackVolumes.set(index, volume);
        const track = this.activeTracks[index];
        if (track) {
            this.audioEngine.setChannelVolume(track.channel, volume);
        }
        this.ui?.updateTrackVolumeUI(index, volume);
    }



    private handleWheel(e: WheelEvent): void {
        e.preventDefault();
        if (e.ctrlKey) {
            this.zoomX = Math.max(0.01, Math.min(0.19, this.zoomX - e.deltaY * 0.0001));
        } else if (e.shiftKey) {
            // Horizontal scroll via shift+wheel could be added here
        } else {
            const trackCount = this.activeTracks.length;
            const totalHeight = trackCount * this.trackHeight;
            const maxScroll = Math.max(0, totalHeight - this.canvas.height);
            this.scrollY = Math.max(0, Math.min(maxScroll, this.scrollY + e.deltaY));
            this.ui?.syncTrackScroll(this.scrollY);
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
        const time = (mouseX + this.scrollX) / this.zoomX / 1000;
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
                this.ui.syncControls(
                    this.zoomX,
                    this.scrollY / (Math.max(1, this.activeTracks.length) * this.trackHeight)
                );
            }
        }

        this.render();
    }

    private render(): void {
        this.ctx.fillStyle = '#0a0a0a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const trackCount = this.activeTracks.length;
        const displayTrackCount = Math.max(10, trackCount);
        const startTrack = Math.max(0, Math.floor(this.scrollY / this.trackHeight));
        const endTrack = Math.min(displayTrackCount, startTrack + Math.ceil(this.canvas.height / this.trackHeight) + 1);

        // Zebra Striping on Canvas
        for (let i = startTrack; i < endTrack; i++) {
            const trackTop = i * this.trackHeight - this.scrollY;
            if (i % 2 === 1) {
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
                this.ctx.fillRect(0, trackTop, this.canvas.width, this.trackHeight);
            }
        }

        // Grid
        const pixelsPerBeat = 500 * this.zoomX;
        const startBeat = Math.floor(this.scrollX / pixelsPerBeat);
        const endBeat = startBeat + Math.ceil(this.canvas.width / pixelsPerBeat) + 1;

        this.ctx.lineWidth = 1;
        for (let b = startBeat; b <= endBeat; b++) {
            const x = b * pixelsPerBeat - this.scrollX;
            const isBar = b % 4 === 0;
            this.ctx.strokeStyle = isBar ? '#444' : '#222';
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();

            if (isBar) {
                this.ctx.fillStyle = '#666';
                this.ctx.font = '9px monospace';
                this.ctx.fillText((b / 4 + 1).toString(), x + 4, 12);
            }
        }

        // Horizontal Grid Lines
        this.ctx.strokeStyle = '#1a1a1a';
        this.ctx.beginPath();
        for (let i = startTrack; i <= endTrack; i++) {
            const y = i * this.trackHeight - this.scrollY;
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
        }
        this.ctx.stroke();

        // Notes & Solo Highlighting
        const getTrackNoteColor = (track: GameTrack) => {
            if (track.isDrum) return '#bdc3c7'; // Silver/Grey
            const family = track.instrumentFamily.toLowerCase();
            if (family.includes('piano')) return '#ffcc00'; // Yellow
            if (family.includes('guitar') || family.includes('bass')) return '#3498db'; // Azure
            if (family.includes('strings') || family.includes('ensemble')) return '#a29bfe'; // Purple
            if (family.includes('brass') || family.includes('reed') || family.includes('pipe')) return '#e17055'; // Coral
            if (family.includes('synth')) return '#55efc4'; // Mint
            return '#00d1b2'; // Teal
        };

        for (let i = startTrack; i < endTrack; i++) {
            const track = this.activeTracks[i];
            const trackTop = i * this.trackHeight - this.scrollY;
            const isSoloed = this.soloTrackIndices.has(i);

            const hasAnySolo = this.soloTrackIndices.size > 0;

            // Highlight Soloed Track Row
            if (isSoloed) {
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
                this.ctx.fillRect(0, trackTop, this.canvas.width, this.trackHeight);

                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(0, trackTop, this.canvas.width, this.trackHeight);
            }

            // Alpha logic: Solo takes priority
            if (hasAnySolo && !isSoloed) {
                this.ctx.globalAlpha = 0.15;
            } else {
                this.ctx.globalAlpha = 1.0;
            }

            if (track) {
                const noteColor = getTrackNoteColor(track);

                track.notes.forEach(note => {
                    const x = (note.time * 1000) * this.zoomX - this.scrollX;
                    const w = Math.max(4, (note.duration * 1000) * this.zoomX);
                    if (x + w < 0 || x > this.canvas.width) return;

                    // Visualization
                    const effectiveMidi = Math.min(108, Math.max(21, note.midi));
                    const pitchNorm = 1 - (Math.min(96, Math.max(36, effectiveMidi)) - 36) / 60;
                    const y = trackTop + 6 + pitchNorm * (this.trackHeight - 16);
                    const h = 5;

                    this.ctx.fillStyle = noteColor;
                    this.ctx.fillRect(x, y, w, h);

                    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                    this.ctx.fillRect(x, y, w, 1);
                });
            }
            this.ctx.globalAlpha = 1.0;
        }

        // Playhead
        const displayTime = this.isDraggingPlayhead ? this.scrubTime : this.audioEngine.currentTime;
        const playheadX = (displayTime * 1000) * this.zoomX - this.scrollX;
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
