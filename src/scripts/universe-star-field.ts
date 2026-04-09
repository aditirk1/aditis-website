/**
 * Universe theme — star field on a rotating shell with mouse-reactive parallax.
 * Secret star → Dream Journal (pointer-events on hero must not blanket the canvas).
 *
 * --- Tweak the “hidden” dream star (subtlety / position) ---
 * - Position on screen: `SECRET_NDC` (normalized device coords, −1…1; origin center).
 * - Apparent size: `SECRET_RADIUS` (world units on its billboard plane).
 * - Look: edit `createSecretStarMaterial()` fragment shader (brightness, color mix, pulse).
 */
import * as THREE from 'three';

const CANVAS_ID = 'universe-star-field-canvas';

const MAX_DPR = 2;
const REDUCED_MOTION_STAR_COUNT = 1400;
const DEFAULT_STAR_COUNT = 5200;

/** NDC anchor for the secret star — keep toward edge so it stays inconspicuous */
const SECRET_NDC = { x: 0.82, y: -0.74 };
const SECRET_PLANE_Z = -30;
const SECRET_RADIUS = 1.55;

/** Ray–sphere intersection radius (~mid shell); aligns mouse with stars you see under the cursor */
const MOUSE_SHELL_R = 108;

/** Star push: falloff radius and strength in starGroup local XY (immediate response, no spring lag) */
const MOUSE_FALLOFF = 54;
const MOUSE_PUSH = 4.25;

function prefersReducedMotion(): boolean {
	return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getTheme(): 'universe' | 'beach' {
	const t = document.documentElement.getAttribute('data-theme');
	return t === 'beach' ? 'beach' : 'universe';
}

function isDreamRealmPage(): boolean {
	return document.documentElement.getAttribute('data-dream-realm') === '1';
}

const _rayOc = new THREE.Vector3();

/** Nearest forward hit of `ray` on `sphere` (robust across three.js builds). */
function rayIntersectSphereFirst(ray: THREE.Ray, sphere: THREE.Sphere, target: THREE.Vector3): boolean {
	_rayOc.subVectors(ray.origin, sphere.center);
	const a = ray.direction.dot(ray.direction);
	const b = 2 * _rayOc.dot(ray.direction);
	const c = _rayOc.dot(_rayOc) - sphere.radius * sphere.radius;
	const disc = b * b - 4 * a * c;
	if (disc < 0) return false;
	const sqrtD = Math.sqrt(disc);
	let t = (-b - sqrtD) / (2 * a);
	if (t < 1e-4) t = (-b + sqrtD) / (2 * a);
	if (t < 1e-4 || !Number.isFinite(t)) return false;
	target.copy(ray.origin).addScaledVector(ray.direction, t);
	return true;
}

function createStarfieldMaterial(): THREE.ShaderMaterial {
	return new THREE.ShaderMaterial({
		transparent: true,
		depthWrite: false,
		blending: THREE.AdditiveBlending,
		uniforms: {
			uPixelRatio: { value: 1 },
			uMouse: { value: new THREE.Vector2(1e6, 1e6) },
			uTime: { value: 0 },
		},
		vertexShader: /* glsl */ `
			attribute float aSize;
			attribute float aDepth;
			uniform float uPixelRatio;
			uniform vec2 uMouse;
			uniform float uTime;
			varying float vStrength;

			void main() {
				vec3 pos = position;
				float drift = sin(uTime * 0.35 + pos.x * 0.02 + pos.y * 0.015) * (0.6 + aDepth * 1.1);
				pos.z += drift;

				vec2 delta = pos.xy - uMouse;
				float dist = length(delta);
				float wake = smoothstep(52.0, 0.0, dist);

				vStrength = 0.22 + aDepth * 0.5 + wake * 0.55;

				vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
				float baseSize = aSize * uPixelRatio * 240.0 / max(1.0, -mvPosition.z);
				gl_PointSize = clamp(baseSize * (1.0 + wake * 1.15), 1.0, 16.0);
				gl_Position = projectionMatrix * mvPosition;
			}
		`,
		fragmentShader: /* glsl */ `
			varying float vStrength;
			void main() {
				vec2 c = gl_PointCoord - vec2(0.5);
				float r = length(c);
				if (r > 0.5) discard;
				float alpha = smoothstep(0.5, 0.06, r) * vStrength;
				vec3 col = mix(vec3(0.92, 0.94, 1.0), vec3(1.0, 0.88, 0.62), 0.1);
				gl_FragColor = vec4(col, alpha);
			}
		`,
	});
}

function createSecretStarMaterial(): THREE.ShaderMaterial {
	return new THREE.ShaderMaterial({
		transparent: true,
		depthWrite: false,
		blending: THREE.AdditiveBlending,
		uniforms: {
			uTime: { value: 0 },
			uHover: { value: 0 },
		},
		vertexShader: /* glsl */ `
			varying vec2 vUv;
			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}
		`,
		fragmentShader: /* glsl */ `
			uniform float uTime;
			uniform float uHover;
			varying vec2 vUv;

			void main() {
				vec2 c = vUv - 0.5;
				float r = length(c);

				float core = smoothstep(0.14, 0.0, r);
				float glow = smoothstep(0.38, 0.04, r) * 0.32;
				float pulse = 0.88 + 0.12 * sin(uTime * 1.4);
				float halo = smoothstep(0.42, 0.12, r) * 0.14 * pulse;
				float hoverGlow = uHover * smoothstep(0.45, 0.0, r) * 0.28;

				float alpha = (core + glow + halo + hoverGlow) * 0.72;
				vec3 col = mix(vec3(0.82, 0.78, 0.95), vec3(0.95, 0.82, 0.55), core + glow * 0.4);
				col = mix(col, vec3(1.0, 0.88, 0.5), uHover * 0.35);

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

	const canvasEl = canvas;

	const reducedMotion = prefersReducedMotion();
	const STAR_COUNT = reducedMotion ? REDUCED_MOTION_STAR_COUNT : DEFAULT_STAR_COUNT;

	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 320);
	camera.position.set(0, 0, 46);

	const renderer = new THREE.WebGLRenderer({
		canvas: canvasEl,
		alpha: true,
		antialias: false,
		powerPreference: 'high-performance',
	});
	renderer.setClearColor(0x020208, 0.35);

	const starGroup = new THREE.Group();
	scene.add(starGroup);

	const geometry = new THREE.BufferGeometry();
	const positions = new Float32Array(STAR_COUNT * 3);
	const base = new Float32Array(STAR_COUNT * 3);
	const aSize = new Float32Array(STAR_COUNT);
	const aDepth = new Float32Array(STAR_COUNT);

	for (let i = 0; i < STAR_COUNT; i++) {
		const ix = i * 3;
		const r = 78 + Math.random() * 92;
		const u = Math.random();
		const v = Math.random();
		const theta = u * Math.PI * 2;
		const phi = Math.acos(2 * v - 1);
		const sinp = Math.sin(phi);
		base[ix] = r * sinp * Math.cos(theta);
		base[ix + 1] = r * sinp * Math.sin(theta);
		base[ix + 2] = r * Math.cos(phi);
		aDepth[i] = Math.random();
		aSize[i] = 0.32 + Math.random() * 1.45;
	}

	geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
	geometry.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
	geometry.setAttribute('aDepth', new THREE.BufferAttribute(aDepth, 1));

	const material = createStarfieldMaterial();
	const points = new THREE.Points(geometry, material);
	starGroup.add(points);

	const secretMat = createSecretStarMaterial();
	const secretGeom = new THREE.PlaneGeometry(SECRET_RADIUS * 2, SECRET_RADIUS * 2);
	const secretStar = new THREE.Mesh(secretGeom, secretMat);
	secretStar.renderOrder = 5;
	scene.add(secretStar);

	const raycaster = new THREE.Raycaster();
	const pointer = new THREE.Vector2();
	const mouseWorld3 = new THREE.Vector3(1e6, 1e6, 0);
	const mouseLocal2 = new THREE.Vector2(1e6, 1e6);
	const invStarGroup = new THREE.Matrix4();
	const tmpHit = new THREE.Vector3();
	const tmpMouseLocal = new THREE.Vector3();
	const starPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -SECRET_PLANE_Z);
	const mouseShell = new THREE.Sphere(new THREE.Vector3(0, 0, 0), MOUSE_SHELL_R);

	let lastScroll = typeof window !== 'undefined' ? window.scrollY : 0;
	let secretHover = false;

	function placeSecretStar() {
		raycaster.setFromCamera(new THREE.Vector2(SECRET_NDC.x, SECRET_NDC.y), camera);
		if (raycaster.ray.intersectPlane(starPlane, tmpHit)) {
			secretStar.position.copy(tmpHit);
			secretStar.lookAt(camera.position);
		}
	}

	const onScroll = () => {
		lastScroll = window.scrollY;
	};

	const onPointerMove = (e: PointerEvent) => {
		const rect = canvasEl.getBoundingClientRect();
		const w = rect.width || 1;
		const h = rect.height || 1;
		const x = ((e.clientX - rect.left) / w) * 2 - 1;
		const y = -((e.clientY - rect.top) / h) * 2 + 1;
		pointer.set(x, y);
		raycaster.setFromCamera(pointer, camera);

		/* Project cursor onto the star shell so parallax matches what you see (not a flat z plane). */
		if (rayIntersectSphereFirst(raycaster.ray, mouseShell, tmpHit)) {
			mouseWorld3.copy(tmpHit);
		} else if (raycaster.ray.intersectPlane(starPlane, tmpHit)) {
			mouseWorld3.copy(tmpHit);
		}

		const hits = raycaster.intersectObject(secretStar, false);
		secretHover = hits.length > 0;
		canvasEl.style.cursor = secretHover ? 'pointer' : 'default';
	};

	const onPointerLeave = () => {
		mouseWorld3.set(1e6, 1e6, 0);
		secretHover = false;
		canvasEl.style.cursor = 'default';
	};

	let navigating = false;
	function goDreamJournal() {
		if (navigating) return;
		navigating = true;
		secretMat.uniforms.uHover.value = 1;
		setTimeout(() => {
			window.location.href = '/dream-journal';
		}, 280);
	}

	const onPointerDown = (e: PointerEvent) => {
		if (e.button !== 0) return;
		const rect = canvasEl.getBoundingClientRect();
		const w = rect.width || 1;
		const h = rect.height || 1;
		const x = ((e.clientX - rect.left) / w) * 2 - 1;
		const y = -((e.clientY - rect.top) / h) * 2 + 1;
		pointer.set(x, y);
		raycaster.setFromCamera(pointer, camera);
		const hits = raycaster.intersectObject(secretStar, false);
		if (hits.length > 0) {
			e.preventDefault();
			goDreamJournal();
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
		placeSecretStar();
	}

	setSize();

	let raf = 0;
	let running = false;
	const clock = new THREE.Clock();
	let spinY = 0;
	let hoverLerp = 0;

	const tick = () => {
		if (!running) return;
		const delta = Math.min(clock.getDelta(), 0.1);
		const t = clock.elapsedTime;

		const baseSpin = reducedMotion ? 0.045 : isDreamRealmPage() ? 0.1 : 0.11;
		spinY += delta * baseSpin;
		starGroup.rotation.y = spinY + lastScroll * (reducedMotion ? 0.00004 : 0.00006);
		starGroup.rotation.x =
			Math.sin(t * 0.09) * 0.22 + Math.cos(t * 0.047) * 0.11 + Math.sin(t * 0.021) * 0.06;
		starGroup.rotation.z = Math.sin(t * 0.065) * 0.09;

		camera.position.set(0, 0, 46 + Math.sin(t * 0.11) * 0.35);
		camera.lookAt(0, 0, 0);

		material.uniforms.uTime.value = t;

		starGroup.updateMatrixWorld(true);
		invStarGroup.copy(starGroup.matrixWorld).invert();
		tmpMouseLocal.copy(mouseWorld3).applyMatrix4(invStarGroup);
		mouseLocal2.set(tmpMouseLocal.x, tmpMouseLocal.y);
		material.uniforms.uMouse.value.copy(mouseLocal2);

		const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;

		const rm = reducedMotion ? 0.58 : 1;
		for (let i = 0; i < STAR_COUNT; i++) {
			const ix = i * 3;
			const bx = base[ix];
			const by = base[ix + 1];
			const bz = base[ix + 2];

			const dx = bx - mouseLocal2.x;
			const dy = by - mouseLocal2.y;
			const dist = Math.hypot(dx, dy);
			let ox = 0;
			let oy = 0;
			if (dist > 1e-6 && dist < MOUSE_FALLOFF) {
				const t = (1 - dist / MOUSE_FALLOFF) * MOUSE_PUSH * rm;
				ox = (dx / dist) * t;
				oy = (dy / dist) * t;
			}

			posAttr.array[ix] = bx + ox;
			posAttr.array[ix + 1] = by + oy;
			posAttr.array[ix + 2] = bz;
		}
		posAttr.needsUpdate = true;

		placeSecretStar();
		secretMat.uniforms.uTime.value = t;
		hoverLerp += ((secretHover ? 1 : 0) - hoverLerp) * 0.14;
		secretMat.uniforms.uHover.value = hoverLerp;

		if (!navigating) {
			const breathe = 1 + Math.sin(t * 0.8) * 0.06;
			const hoverScale = 1 + hoverLerp * 0.3;
			secretStar.scale.setScalar(breathe * hoverScale);
		}

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
		const root = canvasEl.closest('[data-universe-canvas]') as HTMLElement | null;
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
	canvasEl.addEventListener('pointermove', onPointerMove, { passive: true });
	canvasEl.addEventListener('pointerleave', onPointerLeave);
	canvasEl.addEventListener('pointerdown', onPointerDown);

	return () => {
		stop();
		mo.disconnect();
		window.removeEventListener('scroll', onScroll);
		window.removeEventListener('resize', setSize);
		canvasEl.removeEventListener('pointermove', onPointerMove);
		canvasEl.removeEventListener('pointerleave', onPointerLeave);
		canvasEl.removeEventListener('pointerdown', onPointerDown);
		geometry.dispose();
		material.dispose();
		secretGeom.dispose();
		secretMat.dispose();
		renderer.dispose();
	};
}
