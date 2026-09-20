/**
 * Client UI for blog/thoughts comments (Google + GitHub sign-in).
 */
export type CommentItem = {
	id: string;
	name: string;
	provider: 'github' | 'google';
	body: string;
	createdAt: string;
};

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function formatWhen(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.valueOf())) return iso;
	return d.toLocaleString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	});
}

export function initComments(root: HTMLElement): () => void {
	const scope = root.dataset.commentsScope?.trim();
	if (!scope) return () => {};

	const listEl = root.querySelector<HTMLElement>('[data-comments-list]');
	const formWrap = root.querySelector<HTMLElement>('[data-comments-form-wrap]');
	const authWrap = root.querySelector<HTMLElement>('[data-comments-auth]');
	const statusEl = root.querySelector<HTMLElement>('[data-comments-status]');
	const form = root.querySelector<HTMLFormElement>('[data-comments-form]');
	const input = root.querySelector<HTMLTextAreaElement>('[data-comments-input]');
	const whoEl = root.querySelector<HTMLElement>('[data-comments-who]');
	const signOutBtn = root.querySelector<HTMLButtonElement>('[data-comments-sign-out]');

	const returnTo = `${window.location.pathname}${window.location.search}`;
	const googleHref = `/api/dream-auth?provider=google&return_to=${encodeURIComponent(returnTo)}`;
	const githubHref = `/api/dream-auth?provider=github&return_to=${encodeURIComponent(returnTo)}`;

	root.querySelectorAll<HTMLAnchorElement>('[data-comments-google]').forEach((a) => {
		a.href = googleHref;
	});
	root.querySelectorAll<HTMLAnchorElement>('[data-comments-github]').forEach((a) => {
		a.href = githubHref;
	});

	let isAdmin = false;
	let submitting = false;

	function setStatus(msg: string) {
		if (statusEl) statusEl.textContent = msg;
	}

	function renderList(comments: CommentItem[]) {
		if (!listEl) return;
		if (comments.length === 0) {
			listEl.innerHTML = `<p class="comments-empty">No comments yet — be the first.</p>`;
			return;
		}
		listEl.innerHTML = comments
			.map(
				(c) => `<article class="comments-item" data-comment-id="${escapeHtml(c.id)}">
					<header class="comments-item__meta">
						<span class="comments-item__name">${escapeHtml(c.name)}</span>
						<span class="comments-item__via">${c.provider === 'google' ? 'Google' : 'GitHub'}</span>
						<time datetime="${escapeHtml(c.createdAt)}">${escapeHtml(formatWhen(c.createdAt))}</time>
						${
							isAdmin
								? `<button type="button" class="comments-item__delete" data-comment-delete="${escapeHtml(c.id)}">Delete</button>`
								: ''
						}
					</header>
					<p class="comments-item__body">${escapeHtml(c.body).replace(/\n/g, '<br>')}</p>
				</article>`,
			)
			.join('');
	}

	async function load() {
		setStatus('Loading comments…');
		try {
			const res = await fetch(`/api/comments?scope=${encodeURIComponent(scope)}`, {
				credentials: 'same-origin',
			});
			const data = (await res.json()) as {
				ok?: boolean;
				comments?: CommentItem[];
				authenticated?: boolean;
				isAdmin?: boolean;
				viewer?: { name?: string | null } | null;
			};
			if (!res.ok || !data.ok) throw new Error('load failed');
			isAdmin = !!data.isAdmin;
			renderList(Array.isArray(data.comments) ? data.comments : []);
			setStatus('');

			if (data.authenticated) {
				authWrap && (authWrap.hidden = true);
				formWrap && (formWrap.hidden = false);
				if (whoEl) {
					whoEl.textContent = data.viewer?.name
						? `Signed in as ${data.viewer.name}`
						: 'Signed in';
				}
			} else {
				authWrap && (authWrap.hidden = false);
				formWrap && (formWrap.hidden = true);
			}
		} catch {
			setStatus('Couldn’t load comments (site may be redeploying — try again in a minute).');
		}
	}

	const onSubmit = (e: Event) => {
		e.preventDefault();
		if (submitting || !input) return;
		const body = input.value.trim();
		if (!body) return;
		submitting = true;
		void (async () => {
			try {
				const res = await fetch('/api/comments', {
					method: 'POST',
					credentials: 'same-origin',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ scope, body }),
				});
				if (res.status === 401) {
					setStatus('Please sign in again.');
					authWrap && (authWrap.hidden = false);
					formWrap && (formWrap.hidden = true);
					return;
				}
				if (!res.ok) {
					setStatus('Couldn’t post — try again.');
					return;
				}
				input.value = '';
				await load();
			} finally {
				submitting = false;
			}
		})();
	};

	const onClick = (e: Event) => {
		const t = e.target as HTMLElement | null;
		const del = t?.closest<HTMLElement>('[data-comment-delete]');
		if (!del?.dataset.commentDelete) return;
		const id = del.dataset.commentDelete;
		void (async () => {
			const res = await fetch(
				`/api/comments?scope=${encodeURIComponent(scope)}&id=${encodeURIComponent(id)}`,
				{ method: 'DELETE', credentials: 'same-origin' },
			);
			if (!res.ok) {
				setStatus('Couldn’t delete that comment.');
				return;
			}
			await load();
		})();
	};

	const onSignOut = () => {
		void (async () => {
			await fetch('/api/dream-session', { method: 'DELETE', credentials: 'same-origin' });
			await load();
		})();
	};

	form?.addEventListener('submit', onSubmit);
	listEl?.addEventListener('click', onClick);
	signOutBtn?.addEventListener('click', onSignOut);

	void load();

	return () => {
		form?.removeEventListener('submit', onSubmit);
		listEl?.removeEventListener('click', onClick);
		signOutBtn?.removeEventListener('click', onSignOut);
	};
}
