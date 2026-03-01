import type { PatternSegment } from './PatternAnalyzer';
import type { VisualNote } from '../NoteFactory';

export class LaneAllocator {
    /**
     * Assign lanes to notes based on patterns and ergonomics.
     */
    public static assignLanes(segments: PatternSegment[], laneCount: number = 6, difficulty: string = 'NORMAL'): VisualNote[] {
        const result: VisualNote[] = [];
        if (laneCount !== 4 && laneCount !== 6) laneCount = 6; // Default to 6

        const totalLanes = 6; // Always 6 physical lanes, but active ones vary
        const leftLanes = (laneCount === 4) ? [1, 2] : [0, 1, 2];
        const rightLanes = (laneCount === 4) ? [3, 4] : [3, 4, 5];

        let lastLeftLane = leftLanes[Math.floor(leftLanes.length / 2)];
        let lastRightLane = rightLanes[Math.floor(rightLanes.length / 2)];

        // LIMIT: 1 for EASY/NORMAL, 2 for HARD (as requested)
        const maxChordSize = (difficulty === 'HARD') ? 2 : 1;

        // Hand Tracking State
        let lastHand: 'left' | 'right' | null = null;
        let consecutiveSameHand = 0;
        const FATIGUE_THRESHOLD = 3; // Max consecutive notes per hand for single notes

        // Track when each lane will be free (end tick of last note)
        const laneBusyUntil = new Array(totalLanes).fill(0);

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

                // Identify Primary notes in this tick to PROTECT them
                // REFINED PROTECTION: If it's the primary melody, keep ALWAYS.
                // This ensures fast polyphonic trills or unintended overlaps aren't deleted.

                // Identify Primary notes in this tick to PROTECT them
                const primaryInGroup = groupNotes.filter(n => (n as any).isPrimary);

                const count = Math.min(groupNotes.length, maxChordSize);
                let activeNotes = groupNotes.slice(0, count);

                // EMERGENCY OVERRIDE for Primary Channel (Reliability / 100% Protection)
                // If the group contains Primary notes, we ensure they are NOT deleted.
                if (primaryInGroup.length > 0) {
                    // Combine the sliced notes (for secondary) with ALL primary notes
                    // This ensures primary notes are always present, while secondary respects maxChordSize
                    const nonPrimary = activeNotes.filter(n => !(n as any).isPrimary);
                    activeNotes = Array.from(new Set([...primaryInGroup, ...nonPrimary])).slice(0, Math.max(count, primaryInGroup.length));

                    // Actually, if it's primary, we want to BE SURE it's not deleted by slice.
                    // If we have 3 primary and max is 2, we keep all 3.
                    if (primaryInGroup.length > activeNotes.length) {
                        activeNotes = primaryInGroup;
                    }
                }

                // Helper to find free lane
                const findFreeLane = (preferred: number, hand: 'left' | 'right'): number => {
                    // Check preferred first
                    if (tick >= laneBusyUntil[preferred]) return preferred;

                    // Search outwards from center of hand
                    const range = (hand === 'left') ? leftLanes : rightLanes;
                    // Sort range by distance to preferred to pick closest free lane
                    const sortedRange = [...range].sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred));

                    for (const l of sortedRange) {
                        if (tick >= laneBusyUntil[l]) return l;
                    }

                    // If all busy, fallback to preferred (overlap is unavoidable or handled by engine)
                    return preferred;
                };

                if (activeNotes.length === 2) {
                    // CHORDS: Enforce Symmetrical / Opposite side play
                    const options = (laneCount === 4) ? [
                        [1, 4], [2, 3], [1, 3], [2, 4]
                    ] : [
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
                        // IGNORE MIDI PITCH HINT - Use random bias or simple alternation
                        const rhythmHint = Math.random() > 0.5; // Random initial preference

                        if (consecutiveSameHand >= FATIGUE_THRESHOLD) {
                            useLeftHand = (lastHand !== 'left'); // Force swap
                        } else if (lastHand === null) {
                            useLeftHand = rhythmHint;
                        } else {
                            // High chance to keep pitch hint, but slightly bias towards alternation
                            useLeftHand = (Math.random() > 0.7) ? !lastHand : rhythmHint;
                        }
                    }

                    // Assign Lane within hand area
                    let lane;
                    if (useLeftHand) {
                        const move = (Math.random() > 0.5) ? 1 : -1;
                        let preferred = lastLeftLane + move;
                        if (!leftLanes.includes(preferred)) {
                            preferred = leftLanes[Math.floor(Math.random() * leftLanes.length)];
                        }

                        lane = findFreeLane(preferred, 'left');
                        lastLeftLane = lane;

                        if (lastHand === 'left') consecutiveSameHand++;
                        else { lastHand = 'left'; consecutiveSameHand = 1; }
                    } else {
                        const move = (Math.random() > 0.5) ? 1 : -1;
                        let preferred = lastRightLane + move;
                        if (!rightLanes.includes(preferred)) {
                            preferred = rightLanes[Math.floor(Math.random() * rightLanes.length)];
                        }

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
