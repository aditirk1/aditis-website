/**
 * Universe theme — star field on a rotating shell with mouse-reactive parallax.
 * Secret star → Dream Journal (pointer-events on hero must not blanket the canvas).
 *
 * --- Tweak the “hidden” dream star (subtlety / position) ---
 * - Orbit host: `SECRET_HOST_PLANET_INDEX` (index in PLANETS array).
 * - Satellite distance/speed: `SECRET_ORBIT_RADIUS`, `SECRET_ORBIT_SPEED`.
 * - Apparent size: `SECRET_RADIUS` (world units on its billboard plane).
 * - Look: edit `createSecretStarMaterial()` fragment shader (brightness, color mix, pulse).
 * - Axial spin: `PLANET_SPIN_SPEED`. Orbital drift: `INNER_ORBIT_SPEED`.
 */
import * as THREE from 'three';
import {
	isCoarsePointer,
	isMobileViewport,
	planetLabelHint,
	prefersReducedMotion,
	syncCoarsePointerAttribute,
} from '../utils/input-capabilities.ts';
import {
	generatePlanetSurfacesDeferred,
	type PlanetSurfaceMaps,
} from '../utils/planet-surface-texture.ts';
import { getScrollState, subscribeScroll } from './scroll-orchestrator.ts';

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
/** Ringed planet (3rd orbit) — ring band spans radius × [INNER, SCALE]. */
const PLANET_RING_SCALE = 1.68;
const PLANET_RING_INNER_SCALE = 1.22;
/** Tip toward edge-on, then roll the resulting ellipse in the screen plane. */
const PLANET_RING_TILT_X = -1.12;
const PLANET_RING_ROLL_Z = 0.38;

/**
 * Key-light direction (world space, pointing from the light toward the origin).
 * The hero title glows at the lower left of the hero, so the planets are lit from
 * that side. Shared with the rim shader so the glow tracks the same source.
 */
const PLANET_LIGHT_DIR = new THREE.Vector3(-8, -2.5, 8).normalize();

/** Inner-orbit angular speed (rad/ms); outer orbits use ω ∝ 1/r. Negative = reverse. */
const INNER_ORBIT_R = 6;
/** +15% vs prior 0.0001, direction reversed. */
const INNER_ORBIT_SPEED = -0.000115;
/** Planetary axial spin (rad/s). Slow enough to read as gravity, fast enough to notice. */
const PLANET_SPIN_SPEED = 0.22;

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
		tilt: 0.34,
		/* Frozen ocean world: ice shelves cut by bright fracture lines. */
		surface: { style: 'icy', palette: [0x18294a, 0x5b7cb0, 0xcfe2f4], seed: 1207 },
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
		tilt: -0.22,
		/* Rust desert: cratered highlands over darker basins. */
		surface: { style: 'rocky', palette: [0x532c27, 0xb4756a, 0xecc9b6], seed: 4421 },
	},
	{
		id: 'services',
		label: 'Services',
		href: '/services',
		color: 0xd09050,
		radius: 1.72,
		orbitR: 14,
		speed: orbitSpeedFor(14),
		phase: 2.5,
		tilt: 0.46,
		/* Gas giant: latitude belts, and the one that carries the rings. */
		surface: { style: 'banded', palette: [0x6f4318, 0xd09050, 0xf7e0b4], seed: 9013 },
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
		tilt: -0.4,
		/* Swirled mineral seas. */
		surface: { style: 'marbled', palette: [0x0f3b34, 0x4ba58e, 0xbfeada], seed: 6577 },
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
		tilt: 0.28,
		/* Hazy ice giant: soft, low-contrast cloud decks. */
		surface: { style: 'cloudy', palette: [0x302853, 0x9888c0, 0xe3d9f5], seed: 3301 },
	},
] as const;

type PlanetConfig = (typeof PLANETS)[number];

/** Visual radius for overlap math (sphere + hover; services includes ring). */
function planetClearanceRadius(p: PlanetConfig): number {
	let r = p.radius * PLANET_HOVER_SCALE;
	if (p.id === 'services') {
		r = Math.max(r, p.radius * PLANET_RING_SCALE);
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

/** Design-time guard for hand-tuned orbits. Dev only — never logs for visitors. */
function validatePlanetOrbits(): void {
	if (!import.meta.env.DEV) return;

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
	ringMesh?: THREE.Mesh;
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
			attribute float aSeed;
			uniform float uPixelRatio;
			uniform vec2 uMouse;
			uniform float uTime;
			varying float vStrength;
			varying float vTint;

			void main() {
				vec3 pos = position;
				float drift = sin(uTime * 0.22 + pos.x * 0.02 + pos.y * 0.015) * (0.6 + aDepth * 1.1);
				pos.z += drift;

				vec2 delta = pos.xy - uMouse;
				float dist = length(delta);
				float wake = smoothstep(52.0, 0.0, dist);

				/* Slow, shallow twinkle — stars breathe rather than blink. */
				float twinkle = 0.84 + 0.16 * sin(uTime * (0.35 + aSeed * 0.55) + aSeed * 41.0);

				/* Resting brightness carries the field; hover is an accent, not the reveal. */
				vStrength = (0.55 + aDepth * 0.45 + wake * 0.5) * twinkle;
				vTint = aSeed;

				vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
				/* Generous size: the halo needs pixels to read as glow instead of a dot. */
				float baseSize = aSize * uPixelRatio * 260.0 / max(1.0, -mvPosition.z);
				gl_PointSize = clamp(baseSize * (1.0 + wake * 0.85), 2.0, 16.0);
				gl_Position = projectionMatrix * mvPosition;
			}
		`,
		fragmentShader: /* glsl */ `
			varying float vStrength;
			varying float vTint;
			void main() {
				vec2 c = gl_PointCoord - vec2(0.5);
				float r2 = dot(c, c);
				if (r2 > 0.25) discard;

				/*
				 * Two gaussians: a tight core for the point of light and a wide, faint
				 * halo around it. A single falloff just reads as a flat dot.
				 */
				float core = exp(-r2 * 44.0);
				float halo = exp(-r2 * 7.0) * 0.42;

				/* Real starlight runs blue-white through warm; pure white looks synthetic. */
				vec3 col = mix(vec3(0.76, 0.84, 1.0), vec3(1.0, 0.9, 0.72), vTint);
				col = mix(col, vec3(1.0), core * 0.7);

				float alpha = clamp((core + halo) * vStrength, 0.0, 1.0);
				gl_FragColor = vec4(col, alpha);
			}
		`,
	});
}

/**
 * Ring band for the gas giant. Alpha is driven by radial position rather than a
 * texture, which keeps the divisions crisp at any zoom and needs no image asset.
 * `RingGeometry` lies in local XY, so `length(position.xy)` is the ring radius.
 */
function createPlanetRingMaterial(color: number, inner: number, outer: number): THREE.ShaderMaterial {
	return new THREE.ShaderMaterial({
		transparent: true,
		depthWrite: false,
		side: THREE.DoubleSide,
		uniforms: {
			uInnerColor: { value: lightenPlanetColor(color, 0.2) },
			uOuterColor: { value: lightenPlanetColor(color, 0.66) },
			uInner: { value: inner },
			uOuter: { value: outer },
			uOpacity: { value: 0 },
		},
		vertexShader: /* glsl */ `
			varying float vRadius;
			void main() {
				vRadius = length(position.xy);
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}
		`,
		fragmentShader: /* glsl */ `
			uniform vec3 uInnerColor;
			uniform vec3 uOuterColor;
			uniform float uInner;
			uniform float uOuter;
			uniform float uOpacity;
			varying float vRadius;

			void main() {
				float t = clamp((vRadius - uInner) / (uOuter - uInner), 0.0, 1.0);

				/* Feathered edges — a hard cut is what makes a ring read as a stroke. */
				float edge = smoothstep(0.0, 0.16, t) * (1.0 - smoothstep(0.78, 1.0, t));

				/* Two Cassini-style divisions break the band into distinct ringlets. */
				float gaps = 1.0
					- 0.78 * exp(-pow((t - 0.40) / 0.05, 2.0))
					- 0.5 * exp(-pow((t - 0.68) / 0.032, 2.0));

				/* Fine ringlet striping on top of the coarse structure. */
				float bands = 0.7 + 0.3 * sin(t * 44.0);

				float alpha = edge * clamp(gaps, 0.0, 1.0) * bands * uOpacity;
				gl_FragColor = vec4(mix(uInnerColor, uOuterColor, t), clamp(alpha, 0.0, 1.0));
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
		antialias: true,
		powerPreference: 'high-performance',
	});
	renderer.setClearColor(0x05030c, 1);
	renderer.outputColorSpace = THREE.SRGBColorSpace;

	/* Cool sky/ground fill so the night side reads as shadow, not a black hole. */
	scene.add(new THREE.HemisphereLight(0x3c4c80, 0x090914, 0.5));

	/*
	 * Key light off to the lower left — the glowing hero title is the implied sun,
	 * so lighting from that side is what carves a terminator across each sphere.
	 */
	const planetDirLight = new THREE.DirectionalLight(0xfff0da, 3.2);
	planetDirLight.position.copy(PLANET_LIGHT_DIR);
	scene.add(planetDirLight);

	const solarSystemGroup = new THREE.Group();
	scene.add(solarSystemGroup);

	const planetMeshes: THREE.Mesh[] = [];
	/** Orbital anchors — mesh children spin; pivots carry position on the orbit. */
	const planetPivots: THREE.Group[] = [];
	const planetHoverLerp: number[] = [];
	const planetRingMeshes: THREE.Mesh[] = [];
	const planetSurfaceMaps: PlanetSurfaceMaps[] = [];
	let cancelSurfaceGeneration: (() => void) | undefined;
	const orbitRings: THREE.Mesh[] = [];
	let solarFade = 1;
	let solarFadeLerp = 1;

	const planetLabelEl = document.getElementById('planet-label');
	/* RIGHT zone of the hero — the orrery is centred on this box, not the viewport. */
	const heroSideZoneEl = document.querySelector<HTMLElement>('[data-hero-side-slot]');

	/* Reads cached geometry from the scroll orchestrator — no layout during the frame. */
	function getHeroScrollFade(): number {
		const { y, heroBottom, viewportHeight } = getScrollState();
		/* Near the top — or with missing metrics after a theme swap — keep the orrery on. */
		if (y < 80 || viewportHeight < 1) return 1;
		const vh = viewportHeight;
		const fadeStart = vh * 0.72;
		const fadeEnd = vh * 0.2;
		if (heroBottom >= fadeStart) return 1;
		if (heroBottom <= fadeEnd) return 0;
		return (heroBottom - fadeEnd) / (fadeStart - fadeEnd);
	}

	function applySolarFade(fade: number) {
		const f = Math.max(0, Math.min(1, fade));
		solarSystemGroup.visible = f > 0.02;
		for (const ring of orbitRings) {
			const mat = ring.material as THREE.MeshBasicMaterial;
			const base = (ring.userData.baseOpacity as number) ?? 0.55;
			mat.opacity = base * f;
		}
		for (const mesh of planetMeshes) {
			(mesh.material as THREE.MeshStandardMaterial).opacity = f;
		}
		secretStar.visible = isHomePage && f > 0.02;
		const labelOpacity = String(f);
		if (planetLabelEl) planetLabelEl.style.opacity = labelOpacity;
		/* Title opacity is owned by home-hero.ts — never fight the intro animation. */
	}

	if (isHomePage) {
		validatePlanetOrbits();
		for (const p of PLANETS) {
			/* 48 segments: bump shading is per-fragment, but the silhouette still shows facets at 32. */
			const geo = new THREE.SphereGeometry(p.radius, 48, 48);
			const mat = new THREE.MeshStandardMaterial({
				color: p.color,
				roughness: 0.7,
				metalness: 0.2,
				transparent: true,
				opacity: 1,
			});
			/*
			 * Pivot holds orbital position; the mesh child carries tilt + Y spin so
			 * axial rotation is independent of where the planet sits on its orbit.
			 */
			const pivot = new THREE.Group();
			pivot.position.set(Math.cos(p.phase) * p.orbitR, Math.sin(p.phase) * p.orbitR, -8);
			const mesh = new THREE.Mesh(geo, mat);
			mesh.rotation.order = 'XYZ';
			mesh.rotation.x = p.tilt;
			pivot.add(mesh);
			const userData: PlanetMeshUserData = {
				...p,
				baseRoughness: mat.roughness,
				baseMetalness: mat.metalness,
			};
			mesh.userData = userData;
			pivot.userData = userData;

			if (p.id === 'services') {
				const inner = p.radius * PLANET_RING_INNER_SCALE;
				const outer = p.radius * PLANET_RING_SCALE;
				const ringGeo = new THREE.RingGeometry(inner, outer, 160, 1);
				const ringMesh = new THREE.Mesh(ringGeo, createPlanetRingMaterial(p.color, inner, outer));

				/*
				 * Sibling of the planet, not a child: the planet carries a running Y
				 * spin, and a ring parented to it would swing instead of holding its
				 * plane. Position is copied each frame in the animation loop.
				 */
				ringMesh.rotation.order = 'ZYX';
				ringMesh.rotation.set(PLANET_RING_TILT_X, 0, PLANET_RING_ROLL_Z);
				solarSystemGroup.add(ringMesh);
				planetRingMeshes.push(ringMesh);
				userData.ringMesh = ringMesh;
			}

			solarSystemGroup.add(pivot);
			planetPivots.push(pivot);
			planetMeshes.push(mesh);
			planetHoverLerp.push(0);
		}

		/* Planets start as flat colour and get their generated surface a tick later. */
		cancelSurfaceGeneration = generatePlanetSurfacesDeferred(
			PLANETS.map((p) => p.surface),
			(index, maps) => {
				const mesh = planetMeshes[index];
				if (!mesh) return;
				const mat = mesh.material as THREE.MeshStandardMaterial;
				const pd = mesh.userData as PlanetMeshUserData;
				mat.map = maps.map;
				mat.bumpMap = maps.bumpMap;
				mat.bumpScale = maps.bumpScale;
				/* The map carries the colour now; a tinted base would double-multiply it. */
				mat.color.setHex(0xffffff);
				mat.roughness = maps.roughness;
				mat.metalness = maps.metalness;
				pd.baseRoughness = maps.roughness;
				pd.baseMetalness = maps.metalness;
				mat.needsUpdate = true;
				planetSurfaceMaps.push(maps);
			},
		);

		const orbitRadii = [...new Set(PLANETS.map((p) => p.orbitR))].sort((a, b) => a - b);
		for (let oi = 0; oi < orbitRadii.length; oi++) {
			const r = orbitRadii[oi]!;
			/* Thin torus tubes — brighter than the old flat lines, and they read in 3D when the orrery is tilted. */
			const tube = 0.055 + oi * 0.008;
			const torusGeo = new THREE.TorusGeometry(r, tube, 12, 192);
			const isInner = oi === 0;
			const ringMat = new THREE.MeshBasicMaterial({
				color: isInner ? 0xffcc66 : 0xd8e4ff,
				transparent: true,
				opacity: isInner ? 0.72 : 0.48,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
			});
			const ring = new THREE.Mesh(torusGeo, ringMat);
			ring.position.z = -8;
			ring.userData.baseOpacity = ringMat.opacity;
			solarSystemGroup.add(ring);
			orbitRings.push(ring);
		}
	}

	const starGroup = new THREE.Group();
	scene.add(starGroup);

	const geometry = new THREE.BufferGeometry();
	const positions = new Float32Array(STAR_COUNT * 3);
	const base = new Float32Array(STAR_COUNT * 3);
	const aSize = new Float32Array(STAR_COUNT);
	const aDepth = new Float32Array(STAR_COUNT);
	/* Per-star randomness: twinkle phase/rate and colour temperature. */
	const aSeed = new Float32Array(STAR_COUNT);

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
		/* A few foreground stars give the field depth instead of uniform grain. */
		const isForeground = Math.random() < 0.06;
		aDepth[i] = isForeground ? 0.86 + Math.random() * 0.14 : Math.random();
		aSize[i] = isForeground ? 1.6 + Math.random() * 0.9 : 0.62 + Math.random() * 1.05;
		aSeed[i] = Math.random();
	}

	geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
	geometry.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
	geometry.setAttribute('aDepth', new THREE.BufferAttribute(aDepth, 1));
	geometry.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1));

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
	const tmpWorld = new THREE.Vector3();
	const mouseShell = new THREE.Sphere(new THREE.Vector3(0, 0, 0), MOUSE_SHELL_R);

	let lastScroll = typeof window !== 'undefined' ? window.scrollY : 0;
	let secretHover = false;

	const unsubscribeScroll = subscribeScroll(({ y }) => {
		lastScroll = y;
		solarFade = getHeroScrollFade();
	});

	function placeSecretStar(tNow: number) {
		if (!isHomePage) return;
		const host = planetPivots[SECRET_HOST_PLANET_INDEX];
		if (!host) return;
		const angle = tNow * SECRET_ORBIT_SPEED;
		secretStar.position.set(
			host.position.x + Math.cos(angle) * SECRET_ORBIT_RADIUS,
			host.position.y + Math.sin(angle) * SECRET_ORBIT_RADIUS,
			host.position.z + Math.sin(angle * 1.7) * 0.5,
		);
		secretStar.lookAt(camera.position);
	}

	const hostPlanetMesh = planetMeshes[SECRET_HOST_PLANET_INDEX] ?? null;
	const hostPlanetPivot = planetPivots[SECRET_HOST_PLANET_INDEX] ?? null;

	/** When the secret star orbits inside its host sphere, screen distance picks star vs planet. */
	function pointerTargetsSecretStar(clientX: number, clientY: number): boolean {
		if (!hostPlanetPivot) return true;
		const w = window.innerWidth || 1;
		const h = window.innerHeight || 1;
		const ndcX = (clientX / w) * 2 - 1;
		const ndcY = -(clientY / h) * 2 + 1;

		const planetNdc = hostPlanetPivot.getWorldPosition(tmpWorld).clone().project(camera);
		secretStar.getWorldPosition(tmpHit);
		const starNdc = tmpHit.clone().project(camera);
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

		for (let i = 0; i < planetMeshes.length; i++) {
			const mesh = planetMeshes[i]!;
			const pivot = planetPivots[i]!;
			pivot.getWorldPosition(tmpWorld);
			const ndc = tmpWorld.clone().project(camera);
			const px = (ndc.x * 0.5 + 0.5) * w;
			const py = (-ndc.y * 0.5 + 0.5) * h;
			const dist = Math.hypot(clientX - px, clientY - py);
			const pd = mesh.userData as PlanetConfig;
			const camDist = camera.position.distanceTo(tmpWorld);
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
			const rayPivot = (rayHit.parent as THREE.Object3D | null) ?? rayHit;
			const screenPivot = (screenHit.parent as THREE.Object3D | null) ?? screenHit;
			rayPivot.getWorldPosition(tmpWorld);
			const ndcRay = tmpWorld.clone().project(camera);
			screenPivot.getWorldPosition(tmpWorld);
			const ndcScreen = tmpWorld.clone().project(camera);
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

	/** Latched on click so a double-tap cannot fire two navigations. */
	let navigating = false;
	let navigationReleaseTimer = 0;

	/** Frees the latch if the navigation never lands (visitor cancels, or link fails). */
	function beginNavigation() {
		navigating = true;
		window.clearTimeout(navigationReleaseTimer);
		navigationReleaseTimer = window.setTimeout(() => {
			navigating = false;
		}, 3000);
	}

	function goDreamJournal() {
		if (navigating) return;
		beginNavigation();
		secretMat.uniforms.uHover.value = 1;
		setTimeout(() => {
			window.location.assign('/dream-journal');
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
				beginNavigation();
				window.location.assign(pd.href);
			}
		}
	};

	/** Outer orbit + planet/ring clearance — used to keep the system inside the viewport. */
	const SOLAR_EXTENT = 27;
	/** Resting tilt so the coplanar orbits read as a 3D orrery, not a flat diagram. */
	const ORBIT_BASE_TILT = 0.72;
	/** Clearance between orrery AABB and the title block. */
	const TITLE_CLEARANCE_PX = 18;
	/** Caption height plus its offset from the widget's bottom edge. */
	const CAPTION_RESERVE_PX = 32;
	/** Grow past authored size so the orrery can fill the RIGHT zone. */
	const MAX_ORRERY_SCALE = 2.15;

	function getTitleBounds(): DOMRect | null {
		if (!isHomePage) return null;
		const words = document.querySelectorAll<HTMLElement>('#sun-text .hero-word');
		if (!words.length) return null;
		let left = Infinity;
		let right = -Infinity;
		let top = Infinity;
		let bottom = -Infinity;
		for (const word of words) {
			const r = word.getBoundingClientRect();
			if (r.left < left) left = r.left;
			if (r.right > right) right = r.right;
			if (r.top < top) top = r.top;
			if (r.bottom > bottom) bottom = r.bottom;
		}
		if (!(right > left && bottom > top)) return null;
		return new DOMRect(left, top, right - left, bottom - top);
	}

	function aabbsOverlap(
		a: { minX: number; maxX: number; minY: number; maxY: number },
		b: DOMRect,
		pad: number,
	): boolean {
		return !(a.maxX < b.left - pad || a.minX > b.right + pad || a.maxY < b.top - pad || a.minY > b.bottom + pad);
	}

	function positionPlanetLabel(widgetBottom: number): void {
		if (!planetLabelEl) return;
		const zone = planetLabelEl.offsetParent as HTMLElement | null;
		if (!zone) return;
		planetLabelEl.style.top = `${Math.round(widgetBottom - zone.getBoundingClientRect().top + 8)}px`;
	}

	const FIT_SAMPLES: THREE.Vector3[] = [];
	for (let i = 0; i < 48; i++) {
		const a = (i / 48) * Math.PI * 2;
		FIT_SAMPLES.push(new THREE.Vector3(Math.cos(a) * SOLAR_EXTENT, Math.sin(a) * SOLAR_EXTENT, -8));
	}
	const fitProbe = new THREE.Vector3();

	function projectedOrreryBounds(vw: number, vh: number) {
		solarSystemGroup.updateMatrixWorld(true);
		let minX = Infinity;
		let maxX = -Infinity;
		let minY = Infinity;
		let maxY = -Infinity;
		for (const p of FIT_SAMPLES) {
			fitProbe.copy(p).applyMatrix4(solarSystemGroup.matrixWorld).project(camera);
			const sx = (fitProbe.x * 0.5 + 0.5) * vw;
			const sy = (-fitProbe.y * 0.5 + 0.5) * vh;
			if (sx < minX) minX = sx;
			if (sx > maxX) maxX = sx;
			if (sy < minY) minY = sy;
			if (sy > maxY) maxY = sy;
		}
		return { minX, maxX, minY, maxY };
	}

	/**
	 * Fill the RIGHT zone. If the result collides with the title, shift right and
	 * shrink — never move the title.
	 */
	function fitSolarSystemToViewport() {
		if (!isHomePage) {
			solarSystemGroup.scale.setScalar(1);
			solarSystemGroup.position.set(0, 0, 0);
			return;
		}
		const vw = window.innerWidth || 1;
		const vh = window.innerHeight || 1;
		const halfFov = ((camera.fov * Math.PI) / 180) / 2;
		const worldPerPx = (Math.tan(halfFov) * camera.position.z * 2) / vh;

		const zoneRect = heroSideZoneEl?.getBoundingClientRect();
		const title = getTitleBounds();

		const isStacked = vw < 768;

		/* On stacked (mobile) layouts the title sits above the orrery zone — fit the
		 * zone only. Side-by-side desktop still avoids overlapping the title. */
		let left = zoneRect && zoneRect.width > 1 ? zoneRect.left + 2 : vw * 0.46;
		const right = zoneRect && zoneRect.width > 1 ? zoneRect.right - 6 : vw - 10;
		let top = zoneRect && zoneRect.height > 1 ? zoneRect.top + 4 : vh * 0.06;
		let bottom =
			(zoneRect && zoneRect.height > 1 ? zoneRect.bottom - 4 : vh - 12) - CAPTION_RESERVE_PX;

		if (isStacked) {
			/* Prefer the measured side-slot; fall back to the lower half of the hero. */
			if (!(zoneRect && zoneRect.height > 80)) {
				top = Math.max(top, vh * 0.38);
				bottom = vh - 48 - CAPTION_RESERVE_PX;
				left = 12;
			}
		}

		const targetW = Math.max(isStacked ? 160 : 200, right - left);
		const targetH = Math.max(isStacked ? 160 : 200, bottom - top);
		let targetCenterX = (left + right) / 2;
		const targetCenterY = (top + bottom) / 2;

		solarSystemGroup.scale.setScalar(1);
		solarSystemGroup.position.set(0, 0, 0);
		let bounds = projectedOrreryBounds(vw, vh);

		for (let pass = 0; pass < 5; pass++) {
			const h = Math.max(1, bounds.maxY - bounds.minY);
			const w = Math.max(1, bounds.maxX - bounds.minX);
			const next = solarSystemGroup.scale.x * Math.min(targetH / h, targetW / w);
			solarSystemGroup.scale.setScalar(Math.min(MAX_ORRERY_SCALE, Math.max(0.22, next)));
			bounds = projectedOrreryBounds(vw, vh);
			solarSystemGroup.position.x += (targetCenterX - (bounds.minX + bounds.maxX) / 2) * worldPerPx;
			solarSystemGroup.position.y += ((bounds.minY + bounds.maxY) / 2 - targetCenterY) * worldPerPx;
			bounds = projectedOrreryBounds(vw, vh);
		}

		if (title && !isStacked) {
			for (let guard = 0; guard < 10 && aabbsOverlap(bounds, title, TITLE_CLEARANCE_PX); guard++) {
				const push = title.right + TITLE_CLEARANCE_PX - bounds.minX;
				if (push > 0) {
					solarSystemGroup.position.x += push * worldPerPx;
					targetCenterX = Math.min(vw - 80, targetCenterX + push);
					bounds = projectedOrreryBounds(vw, vh);
				}
				if (aabbsOverlap(bounds, title, TITLE_CLEARANCE_PX)) {
					solarSystemGroup.scale.setScalar(Math.max(0.22, solarSystemGroup.scale.x * 0.9));
					bounds = projectedOrreryBounds(vw, vh);
					solarSystemGroup.position.x += (targetCenterX - (bounds.minX + bounds.maxX) / 2) * worldPerPx;
					solarSystemGroup.position.y += ((bounds.minY + bounds.maxY) / 2 - targetCenterY) * worldPerPx;
					bounds = projectedOrreryBounds(vw, vh);
				}
			}
		}

		positionPlanetLabel(bounds.maxY);
	}

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
		fitSolarSystemToViewport();
		placeSecretStar(performance.now());
	}

	if (isHomePage) {
		solarSystemGroup.rotation.x = ORBIT_BASE_TILT;
		solarSystemGroup.rotation.y = 0;
	}
	setSize();
	applyPlanetLabelHint();

	/* The orrery is placed from the title's measured box and the RIGHT zone, so
	 * re-fit whenever either moves (fonts, header height, text-scale, layout). */
	let titleObserver: ResizeObserver | null = null;
	const heroTitleEl = isHomePage ? document.getElementById('sun-text') : null;
	if (typeof ResizeObserver !== 'undefined' && (heroTitleEl || heroSideZoneEl)) {
		titleObserver = new ResizeObserver(() => fitSolarSystemToViewport());
		if (heroTitleEl) titleObserver.observe(heroTitleEl);
		if (heroSideZoneEl) titleObserver.observe(heroSideZoneEl);
	}

	let raf = 0;
	let running = false;
	const clock = new THREE.Clock();
	let spinY = 0;
	let hoverLerp = 0;

	const tick = () => {
		if (!running) return;
		const delta = Math.min(clock.getDelta(), 0.1);
		const t = clock.elapsedTime;

		/* Drift, not spin — 20% slower than the prior base rates. */
		const baseSpin = reducedMotion ? 0.0224 : isDreamRealmPage() ? 0.0512 : 0.056;
		spinY += delta * baseSpin;
		starGroup.rotation.y = spinY + lastScroll * (reducedMotion ? 0.000026 : 0.00004);
		starGroup.rotation.x =
			Math.sin(t * 0.058) * 0.22 + Math.cos(t * 0.03) * 0.11 + Math.sin(t * 0.013) * 0.06;
		starGroup.rotation.z = Math.sin(t * 0.042) * 0.09;

		camera.position.set(0, 0, 46 + Math.sin(t * 0.11) * 0.35);
		camera.lookAt(0, 0, 0);

		if (isHomePage) {
			solarSystemGroup.rotation.x = ORBIT_BASE_TILT;
			solarSystemGroup.rotation.y = 0;
		}

		material.uniforms.uTime.value = t;

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
			if (performance.now() < forceOrreryVisibleUntil) {
				solarFade = 1;
				solarFadeLerp = 1;
			} else {
				solarFade = getHeroScrollFade();
				solarFadeLerp += (solarFade - solarFadeLerp) * 0.14;
			}
			applySolarFade(solarFadeLerp);

			const tNow = performance.now();
			const spinStep = delta * PLANET_SPIN_SPEED * (reducedMotion ? 0.45 : 1);
			for (let i = 0; i < planetMeshes.length; i++) {
				const mesh = planetMeshes[i]!;
				const pivot = planetPivots[i]!;
				const p = PLANETS[i]!;
				const angle = tNow * p.speed + p.phase;
				pivot.position.x = Math.cos(angle) * p.orbitR;
				pivot.position.y = Math.sin(angle) * p.orbitR;
				/* Axial spin on the tilted mesh — textures crawl; uniform spheres wouldn't show it. */
				mesh.rotation.y += spinStep;

				const hoverTarget = mesh === currentHoveredPlanet ? 1 : 0;
				planetHoverLerp[i] += (hoverTarget - planetHoverLerp[i]!) * 0.14;
				const h = planetHoverLerp[i]!;
				const pd = mesh.userData as PlanetMeshUserData;

				/* Slight scale + pull toward camera — keep lit shading (no flat emissive). */
				mesh.scale.setScalar(1 + h * 0.09);
				pivot.position.z = -8 + h * 1.25;

				const mat = mesh.material as THREE.MeshStandardMaterial;
				mat.emissive.setHex(0x000000);
				mat.emissiveIntensity = 0;
				mat.roughness = pd.baseRoughness - h * 0.22;
				mat.metalness = pd.baseMetalness + h * 0.12;

				const ringMesh = pd.ringMesh;
				if (ringMesh) {
					ringMesh.position.copy(pivot.position);
					ringMesh.scale.setScalar(1 + h * 0.09);
					(ringMesh.material as THREE.ShaderMaterial).uniforms.uOpacity.value =
						(0.9 + h * 0.25) * solarFadeLerp;
				}
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

	/**
	 * Browser Back restores this page from the back/forward cache with
	 * `running === true` but every rAF cancelled. A plain start() would
	 * no-op and leave planets frozen and unresponsive — force a fresh loop.
	 */
	function forceRestartLoop() {
		running = false;
		cancelAnimationFrame(raf);
		applyVisibility();
	}

	let showRaf = 0;
	let showRaf2 = 0;
	let warmTimer = 0;
	/** After beach→universe, ignore stale scroll fade so planets don't stay hidden. */
	let forceOrreryVisibleUntil = 0;

	function clearWarmTimer() {
		window.clearTimeout(warmTimer);
		warmTimer = 0;
	}

	function scheduleWarmFrame() {
		clearWarmTimer();
		warmTimer = window.setTimeout(() => {
			warmTimer = 0;
			if (getTheme() !== 'beach' || document.hidden) return;
			/* One cheap frame keeps the universe GL context alive under Beach. */
			renderer.render(scene, camera);
			scheduleWarmFrame();
		}, 480);
	}

	function paintOrreryNow() {
		forceOrreryVisibleUntil = performance.now() + 2800;
		solarFade = 1;
		solarFadeLerp = 1;
		applySolarFade(1);
		setSize();
		start();
		renderer.render(scene, camera);
	}

	function showUniverseCanvas() {
		const root = canvasEl.closest('[data-universe-canvas]') as HTMLElement | null;
		if (root) {
			root.style.visibility = '';
			root.style.opacity = '1';
			root.style.pointerEvents = 'auto';
			root.removeAttribute('aria-hidden');
		}
		clearWarmTimer();
		paintOrreryNow();
		showRaf = requestAnimationFrame(() => {
			if (getTheme() !== 'universe') return;
			paintOrreryNow();
			showRaf2 = requestAnimationFrame(() => {
				if (getTheme() !== 'universe') return;
				setSize();
			});
		});
	}

	function applyVisibility() {
		const theme = getTheme();
		const root = canvasEl.closest('[data-universe-canvas]') as HTMLElement | null;
		window.cancelAnimationFrame(showRaf);
		window.cancelAnimationFrame(showRaf2);

		if (theme === 'beach') {
			stop();
			/* opacity (not visibility:hidden) — Safari is less eager to drop the GL layer. */
			if (root) {
				root.style.visibility = '';
				root.style.opacity = '0';
				root.style.pointerEvents = 'none';
				root.setAttribute('aria-hidden', 'true');
			}
			scheduleWarmFrame();
			return;
		}

		showUniverseCanvas();
	}

	function onBeachGlReleased() {
		if (getTheme() === 'universe') showUniverseCanvas();
	}

	function resetInteractionState() {
		window.clearTimeout(navigationReleaseTimer);
		navigating = false;
		secretHover = false;
		currentHoveredPlanet = null;
		hoverLerp = 0;
		secretMat.uniforms.uHover.value = 0;
		canvasEl.style.cursor = '';
		applyPlanetLabelHint();
		solarFade = getHeroScrollFade();
		solarFadeLerp = solarFade;
		applySolarFade(solarFadeLerp);
	}

	applyVisibility();

	const mo = new MutationObserver(() => applyVisibility());
	mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

	const onThemeLayout = () => {
		if (getTheme() === 'universe') applyVisibility();
	};
	window.addEventListener('aditi:theme-layout', onThemeLayout);
	window.addEventListener('aditi:beach-gl-released', onBeachGlReleased);

	const onResize = () => {
		syncCoarsePointerAttribute();
		setSize();
	};

	/** Leaving the page — drop the click latch so a restore can't strand us. */
	const onPageHide = () => {
		window.clearTimeout(navigationReleaseTimer);
		navigating = false;
	};

	/**
	 * Returning via Back (bfcache) or any soft restore: clear latch, revive the
	 * animation loop, and re-sync sizes in case the viewport changed while away.
	 */
	const onPageShow = (e: PageTransitionEvent) => {
		resetInteractionState();
		if (e.persisted) {
			forceRestartLoop();
			setSize();
		}
	};

	const onVisibilityChange = () => {
		if (document.visibilityState !== 'visible') return;
		resetInteractionState();
		forceRestartLoop();
	};

	const onContextLost = (e: Event) => {
		e.preventDefault();
		stop();
	};

	const onContextRestored = () => {
		forceRestartLoop();
		setSize();
	};

	window.addEventListener('pagehide', onPageHide);
	window.addEventListener('pageshow', onPageShow);
	document.addEventListener('visibilitychange', onVisibilityChange);
	window.addEventListener('resize', onResize);
	window.addEventListener('pointermove', onPointerMove, { passive: true });
	document.documentElement.addEventListener('mouseleave', onPointerLeave);
	canvasEl.addEventListener('pointerdown', onPointerDown);
	canvasEl.addEventListener('webglcontextlost', onContextLost);
	canvasEl.addEventListener('webglcontextrestored', onContextRestored);

	return () => {
		stop();
		clearWarmTimer();
		window.cancelAnimationFrame(showRaf);
		window.cancelAnimationFrame(showRaf2);
		mo.disconnect();
		titleObserver?.disconnect();
		window.removeEventListener('aditi:theme-layout', onThemeLayout);
		window.removeEventListener('aditi:beach-gl-released', onBeachGlReleased);
		cancelSurfaceGeneration?.();
		window.clearTimeout(navigationReleaseTimer);
		window.removeEventListener('pagehide', onPageHide);
		window.removeEventListener('pageshow', onPageShow);
		document.removeEventListener('visibilitychange', onVisibilityChange);
		unsubscribeScroll();
		window.removeEventListener('resize', onResize);
		window.removeEventListener('pointermove', onPointerMove);
		document.documentElement.removeEventListener('mouseleave', onPointerLeave);
		canvasEl.removeEventListener('pointerdown', onPointerDown);
		canvasEl.removeEventListener('webglcontextlost', onContextLost);
		canvasEl.removeEventListener('webglcontextrestored', onContextRestored);
		geometry.dispose();
		material.dispose();
		secretGeom.dispose();
		secretMat.dispose();
		for (const mesh of planetMeshes) {
			mesh.geometry.dispose();
			(mesh.material as THREE.Material).dispose();
		}
		for (const pivot of planetPivots) {
			solarSystemGroup.remove(pivot);
		}
		for (const ring of planetRingMeshes) {
			ring.geometry.dispose();
			(ring.material as THREE.Material).dispose();
			solarSystemGroup.remove(ring);
		}
		for (const maps of planetSurfaceMaps) {
			maps.map.dispose();
			maps.bumpMap.dispose();
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
