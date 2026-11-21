/**
 * Home hero helpers. Title uses the motion-lab "stereo lock" one-shot after splash.
 * The scroll cue fades out once the user scrolls. Beach tagline crossfades in place.
 */
import { gsap } from 'gsap';
import { SPLASH_DONE_EVENT, SPLASH_KEY } from './splash-intro.ts';
import { subscribeScroll } from './scroll-orchestrator.ts';

function markHeroReady(): void {
	document.documentElement.setAttribute('data-hero-ready', '1');
}

function playStereoEntrance(): void {
	const title = document.querySelector<HTMLElement>('[data-hero-entrance="stereo"]');
	if (!title) return;

	const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (reduce) {
		title.classList.remove('is-playing');
		title.classList.add('is-ready');
		return;
	}

	const finish = () => {
		title.classList.add('is-ready');
		title.removeEventListener('animationend', onEnd);
	};
	const onEnd = (e: AnimationEvent) => {
		/* Solid layer is the last to resolve — lock the resting state. */
		if ((e.target as Element | null)?.classList?.contains('hero-stereo-solid')) finish();
	};

	title.classList.remove('is-ready', 'is-playing');
	void title.offsetWidth;
	title.addEventListener('animationend', onEnd);
	title.classList.add('is-playing');
	window.setTimeout(finish, 1200);
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
	playStereoEntrance();

	const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const taglineEl = document.querySelector<HTMLElement>('[data-hero-tagline]');
	const chevron = document.querySelector('[data-hero-chevron]') as HTMLElement | null;

	let unsubscribeChevron = () => {};

	if (chevron) {
		if (reduce) {
			chevron.style.opacity = '0';
		} else {
			gsap.set(chevron, { opacity: 1, visibility: 'visible' });

			let hidden = false;
			unsubscribeChevron = subscribeScroll(({ heroBottom, viewportHeight }) => {
				if (hidden || heroBottom >= viewportHeight * 0.38) return;
				hidden = true;
				unsubscribeChevron();
				gsap.to(chevron, {
					opacity: 0,
					duration: 0.3,
					ease: 'power1.out',
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
				.to(taglineEl, { opacity: 0, duration: 0.3, ease: 'power1.in' })
				.add(() => {
					taglineEl.textContent = next;
				})
				.to(taglineEl, { opacity: 1, duration: 0.35, ease: 'power1.out' });
		};
		interval = window.setInterval(runTagline, 5000);
	} else if (taglineEl && items.length === 1) {
		taglineEl.textContent = items[0]!;
	}

	return () => {
		if (interval) clearInterval(interval);
		unsubscribeChevron();
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
