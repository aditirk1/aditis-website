/**
 * Page-leaving side of the transition experiments. Only does anything when
 * the head script in ViewTransitionExperiment.astro set `html[data-vt]`.
 */
import { recordTransitionOrigin, transitionsEnabled } from './vt-origin.ts';

/** Longer than any transition, shorter than a visitor would wait before retrying. */
const NAVIGATION_LATCH_MS = 2500;

let latchedUntil = 0;

function clearSharedNames() {
	document
		.querySelectorAll<HTMLElement>('.project-index-link__label')
		.forEach((el) => (el.style.viewTransitionName = ''));
}

function onClick(e: MouseEvent) {
	if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
	const link = (e.target as Element | null)?.closest?.<HTMLAnchorElement>('a[href]');
	if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) return;

	const url = new URL(link.href, location.href);
	if (url.origin !== location.origin) return;
	if (url.pathname === location.pathname && url.search === location.search) return;

	/* A second click while the first navigation is in flight would restart it mid-transition. */
	const now = performance.now();
	if (now < latchedUntil) {
		e.preventDefault();
		return;
	}
	latchedUntil = now + NAVIGATION_LATCH_MS;

	const rect = link.getBoundingClientRect();
	const label = link.querySelector<HTMLElement>('.project-index-link__label');
	const mode = document.documentElement.dataset.vt;
	const kind = link.classList.contains('nav-tab') ? 'tab' : label ? 'project' : 'link';

	if (kind === 'project' && label && (mode === 'morph' || mode === 'themed')) {
		label.style.viewTransitionName = 'project-title';
	}

	recordTransitionOrigin({
		kind,
		x: rect.left + rect.width / 2,
		y: rect.top + rect.height / 2,
		r: Math.min(rect.width, rect.height) / 2,
	});
}

export function initTransitionExperiment(): void {
	if (!transitionsEnabled()) return;
	document.addEventListener('click', onClick);
	/* Returning from the back/forward cache: the old navigation is over. */
	window.addEventListener('pageshow', (e) => {
		if (!e.persisted) return;
		latchedUntil = 0;
		clearSharedNames();
	});
}
