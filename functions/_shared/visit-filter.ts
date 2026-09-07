/**
 * Server-side visit gating (User-Agent + Host). Complements the client checks.
 */

const BOT_UA =
	/bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse|pagespeed|pingdom|uptimerobot|curl|wget|python-requests|go-http|puppeteer|playwright|phantom|cfnetwork|monitoring|synthetic/i;

/** Hostnames that should never increment the public visitor counter. */
export function isNonProductionHost(host: string): boolean {
	const h = host.toLowerCase().split(':')[0] ?? '';
	return (
		!h ||
		h === 'localhost' ||
		h === '127.0.0.1' ||
		h.endsWith('.pages.dev') ||
		h.endsWith('.workers.dev') ||
		h.endsWith('.local')
	);
}

export function isBotUserAgent(ua: string | null): boolean {
	if (!ua || ua.length < 8) return true;
	return BOT_UA.test(ua);
}

/**
 * Opaque per-day identity for a visitor: SHA-256 over IP + User-Agent + date,
 * truncated. Never stores the address itself, and rolls over daily so it can't
 * be used to follow anyone across days.
 *
 * This is what stops your own repeat loads, preview checks and deploy smoke
 * tests from each landing as a separate "visitor".
 */
export async function visitorDayHash(request: Request): Promise<string | null> {
	const ip = request.headers.get('CF-Connecting-IP') ?? '';
	if (!ip) return null;
	const ua = request.headers.get('User-Agent') ?? '';
	const day = new Date().toISOString().slice(0, 10);
	const digest = await crypto.subtle.digest(
		'SHA-256',
		new TextEncoder().encode(`${ip}|${ua}|${day}`),
	);
	return Array.from(new Uint8Array(digest).slice(0, 16))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

export function shouldRecordVisitRequest(request: Request): { ok: true } | { ok: false; reason: string } {
	const host = request.headers.get('Host') ?? '';
	if (isNonProductionHost(host)) {
		return { ok: false, reason: 'non-production-host' };
	}

	const ua = request.headers.get('User-Agent');
	if (isBotUserAgent(ua)) {
		return { ok: false, reason: 'bot-ua' };
	}

	/* Prefetch / no-user navigations */
	const dest = request.headers.get('Sec-Fetch-Dest');
	if (dest === 'empty' && request.headers.get('Sec-Fetch-Mode') === 'no-cors') {
		return { ok: false, reason: 'prefetch' };
	}

	const purpose = request.headers.get('Purpose') ?? request.headers.get('Sec-Purpose');
	if (purpose && /prefetch|prerender/i.test(purpose)) {
		return { ok: false, reason: 'prefetch' };
	}

	return { ok: true };
}
