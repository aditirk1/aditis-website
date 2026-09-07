/**
 * Single source of scroll truth.
 *
 * Previously the header, the hero chevron and the starfield each attached their
 * own native scroll listener and called getBoundingClientRect() — the starfield
 * did it every animation frame. That means repeated forced layout during the
 * exact frames that need to stay cheap.
 *
 * Here, hero geometry is measured once (and on resize), scroll position is
 * coalesced into a single rAF, and subscribers read plain numbers.
 */
export interface ScrollState {
	/** Current scroll offset in px. */
	y: number;
	/** Hero bottom edge relative to the viewport top, in px. */
	heroBottom: number;
	viewportHeight: number;
}

type Listener = (state: ScrollState) => void;

const listeners = new Set<Listener>();

const state: ScrollState = { y: 0, heroBottom: 0, viewportHeight: 0 };

let heroDocumentBottom = 0;
let framePending = false;
let started = false;
let measured = false;
/** Set once Lenis drives updates, so the native listener stops duplicating work. */
let externallyDriven = false;

function measure(): void {
	measured = true;
	state.viewportHeight = window.innerHeight || 1;

	const hero = document.querySelector<HTMLElement>('[data-hero-root]');
	if (!hero) {
		heroDocumentBottom = 0;
		return;
	}

	const rect = hero.getBoundingClientRect();
	heroDocumentBottom = rect.bottom + window.scrollY;
}

/**
 * Module init order across script bundles is not guaranteed, so a consumer can
 * read state before initScrollOrchestrator() runs. Without this, it would see
 * a zeroed viewport and compute a bogus hero position.
 */
function ensureMeasured(): void {
	if (measured) return;
	measure();
	recompute(window.scrollY);
}

function recompute(y: number): void {
	state.y = y;
	state.heroBottom = heroDocumentBottom ? heroDocumentBottom - y : state.viewportHeight;
}

function flush(): void {
	framePending = false;
	for (const listener of listeners) listener(state);
}

function schedule(): void {
	if (framePending) return;
	framePending = true;
	requestAnimationFrame(flush);
}

/** Called by the Lenis scroll callback so smoothed position drives everything. */
export function publishScroll(y: number): void {
	externallyDriven = true;
	recompute(y);
	schedule();
}

export function subscribeScroll(listener: Listener): () => void {
	ensureMeasured();
	listeners.add(listener);
	listener(state);
	return () => {
		listeners.delete(listener);
	};
}

export function getScrollState(): Readonly<ScrollState> {
	ensureMeasured();
	return state;
}

/** Re-measure after anything that changes layout height (fonts, text size, theme). */
export function refreshScrollMetrics(): void {
	measure();
	recompute(state.y);
	schedule();
}

export function initScrollOrchestrator(): () => void {
	if (started) return () => {};
	started = true;

	measure();
	recompute(window.scrollY);
	/* Push the real geometry to anything that subscribed before init. */
	schedule();

	const onNativeScroll = () => {
		if (externallyDriven) return;
		recompute(window.scrollY);
		schedule();
	};

	const onResize = () => {
		measure();
		recompute(externallyDriven ? state.y : window.scrollY);
		schedule();
	};

	window.addEventListener('scroll', onNativeScroll, { passive: true });
	window.addEventListener('resize', onResize);

	/* Late-loading fonts and images shift the hero height. */
	window.addEventListener('load', onResize);

	return () => {
		started = false;
		externallyDriven = false;
		listeners.clear();
		window.removeEventListener('scroll', onNativeScroll);
		window.removeEventListener('resize', onResize);
		window.removeEventListener('load', onResize);
	};
}
