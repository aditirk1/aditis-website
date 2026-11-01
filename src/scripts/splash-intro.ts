/**
 * Splash: logo fades in → hold → logo rises + title → hold → scatter → reveal.
 * First visit per session only (sessionStorage).
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

/* GSAP's default: after a stall over 500ms, pretend only 33ms passed. */
const DEFAULT_LAG_THRESHOLD = 500;
const DEFAULT_LAG_FRAME = 33;

function finish(overlay: HTMLElement) {
	gsap.ticker.lagSmoothing(DEFAULT_LAG_THRESHOLD, DEFAULT_LAG_FRAME);
	sessionStorage.setItem(SPLASH_KEY, '1');
	document.documentElement.removeAttribute('data-splash-skip');
	overlay.remove();
	window.dispatchEvent(new CustomEvent(SPLASH_DONE_EVENT));
	document.dispatchEvent(new CustomEvent('splash:done'));
}

function setSplashLogoSrc(logo: HTMLImageElement) {
	const theme = document.documentElement.getAttribute('data-theme') === 'beach' ? 'beach' : 'universe';
	logo.src = theme === 'beach' ? '/brand/logo-flow-512.png' : '/brand/logo-universe-512.png';
}

export function initSplashIntro(): void {
	const overlay = document.getElementById('splash-intro');
	if (!overlay) {
		window.dispatchEvent(new CustomEvent(SPLASH_DONE_EVENT));
		return;
	}

	/* The loading screen belongs to the playful themes; Portfolio opens straight onto the page. */
	if (document.documentElement.getAttribute('data-theme') === 'portfolio') {
		overlay.remove();
		window.dispatchEvent(new CustomEvent(SPLASH_DONE_EVENT));
		document.dispatchEvent(new CustomEvent('splash:done'));
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

	const isPhone = !window.matchMedia('(min-width: 768px)').matches;
	const logoLift = isPhone ? -40 : -88;

	/*
	 * Phones are busy building the star field and video while this plays. Any
	 * frame slower than ~80ms is treated as one 16ms step, so the letters slow
	 * down for a moment instead of jumping straight to the end of the scatter.
	 */
	gsap.ticker.lagSmoothing(80, 16);

	gsap.set(logoWrap, { y: 0 });
	gsap.set(logo, { opacity: 0 });
	gsap.set(title, { autoAlpha: 0 });
	gsap.set(chars, { opacity: 1, x: 0, y: 0, rotation: 0, scale: 1 });

	const tl = gsap.timeline();

	/* Phase 1 — logo fades in, then holds alone */
	tl.to(logo, {
		opacity: 1,
		duration: LOGO_INTRO_S,
		ease: 'power2.out',
	});

	tl.to({}, { duration: LOGO_HOLD_S });

	/* Phase 2 — logo rises; title fades in */
	tl.to(logoWrap, {
		y: logoLift,
		duration: 0.85,
		ease: 'power2.inOut',
	});

	tl.to(
		title,
		{
			autoAlpha: 1,
			duration: TITLE_FADE_S,
			ease: 'power2.out',
		},
		'<0.1',
	);

	tl.to({}, { duration: TITLE_HOLD_S });

	/* Phase 3 — scatter letters outward (original exit) */
	tl.to(logo, {
		opacity: 0,
		duration: 0.35,
		ease: 'power2.in',
	});

	if (isPhone) {
		/*
		 * A narrow screen gives the desktop scatter only a few hundred px to travel,
		 * and shrinking to nothing hides what little movement there is. Burst each
		 * letter out radially past the screen edge, tumbling, staying readable
		 * until it leaves.
		 */
		const reach = Math.hypot(window.innerWidth, window.innerHeight) * 0.75;
		const scatterAt = tl.duration() - 0.35; // with the logo fade, as on desktop
		const order = Array.from(chars, (_, i) => i).sort(() => Math.random() - 0.5);
		order.forEach((charIndex, slot) => {
			const ch = chars[charIndex]!;
			const angle = Math.random() * Math.PI * 2;
			const dist = reach * (0.7 + Math.random() * 0.5);
			const at = scatterAt + slot * 0.035;
			tl.to(
				ch,
				{
					x: Math.cos(angle) * dist,
					y: Math.sin(angle) * dist,
					rotation: (Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 360),
					scale: 1.4 + Math.random() * 0.8,
					duration: 1.05,
					ease: 'power3.in',
				},
				at,
			);
			tl.to(ch, { opacity: 0, duration: 0.3, ease: 'power1.in' }, at + 0.75);
		});
	} else {
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
	}

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
