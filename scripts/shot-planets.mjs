/**
 * Dev-only screenshot helper for the universe orrery.
 * Usage: node scripts/shot-planets.mjs <label>
 * Writes .screenshots/<label>-full.png and .screenshots/<label>-zoom.png
 */
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';

const label = process.argv[2] ?? 'shot';
const URL = process.env.SHOT_URL ?? 'http://localhost:4321/';
const OUT = '.screenshots';

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
	channel: 'msedge',
	args: ['--enable-unsafe-swiftshader', '--use-gl=angle'],
});

const page = await browser.newPage({
	viewport: { width: 1440, height: 900 },
	deviceScaleFactor: 2,
});

const consoleLines = [];
page.on('console', (m) => {
	if (m.type() === 'warning' || m.type() === 'error') consoleLines.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => consoleLines.push(`[pageerror] ${e.message}`));

/* Pin the universe theme (it is otherwise a 60/40 coin flip) and skip the splash. */
await page.addInitScript(() => {
	localStorage.setItem('aditi-theme', 'universe');
	sessionStorage.setItem('aditi-splash-seen', '1');
});

await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(4500);

await page.screenshot({ path: `${OUT}/${label}-full.png` });

/* Desktop layout parks the orrery right of centre; crop tight for detail. */
await page.screenshot({
	path: `${OUT}/${label}-zoom.png`,
	clip: { x: 800, y: 140, width: 640, height: 640 },
});

/* Tight crop on the ringed gas giant to check ring/sphere occlusion. */
await page.screenshot({
	path: `${OUT}/${label}-ring.png`,
	clip: { x: 890, y: 365, width: 170, height: 170 },
});

for (const line of consoleLines) console.log(line);

await browser.close();
console.log(`wrote ${OUT}/${label}-full.png and ${OUT}/${label}-zoom.png`);
