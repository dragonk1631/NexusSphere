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
        let targetChannels: number[] = [];
        let rankedChannels: number[] | null = null; // Defer analysis

        if (forcedChannels && forcedChannels.length > 0) {
            targetChannels = forcedChannels;
        } else {
            rankedChannels = MelodyAnalyzer.findMelodyChannels(midi);
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
        // If current selection is too sparse, try to rescue it with top ranked channels
        if (notesToProcess.length < 50) {
            console.warn(`[NoteFactory] Target channels ${targetChannels} yielded only ${notesToProcess.length} notes. Attempting rescue...`);
            if (!rankedChannels) rankedChannels = MelodyAnalyzer.findMelodyChannels(midi);

            if (rankedChannels.length > 0) {
                // If we were already using the top, expand to more
                const nextPoolSize = targetChannels.length >= 3 ? 6 : 3;
                targetChannels = rankedChannels.slice(0, Math.min(rankedChannels.length, nextPoolSize));
                notesToProcess = collectNotes(targetChannels);
                console.log(`[NoteFactory] Rescue operation expanded pool to ${targetChannels.length} channels. New count: ${notesToProcess.length}`);
            }
        }

        if (notesToProcess.length === 0) {
            console.error("[NoteFactory] Failed to find any notes for charting. Returning empty list.");
            return [];
        }

        // Run Charting Pipeline (Quantize -> Pattern -> Lane) - Run ONLY ONCE
        const quantized = RhythmQuantizer.quantize(notesToProcess, midi.ppq);
        RhythmQuantizer.applyTimeCorrection(quantized, midi);
        const patterns = PatternAnalyzer.analyze(quantized);
        const result = LaneAllocator.assignLanes(patterns, laneCount, difficulty);

        console.log(`[NoteFactory] Charted ${result.length} notes from ${targetChannels.length} channels.`);
        return result;
    }
}
