import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const IMAGE_RE = /\.(png|jpe?g|webp|gif|avif)$/i;

export type PhotoItem = {
	src: string;
	name: string;
	/** Intrinsic size after EXIF orientation; lets the browser reserve space (no layout shift). */
	width?: number;
	height?: number;
	caption?: string;
	alt: string;
};

export type PhotoAlbum = {
	/** URL-safe id (`misc` for files in the photos root) */
	id: string;
	/** Human label for the section heading */
	label: string;
	photos: PhotoItem[];
};

/** A photo added through the CMS (`src/content/photos/*.yml`). */
export type CmsPhoto = {
	image: string;
	album: string;
	caption?: string;
	alt?: string;
	date?: Date;
};

function formatFolderLabel(folderName: string): string {
	return folderName
		.replace(/[-_]+/g, ' ')
		.replace(/\b\w/g, (c) => c.toUpperCase());
}

function slugify(label: string): string {
	return (
		label
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'misc'
	);
}

async function imageSize(filePath: string): Promise<{ width?: number; height?: number }> {
	try {
		const meta = await sharp(filePath).metadata();
		if (!meta.width || !meta.height) return {};
		const rotated = (meta.orientation ?? 1) >= 5;
		return rotated ? { width: meta.height, height: meta.width } : { width: meta.width, height: meta.height };
	} catch {
		return {};
	}
}

type RawEntry = { src: string; name: string; file: string; caption?: string; alt?: string };

function listImagesInDir(dirPath: string, urlPrefix: string): RawEntry[] {
	const items: RawEntry[] = [];
	for (const ent of fs.readdirSync(dirPath, { withFileTypes: true })) {
		if (ent.isFile() && IMAGE_RE.test(ent.name)) {
			items.push({
				src: `/${urlPrefix}/${ent.name}`.replace(/\/+/g, '/'),
				name: ent.name,
				file: path.join(dirPath, ent.name),
			});
		}
	}
	return items.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

/**
 * Albums from `public/photos/` merged with CMS photo entries.
 * - Files directly in `photos/` → album "Misc"
 * - Each subfolder → its own album
 * - CMS entries join the album whose label matches (case-insensitive), or start a new one
 */
export async function loadPhotoAlbums(photosRoot: string, cmsPhotos: CmsPhoto[] = []): Promise<PhotoAlbum[]> {
	const publicRoot = path.dirname(photosRoot);
	const byId = new Map<string, { label: string; entries: RawEntry[] }>();

	function albumFor(label: string) {
		const id = slugify(label);
		let album = byId.get(id);
		if (!album) {
			album = { label, entries: [] };
			byId.set(id, album);
		}
		return album;
	}

	if (fs.existsSync(photosRoot)) {
		const rootPhotos = listImagesInDir(photosRoot, 'photos');
		if (rootPhotos.length > 0) albumFor('Misc').entries.push(...rootPhotos);

		const subdirs = fs
			.readdirSync(photosRoot, { withFileTypes: true })
			.filter((d) => d.isDirectory() && !d.name.startsWith('.'))
			.sort((a, b) => a.name.localeCompare(b.name));
		for (const dir of subdirs) {
			const photos = listImagesInDir(path.join(photosRoot, dir.name), `photos/${dir.name}`);
			if (photos.length > 0) albumFor(formatFolderLabel(dir.name)).entries.push(...photos);
		}
	}

	const sortedCms = [...cmsPhotos].sort((a, b) => (b.date?.valueOf() ?? 0) - (a.date?.valueOf() ?? 0));
	for (const p of sortedCms) {
		if (!p.image) continue;
		const src = p.image.startsWith('/') ? p.image : `/${p.image}`;
		albumFor(p.album?.trim() || 'Misc').entries.push({
			src,
			name: path.basename(src),
			file: path.join(publicRoot, src),
			caption: p.caption?.trim() || undefined,
			alt: p.alt?.trim() || undefined,
		});
	}

	const albums: PhotoAlbum[] = [];
	for (const [id, { label, entries }] of byId) {
		if (entries.length === 0) continue;
		const photos = await Promise.all(
			entries.map(async ({ file, alt, ...entry }, i) => ({
				...entry,
				...(await imageSize(file)),
				alt: alt ?? entry.caption ?? `${label} — photo ${i + 1}`,
			})),
		);
		albums.push({ id, label, photos });
	}

	/* "Misc" stays first, like before; named albums follow alphabetically. */
	return albums.sort((a, b) => (a.id === 'misc' ? -1 : b.id === 'misc' ? 1 : a.label.localeCompare(b.label)));
}

/** Lightbox items for an album (caption + alt travel with each photo when browsing). */
export function albumLightboxItems(album: PhotoAlbum): Array<{ src: string; caption?: string; alt: string }> {
	return album.photos.map(({ src, caption, alt }) => ({ src, caption, alt }));
}
