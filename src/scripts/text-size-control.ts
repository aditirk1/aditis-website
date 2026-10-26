import {
	TEXT_SCALE_DEFAULT,
	TEXT_SCALE_STEPS,
	applyTextScale,
	getTextScale,
	nextTextScale,
	prevTextScale,
} from '../utils/text-size-preference';

function syncTextSizeButtons(scale: number): void {
	const dec = document.querySelector('[data-text-size-decrease]') as HTMLButtonElement | null;
	const inc = document.querySelector('[data-text-size-increase]') as HTMLButtonElement | null;
	const reset = document.querySelector('[data-text-size-reset]') as HTMLButtonElement | null;

	if (dec) dec.disabled = scale <= TEXT_SCALE_STEPS[0];
	if (inc) inc.disabled = scale >= TEXT_SCALE_STEPS[TEXT_SCALE_STEPS.length - 1];
	if (reset) reset.setAttribute('aria-pressed', scale === TEXT_SCALE_DEFAULT ? 'true' : 'false');
}

export function initTextSizeControl(): () => void {
	applyTextScale(getTextScale());
	syncTextSizeButtons(getTextScale());

	const onDecrease = () => {
		const next = prevTextScale(getTextScale());
		applyTextScale(next);
		syncTextSizeButtons(next);
	};

	const onIncrease = () => {
		const next = nextTextScale(getTextScale());
		applyTextScale(next);
		syncTextSizeButtons(next);
	};

	const onReset = () => {
		applyTextScale(TEXT_SCALE_DEFAULT);
		syncTextSizeButtons(TEXT_SCALE_DEFAULT);
	};

	const dec = document.querySelector('[data-text-size-decrease]');
	const inc = document.querySelector('[data-text-size-increase]');
	const reset = document.querySelector('[data-text-size-reset]');

	dec?.addEventListener('click', onDecrease);
	inc?.addEventListener('click', onIncrease);
	reset?.addEventListener('click', onReset);

	/* No hover on touch screens: a tap opens the collapsed control, a tap elsewhere closes it. */
	const control = document.querySelector<HTMLElement>('[data-text-size-control]');
	const noHover = matchMedia('(hover: none)');
	const onControlTap = (e: Event) => {
		if (!control || !noHover.matches || control.hasAttribute('data-open')) return;
		e.preventDefault();
		control.setAttribute('data-open', '');
	};
	const onOutside = (e: Event) => {
		if (control?.hasAttribute('data-open') && !control.contains(e.target as Node)) {
			control.removeAttribute('data-open');
		}
	};
	control?.addEventListener('click', onControlTap, { capture: true });
	document.addEventListener('pointerdown', onOutside);

	return () => {
		dec?.removeEventListener('click', onDecrease);
		inc?.removeEventListener('click', onIncrease);
		reset?.removeEventListener('click', onReset);
		control?.removeEventListener('click', onControlTap, { capture: true });
		document.removeEventListener('pointerdown', onOutside);
	};
}
