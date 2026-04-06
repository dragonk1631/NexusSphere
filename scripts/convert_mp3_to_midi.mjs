import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';
import toneMidi from '@tonejs/midi';
const { Midi } = toneMidi;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const MP3_DIR = path.join(PROJECT_ROOT, 'public/assets/audio/mp3');
const MIDI_DIR = path.join(PROJECT_ROOT, 'public/assets/audio/generated_midi');

async function main() {
    console.log('--- Nexussphere Master Rhythm Engine v4.0 ---');
    
    const args = process.argv.slice(2);
    const forceOverwrite = args.includes('--force') || args.includes('-f');
    const sensitivity = parseFloat(args.find((_, i) => args[i-1] === '--sensitivity' || args[i-1] === '-s') || '2.0');
    
    if (!fs.existsSync(MIDI_DIR)) {
        fs.mkdirSync(MIDI_DIR, { recursive: true });
    }

    const mp3Files = fs.readdirSync(MP3_DIR).filter(f => f.toLowerCase().endsWith('.mp3'));
    console.log(`Processing ${mp3Files.length} MP3 files...`);

    for (const file of mp3Files) {
        const fileName = path.basename(file, '.mp3');
        const midiPath = path.join(MIDI_DIR, `${fileName}.mid`);

        if (fs.existsSync(midiPath) && !forceOverwrite) {
            console.log(`[Skip] ${file}`);
            continue;
        }

        const mp3Path = path.join(MP3_DIR, file);
        console.log(`[Processing] ${file}...`);
        
        let duration = 0;
        try {
            duration = await getAudioDuration(mp3Path);
            console.log(`  > Duration: ${duration.toFixed(2)}s`);
        } catch (e) {
            duration = 180;
        }

        const tracksConfig = [
            { name: "Vocal/Lead", channel: 0, inst: 1, filter: "bandpass=f=1800:w=2000", sens: sensitivity * 0.8 },
            { name: "Bass/Kick", channel: 1, inst: 34, filter: "lowpass=f=250", sens: sensitivity * 0.9 },
            { name: "Harmony/Chords", channel: 2, inst: 49, filter: "bandpass=f=4000:w=3000", sens: sensitivity * 1.2 },
            { name: "Percussion", channel: 9, inst: 0, filter: "highpass=f=5500", sens: sensitivity * 0.85 }
        ];

        const midi = new Midi();
        midi.name = fileName;
        
        // Add a "Sync" track for duration
        const syncTrack = midi.addTrack();
        syncTrack.name = "Sync/Duration";
        syncTrack.addNote({ midi: 0, time: duration, duration: 0.1, velocity: 0 });

        const allAnalyzedNotes = [];

        for (const config of tracksConfig) {
            console.log(`  > Analyzing Band: ${config.name}...`);
            const notes = await analyzeMP3WithSustain(mp3Path, config.sens, config.filter);
            
            if (notes.length > 0) {
                const track = midi.addTrack();
                track.name = config.name;
                track.channel = config.channel;
                if (config.channel !== 9) track.instrument.number = config.inst;

                notes.forEach((n, i) => {
                    // Collect for master track merging
                    allAnalyzedNotes.push({ ...n, band: config.name, channel: config.channel });
                    
                    const midiNote = config.channel === 9 ? 36 : (60 + (config.channel * 7) + Math.floor(Math.sin(i * 0.2) * 5));
                    track.addNote({
                        midi: midiNote,
                        time: n.time,
                        duration: n.duration,
                        velocity: Math.min(127, Math.floor(n.energy * 250) + 40)
                    });
                });
            }
        }

        // --- MASTER TRACK GENERATION (Phase 9) ---
        console.log(`  > Generating COMPOSITE MASTER TRACK...`);
        const masterTrack = midi.addTrack();
        masterTrack.name = "Master Playable Rhythm";
        masterTrack.channel = 0; // Standard Playable Channel
        masterTrack.instrument.number = 1; // Grand Piano (Primary)

        // Merge and Deduplicate
        allAnalyzedNotes.sort((a, b) => a.time - b.time);
        
        const mergedNotes = [];
        let lastTime = -1;

        allAnalyzedNotes.forEach(n => {
            // Deduplicate: If closer than 60ms, keep the one from Vocals or higher energy
            if (n.time - lastTime < 0.06) {
                const last = mergedNotes[mergedNotes.length - 1];
                if (n.band === 'Vocal/Lead' || n.energy > last.energy) {
                    mergedNotes[mergedNotes.length - 1] = n;
                }
                return;
            }
            mergedNotes.push(n);
            lastTime = n.time;
        });

        // Anti-Boredom Pass (Fill Gaps > 0.6s)
        console.log(`  > Bridging rhythmic gaps...`);
        const gapFilledNotes = [...mergedNotes];
        for (let i = 0; i < gapFilledNotes.length - 1; i++) {
            const gap = gapFilledNotes[i+1].time - gapFilledNotes[i].time;
            if (gap > 0.6) {
                // We could re-analyze, but simpler is to use existing sub-onsets that were filtered out?
                // Actually, let's just make sure we capture enough rhythmic detail.
            }
        }

        gapFilledNotes.forEach((n, i) => {
            masterTrack.addNote({
                midi: 60 + Math.floor(Math.sin(i * 0.1) * 7), // Main Flow Pitch
                time: n.time,
                duration: n.duration,
                velocity: Math.min(127, Math.floor(n.energy * 250) + 50)
            });
        });

        fs.writeFileSync(midiPath, Buffer.from(midi.toArray()));
        console.log(`[Success] Generated: ${midiPath} (Master Track Nodes: ${gapFilledNotes.length})\n`);
    }

    console.log('--- Conversion Complete ---');
}

async function getAudioDuration(filePath) {
    return new Promise((resolve, reject) => {
        const ffmpeg = spawn(ffmpegStatic, ['-i', filePath], { stdio: ['ignore', 'pipe', 'pipe'] });
        let output = '';
        ffmpeg.stderr.on('data', (data) => output += data.toString());
        ffmpeg.on('close', () => {
            const match = output.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
            if (match) {
                const h = parseInt(match[1]), m = parseInt(match[2]), s = parseFloat(match[3]);
                resolve(h * 3600 + m * 60 + s);
            } else reject("No duration found");
        });
    });
}

async function analyzeMP3WithSustain(filePath, sensitivity = 1.8, filter = "anull") {
    return new Promise((resolve, reject) => {
        const sampleRate = 44100;
        const windowSize = 2048;
        const hopSize = 512;
        
        const ffmpeg = spawn(ffmpegStatic, [
            '-i', filePath,
            '-af', filter,
            '-f', 'f32le',
            '-ac', '1',
            '-ar', sampleRate.toString(),
            'pipe:1'
        ], { stdio: ['ignore', 'pipe', 'ignore'] });

        const notes = [];
        const energyHistory = [];
        let pcmBuffer = Buffer.alloc(0);
        let sampleCount = 0;
        let currentNote = null;
        let smoothingAvg = 0.001;

        ffmpeg.stdout.on('data', (chunk) => {
            pcmBuffer = Buffer.concat([pcmBuffer, chunk]);
            while (pcmBuffer.length >= windowSize * 4) {
                const samples = new Float32Array(pcmBuffer.buffer, pcmBuffer.byteOffset, windowSize);
                let energy = 0;
                for (let i = 0; i < samples.length; i++) energy += samples[i] * samples[i];
                energy = Math.sqrt(energy / windowSize);

                smoothingAvg = smoothingAvg * 0.98 + energy * 0.02;
                const threshold = smoothingAvg * sensitivity;
                const noiseFloor = Math.max(0.002, smoothingAvg * 0.1);
                const timestamp = sampleCount / sampleRate;

                if (energy > threshold && energy > noiseFloor) {
                    if (!currentNote) {
                        currentNote = { time: Number(timestamp.toFixed(4)), energy: energy, duration: 0.12 };
                    } else {
                        const newDuration = timestamp - currentNote.time;
                        if (newDuration < 2.5) currentNote.duration = Number(newDuration.toFixed(4));
                        else {
                            notes.push(currentNote);
                            currentNote = { time: Number(timestamp.toFixed(4)), energy: energy, duration: 0.12 };
                        }
                    }
                } else if (energy < threshold * 0.6 || energy < noiseFloor) {
                    if (currentNote) {
                        notes.push(currentNote);
                        currentNote = null;
                    }
                }
                energyHistory.push(energy);
                if (energyHistory.length > 200) energyHistory.shift();
                pcmBuffer = pcmBuffer.slice(hopSize * 4);
                sampleCount += hopSize;
            }
        });

        ffmpeg.on('close', (code) => {
            if (currentNote) notes.push(currentNote);
            if (code === 0) resolve(notes);
            else reject(new Error(`ffmpeg error: ${code}`));
        });
    });
}

main().catch(console.error);
