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

	function setTotal(n: number | null, note: string) {
		totalEl.textContent = n === null ? '—' : String(n);
		if (noteEl) noteEl.textContent = note;
	}

	function ensurePanels() {
		theme = currentTheme();
		if (theme === 'universe' && globeEl && !globe) {
			globe = initVisitorGlobe(globeEl);
			globe.setMarkers(markers);
		}
		if (theme === 'beach' && horizonEl && !horizon) {
			horizon = initVisitorHorizon(horizonEl);
			horizon.setMarkers(markers);
		}
		/* Tear down the hidden WebGL globe so it doesn't keep spinning off-screen. */
		if (theme === 'beach' && globe) {
			globe.destroy();
			globe = null;
		}
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
		globe?.destroy();
		horizon?.destroy();
	};
}
