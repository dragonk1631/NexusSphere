import * as fs from 'fs';
import * as path from 'path';
import toneMidi from '@tonejs/midi';
const { Midi } = toneMidi;

const MIDI_DIR = 'public/assets/audio/midi';
const OFFICIAL_SONGS_FILE = 'public/assets/data/official_songs.json';
const MIDI_LIST_FILE = 'public/assets/data/midi_list.json';

interface SongEntry {
    name: string;
    url: string;
    bpm: number;
    difficulty?: number;
    duration: number;
    noteCount?: number;
}

async function sync() {
    console.log("Starting Song List Sync...");

    // 1. Read files in MIDI folder
    const files = fs.readdirSync(MIDI_DIR).filter(f => f.toLowerCase().endsWith('.mid') || f.toLowerCase().endsWith('.midi'));
    console.log(`Found ${files.length} MIDI files in folder.`);

    // 2. Load existing official songs
    let officialSongs: SongEntry[] = [];
    if (fs.existsSync(OFFICIAL_SONGS_FILE)) {
        officialSongs = JSON.parse(fs.readFileSync(OFFICIAL_SONGS_FILE, 'utf-8'));
    }

    const newOfficialList: SongEntry[] = [];
    const newMidiList: any[] = [];

    for (const file of files) {
        const url = `assets/audio/midi/${file}`;
        const existing = officialSongs.find(s => s.url === url);

        let bpm = 120;
        let duration = 0;
        let noteCount = 0;
        let name = file.replace(/\.(mid|midi)$/i, '').replace(/_/g, ' ');

        try {
            const buffer = fs.readFileSync(path.join(MIDI_DIR, file));
            const midi = new Midi(buffer);
            bpm = Math.round(midi.header.tempos[0]?.bpm || 120);
            duration = Math.round(midi.duration);
            midi.tracks.forEach(t => noteCount += t.notes.length);
        } catch (e) {
            console.warn(`Failed to parse ${file}, using defaults.`);
        }

        // Update name if from folder (prettify)
        if (!existing) {
            console.log(`New song detected: ${name}`);
        }

        const entry: SongEntry = {
            name: existing ? existing.name : name,
            url: url,
            bpm: existing ? existing.bpm : bpm,
            difficulty: existing ? existing.difficulty : 6,
            duration: duration
        };

        newOfficialList.push(entry);

        newMidiList.push({
            name: entry.name,
            url: url,
            bpm: entry.bpm,
            duration: duration,
            noteCount: noteCount
        });
    }

    // Sort by name
    newOfficialList.sort((a, b) => a.name.localeCompare(b.name));
    newMidiList.sort((a, b) => a.name.localeCompare(b.name));

    // Save
    fs.writeFileSync(OFFICIAL_SONGS_FILE, JSON.stringify(newOfficialList, null, 2));
    fs.writeFileSync(MIDI_LIST_FILE, JSON.stringify(newMidiList, null, 2));

    console.log(`Sync complete. Saved ${newOfficialList.length} songs to official_songs.json`);
}

sync().catch(console.error);
