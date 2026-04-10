import type { ParsedMidi } from '../../../../core/audio/MidiParser';

export interface LegacyQuantizedNote {
    id: string;
    time: number;
    midi: number;
    name: string;
    velocity: number;
    duration: number;
    ticks: number;
    durationTicks: number;
    channel: number;
    quantizedStartTick: number;
    quantizedEndTick: number;
    isPrimary?: boolean;
}

export class LegacyRhythmQuantizer {
    /**
     * Quantize raw MIDI notes to a musical grid.
     */
    public static quantize(notes: any[], ppq: number): LegacyQuantizedNote[] {
        const grid = ppq / 4; // 16th note grid
        return notes.map(n => {
            const qStart = Math.round(n.ticks / grid) * grid;
            const qEnd = Math.round((n.ticks + (n.durationTicks || grid)) / grid) * grid;
            return {
                ...n,
                quantizedStartTick: qStart,
                quantizedEndTick: Math.max(qEnd, qStart + grid)
            } as LegacyQuantizedNote;
        });
    }

    /**
     * Apply time correction to quantized notes for perfect sync.
     */
    public static applyTimeCorrection(notes: LegacyQuantizedNote[], midi: ParsedMidi): void {
        let tempoIdx = 0;
        notes.forEach(note => {
            while (tempoIdx < midi.tempos.length - 1 && midi.tempos[tempoIdx + 1].ticks <= note.quantizedStartTick) {
                tempoIdx++;
            }
            const tempo = midi.tempos[tempoIdx];
            const ticksSinceTempo = note.quantizedStartTick - tempo.ticks;
            const secondsPerTick = 60 / (tempo.bpm * midi.ppq);
            
            note.time = tempo.time + (ticksSinceTempo * secondsPerTick);
            
            const durationTicks = note.quantizedEndTick - note.quantizedStartTick;
            note.duration = durationTicks * secondsPerTick;
        });
    }
}
