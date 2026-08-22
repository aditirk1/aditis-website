import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules/decap-cms/dist/decap-cms.js');
const destDir = join(root, 'public/admin');
const dest = join(destDir, 'decap-cms.js');

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log(`Copied Decap CMS → ${dest}`);
