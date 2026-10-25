/**
 * Portfolio lab page behaviour: theme switching, "bored?", the font-pair
 * switcher, and the horizontal Selected work section.
 */
import { typePairs, type TypeFace, type TypePair } from '../data/portfolio-type.ts';

const THEME_KEY = 'aditi-theme';
/* Same odds as the first-visit pick in Layout.astro. */
const ORBIT_ODDS = 0.6;

function enterTheme(theme: 'universe' | 'beach') {
	try {
		localStorage.setItem(THEME_KEY, theme);
	} catch {
		/* Storage blocked: Layout falls back to its own pick. */
	}
	const target = 'embed' in document.documentElement.dataset ? window.top ?? window : window;
	target.location.assign('/');
}

function initThemeControls() {
	document.querySelectorAll<HTMLButtonElement>('[data-pf-theme]').forEach((btn) => {
		btn.addEventListener('click', () => {
			const theme = btn.dataset.pfTheme;
			if (theme === 'universe' || theme === 'beach') enterTheme(theme);
		});
	});
	document.querySelector('[data-pf-bored]')?.addEventListener('click', () => {
		enterTheme(Math.random() < ORBIT_ODDS ? 'universe' : 'beach');
	});
}

async function faceIsInstalled(face: TypeFace): Promise<boolean> {
	if (!face.local) return true;
	const src = face.local.probe.map((n) => `local("${n}")`).join(', ');
	try {
		await new FontFace('pf-probe', src).load();
		return true;
	} catch {
		return false;
	}
}

async function describePair(pair: TypePair): Promise<string> {
	const notes: string[] = [];
	for (const face of [pair.display, pair.text]) {
		if (face.local && !(await faceIsInstalled(face))) {
			notes.push(`${face.name} not installed, showing ${face.local.standIn}`);
		}
	}
	return notes.length ? notes.join('. ') : 'Real faces';
}

function initTypeSwitcher() {
	const root = document.documentElement;
	const select = Array.from(document.querySelectorAll('select')).find((el) => el.matches('[data-pf-type-select]'));
	const status = document.querySelector<HTMLElement>('[data-pf-type-status]');
	const colophon = document.querySelector<HTMLElement>('[data-pf-colophon]');

	async function apply(id: string) {
		const pair = typePairs.find((p) => p.id === id) ?? typePairs[0]!;
		root.dataset.type = pair.id;
		if (select) select.value = pair.id;
		if (colophon) colophon.textContent = `Set in ${pair.display.name} and ${pair.text.name}.`;
		if (status) status.textContent = await describePair(pair);
		window.dispatchEvent(new Event('resize'));
	}

	select?.addEventListener('change', () => {
		try {
			localStorage.setItem('pf-type', select.value);
		} catch {
			/* Not persisted; the URL still carries it. */
		}
		const url = new URL(location.href);
		url.searchParams.set('type', select.value);
		history.replaceState(null, '', url);
		void apply(select.value);
	});

	void apply(root.dataset.type ?? typePairs[0]!.id);
}

/**
 * Horizontal Selected work: the section is made as tall as the track is wide,
 * and CSS (a view timeline over the section) slides the pinned track sideways.
 * This only measures. Without scroll-driven animation support, with reduced
 * motion, or on narrow screens, the track stays a swipeable row.
 */
function initHorizontalScroll() {
	const section = document.querySelector<HTMLElement>('[data-hscroll]');
	const viewport = document.querySelector<HTMLElement>('[data-hscroll-viewport]');
	const track = document.querySelector<HTMLElement>('[data-hscroll-track]');
	if (!section || !viewport || !track) return;

	const root = document.documentElement;
	const pinned = matchMedia('(prefers-reduced-motion: no-preference) and (min-width: 760px)');
	const supported = CSS.supports('animation-timeline: view()');
	let distance = 0;

	function measure() {
		if (!supported || !pinned.matches) {
			delete root.dataset.pfHscroll;
			section!.style.removeProperty('--pf-hscroll-h');
			return;
		}
		distance = Math.max(0, track!.scrollWidth - viewport!.clientWidth);
		section!.style.setProperty('--pf-hscroll-h', `calc(100svh + ${distance}px)`);
		track!.style.setProperty('--pf-hdist', `${distance}px`);
		root.dataset.pfHscroll = distance > 0 ? 'pinned' : '';
	}

	/* A focused card off to the side: scroll the page until the track brings it in. */
	track.addEventListener('focusin', (e) => {
		if (root.dataset.pfHscroll !== 'pinned') return;
		const item = (e.target as Element).closest<HTMLElement>('.pf-card-item');
		if (!item) return;
		const sectionTop = section.getBoundingClientRect().top + window.scrollY;
		const reach = Math.min(distance, Math.max(0, item.offsetLeft - viewport.clientWidth * 0.08));
		window.scrollTo({ top: sectionTop + reach, behavior: 'instant' });
	});

	measure();
	new ResizeObserver(measure).observe(track);
	pinned.addEventListener('change', measure);
	window.addEventListener('resize', measure, { passive: true });
	document.fonts?.ready.then(measure);
}

export function initPortfolioPage(): void {
	initThemeControls();
	initTypeSwitcher();
	initHorizontalScroll();
}
