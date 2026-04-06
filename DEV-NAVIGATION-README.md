# Developer navigation map (visuals, motion, content)

This guide is for **non-developers** who want to experiment with how the site **looks**, **moves**, and **reads**—without learning the whole stack. It maps **this repository’s real files** to those goals.

---

## Table of contents

1. [How this site is put together (one paragraph)](#how-this-site-is-put-together-one-paragraph)
2. [Project structure](#project-structure)
3. [Where to edit what](#where-to-edit-what)
4. [Safe edits vs risky edits](#safe-edits-vs-risky-edits)
5. [Beginner-friendly tweak examples](#beginner-friendly-tweak-examples)
6. [Quick-reference table (common edits)](#quick-reference-table-common-edits)
7. [Glossary (beginner terms)](#glossary-beginner-terms)
8. [Before you change anything (checklist)](#before-you-change-anything-checklist)
9. [How to undo mistakes](#how-to-undo-mistakes)
10. [Files that change the *whole* site at once](#files-that-change-the-whole-site-at-once)
11. [Suggested follow-up docs (optional)](#suggested-follow-up-docs-optional)

---

## How this site is put together (one paragraph)

This project uses **Astro**: most pages are **`.astro` files** (HTML-like templates plus optional scripts). **Styles** live mainly in **`src/styles/global.css`** and in **`<style>` blocks** inside components. **Motion** often uses **GSAP** in **`src/scripts/*.ts`** files that components import. **Written content** for blog, projects, thoughts, and dreams is mostly **Markdown** under **`src/content/`**, controlled by **`src/content.config.ts`**. **Static files** (images, audio, favicon) go in **`public/`** and keep their folder paths in the URL (e.g. `public/beach/waves.mp4` → `/beach/waves.mp4`).

---

## Project structure

Below is a **practical** tree (not every dotfile). Use it as a map.

```text
aditis-website/
├── README.md                    # How to install and run the site
├── DEV-NAVIGATION-README.md     # This file
├── package.json                 # Dependencies and npm commands
├── astro.config.mjs             # Astro + Tailwind (Vite) wiring
├── wrangler.toml                # Cloudflare Pages / KV (visitor stats)
├── docs/                        # Longer technical docs (website-guide.md)
├── public/                      # Static assets served as-is
│   ├── favicon.svg
│   ├── audio/                   # Optional ambience MP3s (see README.txt)
│   ├── beach/                   # Optional waves.mp4, palm.webp, etc.
│   └── visitor-map/             # Notes for visitor globe / KV setup
├── functions/                   # Cloudflare edge APIs (visit/stats)
│   └── api/ …
└── src/
    ├── content.config.ts        # Content “collections” and schemas
    ├── content/                 # Markdown content
    │   ├── blog/
    │   ├── projects/
    │   ├── thoughts/
    │   └── dreams/
    ├── env.d.ts                 # Environment variable names (for editors)
    ├── layouts/
    │   └── Layout.astro         # Site shell: header, theme, Lenis, fonts
    ├── pages/                   # One file ≈ one URL route
    │   ├── index.astro          # Homepage
    │   ├── blog/
    │   ├── projects/
    │   ├── services/
    │   ├── dream-journal/
    │   ├── admin/visitors.astro # Private stats page
    │   └── …
    ├── components/              # Reusable UI chunks
    │   ├── SiteNav.astro
    │   ├── Layout pieces: StarFieldUniverse, BeachBackground, AmbientAudio, …
    │   └── …
    ├── styles/
    │   └── global.css           # Global colors, themes, shared classes
    └── scripts/                 # Client-side motion and interactions
        ├── universe-star-field.ts
        ├── page-reveal.ts
        ├── home-hero.ts
        ├── splash-intro.ts
        ├── ambient-audio.ts
        └── …
```

---

## Where to edit what

### Visuals (colors, fonts, spacing, “glass” cards)

| Goal | Start here |
|------|------------|
| Site-wide colors, light/dark beach theme, prose panels, dream panel overrides | **`src/styles/global.css`** |
| Fonts loaded from Google | **`src/layouts/Layout.astro`** (the `<link>` in `<head>`) |
| Header / footer shell, theme toggle behavior | **`src/layouts/Layout.astro`** |
| Beach scene (waves, palm, starfish, shells) | **`src/components/BeachBackground.astro`** |
| Universe starfield + Earth “portal” look | **`src/scripts/universe-star-field.ts`** (and canvas host **`src/components/StarFieldUniverse.astro`**) |
| Visitor globe panel on the homepage | **`src/components/LiveVisitorMap.astro`**, **`src/scripts/visitor-globe.ts`** |
| One specific page’s layout | **`src/pages/<route>/...`** |

### Motion (animation, transitions)

| Goal | Start here |
|------|------------|
| Scroll-in reveals for sections | **`src/scripts/page-reveal.ts`**, used from **`Layout.astro`** |
| Homepage title / tagline motion | **`src/scripts/home-hero.ts`**, **`src/pages/index.astro`** |
| First-visit splash / shooting star | **`src/components/SplashIntro.astro`**, **`src/scripts/splash-intro.ts`** |
| Nav underline | **`src/components/SiteNav.astro`** (script block) |
| Beach parallax / palm sway | **`src/components/BeachBackground.astro`** (script + GSAP) |
| Smooth scrolling (Lenis) | **`src/layouts/Layout.astro`** |
| Project dialogs opening | **`src/pages/projects/index.astro`** (inline script) |
| Photo lightbox | **`src/scripts/photo-lightbox.ts`**, **`src/pages/photo-dump/index.astro`** |

### Navigation (links, labels, order)

| Goal | Start here |
|------|------------|
| Top nav links (Projects, Blog, …) | **`src/components/SiteNav.astro`** |
| Site title in header | **`src/layouts/Layout.astro`** |
| Dream Journal is **not** in the nav; it’s reached via Earth (universe) or starfish (beach) | **`src/scripts/universe-star-field.ts`**, **`src/components/BeachBackground.astro`** |

### Content (words, blog posts, projects)

| Goal | Start here |
|------|------------|
| Blog posts | **`src/content/blog/*.md`** |
| Projects | **`src/content/projects/*.md`** |
| Short thoughts | **`src/content/thoughts/*.md`** |
| Dream journal entries | **`src/content/dreams/*.md`** |
| What fields each type must have (title, date, tags, …) | **`src/content.config.ts`** |
| Dream-specific highlighting | **`src/utils/dream-markdown.ts`** + frontmatter in dream `.md` files |

### Reusable UI

| Component file | Typical use |
|----------------|-------------|
| **`src/components/SiteNav.astro`** | Main navigation |
| **`src/components/ContactModal.astro`** | Contact / forms on services |
| **`src/components/LiveVisitorMap.astro`** | Globe + visit count block |
| **`src/components/AmbientAudio.astro`** | Bottom-right sound panel |
| **`src/components/BeachBackground.astro`** | Beach theme full-screen background |
| **`src/components/StarFieldUniverse.astro`** | Universe WebGL canvas mount |

---

## Safe edits vs risky edits

### Usually **safe** (easy to revert; low chance of breaking the build)

- Editing **text** inside **`src/pages/*.astro`** (headings, paragraphs, button labels).
- Editing **Markdown** in **`src/content/`** (keep the `---` frontmatter block valid).
- Tweaking **colors** and **fonts** in **`src/styles/global.css`** (stay inside existing blocks if unsure).
- Changing **Tailwind-style classes** on a single page (e.g. `class="..."` on one element).
- Replacing or adding images under **`public/`** (same filename = same URL).
- Adjusting **numbers** in GSAP calls (duration, delay, small movement values) in **`src/scripts/*.ts`** if you change one line at a time.

### **Risky** (can break the site, build, or deployment)

- Renaming or **deleting** files under **`src/pages/`** (URLs disappear or 404).
- Changing **`src/content.config.ts`** without matching every Markdown file’s frontmatter.
- Editing **`functions/`** or **`wrangler.toml`** without understanding Cloudflare (visitor API can stop working).
- Large refactors in **`src/scripts/universe-star-field.ts`** or **`visitor-globe.ts`** (WebGL / Three.js).
- Removing **`Layout.astro`** imports or scripts without knowing what depends on them.
- Committing **secrets** (API keys) into any file—use environment variables / Cloudflare dashboard instead.

---

## Beginner-friendly tweak examples

These are **illustrative**—copy the idea, adjust values slowly.

1. **Softer amber accent**  
   In **`src/styles/global.css`**, find `@theme { --color-amber: … }` and change the hex color slightly.

2. **More space between letters in big titles**  
   In **`src/styles/global.css`**, the `h1, h2, h3` rule has `letter-spacing`. Increase the value (e.g. from `0.12em` to `0.16em`).

3. **Homepage hero line**  
   In **`src/pages/index.astro`**, edit the paragraph under `data-hero-tagline` or the main blurb text.

4. **Slower scroll reveal**  
   In **`src/scripts/page-reveal.ts`**, look for `duration:` in GSAP tweens and raise the number slightly (e.g. `0.6` → `0.9`).

5. **Nav link label**  
   In **`src/components/SiteNav.astro`**, find the `links` array and change `label: 'Blog'` to any short label you want.

6. **New blog post**  
   Duplicate **`src/content/blog/hello-world.md`**, rename the file, edit the `title` and `date` in the top `---` block, write the body below.

7. **Beach video**  
   Add **`public/beach/waves.mp4`** (looping, muted-friendly). The component already points at that path.

8. **3D card hover strength**  
   In **`src/styles/global.css`**, find `.card-3d-pop:hover` and slightly reduce `scale3d` or `rotateX` if the effect feels too strong.

---

## Quick-reference table (common edits)

| I want to… | File(s) to open |
|------------|------------------|
| Change site-wide colors / themes | **`src/styles/global.css`** |
| Change fonts | **`src/layouts/Layout.astro`** + optionally **`global.css`** (`--font-*`) |
| Edit homepage text and sections | **`src/pages/index.astro`** |
| Change top navigation | **`src/components/SiteNav.astro`** |
| Edit blog / projects / dreams content | **`src/content/.../*.md`** |
| Change scroll animations | **`src/scripts/page-reveal.ts`** |
| Change universe stars / Earth button | **`src/scripts/universe-star-field.ts`** |
| Change beach look (waves, palm, starfish) | **`src/components/BeachBackground.astro`** |
| Change splash / first visit effect | **`src/components/SplashIntro.astro`**, **`src/scripts/splash-intro.ts`** |
| Change ambient sound UI | **`src/components/AmbientAudio.astro`**, **`src/scripts/ambient-audio.ts`** |
| Change project cards / dialogs | **`src/pages/projects/index.astro`** |
| Change visitor globe block | **`src/components/LiveVisitorMap.astro`**, **`src/scripts/live-visitor-map.ts`**, **`visitor-globe.ts`** |
| Change contact / services modal | **`src/components/ContactModal.astro`**, **`src/pages/services/index.astro`** |

---

## Glossary (beginner terms)

| Term | Plain English |
|------|----------------|
| **Repository / repo** | The project folder with all website files (often synced with Git). |
| **Astro** | The framework that builds static HTML from `.astro` pages and components. |
| **`.astro` file** | A file mixing HTML-like markup with optional scripts and scoped styles. |
| **Component** | A reusable chunk of UI (often under `src/components/`). |
| **Layout** | A wrapper used by many pages (here: **`Layout.astro`**). |
| **Markdown (`.md`)** | Text files with simple formatting (`#` headings, lists); used for blog and projects. |
| **Frontmatter** | The `---` block at the top of a content file with fields like `title:` and `date:`. |
| **Tailwind / utility classes** | Short class names on HTML elements (e.g. `flex`, `p-4`) that control layout and spacing. |
| **CSS variables** | Names like `--page-bg` defined in **`global.css`** and reused across the site. |
| **GSAP** | A JavaScript animation library used for many motions on this site. |
| **Three.js / WebGL** | 3D graphics used for the universe background and visitor globe. |
| **`public/`** | Files copied as-is to the website; paths match the folder (no `public` in the URL). |
| **Build** | Running `npm run build` to generate the `dist/` folder for deployment. |
| **Dev server** | Running `npm run dev` to preview changes locally (usually port 4321). |

---

## Before you change anything (checklist)

- [ ] **Save a backup** of the file (or use Git: commit before experimenting).
- [ ] **Run the dev server** (`npm run dev`) and refresh after each small change.
- [ ] **Change one thing at a time** so you know what caused a problem.
- [ ] **If editing Markdown**, keep the `---` frontmatter valid (no stray characters).
- [ ] **If editing `content.config.ts`**, read an existing `.md` file first to match the pattern.
- [ ] **Do not paste passwords** into repo files; use env vars / hosting settings (see **`src/env.d.ts`** for names).
- [ ] **After visual edits**, check **both** themes (Universe / Beach) if the change should work in both.

---

## How to undo mistakes

1. **Git (best)**  
   If the project uses Git: `git checkout -- path/to/file` restores the last committed version, or use your Git GUI’s “discard changes” on a file.

2. **Editor undo**  
   `Ctrl+Z` (Windows) / `Cmd+Z` (Mac) in the editor—works until you close the file or hit limits.

3. **Copy from an old copy**  
   If you use GitHub/GitLab, open the file history in the browser and copy the previous version back.

4. **Rebuild**  
   If the dev server shows errors after a save, revert the file and run `npm run dev` again.

5. **Nuclear option**  
   Re-clone the repository to a new folder and copy only the files you meant to keep.

---

## Files that change the *whole* site at once

These tend to affect **many or all pages** when edited:

| File | Why it’s global |
|------|------------------|
| **`src/layouts/Layout.astro`** | Wraps almost every page: fonts, theme script, Lenis, nav slot, ambient audio, page-reveal bootstrap. |
| **`src/styles/global.css`** | Defines `--page-bg`, `--page-fg`, `.prose-shell`, `.card-3d-pop`, dream overrides, blog prose. |
| **`src/components/SiteNav.astro`** | Same navigation on (responsive) header across routes. |
| **`src/scripts/page-reveal.ts`** | Hooked from Layout; drives scroll reveals site-wide. |
| **`src/content.config.ts`** | Affects every collection entry and can break the build if schemas don’t match. |

Editing a **single** file under **`src/pages/`** usually affects **that route only** (plus shared layout/CSS).

---

## Suggested follow-up docs (optional)

You asked whether to add more structure later. **Recommendations:**

| Idea | Worth it? | Why |
|------|-----------|-----|
| **`docs/visual-editing.md`** | **Yes** | Deep dive on `global.css`, themes, `prose-shell`, Tailwind tokens—pairs well with this map. |
| **`docs/motion-editing.md`** | **Yes** | GSAP + Lenis + which script owns which motion; reduces fear of editing `*.ts` files. |
| **`docs/navigation-editing.md`** | **Optional** | This repo’s nav is mostly one file (`SiteNav.astro`); a short doc could duplicate this README unless you add mega-menus later. |
| **`.cursor/rules` (or `.cursorrules`)** | **Yes, if you use Cursor** | Short rules like “prefer editing global.css for colors” and “don’t touch functions/ without asking” help AI assistants stay on track. |

**Practical split:** Keep **`DEV-NAVIGATION-README.md`** as the **single entry map**; add **`docs/visual-editing.md`** and **`docs/motion-editing.md`** when you outgrow one file. Merge navigation into visual or motion doc unless navigation grows complex.

---

*Last mapped to this repository layout as of the project’s current `src/` + `public/` + `functions/` structure. If you add new routes or components, append rows to the quick-reference table.*
