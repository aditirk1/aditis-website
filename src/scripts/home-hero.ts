/**
 * Home hero helpers (no title letter animation — it flashed static then replayed).
 * Chevron fades out once the user scrolls. Beach tagline carousel still runs.
 */
import { gsap } from 'gsap';
import { SPLASH_DONE_EVENT, SPLASH_KEY } from './splash-intro.ts';
import { subscribeScroll } from './scroll-orchestrator.ts';

function markHeroReady(): void {
	document.documentElement.setAttribute('data-hero-ready', '1');
}

function splashAlreadyFinished(): boolean {
	if (document.documentElement.getAttribute('data-splash-skip') === '1') return true;
	try {
		if (sessionStorage.getItem(SPLASH_KEY) === '1') return true;
	} catch {
		/* ignore */
	}
	return !document.getElementById('splash-intro');
}

function readTaglineItems(el: Element): string[] {
	const raw = el.getAttribute('data-tagline-items');
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed.map((item) => String(item).trim()).filter(Boolean);
	} catch {
		return [];
	}
}

function runHeroExtras(): () => void {
	markHeroReady();

	const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const taglineEl = document.querySelector<HTMLElement>('[data-hero-tagline]');
	const chevron = document.querySelector('[data-hero-chevron]') as HTMLElement | null;

	let bounceTween: gsap.core.Tween | null = null;
	let unsubscribeChevron = () => {};

	if (chevron) {
		if (reduce) {
			chevron.style.opacity = '0';
		} else {
			gsap.set(chevron, { opacity: 1, visibility: 'visible' });
			bounceTween = gsap.to(chevron, { y: 6, duration: 1.4, repeat: -1, yoyo: true, ease: 'sine.inOut' });

			let hidden = false;
			unsubscribeChevron = subscribeScroll(({ heroBottom, viewportHeight }) => {
				if (hidden || heroBottom >= viewportHeight * 0.38) return;
				hidden = true;
				unsubscribeChevron();
				if (bounceTween) {
					bounceTween.kill();
					bounceTween = null;
				}
				gsap.to(chevron, {
					opacity: 0,
					y: 10,
					duration: 0.5,
					ease: 'power2.out',
					onComplete: () => {
						chevron.style.visibility = 'hidden';
					},
				});
			});
		}
	}

	let interval = 0;
	const items = taglineEl ? readTaglineItems(taglineEl) : [];
	if (!reduce && taglineEl && items.length > 1) {
		let idx = 0;
		taglineEl.textContent = items[0]!;
		const runTagline = () => {
			idx = (idx + 1) % items.length;
			const next = items[idx]!;
			gsap
				.timeline()
				.to(taglineEl, { opacity: 0, y: -8, duration: 0.35, ease: 'power2.in' })
				.add(() => {
					taglineEl.textContent = next;
				})
				.fromTo(taglineEl, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' });
		};
		interval = window.setInterval(runTagline, 4000);
	} else if (taglineEl && items.length === 1) {
		taglineEl.textContent = items[0]!;
	}

	return () => {
		if (interval) clearInterval(interval);
		unsubscribeChevron();
		bounceTween?.kill();
	};
}

export function initHomeHero(): () => void {
	if (splashAlreadyFinished()) {
		const leftover = document.getElementById('splash-intro');
		if (leftover) leftover.remove();
		document.documentElement.removeAttribute('data-splash-skip');
		return runHeroExtras();
	}

	let cleanup = () => {};
	const onSplashDone = () => {
		window.removeEventListener(SPLASH_DONE_EVENT, onSplashDone);
		cleanup = runHeroExtras();
	};
	window.addEventListener(SPLASH_DONE_EVENT, onSplashDone);

	return () => {
		window.removeEventListener(SPLASH_DONE_EVENT, onSplashDone);
		cleanup();
	};
}
