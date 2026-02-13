import type { PatternSegment } from './PatternAnalyzer';
import type { VisualNote } from '../NoteFactory';

export class LaneAllocator {
    /**
     * Assign lanes to notes based on patterns and ergonomics.
     */
    public static assignLanes(segments: PatternSegment[], laneCount: number = 6, difficulty: string = 'NORMAL'): VisualNote[] {
        const result: VisualNote[] = [];
        let lastLane = Math.floor(laneCount / 2);
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

            // Iterate through ticks in order
            const sortedTicks = Array.from(tickGroups.keys()).sort((a, b) => a - b);

            sortedTicks.forEach(tick => {
                const groupNotes = tickGroups.get(tick)!;

                // CRITICAL: Cap chords based on difficulty
                const count = Math.min(groupNotes.length, maxChordSize);
                const activeNotes = groupNotes.slice(0, count);

                if (activeNotes.length === 2) {
                    // Symmetrical and Inner-inclusive pairs for chords
                    const pairs = [
                        [2, 3], [1, 4], [0, 5],
                        [1, 2], [3, 4],
                        [0, 2], [3, 5]
                    ];
                    const chosenPair = pairs[Math.floor(Math.random() * pairs.length)];

                    activeNotes.forEach((note, idx) => {
                        const lane = chosenPair[idx];
                        result.push({ ...note, lane, isProcessed: false } as VisualNote);
                        lastLane = lane;
                    });
                } else if (activeNotes.length === 1) {
                    const note = activeNotes[0];
                    let lane;

                    if (type === 'stream' || type === 'burst') {
                        // Stream Logic: Flow-based movement
                        const rand = Math.random();
                        if (rand < 0.4) {
                            lane = lastLane + (Math.random() > 0.5 ? 1 : -1);
                        } else if (rand < 0.7) {
                            lane = (lastLane <= 2) ? lastLane + 1 : lastLane - 1;
                        } else {
                            lane = Math.floor(Math.random() * laneCount);
                        }
                    } else {
                        // Standard distribution for singles/holds
                        lane = (note.midi + Math.floor(Math.random() * laneCount)) % laneCount;
                    }

                    lane = Math.max(0, Math.min(lane, laneCount - 1));
                    result.push({ ...note, lane, isProcessed: false } as VisualNote);
                    lastLane = lane;
                }
            });
        });

        return result.sort((a, b) => a.time - b.time);
    }
}
