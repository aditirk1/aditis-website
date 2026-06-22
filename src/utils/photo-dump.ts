import fs from 'node:fs';
import path from 'node:path';

const IMAGE_RE = /\.(png|jpe?g|webp|gif|avif)$/i;

export type PhotoItem = {
	src: string;
	name: string;
};

export type PhotoAlbum = {
	/** URL-safe folder id (`misc` for files in the photos root) */
	id: string;
	/** Human label for the section heading */
	label: string;
	photos: PhotoItem[];
};

function formatFolderLabel(folderName: string): string {
	return folderName
		.replace(/[-_]+/g, ' ')
		.replace(/\b\w/g, (c) => c.toUpperCase());
}

function listImagesInDir(dirPath: string, urlPrefix: string): PhotoItem[] {
	const items: PhotoItem[] = [];
	for (const ent of fs.readdirSync(dirPath, { withFileTypes: true })) {
		if (ent.isFile() && IMAGE_RE.test(ent.name)) {
			items.push({
				src: `/${urlPrefix}/${ent.name}`.replace(/\/+/g, '/'),
				name: ent.name,
			});
		}
	}
	return items.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

/**
 * Load photo albums from `public/photos/`.
 * - Files directly in `photos/` → album "Misc"
 * - Each subfolder → its own album (supports one level; nested files inside subfolders included)
 */
export function loadPhotoAlbums(photosRoot: string): PhotoAlbum[] {
	const albums: PhotoAlbum[] = [];

	if (!fs.existsSync(photosRoot)) return albums;

	const rootPhotos = listImagesInDir(photosRoot, 'photos');
	if (rootPhotos.length > 0) {
		albums.push({ id: 'misc', label: 'Misc', photos: rootPhotos });
	}

	const subdirs = fs
		.readdirSync(photosRoot, { withFileTypes: true })
		.filter((d) => d.isDirectory() && !d.name.startsWith('.'));

	for (const dir of subdirs.sort((a, b) => a.name.localeCompare(b.name))) {
		const subPath = path.join(photosRoot, dir.name);
		const photos = listImagesInDir(subPath, `photos/${dir.name}`);
		if (photos.length > 0) {
			albums.push({
				id: dir.name,
				label: formatFolderLabel(dir.name),
				photos,
			});
		}
	}

	return albums;
}

/** Flat list of every photo src (for lightbox navigation across an album). */
export function albumPhotoSources(album: PhotoAlbum): string[] {
	return album.photos.map((p) => p.src);
}
