import type { GlobeMarker } from './visitor-globe';

function countryLabel(code: string | undefined): string {
	if (!code) return 'Unknown';
	try {
		const name = new Intl.DisplayNames(['en'], { type: 'region' }).of(code);
		return name ?? code;
	} catch {
		return code;
	}
}

/**
 * Beach 2D map: soft horizon + pins. Hover a pin to see country + visit count.
 */
export function initVisitorHorizon(container: HTMLElement): {
	setMarkers: (markers: GlobeMarker[]) => void;
	destroy: () => void;
} {
	container.replaceChildren();
	container.classList.add('visitor-horizon');

	const frame = container.parentElement;
	const tooltip = document.createElement('div');
	tooltip.className = 'visitor-horizon__tooltip';
	tooltip.setAttribute('role', 'tooltip');
	(frame ?? container).appendChild(tooltip);

	const svgNS = 'http://www.w3.org/2000/svg';
	const svg = document.createElementNS(svgNS, 'svg');
	svg.setAttribute('viewBox', '0 0 400 220');
	svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
	svg.classList.add('visitor-horizon__svg');

	const defs = document.createElementNS(svgNS, 'defs');
	const grad = document.createElementNS(svgNS, 'linearGradient');
	grad.setAttribute('id', 'visitor-horizon-wash');
	grad.setAttribute('x1', '0');
	grad.setAttribute('y1', '0');
	grad.setAttribute('x2', '0');
	grad.setAttribute('y2', '1');
	for (const [off, color] of [
		['0%', '#eaf4fb'],
		['40%', '#d4e8f4'],
		['55%', '#9ec9e0'],
		['100%', '#6a9db8'],
	] as const) {
		const stop = document.createElementNS(svgNS, 'stop');
		stop.setAttribute('offset', off);
		stop.setAttribute('stop-color', color);
		grad.appendChild(stop);
	}
	defs.appendChild(grad);
	svg.appendChild(defs);

	const bg = document.createElementNS(svgNS, 'rect');
	bg.setAttribute('width', '400');
	bg.setAttribute('height', '220');
	bg.setAttribute('fill', 'url(#visitor-horizon-wash)');
	svg.appendChild(bg);

	const shore = document.createElementNS(svgNS, 'path');
	shore.setAttribute(
		'd',
		'M0 118 C 70 108, 130 128, 200 118 S 330 108, 400 122 L400 220 L0 220 Z',
	);
	shore.setAttribute('fill', '#5a8faa');
	shore.setAttribute('opacity', '0.5');
	svg.appendChild(shore);

	const wave = document.createElementNS(svgNS, 'path');
	wave.setAttribute('d', 'M0 130 C 80 122, 160 138, 240 128 S 360 122, 400 132');
	wave.setAttribute('fill', 'none');
	wave.setAttribute('stroke', '#ffffff');
	wave.setAttribute('stroke-width', '1.25');
	wave.setAttribute('opacity', '0.55');
	svg.appendChild(wave);

	const pins = document.createElementNS(svgNS, 'g');
	pins.classList.add('visitor-horizon__pins');
	svg.appendChild(pins);
	container.appendChild(svg);

	function project(lat: number, lng: number): { x: number; y: number } {
		const x = ((lng + 180) / 360) * 400;
		const y = ((90 - lat) / 180) * 150 + 12;
		return { x, y: Math.min(155, Math.max(18, y)) };
	}

	function hideTip() {
		tooltip.removeAttribute('data-show');
		tooltip.textContent = '';
	}

	function showTip(clientX: number, clientY: number, label: string, count: number) {
		const host = frame ?? container;
		const rect = host.getBoundingClientRect();
		const left = clientX - rect.left;
		const top = clientY - rect.top;
		tooltip.style.left = `${left}px`;
		tooltip.style.top = `${top}px`;
		tooltip.textContent = `${label} · ${count}`;
		tooltip.setAttribute('data-show', '1');
	}

	return {
		setMarkers(markers: GlobeMarker[]) {
			pins.replaceChildren();
			hideTip();
			const accent =
				getComputedStyle(document.documentElement).getPropertyValue('--color-amber').trim() ||
				'#3d7ea6';

			for (const m of markers) {
				const { x, y } = project(m.lat, m.lng);
				const count = m.count ?? 1;
				const label = countryLabel(m.country);
				const r = 3.2 + Math.min(5, Math.sqrt(count) * 1.1);

				const g = document.createElementNS(svgNS, 'g');
				g.style.cursor = 'pointer';

				/* Invisible hit target — easier to hover on small pins. */
				const hit = document.createElementNS(svgNS, 'circle');
				hit.setAttribute('cx', String(x));
				hit.setAttribute('cy', String(y));
				hit.setAttribute('r', String(Math.max(12, r * 2.8)));
				hit.setAttribute('fill', 'transparent');
				g.appendChild(hit);

				const glow = document.createElementNS(svgNS, 'circle');
				glow.setAttribute('cx', String(x));
				glow.setAttribute('cy', String(y));
				glow.setAttribute('r', String(r * 2.2));
				glow.setAttribute('fill', accent);
				glow.setAttribute('opacity', '0.22');
				glow.setAttribute('pointer-events', 'none');
				g.appendChild(glow);

				const dot = document.createElementNS(svgNS, 'circle');
				dot.setAttribute('cx', String(x));
				dot.setAttribute('cy', String(y));
				dot.setAttribute('r', String(r));
				dot.setAttribute('fill', accent);
				dot.setAttribute('stroke', 'rgba(255,255,255,0.65)');
				dot.setAttribute('stroke-width', '1');
				dot.setAttribute('pointer-events', 'none');
				g.appendChild(dot);

				g.addEventListener('pointerenter', (e) => {
					showTip(e.clientX, e.clientY, label, count);
				});
				g.addEventListener('pointermove', (e) => {
					showTip(e.clientX, e.clientY, label, count);
				});
				g.addEventListener('pointerleave', hideTip);

				pins.appendChild(g);
			}
		},
		destroy() {
			hideTip();
			tooltip.remove();
			container.replaceChildren();
			container.classList.remove('visitor-horizon');
		},
	};
}
