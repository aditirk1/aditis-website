export const TEXT_SCALE_KEY = 'aditi-text-scale';

/** Default is 10% larger than the original body copy size. */
export const TEXT_SCALE_DEFAULT = 1.1;

export const TEXT_SCALE_STEPS = [0.95, 1, 1.1, 1.2, 1.25, 1.3] as const;

export type TextScaleStep = (typeof TEXT_SCALE_STEPS)[number];

export function isTextScaleStep(value: number): value is TextScaleStep {
	return TEXT_SCALE_STEPS.some((step) => step === value);
}

export function snapTextScale(value: number): TextScaleStep {
	if (!Number.isFinite(value)) return TEXT_SCALE_DEFAULT;
	let nearest: TextScaleStep = TEXT_SCALE_DEFAULT;
	let minDist = Infinity;
	for (const step of TEXT_SCALE_STEPS) {
		const dist = Math.abs(step - value);
		if (dist < minDist) {
			minDist = dist;
			nearest = step;
		}
	}
	return nearest;
}

export function readStoredTextScale(): TextScaleStep | null {
	try {
		const raw = localStorage.getItem(TEXT_SCALE_KEY);
		if (raw === null) return null;
		const parsed = parseFloat(raw);
		if (!Number.isFinite(parsed)) return null;
		return snapTextScale(parsed);
	} catch {
		return null;
	}
}

export function getTextScale(): TextScaleStep {
	return readStoredTextScale() ?? TEXT_SCALE_DEFAULT;
}

export function applyTextScale(scale: TextScaleStep): void {
	const snapped = snapTextScale(scale);
	document.documentElement.style.setProperty('--reader-text-scale', String(snapped));
	try {
		localStorage.setItem(TEXT_SCALE_KEY, String(snapped));
	} catch {
		/* ignore */
	}
}

export function nextTextScale(current: TextScaleStep): TextScaleStep {
	const idx = TEXT_SCALE_STEPS.indexOf(current);
	if (idx < 0 || idx >= TEXT_SCALE_STEPS.length - 1) return current;
	return TEXT_SCALE_STEPS[idx + 1];
}

export function prevTextScale(current: TextScaleStep): TextScaleStep {
	const idx = TEXT_SCALE_STEPS.indexOf(current);
	if (idx <= 0) return current;
	return TEXT_SCALE_STEPS[idx - 1];
}
