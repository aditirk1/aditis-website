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
 * Beach sits the copy beside the title, both vertically centred in their own
 * grid column. The copy is the taller block, so centring alone leaves the CTAs
 * hanging below the title's last line. Lift it so the buttons finish level with
 * the baseline of "universe."
 *
 * Measured rather than hard-coded: the title is fluid (clamp + cqi) and the
 * copy rewraps, so the gap between the two blocks changes with viewport width.
 */
const SIDE_BY_SIDE = '(min-width: 768px)';

/**
 * Y of the title's last baseline. An empty inline-block with clipped overflow
 * takes its bottom margin edge as its baseline, so a zero-height one lands
 * exactly on the text baseline — the h1's own box bottom sits a descender lower.
 */
function titleBaselineY(title: HTMLElement): number {
	const lastLine = title.querySelector<HTMLElement>('.hero-word:last-of-type');
	if (!lastLine) return title.getBoundingClientRect().bottom;
	const probe = document.createElement('span');
	probe.style.cssText =
		'display:inline-block;width:0;height:0;overflow:hidden;vertical-align:baseline';
	lastLine.appendChild(probe);
	const y = probe.getBoundingClientRect().bottom;
	probe.remove();
	return y;
}

function alignHeroCopyToTitle(): void {
	const copy = document.querySelector<HTMLElement>('[data-hero-copy]');
	if (!copy) return;

	/* Clear first: the old offset would otherwise skew the new measurement. */
	copy.style.removeProperty('translate');

	const title = document.querySelector<HTMLElement>('[data-hero-title]');
	if (!title || !copy.closest('.home-hero-side-col')) return;
	/* Stacked layout — the title is above the copy, nothing to line up with. */
	if (!window.matchMedia(SIDE_BY_SIDE).matches) return;

	/*
	 * offsetTop/offsetHeight, not getBoundingClientRect: the reveal tween drives
	 * `transform` on this same node, so a rect read mid-animation reports the
	 * copy wherever the tween has it and bakes that offset into the result.
	 * Layout offsets ignore transforms, so the answer no longer depends on when
	 * this runs.
	 */
	const anchor = copy.offsetParent as HTMLElement | null;
	const anchorTop = anchor ? anchor.getBoundingClientRect().top : 0;
	const copyBottom = anchorTop + copy.offsetTop + copy.offsetHeight;

	/* Only ever lift. If the copy is the shorter block, centred already reads fine. */
	const drop = copyBottom - titleBaselineY(title);
	if (drop > 1) copy.style.translate = `0 ${-Math.round(drop)}px`;
}

let alignFrame = 0;
function scheduleHeroCopyAlign(): void {
	cancelAnimationFrame(alignFrame);
	alignFrame = requestAnimationFrame(alignHeroCopyToTitle);
}

let alignHooked = false;
function hookHeroCopyAlign(): void {
	if (alignHooked) return;
	alignHooked = true;
	/* Viewport height shifts where the centred blocks sit, without resizing them. */
	window.addEventListener('resize', scheduleHeroCopyAlign);
	/* Title metrics move once the display face swaps in. */
	document.fonts?.ready.then(scheduleHeroCopyAlign).catch(() => {});

	/*
	 * Either block can change height on its own — the tagline carousel swaps in
	 * lines of different lengths, and the fluid title reflows. Offsetting with
	 * `translate` leaves both sizes untouched, so this can't feed back.
	 */
	if (typeof ResizeObserver === 'undefined') return;
	const observer = new ResizeObserver(scheduleHeroCopyAlign);
	for (const sel of ['[data-hero-copy]', '[data-hero-title]']) {
		const el = document.querySelector(sel);
		if (el) observer.observe(el);
	}
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
		scheduleHeroCopyAlign();
	} else {
		/* Universe: park the node back in the band and hide the whole band. */
		if (copy.parentElement !== introBand) {
			introBand.appendChild(copy);
		}
		copy.style.removeProperty('translate');
		introBand.toggleAttribute('data-empty', true);
		introBand.hidden = true;
	}

	window.dispatchEvent(
		new CustomEvent(THEME_LAYOUT_EVENT, { detail: { theme } }),
	);
}
