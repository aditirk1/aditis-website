/**
 * Small security helpers shared by Pages Functions.
 */
import { json } from './cors';

const enc = new TextEncoder();

async function sha256(input: string): Promise<Uint8Array> {
	return new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(input)));
}

/**
 * Constant-time string comparison. Both sides are hashed first so the loop
 * length never depends on the secret's length.
 */
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
	const [ha, hb] = await Promise.all([sha256(a), sha256(b)]);
	let diff = 0;
	for (let i = 0; i < ha.length; i++) diff |= ha[i]! ^ hb[i]!;
	return diff === 0 && a.length > 0;
}

/** Bearer token from `Authorization`, compared in constant time against `secret`. */
export async function bearerMatches(request: Request, secret: string | undefined): Promise<boolean> {
	const expected = secret?.trim() ?? '';
	if (!expected) return false;
	const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
	return timingSafeEqual(token, expected);
}

function clientIp(request: Request): string {
	return (
		request.headers.get('CF-Connecting-IP') ??
		request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
		'unknown'
	);
}

export type RateLimitRule = {
	/** Distinguishes counters, e.g. "comments-post". */
	bucket: string;
	/** Max requests per window per client. */
	limit: number;
	/** Window length in seconds (KV TTLs have a 60s floor). */
	windowS: number;
};

/**
 * Fixed-window rate limit backed by KV, keyed on a hash of the client IP (raw
 * IPs are never stored). KV is eventually consistent, so this is a soft cap
 * that stops floods and brute force, not an exact counter.
 *
 * Returns a 429 response when the client is over the limit, otherwise null.
 */
export async function rateLimit(
	kv: KVNamespace | undefined,
	request: Request,
	rule: RateLimitRule,
): Promise<Response | null> {
	if (!kv) return null;
	const ipHash = Array.from((await sha256(`rl:${clientIp(request)}`)).slice(0, 12))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
	const window = Math.floor(Date.now() / 1000 / rule.windowS);
	const key = `rl:v1:${rule.bucket}:${ipHash}:${window}`;

	const current = Number.parseInt((await kv.get(key)) ?? '0', 10) || 0;
	if (current >= rule.limit) {
		const res = json({ ok: false, error: 'Too many requests. Try again shortly.' }, 429, request);
		res.headers.set('Retry-After', String(rule.windowS));
		return res;
	}
	await kv.put(key, String(current + 1), { expirationTtl: Math.max(60, rule.windowS * 2) });
	return null;
}
