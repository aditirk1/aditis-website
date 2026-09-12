import {
	DREAM_JOURNAL_ATTEMPTS_KEY,
	DREAM_JOURNAL_GATE_QUESTIONS,
	DREAM_JOURNAL_MAX_ATTEMPTS,
	DREAM_JOURNAL_QUESTION_KEY,
	DREAM_JOURNAL_UNLOCK_KEY,
	type DreamGateQuestion,
} from '../data/dream-journal-gate.ts';

function normalizeAnswer(raw: string): string {
	return raw
		.toLowerCase()
		.trim()
		.replace(/['']/g, "'")
		.replace(/[^\p{L}\p{N}\s'.]/gu, '')
		.replace(/\s+/g, ' ');
}

export function isDreamJournalUnlocked(): boolean {
	try {
		return sessionStorage.getItem(DREAM_JOURNAL_UNLOCK_KEY) === '1';
	} catch {
		return false;
	}
}

export function unlockDreamJournal(): void {
	try {
		sessionStorage.setItem(DREAM_JOURNAL_UNLOCK_KEY, '1');
		localStorage.removeItem(DREAM_JOURNAL_ATTEMPTS_KEY);
	} catch {
		/* ignore */
	}
}

function getAttemptCount(): number {
	try {
		const raw = localStorage.getItem(DREAM_JOURNAL_ATTEMPTS_KEY);
		const n = raw ? Number.parseInt(raw, 10) : 0;
		return Number.isFinite(n) && n > 0 ? n : 0;
	} catch {
		return 0;
	}
}

function setAttemptCount(n: number): void {
	try {
		localStorage.setItem(DREAM_JOURNAL_ATTEMPTS_KEY, String(n));
	} catch {
		/* ignore */
	}
}

export function isDreamJournalLockedOut(): boolean {
	return getAttemptCount() >= DREAM_JOURNAL_MAX_ATTEMPTS;
}

function pickRandomQuestion(excludeId?: string): DreamGateQuestion {
	const pool =
		excludeId && DREAM_JOURNAL_GATE_QUESTIONS.length > 1
			? DREAM_JOURNAL_GATE_QUESTIONS.filter((q) => q.id !== excludeId)
			: DREAM_JOURNAL_GATE_QUESTIONS;
	return pool[Math.floor(Math.random() * pool.length)]!;
}

export function getActiveGateQuestion(): DreamGateQuestion {
	try {
		const saved = sessionStorage.getItem(DREAM_JOURNAL_QUESTION_KEY);
		const found = DREAM_JOURNAL_GATE_QUESTIONS.find((q) => q.id === saved);
		if (found) return found;
	} catch {
		/* ignore */
	}
	const q = pickRandomQuestion();
	try {
		sessionStorage.setItem(DREAM_JOURNAL_QUESTION_KEY, q.id);
	} catch {
		/* ignore */
	}
	return q;
}

export function rotateGateQuestion(currentId: string): DreamGateQuestion {
	const q = pickRandomQuestion(currentId);
	try {
		sessionStorage.setItem(DREAM_JOURNAL_QUESTION_KEY, q.id);
	} catch {
		/* ignore */
	}
	return q;
}

/** egg ↔ eggs, beach ↔ beaches (simple trailing-s only) */
function singularForm(word: string): string {
	if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) {
		return word.slice(0, -1);
	}
	return word;
}

async function sha256Hex(text: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function checkGateAnswer(question: DreamGateQuestion, raw: string): Promise<boolean> {
	const normalized = normalizeAnswer(raw);
	if (!normalized) return false;
	const candidates = new Set([normalized, singularForm(normalized)]);
	for (const candidate of candidates) {
		const hash = await sha256Hex(candidate);
		if (question.answerHashes.includes(hash)) return true;
	}
	return false;
}

function shakeWrong(el: HTMLElement): void {
	el.classList.remove('dream-gate-shake');
	// Force reflow so the animation can restart on repeated wrongs.
	void el.offsetWidth;
	el.classList.add('dream-gate-shake');
	const onEnd = () => {
		el.classList.remove('dream-gate-shake');
		el.removeEventListener('animationend', onEnd);
	};
	el.addEventListener('animationend', onEnd);
}

export function initDreamJournalGate(root: HTMLElement): () => void {
	const gateEl = root.querySelector<HTMLElement>('[data-dream-gate]');
	const contentEl = root.querySelector<HTMLElement>('[data-dream-gate-content]');
	const form = root.querySelector<HTMLFormElement>('[data-dream-gate-form]');
	const inputEl = root.querySelector<HTMLInputElement>('[data-dream-gate-input]');
	const questionTextEl = root.querySelector<HTMLElement>('[data-dream-gate-question]');
	const errorEl = root.querySelector<HTMLElement>('[data-dream-gate-error]');
	const rotateBtn = root.querySelector<HTMLButtonElement>('[data-dream-gate-rotate]');
	const lockoutEl = root.querySelector<HTMLElement>('[data-dream-gate-lockout]');
	const panelEl = root.querySelector<HTMLElement>('[data-dream-gate-panel]');

	if (!gateEl || !contentEl || !form || !inputEl || !questionTextEl || !lockoutEl) {
		return () => {};
	}

	const gate = gateEl;
	const content = contentEl;
	const input = inputEl;
	const questionEl = questionTextEl;
	const lockout = lockoutEl;
	const shakeTarget = panelEl ?? form;

	let active = getActiveGateQuestion();
	let submitting = false;

	function reveal() {
		gate.hidden = true;
		lockout.hidden = true;
		content.hidden = false;
		root.removeAttribute('data-dream-locked');
		root.removeAttribute('data-dream-lockout');
	}

	function showLockout() {
		root.setAttribute('data-dream-locked', '1');
		root.setAttribute('data-dream-lockout', '1');
		content.hidden = true;
		form.hidden = true;
		lockout.hidden = false;
		gate.hidden = false;
		if (errorEl) {
			errorEl.textContent = '';
			errorEl.hidden = true;
		}
	}

	function showQuestion(q: DreamGateQuestion) {
		active = q;
		questionEl.textContent = q.question;
		input.value = '';
		if (errorEl) {
			errorEl.textContent = '';
			errorEl.hidden = true;
		}
		input.focus();
	}

	if (isDreamJournalUnlocked()) {
		reveal();
		return () => {};
	}

	if (isDreamJournalLockedOut()) {
		showLockout();
		return () => {};
	}

	root.setAttribute('data-dream-locked', '1');
	content.hidden = true;
	lockout.hidden = true;
	form.hidden = false;
	showQuestion(active);

	const onSubmit = (e: Event) => {
		e.preventDefault();
		if (submitting || isDreamJournalLockedOut()) return;
		submitting = true;
		void (async () => {
			try {
				if (await checkGateAnswer(active, input.value)) {
					unlockDreamJournal();
					reveal();
					return;
				}

				const attempts = getAttemptCount() + 1;
				setAttemptCount(attempts);
				shakeWrong(shakeTarget);

				if (attempts >= DREAM_JOURNAL_MAX_ATTEMPTS) {
					showLockout();
					return;
				}

				const remaining = DREAM_JOURNAL_MAX_ATTEMPTS - attempts;
				showQuestion(rotateGateQuestion(active.id));
				if (errorEl) {
					errorEl.textContent =
						remaining === 1
							? 'Not quite — one try left.'
							: `Not quite — ${remaining} tries left.`;
					errorEl.hidden = false;
				}
			} finally {
				submitting = false;
			}
		})();
	};

	const onRotate = () => {
		if (isDreamJournalLockedOut()) return;
		showQuestion(rotateGateQuestion(active.id));
	};

	form.addEventListener('submit', onSubmit);
	rotateBtn?.addEventListener('click', onRotate);

	return () => {
		form.removeEventListener('submit', onSubmit);
		rotateBtn?.removeEventListener('click', onRotate);
	};
}
