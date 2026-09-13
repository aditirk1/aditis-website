/**
 * Start Google or GitHub OAuth for the dream journal (after the quiz).
 * Callback: /api/dream-callback
 *
 * Env:
 *   DREAM_SESSION_SECRET
 *   DREAM_GITHUB_CLIENT_ID + DREAM_GITHUB_CLIENT_SECRET
 *   GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET
 */
import { DREAM_OAUTH_PROVIDER_COOKIE, DREAM_OAUTH_STATE_COOKIE } from '../_shared/dream-session';

interface Env {
	DREAM_SESSION_SECRET?: string;
	DREAM_GITHUB_CLIENT_ID?: string;
	DREAM_GITHUB_CLIENT_SECRET?: string;
	GOOGLE_CLIENT_ID?: string;
	GOOGLE_CLIENT_SECRET?: string;
}

function cookie(name: string, value: string, maxAge: number): string {
	return `${name}=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

function redirectWithCookies(location: string, cookies: string[]): Response {
	const headers = new Headers({ Location: location, 'Cache-Control': 'no-store' });
	for (const c of cookies) headers.append('Set-Cookie', c);
	return new Response(null, { status: 302, headers });
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
	if (!env.DREAM_SESSION_SECRET) {
		return new Response('Dream sign-in is not configured (missing DREAM_SESSION_SECRET).', {
			status: 503,
			headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
		});
	}

	const url = new URL(request.url);
	const provider = url.searchParams.get('provider');
	const origin = url.origin;
	const state = crypto.randomUUID().replace(/-/g, '');

	if (provider === 'github') {
		if (!env.DREAM_GITHUB_CLIENT_ID || !env.DREAM_GITHUB_CLIENT_SECRET) {
			return new Response(
				'Set DREAM_GITHUB_CLIENT_ID and DREAM_GITHUB_CLIENT_SECRET (OAuth App callback: /api/dream-callback).',
				{
					status: 503,
					headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
				},
			);
		}

		const authorize = new URL('https://github.com/login/oauth/authorize');
		authorize.searchParams.set('client_id', env.DREAM_GITHUB_CLIENT_ID);
		authorize.searchParams.set('redirect_uri', `${origin}/api/dream-callback`);
		authorize.searchParams.set('scope', 'read:user user:email');
		authorize.searchParams.set('state', state);

		return redirectWithCookies(authorize.toString(), [
			cookie(DREAM_OAUTH_STATE_COOKIE, state, 600),
			cookie(DREAM_OAUTH_PROVIDER_COOKIE, 'github', 600),
		]);
	}

	if (provider === 'google') {
		if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
			return new Response('Google sign-in is not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).', {
				status: 503,
				headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
			});
		}

		const authorize = new URL('https://accounts.google.com/o/oauth2/v2/auth');
		authorize.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
		authorize.searchParams.set('redirect_uri', `${origin}/api/dream-callback`);
		authorize.searchParams.set('response_type', 'code');
		authorize.searchParams.set('scope', 'openid email profile');
		authorize.searchParams.set('state', state);
		authorize.searchParams.set('prompt', 'select_account');

		return redirectWithCookies(authorize.toString(), [
			cookie(DREAM_OAUTH_STATE_COOKIE, state, 600),
			cookie(DREAM_OAUTH_PROVIDER_COOKIE, 'google', 600),
		]);
	}

	return new Response('Use ?provider=github or ?provider=google', {
		status: 400,
		headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
	});
};
