import { readAgg } from '../../_shared/agg';
import { corsOptions, forbidCrossOrigin, json } from '../../_shared/cors';

interface Env {
	VISITOR_KV: KVNamespace;
	ADMIN_STATS_SECRET: string;
	VISITOR_COUNT_EPOCH?: string;
}

export const onRequestOptions: PagesFunction<Env> = async ({ request }) => corsOptions(request);

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
	const blocked = forbidCrossOrigin(request);
	if (blocked) return blocked;

	const secret = env.ADMIN_STATS_SECRET ?? '';
	const auth = request.headers.get('Authorization') ?? '';
	const token = auth.replace(/^Bearer\s+/i, '').trim();
	if (!secret || token !== secret) {
		return json({ error: 'Unauthorized' }, 401, request);
	}

	if (!env.VISITOR_KV) {
		return json({ total: 0, countries: [], cities: [] }, 200, request);
	}

	const agg = await readAgg(env.VISITOR_KV, env.VISITOR_COUNT_EPOCH ?? '');
	const countries = Object.entries(agg.byCountry)
		.map(([code, count]) => ({ code, count }))
		.sort((a, b) => b.count - a.count);
	const cities = Object.values(agg.byCityKey).sort((a, b) => b.count - a.count);

	return json({ total: agg.total, countries, cities }, 200, request);
};
