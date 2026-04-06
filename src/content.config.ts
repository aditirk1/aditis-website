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
		'highlight-words': z.array(z.string()).optional(),
		/** Per-word comic style: amber (default), violet, or burst */
		'word-styles': z.record(z.string(), z.enum(['amber', 'violet', 'burst'])).optional(),
		draft: z.boolean().optional(),
	}),
});

export const collections = {
	projects,
	blog,
	thoughts,
	dreams,
};
