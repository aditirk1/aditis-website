/**
 * Blog posts with folder-derived categories.
 *
 * `src/content/blog/on-time.md`         → /blog/on-time            (no category)
 * `src/content/blog/essays/on-time.md`  → /blog/essays/on-time     (category "Essays")
 *
 * Add a category by creating a folder — no config change needed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { getCollection, type CollectionEntry } from 'astro:content';
import { excerptLines, readingTimeMinutes } from './content-helpers.ts';

export type BlogPost = {
	entry: CollectionEntry<'blog'>;
	slug: string;
	href: string;
	categoryId: string;
	categoryLabel: string;
	minutes: number;
	excerpt: string;
};

export type BlogCategory = {
	id: string;
	label: string;
	posts: BlogPost[];
};

/** Posts sitting directly in src/content/blog/ */
const UNCATEGORIZED = '';

function labelFromFolder(name: string): string {
	return name.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function rawBodyFor(entry: CollectionEntry<'blog'>): string {
	if (typeof entry.body === 'string' && entry.body.length > 0) return entry.body;
	const fp = path.join(process.cwd(), 'src', 'content', 'blog', `${entry.id}.md`);
	try {
		return fs.readFileSync(fp, 'utf8');
	} catch {
		return '';
	}
}

export async function loadBlogPosts(): Promise<BlogPost[]> {
	const posts = await getCollection('blog', ({ data }) => data.draft !== true);

	return posts
		.map((entry) => {
			const parts = entry.id.split('/');
			const categoryId =
				parts.length > 1 ? parts[0]! : (entry.data.category?.trim() ?? UNCATEGORIZED);
			const raw = rawBodyFor(entry);

			return {
				entry,
				slug: entry.id,
				href: `/blog/${entry.id}`,
				categoryId,
				categoryLabel: categoryId ? labelFromFolder(categoryId) : 'Other writing',
				minutes: readingTimeMinutes(raw),
				excerpt: excerptLines(raw, 2) || '…',
			};
		})
		.sort((a, b) => b.entry.data.date.valueOf() - a.entry.data.date.valueOf());
}

/** Named folders alphabetically; loose root posts last. */
export function groupByCategory(posts: BlogPost[]): BlogCategory[] {
	const map = new Map<string, BlogCategory>();

	for (const post of posts) {
		const existing = map.get(post.categoryId);
		if (existing) existing.posts.push(post);
		else map.set(post.categoryId, { id: post.categoryId, label: post.categoryLabel, posts: [post] });
	}

	return [...map.values()].sort((a, b) => {
		if (a.id === UNCATEGORIZED) return 1;
		if (b.id === UNCATEGORIZED) return -1;
		return a.label.localeCompare(b.label);
	});
}

export function hasNamedCategories(categories: BlogCategory[]): boolean {
	return categories.some((c) => c.id !== UNCATEGORIZED);
}
