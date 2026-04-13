import { type TransitionData } from '../../../core/GameTransition';
import { type ScoreManager } from '../../../core/score/ScoreManager';
import { type ParsedMidi } from '../../../core/audio/MidiParser';

/**
 * GameState enum for the rhythm game.
 */
export const GameState = {
    MENU: 0,
    PLAYING: 1,
    RESULT: 2,
    GAMEOVER: 3,
    PAUSED: 4,
    LOADING: 5
} as const;
export type GameState = typeof GameState[keyof typeof GameState];

/**
 * Judgment levels for notes.
 * Numeric values are used for faster comparison and memory efficiency.
 */
export const Judgment = {
    PERFECT: 0,
    GREAT: 1,
    GOOD: 2,
    MISS: 3
} as const;
export type Judgment = typeof Judgment[keyof typeof Judgment];

/**
 * Basic song information used in menus and loading.
 */
export interface SongEntry {
    id?: string;
    name: string;
    url: string;
    audioUrl?: string; // Explicit MP3 path to avoid guessing
    beatmapUrl?: string; // Explicit JSON path to avoid guessing
    bpm?: number;
    duration?: number;
    noteCount?: number;
    difficulty?: number;
    isCustom?: boolean;
    isFavorite?: boolean;
    volume?: number;
}

/**
 * Explosion effect data.
 */
export interface Explosion {
    x: number;
    y: number;
    radius: number;
    alpha: number;
    color: string;
}

/**
 * Particle effect data for HUD and hits.
 */
export interface ParticleData {
    x: number;
    y: number;
    alpha: number;
    size: number;
    color: string;
    rotation: number;
}

/**
 * MenuRenderState defines the data passed to the MenuRenderer.
 * It encapsulates all visual state needed to draw the menu system.
 */
export interface MenuRenderState {
    // -- Animation --
    menuAnimationTimer: number;

    // -- Song List --
    songList: SongEntry[];
    selectedSongIndex: number;
    currentSortMode: 'name' | 'bpm' | 'duration' | 'noteCount';
    currentFilter: 'all' | 'official' | 'custom' | 'favorite';

    // -- Options --
    difficultyOptions: readonly string[];
    selectedDifficultyIndex: number;
    speedOptions: readonly number[];
    selectedSpeedIndex: number;
    scrollSpeed: number;
    keyMode: 4 | 6;

    // -- Mode Flags --
    isTestMode: boolean;
    isMobile: boolean;

    // -- Screen --
    width: number;
    height: number;

    // -- System --
    transitionData: TransitionData | null;
    scoreManager: ScoreManager | null;
    cachedMidi?: { url: string, buffer: ArrayBuffer, parsed: ParsedMidi } | null;
    /** Parsed MIDI of the currently-previewing song (for the EQ visualizer) */
    previewMidi?: ParsedMidi | null;
    /** Current audio playback position in seconds (for the EQ visualizer) */
    previewTime?: number;

    // -- Feedback --
    toastMessage?: string | null;
    toastTimer?: number;
}

/**
 * LoadingRenderState defines the data passed to the LoadingRenderer.
 */
export interface LoadingRenderState {
    width: number;
    height: number;
    progress: number;
    song: SongEntry;
    statusText: string;
    cachedNow: number;
}

/**
 * HUDRenderState defines the data passed to the HUDRenderer.
 */
export interface HUDRenderState {
    width: number;
    height: number;
    comboAnim: number;
    lastJudgment: { text: string, color: string, time: number, value: Judgment } | null;
    cachedNow: number;
    isMobile: boolean;
    songTitle?: string;
    currentTime?: number;
    duration?: number;
    keyMode?: number;
    difficulty?: string;
    speed?: number;
    resumeCountdown?: number;
    isTestMode?: boolean;
}

/**
 * PauseRenderState defines the data passed to the PauseRenderer.
 */
export interface PauseRenderState {
    width: number;
    height: number;
    selectedButtonIndex: number;
    animationTimer: number;
}

/**
 * Interface for components that need to render particles.
 * Decouples physics logic from rendering logic.
 */
export interface IParticleRenderData {
    forEachActiveParticle(callback: (p: ParticleData) => void): void;
    forEachActiveExplosion(callback: (e: Explosion) => void): void;
}

/**
 * Interface for components that need to render screen transitions.
 * Decouples transition logic from rendering logic.
 */
export interface ITransitionRenderData {
    isActive(): boolean;
    getAlpha(): number;
    getStyle(): 'fade' | 'glitch';
}

// Re-export VisualNote to prevent circular dependencies
export type { VisualNote } from '../NoteFactory';
export type { TransitionData };
