/**
 * One-off generator for public/brand/og-card.png (1200×630 social preview).
 * Re-run after changing the logo or copy:  node scripts/make-og-card.mjs
 * Text uses a locally installed font (FONT below), so the PNG is committed
 * rather than built on Cloudflare.
 */
import sharp from 'sharp';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const W = 1200;
const H = 630;
const FONT = 'Avenir Next';

function starfieldSvg() {
	let seed = 7;
	const rand = () => {
		seed = (seed * 16807) % 2147483647;
		return seed / 2147483647;
	};
	let dots = '';
	for (let i = 0; i < 220; i++) {
		const r = rand() < 0.08 ? 1.6 : 0.6 + rand() * 0.7;
		const o = 0.25 + rand() * 0.6;
		dots += `<circle cx="${(rand() * W).toFixed(1)}" cy="${(rand() * H).toFixed(1)}" r="${r.toFixed(2)}" fill="#fff" fill-opacity="${o.toFixed(2)}"/>`;
	}
	return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
		<defs>
			<radialGradient id="glow" cx="30%" cy="50%" r="60%">
				<stop offset="0%" stop-color="#ffaa00" stop-opacity="0.16"/>
				<stop offset="100%" stop-color="#05030c" stop-opacity="0"/>
			</radialGradient>
		</defs>
		<rect width="100%" height="100%" fill="#05030c"/>
		<rect width="100%" height="100%" fill="url(#glow)"/>
		${dots}
		<rect x="560" y="330" width="72" height="3" rx="1.5" fill="#ffaa00"/>
	</svg>`);
}

async function text(markup, width) {
	return sharp({
		text: { text: markup, font: FONT, width, rgba: true, dpi: 72 },
	})
		.png()
		.toBuffer();
}

const logo = await sharp(join(root, 'public/brand/logo-universe-512.png')).resize(340, 340).png().toBuffer();
const title = await text('<span foreground="#f7f4ec" size="76pt" weight="light">aditi’s universe</span>', 600);
const subtitle = await text(
	'<span foreground="#bdb8ae" size="28pt">Biomedical engineer · researcher · writer</span>',
	600,
);
const url = await text('<span foreground="#ffaa00" size="24pt" weight="medium">aditirk.me</span>', 600);

const out = join(root, 'public/brand/og-card.png');
await sharp(starfieldSvg())
	.composite([
		{ input: logo, left: 150, top: 145 },
		{ input: title, left: 560, top: 215 },
		{ input: subtitle, left: 560, top: 360 },
		{ input: url, left: 560, top: 420 },
	])
	.png({ compressionLevel: 9 })
	.toFile(out);

console.log(`Wrote ${out}`);
