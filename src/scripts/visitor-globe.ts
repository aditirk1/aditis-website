import Globe from 'globe.gl';

export type GlobeMarker = { lat: number; lng: number; count?: number; country?: string };

type PointDatum = {
	lat: number;
	lng: number;
	size: number;
	color: string;
	count: number;
	country?: string;
	label: string;
};

/**
 * NASA Blue Marble–style texture, self-hosted so the globe still renders when a
 * CDN is slow or blocked. Downscaled to 2048×1024 — plenty for this widget.
 */
const EARTH_BLUE_MARBLE = '/visitor-map/earth-blue-marble.jpg';

function accentColor(): string {
	const v = getComputedStyle(document.documentElement).getPropertyValue('--color-amber').trim();
	return v || '#ffaa00';
}

function countryLabel(code: string | undefined): string {
	if (!code) return 'Unknown';
	try {
		return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code;
	} catch {
		return code;
	}
}

export function initVisitorGlobe(container: HTMLElement): {
	setMarkers: (markers: GlobeMarker[]) => void;
	destroy: () => void;
} {
	const globe = new Globe(container)
		.globeImageUrl(EARTH_BLUE_MARBLE)
		.backgroundColor('rgba(0,0,0,0)')
		.showAtmosphere(true)
		.atmosphereColor('#4a6fa8')
		.atmosphereAltitude(0.15)
		.pointAltitude(0.01)
		.pointRadius('size')
		.pointColor('color')
		.pointsTransitionDuration(0)
		.pointLabel((d: object) => {
			const p = d as PointDatum;
			const accent = accentColor();
			return `<div style="padding:2px 0;line-height:1.25;text-align:left">
				<div style="font-size:11px;font-weight:500;opacity:0.92">${p.label}</div>
				<div style="margin-top:2px;font-size:13px;font-weight:700;color:${accent}">${p.count}</div>
			</div>`;
		});

	const ctrls = globe.controls();
	ctrls.autoRotate = true;
	ctrls.autoRotateSpeed = 0.35;
	ctrls.enableZoom = false;

	/* Pause spin while hovering a pin so it's easier to read. */
	globe.onPointHover((point: object | null) => {
		ctrls.autoRotate = !point;
		container.style.cursor = point ? 'pointer' : '';
	});

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
			const color = accentColor();
			globe.pointsData(
				markers.map(
					(m): PointDatum => ({
						lat: m.lat,
						lng: m.lng,
						size: 0.35 + Math.min(1.2, (m.count ?? 1) * 0.08),
						color,
						count: m.count ?? 1,
						country: m.country,
						label: countryLabel(m.country),
					}),
				),
			);
		},
		destroy() {
			ro.disconnect();
			globe._destructor();
		},
	};

	return api;
}
