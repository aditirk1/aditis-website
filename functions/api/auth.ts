/**
 * GitHub OAuth, step 1 of 2, for Decap CMS at /admin/.
 *
 * GitHub requires the authorization code to be exchanged for a token using a
 * client secret, which cannot live in the browser. This function starts the
 * flow; `callback.ts` finishes it. Both run on Cloudflare Pages for free.
 *
 * Requires GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in the Pages environment.
 */
interface Env {
	GITHUB_CLIENT_ID?: string;
	GITHUB_CLIENT_SECRET?: string;
}

/** `repo` covers private repositories too; narrow to `public_repo` if yours is public. */
const SCOPE = 'repo,user';

export const STATE_COOKIE = 'decap_oauth_state';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
	if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
		return new Response('GitHub sign-in is not configured for this site.', {
			status: 503,
			headers: { 'Content-Type': 'text/plain; charset=utf-8' },
		});
	}

	const origin = new URL(request.url).origin;

	// Guards against an attacker completing the flow with their own code.
	const state = crypto.randomUUID().replace(/-/g, '');

	const authorize = new URL('https://github.com/login/oauth/authorize');
	authorize.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
	authorize.searchParams.set('redirect_uri', `${origin}/api/callback`);
	authorize.searchParams.set('scope', SCOPE);
	authorize.searchParams.set('state', state);

	return new Response(null, {
		status: 302,
		headers: {
			Location: authorize.toString(),
			'Set-Cookie': `${STATE_COOKIE}=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
			'Cache-Control': 'no-store',
		},
	});
};
