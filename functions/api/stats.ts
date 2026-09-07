import { readAgg } from '../_shared/agg';
import { countryCentroid } from '../_shared/centroids';
import { corsOptions, json } from '../_shared/cors';

interface Env {
	VISITOR_KV: KVNamespace;
}

export const onRequestOptions: PagesFunction<Env> = async ({ request }) => corsOptions(request);

/** Pick the most-visited region (state/province) recorded for a country, if any. */
function topRegionForCountry(
	byCityKey: Record<string, { country: string; city: string; count: number; region?: string }>,
	country: string,
): string | undefined {
	const tallies = new Map<string, number>();
	for (const row of Object.values(byCityKey)) {
		if (row.country !== country || !row.region) continue;
		tallies.set(row.region, (tallies.get(row.region) ?? 0) + row.count);
	}
	let best: string | undefined;
	let bestN = 0;
	for (const [region, n] of tallies) {
		if (n > bestN) {
			best = region;
			bestN = n;
		}
	}
	return best;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
	if (!env.VISITOR_KV) {
		return json({ total: 0, markers: [] }, 200, request);
	}

	const agg = await readAgg(env.VISITOR_KV);
	const markers = Object.entries(agg.byCountry)
		.map(([country, count]) => {
			const c = countryCentroid(country);
			if (!c) return null;
			const region = topRegionForCountry(agg.byCityKey, country);
			return { lat: c[0], lng: c[1], count, country, ...(region ? { region } : {}) };
		})
		.filter((m): m is NonNullable<typeof m> => m !== null);

	return json({ total: agg.total, markers }, 200, request);
};
