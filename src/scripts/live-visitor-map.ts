import { initVisitorGlobe, type GlobeMarker } from './visitor-globe';
import { initVisitorHorizon } from './visitor-horizon';
import { markVisitRecorded, shouldRecordVisit } from '../utils/visit-recording';

function apiUrl(base: string, path: string): string {
	const b = base.replace(/\/$/, '');
	return b ? `${b}${path}` : path;
}

function currentTheme(): 'universe' | 'beach' {
	return document.documentElement.getAttribute('data-theme') === 'beach' ? 'beach' : 'universe';
}

type Panel = {
	setMarkers: (markers: GlobeMarker[]) => void;
	destroy: () => void;
};

/**
 * Globe.gl is a full WebGL context. Creating it while the homepage orrery is
 * starting (especially on beach→universe) starves Safari for seconds. Only
 * mount when the widget is near the viewport, and never in the same turn as a
 * theme swap onto Universe.
 */
export function bootLiveVisitorMap(root: HTMLElement): () => void {
	const apiBase = (root.dataset.apiBase ?? '').trim();
	const globeEl = root.querySelector<HTMLElement>('[data-visitor-globe]');
	const horizonEl = root.querySelector<HTMLElement>('[data-visitor-horizon]');
	const totalTextEl = root.querySelector<HTMLElement>('[data-visitor-total]');
	const noteEl = root.querySelector<HTMLElement>('[data-visitor-note]');

	if (!totalTextEl || (!globeEl && !horizonEl)) {
		return () => {};
	}

	const totalEl = totalTextEl;
	let markers: GlobeMarker[] = [];
	let globe: Panel | null = null;
	let horizon: Panel | null = null;
	let theme = currentTheme();
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
		if (theme !== 'universe' || !globeEl || globe || !globeNear) return;
		globe = initVisitorGlobe(globeEl);
		globe.setMarkers(markers);
	}

	function scheduleGlobeMount() {
		window.clearTimeout(globeMountTimer);
		/* Give the orrery a couple frames to claim the GPU after a theme swap. */
		globeMountTimer = window.setTimeout(() => {
			mountGlobeIfReady();
		}, 120);
	}

	function ensurePanels() {
		theme = currentTheme();
		if (theme === 'beach') {
			destroyGlobe();
			if (horizonEl && !horizon) {
				horizon = initVisitorHorizon(horizonEl);
				horizon.setMarkers(markers);
			}
			return;
		}
		/* Universe: horizon can stay (hidden via CSS); defer WebGL globe. */
		scheduleGlobeMount();
	}

	function applyMarkers(next: GlobeMarker[]) {
		markers = next;
		ensurePanels();
		globe?.setMarkers(markers);
		horizon?.setMarkers(markers);
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
	if (globeEl && typeof IntersectionObserver !== 'undefined') {
		io = new IntersectionObserver(
			(entries) => {
				globeNear = entries.some((e) => e.isIntersecting);
				if (globeNear) scheduleGlobeMount();
				else destroyGlobe();
			},
			{ root: null, rootMargin: '120px 0px', threshold: 0.01 },
		);
		io.observe(globeEl);
	} else {
		globeNear = true;
	}

	ensurePanels();
	void load();

	const mo = new MutationObserver(() => {
		if (currentTheme() === theme) return;
		ensurePanels();
		globe?.setMarkers(markers);
		horizon?.setMarkers(markers);
	});
	mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

	return () => {
		mo.disconnect();
		io?.disconnect();
		window.clearTimeout(globeMountTimer);
		globe?.destroy();
		horizon?.destroy();
	};
}
