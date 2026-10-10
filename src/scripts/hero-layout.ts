/**
 * The homepage copy block (tagline, description, CTAs) is a single DOM node.
 * Universe: hidden entirely (hero is title + planets only).
 * Beach: shown in the band below the hero; the title spans the hero's full width.
 *
 * After a move, GSAP reveal state is forced visible so Beach copy never stays
 * stuck at opacity 0 from a prior ScrollTrigger pass.
 */
import { gsap } from 'gsap';

export type HeroTheme = 'universe' | 'beach';

export const THEME_LAYOUT_EVENT = 'aditi:theme-layout';

function revealHeroCopy(copy: HTMLElement): void {
	const kids = copy.querySelectorAll<HTMLElement>('[data-reveal-child]');
	if (kids.length) {
		gsap.set(kids, { opacity: 1, y: 0, clearProps: 'willChange' });
	}
	gsap.set(copy, { opacity: 1, y: 0, clearProps: 'willChange' });
}

let currentTheme: HeroTheme = 'universe';

/*
 * Beach: scale the title so its widest line exactly fills the hero width.
 * Measured rather than a fixed vw size, so it holds for any font or fallback.
 */
function fitHeroTitle(): void {
	const title = document.querySelector<HTMLElement>('[data-hero-title]');
	const box = title?.parentElement;
	if (!title || !box) return;
	title.style.removeProperty('--hero-fit-size');
	if (currentTheme !== 'beach') return;

	const contentWidth = title.getBoundingClientRect().width;
	if (contentWidth === 0) return;
	const size = (parseFloat(getComputedStyle(title).fontSize) * box.clientWidth) / contentWidth;
	title.style.setProperty('--hero-fit-size', `${size.toFixed(2)}px`);
}

let fitFrame = 0;
function scheduleFit(): void {
	cancelAnimationFrame(fitFrame);
	fitFrame = requestAnimationFrame(fitHeroTitle);
}

let fitHooked = false;
function hookFit(): void {
	if (fitHooked) return;
	fitHooked = true;
	window.addEventListener('resize', scheduleFit);
	/* Title metrics change once the display face swaps in. */
	document.fonts?.ready.then(scheduleFit).catch(() => {});
}

export function syncHeroLayout(theme: HeroTheme): void {
	const copy = document.querySelector<HTMLElement>('[data-hero-copy]');
	const introBand = document.querySelector<HTMLElement>('[data-hero-intro-home]');
	if (!copy || !introBand) return;

	currentTheme = theme;
	if (copy.parentElement !== introBand) introBand.appendChild(copy);
	const beach = theme === 'beach';
	introBand.toggleAttribute('data-empty', !beach);
	introBand.hidden = !beach;
	if (beach) revealHeroCopy(copy);

	hookFit();
	fitHeroTitle();

	window.dispatchEvent(
		new CustomEvent(THEME_LAYOUT_EVENT, { detail: { theme } }),
	);
}
