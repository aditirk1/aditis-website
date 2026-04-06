import { readAgg, writeAgg } from '../_shared/agg';
import { corsOptions, json } from '../_shared/cors';

interface Env {
	VISITOR_KV: KVNamespace;
}

export const onRequestOptions: PagesFunction<Env> = async () => corsOptions();

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
	if (!env.VISITOR_KV) {
		return json({ ok: false, error: 'VISITOR_KV not configured' }, 503);
	}

	const cf = request.cf as IncomingRequestCfProperties | undefined;
	const country = cf?.country?.toUpperCase();
	if (!country || country === 'XX' || country === 'T1') {
		return json({ ok: true, recorded: false });
	}

	const cityRaw = cf?.city;
	const city =
		typeof cityRaw === 'string' && cityRaw.length > 0 && cityRaw.toLowerCase() !== 'null'
			? cityRaw
			: undefined;

	const agg = await readAgg(env.VISITOR_KV);
	agg.total += 1;
	agg.byCountry[country] = (agg.byCountry[country] ?? 0) + 1;
	if (city) {
		const ck = `${country}|${city}`;
		const cur = agg.byCityKey[ck];
		if (cur) cur.count += 1;
		else agg.byCityKey[ck] = { country, city, count: 1 };
	}
	await writeAgg(env.VISITOR_KV, agg);
	return json({ ok: true, recorded: true });
};
