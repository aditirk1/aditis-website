/**
 * Desktop tab underline + active states (runs once per full page load).
 */
import { gsap } from 'gsap';

function bestMatchingNavHref(pathname: string): string | null {
	const nav = document.querySelector('[data-site-nav]');
	if (!nav) return null;
	const tabs = nav.querySelectorAll<HTMLAnchorElement>('.nav-tab');
	let best: string | null = null;
	let bestLen = -1;
	tabs.forEach((a) => {
		if (!a.offsetParent) return;
		const href = a.getAttribute('href') || '';
		const match =
			href === '/' ? pathname === '/' : pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
		if (match && href.length > bestLen) {
			best = href;
			bestLen = href.length;
		}
	});
	return best;
}

export function positionSiteNavUnderline(): void {
	const nav = document.querySelector('[data-site-nav]');
	const underline = document.querySelector('[data-nav-underline]') as HTMLElement | null;
	if (!nav || !underline) return;
	const path = window.location.pathname;
	const tabs = nav.querySelectorAll<HTMLAnchorElement>('.nav-tab');
	let best: HTMLAnchorElement | undefined;
	let bestLen = -1;
	tabs.forEach((a) => {
		if (!a.offsetParent) return;
		const href = a.getAttribute('href') || '';
		const match =
			href === '/' ? path === '/' : path === href || (href !== '/' && path.startsWith(`${href}/`));
		if (match && href.length > bestLen) {
			best = a;
			bestLen = href.length;
		}
	});
	if (!best) return;
	const navRect = nav.getBoundingClientRect();
	const r = best.getBoundingClientRect();
	const left = r.left - navRect.left;
	gsap.to(underline, {
		width: r.width,
		x: left,
		duration: 0.45,
		ease: 'power3.out',
	});
}

export function syncSiteNavActiveClasses(): void {
	const path = window.location.pathname;
	const activeHref = bestMatchingNavHref(path);

	document.querySelectorAll<HTMLAnchorElement>('[data-site-nav] .nav-tab').forEach((a) => {
		const href = a.getAttribute('href') || '';
		const on = href === activeHref;
		if (on) a.dataset.active = 'true';
		else delete a.dataset.active;
	});

	document.querySelectorAll<HTMLAnchorElement>('[data-site-nav-mobile] a[data-nav-href]').forEach((a) => {
		const href = a.getAttribute('data-nav-href') || a.getAttribute('href') || '';
		const on = href === activeHref;
		a.className = 'nav-tab';
		if (on) a.dataset.active = 'true';
		else delete a.dataset.active;
	});
}

export function syncSiteNavChrome(): void {
	syncSiteNavActiveClasses();
	positionSiteNavUnderline();
}
