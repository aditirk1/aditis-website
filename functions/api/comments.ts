/**
 * Comments for blog + thoughts.
 *
 * GET    /api/comments?scope=blog/slug     — list (public)
 * POST   /api/comments                    — { scope, body } (signed in)
 * DELETE /api/comments?scope=&id=         — admin only
 *
 * Storage: VISITOR_KV key comments:v1:{scope}
 * Admin: COMMENT_ADMIN_SUBS=github:123,google:456  (from /api/dream-session after you sign in)
 *   or header X-Admin-Secret: ADMIN_STATS_SECRET
 */
import { corsOptions, forbidCrossOrigin, json } from '../_shared/cors';
import { sessionFromRequest, type DreamSessionPayload } from '../_shared/dream-session';

interface Env {
	VISITOR_KV: KVNamespace;
	DREAM_SESSION_SECRET?: string;
	COMMENT_ADMIN_SUBS?: string;
	ADMIN_STATS_SECRET?: string;
}

export type SiteComment = {
	id: string;
	sub: string;
	name: string;
	provider: 'github' | 'google';
	body: string;
	createdAt: string;
};

const MAX_BODY = 2000;
const MAX_COMMENTS_PER_SCOPE = 200;

function kvKey(scope: string): string {
	return `comments:v1:${scope}`;
}

/** scope: blog/... or thoughts/... */
function normalizeScope(raw: string | null): string | null {
	if (!raw) return null;
	const s = raw.trim().replace(/^\/+/, '').replace(/\/+$/, '');
	if (!/^(blog|thoughts)\/[A-Za-z0-9/_-]+$/.test(s)) return null;
	if (s.length > 200) return null;
	return s;
}

function escapeBody(raw: string): string {
	return raw
		.replace(/\r\n/g, '\n')
		.trim()
		.slice(0, MAX_BODY);
}

function isAdmin(session: DreamSessionPayload | null, request: Request, env: Env): boolean {
	const secret = env.ADMIN_STATS_SECRET?.trim();
	if (secret && request.headers.get('X-Admin-Secret') === secret) return true;
	if (!session) return false;
	const allow = (env.COMMENT_ADMIN_SUBS ?? '')
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
	return allow.includes(session.sub);
}

async function readComments(kv: KVNamespace, scope: string): Promise<SiteComment[]> {
	const raw = await kv.get(kvKey(scope));
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw) as SiteComment[];
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

async function writeComments(kv: KVNamespace, scope: string, list: SiteComment[]): Promise<void> {
	await kv.put(kvKey(scope), JSON.stringify(list.slice(0, MAX_COMMENTS_PER_SCOPE)));
}

export const onRequestOptions: PagesFunction = async ({ request }) => corsOptions(request);

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
	const blocked = forbidCrossOrigin(request);
	if (blocked) return blocked;
	if (!env.VISITOR_KV) return json({ ok: false, error: 'KV not configured' }, 503, request);

	const url = new URL(request.url);
	const scope = normalizeScope(url.searchParams.get('scope'));
	if (!scope) return json({ ok: false, error: 'invalid scope' }, 400, request);

	const session = await sessionFromRequest(request, env.DREAM_SESSION_SECRET);
	const comments = await readComments(env.VISITOR_KV, scope);
	return json(
		{
			ok: true,
			scope,
			comments,
			authenticated: !!session,
			isAdmin: isAdmin(session, request, env),
			viewer: session
				? { name: session.name ?? null, provider: session.provider, sub: session.sub }
				: null,
		},
		200,
		request,
	);
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
	const blocked = forbidCrossOrigin(request);
	if (blocked) return blocked;
	if (!env.VISITOR_KV) return json({ ok: false, error: 'KV not configured' }, 503, request);

	const session = await sessionFromRequest(request, env.DREAM_SESSION_SECRET);
	if (!session) return json({ ok: false, error: 'unauthorized' }, 401, request);

	let payload: { scope?: string; body?: string };
	try {
		payload = (await request.json()) as { scope?: string; body?: string };
	} catch {
		return json({ ok: false, error: 'invalid json' }, 400, request);
	}

	const scope = normalizeScope(payload.scope ?? null);
	if (!scope) return json({ ok: false, error: 'invalid scope' }, 400, request);

	const body = escapeBody(typeof payload.body === 'string' ? payload.body : '');
	if (body.length < 1) return json({ ok: false, error: 'empty' }, 400, request);

	const list = await readComments(env.VISITOR_KV, scope);
	const comment: SiteComment = {
		id: crypto.randomUUID().replace(/-/g, ''),
		sub: session.sub,
		name: session.name?.trim() || (session.provider === 'github' ? 'GitHub user' : 'Google user'),
		provider: session.provider,
		body,
		createdAt: new Date().toISOString(),
	};
	list.unshift(comment);
	await writeComments(env.VISITOR_KV, scope, list);

	return json({ ok: true, comment }, 201, request);
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
	const blocked = forbidCrossOrigin(request);
	if (blocked) return blocked;
	if (!env.VISITOR_KV) return json({ ok: false, error: 'KV not configured' }, 503, request);

	const session = await sessionFromRequest(request, env.DREAM_SESSION_SECRET);
	if (!isAdmin(session, request, env)) {
		return json({ ok: false, error: 'forbidden' }, 403, request);
	}

	const url = new URL(request.url);
	const scope = normalizeScope(url.searchParams.get('scope'));
	const id = url.searchParams.get('id')?.trim();
	if (!scope || !id) return json({ ok: false, error: 'scope and id required' }, 400, request);

	const list = await readComments(env.VISITOR_KV, scope);
	const next = list.filter((c) => c.id !== id);
	if (next.length === list.length) return json({ ok: false, error: 'not found' }, 404, request);
	await writeComments(env.VISITOR_KV, scope, next);

	return json({ ok: true }, 200, request);
};
