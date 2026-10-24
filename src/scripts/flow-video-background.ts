/**
 * Flow theme background video.
 *
 * Nothing is fetched until Flow is the active theme (preload="none" in the
 * markup), so Orbit visitors never download it. It pauses in background tabs.
 * Reduced motion and Data Saver get the still poster only; so does any browser
 * that refuses muted autoplay (iOS Low Power Mode), since play() just rejects.
 */

type NetworkInfo = { saveData?: boolean };

function isFlow(): boolean {
	return document.documentElement.getAttribute('data-theme') === 'beach';
}

function stillOnly(): boolean {
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
	const connection = (navigator as Navigator & { connection?: NetworkInfo }).connection;
	return connection?.saveData === true;
}

export function initFlowVideoBackground(): () => void {
	const root = document.querySelector<HTMLElement>('[data-beach-canvas]');
	const video = root?.querySelector<HTMLVideoElement>('[data-flow-video]');
	if (!root || !video) return () => {};

	const host = root;
	const player = video;
	let wasShowing = false;

	function apply(): void {
		const showing = isFlow();
		host.hidden = !showing;

		if (!showing) {
			player.pause();
			/* The starfield listens for this to resume as soon as Flow steps aside. */
			if (wasShowing) window.dispatchEvent(new CustomEvent('aditi:beach-gl-released'));
			wasShowing = false;
			return;
		}

		wasShowing = true;
		if (stillOnly() || document.hidden) {
			player.pause();
			return;
		}
		if (player.preload !== 'auto') player.preload = 'auto';
		player.play().catch(() => {
			/* Autoplay refused — the poster stays up, which is the intended fallback. */
		});
	}

	apply();

	const mo = new MutationObserver(apply);
	mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
	document.addEventListener('visibilitychange', apply);

	return () => {
		mo.disconnect();
		document.removeEventListener('visibilitychange', apply);
		player.pause();
	};
}
