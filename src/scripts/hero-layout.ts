/**
 * The homepage copy block (tagline, description, CTAs) sits under the title.
 * Universe hides it in CSS (hero is title + planets only); Beach shows it.
 *
 * On switching to Beach, GSAP reveal state is forced visible so the copy never
 * stays stuck at opacity 0 from a reveal pass that ran while it was hidden.
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
	if (!copy) return;
	if (theme === 'beach') revealHeroCopy(copy);

	window.dispatchEvent(
		new CustomEvent(THEME_LAYOUT_EVENT, { detail: { theme } }),
	);
}
