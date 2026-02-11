import * as fs from 'fs';
import * as path from 'path';
import midiPkg from '@tonejs/midi';
const { Midi } = midiPkg;

const MIDI_DIR = path.join(process.cwd(), 'public/assets/audio/midi');
const OUTPUT_FILE = path.join(process.cwd(), 'public/assets/data/midi_list.json');

interface SongEntry {
    name: string;
    url: string;
    bpm: number;
    duration: number;
    noteCount: number;
}

function generateMidiList() {
    // ... (existing checks)

    const files = fs.readdirSync(MIDI_DIR);
    const midiFiles = files.filter((file: string) => file.toLowerCase().endsWith('.mid') || file.toLowerCase().endsWith('.midi'));

    const songList: SongEntry[] = midiFiles.map((file: string) => {
        const filePath = path.join(MIDI_DIR, file);
        const buffer = fs.readFileSync(filePath);
        const midi = new Midi(buffer);

        // Calculate metadata
        const bpm = Math.round(midi.header.tempos[0]?.bpm || 120);
        const duration = midi.duration;
        let noteCount = 0;
        midi.tracks.forEach(t => noteCount += t.notes.length);

        // Create a display name
        const name = file.replace(/\.(mid|midi)$/i, '').replace(/_/g, ' ');

        console.log(`Processed: ${name} (BPM: ${bpm}, Notes: ${noteCount})`);

        return {
            name: name,
            url: `assets/audio/midi/${file}`,
            bpm: bpm,
            duration: duration,
            noteCount: noteCount
        };
    });

    console.log(`Found ${songList.length} MIDI files.`);

    const outputDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(songList, null, 2));
    console.log(`Successfully wrote song list to: ${OUTPUT_FILE}`);
}

generateMidiList();
