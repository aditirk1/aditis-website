/**
 * GSAP + ScrollTrigger motion for list pages. Lenis proxy must be configured first.
 *
 * Pre-hidden state is applied in Layout (html[data-reveal-bootstrap]) so the first paint
 * does not flash full-opacity text before JS runs. GSAP then takes ownership of that
 * hidden state with an explicit set() before the attribute is dropped — clearing the
 * attribute without doing so would leave every element at opacity 1, and the reveal
 * would animate from 1 to 1 and appear not to run at all.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/* Long ease-out with a flat tail: content arrives and settles rather than snapping. */
const easeReveal = 'power3.out';
const durReveal = 0.9;
const stagger = 0.07;
const travelY = 22;

function isRoughlyInView(el: HTMLElement, vh: number): boolean {
	const r = el.getBoundingClientRect();
	return r.top < vh * 0.92 && r.bottom > -vh * 0.15;
}

function clearBootstrap(): void {
	document.documentElement.removeAttribute('data-reveal-bootstrap');
}

export function initPageRevealAnimations(): () => void {
	const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (reduce) {
		clearBootstrap();
		return () => {};
	}

	gsap.registerPlugin(ScrollTrigger);

	const triggers: ScrollTrigger[] = [];
	const roots = document.querySelectorAll<HTMLElement>('[data-reveal-stagger]');

	/* Take over the hidden state from CSS, then the attribute is safe to remove. */
	roots.forEach((root) => {
		const kids = root.querySelectorAll<HTMLElement>('[data-reveal-child]');
		if (!kids.length) return;
		gsap.set(kids, { opacity: 0, y: travelY, willChange: 'transform, opacity' });
	});
	clearBootstrap();

	roots.forEach((root) => {
		const kids = root.querySelectorAll<HTMLElement>('[data-reveal-child]');
		if (!kids.length) return;

		const run = () => {
			gsap.to(kids, {
				y: 0,
				opacity: 1,
				duration: durReveal,
				stagger,
				ease: easeReveal,
				overwrite: 'auto',
				onComplete: () => {
					/* Release the compositor hint once the elements are at rest. */
					gsap.set(kids, { clearProps: 'willChange' });
				},
			});
		};

		if (isRoughlyInView(root, window.innerHeight)) {
			requestAnimationFrame(run);
			return;
		}

		triggers.push(
			ScrollTrigger.create({
				trigger: root,
				start: 'top 88%',
				once: true,
				onEnter: run,
			}),
		);
	});

	ScrollTrigger.refresh();

	return () => {
		triggers.forEach((t) => t.kill());
	};
}
