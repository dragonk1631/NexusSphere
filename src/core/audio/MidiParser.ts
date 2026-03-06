import { Midi } from '@tonejs/midi';

export interface GameNote {
    id: string;
    time: number;
    midi: number;
    name: string;
    velocity: number;
    duration: number;
    ticks: number;       // Absolute tick position
    durationTicks: number; // Duration in ticks
    importance: number;
    channel: number; // MIDI channel (0-15)
}

export interface GameTrack {
    name: string;
    channel: number;
    originalIndex: number; // SMF 원본 트랙 인덱스
    isDrum: boolean;
    instrumentFamily: string;
    noteCount: number;
    hasAutomation: boolean;
    notes: GameNote[];
}

export interface ParsedMidi {
    name: string;
    bpm: number;
    duration: number;
    durationTicks: number;
    ppq: number; // Pulses Per Quarter note
    tempos: { bpm: number, time: number, ticks: number }[]; // Tempo map
    timeSignatures: { ticks: number, timeSignature: number[] }[]; // Time Signature map
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

            // check for Automation (Control Changes)
            // If a track has CC events, it controls audio parameters.
            const hasAutomation = Object.keys(track.controlChanges).length > 0;

            // Instrument Family Analysis (based on Program Change events)
            let instrumentFamily = 'Unknown';
            if (isDrum) {
                instrumentFamily = 'Drums';
            } else if (track.instrument.family) {
                instrumentFamily = track.instrument.family;
            }

            const notes: GameNote[] = track.notes.map((note, noteIndex) => {
                const velocity127 = Math.round(note.velocity * 127);
                const beats = note.time * (bpm / 60);
                const beatOffset = Math.abs(beats - Math.round(beats));
                let importance = velocity127;

                if (beatOffset < 0.1) importance *= 1.3;
                if (isDrum) importance *= 1.5;

                const noteChannel = (note as any).channel !== undefined ? (note as any).channel : track.channel;

                return {
                    id: `${trackIndex}-${noteIndex}`,
                    time: note.time,
                    midi: note.midi,
                    name: note.name,
                    velocity: velocity127,
                    duration: note.duration,
                    ticks: note.ticks,
                    durationTicks: note.durationTicks,
                    importance,
                    channel: noteChannel
                };
            });

            return {
                name: track.name || (isDrum ? 'Drums' : `Track ${trackIndex}`),
                channel: track.channel,
                originalIndex: trackIndex,
                isDrum,
                instrumentFamily,
                noteCount: notes.length,
                hasAutomation, // New Flag
                notes: notes.sort((a, b) => a.time - b.time)
            };
        });

        return {
            name: midi.name || 'Untitled',
            bpm,
            duration: midi.duration,
            durationTicks: Math.max(...midi.tracks.map(t => t.durationTicks), 0),
            ppq: midi.header.ppq || 480,
            tempos: midi.header.tempos.length > 0
                ? midi.header.tempos.map(t => ({ bpm: t.bpm, time: t.time || 0, ticks: t.ticks || 0 }))
                : [{ bpm: bpm, time: 0, ticks: 0 }],
            timeSignatures: midi.header.timeSignatures.map(ts => ({ ticks: ts.ticks || 0, timeSignature: ts.timeSignature })),
            tracks
        };
    }
}
