/**
 * List dream entries — requires valid dream_session cookie.
 * Bodies are never in the static HTML build.
 */
import { corsOptions, forbidCrossOrigin, json } from '../_shared/cors';
import { sessionFromRequest } from '../_shared/dream-session';
import { getDreamBundle } from '../_shared/dreams-store';

interface Env {
	DREAM_SESSION_SECRET?: string;
}

export const onRequestOptions: PagesFunction = async ({ request }) => corsOptions(request);

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
	const blocked = forbidCrossOrigin(request);
	if (blocked) return blocked;

	const session = await sessionFromRequest(request, env.DREAM_SESSION_SECRET);
	if (!session) {
		return json({ ok: false, error: 'unauthorized' }, 401, request);
	}

	const { entries, generatedAt } = getDreamBundle();
	return json(
		{
			ok: true,
			generatedAt,
			entries: entries.map((e) => ({
				id: e.id,
				date: e.date,
				mood: e.mood ?? null,
				preview: e.preview,
			})),
		},
		200,
		request,
	);
};
