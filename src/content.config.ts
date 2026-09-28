/**
 * Astro 6 content collections (Content Layer API)
 *
 * Lives at src/content.config.ts (not inside src/content/).
 * Each collection uses a glob loader pointing at a folder under src/content/.
 *
 * @see https://docs.astro.build/en/guides/content-collections/
 */
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const projects = defineCollection({
	loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/projects' }),
	schema: z.object({
		title: z.string(),
		date: z.coerce.date(),
		tags: z.array(z.enum(['research', 'engineering', 'design'])).default([]),
		thumbnail: z.string().optional(),
		summary: z.string(),
		draft: z.boolean().optional(),
	}),
});

const blog = defineCollection({
	loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/blog' }),
	schema: z.object({
		title: z.string(),
		date: z.coerce.date(),
		draft: z.boolean().optional(),
		/**
		 * Normally implied by the folder (`blog/essays/post.md` → "essays").
		 * The CMS also writes it here; a value is only read when a post
		 * sits at the collection root.
		 */
		category: z.string().optional(),
	}),
});

const thoughts = defineCollection({
	loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/thoughts' }),
	schema: z.object({
		date: z.coerce.date(),
		draft: z.boolean().optional(),
	}),
});

const dreams = defineCollection({
	loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/dreams' }),
	schema: z.object({
		date: z.coerce.date(),
		mood: z.string().optional(),
		'highlight-words': z
			.array(z.union([z.string(), z.object({ word: z.string() })]))
			.optional(),
		/** Map form or CMS list of { word, style } */
		'word-styles': z
			.union([
				z.record(z.string(), z.enum(['amber', 'violet', 'burst'])),
				z.array(
					z.object({
						word: z.string(),
						style: z.enum(['amber', 'violet', 'burst']),
					}),
				),
			])
			.optional(),
		draft: z.boolean().optional(),
	}),
});

/** Photo-dump entries added from /admin; image files live in public/uploads/photos. */
const photos = defineCollection({
	loader: glob({ pattern: '**/[^_]*.{yml,yaml}', base: './src/content/photos' }),
	schema: z.object({
		image: z.string(),
		album: z.string().default('Misc'),
		caption: z.string().optional(),
		alt: z.string().optional(),
		date: z.coerce.date().optional(),
	}),
});

export const collections = {
	projects,
	blog,
	thoughts,
	dreams,
	photos,
};
