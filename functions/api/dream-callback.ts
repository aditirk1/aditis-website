/**
 * OAuth callback for dream journal (Google + GitHub).
 * Sets HttpOnly dream_session cookie, then redirects to /dream-journal.
 */
import {
	DREAM_OAUTH_PROVIDER_COOKIE,
	DREAM_OAUTH_STATE_COOKIE,
	clearCookieHeader,
	readCookie,
	sessionCookieHeader,
	signDreamSession,
} from '../_shared/dream-session';

interface Env {
	DREAM_SESSION_SECRET?: string;
	DREAM_GITHUB_CLIENT_ID?: string;
	DREAM_GITHUB_CLIENT_SECRET?: string;
	GOOGLE_CLIENT_ID?: string;
	GOOGLE_CLIENT_SECRET?: string;
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function errorPage(message: string, status: number): Response {
	const safe = escapeHtml(message);
	return new Response(
		`<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>Sign-in failed</title></head>` +
			`<body style="font:16px system-ui;padding:2rem"><h1>Sign-in failed</h1><p>${safe}</p>` +
			`<p><a href="/dream-journal">Back to dream journal</a></p></body></html>`,
		{ status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
	);
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
	if (!env.DREAM_SESSION_SECRET) {
		return errorPage('Dream sign-in is not configured (missing DREAM_SESSION_SECRET).', 503);
	}

	const url = new URL(request.url);
	const origin = url.origin;
	const cookieHeader = request.headers.get('Cookie');

	const denied = url.searchParams.get('error_description') ?? url.searchParams.get('error');
	if (denied) return errorPage(`Sign-in was declined: ${denied}`, 400);

	const code = url.searchParams.get('code');
	if (!code) return errorPage('No authorization code. Start again from the dream journal.', 400);

	const expectedState = readCookie(cookieHeader, DREAM_OAUTH_STATE_COOKIE);
	if (!expectedState || url.searchParams.get('state') !== expectedState) {
		return errorPage('This sign-in link has expired. Please try again.', 400);
	}

	const providerRaw = readCookie(cookieHeader, DREAM_OAUTH_PROVIDER_COOKIE);
	const provider = providerRaw === 'google' || providerRaw === 'github' ? providerRaw : null;
	if (!provider) return errorPage('Missing OAuth provider. Please try again.', 400);

	let sub = '';
	let name: string | undefined;

	if (provider === 'github') {
		if (!env.DREAM_GITHUB_CLIENT_ID || !env.DREAM_GITHUB_CLIENT_SECRET) {
			return errorPage('GitHub sign-in is not configured.', 503);
		}
		const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
				'User-Agent': 'aditirk.me-dream-auth',
			},
			body: JSON.stringify({
				client_id: env.DREAM_GITHUB_CLIENT_ID,
				client_secret: env.DREAM_GITHUB_CLIENT_SECRET,
				code,
				redirect_uri: `${origin}/api/dream-callback`,
			}),
		});
		if (!tokenRes.ok) return errorPage('GitHub rejected the token exchange.', 502);
		const tokenData = (await tokenRes.json()) as { access_token?: string; error_description?: string };
		if (!tokenData.access_token) {
			return errorPage(tokenData.error_description ?? 'GitHub did not return a token.', 502);
		}
		const userRes = await fetch('https://api.github.com/user', {
			headers: {
				Authorization: `Bearer ${tokenData.access_token}`,
				Accept: 'application/vnd.github+json',
				'User-Agent': 'aditirk.me-dream-auth',
			},
		});
		if (!userRes.ok) return errorPage('Could not read your GitHub profile.', 502);
		const user = (await userRes.json()) as { id?: number; login?: string; name?: string };
		if (!user.id) return errorPage('GitHub profile missing id.', 502);
		sub = `github:${user.id}`;
		name = user.name || user.login || undefined;
	} else {
		if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
			return errorPage('Google sign-in is not configured.', 503);
		}
		const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				code,
				client_id: env.GOOGLE_CLIENT_ID,
				client_secret: env.GOOGLE_CLIENT_SECRET,
				redirect_uri: `${origin}/api/dream-callback`,
				grant_type: 'authorization_code',
			}),
		});
		if (!tokenRes.ok) return errorPage('Google rejected the token exchange.', 502);
		const tokenData = (await tokenRes.json()) as { access_token?: string; error_description?: string };
		if (!tokenData.access_token) {
			return errorPage(tokenData.error_description ?? 'Google did not return a token.', 502);
		}
		const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
			headers: { Authorization: `Bearer ${tokenData.access_token}` },
		});
		if (!userRes.ok) return errorPage('Could not read your Google profile.', 502);
		const user = (await userRes.json()) as { id?: string; email?: string; name?: string };
		if (!user.id) return errorPage('Google profile missing id.', 502);
		sub = `google:${user.id}`;
		name = user.name || user.email || undefined;
	}

	const token = await signDreamSession({ sub, provider, name }, env.DREAM_SESSION_SECRET);
	const headers = new Headers({
		Location: `${origin}/dream-journal?dream_auth=ok`,
		'Cache-Control': 'no-store',
	});
	headers.append('Set-Cookie', sessionCookieHeader(token));
	headers.append('Set-Cookie', clearCookieHeader(DREAM_OAUTH_STATE_COOKIE));
	headers.append('Set-Cookie', clearCookieHeader(DREAM_OAUTH_PROVIDER_COOKIE));
	return new Response(null, { status: 302, headers });
};
