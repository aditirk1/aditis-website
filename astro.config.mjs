// @ts-check
/**
 * Astro configuration for aditi's universe (aditirk.me)
 *
 * - Tailwind CSS v4 is wired through the official Vite plugin (works with Astro 6;
 *   the older @astrojs/tailwind package does not list Astro 6 as a peer yet).
 * - Content collections are enabled automatically when src/content/config.ts exists.
 */
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
	vite: {
		plugins: [tailwindcss()],
	},
});
