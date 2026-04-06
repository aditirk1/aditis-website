/**
 * Splash: "aditi's universe" text fades in, holds, then each letter scatters
 * outward with random trajectories — overlay fades and is removed.
 * First visit per session only (sessionStorage).
 */
import { gsap } from 'gsap';

const SPLASH_KEY = 'aditi-splash-seen';
export const SPLASH_DONE_EVENT = 'aditi:splash-done';

function finish(overlay: HTMLElement) {
	sessionStorage.setItem(SPLASH_KEY, '1');
	document.documentElement.removeAttribute('data-splash-skip');
	overlay.remove();
	window.dispatchEvent(new CustomEvent(SPLASH_DONE_EVENT));
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

	const title = overlay.querySelector('[data-splash-title]') as HTMLElement | null;
	const chars = overlay.querySelectorAll<HTMLElement>('.splash-char');
	if (!title || !chars.length) {
		finish(overlay);
		return;
	}

	const tl = gsap.timeline();

	/* Phase 1 — fade in the title after a short pause (let fonts render) */
	tl.to(title, {
		opacity: 1,
		duration: 0.6,
		delay: 0.8,
		ease: 'power2.out',
	});

	/* Phase 2 — scatter every letter outward with random trajectories */
	tl.to(chars, {
		x: () => (Math.random() - 0.5) * window.innerWidth * 1.2,
		y: () => (Math.random() - 0.5) * window.innerHeight * 1.2,
		rotation: () => (Math.random() - 0.5) * 360,
		scale: 0,
		opacity: 0,
		duration: 0.8,
		stagger: 0.025,
		ease: 'power2.in',
	}, '+=1.0');

	/* Phase 3 — fade the overlay backdrop and clean up */
	tl.to(overlay, {
		opacity: 0,
		duration: 0.45,
		ease: 'power2.inOut',
		onComplete: () => finish(overlay),
	}, '-=0.15');
}
