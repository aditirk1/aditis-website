/**
 * Sample gallery folders → coverflow overlay (GSAP).
 * Wheel uses the standard carousel lock: first event steps once, ignore the
 * rest of the burst / trackpad momentum, unlock after the slide animation.
 * @see https://blog.developerehsan.com/how-to-debounce-wheel-scrolling-with-a-lock/
 */
import { gsap } from 'gsap';

type GalleryImage = { src: string; alt: string };
type GalleryAlbum = {
	id: string;
	title: string;
	blurb: string;
	images: GalleryImage[];
};

type Pose = {
	x: number;
	y: number;
	z: number;
	rotateY: number;
	rotateZ: number;
	scale: number;
	opacity: number;
	filter: string;
	zIndex: number;
};

/** Covers GSAP slide (~500ms) + Mac trackpad inertia tail. */
const WHEEL_LOCK_MS = 750;

export function initSampleGalleries(): () => void {
	const root = document.querySelector<HTMLElement>('[data-sample-galleries]');
	const overlay = document.querySelector<HTMLDialogElement>('[data-sg-overlay]');
	const stage = document.querySelector<HTMLElement>('[data-sg-stage]');
	const coverflow = document.querySelector<HTMLElement>('[data-sg-coverflow]');
	const labelEl = document.querySelector<HTMLElement>('[data-sg-label]');
	if (!root || !overlay || !stage || !coverflow || !labelEl) return () => {};

	const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	let album: GalleryAlbum | null = null;
	let focus = 0;
	let detail = false;
	let openFromBtn: HTMLElement | null = null;
	/** Sync lock — must be a plain boolean, not a timestamp refreshed by ignored events. */
	let wheelLocked = false;
	let wheelUnlockTimer = 0;
	let touchX = 0;
	let touchY = 0;
	let touchActive = false;
	let touchMoved = false;
	const cleanups: Array<() => void> = [];

	function albumFromId(id: string): GalleryAlbum | null {
		const node = root.querySelector(`script[data-sg-album="${CSS.escape(id)}"]`);
		if (!node?.textContent) return null;
		try {
			return JSON.parse(node.textContent) as GalleryAlbum;
		} catch {
			return null;
		}
	}

	function poseFor(i: number, f: number): Pose {
		const d = i - f;
		const ad = Math.abs(d);
		const w = window.innerWidth;
		const spread = w < 640 ? 54 : w < 900 ? 68 : 82;
		const depth = w < 640 ? 70 : 90;
		const tilt = w < 640 ? 28 : 38;
		return {
			x: d * spread,
			y: 0,
			z: -ad * depth,
			rotateY: -d * tilt,
			rotateZ: 0,
			scale: Math.max(0.72, 1 - ad * 0.08),
			opacity: Math.max(0.28, 1 - ad * 0.22),
			filter: ad < 0.35 ? 'brightness(1)' : `brightness(${Math.max(0.45, 1 - ad * 0.18)})`,
			zIndex: Math.round(40 - ad * 10),
		};
	}

	function detailScale(el: HTMLElement): number {
		const w = el.offsetWidth || 240;
		const h = el.offsetHeight || w * (4 / 3);
		const maxW = window.innerWidth * (window.innerWidth < 640 ? 0.94 : 0.9);
		const maxH = window.innerHeight * (window.innerWidth < 640 ? 0.72 : 0.8);
		return Math.min(maxW / w, maxH / h);
	}

	function layout(animate: boolean) {
		const items = [...coverflow.querySelectorAll<HTMLElement>('[data-sg-item]')];
		items.forEach((el, i) => {
			const onFocus = Math.round(focus) === i;
			el.classList.toggle('is-active', onFocus && !detail);
			el.classList.toggle('is-detail', detail && onFocus);
			if (onFocus) el.setAttribute('aria-current', 'true');
			else el.removeAttribute('aria-current');

			if (detail && onFocus) {
				const target: Pose = {
					x: 0,
					y: 0,
					z: 120,
					rotateY: 0,
					rotateZ: 0,
					scale: detailScale(el),
					opacity: 1,
					filter: 'brightness(1)',
					zIndex: 50,
				};
				if (animate && !reduce) gsap.to(el, { ...target, duration: 0.55, ease: 'power3.out', overwrite: 'auto' });
				else gsap.set(el, target);
				return;
			}

			const pose = poseFor(i, focus);
			if (detail && !onFocus) {
				pose.opacity *= 0.18;
				pose.scale *= 0.9;
			}
			if (animate && !reduce) gsap.to(el, { ...pose, duration: 0.5, ease: 'power3.out', overwrite: 'auto' });
			else gsap.set(el, pose);
		});
	}

	function setFocus(next: number, animate = true) {
		if (!album) return;
		const max = album.images.length - 1;
		focus = Math.max(0, Math.min(max, next));
		layout(animate);
	}

	function buildItems(a: GalleryAlbum) {
		coverflow.replaceChildren();
		a.images.forEach((img, i) => {
			const li = document.createElement('button');
			li.type = 'button';
			li.className = 'sg-coverflow__item';
			li.dataset.sgItem = String(i);
			li.setAttribute('aria-label', img.alt || `Photo ${i + 1}`);
			const image = document.createElement('img');
			image.src = img.src;
			image.alt = img.alt;
			image.draggable = false;
			image.loading = i < 3 ? 'eager' : 'lazy';
			image.decoding = 'async';
			li.appendChild(image);
			li.addEventListener('click', () => {
				if (touchMoved) return;
				if (Math.round(focus) === i) {
					detail = !detail;
					layout(true);
				} else {
					detail = false;
					setFocus(i, true);
				}
			});
			coverflow.appendChild(li);
		});
	}

	function unlockWheel() {
		wheelLocked = false;
	}

	function openAlbum(id: string, btn: HTMLElement) {
		const next = albumFromId(id);
		if (!next?.images?.length) return;
		album = next;
		focus = 0;
		detail = false;
		wheelLocked = false;
		window.clearTimeout(wheelUnlockTimer);
		openFromBtn = btn;
		labelEl.textContent = next.title;
		buildItems(next);

		const stack = btn.querySelector<HTMLElement>('.sg-folder__stack');
		overlay.showModal();
		document.documentElement.style.overflow = 'hidden';

		layout(false);
		if (reduce) return;

		const items = [...coverflow.querySelectorAll<HTMLElement>('[data-sg-item]')];
		const from = stack?.getBoundingClientRect();
		items.forEach((el, i) => {
			const pose = poseFor(i, 0);
			if (from) {
				const to = el.getBoundingClientRect();
				const dx = from.left + from.width / 2 - (to.left + to.width / 2);
				const dy = from.top + from.height / 2 - (to.top + to.height / 2);
				gsap.fromTo(
					el,
					{ x: dx, y: dy, z: -200, rotateY: (i - 1) * 18, rotateZ: 0, scale: 0.35, opacity: 0 },
					{ ...pose, duration: 0.75, delay: i * 0.045, ease: 'power3.out' },
				);
			} else {
				gsap.fromTo(
					el,
					{ opacity: 0, z: -240, scale: 0.6 },
					{ ...pose, duration: 0.65, delay: i * 0.04, ease: 'power3.out' },
				);
			}
		});
	}

	function closeOverlay() {
		if (!overlay.open) return;
		const finish = () => {
			overlay.close();
			document.documentElement.style.overflow = '';
			coverflow.replaceChildren();
			album = null;
			detail = false;
			wheelLocked = false;
			window.clearTimeout(wheelUnlockTimer);
			openFromBtn?.focus();
			openFromBtn = null;
		};

		if (reduce) {
			finish();
			return;
		}

		const items = [...coverflow.querySelectorAll<HTMLElement>('[data-sg-item]')];
		const to = openFromBtn?.querySelector<HTMLElement>('.sg-folder__stack')?.getBoundingClientRect();
		gsap.to(items, {
			opacity: 0,
			scale: 0.4,
			z: -160,
			y: to ? to.top + to.height / 2 - window.innerHeight / 2 : 40,
			duration: 0.35,
			stagger: 0.02,
			ease: 'power2.in',
			onComplete: finish,
		});
	}

	function step(dir: 1 | -1) {
		detail = false;
		setFocus(Math.round(focus) + dir, true);
	}

	/**
	 * One flick → one photo. A wheel/trackpad gesture fires a burst of events;
	 * lock on the first, ignore the rest, unlock after animation + inertia.
	 * Do not refresh the unlock timer on ignored events (that freezes input).
	 */
	function onWheel(e: WheelEvent) {
		if (!overlay.open || !album) return;

		const dominant = Math.abs(e.deltaX) >= Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
		if (Math.abs(dominant) < 1) return;

		e.preventDefault();

		if (wheelLocked) return;
		wheelLocked = true;

		if (detail) {
			detail = false;
			layout(true);
		}
		step(dominant > 0 ? 1 : -1);

		window.clearTimeout(wheelUnlockTimer);
		wheelUnlockTimer = window.setTimeout(unlockWheel, WHEEL_LOCK_MS);
	}

	function onTouchStart(e: TouchEvent) {
		if (!overlay.open || e.touches.length !== 1) return;
		const t = e.touches[0]!;
		touchActive = true;
		touchMoved = false;
		touchX = t.clientX;
		touchY = t.clientY;
	}

	function onTouchMove(e: TouchEvent) {
		if (!touchActive || !overlay.open || e.touches.length !== 1) return;
		const t = e.touches[0]!;
		const dx = t.clientX - touchX;
		const dy = t.clientY - touchY;
		if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.05) {
			touchMoved = true;
			e.preventDefault();
		}
	}

	function onTouchEnd(e: TouchEvent) {
		if (!touchActive || !album) return;
		touchActive = false;
		const t = e.changedTouches[0];
		if (!t) return;
		const dx = t.clientX - touchX;
		const dy = t.clientY - touchY;
		if (Math.abs(dx) < 36 || Math.abs(dx) < Math.abs(dy) * 1.05) {
			window.setTimeout(() => {
				touchMoved = false;
			}, 50);
			return;
		}
		step(dx < 0 ? 1 : -1);
		window.setTimeout(() => {
			touchMoved = false;
		}, 50);
	}

	function onKey(e: KeyboardEvent) {
		if (!overlay.open) return;
		if (e.key === 'Escape') {
			if (detail) {
				detail = false;
				layout(true);
			} else closeOverlay();
			e.preventDefault();
		} else if (e.key === 'ArrowRight') {
			step(1);
			e.preventDefault();
		} else if (e.key === 'ArrowLeft') {
			step(-1);
			e.preventDefault();
		} else if (e.key === 'Enter' && album) {
			detail = !detail;
			layout(true);
			e.preventDefault();
		}
	}

	root.addEventListener('click', (e) => {
		const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-sg-open]');
		const id = btn?.getAttribute('data-sg-open');
		if (btn && id) openAlbum(id, btn);
	});

	overlay.querySelector('[data-sg-close]')?.addEventListener('click', closeOverlay);
	overlay.querySelector('[data-sg-prev]')?.addEventListener('click', () => step(-1));
	overlay.querySelector('[data-sg-next]')?.addEventListener('click', () => step(1));
	overlay.addEventListener('click', (e) => {
		if (touchMoved) return;
		const t = e.target as HTMLElement;
		if (t.closest('[data-sg-item], .sg-overlay__chrome')) return;
		closeOverlay();
	});
	overlay.addEventListener('cancel', (e) => {
		e.preventDefault();
		closeOverlay();
	});

	/* Single listener only — dual window+overlay listeners were stepping twice. */
	const wheelOpts: AddEventListenerOptions = { capture: true, passive: false };
	overlay.addEventListener('wheel', onWheel, wheelOpts);
	overlay.addEventListener('touchstart', onTouchStart, { passive: true });
	overlay.addEventListener('touchmove', onTouchMove, { passive: false });
	overlay.addEventListener('touchend', onTouchEnd, { passive: true });
	window.addEventListener('keydown', onKey);
	cleanups.push(() => {
		overlay.removeEventListener('wheel', onWheel, wheelOpts);
		overlay.removeEventListener('touchstart', onTouchStart);
		overlay.removeEventListener('touchmove', onTouchMove);
		overlay.removeEventListener('touchend', onTouchEnd);
		window.removeEventListener('keydown', onKey);
		window.clearTimeout(wheelUnlockTimer);
	});

	return () => {
		for (const c of cleanups) c();
		if (overlay.open) {
			overlay.close();
			document.documentElement.style.overflow = '';
		}
	};
}
