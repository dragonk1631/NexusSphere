import type { GameNote, ParsedMidi } from '../../../core/audio/MidiParser';

export interface QuantizedNote extends GameNote {
    quantizedStartTick: number;
    quantizedEndTick: number;
    isOnBeat: boolean;     // 1/4 beat
    isStrongBeat: boolean; // 1/1 (Measure start)
    gridSnap: '1/4' | '1/8' | '1/16' | '1/12' | '1/32' | '1/64' | 'off';
}

export class RhythmQuantizer {
    /**
     * Quantize raw MIDI notes to a musical grid.
     * @param notes Raw GameNotes
     * @param ppq Pulses Per Quarter note (from MidiParser)
     */
    public static quantize(notes: GameNote[], ppq: number = 480): QuantizedNote[] {
        const ticksPerQuarter = ppq;
        const ticksPer16th = ticksPerQuarter / 4;
        const ticksPer12th = ticksPerQuarter / 3; // For triplets
        const ticksPer32th = ticksPerQuarter / 8;
        const ticksPer64th = ticksPerQuarter / 16;

        return notes.map(note => {
            // 1. Determine Snap Logic (Straight vs Triplet vs Fine)
            const snap16 = Math.round(note.ticks / ticksPer16th) * ticksPer16th;
            const error16 = Math.abs(note.ticks - snap16);

            const snap12 = Math.round(note.ticks / ticksPer12th) * ticksPer12th;
            const error12 = Math.abs(note.ticks - snap12);

            const snap32 = Math.round(note.ticks / ticksPer32th) * ticksPer32th;
            const error32 = Math.abs(note.ticks - snap32);

            const snap64 = Math.round(note.ticks / ticksPer64th) * ticksPer64th;
            const error64 = Math.abs(note.ticks - snap64);

            let quantizedTick = note.ticks;
            let snapType: QuantizedNote['gridSnap'] = 'off';

            // Adaptive Tolerance: Stricter for finer grids
            const tolerance16 = ticksPer16th * 0.4;
            const toleranceFine = ticksPer64th * 0.45;

            // Priority: 1/16 > 1/12 > 1/32 > 1/64 > Off
            if (error16 <= tolerance16 && error16 <= error12) {
                quantizedTick = snap16;
                if (quantizedTick % ticksPerQuarter === 0) snapType = '1/4';
                else if (quantizedTick % (ticksPerQuarter / 2) === 0) snapType = '1/8';
                else snapType = '1/16';
            } else if (error12 <= tolerance16) {
                quantizedTick = snap12;
                snapType = '1/12';
            } else if (error32 <= toleranceFine) {
                quantizedTick = snap32;
                snapType = '1/32';
            } else if (error64 <= toleranceFine) {
                quantizedTick = snap64;
                snapType = '1/64';
            } else {
                // Determine closest valid snap to avoid "floating" notes
                // If it's pure garbage, keep original?
                // Better to snap to nearest 1/64 to keep engine sane
                quantizedTick = snap64;
                snapType = '1/64';
            }

            // Duration Quantization
            // Enforce minimum duration for visibility
            let quantizedDuration = Math.round(note.durationTicks / ticksPer64th) * ticksPer64th;
            if (quantizedDuration < ticksPer64th) quantizedDuration = ticksPer64th;

            // Beat Analysis
            const quarterTick = Math.round(quantizedTick / ticksPerQuarter);
            const isOnBeat = (Math.abs(quantizedTick - quarterTick * ticksPerQuarter) < 1);
            const isStrongBeat = isOnBeat && (quarterTick % 4 === 0);

            return {
                ...note,
                quantizedStartTick: quantizedTick,
                quantizedEndTick: quantizedTick + quantizedDuration,
                isOnBeat,
                isStrongBeat,
                gridSnap: snapType
            };
        });
    }

    /**
     * Convert quantized ticks back to seconds for engine consumption
     */
    public static applyTimeCorrection(notes: QuantizedNote[], midi: ParsedMidi): void {
        const sortedNotes = [...notes].sort((a, b) => a.quantizedStartTick - b.quantizedStartTick);
        let tempoIdx = 0;

        sortedNotes.forEach(note => {
            while (tempoIdx < midi.tempos.length - 1 && midi.tempos[tempoIdx + 1].ticks <= note.quantizedStartTick) {
                tempoIdx++;
            }

            const tempo = midi.tempos[tempoIdx] || { bpm: midi.bpm || 120, time: 0, ticks: 0 };
            const ticksSinceTempo = note.quantizedStartTick - tempo.ticks;
            const secondsPerTick = 60 / (tempo.bpm * midi.ppq);

            note.time = tempo.time + (ticksSinceTempo * secondsPerTick);

            const durationTicks = note.quantizedEndTick - note.quantizedStartTick;
            note.duration = durationTicks * secondsPerTick;
        });
    }
}
