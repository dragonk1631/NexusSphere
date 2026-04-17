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
const THEME_DIR = path.join(PROJECT_ROOT, 'public/assets/audio/ui/themes');
const MIDI_DIR = path.join(PROJECT_ROOT, 'public/assets/audio/generated_midi');
const TEMP_STEMS_DIR = path.join(PROJECT_ROOT, 'temp_stems');
const PY_SCRIPT = path.join(__dirname, 'analyze_beats.py');

// ============================================================
// Run Python librosa analyzer and return parsed JSON
// ============================================================
function analyzeWithLibrosa(mp3Path) {
    return new Promise((resolve, reject) => {
        let stdout = '';
        let stderr = '';

        // Create temp stems dir if not exists
        if (!fs.existsSync(TEMP_STEMS_DIR)) fs.mkdirSync(TEMP_STEMS_DIR, { recursive: true });

        const py = spawn('py', [PY_SCRIPT, mp3Path, TEMP_STEMS_DIR], {
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
                // Remove BOM and any AI debug messages printed to stdout
                const startIdx = stdout.indexOf('{');
                if (startIdx === -1) throw new Error("No JSON payload found inside script output.");
                const clean = stdout.substring(startIdx).trim();
                resolve(JSON.parse(clean));
            } catch (e) {
                reject(new Error(`JSON parse failed: ${e.message}\nRaw: ${stdout.slice(0, 200)}`));
            }
        });

        py.on('error', err => reject(new Error(`Failed to spawn Python: ${err.message}`)));
    });
}

// ============================================================
// Helper to find all MP3 files recursively
// ============================================================
function findMp3Files(dir) {
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir, { withFileTypes: true, recursive: true });
    return entries
        .filter(e => e.isFile() && e.name.toLowerCase().endsWith('.mp3'))
        .map(e => path.join(e.parentPath || e.path, e.name));
}

// ============================================================
// Main pipeline
// ============================================================
async function main() {
    console.log('=== NexusSphere Beat Engine v10.0 (Auto-Cleanup Enabled) ===\n');
    const args  = process.argv.slice(2);
    const force = args.includes('--force') || args.includes('-f');

    if (!fs.existsSync(PY_SCRIPT)) {
        console.error(`[!] Python script not found: ${PY_SCRIPT}`);
        process.exit(1);
    }

    if (!fs.existsSync(MIDI_DIR)) fs.mkdirSync(MIDI_DIR, { recursive: true });

    // Collect all MP3 files from both base MP3 dir and Theme BGM dir
    console.log(`[Scan] Searching for MP3s in:\n  - ${MP3_DIR}\n  - ${THEME_DIR}`);
    const mp3Paths = [
        ...findMp3Files(MP3_DIR),
        ...findMp3Files(THEME_DIR)
    ];

    console.log(`[Scan] Found ${mp3Paths.length} candidates.`);

    let processed = 0, skipped = 0;

    for (const mp3Path of mp3Paths) {
        const file     = path.basename(mp3Path);
        const base     = path.basename(file, '.mp3');
        const midiPath = path.join(MIDI_DIR, `${base}.mid`);

        if (fs.existsSync(midiPath) && !force) {
            console.log(`[skip] ${file}`);
            skipped++;
            continue;
        }

        console.log(`\n[Processing] ${file}`);
        console.log(`  Path: ${mp3Path}`);
        console.log(`  Analyzing with librosa + Demucs (Temp: ${TEMP_STEMS_DIR})...`);

        try {
            const data = await analyzeWithLibrosa(mp3Path);

            if (data.error) throw new Error(data.error);

            const { bpm, drums, vocal, bass, instrumental } = data;
            console.log(`  BPM: ${bpm} | Drums: ${drums?.length || 0} | Vocal: ${vocal?.length || 0} | Bass: ${bass?.length || 0} | Inst: ${instrumental?.length || 0}`);

            const midi = new Midi();
            midi.header.setTempo(Math.round(bpm));

            // --- 1. Main Gameplay Track (Vocals) ---
            const vTrack = midi.addTrack();
            vTrack.name = 'Main Gameplay';
            vTrack.channel = 0;
            vTrack.instrument.number = 0; 
            if (vocal) {
                vocal.forEach(n => {
                    vTrack.addNote({
                        midi: Math.max(60, Math.min(86, n.pitch || 72)),
                        time: n.time,
                        duration: n.duration,
                        velocity: Math.min(0.95, Math.max(0.4, n.energy * 0.8))
                    });
                });
            }

            // --- 2. Drum Track (Channel 9 - MIDI Standard) ---
            const dTrack = midi.addTrack();
            dTrack.name = 'Drums';
            dTrack.channel = 9; 
            dTrack.instrument.number = 0;
            if (drums) {
                drums.forEach(n => {
                    let midiNote = 36; // Kick
                    if (n.type === 'snare') {
                        midiNote = (n.time * 100) % 2 < 1 ? 38 : 40;
                    }
                    dTrack.addNote({
                        midi: midiNote,
                        time: n.time,
                        duration: 0.08,
                        velocity: Math.min(0.98, 0.60 + n.energy * 0.38)
                    });
                });
            }

            // --- 3. Bass Track ---
            const bTrack = midi.addTrack();
            bTrack.name = 'Bass';
            bTrack.channel = 1;
            bTrack.instrument.number = 34; // Electric Bass (pick)
            if (bass) {
                bass.forEach(n => {
                    bTrack.addNote({
                        midi: Math.max(30, Math.min(50, n.pitch || 36)),
                        time: n.time,
                        duration: n.duration,
                        velocity: Math.min(0.9, 0.4 + n.energy * 0.5)
                    });
                });
            }

            // --- 4. Instrumental Track ---
            const iTrack = midi.addTrack();
            iTrack.name = 'Instrumental';
            iTrack.channel = 2;
            iTrack.instrument.number = 81; // Lead 2 (sawtooth)
            if (instrumental) {
                instrumental.forEach(n => {
                    iTrack.addNote({
                        midi: Math.max(50, Math.min(80, n.pitch || 60)),
                        time: n.time,
                        duration: n.duration,
                        velocity: Math.min(0.85, 0.3 + n.energy * 0.6)
                    });
                });
            }

            fs.writeFileSync(midiPath, Buffer.from(midi.toArray()));
            console.log(`  [✓] → ${base}.mid`);
            
            // --- Cleanup Stems ---
            const stemPath = path.join(TEMP_STEMS_DIR, 'htdemucs', base);
            if (fs.existsSync(stemPath)) {
                console.log(`  [Cleanup] Removing temporary stems: ${stemPath}`);
                fs.rmSync(stemPath, { recursive: true, force: true });
            }

            processed++;

        } catch (e) {
            console.error(`  [✗] ${file}: ${e.message}`);
        }
    }

    // Final cleanup of the temp directory if empty or as requested
    if (fs.existsSync(TEMP_STEMS_DIR)) {
        console.log(`\n[Final Cleanup] Removing temp directory: ${TEMP_STEMS_DIR}`);
        try {
            fs.rmSync(TEMP_STEMS_DIR, { recursive: true, force: true });
        } catch (e) {}
    }

    console.log(`\n=== Done: ${processed} generated, ${skipped} skipped ===`);
}

main().catch(console.error);
