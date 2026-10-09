/**
 * Homepage title reacts to the shoreline footage: a tiny copy of the current
 * frame is sampled under each letter, and a letter splashes when foam reaches it.
 */
import { gsap } from 'gsap';

const SAMPLE_W = 96;
const SAMPLE_INTERVAL_MS = 120;
/* Hysteresis: foam must rise above ON to splash, then fall below OFF to re-arm. */
const FOAM_ON = 0.45;
const FOAM_OFF = 0.2;
const COOLDOWN_MS = 1500;
const MAX_DROPS = 40;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/* Bright, unsaturated pixels read as foam. Sand (warm) and water (blue) stay near 0. */
function foamAt(data: Uint8ClampedArray, i: number): number {
	const r = data[i];
	const g = data[i + 1];
	const b = data[i + 2];
	const lo = Math.min(r, g, b);
	const hi = Math.max(r, g, b);
	return clamp01((lo - 175) / 45) * clamp01(1 - (hi - lo) / 60);
}

export function initShoreSplash(getVideo: () => HTMLVideoElement): () => void {
	const title = document.querySelector<HTMLElement>('[data-hero-title]');
	const wrapper = title?.parentElement;
	const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
	if (!title || !wrapper || !ctx) return () => {};

	const letters = Array.from(title.querySelectorAll<HTMLElement>('.hero-char'));
	const state = letters.map(() => ({ wet: false, last: 0 }));
	const canvas = ctx.canvas;

	const spray = document.createElement('div');
	spray.className = 'shore-spray';
	spray.setAttribute('aria-hidden', 'true');
	wrapper.append(spray);
	let liveDrops = 0;
	let inView = true;

	function spawnDrops(el: HTMLElement, strength: number) {
		const wr = wrapper!.getBoundingClientRect();
		const r = el.getBoundingClientRect();
		const count = Math.round(4 + strength * 5);
		for (let k = 0; k < count && liveDrops < MAX_DROPS; k++) {
			const drop = document.createElement('span');
			drop.className = 'shore-drop';
			const size = r.height * gsap.utils.random(0.025, 0.06);
			drop.style.width = drop.style.height = `${size}px`;
			drop.style.left = `${r.left - wr.left + gsap.utils.random(0.15, 0.85) * r.width}px`;
			drop.style.top = `${r.bottom - wr.top - r.height * 0.18}px`;
			spray.append(drop);
			liveDrops++;

			const rise = r.height * gsap.utils.random(0.35, 0.9);
			const drift = r.height * gsap.utils.random(-0.35, 0.35);
			const up = gsap.utils.random(0.32, 0.5);
			gsap
				.timeline({
					onComplete: () => {
						drop.remove();
						liveDrops--;
					},
				})
				.fromTo(drop, { x: 0, y: 0, opacity: 0.95 }, { x: drift * 0.6, y: -rise, duration: up, ease: 'power2.out' })
				.to(drop, { x: drift, y: r.height * 0.1, opacity: 0, scale: 0.6, duration: up * 1.3, ease: 'power2.in' });
		}
	}

	function splash(el: HTMLElement, strength: number) {
		gsap
			.timeline()
			.to(el, { y: '-0.06em', rotation: gsap.utils.random(-5, 5), duration: 0.16, ease: 'power2.out', overwrite: 'auto' })
			.to(el, { y: 0, rotation: 0, duration: 1.1, ease: 'elastic.out(1, 0.4)' });
		gsap.fromTo(el, { '--wet': clamp01(0.5 + strength) }, { '--wet': 0, duration: 1.8, ease: 'power2.out' });
		spawnDrops(el, strength);
	}

	function sample() {
		const v = getVideo();
		if (!inView || v.paused || v.videoWidth === 0) return;

		const sw = SAMPLE_W;
		const sh = Math.round((SAMPLE_W * v.videoHeight) / v.videoWidth);
		if (canvas.width !== sw || canvas.height !== sh) {
			canvas.width = sw;
			canvas.height = sh;
		}
		ctx!.drawImage(v, 0, 0, sw, sh);
		const { data } = ctx!.getImageData(0, 0, sw, sh);

		/* The video is object-fit: cover over the viewport — map viewport px → sample px. */
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		const scale = Math.max(vw / sw, vh / sh);
		const ox = (vw - sw * scale) / 2;
		const oy = (vh - sh * scale) / 2;
		const toX = (px: number) => Math.min(sw - 1, Math.max(0, Math.floor((px - ox) / scale)));
		const toY = (px: number) => Math.min(sh - 1, Math.max(0, Math.floor((px - oy) / scale)));
		const now = performance.now();

		letters.forEach((el, i) => {
			const r = el.getBoundingClientRect();
			if (r.width === 0 || r.bottom < 0 || r.top > vh) return;

			/* Lower half of the glyph box: where the water would reach it. */
			const x0 = toX(r.left);
			const x1 = toX(r.right);
			const y0 = toY(r.top + r.height * 0.5);
			const y1 = toY(r.bottom);
			let sum = 0;
			let n = 0;
			for (let y = y0; y <= y1; y++) {
				for (let x = x0; x <= x1; x++) {
					sum += foamAt(data, (y * sw + x) * 4);
					n++;
				}
			}
			const foam = sum / n;

			const s = state[i];
			if (!s.wet && foam > FOAM_ON && now - s.last > COOLDOWN_MS) {
				s.wet = true;
				s.last = now;
				splash(el, foam);
			} else if (s.wet && foam < FOAM_OFF) {
				s.wet = false;
			}
		});
	}

	const io = new IntersectionObserver(([entry]) => {
		inView = entry.isIntersecting;
	});
	io.observe(title);
	const timer = window.setInterval(sample, SAMPLE_INTERVAL_MS);

	return () => {
		window.clearInterval(timer);
		io.disconnect();
		spray.remove();
		gsap.killTweensOf(letters);
		gsap.set(letters, { clearProps: 'all' });
	};
}
