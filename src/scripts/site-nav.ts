/**
 * Marks the nav tab matching the current URL. The active pill is styled purely
 * in CSS via `.nav-tab[data-active='true']`.
 */
function isMatch(href: string, pathname: string): boolean {
	if (href === '/') return pathname === '/';
	return pathname === href || pathname.startsWith(`${href}/`);
}

/** Longest matching href wins, so `/blog/essays/x` prefers `/blog` over `/`. */
function bestMatchingNavHref(pathname: string): string | null {
	const nav = document.querySelector('[data-site-nav]');
	if (!nav) return null;

	let best: string | null = null;
	let bestLen = -1;

	nav.querySelectorAll<HTMLAnchorElement>('.nav-tab').forEach((a) => {
		if (!a.offsetParent) return;
		const href = a.getAttribute('href') ?? '';
		if (isMatch(href, pathname) && href.length > bestLen) {
			best = href;
			bestLen = href.length;
		}
	});

	return best;
}

export function syncSiteNavActiveClasses(): void {
	const activeHref = bestMatchingNavHref(window.location.pathname);

	document.querySelectorAll<HTMLAnchorElement>('[data-site-nav] .nav-tab').forEach((a) => {
		const href = a.getAttribute('href') ?? '';
		if (href === activeHref) a.dataset.active = 'true';
		else delete a.dataset.active;
	});

	document
		.querySelectorAll<HTMLAnchorElement>('[data-site-nav-mobile] a[data-nav-href]')
		.forEach((a) => {
			const href = a.getAttribute('data-nav-href') ?? a.getAttribute('href') ?? '';
			a.className = 'nav-tab';
			if (href === activeHref) a.dataset.active = 'true';
			else delete a.dataset.active;
		});
}

export function syncSiteNavChrome(): void {
	syncSiteNavActiveClasses();
}
