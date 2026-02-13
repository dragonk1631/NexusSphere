import type { ParsedMidi, GameNote } from '../../core/audio/MidiParser';
import { MelodyAnalyzer } from '../../core/audio/MelodyAnalyzer';
import { RhythmQuantizer } from './logic/RhythmQuantizer';
import { PatternAnalyzer } from './logic/PatternAnalyzer';
import { LaneAllocator } from './logic/LaneAllocator';

export interface VisualNote extends GameNote {
    lane: number;
    isProcessed: boolean;
    quantizedStartTick?: number;
    quantizedEndTick?: number;
    isOnBeat?: boolean;
    isStrongBeat?: boolean;
}

export class NoteFactory {
    public static createNotes(midi: ParsedMidi, laneCount: number = 4, forcedChannels: number[] | null = null, difficulty: string = 'NORMAL'): VisualNote[] {
        const rankedChannels = MelodyAnalyzer.findMelodyChannels(midi);
        let targetChannels: number[] = [];

        if (forcedChannels && forcedChannels.length > 0) {
            targetChannels = forcedChannels;
        } else {
            if (rankedChannels.length === 1) {
                targetChannels = [rankedChannels[0]];
            } else {
                targetChannels = rankedChannels.slice(0, Math.min(rankedChannels.length, 3));
            }
        }

        const collectNotes = (channels: number[]): GameNote[] => {
            const collected: GameNote[] = [];
            const seenNoteKeys = new Set<string>();
            const minGap = (difficulty === 'EASY') ? 0.15 : 0;
            let lastNoteTime = -1;

            midi.tracks.forEach((track) => {
                if (channels.includes(track.channel)) {
                    track.notes.forEach(note => {
                        const key = `${note.midi}_${note.time.toFixed(4)}`;
                        if (seenNoteKeys.has(key)) return;
                        seenNoteKeys.add(key);

                        if (difficulty === 'EASY' && lastNoteTime !== -1 && note.time - lastNoteTime < minGap) return;

                        collected.push(note);
                        lastNoteTime = note.time;
                    });
                }
            });
            return collected;
        };

        let notesToProcess = collectNotes(targetChannels);

        // EMERGENCY FALLBACK (Density Check)
        if (notesToProcess.length < 150 && !forcedChannels && rankedChannels.length > targetChannels.length) {
            console.warn(`[NoteFactory] Low note count (${notesToProcess.length}). Expanding channel pool...`);
            targetChannels = rankedChannels.slice(0, Math.min(rankedChannels.length, 6));
            notesToProcess = collectNotes(targetChannels);
        }

        if (notesToProcess.length === 0) return [];

        // Run Charting Pipeline (Quantize -> Pattern -> Lane) - Run ONLY ONCE
        const quantized = RhythmQuantizer.quantize(notesToProcess, midi.ppq);
        RhythmQuantizer.applyTimeCorrection(quantized, midi);
        const patterns = PatternAnalyzer.analyze(quantized);
        const result = LaneAllocator.assignLanes(patterns, laneCount, difficulty);

        console.log(`[NoteFactory] Charted ${result.length} notes from ${targetChannels.length} channels.`);
        return result;
    }
}
