export const THEME_KEY = 'aditi-theme';

export type SiteTheme = 'universe' | 'beach';

/** 60% universe, 40% beach — persisted once chosen until user toggles. */
export function pickWeightedTheme(): SiteTheme {
	return Math.random() < 0.6 ? 'universe' : 'beach';
}

export function readStoredTheme(): SiteTheme | null {
	try {
		const v = localStorage.getItem(THEME_KEY);
		if (v === 'beach' || v === 'universe') return v;
	} catch {
		/* ignore */
	}
	return null;
}

export function resolveTheme(): SiteTheme {
	const stored = readStoredTheme();
	if (stored) return stored;
	const picked = pickWeightedTheme();
	try {
		localStorage.setItem(THEME_KEY, picked);
	} catch {
		/* ignore */
	}
	return picked;
}
