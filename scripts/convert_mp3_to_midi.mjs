import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import toneMidi from '@tonejs/midi';
const { Midi } = toneMidi;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const MP3_DIR  = path.join(PROJECT_ROOT, 'public/assets/audio/mp3');
const MIDI_DIR = path.join(PROJECT_ROOT, 'public/assets/audio/generated_midi');
const PY_SCRIPT = path.join(__dirname, 'analyze_beats.py');

// ============================================================
// Run Python librosa analyzer and return parsed JSON
// ============================================================
function analyzeWithLibrosa(mp3Path) {
    return new Promise((resolve, reject) => {
        let stdout = '';
        let stderr = '';

        const py = spawn('py', [PY_SCRIPT, mp3Path], {
            stdio: ['ignore', 'pipe', 'pipe']
        });

        py.stdout.on('data', d => { stdout += d.toString(); });
        py.stderr.on('data', d => { stderr += d.toString(); });

        py.on('close', code => {
            if (code !== 0) {
                reject(new Error(`Python exited ${code}: ${stderr.slice(0, 500)}`));
                return;
            }
            try {
                // Remove BOM if present (Windows PowerShell pipe quirk)
                const clean = stdout.replace(/^\uFEFF/, '').trim();
                resolve(JSON.parse(clean));
            } catch (e) {
                reject(new Error(`JSON parse failed: ${e.message}\nRaw: ${stdout.slice(0, 200)}`));
            }
        });

        py.on('error', err => reject(new Error(`Failed to spawn Python: ${err.message}`)));
    });
}

// ============================================================
// Main pipeline
// ============================================================
async function main() {
    console.log('=== NexusSphere Beat Engine v9.0 (librosa Backend) ===\n');
    const args  = process.argv.slice(2);
    const force = args.includes('--force') || args.includes('-f');

    if (!fs.existsSync(PY_SCRIPT)) {
        console.error(`[!] Python script not found: ${PY_SCRIPT}`);
        process.exit(1);
    }

    if (!fs.existsSync(MIDI_DIR)) fs.mkdirSync(MIDI_DIR, { recursive: true });

    const files = fs.readdirSync(MP3_DIR)
        .filter(f => f.toLowerCase().endsWith('.mp3'));

    let processed = 0, skipped = 0;

    for (const file of files) {
        const base     = path.basename(file, '.mp3');
        const mp3Path  = path.join(MP3_DIR, file);
        const midiPath = path.join(MIDI_DIR, `${base}.mid`);

        if (fs.existsSync(midiPath) && !force) {
            console.log(`[skip] ${file}`);
            skipped++;
            continue;
        }

        console.log(`\n[Processing] ${file}`);
        console.log(`  Analyzing with librosa (HPSS + onset_detect)...`);

        try {
            const data = await analyzeWithLibrosa(mp3Path);

            if (data.error) throw new Error(data.error);

            const { bpm, drums, melody } = data;
            console.log(`  BPM: ${bpm} | Drums: ${drums.length} | Melody: ${melody.length}`);

            // Build Unified MIDI
            const midi = new Midi();
            midi.header.setTempo(Math.round(bpm));

            // --- Main Gameplay Track (Channel 0 for direct processing) ---
            const mainTrack = midi.addTrack();
            mainTrack.name = 'Main Gameplay';
            mainTrack.channel = 0;
            mainTrack.instrument.number = 0; // Piano-ish base

            // 1. Add Drums (as short TAP notes)
            drums.forEach((n) => {
                let midiNote = 36; // Kick
                if (n.type === 'snare') {
                    midiNote = (n.time * 100) % 2 < 1 ? 38 : 40;
                }

                mainTrack.addNote({
                    midi: midiNote,
                    time: n.time,
                    duration: 0.08, // Very short = TAP
                    velocity: Math.min(0.98, 0.60 + n.energy * 0.38)
                });
            });

            // 2. Add Melody/Vocals (as long HOLD notes)
            melody.forEach((n, i) => {
                // Pitch variation for melody: F4 to C5 range (65-72)
                const pitch = 65 + Math.round(Math.sin(i * 0.35) * 4 + Math.cos(i * 0.11) * 3);
                
                mainTrack.addNote({
                    midi: Math.max(64, Math.min(84, pitch)),
                    time: n.time,
                    duration: 0.55, // Longer = HOLD
                    velocity: Math.min(0.95, 0.45 + n.energy * 0.50)
                });
            });

            fs.writeFileSync(midiPath, Buffer.from(midi.toArray()));
            console.log(`  [✓] → ${base}.mid`);
            processed++;

        } catch (e) {
            console.error(`  [✗] ${file}: ${e.message}`);
        }
    }

    console.log(`\n=== Done: ${processed} generated, ${skipped} skipped ===`);
}

main().catch(console.error);
