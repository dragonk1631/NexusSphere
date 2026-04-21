import fs from 'fs';
import path from 'path';

/**
 * cleanup_large_assets.mjs
 * 
 * Cloudflare Pages의 파일당 25MB 제한을 넘는 파일을 dist 폴더에서 삭제합니다.
 * 이 파일들은 이미 R2에 업로드되어 있으므로, 프론트엔드에서는 R2에서 가져오게 됩니다.
 */

const DIST_DIR = path.resolve('dist');
const MAX_SIZE_BYTES = 24 * 1024 * 1024; // 24MB (안전 마진 고려)

function findAndDeleteLargeFiles(dir) {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            findAndDeleteLargeFiles(fullPath);
        } else if (stat.size > MAX_SIZE_BYTES) {
            console.log(`[Cleanup] Removing large asset: ${file} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
            fs.unlinkSync(fullPath);
        }
    });
}

console.log('[Cleanup] Scanning dist for files exceeding 25MB limit...');
findAndDeleteLargeFiles(DIST_DIR);
console.log('[Cleanup] Done.');
