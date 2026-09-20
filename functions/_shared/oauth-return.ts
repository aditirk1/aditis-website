/**
 * Safe same-origin return path after OAuth (comments, dream journal, etc.).
 */
export function sanitizeReturnPath(raw: string | null, fallback = '/dream-journal'): string {
	if (!raw) return fallback;
	let path = raw.trim();
	try {
		if (path.startsWith('http://') || path.startsWith('https://')) {
			const u = new URL(path);
			path = `${u.pathname}${u.search}${u.hash}`;
		}
	} catch {
		return fallback;
	}
	if (!path.startsWith('/') || path.startsWith('//')) return fallback;
	return path.slice(0, 512) || fallback;
}
