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

        // Track when each lane will be free (end tick of last note)
        const laneBusyUntil = new Array(laneCount).fill(0);

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

                // Helper to find free lane
                const findFreeLane = (preferred: number, hand: 'left' | 'right'): number => {
                    // Check preferred first
                    if (tick >= laneBusyUntil[preferred]) return preferred;

                    // Search outwards from center of hand
                    const range = (hand === 'left') ? [1, 0, 2] : [4, 3, 5];
                    for (const l of range) {
                        if (tick >= laneBusyUntil[l]) return l;
                    }

                    // If all busy, fallback to preferred (overlap is unavoidable or handled by engine)
                    // But we should try to avoid. Let's try ANY free lane? 
                    // No, stick to hand constraints for now.
                    return preferred;
                };

                if (activeNotes.length === 2) {
                    // CHORDS: Enforce Symmetrical / Opposite side play
                    const options = [
                        [1, 4], [0, 5], [2, 3],
                        [0, 4], [1, 5], [2, 4],
                    ];
                    // Filter options where at least one lane is free? 
                    // Or just pick one and force it?
                    // Let's filter for fully free pairs if possible
                    const validOptions = options.filter(pair =>
                        tick >= laneBusyUntil[pair[0]] && tick >= laneBusyUntil[pair[1]]
                    );

                    const chosenPair = (validOptions.length > 0)
                        ? validOptions[Math.floor(Math.random() * validOptions.length)]
                        : options[Math.floor(Math.random() * options.length)];

                    activeNotes.forEach((note, idx) => {
                        const lane = chosenPair[idx];

                        // Update Busy State
                        // We need durationTicks. VisualNote doesn't exist yet, but GameNote does.
                        const duration = note.durationTicks || 0;
                        laneBusyUntil[lane] = tick + duration; // Mark busy until end of note

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
                        let preferred = lastLeftLane + move;
                        if (preferred < 0 || preferred > 2) preferred = (lastLeftLane === 1) ? (Math.random() > 0.5 ? 0 : 2) : 1;

                        lane = findFreeLane(preferred, 'left');
                        lastLeftLane = lane;

                        if (lastHand === 'left') consecutiveSameHand++;
                        else { lastHand = 'left'; consecutiveSameHand = 1; }
                    } else {
                        const move = (Math.random() > 0.5) ? 1 : -1;
                        let preferred = lastRightLane + move;
                        if (preferred < 3 || preferred > 5) preferred = (lastRightLane === 4) ? (Math.random() > 0.5 ? 3 : 5) : 4;

                        lane = findFreeLane(preferred, 'right');
                        lastRightLane = lane;

                        if (lastHand === 'right') consecutiveSameHand++;
                        else { lastHand = 'right'; consecutiveSameHand = 1; }
                    }

                    // Update Busy State
                    const duration = note.durationTicks || 0;
                    laneBusyUntil[lane] = tick + duration;

                    result.push({ ...note, lane, isProcessed: false } as VisualNote);
                }
            });
        });

        return result.sort((a, b) => a.time - b.time);
    }
}
