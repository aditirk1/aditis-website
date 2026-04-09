/// <reference types="astro/client" />

/** Optional PUBLIC_* vars — set in .env locally and in Cloudflare Pages → Settings → Environment variables */
interface ImportMetaEnv {
	readonly PUBLIC_WEB3FORMS_ACCESS_KEY?: string;
	readonly PUBLIC_UMAMI_SCRIPT_URL?: string;
	readonly PUBLIC_UMAMI_WEBSITE_ID?: string;
	/** Optional origin for visitor APIs if not same-origin (default: relative /api/*) */
	readonly PUBLIC_VISITOR_API_BASE?: string;
	/** When `"true"`, Services shows a Stripe Checkout button (requires server-side Stripe env on deploy). */
	readonly PUBLIC_STRIPE_CHECKOUT?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
