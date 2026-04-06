/**
 * Minimal fullscreen lightbox for the photo dump: prev/next, Escape to close.
 */
export function initPhotoLightbox(sources: string[]): () => void {
	const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const overlay = document.querySelector('[data-photo-lightbox]') as HTMLElement | null;
	const img = document.querySelector('[data-photo-lightbox-img]') as HTMLImageElement | null;
	const btnPrev = document.querySelector('[data-photo-prev]') as HTMLButtonElement | null;
	const btnNext = document.querySelector('[data-photo-next]') as HTMLButtonElement | null;
	const btnClose = document.querySelector('[data-photo-close]') as HTMLButtonElement | null;

	if (!overlay || !img || sources.length === 0) return () => {};

	let current = 0;

	function show(i: number) {
		current = (i + sources.length) % sources.length;
		img.src = sources[current];
		img.classList.toggle('blur-sm', !reduce);
		img.classList.toggle('scale-105', !reduce);
		overlay.hidden = false;
		document.body.style.overflow = 'hidden';
		requestAnimationFrame(() => {
			img.classList.remove('blur-sm', 'scale-105');
		});
	}

	function close() {
		overlay.hidden = true;
		document.body.style.overflow = '';
	}

	document.querySelectorAll<HTMLButtonElement>('[data-photo-open]').forEach((btn) => {
		btn.addEventListener('click', () => {
			const i = Number(btn.dataset.photoOpen ?? '0');
			show(i);
		});
	});

	btnPrev?.addEventListener('click', () => show(current - 1));
	btnNext?.addEventListener('click', () => show(current + 1));
	btnClose?.addEventListener('click', close);
	overlay.addEventListener('click', (e) => {
		if (e.target === overlay) close();
	});
	window.addEventListener('keydown', (e) => {
		if (overlay.hidden) return;
		if (e.key === 'Escape') close();
		if (e.key === 'ArrowLeft') show(current - 1);
		if (e.key === 'ArrowRight') show(current + 1);
	});

	return () => {
		close();
	};
}
