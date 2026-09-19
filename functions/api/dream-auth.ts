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

function plain(message: string, status = 503): Response {
	return new Response(message, {
		status,
		headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
	});
}

function envStr(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

/** Real OAuth client IDs never contain spaces (placeholder notes often do). */
function looksLikeClientId(value: string): boolean {
	return value.length >= 8 && !/\s/.test(value);
}

function missingList(flags: Record<string, boolean>): string {
	return Object.entries(flags)
		.filter(([, ok]) => !ok)
		.map(([name]) => name)
		.join(', ');
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
	const sessionSecret = envStr(env.DREAM_SESSION_SECRET);
	if (!sessionSecret) {
		return plain('Dream sign-in is not configured (missing DREAM_SESSION_SECRET).');
	}

	const url = new URL(request.url);
	const provider = url.searchParams.get('provider');
	const origin = url.origin;
	const state = crypto.randomUUID().replace(/-/g, '');

	if (provider === 'github') {
		const clientId = envStr(env.DREAM_GITHUB_CLIENT_ID);
		const clientSecret = envStr(env.DREAM_GITHUB_CLIENT_SECRET);
		const missing = missingList({
			DREAM_GITHUB_CLIENT_ID: !!clientId,
			DREAM_GITHUB_CLIENT_SECRET: !!clientSecret,
		});
		if (missing) {
			return plain(
				`GitHub sign-in missing env: ${missing}. Use the Client ID from GitHub → Settings → Developer settings → OAuth Apps (callback must be ${origin}/api/dream-callback).`,
			);
		}
		if (!looksLikeClientId(clientId)) {
			return plain(
				`DREAM_GITHUB_CLIENT_ID looks like a note, not a Client ID (got "${clientId.slice(0, 64)}"). Paste the real Client ID string from the GitHub OAuth App page.`,
			);
		}

		const authorize = new URL('https://github.com/login/oauth/authorize');
		authorize.searchParams.set('client_id', clientId);
		authorize.searchParams.set('redirect_uri', `${origin}/api/dream-callback`);
		authorize.searchParams.set('scope', 'read:user user:email');
		authorize.searchParams.set('state', state);

		return redirectWithCookies(authorize.toString(), [
			cookie(DREAM_OAUTH_STATE_COOKIE, state, 600),
			cookie(DREAM_OAUTH_PROVIDER_COOKIE, 'github', 600),
		]);
	}

	if (provider === 'google') {
		const clientId = envStr(env.GOOGLE_CLIENT_ID);
		const clientSecret = envStr(env.GOOGLE_CLIENT_SECRET);
		const present = {
			GOOGLE_CLIENT_ID: !!clientId,
			GOOGLE_CLIENT_SECRET: !!clientSecret,
		};
		const missing = missingList(present);
		if (missing) {
			return plain(
				`Google sign-in missing env: ${missing}. ` +
					`Present: ${
						Object.entries(present)
							.filter(([, ok]) => ok)
							.map(([n]) => n)
							.join(', ') || '(none)'
					}. ` +
					`Fix the name/value in Cloudflare → Variables and secrets, then Redeploy.`,
			);
		}
		if (!looksLikeClientId(clientId) || !clientId.includes('.apps.googleusercontent.com')) {
			return plain(
				`GOOGLE_CLIENT_ID does not look like a Google OAuth client ID (should end with .apps.googleusercontent.com). Check the value in Cloudflare.`,
			);
		}

		const authorize = new URL('https://accounts.google.com/o/oauth2/v2/auth');
		authorize.searchParams.set('client_id', clientId);
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

	return plain('Use ?provider=github or ?provider=google', 400);
};
