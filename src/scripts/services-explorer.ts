/**
 * Services explorer — one set of markup, two layouts.
 *
 * Wide screens: the headings stay in the left column and a single detail box sits
 * in the right column, tracking the active heading vertically with a connector line
 * drawn across the gutter. Hover or keyboard focus switches it; one is always open.
 *
 * Narrow screens: the same markup is an accordion — the box opens directly under the
 * heading you tap, and tapping it again closes it.
 *
 * Opening and closing is CSS (grid-template-rows, opacity, transform). This module
 * owns the state and the geometry that CSS can't work out on its own: how far down
 * to float the box, and where to draw the connector.
 */

const WIDE = '(min-width: 60rem)';
/* Long enough for the heading stagger to be most of the way in. */
const FIRST_OPEN_DELAY = 650;

export function initServicesExplorer(): () => void {
	const rootEl = document.querySelector<HTMLElement>('[data-services-explorer]');
	if (!rootEl) return () => {};

	const triggers = Array.from(rootEl.querySelectorAll<HTMLButtonElement>('[data-service-trigger]'));
	const panels = Array.from(rootEl.querySelectorAll<HTMLElement>('[data-service-panel]'));
	if (!triggers.length || triggers.length !== panels.length) return () => {};

	// Bound after the guard so the hoisted helpers below see non-null types.
	const root = rootEl;

	const wide = window.matchMedia(WIDE);
	const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

	/* Tells the CSS that JS is driving: only now do the panels start out hidden. */
	root.setAttribute('data-enhanced', '');

	let active = -1;
	let firstOpen: number | undefined;

	function measure(): void {
		if (!wide.matches) {
			root.style.removeProperty('--stage-min');
			for (const panel of panels) panel.style.removeProperty('--panel-y');
			return;
		}

		const rootTop = root.getBoundingClientRect().top;
		/* The list starts below the hint line; the box should never float above it. */
		const firstTop = triggers[0]!.getBoundingClientRect().top - rootTop;
		const listHeight = triggers[triggers.length - 1]!.getBoundingClientRect().bottom - rootTop;
		const tallest = panels.reduce((max, panel) => Math.max(max, panel.offsetHeight), 0);
		const stageHeight = Math.max(listHeight, firstTop + tallest);

		/* The boxes are out of flow, so the section needs to be told to make room. */
		root.style.setProperty('--stage-min', `${Math.ceil(stageHeight)}px`);

		panels.forEach((panel, i) => {
			const rect = triggers[i]!.getBoundingClientRect();
			const centre = rect.top - rootTop + rect.height / 2;
			const height = panel.offsetHeight;
			/* Centre the box on its heading, then keep it inside the section. */
			const y = Math.min(Math.max(centre - height / 2, firstTop), Math.max(stageHeight - height, firstTop));
			panel.style.setProperty('--panel-y', `${Math.round(y)}px`);
		});

		drawConnector();
	}

	function drawConnector(): void {
		if (!wide.matches || active < 0) {
			root.removeAttribute('data-connected');
			return;
		}
		const rootRect = root.getBoundingClientRect();
		const headRect = triggers[active]!.getBoundingClientRect();
		const x = headRect.right - rootRect.left;
		/*
		 * The box's own rect is mid-slide while it fades in, which would leave the line
		 * overshooting its edge. offsetLeft is the resting position and ignores transforms.
		 */
		const boxLeft = panels[active]!.offsetLeft;
		root.style.setProperty('--connector-x', `${Math.round(x)}px`);
		root.style.setProperty('--connector-y', `${Math.round(headRect.top - rootRect.top + headRect.height / 2)}px`);
		root.style.setProperty('--connector-w', `${Math.max(Math.round(boxLeft - x), 0)}px`);
		root.setAttribute('data-connected', '');
	}

	function setActive(next: number): void {
		active = next;
		triggers.forEach((trigger, i) => {
			const isOpen = i === next;
			trigger.setAttribute('aria-expanded', String(isOpen));
			trigger.parentElement?.toggleAttribute('data-active', isOpen);
			panels[i]!.toggleAttribute('data-open', isOpen);
		});
		/* A newly opened box changes height, so re-measure before drawing to it. */
		if (wide.matches) measure();
		else root.removeAttribute('data-connected');
	}

	function open(i: number): void {
		if (firstOpen !== undefined) {
			window.clearTimeout(firstOpen);
			firstOpen = undefined;
		}
		if (i !== active) setActive(i);
	}

	const cleanups: Array<() => void> = [];

	triggers.forEach((trigger, i) => {
		/* Hover is the wide-screen affordance; click covers touch and narrow screens. */
		const onEnter = () => {
			if (wide.matches) open(i);
		};
		/* Narrow screens toggle on click alone, so focus must not pre-open and
		   turn the tap that follows into an immediate close. */
		const onFocus = () => {
			if (wide.matches) open(i);
		};
		const onClick = () => {
			if (!wide.matches && i === active) {
				setActive(-1);
				return;
			}
			open(i);
		};
		trigger.addEventListener('pointerenter', onEnter);
		trigger.addEventListener('focus', onFocus);
		trigger.addEventListener('click', onClick);
		cleanups.push(() => {
			trigger.removeEventListener('pointerenter', onEnter);
			trigger.removeEventListener('focus', onFocus);
			trigger.removeEventListener('click', onClick);
		});
	});

	const onLayoutChange = () => {
		if (wide.matches && active < 0) setActive(0);
		measure();
	};
	wide.addEventListener('change', onLayoutChange);
	window.addEventListener('resize', measure);
	cleanups.push(() => {
		wide.removeEventListener('change', onLayoutChange);
		window.removeEventListener('resize', measure);
	});

	/* Panels reflow when a webfont lands or an image inside them loads. */
	const observer = new ResizeObserver(() => measure());
	for (const panel of panels) observer.observe(panel);
	observer.observe(root);
	cleanups.push(() => observer.disconnect());

	if (wide.matches) {
		measure();
		if (reduce.matches) setActive(0);
		else firstOpen = window.setTimeout(() => setActive(0), FIRST_OPEN_DELAY);
	}

	return () => {
		if (firstOpen !== undefined) window.clearTimeout(firstOpen);
		for (const fn of cleanups) fn();
		root.removeAttribute('data-enhanced');
		root.removeAttribute('data-connected');
	};
}
