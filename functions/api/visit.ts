import { readAgg, writeAgg } from '../_shared/agg';
import { corsOptions, forbidCrossOrigin, json } from '../_shared/cors';
import { shouldRecordVisitRequest, visitorDayHash } from '../_shared/visit-filter';

interface Env {
	VISITOR_KV: KVNamespace;
	/** Change this in the Pages environment to start the count over. */
	VISITOR_COUNT_EPOCH?: string;
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

	/*
	 * One count per visitor per day. The client's sessionStorage guard only
	 * covers a single tab, so repeat loads — a deploy check, a rebuild, an editor
	 * preview — kept adding "visitors" until this landed.
	 */
	const epoch = env.VISITOR_COUNT_EPOCH ?? '';

	const dayHash = await visitorDayHash(request);
	if (dayHash) {
		/* Epoch in the key so a reset also clears today's dedupe. */
		const seenKey = `visitor:seen:v1:${epoch}:${dayHash}`;
		if (await env.VISITOR_KV.get(seenKey)) {
			return json({ ok: true, recorded: false, reason: 'counted-today' }, 200, request);
		}
		await env.VISITOR_KV.put(seenKey, '1', { expirationTtl: 60 * 60 * 26 });
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

	/*
	 * Coarse coordinates so a pin lands on the actual region rather than the
	 * country centroid. One decimal (~11km) keeps this well short of pinpointing
	 * anyone while still putting New York in New York.
	 */
	const coord = (raw: unknown): number | undefined => {
		const n = typeof raw === 'string' ? Number.parseFloat(raw) : typeof raw === 'number' ? raw : NaN;
		return Number.isFinite(n) ? Math.round(n * 10) / 10 : undefined;
	};
	const lat = coord(cf?.latitude);
	const lng = coord(cf?.longitude);
	const coords = lat !== undefined && lng !== undefined ? { lat, lng } : {};

	const agg = await readAgg(env.VISITOR_KV, epoch);
	agg.total += 1;
	agg.byCountry[country] = (agg.byCountry[country] ?? 0) + 1;
	/* Prefer city+region rows; if we only got a region, still tally it for hover labels. */
	const cityKey = city ? `${country}|${city}` : region ? `${country}|__region__:${region}` : null;
	if (cityKey) {
		const cur = agg.byCityKey[cityKey];
		if (cur) {
			cur.count += 1;
			if (region && !cur.region) cur.region = region;
			if (cur.lat === undefined && lat !== undefined) cur.lat = lat;
			if (cur.lng === undefined && lng !== undefined) cur.lng = lng;
		} else {
			agg.byCityKey[cityKey] = {
				country,
				city: city ?? region ?? '',
				count: 1,
				...(region ? { region } : {}),
				...coords,
			};
		}
	}
	await writeAgg(env.VISITOR_KV, agg);
	return json({ ok: true, recorded: true }, 200, request);
};
