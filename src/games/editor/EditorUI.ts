import { UIManager } from '../../core/ui/UIManager';
import type { GameTrack } from '../../core/audio/MidiParser';

export class EditorUI {
    private uiManager: UIManager;
    private container: HTMLElement | null = null;
    private trackListPanel: HTMLElement | null = null;

    private onTransportClick: (action: string) => void;
    private onTrackMute: (trackIndex: number, muted: boolean) => void;
    private onTrackSolo: (trackIndex: number, soloed: boolean) => void;
    private onZoomChange: (level: number) => void;
    private onScrollXChange: (percent: number) => void;
    private onScrollYChange: (percent: number) => void;
    private onFileSelect: (filename: string, file?: File) => void;
    private onFolderSelect: (files: FileList) => void;
    private onRefresh: () => void;
    private onBpmChange: (bpm: number) => void;
    private onSeekPercent: (percent: number) => void;
    private onMasterVolume: (val: number) => void;
    private onToggleSetting: (setting: string, active: boolean) => void;
    private onTrackVolume: (trackIndex: number, volume: number) => void;

    constructor(
        transportHandler: (action: string) => void,
        muteHandler: (idx: number, m: boolean) => void,
        soloHandler: (idx: number, s: boolean) => void,
        zoomHandler: (level: number) => void,
        scrollXHandler: (percent: number) => void,
        scrollYHandler: (percent: number) => void,
        fileSelectHandler: (filename: string, file?: File) => void,
        folderSelectHandler: (files: FileList) => void,
        refreshHandler: () => void,
        bpmHandler: (bpm: number) => void,
        seekPercentHandler: (percent: number) => void,
        volumeHandler: (val: number) => void,
        toggleHandler: (setting: string, active: boolean) => void,
        trackVolumeHandler: (idx: number, vol: number) => void
    ) {
        this.uiManager = UIManager.getInstance();
        this.onTransportClick = transportHandler;
        this.onTrackMute = muteHandler;
        this.onTrackSolo = soloHandler;
        this.onZoomChange = zoomHandler;
        this.onScrollXChange = scrollXHandler;
        this.onScrollYChange = scrollYHandler;
        this.onFileSelect = fileSelectHandler;
        this.onFolderSelect = folderSelectHandler;
        this.onRefresh = refreshHandler;
        this.onBpmChange = bpmHandler;
        this.onSeekPercent = seekPercentHandler;
        this.onMasterVolume = volumeHandler;
        this.onToggleSetting = toggleHandler;
        this.onTrackVolume = trackVolumeHandler;
    }

    public init(): void {
        const html = `
            <div class="daw-container">
                <!-- Top Control Bar (File & Progress) -->
                <div class="transport-bar">
                    <div class="file-tools" style="display:flex; align-items:center; gap:8px;">
                        <label class="folder-btn" title="Open MIDI Folder">
                            📂
                            <input type="file" id="folder-input" webkitdirectory directory multiple style="display:none;">
                        </label>
                        <button class="refresh-btn" id="btn-refresh" title="Refresh List" style="background:#333; border:1px solid #444; color:#fff; width:28px; height:28px; border-radius:4px; cursor:pointer;">🔄</button>
                        <select id="midi-selector" style="background:#000; color:#fff; border:1px solid #333; padding:4px 8px; border-radius:3px; outline:none; font-size:11px; max-width:150px;">
                            <option value="">-- No Folder --</option>
                        </select>
                    </div>

                    <div class="player-center" style="flex:1; display:flex; flex-direction:column; align-items:center; gap:2px; padding: 0 20px;">
                        <!-- Progress Bar Moved Here -->
                        <div class="top-progress-container" style="width:100%; height:12px; display:flex; align-items:center;">
                            <input type="range" id="progress-bar" min="0" max="1000" value="0" 
                                   style="width:100%; cursor:pointer; height:4px; margin:0;">
                        </div>
                        <div class="time-display" id="time-display" style="font-size:11px; margin-top:-2px;">00:00.00 / 00:00.00</div>
                    </div>

                    <div class="extra-tools" style="display: flex; gap: 12px; align-items: center;">
                        <div class="bpm-tool" style="display:flex; align-items:center; gap:5px; background:#000; padding:2px 8px; border-radius:4px; border:1px solid #333;">
                            <span style="font-size:9px; color:#666; font-weight:bold;">BPM</span>
                            <input type="number" id="bpm-input" value="120" step="0.1" style="width:45px; background:transparent; color:var(--daw-accent); border:none; outline:none; font-family:monospace; font-size:12px; text-align:right;">
                        </div>
                        <div style="display:flex; align-items:center; gap:5px;">
                            <span style="color:#666; font-weight:bold; font-size:9px; text-transform:uppercase;">Zoom</span>
                            <input type="range" id="zoom-slider" min="2" max="200" value="10" style="width: 50px;">
                        </div>
                    </div>
                </div>

                <!-- Track List (Left) -->
                <div class="track-list-panel" id="track-list-panel"></div>

                <!-- Timeline Area (Center) -->
                <div class="timeline-area" id="timeline-area">
                    <div class="scrollbar-h" style="position: absolute; bottom: 0; left: 0; width: calc(100% - 16px); height: 16px; background: #000; z-index: 20; border-top:1px solid #111;">
                        <input type="range" id="scroll-x" min="0" max="1000" value="0" style="width: 100%; margin: 0; height:100%;">
                    </div>
                    <div class="scrollbar-v" style="position: absolute; top: 0; right: 0; width: 16px; height: calc(100% - 16px); background: #000; z-index: 20; border-left:1px solid #111;">
                        <input type="range" id="scroll-y" min="0" max="1000" value="0" style="height: 100%; width: 100%; writing-mode: vertical-lr; direction: rtl; margin: 0; cursor: ns-resize;">
                    </div>
                </div>

                <!-- Bottom Transport Bar (Consolidated) -->
                <div class="player-bar">
                    <div class="player-tools-left" style="display:flex; gap:10px; margin-right:auto;">
                        <button class="toggle-btn" id="btn-loop" title="Loop Toggle">Loop</button>
                        <button class="toggle-btn" id="btn-metronome" title="Metronome Toggle">Metro</button>
                    </div>

                    <div class="transport-buttons" style="display:flex; gap:15px; align-items:center;">
                        <button class="transport-btn small" id="btn-start" title="Go to Start" style="font-size:14px;">⏮</button>
                        <!-- Merged Play/Pause Button -->
                        <button class="transport-btn main" id="btn-play-pause" title="Play/Pause" style="width:40px; height:40px; font-size:20px;">▶</button>
                        <button class="transport-btn small" id="btn-stop" title="Stop" style="font-size:14px;">⏹</button>
                        <button class="transport-btn small" id="btn-end" title="Go to End" style="font-size:14px;">⏭</button>
                    </div>

                    <div class="volume-tool" style="display:flex; align-items:center; gap:10px; margin-left:auto;">
                        <span style="font-size:9px; color:#666; font-weight:bold;">VOL</span>
                        <input type="range" id="master-volume" min="0" max="100" value="80" style="width: 70px;">
                    </div>
                </div>
            </div>
        `;

        this.container = this.uiManager.createOverlay('editor-ui', html);
        this.trackListPanel = document.getElementById('track-list-panel');

        this.attachListeners();
    }

    private attachListeners(): void {
        const q = (s: string) => this.container?.querySelector(s);

        q('#btn-start')?.addEventListener('click', () => this.onTransportClick('start'));
        q('#btn-play-pause')?.addEventListener('click', () => this.onTransportClick('toggle'));
        q('#btn-stop')?.addEventListener('click', () => this.onTransportClick('stop'));
        q('#btn-end')?.addEventListener('click', () => this.onTransportClick('end'));

        q('#btn-loop')?.addEventListener('click', (e) => {
            const btn = e.currentTarget as HTMLElement;
            const active = btn.classList.toggle('active');
            this.onToggleSetting('loop', active);
        });

        q('#btn-metronome')?.addEventListener('click', (e) => {
            const btn = e.currentTarget as HTMLElement;
            const active = btn.classList.toggle('active');
            this.onToggleSetting('metronome', active);
        });

        q('#master-volume')?.addEventListener('input', (e) => {
            this.onMasterVolume(parseInt((e.target as HTMLInputElement).value));
        });

        q('#btn-refresh')?.addEventListener('click', () => this.onRefresh());

        q('#bpm-input')?.addEventListener('change', (e) => {
            const val = parseFloat((e.target as HTMLInputElement).value);
            if (!isNaN(val) && val > 0) this.onBpmChange(val);
        });

        q('#folder-input')?.addEventListener('change', (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (files) this.onFolderSelect(files);
        });

        q('#midi-selector')?.addEventListener('change', (e) => {
            const select = e.target as HTMLSelectElement;
            const filename = select.value;
            if (filename) {
                // If special marker, it's a file object from folder
                const option = select.options[select.selectedIndex];
                const fileIndex = option.dataset.fileIndex;
                if (fileIndex !== undefined) {
                    this.onFileSelect(filename, (this as any)._folderFiles?.[parseInt(fileIndex)]);
                } else {
                    this.onFileSelect(filename);
                }
            }
        });

        q('#progress-bar')?.addEventListener('input', (e) => {
            const val = parseInt((e.target as HTMLInputElement).value);
            this.onSeekPercent(val / 1000);
        });

        q('#zoom-slider')?.addEventListener('input', (e) => {
            this.onZoomChange(parseInt((e.target as HTMLInputElement).value) / 100);
        });

        q('#scroll-x')?.addEventListener('input', (e) => {
            this.onScrollXChange(parseInt((e.target as HTMLInputElement).value) / 1000);
        });

        q('#scroll-y')?.addEventListener('input', (e) => {
            this.onScrollYChange(parseInt((e.target as HTMLInputElement).value) / 1000);
        });
    }

    public setPlayState(isPlaying: boolean): void {
        const btn = document.getElementById('btn-play-pause');
        if (btn) {
            btn.innerHTML = isPlaying ? '⏸' : '▶';
            btn.classList.toggle('active', isPlaying);
        }
    }

    public populateMidiSelector(files: string[] | File[]): void {
        const selector = document.getElementById('midi-selector') as HTMLSelectElement;
        if (!selector) return;
        selector.innerHTML = '<option value="">-- Choose MIDI --</option>';

        if (files.length > 0 && files[0] instanceof File) {
            (this as any)._folderFiles = files; // Store reference for lookup
            (files as File[]).forEach((file, index) => {
                const option = document.createElement('option');
                option.value = file.name;
                option.textContent = file.name;
                option.dataset.fileIndex = index.toString();
                selector.appendChild(option);
            });
        } else {
            (files as string[]).forEach(file => {
                const option = document.createElement('option');
                option.value = file;
                option.textContent = file.split('/').pop() || file;
                selector.appendChild(option);
            });
        }
    }

    public setSelectedMidi(filename: string): void {
        const selector = document.getElementById('midi-selector') as HTMLSelectElement;
        if (selector) selector.value = filename;
    }

    public syncControls(zoom: number, scrollXPercent: number, scrollYPercent: number): void {
        const zoomS = document.getElementById('zoom-slider') as HTMLInputElement;
        if (zoomS && document.activeElement !== zoomS) zoomS.value = (zoom * 100).toString();

        const scrollXS = document.getElementById('scroll-x') as HTMLInputElement;
        if (scrollXS && document.activeElement !== scrollXS) scrollXS.value = (scrollXPercent * 1000).toString();

        const scrollYS = document.getElementById('scroll-y') as HTMLInputElement;
        if (scrollYS && document.activeElement !== scrollYS) scrollYS.value = (scrollYPercent * 1000).toString();
    }

    public updateProgress(currentTime: number, duration: number): void {
        const display = document.getElementById('time-display');
        if (display) {
            const formatTime = (t: number) => {
                const m = Math.floor(t / 60).toString().padStart(2, '0');
                const s = Math.floor(t % 60).toString().padStart(2, '0');
                const ms = Math.floor((t % 1) * 100).toString().padStart(2, '0');
                return `${m}:${s}.${ms}`;
            };
            display.innerText = `${formatTime(currentTime)} / ${formatTime(duration)}`;
        }

        const progressBar = document.getElementById('progress-bar') as HTMLInputElement;
        if (progressBar && document.activeElement !== progressBar && duration > 0) {
            progressBar.value = ((currentTime / duration) * 1000).toString();
        }
    }

    public setBpm(bpm: number): void {
        const input = document.getElementById('bpm-input') as HTMLInputElement;
        if (input && document.activeElement !== input) {
            input.value = bpm.toFixed(1);
        }
    }

    public setMidiMeta(meta: any): void {
        const display = document.getElementById('time-display');
        if (display && meta.copyright) {
            // Just an example of using the space
            console.log("[EditorUI] MIDI Metadata:", meta);
        }
    }

    public syncTrackScroll(scrollY: number): void {
        if (this.trackListPanel) {
            this.trackListPanel.scrollTop = scrollY;
        }
    }

    public renderTrackHeaders(tracks: GameTrack[], trackHeight: number, soloIndices: Set<number>, trackVolumes: Map<number, number>): void {
        if (!this.trackListPanel) return;
        this.trackListPanel.innerHTML = '';

        const getIcon = (track: GameTrack) => {
            if (track.isDrum) return '🥁';
            const family = track.instrumentFamily.toLowerCase();
            if (family.includes('piano')) return '🎹';
            if (family.includes('guitar')) return '🎸';
            if (family.includes('bass')) return '🎸';
            if (family.includes('strings')) return '🎻';
            if (family.includes('brass')) return '🎺';
            if (family.includes('reed') || family.includes('pipe')) return '🎷';
            if (family.includes('synth')) return '⌨️';
            return '🎵';
        };

        const displayCount = Math.max(10, tracks.length);

        for (let index = 0; index < displayCount; index++) {
            const track = tracks[index];
            const div = document.createElement('div');
            div.className = 'track-header';

            // Zebra striping
            const bgColor = (index % 2 === 1) ? 'rgba(255,255,255,0.03)' : 'transparent';
            div.style.cssText = `height: ${trackHeight}px; min-height: ${trackHeight}px; max-height: ${trackHeight}px; box-sizing: border-box; background-color: ${bgColor};`;

            if (track) {
                if (soloIndices.has(index)) div.classList.add('solo-active');
                div.style.cursor = 'pointer';

                // Track Solo Click Listener (restored)
                div.addEventListener('click', (e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest('.track-btn-m') || target.closest('.track-btn-s') || target.closest('.knob-container')) return;
                    this.onTrackSolo(index, !soloIndices.has(index));
                });

                const trackVolume = trackVolumes.get(index) || 100;
                div.dataset.index = index.toString();

                div.innerHTML = `
                    <div class="track-info-container" style="flex:1; pointer-events:none; display:flex; flex-direction:column; justify-content:center; gap:2px; overflow:hidden;">
                        <div class="track-name" style="font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#fff; font-size:12px;">
                            ${getIcon(track)} ${track.name}
                        </div>
                        <div class="track-meta" style="font-size:10px; color:#00ffcc; white-space:nowrap; opacity:0.8; font-family:monospace;">
                            Ch ${track.channel + 1} • ${track.instrumentFamily}
                        </div>
                    </div>
                    <div class="track-controls" style="display:flex; align-items:center;">
                        <button class="track-btn-m" title="Mute">M</button>
                        <button class="track-btn-s ${soloIndices.has(index) ? 'active' : ''}" title="Solo">S</button>
                        <div class="knob-container" style="display:flex; flex-direction:column; align-items:center; gap:2px; margin-left:12px; cursor:ns-resize;" title="Drag Up/Down to change volume">
                            <div class="knob" data-index="${index}" style="width:24px; height:24px; border-radius:50%; background:#111; border:2px solid #444; position:relative; overflow:hidden;">
                                <div class="knob-indicator" style="position:absolute; top:2px; left:50%; width:2px; height:8px; background:#00ffcc; transform-origin:bottom center; transform: translateX(-50%) rotate(${(trackVolume / 127) * 270 - 135}deg);"></div>
                            </div>
                            <span style="font-size:8px; color:#fff; font-weight:bold;">${Math.round(trackVolume)}</span>
                        </div>
                    </div>
                `;

                const knob = div.querySelector('.knob') as HTMLElement;
                knob?.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    const startY = e.clientY;
                    const startVol = trackVolumes.get(index) || 100;

                    const onMove = (moveEvent: MouseEvent) => {
                        const deltaY = startY - moveEvent.clientY;
                        const newVol = Math.max(0, Math.min(127, startVol + deltaY));
                        this.onTrackVolume(index, newVol);
                        this.updateTrackVolumeUI(index, newVol); // Smooth visual feedback
                    };

                    const onUp = () => {
                        window.removeEventListener('mousemove', onMove);
                        window.removeEventListener('mouseup', onUp);
                    };

                    window.addEventListener('mousemove', onMove);
                    window.addEventListener('mouseup', onUp);
                });

                div.querySelector('.track-btn-m')?.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const btn = e.currentTarget as HTMLElement;
                    btn.classList.toggle('active');
                    this.onTrackMute(index, btn.classList.contains('active'));
                });

                div.querySelector('.track-btn-s')?.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.onTrackSolo(index, !soloIndices.has(index));
                });
            } else {
                div.classList.add('empty');
                div.innerHTML = `<div class="track-name" style="color:#333; font-style:italic; padding-left:10px;">Empty Track</div>`;
            }
            this.trackListPanel.appendChild(div);
        }
    }

    public updateTrackVolumeUI(index: number, volume: number): void {
        const headers = this.trackListPanel?.querySelectorAll('.track-header');
        const targetHeader = Array.from(headers || []).find(h => (h as HTMLElement).dataset.index === index.toString()) as HTMLElement;

        if (targetHeader) {
            const label = targetHeader.querySelector('span');
            if (label) label.textContent = Math.round(volume).toString();

            const indicator = targetHeader.querySelector('.knob-indicator') as HTMLElement;
            if (indicator) {
                indicator.style.transform = `translateX(-50%) rotate(${(volume / 127) * 270 - 135}deg)`;
            }
        }
    }

    public updateSoloUI(soloIndices: Set<number>): void {
        const headers = this.trackListPanel?.querySelectorAll('.track-header');
        headers?.forEach((h, i) => {
            const isActive = soloIndices.has(i);
            h.classList.toggle('solo-active', isActive);
            const sBtn = h.querySelector('.track-btn-s');
            sBtn?.classList.toggle('active', isActive);
        });
    }

    public triggerFolderPicker(): void {
        const input = document.getElementById('folder-input') as HTMLInputElement;
        if (input) {
            input.value = ''; // Reset to allow same folder selection
            input.click();
        }
    }

    public getTimelineContainer(): HTMLElement | null {
        return document.getElementById('timeline-area');
    }

    public destroy(): void {
        this.uiManager.hide('editor-ui');
    }
}
