/**
 * Portfolio homepage: one sideways row of full-screen sections
 * (components/portfolio/PortfolioHome.astro), one section per gesture.
 *
 * The row is a native horizontal scroller with mandatory snapping, so touch
 * swipes, focus and find-in-page work as normal and always settle on a
 * section. This adds what browsers don't do for a sideways page: a wheel or
 * trackpad gesture in either direction, anywhere on the page, moves exactly
 * one section; keys step between sections; the status line follows along.
 */
/* Wheel events stop arriving this long after a gesture (and its momentum) ends. */
const GESTURE_GAP_MS = 220;
/* A new swipe during the previous one's momentum arrives as a jump in speed. */
const FRESH_SURGE = 2.5;
const SETTLE_MS = 450;

export function initPortfolioHome(): () => void {
	const root = document.documentElement;
	const scroller = document.querySelector<HTMLElement>('[data-pfh-scroller]');
	if (root.dataset.theme !== 'portfolio' || !scroller) return () => {};

	const panels = Array.from(scroller.querySelectorAll<HTMLElement>('[data-pfh-panel]'));
	const sectionEl = document.querySelector<HTMLElement>('[data-pfh-section]');
	const progressEl = document.querySelector<HTMLElement>('[data-pfh-progress]');
	const hintEl = document.querySelector<HTMLElement>('[data-pfh-hint]');
	const reduce = matchMedia('(prefers-reduced-motion: reduce)');

	let current = 0;
	let inGesture = false;
	let lastAbs = 0;
	let settleAt = 0;
	let quietTimer = 0;

	const starts = () => {
		const base = panels[0]?.offsetLeft ?? 0;
		return panels.map((p) => p.offsetLeft - base);
	};
	const nearest = () => {
		const x = scroller.scrollLeft;
		let best = 0;
		starts().forEach((s, i, all) => {
			if (Math.abs(s - x) < Math.abs(all[best]! - x)) best = i;
		});
		return best;
	};

	function goTo(i: number) {
		current = Math.max(0, Math.min(panels.length - 1, i));
		scroller!.scrollTo({ left: starts()[current], behavior: reduce.matches ? 'auto' : 'smooth' });
	}

	/* A section taller than the screen (long text on a short phone) scrolls itself first. */
	function innerCanScroll(e: WheelEvent): boolean {
		const panel = (e.target as Element | null)?.closest<HTMLElement>('[data-pfh-panel]');
		if (!panel || panel.scrollHeight <= panel.clientHeight + 1) return false;
		if (e.deltaY > 0) return panel.scrollTop + panel.clientHeight < panel.scrollHeight - 1;
		return panel.scrollTop > 0;
	}

	const onWheel = (e: WheelEvent) => {
		if (e.ctrlKey || e.defaultPrevented) return;
		const sideways = Math.abs(e.deltaX) > Math.abs(e.deltaY);
		if (!sideways && innerCanScroll(e)) return;
		const d = sideways ? e.deltaX : e.deltaY;
		e.preventDefault();

		window.clearTimeout(quietTimer);
		quietTimer = window.setTimeout(() => {
			inGesture = false;
			lastAbs = 0;
		}, GESTURE_GAP_MS);

		const abs = Math.abs(d);
		const fresh = !inGesture || (abs > lastAbs * FRESH_SURGE && abs > 30 && performance.now() > settleAt);
		lastAbs = abs;
		if (!fresh || abs < 2) return;

		inGesture = true;
		settleAt = performance.now() + SETTLE_MS;
		goTo(current + (d > 0 ? 1 : -1));
	};

	const onKey = (e: KeyboardEvent) => {
		if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
		const t = e.target as HTMLElement | null;
		if (t?.closest('input, textarea, select, [contenteditable], [role="menu"], [data-theme-switch]')) return;
		let to: number | null = null;
		switch (e.key) {
			case 'ArrowRight':
			case 'ArrowDown':
			case 'PageDown':
				to = current + 1;
				break;
			case ' ':
				/* Space on a focused link or button should still activate it. */
				if (t?.closest('a, button')) return;
				to = current + (e.shiftKey ? -1 : 1);
				break;
			case 'ArrowLeft':
			case 'ArrowUp':
			case 'PageUp':
				to = current - 1;
				break;
			case 'Home':
				to = 0;
				break;
			case 'End':
				to = panels.length - 1;
				break;
		}
		if (to === null) return;
		e.preventDefault();
		goTo(to);
	};

	/* In-row links (e.g. "See my work") move to their section instead of jumping. */
	const onClick = (e: MouseEvent) => {
		const link = (e.target as Element).closest<HTMLAnchorElement>('a[href^="#pfh-"]');
		if (!link) return;
		const panel = document.getElementById(link.hash.slice(1));
		const i = panel ? panels.indexOf(panel) : -1;
		if (i < 0) return;
		e.preventDefault();
		goTo(i);
		panel!.querySelector<HTMLElement>('a, h2')?.focus({ preventScroll: true });
	};

	let frame = 0;
	function sync() {
		frame = 0;
		const x = scroller!.scrollLeft;
		const max = Math.max(0, scroller!.scrollWidth - scroller!.clientWidth);
		if (progressEl) progressEl.style.setProperty('--p', String(max ? x / max : 0));
		if (hintEl) hintEl.toggleAttribute('data-hidden', x > 24);
		const label = panels[nearest()]?.dataset.pfhLabel;
		if (sectionEl && label) sectionEl.textContent = label;
	}

	const onScroll = () => {
		if (!frame) frame = requestAnimationFrame(sync);
	};
	/* Touch swipes and keyboard focus move the row too; follow where it settled. */
	const onSettled = () => {
		if (!inGesture) current = nearest();
	};
	const onResize = () => {
		scroller.scrollTo({ left: starts()[current], behavior: 'auto' });
		onScroll();
	};

	window.addEventListener('wheel', onWheel, { passive: false });
	document.addEventListener('keydown', onKey);
	scroller.addEventListener('click', onClick);
	scroller.addEventListener('scroll', onScroll, { passive: true });
	scroller.addEventListener('scrollend', onSettled);
	window.addEventListener('resize', onResize, { passive: true });
	sync();

	return () => {
		cancelAnimationFrame(frame);
		window.clearTimeout(quietTimer);
		window.removeEventListener('wheel', onWheel);
		document.removeEventListener('keydown', onKey);
		scroller.removeEventListener('click', onClick);
		scroller.removeEventListener('scroll', onScroll);
		scroller.removeEventListener('scrollend', onSettled);
		window.removeEventListener('resize', onResize);
	};
}
