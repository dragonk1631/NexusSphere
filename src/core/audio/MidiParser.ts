import { Midi } from '@tonejs/midi';

export interface GameNote {
    id: string;
    time: number;
    midi: number;
    name: string;
    velocity: number;
    duration: number;
    importance: number;
}

export interface GameTrack {
    name: string;
    channel: number;
    originalIndex: number; // SMF 원본 트랙 인덱스
    isDrum: boolean;
    instrumentFamily: string;
    noteCount: number;
    notes: GameNote[];
}

export interface ParsedMidi {
    name: string;
    bpm: number;
    duration: number;
    tracks: GameTrack[];
}

export class MidiParser {
    /**
     * Parse MIDI from binary buffer
     */
    public async parse(buffer: ArrayBuffer): Promise<ParsedMidi> {
        const midi = new Midi(buffer);
        return this.convertToGameFormat(midi);
    }

    private convertToGameFormat(midi: Midi): ParsedMidi {
        const bpm = midi.header.tempos[0]?.bpm || 120;

        const tracks: GameTrack[] = midi.tracks.map((track, trackIndex) => {
            const isDrum = track.channel === 9 ||
                track.name.toLowerCase().includes('drum') ||
                track.name.toLowerCase().includes('percussion');

            // Instrument Family Analysis (based on Program Change events)
            let instrumentFamily = 'Unknown';
            if (isDrum) {
                instrumentFamily = 'Drums';
            } else if (track.instrument.family) {
                instrumentFamily = track.instrument.family;
            }

            const notes: GameNote[] = track.notes.map((note, noteIndex) => {
                // Simple importance calculation based on velocity and beat alignment
                const beats = note.time * (bpm / 60);
                const beatOffset = Math.abs(beats - Math.round(beats));
                let importance = note.velocity;

                if (beatOffset < 0.1) importance *= 1.3;
                if (isDrum) importance *= 1.5;

                return {
                    id: `${trackIndex}-${noteIndex}`,
                    time: note.time,
                    midi: note.midi,
                    name: note.name,
                    velocity: note.velocity,
                    duration: note.duration,
                    importance
                };
            });

            return {
                name: track.name || (isDrum ? 'Drums' : `Track ${trackIndex}`),
                channel: track.channel,
                originalIndex: trackIndex,
                isDrum,
                instrumentFamily,
                noteCount: notes.length,
                notes: notes.sort((a, b) => a.time - b.time)
            };
        });

        return {
            name: midi.name || 'Untitled',
            bpm,
            duration: midi.duration,
            tracks
        };
    }
}
