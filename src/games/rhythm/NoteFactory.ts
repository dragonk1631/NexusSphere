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
        let rankedChannels: number[] | null = null; // Defer analysis

        if (!(forcedChannels && forcedChannels.length > 0)) {
            rankedChannels = MelodyAnalyzer.findMelodyChannels(midi);
        }

        const ranked = rankedChannels || MelodyAnalyzer.findMelodyChannels(midi);

        // Priority logic: User Forced > Melody Ranked > Support Ranked > Drums
        let primaryCandidates: number[] = [];
        let secondaryCandidates: number[] = [];

        if (forcedChannels && forcedChannels.length > 0) {
            primaryCandidates = forcedChannels;
            secondaryCandidates = ranked.filter(ch => !forcedChannels.includes(ch)).slice(0, 2);
        } else {
            primaryCandidates = ranked.slice(0, 1);
            secondaryCandidates = ranked.slice(1, 3);
        }

        const drumChannel = 9;

        const ppq = midi.ppq;
        const windowTicks = ppq; // Window size: 1 beat

        // Final collection of notes
        const finalNotes: GameNote[] = [];
        const seenNoteKeys = new Set<string>();

        // Pre-group notes by channel and window for fast lookup
        const channelNoteMap = new Map<number, Map<number, GameNote[]>>();
        const allTargetChannels = Array.from(new Set([...primaryCandidates, ...secondaryCandidates, drumChannel]));

        midi.tracks.forEach(track => {
            if (allTargetChannels.includes(track.channel)) {
                if (!channelNoteMap.has(track.channel)) channelNoteMap.set(track.channel, new Map());
                const windowMap = channelNoteMap.get(track.channel)!;

                track.notes.forEach(note => {
                    const windowIndex = Math.floor(note.ticks / windowTicks);
                    if (!windowMap.has(windowIndex)) windowMap.set(windowIndex, []);
                    windowMap.get(windowIndex)!.push(note);
                });
            }
        });

        // Determine total song length in windows
        let maxTick = 0;
        midi.tracks.forEach(t => t.notes.forEach(n => maxTick = Math.max(maxTick, n.ticks + n.durationTicks)));
        const totalWindows = Math.ceil(maxTick / windowTicks);

        console.log(`[NoteFactory] Dynamic Filling: Analyzing ${totalWindows} windows...`);

        for (let w = 0; w < totalWindows; w++) {
            let selectedNotes: GameNote[] = [];

            // 1. Primary: Forced or Top Melody
            primaryCandidates.forEach(ch => {
                const notes = channelNoteMap.get(ch)?.get(w);
                if (notes) selectedNotes.push(...notes);
            });

            // 2. Secondary: Support/Accompaniment (If primary is thin)
            // Threshold for filling: less than 1.5 notes per beat average
            if (selectedNotes.length < 2) {
                secondaryCandidates.forEach(ch => {
                    const notes = channelNoteMap.get(ch)?.get(w);
                    if (notes) selectedNotes.push(...notes);
                });
            }

            // 3. Tertiary: Drums (If still silent)
            if (selectedNotes.length === 0) {
                const drumNotes = channelNoteMap.get(drumChannel)?.get(w);
                if (drumNotes) {
                    // Kick, Snare, Closed Hi-Hat
                    const rhythmicDrums = drumNotes.filter(n => [35, 36, 38, 40, 42].includes(n.midi));
                    selectedNotes.push(...rhythmicDrums);
                }
            }

            // Density Control based on difficulty
            if (difficulty === 'EASY' && selectedNotes.length > 2) selectedNotes = selectedNotes.slice(0, 2);
            if (difficulty === 'NORMAL' && selectedNotes.length > 3) selectedNotes = selectedNotes.slice(0, 3);

            // Add to final list with deduplication
            selectedNotes.forEach(note => {
                const key = `${note.midi}_${note.ticks}`;
                if (!seenNoteKeys.has(key)) {
                    finalNotes.push(note);
                    seenNoteKeys.add(key);
                }
            });
        }

        let notesToProcess = finalNotes.sort((a, b) => a.ticks - b.ticks);

        if (notesToProcess.length === 0) {
            console.error("[NoteFactory] Failed to find any notes for charting. Returning empty list.");
            return [];
        }

        // Run Charting Pipeline (Quantize -> Pattern -> Lane) - Run ONLY ONCE
        const quantized = RhythmQuantizer.quantize(notesToProcess, midi.ppq);
        RhythmQuantizer.applyTimeCorrection(quantized, midi);
        const patterns = PatternAnalyzer.analyze(quantized);
        const result = LaneAllocator.assignLanes(patterns, laneCount, difficulty);

        console.log(`[NoteFactory] Charted ${result.length} notes using Dynamic Filling (Primary: ${primaryCandidates}, Secondary: ${secondaryCandidates}).`);
        return result;
    }
}
