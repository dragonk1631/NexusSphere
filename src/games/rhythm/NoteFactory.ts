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
    /**
     * Convert MIDI data to game visual notes using Smart Charting Engine.
     * @param forcedChannels (Optional) Specific channels (0-15) to use.
     */
    public static createNotes(midi: ParsedMidi, laneCount: number = 4, forcedChannels: number[] | null = null, difficulty: string = 'NORMAL'): VisualNote[] {
        // 1. Determine Target Channels
        let targetChannels: number[] = [];
        const rankedChannels = MelodyAnalyzer.findMelodyChannels(midi);

        if (forcedChannels && forcedChannels.length > 0) {
            targetChannels = forcedChannels;
        } else {
            // Default to top 3
            targetChannels = rankedChannels.slice(0, Math.min(rankedChannels.length, 3));
        }

        const proceedWithChannels = (channels: number[]): VisualNote[] => {
            let notesToProcess: GameNote[] = [];
            let lastNoteTime = -1;
            const seenNoteKeys = new Set<string>();
            const minGap = (difficulty === 'EASY') ? 0.15 : 0; // 150ms gap for EASY

            midi.tracks.forEach((track) => {
                if (channels.includes(track.channel)) {
                    track.notes.forEach(note => {
                        // 1. De-duplication
                        const key = `${note.midi}_${note.time.toFixed(4)}`;
                        if (seenNoteKeys.has(key)) return;
                        seenNoteKeys.add(key);

                        // 2. Density Filtering (EASY mode)
                        if (difficulty === 'EASY') {
                            if (lastNoteTime !== -1 && note.time - lastNoteTime < minGap) {
                                return;
                            }
                        }

                        notesToProcess.push(note);
                        lastNoteTime = note.time;
                    });
                }
            });

            if (notesToProcess.length === 0) return [];

            // Smart Charting Pipeline
            const quantizedNotes = RhythmQuantizer.quantize(notesToProcess, midi.ppq);
            RhythmQuantizer.applyTimeCorrection(quantizedNotes, midi);
            const patterns = PatternAnalyzer.analyze(quantizedNotes);
            return LaneAllocator.assignLanes(patterns, laneCount, difficulty);
        };

        let result = proceedWithChannels(targetChannels);

        // 2. EMERGENCY FALLBACK
        // If note count is suspiciously low (< 150), switch to Smart Charting's best channels
        if (result.length < 150 && rankedChannels.length > 0) {
            console.warn(`[NoteFactory] Low note count (${result.length}). Switching to top ranked channels for better density...`);
            targetChannels = rankedChannels.slice(0, Math.min(rankedChannels.length, 6));
            const expandedResult = proceedWithChannels(targetChannels);
            if (expandedResult.length > result.length) {
                result = expandedResult;
            }
        }

        console.log(`[NoteFactory] Final Note Count: ${result.length}`);
        return result;
    }
}
