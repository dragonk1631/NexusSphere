import type { PatternSegment } from './PatternAnalyzer';
import type { VisualNote } from '../NoteFactory';
import { SeedRandom } from '../../../core/utils/SeedRandom';

export class LaneAllocator {
    /**
     * Assign lanes to notes based on patterns and ergonomics.
     */
    public static assignLanes(segments: PatternSegment[], laneCount: number = 6, difficulty: string = 'NORMAL', seed: number = 0): VisualNote[] {
        const rng = new SeedRandom(seed);
        const result: VisualNote[] = [];
        if (laneCount !== 4 && laneCount !== 6) laneCount = 6; // Default to 6

        const totalLanes = 6; // Always 6 physical lanes, but active ones vary
        const leftLanes = (laneCount === 4) ? [1, 2] : [0, 1, 2];
        const rightLanes = (laneCount === 4) ? [3, 4] : [3, 4, 5];

        let lastLeftLane = rng.pick(leftLanes);
        let lastRightLane = rng.pick(rightLanes);

        // LIMIT: 1 for EASY/NORMAL, 2 for HARD (as requested)
        const maxChordSize = (difficulty === 'HARD') ? 2 : 1;

        // Hand Tracking State
        let lastHand: 'left' | 'right' | null = null;
        let consecutiveSameHand = 0;
        const FATIGUE_THRESHOLD = 3; // Max consecutive notes per hand for single notes

        // Track when each lane will be free (end tick of last note)
        const laneBusyUntil = new Array(totalLanes).fill(0);
        // Track when each hand will be free from a HOLD note (User requested Ergonomics fix)
        const handHoldBusyUntil = { left: 0, right: 0 };

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
                const primaryInGroup = groupNotes.filter(n => (n as any).isPrimary);

                const count = Math.min(groupNotes.length, maxChordSize);
                let activeNotes = groupNotes.slice(0, count);

                // EMERGENCY OVERRIDE for Primary Channel (Reliability / 100% Protection)
                if (primaryInGroup.length > 0) {
                    const nonPrimary = activeNotes.filter(n => !(n as any).isPrimary);
                    activeNotes = Array.from(new Set([...primaryInGroup, ...nonPrimary])).slice(0, Math.max(count, primaryInGroup.length));

                    if (primaryInGroup.length > activeNotes.length) {
                        activeNotes = primaryInGroup;
                    }
                }

                // Hand Availability (Hold Awareness)
                const leftHandAvailable = tick >= handHoldBusyUntil.left;
                const rightHandAvailable = tick >= handHoldBusyUntil.right;

                // Helper to find free lane
                const findFreeLane = (preferred: number, hand: 'left' | 'right'): number => {
                    const isLeft = hand === 'left';
                    const isAvailable = isLeft ? leftHandAvailable : rightHandAvailable;
                    
                    // If the HAND is physically busy holding a long note, NO lanes are free in that hand
                    if (!isAvailable) return -1;

                    if (tick >= laneBusyUntil[preferred]) return preferred;

                    // Search outwards from center of hand
                    const range = isLeft ? leftLanes : rightLanes;
                    const sortedRange = [...range].sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred));

                    for (const l of sortedRange) {
                        if (tick >= laneBusyUntil[l]) return l;
                    }

                    // Try other hand's lanes ONLY if that hand is also free and it's a desperate fallback
                    // (Actually, better to stay within hand for ergonomics)
                    return -1; 
                };

                if (activeNotes.length === 2) {
                    // CHORDS: Enforce Symmetrical / Opposite side play
                    const options = (laneCount === 4) ? [
                        [1, 4], [2, 3], [1, 3], [2, 4]
                    ] : [
                        [1, 4], [0, 5], [2, 3],
                        [0, 4], [1, 5], [2, 4],
                    ];
                    
                    // Valid options must have lanes from TWO available hands
                    const validOptions = options.filter(pair => {
                        const lLane = pair[0];
                        const rLane = pair[1];
                        return leftHandAvailable && rightHandAvailable &&
                               tick >= laneBusyUntil[lLane] && tick >= laneBusyUntil[rLane];
                    });

                    if (validOptions.length > 0) {
                        const chosenPair = rng.pick(validOptions);

                        activeNotes.forEach((note, idx) => {
                            const lane = chosenPair[idx];
                            const isHold = (note as any).isHold;
                            const duration = isHold ? ((note.durationTicks || 10) + 60) : 10;
                            
                            laneBusyUntil[lane] = tick + duration;
                            if (isHold) {
                                if (lane <= 2) handHoldBusyUntil.left = tick + duration;
                                else handHoldBusyUntil.right = tick + duration;
                            }

                            result.push({ ...note, lane, isProcessed: false } as VisualNote);
                            if (lane <= 2) lastLeftLane = lane;
                            else lastRightLane = lane;
                        });
                        lastHand = null; 
                        consecutiveSameHand = 0;
                    } else {
                        // Downgrade chord to a single note because one hand is held
                        activeNotes = [activeNotes[0]];
                    }
                }

                if (activeNotes.length === 1) {
                    const note = activeNotes[0];
                    let useLeftHand = true;

                    // Decision Logic for Hand Assignment (Respect availability)
                    if (!leftHandAvailable && rightHandAvailable) {
                        useLeftHand = false;
                    } else if (leftHandAvailable && !rightHandAvailable) {
                        useLeftHand = true;
                    } else if (!leftHandAvailable && !rightHandAvailable) {
                        // BOTH HANDS BUSY HOLDING. Physically impossible to hit even a tap.
                        return;
                    } else if (type === 'stream' || type === 'burst') {
                        // Alternation
                        useLeftHand = (lastHand !== 'left');
                    } else {
                        const rhythmHint = rng.chance(0.5);
                        if (consecutiveSameHand >= FATIGUE_THRESHOLD) {
                            useLeftHand = (lastHand !== 'left'); 
                        } else if (lastHand === null) {
                            useLeftHand = rhythmHint;
                        } else {
                            useLeftHand = rng.chance(0.3) ? !lastHand : rhythmHint;
                        }
                    }

                    // Assign Lane within hand area
                    let lane = -1;
                    if (useLeftHand) {
                        const move = rng.chance(0.5) ? 1 : -1;
                        let preferred = lastLeftLane + move;
                        if (!leftLanes.includes(preferred)) {
                            preferred = rng.pick(leftLanes);
                        }
                        lane = findFreeLane(preferred, 'left');
                        
                        // Fallback to right hand if left selection failed but right is free
                        if (lane === -1 && rightHandAvailable) {
                           lane = findFreeLane(lastRightLane, 'right');
                        }
                    } else {
                        const move = rng.chance(0.5) ? 1 : -1;
                        let preferred = lastRightLane + move;
                        if (!rightLanes.includes(preferred)) {
                            preferred = rng.pick(rightLanes);
                        }
                        lane = findFreeLane(preferred, 'right');

                        // Fallback to left hand if right selection failed but left is free
                        if (lane === -1 && leftHandAvailable) {
                            lane = findFreeLane(lastLeftLane, 'left');
                        }
                    }

                    if (lane === -1 || tick < laneBusyUntil[lane]) {
                        return;
                    }

                    // Update states for next notes
                    const isHold = (note as any).isHold;
                    const duration = isHold ? ((note.durationTicks || 10) + 60) : 10;
                    
                    if (lane <= 2) {
                        lastLeftLane = lane;
                        if (isHold) handHoldBusyUntil.left = tick + duration;
                        if (lastHand === 'left') consecutiveSameHand++;
                        else { lastHand = 'left'; consecutiveSameHand = 1; }
                    } else {
                        lastRightLane = lane;
                        if (isHold) handHoldBusyUntil.right = tick + duration;
                        if (lastHand === 'right') consecutiveSameHand++;
                        else { lastHand = 'right'; consecutiveSameHand = 1; }
                    }

                    laneBusyUntil[lane] = tick + duration;
                    result.push({ ...note, lane, isProcessed: false } as VisualNote);
                }
            });
        });

        return result.sort((a, b) => a.time - b.time);
    }
}
