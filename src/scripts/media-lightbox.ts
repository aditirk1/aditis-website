/**
 * Fullscreen lightbox for `[data-content-lightbox]`.
 */
export type MediaLightboxController = {
	openGallery: (sources: string[], startIndex?: number, caption?: string) => void;
	openSingle: (src: string, caption?: string) => void;
	close: () => void;
};

export function createMediaLightbox(): MediaLightboxController | null {
	const overlay = document.querySelector('[data-content-lightbox]') as HTMLElement | null;
	const img = document.querySelector('[data-content-lightbox-img]') as HTMLImageElement | null;
	const captionEl = document.querySelector('[data-content-lightbox-caption]') as HTMLElement | null;
	const btnPrev = document.querySelector('[data-content-lightbox-prev]') as HTMLButtonElement | null;
	const btnNext = document.querySelector('[data-content-lightbox-next]') as HTMLButtonElement | null;
	const btnClose = document.querySelector('[data-content-lightbox-close]') as HTMLButtonElement | null;

	if (!overlay || !img) return null;

	const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	let sources: string[] = [];
	let current = 0;

	function setNav() {
		const multi = sources.length > 1;
		if (btnPrev) btnPrev.hidden = !multi;
		if (btnNext) btnNext.hidden = !multi;
	}

	function showAt(i: number, cap?: string) {
		if (sources.length === 0) return;
		current = ((i % sources.length) + sources.length) % sources.length;
		img.src = sources[current]!;
		const text = cap ?? '';
		img.alt = text;
		if (captionEl) {
			if (text) {
				captionEl.textContent = text;
				captionEl.hidden = false;
			} else {
				captionEl.hidden = true;
			}
		}
		overlay.hidden = false;
		document.body.style.overflow = 'hidden';
		setNav();
		if (!reduce) {
			img.style.opacity = '0.88';
			img.style.transform = 'scale(0.97)';
			requestAnimationFrame(() => {
				img.style.transition = 'opacity 0.32s ease, transform 0.32s ease';
				img.style.opacity = '1';
				img.style.transform = 'scale(1)';
			});
		}
	}

	function close() {
		overlay.hidden = true;
		document.body.style.overflow = '';
		img.style.transition = '';
	}

	function onKey(e: KeyboardEvent) {
		if (overlay.hidden) return;
		if (e.key === 'Escape') close();
		if (sources.length <= 1) return;
		if (e.key === 'ArrowLeft') showAt(current - 1);
		if (e.key === 'ArrowRight') showAt(current + 1);
	}

	btnPrev?.addEventListener('click', () => showAt(current - 1));
	btnNext?.addEventListener('click', () => showAt(current + 1));
	btnClose?.addEventListener('click', close);
	overlay.addEventListener('click', (e) => {
		if (e.target === overlay) close();
	});
	window.addEventListener('keydown', onKey);

	return {
		openGallery(nextSources: string[], startIndex = 0, caption?: string) {
			sources = nextSources.filter(Boolean);
			showAt(startIndex, caption);
		},
		openSingle(src: string, caption?: string) {
			sources = [src];
			showAt(0, caption);
		},
		close,
	};
}

/** Gallery buttons: parent `[data-lightbox-gallery]` JSON array + `[data-lightbox-open]` index */
export function initGalleryLightboxButtons(lightbox: MediaLightboxController): () => void {
	const handlers: Array<{ el: Element; fn: () => void }> = [];

	document.querySelectorAll<HTMLElement>('[data-lightbox-gallery]').forEach((root) => {
		const raw = root.getAttribute('data-lightbox-gallery');
		if (!raw) return;
		let gallerySources: string[] = [];
		try {
			gallerySources = JSON.parse(raw) as string[];
		} catch {
			return;
		}
		root.querySelectorAll<HTMLElement>('[data-lightbox-open]').forEach((btn) => {
			const fn = () => {
				const idx = Number(btn.getAttribute('data-lightbox-open') ?? '0');
				const cap = btn.getAttribute('data-lightbox-caption') ?? undefined;
				lightbox.openGallery(gallerySources, idx, cap);
			};
			btn.addEventListener('click', fn);
			handlers.push({ el: btn, fn });
		});
	});

	return () => {
		for (const { el, fn } of handlers) el.removeEventListener('click', fn);
	};
}

export function bindArticleProseLightbox(
	articleRoot: HTMLElement,
	lightbox: MediaLightboxController,
): () => void {
	const images = Array.from(
		articleRoot.querySelectorAll<HTMLImageElement>(
			'.prose-article img:not([data-no-lightbox])',
		),
	);
	const sources = images.map((el) => el.currentSrc || el.src).filter(Boolean);
	const handlers: Array<{ el: HTMLImageElement; click: () => void; key: (e: KeyboardEvent) => void }> =
		[];

	images.forEach((figureImg, index) => {
		figureImg.classList.add('prose-lightbox-img');
		figureImg.tabIndex = 0;
		const click = () => {
			const cap =
				figureImg.closest('figure')?.querySelector('figcaption')?.textContent?.trim() ||
				figureImg.getAttribute('alt') ||
				undefined;
			lightbox.openGallery(sources, index, cap);
		};
		const key = (e: KeyboardEvent) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				click();
			}
		};
		figureImg.addEventListener('click', click);
		figureImg.addEventListener('keydown', key);
		handlers.push({ el: figureImg, click, key });
	});

	return () => {
		for (const { el, click, key } of handlers) {
			el.removeEventListener('click', click);
			el.removeEventListener('keydown', key);
		}
	};
}
