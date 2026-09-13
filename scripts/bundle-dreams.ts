/**
 * Build-time: turn src/content/dreams/*.md into functions/_data/dreams.json.
 * That JSON is imported only by Cloudflare Functions (not published under /dist).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dreamMarkdownToHtml, stripFrontmatter } from '../src/utils/dream-markdown.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dreamsDir = path.join(root, 'src', 'content', 'dreams');
const outFile = path.join(root, 'functions', '_data', 'dreams.json');

type WordStyle = 'amber' | 'violet' | 'burst';

function parseSimpleFrontmatter(raw: string): {
	data: Record<string, unknown>;
	body: string;
} {
	const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
	if (!m) return { data: {}, body: raw };
	const yaml = m[1] ?? '';
	const body = m[2] ?? '';
	const data: Record<string, unknown> = {};

	const lines = yaml.split(/\r?\n/);
	let i = 0;
	while (i < lines.length) {
		const line = lines[i] ?? '';
		const keyed = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
		if (!keyed) {
			i++;
			continue;
		}
		const key = keyed[1]!;
		const rest = keyed[2]!;
		if (rest === '' || rest === '|' || rest === '>') {
			if (key === 'highlight-words') {
				const items: string[] = [];
				i++;
				while (i < lines.length && /^\s+-\s+/.test(lines[i] ?? '')) {
					items.push((lines[i] ?? '').replace(/^\s+-\s+/, '').replace(/^["']|["']$/g, '').trim());
					i++;
				}
				data[key] = items;
				continue;
			}
			if (key === 'word-styles') {
				const map: Record<string, string> = {};
				i++;
				while (i < lines.length && /^\s+\S/.test(lines[i] ?? '') && !/^\s+-\s+/.test(lines[i] ?? '')) {
					const mm = (lines[i] ?? '').match(/^\s+([^:]+):\s*(.*)$/);
					if (mm) map[mm[1]!.trim()] = mm[2]!.trim().replace(/^["']|["']$/g, '');
					i++;
				}
				data[key] = map;
				continue;
			}
			i++;
			continue;
		}
		let val: unknown = rest.replace(/^["']|["']$/g, '');
		if (val === 'true') val = true;
		else if (val === 'false') val = false;
		data[key] = val;
		i++;
	}

	return { data, body };
}

function previewPlain(html: string, max: number): string {
	const t = html
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	return t.length > max ? `${t.slice(0, max).trim()}…` : t;
}

async function main() {
	fs.mkdirSync(path.dirname(outFile), { recursive: true });

	if (!fs.existsSync(dreamsDir)) {
		fs.writeFileSync(outFile, `${JSON.stringify({ entries: [], generatedAt: new Date().toISOString() }, null, '\t')}\n`);
		console.log('dreams:bundle — no dreams folder; wrote empty bundle');
		return;
	}

	const files = fs
		.readdirSync(dreamsDir)
		.filter((f) => f.endsWith('.md') && !f.startsWith('_'))
		.sort();

	const entries = [];
	for (const file of files) {
		const raw = fs.readFileSync(path.join(dreamsDir, file), 'utf8');
		const { data, body } = parseSimpleFrontmatter(raw);
		if (data.draft === true) continue;

		const id = file.replace(/\.md$/i, '');
		const dateRaw = data.date;
		const date =
			dateRaw instanceof Date
				? dateRaw.toISOString().slice(0, 10)
				: String(dateRaw ?? '').slice(0, 10);
		if (!date) {
			console.warn(`dreams:bundle — skip ${file} (missing date)`);
			continue;
		}

		const md = stripFrontmatter(raw).trim() ? stripFrontmatter(raw) : body;
		const highlight = Array.isArray(data['highlight-words'])
			? (data['highlight-words'] as string[])
			: undefined;
		const wordStyles = (data['word-styles'] as Record<string, WordStyle> | undefined) ?? undefined;
		const html = await dreamMarkdownToHtml(md, highlight, wordStyles);
		const mood = typeof data.mood === 'string' && data.mood.trim() ? data.mood.trim() : undefined;

		entries.push({
			id,
			date,
			...(mood ? { mood } : {}),
			html,
			preview: previewPlain(html, 220),
		});
	}

	entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

	const bundle = { entries, generatedAt: new Date().toISOString() };
	fs.writeFileSync(outFile, `${JSON.stringify(bundle, null, '\t')}\n`);
	console.log(`dreams:bundle — ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} → functions/_data/dreams.json`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
