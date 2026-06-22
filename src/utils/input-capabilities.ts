/** Shared input / viewport helpers for touch vs hover behavior. */

export function prefersReducedMotion(): boolean {
	return (
		typeof window !== 'undefined' &&
		window.matchMedia('(prefers-reduced-motion: reduce)').matches
	);
}

export function isCoarsePointer(): boolean {
	return (
		typeof window !== 'undefined' &&
		window.matchMedia('(hover: none), (pointer: coarse)').matches
	);
}

export function isMobileViewport(): boolean {
	return typeof window !== 'undefined' && window.innerWidth < 768;
}

export function canFineHover(): boolean {
	return (
		typeof window !== 'undefined' &&
		window.matchMedia('(hover: hover) and (pointer: fine)').matches
	);
}

export function planetLabelHint(): string {
	return canFineHover() ? 'hover over a planet to explore' : 'tap a planet to explore';
}

/** Apply `data-coarse-pointer` on <html> for CSS hooks. */
export function syncCoarsePointerAttribute(root: HTMLElement = document.documentElement): void {
	if (isCoarsePointer() || isMobileViewport()) {
		root.setAttribute('data-coarse-pointer', '1');
	} else {
		root.removeAttribute('data-coarse-pointer');
	}
}
