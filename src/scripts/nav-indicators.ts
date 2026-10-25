/**
 * Themed nav hover, part of the "themed" transition experiment.
 * Orbit: a small orbiting dot glides to the hovered (else active) tab.
 * Flow: a wavy underline follows the cursor across the tabs.
 */
const FLOW_EASE = 0.22;

/**
 * Follows the chosen mode, not whether this page plays transitions: pages
 * excluded from transitions (Services, checkout) still get the hover feedback.
 * Same lookup as the head script in ViewTransitionExperiment.astro.
 */
function themedModeChosen(): boolean {
	try {
		const framed = /^vt:([a-z]+)$/.exec(window.name || '');
		return (framed ? framed[1] : localStorage.getItem('aditi-vt') || 'themed') === 'themed';
	} catch {
		return true;
	}
}

export function initNavIndicators(): void {
	const root = document.documentElement;
	if (!themedModeChosen()) return;
	const list = document.querySelector<HTMLElement>('[data-site-nav]');
	if (!list) return;

	const indicator = document.createElement('span');
	indicator.className = 'nav-indicator';
	indicator.setAttribute('aria-hidden', 'true');
	list.appendChild(indicator);
	list.classList.add('has-nav-indicator');

	const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
	let hovered: HTMLElement | null = null;
	let cursorX: number | null = null;
	let x = 0;
	let w = 0;
	let raf = 0;

	const tabs = () => Array.from(list.querySelectorAll<HTMLElement>('.nav-tab'));
	const activeTab = () => list.querySelector<HTMLElement>('.nav-tab[data-active="true"]');
	const flow = () => root.dataset.theme === 'beach';

	function placeOrbit() {
		const tab = hovered ?? activeTab();
		indicator.style.opacity = tab ? '1' : '0';
		if (!tab) return;
		indicator.style.transform = `translate(${tab.offsetLeft + tab.offsetWidth / 2}px, ${tab.offsetTop + tab.offsetHeight + 5}px)`;
	}

	function stepFlow() {
		raf = 0;
		const tab = hovered ?? activeTab();
		indicator.style.opacity = tab ? '1' : '0';
		if (!tab) return;
		const targetW = tab.offsetWidth * 0.72;
		const centre = hovered && cursorX !== null ? cursorX : tab.offsetLeft + tab.offsetWidth / 2;
		const min = tab.offsetLeft + targetW / 2;
		const max = tab.offsetLeft + tab.offsetWidth - targetW / 2;
		const targetX = Math.min(max, Math.max(min, centre)) - targetW / 2;
		x += (targetX - x) * FLOW_EASE;
		w += (targetW - w) * FLOW_EASE;
		indicator.style.width = `${w}px`;
		indicator.style.transform = `translate(${x}px, ${tab.offsetTop + tab.offsetHeight + 3}px)`;
		if (Math.abs(targetX - x) > 0.3 || Math.abs(targetW - w) > 0.3) raf = requestAnimationFrame(stepFlow);
	}

	function update() {
		indicator.dataset.kind = flow() ? 'flow' : 'orbit';
		if (flow()) {
			if (!finePointer.matches) {
				indicator.style.opacity = '0';
				return;
			}
			indicator.style.removeProperty('transform');
			if (!raf) raf = requestAnimationFrame(stepFlow);
		} else {
			indicator.style.removeProperty('width');
			placeOrbit();
		}
	}

	tabs().forEach((tab) => {
		tab.addEventListener('pointerenter', () => {
			hovered = tab;
			update();
		});
		tab.addEventListener('focus', () => {
			hovered = tab;
			update();
		});
		tab.addEventListener('blur', () => {
			hovered = null;
			update();
		});
	});
	list.addEventListener('pointermove', (e) => {
		cursorX = e.clientX - list.getBoundingClientRect().left + list.scrollLeft;
		if (flow()) update();
	});
	list.addEventListener('pointerleave', () => {
		hovered = null;
		cursorX = null;
		update();
	});

	new MutationObserver(update).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
	window.addEventListener('resize', update, { passive: true });
	/* Active tab is marked after load; place once it is known. */
	requestAnimationFrame(update);
}
