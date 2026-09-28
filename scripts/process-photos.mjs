/**
 * Strip EXIF/XMP/IPTC (GPS, camera serials) and downsize oversized photos in
 * public/photos and public/uploads, in place. ICC colour profiles are kept.
 *
 * Runs in the build so deployed files are always clean, but the build can't
 * rewrite git history — run `npm run photos:process` before committing photos
 * you dropped into the repo by hand. (CMS uploads are already cleaned in the
 * browser; see media_libraries in public/admin/config.yml.)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = ['public/photos', 'public/uploads'];
const MAX = 2400;
/* GIFs are skipped so animations survive. */
const RE = /\.(jpe?g|png|webp|avif)$/i;

async function* walk(dir) {
	let entries;
	try {
		entries = await fs.readdir(dir, { withFileTypes: true });
	} catch {
		return;
	}
	for (const ent of entries) {
		if (ent.name.startsWith('.')) continue;
		const p = path.join(dir, ent.name);
		if (ent.isDirectory()) yield* walk(p);
		else if (ent.isFile() && RE.test(ent.name)) yield p;
	}
}

let processed = 0;
let skipped = 0;

for (const rel of DIRS) {
	for await (const file of walk(path.join(root, rel))) {
		const meta = await sharp(file).metadata();
		const hasMetadata = Boolean(meta.exif || meta.xmp || meta.iptc) || (meta.orientation ?? 1) > 1;
		const tooBig = (meta.width ?? 0) > MAX || (meta.height ?? 0) > MAX;
		if (!hasMetadata && !tooBig) {
			skipped++;
			continue;
		}

		const ext = path.extname(file).toLowerCase();
		let pipeline = sharp(file)
			.rotate()
			.resize({ width: MAX, height: MAX, fit: 'inside', withoutEnlargement: true })
			.keepIccProfile();
		if (ext === '.png') pipeline = pipeline.png({ compressionLevel: 9 });
		else if (ext === '.webp') pipeline = pipeline.webp({ quality: 85 });
		else if (ext === '.avif') pipeline = pipeline.avif({ quality: 60 });
		else pipeline = pipeline.jpeg({ quality: 85, mozjpeg: true });

		const tmp = `${file}.tmp`;
		await pipeline.toFile(tmp);
		await fs.rename(tmp, file);
		processed++;
		console.log(`photos: cleaned ${path.relative(root, file)}${tooBig ? ' (resized)' : ''}`);
	}
}

console.log(`photos: ${processed} cleaned, ${skipped} already clean`);
