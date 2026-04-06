import { initVisitorGlobe, type GlobeMarker } from './visitor-globe';

const DEMO_MARKERS: GlobeMarker[] = [
	{ lat: 37.09, lng: -95.71, count: 12, country: 'US' },
	{ lat: 51.17, lng: 10.45, count: 8, country: 'DE' },
	{ lat: 20.59, lng: 78.96, count: 9, country: 'IN' },
	{ lat: 55.38, lng: -3.44, count: 5, country: 'GB' },
];

function apiUrl(base: string, path: string): string {
	const b = base.replace(/\/$/, '');
	return b ? `${b}${path}` : path;
}

async function postVisit(base: string): Promise<void> {
	try {
		await fetch(apiUrl(base, '/api/visit'), {
			method: 'POST',
			credentials: 'same-origin',
			headers: { Accept: 'application/json' },
		});
	} catch {
		/* offline / local dev */
	}
}

async function getStats(base: string): Promise<{ total: number; markers: GlobeMarker[] } | null> {
	try {
		const r = await fetch(apiUrl(base, '/api/stats'), {
			credentials: 'same-origin',
			headers: { Accept: 'application/json' },
		});
		if (!r.ok) return null;
		const data = (await r.json()) as { total?: number; markers?: GlobeMarker[] };
		if (typeof data.total !== 'number' || !Array.isArray(data.markers)) return null;
		return { total: data.total, markers: data.markers };
	} catch {
		return null;
	}
}

export function bootLiveVisitorMap(root: HTMLElement): () => void {
	const base = (root.dataset.apiBase ?? '').trim();
	const globeEl = root.querySelector<HTMLElement>('[data-visitor-globe]');
	const totalEl = root.querySelector<HTMLElement>('[data-visitor-total]');
	const noteEl = root.querySelector<HTMLElement>('[data-visitor-note]');

	if (!globeEl || !totalEl) {
		return () => {};
	}

	const globeApi = initVisitorGlobe(globeEl);

	function setTotal(n: number, label?: string) {
		totalEl.textContent = String(n);
		if (noteEl) {
			noteEl.textContent =
				label ??
				'Country-level pins only. Counts update on each edge-recorded page load.';
		}
	}

	void (async () => {
		await postVisit(base);
		const stats = await getStats(base);
		if (stats) {
			setTotal(stats.total);
			globeApi.setMarkers(stats.markers);
		} else {
			setTotal(0, 'Demo globe — deploy to Cloudflare Pages with KV to record visits.');
			globeApi.setMarkers(DEMO_MARKERS);
		}
	})();

	return () => globeApi.destroy();
}
