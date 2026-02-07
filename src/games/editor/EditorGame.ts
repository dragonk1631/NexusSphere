import { BaseGame } from '../../core/BaseGame';
import { ASSET_PATHS } from '../../core/asset/AssetRegistry';
import { MidiParser } from '../../core/audio/MidiParser';
import type { ParsedMidi, GameTrack } from '../../core/audio/MidiParser';
import { EditorUI } from './EditorUI';

const MIDI_FILES = [
    'assets/audio/midi/test.mid',
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

    constructor(canvas: HTMLCanvasElement) {
        super(canvas);
    }

    public async init(): Promise<void> {
        this.ui = new EditorUI(
            (action) => this.handleTransport(action),
            (idx, mute) => this.handleMute(idx, mute),
            (idx, solo) => this.handleSolo(idx, solo),
            (zoom) => { this.zoomX = zoom; },
            (scrollXPercent) => {
                if (this.midiData) {
                    const totalWidth = (this.midiData.duration * 1000) * this.zoomX;
                    this.scrollX = scrollXPercent * Math.max(0, totalWidth - this.canvas.width);
                }
            },
            (scrollYPercent) => {
                const totalHeight = this.activeTracks.length * this.trackHeight;
                this.scrollY = scrollYPercent * Math.max(0, totalHeight - this.canvas.height);
            },
            (filename, file) => this.loadMidiFile(filename, file),
            (files) => this.handleFolderSelect(files),
            () => this.handleRefresh(),
            (bpm) => this.handleBpmChange(bpm),
            (percent) => this.seekToPercent(percent),
            (vol) => this.audioEngine.setMasterVolume(vol),
            (setting, active) => {
                if (setting === 'loop') this.isLooping = active;
                if (setting === 'metronome') this.metronomeEnabled = active;
            },
            (idx, vol) => this.handleTrackVolume(idx, vol)
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
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mouseenter', () => document.body.style.overflow = 'hidden');
        this.canvas.addEventListener('mouseleave', () => document.body.style.overflow = '');
    }

    public async load(): Promise<void> {
        await this.audioEngine.init(ASSET_PATHS.AUDIO.SOUNDFONTS.DEFAULT);

        // Disable manual scroll on track list panel to ensure sync
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
        // Browser won't refresh FileList automatically.
        // We must re-trigger the picker to get new files.
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

            this.activeTracks = this.midiData.tracks.filter(t => t.noteCount > 0);
            this.originalBpm = this.midiData.bpm;
            this.ui?.setSelectedMidi(name);
            this.ui?.setBpm(this.midiData.bpm);
            this.ui?.setMidiMeta({ name: this.midiData.name });

            this.updateTrackLayout();
            this.syncAudioStates(); // Reset audio states for new file

            this.scrollX = 0;
            this.scrollY = 0;
            this.isPlaying = false;
            this.soloTrackIndices.clear();
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

            // Ensure volumes are initialized for current tracks
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
            console.log(`[EditorGame] BPM changed to: ${bpm} (Rate: ${rate.toFixed(2)})`);
        }
    }

    private syncAudioStates(): void {
        if (!this.audioEngine) return;

        const hasSolo = this.soloTrackIndices.size > 0;
        const seqTracks = this.audioEngine.getSequencerTracks();
        const SANDBOX_CHANNEL = 15;

        // 1. UI 트랙(activeTracks)을 시퀀서 실제 트랙 인덱스에 매핑 (이름 기반 정밀 매핑)
        const uiToSeqMap = new Map<number, number>(); // uiIndex -> seqIndex
        this.activeTracks.forEach((uiTrack, uiIndex) => {
            // 이름과 채널이 일치하는 시퀀서 트랙 탐색
            const seqIndex = seqTracks.findIndex((st: any) =>
                st.name === uiTrack.name && st.channel === uiTrack.channel
            );

            // 만약 이름 기반 탐색 실패시 originalIndex 사용 (정밀 매핑 실패 대비)
            const finalSeqIndex = seqIndex !== -1 ? seqIndex : uiTrack.originalIndex;
            uiToSeqMap.set(uiIndex, finalSeqIndex);
        });

        // 2. 가시성(Audibility) 판단 및 채널 상태 수집
        const audibleTracks = new Set<number>(); // uiIndices
        const channelsWithAudibleTracks = new Set<number>();

        this.activeTracks.forEach((track, uiIndex) => {
            let isAudible = false;
            if (hasSolo) {
                if (this.soloTrackIndices.has(uiIndex)) isAudible = true;
            } else {
                if (!this.mutedTrackIndices.has(uiIndex)) isAudible = true;
            }

            if (isAudible) {
                audibleTracks.add(uiIndex);
                channelsWithAudibleTracks.add(track.channel);
            }
        });

        // 3. 트랙별 물리적 처리 (뮤트 + 채널 샌드박싱)
        this.activeTracks.forEach((uiTrack, uiIndex) => {
            const seqIndex = uiToSeqMap.get(uiIndex)!;
            const isAudible = audibleTracks.has(uiIndex);

            if (isAudible) {
                // [Audible] 원본 채널 복구 및 뮤트 해제
                this.audioEngine.reassignTrackChannel(seqIndex, uiTrack.channel);
                this.audioEngine.setTrackMute(seqIndex, false);

                // 트랙별 볼륨 설정
                const vol = this.trackVolumes.get(uiIndex) ?? 100;
                this.audioEngine.setChannelVolume(uiTrack.channel, vol);
            } else {
                // [Muted] 
                // 만약 이 트랙이 현재 들려야 하는 트랙과 채널을 공유한다면 샌드박스로 격리
                if (channelsWithAudibleTracks.has(uiTrack.channel)) {
                    this.audioEngine.reassignTrackChannel(seqIndex, SANDBOX_CHANNEL);
                } else {
                    // 공유하지 않는다면 원본 채널 유지 (어차피 채널 자체가 뮤트될 것임)
                    this.audioEngine.reassignTrackChannel(seqIndex, uiTrack.channel);
                }

                // 트랙 레벨 뮤트 적용
                this.audioEngine.setTrackMute(seqIndex, true);
            }
        });

        // 4. 채널 레벨 방어막 (샌드박스 채널 포함)
        for (let ch = 0; ch < 16; ch++) {
            const isChannelInAudibleSet = channelsWithAudibleTracks.has(ch);
            const isSandbox = (ch === SANDBOX_CHANNEL);

            // 들리는 트랙이 하나도 없는 채널이거나, 샌드박스 채널이면 완전 차단
            const shouldMuteChannel = !isChannelInAudibleSet || isSandbox;
            this.audioEngine.setChannelMute(ch, shouldMuteChannel);

            // Note: Volume is already set per-track in Step 3 for audible tracks.
            // If the channel is muted, it shouldn't produce sound regardless of CC7.
        }

        console.log(`[EditorGame] Sync Done. Solos: ${hasSolo}. Channels Active:`, Array.from(channelsWithAudibleTracks));
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
                this.scrollX = 0;
                break;
            case 'end':
                if (this.midiData) {
                    this.audioEngine.seek(this.midiData.duration - 0.1);
                    this.syncAudioStates();
                }
                break;
        }
    }

    private seekToPercent(percent: number): void {
        if (this.midiData) {
            this.audioEngine.seek(percent * this.midiData.duration);
            this.syncAudioStates();
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

        // [Optimization] skip full sync and layout update for volume changes
        const track = this.activeTracks[index];
        if (track) {
            this.audioEngine.setChannelVolume(track.channel, volume);
        }

        this.ui?.updateTrackVolumeUI(index, volume);
    }

    private handleWheel(e: WheelEvent): void {
        e.preventDefault();
        if (e.ctrlKey) {
            this.zoomX = Math.max(0.02, Math.min(2.0, this.zoomX - e.deltaY * 0.0003));
        } else if (e.shiftKey) {
            this.scrollX = Math.max(0, Math.min(Math.max(0, (this.midiData?.duration || 0) * 1000 * this.zoomX - this.canvas.width), this.scrollX + e.deltaY * 2));
        } else {
            const trackCount = Math.max(10, this.activeTracks.length);
            const totalHeight = trackCount * this.trackHeight;
            this.scrollY = Math.max(0, Math.min(Math.max(0, totalHeight - this.canvas.height), this.scrollY + e.deltaY));
            this.ui?.syncTrackScroll(this.scrollY);
        }
    }

    private handleMouseDown(e: MouseEvent): void {
        const rect = this.canvas.getBoundingClientRect();
        const time = (e.clientX - rect.left + this.scrollX) / this.zoomX / 1000;
        if (time >= 0 && time <= (this.midiData?.duration || 0)) {
            this.audioEngine.seek(time);
            this.syncAudioStates();
        }
    }

    public update(_delta: number): void {
        const duration = this.audioEngine.duration;
        const currentTime = this.audioEngine.currentTime;
        this.ui?.updateProgress(currentTime, duration);

        if (currentTime >= duration && this.isPlaying) {
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
            const playheadX = currentTime * 1000 * this.zoomX;
            if (playheadX > this.scrollX + this.canvas.width * 0.9) {
                this.scrollX = playheadX - this.canvas.width * 0.2;
            }
        }

        if (this.midiData && this.ui) {
            const totalWidth = (this.midiData.duration * 1000) * this.zoomX;
            const maxScrollX = Math.max(1, totalWidth - this.canvas.width);
            const totalH = Math.max(10, this.activeTracks.length) * this.trackHeight;
            const maxScrollY = Math.max(1, totalH - this.canvas.height);
            this.ui.syncControls(this.zoomX, this.scrollX / maxScrollX, this.scrollY / maxScrollY);
        }

        this.render();
    }

    private render(): void {
        this.ctx.fillStyle = '#111';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const trackCount = this.activeTracks.length;
        const displayTrackCount = Math.max(10, trackCount);
        const startTrack = Math.max(0, Math.floor(this.scrollY / this.trackHeight));
        const endTrack = Math.min(displayTrackCount, startTrack + Math.ceil(this.canvas.height / this.trackHeight) + 1);

        // Grid
        const gridEndTrack = Math.max(displayTrackCount, endTrack);
        this.ctx.strokeStyle = '#222';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        for (let i = startTrack; i <= gridEndTrack; i++) {
            const y = i * this.trackHeight - this.scrollY;
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
        }
        const pixelsPerBeat = 500 * this.zoomX;
        const startBeat = Math.floor(this.scrollX / pixelsPerBeat);
        const endBeat = startBeat + Math.ceil(this.canvas.width / pixelsPerBeat) + 1;
        for (let b = startBeat; b <= endBeat; b++) {
            const x = b * pixelsPerBeat - this.scrollX;
            this.ctx.strokeStyle = (b % 4 === 0) ? '#333' : '#222';
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
        }
        this.ctx.stroke();

        // Notes
        const trackColors = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#a29bfe', '#fd79a8', '#55efc4', '#74b9ff', '#ffeaa7'];
        for (let i = startTrack; i < endTrack; i++) {
            const track = this.activeTracks[i];
            const trackTop = i * this.trackHeight - this.scrollY;
            if (i % 2 === 1) {
                this.ctx.fillStyle = 'rgba(255,255,255,0.03)';
                this.ctx.fillRect(0, trackTop, this.canvas.width, this.trackHeight);
            }
            this.ctx.fillStyle = trackColors[i % trackColors.length];
            if (this.soloTrackIndices.size > 0 && !this.soloTrackIndices.has(i)) this.ctx.globalAlpha = 0.2;
            else this.ctx.globalAlpha = 1.0;

            if (track) {
                track.notes.forEach(note => {
                    const x = (note.time * 1000) * this.zoomX - this.scrollX;
                    const w = Math.max(3, (note.duration * 1000) * this.zoomX);
                    if (x + w < 0 || x > this.canvas.width) return;
                    const pitchNorm = 1 - (Math.min(96, Math.max(36, note.midi)) - 36) / 60;
                    this.ctx.fillRect(x, trackTop + 4 + pitchNorm * (this.trackHeight - 12), w, 6);
                });
            }
            this.ctx.globalAlpha = 1.0;
        }

        // Playhead
        const playheadX = (this.audioEngine.currentTime * 1000) * this.zoomX - this.scrollX;
        if (playheadX >= 0 && playheadX <= this.canvas.width) {
            this.ctx.strokeStyle = '#00ffcc';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(playheadX, 0);
            this.ctx.lineTo(playheadX, this.canvas.height);
            this.ctx.stroke();
            this.ctx.fillStyle = '#00ffcc';
            this.ctx.beginPath();
            this.ctx.moveTo(playheadX - 6, 0);
            this.ctx.lineTo(playheadX + 6, 0);
            this.ctx.lineTo(playheadX, 10);
            this.ctx.fill();
        }
    }

    public destroy(): void {
        this.audioEngine.stop();
        this.isPlaying = false;
        this.ui?.destroy();
        document.body.style.overflow = '';
    }
}
