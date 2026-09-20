/**
 * Dream/site session status + logout.
 */
import { corsOptions, forbidCrossOrigin, json } from '../_shared/cors';
import {
	DREAM_SESSION_COOKIE,
	clearCookieHeader,
	sessionFromRequest,
} from '../_shared/dream-session';

interface Env {
	DREAM_SESSION_SECRET?: string;
	COMMENT_ADMIN_SUBS?: string;
}

function isAdminSub(sub: string, env: Env): boolean {
	const allow = (env.COMMENT_ADMIN_SUBS ?? '')
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
	return allow.includes(sub);
}

export const onRequestOptions: PagesFunction = async ({ request }) => corsOptions(request);

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
	const blocked = forbidCrossOrigin(request);
	if (blocked) return blocked;

	const session = await sessionFromRequest(request, env.DREAM_SESSION_SECRET);
	if (!session) {
		return json({ ok: true, authenticated: false, isAdmin: false }, 200, request);
	}
	return json(
		{
			ok: true,
			authenticated: true,
			provider: session.provider,
			name: session.name ?? null,
			sub: session.sub,
			isAdmin: isAdminSub(session.sub, env),
		},
		200,
		request,
	);
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
	const blocked = forbidCrossOrigin(request);
	if (blocked) return blocked;
	void env;

	const headers = new Headers({
		'Content-Type': 'application/json; charset=utf-8',
		'Cache-Control': 'no-store',
	});
	headers.append('Set-Cookie', clearCookieHeader(DREAM_SESSION_COOKIE));
	return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
};
