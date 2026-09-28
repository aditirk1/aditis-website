/**
 * Quick capture for Thoughts — one textbox on /quick (or an iOS Shortcut)
 * commits a Markdown file straight to src/content/thoughts/ on GitHub.
 *
 * GET  /api/quick-thought        — { canPost } for the signed-in viewer
 * POST /api/quick-thought        — { body, localDate?: "YYYY-MM-DD", draft?: boolean }
 *
 * Who may post (either):
 *   - Site session (Google/GitHub via /api/dream-auth) whose sub is listed in
 *     QUICK_POST_SUBS, falling back to COMMENT_ADMIN_SUBS.
 *   - Authorization: Bearer QUICK_POST_TOKEN (for iOS Shortcuts / curl).
 *
 * Commits with GITHUB_CONTENT_TOKEN: a fine-grained PAT scoped to this repo
 * with Contents: Read and write. Output matches the Sveltia `thoughts`
 * collection (date + draft frontmatter), so entries stay editable in /admin.
 */
import { corsOptions, forbidCrossOrigin, json } from '../_shared/cors';
import { sessionFromRequest } from '../_shared/dream-session';
import { bearerMatches, rateLimit } from '../_shared/security';

interface Env {
	VISITOR_KV?: KVNamespace;
	DREAM_SESSION_SECRET?: string;
	QUICK_POST_SUBS?: string;
	COMMENT_ADMIN_SUBS?: string;
	QUICK_POST_TOKEN?: string;
	GITHUB_CONTENT_TOKEN?: string;
	/** Defaults to aditirk1/aditis-website */
	GITHUB_CONTENT_REPO?: string;
	GITHUB_CONTENT_BRANCH?: string;
}

const MAX_BODY = 5000;
const THOUGHTS_DIR = 'src/content/thoughts';

function allowedSubs(env: Env): string[] {
	const raw = env.QUICK_POST_SUBS?.trim() || env.COMMENT_ADMIN_SUBS || '';
	return raw
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
}

async function canPost(request: Request, env: Env): Promise<boolean> {
	if (await bearerMatches(request, env.QUICK_POST_TOKEN)) return true;
	const session = await sessionFromRequest(request, env.DREAM_SESSION_SECRET);
	return !!session && allowedSubs(env).includes(session.sub);
}

function isoDate(raw: unknown): string {
	if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
	return new Date().toISOString().slice(0, 10);
}

function utf8ToBase64(text: string): string {
	const bytes = new TextEncoder().encode(text);
	let bin = '';
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin);
}

export const onRequestOptions: PagesFunction = async ({ request }) => corsOptions(request);

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
	const blocked = forbidCrossOrigin(request);
	if (blocked) return blocked;
	const session = await sessionFromRequest(request, env.DREAM_SESSION_SECRET);
	return json(
		{
			ok: true,
			authenticated: !!session,
			canPost: await canPost(request, env),
			configured: !!env.GITHUB_CONTENT_TOKEN?.trim(),
		},
		200,
		request,
	);
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
	const blocked = forbidCrossOrigin(request);
	if (blocked) return blocked;

	const limited = await rateLimit(env.VISITOR_KV, request, { bucket: 'quick-thought', limit: 10, windowS: 300 });
	if (limited) return limited;

	if (!(await canPost(request, env))) {
		return json({ ok: false, error: 'Not allowed to post.' }, 403, request);
	}

	const token = env.GITHUB_CONTENT_TOKEN?.trim();
	if (!token) {
		return json({ ok: false, error: 'GITHUB_CONTENT_TOKEN is not set on Cloudflare Pages.' }, 503, request);
	}

	let payload: { body?: unknown; localDate?: unknown; draft?: unknown };
	try {
		payload = (await request.json()) as typeof payload;
	} catch {
		return json({ ok: false, error: 'Invalid JSON.' }, 400, request);
	}

	const body = (typeof payload.body === 'string' ? payload.body : '').replace(/\r\n/g, '\n').trim();
	if (!body) return json({ ok: false, error: 'Write something first.' }, 400, request);
	if (body.length > MAX_BODY) {
		return json({ ok: false, error: `Keep it under ${MAX_BODY} characters.` }, 400, request);
	}

	const date = isoDate(payload.localDate);
	const draft = payload.draft === true;
	const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, '');
	const slug = `${date}-${stamp}`;
	const path = `${THOUGHTS_DIR}/${slug}.md`;
	const file = `---\ndate: ${date}\ndraft: ${draft}\n---\n\n${body}\n`;

	const repo = env.GITHUB_CONTENT_REPO?.trim() || 'aditirk1/aditis-website';
	const branch = env.GITHUB_CONTENT_BRANCH?.trim() || 'main';
	const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
		method: 'PUT',
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28',
			'Content-Type': 'application/json',
			'User-Agent': 'aditirk.me-quick-thought',
		},
		body: JSON.stringify({
			message: `content: add thoughts "${slug}"`,
			content: utf8ToBase64(file),
			branch,
		}),
	});

	if (!res.ok) {
		const detail = (await res.json().catch(() => ({}))) as { message?: string };
		return json(
			{ ok: false, error: `GitHub rejected the commit (${res.status}): ${detail.message ?? 'unknown error'}` },
			res.status === 401 || res.status === 403 ? 503 : 400,
			request,
		);
	}

	return json({ ok: true, slug, url: `/thoughts/${slug}`, draft }, 201, request);
};
