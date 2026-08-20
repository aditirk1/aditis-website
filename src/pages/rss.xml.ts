import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { loadBlogPosts } from '../utils/blog.ts';

export async function GET(context: APIContext) {
	const posts = await loadBlogPosts();

	return rss({
		title: "aditi's universe · blog",
		description: 'Essays and notes, written by hand.',
		site: context.site!,
		items: posts.map((post) => ({
			title: post.entry.data.title,
			pubDate: post.entry.data.date,
			description: post.excerpt,
			link: post.href,
			categories: post.categoryId ? [post.categoryLabel] : undefined,
		})),
	});
}
