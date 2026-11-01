/**
 * Hand-off between the page being left and the page arriving, for the
 * transition experiments. The old page records where the navigation started;
 * the new page's `pagereveal` handler (ViewTransitionExperiment.astro) reads it
 * once and removes it. Coordinates are viewport pixels.
 */
/** Scoped by window.name: the lab's frames share one sessionStorage. */
export const vtOriginKey = (): string => `aditi-vt-origin:${window.name}`;

export type VtOriginKind = 'tab' | 'planet' | 'project' | 'link';

export interface VtOrigin {
	kind: VtOriginKind;
	x: number;
	y: number;
	/** Radius of the thing that was clicked, so the portal starts at its edge. */
	r: number;
	ts: number;
}

export function transitionsEnabled(): boolean {
	return Boolean(document.documentElement.dataset.vt);
}

export function recordTransitionOrigin(origin: Omit<VtOrigin, 'ts'>): void {
	if (!transitionsEnabled()) return;
	try {
		sessionStorage.setItem(vtOriginKey(), JSON.stringify({ ...origin, ts: Date.now() }));
	} catch {
		/* Private mode with storage blocked: the transition falls back to the centre. */
	}
}
