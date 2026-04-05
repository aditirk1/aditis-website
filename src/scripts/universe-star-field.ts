/**
 * Universe theme — Three.js living star field
 *
 * Purpose:
 * - Full-viewport WebGL layer behind site content (fixed, pointer-events: none on the canvas wrapper).
 * - Thousands of soft points with depth-based parallax (scroll) and a water-like ripple near the cursor.
 * - One separate amber "star" mesh is the hidden Dream Journal trigger (dispatches a browser event on click).
 *
 * Performance notes:
 * - Pixel ratio is capped (see MAX_DPR) to protect mobile GPUs.
 * - prefers-reduced-motion: fewer stars + slower drift (still "alive", but calmer).
 * - OffscreenCanvas + WebGL in a worker is possible for extra isolation, but it is not wired here yet;
 *   the usual win for this site is capping DPR + pausing when the Beach theme is active.
 */
import * as THREE from 'three';

/** Dispatched on the window when the secret amber star is clicked */
export const DREAM_UNLOCK_EVENT = 'aditi:dream-unlock';

const CANVAS_ID = 'universe-star-field-canvas';

const MAX_DPR = 2;
const REDUCED_MOTION_STAR_COUNT = 1200;
const DEFAULT_STAR_COUNT = 6500;

function prefersReducedMotion(): boolean {
	return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getTheme(): 'universe' | 'beach' {
	const t = document.documentElement.getAttribute('data-theme');
	return t === 'beach' ? 'beach' : 'universe';
}

function createStarfieldMaterial(): THREE.ShaderMaterial {
	return new THREE.ShaderMaterial({
		transparent: true,
		depthWrite: false,
		blending: THREE.AdditiveBlending,
		uniforms: {
			uPixelRatio: { value: 1 },
			uMouse: { value: new THREE.Vector2(1e6, 1e6) },
			uScroll: { value: 0 },
		},
		vertexShader: /* glsl */ `
			attribute float aSize;
			attribute float aDepth;
			uniform float uPixelRatio;
			uniform vec2 uMouse;
			uniform float uScroll;
			varying float vStrength;

			void main() {
				vec3 pos = position;

				// Scroll parallax: deeper stars drift farther (flying-through-space feeling)
				float parallax = uScroll * (0.045 + aDepth * 0.11);
				pos.x -= parallax * 0.35;
				pos.y += parallax;

				vec2 delta = pos.xy - uMouse;
				float dist = length(delta);
				float wake = smoothstep(11.0, 0.0, dist);

				vStrength = 0.28 + aDepth * 0.62 + wake * 0.55;

				vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
				float baseSize = aSize * uPixelRatio * 260.0 / max(1.0, -mvPosition.z);
				gl_PointSize = clamp(baseSize * (1.0 + wake * 1.15), 1.2, 16.0);
				gl_Position = projectionMatrix * mvPosition;
			}
		`,
		fragmentShader: /* glsl */ `
			varying float vStrength;
			void main() {
				vec2 c = gl_PointCoord - vec2(0.5);
				float r = length(c);
				if (r > 0.5) discard;
				float alpha = smoothstep(0.5, 0.05, r) * vStrength;
				vec3 col = mix(vec3(1.0), vec3(1.0, 0.86, 0.62), 0.12);
				gl_FragColor = vec4(col, alpha);
			}
		`,
	});
}

export function initUniverseStarField(): () => void {
	const canvas = document.getElementById(CANVAS_ID) as HTMLCanvasElement | null;
	if (!canvas) {
		console.warn('[universe-star-field] Canvas not found:', CANVAS_ID);
		return () => {};
	}

	const reducedMotion = prefersReducedMotion();
	const STAR_COUNT = reducedMotion ? REDUCED_MOTION_STAR_COUNT : DEFAULT_STAR_COUNT;

	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 250);
	camera.position.z = 42;

	const renderer = new THREE.WebGLRenderer({
		canvas,
		alpha: true,
		antialias: false,
		powerPreference: 'high-performance',
	});
	renderer.setClearColor(0x000000, 0);

	const geometry = new THREE.BufferGeometry();
	const positions = new Float32Array(STAR_COUNT * 3);
	const base = new Float32Array(STAR_COUNT * 3);
	const scatter = new Float32Array(STAR_COUNT * 3);
	const aSize = new Float32Array(STAR_COUNT);
	const aDepth = new Float32Array(STAR_COUNT);
	const phase = new Float32Array(STAR_COUNT);

	for (let i = 0; i < STAR_COUNT; i++) {
		const ix = i * 3;
		const x = (Math.random() - 0.5) * 110;
		const y = (Math.random() - 0.5) * 110;
		const z = -Math.random() * 95 - 8;
		base[ix] = x;
		base[ix + 1] = y;
		base[ix + 2] = z;
		aDepth[i] = Math.random();
		aSize[i] = 0.35 + Math.random() * 1.65;
		phase[i] = Math.random() * Math.PI * 2;
	}

	geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
	geometry.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
	geometry.setAttribute('aDepth', new THREE.BufferAttribute(aDepth, 1));

	const material = createStarfieldMaterial();
	const points = new THREE.Points(geometry, material);
	scene.add(points);

	// --- Secret Dream Journal trigger (slightly larger amber "star", no label) ---
	const trigger = new THREE.Mesh(
		new THREE.CircleGeometry(0.62, 28),
		new THREE.MeshBasicMaterial({
			color: 0xffaa00,
			transparent: true,
			opacity: 0.92,
			depthWrite: false,
		}),
	);
	// Placed off-center so it feels discovered, not "UI centered"
	trigger.position.set(16.5, 9.5, -36);
	scene.add(trigger);

	const raycaster = new THREE.Raycaster();
	const pointer = new THREE.Vector2();
	let mouseWorld = new THREE.Vector2(1e6, 1e6);
	let lastScroll = typeof window !== 'undefined' ? window.scrollY : 0;

	const onScroll = () => {
		lastScroll = window.scrollY;
	};

	const onPointerMove = (e: PointerEvent) => {
		const rect = canvas.getBoundingClientRect();
		const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
		const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
		pointer.set(x, y);
		raycaster.setFromCamera(pointer, camera);
		const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 28);
		const hit = new THREE.Vector3();
		if (raycaster.ray.intersectPlane(plane, hit)) {
			mouseWorld.set(hit.x, hit.y);
		}
	};

	const onPointerLeave = () => {
		mouseWorld.set(1e6, 1e6);
	};

	const onClick = (e: MouseEvent) => {
		const rect = canvas.getBoundingClientRect();
		const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
		const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
		pointer.set(x, y);
		raycaster.setFromCamera(pointer, camera);
		const hits = raycaster.intersectObject(trigger, false);
		if (hits.length > 0) {
			window.dispatchEvent(new CustomEvent(DREAM_UNLOCK_EVENT, { bubbles: true }));
		}
	};

	function setSize() {
		const w = window.innerWidth;
		const h = window.innerHeight;
		const pr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
		renderer.setPixelRatio(pr);
		renderer.setSize(w, h, false);
		material.uniforms.uPixelRatio.value = pr;
	}

	setSize();

	let raf = 0;
	let running = false;

	const clock = new THREE.Clock();

	const tick = () => {
		if (!running) return;
		const t = clock.getElapsedTime();
		const driftScale = reducedMotion ? 0.35 : 1;

		material.uniforms.uMouse.value.copy(mouseWorld);
		material.uniforms.uScroll.value = lastScroll * (reducedMotion ? 0.00035 : 0.00085);

		const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;

		for (let i = 0; i < STAR_COUNT; i++) {
			const ix = i * 3;
			const bx = base[ix];
			const by = base[ix + 1];
			const bz = base[ix + 2];
			const d = aDepth[i];
			const ph = phase[i];

			const dx = bx - mouseWorld.x;
			const dy = by - mouseWorld.y;
			const dist = Math.hypot(dx, dy);
			const influence = Math.max(0, 1 - dist / 14) * (reducedMotion ? 0.45 : 1);

			if (influence > 0 && dist > 0.0001) {
				const push = influence * 0.09;
				scatter[ix] += (dx / dist) * push;
				scatter[ix + 1] += (dy / dist) * push;
			}

			scatter[ix] *= 0.9;
			scatter[ix + 1] *= 0.9;
			scatter[ix + 2] *= 0.9;

			const driftX = Math.sin(t * (0.12 + d * 0.08) * driftScale + ph) * (0.28 + d * 0.35) * driftScale;
			const driftY = Math.cos(t * (0.1 + d * 0.09) * driftScale + ph * 1.3) * (0.26 + d * 0.32) * driftScale;

			posAttr.array[ix] = bx + driftX + scatter[ix];
			posAttr.array[ix + 1] = by + driftY + scatter[ix + 1];
			posAttr.array[ix + 2] = bz + scatter[ix + 2];
		}
		posAttr.needsUpdate = true;

		// Gentle breathing on the secret trigger so it feels like part of the sky
		const breathe = 1 + Math.sin(t * 0.7) * 0.04;
		trigger.scale.setScalar(breathe);

		renderer.render(scene, camera);
		raf = requestAnimationFrame(tick);
	};

	function start() {
		if (running) return;
		running = true;
		clock.start();
		raf = requestAnimationFrame(tick);
	}

	function stop() {
		running = false;
		cancelAnimationFrame(raf);
	}

	function applyVisibility() {
		const theme = getTheme();
		const root = canvas.closest('[data-universe-canvas]') as HTMLElement | null;
		if (theme === 'beach') {
			stop();
			if (root) root.style.visibility = 'hidden';
			return;
		}
		if (root) root.style.visibility = 'visible';
		start();
	}

	applyVisibility();

	const mo = new MutationObserver(() => applyVisibility());
	mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

	window.addEventListener('scroll', onScroll, { passive: true });
	window.addEventListener('resize', setSize);
	window.addEventListener('pointermove', onPointerMove, { passive: true });
	canvas.addEventListener('pointerleave', onPointerLeave);
	canvas.addEventListener('click', onClick);

	return () => {
		stop();
		mo.disconnect();
		window.removeEventListener('scroll', onScroll);
		window.removeEventListener('resize', setSize);
		window.removeEventListener('pointermove', onPointerMove);
		canvas.removeEventListener('pointerleave', onPointerLeave);
		canvas.removeEventListener('click', onClick);
		geometry.dispose();
		material.dispose();
		trigger.geometry.dispose();
		(trigger.material as THREE.Material).dispose();
		renderer.dispose();
	};
}
