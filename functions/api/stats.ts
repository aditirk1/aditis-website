import { readAgg } from '../_shared/agg';
import { corsOptions, json } from '../_shared/cors';

interface Env {
	VISITOR_KV: KVNamespace;
}

interface Marker {
	lat: number;
	lng: number;
	count: number;
	country: string;
	region?: string;
}

export const onRequestOptions: PagesFunction<Env> = async ({ request }) => corsOptions(request);

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
	if (!env.VISITOR_KV) {
		return json({ total: 0, markers: [] }, 200, request);
	}

	const agg = await readAgg(env.VISITOR_KV);

	/*
	 * Rows carrying coordinates get a pin where the visit actually happened,
	 * rolled up per state/province so several cities in one region share a pin.
	 */
	const grouped = new Map<
		string,
		{ country: string; region?: string; count: number; latSum: number; lngSum: number }
	>();

	for (const row of Object.values(agg.byCityKey)) {
		if (typeof row.lat !== 'number' || typeof row.lng !== 'number') continue;
		const label = row.region ?? row.city ?? undefined;
		const key = `${row.country}|${label ?? ''}`;
		const cur = grouped.get(key);
		if (cur) {
			cur.count += row.count;
			cur.latSum += row.lat * row.count;
			cur.lngSum += row.lng * row.count;
		} else {
			grouped.set(key, {
				country: row.country,
				region: label,
				count: row.count,
				latSum: row.lat * row.count,
				lngSum: row.lng * row.count,
			});
		}
	}

	/*
	 * Only pins we can actually place, so every label reads "Region, Country".
	 * Visits without a region (older rows, or geo Cloudflare couldn't resolve)
	 * still land in the total — a pin at the country centroid would just be a
	 * confident-looking guess in the middle of nowhere.
	 */
	const markers: Marker[] = [];
	for (const g of grouped.values()) {
		if (!g.region) continue;
		markers.push({
			lat: g.latSum / g.count,
			lng: g.lngSum / g.count,
			count: g.count,
			country: g.country,
			region: g.region,
		});
	}

	return json({ total: agg.total, markers }, 200, request);
};
