/**
 * OAuth callback for site sign-in (dream journal + comments).
 * Sets HttpOnly dream_session cookie, then redirects to return_to (or /dream-journal).
 *
 * Important: never return HTTP 502 from this Function — Cloudflare replaces those
 * with a generic "Bad gateway" page and hides the real error message.
 */
import {
	DREAM_OAUTH_PROVIDER_COOKIE,
	DREAM_OAUTH_RETURN_COOKIE,
	DREAM_OAUTH_STATE_COOKIE,
	clearCookieHeader,
	readCookie,
	sessionCookieHeader,
	signDreamSession,
} from '../_shared/dream-session';
import { sanitizeReturnPath } from '../_shared/oauth-return';

interface Env {
	DREAM_SESSION_SECRET?: string;
	DREAM_GITHUB_CLIENT_ID?: string;
	DREAM_GITHUB_CLIENT_SECRET?: string;
	GOOGLE_CLIENT_ID?: string;
	GOOGLE_CLIENT_SECRET?: string;
}

function envStr(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function errorPage(message: string, status = 400): Response {
	const safe = escapeHtml(message);
	return new Response(
		`<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>Sign-in failed</title></head>` +
			`<body style="font:16px system-ui;padding:2rem;max-width:36rem;margin:2rem auto;line-height:1.5">` +
			`<h1>Sign-in failed</h1><p>${safe}</p>` +
			`<p><a href="/dream-journal">Back to dream journal</a> · <a href="/">Home</a></p>` +
			`</body></html>`,
		{
			/* 400/503 — not 502 (Cloudflare hides 502 bodies behind its Bad gateway page) */
			status: status === 502 ? 400 : status,
			headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
		},
	);
}

function safeReadCookie(header: string | null, name: string): string | null {
	try {
		return readCookie(header, name);
	} catch {
		return null;
	}
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
	try {
		const sessionSecret = envStr(env.DREAM_SESSION_SECRET);
		if (!sessionSecret) {
			return errorPage('Sign-in is not configured (missing DREAM_SESSION_SECRET).', 503);
		}

		const url = new URL(request.url);
		const origin = url.origin;
		const cookieHeader = request.headers.get('Cookie');
		const returnTo = sanitizeReturnPath(safeReadCookie(cookieHeader, DREAM_OAUTH_RETURN_COOKIE));

		const denied = url.searchParams.get('error_description') ?? url.searchParams.get('error');
		if (denied) return errorPage(`Sign-in was declined: ${denied}`);

		const code = url.searchParams.get('code');
		if (!code) return errorPage('No authorization code. Start again from the site.');

		const expectedState = safeReadCookie(cookieHeader, DREAM_OAUTH_STATE_COOKIE);
		if (!expectedState || url.searchParams.get('state') !== expectedState) {
			return errorPage(
				'This sign-in link expired or cookies were blocked. Try again from the same browser (not private mode if cookies are blocked).',
			);
		}

		const providerRaw = safeReadCookie(cookieHeader, DREAM_OAUTH_PROVIDER_COOKIE);
		const provider = providerRaw === 'google' || providerRaw === 'github' ? providerRaw : null;
		if (!provider) {
			return errorPage('Missing OAuth provider cookie. Start again from the site.');
		}

		let sub = '';
		let name: string | undefined;

		if (provider === 'github') {
			const clientId = envStr(env.DREAM_GITHUB_CLIENT_ID);
			const clientSecret = envStr(env.DREAM_GITHUB_CLIENT_SECRET);
			if (!clientId || !clientSecret) {
				return errorPage('GitHub sign-in is not configured in Cloudflare.', 503);
			}
			const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/json',
					'User-Agent': 'aditirk.me-auth',
				},
				body: JSON.stringify({
					client_id: clientId,
					client_secret: clientSecret,
					code,
					redirect_uri: `${origin}/api/dream-callback`,
				}),
			});
			let tokenData: { access_token?: string; error?: string; error_description?: string } = {};
			try {
				tokenData = (await tokenRes.json()) as typeof tokenData;
			} catch {
				return errorPage('GitHub returned a non-JSON token response. Try again.');
			}
			if (!tokenRes.ok || !tokenData.access_token) {
				return errorPage(
					tokenData.error_description ||
						tokenData.error ||
						'GitHub rejected the token exchange. Most often DREAM_GITHUB_CLIENT_SECRET does not match the OAuth App for this Client ID — regenerate the secret on GitHub and update Cloudflare, then Redeploy.',
				);
			}
			const userRes = await fetch('https://api.github.com/user', {
				headers: {
					Authorization: `Bearer ${tokenData.access_token}`,
					Accept: 'application/vnd.github+json',
					'User-Agent': 'aditirk.me-auth',
				},
			});
			if (!userRes.ok) return errorPage('Could not read your GitHub profile.');
			const user = (await userRes.json()) as { id?: number; login?: string; name?: string };
			if (!user.id) return errorPage('GitHub profile missing id.');
			sub = `github:${user.id}`;
			name = user.name || user.login || undefined;
		} else {
			const clientId = envStr(env.GOOGLE_CLIENT_ID);
			const clientSecret = envStr(env.GOOGLE_CLIENT_SECRET);
			if (!clientId || !clientSecret) {
				return errorPage(
					'Google sign-in is not configured (missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET on this deploy).',
					503,
				);
			}
			const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams({
					code,
					client_id: clientId,
					client_secret: clientSecret,
					redirect_uri: `${origin}/api/dream-callback`,
					grant_type: 'authorization_code',
				}),
			});
			let tokenData: { access_token?: string; error?: string; error_description?: string } = {};
			try {
				tokenData = (await tokenRes.json()) as typeof tokenData;
			} catch {
				return errorPage('Google returned a non-JSON token response. Try again.');
			}
			if (!tokenRes.ok || !tokenData.access_token) {
				return errorPage(
					tokenData.error_description ||
						tokenData.error ||
						'Google rejected the token exchange. Check GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET and that the redirect URI is https://aditirk.me/api/dream-callback.',
				);
			}
			const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
				headers: { Authorization: `Bearer ${tokenData.access_token}` },
			});
			if (!userRes.ok) return errorPage('Could not read your Google profile.');
			const user = (await userRes.json()) as { id?: string; email?: string; name?: string };
			if (!user.id) return errorPage('Google profile missing id.');
			sub = `google:${user.id}`;
			name = user.name || user.email || undefined;
		}

		const token = await signDreamSession({ sub, provider, name }, sessionSecret);
		const sep = returnTo.includes('?') ? '&' : '?';
		const headers = new Headers({
			Location: `${origin}${returnTo}${sep}signed_in=1`,
			'Cache-Control': 'no-store',
		});
		headers.append('Set-Cookie', sessionCookieHeader(token));
		headers.append('Set-Cookie', clearCookieHeader(DREAM_OAUTH_STATE_COOKIE));
		headers.append('Set-Cookie', clearCookieHeader(DREAM_OAUTH_PROVIDER_COOKIE));
		headers.append('Set-Cookie', clearCookieHeader(DREAM_OAUTH_RETURN_COOKIE));
		return new Response(null, { status: 302, headers });
	} catch (err) {
		const msg = err instanceof Error ? err.message : 'Unknown error';
		return errorPage(`Unexpected sign-in error: ${msg}`);
	}
};
