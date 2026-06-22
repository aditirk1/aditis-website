import Globe from 'globe.gl';

export type GlobeMarker = { lat: number; lng: number; count?: number };

/** NASA Blue Marble–style texture (three-globe example asset). */
const EARTH_BLUE_MARBLE =
	'https://unpkg.com/three-globe@2.45.0/example/img/earth-blue-marble.jpg';

/** Read theme accent from CSS (`--color-amber` is gold on Universe, blue on Beach). */
function accentColor(): string {
	const v = getComputedStyle(document.documentElement).getPropertyValue('--color-amber').trim();
	return v || '#ffaa00';
}

export function initVisitorGlobe(container: HTMLElement): {
	setMarkers: (markers: GlobeMarker[]) => void;
	destroy: () => void;
} {
	const globe = Globe()(container)
		.globeImageUrl(EARTH_BLUE_MARBLE)
		.backgroundColor('rgba(0,0,0,0)')
		.showAtmosphere(true)
		.atmosphereColor('#4a6fa8')
		.atmosphereAltitude(0.15);

	const ctrls = globe.controls();
	ctrls.autoRotate = true;
	ctrls.autoRotateSpeed = 0.35;
	ctrls.enableZoom = false;

	const resize = () => {
		const w = container.clientWidth || 200;
		const h = container.clientHeight || 200;
		globe.width(w).height(h);
	};
	resize();
	const ro = new ResizeObserver(resize);
	ro.observe(container);

	const api = {
		setMarkers(markers: GlobeMarker[]) {
			globe.pointsData(
				markers.map((m) => ({
					lat: m.lat,
					lng: m.lng,
					size: 0.35 + Math.min(1.2, (m.count ?? 1) * 0.08),
					color: accentColor(),
				})),
			);
		},
		destroy() {
			ro.disconnect();
			globe._destructor();
		},
	};

	return api;
}
