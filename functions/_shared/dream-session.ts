/**
 * Shared dream-session cookie helpers (HMAC-SHA256).
 * Dreams APIs refuse to return content without a valid cookie.
 */
export const DREAM_SESSION_COOKIE = 'dream_session';
export const DREAM_OAUTH_STATE_COOKIE = 'dream_oauth_state';
export const DREAM_OAUTH_PROVIDER_COOKIE = 'dream_oauth_provider';

/** 30 days */
export const DREAM_SESSION_MAX_AGE_S = 60 * 60 * 24 * 30;

export type DreamSessionPayload = {
	sub: string;
	provider: 'github' | 'google';
	name?: string;
	exp: number;
};

export function readCookie(header: string | null, name: string): string | null {
	if (!header) return null;
	for (const part of header.split(';')) {
		const [key, ...rest] = part.trim().split('=');
		if (key === name) return decodeURIComponent(rest.join('='));
	}
	return null;
}

function b64urlEncode(bytes: ArrayBuffer | Uint8Array): string {
	const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
	let bin = '';
	for (const b of u8) bin += String.fromCharCode(b);
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64urlDecode(s: string): Uint8Array {
	const pad = '='.repeat((4 - (s.length % 4)) % 4);
	const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
	const bin = atob(b64);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign', 'verify'],
	);
}

export async function signDreamSession(
	payload: Omit<DreamSessionPayload, 'exp'> & { exp?: number },
	secret: string,
): Promise<string> {
	const body: DreamSessionPayload = {
		...payload,
		exp: payload.exp ?? Math.floor(Date.now() / 1000) + DREAM_SESSION_MAX_AGE_S,
	};
	const bodyB64 = b64urlEncode(new TextEncoder().encode(JSON.stringify(body)));
	const key = await hmacKey(secret);
	const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(bodyB64));
	return `${bodyB64}.${b64urlEncode(sig)}`;
}

export async function verifyDreamSession(
	token: string | null,
	secret: string | undefined,
): Promise<DreamSessionPayload | null> {
	if (!token || !secret) return null;
	const [bodyB64, sigB64] = token.split('.');
	if (!bodyB64 || !sigB64) return null;
	try {
		const key = await hmacKey(secret);
		const sigBytes = b64urlDecode(sigB64);
		const sigBuf = new ArrayBuffer(sigBytes.byteLength);
		new Uint8Array(sigBuf).set(sigBytes);
		const ok = await crypto.subtle.verify('HMAC', key, sigBuf, new TextEncoder().encode(bodyB64));
		if (!ok) return null;
		const json = new TextDecoder().decode(b64urlDecode(bodyB64));
		const payload = JSON.parse(json) as DreamSessionPayload;
		if (!payload?.sub || !payload?.provider || !payload?.exp) return null;
		if (payload.exp < Math.floor(Date.now() / 1000)) return null;
		if (payload.provider !== 'github' && payload.provider !== 'google') return null;
		return payload;
	} catch {
		return null;
	}
}

export function sessionCookieHeader(token: string, maxAge = DREAM_SESSION_MAX_AGE_S): string {
	return `${DREAM_SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export function clearCookieHeader(name: string): string {
	return `${name}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export async function sessionFromRequest(
	request: Request,
	secret: string | undefined,
): Promise<DreamSessionPayload | null> {
	const raw = readCookie(request.headers.get('Cookie'), DREAM_SESSION_COOKIE);
	return verifyDreamSession(raw, secret);
}
