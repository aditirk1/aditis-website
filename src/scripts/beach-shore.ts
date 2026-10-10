/**
 * Beach theme background: real beach footage on a native, seamless loop (the
 * seam is blended into the file by scripts/beach-video.sh). The browser streams
 * the file itself, which is the path phones handle best.
 *
 * Every page load is a fresh document, so the playhead is saved on pagehide and
 * the next page picks up where the last one left off.
 *
 * Video is released entirely while Universe is active. Reduced motion and
 * Save-Data keep the CSS poster only.
 */

/* Files come from scripts/beach-video.sh. Must match the poster URLs in global.css. */
const CLIP = '/beach/tropic-loop';
const RESUME_KEY = 'aditi-beach-playhead';
const RESUME_MAX_AGE_MS = 30 * 60 * 1000;
const FADE_IN_S = 0.8;
const RESUME_FADE_IN_S = 0.3;

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
	const video = root?.querySelector<HTMLVideoElement>('[data-beach-video]');
	if (!root || !video || posterOnly()) return () => {};
	const v = video;

	const sources = pickSources(v);
	if (!sources.length) return () => {};

	let sourceIndex = 0;
	let active = false;
	let resumeAt: number | null = null;

	const shouldPlay = () => active && getTheme() === 'beach' && !document.hidden;

	function tryPlay() {
		void v.play().catch(() => {
			/* Autoplay blocked (e.g. iOS Low Power Mode): poster stays until the first tap. */
			document.addEventListener('pointerdown', onGesture, { once: true });
		});
	}

	/* Called straight from the tap so the browser counts it as user-initiated. */
	function onGesture() {
		if (shouldPlay()) tryPlay();
	}

	function start() {
		active = true;
		resumeAt = readResumePoint();
		v.style.transitionDuration = `${resumeAt === null ? FADE_IN_S : RESUME_FADE_IN_S}s`;
		v.preload = 'auto';
		v.src = sources[sourceIndex];
		tryPlay();
	}

	function stop() {
		active = false;
		v.removeAttribute('data-visible');
		v.pause();
		v.removeAttribute('src');
		v.load();
	}

	function onLoadedMetadata() {
		if (resumeAt !== null && v.duration > 0) v.currentTime = resumeAt % v.duration;
		resumeAt = null;
	}

	function onPlaying() {
		if (active) v.toggleAttribute('data-visible', true);
	}

	/* A format this browser can't decode: move on to the next one. */
	function onError() {
		if (!active || !v.error) return;
		if (sourceIndex + 1 >= sources.length) {
			console.warn('[beach-shore] No playable footage, keeping poster.', v.error);
			stop();
			return;
		}
		console.warn(`[beach-shore] ${sources[sourceIndex]} would not play, trying the next format.`, v.error);
		sourceIndex++;
		v.src = sources[sourceIndex];
		tryPlay();
	}

	/* Browsers can pause background media on their own (power saving, media
	 * session changes). If it stops while it should be playing, start it again. */
	function onPause() {
		if (shouldPlay()) tryPlay();
	}

	function savePlayhead() {
		if (!active || v.readyState < HTMLMediaElement.HAVE_METADATA) return;
		try {
			sessionStorage.setItem(RESUME_KEY, JSON.stringify({ t: v.currentTime, at: Date.now() }));
		} catch {
			/* Private mode or storage full: the next page just starts from the top. */
		}
	}

	function sync() {
		if (getTheme() !== 'beach') {
			if (active) stop();
			return;
		}
		if (!active) {
			start();
			return;
		}
		if (document.hidden) v.pause();
		else tryPlay();
	}

	v.addEventListener('loadedmetadata', onLoadedMetadata);
	v.addEventListener('playing', onPlaying);
	v.addEventListener('error', onError);
	v.addEventListener('pause', onPause);
	const mo = new MutationObserver(sync);
	mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
	document.addEventListener('visibilitychange', sync);
	window.addEventListener('pagehide', savePlayhead);
	sync();

	return () => {
		stop();
		mo.disconnect();
		v.removeEventListener('loadedmetadata', onLoadedMetadata);
		v.removeEventListener('playing', onPlaying);
		v.removeEventListener('error', onError);
		v.removeEventListener('pause', onPause);
		document.removeEventListener('visibilitychange', sync);
		document.removeEventListener('pointerdown', onGesture);
		window.removeEventListener('pagehide', savePlayhead);
	};
}
