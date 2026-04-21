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

function cleanupDist(dir) {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            // [STRATEGY] R2에 이미 있는 대용량 카테고리는 dist에서 아예 삭제하여 25MB 제한 및 용량 낭비 방지
            // 단, 초기 UI에 필요한 images/ui, logos, favicons 등은 제외함
            const isLargeCategory = file === 'audio' || file === 'background-themes' || file === 'videos';
            if (isLargeCategory) {
                console.log(`[Cleanup] Removing large asset directory from dist: ${file}`);
                fs.rmSync(fullPath, { recursive: true, force: true });
            } else {
                cleanupDist(fullPath);
            }
        } else if (stat.size > MAX_SIZE_BYTES) {
            console.log(`[Cleanup] Removing large file: ${file} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
            fs.unlinkSync(fullPath);
        }
    });
}

console.log('[Cleanup] Aggressively cleaning dist for Cloudflare Pages compatibility...');
cleanupDist(DIST_DIR);
console.log('[Cleanup] Done.');
