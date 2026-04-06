/**
 * Ambient soundtrack — crossfades on theme change and on entering /dream-journal.
 * When MP3 files are missing from /public/audio/, synthesizes gentle ambient drones
 * using the Web Audio API so sound works out of the box.
 */
export const STORAGE_VOLUME = 'aditi-audio-volume';
export const STORAGE_TRACK = 'aditi-audio-track-index';
export const STORAGE_MUTED = 'aditi-audio-muted';

export const TRACKS = {
	universe: ['universe-1.mp3', 'universe-2.mp3'],
	beach: ['beach-1.mp3', 'beach-2.mp3'],
	dream: ['dream-1.mp3', 'dream-2.mp3'],
} as const;

export type ThemeKey = 'universe' | 'beach';

const SYNTH_PRESETS: Record<keyof typeof TRACKS, { freqs: number[]; detune: number; filterFreq: number; type: OscillatorType }[]> = {
	universe: [
		{ freqs: [55, 82.41, 110], detune: -5, filterFreq: 400, type: 'sine' },
		{ freqs: [65.41, 98, 130.81], detune: 8, filterFreq: 350, type: 'sine' },
	],
	beach: [
		{ freqs: [130.81, 196, 261.63], detune: 3, filterFreq: 800, type: 'sine' },
		{ freqs: [146.83, 220, 293.66], detune: -4, filterFreq: 700, type: 'sine' },
	],
	dream: [
		{ freqs: [73.42, 110, 146.83], detune: 12, filterFreq: 500, type: 'sine' },
		{ freqs: [82.41, 123.47, 164.81], detune: -8, filterFreq: 450, type: 'sine' },
	],
};

function themeFromDoc(): ThemeKey {
	return document.documentElement.getAttribute('data-theme') === 'beach' ? 'beach' : 'universe';
}

function isDreamRoute(): boolean {
	return window.location.pathname.startsWith('/dream-journal');
}

function clamp(n: number, a: number, b: number): number {
	return Math.max(a, Math.min(b, n));
}

interface SynthVoice {
	ctx: AudioContext;
	gain: GainNode;
	oscs: OscillatorNode[];
	filter: BiquadFilterNode;
	lfo: OscillatorNode;
	lfoGain: GainNode;
}

function createSynthVoice(preset: typeof SYNTH_PRESETS['universe'][0]): SynthVoice {
	const ctx = new AudioContext();
	const gain = ctx.createGain();
	gain.gain.value = 0;

	const filter = ctx.createBiquadFilter();
	filter.type = 'lowpass';
	filter.frequency.value = preset.filterFreq;
	filter.Q.value = 0.7;
	filter.connect(gain);
	gain.connect(ctx.destination);

	const lfo = ctx.createOscillator();
	lfo.frequency.value = 0.08 + Math.random() * 0.04;
	const lfoGain = ctx.createGain();
	lfoGain.gain.value = preset.filterFreq * 0.3;
	lfo.connect(lfoGain);
	lfoGain.connect(filter.frequency);
	lfo.start();

	const oscs = preset.freqs.map((freq) => {
		const osc = ctx.createOscillator();
		osc.type = preset.type;
		osc.frequency.value = freq;
		osc.detune.value = preset.detune + (Math.random() - 0.5) * 6;
		osc.connect(filter);
		osc.start();
		return osc;
	});

	return { ctx, gain, oscs, filter, lfo, lfoGain };
}

function destroySynthVoice(voice: SynthVoice) {
	voice.oscs.forEach((o) => { try { o.stop(); o.disconnect(); } catch {} });
	try { voice.lfo.stop(); voice.lfo.disconnect(); } catch {}
	voice.lfoGain.disconnect();
	voice.filter.disconnect();
	voice.gain.disconnect();
	voice.ctx.close().catch(() => {});
}

export function initAmbientAudio(): () => void {
	const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	const a = document.createElement('audio');
	const b = document.createElement('audio');
	a.preload = 'auto';
	b.preload = 'auto';
	a.loop = true;
	b.loop = true;
	a.volume = 0;
	b.volume = 0;
	let front = a;
	let back = b;
	let fading = false;
	let lastKey = '';
	let usingSynth = false;
	let currentSynth: SynthVoice | null = null;

	const defaultVol = 0.15;
	let targetVolume = clamp(Number(localStorage.getItem(STORAGE_VOLUME)) || defaultVol, 0, 1);
	let muted = localStorage.getItem(STORAGE_MUTED) === '1';
	let trackIndex = clamp(Number(localStorage.getItem(STORAGE_TRACK)) || 0, 0, 99);

	function effectiveMode(): keyof typeof TRACKS {
		if (isDreamRoute()) return 'dream';
		return themeFromDoc();
	}

	function listForMode(m: keyof typeof TRACKS): readonly string[] {
		return TRACKS[m];
	}

	function srcFor(m: keyof typeof TRACKS, idx: number): string {
		const list = listForMode(m);
		const file = list[idx % list.length];
		return new URL(`/audio/${file}`, window.location.origin).href;
	}

	function applyUi() {
		const mode = effectiveMode();
		const len = listForMode(mode).length;
		document.querySelectorAll('[data-audio-mute-label]').forEach((el) => {
			el.textContent = muted ? 'Sound off' : 'Sound on';
		});
		document.querySelectorAll('[data-audio-volume-slider]').forEach((el) => {
			if (el instanceof HTMLInputElement) el.value = String(Math.round(targetVolume * 100));
		});
		document.querySelectorAll('[data-audio-track-select]').forEach((el) => {
			if (el instanceof HTMLSelectElement) {
				el.innerHTML = '';
				for (let i = 0; i < len; i++) {
					const opt = document.createElement('option');
					opt.value = String(i);
					opt.textContent = `Ambience ${i + 1}`;
					el.appendChild(opt);
				}
				el.value = String(trackIndex % len);
			}
		});
	}

	function fadeVolume(el: HTMLAudioElement, to: number, ms: number): Promise<void> {
		const from = el.volume;
		const t0 = performance.now();
		return new Promise((resolve) => {
			function step(now: number) {
				const u = Math.min(1, (now - t0) / ms);
				el.volume = from + (to - from) * u;
				if (u < 1) requestAnimationFrame(step);
				else resolve();
			}
			requestAnimationFrame(step);
		});
	}

	function fadeSynthVolume(voice: SynthVoice, to: number, ms: number): Promise<void> {
		const now = voice.ctx.currentTime;
		voice.gain.gain.cancelScheduledValues(now);
		voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
		voice.gain.gain.linearRampToValueAtTime(to, now + ms / 1000);
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	function stopSynth() {
		if (currentSynth) {
			destroySynthVoice(currentSynth);
			currentSynth = null;
		}
		usingSynth = false;
	}

	async function startSynth(mode: keyof typeof TRACKS, idx: number) {
		stopSynth();
		const presets = SYNTH_PRESETS[mode];
		const preset = presets[idx % presets.length];
		const voice = createSynthVoice(preset);
		currentSynth = voice;
		usingSynth = true;

		if (voice.ctx.state === 'suspended') {
			await voice.ctx.resume().catch(() => {});
		}

		if (!muted) {
			await fadeSynthVolume(voice, targetVolume * 0.25, 800);
		}
	}

	async function crossfadeTo(nextSrc: string) {
		stopSynth();

		if (muted) {
			front.src = nextSrc;
			front.load();
			front.pause();
			front.volume = 0;
			return;
		}

		if (reduceMotion) {
			front.src = nextSrc;
			front.load();
			try {
				await front.play();
			} catch {
				/* autoplay policy or missing file — try synth */
			}
			front.volume = targetVolume;
			return;
		}
		if (fading) return;
		fading = true;
		back.src = nextSrc;
		back.load();

		let fileError = false;
		back.addEventListener('error', () => { fileError = true; }, { once: true });

		await new Promise<void>((r) => setTimeout(r, 200));

		if (fileError) {
			fading = false;
			return false;
		}

		try {
			await back.play();
		} catch {
			fading = false;
			return false;
		}
		const v = targetVolume;
		back.volume = 0;
		await Promise.all([fadeVolume(front, 0, 700), fadeVolume(back, v, 700)]);
		front.pause();
		[front, back] = [back, front];
		fading = false;
		return true;
	}

	async function syncPlayback() {
		const mode = effectiveMode();
		const list = listForMode(mode);
		const idx = trackIndex % list.length;
		const key = `${mode}:${idx}`;
		const nextSrc = srcFor(mode, idx);

		if (key !== lastKey || !front.src) {
			lastKey = key;
			const success = await crossfadeTo(nextSrc);
			if (success === false) {
				await startSynth(mode, idx);
				applyUi();
				return;
			}
		}

		if (usingSynth && currentSynth) {
			if (muted) {
				await fadeSynthVolume(currentSynth, 0, 300);
			} else {
				if (currentSynth.ctx.state === 'suspended') {
					await currentSynth.ctx.resume().catch(() => {});
				}
				await fadeSynthVolume(currentSynth, targetVolume * 0.25, 300);
			}
		} else {
			if (muted) {
				front.volume = 0;
				front.pause();
			} else {
				try {
					await front.play();
				} catch {
					await startSynth(mode, idx);
				}
				if (!usingSynth) front.volume = targetVolume;
			}
		}
		applyUi();
	}

	applyUi();
	void syncPlayback();

	const onRouteOrTheme = () => void syncPlayback();
	const mo = new MutationObserver(onRouteOrTheme);
	mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
	window.addEventListener('popstate', onRouteOrTheme);

	document.addEventListener('click', (e) => {
		const btn = (e.target as HTMLElement).closest('[data-audio-mute-toggle]');
		if (!btn) return;
		muted = !muted;
		localStorage.setItem(STORAGE_MUTED, muted ? '1' : '0');
		if (muted) {
			if (usingSynth && currentSynth) {
				fadeSynthVolume(currentSynth, 0, 300);
			} else {
				front.volume = 0;
				front.pause();
			}
		} else {
			void syncPlayback();
		}
		applyUi();
	});

	document.addEventListener('input', (e) => {
		const t = e.target as HTMLInputElement;
		if (t.matches('[data-audio-volume-slider]')) {
			targetVolume = clamp(Number(t.value) / 100, 0, 1);
			localStorage.setItem(STORAGE_VOLUME, String(targetVolume));
			if (!muted) {
				if (usingSynth && currentSynth) {
					currentSynth.gain.gain.value = targetVolume * 0.25;
				} else {
					front.volume = targetVolume;
				}
			}
		}
	});

	document.addEventListener('change', (e) => {
		const t = e.target as HTMLSelectElement;
		if (t.matches('[data-audio-track-select]')) {
			trackIndex = Number(t.value);
			localStorage.setItem(STORAGE_TRACK, String(trackIndex));
			lastKey = '';
			void syncPlayback();
		}
	});

	return () => {
		mo.disconnect();
		window.removeEventListener('popstate', onRouteOrTheme);
		front.pause();
		back.pause();
		stopSynth();
	};
}
