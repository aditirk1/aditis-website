/**
 * Single dream entry — requires valid dream_session cookie.
 */
import { corsOptions, forbidCrossOrigin, json } from '../../_shared/cors';
import { sessionFromRequest } from '../../_shared/dream-session';
import { findDream } from '../../_shared/dreams-store';

interface Env {
	DREAM_SESSION_SECRET?: string;
}

export const onRequestOptions: PagesFunction = async ({ request }) => corsOptions(request);

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
	const blocked = forbidCrossOrigin(request);
	if (blocked) return blocked;

	const session = await sessionFromRequest(request, env.DREAM_SESSION_SECRET);
	if (!session) {
		return json({ ok: false, error: 'unauthorized' }, 401, request);
	}

	const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';
	if (!id) return json({ ok: false, error: 'missing id' }, 400, request);

	const entry = findDream(id);
	if (!entry) return json({ ok: false, error: 'not found' }, 404, request);

	return json(
		{
			ok: true,
			entry: {
				id: entry.id,
				date: entry.date,
				mood: entry.mood ?? null,
				html: entry.html,
			},
		},
		200,
		request,
	);
};
