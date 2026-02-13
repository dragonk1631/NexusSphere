import type { PatternSegment } from './PatternAnalyzer';
import type { VisualNote } from '../NoteFactory';

export class LaneAllocator {
    /**
     * Assign lanes to notes based on patterns and ergonomics.
     */
    public static assignLanes(segments: PatternSegment[], laneCount: number = 6, difficulty: string = 'NORMAL'): VisualNote[] {
        const result: VisualNote[] = [];
        if (laneCount < 2) laneCount = 6; // Safety validation

        // Split lanes into Hand Groups: Left (0, 1, 2) and Right (3, 4, 5)
        let lastLeftLane = 1;  // Middle of left group
        let lastRightLane = 4; // Middle of right group
        const maxChordSize = (difficulty === 'HARD') ? 2 : 1;

        segments.forEach(segment => {
            const { type, notes } = segment;

            // Group notes by tick to handle chords accurately
            const tickGroups = new Map<number, any[]>();
            notes.forEach(n => {
                const tick = n.quantizedStartTick;
                if (!tickGroups.has(tick)) tickGroups.set(tick, []);
                tickGroups.get(tick)!.push(n);
            });

            const sortedTicks = Array.from(tickGroups.keys()).sort((a, b) => a - b);

            sortedTicks.forEach(tick => {
                const groupNotes = tickGroups.get(tick)!;
                const count = Math.min(groupNotes.length, maxChordSize);
                const activeNotes = groupNotes.slice(0, count);

                if (activeNotes.length === 2) {
                    // CHORDS: Enforce Symmetrical / Opposite side play for thumbs
                    // Avoid single-hand double taps (e.g., [0,1]) which are hard for thumbs
                    const options = [
                        [1, 4], [0, 5], [2, 3], // Wide/Center pairs
                        [0, 4], [1, 5], [2, 4], // Cross-hand mix
                    ];
                    const chosenPair = options[Math.floor(Math.random() * options.length)];

                    activeNotes.forEach((note, idx) => {
                        const lane = chosenPair[idx];
                        result.push({ ...note, lane, isProcessed: false } as VisualNote);
                        if (lane <= 2) lastLeftLane = lane;
                        else lastRightLane = lane;
                    });
                } else if (activeNotes.length === 1) {
                    const note = activeNotes[0];
                    let lane;

                    // Alternating Hands or Flow-based? 
                    // Use MIDI pitch hints to decide which hand (lower = left, higher = right)
                    // But also consider lane balance.
                    const isLeftHand = note.midi % 2 === 0;

                    if (isLeftHand) {
                        // Left Hand Area (0, 1, 2)
                        if (type === 'stream' || type === 'burst') {
                            // Adjacent movement only
                            const move = (Math.random() > 0.5) ? 1 : -1;
                            lane = lastLeftLane + move;
                            if (lane < 0) lane = 1;
                            if (lane > 2) lane = 1;
                        } else {
                            lane = Math.floor(Math.random() * 3);
                        }
                        lastLeftLane = lane;
                    } else {
                        // Right Hand Area (3, 4, 5)
                        if (type === 'stream' || type === 'burst') {
                            const move = (Math.random() > 0.5) ? 1 : -1;
                            lane = lastRightLane + move;
                            if (lane < 3) lane = 4;
                            if (lane > 5) lane = 4;
                        } else {
                            lane = 3 + Math.floor(Math.random() * 3);
                        }
                        lastRightLane = lane;
                    }

                    result.push({ ...note, lane, isProcessed: false } as VisualNote);
                }
            });
        });

        return result.sort((a, b) => a.time - b.time);
    }
}
