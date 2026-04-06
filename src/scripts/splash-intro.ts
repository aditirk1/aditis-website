/**
 * Splash: shooting-star streak (first visit / session), then overlay removed.
 * If already seen: no visible flash — html[data-splash-skip] hides CSS; we remove node + fire event.
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

	gsap.fromTo(
		overlay,
		{ opacity: 1 },
		{
			opacity: 0,
			duration: 0.5,
			delay: 1.45,
			ease: 'power2.inOut',
			onComplete: () => finish(overlay),
		},
	);
}
