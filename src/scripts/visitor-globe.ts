import Globe from 'globe.gl';

export type GlobeMarker = {
	lat: number;
	lng: number;
	count?: number;
	country?: string;
	/** State / province when known (e.g. "California"). */
	region?: string;
};

type PointDatum = {
	lat: number;
	lng: number;
	size: number;
	color: string;
	count: number;
	country?: string;
	region?: string;
	placeLine: string;
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

function placeLine(m: { country?: string; region?: string }): string {
	const country = countryLabel(m.country);
	const region = m.region?.trim();
	if (region) return `${region}, ${country}`;
	return country;
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/**
 * Visitor globe (Universe + Beach). Uses a custom HTML tooltip outside the
 * clipped circle — globe.gl's built-in labels get clipped / miss pointer hits.
 */
export function initVisitorGlobe(container: HTMLElement): {
	setMarkers: (markers: GlobeMarker[]) => void;
	destroy: () => void;
} {
	const host = container.parentElement ?? container;

	const tooltip = document.createElement('div');
	tooltip.className = 'visitor-globe__tooltip';
	tooltip.setAttribute('role', 'tooltip');
	tooltip.hidden = true;
	host.appendChild(tooltip);

	const globe = new Globe(container)
		.globeImageUrl(EARTH_BLUE_MARBLE)
		.backgroundColor('rgba(0,0,0,0)')
		.showAtmosphere(true)
		.atmosphereColor('#4a6fa8')
		.atmosphereAltitude(0.15)
		.pointAltitude(0.012)
		.pointRadius('size')
		.pointColor('color')
		.pointsTransitionDuration(0)
		.pointLabel(() => '');

	const ctrls = globe.controls();
	ctrls.autoRotate = true;
	ctrls.autoRotateSpeed = 0.35;
	ctrls.enableZoom = false;

	function hideTip() {
		tooltip.hidden = true;
		tooltip.replaceChildren();
	}

	function showTip(p: PointDatum) {
		const accent = accentColor();
		tooltip.innerHTML = `<div class="visitor-globe__tooltip-place">${escapeHtml(p.placeLine)}</div><div class="visitor-globe__tooltip-count" style="color:${accent}">${p.count}</div>`;
		tooltip.hidden = false;
		/* Anchor above the globe centre — avoids clipped labels inside the circle. */
		tooltip.style.left = '50%';
		tooltip.style.top = '10px';
	}

	globe.onPointHover((point: object | null) => {
		ctrls.autoRotate = !point;
		container.style.cursor = point ? 'pointer' : '';
		if (point) showTip(point as PointDatum);
		else hideTip();
	});

	const resize = () => {
		const w = container.clientWidth || 200;
		const h = container.clientHeight || 200;
		globe.width(w).height(h);
	};
	resize();
	const ro = new ResizeObserver(resize);
	ro.observe(container);

	const onTheme = () => {
		/* Refresh pin color when amber↔beach blue swaps. */
		const data = globe.pointsData() as PointDatum[];
		if (!data.length) return;
		const color = accentColor();
		globe.pointsData(data.map((d) => ({ ...d, color })));
	};
	const mo = new MutationObserver(onTheme);
	mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

	const api = {
		setMarkers(markers: GlobeMarker[]) {
			const color = accentColor();
			hideTip();
			globe.pointsData(
				markers.map(
					(m): PointDatum => ({
						lat: m.lat,
						lng: m.lng,
						/* Larger hit target so hover works on a small globe. */
						size: 0.55 + Math.min(1.4, (m.count ?? 1) * 0.1),
						color,
						count: m.count ?? 1,
						country: m.country,
						region: m.region,
						placeLine: placeLine(m),
					}),
				),
			);
		},
		destroy() {
			mo.disconnect();
			ro.disconnect();
			hideTip();
			tooltip.remove();
			globe._destructor();
		},
	};

	return api;
}
