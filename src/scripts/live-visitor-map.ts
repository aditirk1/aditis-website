import { initVisitorGlobe, type GlobeMarker } from './visitor-globe';

function apiUrl(base: string, path: string): string {
	const b = base.replace(/\/$/, '');
	return b ? `${b}${path}` : path;
}

export function bootLiveVisitorMap(root: HTMLElement): () => void {
	const apiBase = (root.dataset.apiBase ?? '').trim();
	const globeEl = root.querySelector<HTMLElement>('[data-visitor-globe]');
	const totalTextEl = root.querySelector<HTMLElement>('[data-visitor-total]');
	const noteEl = root.querySelector<HTMLElement>('[data-visitor-note]');

	if (!globeEl || !totalTextEl) {
		return () => {};
	}

	// Bound after the guard so the hoisted helpers below see a non-null type.
	const totalEl = totalTextEl;

	const globeApi = initVisitorGlobe(globeEl);

	function setTotal(n: number | null, note: string) {
		totalEl.textContent = n === null ? '—' : String(n);
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
			setTotal(d.total, d.total > 0 ? '' : 'Counting from today.');
			globeApi.setMarkers(d.markers);
		} catch {
			setTotal(null, 'Live count is offline right now.');
			globeApi.setMarkers([]);
		}
	}

	void load();

	return () => globeApi.destroy();
}
