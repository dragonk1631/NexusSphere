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
        // Jackhammer Prevention: Lanes shouldn't be reused too quickly for taps
        const LANE_REUSE_COOLDOWN = 480; // 1 beat at 120bpm (480 ticks)

        // Track when each lane will be free (end tick of last note)
        const laneBusyUntil = new Array(totalLanes).fill(0);
        // Track when each hand will be free from a HOLD note (User requested Ergonomics fix)
        const handHoldBusyUntil = { left: 0, right: 0 };
        
        let lastNoteTick = -1000;

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
                    let pair = options.find(p => {
                        const lLane = p[0];
                        const rLane = p[1];
                        return leftHandAvailable && rightHandAvailable &&
                               tick >= laneBusyUntil[lLane] && tick >= laneBusyUntil[rLane];
                    });

                    // [FIX] fallback for Chords: If no perfect symmetrical pair is free, find ANY two lanes
                    if (!pair) {
                        const allLanes = (laneCount === 4) ? [1, 2, 3, 4] : [0, 1, 2, 3, 4, 5];
                        const sortedByAvailability = [...allLanes].sort((a, b) => laneBusyUntil[a] - laneBusyUntil[b]);
                        pair = [sortedByAvailability[0], sortedByAvailability[1]];
                    }

                    // Process Chord Notes
                    pair.forEach((lane, idx) => {
                        const note = activeNotes[idx];
                        if (!note) return;

                        const isHold = (note as any).isHold;
                        const duration = isHold ? ((note.durationTicks || 10) + 240) : 10;
                        const blockDuration = isHold ? duration : Math.max(duration, LANE_REUSE_COOLDOWN);
                        
                        if (lane <= 2) {
                            lastLeftLane = lane;
                            if (isHold) handHoldBusyUntil.left = tick + duration;
                        } else {
                            lastRightLane = lane;
                            if (isHold) handHoldBusyUntil.right = tick + duration;
                        }

                        laneBusyUntil[lane] = tick + blockDuration;
                        result.push({ ...note, lane, isProcessed: false } as VisualNote);
                    });
                    
                    lastNoteTick = tick;
                    lastHand = null; // Mixed hands
                    return; // Progress to next tick
                }

                if (activeNotes.length === 1) {
                    const note = activeNotes[0];
                    let useLeftHand = true;

                    // Decision Logic for Hand Assignment (Respect availability)
                    const isRapid = (tick - lastNoteTick) < 240; // 8th note at 120bpm

                    if (!leftHandAvailable && rightHandAvailable) {
                        useLeftHand = false;
                    } else if (leftHandAvailable && !rightHandAvailable) {
                        useLeftHand = true;
                    } else if (!leftHandAvailable && !rightHandAvailable) {
                        // [FIX] Both hands busy holding. Force any hand based on least busy lane.
                        const leftMin = Math.min(...leftLanes.map(l => laneBusyUntil[l]));
                        const rightMin = Math.min(...rightLanes.map(l => laneBusyUntil[l]));
                        useLeftHand = leftMin <= rightMin;
                    } else if (isRapid && lastHand !== null) {
                        // FORCE Alternation during rapid passages to prevent Jackhammers
                        useLeftHand = (lastHand !== 'left');
                    } else if (type === 'stream' || type === 'burst') {
                        // Alternation
                        useLeftHand = (lastHand !== 'left');
                    } else {
                        const rhythmHint = rng.chance(0.5);
                        if (lastHand === null) {
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

                    // [FIX] Final Desperation Fallback: If still no lane, pick the absolute least busy one in the whole game
                    if (lane === -1) {
                        const allLanes = (laneCount === 4) ? [1, 2, 3, 4] : [0, 1, 2, 3, 4, 5];
                        lane = allLanes.reduce((prev, curr) => laneBusyUntil[curr] < laneBusyUntil[prev] ? curr : prev);
                    }

                    // Update states for next notes
                    const isHold = (note as any).isHold;
                    const duration = isHold ? ((note.durationTicks || 10) + 240) : 10;
                    const blockDuration = isHold ? duration : Math.max(duration, LANE_REUSE_COOLDOWN);
                    
                    if (lane <= 2) {
                        lastLeftLane = lane;
                        if (isHold) handHoldBusyUntil.left = tick + duration;
                        lastHand = 'left';
                    } else {
                        lastRightLane = lane;
                        if (isHold) handHoldBusyUntil.right = tick + duration;
                        lastHand = 'right';
                    }

                    laneBusyUntil[lane] = tick + blockDuration;
                    lastNoteTick = tick;
                    result.push({ ...note, lane, isProcessed: false } as VisualNote);
                }
            });
        });

        return result.sort((a, b) => a.time - b.time);
    }
}
