
import { type ParsedMidi } from '../../../core/audio/MidiParser';
import { type TransitionData } from '../../../core/GameTransition';
import { type BeatmapData } from '../types/BeatmapTypes';
import { type VisualNote } from '../NoteFactory';
import { GameState } from '../types/GameTypes';

/**
 * StageManager holds the data for the current stage/song.
 * It also manages global configuration settings like scroll speed and key mode.
 */
export class StageManager {
    public transitionData: TransitionData | null = null;
    public midiData: ParsedMidi | null = null;
    public beatmapData: BeatmapData | null = null;
    public visualNotes: VisualNote[] = [];

    public isMobile: boolean = false;
    public isTestMode: boolean = false;
    public currentState: GameState = GameState.MENU;

    // Layout (Protected)
    private _horizonY = 0;
    private _bottomY = 0;
    private _hitLineY = 0;
    private _laneBottomWidth = 100;
    private _laneTopWidth = 10;
    private _laneCount = 6;

    get horizonY(): number { return this._horizonY; }
    get bottomY(): number { return this._bottomY; }
    get hitLineY(): number { return this._hitLineY; }
    get laneBottomWidth(): number { return this._laneBottomWidth; }
    get laneTopWidth(): number { return this._laneTopWidth; }
    get laneCount(): number { return this._laneCount; }

    public updateLayout(horizonY: number, bottomY: number, hitLineY: number, laneBottomWidth: number, laneTopWidth: number, laneCount: number): void {
        this._horizonY = horizonY;
        this._bottomY = bottomY;
        this._hitLineY = hitLineY;
        this._laneBottomWidth = laneBottomWidth;
        this._laneTopWidth = laneTopWidth;
        this._laneCount = laneCount;
    }

    // Settings
    public scrollSpeed = 1.0;
    public keyMode: 4 | 6 = 4;

    public reset(): void {
        this.midiData = null;
        this.beatmapData = null;
        this.visualNotes = [];
    }
}
