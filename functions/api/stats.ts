import { readAgg } from '../_shared/agg';
import { countryCentroid } from '../_shared/centroids';
import { corsOptions, json } from '../_shared/cors';

interface Env {
	VISITOR_KV: KVNamespace;
}

export const onRequestOptions: PagesFunction<Env> = async ({ request }) => corsOptions(request);

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
	if (!env.VISITOR_KV) {
		return json({ total: 0, markers: [] }, 200, request);
	}

	const agg = await readAgg(env.VISITOR_KV);
	const markers = Object.entries(agg.byCountry)
		.map(([country, count]) => {
			const c = countryCentroid(country);
			if (!c) return null;
			return { lat: c[0], lng: c[1], count, country };
		})
		.filter((m): m is NonNullable<typeof m> => m !== null);

	return json({ total: agg.total, markers }, 200, request);
};
