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
	/** Counter generation — see readAgg. */
	epoch?: string;
}

const KEY = 'visitor:agg:v1';

function emptyAgg(epoch: string): VisitorAgg {
	return { total: 0, byCountry: {}, byCityKey: {}, epoch };
}

/**
 * Reads the aggregate, discarding it when it belongs to an older generation.
 *
 * Filtering can only change what gets counted from here on; totals already
 * inflated by deploy checks and editor previews live in KV until something
 * clears them. Setting (or changing) VISITOR_COUNT_EPOCH in the Pages
 * environment starts a clean count without touching KV by hand.
 */
export async function readAgg(kv: KVNamespace, epoch = ''): Promise<VisitorAgg> {
	const raw = await kv.get(KEY, 'json');
	if (!raw || typeof raw !== 'object') {
		return emptyAgg(epoch);
	}
	const o = raw as Record<string, unknown>;
	if ((typeof o.epoch === 'string' ? o.epoch : '') !== epoch) {
		return emptyAgg(epoch);
	}
	return {
		total: Number(o.total) || 0,
		byCountry: (o.byCountry as Record<string, number>) ?? {},
		byCityKey: (o.byCityKey as VisitorAgg['byCityKey']) ?? {},
		epoch,
	};
}

export async function writeAgg(kv: KVNamespace, agg: VisitorAgg): Promise<void> {
	await kv.put(KEY, JSON.stringify(agg));
}
