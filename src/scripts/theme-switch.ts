/**
 * Header theme controls (components/ThemeSwitch.astro).
 *
 * Portfolio and the playful themes run different page furniture (no WebGL or
 * video in Portfolio), so moving between them reloads the current page in the
 * new theme. Orbit and Flow swap live, as before.
 */
import {
	THEME_LABEL,
	pickPlayfulTheme,
	storeTheme,
	type PlayfulTheme,
	type SiteTheme,
} from '../utils/theme-preference.ts';
import { recordTransitionOrigin } from './vt-origin.ts';

/* Pages that exist only in Orbit and Flow; the head script in Layout.astro mirrors this. */
const PLAYFUL_ONLY = /^\/(photo-dump|thoughts|dream-journal)(\/|$)/;

const BORED_SEEN = 'aditi-bored-seen';

/* The first "bored?" of a visit lands on the playful homepage, so the intro is seen once. */
function boredTarget(): string | undefined {
	try {
		if (sessionStorage.getItem(BORED_SEEN)) return undefined;
		sessionStorage.setItem(BORED_SEEN, '1');
	} catch {
		return undefined;
	}
	return location.pathname === '/' ? undefined : '/';
}

function reloadInto(theme: SiteTheme, from?: Element | null, to?: string) {
	storeTheme(theme);
	try {
		/* The next page shows its theme's loading screen; a playful homepage replays its intro. */
		sessionStorage.setItem('aditi-theme-switched', '1');
		if (theme !== 'portfolio') sessionStorage.removeItem('aditi-splash-seen');
	} catch {
		/* Storage blocked: the switch still happens, without the loading screen. */
	}
	if (from) {
		const r = from.getBoundingClientRect();
		recordTransitionOrigin({
			kind: 'tab',
			x: r.left + r.width / 2,
			y: r.top + r.height / 2,
			r: Math.min(r.width, r.height) / 2,
		});
	}
	if (to) {
		location.assign(to);
		return;
	}
	location.replace(theme === 'portfolio' && PLAYFUL_ONLY.test(location.pathname) ? '/' : location.href);
}

/* Orbit and Flow swap without a reload, so show the new theme's loader here. */
function flashLoader() {
	const html = document.documentElement;
	html.setAttribute('data-loading', '');
	window.setTimeout(() => {
		html.setAttribute('data-loading', 'out');
		window.setTimeout(() => html.removeAttribute('data-loading'), 450);
	}, matchMedia('(prefers-reduced-motion: reduce)').matches ? 300 : 800);
}

export function initThemeSwitch(applyPlayful: (theme: PlayfulTheme) => void): () => void {
	const root = document.documentElement;
	const bored = document.querySelector<HTMLButtonElement>('[data-theme-bored]');
	const button = document.querySelector<HTMLButtonElement>('[data-theme-menu-button]');
	const list = document.querySelector<HTMLElement>('[data-theme-menu-list]');
	const label = document.querySelector<HTMLElement>('[data-theme-menu-label]');
	const otherLabel = document.querySelector<HTMLElement>('[data-theme-other-label]');
	const toOther = document.querySelector<HTMLButtonElement>('[data-theme-to-other]');
	const toPortfolio = document.querySelector<HTMLButtonElement>('[data-theme-to-portfolio]');

	const current = (): SiteTheme => (root.dataset.theme as SiteTheme) ?? 'portfolio';
	const other = (t: PlayfulTheme): PlayfulTheme => (t === 'universe' ? 'beach' : 'universe');
	const items = () => Array.from(list?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);

	/* One span per letter so the hover animation can move them in turn. */
	function setLabel(text: string) {
		if (!label) return;
		button?.setAttribute('aria-label', `${text} theme, change theme`);
		label.replaceChildren(
			...Array.from(text, (ch, i) => {
				const span = document.createElement('span');
				span.className = 'theme-menu__char';
				span.style.setProperty('--i', String(i));
				span.setAttribute('aria-hidden', 'true');
				span.textContent = ch;
				return span;
			}),
		);
	}

	function syncLabels() {
		const t = current();
		if (t === 'portfolio') return;
		setLabel(THEME_LABEL[t]);
		if (otherLabel) otherLabel.textContent = `Switch to ${THEME_LABEL[other(t)]}`;
	}

	function setOpen(open: boolean, focusFirst = false) {
		if (!button || !list) return;
		button.setAttribute('aria-expanded', String(open));
		list.hidden = !open;
		if (open && focusFirst) items()[0]?.focus();
	}

	const onBored = () => reloadInto(pickPlayfulTheme(), bored, boredTarget());
	const onButton = () => setOpen(list?.hidden === true);
	const onOther = () => {
		const t = current();
		if (t === 'portfolio') return;
		flashLoader();
		applyPlayful(other(t));
		syncLabels();
		setOpen(false);
		button?.focus();
	};
	const onPortfolio = () => reloadInto('portfolio');

	const onDocClick = (e: MouseEvent) => {
		if (!list || list.hidden) return;
		if (!(e.target as Element).closest('[data-theme-menu]')) setOpen(false);
	};

	const onKey = (e: KeyboardEvent) => {
		if (!list || list.hidden) {
			if (e.target === button && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
				e.preventDefault();
				setOpen(true, true);
			}
			return;
		}
		const all = items();
		const i = all.indexOf(document.activeElement as HTMLButtonElement);
		if (e.key === 'Escape') {
			setOpen(false);
			button?.focus();
		} else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			const step = e.key === 'ArrowDown' ? 1 : -1;
			all[(i + step + all.length) % all.length]?.focus();
		} else if (e.key === 'Tab') {
			setOpen(false);
		}
	};

	bored?.addEventListener('click', onBored);
	button?.addEventListener('click', onButton);
	toOther?.addEventListener('click', onOther);
	toPortfolio?.addEventListener('click', onPortfolio);
	document.addEventListener('click', onDocClick);
	document.addEventListener('keydown', onKey);
	syncLabels();

	return () => {
		bored?.removeEventListener('click', onBored);
		button?.removeEventListener('click', onButton);
		toOther?.removeEventListener('click', onOther);
		toPortfolio?.removeEventListener('click', onPortfolio);
		document.removeEventListener('click', onDocClick);
		document.removeEventListener('keydown', onKey);
	};
}
