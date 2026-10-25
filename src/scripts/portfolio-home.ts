/**
 * Portfolio homepage: the page is one sideways row (components/portfolio/
 * PortfolioHome.astro). The row is a native horizontal scroller, so touch
 * swipes, horizontal trackpad gestures, focus and find-in-page all work as
 * normal. This adds what browsers don't do for a sideways page: wheel and
 * trackpad input in either direction, anywhere on the page, moves it
 * sideways; keys step between panels; the status line follows along.
 */
const EASE = 0.18;

export function initPortfolioHome(): () => void {
	const root = document.documentElement;
	const scroller = document.querySelector<HTMLElement>('[data-pfh-scroller]');
	if (root.dataset.theme !== 'portfolio' || !scroller) return () => {};

	const panels = Array.from(scroller.querySelectorAll<HTMLElement>('[data-pfh-panel]'));
	const sectionEl = document.querySelector<HTMLElement>('[data-pfh-section]');
	const progressEl = document.querySelector<HTMLElement>('[data-pfh-progress]');
	const hintEl = document.querySelector<HTMLElement>('[data-pfh-hint]');
	const reduce = matchMedia('(prefers-reduced-motion: reduce)');

	let target = scroller.scrollLeft;
	let raf = 0;
	let gliding = false;

	const max = () => Math.max(0, scroller.scrollWidth - scroller.clientWidth);
	const clamp = (v: number) => Math.min(max(), Math.max(0, v));

	function step() {
		const cur = scroller!.scrollLeft;
		const next = cur + (target - cur) * EASE;
		if (Math.abs(target - next) < 0.5) {
			scroller!.scrollLeft = target;
			gliding = false;
			raf = 0;
			return;
		}
		scroller!.scrollLeft = next;
		raf = requestAnimationFrame(step);
	}

	function glideTo(x: number) {
		target = clamp(x);
		if (reduce.matches) {
			scroller!.scrollLeft = target;
			return;
		}
		gliding = true;
		if (!raf) raf = requestAnimationFrame(step);
	}

	/* A panel taller than the screen (rare: long text on a short phone) scrolls itself first. */
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
		e.preventDefault();
		/*
		 * Trackpads send many small deltas that already carry the OS's momentum:
		 * follow them 1:1, in either direction, wherever the pointer is. Mouse
		 * wheels send coarse notches: glide between them.
		 */
		if (sideways || (e.deltaMode === 0 && Math.abs(d) < 50)) {
			cancelAnimationFrame(raf);
			raf = 0;
			gliding = false;
			scroller.scrollLeft = clamp(scroller.scrollLeft + d);
			target = scroller.scrollLeft;
			return;
		}
		glideTo((gliding ? target : scroller.scrollLeft) + d);
	};

	function panelStarts(): number[] {
		const base = panels[0]?.offsetLeft ?? 0;
		return panels.map((p) => p.offsetLeft - base);
	}

	const onKey = (e: KeyboardEvent) => {
		if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
		const t = e.target as HTMLElement | null;
		if (t?.closest('input, textarea, select, [contenteditable], [role="menu"], [data-theme-switch]')) return;
		const now = gliding ? target : scroller.scrollLeft;
		const starts = panelStarts();
		let to: number | null = null;
		switch (e.key) {
			case 'ArrowRight':
			case 'ArrowDown':
			case 'PageDown':
				to = starts.find((x) => x > now + 4) ?? max();
				break;
			case ' ':
				to = e.shiftKey ? ([...starts].reverse().find((x) => x < now - 4) ?? 0) : (starts.find((x) => x > now + 4) ?? max());
				break;
			case 'ArrowLeft':
			case 'ArrowUp':
			case 'PageUp':
				to = [...starts].reverse().find((x) => x < now - 4) ?? 0;
				break;
			case 'Home':
				to = 0;
				break;
			case 'End':
				to = max();
				break;
		}
		if (to === null) return;
		/* Space on a focused link or button should still activate it. */
		if (e.key === ' ' && t?.closest('a, button')) return;
		e.preventDefault();
		glideTo(to);
	};

	/* In-row links (e.g. "See my work") glide to their panel instead of jumping. */
	const onClick = (e: MouseEvent) => {
		const link = (e.target as Element).closest<HTMLAnchorElement>('a[href^="#pfh-"]');
		if (!link) return;
		const panel = document.getElementById(link.hash.slice(1));
		if (!panel) return;
		e.preventDefault();
		glideTo(panel.offsetLeft - (panels[0]?.offsetLeft ?? 0));
		panel.querySelector<HTMLElement>('a, h2')?.focus({ preventScroll: true });
	};

	let frame = 0;
	function sync() {
		frame = 0;
		const x = scroller!.scrollLeft;
		const m = max();
		if (progressEl) progressEl.style.setProperty('--p', String(m ? x / m : 0));
		if (hintEl) hintEl.toggleAttribute('data-hidden', x > 24);
		const probe = x + scroller!.clientWidth * 0.3;
		const base = panels[0]?.offsetLeft ?? 0;
		let current = panels[0];
		for (const p of panels) if (p.offsetLeft - base <= probe) current = p;
		if (sectionEl && current?.dataset.pfhLabel) sectionEl.textContent = current.dataset.pfhLabel;
	}

	const onScroll = () => {
		if (!gliding) target = scroller.scrollLeft;
		if (!frame) frame = requestAnimationFrame(sync);
	};

	window.addEventListener('wheel', onWheel, { passive: false });
	document.addEventListener('keydown', onKey);
	scroller.addEventListener('click', onClick);
	scroller.addEventListener('scroll', onScroll, { passive: true });
	window.addEventListener('resize', onScroll, { passive: true });
	sync();

	return () => {
		cancelAnimationFrame(raf);
		cancelAnimationFrame(frame);
		window.removeEventListener('wheel', onWheel);
		document.removeEventListener('keydown', onKey);
		scroller.removeEventListener('click', onClick);
		scroller.removeEventListener('scroll', onScroll);
		window.removeEventListener('resize', onScroll);
	};
}
