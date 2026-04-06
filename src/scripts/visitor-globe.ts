import Globe from 'globe.gl';

export type GlobeMarker = { lat: number; lng: number; count: number; country: string };

const EARTH_NIGHT =
	'https://cdn.jsdelivr.net/npm/three-globe@2/example/img/earth-night.jpg';

export function initVisitorGlobe(container: HTMLElement): {
	setMarkers: (markers: GlobeMarker[]) => void;
	destroy: () => void;
} {
	const globe = new Globe(container)
		.globeImageUrl(EARTH_NIGHT)
		.backgroundColor('rgba(0,0,0,0)')
		.showGlobe(true)
		.showAtmosphere(true)
		.atmosphereColor('rgba(245, 158, 11, 0.35)')
		.atmosphereAltitude(0.18);

	const ctrls = globe.controls();
	ctrls.autoRotate = true;
	ctrls.autoRotateSpeed = 0.55;
	ctrls.enableZoom = false;
	ctrls.minPolarAngle = Math.PI / 2.2;
	ctrls.maxPolarAngle = Math.PI / 1.8;

	let markers: GlobeMarker[] = [];

	globe
		.pointsData(markers)
		.pointLat('lat')
		.pointLng('lng')
		.pointColor(() => 'rgba(251, 191, 36, 0.92)')
		.pointAltitude(0.012)
		.pointRadius((d: GlobeMarker) => Math.min(0.42, 0.08 + Math.log1p(d.count) * 0.055))
		.pointResolution(18);

	const ro = new ResizeObserver(() => {
		const w = container.clientWidth;
		const h = container.clientHeight;
		if (w > 0 && h > 0) {
			globe.width(w);
			globe.height(h);
		}
	});
	ro.observe(container);

	const w0 = container.clientWidth || 220;
	const h0 = container.clientHeight || 220;
	globe.width(w0).height(h0);
	globe.pointOfView({ lat: 20, lng: 0, altitude: 2.35 }, 0);

	function setMarkers(next: GlobeMarker[]) {
		markers = next;
		globe.pointsData([...markers]);
	}

	return {
		setMarkers,
		destroy: () => {
			ro.disconnect();
			globe._destructor();
		},
	};
}
