import { MidiParser, type ParsedMidi } from '../../../core/audio/MidiParser';
import { LocalSongStorage, type LocalSongMetadata } from '../services/LocalSongStorage';
import { type SongEntry } from '../types/GameTypes';
import { type CoreAudioEngine } from '../../../core/audio/CoreAudioEngine';
import { MenuMusicManager } from '../../../core/audio/MenuMusicManager';
import { SPEED_OPTIONS, DIFFICULTY_OPTIONS } from '../constants/GameConstants';
import { computeMenuLayout } from '../renderer/MenuLayout';
import { AssetLoader } from '../../../core/asset/AssetLoader';
import { MelodyAnalyzer } from '../../../core/audio/MelodyAnalyzer';
import { GameState } from '../types/GameTypes';

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
    private gameState: GameState = GameState.MENU;
    
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
        this.loadFavoriteStates(); // Load favorites into the newly loaded lists
        this.sortSongList();
        
        // --- IRONCLAD: Proactive Library Integrity Sync (v1.3.2) ---
        this.syncLibraryIntegrity();
    }

    private setState(state: GameState) {
        this.gameState = state;
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

            console.log(`[MenuManager] Loaded ${favoriteSet.size} favorites from localStorage`);
            this.applyFilter();
        } catch (e) {
            console.error("[MenuManager] Failed to load favorites from localStorage:", e);
        }
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
            if (this.audioEngine.isPlaying() && !this.previewMidi) {
                break; 
            }
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
        } else if (this.currentFilter === 'favorite') {
            baseList = [...this.officialSongs, ...this.customSongs].filter(s => s.isFavorite);
        }
        this.songList = baseList;
        this.sortSongList();
    }

    public async addUserSong(file: File): Promise<void> {
        try {
            const buffer = await file.arrayBuffer();
            const header = new Uint8Array(buffer.slice(0, 4));
            const isMidi = header[0] === 0x4D && header[1] === 0x54 && header[2] === 0x68 && header[3] === 0x64;
            if (!isMidi) throw new Error("Invalid MIDI file format.");
            const parser = new MidiParser();
            const parsed = await parser.parse(buffer, file.name);
            const id = `custom_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
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
            this.toastMessage = "곡이 추가되었습니다!";
            this.toastTimer = 2500;
        } catch (err: any) {
            this.toastMessage = err.message || "곡 추가 실패";
            this.toastTimer = 3000;
            throw err;
        }
    }

    public async handleFileDrop(files: FileList): Promise<void> {
        let addedCount = 0;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.name.toLowerCase().endsWith('.mid') || file.name.toLowerCase().endsWith('.midi')) {
                try {
                    await this.addUserSong(file);
                    addedCount++;
                } catch (e) {
                    console.warn(`[MenuManager] Failed to add dropped file ${file.name}:`, e);
                }
            }
        }
        if (addedCount > 0) {
            this.currentFilter = 'custom';
            this.applyFilter();
        }
    }

    public async deleteUserSong(id: string): Promise<void> {
        const song = this.customSongs.find(s => s.id === id);
        if (!song) return;
        this.stopPreview();
        await this.storage.deleteSong(id, song.url);
        await this.loadUserSongs();
        if (this.selectedSongIndex >= this.songList.length) {
            this.selectedSongIndex = Math.max(0, this.songList.length - 1);
        }
        this.playPreview();
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
        if (this.selectedSongIndex < 0 || this.selectedSongIndex >= this.songList.length) {
            this.selectedSongIndex = 0;
        }
        const currentSong = this.songList[this.selectedSongIndex];
        if (this.currentSongUrl === currentSong.url && this.audioEngine.isPlaying()) return;
        if (this.previewTimeout) clearTimeout(this.previewTimeout);
        MenuMusicManager.getInstance().pauseMusic(true);
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
                const parsedMidi = await this._midiParser.parse(buffer.slice(0));
                let firstNoteTime = Infinity;
                for (const track of parsedMidi.tracks) {
                    for (const note of track.notes) {
                        if (note.time < firstNoteTime) firstNoteTime = note.time;
                    }
                }
                if (firstNoteTime !== Infinity && firstNoteTime > 0) {
                    for (const track of parsedMidi.tracks) {
                        for (const note of track.notes) {
                            (note as any).time -= firstNoteTime;
                        }
                    }
                }
                if (!currentSong.duration || !currentSong.bpm) {
                    currentSong.duration = parsedMidi.duration;
                    currentSong.bpm = parsedMidi.bpm || 120;
                }
                const midiName = currentSong.url.split('/').pop()?.replace(/\.mid$/i, '') || 'test';
                const mp3Path = `assets/audio/mp3/${midiName}.mp3`;
                const al = AssetLoader.getInstance();
                if (await al.checkAssetExists(mp3Path)) {
                    const mp3Buffer = await al.loadAudio(mp3Path);
                    await this.audioEngine.loadHybrid(buffer, mp3Buffer);
                    this.audioEngine.setHybridVolume((currentSong as any).volume ?? 1.0);
                } else {
                    await this.audioEngine.loadMidi(buffer);
                }
                this.audioEngine.startPreciseTime(0);
                this.previewMidi = parsedMidi;
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

    public handleKeyboardInput(code: string): void {
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
            case 'Enter':
                this.handlePlayRequest(this.getCurrentSong());
                break;
        }
    }

    private async handlePlayRequest(song: SongEntry) {
        try {
            await this.ensureSongSynced(song);
            this.callbacks.onPlayRequested();
            this.setState(GameState.LOADING);
        } catch (e) {
            console.error("Failed to prepare song:", e);
        }
    }

    public handlePointerDown(x: number, y: number, width: number, height: number, isMobile: boolean): void {
        const layout = computeMenuLayout(width, height, isMobile);
        if (x >= layout.btnX && x <= layout.btnX + layout.btnW &&
            y >= layout.btnY && y <= layout.btnY + layout.btnH) {
            this.handlePlayRequest(this.getCurrentSong());
            return;
        }
        if (x >= layout.backBtnX && x <= layout.backBtnX + layout.backBtnW &&
            y >= layout.backBtnY && y <= layout.backBtnY + layout.backBtnH) {
            this.callbacks.onReturnToMainMenu();
            return;
        }
        // Simplified selection for speed/difficulty/keymode
        if (Math.abs(y - layout.row1CenterY) < layout.hitHeight) {
            const centers = [layout.col1CenterX, layout.col2CenterX, layout.col3CenterX];
            for (let i = 0; i < 3; i++) {
                if (Math.abs(x - centers[i]) < layout.hitWidth) {
                    if (i === 0) this.selectNextDifficulty();
                    else if (i === 1) this.selectNextSpeed();
                    else if (i === 2) this.toggleKeyMode();
                    this.playPreview();
                    return;
                }
            }
        }
        // Song Selection
        if (y > layout.listInnerY && y < layout.listInnerY + (layout.itemHeight * layout.visibleCount)) {
            const relativeY = y - layout.listInnerY;
            const clickedIndexOffset = Math.floor(relativeY / layout.itemHeight);
            const maxScrollOffset = Math.max(0, this.songList.length - layout.visibleCount);
            let visibleStartIndex = this.selectedSongIndex - Math.floor(layout.visibleCount / 2);
            if (visibleStartIndex < 0) visibleStartIndex = 0;
            if (visibleStartIndex > maxScrollOffset) visibleStartIndex = maxScrollOffset;
            const targetIndex = visibleStartIndex + clickedIndexOffset;
            if (targetIndex >= 0 && targetIndex < this.songList.length) {
                if (this.selectedSongIndex !== targetIndex) {
                    this.selectedSongIndex = targetIndex;
                    this.playPreview();
                }
            }
        }
    }

    public selectNextDifficulty(): void { this.selectedDifficultyIndex = (this.selectedDifficultyIndex + 1) % DIFFICULTY_OPTIONS.length; }
    public selectPreviousDifficulty(): void { this.selectedDifficultyIndex = (this.selectedDifficultyIndex - 1 + DIFFICULTY_OPTIONS.length) % DIFFICULTY_OPTIONS.length; }
    public selectNextSpeed(): void { this.selectedSpeedIndex = (this.selectedSpeedIndex + 1) % SPEED_OPTIONS.length; this.scrollSpeed = SPEED_OPTIONS[this.selectedSpeedIndex]; }
    public selectPreviousSpeed(): void { this.selectedSpeedIndex = (this.selectedSpeedIndex - 1 + SPEED_OPTIONS.length) % SPEED_OPTIONS.length; this.scrollSpeed = SPEED_OPTIONS[this.selectedSpeedIndex]; }
    public toggleKeyMode(): void { this.keyMode = this.keyMode === 4 ? 6 : 4; }

    public getCurrentSong(): SongEntry { return this.songList[this.selectedSongIndex]; }
    public stopPreview(): void {
        if (this.previewTimeout) clearTimeout(this.previewTimeout);
        this.audioEngine.stop();
        this.previewMidi = null;
        MenuMusicManager.getInstance().resumeMusic();
    }

    private async syncLibraryIntegrity(): Promise<void> {
        if (this.officialSongs.length === 0) return;
        console.log(`[MenuManager] Integrity Sync: Scanning ${this.officialSongs.length} official songs...`);
        let syncedCount = 0;
        let skipCount = 0;
        for (const song of this.officialSongs) {
            const strippedName = song.url.split('/').pop()?.replace(/\.mid$/i, '') || 'unknown';
            const safeName = strippedName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const storageKey = `beatmap_config_${safeName}`;
            const existingStr = localStorage.getItem(storageKey);
            let needsSync = true;
            if (existingStr) {
                try {
                    const parsed = JSON.parse(existingStr);
                    if (parsed.version === "1.3.2") { needsSync = false; skipCount++; }
                } catch (e) {}
            }
            if (needsSync) {
                try {
                    if (syncedCount % 3 === 0) await new Promise(r => setTimeout(r, 150));
                    if (this.audioEngine.isPlaying() && !this.previewMidi) break;
                    await this.performSyncOperation(song, storageKey);
                    syncedCount++;
                } catch (err) { console.error(`[MenuManager] Integrity Sync Error:`, err); }
            }
        }
        console.log(`[MenuManager] Integrity Sync Complete. (Synced: ${syncedCount}, Already Valid: ${skipCount})`);
    }

    public async ensureSongSynced(song: SongEntry): Promise<void> {
        const strippedName = song.url.split('/').pop()?.replace(/\.mid$/i, '') || 'unknown';
        const safeName = strippedName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const storageKey = `beatmap_config_${safeName}`;
        const existingStr = localStorage.getItem(storageKey);
        if (existingStr) {
            try {
                const parsed = JSON.parse(existingStr);
                if (parsed.version === "1.3.2") return;
            } catch (e) {}
        }
        console.log(`[MenuManager] JIT Sync for ${song.name}...`);
        await this.performSyncOperation(song, storageKey);
    }

    private async performSyncOperation(song: SongEntry, storageKey: string): Promise<void> {
        const res = await fetch(song.url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buffer = await res.arrayBuffer();
        const view = new DataView(buffer);
        if (buffer.byteLength < 4 || view.getUint32(0) !== 0x4d546864) throw new Error(`Invalid MIDI`);
        const midiData = await this._midiParser.parse(buffer);
        const autoTrackConfig = MelodyAnalyzer.suggestGapFilling(midiData);
        const measureMap = new Map<number, number>();
        autoTrackConfig.forEach((tIdx, mIdx) => {
            const track = midiData.tracks[tIdx];
            if (track) measureMap.set(mIdx, track.channel);
        });
        const outputData = {
            version: "1.3.2",
            metadata: { title: midiData.name, bpm: midiData.bpm, duration: midiData.duration },
            measureConfig: Array.from(measureMap.entries())
        };
        localStorage.setItem(storageKey, JSON.stringify(outputData));
    }

    public destroy(): void { this.stopPreview(); }
}
