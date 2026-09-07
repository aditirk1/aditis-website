import { readAgg, writeAgg } from '../_shared/agg';
import { corsOptions, forbidCrossOrigin, json } from '../_shared/cors';
import { shouldRecordVisitRequest } from '../_shared/visit-filter';

interface Env {
	VISITOR_KV: KVNamespace;
}

export const onRequestOptions: PagesFunction<Env> = async ({ request }) => corsOptions(request);

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
	const blocked = forbidCrossOrigin(request);
	if (blocked) return blocked;

	if (!env.VISITOR_KV) {
		return json({ ok: false, error: 'VISITOR_KV not configured' }, 503, request);
	}

	const gated = shouldRecordVisitRequest(request);
	if (!gated.ok) {
		return json({ ok: true, recorded: false, reason: gated.reason }, 200, request);
	}

	const cf = request.cf as IncomingRequestCfProperties | undefined;
	const country = cf?.country?.toUpperCase();
	if (!country || country === 'XX' || country === 'T1') {
		return json({ ok: true, recorded: false, reason: 'no-geo' }, 200, request);
	}

	const cityRaw = cf?.city;
	const city =
		typeof cityRaw === 'string' && cityRaw.length > 0 && cityRaw.toLowerCase() !== 'null'
			? cityRaw
			: undefined;
	/* State / province when Cloudflare has it (e.g. "California"). */
	const regionRaw = cf?.region;
	const region =
		typeof regionRaw === 'string' && regionRaw.length > 0 && regionRaw.toLowerCase() !== 'null'
			? regionRaw
			: undefined;

	const agg = await readAgg(env.VISITOR_KV);
	agg.total += 1;
	agg.byCountry[country] = (agg.byCountry[country] ?? 0) + 1;
	/* Prefer city+region rows; if we only got a region, still tally it for hover labels. */
	if (city) {
		const ck = `${country}|${city}`;
		const cur = agg.byCityKey[ck];
		if (cur) {
			cur.count += 1;
			if (region && !cur.region) cur.region = region;
		} else {
			agg.byCityKey[ck] = { country, city, count: 1, ...(region ? { region } : {}) };
		}
	} else if (region) {
		const ck = `${country}|__region__:${region}`;
		const cur = agg.byCityKey[ck];
		if (cur) cur.count += 1;
		else agg.byCityKey[ck] = { country, city: region, count: 1, region };
	}
	await writeAgg(env.VISITOR_KV, agg);
	return json({ ok: true, recorded: true }, 200, request);
};
