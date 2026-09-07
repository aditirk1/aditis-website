import { initVisitorGlobe, type GlobeMarker } from './visitor-globe';
import { markVisitRecorded, shouldRecordVisit } from '../utils/visit-recording';

function apiUrl(base: string, path: string): string {
	const b = base.replace(/\/$/, '');
	return b ? `${b}${path}` : path;
}

/**
 * One marble globe for both themes. Mount only when near the viewport so it
 * never fights the homepage orrery for WebGL on first paint / theme swap.
 */
export function bootLiveVisitorMap(root: HTMLElement): () => void {
	const apiBase = (root.dataset.apiBase ?? '').trim();
	const globeEl = root.querySelector<HTMLElement>('[data-visitor-globe]');
	const totalTextEl = root.querySelector<HTMLElement>('[data-visitor-total]');
	const noteEl = root.querySelector<HTMLElement>('[data-visitor-note]');

	if (!totalTextEl || !globeEl) {
		return () => {};
	}

	const totalEl = totalTextEl;
	let markers: GlobeMarker[] = [];
	let globe: ReturnType<typeof initVisitorGlobe> | null = null;
	let globeNear = false;
	let globeMountTimer = 0;

	function setTotal(n: number | null, note: string) {
		totalEl.textContent = n === null ? '—' : String(n);
		if (noteEl) noteEl.textContent = note;
	}

	function destroyGlobe() {
		window.clearTimeout(globeMountTimer);
		if (!globe) return;
		globe.destroy();
		globe = null;
	}

	function mountGlobeIfReady() {
		if (!globeEl || globe || !globeNear) return;
		globe = initVisitorGlobe(globeEl);
		globe.setMarkers(markers);
	}

	function scheduleGlobeMount() {
		window.clearTimeout(globeMountTimer);
		/* Stay clear of beach→universe orrery GPU claim. */
		globeMountTimer = window.setTimeout(() => {
			mountGlobeIfReady();
		}, 200);
	}

	function applyMarkers(next: GlobeMarker[]) {
		markers = next;
		if (globeNear) scheduleGlobeMount();
		globe?.setMarkers(markers);
	}

	async function recordVisit() {
		if (!shouldRecordVisit()) return;
		try {
			const r = await fetch(apiUrl(apiBase, '/api/visit'), {
				method: 'POST',
				credentials: 'same-origin',
			});
			if (r.ok) markVisitRecorded();
		} catch {
			/* Fire-and-forget. */
		}
	}

	async function load() {
		await recordVisit();
		try {
			const r = await fetch(apiUrl(apiBase, '/api/stats'), { credentials: 'same-origin' });
			if (!r.ok) throw new Error(String(r.status));
			const d = (await r.json()) as { total: number; markers: GlobeMarker[] };
			setTotal(d.total, d.total > 0 ? '' : 'Counting from today.');
			applyMarkers(d.markers);
		} catch {
			setTotal(null, 'Live count is offline right now.');
			applyMarkers([]);
		}
	}

	let io: IntersectionObserver | null = null;
	if (typeof IntersectionObserver !== 'undefined') {
		io = new IntersectionObserver(
			(entries) => {
				globeNear = entries.some((e) => e.isIntersecting);
				if (globeNear) scheduleGlobeMount();
				else destroyGlobe();
			},
			{ root: null, rootMargin: '160px 0px', threshold: 0.01 },
		);
		io.observe(globeEl);
	} else {
		globeNear = true;
		scheduleGlobeMount();
	}

	void load();

	return () => {
		io?.disconnect();
		window.clearTimeout(globeMountTimer);
		globe?.destroy();
	};
}
