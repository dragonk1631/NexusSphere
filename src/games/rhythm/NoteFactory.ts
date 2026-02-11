import type { ParsedMidi, GameNote } from '../../core/audio/MidiParser';
import { MelodyAnalyzer } from '../../core/audio/MelodyAnalyzer';

export interface VisualNote extends GameNote {
    lane: number;
    isProcessed: boolean;
}

export class NoteFactory {
    /**
     * Convert MIDI data to game visual notes using Channel-based logic.
     * @param forcedChannels (Optional) Specific channels (0-15) to use.
     */
    public static createNotes(midi: ParsedMidi, laneCount: number = 4, forcedChannels: number[] | null = null): VisualNote[] {
        const visualNotes: VisualNote[] = [];
        let notesToProcess: GameNote[] = [];

        // 1. Determine Target Channels
        let targetChannels: number[] = [];

        if (forcedChannels && forcedChannels.length > 0) {
            targetChannels = forcedChannels;
        } else {
            // Use MelodyAnalyzer to get ranked channels
            const rankedChannels = MelodyAnalyzer.findMelodyChannels(midi);
            // Select top 3 channels for a rich chart
            targetChannels = rankedChannels.slice(0, Math.min(rankedChannels.length, 3));
        }

        console.log(`[NoteFactory] Generating notes for channels: ${targetChannels.join(', ')}`);

        // 2. Gather Notes from Target Channels
        // Iterate all tracks and collect notes belonging to target channels
        midi.tracks.forEach(track => {
            // Check if track channel matches
            // We assume track.channel is the source of truth.
            if (targetChannels.includes(track.channel)) {
                notesToProcess.push(...track.notes);
            }
        });

        // 3. Sort by Time
        notesToProcess.sort((a, b) => a.time - b.time);

        // 4. Analyze Pitch Range for mapping
        let minPitch = 127;
        let maxPitch = 0;
        if (notesToProcess.length > 0) {
            notesToProcess.forEach(n => {
                if (n.midi < minPitch) minPitch = n.midi;
                if (n.midi > maxPitch) maxPitch = n.midi;
            });
        } else {
            return [];
        }

        const pitchRange = Math.max(1, maxPitch - minPitch);

        // 5. Apply Layered Fill + Gap Buffer + Collision Handling
        const GAP_BUFFER = 0.05; // 50ms in seconds
        const laneLastOccupiedTime: number[] = Array(laneCount).fill(-Infinity);
        const occupiedLanesAtQuantizedTime = new Map<number, number>();

        notesToProcess.forEach(note => {
            const quantizedTime = Math.round(note.time / GAP_BUFFER);

            // Calculate Target Lane
            const normalizedPitch = (note.midi - minPitch) / pitchRange;
            let targetLane = Math.floor(normalizedPitch * laneCount);
            targetLane = Math.max(0, Math.min(targetLane, laneCount - 1));

            let assignedLane = -1;

            // Try target lane
            if (note.time >= laneLastOccupiedTime[targetLane] + GAP_BUFFER) {
                const currentQuantizedMask = occupiedLanesAtQuantizedTime.get(quantizedTime) || 0;
                if (!(currentQuantizedMask & (1 << targetLane))) {
                    assignedLane = targetLane;
                }
            }

            // Find nearest empty lane
            if (assignedLane === -1) {
                let offset = 1;
                while (offset < laneCount) {
                    // Check Left
                    let checkLane = targetLane - offset;
                    if (checkLane >= 0) {
                        if (note.time >= laneLastOccupiedTime[checkLane] + GAP_BUFFER) {
                            const currentQuantizedMask = occupiedLanesAtQuantizedTime.get(quantizedTime) || 0;
                            if (!(currentQuantizedMask & (1 << checkLane))) {
                                assignedLane = checkLane;
                                break;
                            }
                        }
                    }
                    // Check Right
                    checkLane = targetLane + offset;
                    if (checkLane < laneCount) {
                        if (note.time >= laneLastOccupiedTime[checkLane] + GAP_BUFFER) {
                            const currentQuantizedMask = occupiedLanesAtQuantizedTime.get(quantizedTime) || 0;
                            if (!(currentQuantizedMask & (1 << checkLane))) {
                                assignedLane = checkLane;
                                break;
                            }
                        }
                    }
                    offset++;
                }
            }

            // Force assign if full (overlap)
            if (assignedLane === -1) {
                assignedLane = targetLane;
            }

            laneLastOccupiedTime[assignedLane] = note.time + note.duration;
            const currentQuantizedMask = occupiedLanesAtQuantizedTime.get(quantizedTime) || 0;
            occupiedLanesAtQuantizedTime.set(quantizedTime, currentQuantizedMask | (1 << assignedLane));

            visualNotes.push({
                ...note,
                lane: assignedLane,
                isProcessed: false
            });
        });

        return visualNotes.sort((a, b) => a.time - b.time);
    }
}
