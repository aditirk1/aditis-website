import { readAgg } from '../../_shared/agg';
import { corsOptions, json } from '../../_shared/cors';

interface Env {
	VISITOR_KV: KVNamespace;
	ADMIN_STATS_SECRET: string;
}

export const onRequestOptions: PagesFunction<Env> = async () => corsOptions();

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
	const secret = env.ADMIN_STATS_SECRET ?? '';
	const auth = request.headers.get('Authorization') ?? '';
	const token = auth.replace(/^Bearer\s+/i, '').trim();
	if (!secret || token !== secret) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				'Access-Control-Allow-Origin': '*',
			},
		});
	}

	if (!env.VISITOR_KV) {
		return json({ total: 0, countries: [], cities: [] });
	}

	const agg = await readAgg(env.VISITOR_KV);
	const countries = Object.entries(agg.byCountry)
		.map(([code, count]) => ({ code, count }))
		.sort((a, b) => b.count - a.count);
	const cities = Object.values(agg.byCityKey).sort((a, b) => b.count - a.count);

	return json({ total: agg.total, countries, cities });
};
