import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.resolve(__dirname, '../public');
const ASSETS_DIR = path.resolve(PUBLIC_DIR, 'assets');
const OUTPUT_FILE = path.resolve(PUBLIC_DIR, 'assets_manifest.json');

/**
 * Recursively get all files in a directory
 */
function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);

  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function(file) {
    if (fs.statSync(path.join(dirPath, file)).isDirectory()) {
      arrayOfFiles = getAllFiles(path.join(dirPath, file), arrayOfFiles);
    } else {
      // Store relative path from PUBLIC_DIR
      const fullPath = path.join(dirPath, file);
      const relativePath = path.relative(PUBLIC_DIR, fullPath).replace(/\\/g, '/');
      arrayOfFiles.push(relativePath);
    }
  });

  return arrayOfFiles;
}

try {
  console.log('[Manifest] Scanning assets in:', ASSETS_DIR);
  const files = getAllFiles(ASSETS_DIR);
  
  // Also include files directly in public/ (optional, let's keep it to assets/ for now)
  // const rootFiles = fs.readdirSync(PUBLIC_DIR).filter(f => !fs.statSync(path.join(PUBLIC_DIR, f)).isDirectory());
  // rootFiles.forEach(f => files.push(f));

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(files, null, 2));
  console.log(`[Manifest] Successfully generated ${OUTPUT_FILE} with ${files.length} entries.`);
} catch (e) {
  console.error('[Manifest] Failed to generate manifest:', e);
  process.exit(1);
}
