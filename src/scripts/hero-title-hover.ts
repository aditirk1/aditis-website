/**
 * Beach homepage: hovering a title letter sends a small wave through its word —
 * the letter lifts and glints aqua, its neighbours follow a beat later, smaller.
 * Mouse only (no hover on touch) and off under reduced motion.
 */
import { gsap } from 'gsap';

/* Lift in em for the hovered letter, then each step away from it. */
const LIFT = [0.16, 0.09, 0.04];
const STEP_DELAY_S = 0.06;

export function initHeroTitleHover(): () => void {
	const title = document.querySelector<HTMLElement>('[data-hero-title]');
	if (
		!title ||
		!window.matchMedia('(hover: hover) and (pointer: fine)').matches ||
		window.matchMedia('(prefers-reduced-motion: reduce)').matches
	) {
		return () => {};
	}

	const letters = Array.from(title.querySelectorAll<HTMLElement>('.hero-char'));
	const isBeach = () => document.documentElement.getAttribute('data-theme') === 'beach';

	const handlers = letters.map((hovered, i) => () => {
		if (!isBeach()) return;
		letters.forEach((el, j) => {
			const d = Math.abs(j - i);
			if (d >= LIFT.length || el.parentElement !== hovered.parentElement) return;
			gsap
				.timeline({ delay: d * STEP_DELAY_S })
				.to(el, { y: `-${LIFT[d]}em`, rotation: (j - i) * 2, duration: 0.25, ease: 'power2.out', overwrite: 'auto' })
				.to(el, { y: 0, rotation: 0, duration: 1, ease: 'elastic.out(1, 0.35)' });
		});
		gsap.fromTo(hovered, { color: '#8ee6ff' }, { color: '#ffffff', duration: 1.1, ease: 'power2.out', clearProps: 'color' });
	});

	letters.forEach((el, i) => el.addEventListener('pointerenter', handlers[i]));

	return () => {
		letters.forEach((el, i) => el.removeEventListener('pointerenter', handlers[i]));
		gsap.killTweensOf(letters);
		gsap.set(letters, { clearProps: 'transform,color' });
	};
}
