import type { QuantizedNote } from './RhythmQuantizer';

export type PatternType = 'single' | 'stream' | 'chord' | 'hold' | 'burst';

export interface PatternSegment {
    type: PatternType;
    notes: QuantizedNote[]; // Notes belonging to this segment
    startTime: number;      // Seconds
    endTime: number;        // Seconds
    startTick: number;
    endTick: number;
    averageDensity: number; // Notes per second
}

export class PatternAnalyzer {
    /**
     * Analyze quantized notes and group them into logical patterns.
     */
    public static analyze(notes: QuantizedNote[]): PatternSegment[] {
        const segments: PatternSegment[] = [];
        if (notes.length === 0) return segments;

        // Sorting by time is crucial
        notes.sort((a, b) => a.quantizedStartTick - b.quantizedStartTick);

        let currentPatternNotes: QuantizedNote[] = [];

        for (let i = 0; i < notes.length; i++) {
            const note = notes[i];
            const nextNote = notes[i + 1];

            // 1. Check for Chords (Simultaneous notes)
            // If this note starts at same tick as next note, or previous note in current cluster
            // We need to handle this carefully.
            // For simplicity, let's treat chords as single "events" with multiple notes?
            // Or PatternSegment can contain chords?

            // Let's grouping logic:
            // If strictly simultaneous -> Add to current 'chord' group

            // Current approach:
            // Group sequential notes by interval. 
            // If interval > threshold, break segment.

            currentPatternNotes.push(note);

            if (!nextNote) {
                // End of track
                segments.push(this.createSegment(currentPatternNotes));
                break;
            }

            const interval = nextNote.quantizedStartTick - note.quantizedStartTick;

            // Pattern Break Condition
            // If gap is large (> 1/2 note), definitely break
            if (interval > 960) { // 960 = 1/2 note at 480 PPQ
                segments.push(this.createSegment(currentPatternNotes));
                currentPatternNotes = [];
                continue;
            }

            // Just accumulate until a fairly large gap occurs.
            // 960 ticks = 1/2 note. This keeps most phrases together.
            if (interval > 720) { // Approx 3/4 beat
                segments.push(this.createSegment(currentPatternNotes));
                currentPatternNotes = [];
            }
        }

        return segments;
    }

    private static createSegment(notes: QuantizedNote[]): PatternSegment {
        const first = notes[0];
        const last = notes[notes.length - 1];

        // Determine Type
        let type: PatternType = 'single';
        const duration = (last.time - first.time) || 1; // avoid div 0
        const count = notes.length;
        const density = count / duration;

        if (count > 1) {
            // Check for chords (any simultaneous notes?)
            const hasChords = notes.some((n, i) => i > 0 && n.quantizedStartTick === notes[i - 1].quantizedStartTick);

            if (hasChords) {
                type = 'chord'; // Contains chords
            } else if (density > 8) { // > 8 notes per second roughly covers 1/8 streams at 120bpm?
                // 120 BPM = 2 beats/sec = 4 x 1/8 notes / sec -> density 4. 
                // 1/16 stream -> density 8.
                type = 'stream';
                if (density > 16) type = 'burst';
            } else if (density > 2) {
                type = 'stream'; // Slow stream
            }
        }

        // Check for Hold (Long Note) dominance
        const avgDuration = notes.reduce((sum, n) => sum + n.durationTicks, 0) / count;
        if (avgDuration > 480) { // Average note > 1/4 note
            type = 'hold';
        }

        return {
            type,
            notes,
            startTime: first.time,
            endTime: last.time + last.duration, // Rough end time
            startTick: first.quantizedStartTick,
            endTick: last.quantizedEndTick,
            averageDensity: density
        };
    }
}
