/**
 * Procedural equirectangular surface maps for the universe-theme planets.
 *
 * Why generated rather than shipped as images: five distinct planets at usable
 * resolution would be a few hundred KB of PNGs for decoration that only appears
 * in one theme, on one page.
 *
 * Noise is sampled on the unit sphere (3D value-noise fBm) rather than in UV
 * space, so there is no longitude seam and no smearing at the poles.
 *
 * Cost: ~35ms per planet at TEXTURE_W×TEXTURE_H. Generate off the critical path
 * (see `generatePlanetSurfacesDeferred`) — five in a row is a visible stall.
 */
import * as THREE from 'three';

export type PlanetSurfaceStyle = 'icy' | 'rocky' | 'banded' | 'marbled' | 'cloudy';

export interface PlanetSurfaceSpec {
	style: PlanetSurfaceStyle;
	/** Ramp from lowest to highest surface value: shadowed rock → mid tone → highlight. */
	palette: readonly [number, number, number];
	/** Decorrelates planets that share a style. */
	seed: number;
}

export interface PlanetSurfaceMaps {
	map: THREE.CanvasTexture;
	bumpMap: THREE.CanvasTexture;
	bumpScale: number;
	roughness: number;
	metalness: number;
}

/*
 * Sized to the largest apparent planet diameter (~200 device px), not to look
 * good zoomed in. Doubling this quadruples generation time for no visible gain.
 */
const TEXTURE_W = 320;
const TEXTURE_H = 160;

/** Per-style material response, applied alongside the generated maps. */
const STYLE_MATERIAL: Record<PlanetSurfaceStyle, Pick<PlanetSurfaceMaps, 'bumpScale' | 'roughness' | 'metalness'>> = {
	/* Ice has real specular response, so it stays the smoothest surface here. */
	icy: { bumpScale: 0.28, roughness: 0.46, metalness: 0.06 },
	rocky: { bumpScale: 0.55, roughness: 0.88, metalness: 0.03 },
	/* Gas giants have no relief — the bump only breaks up the band edges. */
	banded: { bumpScale: 0.12, roughness: 0.7, metalness: 0.02 },
	marbled: { bumpScale: 0.34, roughness: 0.62, metalness: 0.05 },
	cloudy: { bumpScale: 0.1, roughness: 0.8, metalness: 0.02 },
};

function hash3(ix: number, iy: number, iz: number, seed: number): number {
	let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(iz, 1440662683);
	h = Math.imul(h ^ seed, 2246822519);
	h = Math.imul(h ^ (h >>> 13), 1274126177);
	h ^= h >>> 16;
	return (h >>> 0) / 4294967296;
}

function smoothstepT(t: number): number {
	return t * t * (3 - 2 * t);
}

function valueNoise(x: number, y: number, z: number, seed: number): number {
	const ix = Math.floor(x);
	const iy = Math.floor(y);
	const iz = Math.floor(z);
	const fx = smoothstepT(x - ix);
	const fy = smoothstepT(y - iy);
	const fz = smoothstepT(z - iz);

	const c000 = hash3(ix, iy, iz, seed);
	const c100 = hash3(ix + 1, iy, iz, seed);
	const c010 = hash3(ix, iy + 1, iz, seed);
	const c110 = hash3(ix + 1, iy + 1, iz, seed);
	const c001 = hash3(ix, iy, iz + 1, seed);
	const c101 = hash3(ix + 1, iy, iz + 1, seed);
	const c011 = hash3(ix, iy + 1, iz + 1, seed);
	const c111 = hash3(ix + 1, iy + 1, iz + 1, seed);

	const x00 = c000 + (c100 - c000) * fx;
	const x10 = c010 + (c110 - c010) * fx;
	const x01 = c001 + (c101 - c001) * fx;
	const x11 = c011 + (c111 - c011) * fx;
	const y0 = x00 + (x10 - x00) * fy;
	const y1 = x01 + (x11 - x01) * fy;
	return y0 + (y1 - y0) * fz;
}

/** Lacunarity is off-integer so octaves do not line up into a grid. */
function fbm(x: number, y: number, z: number, seed: number, octaves: number): number {
	let amp = 0.5;
	let freq = 1;
	let sum = 0;
	let norm = 0;
	for (let i = 0; i < octaves; i++) {
		sum += amp * valueNoise(x * freq, y * freq, z * freq, seed + i * 7919);
		norm += amp;
		amp *= 0.5;
		freq *= 2.03;
	}
	return sum / norm;
}

/** Ridged noise — the creases read as mountain chains and crater rims. */
function ridged(x: number, y: number, z: number, seed: number, octaves: number): number {
	const f = fbm(x, y, z, seed, octaves);
	return 1 - Math.abs(2 * f - 1);
}

function clamp01(v: number): number {
	return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Surface value in 0..1 for a point on the unit sphere. Feeds both the colour
 * ramp and the bump map, so colour and relief always agree.
 */
function surfaceValue(
	style: PlanetSurfaceStyle,
	seed: number,
	nx: number,
	ny: number,
	nz: number,
): number {
	switch (style) {
		case 'rocky': {
			/* Big basins under sharp ridges: two scales keep it from looking like grain. */
			const basins = fbm(nx * 1.7, ny * 1.7, nz * 1.7, seed, 3);
			const ridges = ridged(nx * 5.5, ny * 5.5, nz * 5.5, seed + 131, 4);
			return clamp01(basins * 0.55 + ridges * 0.55 - 0.05);
		}
		case 'icy': {
			/* Continent mask, then thin bright fracture lines cutting across it. */
			const shelf = fbm(nx * 2.1, ny * 2.1, nz * 2.1, seed, 4);
			const cracks = 1 - Math.abs(2 * fbm(nx * 6.5, ny * 6.5, nz * 6.5, seed + 733, 2) - 1);
			return clamp01(shelf * 0.75 + Math.pow(cracks, 6) * 0.6);
		}
		case 'banded': {
			/* Latitude bands, warped by turbulence so the edges churn like real belts. */
			const warp = fbm(nx * 2.4, ny * 1.1, nz * 2.4, seed, 4);
			const bands = 0.5 + 0.5 * Math.sin(Math.asin(clamp01((ny + 1) / 2) * 2 - 1) * 11 + warp * 5.5);
			const detail = fbm(nx * 7, ny * 3, nz * 7, seed + 401, 3);
			return clamp01(bands * 0.72 + detail * 0.34 - 0.03);
		}
		case 'marbled': {
			/* Sine field driven through noise — swirls rather than blobs. */
			const warp = fbm(nx * 2.6, ny * 2.6, nz * 2.6, seed, 4);
			const swirl = 0.5 + 0.5 * Math.sin((nx * 2.7 + ny * 1.9 + nz * 1.3) * 2.6 + warp * 7.5);
			return clamp01(swirl * 0.68 + warp * 0.4);
		}
		case 'cloudy':
		default: {
			/* Domain-warped low-frequency fBm: soft haze, deliberately low contrast. */
			const wx = fbm(nx * 1.4, ny * 1.4, nz * 1.4, seed + 61, 3) - 0.5;
			const wy = fbm(nx * 1.4 + 5.2, ny * 1.4 + 1.3, nz * 1.4, seed + 97, 3) - 0.5;
			const base = fbm(nx * 2.6 + wx * 2.4, ny * 2.6 + wy * 2.4, nz * 2.6, seed, 4);
			return clamp01(0.5 + (base - 0.5) * 1.5);
		}
	}
}

function makeCanvas(): HTMLCanvasElement {
	const c = document.createElement('canvas');
	c.width = TEXTURE_W;
	c.height = TEXTURE_H;
	return c;
}

/** Blocking generation of one planet's colour + bump maps. */
export function createPlanetSurfaceMaps(spec: PlanetSurfaceSpec): PlanetSurfaceMaps {
	const [lowHex, midHex, highHex] = spec.palette;
	const low = new THREE.Color(lowHex);
	const mid = new THREE.Color(midHex);
	const high = new THREE.Color(highHex);

	const colorCanvas = makeCanvas();
	const bumpCanvas = makeCanvas();
	const colorCtx = colorCanvas.getContext('2d')!;
	const bumpCtx = bumpCanvas.getContext('2d')!;
	const colorData = colorCtx.createImageData(TEXTURE_W, TEXTURE_H);
	const bumpData = bumpCtx.createImageData(TEXTURE_W, TEXTURE_H);

	for (let py = 0; py < TEXTURE_H; py++) {
		/* v=0 is the north pole to match SphereGeometry's UV layout. */
		const lat = (0.5 - (py + 0.5) / TEXTURE_H) * Math.PI;
		const cosLat = Math.cos(lat);
		const sinLat = Math.sin(lat);

		for (let px = 0; px < TEXTURE_W; px++) {
			const lon = ((px + 0.5) / TEXTURE_W) * Math.PI * 2;
			const nx = cosLat * Math.cos(lon);
			const ny = sinLat;
			const nz = cosLat * Math.sin(lon);

			const v = surfaceValue(spec.style, spec.seed, nx, ny, nz);

			/* Two-segment ramp: shadowed → mid gives body, mid → highlight gives sparkle. */
			let r: number;
			let g: number;
			let b: number;
			if (v < 0.5) {
				const t = v * 2;
				r = low.r + (mid.r - low.r) * t;
				g = low.g + (mid.g - low.g) * t;
				b = low.b + (mid.b - low.b) * t;
			} else {
				const t = (v - 0.5) * 2;
				r = mid.r + (high.r - mid.r) * t;
				g = mid.g + (high.g - mid.g) * t;
				b = mid.b + (high.b - mid.b) * t;
			}

			const i = (py * TEXTURE_W + px) * 4;
			colorData.data[i] = Math.round(clamp01(r) * 255);
			colorData.data[i + 1] = Math.round(clamp01(g) * 255);
			colorData.data[i + 2] = Math.round(clamp01(b) * 255);
			colorData.data[i + 3] = 255;

			const bv = Math.round(v * 255);
			bumpData.data[i] = bv;
			bumpData.data[i + 1] = bv;
			bumpData.data[i + 2] = bv;
			bumpData.data[i + 3] = 255;
		}
	}

	colorCtx.putImageData(colorData, 0, 0);
	bumpCtx.putImageData(bumpData, 0, 0);

	const map = new THREE.CanvasTexture(colorCanvas);
	map.colorSpace = THREE.SRGBColorSpace;
	map.wrapS = THREE.RepeatWrapping;
	map.anisotropy = 4;

	/* Bump data is height, not colour — leave it in linear space. */
	const bumpMap = new THREE.CanvasTexture(bumpCanvas);
	bumpMap.wrapS = THREE.RepeatWrapping;
	bumpMap.anisotropy = 4;

	return { map, bumpMap, ...STYLE_MATERIAL[spec.style] };
}

/**
 * Generates each planet's maps in its own task so the five passes never land in
 * one long frame. Returns a cancel function for teardown mid-generation.
 */
export function generatePlanetSurfacesDeferred(
	specs: readonly PlanetSurfaceSpec[],
	onReady: (index: number, maps: PlanetSurfaceMaps) => void,
): () => void {
	let cancelled = false;
	let handle = 0;

	const schedule = (fn: () => void) => {
		handle = window.setTimeout(fn, 0);
	};

	const step = (i: number) => {
		if (cancelled || i >= specs.length) return;
		onReady(i, createPlanetSurfaceMaps(specs[i]!));
		schedule(() => step(i + 1));
	};

	schedule(() => step(0));

	return () => {
		cancelled = true;
		window.clearTimeout(handle);
	};
}
