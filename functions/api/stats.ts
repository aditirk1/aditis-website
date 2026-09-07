import { readAgg } from '../_shared/agg';
import { countryCentroid } from '../_shared/centroids';
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
	const placedPerCountry = new Map<string, number>();

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
		placedPerCountry.set(row.country, (placedPerCountry.get(row.country) ?? 0) + row.count);
	}

	const markers: Marker[] = [];
	for (const g of grouped.values()) {
		markers.push({
			lat: g.latSum / g.count,
			lng: g.lngSum / g.count,
			count: g.count,
			country: g.country,
			...(g.region ? { region: g.region } : {}),
		});
	}

	/* Visits recorded before coordinates were captured still need a pin. */
	for (const [country, count] of Object.entries(agg.byCountry)) {
		const leftover = count - (placedPerCountry.get(country) ?? 0);
		if (leftover <= 0) continue;
		const c = countryCentroid(country);
		if (!c) continue;
		markers.push({ lat: c[0], lng: c[1], count: leftover, country });
	}

	return json({ total: agg.total, markers }, 200, request);
};
