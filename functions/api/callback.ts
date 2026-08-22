/**
 * GitHub OAuth, step 2 of 2, for Decap CMS at /admin/.
 *
 * Exchanges the authorization code for an access token, then hands it to the
 * Decap window that opened this popup using the handshake Decap expects:
 * the popup announces `authorizing:github`, and replies to the opener's
 * acknowledgement with the token.
 *
 * Set the GitHub OAuth app's callback URL to https://<your-domain>/api/callback
 */
import { STATE_COOKIE } from './auth';

interface Env {
	GITHUB_CLIENT_ID?: string;
	GITHUB_CLIENT_SECRET?: string;
}

function readCookie(header: string | null, name: string): string | null {
	if (!header) return null;
	for (const part of header.split(';')) {
		const [key, ...rest] = part.trim().split('=');
		if (key === name) return rest.join('=');
	}
	return null;
}

/** Inline script data must never be able to close the script tag. */
function safeJson(value: unknown): string {
	return JSON.stringify(value).replace(/</g, '\\u003c');
}

function handshakePage(payload: string, origin: string): Response {
	const html = `<!doctype html>
<html lang="en">
	<head><meta charset="utf-8" /><title>Signing in…</title></head>
	<body style="font:16px system-ui;padding:2rem">
		<p>Completing sign-in…</p>
		<script>
			(function () {
				var payload = ${safeJson(payload)};
				var origin = ${safeJson(origin)};
				if (!window.opener) {
					document.body.textContent = 'Open the CMS at /admin/ and sign in from there.';
					return;
				}
				window.addEventListener('message', function (e) {
					if (e.origin !== origin) return;
					window.opener.postMessage(payload, origin);
				}, false);
				window.opener.postMessage('authorizing:github', origin);
			})();
		</script>
	</body>
</html>`;

	return new Response(html, {
		headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
	});
}

function errorPage(message: string, status: number): Response {
	return new Response(
		`<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>Sign-in failed</title></head>` +
			`<body style="font:16px system-ui;padding:2rem"><h1>Sign-in failed</h1><p>${message}</p>` +
			`<p><a href="/admin/">Back to the CMS</a></p></body></html>`,
		{ status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
	);
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
	if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
		return errorPage('GitHub sign-in is not configured for this site.', 503);
	}

	const url = new URL(request.url);
	const origin = url.origin;

	const denied = url.searchParams.get('error_description') ?? url.searchParams.get('error');
	if (denied) return errorPage(`GitHub declined the request: ${denied}`, 400);

	const code = url.searchParams.get('code');
	if (!code) {
		// Usually: opened /api/callback directly, or a Cloudflare redirect stripped ?code=
		const keys = [...url.searchParams.keys()].join(', ') || '(none)';
		return errorPage(
			`GitHub did not return an authorization code. Query params received: ${keys}. ` +
				`Start again from /admin/ (Login with GitHub). ` +
				`Confirm the OAuth app callback is exactly https://aditirk.me/api/callback ` +
				`and that Cloudflare is not redirecting /api/callback in a way that drops the query string.`,
			400,
		);
	}

	const expectedState = readCookie(request.headers.get('Cookie'), STATE_COOKIE);
	if (!expectedState || url.searchParams.get('state') !== expectedState) {
		return errorPage('This sign-in link has expired. Please try again from /admin/.', 400);
	}

	const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json',
			'User-Agent': 'aditirk.me-decap-auth',
		},
		body: JSON.stringify({
			client_id: env.GITHUB_CLIENT_ID,
			client_secret: env.GITHUB_CLIENT_SECRET,
			code,
			redirect_uri: `${origin}/api/callback`,
		}),
	});

	if (!tokenRes.ok) {
		return errorPage('GitHub rejected the token exchange. Please try again.', 502);
	}

	const data = (await tokenRes.json()) as { access_token?: string; error_description?: string };
	if (!data.access_token) {
		return errorPage(data.error_description ?? 'GitHub did not return an access token.', 502);
	}

	const payload = `authorization:github:success:${JSON.stringify({
		token: data.access_token,
		provider: 'github',
	})}`;

	const response = handshakePage(payload, origin);
	// One-time use: the state cookie is spent.
	response.headers.append(
		'Set-Cookie',
		`${STATE_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
	);
	return response;
};
