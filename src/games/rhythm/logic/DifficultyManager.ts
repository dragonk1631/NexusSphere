import type { QuantizedNote } from './RhythmQuantizer';

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
        // [Parity] AI-NORMAL: Skip Drums (MIDI < 60)
        if (this.context.isAiGenerated && this.rawDifficulty === 'NORMAL') {
            if (note.midi && note.midi < 60) return false;
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
}
