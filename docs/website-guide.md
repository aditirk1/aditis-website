# Website guide

Complete reference for **aditi's universe** (aditirk.me): how the site is built, how content and features work, and how to deploy and operate it—especially the custom visitor globe and analytics APIs.

---

## Table of contents

1. [Overview](#overview)
2. [Repository layout](#repository-layout)
3. [Tech stack](#tech-stack)
4. [Development](#development)
5. [Content collections](#content-collections)
6. [Theming and layout](#theming-and-layout)
7. [Major features](#major-features)
8. [Scripts and client modules](#scripts-and-client-modules)
9. [Environment variables](#environment-variables)
10. [Visitor analytics (globe + APIs)](#visitor-analytics-globe--apis)
11. [Deployment (Cloudflare Pages)](#deployment-cloudflare-pages)
12. [Optional integrations](#optional-integrations)

---

## Overview

This project is a **static Astro site**: pages compile to HTML in `dist/`. Interactive behavior is added with client-side scripts (GSAP, Lenis, globe.gl, etc.). There is **no Node server** in production for the Astro app itself; dynamic behavior for visitor counts runs on **Cloudflare Pages Functions** at the edge when deployed there.

**Goals encoded in the codebase:**

- Readable, portfolio-adjacent pages (projects, blog, services, photos, thoughts).
- Strong visual identity: **Universe** vs **Beach** themes, starfield / beach backgrounds, dream-journal styling.
- **Privacy-conscious public stats**: globe pins only at **country centroids**; city-level detail is limited to an **authenticated admin view**.

---

## Repository layout

High-level map (not every file):

```text
aditis-website/
├── README.md                 # Quick start + links
├── docs/                     # This documentation
│   ├── README.md             # Docs index
│   └── website-guide.md      # This file
├── astro.config.mjs          # Astro + Tailwind (Vite plugin)
├── wrangler.toml             # Cloudflare Pages: output dir + KV binding name
├── package.json
├── functions/                # Cloudflare Pages Functions (edge)
│   ├── global.d.ts           # Workers types reference
│   ├── api/
│   │   ├── visit.ts          # POST — record visit from cf.* geo
│   │   ├── stats.ts          # GET — public totals + globe markers
│   │   └── admin/
│   │       └── stats.ts      # GET — country/city breakdown (Bearer secret)
│   └── _shared/              # KV aggregate helpers, CORS, country centroids
├── public/                   # Static assets (copied as-is)
│   ├── visitor-map/README.txt
│   ├── fonts/  photos/  audio/  …
│   └── …
└── src/
    ├── content.config.ts     # Content Layer collections + Zod schemas
    ├── content/              # Markdown per collection (blog, projects, …)
    ├── env.d.ts              # PUBLIC_* TypeScript env definitions
    ├── layouts/
    │   └── Layout.astro      # Shell: theme guard, nav, Lenis/GSAP, Umami optional
    ├── pages/                # File-based routes
    │   ├── index.astro
    │   ├── admin/visitors.astro   # Private stats UI (noindex)
    │   ├── blog/  projects/  …
    │   └── …
    ├── components/           # Astro components (maps, backgrounds, modals, …)
    ├── styles/
    │   └── global.css        # Tailwind v4 @theme tokens, theme variables
    ├── scripts/              # TS modules imported by pages/components
    └── utils/                # Content helpers, dream markdown, …
```

**Routing:** Anything under `src/pages/` becomes a URL path. Content in `src/content/` is loaded through **collections** defined in `src/content.config.ts`, not by file path alone.

---

## Tech stack

| Layer | Choice | Notes |
| ----- | ------ | ----- |
| Framework | **Astro 6** | Static output by default; `astro.config.mjs` wires **Tailwind v4** via `@tailwindcss/vite`. |
| Styling | **Tailwind CSS 4** | Theme tokens in `src/styles/global.css` (`@theme`, `data-theme`, `data-layout`). |
| Motion | **GSAP** + **ScrollTrigger** | Page reveals, nav underline, hero. |
| Scroll | **Lenis** | Smoother scrolling; integrated with ScrollTrigger in `Layout.astro`. |
| Markdown | **marked** (where used) | Dream journal and other prose pipelines. |
| Globe | **globe.gl** + **three** | Homepage visitor visualization. |
| Edge (optional) | **Cloudflare Pages Functions** + **KV** | Visit recording and aggregate stats. |
| Tooling | **wrangler**, **@cloudflare/workers-types** | Local Pages previews and TypeScript types for Functions. |

---

## Development

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # output → dist/
npm run preview  # serve dist
```

**Important:** `astro dev` does **not** execute Cloudflare Pages Functions. The homepage visitor widget calls `/api/visit` and `/api/stats`; in local dev those routes are absent unless you use **Wrangler** against a built `dist/`. Until then, the client falls back to a **demo globe** and explains that behavior.

Local preview with Functions (after configuring a real KV id in `wrangler.toml`):

```bash
npm run build
npx wrangler pages dev ./dist
```

---

## Content collections

Defined in **`src/content.config.ts`** using Astro’s **Content Layer** (`defineCollection`, `glob` loader, **Zod** schemas).

| Collection | Folder | Purpose |
| ---------- | ------ | ------- |
| `projects` | `src/content/projects/` | Portfolio-style entries: title, date, tags, summary, optional thumbnail. |
| `blog` | `src/content/blog/` | Blog posts: title, date, optional draft. |
| `thoughts` | `src/content/thoughts/` | Short notes: date, optional draft. |
| `dreams` | `src/content/dreams/` | Dream journal: date, mood, highlight words, optional per-word styles (`amber` / `violet` / `burst`). |

**Adding a post:** create a new `.md` or `.mdx` file in the right folder, match the frontmatter fields expected by the schema, and rebuild. Files prefixed with `_` are ignored by the glob patterns.

Draft fields exist on several schemas; pages should filter `draft: true` from production lists if not already.

---

## Theming and layout

### Universe vs Beach

- Stored in **`localStorage`** under `aditi-theme` and mirrored on `<html data-theme="universe|beach">`.
- **FOUC guard:** inline script in `Layout.astro` sets `data-theme` before paint.
- CSS variables **`--page-bg`**, **`--page-fg`**, **`--page-muted`** switch with the theme; amber accent **`--color-amber`** is shared.

### Dream Journal layout

- **`Layout.astro`** accepts `layoutVariant="dream"` (`data-layout="dream"` on `<html>`), which applies the dream color override in `global.css`.

### Navigation

- **`SiteNav.astro`** — primary links; **Dream Journal** tab is hidden until a session unlock flag is set (secret star / starfish interaction on the home experience).

---

## Major features

| Feature | Where it lives |
| ------- | -------------- |
| Star field (universe) | `StarFieldUniverse.astro`, `universe-star-field.ts` |
| Beach layers | `BeachBackground.astro` |
| Home hero motion | `index.astro`, `home-hero.ts` |
| Page reveal / scroll | `page-reveal.ts`, `Layout.astro` |
| Ambient audio | `AmbientAudio.astro`, `ambient-audio.ts` |
| Photo lightbox | `photo-lightbox.ts`, photo-dump page |
| Contact / services | `ContactModal.astro`, services page (Web3Forms when key set) |
| Live visitor map | `LiveVisitorMap.astro`, `live-visitor-map.ts`, `visitor-globe.ts` |
| Private visitor geography | `src/pages/admin/visitors.astro` |

---

## Scripts and client modules

Key files under **`src/scripts/`**:

- **`home-hero.ts`** — Homepage title / tagline animations.
- **`page-reveal.ts`** — GSAP staggers for sections entering the viewport.
- **`universe-star-field.ts`** — Star field behavior.
- **`ambient-audio.ts`** — Audio UI and playback logic.
- **`photo-lightbox.ts`** — Lightbox for photo grids.
- **`visitor-globe.ts`** — globe.gl setup (texture, atmosphere, pins, auto-rotate).
- **`live-visitor-map.ts`** — Fetches stats, posts visits, updates totals, demo fallback.

Pattern: components include a `<script>` block that imports these modules and runs `init` / `boot` functions; **`import.meta.hot`** is used for cleanup where appropriate.

---

## Environment variables

All **`PUBLIC_*`** variables are exposed to the browser. Never put secrets in `PUBLIC_*`.

| Variable | Used for |
| -------- | -------- |
| `PUBLIC_WEB3FORMS_ACCESS_KEY` | Contact / form submissions via Web3Forms |
| `PUBLIC_UMAMI_SCRIPT_URL` | Umami analytics script URL |
| `PUBLIC_UMAMI_WEBSITE_ID` | Umami site id |
| `PUBLIC_VISITOR_API_BASE` | Optional absolute origin for `/api/*` if not same-origin |
| `PUBLIC_STRIPE_LINK_*` | Stripe payment links (consult / writing / design) |

**Cloudflare-only (not `PUBLIC_*`):**

- **`VISITOR_KV`** — KV namespace binding (see `wrangler.toml`).
- **`ADMIN_STATS_SECRET`** — Bearer token for `/api/admin/stats`.

Define **`PUBLIC_*`** in `.env` locally and in **Cloudflare Pages → Settings → Environment variables** for production/preview.

---

## Visitor analytics (globe + APIs)

### Behavior

1. On load, the client sends **`POST /api/visit`** (fire-and-forget). The Function reads **`request.cf`** (country; sometimes city), then increments aggregates in **KV**.
2. The client fetches **`GET /api/stats`** and renders **total visits** and **markers**. Markers use **country centroids** only (`functions/_shared/centroids.ts`) so the public map never pins exact city locations.
3. **`GET /api/admin/stats`** returns **full country and city breakdowns** when called with `Authorization: Bearer <ADMIN_STATS_SECRET>`.

### UI

- **Public:** `LiveVisitorMap.astro` on the homepage.
- **Private:** `/admin/visitors` — `noindex`, not linked from main nav; paste the admin secret and load tables.

### Reference copy

`public/visitor-map/README.txt` duplicates the operational bullets for quick copy-paste while provisioning KV.

---

## Deployment (Cloudflare Pages)

1. **Build:** `npm run build` → **`dist/`**.
2. **Functions:** repository **`functions/`** directory is picked up automatically for Pages projects connected to Git or for Wrangler deploys.
3. **KV:** Create a namespace, note its id, put it in **`wrangler.toml`** under `[[kv_namespaces]]` → `binding = "VISITOR_KV"`.
4. **Dashboard:** In the Pages project, bind the same KV to **`VISITOR_KV`** for **Production** and **Preview** if you edit bindings in the UI instead of only via `wrangler.toml`.
5. **Secret:** Add **`ADMIN_STATS_SECRET`** as an encrypted secret in Pages (not a plain `PUBLIC_` var).
6. **Optional:** Set **`PUBLIC_*`** analytics and Stripe keys per environment.

After deploy, verify **`POST /api/visit`** and **`GET /api/stats`** from the live origin; then open **`/admin/visitors`** with the secret to confirm city/country rows.

---

## Optional integrations

| Integration | Purpose |
| ----------- | ------- |
| **Umami** | Privacy-friendly analytics; script injected from `Layout.astro` when `PUBLIC_UMAMI_*` is set |
| **Web3Forms** | Serverless form handling when access key is present |
| **Stripe links** | Checkout links on services when `PUBLIC_STRIPE_LINK_*` are set |

Umami and the **custom visitor KV counters** are independent; you may run both, but be mindful of **double-counting** conceptually if you treat both as “visits.”

---

## Maintenance tips

- **Upgrade Astro / Tailwind:** follow official upgrade guides; this project uses Tailwind **v4 Vite plugin**, not `@astrojs/tailwind`.
- **Large JS bundles:** globe.gl pulls three.js; expect a larger homepage chunk; consider lazy-loading if you optimize further.
- **Content:** keep collection schemas in sync with frontmatter in new Markdown files to avoid build failures.

For questions about **this repo only**, use this guide and the root **README**; for **Astro** or **Cloudflare** behavior, prefer their official documentation.
