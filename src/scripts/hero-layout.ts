/**
 * The homepage copy block (tagline, description, CTAs) is a single DOM node.
 * Universe: hidden entirely (hero is title + planets only).
 * Beach: shown in the hero's right column.
 *
 * Theme toggle relocates the node at runtime — one copy for a11y/crawlers.
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

export function syncHeroLayout(theme: HeroTheme): void {
	const copy = document.querySelector<HTMLElement>('[data-hero-copy]');
	const sideSlot = document.querySelector<HTMLElement>('[data-hero-side-slot]');
	const introBand = document.querySelector<HTMLElement>('[data-hero-intro-home]');
	if (!copy || !sideSlot || !introBand) return;

	if (theme === 'beach') {
		if (copy.parentElement !== sideSlot) {
			sideSlot.appendChild(copy);
		}
		introBand.toggleAttribute('data-empty', true);
		introBand.hidden = true;
		revealHeroCopy(copy);
	} else {
		/* Universe: park the node back in the band and hide the whole band. */
		if (copy.parentElement !== introBand) {
			introBand.appendChild(copy);
		}
		introBand.toggleAttribute('data-empty', true);
		introBand.hidden = true;
	}

	window.dispatchEvent(
		new CustomEvent(THEME_LAYOUT_EVENT, { detail: { theme } }),
	);
}
