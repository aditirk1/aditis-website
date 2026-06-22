import { initVisitorGlobe, type GlobeMarker } from './visitor-globe';

const DEMO_MARKERS: GlobeMarker[] = [
	{ lat: 40.7, lng: -74, count: 2 },
	{ lat: 51.5, lng: -0.1, count: 1 },
	{ lat: 35.6, lng: 139.7, count: 1 },
	{ lat: -33.8, lng: 151.2, count: 1 },
];

function apiUrl(base: string, path: string): string {
	const b = base.replace(/\/$/, '');
	return b ? `${b}${path}` : path;
}

export function bootLiveVisitorMap(root: HTMLElement): () => void {
	const apiBase = (root.dataset.apiBase ?? '').trim();
	const globeEl = root.querySelector<HTMLElement>('[data-visitor-globe]');
	const totalEl = root.querySelector<HTMLElement>('[data-visitor-total]');
	const noteEl = root.querySelector<HTMLElement>('[data-visitor-note]');

	if (!globeEl || !totalEl) {
		return () => {};
	}

	const globeApi = initVisitorGlobe(globeEl);

	function setTotal(n: number, note: string) {
		totalEl.textContent = n >= 0 ? String(n) : '—';
		if (noteEl) noteEl.textContent = note;
	}

	async function recordVisit() {
		try {
			await fetch(apiUrl(apiBase, '/api/visit'), {
				method: 'POST',
				credentials: 'same-origin',
			});
		} catch {
			// Fire-and-forget; stats fetch handles UI fallback.
		}
	}

	async function load() {
		await recordVisit();
		try {
			const r = await fetch(apiUrl(apiBase, '/api/stats'), { credentials: 'same-origin' });
			if (!r.ok) throw new Error(String(r.status));
			const d = (await r.json()) as { total: number; markers: GlobeMarker[] };
			setTotal(d.total, '');
			globeApi.setMarkers(d.markers.length ? d.markers : DEMO_MARKERS);
		} catch {
			setTotal(
				0,
				'Demo data: after deploy, totals and markers come from your site (GET /api/stats, country-level from Cloudflare). Astro dev does not run Pages Functions.',
			);
			globeApi.setMarkers(DEMO_MARKERS);
		}
	}

	void load();

	return () => globeApi.destroy();
}
