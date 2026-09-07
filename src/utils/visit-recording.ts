/**
 * Client-side visit gating: skip localhost, Pages previews, bots, and
 * repeat loads in the same browser tab session (deploy checks / editing).
 */
const SESSION_KEY = 'aditi-visit-recorded';

const BOT_UA =
	/bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse|pagespeed|pingdom|uptimerobot|curl|wget|python-requests|go-http|puppeteer|playwright|phantom/i;

export function shouldRecordVisit(): boolean {
	if (typeof window === 'undefined') return false;

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
