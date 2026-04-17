import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(PROJECT_ROOT, 'public/assets/data/official_songs.json');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');

async function analyze() {
    console.log('--- Analyzing Audio Normalization Levels (FFmpeg) ---');

    if (!fs.existsSync(REGISTRY_PATH)) {
        console.error('Song registry not found.');
        return;
    }

    const songs = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
    let updatedCount = 0;

    // Helper to simplify names for matching (same logic as AssetLoader)
    const simplify = (s) => s.toLowerCase().replace(/[\s_]/g, '').normalize('NFC');

    for (const song of songs) {
        let mp3Path = null;
        
        // 1. Direct audioUrl check
        if (song.audioUrl) {
            const fullPath = path.join(PUBLIC_DIR, song.audioUrl);
            if (fs.existsSync(fullPath)) mp3Path = fullPath;
        }

        // 2. Search if not found
        if (!mp3Path) {
            const cleanName = song.name.replace(/\s*\(MP3\)\s*/gi, '').replace(/\s*\(Preview\)\s*/gi, '').trim();
            const targetKey = simplify(cleanName);
            
            const searchDirs = [
                path.join(PUBLIC_DIR, 'assets/audio/mp3'),
                path.join(PUBLIC_DIR, 'assets/audio/ui/themes')
            ];

            for (const dir of searchDirs) {
                if (!fs.existsSync(dir)) continue;
                // Simple recursive search
                const found = findFileFuzzy(dir, targetKey, simplify);
                if (found) {
                    mp3Path = found;
                    break;
                }
            }
        }

        if (mp3Path) {
            try {
                // [CRITICAL] FFmpeg volumedetect outputs to STDERR
                const result = spawnSync(ffmpegStatic, ['-i', mp3Path, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf-8' });
                const output = result.stderr; 
                
                const match = output.match(/max_volume: ([\-\d\.]+) dB/);
                if (match) {
                    const maxDb = parseFloat(match[1]);
                    const targetDb = -1.5; // Target peak
                    const gain = Math.pow(10, (targetDb - maxDb) / 20);
                    
                    song.normalizationGain = parseFloat(gain.toFixed(3));
                    console.log(`  ✔ [${song.name}] Peak: ${maxDb}dB -> Gain: ${song.normalizationGain}`);
                    updatedCount++;
                } else {
                    console.log(`  ⚠ [${song.name}] No peak detected in FFmpeg output.`);
                }
            } catch (e) {
                console.warn(`  ❌ [${song.name}] Analysis error: ${e.message}`);
            }
        }
    }

    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(songs, null, 2));
    console.log(`\n✅ Analyzed ${updatedCount} songs. Registry updated.`);
}

function findFileFuzzy(dir, targetKey, simplify) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            const found = findFileFuzzy(fullPath, targetKey, simplify);
            if (found) return found;
        } else if (file.toLowerCase().endsWith('.mp3')) {
            const filename = file.split('.')[0];
            if (simplify(filename) === targetKey) {
                return fullPath;
            }
        }
    }
    return null;
}

analyze().catch(console.error);
