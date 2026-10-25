/**
 * Three themes. Portfolio is the professional front and the default for every
 * visit; "bored?" enters Orbit or Flow for the rest of the browsing session.
 * Stored values stay universe/beach (shown as Orbit/Flow) so CSS and scripts
 * keyed on them are unchanged. The inline script in Layout.astro mirrors this.
 */
export const THEME_KEY = 'aditi-theme';

export type PlayfulTheme = 'universe' | 'beach';
export type SiteTheme = 'portfolio' | PlayfulTheme;

export const THEME_LABEL: Record<PlayfulTheme, string> = { universe: 'Orbit', beach: 'Flow' };

export function isSiteTheme(v: unknown): v is SiteTheme {
	return v === 'portfolio' || v === 'universe' || v === 'beach';
}

export function readStoredTheme(): SiteTheme | null {
	try {
		const v = sessionStorage.getItem(THEME_KEY);
		return isSiteTheme(v) ? v : null;
	} catch {
		return null;
	}
}

export function storeTheme(theme: SiteTheme): void {
	try {
		sessionStorage.setItem(THEME_KEY, theme);
	} catch {
		/* Storage blocked: the choice lasts for this page only. */
	}
}

/** "bored?": an even chance of either playful theme. */
export function pickPlayfulTheme(): PlayfulTheme {
	return Math.random() < 0.5 ? 'universe' : 'beach';
}
