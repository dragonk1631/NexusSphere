import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const OFFICIAL_MIDI_DIR = path.join(PROJECT_ROOT, 'public/assets/audio/midi');
const GENERATED_MIDI_DIR = path.join(PROJECT_ROOT, 'public/assets/audio/generated_midi');
const REGISTRY_PATH = path.join(PROJECT_ROOT, 'public/assets/data/official_songs.json');
const EDITOR_REGISTRY_PATH = path.join(PROJECT_ROOT, 'public/assets/data/midi_list.json');

async function sync() {
    console.log('--- Syncing Song Registries ---');

    // 1. Load existing registry to preserve metadata (difficulty, bpm manually set, etc)
    let registry = [];
    if (fs.existsSync(REGISTRY_PATH)) {
        registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
    }

    const officialFiles = fs.readdirSync(OFFICIAL_MIDI_DIR).filter(f => f.toLowerCase().endsWith('.mid'));
    const generatedFiles = fs.existsSync(GENERATED_MIDI_DIR) ? fs.readdirSync(GENERATED_MIDI_DIR).filter(f => f.toLowerCase().endsWith('.mid')) : [];

    const newRegistry = [];

    // Process Official
    for (const file of officialFiles) {
        const url = `assets/audio/midi/${file}`;
        const existing = registry.find(s => s.url === url);
        newRegistry.push(existing || {
            name: file.replace(/\.mid$/i, ''),
            url: url,
            bpm: 120,
            difficulty: 5,
            duration: 0,
            volume: 1.0
        });
    }

    // Process Generated (Hybrid)
    for (const file of generatedFiles) {
        const url = `assets/audio/generated_midi/${file}`;
        const existing = registry.find(s => s.url === url);
        newRegistry.push(existing || {
            name: `${file.replace(/\.mid$/i, '')} (MP3)`,
            url: url,
            bpm: 120,
            difficulty: 4,
            duration: 0,
            isHybrid: true,
            volume: 1.0
        });
    }

    // Sort by name
    newRegistry.sort((a, b) => a.name.localeCompare(b.name));

    // Save Official Songs
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(newRegistry, null, 2));
    console.log(`Updated ${REGISTRY_PATH} (${newRegistry.length} songs)`);

    // Save Editor MIDI list (Simplified version)
    const midiList = newRegistry.map(s => ({
        name: s.name,
        url: s.url,
        bpm: s.bpm,
        duration: s.duration
    }));
    fs.writeFileSync(EDITOR_REGISTRY_PATH, JSON.stringify(midiList, null, 2));
    console.log(`Updated ${EDITOR_REGISTRY_PATH}`);

    console.log('--- Sync Complete ---');
}

sync().catch(console.error);
