/**
 * Dream Journal Markdown → HTML, with comic-book emphasis on chosen words.
 *
 * - `highlight-words` in frontmatter → default amber comic style.
 * - `word-styles` map (word → amber | violet | burst) for per-word control.
 * - Inline HTML spans in Markdown still work for one-off styling.
 */
import { marked } from 'marked';

export type WordStyle = 'amber' | 'violet' | 'burst';

export function stripFrontmatter(raw: string): string {
	const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
	if (m) return m[2].trimStart();
	return raw;
}

function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function classForStyle(style: WordStyle): string {
	if (style === 'violet') return 'dream-hit dream-hit--violet';
	if (style === 'burst') return 'dream-hit dream-hit--burst';
	return 'dream-hit';
}

function normalizeStyleMap(raw: Record<string, WordStyle> | undefined): Record<string, WordStyle> {
	const out: Record<string, WordStyle> = {};
	if (!raw) return out;
	for (const [k, v] of Object.entries(raw)) {
		out[k.trim().toLowerCase()] = v;
	}
	return out;
}

export function applyHighlightWords(
	markdown: string,
	highlightWords: string[] | undefined,
	wordStyles: Record<string, WordStyle> | undefined,
): string {
	const styleByLower = normalizeStyleMap(wordStyles);
	const fromList = (highlightWords ?? []).map((w) => w.trim()).filter(Boolean);

	const combined = new Set<string>([...fromList, ...Object.keys(wordStyles ?? {})]);
	if (!combined.size) return markdown;

	const sorted = [...combined].sort((a, b) => b.length - a.length);
	let result = markdown;

	for (const w of sorted) {
		const lower = w.toLowerCase();
		const st: WordStyle = styleByLower[lower] ?? 'amber';
		const cls = classForStyle(st);
		const re = new RegExp(`(?<![\\w])${escapeRegExp(w)}(?![\\w])`, 'gi');
		result = result.replace(re, (m) => `<span class="${cls}">${m}</span>`);
	}
	return result;
}

export async function dreamMarkdownToHtml(
	markdown: string,
	highlightWords: string[] | undefined,
	wordStyles: Record<string, WordStyle> | undefined,
): Promise<string> {
	const pass1 = applyHighlightWords(markdown, highlightWords, wordStyles);
	const html = await marked.parse(pass1, { async: true, breaks: true, gfm: true });
	return typeof html === 'string' ? html : String(html);
}
