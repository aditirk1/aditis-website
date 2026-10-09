/**
 * Beach theme background: real shoreline footage. Instead of looping the clip
 * end-to-start, two <video> layers crossfade between random segments of it, so
 * the repeat point is never the same twice.
 *
 * Video is released entirely while Universe is active. Reduced motion and
 * Save-Data keep the CSS poster only.
 */
import { initShoreSplash } from './beach-shore-splash.ts';

const FADE_S = 2.2;
const MIN_SEGMENT_S = 7;
const MAX_SEGMENT_S = 13;
/* timeupdate fires ~4×/s, so leave slack for the outgoing layer to finish its fade. */
const END_MARGIN_S = FADE_S + 0.6;

function getTheme(): 'universe' | 'beach' {
	return document.documentElement.getAttribute('data-theme') === 'beach' ? 'beach' : 'universe';
}

function posterOnly(): boolean {
	const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches || saveData === true;
}

/* Must match the portrait poster media query in global.css. */
function pickSource(probe: HTMLVideoElement): string | null {
	const base = window.matchMedia('(max-aspect-ratio: 1/1)').matches ? '/beach/shore-portrait' : '/beach/shore';
	if (probe.canPlayType('video/webm; codecs="vp9"')) return `${base}.webm`;
	if (probe.canPlayType('video/mp4; codecs="avc1.640028"')) return `${base}.mp4`;
	return null;
}

function once(v: HTMLVideoElement, event: string): Promise<void> {
	return new Promise((resolve) => v.addEventListener(event, () => resolve(), { once: true }));
}

async function seek(v: HTMLVideoElement, t: number): Promise<void> {
	if (v.readyState < HTMLMediaElement.HAVE_METADATA) await once(v, 'loadedmetadata');
	const done = once(v, 'seeked');
	v.currentTime = t;
	await done;
}

export function initBeachShore(): () => void {
	const root = document.querySelector<HTMLElement>('[data-beach-background]');
	const layers = root ? Array.from(root.querySelectorAll<HTMLVideoElement>('[data-beach-video]')) : [];
	if (!root || layers.length !== 2 || posterOnly()) return () => {};

	const src = pickSource(layers[0]);
	if (!src) return () => {};

	for (const v of layers) v.style.transitionDuration = `${FADE_S}s`;

	/* One download shared by both layers (two plain src attributes can fetch twice). */
	let clipUrl: Promise<string> | null = null;
	let front = 0;
	let loaded = false;
	/* Seeking fires timeupdate too, so nothing may crossfade before the first segment is planned. */
	let segmentEnd = Infinity;
	let fadeTimer = 0;
	let fading = false;
	/* Bumped on release so in-flight loads/seeks from a previous run bail out. */
	let generation = 0;
	let stopSplash: (() => void) | null = null;

	const frontVideo = () => layers[front];
	const backVideo = () => layers[1 - front];

	function randomStart(v: HTMLVideoElement): number {
		const room = v.duration - END_MARGIN_S - MIN_SEGMENT_S;
		return room > 0 ? Math.random() * room : 0;
	}

	function planSegment(v: HTMLVideoElement) {
		const length = MIN_SEGMENT_S + Math.random() * (MAX_SEGMENT_S - MIN_SEGMENT_S);
		segmentEnd = Math.min(v.currentTime + length, v.duration - END_MARGIN_S);
	}

	function retryOnGesture() {
		document.addEventListener('pointerdown', sync, { once: true });
	}

	async function load() {
		const gen = ++generation;
		loaded = true;
		clipUrl ??= fetch(src!)
			.then((r) => {
				if (!r.ok) throw new Error(`${r.status} ${src}`);
				return r.blob();
			})
			.then((b) => URL.createObjectURL(b));

		let url: string;
		try {
			url = await clipUrl;
		} catch (err) {
			clipUrl = null;
			loaded = false;
			console.warn('[beach-shore] Could not load footage, keeping poster.', err);
			return;
		}
		if (gen !== generation) return;

		for (const v of layers) v.src = url;
		const first = frontVideo();
		await seek(first, randomStart(first));
		if (gen !== generation) return;
		try {
			await first.play();
		} catch {
			/* Autoplay blocked (e.g. iOS Low Power Mode): poster stays, try again on first tap. */
			release();
			retryOnGesture();
			return;
		}
		if (gen !== generation) return;
		first.toggleAttribute('data-front', true);
		first.toggleAttribute('data-visible', true);
		if (document.hidden) first.pause();
		planSegment(first);
		void seek(backVideo(), randomStart(backVideo()));
		stopSplash = initShoreSplash(frontVideo);
	}

	async function crossfade() {
		fading = true;
		const gen = generation;
		const incoming = backVideo();
		const outgoing = frontVideo();
		try {
			await incoming.play();
		} catch {
			fading = false;
			return;
		}
		if (gen !== generation || !fading) return;
		outgoing.removeAttribute('data-front');
		incoming.toggleAttribute('data-front', true);
		incoming.toggleAttribute('data-visible', true);
		front = 1 - front;
		planSegment(incoming);

		fadeTimer = window.setTimeout(() => {
			outgoing.removeAttribute('data-visible');
			outgoing.pause();
			fading = false;
			void seek(outgoing, randomStart(outgoing));
		}, FADE_S * 1000);
	}

	function onTimeUpdate(e: Event) {
		if (fading || e.target !== frontVideo()) return;
		if (frontVideo().currentTime >= segmentEnd) void crossfade();
	}

	function pause() {
		window.clearTimeout(fadeTimer);
		for (const v of layers) v.pause();
		if (fading) {
			/* Settle on the front layer and re-park the standby, so resume is a clean single layer. */
			const standby = backVideo();
			standby.removeAttribute('data-visible');
			void seek(standby, randomStart(standby));
			fading = false;
		}
	}

	function release() {
		generation++;
		pause();
		stopSplash?.();
		stopSplash = null;
		loaded = false;
		segmentEnd = Infinity;
		for (const v of layers) {
			v.removeAttribute('data-front');
			v.removeAttribute('data-visible');
			v.removeAttribute('src');
			v.load();
		}
	}

	function sync() {
		if (getTheme() !== 'beach') {
			if (loaded) release();
			return;
		}
		if (document.hidden) {
			pause();
			return;
		}
		if (!loaded) {
			void load();
			return;
		}
		const v = frontVideo();
		if (v.paused && v.hasAttribute('data-visible')) void v.play().catch(retryOnGesture);
	}

	for (const v of layers) v.addEventListener('timeupdate', onTimeUpdate);
	const mo = new MutationObserver(sync);
	mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
	document.addEventListener('visibilitychange', sync);
	sync();

	return () => {
		release();
		mo.disconnect();
		document.removeEventListener('visibilitychange', sync);
		document.removeEventListener('pointerdown', sync);
		for (const v of layers) v.removeEventListener('timeupdate', onTimeUpdate);
		void clipUrl?.then((url) => URL.revokeObjectURL(url)).catch(() => {});
	};
}
