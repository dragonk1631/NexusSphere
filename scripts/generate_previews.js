import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ffmpegPath from 'ffmpeg-static';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.resolve(__dirname, '../public');
const MP3_DIR = path.resolve(PUBLIC_DIR, 'assets/audio/mp3');
const PREVIEW_DIR = path.resolve(MP3_DIR, 'previews');

/**
 * Generate a 10-second preview for an MP3 file
 */
function generatePreview(inputFile) {
    const filename = path.basename(inputFile);
    const outputFile = path.join(PREVIEW_DIR, filename);

    // Skip if already exists
    if (fs.existsSync(outputFile)) {
        // console.log(`[Preview] Skipping ${filename} (Already exists)`);
        return;
    }

    console.log(`[Preview] Generating snippet for ${filename}...`);
    try {
        // Settings: 
        // -ss 0: Start from 0s
        // -t 10: 10 seconds duration
        // -ac 1: Mono
        // -b:a 64k: Radio quality
        // -map_metadata -1: Strip metadata to reduce size further
        execSync(`"${ffmpegPath}" -y -i "${inputFile}" -ss 0 -t 10 -ac 1 -b:a 64k -map_metadata -1 "${outputFile}"`, { stdio: 'ignore' });
        
        const originalSize = (fs.statSync(inputFile).size / 1024 / 1024).toFixed(2);
        const previewSize = (fs.statSync(outputFile).size / 1024).toFixed(0);
        console.log(`[Preview] Done. Reduced ${originalSize}MB Down to ${previewSize}KB`);
    } catch (e) {
        console.error(`[Preview] Failed to generate preview for ${filename}:`, e.message);
    }
}

async function run() {
    if (!fs.existsSync(MP3_DIR)) {
        console.error('[Preview] MP3 directory not found:', MP3_DIR);
        return;
    }

    if (!fs.existsSync(PREVIEW_DIR)) {
        fs.mkdirSync(PREVIEW_DIR, { recursive: true });
    }

    const files = fs.readdirSync(MP3_DIR).filter(f => f.toLowerCase().endsWith('.mp3'));
    
    console.log(`[Preview] Found ${files.length} MP3 files.`);
    
    for (const file of files) {
        generatePreview(path.join(MP3_DIR, file));
    }
    
    console.log('[Preview] Generation complete.');
}

run();
