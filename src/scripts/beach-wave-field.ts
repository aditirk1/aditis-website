/**
 * Beach theme: single full-screen shader — pale sky + light blue water,
 * with soft crests and a glow that travels along each wave (GPU, one rAF loop).
 */
import * as THREE from 'three';
import { isMobileViewport } from '../utils/input-capabilities.ts';

const CANVAS_ID = 'beach-wave-canvas';
const MAX_DPR = 1.5;
const MOBILE_MAX_DPR = 1.1;

const VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

const FRAG = `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform float uMotion;

varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = rot * p * 2.03 + 13.7;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float t = uTime * uMotion;
  vec2 p = uv;

  float n = fbm(p * 1.65 + vec2(t * 0.045, t * 0.028));
  float n2 = fbm(p * 2.1 - vec2(t * 0.032, t * 0.04) + 6.2);

  vec3 col = vec3(0.94, 0.97, 1.0);
  vec3 sky = vec3(0.68, 0.86, 0.98);
  vec3 sand = vec3(0.78, 0.91, 0.99);

  float crestMix = 0.0;
  float glowMix = 0.0;

  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float phase = t * (0.38 + fi * 0.07) + fi * 1.65;
    float yCrest =
      0.18 + fi * 0.19
      + 0.065 * sin(p.x * 6.28318 * (0.95 + fi * 0.12) + phase)
      + 0.032 * sin(p.x * 12.56636 + phase * 1.25);

    float d = p.y - yCrest;
    float band = exp(-d * d * 75.0);
    crestMix += band * (0.28 - fi * 0.04);

    float travel = sin(p.x * 10.0 - t * (1.5 + fi * 0.18) + fi * 2.1) * 0.5 + 0.5;
    float onCrest = exp(-abs(d) * 48.0);
    glowMix += onCrest * travel * (0.22 - fi * 0.035);
  }

  float flow = 0.5 + 0.5 * sin(p.x * 2.4 + t * 0.5 + n * 3.0);
  float skyAmt = smoothstep(0.2, 0.8, n) * 0.38 * flow + crestMix * 0.55 * (0.55 + 0.45 * n2);
  float sandAmt = smoothstep(0.25, 0.75, n2) * 0.34 * (1.0 - flow * 0.35) + crestMix * 0.5 * (0.5 + 0.5 * n);

  col = mix(col, sky, clamp(skyAmt, 0.0, 0.72));
  col = mix(col, sand, clamp(sandAmt, 0.0, 0.68));

  col += vec3(0.52, 0.82, 1.0) * glowMix * 0.58;
  col += vec3(0.86, 0.95, 1.0) * glowMix * 0.3;

  col *= 0.985 + 0.015 * sin(t * 0.55 + n * 2.0);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

function getTheme(): 'universe' | 'beach' {
	const t = document.documentElement.getAttribute('data-theme');
	return t === 'beach' ? 'beach' : 'universe';
}

function prefersReducedMotion(): boolean {
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function initBeachWaveField(): () => void {
	const canvasEl = document.getElementById(CANVAS_ID) as HTMLCanvasElement | null;
	if (!canvasEl) {
		console.warn('[beach-wave-field] Canvas not found:', CANVAS_ID);
		return () => {};
	}

	// Bound after the guard so the hoisted helpers below see a non-null type.
	const canvas = canvasEl;

	const root = canvas.closest('[data-beach-canvas]') as HTMLElement | null;
	const reducedMotion = prefersReducedMotion();

	const renderer = new THREE.WebGLRenderer({
		canvas,
		alpha: false,
		antialias: false,
		powerPreference: 'high-performance',
	});
	renderer.setClearColor(0xeaf6ff, 1);

	const scene = new THREE.Scene();
	const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

	const material = new THREE.ShaderMaterial({
		vertexShader: VERT,
		fragmentShader: FRAG,
		uniforms: {
			uTime: { value: 0 },
			uResolution: { value: new THREE.Vector2(1, 1) },
			uMotion: { value: reducedMotion ? 0 : 1 },
		},
		depthTest: false,
		depthWrite: false,
	});

	const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
	scene.add(mesh);

	let running = false;
	let raf = 0;
	const clock = new THREE.Clock();

	function setSize() {
		const w = window.innerWidth;
		const h = window.innerHeight;
		const maxPr = isMobileViewport() ? MOBILE_MAX_DPR : MAX_DPR;
		const pr = Math.min(window.devicePixelRatio || 1, maxPr);
		renderer.setPixelRatio(pr);
		renderer.setSize(w, h, false);
		material.uniforms.uResolution.value.set(canvas.width, canvas.height);
	}

	function tick() {
		if (!running) return;
		material.uniforms.uTime.value = clock.getElapsedTime();
		renderer.render(scene, camera);
		raf = requestAnimationFrame(tick);
	}

	function start() {
		if (running) return;
		running = true;
		clock.start();
		setSize();
		raf = requestAnimationFrame(tick);
	}

	function stop() {
		running = false;
		cancelAnimationFrame(raf);
		clock.stop();
	}

	function applyVisibility() {
		const beach = getTheme() === 'beach';
		if (!beach || document.hidden) {
			stop();
			if (root) {
				root.hidden = true;
				root.style.visibility = 'hidden';
			}
			return;
		}
		if (root) {
			root.hidden = false;
			root.style.visibility = 'visible';
		}
		start();
	}

	applyVisibility();

	const mo = new MutationObserver(applyVisibility);
	mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
	document.addEventListener('visibilitychange', applyVisibility);
	window.addEventListener('resize', setSize);

	return () => {
		stop();
		mo.disconnect();
		document.removeEventListener('visibilitychange', applyVisibility);
		window.removeEventListener('resize', setSize);
		mesh.geometry.dispose();
		material.dispose();
		renderer.dispose();
	};
}
