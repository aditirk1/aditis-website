/**
 * Home hero: title letters stagger in, tagline rotates every 4s with crossfade.
 * Waits for the splash intro to finish (if present) before animating.
 */
import { gsap } from 'gsap';

const TAGLINES = [
	'biomedical engineer',
	'researcher',
	'writer',
	'builder',
	'dreamer',
] as const;

function runHeroAnimations(): () => void {
	const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const titleRoot = document.querySelector('[data-hero-title]');
	const taglineEl = document.querySelector('[data-hero-tagline]');
	const chevron = document.querySelector('[data-hero-chevron]');

	if (!titleRoot || !taglineEl) return () => {};

	if (reduce) {
		titleRoot.querySelectorAll('.hero-char').forEach((el) => {
			(el as HTMLElement).style.opacity = '1';
		});
		return () => {};
	}

	const chars = titleRoot.querySelectorAll<HTMLElement>('.hero-char');
	gsap.from(chars, {
		opacity: 0,
		y: 28,
		rotateX: -55,
		duration: 0.55,
		stagger: 0.035,
		ease: 'power3.out',
		transformOrigin: '50% 100%',
	});

	if (chevron) {
		gsap.to(chevron, { y: 6, duration: 0.9, repeat: -1, yoyo: true, ease: 'sine.inOut' });
	}

	let idx = 0;
	const runTagline = () => {
		const next = TAGLINES[idx % TAGLINES.length];
		idx++;
		gsap.timeline().to(taglineEl, { opacity: 0, y: -8, duration: 0.35, ease: 'power2.in' }).add(() => {
			taglineEl.textContent = next;
		}).fromTo(taglineEl, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' });
	};

	const interval = window.setInterval(runTagline, 4000);

	return () => {
		clearInterval(interval);
	};
}

export function initHomeHero(): () => void {
	const splashOverlay = document.getElementById('splash-intro');
	if (!splashOverlay) {
		return runHeroAnimations();
	}

	let cleanup = () => {};
	const onSplashDone = () => {
		window.removeEventListener('aditi:splash-done', onSplashDone);
		cleanup = runHeroAnimations();
	};
	window.addEventListener('aditi:splash-done', onSplashDone);

	return () => {
		window.removeEventListener('aditi:splash-done', onSplashDone);
		cleanup();
	};
}
