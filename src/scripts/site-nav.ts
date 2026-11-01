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
	const nav = document.querySelector('nav[aria-label="Primary"]');
	if (!nav) return null;

	let best: string | null = null;
	let bestLen = -1;

	nav.querySelectorAll<HTMLAnchorElement>('.nav-tab').forEach((a) => {
		const href = a.getAttribute('href') ?? a.getAttribute('data-nav-href') ?? '';
		if (isMatch(href, pathname) && href.length > bestLen) {
			best = href;
			bestLen = href.length;
		}
	});

	return best;
}

export function syncSiteNavActiveClasses(): void {
	const activeHref = bestMatchingNavHref(window.location.pathname);
	const nav = document.querySelector('nav[aria-label="Primary"]');
	if (!nav) return;

	nav.querySelectorAll<HTMLAnchorElement>('.nav-tab').forEach((a) => {
		const href = a.getAttribute('href') ?? a.getAttribute('data-nav-href') ?? '';
		if (href === activeHref) a.dataset.active = 'true';
		else delete a.dataset.active;
	});
}

/*
 * On phones the tabs are a sideways-scrolling row. Bring the current page's tab
 * into view, and mark the row while more tabs sit past its right edge so the
 * CSS can fade that edge as a hint.
 */
function syncNavRow(): void {
	const row = document.querySelector<HTMLElement>('[data-site-nav]');
	if (!row) return;
	const update = () => {
		row.toggleAttribute('data-more', row.scrollLeft + row.clientWidth < row.scrollWidth - 2);
	};
	const active = row.querySelector<HTMLElement>('.nav-tab[data-active="true"]');
	if (active && row.scrollWidth > row.clientWidth) {
		const end = active.offsetLeft + active.offsetWidth;
		if (end > row.scrollLeft + row.clientWidth) row.scrollLeft = end - row.clientWidth + 16;
	}
	update();
	if (row.dataset.navRowWatched) return;
	row.dataset.navRowWatched = '1';
	row.addEventListener('scroll', update, { passive: true });
	window.addEventListener('resize', update, { passive: true });
}

export function syncSiteNavChrome(): void {
	syncSiteNavActiveClasses();
	syncNavRow();
}
