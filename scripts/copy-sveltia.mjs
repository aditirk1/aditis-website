import { copyFileSync, mkdirSync, unlinkSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules/@sveltia/cms/dist/sveltia-cms.js');
const destDir = join(root, 'public/admin');
const dest = join(destDir, 'sveltia-cms.js');
const legacyDecap = join(destDir, 'decap-cms.js');

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
if (existsSync(legacyDecap)) unlinkSync(legacyDecap);
console.log(`Copied Sveltia CMS → ${dest}`);
