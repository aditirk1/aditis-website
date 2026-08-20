---
# Copy this file, rename to your-post-slug.md (no leading underscore).
#
# src/content/blog/your-post-slug.md          → /blog/your-post-slug
# src/content/blog/essays/your-post-slug.md   → /blog/essays/your-post-slug
#
# Folders become categories automatically. The folder name is the heading
# on /blog ("deep-dives" renders as "Deep Dives") — no config to update.

title: Post title
date: 2026-01-15
draft: true # set false when ready to publish
---

Opening paragraph — shows with a drop cap on the blog layout. Make it count.

> Optional pull quote. Renders with an amber left border.

Continue the essay here. Standard Markdown works: **bold**, [links](https://example.com), headers, lists.

<!--
IMAGES
======
Put files in `public/uploads/`, then reference them as `/uploads/name.jpg`.
Every image is clickable — the lightbox opens it large and arrow keys move
through all images in the post. Delete this comment block in real posts.

Simplest possible — full text width, centered:

    ![Alt text](/uploads/figure.png)

One image with a caption:

    <figure class="article-figure">
      <img src="/uploads/figure.png" alt="What it shows" />
      <figcaption>Caption under the image.</figcaption>
    </figure>

TWO SIDE BY SIDE, inside the text column. Put it between two paragraphs and
the text flows above and below it:

    <div class="article-figure-grid article-figure-grid--2">
      <figure class="article-figure"><img src="/uploads/left.jpg" alt="" /></figure>
      <figure class="article-figure"><img src="/uploads/right.jpg" alt="" /></figure>
    </div>

FOUR IN A QUADRANT (2×2), still inside the text column — text above and below:

    <div class="article-figure-grid article-figure-grid--quad article-figure-grid--even">
      <figure class="article-figure"><img src="/uploads/1.jpg" alt="" /></figure>
      <figure class="article-figure"><img src="/uploads/2.jpg" alt="" /></figure>
      <figure class="article-figure"><img src="/uploads/3.jpg" alt="" /></figure>
      <figure class="article-figure"><img src="/uploads/4.jpg" alt="" /></figure>
      <p class="article-figure-grid__caption">One caption for the whole set.</p>
    </div>

TEXT WRAPPING BESIDE AN IMAGE (desktop; stacks on phones):

    <figure class="article-figure article-figure--right">
      <img src="/uploads/portrait.jpg" alt="" />
    </figure>

Modifiers you can mix in:
  Grid columns   --2 (default pair / 2x2 quadrant), --3, --4
  Even heights   --even crops to 4:3 so a grid lines up; add --square for 1:1
  Width          --wide breaks out past the text column, --full goes edge to edge
  Float          --left or --right wraps text beside the image

All grids stack to one column on phones, so nothing needs a mobile variant.
-->

![Optional image](/uploads/figure.png)
