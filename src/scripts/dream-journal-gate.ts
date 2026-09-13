/**
 * Dream journal client: quiz → OAuth → fetch entries from /api/dreams (cookie).
 * Dream HTML is never embedded in the static page build.
 */
import {
	DREAM_JOURNAL_ATTEMPTS_KEY,
	DREAM_JOURNAL_GATE_QUESTIONS,
	DREAM_JOURNAL_MAX_ATTEMPTS,
	DREAM_JOURNAL_QUESTION_KEY,
	DREAM_JOURNAL_UNLOCK_KEY,
	type DreamGateQuestion,
} from '../data/dream-journal-gate.ts';

export type DreamListItem = {
	id: string;
	date: string;
	mood: string | null;
	preview: string;
};

function normalizeAnswer(raw: string): string {
	return raw
		.toLowerCase()
		.trim()
		.replace(/['']/g, "'")
		.replace(/[^\p{L}\p{N}\s'.]/gu, '')
		.replace(/\s+/g, ' ');
}

export function isQuizPassed(): boolean {
	try {
		return sessionStorage.getItem(DREAM_JOURNAL_UNLOCK_KEY) === '1';
	} catch {
		return false;
	}
}

export function markQuizPassed(): void {
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
	void el.offsetWidth;
	el.classList.add('dream-gate-shake');
	const onEnd = () => {
		el.classList.remove('dream-gate-shake');
		el.removeEventListener('animationend', onEnd);
	};
	el.addEventListener('animationend', onEnd);
}

async function fetchSession(): Promise<{ authenticated: boolean; name?: string | null }> {
	try {
		const res = await fetch('/api/dream-session', { credentials: 'same-origin' });
		if (!res.ok) return { authenticated: false };
		const data = (await res.json()) as { authenticated?: boolean; name?: string | null };
		return { authenticated: !!data.authenticated, name: data.name };
	} catch {
		return { authenticated: false };
	}
}

async function fetchDreamList(): Promise<DreamListItem[]> {
	const res = await fetch('/api/dreams', { credentials: 'same-origin' });
	if (res.status === 401) throw new Error('unauthorized');
	if (!res.ok) throw new Error('failed');
	const data = (await res.json()) as { entries?: DreamListItem[] };
	return Array.isArray(data.entries) ? data.entries : [];
}

async function fetchDreamEntry(id: string): Promise<{ id: string; date: string; mood: string | null; html: string }> {
	const res = await fetch(`/api/dreams/${encodeURIComponent(id)}`, { credentials: 'same-origin' });
	if (res.status === 401) throw new Error('unauthorized');
	if (res.status === 404) throw new Error('notfound');
	if (!res.ok) throw new Error('failed');
	const data = (await res.json()) as {
		entry?: { id: string; date: string; mood: string | null; html: string };
	};
	if (!data.entry) throw new Error('failed');
	return data.entry;
}

function formatDate(iso: string): string {
	const d = new Date(`${iso}T12:00:00`);
	if (Number.isNaN(d.valueOf())) return iso;
	return d.toLocaleDateString(undefined, {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	});
}

function bindDreamHits(root: Element): void {
	const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (reduce) return;
	root.querySelectorAll('.dream-hit').forEach((el) => {
		el.addEventListener('mouseenter', () => {
			(el as HTMLElement).style.transform = 'scale(1.08)';
			(el as HTMLElement).style.transition = 'transform 0.22s ease';
		});
		el.addEventListener('mouseleave', () => {
			(el as HTMLElement).style.transform = 'scale(1)';
		});
	});
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
	const authEl = root.querySelector<HTMLElement>('[data-dream-gate-auth]');
	const formWrap = root.querySelector<HTMLElement>('[data-dream-gate-form-wrap]');
	const listEl = root.querySelector<HTMLElement>('[data-dream-list]');
	const detailEl = root.querySelector<HTMLElement>('[data-dream-detail]');
	const statusEl = root.querySelector<HTMLElement>('[data-dream-status]');
	const signOutBtn = root.querySelector<HTMLButtonElement>('[data-dream-sign-out]');

	if (!gateEl || !contentEl || !form || !inputEl || !questionTextEl || !lockoutEl || !authEl) {
		return () => {};
	}

	const gate = gateEl;
	const content = contentEl;
	const input = inputEl;
	const questionEl = questionTextEl;
	const lockout = lockoutEl;
	const auth = authEl;
	const quizForm = form;
	const shakeTarget = panelEl ?? form;

	let active = getActiveGateQuestion();
	let submitting = false;

	function setPhase(phase: 'quiz' | 'auth' | 'lockout' | 'content') {
		if (phase === 'content') {
			root.removeAttribute('data-dream-locked');
			root.removeAttribute('data-dream-lockout');
			root.removeAttribute('data-dream-auth');
			gate.hidden = true;
			content.hidden = false;
			lockout.hidden = true;
			auth.hidden = true;
			if (formWrap) formWrap.hidden = true;
			return;
		}

		content.hidden = true;
		gate.hidden = false;
		root.setAttribute('data-dream-locked', '1');

		if (phase === 'lockout') {
			root.setAttribute('data-dream-lockout', '1');
			root.removeAttribute('data-dream-auth');
			lockout.hidden = false;
			auth.hidden = true;
			if (formWrap) formWrap.hidden = true;
			quizForm.hidden = true;
			return;
		}

		root.removeAttribute('data-dream-lockout');
		lockout.hidden = true;
		quizForm.hidden = false;

		if (phase === 'auth') {
			root.setAttribute('data-dream-auth', '1');
			auth.hidden = false;
			if (formWrap) formWrap.hidden = true;
			return;
		}

		root.removeAttribute('data-dream-auth');
		auth.hidden = true;
		if (formWrap) formWrap.hidden = false;
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

	function renderList(entries: DreamListItem[]) {
		if (!listEl) return;
		if (entries.length === 0) {
			listEl.innerHTML = `<div class="dream-realm-panel relative rounded-2xl px-6 py-6 md:px-8 md:py-8">
				<p class="text-[var(--page-muted)]">Nothing to see here yet — more to come very soon.</p>
				<p class="mt-2 text-sm text-[var(--page-muted)]">You made it past the gate, though.</p>
			</div>`;
			return;
		}
		listEl.innerHTML = entries
			.map(
				(e) => `<article class="dream-realm-panel relative rounded-2xl px-6 py-6 md:px-8 md:py-8">
					<p class="dream-entry-meta mb-3">${formatDate(e.date)}${e.mood ? ` · ${escapeHtml(e.mood)}` : ''}</p>
					<p class="text-[var(--page-muted)]">${escapeHtml(e.preview)}</p>
					<button type="button" data-dream-open="${escapeAttr(e.id)}" class="mt-4 inline-block text-sm font-bold tracking-wide text-[var(--color-amber)] underline-offset-2 hover:underline">
						Read full dream →
					</button>
				</article>`,
			)
			.join('');
	}

	function escapeHtml(s: string): string {
		return s
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	function escapeAttr(s: string): string {
		return escapeHtml(s).replace(/'/g, '&#39;');
	}

	async function showDetail(id: string) {
		if (!detailEl || !listEl) return;
		listEl.hidden = true;
		detailEl.hidden = false;
		detailEl.innerHTML = `<p class="text-[var(--page-muted)]">Loading…</p>`;
		try {
			const entry = await fetchDreamEntry(id);
			detailEl.innerHTML = `
				<p class="mb-8 flex flex-wrap items-center gap-x-4 gap-y-2">
					<button type="button" data-dream-back class="article-back-link">← All dreams</button>
				</p>
				<article class="dream-realm-panel relative px-6 py-8 md:px-8 md:py-10">
					<div class="dream-realm-article">
						<p class="dream-entry-meta mb-5">${formatDate(entry.date)}${entry.mood ? ` · ${escapeHtml(entry.mood)}` : ''}</p>
						<div class="dream-md space-y-4 text-lg leading-relaxed text-[var(--page-fg)] [&_p]:mb-4">${entry.html}</div>
					</div>
				</article>`;
			bindDreamHits(detailEl);
			const url = new URL(window.location.href);
			url.searchParams.set('id', id);
			history.replaceState({}, '', url);
		} catch {
			detailEl.innerHTML = `<p class="text-[var(--page-muted)]">Couldn’t load that dream.</p>
				<button type="button" data-dream-back class="mt-4 article-back-link">← All dreams</button>`;
		}
	}

	function showListView() {
		if (!detailEl || !listEl) return;
		detailEl.hidden = true;
		detailEl.innerHTML = '';
		listEl.hidden = false;
		const url = new URL(window.location.href);
		url.searchParams.delete('id');
		url.searchParams.delete('dream_auth');
		history.replaceState({}, '', url);
	}

	async function loadContent() {
		setPhase('content');
		if (statusEl) statusEl.textContent = 'Loading dreams…';
		try {
			const entries = await fetchDreamList();
			if (statusEl) statusEl.textContent = '';
			renderList(entries);
			const id = new URL(window.location.href).searchParams.get('id');
			if (id) await showDetail(id);
			else showListView();
		} catch {
			if (statusEl) {
				statusEl.textContent =
					'Couldn’t load dreams. Sign-in may have expired — try signing in again.';
			}
			markQuizPassed();
			setPhase('auth');
		}
	}

	async function boot() {
		if (isDreamJournalLockedOut() && !isQuizPassed()) {
			setPhase('lockout');
			return;
		}

		const session = await fetchSession();
		if (session.authenticated) {
			markQuizPassed();
			await loadContent();
			return;
		}

		if (isQuizPassed()) {
			setPhase('auth');
			return;
		}

		setPhase('quiz');
		showQuestion(active);
	}

	const onSubmit = (e: Event) => {
		e.preventDefault();
		if (submitting || isDreamJournalLockedOut()) return;
		submitting = true;
		void (async () => {
			try {
				if (await checkGateAnswer(active, input.value)) {
					markQuizPassed();
					setPhase('auth');
					return;
				}

				const attempts = getAttemptCount() + 1;
				setAttemptCount(attempts);
				shakeWrong(shakeTarget);

				if (attempts >= DREAM_JOURNAL_MAX_ATTEMPTS) {
					setPhase('lockout');
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

	const onContentClick = (e: Event) => {
		const t = e.target as HTMLElement | null;
		if (!t) return;
		const open = t.closest<HTMLElement>('[data-dream-open]');
		if (open?.dataset.dreamOpen) {
			void showDetail(open.dataset.dreamOpen);
			return;
		}
		if (t.closest('[data-dream-back]')) {
			showListView();
		}
	};

	const onSignOut = () => {
		void (async () => {
			await fetch('/api/dream-session', { method: 'DELETE', credentials: 'same-origin' });
			setPhase('auth');
		})();
	};

	quizForm.addEventListener('submit', onSubmit);
	rotateBtn?.addEventListener('click', onRotate);
	content.addEventListener('click', onContentClick);
	signOutBtn?.addEventListener('click', onSignOut);

	void boot();

	return () => {
		quizForm.removeEventListener('submit', onSubmit);
		rotateBtn?.removeEventListener('click', onRotate);
		content.removeEventListener('click', onContentClick);
		signOutBtn?.removeEventListener('click', onSignOut);
	};
}
