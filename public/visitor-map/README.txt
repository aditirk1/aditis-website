Custom visitor globe + counts (no third-party globe embed)

Public homepage
  - Rotating WebGL globe (globe.gl) with amber pins at country centroids.
  - Total visits from your own API (/api/stats).

Edge backend (Cloudflare Pages Functions + KV)
  - Bind a KV namespace as VISITOR_KV (Production + Preview).
  - POST /api/visit — increments total, country, and city (when Cloudflare provides city on the request).
  - GET /api/stats — returns { total, markers } for the globe (country-level only).
  - Secret ADMIN_STATS_SECRET — used for GET /api/admin/stats (Bearer token).

Private breakdown
  - Open /admin/visitors (not linked in nav; add noindex). Paste the admin secret and load
    country + city tables.

Local / Astro dev
  - astro dev does not run Pages Functions; the widget shows a demo globe until you deploy
    or run: npm run build && npx wrangler pages dev ./dist
    (KV binding must be set in wrangler.toml with a real namespace id.)

wrangler.toml
  - Set the real KV namespace id from the dashboard (or wrangler kv namespace create).

Optional env
  - PUBLIC_VISITOR_API_BASE — only if the browser must call another origin for /api/*.
