/**
 * Dev-only measuring helper for the homepage hero.
 * Reports text / orrery / scroll-arrow boxes as percentages of the viewport.
 * Usage: node scripts/measure-hero.mjs <label> [theme] [width] [height]
 */
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';

const [label = 'shot', theme = 'universe', w = '1440', h = '900'] = process.argv.slice(2);
const vw = Number(w);
const vh = Number(h);
const URL = process.env.SHOT_URL ?? 'http://localhost:4321/';
const OUT = '.screenshots';

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
	channel: 'msedge',
	args: ['--enable-unsafe-swiftshader', '--use-gl=angle'],
});
const page = await browser.newPage({
	viewport: { width: vw, height: vh },
	deviceScaleFactor: 1,
	isMobile: vw < 500,
	hasTouch: vw < 500,
});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.addInitScript((t) => {
	localStorage.setItem('aditi-theme', t);
	sessionStorage.setItem('aditi-splash-seen', '1');
}, theme);

await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(4000);

const shot = await page.screenshot({ path: `${OUT}/${label}.png` });

const dom = await page.evaluate(() => {
	const box = (el) => {
		if (!el) return null;
		const r = el.getBoundingClientRect();
		if (!r.width || !r.height) return null;
		return {
			l: +((r.left / innerWidth) * 100).toFixed(1),
			r: +((r.right / innerWidth) * 100).toFixed(1),
			t: +((r.top / innerHeight) * 100).toFixed(1),
			b: +((r.bottom / innerHeight) * 100).toFixed(1),
		};
	};
	const words = [...document.querySelectorAll('#sun-text .hero-word')];
	return {
		vw: innerWidth,
		vh: innerHeight,
		fontPx: Math.round(parseFloat(getComputedStyle(document.querySelector('#sun-text')).fontSize)),
		line1: box(words[0]),
		line2: box(words[words.length - 1]),
		caption: box(document.querySelector('#planet-label-text')),
		arrow: box(document.querySelector('[data-hero-chevron]')),
	};
});

/* The orrery is WebGL, so its box comes from the pixels: mask out every DOM box
 * (text, header, controls) and require a long lit run per row/column so single
 * stars don't count as part of the widget. */
const orrery = await page.evaluate(
	async ({ dataUrl, width, height }) => {
		const masks = [...document.querySelectorAll('body *')]
			.filter((el) => {
				const s = getComputedStyle(el);
				if (s.visibility === 'hidden' || s.display === 'none' || s.opacity === '0') return false;
				return el.matches('.hero-word, #planet-label, [data-hero-chevron], header, header *, [data-reader-tools], [data-reader-tools] *');
			})
			.map((el) => el.getBoundingClientRect())
			.filter((r) => r.width && r.height);
		const masked = (x, y) => masks.some((r) => x >= r.left - 4 && x <= r.right + 4 && y >= r.top - 4 && y <= r.bottom + 4);

		const img = new Image();
		img.src = dataUrl;
		await img.decode();
		const c = document.createElement('canvas');
		c.width = width;
		c.height = height;
		const ctx = c.getContext('2d');
		ctx.drawImage(img, 0, 0);
		const { data } = ctx.getImageData(0, 0, width, height);

		const MIN_RUN = 18;
		const rows = new Array(height).fill(0);
		const cols = new Array(width).fill(0);
		const x0 = Math.floor(width * 0.55);
		for (let y = 0; y < height; y++) {
			for (let x = x0; x < width; x++) {
				const i = (y * width + x) * 4;
				if ((data[i] + data[i + 1] + data[i + 2]) / 3 <= 40) continue;
				if (masked(x, y)) continue;
				rows[y]++;
				cols[x]++;
			}
		}
		const pick = (arr) => arr.map((n, i) => (n >= MIN_RUN ? i : -1)).filter((i) => i >= 0);
		const ys = pick(rows);
		const xs = pick(cols);
		if (!ys.length || !xs.length) return null;
		return {
			l: +((xs[0] / width) * 100).toFixed(1),
			r: +((xs[xs.length - 1] / width) * 100).toFixed(1),
			t: +((ys[0] / height) * 100).toFixed(1),
			b: +((ys[ys.length - 1] / height) * 100).toFixed(1),
			cx: +(((xs[0] + xs[xs.length - 1]) / 2 / width) * 100).toFixed(1),
			cy: +(((ys[0] + ys[ys.length - 1]) / 2 / height) * 100).toFixed(1),
		};
	},
	{ dataUrl: `data:image/png;base64,${shot.toString('base64')}`, width: vw, height: vh },
);

console.log(JSON.stringify({ label, theme, ...dom, orrery, errors }, null, 1));
await browser.close();
