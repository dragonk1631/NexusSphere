import type { ParsedMidi, GameNote } from '../../core/audio/MidiParser';
import { MelodyAnalyzer } from '../../core/audio/MelodyAnalyzer';
import { RhythmQuantizer, type QuantizedNote } from './logic/RhythmQuantizer';
import { PatternAnalyzer } from './logic/PatternAnalyzer';
import { LaneAllocator } from './logic/LaneAllocator';

export interface VisualNote extends GameNote {
    lane: number;
    isProcessed: boolean;
    quantizedStartTick?: number;
    quantizedEndTick?: number;
    isOnBeat?: boolean;
    isStrongBeat?: boolean;
    // Long Note Props
    durationMs: number;
    isHold: boolean;
    endTick: number; // For logic
    isHolding: boolean; // Runtime state
    accumulatedHoldTime: number; // For tick combo
    type: 'TAP' | 'HOLD';
}

export class NoteFactory {
    public static createNotes(midi: ParsedMidi, laneCount: number = 4, forcedChannels: number[] | null = null, difficulty: string = 'NORMAL'): VisualNote[] {
        // Determine Candidates (Primary, Secondary, Drums)
        let primaryCandidates: number[] = [];
        let secondaryCandidates: number[] = [];

        if (forcedChannels && forcedChannels.length > 0) {
            primaryCandidates = forcedChannels;
            // EXCLUSIVE SOLO MODE: Force Secondary to empty
            secondaryCandidates = [];
        } else {
            const rankedChannels = MelodyAnalyzer.findMelodyChannels(midi);
            primaryCandidates = rankedChannels.slice(0, 1);
            secondaryCandidates = []; // Also force empty here for now
        }

        const ppq = midi.ppq;

        console.log(`[NoteFactory] Primary: ${primaryCandidates}, Secondary: ${secondaryCandidates}`);

        // --- LAYERED GAP FILLING STRATEGY ---
        const finalNotes: GameNote[] = [];

        // Grid System for Collision Detection (Quantize to 16th note for occupancy check)
        const ticksPer16th = ppq / 4;
        const occupiedGrids = new Set<string>(); // Key: "GridIndex"

        const getGridIndex = (tick: number) => Math.floor(tick / ticksPer16th);

        // Helper to add notes
        const addNotesToLayer = (channels: number[], isPrimary: boolean) => {
            // Collect all notes from these channels
            const layerNotes: GameNote[] = [];
            midi.tracks.forEach(t => {
                t.notes.forEach(n => {
                    if (channels.includes(n.channel)) layerNotes.push(n);
                });
            });

            // Sort by time
            layerNotes.sort((a, b) => a.ticks - b.ticks);

            // Filter & Add
            layerNotes.forEach(note => {
                const grid = getGridIndex(note.ticks);

                // 1. Check Collision
                let isBlocked = false;

                if (isPrimary) {
                    // Primary always wins
                } else {
                    if (occupiedGrids.has(grid.toString())) isBlocked = true;
                }

                // 2. Velocity Filter (Ignore ghost notes < 10% velocity)
                if (note.velocity < 13) { // 13/127 ~= 10%
                    isBlocked = true;
                }

                if (!isBlocked) {
                    if (isPrimary) {
                        (note as any).isPrimary = true;
                    }

                    finalNotes.push(note);
                    occupiedGrids.add(grid.toString());
                }
            });
        };

        // LAYER 1: PRIMARY (Sacred)
        addNotesToLayer(primaryCandidates, true);

        // LAYER 2: SECONDARY (Fill Gaps)
        if (difficulty !== 'EASY') {
            addNotesToLayer(secondaryCandidates, false);
        }

        // DEBUG: Verify each required channel has some representation
        primaryCandidates.forEach((ch: number) => {
            const count = finalNotes.filter(n => n.channel === ch).length;
            console.log(`[NoteFactory] Channel ${ch + 1} (PRIMARY): ${count} notes gathered.`);
            if (count === 0) console.warn(`[NoteFactory] WARNING: Channel ${ch + 1} is empty after collection!`);
        });

        let notesToProcess = finalNotes.sort((a, b) => a.ticks - b.ticks);

        if (notesToProcess.length === 0) {
            console.error("[NoteFactory] Failed to find any notes for charting. Returning empty list.");
            return [];
        }

        // 1. Quantize first
        const quantized = RhythmQuantizer.quantize(notesToProcess, midi.ppq);

        // 2. Collapse Chords BASED ON QUANTIZED TICKS (The Fix for jittery MIDI)
        const collapsed: QuantizedNote[] = [];
        const seenCounts = new Map<string, number>();
        const maxLimit = (difficulty === 'HARD') ? 2 : 1;

        quantized.forEach(n => {
            const key = `${n.channel}_${n.quantizedStartTick}`;
            const count = seenCounts.get(key) || 0;
            if (count < maxLimit) {
                collapsed.push(n);
                seenCounts.set(key, count + 1);
            }
        });

        // 3. Apply Time Correction (Sync Fix)
        RhythmQuantizer.applyTimeCorrection(collapsed, midi);

        // 4. Pattern & Lane Analysis
        const patterns = PatternAnalyzer.analyze(collapsed);
        const result = LaneAllocator.assignLanes(patterns, laneCount, difficulty);

        // Post-process to map Long Note data
        // We need to re-attach duration info since LaneAllocator might strictly deal with patterns
        // But since VisualNote extends GameNote, and GameNote has duration/durationTicks, we can calculate it.
        // However, LaneAllocator returns VisualNote[]. We should iterate and set isHold based on duration.

        // Use Musical Threshold: 1/2 Beat
        const beatDurationMs = 60000 / midi.bpm;
        const holdThresholdMs = beatDurationMs * 0.5;

        const finalResult = result.map(n => {
            // Use existing duration (from MidiParser or RhythmQuantizer) for accuracy
            // This handles variable tempo changes correctly
            const durationMs = n.duration * 1000;
            const isHold = durationMs >= holdThresholdMs;

            return {
                ...n,
                durationMs: durationMs,
                isHold: isHold,
                endTick: n.ticks + n.durationTicks,
                isHolding: false,
                accumulatedHoldTime: 0,
                type: isHold ? 'HOLD' : 'TAP'
            } as VisualNote;
        });

        console.log(`[NoteFactory] Charted ${finalResult.length} notes (Holds: ${finalResult.filter(n => n.isHold).length}).`);
        return finalResult;
    }
}
