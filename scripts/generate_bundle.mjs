import fs from 'fs';
import path from 'path';
import { zipSync } from 'fflate';

/**
 * generate_bundle.mjs
 * 
 * 모든 애셋(public/assets)을 하나의 assets_bundle.zip으로 압축합니다.
 * 이를 통해 클라이언트가 수백 개의 파일을 개별적으로 요청하는 대신
 * 단 한 번의 요청으로 모든 필수 자산을 동기화할 수 있도록 합니다.
 */

const ASSETS_DIR = path.resolve('public/assets');
const OUTPUT_FILE = path.resolve('public/assets_bundle.zip');

function getFilesRecursive(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.resolve(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getFilesRecursive(fullPath));
        } else {
            results.push(fullPath);
        }
    });
    return results;
}

function generateBundle() {
    console.log('[Bundle] Starting asset compression...');
    
    if (!fs.existsSync(ASSETS_DIR)) {
        console.error(`[Bundle] Source directory not found: ${ASSETS_DIR}`);
        process.exit(1);
    }

    const files = getFilesRecursive(ASSETS_DIR);
    const zipData = {};

    let sf2Count = 0;
    files.forEach(filePath => {
        // public/assets 폴더 안의 상대 경로를 계산 (예: audio/ui/click.mp3)
        let relativePath = path.relative(ASSETS_DIR, filePath).replace(/\\/g, '/');
        // 앞부분에 혹시 모를 슬래시 제거
        relativePath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
        
        if (relativePath.toLowerCase().endsWith('.sf2')) {
            sf2Count++;
        }

        const fileContent = fs.readFileSync(filePath);
        
        // zipData에 Uint8Array 형태로 저장 (앱 내 호출 경로와 동일하게 assets/ 로 시작)
        zipData[`assets/${relativePath}`] = new Uint8Array(fileContent);
    });

    try {
        // Zip 생성 (최대 압축 수준)
        const zipped = zipSync(zipData, { level: 9 });
        fs.writeFileSync(OUTPUT_FILE, zipped);
        
        const sizeMB = (zipped.length / 1024 / 1024).toFixed(2);
        console.log(`[Bundle] ✓ Successfully created ${OUTPUT_FILE}`);
        console.log(`[Bundle] Total Size: ${sizeMB} MB (${files.length} files bundled, ${sf2Count} SoundFonts)`);

        if (sf2Count === 0) {
            console.warn('\n' + '!'.repeat(60));
            console.warn('⚠️  WARNING: NO SOUNDFONT (.sf2) FILES WERE FOUND!');
            console.warn('Your offline rhythm engine will have NO SOUND without an SoundFont.');
            console.warn('Ensure your SF2 files are in: public/assets/audio/soundfonts/');
            console.warn('!'.repeat(60) + '\n');
        }
    } catch (error) {
        console.error('[Bundle] Failed to generate zip bundle:', error);
        process.exit(1);
    }
}

generateBundle();
