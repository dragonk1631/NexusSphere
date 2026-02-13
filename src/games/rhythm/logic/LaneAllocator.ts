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

        // Hand Tracking State
        let lastHand: 'left' | 'right' | null = null;
        let consecutiveSameHand = 0;
        const FATIGUE_THRESHOLD = 3; // Max consecutive notes per hand for single notes

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
                    // CHORDS: Enforce Symmetrical / Opposite side play
                    const options = [
                        [1, 4], [0, 5], [2, 3],
                        [0, 4], [1, 5], [2, 4],
                    ];
                    const chosenPair = options[Math.floor(Math.random() * options.length)];

                    activeNotes.forEach((note, idx) => {
                        const lane = chosenPair[idx];
                        result.push({ ...note, lane, isProcessed: false } as VisualNote);
                        if (lane <= 2) lastLeftLane = lane;
                        else lastRightLane = lane;
                    });
                    lastHand = null; // Reset fatigue after chord
                    consecutiveSameHand = 0;
                } else if (activeNotes.length === 1) {
                    const note = activeNotes[0];
                    let useLeftHand = true;

                    // Decision Logic for Hand Assignment
                    if (type === 'stream' || type === 'burst') {
                        // FORCE ALTERNATION for rhythm
                        useLeftHand = (lastHand !== 'left');
                    } else {
                        // FATIGUE BIAS + MIDI PITCH HINT
                        const pitchHint = note.midi % 2 === 0; // Even midi = Left preference

                        if (consecutiveSameHand >= FATIGUE_THRESHOLD) {
                            useLeftHand = (lastHand !== 'left'); // Force swap
                        } else if (lastHand === null) {
                            useLeftHand = pitchHint;
                        } else {
                            // High chance to keep pitch hint, but slightly bias towards alternation
                            useLeftHand = (Math.random() > 0.7) ? !lastHand : pitchHint;
                        }
                    }

                    // Assign Lane within hand area
                    let lane;
                    if (useLeftHand) {
                        const move = (Math.random() > 0.5) ? 1 : -1;
                        lane = lastLeftLane + move;
                        if (lane < 0 || lane > 2) lane = (lastLeftLane === 1) ? (Math.random() > 0.5 ? 0 : 2) : 1;
                        lastLeftLane = lane;

                        if (lastHand === 'left') consecutiveSameHand++;
                        else { lastHand = 'left'; consecutiveSameHand = 1; }
                    } else {
                        const move = (Math.random() > 0.5) ? 1 : -1;
                        lane = lastRightLane + move;
                        if (lane < 3 || lane > 5) lane = (lastRightLane === 4) ? (Math.random() > 0.5 ? 3 : 5) : 4;
                        lastRightLane = lane;

                        if (lastHand === 'right') consecutiveSameHand++;
                        else { lastHand = 'right'; consecutiveSameHand = 1; }
                    }

                    result.push({ ...note, lane, isProcessed: false } as VisualNote);
                }
            });
        });

        return result.sort((a, b) => a.time - b.time);
    }
}
