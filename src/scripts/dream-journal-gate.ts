import {
	DREAM_JOURNAL_GATE_QUESTIONS,
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
	} catch {
		/* ignore */
	}
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

function answersMatch(input: string, accepted: string): boolean {
	if (input === accepted) return true;
	return singularForm(input) === singularForm(accepted);
}

export function checkGateAnswer(question: DreamGateQuestion, raw: string): boolean {
	const normalized = normalizeAnswer(raw);
	if (!normalized) return false;
	return question.answers.some((a) => answersMatch(normalized, normalizeAnswer(a)));
}

export function initDreamJournalGate(root: HTMLElement): () => void {
	const gateEl = root.querySelector<HTMLElement>('[data-dream-gate]');
	const contentEl = root.querySelector<HTMLElement>('[data-dream-gate-content]');
	const form = root.querySelector<HTMLFormElement>('[data-dream-gate-form]');
	const inputEl = root.querySelector<HTMLInputElement>('[data-dream-gate-input]');
	const questionTextEl = root.querySelector<HTMLElement>('[data-dream-gate-question]');
	const errorEl = root.querySelector<HTMLElement>('[data-dream-gate-error]');
	const rotateBtn = root.querySelector<HTMLButtonElement>('[data-dream-gate-rotate]');

	if (!gateEl || !contentEl || !form || !inputEl || !questionTextEl) {
		return () => {};
	}

	// Bound after the guard so the hoisted helpers below see non-null types.
	const gate = gateEl;
	const content = contentEl;
	const input = inputEl;
	const questionEl = questionTextEl;

	let active = getActiveGateQuestion();

	function reveal() {
		gate.hidden = true;
		content.hidden = false;
		root.removeAttribute('data-dream-locked');
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

	root.setAttribute('data-dream-locked', '1');
	content.hidden = true;
	showQuestion(active);

	const onSubmit = (e: Event) => {
		e.preventDefault();
		if (checkGateAnswer(active, input.value)) {
			unlockDreamJournal();
			reveal();
			return;
		}
		if (errorEl) {
			errorEl.textContent = 'Not quite — try again, or pick another question.';
			errorEl.hidden = false;
		}
		input.select();
	};

	const onRotate = () => {
		showQuestion(rotateGateQuestion(active.id));
	};

	form.addEventListener('submit', onSubmit);
	rotateBtn?.addEventListener('click', onRotate);

	return () => {
		form.removeEventListener('submit', onSubmit);
		rotateBtn?.removeEventListener('click', onRotate);
	};
}
