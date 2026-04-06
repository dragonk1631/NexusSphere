import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import toneMidi from '@tonejs/midi';
const { Midi } = toneMidi;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const MP3_DIR = path.join(PROJECT_ROOT, 'public/assets/audio/mp3');
const MIDI_DIR = path.join(PROJECT_ROOT, 'public/assets/audio/generated_midi');

async function main() {
    console.log('--- Nexussphere MP3 to MIDI Converter v1.1 ---');
    
    // Parse Arguments
    const args = process.argv.slice(2);
    let customOnsets = null;
    const onsetArgIndex = args.indexOf('--onsets');
    if (onsetArgIndex !== -1 && args[onsetArgIndex + 1]) {
        try {
            customOnsets = JSON.parse(args[onsetArgIndex + 1]);
            console.log(`[Input] Using ${customOnsets.length} custom onsets.`);
        } catch (e) {
            console.error('[Error] Failed to parse custom onsets:', e);
        }
    }
    
    if (!fs.existsSync(MIDI_DIR)) {
        fs.mkdirSync(MIDI_DIR, { recursive: true });
    }

    const mp3Files = fs.readdirSync(MP3_DIR).filter(f => f.toLowerCase().endsWith('.mp3'));
    console.log(`Found ${mp3Files.length} MP3 files.`);

    for (const file of mp3Files) {
        const fileName = path.basename(file, '.mp3');
        const midiPath = path.join(MIDI_DIR, `${fileName}.mid`);

        if (fs.existsSync(midiPath)) {
            console.log(`[Skip] MIDI already exists for: ${file}`);
            continue;
        }

        console.log(`[Processing] Converting ${file} to MIDI...`);
        
        // PROTOTYPE: Create a simulated MIDI file
        // In the next step, we will use browser-assisted decoding for real analysis.
        const midi = new Midi();
        midi.name = fileName;
        
        // Add a "Main Melody" Track (Channel 1)
        const track = midi.addTrack();
        track.name = "Main Melody"; 
        track.channel = 0; 
        track.instrument.number = 1; // Acoustic Grand Piano (analyzer likes piano family)
        
        // Add a "Drum" Track (Channel 10)
        const drumTrack = midi.addTrack();
        drumTrack.name = "Drums";
        drumTrack.channel = 9; 
        
        // Generate Notes
        if (customOnsets && customOnsets.length > 0) {
            // PRECISION MODE: Use analyzed timestamps
            customOnsets.forEach((timestamp, i) => {
                track.addNote({
                    midi: 60 + Math.floor(Math.sin(i * 0.1) * 7), 
                    time: timestamp,
                    duration: 0.2,
                    velocity: 100
                });

                // Drum hit every 4 onsets
                if (i % 4 === 0) {
                    drumTrack.addNote({
                        midi: 36,
                        time: timestamp,
                        duration: 0.1,
                        velocity: 110
                    });
                }
            });
        } else {
            // LEGACY/DUMMY MODE: Generate rhythmic grid
            for (let i = 0; i < 400; i++) {
                const time = i * 0.3; 
                track.addNote({
                    midi: 60 + Math.floor(Math.sin(i * 0.05) * 10), // Varied Pitch
                    time: time,
                    duration: 0.2 + (i % 4) * 0.15, // Rhythmic variety
                    velocity: 100 // High velocity
                });
                
                // Drum hit every 0.6s
                if (i % 2 === 0) {
                    drumTrack.addNote({
                        midi: 36, 
                        time: i * 0.3,
                        duration: 0.1,
                        velocity: 110
                    });
                }
            }
        }

        fs.writeFileSync(midiPath, Buffer.from(midi.toArray()));
        console.log(`[Success] Generated: ${midiPath}`);
    }

    console.log('--- Conversion Complete ---');
}

main().catch(console.error);
