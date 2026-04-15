import fs from 'fs';
import { unzipSync } from 'fflate';

const bundlePath = 'public/assets_bundle.zip';

if (!fs.existsSync(bundlePath)) {
    console.log('Bundle not found at ' + bundlePath);
} else {
    const data = fs.readFileSync(bundlePath);
    const unzipped = unzipSync(data);
    const files = Object.keys(unzipped);
    console.log(`Total files in zip: ${files.length}`);
    files.forEach(f => {
        if (f.toLowerCase().includes('sf2')) {
            console.log(`Found SF2: "${f}"`);
        }
    });
}
