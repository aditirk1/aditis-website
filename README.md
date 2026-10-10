# aditi's universe

**Live at aditirk.me**

My website that hosts a portfolio, and a notebook: projects and research, long-form writing, quick thoughts, a photo dump, freelance services, and a private dream journal. It has two moods — **Universe** (a WebGL starfield with an orbiting planet system) and **Beach** (animated waves) — and picks one at random on your first visit.

## What's inside

- **Home**: animated intro, rotating taglines, and a live visitor globe
- **Projects**: research and engineering work (BCI pipelines, nanobot tracking, a quadruped robot, and more)
- **Blog**: essays, notes, and reading, grouped by category, with an RSS feed
- **Thoughts**: short-form posts, which can also be sent from a phone via `/quick`
- **Photo dump**: albums with a full-screen viewer
- **Services**: freelance offerings with a contact form and optional Stripe checkout
- **Dream journal**: private entries behind Google/GitHub sign-in, with comic-style pop-out words
- **Comments**: signed-in readers can comment, with moderation for the admin
- **/admin**: browser-based content editing, so no code is needed to publish

## Stack

| Layer | Tools |
| --- | --- |
| Framework | [Astro 7](https://astro.build) (static output) + TypeScript |
| Styling | Tailwind CSS v4 |
| Motion & 3D | GSAP, Lenis (smooth scroll), Three.js, globe.gl |
| Content | Astro content collections (Markdown/YAML), `marked`, DOMPurify |
| CMS | [Sveltia CMS](https://github.com/sveltia/sveltia-cms) with GitHub as the backend |
| Hosting | Cloudflare Pages |
| Backend | Cloudflare Pages Functions (`functions/api/*`) + Workers KV |
| Auth | Google & GitHub OAuth with HMAC-signed session cookies |
| Integrations | Web3Forms (contact), Stripe Checkout, GitHub Contents API |
| Media | `sharp` for EXIF stripping/resizing and generating the social card |

## Under the hood

- **Security**: strict security headers, a content security policy in report-only mode, KV-backed rate limiting, constant-time secret checks, and sanitized HTML
- **Accessibility**: WCAG AA contrast on both themes, 44px tap targets on mobile, reduced-motion support (the starfield stays still), native `<dialog>` modals with focus return, and a text-size control
- **Privacy**: photo uploads are re-encoded in the browser so GPS and camera metadata never reach the repo
- **Visitor analytics**: a privacy-friendly count built on Cloudflare KV, with no third-party trackers by default

Built with Cursor Pro (mostly Claude Opus & Composer) and my own ideas.
