import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// import { Midi } from '@tonejs/midi'; // CJS Named export failure
import toneMidi from '@tonejs/midi';
const { Midi } = toneMidi;
import { MelodyAnalyzer } from '../src/core/audio/MelodyAnalyzer.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Inlined MIDI Parser Logic for Node.js ---
interface GameNote {
    id: string;
    time: number;
    midi: number;
    name: string;
    velocity: number;
    duration: number;
    ticks: number;
    durationTicks: number;
    importance: number;
    channel: number;
}

interface GameTrack {
    name: string;
    channel: number;
    originalIndex: number;
    isDrum: boolean;
    instrumentFamily: string;
    noteCount: number;
    hasAutomation: boolean;
    notes: GameNote[];
}

interface ParsedMidi {
    name: string;
    bpm: number;
    duration: number;
    ppq: number;
    tracks: GameTrack[];
}

class NodeMidiParser {
    public async parse(buffer: Buffer): Promise<ParsedMidi> {
        const midi = new Midi(buffer);
        return this.convertToGameFormat(midi);
    }

    private convertToGameFormat(midi: any): ParsedMidi {
        const bpm = midi.header.tempos[0]?.bpm || 120;

        const tracks: GameTrack[] = midi.tracks.map((track: any, trackIndex: number) => {
            const channel = track.channel !== undefined ? track.channel : (track.name.toLowerCase().includes('drum') ? 9 : 0);
            const isDrum = channel === 9 ||
                track.name.toLowerCase().includes('drum') ||
                track.name.toLowerCase().includes('percussion');

            const hasAutomation = Object.keys(track.controlChanges).length > 0;

            let instrumentFamily = 'Unknown';
            if (isDrum) {
                instrumentFamily = 'Drums';
            } else if (track.instrument.family) {
                instrumentFamily = track.instrument.family;
            }

            const notes: GameNote[] = track.notes.map((note: any, noteIndex: number) => {
                const velocity127 = Math.round(note.velocity * 127);
                const beats = note.time * (bpm / 60);
                const beatOffset = Math.abs(beats - Math.round(beats));
                let importance = velocity127;

                if (beatOffset < 0.1) importance *= 1.3;
                if (isDrum) importance *= 1.5;

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
                    channel: channel
                };
            });

            return {
                name: track.name || (isDrum ? 'Drums' : `Track ${trackIndex}`),
                channel: channel,
                originalIndex: trackIndex,
                isDrum,
                instrumentFamily,
                noteCount: notes.length,
                hasAutomation,
                notes: notes.sort((a, b) => a.time - b.time)
            };
        });

        return {
            name: midi.name || 'Untitled',
            bpm,
            duration: midi.duration,
            ppq: midi.header.ppq || 480,
            tracks
        };
    }
}
// ---------------------------------------------

// Constants
const PROJECT_ROOT = path.resolve(__dirname, '..');
const MIDI_DIR = path.join(PROJECT_ROOT, 'public/assets/audio/midi');
const GENERATED_MIDI_DIR = path.join(PROJECT_ROOT, 'public/assets/audio/generated_midi');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'public/assets/data/beatmaps');

async function main() {
    console.log('Starting Beatmap Generation...');
    console.log(`MIDI Directory: ${MIDI_DIR}`);
    console.log(`Output Directory: ${OUTPUT_DIR}`);

    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        console.log('Created output directory.');
    }

    // Get all MIDI files from both folders
    const officialFiles = fs.readdirSync(MIDI_DIR)
        .filter((file: string) => file.toLowerCase().endsWith('.mid'))
        .map(f => ({ name: f, path: path.join(MIDI_DIR, f) }));
    
    const generatedFiles = fs.existsSync(GENERATED_MIDI_DIR) 
        ? fs.readdirSync(GENERATED_MIDI_DIR)
            .filter((file: string) => file.toLowerCase().endsWith('.mid'))
            .map(f => ({ name: f, path: path.join(GENERATED_MIDI_DIR, f) }))
        : [];

    const allFiles = [...officialFiles, ...generatedFiles];
    console.log(`Found ${allFiles.length} MIDI files total (${officialFiles.length} official, ${generatedFiles.length} generated).`);

    const parser = new NodeMidiParser();
    let successCount = 0;
    let failCount = 0;

    for (const fileObj of allFiles) {
        const filePath = fileObj.path;
        const fileName = path.basename(fileObj.name, path.extname(fileObj.name)); // No extension
        const outputJsonPath = path.join(OUTPUT_DIR, `${fileName}.json`);

        try {
            console.log(`Processing: ${fileObj.name}`);

            // Read file
            const buffer = fs.readFileSync(filePath);

            // NodeMidiParser handles Buffer directly
            const parsedMidi = await parser.parse(buffer);

            // Analyze Melody 
            // We use 'as any' to bypass strict type check between local interface and imported class expected type if needed
            const originalIndex = MelodyAnalyzer.findMelodyTrack(parsedMidi as any);

            if (originalIndex === -1) {
                console.warn(`[WARNING] No melody track found for ${fileObj.name}. Skipping.`);
                failCount++;
                continue;
            }

            // Find the track to get its channel
            const track = parsedMidi.tracks.find(t => t.originalIndex === originalIndex);
            if (!track) {
                console.warn(`[WARNING] Track index ${originalIndex} not found in parsed data for ${fileObj.name}.`);
                failCount++;
                continue;
            }

            // Create Beatmap Data
            const beatmapData = {
                gameChannels: [track.channel], // Store Channel Number
                metadata: {
                    title: parsedMidi.name,
                    bpm: parsedMidi.bpm,
                    duration: parsedMidi.duration,
                    analyzed: new Date().toISOString()
                }
            };

            // Write JSON (Pretty Print)
            fs.writeFileSync(outputJsonPath, JSON.stringify(beatmapData, null, 2));
            console.log(`Saved: ${outputJsonPath}`);
            successCount++;

        } catch (e) {
            console.error(`[ERROR] Failed to process ${fileObj.name}:`, e);
            failCount++;
        }
    }

    console.log('------------------------');
    console.log(`Generation Complete.`);
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${failCount}`);
}

main().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
