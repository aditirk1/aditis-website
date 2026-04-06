/**
 * Global GSAP + ScrollTrigger motion for list pages (staggered sections, project cards,
 * blog horizontal wipes). Safe to call once per full page load (Astro MPA).
 *
 * Lenis + ScrollTrigger proxy must already be configured in Layout.astro before this runs.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function initPageRevealAnimations(): () => void {
	const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (reduce) return () => {};

	gsap.registerPlugin(ScrollTrigger);

	const triggers: ScrollTrigger[] = [];

	/* Generic staggered children inside a section */
	document.querySelectorAll<HTMLElement>('[data-reveal-stagger]').forEach((root) => {
		const kids = root.querySelectorAll<HTMLElement>('[data-reveal-child]');
		if (!kids.length) return;
		const st = ScrollTrigger.create({
			trigger: root,
			start: 'top 88%',
			once: true,
			onEnter: () => {
				gsap.from(kids, {
					y: 40,
					opacity: 0,
					duration: 0.55,
					stagger: 0.07,
					ease: 'power3.out',
				});
			},
		});
		triggers.push(st);
	});

	/* Project cards: rise from below */
	document.querySelectorAll<HTMLElement>('[data-project-card]').forEach((el) => {
		const st = ScrollTrigger.create({
			trigger: el,
			start: 'top 92%',
			once: true,
			onEnter: () => {
				gsap.from(el, { y: 52, opacity: 0, duration: 0.62, ease: 'power3.out' });
			},
		});
		triggers.push(st);
	});

	/* Blog list: horizontal wipe */
	document.querySelectorAll<HTMLElement>('[data-blog-wipe]').forEach((shell) => {
		const inner = shell.querySelector<HTMLElement>('[data-blog-wipe-inner]');
		if (!inner) return;
		gsap.set(inner, { clipPath: 'inset(0 100% 0 0)' });
		const st = ScrollTrigger.create({
			trigger: shell,
			start: 'top 90%',
			once: true,
			onEnter: () => {
				gsap.to(inner, {
					clipPath: 'inset(0 0% 0 0)',
					duration: 0.9,
					ease: 'power2.inOut',
				});
			},
		});
		triggers.push(st);
	});

	ScrollTrigger.refresh();

	return () => {
		triggers.forEach((t) => t.kill());
	};
}
