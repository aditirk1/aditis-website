/**
 * Dream Journal Markdown → HTML, with comic-book emphasis on chosen words.
 *
 * - `highlight-words` in frontmatter → default amber comic style.
 * - `word-styles` map (word → amber | violet | burst) for per-word control.
 * - Inline HTML spans in Markdown still work for one-off styling.
 */
import { marked } from 'marked';

export type WordStyle = 'amber' | 'violet' | 'burst';

const WORD_STYLES = new Set<WordStyle>(['amber', 'violet', 'burst']);

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

function asWordStyle(value: unknown): WordStyle | null {
	if (typeof value !== 'string') return null;
	const v = value.trim().toLowerCase() as WordStyle;
	return WORD_STYLES.has(v) ? v : null;
}

/**
 * Accepts either the classic map (`door: burst`) or a CMS list
 * (`[{ word: "door", style: "burst" }]`).
 */
export function normalizeWordStyles(
	raw: Record<string, unknown> | Array<Record<string, unknown>> | undefined | null,
): Record<string, WordStyle> {
	const out: Record<string, WordStyle> = {};
	if (!raw) return out;

	if (Array.isArray(raw)) {
		for (const item of raw) {
			if (!item || typeof item !== 'object') continue;
			const word = typeof item.word === 'string' ? item.word.trim() : '';
			const style = asWordStyle(item.style);
			if (word && style) out[word.toLowerCase()] = style;
		}
		return out;
	}

	for (const [k, v] of Object.entries(raw)) {
		const style = asWordStyle(v);
		if (style) out[k.trim().toLowerCase()] = style;
	}
	return out;
}

/** Flatten CMS list items that may be bare strings or `{ word: "…" }`. */
export function normalizeHighlightWords(raw: unknown): string[] | undefined {
	if (!Array.isArray(raw)) return undefined;
	const words = raw
		.map((item) => {
			if (typeof item === 'string') return item.trim();
			if (item && typeof item === 'object' && typeof (item as { word?: unknown }).word === 'string') {
				return (item as { word: string }).word.trim();
			}
			return '';
		})
		.filter(Boolean);
	return words.length ? words : undefined;
}

export function applyHighlightWords(
	markdown: string,
	highlightWords: string[] | undefined,
	wordStyles: Record<string, WordStyle> | undefined,
): string {
	const styleByLower = normalizeWordStyles(wordStyles);
	const fromList = (highlightWords ?? []).map((w) => w.trim()).filter(Boolean);

	const combined = new Set<string>([...fromList, ...Object.keys(styleByLower)]);
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
	wordStyles:
		| Record<string, WordStyle>
		| Record<string, unknown>
		| Array<Record<string, unknown>>
		| undefined,
): Promise<string> {
	const styles = normalizeWordStyles(wordStyles);
	const highlights = normalizeHighlightWords(highlightWords) ?? highlightWords;
	const pass1 = applyHighlightWords(markdown, highlights, styles);
	const html = await marked.parse(pass1, { async: true, breaks: true, gfm: true });
	return typeof html === 'string' ? html : String(html);
}
