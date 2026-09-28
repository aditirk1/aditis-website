/**
 * Fullscreen lightbox for `[data-content-lightbox]`.
 */
export type LightboxItem = { src: string; caption?: string; alt?: string };

export type MediaLightboxController = {
	openGallery: (items: Array<LightboxItem | string>, startIndex?: number) => void;
	openSingle: (src: string, caption?: string) => void;
	close: () => void;
};

export function createMediaLightbox(): MediaLightboxController | null {
	const overlayEl = document.querySelector<HTMLDialogElement>('[data-content-lightbox]');
	const imgEl = document.querySelector<HTMLImageElement>('[data-content-lightbox-img]');
	const captionEl = document.querySelector<HTMLElement>('[data-content-lightbox-caption]');
	const btnPrev = document.querySelector<HTMLButtonElement>('[data-content-lightbox-prev]');
	const btnNext = document.querySelector<HTMLButtonElement>('[data-content-lightbox-next]');
	const btnClose = document.querySelector<HTMLButtonElement>('[data-content-lightbox-close]');

	if (!overlayEl || !imgEl) return null;

	// Bound after the guard so the hoisted helpers below see non-null types.
	const overlay = overlayEl;
	const img = imgEl;

	const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	let items: LightboxItem[] = [];
	let current = 0;
	let returnFocus: HTMLElement | null = null;

	function setNav() {
		const multi = items.length > 1;
		if (btnPrev) btnPrev.hidden = !multi;
		if (btnNext) btnNext.hidden = !multi;
	}

	function showAt(i: number) {
		if (items.length === 0) return;
		current = ((i % items.length) + items.length) % items.length;
		const item = items[current]!;
		img.src = item.src;
		const text = item.caption ?? '';
		img.alt = item.alt ?? text;
		if (captionEl) {
			if (text) {
				captionEl.textContent = text;
				captionEl.hidden = false;
			} else {
				captionEl.hidden = true;
			}
		}
		if (!overlay.open) {
			returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
			overlay.showModal();
			btnClose?.focus();
		}
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
		if (overlay.open) overlay.close();
	}

	/* Fires for close(), the Escape key, and form-method=dialog alike. */
	overlay.addEventListener('close', () => {
		document.body.style.overflow = '';
		img.style.transition = '';
		returnFocus?.focus();
		returnFocus = null;
	});

	function onKey(e: KeyboardEvent) {
		if (!overlay.open) return;
		if (items.length <= 1) return;
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
		openGallery(next: Array<LightboxItem | string>, startIndex = 0) {
			items = next
				.map((it) => (typeof it === 'string' ? { src: it } : it))
				.filter((it) => Boolean(it.src));
			showAt(startIndex);
		},
		openSingle(src: string, caption?: string) {
			items = [{ src, caption }];
			showAt(0);
		},
		close,
	};
}

/** Gallery buttons: parent `[data-lightbox-gallery]` JSON array (src strings or LightboxItem) + `[data-lightbox-open]` index */
export function initGalleryLightboxButtons(lightbox: MediaLightboxController): () => void {
	const handlers: Array<{ el: Element; fn: () => void }> = [];

	document.querySelectorAll<HTMLElement>('[data-lightbox-gallery]').forEach((root) => {
		const raw = root.getAttribute('data-lightbox-gallery');
		if (!raw) return;
		let galleryItems: Array<LightboxItem | string> = [];
		try {
			galleryItems = JSON.parse(raw) as Array<LightboxItem | string>;
		} catch {
			return;
		}
		root.querySelectorAll<HTMLElement>('[data-lightbox-open]').forEach((btn) => {
			const fn = () => {
				const idx = Number(btn.getAttribute('data-lightbox-open') ?? '0');
				lightbox.openGallery(galleryItems, idx);
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
	const items: LightboxItem[] = images.map((el) => ({
		src: el.currentSrc || el.src,
		caption:
			el.closest('figure')?.querySelector('figcaption')?.textContent?.trim() ||
			el.getAttribute('alt') ||
			undefined,
		alt: el.getAttribute('alt') ?? undefined,
	}));
	const handlers: Array<{ el: HTMLImageElement; click: () => void; key: (e: KeyboardEvent) => void }> =
		[];

	images.forEach((figureImg, index) => {
		figureImg.classList.add('prose-lightbox-img');
		figureImg.tabIndex = 0;
		const click = () => lightbox.openGallery(items, index);
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
