import { MidiParser, type ParsedMidi } from '../../../core/audio/MidiParser';
import { LocalSongStorage, type LocalSongMetadata } from '../services/LocalSongStorage';
import { type SongEntry } from '../types/GameTypes';
import { type CoreAudioEngine } from '../../../core/audio/CoreAudioEngine';
import { MenuMusicManager } from '../../../core/audio/MenuMusicManager';
import { SPEED_OPTIONS, DIFFICULTY_OPTIONS } from '../constants/GameConstants';
import { computeMenuLayout } from '../renderer/MenuLayout';
import { AssetLoader } from '../../../core/asset/AssetLoader';
import { resolveAssetPath } from '../../../core/utils/PathUtils';
import { SystemInitializer } from '../../../core/SystemInitializer';

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
    public keyMode: 4 | 6 = 6;
    public menuAnimationTimer = 0;
    public currentFilter: 'all' | 'official' | 'custom' | 'favorite' = 'all';

    private storage = new LocalSongStorage();
    private readonly FAVORITES_STORAGE_KEY = 'NexusSphere_Favorites_v2';
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

    // -- Toast Feedback --
    public toastMessage: string | null = null;
    public toastTimer = 0;

    public initPromise: Promise<void> | null = null;
    
    constructor(
        audioEngine: CoreAudioEngine,
        callbacks: IMenuCallbacks
    ) {
        this.audioEngine = audioEngine;
        this.callbacks = callbacks;
        this.initPromise = this.init();
    }

    private async init() {
        await this.loadOfficialSongs();
        await this.loadUserSongs();
        this.loadFavoriteStates(); 
        this.sortSongList();
        
        // --- IRONCLAD: Library Sync moved to SystemInitializer ---
        // Integrity sync is now performed during the Title -> Menu transition.
    }

    public loadFavoriteStates() {
        try {
            const favoritesJson = localStorage.getItem(this.FAVORITES_STORAGE_KEY);
            const favorites = favoritesJson ? JSON.parse(favoritesJson) : [];
            const favoriteSet = new Set(favorites);
            
            const applyTo = (list: SongEntry[]) => {
                list.forEach(song => {
                    song.isFavorite = favoriteSet.has(song.url);
                });
            };

            applyTo(this.officialSongs);
            applyTo(this.customSongs);
            this.applyFilter();
        } catch (e) {
            console.error("[MenuManager] Failed to load favorites:", e);
        }
    }

    public async loadOfficialSongs() {
        // PROFESSIONAL: We now consume the pre-verified list from the SystemInitializer.
        // This list has already been probed for 404s and normalized to NFD if needed.
        const si = SystemInitializer.getInstance();
        this.officialSongs = [...si.getVerifiedSongs()];
        this.loadFavoriteStates();
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
            this.loadFavoriteStates(); 
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
            await new Promise(r => setTimeout(r, 400)); 
            if (this.audioEngine.isPlaying() && !this.previewMidi) break;
            try {
                const blob = await this.storage.getSongBlob(s.url);
                if (blob) {
                    const buffer = await blob.arrayBuffer();
                    if (this.audioEngine.isPlaying() && !this.previewMidi) break;
                    const parsed = await this._midiParser.parse(buffer);
                    s.duration = parsed.duration;
                    s.bpm = parsed.bpm || 120;
                    await this.storage.updateSongMetadata(s.id!, { duration: s.duration, bpm: s.bpm });
                }
            } catch (e) {}
        }
        this._isQueueRunning = false;
    }

    public applyFilter() {
        let baseList = [...this.officialSongs, ...this.customSongs];
        if (this.currentFilter === 'official') baseList = this.officialSongs;
        else if (this.currentFilter === 'custom') baseList = this.customSongs;
        else if (this.currentFilter === 'favorite') baseList = baseList.filter(s => s.isFavorite);
        this.songList = baseList;
        this.sortSongList();
    }

    public async addUserSong(file: File): Promise<void> {
        const buffer = await file.arrayBuffer();
        const parser = new MidiParser();
        const parsed = await parser.parse(buffer, file.name);
        const id = `custom_${Date.now()}`;
        const blobKey = `file_${id}`;
        const metadata: LocalSongMetadata = {
            id,
            title: parsed.name.replace(/\.[^/.]+$/, ""),
            artist: 'Unknown',
            duration: parsed.duration,
            bpm: parsed.bpm,
            isCustom: true,
            createdAt: Date.now(),
            blobKey
        };
        await this.storage.saveSong(metadata, new Blob([buffer]));
        await this.loadUserSongs();
        this.currentFilter = 'custom';
        this.applyFilter();
    }

    public async handleFileDrop(files: FileList): Promise<void> {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.name.toLowerCase().endsWith('.mid')) await this.addUserSong(file);
        }
    }

    public async deleteUserSong(id: string): Promise<void> {
        const song = this.customSongs.find(s => s.id === id);
        if (!song) return;
        this.stopPreview();
        await this.storage.deleteSong(id, song.url);
        await this.loadUserSongs();
    }

    public update(delta: number): void {
        this.menuAnimationTimer += delta * 0.001;
        if (this.toastTimer > 0) {
            this.toastTimer -= delta;
            if (this.toastTimer <= 0) this.toastMessage = null;
        }
    }

    public sortSongList(): void {
        const currentSong = this.songList[this.selectedSongIndex];
        if (this.currentSortMode === 'name') this.songList.sort((a, b) => a.name.localeCompare(b.name));
        else if (this.currentSortMode === 'bpm') this.songList.sort((a, b) => (a.bpm || 0) - (b.bpm || 0));
        if (currentSong) this.selectedSongIndex = Math.max(0, this.songList.findIndex(s => s.name === currentSong.name));
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
        
        // [REDUNDANCY FIX] Tighten check: If same song is ALREADY PLAYING or still loading, don't restart.
        if (this.currentSongUrl === currentSong.url && (this.audioEngine.isPlaying() || this.previewTimeout)) return;

        if (this.previewTimeout) clearTimeout(this.previewTimeout);
        
        // UNBLOCK: RESUME IMMEDIATELY on the user interaction stack.
        this.audioEngine.resume();

        const previewId = ++this.currentPreviewId;
        this.previewTimeout = setTimeout(async () => {
            if (previewId !== this.currentPreviewId) return;
            
            // PROFESSIONAL: Pause theme and stop old MIDI *only* when the new one is ready to start parsing.
            // This prevents silence gaps during fast scrolling.
            MenuMusicManager.getInstance().pauseMusic(true);
            this.audioEngine.stop();
            this.previewMidi = null;

            try {
                let buffer: ArrayBuffer;
                if (currentSong.isCustom) {
                    const blob = await this.storage.getSongBlob(currentSong.url);
                    if (previewId !== this.currentPreviewId) return;
                    if (!blob) throw new Error("Custom MIDI file not found in storage.");
                    buffer = await blob.arrayBuffer();
                } else {
                    const res = await fetch(resolveAssetPath(currentSong.url));
                    if (previewId !== this.currentPreviewId) return;
                    buffer = await res.arrayBuffer();
                }
                if (previewId !== this.currentPreviewId) return;

                // 0. Final safety check before heavy processing
                this.audioEngine.stop();

                // 1. Parse MIDI
                const parsedMidi = await this._midiParser.parse(buffer.slice(0));
                if (previewId !== this.currentPreviewId) return;

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
                await this.audioEngine.resume();
                if (previewId !== this.currentPreviewId) return;

                // 5. Probe Audio
                const al = AssetLoader.getInstance();
                const explicitMp3 = (currentSong as any).audioUrl;
                const midiName = decodeURI(currentSong.url).split('/').pop()?.replace(/\.mid$/i, '') || 'test';
                
                // [WEB OPTIMIZATION] Try low-bitrate preview first
                const previewPath = `assets/audio/mp3/previews/${midiName}.mp3`;
                const originalPath = explicitMp3 || `assets/audio/mp3/${midiName}.mp3`;
                
                let mp3Path = originalPath;
                if (await al.checkAssetExists(previewPath)) {
                    mp3Path = previewPath;
                    console.log(`[MenuManager] Using low-bitrate preview: ${previewPath}`);
                } else {
                    console.log(`[MenuManager] Preview not found, falling back to original: ${originalPath}`);
                }
                
                if (await al.checkAssetExists(mp3Path)) {
                    if (previewId !== this.currentPreviewId) return;
                    const mp3Buffer = await al.loadAudio(mp3Path);
                    if (previewId !== this.currentPreviewId) return;
                    await this.audioEngine.loadHybrid(buffer, mp3Buffer);
                } else {
                    if (previewId !== this.currentPreviewId) return;
                    await this.audioEngine.loadMidi(buffer);
                }

                if (previewId !== this.currentPreviewId) return;

                // 6. ATOMIC UPDATE: Synchronize state switch
                // We reset time and set MIDI data only when audio is actually ready to emit sound.
                this.audioEngine.startPreciseTime(0);
                this.audioEngine.setPreviewLoop(true); // START Natural Loop with Fades
                this.previewMidi = parsedMidi; // Atomic switch: visualizer now sees the new, normalized data

                this.audioEngine.play();
                this._currentSongUrl = currentSong.url;
            } catch (e) {
                if (previewId === this.currentPreviewId) {
                    console.warn("Failed to play preview:", e);
                    this.previewMidi = null;
                }
            } finally {
                // Clear the timeout reference if this was the latest request
                if (previewId === this.currentPreviewId) {
                    this.previewTimeout = null;
                }
            }
        }, 300);
    }

    private _currentSongUrl: string = "";
    public get currentSongUrl(): string { return this._currentSongUrl; }

    public setTouchStartY(y: number): void {
        this.touchStartY = y;
    }

    public handleScroll(y: number): boolean {
        this.audioEngine.resume();
        if (this.songList.length === 0) return false;
        const diffY = y - this.touchStartY;
        const threshold = 30;
        const shift = Math.trunc(diffY / threshold);
        if (shift !== 0) {
            this.selectedSongIndex = (this.selectedSongIndex + shift) % this.songList.length;
            if (this.selectedSongIndex < 0) this.selectedSongIndex += this.songList.length;
            this.touchStartY = y - (diffY % threshold);
            this.playPreview();
            return true;
        }
        return false;
    }

    public handleWheel(deltaY: number): void {
        this.audioEngine.resume();
        if (this.songList.length === 0) return;
        if (deltaY > 0) {
            this.selectedSongIndex = (this.selectedSongIndex + 1) % this.songList.length;
        } else {
            this.selectedSongIndex = (this.selectedSongIndex - 1 + this.songList.length) % this.songList.length;
        }
        this.playPreview();
    }

    public selectNextDifficulty(): void {
        this.audioEngine.resume();
        this.selectedDifficultyIndex = Math.min(DIFFICULTY_OPTIONS.length - 1, this.selectedDifficultyIndex + 1);
    }

    public selectPreviousDifficulty(): void {
        this.audioEngine.resume();
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
        this.audioEngine.resume();
        if (this.songList.length === 0) return;
        switch (code) {
            case 'ArrowUp':
                this.selectedSongIndex = (this.selectedSongIndex - 1 + this.songList.length) % this.songList.length;
                this.playPreview();
                break;
            case 'ArrowDown':
                this.selectedSongIndex = (this.selectedSongIndex + 1) % this.songList.length;
                this.playPreview();
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
        this.audioEngine.resume();
        
        // [STABILITY RESCUE] If first song preview was blocked by autoplay, interaction rescues it
        if (!this.audioEngine.isPlaying() && !this.previewTimeout && this.songList.length > 0) {
            this.playPreview();
        }

        const layout = computeMenuLayout(width, height, isMobile);
        if (x >= layout.btnX && x <= layout.btnX + layout.btnW && y >= layout.btnY && y <= layout.btnY + layout.btnH) {
            this.handlePlayRequest(this.getCurrentSong());
            return;
        }
        if (x >= layout.backBtnX && x <= layout.backBtnX + layout.backBtnW && y >= layout.backBtnY && y <= layout.backBtnY + layout.backBtnH) {
            this.callbacks.onReturnToMainMenu();
            return;
        }

        // Scrollbar hit detection
        const scrollbarX = layout.listX + layout.listW - (20 * layout.scaleFactor);
        const scrollbarW = 15 * layout.scaleFactor;
        if (x >= scrollbarX && x <= scrollbarX + scrollbarW) {
            this.isDraggingScrollbar = true;
            this.dragStartY = y;
            this.dragStartIdx = this.selectedSongIndex;
            return;
        }

        if (y > layout.listInnerY && y < layout.listInnerY + (layout.itemHeight * layout.visibleCount)) {
            const relY = y - layout.listInnerY;
            const idx = Math.floor(relY / layout.itemHeight);
            const target = idx + Math.max(0, this.selectedSongIndex - Math.floor(layout.visibleCount / 2));
            if (target >= 0 && target < this.songList.length) {
                if (this.selectedSongIndex !== target) {
                    this.selectedSongIndex = target;
                    this.playPreview();
                }
            }
        }
    }

    public handlePointerMove(_x: number, y: number, width: number, height: number, isMobile: boolean): void {
        if (!this.isDraggingScrollbar) return;
        const layout = computeMenuLayout(width, height, isMobile);
        const deltaIdx = Math.round(((y - this.dragStartY) / (layout.itemHeight * layout.visibleCount)) * this.songList.length);
        const newIdx = Math.max(0, Math.min(this.dragStartIdx + deltaIdx, this.songList.length - 1));
        if (this.selectedSongIndex !== newIdx) {
            this.selectedSongIndex = newIdx;
            this.playPreview();
        }
    }

    public handlePointerUp(_x: number, _y: number, _width: number, _height: number, _isMobile: boolean): void {
        this.isDraggingScrollbar = false;
    }
    public handleWheel(deltaY: number): void {
        if (this.songList.length === 0) return;
        this.selectedSongIndex = (this.selectedSongIndex + (deltaY > 0 ? 1 : -1) + this.songList.length) % this.songList.length;
        this.playPreview();
    }

    // --- RE-IMPLEMENTING MISSING PUBLIC INTERFACES ---
    public selectNextDifficulty(): void { this.selectedDifficultyIndex = (this.selectedDifficultyIndex + 1) % DIFFICULTY_OPTIONS.length; this.playPreview(); }
    public selectPreviousDifficulty(): void { this.selectedDifficultyIndex = (this.selectedDifficultyIndex - 1 + DIFFICULTY_OPTIONS.length) % DIFFICULTY_OPTIONS.length; this.playPreview(); }
    public selectNextSpeed(): void { this.selectedSpeedIndex = (this.selectedSpeedIndex + 1) % SPEED_OPTIONS.length; this.scrollSpeed = SPEED_OPTIONS[this.selectedSpeedIndex]; }
    public selectPreviousSpeed(): void { this.selectedSpeedIndex = (this.selectedSpeedIndex - 1 + SPEED_OPTIONS.length) % SPEED_OPTIONS.length; this.scrollSpeed = SPEED_OPTIONS[this.selectedSpeedIndex]; }
    public toggleKeyMode(): void { this.keyMode = this.keyMode === 4 ? 6 : 4; }

    public getCurrentSong(): SongEntry { return this.songList[this.selectedSongIndex]; }
    public getCurrentDifficulty(): string { return DIFFICULTY_OPTIONS[this.selectedDifficultyIndex]; }
    public getKeyMode(): 4 | 6 { return this.keyMode; }
    public getScrollSpeed(): number { return this.scrollSpeed; }

    public stopPreview(): void {
        if (this.previewTimeout) clearTimeout(this.previewTimeout);
        this.audioEngine.setPreviewLoop(false); // STOP Natural Loop
        this.audioEngine.stop();
        this.previewMidi = null;
        MenuMusicManager.getInstance().resumeMusic();
    }

    private triggerFolderUpload(): void {
        const input = document.createElement('input');
        input.type = 'file';
        (input as any).webkitdirectory = true;
        input.onchange = (e: any) => {
            const files = e.target.files;
            if (files && files.length > 0) this.handleFileDrop(files);
        };
        input.click();
    }

    /**
     * IRONCLAD: Library Integrity Sync (v1.3)
     * Proactively scans all official songs for missing or outdated configurations.
     * This ensures 100% chart accuracy before the user even selects a song.
     */

    public async ensureSongSynced(song: SongEntry): Promise<void> {
        const midiName = song.url.split('/').pop()?.replace(/\.mid$/i, '') || 'unknown';
        const safeName = encodeURIComponent(midiName).replace(/%/g, '_').toLowerCase();
        // Use v133 suffix to ensure we don't pick up the old corrupted ____ configs
        const key = `beatmap_config_${safeName}_v133`;
        const existing = localStorage.getItem(key);
        if (!existing || JSON.parse(existing).version !== "1.3.3") {
            await this.performSyncOperation(song, key);
        }
    }

    private async performSyncOperation(song: SongEntry, storageKey: string): Promise<void> {
        // PROFESSIONAL: URI encode the URL to prevent 404s on GitHub Pages for Korean filenames
        const encodedUrl = song.url.split('/').map(part => part.includes('.') ? part : encodeURIComponent(part)).join('/');
        
        const res = await fetch(encodedUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buffer = await res.arrayBuffer();
        if (new DataView(buffer).getUint32(0) !== 0x4d546864) throw new Error(`Invalid MIDI`);
        const midiData = await this._midiParser.parse(buffer);
        const autoTrackConfig = MelodyAnalyzer.suggestGapFilling(midiData);
        const measureMap = Array.from(autoTrackConfig.entries()).map(([m, t]) => [m, midiData.tracks[t]?.channel ?? 0]);
        localStorage.setItem(storageKey, JSON.stringify({
            version: "1.3.3",
            metadata: { title: midiData.name, bpm: midiData.bpm, duration: midiData.duration },
            measureConfig: measureMap
        }));
    }

    public destroy(): void { this.stopPreview(); }
}
