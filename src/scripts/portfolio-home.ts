/**
 * Portfolio homepage: one sideways row of full-screen sections
 * (components/portfolio/PortfolioHome.astro), scrolled continuously.
 *
 * The row is a native horizontal scroller, so touch swipes, focus and
 * find-in-page work as normal. This adds what browsers don't do for a
 * sideways page: wheel and trackpad input in either direction, anywhere on
 * the page, moves it sideways, and the status line follows along.
 */
/* Share of the remaining distance a mouse-wheel glide covers per 60 Hz frame. */
const GLIDE = 0.14;

export function initPortfolioHome(): () => void {
	const root = document.documentElement;
	const scroller = document.querySelector<HTMLElement>('[data-pfh-scroller]');
	if (root.dataset.theme !== 'portfolio' || !scroller) return () => {};

	const panels = Array.from(scroller.querySelectorAll<HTMLElement>('[data-pfh-panel]'));
	const sectionEl = document.querySelector<HTMLElement>('[data-pfh-section]');
	const progressEl = document.querySelector<HTMLElement>('[data-pfh-progress]');
	const hintEl = document.querySelector<HTMLElement>('[data-pfh-hint]');
	const reduce = matchMedia('(prefers-reduced-motion: reduce)');

	/* Fractional position kept here: scrollLeft rounds, which would stall slow glides. */
	let pos = scroller.scrollLeft;
	let target = pos;
	let raf = 0;
	let last = 0;

	const max = () => Math.max(0, scroller.scrollWidth - scroller.clientWidth);
	const clamp = (v: number) => Math.min(max(), Math.max(0, v));
	const starts = () => {
		const base = panels[0]?.offsetLeft ?? 0;
		return panels.map((p) => p.offsetLeft - base);
	};

	function stopGlide() {
		cancelAnimationFrame(raf);
		raf = 0;
	}

	function step(now: number) {
		const dt = last ? Math.min(64, now - last) : 16.7;
		last = now;
		/* Frame-rate independent easing toward the target. */
		pos += (target - pos) * (1 - Math.pow(1 - GLIDE, dt / 16.7));
		if (Math.abs(target - pos) < 0.5) pos = target;
		scroller!.scrollLeft = pos;
		if (pos === target) {
			raf = 0;
			last = 0;
			return;
		}
		raf = requestAnimationFrame(step);
	}

	function glideTo(x: number) {
		target = clamp(x);
		if (reduce.matches) {
			stopGlide();
			pos = target;
			scroller!.scrollLeft = pos;
			return;
		}
		if (!raf) {
			pos = scroller!.scrollLeft;
			last = 0;
			raf = requestAnimationFrame(step);
		}
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
		let d = sideways ? e.deltaX : e.deltaY;
		if (e.deltaMode === 1) d *= 32;
		else if (e.deltaMode === 2) d *= scroller.clientWidth;
		if (!d) return;
		e.preventDefault();
		/*
		 * Trackpads send many small deltas that already carry the OS's momentum:
		 * follow them 1:1. Mouse wheels send coarse notches: glide between them,
		 * adding each notch to wherever the glide is heading.
		 */
		if (sideways || (e.deltaMode === 0 && Math.abs(d) < 50)) {
			stopGlide();
			pos = clamp(scroller.scrollLeft + d);
			target = pos;
			scroller.scrollLeft = pos;
			return;
		}
		glideTo((raf ? target : scroller.scrollLeft) + d);
	};

	const onKey = (e: KeyboardEvent) => {
		if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
		const t = e.target as HTMLElement | null;
		if (t?.closest('input, textarea, select, [contenteditable], [role="menu"], [data-theme-switch]')) return;
		const now = raf ? target : scroller.scrollLeft;
		const s = starts();
		const next = () => s.find((x) => x > now + 4) ?? max();
		const prev = () => [...s].reverse().find((x) => x < now - 4) ?? 0;
		let to: number | null = null;
		switch (e.key) {
			case 'ArrowRight':
			case 'ArrowDown':
			case 'PageDown':
				to = next();
				break;
			case ' ':
				/* Space on a focused link or button should still activate it. */
				if (t?.closest('a, button')) return;
				to = e.shiftKey ? prev() : next();
				break;
			case 'ArrowLeft':
			case 'ArrowUp':
			case 'PageUp':
				to = prev();
				break;
			case 'Home':
				to = 0;
				break;
			case 'End':
				to = max();
				break;
		}
		if (to === null) return;
		e.preventDefault();
		glideTo(to);
	};

	/* In-row links (e.g. "See my work") glide to their section instead of jumping. */
	const onClick = (e: MouseEvent) => {
		const link = (e.target as Element).closest<HTMLAnchorElement>('a[href^="#pfh-"]');
		if (!link) return;
		const panel = document.getElementById(link.hash.slice(1));
		const i = panel ? panels.indexOf(panel) : -1;
		if (i < 0) return;
		e.preventDefault();
		glideTo(starts()[i]!);
		panel!.querySelector<HTMLElement>('a, h2')?.focus({ preventScroll: true });
	};

	let frame = 0;
	function sync() {
		frame = 0;
		const x = scroller!.scrollLeft;
		const m = max();
		if (progressEl) progressEl.style.setProperty('--p', String(m ? x / m : 0));
		if (hintEl) hintEl.toggleAttribute('data-hidden', x > 24);
		const probe = x + scroller!.clientWidth * 0.4;
		let current = panels[0];
		for (const p of panels) if (p.offsetLeft - (panels[0]?.offsetLeft ?? 0) <= probe) current = p;
		if (sectionEl && current?.dataset.pfhLabel) sectionEl.textContent = current.dataset.pfhLabel;
	}

	const onScroll = () => {
		/* Touch swipes, scrollbar drags and focus move the row too: follow them. */
		if (!raf) {
			pos = scroller.scrollLeft;
			target = pos;
		}
		if (!frame) frame = requestAnimationFrame(sync);
	};

	/* Keep the same section in view when the window resizes. */
	let ratio = 0;
	const onResize = () => {
		stopGlide();
		const m = max();
		scroller.scrollLeft = ratio * m;
		pos = target = scroller.scrollLeft;
		onScroll();
	};
	const rememberRatio = () => {
		const m = max();
		ratio = m ? scroller.scrollLeft / m : 0;
	};

	window.addEventListener('wheel', onWheel, { passive: false });
	document.addEventListener('keydown', onKey);
	scroller.addEventListener('click', onClick);
	scroller.addEventListener('scroll', onScroll, { passive: true });
	scroller.addEventListener('scroll', rememberRatio, { passive: true });
	window.addEventListener('resize', onResize, { passive: true });
	sync();

	return () => {
		stopGlide();
		cancelAnimationFrame(frame);
		window.removeEventListener('wheel', onWheel);
		document.removeEventListener('keydown', onKey);
		scroller.removeEventListener('click', onClick);
		scroller.removeEventListener('scroll', onScroll);
		scroller.removeEventListener('scroll', rememberRatio);
		window.removeEventListener('resize', onResize);
	};
}
