# aditi's universe

Personal site for **aditirk.me**: Astro 6, Tailwind v4, content-driven pages, dual themes (Universe / Beach), and optional Cloudflare-backed visitor analytics with a WebGL globe.

## Requirements

- **Node.js** ≥ 22.12

## Quick start

```bash
npm install
npm run dev
```

- Local dev: [http://localhost:4321](http://localhost:4321)
- Production build output: **`dist/`** (static HTML + assets)

```bash
npm run build
npm run preview   # optional: serve dist locally
```

## Documentation

| Resource | Description |
| -------- | ----------- |
| [**Website guide**](docs/website-guide.md) | Full documentation: architecture, content, theming, env vars, deployment, visitor APIs |
| [**Docs index**](docs/README.md) | Short map of all doc topics |
| [`public/visitor-map/README.txt`](public/visitor-map/README.txt) | Visitor globe + KV setup cheat sheet |

## Tech stack (short)

- [Astro](https://astro.build/) 6 — static site, islands-friendly
- [Tailwind CSS](https://tailwindcss.com/) 4 — `@tailwindcss/vite`
- [GSAP](https://greensock.com/gsap/) + [Lenis](https://lenis.darkroom.engineering/) — motion and smooth scroll
- [globe.gl](https://github.com/vasturiano/globe.gl) / [three.js](https://threejs.org/) — homepage visitor globe
- [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/) + **KV** — `/api/visit`, `/api/stats`, `/api/admin/stats`, optional **`/api/checkout`** (Stripe)

## Deploy (Cloudflare Pages)

1. Connect the repo (or upload **`dist`** + **`functions/`**).
2. Build command: **`npm run build`**, output directory: **`dist`**.
3. Bind **KV** as **`VISITOR_KV`**; set secret **`ADMIN_STATS_SECRET`** for the private admin stats page.
4. See [docs/website-guide.md § Deployment](docs/website-guide.md#deployment-cloudflare-pages) for details.
5. **Stripe Checkout (optional):** set `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, and `PUBLIC_STRIPE_CHECKOUT=true` (see [`env.example`](env.example)). Test the `/api/checkout` function with `npx wrangler pages dev ./dist` after `npm run build`.

## License

Private / personal project unless otherwise noted by the owner.
