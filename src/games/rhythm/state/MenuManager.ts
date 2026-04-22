import { MidiParser, type ParsedMidi } from '../../../core/audio/MidiParser';
import { LocalSongStorage, type LocalSongMetadata } from '../services/LocalSongStorage';
import { type SongEntry } from '../types/GameTypes';
import { type CoreAudioEngine } from '../../../core/audio/CoreAudioEngine';
import { MenuMusicManager } from '../../../core/audio/MenuMusicManager';
import { SPEED_OPTIONS, DIFFICULTY_OPTIONS } from '../constants/GameConstants';
import { computeMenuLayout } from '../renderer/MenuLayout';
import { AssetLoader } from '../../../core/asset/AssetLoader';
import { SystemInitializer } from '../../../core/SystemInitializer';
import { MelodyAnalyzer } from '../../../core/audio/MelodyAnalyzer';
import { OfflineDownloadManager } from '../../../core/asset/OfflineDownloadManager';
import { ScoreManager } from '../../../core/score/ScoreManager';

export interface IMenuCallbacks {
    onPlayRequested: () => void;
    onReturnToMainMenu: () => void;
}

/**
 * MenuManager handles the state and logic for the game's menu system.
 * v5.5: Fully Restored & Sanitized Interactive Engine.
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
    
    constructor(audioEngine: CoreAudioEngine, callbacks: IMenuCallbacks) {
        this.audioEngine = audioEngine;
        this.callbacks = callbacks;
        this.initPromise = this.init();

        // Listen for cloud sync completion to refresh favorites UI
        window.addEventListener('nexus-favorites-synced', this.onFavoritesSynced);
    }

    private async init() {
        await this.loadOfficialSongs();
        await this.loadUserSongs();
        this.loadFavoriteStates(); 
        this.sortSongList();
    }

    private onFavoritesSynced = () => {
        this.loadFavoriteStates();
    };

    public loadFavoriteStates() {
        try {
            const sm = ScoreManager.getInstance();
            const applyTo = (list: SongEntry[]) => list.forEach(song => song.isFavorite = sm.isFavorite(song.url));
            applyTo(this.officialSongs);
            applyTo(this.customSongs);
            this.applyFilter();
        } catch (e) {
            console.error("[MenuManager] Failed to load favorites:", e);
        }
    }

    public toggleFavorite(song: SongEntry) {
        try {
            const sm = ScoreManager.getInstance();
            const nextState = !song.isFavorite;
            song.isFavorite = nextState;
            
            // Delegate to ScoreManager for cloud sync and local persistence
            sm.toggleCloudFavorite(song.url, nextState);
            
            // Re-apply filter if in favorite tab
            if (this.currentFilter === 'favorite') this.applyFilter();
        } catch (e) {}
    }

    public async loadOfficialSongs() {
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
            artist: 'Unknown', duration: parsed.duration, bpm: parsed.bpm,
            isCustom: true, createdAt: Date.now(), blobKey
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
        if (currentSong) this.selectedSongIndex = Math.max(0, this.songList.findIndex(s => s.url === currentSong.url));
    }

    public playPreview(): void {
        if (this.songList.length === 0) { this.stopPreview(); this.previewMidi = null; return; }
        if (this.selectedSongIndex < 0 || this.selectedSongIndex >= this.songList.length) this.selectedSongIndex = 0;

        const currentSong = this.songList[this.selectedSongIndex];
        if (this.currentSongUrl === currentSong.url && (this.audioEngine.isPlaying() || this.previewTimeout)) return;

        if (this.previewTimeout) clearTimeout(this.previewTimeout);
        this.audioEngine.resume();

        const previewId = ++this.currentPreviewId;
        this.previewTimeout = setTimeout(async () => {
            if (previewId !== this.currentPreviewId) return;
            MenuMusicManager.getInstance().pauseMusic(true);
            this.audioEngine.stop();
            this.previewMidi = null;

            try {
                let buffer: ArrayBuffer;
                if (currentSong.isCustom) {
                    const blob = await this.storage.getSongBlob(currentSong.url);
                    if (previewId !== this.currentPreviewId) return;
                    if (!blob) throw new Error("Custom MIDI not found.");
                    buffer = await blob.arrayBuffer();
                } else {
                    const res = await OfflineDownloadManager.getInstance().vaultFetch(currentSong.url);
                    if (previewId !== this.currentPreviewId) return;
                    buffer = await res.arrayBuffer();
                }
                if (previewId !== this.currentPreviewId) return;

                this.audioEngine.stop();
                const parsedMidi = await this._midiParser.parse(buffer.slice(0));
                if (previewId !== this.currentPreviewId) return;

                // Normalize notes
                let firstNoteTime = Infinity;
                parsedMidi.tracks.forEach(t => t.notes.forEach(n => { if (n.time < firstNoteTime) firstNoteTime = n.time; }));
                if (firstNoteTime !== Infinity && firstNoteTime > 0) {
                    parsedMidi.tracks.forEach(track => track.notes.forEach(note => (note as any).time -= firstNoteTime));
                }

                if (!currentSong.duration || !currentSong.bpm) {
                    currentSong.duration = parsedMidi.duration;
                    currentSong.bpm = parsedMidi.bpm || 120;
                }

                await this.audioEngine.resume();
                if (previewId !== this.currentPreviewId) return;

                const midiName = decodeURI(currentSong.url).split('/').pop()?.replace(/\.mid$/i, '') || 'test';
                
                // [TRANSITION] Prioritize Full MP3 for high-fidelity previews (Streaming)
                const al = AssetLoader.getInstance();
                
                // Try smart path resolution for full MP3 first
                let actualPath = (currentSong as any).audioUrl || await al.findAudioPath(currentSong.name);
                
                // Fallback to legacy preview path only if necessary
                if (!actualPath) {
                    const previewPath = (currentSong as any).previewUrl || `assets/audio/mp3/previews/${midiName}.mp3`;
                    if (await al.checkAssetExists(previewPath)) {
                        actualPath = previewPath;
                    }
                }
                
                if (actualPath && await al.checkAssetExists(actualPath)) {
                    if (previewId !== this.currentPreviewId) return;
                    
                    // Use STREAMING for full MP3 previews (Low memory, fast start)
                    const player = al.loadAudioStreaming(actualPath);
                    if (previewId !== this.currentPreviewId) return;
                    await this.audioEngine.loadHybrid(buffer, player, (currentSong as any).normalizationGain);
                } else {
                    if (previewId !== this.currentPreviewId) return;
                    await this.audioEngine.loadMidi(buffer);
                }

                if (previewId !== this.currentPreviewId) return;

                // Set initial seek point for preview (Support theme/song highlight)
                const startOff = (currentSong as any).previewStart || 0;
                this.audioEngine.seek(startOff);

                this.audioEngine.setPreviewLoop(true);
                this.previewMidi = parsedMidi;
                this.audioEngine.play();
                this._currentSongUrl = currentSong.url;
            } catch (e) {
                if (previewId === this.currentPreviewId) this.previewMidi = null;
            } finally {
                if (previewId === this.currentPreviewId) this.previewTimeout = null;
            }
        }, 300);
    }

    private _currentSongUrl = "";
    public get currentSongUrl(): string { return this._currentSongUrl; }

    private touchStartY = 0;
    public setTouchStartY(y: number): void { this.touchStartY = y; }

    public handleScroll(y: number): boolean {
        this.audioEngine.resume();
        if (this.songList.length === 0) return false;
        const threshold = 30;
        const shift = Math.trunc((y - this.touchStartY) / threshold);
        if (shift !== 0) {
            this.selectedSongIndex = (this.selectedSongIndex + shift + this.songList.length) % this.songList.length;
            this.touchStartY = y - ((y - this.touchStartY) % threshold);
            this.playPreview();
            return true;
        }
        return false;
    }

    public handleWheel(deltaY: number): void {
        this.audioEngine.resume();
        if (this.songList.length === 0) return;
        this.selectedSongIndex = (this.selectedSongIndex + (deltaY > 0 ? 1 : -1) + this.songList.length) % this.songList.length;
        this.playPreview();
    }

    public selectNextDifficulty(): void { this.audioEngine.resume(); this.selectedDifficultyIndex = (this.selectedDifficultyIndex + 1) % DIFFICULTY_OPTIONS.length; this.playPreview(); }
    public selectPreviousDifficulty(): void { this.audioEngine.resume(); this.selectedDifficultyIndex = (this.selectedDifficultyIndex - 1 + DIFFICULTY_OPTIONS.length) % DIFFICULTY_OPTIONS.length; this.playPreview(); }
    public selectNextSpeed(): void { this.selectedSpeedIndex = (this.selectedSpeedIndex + 1) % SPEED_OPTIONS.length; this.scrollSpeed = SPEED_OPTIONS[this.selectedSpeedIndex]; }
    public selectPreviousSpeed(): void { this.selectedSpeedIndex = (this.selectedSpeedIndex - 1 + SPEED_OPTIONS.length) % SPEED_OPTIONS.length; this.scrollSpeed = SPEED_OPTIONS[this.selectedSpeedIndex]; }
    public toggleKeyMode(): void { this.keyMode = this.keyMode === 4 ? 6 : 4; }
    public cycleSortMode(): void { const modes: ('name' | 'bpm' | 'duration' | 'noteCount')[] = ['name', 'bpm', 'duration', 'noteCount']; const idx = modes.indexOf(this.currentSortMode); this.currentSortMode = modes[(idx + 1) % modes.length]; this.sortSongList(); }

    public getScrollSpeed(): number { return this.scrollSpeed; }
    public getKeyMode(): 4 | 6 { return this.keyMode; }
    public getCurrentSong(): SongEntry { return this.songList[this.selectedSongIndex]; }
    public getCurrentDifficulty(): string { return DIFFICULTY_OPTIONS[this.selectedDifficultyIndex]; }

    public handleKeyboardInput(code: string): void {
        this.audioEngine.resume();
        if (this.songList.length === 0) return;
        switch (code) {
            case 'ArrowUp': this.selectedSongIndex = (this.selectedSongIndex - 1 + this.songList.length) % this.songList.length; this.playPreview(); break;
            case 'ArrowDown': this.selectedSongIndex = (this.selectedSongIndex + 1) % this.songList.length; this.playPreview(); break;
            case 'ArrowLeft': this.selectPreviousDifficulty(); break;
            case 'ArrowRight': this.selectNextDifficulty(); break;
            case 'KeyS': this.selectNextSpeed(); break;
            case 'KeyA': this.selectPreviousSpeed(); break;
            case 'KeyK': this.toggleKeyMode(); break;
            case 'Enter': this.stopPreview(); this.callbacks.onPlayRequested(); break;
        }
    }

    public handlePointerDown(x: number, y: number, width: number, height: number, isMobile: boolean): void {
        this.audioEngine.resume();
        if (!this.audioEngine.isPlaying() && !this.previewTimeout && this.songList.length > 0) this.playPreview();
        const layout = computeMenuLayout(width, height, isMobile);
        const sf = layout.scaleFactor;

        // 1. ACTION BUTTONS (PLAY/BACK)
        if (x >= layout.btnX && x <= layout.btnX + layout.btnW && y >= layout.btnY && y <= layout.btnY + layout.btnH) { this.callbacks.onPlayRequested(); return; }
        if (x >= layout.backBtnX && x <= layout.backBtnX + layout.backBtnW && y >= layout.backBtnY && y <= layout.backBtnY + layout.backBtnH) { this.callbacks.onReturnToMainMenu(); return; }

        // 2. FILTER TABS
        if (x >= layout.tabAreaX && x <= layout.tabAreaX + layout.tabAreaW && y >= layout.tabAreaY && y <= layout.tabAreaY + layout.tabAreaH) {
            const tabIdx = Math.floor((x - layout.tabAreaX) / layout.tabWidth);
            const filters: Array<MenuManager['currentFilter']> = ['all', 'official', 'custom', 'favorite'];
            if (tabIdx >= 0 && tabIdx < filters.length) { this.currentFilter = filters[tabIdx]; this.applyFilter(); return; }
        }

        // 3. OPTIONS HEADER (SORT CYCLE)
        if (x >= layout.leftPanelX && x <= layout.leftPanelX + layout.leftPanelWidth && y >= layout.infoY && y <= layout.infoY + 34 * sf) {
            this.cycleSortMode(); return;
        }

        // 4. OPTIONS GRID (DIFFICULTY/SPEED/KEYMODE) with Left/Right awareness
        if (Math.abs(y - layout.row1CenterY) < layout.hitHeight) {
            if (Math.abs(x - layout.col1CenterX) < layout.hitWidth) {
                if (x < layout.col1CenterX - 5 * sf) this.selectPreviousDifficulty();
                else if (x > layout.col1CenterX + 5 * sf) this.selectNextDifficulty();
                return;
            }
            if (Math.abs(x - layout.col2CenterX) < layout.hitWidth) {
                if (x < layout.col2CenterX - 5 * sf) this.selectPreviousSpeed();
                else if (x > layout.col2CenterX + 5 * sf) this.selectNextSpeed();
                return;
            }
            if (Math.abs(x - layout.col3CenterX) < layout.hitWidth) { this.toggleKeyMode(); return; }
        }

        // 5. FOLDER UPLOAD
        if (x >= layout.folderBtnX && x <= layout.folderBtnX + layout.folderBtnW && y >= layout.folderBtnY && y <= layout.folderBtnY + layout.folderBtnH) {
            this.triggerFolderUpload(); return;
        }

        // 6. SCROLLBAR
        const scX = layout.listX + layout.listW - layout.scrollbarW - 8 * sf;
        if (x >= scX && x <= scX + layout.scrollbarW) {
            this.isDraggingScrollbar = true; this.dragStartY = y; this.dragStartIdx = this.selectedSongIndex; return;
        }

        // 7. SONG LIST ITEMS (FAVORITE/DELETE/SELECT)
        if (x >= layout.listX && x <= layout.listHitMaxX && y > layout.listInnerY && y < layout.listInnerY + (layout.itemHeight * layout.visibleCount)) {
            const relY = y - layout.listInnerY;
            const itemIdxInView = Math.floor(relY / layout.itemHeight);
            const startIndex = Math.max(0, Math.min(this.selectedSongIndex - Math.floor(layout.visibleCount / 2), this.songList.length - layout.visibleCount));
            const actualIdx = startIndex + itemIdxInView;
            
            if (actualIdx >= 0 && actualIdx < this.songList.length) {
                const song = this.songList[actualIdx];
                const itemX = layout.listX + 10 * sf;
                
                // Favorite Star Toggle (Left side of item)
                const boxSize = layout.itemHeight - 24 * sf; 
                const boxPos = itemX + 8 * sf;
                if (x >= boxPos && x <= boxPos + boxSize) { // Star hit box
                    this.toggleFavorite(song); return;
                }

                // Delete Button (Right side, only for Custom + Selected)
                if (song.isCustom && actualIdx === this.selectedSongIndex) {
                    const safeItemW = layout.listW - layout.scrollbarW - 25 * sf;
                    const delX = itemX + safeItemW - 34 * sf;
                    if (x >= delX - 20 * sf) { this.deleteUserSong(song.id!); return; }
                }

                if (this.selectedSongIndex !== actualIdx) { this.selectedSongIndex = actualIdx; this.playPreview(); }
            }
        }
    }

    public handlePointerMove(_x: number, y: number, width: number, height: number, isMobile: boolean): void {
        if (!this.isDraggingScrollbar) return;
        const layout = computeMenuLayout(width, height, isMobile);
        const deltaIdx = Math.round(((y - this.dragStartY) / (layout.itemHeight * layout.visibleCount)) * this.songList.length);
        const newIdx = Math.max(0, Math.min(this.dragStartIdx + deltaIdx, this.songList.length - 1));
        if (this.selectedSongIndex !== newIdx) { this.selectedSongIndex = newIdx; this.playPreview(); }
    }

    public handlePointerUp(): void { this.isDraggingScrollbar = false; }

    public stopPreview(): void {
        if (this.previewTimeout) clearTimeout(this.previewTimeout);
        this.audioEngine.setPreviewLoop(false);
        this.audioEngine.stop();
        this.previewMidi = null;
        MenuMusicManager.getInstance().resumeMusic();
    }

    private triggerFolderUpload(): void {
        const input = document.createElement('input');
        input.type = 'file';
        (input as any).webkitdirectory = true;
        input.onchange = (e: any) => { const files = e.target.files; if (files && files.length > 0) this.handleFileDrop(files); };
        input.click();
    }

    public async ensureSongSynced(song: SongEntry): Promise<void> {
        const midiName = song.url.split('/').pop()?.replace(/\.mid$/i, '') || 'unknown';
        const safeName = encodeURIComponent(midiName).replace(/%/g, '_').toLowerCase();
        const key = `beatmap_config_${safeName}_v133`;
        const existing = localStorage.getItem(key);
        if (!existing || JSON.parse(existing).version !== "1.3.3") await this.performSyncOperation(song, key);
    }

    private async performSyncOperation(song: SongEntry, storageKey: string): Promise<void> {
        const res = await OfflineDownloadManager.getInstance().vaultFetch(song.url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buffer = await res.arrayBuffer();
        const midiData = await this._midiParser.parse(buffer);
        const autoTrackConfig = MelodyAnalyzer.suggestGapFilling(midiData);
        const measureMap = Array.from(autoTrackConfig.entries()).map(([m, t]) => [m, midiData.tracks[t]?.channel ?? 0]);
        localStorage.setItem(storageKey, JSON.stringify({ version: "1.3.3", metadata: { title: midiData.name, bpm: midiData.bpm, duration: midiData.duration }, measureConfig: measureMap }));
    }

    public destroy(): void { 
        this.stopPreview(); 
        window.removeEventListener('nexus-favorites-synced', this.onFavoritesSynced);
    }
}
