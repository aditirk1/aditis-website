/**
 * Splash: logo fades in → hold → title fades in (pair stays screen-centered) →
 * hold → scatter → reveal. First visit per session only (sessionStorage).
 *
 * Logo shimmer uses the original img + overlay structure from before the redesign.
 */
import { gsap } from 'gsap';

export const SPLASH_KEY = 'aditi-splash-seen';
export const SPLASH_DONE_EVENT = 'aditi:splash-done';

const LOGO_INTRO_S = 0.65;
/** Logo alone on screen before the wordmark appears. */
const LOGO_HOLD_S = 1.5;
const TITLE_FADE_S = 0.6;
const TITLE_HOLD_S = 1.0;

function finish(overlay: HTMLElement) {
	sessionStorage.setItem(SPLASH_KEY, '1');
	document.documentElement.removeAttribute('data-splash-skip');
	overlay.remove();
	window.dispatchEvent(new CustomEvent(SPLASH_DONE_EVENT));
	document.dispatchEvent(new CustomEvent('splash:done'));
}

function setSplashLogoSrc(logo: HTMLImageElement) {
	const theme = document.documentElement.getAttribute('data-theme') === 'beach' ? 'beach' : 'universe';
	logo.src = theme === 'beach' ? '/brand/logo-beach-512.png' : '/brand/logo-universe-512.png';
}

export function initSplashIntro(): void {
	const overlay = document.getElementById('splash-intro');
	if (!overlay) {
		window.dispatchEvent(new CustomEvent(SPLASH_DONE_EVENT));
		return;
	}

	if (sessionStorage.getItem(SPLASH_KEY) === '1') {
		finish(overlay);
		return;
	}

	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
		finish(overlay);
		return;
	}

	const logoWrap = overlay.querySelector('[data-splash-logo-wrap]') as HTMLElement | null;
	const logo = overlay.querySelector('[data-splash-logo]') as HTMLImageElement | null;
	const title = overlay.querySelector('[data-splash-title]') as HTMLElement | null;
	const chars = overlay.querySelectorAll<HTMLElement>('.splash-char');

	if (!logoWrap || !logo || !title || !chars.length) {
		finish(overlay);
		return;
	}

	setSplashLogoSrc(logo);

	gsap.set(logoWrap, { y: 0 });
	gsap.set(logo, { opacity: 0 });
	/* Title stays in layout (space reserved) but invisible until phase 2 — keeps the pair centered. */
	gsap.set(title, { opacity: 0, visibility: 'hidden' });
	gsap.set(chars, { opacity: 1, x: 0, y: 0, rotation: 0, scale: 1 });

	const tl = gsap.timeline();

	/* Phase 1 — logo fades in, then holds alone */
	tl.to(logo, {
		opacity: 1,
		duration: LOGO_INTRO_S,
		ease: 'power2.out',
	});

	tl.to({}, { duration: LOGO_HOLD_S });

	/* Phase 2 — title fades in under the logo; no vertical lift (avoids off-center drift) */
	tl.to(title, {
		opacity: 1,
		visibility: 'visible',
		duration: TITLE_FADE_S,
		ease: 'power2.out',
	});

	tl.to({}, { duration: TITLE_HOLD_S });

	/* Phase 3 — scatter letters outward (original exit) */
	tl.to(logo, {
		opacity: 0,
		duration: 0.35,
		ease: 'power2.in',
	});

	tl.to(
		chars,
		{
			x: () => (Math.random() - 0.5) * window.innerWidth * 1.2,
			y: () => (Math.random() - 0.5) * window.innerHeight * 1.2,
			rotation: () => (Math.random() - 0.5) * 360,
			scale: 0,
			opacity: 0,
			duration: 0.8,
			stagger: 0.025,
			ease: 'power2.in',
		},
		'<',
	);

	tl.to(
		overlay,
		{
			opacity: 0,
			duration: 0.45,
			ease: 'power2.inOut',
			onComplete: () => finish(overlay),
		},
		'-=0.15',
	);
}
