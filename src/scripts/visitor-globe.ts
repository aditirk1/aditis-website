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

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Leader geometry, in px. */
const ELBOW_GAP = 16;
const TICK_LEN = 16;
const LABEL_GAP = 5;

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
	return region ? `${region}, ${country}` : country;
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(hi, v));
}

/**
 * Visitor globe (Universe + Beach).
 *
 * Hovering a pin draws a leader line out of the globe — slanted radial segment,
 * short horizontal tick, then the label — instead of a centred tooltip that the
 * round frame would clip. Zoom is available so sparse, single-visit pins are big
 * enough to hit.
 */
export function initVisitorGlobe(container: HTMLElement): {
	setMarkers: (markers: GlobeMarker[]) => void;
	destroy: () => void;
} {
	const stage = container.closest<HTMLElement>('[data-globe-stage]');
	const leaderSvg = stage?.querySelector<SVGSVGElement>('[data-globe-leader]') ?? null;
	const callout = stage?.querySelector<HTMLElement>('[data-globe-callout]') ?? null;
	const calloutPlace = stage?.querySelector<HTMLElement>('[data-globe-callout-place]') ?? null;
	const calloutCount = stage?.querySelector<HTMLElement>('[data-globe-callout-count]') ?? null;

	const leaderPath = document.createElementNS(SVG_NS, 'polyline');
	leaderPath.setAttribute('fill', 'none');
	leaderPath.setAttribute('stroke', 'currentColor');
	leaderPath.setAttribute('stroke-width', '1.1');
	leaderPath.setAttribute('stroke-linecap', 'round');
	leaderPath.setAttribute('stroke-linejoin', 'round');

	const leaderDot = document.createElementNS(SVG_NS, 'circle');
	leaderDot.setAttribute('r', '2.6');
	leaderDot.setAttribute('fill', 'currentColor');

	leaderSvg?.appendChild(leaderPath);
	leaderSvg?.appendChild(leaderDot);

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
		/* Built-in labels sit inside the clipped circle — we draw our own. */
		.pointLabel(() => '');

	const ctrls = globe.controls();
	ctrls.autoRotate = true;
	ctrls.autoRotateSpeed = 0.35;
	/*
	 * Wheel zoom only after a deliberate pause over the globe, so scrolling the
	 * page past this small widget doesn't get captured.
	 */
	ctrls.enableZoom = false;

	let hovered: PointDatum | null = null;
	let followRaf = 0;
	let zoomArmTimer = 0;

	function hideCallout() {
		hovered = null;
		cancelAnimationFrame(followRaf);
		followRaf = 0;
		if (callout) callout.hidden = true;
		leaderPath.setAttribute('points', '');
		leaderDot.setAttribute('r', '0');
	}

	/**
	 * A pin that has rotated behind the globe still projects inside the disc, but
	 * the surface under that screen point is somewhere else entirely. Threshold is
	 * deliberately loose — near the limb, parallax from the pin's altitude adds up,
	 * and hiding a label the visitor is actually hovering is the worse failure.
	 */
	function isFacingCamera(p: PointDatum, sx: number, sy: number): boolean {
		const surface = globe.toGlobeCoords(sx, sy);
		if (!surface) return true;
		const dLat = Math.abs(surface.lat - p.lat);
		let dLng = Math.abs(surface.lng - p.lng);
		if (dLng > 180) dLng = 360 - dLng;
		return dLat < 30 && dLng < 30;
	}

	function drawCallout(p: PointDatum) {
		if (!stage || !leaderSvg || !callout || !calloutPlace || !calloutCount) return;

		const stageRect = stage.getBoundingClientRect();
		const circleRect = container.getBoundingClientRect();
		if (stageRect.width < 1 || circleRect.width < 1) return;

		const screen = globe.getScreenCoords(p.lat, p.lng, 0.012);
		if (!screen || !Number.isFinite(screen.x) || !Number.isFinite(screen.y)) return;

		if (!isFacingCamera(p, screen.x, screen.y)) {
			callout.hidden = true;
			leaderPath.setAttribute('points', '');
			leaderDot.setAttribute('r', '0');
			return;
		}

		/* Globe coords are canvas-relative; the leader layer spans the stage. */
		const offsetX = circleRect.left - stageRect.left;
		const offsetY = circleRect.top - stageRect.top;
		const px = screen.x + offsetX;
		const py = screen.y + offsetY;

		const cx = offsetX + circleRect.width / 2;
		const cy = offsetY + circleRect.height / 2;
		const radius = circleRect.width / 2;
		const stageW = stageRect.width;
		const stageH = stageRect.height;

		let vx = px - cx;
		let vy = py - cy;
		const len = Math.hypot(vx, vy);
		if (len < 1) {
			vx = 0;
			vy = -1;
		} else {
			vx /= len;
			vy /= len;
		}

		/* Where the leader wants to leave the frame: outward along the pin's radius. */
		const elbowDist = Math.max(len, radius) + ELBOW_GAP;
		const ox = cx + vx * elbowDist;
		const oy = cy + vy * elbowDist;

		calloutPlace.textContent = p.placeLine;
		calloutCount.textContent = String(p.count);
		callout.hidden = false;

		const box = callout.getBoundingClientRect();
		const w = box.width;
		const h = box.height;

		/* Put the label on whichever side actually has room for it. */
		let side = vx >= 0 ? 1 : -1;
		const roomRight = stageW - (ox + TICK_LEN + LABEL_GAP);
		const roomLeft = ox - TICK_LEN - LABEL_GAP;
		if (side === 1 && roomRight < w && roomLeft > roomRight) side = -1;
		else if (side === -1 && roomLeft < w && roomRight > roomLeft) side = 1;

		/*
		 * Place and clamp the label first, then derive the elbow from where it
		 * actually landed. Doing it the other way round let clamping slide the box
		 * off the end of the line, and the box paints over the line, so the two
		 * read as separate floating pieces.
		 */
		const nearEdgeWanted = ox + side * (TICK_LEN + LABEL_GAP);
		const left = clamp(
			side === 1 ? nearEdgeWanted : nearEdgeWanted - w,
			0,
			Math.max(0, stageW - w),
		);
		const top = clamp(oy - h / 2, 0, Math.max(0, stageH - h));

		callout.style.left = `${left}px`;
		callout.style.top = `${top}px`;

		/* Tick lands on the label's near edge; the elbow sits a tick outside it. */
		const attachX = side === 1 ? left - LABEL_GAP : left + w + LABEL_GAP;
		const elbowX = attachX - side * TICK_LEN;
		const attachY = top + h / 2;

		leaderPath.setAttribute('points', `${px},${py} ${elbowX},${attachY} ${attachX},${attachY}`);
		leaderDot.setAttribute('cx', String(px));
		leaderDot.setAttribute('cy', String(py));
		leaderDot.setAttribute('r', '2.6');
	}

	function followHovered() {
		if (!hovered) return;
		drawCallout(hovered);
		followRaf = requestAnimationFrame(followHovered);
	}

	globe.onPointHover((point: object | null) => {
		const p = point as PointDatum | null;
		ctrls.autoRotate = !p;
		container.style.cursor = p ? 'pointer' : '';
		if (!p) {
			hideCallout();
			return;
		}
		hovered = p;
		drawCallout(p);
		/* Keep the leader glued to the pin through drags and zooms. */
		if (!followRaf) followRaf = requestAnimationFrame(followHovered);
	});

	/*
	 * Trackpad two-finger scroll, mouse wheel and touch pinch all drive
	 * OrbitControls zoom. It arms after a short pause so scrolling the page past
	 * this small widget doesn't get swallowed, and immediately on touch since a
	 * pinch is already deliberate.
	 */
	const onPointerEnter = () => {
		window.clearTimeout(zoomArmTimer);
		zoomArmTimer = window.setTimeout(() => {
			ctrls.enableZoom = true;
		}, 260);
	};
	const onPointerDown = () => {
		window.clearTimeout(zoomArmTimer);
		ctrls.enableZoom = true;
	};
	const onPointerLeave = () => {
		window.clearTimeout(zoomArmTimer);
		ctrls.enableZoom = false;
	};
	container.addEventListener('pointerenter', onPointerEnter);
	container.addEventListener('pointerdown', onPointerDown);
	container.addEventListener('pointerleave', onPointerLeave);

	const resize = () => {
		const w = container.clientWidth || 200;
		const h = container.clientHeight || 200;
		globe.width(w).height(h);
		if (stage && leaderSvg) {
			const r = stage.getBoundingClientRect();
			leaderSvg.setAttribute('width', String(Math.round(r.width)));
			leaderSvg.setAttribute('height', String(Math.round(r.height)));
		}
	};
	resize();
	const ro = new ResizeObserver(resize);
	ro.observe(container);
	if (stage) ro.observe(stage);

	const onTheme = () => {
		/* Refresh pin colour when amber ↔ beach blue swaps. */
		const data = globe.pointsData() as PointDatum[];
		if (!data.length) return;
		const color = accentColor();
		globe.pointsData(data.map((d) => ({ ...d, color })));
	};
	const mo = new MutationObserver(onTheme);
	mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

	return {
		setMarkers(markers: GlobeMarker[]) {
			const color = accentColor();
			hideCallout();
			globe.pointsData(
				markers.map(
					(m): PointDatum => ({
						lat: m.lat,
						lng: m.lng,
						/* Floor the size so a 1-visit pin is still a real hit target. */
						size: 0.7 + Math.min(1.3, (m.count ?? 1) * 0.09),
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
			hideCallout();
			window.clearTimeout(zoomArmTimer);
			container.removeEventListener('pointerenter', onPointerEnter);
			container.removeEventListener('pointerdown', onPointerDown);
			container.removeEventListener('pointerleave', onPointerLeave);
			leaderPath.remove();
			leaderDot.remove();
			globe._destructor();
		},
	};
}
