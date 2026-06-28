/**
 * Universe theme — star field on a rotating shell with mouse-reactive parallax.
 * Secret star → Dream Journal (pointer-events on hero must not blanket the canvas).
 *
 * --- Tweak the “hidden” dream star (subtlety / position) ---
 * - Orbit host: `SECRET_HOST_PLANET_INDEX` (index in PLANETS array).
 * - Satellite distance/speed: `SECRET_ORBIT_RADIUS`, `SECRET_ORBIT_SPEED`.
 * - Apparent size: `SECRET_RADIUS` (world units on its billboard plane).
 * - Look: edit `createSecretStarMaterial()` fragment shader (brightness, color mix, pulse).
 */
import * as THREE from 'three';
import {
	isCoarsePointer,
	isMobileViewport,
	planetLabelHint,
	prefersReducedMotion,
	syncCoarsePointerAttribute,
} from '../utils/input-capabilities.ts';
import { createNebulaSky } from './universe-nebula-sky.ts';

const CANVAS_ID = 'universe-star-field-canvas';

const MAX_DPR = 2;
const MOBILE_MAX_DPR = 1.25;
const REDUCED_MOTION_STAR_COUNT = 1400;
const DEFAULT_STAR_COUNT = 5200;
const MOBILE_STAR_COUNT = 3000;
const INNER_PAGE_STAR_COUNT = 2400;
const MOBILE_INNER_PAGE_STAR_COUNT = 1800;

/** Index in PLANETS — dream journal satellite orbits `thoughts` (outermost). */
const SECRET_HOST_PLANET_INDEX = 4;
/** Keep inside host planet radius so the star stays partly hidden behind it. */
const SECRET_ORBIT_RADIUS = 1.75;
const SECRET_ORBIT_SPEED = 0.00125;
const SECRET_PLANE_Z = -30;
const SECRET_RADIUS = 2.2;

/** Minimum touch target when raycasts miss on small screens. */
const TOUCH_PICK_MIN_PX = 44;

/** Ray–sphere intersection radius (~mid shell); aligns mouse with stars you see under the cursor */
const MOUSE_SHELL_R = 108;

/** Star push: falloff radius and strength in starGroup local XY (immediate response, no spring lag) */
const MOUSE_FALLOFF = 54;
const MOUSE_PUSH = 4.25;

/** Extra space between planet spheres (world units). */
const ORBIT_GAP_PADDING = 0.75;
/** Hover scale — include when checking clearance. */
const PLANET_HOVER_SCALE = 1.09;
/** Ringed planet (3rd orbit) — torus extends ~ radius × this + tube. */
const PLANET_RING_SCALE = 1.35;

/** Inner-orbit angular speed (rad/ms); outer orbits use ω ∝ 1/r. */
const INNER_ORBIT_R = 6;
const INNER_ORBIT_SPEED = 0.00028;

function orbitSpeedFor(orbitR: number): number {
	return (INNER_ORBIT_SPEED * INNER_ORBIT_R) / orbitR;
}

function lightenPlanetColor(hex: number, mix = 0.42): THREE.Color {
	const c = new THREE.Color(hex);
	c.lerp(new THREE.Color(0xffffff), mix);
	return c;
}

/** Inner → outer: projects, blog, services (ring), photo dump, thoughts (dream star host). */
const PLANETS = [
	{
		id: 'projects',
		label: 'Projects',
		href: '/projects',
		color: 0x6080b0,
		radius: 1.2,
		orbitR: 6,
		speed: orbitSpeedFor(6),
		phase: 0,
	},
	{
		id: 'blog',
		label: 'Blog',
		href: '/blog',
		color: 0xc08888,
		radius: 1.5,
		orbitR: 9.5,
		speed: orbitSpeedFor(9.5),
		phase: 1.2,
	},
	{
		id: 'services',
		label: 'Services',
		href: '/services',
		color: 0xd09050,
		radius: 2.0,
		orbitR: 14,
		speed: orbitSpeedFor(14),
		phase: 2.5,
	},
	{
		id: 'photo-dump',
		label: 'Photo Dump',
		href: '/photo-dump',
		color: 0x50a890,
		radius: 1.65,
		orbitR: 19,
		speed: orbitSpeedFor(19),
		phase: 4.0,
	},
	{
		id: 'thoughts',
		label: 'Thoughts',
		href: '/thoughts',
		color: 0x9888c0,
		radius: 1.85,
		orbitR: 23.5,
		speed: orbitSpeedFor(23.5),
		phase: 5.4,
	},
] as const;

type PlanetConfig = (typeof PLANETS)[number];

/** Visual radius for overlap math (sphere + hover; services includes ring). */
function planetClearanceRadius(p: PlanetConfig): number {
	let r = p.radius * PLANET_HOVER_SCALE;
	if (p.id === 'services') {
		r = Math.max(r, p.radius * PLANET_RING_SCALE + 0.18);
	}
	return r;
}

/**
 * Minimum orbitR for `outer` so spheres never touch when inner/outer align on the same side.
 * Rule: outer.orbitR − inner.orbitR ≥ clearance(inner) + clearance(outer) + padding
 * (speed/phase do not change that — same angle is the closest approach on concentric orbits).
 */
function minOuterOrbitR(inner: PlanetConfig, outer: PlanetConfig): number {
	return inner.orbitR + planetClearanceRadius(inner) + planetClearanceRadius(outer) + ORBIT_GAP_PADDING;
}

/** Same orbit: minimum phase separation (radians) so chord ≥ sum of clearances. */
function minPhaseSeparation(r: number, a: PlanetConfig, b: PlanetConfig): number {
	const need = planetClearanceRadius(a) + planetClearanceRadius(b) + ORBIT_GAP_PADDING;
	const ratio = Math.min(need / (2 * r), 0.99);
	return 2 * Math.asin(ratio);
}

function validatePlanetOrbits(): void {
	const sorted = [...PLANETS].sort((a, b) => a.orbitR - b.orbitR);
	for (let i = 1; i < sorted.length; i++) {
		const inner = sorted[i - 1]!;
		const outer = sorted[i]!;
		const need = minOuterOrbitR(inner, outer);
		if (outer.orbitR < need - 1e-6) {
			console.warn(
				`[universe-star-field] Orbit overlap risk: ${outer.id} orbitR=${outer.orbitR} should be ≥ ${need.toFixed(2)} (inner ${inner.id}=${inner.orbitR})`,
			);
		}
	}
	const byOrbit = new Map<number, PlanetConfig[]>();
	for (const p of PLANETS) {
		const list = byOrbit.get(p.orbitR) ?? [];
		list.push(p);
		byOrbit.set(p.orbitR, list);
	}
	for (const [orbitR, group] of byOrbit) {
		if (group.length < 2) continue;
		const needRad = minPhaseSeparation(orbitR, group[0]!, group[1]!);
		const needDeg = ((needRad * 180) / Math.PI).toFixed(1);
		for (let i = 0; i < group.length; i++) {
			for (let j = i + 1; j < group.length; j++) {
				const a = group[i]!;
				const b = group[j]!;
				const sep = Math.abs(a.phase - b.phase);
				const delta = Math.min(sep, Math.PI * 2 - sep);
				if (delta < needRad - 0.05) {
					console.warn(
						`[universe-star-field] Shared orbit ${orbitR}: ${a.id} vs ${b.id} phase gap ${((delta * 180) / Math.PI).toFixed(1)}° — need ≥ ${needDeg}°`,
					);
				}
			}
		}
	}
}

type PlanetMeshUserData = PlanetConfig & {
	glowMesh?: THREE.Mesh;
	baseRoughness: number;
	baseMetalness: number;
};

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
	const isHomePage = window.location.pathname === '/';
	syncCoarsePointerAttribute();

	let currentHoveredPlanet: THREE.Mesh | null = null;
	const coarsePointer = isCoarsePointer() || isMobileViewport();

	const reducedMotion = prefersReducedMotion();
	const STAR_COUNT = reducedMotion
		? REDUCED_MOTION_STAR_COUNT
		: coarsePointer
			? isHomePage
				? MOBILE_STAR_COUNT
				: MOBILE_INNER_PAGE_STAR_COUNT
			: isHomePage
				? DEFAULT_STAR_COUNT
				: INNER_PAGE_STAR_COUNT;

	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 320);
	camera.position.set(0, 0, 46);

	const renderer = new THREE.WebGLRenderer({
		canvas: canvasEl,
		alpha: false,
		antialias: false,
		powerPreference: 'high-performance',
	});
	renderer.setClearColor(0x0a0614, 1);

	const nebulaMotion = reducedMotion ? 0.22 : 1;
	const nebulaSky = createNebulaSky(nebulaMotion);
	scene.add(nebulaSky.mesh);

	scene.add(new THREE.AmbientLight(0xffffff, 0.4));
	const planetDirLight = new THREE.DirectionalLight(0xffffff, 0.6);
	planetDirLight.position.set(1, 1, 1);
	scene.add(planetDirLight);

	const solarSystemGroup = new THREE.Group();
	scene.add(solarSystemGroup);

	const planetMeshes: THREE.Mesh[] = [];
	const planetLights: THREE.PointLight[] = [];
	const planetHoverLerp: number[] = [];
	const orbitRings: THREE.Line[] = [];
	let solarFade = 1;
	let solarFadeLerp = 1;

	const planetLabelEl = document.getElementById('planet-label');
	const sunWrapperEl = document.getElementById('sun-wrapper');

	function getHeroScrollFade(): number {
		const hero = document.querySelector('[data-hero-root]') as HTMLElement | null;
		if (!hero) return 1;
		const bottom = hero.getBoundingClientRect().bottom;
		const vh = window.innerHeight || 1;
		const fadeStart = vh * 0.72;
		const fadeEnd = vh * 0.2;
		if (bottom >= fadeStart) return 1;
		if (bottom <= fadeEnd) return 0;
		return (bottom - fadeEnd) / (fadeStart - fadeEnd);
	}

	function applySolarFade(fade: number) {
		const f = Math.max(0, Math.min(1, fade));
		solarSystemGroup.visible = f > 0.02;
		for (const ring of orbitRings) {
			(ring.material as THREE.LineBasicMaterial).opacity = 0.18 * f;
		}
		for (const mesh of planetMeshes) {
			(mesh.material as THREE.MeshStandardMaterial).opacity = f;
		}
		secretStar.visible = isHomePage && f > 0.02;
		const labelOpacity = String(f);
		if (planetLabelEl) planetLabelEl.style.opacity = labelOpacity;
		if (sunWrapperEl) sunWrapperEl.style.opacity = labelOpacity;
	}

	if (isHomePage) {
		validatePlanetOrbits();
		for (const p of PLANETS) {
			const geo = new THREE.SphereGeometry(p.radius, 32, 32);
			const mat = new THREE.MeshStandardMaterial({
				color: p.color,
				roughness: 0.7,
				metalness: 0.2,
				transparent: true,
				opacity: 1,
			});
			const mesh = new THREE.Mesh(geo, mat);
			mesh.position.set(Math.cos(p.phase) * p.orbitR, Math.sin(p.phase) * p.orbitR, -8);
			const userData: PlanetMeshUserData = {
				...p,
				baseRoughness: mat.roughness,
				baseMetalness: mat.metalness,
			};
			mesh.userData = userData;

			const glowGeo = new THREE.SphereGeometry(p.radius * 1.06, 20, 20);
			const glowMat = new THREE.MeshBasicMaterial({
				color: p.color,
				transparent: true,
				opacity: 0,
				blending: THREE.AdditiveBlending,
				depthWrite: false,
				side: THREE.BackSide,
			});
			const glowMesh = new THREE.Mesh(glowGeo, glowMat);
			glowMesh.scale.setScalar(1.05);
			mesh.add(glowMesh);
			userData.glowMesh = glowMesh;

			if (p.id === 'services') {
				const ringGeo = new THREE.TorusGeometry(p.radius * PLANET_RING_SCALE, 0.16, 8, 64);
				const ringMat = new THREE.MeshBasicMaterial({
					color: lightenPlanetColor(p.color, 0.45),
					transparent: true,
					opacity: 0.55,
				});
				const ring = new THREE.Mesh(ringGeo, ringMat);
				ring.rotation.x = 0;
				ring.rotation.z = 0;
				mesh.add(ring);
			}

			solarSystemGroup.add(mesh);
			planetMeshes.push(mesh);
			planetHoverLerp.push(0);

			const light = new THREE.PointLight(p.color, 1.0, p.radius * 10);
			light.position.copy(mesh.position);
			solarSystemGroup.add(light);
			planetLights.push(light);
		}

		const orbitRadii = [...new Set(PLANETS.map((p) => p.orbitR))].sort((a, b) => a - b);
		for (const r of orbitRadii) {
			const pts: THREE.Vector3[] = [];
			for (let i = 0; i <= 128; i++) {
				const a = (i / 128) * Math.PI * 2;
				pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, -8));
			}
			const ringGeo = new THREE.BufferGeometry().setFromPoints(pts);
			const ringMat = new THREE.LineBasicMaterial({
				color: 0xffffff,
				transparent: true,
				opacity: 0.18,
			});
			const ring = new THREE.Line(ringGeo, ringMat);
			solarSystemGroup.add(ring);
			orbitRings.push(ring);
		}

		orbitRings[0] &&
			((orbitRings[0].material as THREE.LineBasicMaterial).color.setHex(0xffcc66));
	}

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
	secretStar.visible = isHomePage;
	if (isHomePage) {
		solarSystemGroup.add(secretStar);
	} else {
		scene.add(secretStar);
	}

	const raycaster = new THREE.Raycaster();
	const pointer = new THREE.Vector2();
	const mouseWorld3 = new THREE.Vector3(1e6, 1e6, 0);
	const mouseLocal2 = new THREE.Vector2(1e6, 1e6);
	const invStarGroup = new THREE.Matrix4();
	const tmpHit = new THREE.Vector3();
	const tmpMouseLocal = new THREE.Vector3();
	const mouseShell = new THREE.Sphere(new THREE.Vector3(0, 0, 0), MOUSE_SHELL_R);

	let lastScroll = typeof window !== 'undefined' ? window.scrollY : 0;
	let secretHover = false;

	function placeSecretStar(tNow: number) {
		if (!isHomePage) return;
		const host = planetMeshes[SECRET_HOST_PLANET_INDEX];
		if (!host) return;
		const angle = tNow * SECRET_ORBIT_SPEED;
		secretStar.position.set(
			host.position.x + Math.cos(angle) * SECRET_ORBIT_RADIUS,
			host.position.y + Math.sin(angle) * SECRET_ORBIT_RADIUS,
			host.position.z + Math.sin(angle * 1.7) * 0.5,
		);
		secretStar.lookAt(camera.position);
	}

	const onScroll = () => {
		lastScroll = window.scrollY;
		solarFade = getHeroScrollFade();
	};

	const hostPlanetMesh = planetMeshes[SECRET_HOST_PLANET_INDEX] ?? null;

	/** When the secret star orbits inside its host sphere, screen distance picks star vs planet. */
	function pointerTargetsSecretStar(clientX: number, clientY: number): boolean {
		if (!hostPlanetMesh) return true;
		const w = window.innerWidth || 1;
		const h = window.innerHeight || 1;
		const ndcX = (clientX / w) * 2 - 1;
		const ndcY = -(clientY / h) * 2 + 1;

		const planetNdc = hostPlanetMesh.position.clone().project(camera);
		const starNdc = secretStar.position.clone().project(camera);
		const dPlanet = Math.hypot(ndcX - planetNdc.x, ndcY - planetNdc.y);
		const dStar = Math.hypot(ndcX - starNdc.x, ndcY - starNdc.y);

		return dStar < dPlanet * 0.85;
	}

	function resolveSecretHover(
		clientX: number,
		clientY: number,
		secretRayHit: boolean,
		hitPlanet: THREE.Mesh | null,
	): boolean {
		if (!secretRayHit) return false;
		if (!hitPlanet) return true;
		if (hitPlanet !== hostPlanetMesh) return false;
		return pointerTargetsSecretStar(clientX, clientY);
	}

	function pickPlanetScreenSpace(clientX: number, clientY: number): THREE.Mesh | null {
		const w = window.innerWidth || 1;
		const h = window.innerHeight || 1;
		let best: THREE.Mesh | null = null;
		let bestDist = Infinity;

		for (const mesh of planetMeshes) {
			const ndc = mesh.position.clone().project(camera);
			const px = (ndc.x * 0.5 + 0.5) * w;
			const py = (-ndc.y * 0.5 + 0.5) * h;
			const dist = Math.hypot(clientX - px, clientY - py);
			const pd = mesh.userData as PlanetConfig;
			const camDist = camera.position.distanceTo(mesh.position);
			const apparentR = (pd.radius / camDist) * h * 0.55;
			const threshold = Math.max(TOUCH_PICK_MIN_PX, apparentR * 1.35);
			if (dist < threshold && dist < bestDist) {
				bestDist = dist;
				best = mesh;
			}
		}

		return best;
	}

	function pickPlanetFromRaycast(): THREE.Mesh | null {
		const planetHits =
			isHomePage && solarFadeLerp > 0.08
				? raycaster.intersectObjects(planetMeshes, false)
				: [];
		return planetHits.length > 0 ? (planetHits[0]!.object as THREE.Mesh) : null;
	}

	function resolveHitPlanet(clientX: number, clientY: number): THREE.Mesh | null {
		const rayHit = pickPlanetFromRaycast();
		const screenHit = pickPlanetScreenSpace(clientX, clientY);
		if (!coarsePointer) {
			return rayHit ?? screenHit;
		}
		if (rayHit && screenHit && rayHit !== screenHit) {
			const w = window.innerWidth || 1;
			const h = window.innerHeight || 1;
			const ndcRay = rayHit.position.clone().project(camera);
			const ndcScreen = screenHit.position.clone().project(camera);
			const dRay = Math.hypot(
				clientX - (ndcRay.x * 0.5 + 0.5) * w,
				clientY - (-ndcRay.y * 0.5 + 0.5) * h,
			);
			const dScreen = Math.hypot(
				clientX - (ndcScreen.x * 0.5 + 0.5) * w,
				clientY - (-ndcScreen.y * 0.5 + 0.5) * h,
			);
			return dScreen < dRay ? screenHit : rayHit;
		}
		return rayHit ?? screenHit;
	}

	function applyPlanetLabelHint() {
		const labelEl = document.getElementById('planet-label-text');
		if (labelEl && !labelEl.classList.contains('active')) {
			labelEl.textContent = planetLabelHint();
		}
	}

	function updateSolarPick(clientX: number, clientY: number, overInteractive: boolean) {
		const canPickSolar = isHomePage && solarFadeLerp > 0.08 && !overInteractive;
		const secretHits = canPickSolar ? raycaster.intersectObject(secretStar, false) : [];
		const hitPlanet = canPickSolar ? resolveHitPlanet(clientX, clientY) : null;

		secretHover = canPickSolar
			? resolveSecretHover(clientX, clientY, secretHits.length > 0, hitPlanet)
			: false;

		const labelEl = document.getElementById('planet-label-text');

		if (secretHover && labelEl) {
			labelEl.textContent = '??';
			labelEl.classList.add('active');
			canvasEl.style.cursor = 'pointer';
			currentHoveredPlanet = null;
		} else if (hitPlanet) {
			const pd = hitPlanet.userData as PlanetConfig;
			canvasEl.style.cursor = 'pointer';
			if (labelEl) {
				labelEl.textContent = pd.label;
				labelEl.classList.add('active');
			}
			currentHoveredPlanet = hitPlanet;
		} else {
			canvasEl.style.cursor = '';
			if (labelEl) {
				labelEl.textContent = planetLabelHint();
				labelEl.classList.remove('active');
			}
			currentHoveredPlanet = null;
		}
	}

	function mapPointerToShell(ray: THREE.Ray, target: THREE.Vector3): void {
		if (rayIntersectSphereFirst(ray, mouseShell, target)) return;
		/* Stable fallback: fixed depth along view ray (avoids huge plane hits). */
		target.copy(ray.origin).addScaledVector(ray.direction, MOUSE_SHELL_R);
	}

	function isBlockingOverlay(el: Element | null): boolean {
		if (!el || el === canvasEl || el.closest('[data-universe-canvas]')) return false;
		const hit = el.closest(
			'a, button, input, textarea, select, label, [role="button"], [data-theme-toggle], [data-contact-modal]',
		);
		return !!hit && getComputedStyle(hit).pointerEvents !== 'none';
	}

	const onPointerMove = (e: PointerEvent) => {
		const w = window.innerWidth || 1;
		const h = window.innerHeight || 1;
		const x = (e.clientX / w) * 2 - 1;
		const y = -(e.clientY / h) * 2 + 1;
		pointer.set(x, y);
		raycaster.setFromCamera(pointer, camera);

		mapPointerToShell(raycaster.ray, tmpHit);
		mouseWorld3.copy(tmpHit);

		const top = document.elementFromPoint(e.clientX, e.clientY);
		updateSolarPick(e.clientX, e.clientY, isBlockingOverlay(top));
	};

	const onPointerLeave = () => {
		mouseWorld3.set(1e6, 1e6, 0);
		secretHover = false;
		currentHoveredPlanet = null;
		canvasEl.style.cursor = '';
		const labelEl = document.getElementById('planet-label-text');
		if (labelEl) {
			labelEl.textContent = planetLabelHint();
			labelEl.classList.remove('active');
		}
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
		const w = window.innerWidth || 1;
		const h = window.innerHeight || 1;
		const x = (e.clientX / w) * 2 - 1;
		const y = -(e.clientY / h) * 2 + 1;
		pointer.set(x, y);
		raycaster.setFromCamera(pointer, camera);

		const top = document.elementFromPoint(e.clientX, e.clientY);
		if (isBlockingOverlay(top)) return;

		updateSolarPick(e.clientX, e.clientY, false);

		const canPickSolar = isHomePage && solarFadeLerp > 0.08;
		const secretHits = canPickSolar ? raycaster.intersectObject(secretStar, false) : [];
		const hitPlanet = canPickSolar ? resolveHitPlanet(e.clientX, e.clientY) : null;
		const preferSecret = resolveSecretHover(
			e.clientX,
			e.clientY,
			secretHits.length > 0,
			hitPlanet,
		);

		if (preferSecret) {
			e.preventDefault();
			goDreamJournal();
			return;
		}

		if (hitPlanet) {
			e.preventDefault();
			const pd = hitPlanet.userData as PlanetConfig;
			if (!navigating) {
				navigating = true;
				window.location.href = pd.href;
			}
		}
	};

	function setSize() {
		const w = window.innerWidth;
		const h = window.innerHeight;
		const maxPr = coarsePointer ? MOBILE_MAX_DPR : MAX_DPR;
		const pr = Math.min(window.devicePixelRatio || 1, maxPr);
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
		renderer.setPixelRatio(pr);
		renderer.setSize(w, h, false);
		material.uniforms.uPixelRatio.value = pr;
		placeSecretStar(performance.now());
	}

	setSize();
	applyPlanetLabelHint();

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

		nebulaSky.update(camera, t);

		starGroup.updateMatrixWorld(true);
		invStarGroup.copy(starGroup.matrixWorld).invert();
		tmpMouseLocal.copy(mouseWorld3).applyMatrix4(invStarGroup);
		mouseLocal2.set(tmpMouseLocal.x, tmpMouseLocal.y);

		if (coarsePointer && mouseWorld3.x > 1e5) {
			mouseLocal2.set(Math.sin(t * 0.22) * 18, Math.cos(t * 0.19) * 14);
		}

		material.uniforms.uMouse.value.copy(mouseLocal2);

		const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;

		const rm = reducedMotion ? 0.58 : 1;
		const pushScale = coarsePointer ? 0.55 : 1;

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
				const tPush = (1 - dist / MOUSE_FALLOFF) * MOUSE_PUSH * rm * pushScale;
				ox = (dx / dist) * tPush;
				oy = (dy / dist) * tPush;
			}

			posAttr.array[ix] = bx + ox;
			posAttr.array[ix + 1] = by + oy;
			posAttr.array[ix + 2] = bz;
		}
		posAttr.needsUpdate = true;

		secretMat.uniforms.uTime.value = t;
		hoverLerp += ((secretHover ? 1 : 0) - hoverLerp) * 0.14;
		secretMat.uniforms.uHover.value = hoverLerp;

		if (!navigating) {
			const breathe = 1 + Math.sin(t * 0.8) * 0.06;
			const hoverScale = 1 + hoverLerp * 0.3;
			secretStar.scale.setScalar(breathe * hoverScale);
		}

		if (isHomePage) {
			solarFade = getHeroScrollFade();
			solarFadeLerp += (solarFade - solarFadeLerp) * 0.14;
			applySolarFade(solarFadeLerp);

			const tNow = performance.now();
			for (let i = 0; i < planetMeshes.length; i++) {
				const mesh = planetMeshes[i]!;
				const p = PLANETS[i]!;
				const angle = tNow * p.speed + p.phase;
				mesh.position.x = Math.cos(angle) * p.orbitR;
				mesh.position.y = Math.sin(angle) * p.orbitR;
				mesh.position.z = -8;
				mesh.rotation.y += 0.0008;

				const hoverTarget = mesh === currentHoveredPlanet ? 1 : 0;
				planetHoverLerp[i] += (hoverTarget - planetHoverLerp[i]!) * 0.14;
				const h = planetHoverLerp[i]!;
				const pd = mesh.userData as PlanetMeshUserData;

				/* Slight scale + pull toward camera — keep lit shading (no flat emissive). */
				mesh.scale.setScalar(1 + h * 0.09);
				mesh.position.z = -8 + h * 1.25;

				const mat = mesh.material as THREE.MeshStandardMaterial;
				mat.emissive.setHex(0x000000);
				mat.emissiveIntensity = 0;
				mat.roughness = pd.baseRoughness - h * 0.22;
				mat.metalness = pd.baseMetalness + h * 0.12;

				const glowMesh = pd.glowMesh;
				if (glowMesh) {
					const glowMat = glowMesh.material as THREE.MeshBasicMaterial;
					glowMat.opacity = h * 0.12 * solarFadeLerp;
					glowMesh.scale.setScalar(1.05 + h * 0.04);
				}

				const light = planetLights[i]!;
				light.position.copy(mesh.position);
				light.intensity = 1.0 + h * 0.75;
			}
			placeSecretStar(tNow);
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

	const onResize = () => {
		syncCoarsePointerAttribute();
		setSize();
	};

	window.addEventListener('scroll', onScroll, { passive: true });
	window.addEventListener('resize', onResize);
	window.addEventListener('pointermove', onPointerMove, { passive: true });
	document.documentElement.addEventListener('mouseleave', onPointerLeave);
	canvasEl.addEventListener('pointerdown', onPointerDown);

	return () => {
		stop();
		mo.disconnect();
		window.removeEventListener('scroll', onScroll);
		window.removeEventListener('resize', onResize);
		window.removeEventListener('pointermove', onPointerMove);
		document.documentElement.removeEventListener('mouseleave', onPointerLeave);
		canvasEl.removeEventListener('pointerdown', onPointerDown);
		geometry.dispose();
		material.dispose();
		nebulaSky.mesh.geometry.dispose();
		(nebulaSky.mesh.material as THREE.Material).dispose();
		scene.remove(nebulaSky.mesh);
		secretGeom.dispose();
		secretMat.dispose();
		for (const mesh of planetMeshes) {
			mesh.traverse((child) => {
				if (child instanceof THREE.Mesh && child !== mesh) {
					child.geometry.dispose();
					(child.material as THREE.Material).dispose();
				}
			});
			mesh.geometry.dispose();
			(mesh.material as THREE.Material).dispose();
			solarSystemGroup.remove(mesh);
		}
		for (const light of planetLights) {
			solarSystemGroup.remove(light);
		}
		for (const ring of orbitRings) {
			ring.geometry.dispose();
			(ring.material as THREE.Material).dispose();
			solarSystemGroup.remove(ring);
		}
		scene.remove(solarSystemGroup);
		scene.remove(planetDirLight);
		renderer.dispose();
	};
}
