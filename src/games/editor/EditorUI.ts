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
    private onSortChange: (sortBy: string) => void;
    private onSaveConfig: () => void;
    private onTrackHeaderClick: (trackIndex: number) => void;
    private onToggleAllMeasures: () => void;
    private onMagicAnalyze: () => void;
    private onResetConfig: () => void;

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
        sortHandler: (sortBy: string) => void,
        saveConfigHandler: () => void,
        trackHeaderClickHandler: (trackIndex: number) => void,
        toggleAllHandler: () => void,
        magicAnalyzeHandler: () => void,
        resetConfigHandler: () => void
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
        this.onSortChange = sortHandler;
        this.onSaveConfig = saveConfigHandler;
        this.onTrackHeaderClick = trackHeaderClickHandler;
        this.onToggleAllMeasures = toggleAllHandler;
        this.onMagicAnalyze = magicAnalyzeHandler;
        this.onResetConfig = resetConfigHandler;
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
                    <div class="file-tools" style="display:flex; align-items:center; gap:8px; margin-right: auto; min-width: 0; flex: 1;">
                        <select id="midi-selector" style="background:#000; color:var(--daw-accent); border:1px solid #333; padding:4px 8px; border-radius:3px; outline:none; font-size:12px; font-weight:bold; width: 100%; max-width:450px; text-overflow: ellipsis; white-space: nowrap; overflow: hidden; cursor:pointer;" title="Current Song">
                            <option value="">-- No Song Selected --</option>
                        </select>
                        <input type="file" id="folder-input" webkitdirectory directory multiple style="display:none;">
                    </div>

                    <div class="extra-tools" style="display: flex; gap: 12px; align-items: center; margin-left: auto;">
                        <button id="btn-main-menu" title="Return to Main Menu" style="background:#673AB7; color:white; border:none; padding:4px 8px; border-radius:4px; font-weight:bold; cursor:pointer; font-size:11px;">
                            🏠 MENU
                        </button>
                        <button id="btn-save-config" title="Save to LocalStorage" style="background:#FF9800; color:white; border:none; padding:4px 8px; border-radius:4px; font-weight:bold; cursor:pointer; font-size:11px;">
                            💾 SAVE
                        </button>
                        <button id="btn-reset-config" title="Clear all manual configs" style="background:#f44336; color:white; border:none; padding:4px 8px; border-radius:4px; font-weight:bold; cursor:pointer; font-size:11px;">
                            ↺ RESET
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
                        
                        <div class="zoom-tool" style="display:flex; align-items:center; gap:5px; margin-right: 5px;">
                            <span style="color:#666; font-weight:bold; font-size:9px; text-transform:uppercase;">Zoom</span>
                            <input type="range" id="zoom-slider" min="10" max="190" value="100" style="width: 55px;">
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
        q('#btn-save-config')?.addEventListener('click', () => this.onSaveConfig());
        q('#btn-main-menu')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('switch-game', {
                detail: { targetMode: 'menu' }
            }));
        });
        q('#btn-reset-config')?.addEventListener('click', () => {
            if (confirm("Are you sure you want to delete ALL manual configurations? This cannot be undone.")) {
                this.onResetConfig();
            }
        });

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

    public renderChannelHeaders(channelData: any[], channelHeight: number, soloIndices: Set<number>, channelVolumes: Map<number, number>, mutedIndices: Set<number>, channelColors: string[], mainChannels: Set<number> = new Set()): void {
        if (!this.trackListPanel) return;
        this.trackListPanel.innerHTML = '';

        // Add Sticky Header Spacer to match Canvas Measure Header
        const headerSpacer = document.createElement('div');
        headerSpacer.style.cssText = 'position: sticky; top: 0; height: 24px; min-height: 24px; background: #0a0a0a; border-bottom: 1px solid #333; z-index: 10; width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 0 4px; box-sizing: border-box; color: #666; font-size: 10px; font-weight: bold;';

        const label = document.createElement('span');
        label.innerText = 'CHANNELS';
        headerSpacer.appendChild(label);

        const btnContainer = document.createElement('div');
        btnContainer.style.display = 'flex';
        btnContainer.style.gap = '4px';

        const magicBtn = document.createElement('button');
        magicBtn.innerHTML = '🪄';
        magicBtn.title = 'Magic Auto-Fill (Fill Gaps)';
        magicBtn.style.cssText = 'background: #222; color: #fff; border: 1px solid #ffcc00; border-radius: 4px; font-size: 11px; padding: 1px 4px; cursor: pointer; transition: all 0.2s;';
        magicBtn.onmouseover = () => { magicBtn.style.background = '#444'; magicBtn.style.transform = 'scale(1.1)'; };
        magicBtn.onmouseout = () => { magicBtn.style.background = '#222'; magicBtn.style.transform = 'scale(1.0)'; };
        magicBtn.onclick = (e) => {
            e.stopPropagation();
            this.onMagicAnalyze();
        };
        btnContainer.appendChild(magicBtn);

        const toggleBtn = document.createElement('button');
        toggleBtn.innerText = 'ALL';
        toggleBtn.title = 'Select / Deselect All Measures';
        toggleBtn.style.cssText = 'background: #222; color: #aaa; border: 1px solid #444; border-radius: 4px; font-size: 9px; padding: 1px 6px; cursor: pointer; transition: all 0.2s;';
        toggleBtn.onmouseover = () => { toggleBtn.style.background = '#333'; toggleBtn.style.color = '#fff'; };
        toggleBtn.onmouseout = () => { toggleBtn.style.background = '#222'; toggleBtn.style.color = '#aaa'; };
        toggleBtn.onclick = (e) => {
            e.stopPropagation();
            this.onToggleAllMeasures();
        };
        btnContainer.appendChild(toggleBtn);

        headerSpacer.appendChild(btnContainer);

        this.trackListPanel.appendChild(headerSpacer);

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
            const isMain = mainChannels && mainChannels.has(ch);
            div.className = `track-header zebra-${(ch % 2) + 1} ${isMain ? 'main-channel' : ''}`;

            const color = channelColors[ch] || '#888';

            // Ensure height is an exact integer to prevent sub-pixel desync with canvas
            const h = Math.floor(channelHeight);

            // Match Canvas Zebra (High Contrast)
            let bg = (ch % 2 === 1) ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.5)';
            if (isMain) bg = 'rgba(255, 215, 0, 0.1)'; // Golden background twist

            const borderStyle = isMain ? `border: 2px solid gold;` : `border-left: 4px solid ${color}; border-bottom: 1.2px solid #555;`;

            div.style.cssText = `position: relative; height: ${h}px; min-height: ${h}px; max-height: ${h}px; box-sizing: border-box; overflow: hidden; ${borderStyle} background: ${bg}; transition: all 0.2s;`;

            if (channelInfo && channelInfo.notes.length > 0) {
                if (soloIndices.has(ch)) div.classList.add('solo-active');
                div.style.cursor = 'pointer';

                // Channel Solo Click Listener
                div.addEventListener('click', (e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest('.track-btn-m') || target.closest('.track-btn-s') || target.closest('.track-volume-slider')) return;
                    this.onTrackHeaderClick(ch);
                });

                const channelVolume = channelVolumes.get(ch) || 100;
                div.dataset.index = ch.toString();

                const trackNamesStr = channelInfo.trackNames.length > 0
                    ? channelInfo.trackNames.join(', ')
                    : `Channel ${ch + 1}`;

                // Restore the original MAIN badge positioned to the top left
                const mainBadge = isMain ? `<div title="Auto-Selected Main Channel" style="position:absolute; left:0; top:0; background:gold; color:#000; font-size:9px; font-weight:bold; padding:1px 3px; border-bottom-right-radius:4px; z-index: 5; box-shadow: 1px 1px 3px rgba(0,0,0,0.5);">👑 MAIN</div>` : '';

                div.innerHTML = `
                    ${mainBadge}
                    <div style="display:flex; align-items:center; width:100%; height:100%; padding: 0 5px; gap:8px; overflow:hidden;">
                        <span class="track-number" style="color:${isMain ? 'gold' : color}; font-weight:bold; width:16px; text-align:center; display:inline-block; margin-top:${isMain ? '12px' : '0'};">${ch + 1}</span>
                        
                        <div class="track-icon-badge" style="width:30px; height:30px; display:flex; align-items:center; justify-content:center; background:${color}22; border:1px solid ${color}44; border-radius:4px; font-size:16px;">
                            ${getIcon(channelInfo)}
                        </div>

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
