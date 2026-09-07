/**
 * Client-side visit gating: skip localhost, Pages previews, bots, and
 * repeat loads in the same browser tab session (deploy checks / editing).
 */
const SESSION_KEY = 'aditi-visit-recorded';
const OPT_OUT_KEY = 'aditi-visit-optout';

/**
 * Permanent per-browser opt-out, so your own machine never inflates the count.
 * Visit /?visits=off once to enable it, /?visits=on to undo.
 */
function isOptedOut(): boolean {
	try {
		const param = new URLSearchParams(window.location.search).get('visits');
		if (param === 'off') localStorage.setItem(OPT_OUT_KEY, '1');
		else if (param === 'on') localStorage.removeItem(OPT_OUT_KEY);
		return localStorage.getItem(OPT_OUT_KEY) === '1';
	} catch {
		return false;
	}
}

const BOT_UA =
	/bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse|pagespeed|pingdom|uptimerobot|curl|wget|python-requests|go-http|puppeteer|playwright|phantom/i;

export function shouldRecordVisit(): boolean {
	if (typeof window === 'undefined') return false;

	if (isOptedOut()) return false;

	const host = window.location.hostname;
	if (
		host === 'localhost' ||
		host === '127.0.0.1' ||
		host.endsWith('.pages.dev') ||
		host.endsWith('.workers.dev') ||
		host.endsWith('.local')
	) {
		return false;
	}

	const ua = navigator.userAgent || '';
	if (!ua || BOT_UA.test(ua)) return false;

	try {
		if ('prerendering' in document && (document as Document & { prerendering?: boolean }).prerendering) {
			return false;
		}
	} catch {
		/* ignore */
	}

	try {
		if (sessionStorage.getItem(SESSION_KEY) === '1') return false;
	} catch {
		/* private mode — still allow; server filters bots */
	}

	return true;
}

export function markVisitRecorded(): void {
	try {
		sessionStorage.setItem(SESSION_KEY, '1');
	} catch {
		/* ignore */
	}
}
