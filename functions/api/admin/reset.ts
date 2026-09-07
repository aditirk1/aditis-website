import { writeAgg } from '../../_shared/agg';
import { corsOptions, forbidCrossOrigin, json } from '../../_shared/cors';

interface Env {
	VISITOR_KV: KVNamespace;
	ADMIN_STATS_SECRET: string;
}

export const onRequestOptions: PagesFunction<Env> = async ({ request }) => corsOptions(request);

/**
 * Wipes the visitor aggregate. Needed because filtering can only change what
 * gets counted from now on — totals inflated by deploy checks and edit previews
 * stay in KV until they're cleared.
 *
 * curl -X POST https://aditirk.me/api/admin/reset -H "Authorization: Bearer $ADMIN_STATS_SECRET"
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

	await writeAgg(env.VISITOR_KV, { total: 0, byCountry: {}, byCityKey: {} });
	return json({ ok: true, reset: true }, 200, request);
};
