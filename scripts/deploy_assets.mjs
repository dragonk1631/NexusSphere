import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// Load env vars
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'nexussphere-assets';
const PUBLIC_DIR = path.resolve(__dirname, '../public');
const ASSETS_DIR = path.join(PUBLIC_DIR, 'assets');
const CACHE_FILE = path.resolve(__dirname, '../.deploy_state.json');

// S3 Client Configuration (Cloudflare R2 S3 API)
const s3 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_S3_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

console.log(`\n🚀 [Deployment Secretary] Starting High-Speed S3 Sync: ${BUCKET_NAME}`);

/**
 * 1. 로컬 데이터 정합성 체크 (Midi list & Manifest)
 */
function prepareLocal() {
    console.log('📦 Step 1: Synchronizing local metadata...');
    try {
        execSync('node scripts/sync_song_list.mjs', { stdio: 'inherit' });
        execSync('node scripts/analyze_audio_levels.mjs', { stdio: 'inherit' });
        execSync('node scripts/generate_assets_manifest.js', { stdio: 'inherit' });
        execSync('node scripts/generate_bundle.mjs', { stdio: 'inherit' });
    } catch (e) {
        console.error('❌ Failed to prepare local assets:', e.message);
        process.exit(1);
    }
}

/**
 * 2. 스마트 싱크 (해시 비교)
 */
function getFileHash(filePath) {
    const stats = fs.statSync(filePath);
    return crypto.createHash('md5').update(`${stats.size}-${stats.mtimeMs}`).digest('hex');
}

function loadCache() {
    if (fs.existsSync(CACHE_FILE)) {
        return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    }
    return {};
}

function saveCache(cache) {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

async function smartSync() {
    console.log('🔍 Step 2: Comparing local files with deployment state...');
    const cache = loadCache();
    const newCache = {};
    let uploadCount = 0;
    const uploadPromises = [];

    // Scan recursive
    function scan(dir) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            const stats = fs.statSync(fullPath);
            if (stats.isDirectory()) {
                scan(fullPath);
            } else {
                const relativePath = path.relative(PUBLIC_DIR, fullPath).replace(/\\/g, '/');
                const hash = getFileHash(fullPath);
                newCache[relativePath] = hash;

                if (cache[relativePath] !== hash) {
                    uploadPromises.push(uploadFileToR2(fullPath, relativePath));
                    uploadCount++;
                }
            }
        }
    }

    // Always upload critical files
    const criticalFiles = ['assets_manifest.json', 'assets_bundle.zip', 'assets/data/official_songs.json', 'assets/data/midi_list.json'];
    
    scan(ASSETS_DIR);

    for (const f of criticalFiles) {
        const fullPath = path.join(PUBLIC_DIR, f);
        if (fs.existsSync(fullPath)) {
            // Force upload critical files to ensure metadata is always fresh
            uploadPromises.push(uploadFileToR2(fullPath, f));
        }
    }

    if (uploadPromises.length > 0) {
        console.log(`📤 Uploading ${uploadPromises.length} files (including bundle and manifest)...`);
        await Promise.all(uploadPromises);
    } else {
        console.log('✨ Everything is already up to date!');
    }

    saveCache(newCache);
    console.log(`\n✅ Deployment Sync Complete!`);
}

async function uploadFileToR2(filePath, r2Key) {
    const fileContent = fs.readFileSync(filePath);
    const contentType = getContentType(filePath);

    try {
        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: r2Key,
            Body: fileContent,
            ContentType: contentType,
            CacheControl: 'max-age=31536000' // 1 year caching for generic assets
        });

        await s3.send(command);
        console.log(`  ✔ Uploaded: ${r2Key} (${contentType})`);
    } catch (e) {
        console.error(`  ❌ Failed to upload ${r2Key}:`, e.message);
    }
}

function getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const map = {
        '.json': 'application/json',
        '.mid': 'audio/midi',
        '.midi': 'audio/midi',
        '.mp3': 'audio/mpeg',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.zip': 'application/zip',
        '.sf2': 'application/octet-stream'
    };
    return map[ext] || 'application/octet-stream';
}

// EXECUTION
prepareLocal();
smartSync().catch(console.error);
