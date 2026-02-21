import { UIManager } from '../../core/ui/UIManager';

export class EditorUI {
    private uiManager: UIManager;
    private container: HTMLElement | null = null;
    private trackListPanel: HTMLElement | null = null;

    private onTransportClick: (action: string) => void;
    private onTrackMute: (trackIndex: number, muted: boolean) => void;
    private onTrackSolo: (trackIndex: number, soloed: boolean) => void;
    private onZoomChange: (level: number) => void;
    private onScrollYChange: (percent: number) => void;
    private onFileSelect: (filename: string, file?: File) => void;
    private onFolderSelect: (files: FileList) => void;
    private onRefresh: () => void;
    private onBpmChange: (bpm: number) => void;
    private onSeekPercent: (percent: number) => void;
    private onMasterVolume: (val: number) => void;
    private onTrackVolume: (trackIndex: number, volume: number) => void;
    private onEQChange: (type: 'low' | 'mid' | 'high', val: number) => void;
    private onFXChange: (type: 'reverb' | 'chorus', val: number) => void;
    private onChannelRoleChange: (channelIndex: number, role: string) => void;
    private onAutoRolesClick: () => void;
    private onSaveConfigClick: () => void;
    private onSortChange: (sortBy: string) => void;

    constructor(
        transportHandler: (action: string) => void,
        muteHandler: (idx: number, m: boolean) => void,
        soloHandler: (idx: number, s: boolean) => void,
        zoomHandler: (level: number) => void,
        scrollYHandler: (percent: number) => void,
        fileSelectHandler: (filename: string, file?: File) => void,
        folderSelectHandler: (files: FileList) => void,
        refreshHandler: () => void,
        bpmHandler: (bpm: number) => void,
        seekPercentHandler: (percent: number) => void,
        volumeHandler: (val: number) => void,
        trackVolumeHandler: (idx: number, vol: number) => void,
        eqHandler: (type: 'low' | 'mid' | 'high', val: number) => void,
        fxHandler: (type: 'reverb' | 'chorus', val: number) => void,
        channelRoleHandler: (channelIndex: number, role: string) => void,
        autoRolesHandler: () => void,
        saveConfigHandler: () => void,
        sortHandler: (sortBy: string) => void
    ) {
        this.uiManager = UIManager.getInstance();
        this.onTransportClick = transportHandler;
        this.onTrackMute = muteHandler;
        this.onTrackSolo = soloHandler;
        this.onZoomChange = zoomHandler;
        this.onScrollYChange = scrollYHandler;
        this.onFileSelect = fileSelectHandler;
        this.onFolderSelect = folderSelectHandler;
        this.onRefresh = refreshHandler;
        this.onBpmChange = bpmHandler;
        this.onSeekPercent = seekPercentHandler;
        this.onMasterVolume = volumeHandler;
        this.onTrackVolume = trackVolumeHandler;
        this.onEQChange = eqHandler;
        this.onFXChange = fxHandler;
        this.onChannelRoleChange = channelRoleHandler;
        this.onAutoRolesClick = autoRolesHandler;
        this.onSaveConfigClick = saveConfigHandler;
        this.onSortChange = sortHandler;
    }

    public show(): void {
        const container = document.querySelector('.daw-container') as HTMLElement;
        if (container) {
            container.style.opacity = '1';
        }
    }

    public init(): void {
        const html = `
            <div class="daw-container" style="opacity: 0; transition: opacity 0.3s;">
                <!-- Top Control Bar (File & Progress) -->
                <div class="transport-bar">
                    <div class="file-tools" style="display:flex; align-items:center; gap:8px; margin-right: auto;">
                        <label class="folder-btn" title="Open MIDI Folder">
                            📂
                            <input type="file" id="folder-input" webkitdirectory directory multiple style="display:none;">
                        </label>
                        <select id="editor-sort" style="background:#000; color:#fff; border:1px solid #333; padding:4px 8px; border-radius:3px; outline:none; font-size:11px; margin-left: 5px; max-width:110px;">
                            <option value="name">Sort: Name</option>
                            <option value="bpm">Sort: BPM</option>
                            <option value="duration">Sort: Length</option>
                            <option value="noteCount">Sort: Notes</option>
                        </select>
                        <button class="refresh-btn" id="btn-refresh" title="Refresh List" style="background:#333; border:1px solid #444; color:#fff; width:28px; height:28px; border-radius:4px; cursor:pointer;">🔄</button>
                        <select id="midi-selector" style="background:#000; color:#fff; border:1px solid #333; padding:4px 8px; border-radius:3px; outline:none; font-size:11px; max-width:150px;">
                            <option value="">-- No Folder --</option>
                        </select>
                    </div>

                    <div class="extra-tools" style="display: flex; gap: 12px; align-items: center; margin-left: auto;">
                        <button id="btn-auto-roles" title="Auto Detect Roles" style="background:#2196F3; color:white; border:none; padding:4px 8px; border-radius:4px; font-weight:bold; cursor:pointer; font-size:11px;">
                            🤖 AUTO ROLES
                        </button>

                        <button id="btn-save-config" title="Save to LocalStorage" style="background:#FF9800; color:white; border:none; padding:4px 8px; border-radius:4px; font-weight:bold; cursor:pointer; font-size:11px;">
                            💾 SAVE (LOCAL)
                        </button>

                        <button id="btn-test-play" title="Test Play" style="background:#4CAF50; color:white; border:none; padding:4px 12px; border-radius:4px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:5px; font-size:11px;">
                            <span style="font-size:14px;">🎮</span> TEST
                        </button>

                        <select id="test-difficulty" style="background:#222; color:#fff; border:1px solid #444; padding:2px 4px; border-radius:4px; font-size:11px; outline:none; cursor:pointer;" title="Test Play Difficulty">
                            <option value="EASY">EASY</option>
                            <option value="NORMAL" selected>NORMAL</option>
                            <option value="HARD">HARD</option>
                        </select>

                        <select id="test-channel" style="background:#222; color:#fff; border:1px solid #444; padding:2px 4px; border-radius:4px; font-size:11px; outline:none; cursor:pointer;" title="Test Channel">
                            <option value="-1" selected>AUTO (Melody)</option>
                            <option value="0">CH 1</option>
                            <option value="1">CH 2</option>
                            <option value="2">CH 3</option>
                            <option value="3">CH 4</option>
                            <option value="4">CH 5</option>
                            <option value="5">CH 6</option>
                            <option value="6">CH 7</option>
                            <option value="7">CH 8</option>
                            <option value="8">CH 9</option>
                            <option value="9">CH 10 (Drums)</option>
                            <option value="10">CH 11</option>
                            <option value="11">CH 12</option>
                            <option value="12">CH 13</option>
                            <option value="13">CH 14</option>
                            <option value="14">CH 15</option>
                            <option value="15">CH 16</option>
                        </select>
                        
                        <div class="bpm-tool" style="display:flex; align-items:center; gap:5px; background:#000; padding:2px 8px; border-radius:4px; border:1px solid #333;">
                            <span style="font-size:9px; color:#666; font-weight:bold;">BPM</span>
                            <input type="number" id="bpm-input" value="120" step="0.1" style="width:45px; background:transparent; color:var(--daw-accent); border:none; outline:none; font-family:monospace; font-size:12px; text-align:right;">
                        </div>
                        <div style="display:flex; align-items:center; gap:5px;">
                            <span style="color:#666; font-weight:bold; font-size:9px; text-transform:uppercase;">Zoom</span>
                            <input type="range" id="zoom-slider" min="10" max="190" value="100" style="width: 50px;">
                        </div>
                    </div>
                </div>

                <!-- Track List (Left) -->
                <div class="track-list-panel" id="track-list-panel" style="height: calc(100% - 16px);"></div>

                <!-- Timeline Area (Center) -->
                <div class="timeline-area" id="timeline-area">
                    <div class="scrollbar-v" style="position: absolute; top: 0; right: 0; width: 16px; height: 100%; background: #000; z-index: 20; border-left:1px solid #111;">
                        <input type="range" id="scroll-y" min="0" max="1000" value="0" style="height: 100%; width: 100%; writing-mode: vertical-lr; margin: 0; cursor: ns-resize;">
                    </div>

                    <button class="sidebar-toggle" id="btn-sidebar-toggle" title="Toggle Tracks">☰</button>
                </div>

                <!-- Bottom Player Bar (Consolidated) -->
                <!-- Bottom Player Bar (Consolidated Navigation) -->
                <div class="player-bar">
                    <!-- Progress Bar (Acts as Main Navigation/Scroll) -->
                    <div class="bottom-progress-container" style="position: absolute; top: 0; left: 0; width: 100%; height: 24px; background: #000; border-bottom: 1px solid #222; display: flex; align-items: center; padding: 0;">
                        <input type="range" id="progress-bar" min="0" max="1000" value="0" style="width: 100%; height: 100%; cursor: pointer; margin: 0; background: transparent;">
                    </div>

                    <div class="player-tools-left" style="display:flex; gap:10px; margin-right:auto; margin-top: 20px; position: relative;">
                        <button class="toggle-btn" id="btn-fx-eq-toggle" title="Toggle FX & EQ">Master FX & EQ</button>
                        
                        <!-- Consolidated FX & EQ Popover -->
                        <div class="eq-popover-menu collapsed" id="fx-eq-popover">
                            <div class="eq-popover-header">Master Equalizer</div>
                            <div class="eq-grid-vertical" style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                                <div class="eq-item">
                                    <span class="eq-label">LOW</span>
                                    <input type="range" class="eq-slider-v eq-shared" data-type="low" min="-12" max="12" value="0">
                                    <span class="eq-value" id="eq-pop-val-low">0dB</span>
                                </div>
                                <div class="eq-item">
                                    <span class="eq-label">MID</span>
                                    <input type="range" class="eq-slider-v eq-shared" data-type="mid" min="-12" max="12" value="0">
                                    <span class="eq-value" id="eq-pop-val-mid">0dB</span>
                                </div>
                                <div class="eq-item">
                                    <span class="eq-label">HIGH</span>
                                    <input type="range" class="eq-slider-v eq-shared" data-type="high" min="-12" max="12" value="0">
                                    <span class="eq-value" id="eq-pop-val-high">0dB</span>
                                </div>
                            </div>

                            <div class="eq-popover-header">Master Effects</div>
                            <div class="eq-grid-vertical">
                                <div class="eq-item">
                                    <span class="eq-label" style="color:#a29bfe;">REV</span>
                                    <input type="range" class="eq-slider-v fx-shared" data-type="reverb" min="0" max="100" value="30">
                                    <span class="eq-value" id="fx-pop-val-reverb" style="color:#a29bfe;">30%</span>
                                </div>
                                <div class="eq-item">
                                    <span class="eq-label" style="color:#55efc4;">CHO</span>
                                    <input type="range" class="eq-slider-v fx-shared" data-type="chorus" min="0" max="100" value="20">
                                    <span class="eq-value" id="fx-pop-val-chorus" style="color:#55efc4;">20%</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="transport-buttons" style="display:flex; gap:15px; align-items:center; margin-top: 20px; position: relative;">
                        <button class="transport-btn small" id="btn-start" title="Go to Start" style="font-size:14px;">⏮</button>
                        <button class="transport-btn main" id="btn-play-pause" title="Play/Pause" style="width:40px; height:40px; font-size:20px;">▶</button>
                        <button class="transport-btn small" id="btn-stop" title="Stop" style="font-size:14px;">⏹</button>
                        <button class="transport-btn small" id="btn-end" title="Go to End" style="font-size:14px;">⏭</button>
                        
                        <!-- Time Display nested here for clean layout -->
                        <div class="time-display" id="time-display" style="position: absolute; left: 50%; bottom: -18px; transform: translateX(-50%); font-size: 10px; color: #888; font-family: monospace; white-space: nowrap;">00:00.00 / 00:00.00</div>
                    </div>

                    <div class="volume-tool" style="display:flex; align-items:center; gap:10px; margin-left:auto; margin-top: 20px;">
                        <span style="font-size:9px; color:#666; font-weight:bold;">VOL</span>
                        <input type="range" id="master-volume" min="0" max="100" value="80" style="width: 70px;">
                    </div>
                </div>

                <!-- Floating dashboard removed: consolidated to bottom-left -->
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
        q('#btn-test-play')?.addEventListener('click', () => this.onTransportClick('test'));
        q('#btn-auto-roles')?.addEventListener('click', () => this.onAutoRolesClick());
        q('#btn-save-config')?.addEventListener('click', () => this.onSaveConfigClick());

        q('#btn-fx-eq-toggle')?.addEventListener('click', (e) => {
            const btn = e.currentTarget as HTMLElement;
            const popover = q('#fx-eq-popover');
            const isActive = btn.classList.toggle('active');
            popover?.classList.toggle('collapsed', !isActive);
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

        q('#editor-sort')?.addEventListener('change', (e) => {
            const select = e.target as HTMLSelectElement;
            this.onSortChange(select.value);
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
            this.onZoomChange(parseInt((e.target as HTMLInputElement).value) / 1000);
        });

        q('#scroll-y')?.addEventListener('input', (e) => {
            // Standard behavior: Top is 0 (Min), Bottom is Max
            const target = e.target as HTMLInputElement;
            const max = parseInt(target.max) || 1000; // Fallback to 1000 if invalid
            const val = parseInt(target.value);
            this.onScrollYChange(val / max);
        });

        q('#btn-sidebar-toggle')?.addEventListener('click', () => {
            const container = q('.daw-container');
            container?.classList.toggle('sidebar-open');
        });


        this.container?.querySelectorAll('.eq-shared').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const el = e.target as HTMLInputElement;
                const type = el.dataset.type;
                const val = parseFloat(el.value);

                // Update both displays (if they exist)
                const displayPop = document.getElementById(`eq-pop-val-${type}`);
                if (displayPop) displayPop.textContent = `${val > 0 ? '+' : ''}${val}dB`;

                this.onEQChange(type as any, val);
            });
        });

        this.container?.querySelectorAll('.fx-shared').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const el = e.target as HTMLInputElement;
                const type = el.dataset.type;
                const val = parseFloat(el.value);
                const displayPop = document.getElementById(`fx-pop-val-${type}`);
                if (displayPop) displayPop.textContent = `${Math.round(val)}%`;
                this.onFXChange(type as any, val / 100);
            });
        });
    }

    public setPlayState(isPlaying: boolean): void {
        const btn = document.getElementById('btn-play-pause');
        if (btn) {
            btn.innerHTML = isPlaying ? '⏸' : '▶';
            btn.classList.toggle('active', isPlaying);
        }
    }

    public populateMidiSelector(files: any[] | File[]): void {
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
            files.forEach(file => {
                const option = document.createElement('option');
                if (typeof file === 'string') {
                    option.value = file;
                    option.textContent = file.split('/').pop() || file;
                } else if (file) {
                    option.value = file.url;
                    let text = file.name || file.url.split('/').pop();
                    if (file.bpm) text += ` [${Math.round(file.bpm)} BPM]`;
                    option.textContent = text;
                }
                selector.appendChild(option);
            });
        }
    }

    public setSelectedMidi(filename: string): void {
        const selector = document.getElementById('midi-selector') as HTMLSelectElement;
        if (selector) selector.value = filename;
    }

    public resetControls(): void {
        const setVal = (id: string, val: number) => {
            const el = document.getElementById(id) as HTMLInputElement;
            if (el) el.value = val.toString();
        };

        const setText = (id: string, text: string) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };

        // Master Volume (Default 80)
        setVal('master-volume', 80);

        // EQ (Default 0)
        this.container?.querySelectorAll('.eq-shared').forEach(el => (el as HTMLInputElement).value = '0');
        setText('eq-pop-val-low', '0dB');
        setText('eq-pop-val-mid', '0dB');
        setText('eq-pop-val-high', '0dB');

        // FX (Default 30/20)
        this.container?.querySelectorAll('.fx-shared[data-type="reverb"]').forEach(el => (el as HTMLInputElement).value = '30');
        setText('fx-pop-val-reverb', '30%');

        this.container?.querySelectorAll('.fx-shared[data-type="chorus"]').forEach(el => (el as HTMLInputElement).value = '20');
        setText('fx-pop-val-chorus', '20%');

        // Reset scroll/zoom
        this.syncControls(0.1, 0);
    }

    public syncControls(zoom: number, scrollYPercent: number): void {
        const zoomS = document.getElementById('zoom-slider') as HTMLInputElement;
        if (zoomS && document.activeElement !== zoomS) {
            const targetVal = Math.round(zoom * 1000).toString();
            if (zoomS.value !== targetVal) zoomS.value = targetVal;
        }

        const scrollYS = document.getElementById('scroll-y') as HTMLInputElement;
        if (scrollYS && document.activeElement !== scrollYS) {
            // Standard behavior: 0% at Top (0), 100% at Bottom (Max)
            const max = parseInt(scrollYS.max) || 1000;
            const targetVal = Math.round(scrollYPercent * max).toString();
            if (scrollYS.value !== targetVal) scrollYS.value = targetVal;
        }
    }

    public updateProgress(currentTime: number, duration: number): void {
        const display = document.getElementById('time-display');
        if (display) {
            const formatTime = (t: number) => {
                const m = Math.floor(t / 60).toString().padStart(2, '0');
                const s = Math.floor(t % 60).toString().padStart(2, '0');
                return `${m}:${s}`;
            };
            const newText = `${formatTime(currentTime)} / ${formatTime(duration)}`;
            if (display.innerText !== newText) {
                display.innerText = newText;
            }
        }

        const progressBar = document.getElementById('progress-bar') as HTMLInputElement;
        if (progressBar && document.activeElement !== progressBar && duration > 0) {
            const newVal = Math.floor((currentTime / duration) * 1000).toString();
            if (progressBar.value !== newVal) {
                progressBar.value = newVal;
            }
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

    public renderChannelHeaders(channelData: any[], channelHeight: number, soloIndices: Set<number>, channelVolumes: Map<number, number>, mutedIndices: Set<number>, channelColors: string[], gameRoles?: Map<number, string>): void {
        if (!this.trackListPanel) return;
        this.trackListPanel.innerHTML = '';

        const getIcon = (channel: any) => {
            if (channel.isDrum) return '🥁';
            const family = channel.instrumentFamily.toLowerCase();
            if (family.includes('piano')) return '🎹';
            if (family.includes('guitar')) return '🎸';
            if (family.includes('bass')) return '🎸';
            if (family.includes('strings')) return '🎻';
            if (family.includes('brass')) return '🎺';
            if (family.includes('reed') || family.includes('pipe')) return '🎷';
            if (family.includes('synth')) return '⌨️';
            return '🎵';
        };

        // Always render 16 channels (0-15)
        for (let ch = 0; ch < 16; ch++) {
            const channelInfo = channelData[ch];
            const div = document.createElement('div');
            div.className = `track-header zebra-${(ch % 2) + 1}`;

            const color = channelColors[ch] || '#888';

            // Ensure height is an exact integer to prevent sub-pixel desync with canvas
            const h = Math.floor(channelHeight);

            // Match Canvas Zebra (High Contrast)
            const bg = (ch % 2 === 1) ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.5)';

            div.style.cssText = `height: ${h}px; min-height: ${h}px; max-height: ${h}px; box-sizing: border-box; overflow: hidden; border-left: 4px solid ${color}; border-bottom: 1.2px solid #555; background: ${bg};`;

            if (channelInfo && channelInfo.notes.length > 0) {
                if (soloIndices.has(ch)) div.classList.add('solo-active');
                div.style.cursor = 'pointer';

                // Channel Solo Click Listener
                div.addEventListener('click', (e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest('.track-btn-m') || target.closest('.track-btn-s') || target.closest('.track-volume-slider')) return;
                    this.onTrackSolo(ch, !soloIndices.has(ch));
                });

                const channelVolume = channelVolumes.get(ch) || 100;
                div.dataset.index = ch.toString();

                const trackNamesStr = channelInfo.trackNames.length > 0
                    ? channelInfo.trackNames.join(', ')
                    : `Channel ${ch + 1}`;

                div.innerHTML = `
                    <div style="display:flex; align-items:center; width:100%; height:100%; padding: 0 5px; gap:8px; overflow:hidden;">
                        <span class="track-number" style="color:${color}; font-weight:bold;">${ch + 1}</span>
                        
                        <div class="track-icon-badge" style="width:30px; height:30px; display:flex; align-items:center; justify-content:center; background:${color}22; border:1px solid ${color}44; border-radius:4px; font-size:16px;">
                            ${getIcon(channelInfo)}
                        </div>

                        <select class="channel-role-select" data-index="${ch}" style="background:#222; color:${color}; border:1px solid #444; border-radius:3px; font-size:10px; padding:2px; margin-right:8px; cursor:pointer; outline:none;">
                            <option value="NONE" ${(!gameRoles || !gameRoles.has(ch)) ? 'selected' : ''}>--</option>
                            <option value="PRIMARY" ${(gameRoles && gameRoles.get(ch) === 'PRIMARY') ? 'selected' : ''}>👑 PRI</option>
                            <option value="SECONDARY" ${(gameRoles && gameRoles.get(ch) === 'SECONDARY') ? 'selected' : ''}>🛡️ SEC</option>
                            <option value="THIRD" ${(gameRoles && gameRoles.get(ch) === 'THIRD') ? 'selected' : ''}>🔸 3RD</option>
                            <option value="DRUM" ${(gameRoles && gameRoles.get(ch) === 'DRUM') ? 'selected' : ''}>🥁 DRM</option>
                        </select>

                        <div class="track-info-container" style="flex:1; pointer-events:none; display:flex; flex-direction:column; justify-content:center; overflow:hidden;">
                            <div class="track-name" style="font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#fff; font-size:11px; margin-bottom:0px;">
                                ${trackNamesStr}
                            </div>
                            <div class="track-meta" style="font-size:9px; color:${color}; white-space:nowrap; opacity:0.8; font-family:monospace;">
                                CH ${ch + 1} • ${channelInfo.instrumentFamily} • ${channelInfo.notes.length} notes
                            </div>
                        </div>


                            <button class="track-btn-m ${mutedIndices.has(ch) ? 'active' : ''}" title="Mute">M</button>
                            <button class="track-btn-s ${soloIndices.has(ch) ? 'active' : ''}" title="Solo">S</button>
                            
                            <div class="slider-container" style="flex: 1; min-width: 80px; margin-left: 10px;">
                                <input type="range" class="track-volume-slider" min="0" max="127" value="${channelVolume}" data-index="${ch}" style="width: 100%; --value: ${(channelVolume / 127) * 100}%; --thumb-color: ${color}">
                            </div>
                        </div>
                    </div>
                `;

                const slider = div.querySelector('.track-volume-slider') as HTMLInputElement;
                slider?.addEventListener('input', (e) => {
                    e.stopPropagation();
                    const val = parseInt((e.target as HTMLInputElement).value);
                    (e.target as HTMLElement).style.setProperty('--value', `${(val / 127) * 100}%`);
                    this.onTrackVolume(ch, val);
                });

                slider?.addEventListener('mousedown', (e) => e.stopPropagation());

                const roleSelect = div.querySelector('.channel-role-select') as HTMLSelectElement;
                roleSelect?.addEventListener('change', (e) => {
                    e.stopPropagation();
                    const val = (e.target as HTMLSelectElement).value;
                    this.onChannelRoleChange(ch, val);
                });
                roleSelect?.addEventListener('click', (e) => e.stopPropagation());
                roleSelect?.addEventListener('mousedown', (e) => e.stopPropagation());


                div.querySelector('.track-btn-m')?.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const btn = e.currentTarget as HTMLElement;
                    btn.classList.toggle('active');
                    this.onTrackMute(ch, btn.classList.contains('active'));
                });

                div.querySelector('.track-btn-s')?.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.onTrackSolo(ch, !soloIndices.has(ch));
                });
            } else {
                div.classList.add('empty');
                div.innerHTML = `
                    <div style="display:flex; align-items:center; padding:0 15px; color:#333; height:100%;">
                        <span class="track-number">${ch + 1}</span>
                        <span style="font-style:italic; font-size:10px;">Empty Channel</span>
                    </div>
                `;
            }
            this.trackListPanel.appendChild(div);
        }
    }

    public updateTrackVolumeUI(index: number, volume: number): void {
        const headers = this.trackListPanel?.querySelectorAll('.track-header');
        const targetHeader = Array.from(headers || []).find(h => (h as HTMLElement).dataset.index === index.toString()) as HTMLElement;

        if (targetHeader) {
            const slider = targetHeader.querySelector('.track-volume-slider') as HTMLInputElement;
            if (slider) {
                slider.value = volume.toString();
                slider.style.setProperty('--value', `${(volume / 127) * 100}%`);
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

    public updateMuteUI(mutedIndices: Set<number>): void {
        const headers = this.trackListPanel?.querySelectorAll('.track-header');
        headers?.forEach((h, i) => {
            const isActive = mutedIndices.has(i);
            const mBtn = h.querySelector('.track-btn-m');
            mBtn?.classList.toggle('active', isActive);
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

    public getTestDifficulty(): string {
        const selector = document.getElementById('test-difficulty') as HTMLSelectElement;
        return selector ? selector.value : 'NORMAL';
    }

    public getTestChannel(): number {
        const selector = document.getElementById('test-channel') as HTMLSelectElement;
        return selector ? parseInt(selector.value) : -1;
    }

    public destroy(): void {
        this.uiManager.hide('editor-ui');
    }
}
