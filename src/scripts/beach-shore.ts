/**
 * Beach theme background: real beach footage. Instead of looping the clip
 * end-to-start, two <video> layers crossfade between random segments of it, so
 * the repeat point is never the same twice.
 *
 * Every page load is a fresh document, so the playhead is saved on pagehide and
 * the next page picks up where the last one left off, keeping the footage
 * continuous across the site.
 *
 * Video is released entirely while Universe is active. Reduced motion and
 * Save-Data keep the CSS poster only.
 */

/* Files come from scripts/beach-video.sh. Must match the poster URLs in global.css. */
const CLIP = '/beach/tropic';
const FADE_S = 2.2;
const RESUME_FADE_S = 0.4;
const MIN_SEGMENT_S = 10;
const MAX_SEGMENT_S = 18;
/* timeupdate fires ~4×/s, so leave slack for the outgoing layer to finish its fade. */
const END_MARGIN_S = FADE_S + 0.6;
const RESUME_KEY = 'aditi-beach-playhead';
const RESUME_MAX_AGE_MS = 30 * 60 * 1000;
const READY_TIMEOUT_MS = 10_000;

function getTheme(): 'universe' | 'beach' {
	return document.documentElement.getAttribute('data-theme') === 'beach' ? 'beach' : 'universe';
}

function posterOnly(): boolean {
	const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches || saveData === true;
}

/*
 * Formats to try, best first. H.264 leads wherever the browser is sure of it:
 * Safari can claim VP9 WebM and still fail to decode it. WebM covers browsers
 * built without H.264. Must match the portrait poster media query in global.css.
 */
function pickSources(probe: HTMLVideoElement): string[] {
	const base = window.matchMedia('(max-aspect-ratio: 1/1)').matches ? `${CLIP}-portrait` : CLIP;
	const mp4 = probe.canPlayType('video/mp4; codecs="avc1.640028"');
	const webm = probe.canPlayType('video/webm; codecs="vp9"');
	const sources: string[] = [];
	if (mp4 === 'probably') sources.push(`${base}.mp4`);
	if (webm) sources.push(`${base}.webm`);
	if (mp4 === 'maybe') sources.push(`${base}.mp4`);
	return sources;
}

function once(v: HTMLVideoElement, event: string): Promise<void> {
	return new Promise((resolve) => v.addEventListener(event, () => resolve(), { once: true }));
}

/* Metadata loaded, or the browser couldn't decode this file (or never started loading it). */
function whenReady(v: HTMLVideoElement): Promise<void> {
	if (v.readyState >= HTMLMediaElement.HAVE_METADATA) return Promise.resolve();
	return new Promise((resolve, reject) => {
		const timer = window.setTimeout(() => finish(new Error('timed out waiting for metadata')), READY_TIMEOUT_MS);
		const finish = (err?: unknown) => {
			window.clearTimeout(timer);
			v.removeEventListener('loadedmetadata', onReady);
			v.removeEventListener('error', onError);
			if (err) reject(err);
			else resolve();
		};
		const onReady = () => finish();
		const onError = () => finish(v.error ?? new Error('media error'));
		v.addEventListener('loadedmetadata', onReady);
		v.addEventListener('error', onError);
	});
}

async function fetchBlobUrl(src: string): Promise<string> {
	const r = await fetch(src);
	if (!r.ok) throw new Error(`${r.status} ${src}`);
	return URL.createObjectURL(await r.blob());
}

async function seek(v: HTMLVideoElement, t: number): Promise<void> {
	if (v.readyState < HTMLMediaElement.HAVE_METADATA) await once(v, 'loadedmetadata');
	const done = once(v, 'seeked');
	v.currentTime = t;
	await done;
}

/* Where the previous page's footage would be by now, if it was saved recently. */
function readResumePoint(): number | null {
	try {
		const raw = sessionStorage.getItem(RESUME_KEY);
		if (!raw) return null;
		const { t, at } = JSON.parse(raw) as { t: number; at: number };
		const age = Date.now() - at;
		if (!Number.isFinite(t) || age < 0 || age > RESUME_MAX_AGE_MS) return null;
		return t + age / 1000;
	} catch {
		return null;
	}
}

export function initBeachShore(): () => void {
	const root = document.querySelector<HTMLElement>('[data-beach-background]');
	const layers = root ? Array.from(root.querySelectorAll<HTMLVideoElement>('[data-beach-video]')) : [];
	if (!root || layers.length !== 2 || posterOnly()) return () => {};

	const sources = pickSources(layers[0]);
	if (!sources.length) return () => {};

	for (const v of layers) v.style.transitionDuration = `${FADE_S}s`;

	/* Blob URL of the format that decoded, shared by both layers (two plain src attributes can fetch twice). */
	let clipUrl: string | null = null;
	let front = 0;
	let loaded = false;
	/* Seeking fires timeupdate too, so nothing may crossfade before the first segment is planned. */
	let segmentEnd = Infinity;
	let fadeTimer = 0;
	let fading = false;
	/* Bumped on release so in-flight loads/seeks from a previous run bail out. */
	let generation = 0;

	const frontVideo = () => layers[front];
	const backVideo = () => layers[1 - front];
	const shouldPlay = () => loaded && getTheme() === 'beach' && !document.hidden;

	function lastStart(v: HTMLVideoElement): number {
		return Math.max(0, v.duration - END_MARGIN_S - MIN_SEGMENT_S);
	}

	function randomStart(v: HTMLVideoElement): number {
		return Math.random() * lastStart(v);
	}

	function planSegment(v: HTMLVideoElement) {
		const length = MIN_SEGMENT_S + Math.random() * (MAX_SEGMENT_S - MIN_SEGMENT_S);
		segmentEnd = Math.min(v.currentTime + length, v.duration - END_MARGIN_S);
	}

	function retryOnGesture() {
		document.addEventListener('pointerdown', sync, { once: true });
	}

	/*
	 * The markup says preload="none" so nothing downloads before this runs, and
	 * Safari honours that even for a blob URL: no metadata ever arrives unless
	 * preload is raised. iOS may still wait for playback to begin, so start it.
	 */
	function setClip(url: string) {
		for (const v of layers) {
			v.preload = 'auto';
			v.src = url;
		}
		void layers[0].play().catch(() => {});
	}

	/* Load the first format this browser actually decodes into both layers. */
	async function attachClip(gen: number): Promise<boolean> {
		if (clipUrl) {
			setClip(clipUrl);
			await whenReady(layers[0]);
			return true;
		}
		for (const src of sources) {
			let url: string;
			try {
				url = await fetchBlobUrl(src);
			} catch (err) {
				console.warn('[beach-shore] Could not download footage.', err);
				continue;
			}
			if (gen !== generation) {
				URL.revokeObjectURL(url);
				return false;
			}
			setClip(url);
			try {
				await whenReady(layers[0]);
				clipUrl = url;
				return true;
			} catch (err) {
				console.warn(`[beach-shore] ${src} would not decode, trying the next format.`, err);
				URL.revokeObjectURL(url);
			}
		}
		return false;
	}

	async function load() {
		const gen = ++generation;
		loaded = true;

		let attached = false;
		try {
			attached = await attachClip(gen);
		} catch (err) {
			console.warn('[beach-shore] Footage failed to load.', err);
		}
		if (gen !== generation) return;
		if (!attached) {
			release();
			console.warn('[beach-shore] No playable footage, keeping poster.');
			/* Autoplay blocked before anything loaded (e.g. iOS Low Power Mode): a tap tries again. */
			retryOnGesture();
			return;
		}

		const first = frontVideo();
		const resumeAt = readResumePoint();
		const resuming = resumeAt !== null && resumeAt < first.duration - END_MARGIN_S - 1;
		await seek(first, resuming ? resumeAt : randomStart(first));
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
		/* Carrying on from the previous page: a quick reveal reads as continuous, not a restart. */
		if (resuming) first.style.transitionDuration = `${RESUME_FADE_S}s`;
		first.toggleAttribute('data-front', true);
		first.toggleAttribute('data-visible', true);
		if (resuming) {
			window.setTimeout(() => {
				first.style.transitionDuration = `${FADE_S}s`;
			}, RESUME_FADE_S * 1000);
		}
		if (document.hidden) first.pause();
		planSegment(first);
		void seek(backVideo(), randomStart(backVideo()));
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

	/* Browsers can pause background media on their own (power saving, media
	 * session changes). If the visible layer stops while it should be playing,
	 * start it again rather than leaving a frozen frame. */
	function onPause(e: Event) {
		if (e.target !== frontVideo() || !shouldPlay() || !frontVideo().hasAttribute('data-visible')) return;
		void frontVideo().play().catch(retryOnGesture);
	}

	/* Reaching the end means a crossfade was missed: hand over right away. */
	function onEnded(e: Event) {
		if (e.target === frontVideo() && !fading && shouldPlay()) void crossfade();
	}

	function savePlayhead() {
		if (!loaded || !frontVideo().hasAttribute('data-visible')) return;
		try {
			sessionStorage.setItem(RESUME_KEY, JSON.stringify({ t: frontVideo().currentTime, at: Date.now() }));
		} catch {
			/* Private mode or storage full: the next page just starts somewhere new. */
		}
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

	for (const v of layers) {
		v.addEventListener('timeupdate', onTimeUpdate);
		v.addEventListener('pause', onPause);
		v.addEventListener('ended', onEnded);
	}
	const mo = new MutationObserver(sync);
	mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
	document.addEventListener('visibilitychange', sync);
	window.addEventListener('pagehide', savePlayhead);
	sync();

	return () => {
		release();
		mo.disconnect();
		document.removeEventListener('visibilitychange', sync);
		document.removeEventListener('pointerdown', sync);
		window.removeEventListener('pagehide', savePlayhead);
		for (const v of layers) {
			v.removeEventListener('timeupdate', onTimeUpdate);
			v.removeEventListener('pause', onPause);
			v.removeEventListener('ended', onEnded);
		}
		if (clipUrl) URL.revokeObjectURL(clipUrl);
	};
}
