import { MidiParser, type ParsedMidi } from '../../../core/audio/MidiParser';
import { LocalSongStorage, type LocalSongMetadata } from '../services/LocalSongStorage';
import { type SongEntry } from '../types/GameTypes';
import { type CoreAudioEngine } from '../../../core/audio/CoreAudioEngine';
import { SPEED_OPTIONS, DIFFICULTY_OPTIONS } from '../constants/GameConstants';
import { computeMenuLayout } from '../renderer/MenuLayout';

export interface IMenuCallbacks {
    onPlayRequested: () => void;
    onReturnToMainMenu: () => void;
}

/**
 * MenuManager handles the state and logic for the game's menu system.
 * It manages song selection, options, and playback previews.
 */
export class MenuManager {
    public songList: SongEntry[] = [];

    public selectedSongIndex = 0;
    public currentSortMode: 'name' | 'bpm' | 'duration' | 'noteCount' = 'name';
    public selectedSpeedIndex = 1; // Default 1.0x
    public selectedDifficultyIndex = 1; // Default NORMAL
    public scrollSpeed = 1.0;
    public keyMode: 4 | 6 = 4;
    public menuAnimationTimer = 0;
    public currentFilter: 'all' | 'official' | 'custom' = 'all';

    private storage = new LocalSongStorage();
    private officialSongs: SongEntry[] = [];
    private customSongs: SongEntry[] = [];

    // Drag-to-scroll state
    private isDraggingScrollbar: boolean = false;
    private dragStartY: number = 0;
    private dragStartIdx: number = 0;

    private currentPreviewId = 0;
    private previewTimeout: ReturnType<typeof setTimeout> | null = null;
    private audioEngine: CoreAudioEngine;
    private callbacks: IMenuCallbacks;
    /** Parsed MIDI of the currently-previewing song. Consumed by MenuRenderState → EQ visualizer. */
    public previewMidi: ParsedMidi | null = null;
    private _midiParser = new MidiParser();

    constructor(
        audioEngine: CoreAudioEngine,
        callbacks: IMenuCallbacks
    ) {
        this.audioEngine = audioEngine;
        this.callbacks = callbacks;
        this.init();
    }

    private async init() {
        await this.loadOfficialSongs();
        await this.loadUserSongs();
        this.sortSongList();
    }

    public async loadOfficialSongs() {
        try {
            const res = await fetch('assets/data/official_songs.json');
            if (!res.ok) throw new Error("Failed to load official songs list.");
            const data = await res.json();
            this.officialSongs = data.map((s: any) => ({
                ...s,
                isCustom: false
            } as SongEntry));
            this.applyFilter();
        } catch (e) {
            console.error("[MenuManager] Failed to load official songs:", e);
        }
    }

    public async loadUserSongs() {
        try {
            const metas = await this.storage.getAllMetadata();
            this.customSongs = metas.map(m => ({
                id: m.id,
                name: m.title,
                bpm: m.bpm || 120, 
                url: m.blobKey, 
                duration: m.duration || 0,
                difficulty: 5,
                isCustom: true
            } as SongEntry));
            this.applyFilter();

            // Background parsing to fill missing metadata (Fixes 0s duration bug for My Songs)
            // PROFESSIONAL: We use a serial queue to avoid main-thread stuttering
            this.processMetadataQueue();
        } catch (e) {
            console.error("[MenuManager] Failed to load user songs:", e);
        }
    }

    private _isQueueRunning = false;
    private async processMetadataQueue() {
        if (this._isQueueRunning) return;
        this._isQueueRunning = true;

        const targets = this.customSongs.filter(s => s.duration === 0);
        
        for (const s of targets) {
            // Yield to main thread to prevent UI lock
            await new Promise(r => setTimeout(r, 200)); 
            
            // PROFESSIONAL: Abort background tasks immediately if game is active
            if (this.audioEngine.isPlaying() && !this.previewMidi) break; 

            try {
                const blob = await this.storage.getSongBlob(s.url);
                if (blob) {
                    const buffer = await blob.arrayBuffer();
                    const parsed = await this._midiParser.parse(buffer);
                    s.duration = parsed.duration;
                    s.bpm = parsed.bpm || 120;
                    
                    // Optimized single-field update
                    await this.storage.updateSongMetadata(s.id!, { 
                        duration: s.duration, 
                        bpm: s.bpm 
                    });
                }
            } catch (e) {
                console.warn(`[MenuManager] Background parse failed for ${s.name}:`, e);
            }
        }

        this._isQueueRunning = false;
    }

    public applyFilter() {
        let baseList = [...this.officialSongs, ...this.customSongs];
        if (this.currentFilter === 'official') {
            baseList = this.officialSongs;
        } else if (this.currentFilter === 'custom') {
            baseList = this.customSongs;
        }
        this.songList = baseList;
        this.sortSongList();

        // ── Defensive: Re-validate index after filtering ──
        if (this.songList.length === 0) {
            this.selectedSongIndex = 0;
        } else if (this.selectedSongIndex >= this.songList.length) {
            this.selectedSongIndex = this.songList.length - 1;
        }
    }

    public async addUserSong(file: File): Promise<void> {
        // 1. Basic MIDI Validation (Header check)
        const buffer = await file.arrayBuffer();
        const header = new Uint8Array(buffer.slice(0, 4));
        const isMidi = header[0] === 0x4D && header[1] === 0x54 && header[2] === 0x68 && header[3] === 0x64;
        
        if (!isMidi) {
            throw new Error("Invalid MIDI file format.");
        }

        // 2. Extract Metadata
        const id = `custom_${Date.now()}`;
        const blobKey = `file_${id}`;
        const metadata: LocalSongMetadata = {
            id,
            title: file.name.replace(/\.[^/.]+$/, ""),
            artist: 'Unknown',
            duration: 0,
            isCustom: true,
            createdAt: Date.now(),
            blobKey
        };

        // 3. Save to Storage
        await this.storage.saveSong(metadata, new Blob([buffer]));

        // 4. Update State
        await this.loadUserSongs();
        this.currentFilter = 'custom';
        this.applyFilter();
    }

    public async deleteUserSong(id: string): Promise<void> {
        const song = this.customSongs.find(s => s.id === id);
        if (!song) return;

        await this.storage.deleteSong(id, song.url);
        await this.loadUserSongs();
    }

    private touchStartY = 0;

    public update(delta: number): void {
        this.menuAnimationTimer += delta * 0.001;
    }

    public sortSongList(): void {
        const currentSong = this.songList[this.selectedSongIndex];

        switch (this.currentSortMode) {
            case 'name':
                this.songList.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'bpm':
                this.songList.sort((a, b) => (a.bpm || 0) - (b.bpm || 0));
                break;
        }

        if (currentSong) {
            this.selectedSongIndex = this.songList.findIndex(s => s.name === currentSong.name);
        }
    }

    public playPreview(): void {
        if (this.songList.length === 0) {
            this.stopPreview();
            this.previewMidi = null;
            return;
        }

        // Validate index again to prevent race conditions or unexpected state changes
        if (this.selectedSongIndex < 0 || this.selectedSongIndex >= this.songList.length) {
            this.selectedSongIndex = 0;
        }

        const currentSong = this.songList[this.selectedSongIndex];
        if (this.currentSongUrl === currentSong.url && this.audioEngine.isPlaying()) return;

        if (this.previewTimeout) clearTimeout(this.previewTimeout);
        this.audioEngine.stop();

        const previewId = ++this.currentPreviewId;
        this.previewTimeout = setTimeout(async () => {
            if (previewId !== this.currentPreviewId) return;
            try {
                let buffer: ArrayBuffer;
                if (currentSong.isCustom) {
                    const blob = await this.storage.getSongBlob(currentSong.url);
                    if (!blob) throw new Error("Custom MIDI file not found in storage.");
                    buffer = await blob.arrayBuffer();
                } else {
                    const res = await fetch(currentSong.url);
                    buffer = await res.arrayBuffer();
                }

                // 1. Parse MIDI
                const parsedMidi = await this._midiParser.parse(buffer.slice(0));

                // 2. Normalize MIDI (Shift first note to 0s to eliminate initial quiet gap/desync)
                let firstNoteTime = Infinity;
                for (const track of parsedMidi.tracks) {
                    for (const note of track.notes) {
                        if (note.time < firstNoteTime) firstNoteTime = note.time;
                    }
                }

                if (firstNoteTime !== Infinity && firstNoteTime > 0) {
                    console.log(`[MenuManager] Normalizing preview: shifting notes by -${firstNoteTime.toFixed(3)}s`);
                    for (const track of parsedMidi.tracks) {
                        for (const note of track.notes) {
                            (note as any).time -= firstNoteTime;
                        }
                    }
                }

                // 3. Update Metadata if missing (Fixes 0s duration bug)
                if (!currentSong.duration || !currentSong.bpm) {
                    currentSong.duration = parsedMidi.duration;
                    currentSong.bpm = parsedMidi.bpm || 120;
                    
                    // Propagate to source catalogues to persist during filter changes
                    const cat = currentSong.isCustom ? this.customSongs : this.officialSongs;
                    const entry = cat.find(s => s.url === currentSong.url);
                    if (entry) {
                        entry.duration = currentSong.duration;
                        entry.bpm = currentSong.bpm;
                    }
                }

                // 4. Prepare Engine
                await this.audioEngine.loadMidi(buffer);

                // 4. ATOMIC UPDATE: Synchronize state switch
                // We reset time and set MIDI data only when audio is actually ready to emit sound.
                this.audioEngine.startPreciseTime(0);
                this.previewMidi = parsedMidi; // Atomic switch: visualizer now sees the new, normalized data

                this.audioEngine.play();
                this._currentSongUrl = currentSong.url;
            } catch (e) {
                console.warn("Failed to play preview:", e);
                this.previewMidi = null;
            }
        }, 300);
    }
    private _currentSongUrl: string = "";
    public get currentSongUrl(): string { return this._currentSongUrl; }

    public setTouchStartY(y: number): void {
        this.touchStartY = y;
    }

    public handleScroll(y: number): boolean {
        if (this.songList.length === 0) return false;
        const diffY = y - this.touchStartY;
        const threshold = 30;
        const shift = Math.trunc(diffY / threshold);
        if (shift !== 0) {
            this.selectedSongIndex = (this.selectedSongIndex + shift) % this.songList.length;
            if (this.selectedSongIndex < 0) this.selectedSongIndex += this.songList.length;
            this.touchStartY = y - (diffY % threshold);
            return true;
        }
        return false;
    }

    public handleWheel(deltaY: number): void {
        if (this.songList.length === 0) return;
        if (deltaY > 0) {
            this.selectedSongIndex = (this.selectedSongIndex + 1) % this.songList.length;
        } else {
            this.selectedSongIndex = (this.selectedSongIndex - 1 + this.songList.length) % this.songList.length;
        }
    }

    public selectNextDifficulty(): void {
        this.selectedDifficultyIndex = Math.min(DIFFICULTY_OPTIONS.length - 1, this.selectedDifficultyIndex + 1);
    }

    public selectPreviousDifficulty(): void {
        this.selectedDifficultyIndex = Math.max(0, this.selectedDifficultyIndex - 1);
    }

    public selectNextSpeed(): void {
        this.selectedSpeedIndex = Math.min(SPEED_OPTIONS.length - 1, this.selectedSpeedIndex + 1);
        this.scrollSpeed = SPEED_OPTIONS[this.selectedSpeedIndex];
    }

    public selectPreviousSpeed(): void {
        this.selectedSpeedIndex = Math.max(0, this.selectedSpeedIndex - 1);
        this.scrollSpeed = SPEED_OPTIONS[this.selectedSpeedIndex];
    }

    public toggleKeyMode(): void {
        this.keyMode = this.keyMode === 4 ? 6 : 4;
    }

    public cycleSortMode(): void {
        const modes: ('name' | 'bpm' | 'duration' | 'noteCount')[] = ['name', 'bpm', 'duration', 'noteCount'];
        const idx = modes.indexOf(this.currentSortMode);
        this.currentSortMode = modes[(idx + 1) % modes.length];
        this.sortSongList();
    }

    public setSelectedSongIndex(index: number): void {
        if (index >= 0 && index < this.songList.length) {
            this.selectedSongIndex = index;
        }
    }

    public getScrollSpeed(): number { return this.scrollSpeed; }
    public getKeyMode(): 4 | 6 { return this.keyMode; }
    public getCurrentSong(): SongEntry { return this.songList[this.selectedSongIndex]; }
    public getCurrentDifficulty(): string { return DIFFICULTY_OPTIONS[this.selectedDifficultyIndex]; }

    public handleKeyboardInput(code: string): void {
        if (this.songList.length === 0) return;
        switch (code) {
            case 'ArrowUp':
                this.selectedSongIndex = (this.selectedSongIndex - 1 + this.songList.length) % this.songList.length;
                break;
            case 'ArrowDown':
                this.selectedSongIndex = (this.selectedSongIndex + 1) % this.songList.length;
                break;
            case 'ArrowLeft':
                this.selectPreviousDifficulty();
                break;
            case 'ArrowRight':
                this.selectNextDifficulty();
                break;
            case 'KeyS':
                this.selectNextSpeed();
                break;
            case 'KeyA':
                this.selectPreviousSpeed();
                break;
            case 'KeyK':
                this.toggleKeyMode();
                break;
            case 'Enter':
                this.stopPreview();
                this.callbacks.onPlayRequested();
                break;
        }
    }

    public handlePointerDown(x: number, y: number, width: number, height: number, isMobile: boolean): void {
        const layout = computeMenuLayout(width, height, isMobile);

        // Main Menu Button
        if (x >= layout.mainMenuBtnX && x <= layout.mainMenuBtnX + layout.mainMenuBtnW &&
            y >= layout.mainMenuBtnY && y <= layout.mainMenuBtnY + layout.mainMenuBtnH) {
            this.callbacks.onReturnToMainMenu();
            return;
        }

        // ── Filter Tabs Interaction ──
        if (y >= layout.tabAreaY && y <= layout.tabAreaY + layout.tabAreaH) {
            if (x >= layout.tabAreaX && x <= layout.tabAreaX + layout.tabAreaW) {
                const relativeX = x - layout.tabAreaX;
                const tabIndex = Math.floor(relativeX / layout.tabWidth);
                const filters: Array<'all' | 'official' | 'custom'> = ['all', 'official', 'custom'];
                if (tabIndex >= 0 && tabIndex < filters.length) {
                    this.currentFilter = filters[tabIndex];
                    this.selectedSongIndex = 0;
                    this.applyFilter();
                    this.playPreview();
                    return;
                }
            }
        }

        // ── Upload Button Interaction ──
        if (x >= layout.uploadBtnX && x <= layout.uploadBtnX + layout.uploadBtnW &&
            y >= layout.uploadBtnY && y <= layout.uploadBtnY + layout.uploadBtnH) {
            this.triggerFileUpload();
            return;
        }

        // Scrollbar interaction
        const contentAreaH = layout.itemHeight * layout.visibleCount;
        const scrollbarX = layout.listX + layout.listW - (20 * layout.scaleFactor); // Match approximate scrollbar hit zone
        const scrollbarW = 15 * layout.scaleFactor; // Thicker hit area
        if (x >= scrollbarX && x <= scrollbarX + scrollbarW && y >= layout.listInnerY && y <= layout.listInnerY + contentAreaH) {
            this.isDraggingScrollbar = true;
            this.dragStartY = y;
            this.dragStartIdx = this.selectedSongIndex;
            return;
        }

        // Play Button
        if (x >= layout.btnX && x <= layout.btnX + layout.btnW &&
            y >= layout.btnY && y <= layout.btnY + layout.btnH) {
            this.stopPreview();
            this.callbacks.onPlayRequested();
            return;
        }

        // OPTIONS Area Interaction (Single Row, 3 Columns)
        // Check for hits within the vertical bounds of the row
        if (Math.abs(y - layout.row1CenterY) < layout.hitHeight) {
            const sf = layout.scaleFactor;
            const tw = layout.hitWidth * 1.8;
            const th = 54 * sf;
            const tabH = 22 * sf;
            const totalH = th + tabH;

            // Re-calculate visual box bounds to sync hit detection
            const baseY = layout.row1CenterY - totalH / 2;
            const boxY = baseY + tabH;

            const centers = [layout.col1CenterX, layout.col2CenterX, layout.col3CenterX];

            for (let i = 0; i < 3; i++) {
                const cx = centers[i];
                // Check if pointer is within this item's horizontal bounds
                if (x >= cx - tw / 2 && x <= cx + tw / 2) {
                    // Check if pointer is in the main tile area (Full height for better hit sensitivity)
                    if (y >= boxY && y <= boxY + th) {
                        if (x < cx) { // Left half of tile -> Previous
                            if (i === 0) { this.selectPreviousDifficulty(); this.playPreview(); }
                            else if (i === 1) this.selectPreviousSpeed();
                            else if (i === 2) this.toggleKeyMode();
                        } else { // Right half of tile -> Next
                            if (i === 0) { this.selectNextDifficulty(); this.playPreview(); }
                            else if (i === 1) this.selectNextSpeed();
                            else if (i === 2) this.toggleKeyMode();
                        }
                    }
                    return;
                }
            }
        }

        // Sort Button (Check near the top of the list panel)
        if (y > layout.listY && y < layout.listY + layout.tabH + (25 * layout.scaleFactor) && x > layout.listX + layout.listW - (130 * layout.scaleFactor)) {
            this.cycleSortMode();
            this.playPreview();
            return;
        }

        // Song Selection
        if (x > layout.listContentX && x < layout.listHitMaxX &&
            y > layout.listInnerY && y < layout.listInnerY + (layout.itemHeight * layout.visibleCount)) {
            const relativeY = y - layout.listInnerY;
            const clickedIndexOffset = Math.floor(relativeY / layout.itemHeight);

            const maxScrollOffset = Math.max(0, this.songList.length - layout.visibleCount);
            let visibleStartIndex = this.selectedSongIndex - Math.floor(layout.visibleCount / 2);
            if (visibleStartIndex < 0) visibleStartIndex = 0;
            if (visibleStartIndex > maxScrollOffset) visibleStartIndex = maxScrollOffset;

            const targetIndex = visibleStartIndex + clickedIndexOffset;
            if (targetIndex >= 0 && targetIndex < this.songList.length) {
                const song = this.songList[targetIndex];

                // Check for Delete Button (on the right side of the item)
                if (song.isCustom) {
                    const delW = 24 * layout.scaleFactor;
                    const delX = layout.listX + (20 * layout.scaleFactor) + (layout.listW - 60 * layout.scaleFactor) - delW - 15 * layout.scaleFactor;
                    if (x >= delX - 15 * layout.scaleFactor && x <= delX + 15 * layout.scaleFactor) {
                        this.deleteUserSong(song.id!);
                        return;
                    }
                }

                if (this.selectedSongIndex !== targetIndex) {
                    this.selectedSongIndex = targetIndex;
                    this.playPreview();
                }
            }
        }
    } // End of handlePointerDown

    public handlePointerMove(_x: number, y: number, width: number, height: number, isMobile: boolean): void {
        if (!this.isDraggingScrollbar) return;

        const layout = computeMenuLayout(width, height, isMobile);
        const scrollbarTrackH = layout.itemHeight * layout.visibleCount;

        // Ensure scrollbar has a defined thumb size
        const thumbH = Math.max(scrollbarTrackH * (layout.visibleCount / Math.max(1, this.songList.length)), 40 * layout.scaleFactor);
        const scrollRange = scrollbarTrackH - thumbH;

        if (scrollRange <= 0) return;

        const deltaY = y - this.dragStartY;
        // How much of the total list does this delta represent?
        const deltaIdx = Math.round((deltaY / scrollRange) * (this.songList.length - 1));

        let newIdx = this.dragStartIdx + deltaIdx;
        newIdx = Math.max(0, Math.min(newIdx, this.songList.length - 1));

        if (this.selectedSongIndex !== newIdx) {
            this.selectedSongIndex = newIdx;
            this.playPreview();
        }
    }

    public handlePointerUp(_x: number, _y: number, _width: number, _height: number, _isMobile: boolean): void {
        this.isDraggingScrollbar = false;
    }

    public stopPreview(): void {
        if (this.previewTimeout) clearTimeout(this.previewTimeout);
        this.audioEngine.stop();
    }

    private triggerFileUpload(): void {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.mid,.midi';
        input.onchange = async (e: any) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    await this.addUserSong(file);
                } catch (err: any) {
                    alert(err.message || "Failed to upload MIDI.");
                }
            }
        };
        input.click();
    }

    public destroy(): void {
        this.stopPreview();
    }
}
