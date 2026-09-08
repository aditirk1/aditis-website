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

/**
 * Beach: sit the CTA row on the same line as the title's last word, so the two
 * hero columns read as sharing a rule instead of floating independently.
 *
 * The nudge goes through `top` (with position: relative) rather than a
 * transform: GSAP's reveal writes `transform` on this very node and would
 * clobber anything we put there.
 */
function alignHeroCopyToTitle(copy: HTMLElement): void {
	const words = document.querySelectorAll<HTMLElement>('#sun-text .hero-word');
	const lastWord = words[words.length - 1];
	const cta = copy.querySelector<HTMLElement>('[data-hero-cta]');
	if (!lastWord || !cta) return;

	/* Measure from rest — `top` doesn't move layout, but it does move the rect. */
	copy.style.setProperty('--hero-copy-shift', '0px');
	const line = lastWord.getBoundingClientRect();
	const row = cta.getBoundingClientRect();
	if (line.height < 1 || row.height < 1) return;

	/* Centre-on-centre: a pill button reads as "on the line" of big display text
	 * when their midlines agree, not when their baselines do. */
	let shift = line.top + line.height / 2 - (row.top + row.height / 2);

	/* Stacked layouts put the copy under the title — leave it where it is. */
	if (window.innerWidth < 768) shift = 0;

	const hero = copy.closest<HTMLElement>('.home-hero')?.getBoundingClientRect();
	if (hero) {
		/* Don't drag the block off the top of the hero. */
		const minShift = hero.top + 8 - copy.getBoundingClientRect().top;
		shift = Math.max(shift, minShift);
	}

	copy.style.setProperty('--hero-copy-shift', `${Math.round(shift)}px`);
}

let alignQueued = false;
function queueHeroCopyAlign(): void {
	if (alignQueued) return;
	alignQueued = true;
	requestAnimationFrame(() => {
		alignQueued = false;
		const copy = document.querySelector<HTMLElement>('[data-hero-copy]');
		if (copy && document.documentElement.getAttribute('data-theme') === 'beach') {
			alignHeroCopyToTitle(copy);
		}
	});
}

let alignHooked = false;
function hookHeroCopyAlign(): void {
	if (alignHooked) return;
	alignHooked = true;
	window.addEventListener('resize', queueHeroCopyAlign, { passive: true });
	/* The title is the reference, so re-run once its webfont settles. */
	document.fonts?.ready.then(queueHeroCopyAlign).catch(() => {});
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
		hookHeroCopyAlign();
		queueHeroCopyAlign();
	} else {
		/* Universe: park the node back in the band and hide the whole band. */
		if (copy.parentElement !== introBand) {
			introBand.appendChild(copy);
		}
		copy.style.removeProperty('--hero-copy-shift');
		introBand.toggleAttribute('data-empty', true);
		introBand.hidden = true;
	}

	window.dispatchEvent(
		new CustomEvent(THEME_LAYOUT_EVENT, { detail: { theme } }),
	);
}
