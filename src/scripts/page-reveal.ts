/**
 * Scroll reveal for the homepage's lower sections (Layout only calls this on /).
 *
 * Nothing is hidden before JavaScript runs, and nothing on screen at load is ever
 * hidden: a group is only taken to opacity 0 when it starts below the fold, so the
 * first paint is the finished page and readers who never scroll never wait on it.
 * Groups below the fold fade in once, briefly, as they arrive.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const easeReveal = 'power2.out';
const durReveal = 0.5;
const stagger = 0.05;
const travelY = 10;

function startsBelowFold(el: HTMLElement, vh: number): boolean {
	return el.getBoundingClientRect().top > vh * 0.9;
}

export function initPageRevealAnimations(): () => void {
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};

	gsap.registerPlugin(ScrollTrigger);

	const triggers: ScrollTrigger[] = [];
	const vh = window.innerHeight;
	/* Same condition as the spatial scroll CSS in global.css; that owns these sections. */
	const spatial = CSS.supports('animation-timeline: view()');

	document.querySelectorAll<HTMLElement>('[data-reveal-stagger]').forEach((root) => {
		if (spatial && root.hasAttribute('data-spatial-section')) return;
		const kids = root.querySelectorAll<HTMLElement>('[data-reveal-child]');
		if (!kids.length || !startsBelowFold(root, vh)) return;

		gsap.set(kids, { opacity: 0, y: travelY });
		triggers.push(
			ScrollTrigger.create({
				trigger: root,
				start: 'top 88%',
				once: true,
				onEnter: () => {
					gsap.to(kids, {
						opacity: 1,
						y: 0,
						duration: durReveal,
						stagger,
						ease: easeReveal,
						overwrite: 'auto',
						clearProps: 'transform',
					});
				},
			}),
		);
	});

	ScrollTrigger.refresh();

	return () => {
		triggers.forEach((t) => t.kill());
	};
}
