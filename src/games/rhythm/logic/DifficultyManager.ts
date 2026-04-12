import type { QuantizedNote } from './RhythmQuantizer';
import type { ParsedMidi } from '../../../core/audio/MidiParser';

export interface DifficultyContext {
    isAiGenerated: boolean;
    bpm: number;
    ppq: number;
}

/**
 * DifficultyManager: Professional-grade logic for chart density and tier management.
 * Encapsulates filtering, chord capping, and rhythmic throttling.
 */
export class DifficultyManager {
    private context: DifficultyContext;
    private rawDifficulty: string;
    private effectiveDifficulty: string;
    
    private lastAcceptedTick: number = -99999;
    private easyMinGap: number = 0;
    private normalMinGap: number = 0;
    private holdThresholdMs: number = 0;

    constructor(difficulty: string, context: DifficultyContext) {
        this.rawDifficulty = difficulty;
        this.context = context;
        this.effectiveDifficulty = this.calculateEffectiveDifficulty();
        this.easyMinGap = this.calculateEasyMinGap();
        this.normalMinGap = this.easyMinGap / 2; // Normal allows 2x density of Easy
        this.holdThresholdMs = (60000 / this.context.bpm) * 0.75;
    }

    private calculateEffectiveDifficulty(): string {
        if (!this.context.isAiGenerated) return this.rawDifficulty;

        // Hierarchical mapping for AI songs
        // NORMAL -> NORMAL (Base)
        // HARD -> HARD (Normal + Drums)
        // EXTREME -> EXTREME (Hard + Chords/Extra)
        return this.rawDifficulty;
    }

    private calculateEasyMinGap(): number {
        const { ppq, bpm } = this.context;
        if (bpm >= 180) return ppq * 2;   // 1/2 note
        if (bpm >= 110) return ppq;       // 1/4 note
        return ppq / 2;                  // 1/8 note
    }

    /**
     * Returns the maximum simultaneous notes allowed for this difficulty.
     */
    public getNoteChordLimit(): number {
        if (this.effectiveDifficulty === 'EXTREME') {
            return 2;
        }
        // NORMAL and HARD are strictly monophonic (1 note at a time)
        return 1;
    }

    /**
     * Returns whether chords should be suppressed globally (all channels fused).
     * This enforces monophony across all active tracks.
     */
    public isGlobalChordSuppressionActive(): boolean {
        // Suppress chords (fuse tracks) for EASY, NORMAL, and HARD
        return (this.effectiveDifficulty !== 'EXTREME');
    }

    /**
     * Determines if a note should be accepted based on density limits and difficulty rules.
     */
    public shouldAcceptNote(note: QuantizedNote): boolean {
        // 1. NORMAL Difficulty Density Throttle (Apply to AI Melody)
        if (this.context.isAiGenerated && this.effectiveDifficulty === 'NORMAL') {
            const tickDiff = note.quantizedStartTick - this.lastAcceptedTick;
            if (tickDiff > 0 && tickDiff < this.normalMinGap) {
                return false;
            }
        }

        // 2. EASY Throttle
        if (this.effectiveDifficulty === 'EASY') {
            const tickDiff = note.quantizedStartTick - this.lastAcceptedTick;
            if (tickDiff > 0 && tickDiff < this.easyMinGap) {
                return false;
            }
        }

        return true;
    }

    /**
     * Updates internal tracking after a note is accepted.
     */
    public recordAcceptedNote(note: QuantizedNote): void {
        this.lastAcceptedTick = note.quantizedStartTick;
    }

    /**
     * Returns the threshold in MS used to distinguish TAPs from HOLDs for legacy MIDI.
     */
    public getHoldThresholdMs(): number {
        return this.holdThresholdMs;
    }

    public getEffectiveDifficulty(): string {
        return this.effectiveDifficulty;
    }

    /**
     * Returns the threshold in MS used for AI-generated charts.
     * NORMAL/EASY difficulties use a higher threshold to filter out too-short long notes.
     */
    public getAiHoldThresholdMs(): number {
        if (this.effectiveDifficulty === 'NORMAL' || this.effectiveDifficulty === 'EASY') {
            return 400;
        }
        return 150;
    }

    /**
     * [Phase 8] Refines the measure-to-track mapping for AI-generated charts.
     * Unified with standard MIDI logic: switches to the best available candidate in the hierarchy
     * whenever the primary vocal track is empty.
     */
    public refineAiChartStrategy(config: Map<number, number>, midi: ParsedMidi, rankedTracks: number[]): void {
        // [Parity] Standardize AI chart fallback with general MIDI logic
        // We remove the 5.0s "Vocal-only" enforcement to prevent empty sections.
        
        const ppq = midi.ppq || 480;
        const totalMeasures = Math.max(...config.keys(), 0) + 1;

        // Group note availability by track for fast checking
        const trackMeasureMap = new Map<number, Set<number>>();
        rankedTracks.forEach(tIdx => {
            const track = midi.tracks[tIdx];
            const mSet = new Set<number>();
            if (track) {
                track.notes.forEach(note => {
                    if (note.velocity < 13) return;
                    const mIdx = Math.floor(note.ticks / (ppq * 4));
                    mSet.add(mIdx);
                });
            }
            trackMeasureMap.set(tIdx, mSet);
        });

        const mainTrackIdx = rankedTracks[0];

        for (let m = 0; m < totalMeasures; m++) {
            const mainHasNotes = trackMeasureMap.get(mainTrackIdx)?.has(m);

            if (!mainHasNotes) {
                // Gap detected! Search through ranked fallback candidates (Instrumental -> Bass -> Drums)
                for (let i = 1; i < rankedTracks.length; i++) {
                    const altTrackIdx = rankedTracks[i];
                    if (trackMeasureMap.get(altTrackIdx)?.has(m)) {
                        config.set(m, altTrackIdx);
                        break;
                    }
                }
            } else {
                // Return to main track
                config.set(m, mainTrackIdx);
            }
        }
    }

    /**
     * Hierarchical Track Inclusion Helpers
     */
    public shouldIncludeDrums(): boolean {
        return this.effectiveDifficulty === 'HARD' || this.effectiveDifficulty === 'EXTREME';
    }

    public shouldIncludeExtraTracks(): boolean {
        return this.effectiveDifficulty === 'EXTREME';
    }
}
