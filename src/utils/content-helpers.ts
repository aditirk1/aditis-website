/**
 * Shared helpers for Markdown files on disk (excerpts, reading time).
 * Used by blog index and similar list pages.
 */

export function stripFrontmatter(raw: string): string {
	const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
	if (m) return m[2].trimStart();
	return raw;
}

export function wordCount(text: string): number {
	return text.trim().split(/\s+/).filter(Boolean).length;
}

/** ~200 wpm reading time, minimum 1 minute */
export function readingTimeMinutes(markdownBody: string): number {
	const plain = stripFrontmatter(markdownBody)
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/[#>*_[\]`(-]/g, ' ');
	const w = wordCount(plain);
	return Math.max(1, Math.round(w / 200));
}

/** First non-empty, non-heading lines for a list teaser */
export function excerptLines(markdownBody: string, lineCount = 2): string {
	const body = stripFrontmatter(markdownBody);
	const lines = body
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('```'));
	return lines.slice(0, lineCount).join(' ');
}
