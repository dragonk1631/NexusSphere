import { type SongEntry } from '../types/GameTypes';
import { type CoreAudioEngine } from '../../../core/audio/CoreAudioEngine';
import { SPEED_OPTIONS, DIFFICULTY_OPTIONS } from '../constants/GameConstants';
import { computeMenuLayout } from '../renderer/MenuLayout';
import { MidiParser, type ParsedMidi } from '../../../core/audio/MidiParser';

export interface IMenuCallbacks {
    onPlayRequested: () => void;
    onReturnToMainMenu: () => void;
}

/**
 * MenuManager handles the state and logic for the game's menu system.
 * It manages song selection, options, and playback previews.
 */
export class MenuManager {
    public songList: SongEntry[] = [
        { name: "Neon Drift", bpm: 128, url: "assets/audio/neon_drift.mid", difficulty: 3 },
        { name: "Cyber Pulse", bpm: 145, url: "assets/audio/cyber_pulse.mid", difficulty: 5 },
        { name: "Midnight City", bpm: 110, url: "assets/audio/midnight_city.mid", difficulty: 2 },
        { name: "Digital Love", bpm: 120, url: "assets/audio/digital_love.mid", difficulty: 4 },
        { name: "System Overload", bpm: 180, url: "assets/audio/system_overload.mid", difficulty: 8 }
    ];

    public selectedSongIndex = 0;
    public currentSortMode: 'name' | 'bpm' | 'duration' | 'noteCount' = 'name';
    public selectedSpeedIndex = 1; // Default 1.0x
    public selectedDifficultyIndex = 1; // Default NORMAL
    public scrollSpeed = 1.0;
    public keyMode: 4 | 6 = 4;
    public menuAnimationTimer = 0;

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
        this.sortSongList();
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
        if (this.currentSongUrl === this.songList[this.selectedSongIndex].url && this.audioEngine.isPlaying()) return;

        if (this.previewTimeout) clearTimeout(this.previewTimeout);
        this.audioEngine.stop();

        const previewId = ++this.currentPreviewId;
        const currentSong = this.songList[this.selectedSongIndex];

        this.previewTimeout = setTimeout(async () => {
            if (previewId !== this.currentPreviewId) return;
            try {
                const res = await fetch(currentSong.url);
                const buffer = await res.arrayBuffer();
                // Parse MIDI first so the EQ visualizer has data
                this.previewMidi = await this._midiParser.parse(buffer.slice(0));
                await this.audioEngine.loadMidi(buffer);
                // CRITICAL: Reset precise time anchor to 0 before playback starts.
                // This ensures the EQ visualizer reads the correct playhead in sync.
                this.audioEngine.startPreciseTime(0);
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

    public destroy(): void {
        this.stopPreview();
    }
}
