import { type LegacyPatternSegment } from './LegacyPatternAnalyzer';
import type { LegacyVisualNote } from './LegacyNoteFactory';

export class LegacyLaneAllocator {
    /**
     * Assign lanes to notes based on patterns and ergonomics.
     */
    public static assignLanes(segments: LegacyPatternSegment[], laneCount: number = 6, difficulty: string = 'NORMAL'): LegacyVisualNote[] {
        const result: LegacyVisualNote[] = [];
        if (laneCount !== 4 && laneCount !== 6) laneCount = 6; 

        const totalLanes = 6; 
        const leftLanes = (laneCount === 4) ? [1, 2] : [0, 1, 2];
        const rightLanes = (laneCount === 4) ? [3, 4] : [3, 4, 5];

        let lastLeftLane = leftLanes[Math.floor(leftLanes.length / 2)];
        let lastRightLane = rightLanes[Math.floor(rightLanes.length / 2)];

        const maxChordSize = (difficulty === 'HARD') ? 2 : 1;

        let lastHand: 'left' | 'right' | null = null;
        let consecutiveSameHand = 0;
        const FATIGUE_THRESHOLD = 3; 

        const laneBusyUntil = new Array(totalLanes).fill(0);

        segments.forEach(segment => {
            const { type, notes } = segment;

            const tickGroups = new Map<number, LegacyVisualNote[]>();
            notes.forEach((n: any) => {
                const tick = n.quantizedStartTick;
                if (!tickGroups.has(tick)) tickGroups.set(tick, []);
                tickGroups.get(tick)!.push(n);
            });

            const sortedTicks = Array.from(tickGroups.keys()).sort((a, b) => a - b);

            sortedTicks.forEach(tick => {
                const groupNotes = tickGroups.get(tick)!;
                const primaryInGroup = groupNotes.filter(n => (n as any).isPrimary);
                const count = Math.min(groupNotes.length, maxChordSize);
                let activeNotes = groupNotes.slice(0, count);

                if (primaryInGroup.length > 0) {
                    const nonPrimary = activeNotes.filter(n => !(n as any).isPrimary);
                    activeNotes = Array.from(new Set([...primaryInGroup, ...nonPrimary])).slice(0, Math.max(count, primaryInGroup.length));
                    if (primaryInGroup.length > activeNotes.length) activeNotes = primaryInGroup;
                }

                const findFreeLane = (preferred: number, hand: 'left' | 'right'): number => {
                    if (tick >= laneBusyUntil[preferred]) return preferred;
                    const range = (hand === 'left') ? leftLanes : rightLanes;
                    const sortedRange = [...range].sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred));
                    for (const l of sortedRange) if (tick >= laneBusyUntil[l]) return l;
                    const otherRange = (hand === 'left') ? rightLanes : leftLanes;
                    const sortedOtherRange = [...otherRange].sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred));
                    for (const l of sortedOtherRange) if (tick >= laneBusyUntil[l]) return l;
                    return preferred;
                };

                if (activeNotes.length === 2) {
                    const options = (laneCount === 4) ? [[1, 4], [2, 3], [1, 3], [2, 4]] : [[1, 4], [0, 5], [2, 3], [0, 4], [1, 5], [2, 4]];
                    const validOptions = options.filter(pair => tick >= laneBusyUntil[pair[0]] && tick >= laneBusyUntil[pair[1]]);

                    if (validOptions.length > 0) {
                        const chosenPair = validOptions[Math.floor(Math.random() * validOptions.length)];
                        activeNotes.forEach((note, idx) => {
                            const lane = chosenPair[idx];
                            const isHold = (note as any).isHold;
                            const duration = isHold ? ((note.durationTicks || 10) + 60) : 10;
                            laneBusyUntil[lane] = tick + duration;
                            result.push({ ...note, lane, isProcessed: false } as LegacyVisualNote);
                            if (lane <= 2) lastLeftLane = lane; else lastRightLane = lane;
                        });
                        lastHand = null; consecutiveSameHand = 0;
                    } else {
                        activeNotes = [activeNotes[0]];
                    }
                }

                if (activeNotes.length === 1) {
                    const note = activeNotes[0];
                    let useLeftHand = true;
                    if (type === 'stream' || type === 'burst') useLeftHand = (lastHand !== 'left');
                    else {
                        const rhythmHint = Math.random() > 0.5;
                        if (consecutiveSameHand >= FATIGUE_THRESHOLD) useLeftHand = (lastHand !== 'left');
                        else if (lastHand === null) useLeftHand = rhythmHint;
                        else useLeftHand = (Math.random() > 0.7) ? !lastHand : rhythmHint;
                    }

                    let lane;
                    if (useLeftHand) {
                        const move = (Math.random() > 0.5) ? 1 : -1;
                        let preferred = lastLeftLane + move;
                        if (!leftLanes.includes(preferred)) preferred = leftLanes[Math.floor(Math.random() * leftLanes.length)];
                        lane = findFreeLane(preferred, 'left');
                    } else {
                        const move = (Math.random() > 0.5) ? 1 : -1;
                        let preferred = lastRightLane + move;
                        if (!rightLanes.includes(preferred)) preferred = rightLanes[Math.floor(Math.random() * rightLanes.length)];
                        lane = findFreeLane(preferred, 'right');
                    }

                    if (tick < laneBusyUntil[lane]) return;

                    if (lane <= 2) {
                        lastLeftLane = lane;
                        if (lastHand === 'left') consecutiveSameHand++; else { lastHand = 'left'; consecutiveSameHand = 1; }
                    } else {
                        lastRightLane = lane;
                        if (lastHand === 'right') consecutiveSameHand++; else { lastHand = 'right'; consecutiveSameHand = 1; }
                    }

                    const isHold = (note as any).isHold;
                    const duration = isHold ? ((note.durationTicks || 10) + 60) : 10;
                    laneBusyUntil[lane] = tick + duration;
                    result.push({ ...note, lane, isProcessed: false } as LegacyVisualNote);
                }
            });
        });

        return result.sort((a, b) => a.time - b.time);
    }
}
