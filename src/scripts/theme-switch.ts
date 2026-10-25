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

function reloadInto(theme: SiteTheme, from?: Element | null) {
	storeTheme(theme);
	if (from) {
		const r = from.getBoundingClientRect();
		recordTransitionOrigin({
			kind: 'tab',
			x: r.left + r.width / 2,
			y: r.top + r.height / 2,
			r: Math.min(r.width, r.height) / 2,
		});
	}
	location.replace(location.href);
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

	function syncLabels() {
		const t = current();
		if (t === 'portfolio') return;
		if (label) label.textContent = THEME_LABEL[t];
		if (otherLabel) otherLabel.textContent = `Switch to ${THEME_LABEL[other(t)]}`;
	}

	function setOpen(open: boolean, focusFirst = false) {
		if (!button || !list) return;
		button.setAttribute('aria-expanded', String(open));
		list.hidden = !open;
		if (open && focusFirst) items()[0]?.focus();
	}

	const onBored = () => reloadInto(pickPlayfulTheme(), bored);
	const onButton = () => setOpen(list?.hidden === true);
	const onOther = () => {
		const t = current();
		if (t === 'portfolio') return;
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
