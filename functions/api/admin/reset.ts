import { writeAgg } from '../../_shared/agg';
import { corsOptions, forbidCrossOrigin, json } from '../../_shared/cors';

interface Env {
	VISITOR_KV: KVNamespace;
	ADMIN_STATS_SECRET: string;
	VISITOR_COUNT_EPOCH?: string;
}

export const onRequestOptions: PagesFunction<Env> = async ({ request }) => corsOptions(request);

/**
 * Wipes the visitor aggregate.
 *
 * curl -X POST https://aditirk.me/api/admin/reset -H "Authorization: Bearer $ADMIN_STATS_SECRET"
 *
 * Prefer changing VISITOR_COUNT_EPOCH in the Pages environment if you'd rather
 * not deal with a secret — same effect, no request needed.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
	const blocked = forbidCrossOrigin(request);
	if (blocked) return blocked;

	const secret = env.ADMIN_STATS_SECRET ?? '';
	const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
	if (!secret || token !== secret) {
		return json({ error: 'Unauthorized' }, 401, request);
	}

	if (!env.VISITOR_KV) {
		return json({ ok: false, error: 'VISITOR_KV not configured' }, 503, request);
	}

	await writeAgg(env.VISITOR_KV, {
		total: 0,
		byCountry: {},
		byCityKey: {},
		epoch: env.VISITOR_COUNT_EPOCH ?? '',
	});
	return json({ ok: true, reset: true }, 200, request);
};
