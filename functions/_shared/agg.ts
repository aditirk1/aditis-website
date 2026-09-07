export interface VisitorAgg {
	total: number;
	byCountry: Record<string, number>;
	/**
	 * City rollup. `region` is state/province and `lat`/`lng` are coarse
	 * coordinates (1 decimal, ~11km) — both present only for visits recorded
	 * after those fields were captured.
	 */
	byCityKey: Record<
		string,
		{ country: string; city: string; count: number; region?: string; lat?: number; lng?: number }
	>;
}

const KEY = 'visitor:agg:v1';

export async function readAgg(kv: KVNamespace): Promise<VisitorAgg> {
	const raw = await kv.get(KEY, 'json');
	if (!raw || typeof raw !== 'object') {
		return { total: 0, byCountry: {}, byCityKey: {} };
	}
	const o = raw as Record<string, unknown>;
	return {
		total: Number(o.total) || 0,
		byCountry: (o.byCountry as Record<string, number>) ?? {},
		byCityKey: (o.byCityKey as VisitorAgg['byCityKey']) ?? {},
	};
}

export async function writeAgg(kv: KVNamespace, agg: VisitorAgg): Promise<void> {
	await kv.put(KEY, JSON.stringify(agg));
}
