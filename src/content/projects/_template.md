---
# Copy this file, rename to your-project-slug.md (no leading underscore).
# URL becomes /projects/your-project-slug

title: Project title
date: 2026-01-15
tags:
  - research # research | engineering | design (pick one or more)
summary: One sentence for the card on /projects — what it is and why it matters.
draft: true # set false when ready to publish
# thumbnail: /uploads/cover.jpg  # optional — not shown on cards yet; use in body for now
---

## Overview

What you built, for whom, and the outcome in 2–3 sentences.

## What I did

- Bullet your role, methods, or stack
- Link out: [Paper or repo](https://github.com/yourname/project)

## Images & layout

Put files in `public/uploads/`, then use HTML for positioning (works in project & blog Markdown):

**Centered (default):**
```html
<figure class="article-figure article-figure--center">
  <img src="/uploads/screenshot.png" alt="Setup" />
  <figcaption>Caption here</figcaption>
</figure>
```

**Wide / full-bleed / float left / two-column grid:**
- `article-figure--wide` — breaks out wider than text column
- `article-figure--full` — edge-to-edge across the screen
- `article-figure--left` or `--right` — text wraps beside image (desktop)
- Wrap two figures in `<div class="article-figure-grid article-figure-grid--2">`

Plain `![caption](/uploads/x.png)` also works — click any image to open the lightbox.
