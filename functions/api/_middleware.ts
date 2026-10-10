/**
 * Baseline security headers for every /api/* response. Static assets get the
 * same set (plus CSP) from public/_headers, which Pages does not apply to
 * Functions.
 */
const HEADERS: Record<string, string> = {
	'X-Frame-Options': 'DENY',
	'X-Content-Type-Options': 'nosniff',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
};

export const onRequest: PagesFunction = async ({ next }) => {
	const response = await next();
	const out = new Response(response.body, response);
	for (const [name, value] of Object.entries(HEADERS)) {
		if (!out.headers.has(name)) out.headers.set(name, value);
	}
	return out;
};
