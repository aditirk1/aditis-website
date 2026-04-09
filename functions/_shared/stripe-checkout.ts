/**
 * Create a Stripe Checkout Session using fetch (Cloudflare Workers–compatible).
 * @see https://stripe.com/docs/api/checkout/sessions/create
 */
export type CreateCheckoutInput = {
	secretKey: string;
	priceId: string;
	successUrl: string;
	cancelUrl: string;
	quantity?: number;
};

export type CreateCheckoutResult =
	| { ok: true; url: string }
	| { ok: false; message: string; status?: number };

export async function createStripeCheckoutSession(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
	const body = new URLSearchParams();
	body.set('mode', 'payment');
	body.set('success_url', input.successUrl);
	body.set('cancel_url', input.cancelUrl);
	body.set('line_items[0][price]', input.priceId);
	body.set('line_items[0][quantity]', String(input.quantity ?? 1));

	const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${input.secretKey}`,
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body,
	});

	const data = (await res.json()) as { url?: string; error?: { message?: string; type?: string } };

	if (!res.ok || data.error) {
		const msg = data.error?.message ?? `Stripe HTTP ${res.status}`;
		return { ok: false, message: msg, status: res.status >= 400 && res.status < 600 ? res.status : 502 };
	}
	if (!data.url) {
		return { ok: false, message: 'No checkout URL returned from Stripe.' };
	}
	return { ok: true, url: data.url };
}
