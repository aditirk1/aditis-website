/**
 * Home hero: title letters stagger in, tagline rotates every 4s with crossfade.
 * Chevron fades out once the user scrolls (no infinite bounce over content).
 */
import { gsap } from 'gsap';
import { SPLASH_DONE_EVENT } from './splash-intro.ts';

const TAGLINES = ['biomedical engineer', 'researcher', 'writer'] as const;

function isUniverseTheme(): boolean {
	return document.documentElement.getAttribute('data-theme') !== 'beach';
}

function runHeroAnimations(): () => void {
	const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const universe = isUniverseTheme();
	const titleRoot = document.querySelector('[data-hero-title]');
	const taglineEl = document.querySelector('[data-hero-tagline]');
	const chevron = document.querySelector('[data-hero-chevron]') as HTMLElement | null;

	if (!titleRoot) return () => {};
	if (!universe && !taglineEl) return () => {};

	if (reduce) {
		titleRoot.querySelectorAll('.hero-char').forEach((el) => {
			(el as HTMLElement).style.opacity = '1';
		});
		if (chevron) chevron.style.opacity = '0';
		return () => {};
	}

	const chars = titleRoot.querySelectorAll<HTMLElement>('.hero-char');
	if (chars.length) {
		gsap.from(chars, {
			opacity: 0,
			y: 28,
			rotateX: -55,
			duration: 0.55,
			stagger: 0.035,
			ease: 'power3.out',
			transformOrigin: '50% 100%',
		});
	}

	let bounceTween: gsap.core.Tween | null = null;
	if (chevron) {
		gsap.set(chevron, { opacity: 1, visibility: 'visible' });
		bounceTween = gsap.to(chevron, { y: 6, duration: 0.9, repeat: -1, yoyo: true, ease: 'sine.inOut' });

		const heroRoot = document.querySelector('[data-hero-root]') as HTMLElement | null;
		const shouldHideChevron = () => {
			if (!heroRoot) {
				return window.scrollY > window.innerHeight * 0.55;
			}
			const rect = heroRoot.getBoundingClientRect();
			/* Fade once the hero has mostly left the viewport (not on tiny scroll nudges). */
			return rect.bottom < window.innerHeight * 0.38;
		};

		const onScrollChevron = () => {
			if (!shouldHideChevron()) return;
			window.removeEventListener('scroll', onScrollChevron);
			if (bounceTween) {
				bounceTween.kill();
				bounceTween = null;
			}
			gsap.to(chevron, {
				opacity: 0,
				y: 10,
				duration: 0.42,
				ease: 'power2.inOut',
				onComplete: () => {
					chevron.style.visibility = 'hidden';
				},
			});
		};
		window.addEventListener('scroll', onScrollChevron, { passive: true });
		requestAnimationFrame(() => {
			if (shouldHideChevron()) onScrollChevron();
		});
	}

	let interval = 0;
	if (!universe && taglineEl) {
		let idx = 0;
		const runTagline = () => {
			const next = TAGLINES[idx % TAGLINES.length];
			idx++;
			gsap
				.timeline()
				.to(taglineEl, { opacity: 0, y: -8, duration: 0.35, ease: 'power2.in' })
				.add(() => {
					taglineEl.textContent = next;
				})
				.fromTo(taglineEl, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' });
		};

		interval = window.setInterval(runTagline, 4000);
	}

	return () => {
		if (interval) clearInterval(interval);
		bounceTween?.kill();
	};
}

export function initHomeHero(): () => void {
	const splashOverlay = document.getElementById('splash-intro');
	if (!splashOverlay) {
		return runHeroAnimations();
	}

	let cleanup = () => {};
	const onSplashDone = () => {
		window.removeEventListener(SPLASH_DONE_EVENT, onSplashDone);
		cleanup = runHeroAnimations();
	};
	window.addEventListener(SPLASH_DONE_EVENT, onSplashDone);

	return () => {
		window.removeEventListener(SPLASH_DONE_EVENT, onSplashDone);
		cleanup();
	};
}
