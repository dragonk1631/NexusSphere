import { MidiParser, type ParsedMidi } from '../../../core/audio/MidiParser';
import { LocalSongStorage, type LocalSongMetadata } from '../services/LocalSongStorage';
import { type SongEntry } from '../types/GameTypes';
import { type CoreAudioEngine } from '../../../core/audio/CoreAudioEngine';
import { MenuMusicManager } from '../../../core/audio/MenuMusicManager';
import { SPEED_OPTIONS, DIFFICULTY_OPTIONS } from '../constants/GameConstants';
import { computeMenuLayout } from '../renderer/MenuLayout';
import { AssetLoader } from '../../../core/asset/AssetLoader';
import { MelodyAnalyzer } from '../../../core/audio/MelodyAnalyzer';

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
        
        // --- IRONCLAD: Proactive Library Integrity Sync (v1.3.2) ---
        this.syncLibraryIntegrity();
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
        try {
            const res = await fetch('assets/data/official_songs.json');
            if (!res.ok) throw new Error("Failed to load official songs.");
            const data = await res.json();
            this.officialSongs = data.map((s: any) => ({ ...s, isCustom: false }));
            this.loadFavoriteStates(); 
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
        if (this.songList.length === 0) { this.stopPreview(); return; }
        const currentSong = this.getCurrentSong();
        if (this.currentSongUrl === currentSong.url && this.audioEngine.isPlaying()) return;
        if (this.previewTimeout) clearTimeout(this.previewTimeout);
        MenuMusicManager.getInstance().pauseMusic(true);
        this.audioEngine.stop();
        this.previewMidi = null;

        const previewId = ++this.currentPreviewId;
        this.previewTimeout = setTimeout(async () => {
            if (previewId !== this.currentPreviewId) return;
            try {
                let buffer: ArrayBuffer;
                if (currentSong.isCustom) {
                    const blob = await this.storage.getSongBlob(currentSong.url);
                    if (!blob) return;
                    buffer = await blob.arrayBuffer();
                } else {
                    const res = await fetch(currentSong.url);
                    buffer = await res.arrayBuffer();
                }
                const parsedMidi = await this._midiParser.parse(buffer.slice(0));
                this.previewMidi = parsedMidi;
                const midiName = currentSong.url.split('/').pop()?.replace(/\.mid$/i, '') || 'test';
                const mp3Path = `assets/audio/mp3/${midiName}.mp3`;
                const al = AssetLoader.getInstance();
                if (await al.checkAssetExists(mp3Path)) {
                    const mp3Buffer = await al.loadAudio(mp3Path);
                    await this.audioEngine.loadHybrid(buffer, mp3Buffer);
                } else {
                    await this.audioEngine.loadMidi(buffer);
                }
                this.audioEngine.play();
                this._currentSongUrl = currentSong.url;
            } catch (e) {}
        }, 300);
    }
    private _currentSongUrl = "";
    public get currentSongUrl() { return this._currentSongUrl; }

    public handleKeyboardInput(code: string): void {
        if (this.songList.length === 0) return;
        switch (code) {
            case 'ArrowUp': this.selectedSongIndex = (this.selectedSongIndex - 1 + this.songList.length) % this.songList.length; this.playPreview(); break;
            case 'ArrowDown': this.selectedSongIndex = (this.selectedSongIndex + 1) % this.songList.length; this.playPreview(); break;
            case 'ArrowLeft': this.selectPreviousDifficulty(); break;
            case 'ArrowRight': this.selectNextDifficulty(); break;
            case 'Enter': this.handlePlayRequest(this.getCurrentSong()); break;
        }
    }

    private async handlePlayRequest(song: SongEntry) {
        try {
            await this.ensureSongSynced(song);
            this.callbacks.onPlayRequested();
        } catch (e) {
            console.error("Failed to prepare song:", e);
        }
    }

    public handlePointerDown(x: number, y: number, width: number, height: number, isMobile: boolean): void {
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
        this.audioEngine.stop();
        this.previewMidi = null;
        MenuMusicManager.getInstance().resumeMusic();
    }

    private async syncLibraryIntegrity(): Promise<void> {
        if (this.officialSongs.length === 0) return;
        for (const song of this.officialSongs) {
            const safeName = song.url.split('/').pop()?.replace(/\.mid$/i, '').replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const key = `beatmap_config_${safeName}`;
            const existing = localStorage.getItem(key);
            if (!existing || JSON.parse(existing).version !== "1.3.2") {
                try {
                    if (this.audioEngine.isPlaying() && !this.previewMidi) break;
                    await this.performSyncOperation(song, key);
                } catch (e) {}
            }
        }
    }

    public async ensureSongSynced(song: SongEntry): Promise<void> {
        const safeName = song.url.split('/').pop()?.replace(/\.mid$/i, '').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const key = `beatmap_config_${safeName}`;
        const existing = localStorage.getItem(key);
        if (!existing || JSON.parse(existing).version !== "1.3.2") {
            await this.performSyncOperation(song, key);
        }
    }

    private async performSyncOperation(song: SongEntry, storageKey: string): Promise<void> {
        const res = await fetch(song.url);
        if (!res.ok) return;
        const buffer = await res.arrayBuffer();
        if (new DataView(buffer).getUint32(0) !== 0x4d546864) return;
        const midiData = await this._midiParser.parse(buffer);
        const autoTrackConfig = MelodyAnalyzer.suggestGapFilling(midiData);
        const measureMap = Array.from(autoTrackConfig.entries()).map(([m, t]) => [m, midiData.tracks[t]?.channel ?? 0]);
        localStorage.setItem(storageKey, JSON.stringify({
            version: "1.3.2",
            metadata: { title: midiData.name, bpm: midiData.bpm, duration: midiData.duration },
            measureConfig: measureMap
        }));
    }

    public destroy(): void { this.stopPreview(); }
}
