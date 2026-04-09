import { corsOptions, json } from '../_shared/cors';
import { createStripeCheckoutSession } from '../_shared/stripe-checkout';

interface Env {
	STRIPE_SECRET_KEY?: string;
	/** Default Price ID from Stripe Dashboard (Products → Prices), e.g. price_xxx */
	STRIPE_PRICE_ID?: string;
}

export const onRequestOptions: PagesFunction<Env> = async () => corsOptions();

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
	const secret = env.STRIPE_SECRET_KEY?.trim();
	const defaultPrice = env.STRIPE_PRICE_ID?.trim();
	if (!secret || !defaultPrice) {
		return json(
			{
				ok: false,
				error: 'Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID on Cloudflare Pages.',
			},
			503,
		);
	}

	const priceId = defaultPrice;
	if (!priceId.startsWith('price_')) {
		return json({ ok: false, error: 'STRIPE_PRICE_ID must be a Price id (price_…).' }, 500);
	}

	const origin = new URL(request.url).origin;
	const successUrl = `${origin}/services/success?session_id={CHECKOUT_SESSION_ID}`;
	const cancelUrl = `${origin}/services?checkout=canceled`;

	const result = await createStripeCheckoutSession({
		secretKey: secret,
		priceId,
		successUrl,
		cancelUrl,
		quantity: 1,
	});

	if (!result.ok) {
		return json({ ok: false, error: result.message }, result.status && result.status !== 200 ? result.status : 502);
	}

	return json({ ok: true, url: result.url });
};
