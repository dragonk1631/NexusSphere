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
    private lastAcceptedDrumTick: number = -99999;
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

        // Current Parity logic for AI songs
        if (this.rawDifficulty === 'EXTREME') return 'HARD';
        if (this.rawDifficulty === 'HARD') return 'NORMAL';
        if (this.rawDifficulty === 'NORMAL') return 'NORMAL';
        return 'EASY';
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
        return (this.effectiveDifficulty === 'HARD') ? 2 : 1;
    }

    /**
     * Returns whether chords should be suppressed globally (all channels fused).
     */
    public isGlobalChordSuppressionActive(): boolean {
        return (this.effectiveDifficulty === 'EASY' || (this.context.isAiGenerated && this.rawDifficulty === 'NORMAL'));
    }

    /**
     * Determines if a note should be accepted based on density limits and difficulty rules.
     */
    public shouldAcceptNote(note: QuantizedNote): boolean {
        // [Phase 3] AI-NORMAL Drum Pruning
        if (this.context.isAiGenerated && this.rawDifficulty === 'NORMAL') {
            if (note.midi && note.midi < 60) {
                // 1. Sound Filtering: Only keep Snare (38, 40) and Kick (36)
                const isSnare = (note.midi === 38 || note.midi === 40);
                const isKick = (note.midi === 36 || note.midi === 35);
                if (!isSnare && !isKick) return false;

                // 2. Density Filtering: Minimum gap of 1 quarter note (ppq) for drums in Normal
                const drumTickDiff = note.quantizedStartTick - this.lastAcceptedDrumTick;
                if (drumTickDiff < this.context.ppq) return false;
            }

            // 3. Melody Density Filtering: Limit to 8th notes (variable by BPM)
            // This prevents "Hard-level" instrumental sections from leaking into Normal.
            const tickDiff = note.quantizedStartTick - this.lastAcceptedTick;
            if (tickDiff > 0 && tickDiff < this.normalMinGap) {
                return false;
            }
        }

        // [Parity] EASY Throttle
        if (this.effectiveDifficulty === 'EASY') {
            const tickDiff = note.quantizedStartTick - this.lastAcceptedTick;
            // IMPORTANT: Gap 0 (simultaneous) is ALLOWED within the chord limit logic handled elsewhere,
            // but the throttle drops notes that are too close but NOT simultaneous.
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
        if (note.midi && note.midi < 60) {
            this.lastAcceptedDrumTick = note.quantizedStartTick;
        }
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
}
