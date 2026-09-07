/**
 * Same-origin-only CORS helpers for Cloudflare Pages Functions.
 * Never reflect arbitrary origins and never use Access-Control-Allow-Origin: *.
 */

function siteOrigin(request: Request): string {
	return new URL(request.url).origin;
}

/** Returns the request Origin only when it matches this site; otherwise null. */
export function sameSiteOrigin(request: Request): string | null {
	const origin = request.headers.get('Origin');
	if (!origin) return null;
	return origin === siteOrigin(request) ? origin : null;
}

/**
 * Reject browser cross-site calls. Same-origin fetches and non-browser clients
 * (no Origin / Sec-Fetch-Site) are allowed.
 */
export function forbidCrossOrigin(request: Request): Response | null {
	const origin = request.headers.get('Origin');
	if (origin && origin !== siteOrigin(request)) {
		return json({ ok: false, error: 'Forbidden' }, 403, request);
	}
	const fetchSite = request.headers.get('Sec-Fetch-Site');
	if (fetchSite === 'cross-site') {
		return json({ ok: false, error: 'Forbidden' }, 403, request);
	}
	return null;
}

export function json(data: unknown, status = 200, request?: Request): Response {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json; charset=utf-8',
		'Cache-Control': 'no-store',
		Vary: 'Origin',
	};
	if (request) {
		const allowed = sameSiteOrigin(request);
		if (allowed) headers['Access-Control-Allow-Origin'] = allowed;
	}
	return new Response(JSON.stringify(data), { status, headers });
}

export function corsOptions(request: Request): Response {
	const allowed = sameSiteOrigin(request);
	if (!allowed) {
		return new Response(null, { status: 403, headers: { Vary: 'Origin' } });
	}
	return new Response(null, {
		status: 204,
		headers: {
			'Access-Control-Allow-Origin': allowed,
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization',
			'Access-Control-Max-Age': '86400',
			Vary: 'Origin',
		},
	});
}
