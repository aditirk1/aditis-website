/**
 * Client enhancements for full-page project & blog articles.
 */
import {
	bindArticleProseLightbox,
	createMediaLightbox,
	type MediaLightboxController,
} from './media-lightbox.ts';

let sharedLightbox: MediaLightboxController | null = null;

function getLightbox(): MediaLightboxController | null {
	if (!sharedLightbox) sharedLightbox = createMediaLightbox();
	return sharedLightbox;
}

export function initContentArticle(): () => void {
	const root = document.querySelector('[data-content-article]') as HTMLElement | null;
	const lightbox = getLightbox();
	if (!root || !lightbox) return () => {};

	const stopImages = bindArticleProseLightbox(root, lightbox);

	return () => {
		stopImages();
		lightbox.close();
	};
}
