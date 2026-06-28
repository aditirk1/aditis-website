/**
 * Emission-nebula background for the Universe theme — amber, orange, red, pink.
 * Seamless 3D noise (no atan UV seam). Camera-aligned plane with slight overscan.
 */
import * as THREE from 'three';

const NEBULA_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
	vUv = uv;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const NEBULA_FRAG = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uMotion;
uniform float uAspect;
uniform float uOpacity;
uniform mat3 uSkyRot;

varying vec2 vUv;

float hash3(vec3 p) {
	return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

float noise3(vec3 p) {
	vec3 i = floor(p);
	vec3 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);

	float n000 = hash3(i);
	float n100 = hash3(i + vec3(1.0, 0.0, 0.0));
	float n010 = hash3(i + vec3(0.0, 1.0, 0.0));
	float n110 = hash3(i + vec3(1.0, 1.0, 0.0));
	float n001 = hash3(i + vec3(0.0, 0.0, 1.0));
	float n101 = hash3(i + vec3(1.0, 0.0, 1.0));
	float n011 = hash3(i + vec3(0.0, 1.0, 1.0));
	float n111 = hash3(i + vec3(1.0, 1.0, 1.0));

	float nx00 = mix(n000, n100, f.x);
	float nx10 = mix(n010, n110, f.x);
	float nx01 = mix(n001, n101, f.x);
	float nx11 = mix(n011, n111, f.x);
	float nxy0 = mix(nx00, nx10, f.y);
	float nxy1 = mix(nx01, nx11, f.y);
	return mix(nxy0, nxy1, f.z);
}

float fbm3(vec3 p) {
	float v = 0.0;
	float a = 0.5;
	for (int i = 0; i < 5; i++) {
		v += a * noise3(p);
		p = p * 2.03 + vec3(11.3, 4.7, 2.1);
		a *= 0.5;
	}
	return v;
}

vec3 sampleNebula(vec3 dir) {
	float t = uTime * uMotion;

	vec3 p = dir * 1.65 + vec3(t * 0.018, -t * 0.014, t * 0.011);
	vec3 warp = vec3(
		fbm3(p + vec3(0.0, 0.0, t * 0.02)),
		fbm3(p + vec3(5.2, 1.3, 0.0) - vec3(t * 0.016, t * 0.02, 0.0)),
		fbm3(p + vec3(1.9, 4.1, 2.7))
	) - 0.5;
	p += warp * 0.38;

	float n = fbm3(p * 1.35);
	float n2 = fbm3(p * 2.05 + vec3(3.7, 1.2, 0.0));
	float n3 = fbm3(p * 3.15 + vec3(n, n2, 0.4));
	float hue = fbm3(p * 0.92 + vec3(4.1, 1.7, 6.3));

	vec3 voidCol = vec3(0.05, 0.025, 0.06);
	vec3 deepRed = vec3(0.38, 0.05, 0.09);
	vec3 red = vec3(0.68, 0.11, 0.15);
	vec3 orange = vec3(0.97, 0.44, 0.1);
	vec3 amber = vec3(1.0, 0.667, 0.0);
	vec3 coral = vec3(0.98, 0.36, 0.2);
	vec3 rose = vec3(0.9, 0.34, 0.44);
	vec3 pink = vec3(0.94, 0.42, 0.56);
	vec3 magenta = vec3(0.78, 0.2, 0.48);

	float cloud = smoothstep(0.32, 0.76, n);
	float warm = smoothstep(0.44, 0.82, n2) * cloud;
	float hot = smoothstep(0.58, 0.92, n3) * warm;
	float wisp = smoothstep(0.2, 0.52, n) * (1.0 - hot * 0.65);

	/* Regional hue bands — amber, orange, red, pink patches across the sky */
	float wAmber = 1.0 - smoothstep(0.0, 0.22, abs(hue - 0.12));
	float wOrange = 1.0 - smoothstep(0.0, 0.24, abs(hue - 0.34));
	float wRed = 1.0 - smoothstep(0.0, 0.22, abs(hue - 0.56));
	float wPink = 1.0 - smoothstep(0.0, 0.24, abs(hue - 0.78));
	float wSum = wAmber + wOrange + wRed + wPink + 0.001;

	vec3 goldPatch = mix(voidCol, mix(amber, orange, warm), cloud * 0.82);
	goldPatch = mix(goldPatch, amber, hot * 0.7);

	vec3 orangePatch = mix(voidCol, mix(orange, coral, warm), cloud * 0.8);
	orangePatch = mix(orangePatch, amber, hot * 0.45);

	vec3 redPatch = mix(voidCol, mix(deepRed, red, warm), cloud * 0.72);
	redPatch = mix(redPatch, coral, hot * 0.35);

	vec3 pinkPatch = mix(voidCol, mix(rose, pink, wisp), cloud * 0.68);
	pinkPatch = mix(pinkPatch, magenta, warm * 0.28);

	vec3 col = (goldPatch * wAmber + orangePatch * wOrange + redPatch * wRed + pinkPatch * wPink) / wSum;
	col = mix(col, amber, hot * 0.28);

	float presence = clamp(cloud * 0.68 + warm * 0.42 + wisp * 0.26, 0.0, 1.0);
	col = mix(voidCol, col, presence * uOpacity);

	float breathe = 0.96 + 0.04 * sin(t * 0.32 + n * 5.0);
	col *= breathe;

	return col;
}

void main() {
	vec2 ndc = vUv * 2.0 - 1.0;
	vec3 dir = normalize(vec3(ndc.x * uAspect, ndc.y, -1.0));
	dir = uSkyRot * dir;

	vec3 col = sampleNebula(dir);
	gl_FragColor = vec4(col, 1.0);
}
`;

const _skyEuler = new THREE.Euler();
const _skyRotMat = new THREE.Matrix4();
const _camDir = new THREE.Vector3();

/** Slightly larger than the frustum so no hard edge appears at screen bounds. */
const PLANE_OVERSCAN = 1.12;

export interface NebulaSky {
	mesh: THREE.Mesh;
	uniforms: {
		uTime: { value: number };
		uMotion: { value: number };
		uAspect: { value: number };
		uOpacity: { value: number };
		uSkyRot: { value: THREE.Matrix3 };
	};
	update: (camera: THREE.PerspectiveCamera, time: number) => void;
}

export function createNebulaSky(motionScale = 1): NebulaSky {
	const uniforms = {
		uTime: { value: 0 },
		uMotion: { value: motionScale },
		uAspect: { value: 1 },
		uOpacity: { value: 0.76 },
		uSkyRot: { value: new THREE.Matrix3() },
	};

	const material = new THREE.ShaderMaterial({
		uniforms,
		vertexShader: NEBULA_VERT,
		fragmentShader: NEBULA_FRAG,
		depthWrite: false,
		depthTest: false,
	});

	const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
	mesh.renderOrder = -1000;
	mesh.frustumCulled = false;

	function update(camera: THREE.PerspectiveCamera, time: number) {
		const dist = Math.min(camera.far - 2, 318);
		const h = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5) * dist * PLANE_OVERSCAN;
		const w = h * camera.aspect;

		camera.getWorldDirection(_camDir);
		mesh.position.copy(camera.position).addScaledVector(_camDir, dist);
		mesh.quaternion.copy(camera.quaternion);
		mesh.scale.set(w, h, 1);

		uniforms.uAspect.value = camera.aspect;
		uniforms.uTime.value = time;

		_skyEuler.set(
			Math.sin(time * 0.028) * 0.08 + Math.cos(time * 0.017) * 0.05,
			time * 0.011,
			0,
			'YXZ',
		);
		_skyRotMat.makeRotationFromEuler(_skyEuler);
		uniforms.uSkyRot.value.setFromMatrix4(_skyRotMat);
	}

	return { mesh, uniforms, update };
}
