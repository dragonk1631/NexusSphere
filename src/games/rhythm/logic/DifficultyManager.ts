import type { QuantizedNote } from './RhythmQuantizer';
import type { ParsedMidi, GameNote } from '../../../core/audio/MidiParser';

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
    private holdThresholdMs: number = 0;

    constructor(difficulty: string, context: DifficultyContext) {
        this.rawDifficulty = difficulty;
        this.context = context;
        this.effectiveDifficulty = this.calculateEffectiveDifficulty();
        this.easyMinGap = this.calculateEasyMinGap();
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
     * [Phase 8] Refines the measure-to-track mapping for AI charts.
     * Centralizes the "Vocals by default, Drums in long gaps" logic using TRACK isolation.
     */
    public refineAiChartStrategy(config: Map<number, number>, midi: ParsedMidi, rankedTracks: number[]): void {
        if (this.rawDifficulty !== 'NORMAL') return; // Only strictly optimize for Normal for now

        const vocalTrackIdx = rankedTracks[0];
        const drumTrackIdx = rankedTracks[rankedTracks.length - 1];

        const ppq = midi.ppq || 480;
        const bpm = midi.bpm || 120;
        const secPerMeasure = (4 * 60) / bpm;

        // 1. Identify all "Melody" tracks (exclude drums)
        const melodyTracks = rankedTracks.filter(tIdx => {
            const track = (midi.tracks || [])[tIdx];
            return track && !track.isDrum;
        });

        // 2. Scan all measures to check for ANY melody content
        const totalMeasures = Math.max(...config.keys(), 0) + 1;
        let emptyMeasures: number[] = [];

        const applyDrums = () => {
            // "딱 거기만!" -> Only if the gap is truly long (>= 5 seconds)
            if (emptyMeasures.length * secPerMeasure >= 5.0) {
                emptyMeasures.forEach(mIdx => config.set(mIdx, drumTrackIdx));
            } else {
                // Not long enough? Stay on the best Vocal/Melody track
                emptyMeasures.forEach(mIdx => config.set(mIdx, vocalTrackIdx));
            }
            emptyMeasures = [];
        };

        for (let m = 0; m < totalMeasures; m++) {
            const mStart = m * ppq * 4;
            const mEnd = (m + 1) * ppq * 4;

            // Check if ANY melody track has notes here
            let hasMelody = false;
            for (const tIdx of melodyTracks) {
                const track = (midi.tracks || [])[tIdx];
                const hasNotes = track?.notes.some((n: GameNote) => 
                    n.ticks < mEnd && (n.ticks + (n.durationTicks || 0)) > mStart && (n.velocity || 0) >= 13
                );
                if (hasNotes) {
                    hasMelody = true;
                    break;
                }
            }

            if (hasMelody) {
                applyDrums();
                config.set(m, vocalTrackIdx); // Vocal candidate takes precedence
            } else {
                emptyMeasures.push(m);
            }
        }
        applyDrums();
    }
}
