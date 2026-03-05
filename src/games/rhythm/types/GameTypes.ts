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
    PAUSED: 4
} as const;
export type GameState = typeof GameState[keyof typeof GameState];

/**
 * Basic song information used in menus and loading.
 */
export interface SongEntry {
    name: string;
    url: string;
    bpm?: number;
    duration?: number;
    noteCount?: number;
    difficulty?: number;
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
    vx: number;
    vy: number;
    alpha: number;
    size: number;
    color: string;
    rotation: number;
    rotationSpeed: number;
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
}

/**
 * Interface for components that need to render particles.
 * Decouples physics logic from rendering logic.
 */
export interface IParticleRenderData {
    getParticles(): ReadonlyArray<ParticleData>;
    getExplosions(): ReadonlyArray<Explosion>;
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
