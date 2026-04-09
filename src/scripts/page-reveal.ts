/**
 * GSAP + ScrollTrigger motion for list pages. Lenis proxy must be configured first.
 *
 * Pre-hidden state is applied in Layout (html[data-reveal-bootstrap]) so the first paint
 * does not flash full-opacity text before JS runs.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const easeReveal = 'expo.out';
const durShort = 0.62;
const durCard = 0.68;
const stagger = 0.048;

function isRoughlyInView(el: HTMLElement, vh: number): boolean {
	const r = el.getBoundingClientRect();
	return r.top < vh * 0.92 && r.bottom > -vh * 0.15;
}

export function initPageRevealAnimations(): () => void {
	const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (reduce) {
		document.documentElement.removeAttribute('data-reveal-bootstrap');
		return () => {};
	}

	gsap.registerPlugin(ScrollTrigger);

	const triggers: ScrollTrigger[] = [];

	/* Staggered children inside [data-reveal-stagger] */
	document.querySelectorAll<HTMLElement>('[data-reveal-stagger]').forEach((root) => {
		const kids = root.querySelectorAll<HTMLElement>('[data-reveal-child]');
		if (!kids.length) return;

		const run = () => {
			gsap.to(kids, {
				y: 0,
				opacity: 1,
				duration: durShort,
				stagger,
				ease: easeReveal,
				overwrite: 'auto',
			});
		};

		if (isRoughlyInView(root, window.innerHeight)) {
			requestAnimationFrame(run);
			return;
		}

		const st = ScrollTrigger.create({
			trigger: root,
			start: 'top 88%',
			once: true,
			onEnter: run,
		});
		triggers.push(st);
	});

	/* Project cards */
	document.querySelectorAll<HTMLElement>('[data-project-card]').forEach((el) => {
		const run = () => {
			gsap.to(el, {
				y: 0,
				opacity: 1,
				duration: durCard,
				ease: easeReveal,
				overwrite: 'auto',
			});
		};

		if (isRoughlyInView(el, window.innerHeight)) {
			requestAnimationFrame(run);
			return;
		}

		const st = ScrollTrigger.create({
			trigger: el,
			start: 'top 90%',
			once: true,
			onEnter: run,
		});
		triggers.push(st);
	});

	/* Blog list: horizontal reveal */
	document.querySelectorAll<HTMLElement>('[data-blog-wipe]').forEach((shell) => {
		const inner = shell.querySelector<HTMLElement>('[data-blog-wipe-inner]');
		if (!inner) return;

		const run = () => {
			gsap.to(inner, {
				clipPath: 'inset(0 0% 0 0)',
				duration: 0.85,
				ease: 'power3.inOut',
				overwrite: 'auto',
			});
		};

		if (isRoughlyInView(shell, window.innerHeight)) {
			requestAnimationFrame(run);
			return;
		}

		const st = ScrollTrigger.create({
			trigger: shell,
			start: 'top 90%',
			once: true,
			onEnter: run,
		});
		triggers.push(st);
	});

	ScrollTrigger.refresh();

	return () => {
		triggers.forEach((t) => t.kill());
	};
}
