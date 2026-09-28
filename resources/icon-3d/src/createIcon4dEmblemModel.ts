import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type ProceduralModelOptions = {
  wireframe?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  textureSize?: number;
  textureAnisotropy?: number;
  qualityPriority?: 'reference-fidelity' | 'balanced';
};

export type ProceduralModelRuntime = {
  nodes: Record<string, THREE.Object3D>;
  meshes: Record<string, THREE.Mesh>;
  sockets: Record<string, THREE.Object3D>;
  colliders: Record<string, unknown>;
  destructionGroups: Record<string, THREE.Object3D[]>;
};

type SculptMaterialSpec = Record<string, any>;

// bevelEnabled defaults to true on THREE.ExtrudeGeometry and rounds every
// corner — sharp/pointed profiles (blades, fork tines, spikes) need
// bevelEnabled: false plus lineTo()-only path segments near the tip, since a
// curve command cannot produce a true converging point.
function buildExtrudeShape(points: [number, number][], holes?: [number, number][][]): THREE.Shape {
  const shape = new THREE.Shape();
  if (points.length > 0) {
    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) {
      shape.lineTo(points[i][0], points[i][1]);
    }
  }
  // Cutouts (e.g. an oval wire-cutter hole) as THREE.Path added to shape.holes —
  // dep-free boolean subtraction via the tessellator, no CSG library needed.
  for (const loop of holes ?? []) {
    if (loop.length < 3) continue;
    const path = new THREE.Path();
    path.moveTo(loop[0][0], loop[0][1]);
    for (let i = 1; i < loop.length; i += 1) path.lineTo(loop[i][0], loop[i][1]);
    path.closePath();
    shape.holes.push(path);
  }
  return shape;
}

// Build an N-gon oval loop (for hole authoring from a compact {cx,cy,rx,ry} descriptor).
function ovalLoop(cx: number, cy: number, rx: number, ry: number, seg = 24): [number, number][] {
  const loop: [number, number][] = [];
  for (let i = 0; i < seg; i += 1) {
    const a = (i / seg) * Math.PI * 2;
    loop.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return loop;
}

function buildExtrudeGeometry(profile: { points: [number, number][]; depth: number; holes?: [number, number][][]; ovalHoles?: { cx: number; cy: number; rx: number; ry: number }[] }): THREE.ExtrudeGeometry {
  const holes = [...(profile.holes ?? []), ...((profile.ovalHoles ?? []).map((o) => ovalLoop(o.cx, o.cy, o.rx, o.ry)))];
  const shape = buildExtrudeShape(profile.points, holes);
  return new THREE.ExtrudeGeometry(shape, {
    depth: profile.depth,
    bevelEnabled: false,
    steps: 1,
  });
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function readLayerNumber(value: unknown, keys: string[], fallback: number): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of keys) {
      if (typeof record[key] === 'number') return record[key] as number;
    }
  }
  return fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = /^#[0-9a-f]{3}$/i.test(hex)
    ? '#' + hex.slice(1).split('').map((part) => part + part).join('')
    : hex;
  const value = /^#[0-9a-f]{6}$/i.test(normalized) ? Number.parseInt(normalized.slice(1), 16) : 0x8a7a5f;
  return [clampAlbedoChannel((value >> 16) & 255), clampAlbedoChannel((value >> 8) & 255), clampAlbedoChannel(value & 255)];
}

function materialPalette(spec: SculptMaterialSpec): string[] {
  const palette = spec.colorVariation?.palette;
  if (Array.isArray(palette) && palette.length > 0) return palette.filter((value) => typeof value === 'string');
  const secondary = spec.albedo?.secondary;
  const colors = [spec.baseColor ?? spec.color ?? spec.albedo?.dominant, ...(Array.isArray(secondary) ? secondary : [])];
  return colors.filter((value): value is string => typeof value === 'string' && value.startsWith('#'));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampAlbedoChannel(value: number): number {
  return Math.max(30, Math.min(240, Math.round(value)));
}

function clampPbrF0(value: number): number {
  return Math.max(0.02, Math.min(1, value));
}

function clampPbrIor(value: number): number {
  return Math.max(1, Math.min(2.5, value));
}

function clampPbrMetalness(value: number): number {
  return value >= 0.5 ? 1 : 0;
}

function clampedAlbedoColor(spec: SculptMaterialSpec): THREE.Color {
  const source = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  // setStyle with an explicit SRGBColorSpace, NOT the numeric constructor.
  //
  // `new THREE.Color(r, g, b)` treats its arguments as LINEAR working-space components,
  // while an authored `baseColor` hex is sRGB. Feeding one to the other skipped the
  // transfer function and lifted every dark albedo: #2e2a28, authored as a near-black
  // vinyl, rendered at roughly sRGB 0.46 — a mid grey. The error is largest exactly where
  // it matters most, because the transfer curve is steepest near black.
  return new THREE.Color().setStyle(source, THREE.SRGBColorSpace);
}

function smoothCurve(value: number): number {
  return value * value * (3 - 2 * value);
}

function periodicHash(x: number, y: number, seed: number, periodX: number, periodY: number): number {
  const wrappedX = ((x % periodX) + periodX) % periodX;
  const wrappedY = ((y % periodY) + periodY) % periodY;
  let value = Math.imul(wrappedX + seed * 17, 374761393) ^ Math.imul(wrappedY + seed * 31, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function periodicValueNoise(u: number, v: number, seed: number, periodX: number, periodY: number): number {
  const x = u * periodX;
  const y = v * periodY;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothCurve(x - x0);
  const ty = smoothCurve(y - y0);
  const a = periodicHash(x0, y0, seed, periodX, periodY);
  const b = periodicHash(x0 + 1, y0, seed, periodX, periodY);
  const c = periodicHash(x0, y0 + 1, seed, periodX, periodY);
  const d = periodicHash(x0 + 1, y0 + 1, seed, periodX, periodY);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, tx), THREE.MathUtils.lerp(c, d, tx), ty);
}

type SurfaceBand = {
  frequency: number;
  amplitude: number;
  stretchX: number;
  stretchY: number;
  ridge: boolean;
};

function surfaceBands(spec: SculptMaterialSpec): SurfaceBand[] {
  const source = Array.isArray(spec.surfaceFrequencyBands) ? spec.surfaceFrequencyBands : [];
  const parsed = source.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const band = item as Record<string, unknown>;
    const frequency = typeof band.frequency === 'number' ? band.frequency : 0;
    const amplitude = typeof band.amplitude === 'number' ? band.amplitude : 0;
    if (frequency <= 0 || amplitude <= 0) return [];
    const stretch = Array.isArray(band.stretch) ? band.stretch : [1, 1];
    const description = `${String(band.pattern ?? '')} ${String(band.role ?? '')}`.toLowerCase();
    return [{
      frequency,
      amplitude,
      stretchX: typeof stretch[0] === 'number' ? Math.max(0.1, stretch[0]) : 1,
      stretchY: typeof stretch[1] === 'number' ? Math.max(0.1, stretch[1]) : 1,
      ridge: /(ridge|groove|grain|fiber|striated|crack)/.test(description),
    }];
  });
  return parsed.length > 0 ? parsed : [
    { frequency: 2, amplitude: 0.42, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 12, amplitude: 0.22, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 56, amplitude: 0.08, stretchX: 1, stretchY: 1, ridge: false },
  ];
}

function sampleSurface(u: number, v: number, bands: SurfaceBand[], seed: number): number {
  let value = 0;
  let weight = 0;
  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index];
    const periodX = Math.max(1, Math.round(band.frequency * band.stretchX));
    const periodY = Math.max(1, Math.round(band.frequency * band.stretchY));
    let sample = periodicValueNoise(u, v, seed + index * 1013, periodX, periodY);
    if (band.ridge) sample = 1 - Math.abs(sample * 2 - 1);
    value += sample * band.amplitude;
    weight += band.amplitude;
  }
  return weight > 0 ? clamp01(value / weight) : 0.5;
}

function mixPalette(colors: [number, number, number][], value: number): [number, number, number] {
  if (colors.length === 1) return colors[0];
  const scaled = clamp01(value) * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(scaled));
  const mix = scaled - index;
  const a = colors[index];
  const b = colors[index + 1];
  return [
    Math.round(THREE.MathUtils.lerp(a[0], b[0], mix)),
    Math.round(THREE.MathUtils.lerp(a[1], b[1], mix)),
    Math.round(THREE.MathUtils.lerp(a[2], b[2], mix)),
  ];
}

type ColorGradientStop = { offset: number; color: string };
type ColorGradientSpec = {
  type: 'linear' | 'radial';
  axis: [number, number];
  stops: ColorGradientStop[];
};

function parseRgba(value: string): [number, number, number] {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
  if (!match) return [138, 122, 95];
  return [clampAlbedoChannel(Number(match[1])), clampAlbedoChannel(Number(match[2])), clampAlbedoChannel(Number(match[3]))];
}

// Analytical per-pixel gradient sample. The extraction schema's colorGradient carries
// exact rgba(...) stop colors (see extract_part_color_recipe.py), so this samples the
// same trend directly in JS math rather than round-tripping through a Canvas 2D
// createLinearGradient/createRadialGradient object — same visual result, and it composes
// directly with the existing noise/height-correlated colorVariation blend below.
function sampleColorGradient(gradient: ColorGradientSpec, u: number, v: number): [number, number, number] {
  const stops = gradient.stops.length >= 2 ? gradient.stops : [{ offset: 0, color: 'rgba(138,122,95,1)' }, { offset: 1, color: 'rgba(138,122,95,1)' }];
  let t: number;
  if (gradient.type === 'radial') {
    const [cx, cy] = gradient.axis;
    const dx = u - cx;
    const dy = v - cy;
    const maxRadius = Math.max(0.001, Math.hypot(Math.max(cx, 1 - cx), Math.max(cy, 1 - cy)));
    t = clamp01(Math.hypot(dx, dy) / maxRadius);
  } else {
    const [ax, ay] = gradient.axis;
    const projection = (u - 0.5) * ax + (v - 0.5) * ay;
    const maxProjection = 0.5 * (Math.abs(ax) + Math.abs(ay)) || 0.5;
    t = clamp01(projection / maxProjection + 0.5);
  }
  const scaled = t * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.max(0, Math.floor(scaled)));
  const mix = scaled - index;
  const a = parseRgba(stops[index].color);
  const b = parseRgba(stops[index + 1].color);
  return [
    THREE.MathUtils.lerp(a[0], b[0], mix),
    THREE.MathUtils.lerp(a[1], b[1], mix),
    THREE.MathUtils.lerp(a[2], b[2], mix),
  ];
}

function writePixel(data: Uint8ClampedArray, offset: number, red: number, green: number, blue: number): void {
  data[offset] = Math.max(0, Math.min(255, Math.round(red)));
  data[offset + 1] = Math.max(0, Math.min(255, Math.round(green)));
  data[offset + 2] = Math.max(0, Math.min(255, Math.round(blue)));
  data[offset + 3] = 255;
}

function makeCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function createMapTexture(
  canvas: HTMLCanvasElement,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [2, 2];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 2,
    typeof repeat[1] === 'number' ? repeat[1] : 2,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

type ProceduralTextureSet = {
  albedo: THREE.Texture;
  roughness: THREE.Texture;
  height: THREE.Texture;
  normal: THREE.Texture;
  ao: THREE.Texture;
  source: 'reference-pixel-extraction' | 'procedural';
};

function referenceMapUrl(spec: SculptMaterialSpec, channel: string): string | null {
  const reference = spec.referencePbr;
  if (!reference || typeof reference !== 'object') return null;
  if (reference.usable === false) return null;
  const confidence = typeof reference.confidence === 'number'
    ? reference.confidence
    : (typeof reference.estimatedFidelity === 'number' ? reference.estimatedFidelity : 0);
  const threshold = typeof reference.targetThreshold === 'number' ? reference.targetThreshold : 0.7;
  if (confidence < threshold) return null;
  const maps = reference.maps;
  if (!maps || typeof maps !== 'object') return null;
  const map = (maps as Record<string, unknown>)[channel];
  if (!map || typeof map !== 'object') return null;
  const record = map as Record<string, unknown>;
  const url = typeof record.url === 'string' && record.url.trim() ? record.url : record.path;
  return typeof url === 'string' && url.trim() ? url : null;
}

function createLoadedMapTexture(
  url: string,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.Texture {
  const texture = new THREE.TextureLoader().load(url);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [1, 1];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 1,
    typeof repeat[1] === 'number' ? repeat[1] : 1,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

function makeReferenceTextureSet(spec: SculptMaterialSpec, options: ProceduralModelOptions): ProceduralTextureSet | null {
  const albedo = referenceMapUrl(spec, 'albedo');
  const roughness = referenceMapUrl(spec, 'roughness');
  const height = referenceMapUrl(spec, 'height');
  const normal = referenceMapUrl(spec, 'normal');
  const ao = referenceMapUrl(spec, 'ao');
  if (!albedo || !roughness || !height || !normal || !ao) return null;
  return {
    albedo: createLoadedMapTexture(albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createLoadedMapTexture(roughness, THREE.NoColorSpace, spec, options),
    height: createLoadedMapTexture(height, THREE.NoColorSpace, spec, options),
    normal: createLoadedMapTexture(normal, THREE.NoColorSpace, spec, options),
    ao: createLoadedMapTexture(ao, THREE.NoColorSpace, spec, options),
    source: 'reference-pixel-extraction',
  };
}

function makeProceduralTextureSet(
  id: string,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): ProceduralTextureSet | null {
  if (typeof document === 'undefined') return null;
  const qualityFirst = (options.qualityPriority ?? 'reference-fidelity') === 'reference-fidelity';
  const requested = options.textureSize ?? spec.textureResolution;
  const requestedSize = typeof requested === 'number' && Number.isFinite(requested)
    ? requested
    : (qualityFirst ? 1024 : 512);
  const size = Math.max(256, Math.min(2048, 2 ** Math.round(Math.log2(requestedSize))));
  const canvases = {
    albedo: makeCanvas(size),
    roughness: makeCanvas(size),
    height: makeCanvas(size),
    normal: makeCanvas(size),
    ao: makeCanvas(size),
  };
  const contexts = {
    albedo: canvases.albedo.getContext('2d'),
    roughness: canvases.roughness.getContext('2d'),
    height: canvases.height.getContext('2d'),
    normal: canvases.normal.getContext('2d'),
    ao: canvases.ao.getContext('2d'),
  };
  if (!contexts.albedo || !contexts.roughness || !contexts.height || !contexts.normal || !contexts.ao) return null;
  const images = {
    albedo: contexts.albedo.createImageData(size, size),
    roughness: contexts.roughness.createImageData(size, size),
    height: contexts.height.createImageData(size, size),
    normal: contexts.normal.createImageData(size, size),
    ao: contexts.ao.createImageData(size, size),
  };
  const seed = hashString(id);
  const bands = surfaceBands(spec);
  const heightField = new Float32Array(size * size);
  const roughnessField = new Float32Array(size * size);
  const palette = materialPalette(spec);
  const fallback = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  const colors = (palette.length >= 2 ? palette : [fallback, '#6E614B', '#A08F70']).map(hexToRgb);
  const baseRoughness = clamp01(readLayerNumber(spec.roughness, ['base'], 0.76));
  const roughnessVariation = clamp01(readLayerNumber(spec.roughness, ['variation'], 0.18));
  const colorAmplitude = clamp01(readLayerNumber(spec.colorVariation, ['amplitude', 'variation'], 0.18));
  const heightCorrelation = clamp01(readLayerNumber(spec.colorVariation, ['heightCorrelation'], 0.3));
  const colorGradient: ColorGradientSpec | undefined = spec.colorGradient;
  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const index = y * size + x;
      const height = sampleSurface(u, v, bands, seed + 101);
      const roughNoise = sampleSurface(u, v, bands, seed + 7001);
      const colorNoise = sampleSurface(u, v, bands, seed + 15013);
      heightField[index] = height;
      roughnessField[index] = clamp01(baseRoughness + (roughNoise - 0.5) * roughnessVariation * 2);
      let color: [number, number, number];
      if (colorGradient) {
        // Evidence-derived spatial gradient (Plan 1.3 Workstream C) takes priority
        // over the noise-based palette blend below — it is a measured trend, not a guess.
        color = sampleColorGradient(colorGradient, u, v);
      } else {
        const paletteValue = clamp01(
          0.5 + (colorNoise - 0.5) * colorAmplitude * 2 + (height - 0.5) * heightCorrelation
        );
        color = mixPalette(colors, paletteValue);
      }
      writePixel(images.albedo.data, index * 4, color[0], color[1], color[2]);
    }
  }
  const normalStrength = Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35));
  const aoStrength = clamp01(readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35));
  for (let y = 0; y < size; y += 1) {
    const up = ((y - 1 + size) % size) * size;
    const down = ((y + 1) % size) * size;
    for (let x = 0; x < size; x += 1) {
      const left = (x - 1 + size) % size;
      const right = (x + 1) % size;
      const index = y * size + x;
      const center = heightField[index];
      const dx = (heightField[y * size + right] - heightField[y * size + left]) * normalStrength * 6;
      const dy = (heightField[down + x] - heightField[up + x]) * normalStrength * 6;
      const inverseLength = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const normalX = -dx * inverseLength;
      const normalY = -dy * inverseLength;
      const normalZ = inverseLength;
      const neighborAverage = (
        heightField[y * size + left] + heightField[y * size + right]
        + heightField[up + x] + heightField[down + x]
      ) * 0.25;
      const cavity = Math.max(0, neighborAverage - center);
      const ao = clamp01(1 - aoStrength * (cavity * 12 + (1 - center) * 0.16));
      const offset = index * 4;
      const heightByte = center * 255;
      const roughnessByte = roughnessField[index] * 255;
      writePixel(images.height.data, offset, heightByte, heightByte, heightByte);
      writePixel(images.roughness.data, offset, roughnessByte, roughnessByte, roughnessByte);
      writePixel(
        images.normal.data, offset,
        (normalX * 0.5 + 0.5) * 255,
        (normalY * 0.5 + 0.5) * 255,
        (normalZ * 0.5 + 0.5) * 255,
      );
      writePixel(images.ao.data, offset, ao * 255, ao * 255, ao * 255);
    }
  }
  contexts.albedo.putImageData(images.albedo, 0, 0);
  contexts.roughness.putImageData(images.roughness, 0, 0);
  contexts.height.putImageData(images.height, 0, 0);
  contexts.normal.putImageData(images.normal, 0, 0);
  contexts.ao.putImageData(images.ao, 0, 0);
  return {
    albedo: createMapTexture(canvases.albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createMapTexture(canvases.roughness, THREE.NoColorSpace, spec, options),
    height: createMapTexture(canvases.height, THREE.NoColorSpace, spec, options),
    normal: createMapTexture(canvases.normal, THREE.NoColorSpace, spec, options),
    ao: createMapTexture(canvases.ao, THREE.NoColorSpace, spec, options),
    source: 'procedural',
  };
}

function createSculptMaterial(id: string, spec: SculptMaterialSpec, options: ProceduralModelOptions, denseComponent = false): THREE.MeshPhysicalMaterial {
  // A material that declares -- with evidence -- that its subject carries no texture
  // detail gets NO texture set. Synthesising one anyway is not a harmless default: the
  // branch below then forces color to white and roughness to 1 and reads both from the
  // generated maps, so the authored albedo and the reference-derived roughness are both
  // discarded, and the model gains mottling the reference does not have. Measured on the
  // tuxedo cat, whose black fur rendered as speckled grey-and-white from a palette that
  // only ever described two flat regions.
  const textureless = (spec.textureless as { declared?: boolean } | undefined)?.declared === true;
  const textures = textureless
    ? null
    : makeReferenceTextureSet(spec, options) ?? makeProceduralTextureSet(id, spec, options);
  const material = new THREE.MeshPhysicalMaterial({
    color: textures ? 0xffffff : clampedAlbedoColor(spec),
    roughness: textures ? 1 : clamp01(readLayerNumber(spec.roughness, ['base'], 0.76)),
    metalness: clampPbrMetalness(readLayerNumber(spec.metalness, ['base'], 0.0)),
    clearcoat: clamp01(readLayerNumber(spec.clearcoat, ['base', 'amount'], 0)),
    clearcoatRoughness: clamp01(readLayerNumber(spec.clearcoatRoughness, ['base'], 0.25)),
    transmission: clamp01(readLayerNumber(spec.transmission, ['base', 'amount'], 0)),
    ior: clampPbrIor(readLayerNumber(spec.ior, ['base', 'value'], 1.5)),
    thickness: Math.max(0, readLayerNumber(spec.thickness, ['base', 'amount'], 0)),
    attenuationDistance: Math.max(0.001, readLayerNumber(spec.attenuationDistance, ['base', 'value'], Infinity)),
    attenuationColor: new THREE.Color(typeof spec.attenuationColor === 'string' ? spec.attenuationColor : '#ffffff'),
    sheen: clamp01(readLayerNumber(spec.sheen, ['base', 'amount'], 0)),
    sheenColor: new THREE.Color(typeof spec.sheenColor === 'string' ? spec.sheenColor : '#ffffff'),
    sheenRoughness: clamp01(readLayerNumber(spec.sheenRoughness, ['base'], 1.0)),
    iridescence: clamp01(readLayerNumber(spec.iridescence, ['base', 'amount'], 0)),
    iridescenceIOR: clampPbrIor(readLayerNumber(spec.iridescenceIOR, ['base', 'value'], 1.3)),
    anisotropy: clamp01(readLayerNumber(spec.anisotropy, ['base', 'amount'], 0)),
    anisotropyRotation: readLayerNumber(spec.anisotropy, ['rotation'], 0),
    specularIntensity: clampPbrF0(readLayerNumber(spec.specularF0 ?? spec.f0 ?? spec.specularIntensity, ['base', 'value'], 1.0)),
    specularColor: new THREE.Color(typeof spec.specularColor === 'string' ? spec.specularColor : '#ffffff'),
    emissive: new THREE.Color(typeof spec.emissive === 'string' ? spec.emissive : '#000000'),
    emissiveIntensity: Math.max(0, readLayerNumber(spec.emissiveIntensity, ['base'], 1.0)),
    opacity: clamp01(readLayerNumber(spec.opacity, ['base'], 1)),
    transparent: readLayerNumber(spec.transmission, ['base', 'amount'], 0) > 0 || readLayerNumber(spec.opacity, ['base'], 1) < 1,
    alphaTest: Math.max(0, readLayerNumber(spec.alpha, ['cutoff', 'alphaTest'], 0)),
    wireframe: options.wireframe ?? false,
    side: spec.doubleSided === true ? THREE.DoubleSide : THREE.FrontSide,
    flatShading: spec.flatShading === true,
  });
  if (textures) {
    material.map = textures.albedo;
    material.roughnessMap = textures.roughness;
    material.normalMap = textures.normal;
    material.normalScale.setScalar(Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35)));
    material.aoMap = textures.ao;
    material.aoMap.channel = 0;
    material.aoMapIntensity = readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35);
    const denseMesh = denseComponent || spec.denseMesh === true || spec.geometryDensity === 'dense' || spec.topologyClass === 'dense';
    const bumpScale = Math.max(0, readLayerNumber(spec.bump, ['amplitude', 'strength'], 0));
    const effectiveBumpScale = denseMesh ? Math.max(0.05, bumpScale) : bumpScale;
    if (effectiveBumpScale > 0) {
      material.bumpMap = textures.height;
      material.bumpScale = effectiveBumpScale;
    }
    const displacementScale = Math.max(0, readLayerNumber(spec.displacement, ['amplitude', 'strength'], 0));
    const effectiveDisplacementScale = denseMesh ? Math.max(0.005, displacementScale) : displacementScale;
    if (effectiveDisplacementScale > 0) {
      material.displacementMap = textures.height;
      material.displacementScale = effectiveDisplacementScale;
      material.displacementBias = -effectiveDisplacementScale * 0.5;
    }
  }
  material.envMapIntensity = readLayerNumber(spec, ['envMapIntensity'], 0.8);
  material.userData.sculptMaterial = spec;
  material.userData.proceduralMapsIndependent = true;
  material.userData.pbrConstraints = { albedoRange: [30, 240], binaryMetalness: true, f0Range: [0.02, 1], iorRange: [1, 2.5] };
  material.userData.pbrTextureSource = textures?.source ?? 'flat-fallback';
  material.userData.referencePbr = spec.referencePbr ?? null;
  material.userData.referenceMaterialId = spec.referenceMaterialId ?? spec.materialReference?.profileId ?? null;
  material.userData.materialEvidence = spec.materialEvidence ?? null;
  material.userData.validationViews = spec.materialReference?.validationViews ?? [];
  material.needsUpdate = true;
  return material;
}

type AttachmentEndpoint = {
  start: THREE.Vector3;
  midpoint: THREE.Vector3;
  quaternion: THREE.Quaternion;
  length: number;
  baseRadius: number;
  endRadius: number;
};

function readVector3(value: unknown, fallback: [number, number, number]): THREE.Vector3 {
  if (Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === 'number')) {
    return new THREE.Vector3(value[0], value[1], value[2]);
  }
  return new THREE.Vector3(fallback[0], fallback[1], fallback[2]);
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function makeAttachmentEndpoint(attachment: unknown): AttachmentEndpoint | null {
  if (!attachment || typeof attachment !== 'object') return null;
  const record = attachment as Record<string, unknown>;
  const start = readVector3(record.localStart, [0, 0, 0]);
  const end = readVector3(record.localEnd, [0, 1, 0]);
  const delta = end.clone().sub(start);
  const length = delta.length();
  if (length <= 0.0001) return null;
  const direction = delta.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const baseRadius = Math.max(0.005, readNumber(record.baseRadius, 0.06));
  const endRadius = Math.max(0.003, readNumber(record.endRadius, baseRadius * 0.55));
  return {
    start,
    midpoint: delta.multiplyScalar(0.5),
    quaternion,
    length,
    baseRadius,
    endRadius,
  };
}

// Generated from ObjectSculptSpec target: Icon 4D Emblem
// Sculpt build pass: material-pass
// This factory is intentionally pass-gated. Finish browser screenshot review before unlocking deeper passes.
export function createIcon4DEmblemModel(options: ProceduralModelOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "Icon 4D Emblem";
  root.userData.reconstructionEvidence = {"itemFamily": null, "subtype": null, "componentAdapter": null, "route": null, "exactnessTier": null, "referenceCamera": {"solved": true, "fovDegrees": 40.0, "aspect": 1.0, "orientation": {"yaw": 0.0, "pitch": 0.0, "roll": 0.0}, "positionHint": [0, 0, 11.0], "target": [0, 0, 0], "focalPx": 1406.7084387607667, "note": "All geometry is back-projected through this camera; the fixed review view must use it exactly."}, "approximationNotes": []};
  root.userData.materialPipeline = {"schemaVersion": 1, "status": "proceed", "registry": "img2threejs:docs/materials/material-reference.json", "analysisArtifact": "evidence/material-analysis.json", "targetThreshold": 0.7, "unresolvedNotObservedMaterials": [], "regions": [{"componentId": "panel-front", "regionId": "print", "specMaterialId": "printed-panel", "profileId": "plastic.glossy", "status": "proceed"}, {"componentId": "panel-glass", "regionId": "glass", "specMaterialId": "glass", "profileId": "glass.clear", "status": "proceed"}, {"componentId": "panel-front-rim", "regionId": "rim", "specMaterialId": "panel-rim-cyan", "profileId": "plastic.glossy", "status": "proceed"}, {"componentId": "panel-glass-rim", "regionId": "rim", "specMaterialId": "panel-rim-white", "profileId": "glass.clear", "status": "proceed"}, {"componentId": "panel-middle-rim", "regionId": "rim", "specMaterialId": "panel-rim-red", "profileId": "plastic.glossy", "status": "proceed"}, {"componentId": "panel-back-rim", "regionId": "rim", "specMaterialId": "panel-rim-sky", "profileId": "plastic.glossy", "status": "proceed"}, {"componentId": "glyph-4", "regionId": "cap", "specMaterialId": "glyph-4-gloss", "profileId": "plastic.glossy", "status": "proceed"}, {"componentId": "glyph-d", "regionId": "cap", "specMaterialId": "glyph-d-gloss", "profileId": "plastic.glossy", "status": "proceed"}, {"componentId": "glyph-4", "regionId": "clearcoat", "specMaterialId": "glyph-gloss", "profileId": "plastic.glossy", "status": "proceed"}, {"componentId": "sphere-01", "regionId": "sphere", "specMaterialId": "sphere-blue", "profileId": "plastic.glossy", "status": "proceed"}, {"componentId": "sphere-08", "regionId": "sphere", "specMaterialId": "sphere-red", "profileId": "plastic.glossy", "status": "proceed"}, {"componentId": "sphere-09", "regionId": "sphere", "specMaterialId": "sphere-violet", "profileId": "plastic.glossy", "status": "proceed"}, {"componentId": "sphere-05", "regionId": "gloss", "specMaterialId": "sphere-gloss", "profileId": "plastic.glossy", "status": "proceed"}], "controlledViewsRequired": ["backlight-transmission", "environment-reflection", "grazing", "neutral-studio", "reference-beauty"]};
  root.userData.materialReferenceRegistry = "img2threejs:docs/materials/material-reference.json";

  const materialMap: Record<string, THREE.Material> = {};
  materialMap["printed-panel"] = createSculptMaterial(
    "printed-panel",
    {"id": "printed-panel", "name": "Printed glossy panel", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#1060E0", "color": "#1060E0", "albedo": {"dominant": "#1060E0", "secondary": ["#D00018", "#0B4E7C"], "samplingNotes": "Albedo is the reference image projected through the reference camera (panel-texture.png)."}, "colorVariation": {"palette": ["#1060E0", "#D00018", "#0B4E7C"], "pattern": "gradient", "amplitude": 0.3, "heightCorrelation": 0.0}, "textureResolution": 1024, "textureProjection": {"mode": "reference-camera-projection", "image": "panel-texture.png", "repeat": [1.0, 1.0], "anisotropy": 8, "texelDensityIntent": "UV = reference pixel of each vertex; exact match from the reference camera."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.0, "amplitude": 0.3, "role": "gradient stops"}, {"id": "meso", "frequency": 6.0, "amplitude": 0.1, "role": "specular bands"}, {"id": "micro", "frequency": 40.0, "amplitude": 0.02, "role": "clearcoat sparkle"}], "roughness": {"base": 0.28, "variation": 0.05, "map": "uniform", "localResponse": "glossy dielectric"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "none", "strength": 0.0, "scale": 1.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.1, "contactShadowBias": 0.1, "notes": "graphic emblem, minimal AO"}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "printed-panel-projected-reference", "region": "panel faces", "channel": "albedo", "source": "panel-texture.png"}], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Albedo is the reference image projected through the reference camera (panel-texture.png).", "physical": {"clearcoat": 0.6, "clearcoatRoughness": 0.2}, "referenceMaterialId": "plastic.glossy", "materialFamily": "plastic", "materialSubtype": "generic-polymer", "materialFinish": "glossy", "materialReference": {"registry": "img2threejs:docs/materials/material-reference.json", "profileId": "plastic.glossy", "method": "family-subtype-finish", "confidence": 0.829, "sourceRefs": ["three.mesh-physical", "three.mesh-standard", "adobe.pbr-guide-1", "google.filament-pbr", "mit.material-recognition"], "requiredMaps": ["map", "roughnessMap"], "optionalMaps": ["normalMap", "clearcoatMap"], "validationViews": ["neutral-studio", "grazing", "environment-reflection", "reference-beauty"]}, "clearcoat": {"base": 0.2, "variation": 0.0}, "clearcoatRoughness": {"base": 0.18, "variation": 0.0}, "ior": {"base": 1.5, "variation": 0.0}, "referencePbr": {"version": "1.0", "sourceImage": "evidence/material-evidence/00-print.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence with de-lighting estimate; not photogrammetry", "usable": true, "verdict": "pass", "confidence": 0.829, "estimatedFidelity": 0.829, "targetThreshold": 0.7, "hardLimit": "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", "maps": {"albedo": {"path": "evidence/material-evidence/pbr-00-print/printed-panel_albedo.png", "url": "maps/printed-panel_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}, "roughness": {"path": "evidence/material-evidence/pbr-00-print/printed-panel_roughness.png", "url": "maps/printed-panel_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "evidence/material-evidence/pbr-00-print/printed-panel_height.png", "url": "maps/printed-panel_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "evidence/material-evidence/pbr-00-print/printed-panel_normal.png", "url": "maps/printed-panel_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "evidence/material-evidence/pbr-00-print/printed-panel_ao.png", "url": "maps/printed-panel_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}}, "diagnostics": {"sourceWidth": 200, "sourceHeight": 220, "mapSize": 512, "cropBBoxPixels": {"x": 0, "y": 0, "width": 200, "height": 220}, "mask": {"backgroundColor": "#0059EE", "backgroundNoise": 131.187, "transparentPixelFraction": 0.0, "foregroundCoverage": 0.9971}, "mapStats": {"valueRange": 0.6338, "heightP90Gradient": 0.06076, "roughnessBase": 0.715, "roughnessVariation": 0.108, "normalStrength": 0.227, "blurRadius": 10}, "palette": ["#02A2FB", "#20CCFB", "#0065F3", "#56E6FB", "#0032BA"]}, "warnings": ["image is not clearly isolated from background; using most pixels as material evidence", "object/background separation is weak", "single-image inverse rendering cannot prove true physical PBR; confidence is capped"]}, "textureAnalysis": {"finishClass": "candy-coat", "recipe": {"metalness": 0.35, "roughness": 0.18, "clearcoat": 0.6, "clearcoatRoughness": 0.15, "transmission": 0.0, "ior": 1.5, "envMapIntensity": 0.7, "anisotropy": 0.0, "procedural": "gradient-smoke"}, "palette": ["#45D1FA", "#1DB4F6", "#0B8CEC", "#0186EB", "#0058E1"], "paletteHueRisk": [{"stop": "#1DB4F6", "hueRisk": "blue-collapse", "suggestedRgb": [246, 180, 29]}, {"stop": "#0B8CEC", "hueRisk": "blue-collapse", "suggestedRgb": [236, 140, 11]}, {"stop": "#0186EB", "hueRisk": "blue-collapse", "suggestedRgb": [235, 134, 1]}, {"stop": "#0058E1", "hueRisk": "blue-collapse", "suggestedRgb": [225, 88, 0]}], "gradientAxis": "horizontal", "stats": {"meanLum": 125.7, "meanSaturation": 0.905, "gradientStrength": 0.396, "mottle": 0.043, "streakRatio": 0.87, "hueSpread": 0.025, "specularFraction": 0.003}}, "materialEvidence": {"componentId": "panel-front", "regionId": "print", "crop": {"path": "evidence/material-evidence/00-print.png", "bbox": {"x": 110, "y": 420, "width": 200, "height": 220}, "sourceWidth": 1024, "sourceHeight": 1024, "loaderWarnings": [], "coverage": 0.042}, "observations": ["chromatic base-colour response", "visible meso/micro variation", "strong image-space gradient; verify it is material pattern, not lighting", "single-image PBR inference requires controlled render validation"], "hypothesis": {"componentId": "panel-front", "regionId": "print", "materialId": null, "family": "plastic", "subtype": "generic-polymer", "finish": "glossy", "aliases": [], "confidence": 0.829, "source": "vision"}, "alternatives": []}},
    options
  );
  materialMap["glass"] = createSculptMaterial(
    "glass",
    {"id": "glass", "name": "Glass panel", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#CFF6FF", "color": "#CFF6FF", "albedo": {"dominant": "#CFF6FF", "secondary": ["#FFFFFF"], "samplingNotes": "Low-opacity glass slab; no caustics."}, "colorVariation": {"palette": ["#CFF6FF", "#FFFFFF"], "pattern": "gradient", "amplitude": 0.3, "heightCorrelation": 0.0}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.0, "amplitude": 0.3, "role": "gradient stops"}, {"id": "meso", "frequency": 6.0, "amplitude": 0.1, "role": "specular bands"}, {"id": "micro", "frequency": 40.0, "amplitude": 0.02, "role": "clearcoat sparkle"}], "roughness": {"base": 0.05, "variation": 0.05, "map": "uniform", "localResponse": "glossy dielectric"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "none", "strength": 0.0, "scale": 1.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.1, "contactShadowBias": 0.1, "notes": "graphic emblem, minimal AO"}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Low-opacity glass slab; no caustics.", "physical": {"transmission": 0.0, "clearcoat": 1.0, "clearcoatRoughness": 0.05}, "opacity": 0.14, "transparent": true, "referenceMaterialId": "glass.clear", "materialFamily": "glass", "materialSubtype": "clear", "materialFinish": "polished", "materialReference": {"registry": "img2threejs:docs/materials/material-reference.json", "profileId": "glass.clear", "method": "family-subtype-finish", "confidence": 0.829, "sourceRefs": ["three.mesh-physical", "three.pmrem", "gltf.2", "khronos.transmission", "khronos.volume", "google.filament-pbr"], "requiredMaps": ["roughnessMap", "thicknessMap"], "optionalMaps": ["map", "normalMap", "transmissionMap"], "validationViews": ["neutral-studio", "environment-reflection", "backlight-transmission", "reference-beauty"]}, "transmission": {"base": 1.0, "variation": 0.0}, "ior": {"base": 1.5, "variation": 0.0}, "referencePbr": {"version": "1.0", "sourceImage": "evidence/material-evidence/01-glass.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence with de-lighting estimate; not photogrammetry", "usable": true, "verdict": "pass", "confidence": 0.829, "estimatedFidelity": 0.829, "targetThreshold": 0.7, "hardLimit": "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", "maps": {"albedo": {"path": "evidence/material-evidence/pbr-01-glass/glass_albedo.png", "url": "maps/glass_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}, "roughness": {"path": "evidence/material-evidence/pbr-01-glass/glass_roughness.png", "url": "maps/glass_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "evidence/material-evidence/pbr-01-glass/glass_height.png", "url": "maps/glass_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "evidence/material-evidence/pbr-01-glass/glass_normal.png", "url": "maps/glass_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "evidence/material-evidence/pbr-01-glass/glass_ao.png", "url": "maps/glass_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}}, "diagnostics": {"sourceWidth": 70, "sourceHeight": 280, "mapSize": 512, "cropBBoxPixels": {"x": 0, "y": 0, "width": 70, "height": 280}, "mask": {"backgroundColor": "#5C4CBC", "backgroundNoise": 152.315, "transparentPixelFraction": 0.0, "foregroundCoverage": 0.9933}, "mapStats": {"valueRange": 0.505, "heightP90Gradient": 0.12067, "roughnessBase": 0.752, "roughnessVariation": 0.19, "normalStrength": 0.298, "blurRadius": 10}, "palette": ["#C94E99", "#B02566", "#6E338B", "#6F0C40", "#E77CC1"]}, "warnings": ["image is not clearly isolated from background; using most pixels as material evidence", "object/background separation is weak", "single-image inverse rendering cannot prove true physical PBR; confidence is capped"]}, "textureAnalysis": {"finishClass": "candy-coat", "recipe": {"metalness": 0.35, "roughness": 0.18, "clearcoat": 0.6, "clearcoatRoughness": 0.15, "transmission": 0.0, "ior": 1.5, "envMapIntensity": 0.7, "anisotropy": 0.0, "procedural": "gradient-smoke"}, "palette": ["#782B4C", "#D44B86", "#DD73BA", "#963D92", "#4D287C"], "paletteHueRisk": [{"stop": "#4D287C", "hueRisk": "blue-collapse", "suggestedRgb": [124, 40, 77]}], "gradientAxis": "vertical", "stats": {"meanLum": 100.7, "meanSaturation": 0.682, "gradientStrength": 0.378, "mottle": 0.045, "streakRatio": 0.56, "hueSpread": 0.077, "specularFraction": 0.005}}, "materialEvidence": {"componentId": "panel-glass", "regionId": "glass", "crop": {"path": "evidence/material-evidence/01-glass.png", "bbox": {"x": 362, "y": 380, "width": 70, "height": 280}, "sourceWidth": 1024, "sourceHeight": 1024, "loaderWarnings": [], "coverage": 0.0187}, "observations": ["chromatic base-colour response", "visible meso/micro variation", "strong image-space gradient; verify it is material pattern, not lighting", "single-image PBR inference requires controlled render validation"], "hypothesis": {"componentId": "panel-glass", "regionId": "glass", "materialId": null, "family": "glass", "subtype": "clear", "finish": "polished", "aliases": [], "confidence": 0.829, "source": "vision"}, "alternatives": []}, "needsEnvironment": true},
    options
  );
  materialMap["panel-rim-cyan"] = createSculptMaterial(
    "panel-rim-cyan",
    {"id": "panel-rim-cyan", "name": "Cyan rim glow", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#7FE3FF", "color": "#7FE3FF", "albedo": {"dominant": "#7FE3FF", "secondary": ["#1E9BFF"], "samplingNotes": "Emissive rim frame."}, "colorVariation": {"palette": ["#7FE3FF", "#1E9BFF"], "pattern": "gradient", "amplitude": 0.3, "heightCorrelation": 0.0}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.0, "amplitude": 0.3, "role": "gradient stops"}, {"id": "meso", "frequency": 6.0, "amplitude": 0.1, "role": "specular bands"}, {"id": "micro", "frequency": 40.0, "amplitude": 0.02, "role": "clearcoat sparkle"}], "roughness": {"base": 0.28, "variation": 0.05, "map": "uniform", "localResponse": "glossy dielectric"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "none", "strength": 0.0, "scale": 1.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.1, "contactShadowBias": 0.1, "notes": "graphic emblem, minimal AO"}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Emissive rim frame.", "emissive": {"color": "#2FB8FF", "intensity": 1.6}, "referenceMaterialId": "plastic.glossy", "materialFamily": "plastic", "materialSubtype": "generic-polymer", "materialFinish": "glossy", "materialReference": {"registry": "img2threejs:docs/materials/material-reference.json", "profileId": "plastic.glossy", "method": "family-subtype-finish", "confidence": 0.829, "sourceRefs": ["three.mesh-physical", "three.mesh-standard", "adobe.pbr-guide-1", "google.filament-pbr", "mit.material-recognition"], "requiredMaps": ["map", "roughnessMap"], "optionalMaps": ["normalMap", "clearcoatMap"], "validationViews": ["neutral-studio", "grazing", "environment-reflection", "reference-beauty"]}, "clearcoat": {"base": 0.2, "variation": 0.0}, "clearcoatRoughness": {"base": 0.18, "variation": 0.0}, "ior": {"base": 1.5, "variation": 0.0}, "referencePbr": {"version": "1.0", "sourceImage": "evidence/material-evidence/02-rim.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence with de-lighting estimate; not photogrammetry", "usable": true, "verdict": "pass", "confidence": 0.829, "estimatedFidelity": 0.829, "targetThreshold": 0.7, "hardLimit": "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", "maps": {"albedo": {"path": "evidence/material-evidence/pbr-02-rim/panel-rim-cyan_albedo.png", "url": "maps/panel-rim-cyan_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}, "roughness": {"path": "evidence/material-evidence/pbr-02-rim/panel-rim-cyan_roughness.png", "url": "maps/panel-rim-cyan_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "evidence/material-evidence/pbr-02-rim/panel-rim-cyan_height.png", "url": "maps/panel-rim-cyan_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "evidence/material-evidence/pbr-02-rim/panel-rim-cyan_normal.png", "url": "maps/panel-rim-cyan_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "evidence/material-evidence/pbr-02-rim/panel-rim-cyan_ao.png", "url": "maps/panel-rim-cyan_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}}, "diagnostics": {"sourceWidth": 12, "sourceHeight": 300, "mapSize": 512, "cropBBoxPixels": {"x": 0, "y": 0, "width": 12, "height": 300}, "mask": {"backgroundColor": "#75F9FA", "backgroundNoise": 120.768, "transparentPixelFraction": 0.0, "foregroundCoverage": 0.9356}, "mapStats": {"valueRange": 0.5353, "heightP90Gradient": 0.04987, "roughnessBase": 0.7, "roughnessVariation": 0.095, "normalStrength": 0.215, "blurRadius": 10}, "palette": ["#02A8FB", "#9AF7FB", "#10D6FA", "#5AE0FB", "#0471F8"]}, "warnings": ["image is not clearly isolated from background; using most pixels as material evidence", "object/background separation is weak", "single-image inverse rendering cannot prove true physical PBR; confidence is capped"]}, "textureAnalysis": {"finishClass": "painted-metal", "recipe": {"metalness": 0.0, "roughness": 0.5, "clearcoat": 1.0, "clearcoatRoughness": 0.05, "transmission": 0.0, "ior": 1.5, "envMapIntensity": 1.0, "anisotropy": 0.0, "procedural": "flat-clearcoat"}, "palette": ["#04BDF8", "#01A7FE", "#2EA8F9", "#93F7FA", "#47E2FA"], "paletteHueRisk": [{"stop": "#04BDF8", "hueRisk": "blue-collapse", "suggestedRgb": [248, 189, 4]}, {"stop": "#01A7FE", "hueRisk": "blue-collapse", "suggestedRgb": [254, 167, 1]}, {"stop": "#2EA8F9", "hueRisk": "blue-collapse", "suggestedRgb": [249, 168, 46]}], "gradientAxis": "horizontal", "stats": {"meanLum": 163.7, "meanSaturation": 0.75, "gradientStrength": 0.419, "mottle": 0.013, "streakRatio": 0.49, "hueSpread": 0.018, "specularFraction": 0.063}}, "materialEvidence": {"componentId": "panel-front-rim", "regionId": "rim", "crop": {"path": "evidence/material-evidence/02-rim.png", "bbox": {"x": 84, "y": 330, "width": 12, "height": 300}, "sourceWidth": 1024, "sourceHeight": 1024, "loaderWarnings": [], "coverage": 0.0034}, "observations": ["chromatic base-colour response", "directional surface frequency", "strong image-space gradient; verify it is material pattern, not lighting", "single-image PBR inference requires controlled render validation"], "hypothesis": {"componentId": "panel-front-rim", "regionId": "rim", "materialId": null, "family": "plastic", "subtype": "generic-polymer", "finish": "glossy", "aliases": [], "confidence": 0.829, "source": "vision"}, "alternatives": []}},
    options
  );
  materialMap["panel-rim-white"] = createSculptMaterial(
    "panel-rim-white",
    {"id": "panel-rim-white", "name": "Glass rim", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#E8FDFF", "color": "#E8FDFF", "albedo": {"dominant": "#E8FDFF", "secondary": ["#9EEBFF"], "samplingNotes": "Bright thin glass edge."}, "colorVariation": {"palette": ["#E8FDFF", "#9EEBFF"], "pattern": "gradient", "amplitude": 0.3, "heightCorrelation": 0.0}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.0, "amplitude": 0.3, "role": "gradient stops"}, {"id": "meso", "frequency": 6.0, "amplitude": 0.1, "role": "specular bands"}, {"id": "micro", "frequency": 40.0, "amplitude": 0.02, "role": "clearcoat sparkle"}], "roughness": {"base": 0.05, "variation": 0.05, "map": "uniform", "localResponse": "glossy dielectric"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "none", "strength": 0.0, "scale": 1.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.1, "contactShadowBias": 0.1, "notes": "graphic emblem, minimal AO"}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Bright thin glass edge.", "emissive": {"color": "#9EEBFF", "intensity": 1.0}, "referenceMaterialId": "glass.clear", "materialFamily": "glass", "materialSubtype": "clear", "materialFinish": "polished", "materialReference": {"registry": "img2threejs:docs/materials/material-reference.json", "profileId": "glass.clear", "method": "family-subtype-finish", "confidence": 0.829, "sourceRefs": ["three.mesh-physical", "three.pmrem", "gltf.2", "khronos.transmission", "khronos.volume", "google.filament-pbr"], "requiredMaps": ["roughnessMap", "thicknessMap"], "optionalMaps": ["map", "normalMap", "transmissionMap"], "validationViews": ["neutral-studio", "environment-reflection", "backlight-transmission", "reference-beauty"]}, "transmission": {"base": 1.0, "variation": 0.0}, "ior": {"base": 1.5, "variation": 0.0}, "referencePbr": {"version": "1.0", "sourceImage": "evidence/material-evidence/03-rim.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence with de-lighting estimate; not photogrammetry", "usable": true, "verdict": "pass", "confidence": 0.829, "estimatedFidelity": 0.829, "targetThreshold": 0.7, "hardLimit": "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", "maps": {"albedo": {"path": "evidence/material-evidence/pbr-03-rim/panel-rim-white_albedo.png", "url": "maps/panel-rim-white_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}, "roughness": {"path": "evidence/material-evidence/pbr-03-rim/panel-rim-white_roughness.png", "url": "maps/panel-rim-white_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "evidence/material-evidence/pbr-03-rim/panel-rim-white_height.png", "url": "maps/panel-rim-white_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "evidence/material-evidence/pbr-03-rim/panel-rim-white_normal.png", "url": "maps/panel-rim-white_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "evidence/material-evidence/pbr-03-rim/panel-rim-white_ao.png", "url": "maps/panel-rim-white_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}}, "diagnostics": {"sourceWidth": 10, "sourceHeight": 250, "mapSize": 512, "cropBBoxPixels": {"x": 0, "y": 0, "width": 10, "height": 250}, "mask": {"backgroundColor": "#0BCDF9", "backgroundNoise": 199.935, "transparentPixelFraction": 0.0, "foregroundCoverage": 0.9992}, "mapStats": {"valueRange": 0.6877, "heightP90Gradient": 0.03565, "roughnessBase": 0.698, "roughnessVariation": 0.07, "normalStrength": 0.198, "blurRadius": 10}, "palette": ["#0774F8", "#12C0FA", "#84DCFB", "#042ABF", "#6597EC"]}, "warnings": ["image is not clearly isolated from background; using most pixels as material evidence", "object/background separation is weak", "single-image inverse rendering cannot prove true physical PBR; confidence is capped"]}, "textureAnalysis": {"finishClass": "painted-metal", "recipe": {"metalness": 0.0, "roughness": 0.5, "clearcoat": 1.0, "clearcoatRoughness": 0.05, "transmission": 0.0, "ior": 1.5, "envMapIntensity": 1.0, "anisotropy": 0.0, "procedural": "flat-clearcoat"}, "palette": ["#2538A3", "#2749D3", "#1EA6FA", "#2CBBF9", "#3DDCFA"], "paletteHueRisk": [{"stop": "#2538A3", "hueRisk": "blue-collapse", "suggestedRgb": [163, 56, 37]}, {"stop": "#2749D3", "hueRisk": "blue-collapse", "suggestedRgb": [211, 73, 39]}, {"stop": "#1EA6FA", "hueRisk": "blue-collapse", "suggestedRgb": [250, 166, 30]}, {"stop": "#2CBBF9", "hueRisk": "blue-collapse", "suggestedRgb": [249, 187, 44]}], "gradientAxis": "vertical", "stats": {"meanLum": 123.7, "meanSaturation": 0.838, "gradientStrength": 0.445, "mottle": 0.012, "streakRatio": 0.31, "hueSpread": 0.03, "specularFraction": 0.0}}, "materialEvidence": {"componentId": "panel-glass-rim", "regionId": "rim", "crop": {"path": "evidence/material-evidence/03-rim.png", "bbox": {"x": 244, "y": 330, "width": 10, "height": 250}, "sourceWidth": 1024, "sourceHeight": 1024, "loaderWarnings": [], "coverage": 0.0024}, "observations": ["chromatic base-colour response", "directional surface frequency", "strong image-space gradient; verify it is material pattern, not lighting", "single-image PBR inference requires controlled render validation"], "hypothesis": {"componentId": "panel-glass-rim", "regionId": "rim", "materialId": null, "family": "glass", "subtype": "clear", "finish": "polished", "aliases": [], "confidence": 0.829, "source": "vision"}, "alternatives": []}, "needsEnvironment": true},
    options
  );
  materialMap["panel-rim-red"] = createSculptMaterial(
    "panel-rim-red",
    {"id": "panel-rim-red", "name": "Red rim glow", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#FF5A5A", "color": "#FF5A5A", "albedo": {"dominant": "#FF5A5A", "secondary": ["#FF2A2A"], "samplingNotes": "Emissive rim frame."}, "colorVariation": {"palette": ["#FF5A5A", "#FF2A2A"], "pattern": "gradient", "amplitude": 0.3, "heightCorrelation": 0.0}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.0, "amplitude": 0.3, "role": "gradient stops"}, {"id": "meso", "frequency": 6.0, "amplitude": 0.1, "role": "specular bands"}, {"id": "micro", "frequency": 40.0, "amplitude": 0.02, "role": "clearcoat sparkle"}], "roughness": {"base": 0.28, "variation": 0.05, "map": "uniform", "localResponse": "glossy dielectric"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "none", "strength": 0.0, "scale": 1.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.1, "contactShadowBias": 0.1, "notes": "graphic emblem, minimal AO"}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Emissive rim frame.", "emissive": {"color": "#FF2030", "intensity": 1.4}, "referenceMaterialId": "plastic.glossy", "materialFamily": "plastic", "materialSubtype": "generic-polymer", "materialFinish": "glossy", "materialReference": {"registry": "img2threejs:docs/materials/material-reference.json", "profileId": "plastic.glossy", "method": "family-subtype-finish", "confidence": 0.829, "sourceRefs": ["three.mesh-physical", "three.mesh-standard", "adobe.pbr-guide-1", "google.filament-pbr", "mit.material-recognition"], "requiredMaps": ["map", "roughnessMap"], "optionalMaps": ["normalMap", "clearcoatMap"], "validationViews": ["neutral-studio", "grazing", "environment-reflection", "reference-beauty"]}, "clearcoat": {"base": 0.2, "variation": 0.0}, "clearcoatRoughness": {"base": 0.18, "variation": 0.0}, "ior": {"base": 1.5, "variation": 0.0}, "referencePbr": {"version": "1.0", "sourceImage": "evidence/material-evidence/04-rim.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence with de-lighting estimate; not photogrammetry", "usable": true, "verdict": "pass", "confidence": 0.829, "estimatedFidelity": 0.829, "targetThreshold": 0.7, "hardLimit": "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", "maps": {"albedo": {"path": "evidence/material-evidence/pbr-04-rim/panel-rim-red_albedo.png", "url": "maps/panel-rim-red_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}, "roughness": {"path": "evidence/material-evidence/pbr-04-rim/panel-rim-red_roughness.png", "url": "maps/panel-rim-red_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "evidence/material-evidence/pbr-04-rim/panel-rim-red_height.png", "url": "maps/panel-rim-red_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "evidence/material-evidence/pbr-04-rim/panel-rim-red_normal.png", "url": "maps/panel-rim-red_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "evidence/material-evidence/pbr-04-rim/panel-rim-red_ao.png", "url": "maps/panel-rim-red_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}}, "diagnostics": {"sourceWidth": 10, "sourceHeight": 300, "mapSize": 512, "cropBBoxPixels": {"x": 0, "y": 0, "width": 10, "height": 300}, "mask": {"backgroundColor": "#E21B5E", "backgroundNoise": 142.99, "transparentPixelFraction": 0.0, "foregroundCoverage": 0.9403}, "mapStats": {"valueRange": 0.5876, "heightP90Gradient": 0.07717, "roughnessBase": 0.701, "roughnessVariation": 0.129, "normalStrength": 0.247, "blurRadius": 10}, "palette": ["#E90919", "#F01E44", "#F3A39F", "#26549A", "#B83B72"]}, "warnings": ["image is not clearly isolated from background; using most pixels as material evidence", "object/background separation is weak", "single-image inverse rendering cannot prove true physical PBR; confidence is capped"]}, "textureAnalysis": {"finishClass": "painted-metal", "recipe": {"metalness": 0.0, "roughness": 0.5, "clearcoat": 1.0, "clearcoatRoughness": 0.05, "transmission": 0.0, "ior": 1.5, "envMapIntensity": 1.0, "anisotropy": 0.0, "procedural": "flat-clearcoat"}, "palette": ["#F03E43", "#F2494D", "#DF646D", "#D4133E", "#9F0D77"], "paletteHueRisk": [], "gradientAxis": "vertical", "stats": {"meanLum": 112.4, "meanSaturation": 0.741, "gradientStrength": 0.574, "mottle": 0.014, "streakRatio": 0.31, "hueSpread": 0.209, "specularFraction": 0.044}}, "materialEvidence": {"componentId": "panel-middle-rim", "regionId": "rim", "crop": {"path": "evidence/material-evidence/04-rim.png", "bbox": {"x": 512, "y": 200, "width": 10, "height": 300}, "sourceWidth": 1024, "sourceHeight": 1024, "loaderWarnings": [], "coverage": 0.0029}, "observations": ["chromatic base-colour response", "directional surface frequency", "strong image-space gradient; verify it is material pattern, not lighting", "single-image PBR inference requires controlled render validation"], "hypothesis": {"componentId": "panel-middle-rim", "regionId": "rim", "materialId": null, "family": "plastic", "subtype": "generic-polymer", "finish": "glossy", "aliases": [], "confidence": 0.829, "source": "vision"}, "alternatives": []}},
    options
  );
  materialMap["panel-rim-sky"] = createSculptMaterial(
    "panel-rim-sky",
    {"id": "panel-rim-sky", "name": "Sky rim glow", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#6CCBFF", "color": "#6CCBFF", "albedo": {"dominant": "#6CCBFF", "secondary": ["#2AA8FF"], "samplingNotes": "Emissive rim frame."}, "colorVariation": {"palette": ["#6CCBFF", "#2AA8FF"], "pattern": "gradient", "amplitude": 0.3, "heightCorrelation": 0.0}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.0, "amplitude": 0.3, "role": "gradient stops"}, {"id": "meso", "frequency": 6.0, "amplitude": 0.1, "role": "specular bands"}, {"id": "micro", "frequency": 40.0, "amplitude": 0.02, "role": "clearcoat sparkle"}], "roughness": {"base": 0.28, "variation": 0.05, "map": "uniform", "localResponse": "glossy dielectric"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "none", "strength": 0.0, "scale": 1.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.1, "contactShadowBias": 0.1, "notes": "graphic emblem, minimal AO"}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Emissive rim frame.", "emissive": {"color": "#1E90FF", "intensity": 1.3}, "referenceMaterialId": "plastic.glossy", "materialFamily": "plastic", "materialSubtype": "generic-polymer", "materialFinish": "glossy", "materialReference": {"registry": "img2threejs:docs/materials/material-reference.json", "profileId": "plastic.glossy", "method": "family-subtype-finish", "confidence": 0.829, "sourceRefs": ["three.mesh-physical", "three.mesh-standard", "adobe.pbr-guide-1", "google.filament-pbr", "mit.material-recognition"], "requiredMaps": ["map", "roughnessMap"], "optionalMaps": ["normalMap", "clearcoatMap"], "validationViews": ["neutral-studio", "grazing", "environment-reflection", "reference-beauty"]}, "clearcoat": {"base": 0.2, "variation": 0.0}, "clearcoatRoughness": {"base": 0.18, "variation": 0.0}, "ior": {"base": 1.5, "variation": 0.0}, "referencePbr": {"version": "1.0", "sourceImage": "evidence/material-evidence/05-rim.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence with de-lighting estimate; not photogrammetry", "usable": true, "verdict": "pass", "confidence": 0.829, "estimatedFidelity": 0.829, "targetThreshold": 0.7, "hardLimit": "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", "maps": {"albedo": {"path": "evidence/material-evidence/pbr-05-rim/panel-rim-sky_albedo.png", "url": "maps/panel-rim-sky_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}, "roughness": {"path": "evidence/material-evidence/pbr-05-rim/panel-rim-sky_roughness.png", "url": "maps/panel-rim-sky_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "evidence/material-evidence/pbr-05-rim/panel-rim-sky_height.png", "url": "maps/panel-rim-sky_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "evidence/material-evidence/pbr-05-rim/panel-rim-sky_normal.png", "url": "maps/panel-rim-sky_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "evidence/material-evidence/pbr-05-rim/panel-rim-sky_ao.png", "url": "maps/panel-rim-sky_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}}, "diagnostics": {"sourceWidth": 8, "sourceHeight": 200, "mapSize": 512, "cropBBoxPixels": {"x": 0, "y": 0, "width": 8, "height": 200}, "mask": {"backgroundColor": "#0093E6", "backgroundNoise": 96.104, "transparentPixelFraction": 0.0, "foregroundCoverage": 1.0}, "mapStats": {"valueRange": 0.5889, "heightP90Gradient": 0.05839, "roughnessBase": 0.7, "roughnessVariation": 0.115, "normalStrength": 0.225, "blurRadius": 10}, "palette": ["#0362B7", "#118BDB", "#003B9C", "#012246", "#0ED6F6"]}, "warnings": ["image is not clearly isolated from background; using most pixels as material evidence", "object/background separation is weak", "single-image inverse rendering cannot prove true physical PBR; confidence is capped"]}, "textureAnalysis": {"finishClass": "painted-metal", "recipe": {"metalness": 0.0, "roughness": 0.5, "clearcoat": 1.0, "clearcoatRoughness": 0.05, "transmission": 0.0, "ior": 1.5, "envMapIntensity": 1.0, "anisotropy": 0.0, "procedural": "flat-clearcoat"}, "palette": ["#015986", "#077ACA", "#0763BB", "#206DC2", "#00B6E6"], "paletteHueRisk": [{"stop": "#015986", "hueRisk": "blue-collapse", "suggestedRgb": [134, 89, 1]}, {"stop": "#077ACA", "hueRisk": "blue-collapse", "suggestedRgb": [202, 122, 7]}, {"stop": "#0763BB", "hueRisk": "blue-collapse", "suggestedRgb": [187, 99, 7]}, {"stop": "#206DC2", "hueRisk": "blue-collapse", "suggestedRgb": [194, 109, 32]}], "gradientAxis": "vertical", "stats": {"meanLum": 83.2, "meanSaturation": 0.967, "gradientStrength": 0.341, "mottle": 0.006, "streakRatio": 0.14, "hueSpread": 0.013, "specularFraction": 0.0}}, "materialEvidence": {"componentId": "panel-back-rim", "regionId": "rim", "crop": {"path": "evidence/material-evidence/05-rim.png", "bbox": {"x": 639, "y": 240, "width": 8, "height": 200}, "sourceWidth": 1024, "sourceHeight": 1024, "loaderWarnings": [], "coverage": 0.0015}, "observations": ["chromatic base-colour response", "directional surface frequency", "strong image-space gradient; verify it is material pattern, not lighting", "single-image PBR inference requires controlled render validation"], "hypothesis": {"componentId": "panel-back-rim", "regionId": "rim", "materialId": null, "family": "plastic", "subtype": "generic-polymer", "finish": "glossy", "aliases": [], "confidence": 0.829, "source": "vision"}, "alternatives": []}},
    options
  );
  materialMap["glyph-4-gloss"] = createSculptMaterial(
    "glyph-4-gloss",
    {"id": "glyph-4-gloss", "name": "Glyph 4 glossy gradient", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#00A0FA", "color": "#00A0FA", "albedo": {"dominant": "#00A0FA", "secondary": ["#5AFAFB", "#005AE6", "#FFAA78"], "samplingNotes": "Front cap: reference projection; walls: vertical gradient cyan->blue->peach."}, "colorVariation": {"palette": ["#00A0FA", "#5AFAFB", "#005AE6", "#FFAA78"], "pattern": "gradient", "amplitude": 0.3, "heightCorrelation": 0.0}, "textureResolution": 1024, "textureProjection": {"mode": "reference-camera-projection", "image": "ref.png", "repeat": [1.0, 1.0], "anisotropy": 8, "texelDensityIntent": "UV = reference pixel of each vertex; exact match from the reference camera."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.0, "amplitude": 0.3, "role": "gradient stops"}, {"id": "meso", "frequency": 6.0, "amplitude": 0.1, "role": "specular bands"}, {"id": "micro", "frequency": 40.0, "amplitude": 0.02, "role": "clearcoat sparkle"}], "roughness": {"base": 0.28, "variation": 0.05, "map": "uniform", "localResponse": "glossy dielectric"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "none", "strength": 0.0, "scale": 1.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.1, "contactShadowBias": 0.1, "notes": "graphic emblem, minimal AO"}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "clearcoat", "region": "front cap", "channel": "clearcoat", "value": 1.0}], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Front cap: reference projection; walls: vertical gradient cyan->blue->peach.", "physical": {"clearcoat": 1.0, "clearcoatRoughness": 0.08}, "referenceMaterialId": "plastic.glossy", "materialFamily": "plastic", "materialSubtype": "generic-polymer", "materialFinish": "glossy", "materialReference": {"registry": "img2threejs:docs/materials/material-reference.json", "profileId": "plastic.glossy", "method": "family-subtype-finish", "confidence": 0.774, "sourceRefs": ["three.mesh-physical", "three.mesh-standard", "adobe.pbr-guide-1", "google.filament-pbr", "mit.material-recognition"], "requiredMaps": ["map", "roughnessMap"], "optionalMaps": ["normalMap", "clearcoatMap"], "validationViews": ["neutral-studio", "grazing", "environment-reflection", "reference-beauty"]}, "clearcoat": {"base": 0.2, "variation": 0.0}, "clearcoatRoughness": {"base": 0.18, "variation": 0.0}, "ior": {"base": 1.5, "variation": 0.0}, "referencePbr": {"version": "1.0", "sourceImage": "evidence/material-evidence/06-cap.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence with de-lighting estimate; not photogrammetry", "usable": true, "verdict": "pass", "confidence": 0.774, "estimatedFidelity": 0.774, "targetThreshold": 0.7, "hardLimit": "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", "maps": {"albedo": {"path": "evidence/material-evidence/pbr-06-cap/glyph-4-gloss_albedo.png", "url": "maps/glyph-4-gloss_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}, "roughness": {"path": "evidence/material-evidence/pbr-06-cap/glyph-4-gloss_roughness.png", "url": "maps/glyph-4-gloss_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "evidence/material-evidence/pbr-06-cap/glyph-4-gloss_height.png", "url": "maps/glyph-4-gloss_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "evidence/material-evidence/pbr-06-cap/glyph-4-gloss_normal.png", "url": "maps/glyph-4-gloss_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "evidence/material-evidence/pbr-06-cap/glyph-4-gloss_ao.png", "url": "maps/glyph-4-gloss_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}}, "diagnostics": {"sourceWidth": 60, "sourceHeight": 200, "mapSize": 512, "cropBBoxPixels": {"x": 0, "y": 0, "width": 60, "height": 200}, "mask": {"backgroundColor": "#58B7FB", "backgroundNoise": 86.371, "transparentPixelFraction": 0.0, "foregroundCoverage": 1.0}, "mapStats": {"valueRange": 0.4317, "heightP90Gradient": 0.01403, "roughnessBase": 0.688, "roughnessVariation": 0.05, "normalStrength": 0.173, "blurRadius": 10}, "palette": ["#0578FB", "#029CFB", "#37A7FA", "#5C5EF9", "#53DEFA"]}, "warnings": ["image is not clearly isolated from background; using most pixels as material evidence", "object/background separation is weak", "single-image inverse rendering cannot prove true physical PBR; confidence is capped"]}, "textureAnalysis": {"finishClass": "painted-metal", "recipe": {"metalness": 0.0, "roughness": 0.5, "clearcoat": 1.0, "clearcoatRoughness": 0.05, "transmission": 0.0, "ior": 1.5, "envMapIntensity": 1.0, "anisotropy": 0.0, "procedural": "flat-clearcoat"}, "palette": ["#55E1FA", "#089EFA", "#087DFA", "#4A9DF9", "#6E66FA"], "paletteHueRisk": [{"stop": "#089EFA", "hueRisk": "blue-collapse", "suggestedRgb": [250, 158, 8]}, {"stop": "#087DFA", "hueRisk": "blue-collapse", "suggestedRgb": [250, 125, 8]}, {"stop": "#4A9DF9", "hueRisk": "blue-collapse", "suggestedRgb": [249, 157, 74]}, {"stop": "#6E66FA", "hueRisk": "blue-collapse", "suggestedRgb": [250, 102, 110]}], "gradientAxis": "vertical", "stats": {"meanLum": 126.8, "meanSaturation": 0.849, "gradientStrength": 0.33, "mottle": 0.006, "streakRatio": 0.54, "hueSpread": 0.037, "specularFraction": 0.0}}, "materialEvidence": {"componentId": "glyph-4", "regionId": "cap", "crop": {"path": "evidence/material-evidence/06-cap.png", "bbox": {"x": 610, "y": 500, "width": 60, "height": 200}, "sourceWidth": 1024, "sourceHeight": 1024, "loaderWarnings": [], "coverage": 0.0114}, "observations": ["chromatic base-colour response", "strong image-space gradient; verify it is material pattern, not lighting", "single-image PBR inference requires controlled render validation"], "hypothesis": {"componentId": "glyph-4", "regionId": "cap", "materialId": null, "family": "plastic", "subtype": "generic-polymer", "finish": "glossy", "aliases": [], "confidence": 0.774, "source": "vision"}, "alternatives": []}},
    options
  );
  materialMap["glyph-d-gloss"] = createSculptMaterial(
    "glyph-d-gloss",
    {"id": "glyph-d-gloss", "name": "Glyph D glossy gradient", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#ED2B82", "color": "#ED2B82", "albedo": {"dominant": "#ED2B82", "secondary": ["#5A14E6", "#7211F1", "#FB4B51"], "samplingNotes": "Front cap: reference projection; walls: gradient violet->pink->coral."}, "colorVariation": {"palette": ["#ED2B82", "#5A14E6", "#7211F1", "#FB4B51"], "pattern": "gradient", "amplitude": 0.3, "heightCorrelation": 0.0}, "textureResolution": 1024, "textureProjection": {"mode": "reference-camera-projection", "image": "ref.png", "repeat": [1.0, 1.0], "anisotropy": 8, "texelDensityIntent": "UV = reference pixel of each vertex; exact match from the reference camera."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.0, "amplitude": 0.3, "role": "gradient stops"}, {"id": "meso", "frequency": 6.0, "amplitude": 0.1, "role": "specular bands"}, {"id": "micro", "frequency": 40.0, "amplitude": 0.02, "role": "clearcoat sparkle"}], "roughness": {"base": 0.28, "variation": 0.05, "map": "uniform", "localResponse": "glossy dielectric"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "none", "strength": 0.0, "scale": 1.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.1, "contactShadowBias": 0.1, "notes": "graphic emblem, minimal AO"}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "clearcoat", "region": "front cap", "channel": "clearcoat", "value": 1.0}], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Front cap: reference projection; walls: gradient violet->pink->coral.", "physical": {"clearcoat": 1.0, "clearcoatRoughness": 0.08}, "referenceMaterialId": "plastic.glossy", "materialFamily": "plastic", "materialSubtype": "generic-polymer", "materialFinish": "glossy", "materialReference": {"registry": "img2threejs:docs/materials/material-reference.json", "profileId": "plastic.glossy", "method": "family-subtype-finish", "confidence": 0.72, "sourceRefs": ["three.mesh-physical", "three.mesh-standard", "adobe.pbr-guide-1", "google.filament-pbr", "mit.material-recognition"], "requiredMaps": ["map", "roughnessMap"], "optionalMaps": ["normalMap", "clearcoatMap"], "validationViews": ["neutral-studio", "grazing", "environment-reflection", "reference-beauty"]}, "clearcoat": {"base": 0.2, "variation": 0.0}, "clearcoatRoughness": {"base": 0.18, "variation": 0.0}, "ior": {"base": 1.5, "variation": 0.0}, "referencePbr": {"version": "1.0", "sourceImage": "evidence/material-evidence/07-cap.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence with de-lighting estimate; not photogrammetry", "usable": true, "verdict": "pass", "confidence": 0.72, "estimatedFidelity": 0.72, "targetThreshold": 0.7, "hardLimit": "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", "maps": {"albedo": {"path": "evidence/material-evidence/pbr-07-cap/glyph-d-gloss_albedo.png", "url": "maps/glyph-d-gloss_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}, "roughness": {"path": "evidence/material-evidence/pbr-07-cap/glyph-d-gloss_roughness.png", "url": "maps/glyph-d-gloss_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "evidence/material-evidence/pbr-07-cap/glyph-d-gloss_height.png", "url": "maps/glyph-d-gloss_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "evidence/material-evidence/pbr-07-cap/glyph-d-gloss_normal.png", "url": "maps/glyph-d-gloss_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "evidence/material-evidence/pbr-07-cap/glyph-d-gloss_ao.png", "url": "maps/glyph-d-gloss_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}}, "diagnostics": {"sourceWidth": 45, "sourceHeight": 250, "mapSize": 512, "cropBBoxPixels": {"x": 0, "y": 0, "width": 45, "height": 250}, "mask": {"backgroundColor": "#F85BBD", "backgroundNoise": 86.977, "transparentPixelFraction": 0.0, "foregroundCoverage": 1.0}, "mapStats": {"valueRange": 0.3903, "heightP90Gradient": 0.00882, "roughnessBase": 0.687, "roughnessVariation": 0.05, "normalStrength": 0.167, "blurRadius": 10}, "palette": ["#170DB2", "#F72D75", "#6120C8", "#AE20BA", "#BE58E2"]}, "warnings": ["image is not clearly isolated from background; using most pixels as material evidence", "object/background separation is weak", "single-image inverse rendering cannot prove true physical PBR; confidence is capped", "low high-frequency detail weakens normal/roughness inference"]}, "textureAnalysis": {"finishClass": "painted-metal", "recipe": {"metalness": 0.0, "roughness": 0.5, "clearcoat": 1.0, "clearcoatRoughness": 0.05, "transmission": 0.0, "ior": 1.5, "envMapIntensity": 1.0, "anisotropy": 0.0, "procedural": "flat-clearcoat"}, "palette": ["#E46FE6", "#431EB9", "#2A0FC5", "#D91CA4", "#F9425A"], "paletteHueRisk": [{"stop": "#431EB9", "hueRisk": "blue-collapse", "suggestedRgb": [185, 46, 67]}, {"stop": "#2A0FC5", "hueRisk": "blue-collapse", "suggestedRgb": [197, 49, 42]}], "gradientAxis": "vertical", "stats": {"meanLum": 81.7, "meanSaturation": 0.837, "gradientStrength": 0.521, "mottle": 0.002, "streakRatio": 0.14, "hueSpread": 0.203, "specularFraction": 0.0}}, "materialEvidence": {"componentId": "glyph-d", "regionId": "cap", "crop": {"path": "evidence/material-evidence/07-cap.png", "bbox": {"x": 700, "y": 500, "width": 45, "height": 250}, "sourceWidth": 1024, "sourceHeight": 1024, "loaderWarnings": [], "coverage": 0.0107}, "observations": ["chromatic base-colour response", "directional surface frequency", "strong image-space gradient; verify it is material pattern, not lighting", "single-image PBR inference requires controlled render validation"], "hypothesis": {"componentId": "glyph-d", "regionId": "cap", "materialId": null, "family": "plastic", "subtype": "generic-polymer", "finish": "glossy", "aliases": [], "confidence": 0.72, "source": "vision"}, "alternatives": []}},
    options
  );
  materialMap["sphere-blue"] = createSculptMaterial(
    "sphere-blue",
    {"id": "sphere-blue", "name": "Glossy blue sphere", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#006EF5", "color": "#006EF5", "albedo": {"dominant": "#006EF5", "secondary": ["#5AD2FF"], "samplingNotes": "Glossy dielectric."}, "colorVariation": {"palette": ["#006EF5", "#5AD2FF"], "pattern": "gradient", "amplitude": 0.3, "heightCorrelation": 0.0}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.0, "amplitude": 0.3, "role": "gradient stops"}, {"id": "meso", "frequency": 6.0, "amplitude": 0.1, "role": "specular bands"}, {"id": "micro", "frequency": 40.0, "amplitude": 0.02, "role": "clearcoat sparkle"}], "roughness": {"base": 0.28, "variation": 0.05, "map": "uniform", "localResponse": "glossy dielectric"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "none", "strength": 0.0, "scale": 1.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.1, "contactShadowBias": 0.1, "notes": "graphic emblem, minimal AO"}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "roughness", "region": "whole", "channel": "roughness", "value": 0.1}], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Glossy dielectric.", "physical": {"clearcoat": 1.0, "clearcoatRoughness": 0.05}, "referenceMaterialId": "plastic.glossy", "materialFamily": "plastic", "materialSubtype": "generic-polymer", "materialFinish": "glossy", "materialReference": {"registry": "img2threejs:docs/materials/material-reference.json", "profileId": "plastic.glossy", "method": "family-subtype-finish", "confidence": 0.791, "sourceRefs": ["three.mesh-physical", "three.mesh-standard", "adobe.pbr-guide-1", "google.filament-pbr", "mit.material-recognition"], "requiredMaps": ["map", "roughnessMap"], "optionalMaps": ["normalMap", "clearcoatMap"], "validationViews": ["neutral-studio", "grazing", "environment-reflection", "reference-beauty"]}, "clearcoat": {"base": 0.2, "variation": 0.0}, "clearcoatRoughness": {"base": 0.18, "variation": 0.0}, "ior": {"base": 1.5, "variation": 0.0}, "referencePbr": {"version": "1.0", "sourceImage": "evidence/material-evidence/09-sphere.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence with de-lighting estimate; not photogrammetry", "usable": true, "verdict": "pass", "confidence": 0.791, "estimatedFidelity": 0.791, "targetThreshold": 0.7, "hardLimit": "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", "maps": {"albedo": {"path": "evidence/material-evidence/pbr-09-sphere/sphere-blue_albedo.png", "url": "maps/sphere-blue_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}, "roughness": {"path": "evidence/material-evidence/pbr-09-sphere/sphere-blue_roughness.png", "url": "maps/sphere-blue_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "evidence/material-evidence/pbr-09-sphere/sphere-blue_height.png", "url": "maps/sphere-blue_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "evidence/material-evidence/pbr-09-sphere/sphere-blue_normal.png", "url": "maps/sphere-blue_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "evidence/material-evidence/pbr-09-sphere/sphere-blue_ao.png", "url": "maps/sphere-blue_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}}, "diagnostics": {"sourceWidth": 36, "sourceHeight": 36, "mapSize": 512, "cropBBoxPixels": {"x": 0, "y": 0, "width": 36, "height": 36}, "mask": {"backgroundColor": "#008FFA", "backgroundNoise": 113.071, "transparentPixelFraction": 0.0, "foregroundCoverage": 0.9252}, "mapStats": {"valueRange": 0.8308, "heightP90Gradient": 0.01469, "roughnessBase": 0.696, "roughnessVariation": 0.05, "normalStrength": 0.173, "blurRadius": 10}, "palette": ["#0072FB", "#01B9FB", "#002DF3", "#43F0FB", "#C7FAFB"]}, "warnings": ["image is not clearly isolated from background; using most pixels as material evidence", "object/background separation is weak", "single-image inverse rendering cannot prove true physical PBR; confidence is capped"]}, "textureAnalysis": {"finishClass": "painted-metal", "recipe": {"metalness": 0.0, "roughness": 0.5, "clearcoat": 1.0, "clearcoatRoughness": 0.05, "transmission": 0.0, "ior": 1.5, "envMapIntensity": 1.0, "anisotropy": 0.0, "procedural": "flat-clearcoat"}, "palette": ["#69DCFA", "#7AD6FB", "#1FB6FA", "#006BF8", "#0043F3"], "paletteHueRisk": [{"stop": "#7AD6FB", "hueRisk": "blue-collapse", "suggestedRgb": [251, 214, 122]}, {"stop": "#1FB6FA", "hueRisk": "blue-collapse", "suggestedRgb": [250, 182, 31]}, {"stop": "#006BF8", "hueRisk": "blue-collapse", "suggestedRgb": [248, 107, 0]}, {"stop": "#0043F3", "hueRisk": "blue-collapse", "suggestedRgb": [243, 67, 0]}], "gradientAxis": "vertical", "stats": {"meanLum": 137.9, "meanSaturation": 0.795, "gradientStrength": 0.509, "mottle": 0.009, "streakRatio": 1.02, "hueSpread": 0.043, "specularFraction": 0.125}}, "materialEvidence": {"componentId": "sphere-01", "regionId": "sphere", "crop": {"path": "evidence/material-evidence/09-sphere.png", "bbox": {"x": 652, "y": 412, "width": 36, "height": 36}, "sourceWidth": 1024, "sourceHeight": 1024, "loaderWarnings": [], "coverage": 0.0012}, "observations": ["chromatic base-colour response", "strong image-space gradient; verify it is material pattern, not lighting", "single-image PBR inference requires controlled render validation"], "hypothesis": {"componentId": "sphere-01", "regionId": "sphere", "materialId": null, "family": "plastic", "subtype": "generic-polymer", "finish": "glossy", "aliases": [], "confidence": 0.791, "source": "vision"}, "alternatives": []}},
    options
  );
  materialMap["sphere-red"] = createSculptMaterial(
    "sphere-red",
    {"id": "sphere-red", "name": "Glossy red sphere", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#E6142D", "color": "#E6142D", "albedo": {"dominant": "#E6142D", "secondary": ["#FF6070"], "samplingNotes": "Glossy dielectric."}, "colorVariation": {"palette": ["#E6142D", "#FF6070"], "pattern": "gradient", "amplitude": 0.3, "heightCorrelation": 0.0}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.0, "amplitude": 0.3, "role": "gradient stops"}, {"id": "meso", "frequency": 6.0, "amplitude": 0.1, "role": "specular bands"}, {"id": "micro", "frequency": 40.0, "amplitude": 0.02, "role": "clearcoat sparkle"}], "roughness": {"base": 0.28, "variation": 0.05, "map": "uniform", "localResponse": "glossy dielectric"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "none", "strength": 0.0, "scale": 1.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.1, "contactShadowBias": 0.1, "notes": "graphic emblem, minimal AO"}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Glossy dielectric.", "physical": {"clearcoat": 1.0, "clearcoatRoughness": 0.05}, "referenceMaterialId": "plastic.glossy", "materialFamily": "plastic", "materialSubtype": "generic-polymer", "materialFinish": "glossy", "materialReference": {"registry": "img2threejs:docs/materials/material-reference.json", "profileId": "plastic.glossy", "method": "family-subtype-finish", "confidence": 0.778, "sourceRefs": ["three.mesh-physical", "three.mesh-standard", "adobe.pbr-guide-1", "google.filament-pbr", "mit.material-recognition"], "requiredMaps": ["map", "roughnessMap"], "optionalMaps": ["normalMap", "clearcoatMap"], "validationViews": ["neutral-studio", "grazing", "environment-reflection", "reference-beauty"]}, "clearcoat": {"base": 0.2, "variation": 0.0}, "clearcoatRoughness": {"base": 0.18, "variation": 0.0}, "ior": {"base": 1.5, "variation": 0.0}, "referencePbr": {"version": "1.0", "sourceImage": "evidence/material-evidence/10-sphere.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence with de-lighting estimate; not photogrammetry", "usable": true, "verdict": "pass", "confidence": 0.778, "estimatedFidelity": 0.778, "targetThreshold": 0.7, "hardLimit": "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", "maps": {"albedo": {"path": "evidence/material-evidence/pbr-10-sphere/sphere-red_albedo.png", "url": "maps/sphere-red_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}, "roughness": {"path": "evidence/material-evidence/pbr-10-sphere/sphere-red_roughness.png", "url": "maps/sphere-red_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "evidence/material-evidence/pbr-10-sphere/sphere-red_height.png", "url": "maps/sphere-red_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "evidence/material-evidence/pbr-10-sphere/sphere-red_normal.png", "url": "maps/sphere-red_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "evidence/material-evidence/pbr-10-sphere/sphere-red_ao.png", "url": "maps/sphere-red_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}}, "diagnostics": {"sourceWidth": 20, "sourceHeight": 20, "mapSize": 512, "cropBBoxPixels": {"x": 0, "y": 0, "width": 20, "height": 20}, "mask": {"backgroundColor": "#FA0B46", "backgroundNoise": 68.315, "transparentPixelFraction": 0.0, "foregroundCoverage": 1.0}, "mapStats": {"valueRange": 0.8075, "heightP90Gradient": 0.01309, "roughnessBase": 0.69, "roughnessVariation": 0.05, "normalStrength": 0.172, "blurRadius": 10}, "palette": ["#F50B42", "#C90024", "#FB3B6E", "#FCE1E9", "#FB7EA3"]}, "warnings": ["image is not clearly isolated from background; using most pixels as material evidence", "object/background separation is weak", "single-image inverse rendering cannot prove true physical PBR; confidence is capped"]}, "textureAnalysis": {"finishClass": "painted-metal", "recipe": {"metalness": 0.0, "roughness": 0.5, "clearcoat": 1.0, "clearcoatRoughness": 0.05, "transmission": 0.0, "ior": 1.5, "envMapIntensity": 1.0, "anisotropy": 0.0, "procedural": "flat-clearcoat"}, "palette": ["#FA88A7", "#FB8CA7", "#F54772", "#E30F41", "#D8012D"], "paletteHueRisk": [], "gradientAxis": "vertical", "stats": {"meanLum": 126.2, "meanSaturation": 0.715, "gradientStrength": 0.433, "mottle": 0.007, "streakRatio": 0.92, "hueSpread": 0.001, "specularFraction": 0.1}}, "materialEvidence": {"componentId": "sphere-08", "regionId": "sphere", "crop": {"path": "evidence/material-evidence/10-sphere.png", "bbox": {"x": 780, "y": 646, "width": 20, "height": 20}, "sourceWidth": 1024, "sourceHeight": 1024, "loaderWarnings": [], "coverage": 0.0004}, "observations": ["chromatic base-colour response", "strong image-space gradient; verify it is material pattern, not lighting", "single-image PBR inference requires controlled render validation"], "hypothesis": {"componentId": "sphere-08", "regionId": "sphere", "materialId": null, "family": "plastic", "subtype": "generic-polymer", "finish": "glossy", "aliases": [], "confidence": 0.778, "source": "vision"}, "alternatives": []}},
    options
  );
  materialMap["sphere-violet"] = createSculptMaterial(
    "sphere-violet",
    {"id": "sphere-violet", "name": "Glossy violet sphere", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#8F43F9", "color": "#8F43F9", "albedo": {"dominant": "#8F43F9", "secondary": ["#C090FF"], "samplingNotes": "Glossy dielectric."}, "colorVariation": {"palette": ["#8F43F9", "#C090FF"], "pattern": "gradient", "amplitude": 0.3, "heightCorrelation": 0.0}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.0, "amplitude": 0.3, "role": "gradient stops"}, {"id": "meso", "frequency": 6.0, "amplitude": 0.1, "role": "specular bands"}, {"id": "micro", "frequency": 40.0, "amplitude": 0.02, "role": "clearcoat sparkle"}], "roughness": {"base": 0.28, "variation": 0.05, "map": "uniform", "localResponse": "glossy dielectric"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "none", "strength": 0.0, "scale": 1.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.1, "contactShadowBias": 0.1, "notes": "graphic emblem, minimal AO"}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Glossy dielectric.", "physical": {"clearcoat": 1.0, "clearcoatRoughness": 0.05}, "referenceMaterialId": "plastic.glossy", "materialFamily": "plastic", "materialSubtype": "generic-polymer", "materialFinish": "glossy", "materialReference": {"registry": "img2threejs:docs/materials/material-reference.json", "profileId": "plastic.glossy", "method": "family-subtype-finish", "confidence": 0.86, "sourceRefs": ["three.mesh-physical", "three.mesh-standard", "adobe.pbr-guide-1", "google.filament-pbr", "mit.material-recognition"], "requiredMaps": ["map", "roughnessMap"], "optionalMaps": ["normalMap", "clearcoatMap"], "validationViews": ["neutral-studio", "grazing", "environment-reflection", "reference-beauty"]}, "clearcoat": {"base": 0.2, "variation": 0.0}, "clearcoatRoughness": {"base": 0.18, "variation": 0.0}, "ior": {"base": 1.5, "variation": 0.0}, "referencePbr": {"version": "1.0", "sourceImage": "evidence/material-evidence/11-sphere.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence with de-lighting estimate; not photogrammetry", "usable": true, "verdict": "pass", "confidence": 0.86, "estimatedFidelity": 0.86, "targetThreshold": 0.7, "hardLimit": "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", "maps": {"albedo": {"path": "evidence/material-evidence/pbr-11-sphere/sphere-violet_albedo.png", "url": "maps/sphere-violet_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}, "roughness": {"path": "evidence/material-evidence/pbr-11-sphere/sphere-violet_roughness.png", "url": "maps/sphere-violet_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "evidence/material-evidence/pbr-11-sphere/sphere-violet_height.png", "url": "maps/sphere-violet_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "evidence/material-evidence/pbr-11-sphere/sphere-violet_normal.png", "url": "maps/sphere-violet_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "evidence/material-evidence/pbr-11-sphere/sphere-violet_ao.png", "url": "maps/sphere-violet_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}}, "diagnostics": {"sourceWidth": 20, "sourceHeight": 20, "mapSize": 512, "cropBBoxPixels": {"x": 0, "y": 0, "width": 20, "height": 20}, "mask": {"backgroundColor": "#7A24F4", "backgroundNoise": 104.79, "transparentPixelFraction": 0.0, "foregroundCoverage": 0.875}, "mapStats": {"valueRange": 0.7224, "heightP90Gradient": 0.02816, "roughnessBase": 0.693, "roughnessVariation": 0.05, "normalStrength": 0.189, "blurRadius": 10}, "palette": ["#863BF7", "#611AE5", "#4104BB", "#B46CFB", "#E7BBFC"]}, "warnings": ["single-image inverse rendering cannot prove true physical PBR; confidence is capped"]}, "textureAnalysis": {"finishClass": "painted-metal", "recipe": {"metalness": 0.0, "roughness": 0.5, "clearcoat": 1.0, "clearcoatRoughness": 0.05, "transmission": 0.0, "ior": 1.5, "envMapIntensity": 1.0, "anisotropy": 0.0, "procedural": "flat-clearcoat"}, "palette": ["#D0A3FB", "#CAA1F9", "#9D5AF4", "#6722E0", "#4F08C3"], "paletteHueRisk": [{"stop": "#D0A3FB", "hueRisk": "blue-collapse", "suggestedRgb": [251, 163, 208]}, {"stop": "#CAA1F9", "hueRisk": "blue-collapse", "suggestedRgb": [249, 161, 202]}, {"stop": "#9D5AF4", "hueRisk": "blue-collapse", "suggestedRgb": [244, 90, 157]}, {"stop": "#6722E0", "hueRisk": "blue-collapse", "suggestedRgb": [224, 56, 103]}, {"stop": "#4F08C3", "hueRisk": "blue-collapse", "suggestedRgb": [195, 48, 79]}], "gradientAxis": "vertical", "stats": {"meanLum": 124.1, "meanSaturation": 0.637, "gradientStrength": 0.544, "mottle": 0.008, "streakRatio": 0.89, "hueSpread": 0.004, "specularFraction": 0.127}}, "materialEvidence": {"componentId": "sphere-09", "regionId": "sphere", "crop": {"path": "evidence/material-evidence/11-sphere.png", "bbox": {"x": 796, "y": 689, "width": 20, "height": 20}, "sourceWidth": 1024, "sourceHeight": 1024, "loaderWarnings": [], "coverage": 0.0004}, "observations": ["chromatic base-colour response", "strong image-space gradient; verify it is material pattern, not lighting", "single-image PBR inference requires controlled render validation"], "hypothesis": {"componentId": "sphere-09", "regionId": "sphere", "materialId": null, "family": "plastic", "subtype": "generic-polymer", "finish": "glossy", "aliases": [], "confidence": 0.86, "source": "vision"}, "alternatives": []}},
    options
  );
  materialMap["glyph-gloss"] = createSculptMaterial(
    "glyph-gloss",
    {"id": "glyph-gloss", "name": "Glyph clearcoat layer", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#FFFFFF", "color": "#FFFFFF", "albedo": {"dominant": "#FFFFFF", "secondary": [], "samplingNotes": "Shared clearcoat response of both glyphs."}, "colorVariation": {"palette": ["#FFFFFF"], "pattern": "gradient", "amplitude": 0.3, "heightCorrelation": 0.0}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.0, "amplitude": 0.3, "role": "gradient stops"}, {"id": "meso", "frequency": 6.0, "amplitude": 0.1, "role": "specular bands"}, {"id": "micro", "frequency": 40.0, "amplitude": 0.02, "role": "clearcoat sparkle"}], "roughness": {"base": 0.28, "variation": 0.05, "map": "uniform", "localResponse": "glossy dielectric"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "none", "strength": 0.0, "scale": 1.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.1, "contactShadowBias": 0.1, "notes": "graphic emblem, minimal AO"}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "glyph-gloss-clearcoat", "region": "glyph caps", "channel": "clearcoat", "value": 1.0}], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Shared clearcoat response of both glyphs.", "physical": {"clearcoat": 1.0, "clearcoatRoughness": 0.08}, "referenceMaterialId": "plastic.glossy", "materialFamily": "plastic", "materialSubtype": "generic-polymer", "materialFinish": "glossy", "materialReference": {"registry": "img2threejs:docs/materials/material-reference.json", "profileId": "plastic.glossy", "method": "family-subtype-finish", "confidence": 0.754, "sourceRefs": ["three.mesh-physical", "three.mesh-standard", "adobe.pbr-guide-1", "google.filament-pbr", "mit.material-recognition"], "requiredMaps": ["map", "roughnessMap"], "optionalMaps": ["normalMap", "clearcoatMap"], "validationViews": ["neutral-studio", "grazing", "environment-reflection", "reference-beauty"]}, "clearcoat": {"base": 0.2, "variation": 0.0}, "clearcoatRoughness": {"base": 0.18, "variation": 0.0}, "ior": {"base": 1.5, "variation": 0.0}, "referencePbr": {"version": "1.0", "sourceImage": "evidence/material-evidence/08-clearcoat.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence with de-lighting estimate; not photogrammetry", "usable": true, "verdict": "pass", "confidence": 0.754, "estimatedFidelity": 0.754, "targetThreshold": 0.7, "hardLimit": "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", "maps": {"albedo": {"path": "evidence/material-evidence/pbr-08-clearcoat/glyph-gloss_albedo.png", "url": "maps/glyph-gloss_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}, "roughness": {"path": "evidence/material-evidence/pbr-08-clearcoat/glyph-gloss_roughness.png", "url": "maps/glyph-gloss_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "evidence/material-evidence/pbr-08-clearcoat/glyph-gloss_height.png", "url": "maps/glyph-gloss_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "evidence/material-evidence/pbr-08-clearcoat/glyph-gloss_normal.png", "url": "maps/glyph-gloss_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "evidence/material-evidence/pbr-08-clearcoat/glyph-gloss_ao.png", "url": "maps/glyph-gloss_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}}, "diagnostics": {"sourceWidth": 56, "sourceHeight": 120, "mapSize": 512, "cropBBoxPixels": {"x": 0, "y": 0, "width": 56, "height": 120}, "mask": {"backgroundColor": "#286FFB", "backgroundNoise": 76.0, "transparentPixelFraction": 0.0, "foregroundCoverage": 1.0}, "mapStats": {"valueRange": 0.3792, "heightP90Gradient": 0.01321, "roughnessBase": 0.688, "roughnessVariation": 0.05, "normalStrength": 0.172, "blurRadius": 10}, "palette": ["#4B80FA", "#097FFB", "#40B3FA", "#5243F7", "#9328E2"]}, "warnings": ["image is not clearly isolated from background; using most pixels as material evidence", "object/background separation is weak", "single-image inverse rendering cannot prove true physical PBR; confidence is capped"]}, "textureAnalysis": {"finishClass": "painted-metal", "recipe": {"metalness": 0.0, "roughness": 0.5, "clearcoat": 1.0, "clearcoatRoughness": 0.05, "transmission": 0.0, "ior": 1.5, "envMapIntensity": 1.0, "anisotropy": 0.0, "procedural": "flat-clearcoat"}, "palette": ["#077BFA", "#2292FA", "#5091FA", "#545FF7", "#662EDC"], "paletteHueRisk": [{"stop": "#077BFA", "hueRisk": "blue-collapse", "suggestedRgb": [250, 123, 7]}, {"stop": "#2292FA", "hueRisk": "blue-collapse", "suggestedRgb": [250, 146, 34]}, {"stop": "#5091FA", "hueRisk": "blue-collapse", "suggestedRgb": [250, 145, 80]}, {"stop": "#545FF7", "hueRisk": "blue-collapse", "suggestedRgb": [247, 95, 84]}, {"stop": "#662EDC", "hueRisk": "blue-collapse", "suggestedRgb": [220, 55, 102]}], "gradientAxis": "vertical", "stats": {"meanLum": 116.9, "meanSaturation": 0.792, "gradientStrength": 0.237, "mottle": 0.005, "streakRatio": 0.44, "hueSpread": 0.074, "specularFraction": 0.0}}, "materialEvidence": {"componentId": "glyph-4", "regionId": "clearcoat", "crop": {"path": "evidence/material-evidence/08-clearcoat.png", "bbox": {"x": 612, "y": 600, "width": 56, "height": 120}, "sourceWidth": 1024, "sourceHeight": 1024, "loaderWarnings": [], "coverage": 0.0064}, "observations": ["chromatic base-colour response", "directional surface frequency", "strong image-space gradient; verify it is material pattern, not lighting", "single-image PBR inference requires controlled render validation"], "hypothesis": {"componentId": "glyph-4", "regionId": "clearcoat", "materialId": null, "family": "plastic", "subtype": "generic-polymer", "finish": "glossy", "aliases": [], "confidence": 0.754, "source": "vision"}, "alternatives": []}},
    options
  );
  materialMap["sphere-gloss"] = createSculptMaterial(
    "sphere-gloss",
    {"id": "sphere-gloss", "name": "Sphere gloss layer", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#FFFFFF", "color": "#FFFFFF", "albedo": {"dominant": "#FFFFFF", "secondary": [], "samplingNotes": "Shared sphere highlight response."}, "colorVariation": {"palette": ["#FFFFFF"], "pattern": "gradient", "amplitude": 0.3, "heightCorrelation": 0.0}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.0, "amplitude": 0.3, "role": "gradient stops"}, {"id": "meso", "frequency": 6.0, "amplitude": 0.1, "role": "specular bands"}, {"id": "micro", "frequency": 40.0, "amplitude": 0.02, "role": "clearcoat sparkle"}], "roughness": {"base": 0.28, "variation": 0.05, "map": "uniform", "localResponse": "glossy dielectric"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "none", "strength": 0.0, "scale": 1.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.1, "contactShadowBias": 0.1, "notes": "graphic emblem, minimal AO"}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "sphere-gloss-roughness", "region": "sphere", "channel": "roughness", "value": 0.1}], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Shared sphere highlight response.", "referenceMaterialId": "plastic.glossy", "materialFamily": "plastic", "materialSubtype": "generic-polymer", "materialFinish": "glossy", "materialReference": {"registry": "img2threejs:docs/materials/material-reference.json", "profileId": "plastic.glossy", "method": "family-subtype-finish", "confidence": 0.793, "sourceRefs": ["three.mesh-physical", "three.mesh-standard", "adobe.pbr-guide-1", "google.filament-pbr", "mit.material-recognition"], "requiredMaps": ["map", "roughnessMap"], "optionalMaps": ["normalMap", "clearcoatMap"], "validationViews": ["neutral-studio", "grazing", "environment-reflection", "reference-beauty"]}, "clearcoat": {"base": 0.2, "variation": 0.0}, "clearcoatRoughness": {"base": 0.18, "variation": 0.0}, "ior": {"base": 1.5, "variation": 0.0}, "referencePbr": {"version": "1.0", "sourceImage": "evidence/material-evidence/12-gloss.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence with de-lighting estimate; not photogrammetry", "usable": true, "verdict": "pass", "confidence": 0.793, "estimatedFidelity": 0.793, "targetThreshold": 0.7, "hardLimit": "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", "maps": {"albedo": {"path": "evidence/material-evidence/pbr-12-gloss/sphere-gloss_albedo.png", "url": "maps/sphere-gloss_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}, "roughness": {"path": "evidence/material-evidence/pbr-12-gloss/sphere-gloss_roughness.png", "url": "maps/sphere-gloss_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "evidence/material-evidence/pbr-12-gloss/sphere-gloss_height.png", "url": "maps/sphere-gloss_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "evidence/material-evidence/pbr-12-gloss/sphere-gloss_normal.png", "url": "maps/sphere-gloss_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "evidence/material-evidence/pbr-12-gloss/sphere-gloss_ao.png", "url": "maps/sphere-gloss_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}}, "diagnostics": {"sourceWidth": 28, "sourceHeight": 28, "mapSize": 512, "cropBBoxPixels": {"x": 0, "y": 0, "width": 28, "height": 28}, "mask": {"backgroundColor": "#0380F8", "backgroundNoise": 61.474, "transparentPixelFraction": 0.0, "foregroundCoverage": 1.0}, "mapStats": {"valueRange": 0.8214, "heightP90Gradient": 0.01487, "roughnessBase": 0.696, "roughnessVariation": 0.05, "normalStrength": 0.174, "blurRadius": 10}, "palette": ["#0129F4", "#0062FA", "#01A7FA", "#2CEEFB", "#C8FAFC"]}, "warnings": ["image is not clearly isolated from background; using most pixels as material evidence", "object/background separation is weak", "single-image inverse rendering cannot prove true physical PBR; confidence is capped"]}, "textureAnalysis": {"finishClass": "painted-metal", "recipe": {"metalness": 0.0, "roughness": 0.5, "clearcoat": 1.0, "clearcoatRoughness": 0.05, "transmission": 0.0, "ior": 1.5, "envMapIntensity": 1.0, "anisotropy": 0.0, "procedural": "flat-clearcoat"}, "palette": ["#27C0F0", "#6DCDFA", "#11AFFA", "#005AF6", "#0043F7"], "paletteHueRisk": [{"stop": "#6DCDFA", "hueRisk": "blue-collapse", "suggestedRgb": [250, 205, 109]}, {"stop": "#11AFFA", "hueRisk": "blue-collapse", "suggestedRgb": [250, 175, 17]}, {"stop": "#005AF6", "hueRisk": "blue-collapse", "suggestedRgb": [246, 90, 0]}, {"stop": "#0043F7", "hueRisk": "blue-collapse", "suggestedRgb": [247, 67, 0]}], "gradientAxis": "vertical", "stats": {"meanLum": 126.7, "meanSaturation": 0.848, "gradientStrength": 0.459, "mottle": 0.011, "streakRatio": 1.01, "hueSpread": 0.048, "specularFraction": 0.081}}, "materialEvidence": {"componentId": "sphere-05", "regionId": "gloss", "crop": {"path": "evidence/material-evidence/12-gloss.png", "bbox": {"x": 495, "y": 538, "width": 28, "height": 28}, "sourceWidth": 1024, "sourceHeight": 1024, "loaderWarnings": [], "coverage": 0.0007}, "observations": ["chromatic base-colour response", "strong image-space gradient; verify it is material pattern, not lighting", "single-image PBR inference requires controlled render validation"], "hypothesis": {"componentId": "sphere-05", "regionId": "gloss", "materialId": null, "family": "plastic", "subtype": "generic-polymer", "finish": "glossy", "aliases": [], "confidence": 0.793, "source": "vision"}, "alternatives": []}},
    options
  );

  const nodes: Record<string, THREE.Object3D> = { root };
  const meshes: Record<string, THREE.Mesh> = {};
  const sockets: Record<string, THREE.Object3D> = {};
  const colliders: Record<string, unknown> = {};
  const destructionGroups: Record<string, THREE.Object3D[]> = {};

  const endpoint_root_0 = makeAttachmentEndpoint(null);
  const node_root_0 = new THREE.Group();
  node_root_0.name = "Icon 4D Emblem__pivot";
  node_root_0.scale.set(1, 1, 1);
  if (endpoint_root_0) {
    node_root_0.position.copy(endpoint_root_0.start);
    node_root_0.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_root_0.position.set(0.0, 0.0, 0.0);
    node_root_0.rotation.set(0.0, 0.0, 0.0);
  }
  node_root_0.userData.sculptComponent = {"id": "root", "name": "Icon 4D Emblem", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Root pivot only; all geometry lives in children.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.001, "height": 0.001, "depth": 0.001, "units": "world", "confidence": 1.0}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "printed-panel", "materialLayers": ["printed-panel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "groupOnly": true, "colorMaterialRecipe": {"dominantAlbedo": "rgba(1, 168, 250, 1.0)", "secondaryAlbedo": "rgba(214, 0, 18, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}};
  node_root_0.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_root_0);
  nodes["root"] = node_root_0;
  const mesh_root_0Geometry = endpoint_root_0
    ? new THREE.CylinderGeometry(endpoint_root_0.endRadius, endpoint_root_0.baseRadius, endpoint_root_0.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_root_0) {
    mesh_root_0Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_root_0 = new THREE.Mesh(
    mesh_root_0Geometry,
    materialMap["printed-panel"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_root_0.name = "Icon 4D Emblem";
  if (endpoint_root_0) {
    mesh_root_0.position.copy(endpoint_root_0.midpoint);
    mesh_root_0.quaternion.copy(endpoint_root_0.quaternion);
  }
  mesh_root_0.castShadow = options.castShadow ?? true;
  mesh_root_0.receiveShadow = options.receiveShadow ?? true;
  mesh_root_0.userData.sculptComponent = {"id": "root", "name": "Icon 4D Emblem", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Root pivot only; all geometry lives in children.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.001, "height": 0.001, "depth": 0.001, "units": "world", "confidence": 1.0}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "printed-panel", "materialLayers": ["printed-panel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "groupOnly": true, "colorMaterialRecipe": {"dominantAlbedo": "rgba(1, 168, 250, 1.0)", "secondaryAlbedo": "rgba(214, 0, 18, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}};
  node_root_0.add(mesh_root_0);
  meshes["root"] = mesh_root_0;
  colliders["root"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_root_0);

  const endpoint_panel_front_1 = makeAttachmentEndpoint(null);
  const node_panel_front_1 = new THREE.Group();
  node_panel_front_1.name = "Front panel (statue head)__pivot";
  node_panel_front_1.scale.set(1, 1, 1);
  if (endpoint_panel_front_1) {
    node_panel_front_1.position.copy(endpoint_panel_front_1.start);
    node_panel_front_1.rotation.set(0.0, -0.85373, 0.0);
  } else {
    node_panel_front_1.position.set(-8.26334, 0.0, -6.49943);
    node_panel_front_1.rotation.set(0.0, -0.85373, 0.0);
  }
  node_panel_front_1.userData.sculptComponent = {"id": "panel-front", "name": "Front panel (statue head)", "level": "macro", "role": "body", "importance": 0.9, "confidence": 0.8, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Thin planar slab: a rounded quad extruded by panel thickness; flat faces carry a projected print.", "geometryDescriptor": {"profile2D": {"points": [[0.0, -3.5971], [0.00946, -3.70143], [0.03783, -3.78735], [0.08512, -3.85486], [0.15133, -3.90397], [0.23645, -3.93466], [0.34049, -3.94694], [9.55689, -4.19685], [9.66093, -4.19021], [9.74605, -4.16414], [9.81226, -4.11863], [9.85955, -4.05368], [9.88792, -3.96929], [9.89738, -3.86547], [9.89738, 3.8542], [9.88792, 3.95854], [9.85955, 4.04448], [9.81226, 4.11202], [9.74605, 4.16116], [9.66093, 4.19191], [9.5569, 4.20425], [0.34048, 4.45986], [0.23645, 4.45328], [0.15133, 4.42726], [0.08512, 4.38179], [0.03783, 4.31687], [0.00946, 4.2325], [0.0, 4.12869]], "depth": 0.06}, "edgeTreatment": {"type": "fillet-in-profile", "bevelRadius": 0.2147, "segments": 6}, "uvStrategy": "reference-camera projection (UV = reference pixel of each vertex)", "projection": {"mode": "reference-camera-projection", "camera": "referenceCamera", "imageCorners": {"TL": [90, 285], "TR": [352, 140], "BR": [352, 885], "BL": [90, 712]}, "edgeDepths": {"left": 17.46, "right": 10.0}}, "topologyIntent": "planar slab", "deformationStack": [], "normalStrategy": "flat faces"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.0, "height": 1.0, "depth": 1.0, "units": "relative", "confidence": 0.5}, "transform": {"position": [-8.26334, 0.0, -6.49943], "rotation": [0.0, -0.85373, 0.0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-body", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [{"id": "panel-front-face", "localPosition": [0, 0, 0], "normal": [0, 0, 1]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "panel-front", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "printed-panel"}}, "material": "printed-panel", "materialLayers": ["printed-panel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "projected-print", "type": "projected-decal", "detailRef": "printed-statue"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(1, 168, 250, 1.0)", "secondaryAlbedo": "rgba(214, 0, 18, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "printed-panel"}, "materialRegions": [{"regionId": "print", "materialId": "printed-panel", "profileId": "plastic.glossy", "crop": {"path": "evidence/material-evidence/00-print.png", "bbox": {"x": 110, "y": 420, "width": 200, "height": 220}, "sourceWidth": 1024, "sourceHeight": 1024, "loaderWarnings": [], "coverage": 0.042}}]};
  node_panel_front_1.userData.actionProfile = {"animationRole": "static-body", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [{"id": "panel-front-face", "localPosition": [0, 0, 0], "normal": [0, 0, 1]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "panel-front", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "printed-panel"}};
  (nodes["root"] ?? root).add(node_panel_front_1);
  nodes["panel-front"] = node_panel_front_1;
  const mesh_panel_front_1Geometry = endpoint_panel_front_1
    ? new THREE.CylinderGeometry(endpoint_panel_front_1.endRadius, endpoint_panel_front_1.baseRadius, endpoint_panel_front_1.length, 32, 12)
    : buildExtrudeGeometry({"points": [[0.0, -3.5971], [0.00946, -3.70143], [0.03783, -3.78735], [0.08512, -3.85486], [0.15133, -3.90397], [0.23645, -3.93466], [0.34049, -3.94694], [9.55689, -4.19685], [9.66093, -4.19021], [9.74605, -4.16414], [9.81226, -4.11863], [9.85955, -4.05368], [9.88792, -3.96929], [9.89738, -3.86547], [9.89738, 3.8542], [9.88792, 3.95854], [9.85955, 4.04448], [9.81226, 4.11202], [9.74605, 4.16116], [9.66093, 4.19191], [9.5569, 4.20425], [0.34048, 4.45986], [0.23645, 4.45328], [0.15133, 4.42726], [0.08512, 4.38179], [0.03783, 4.31687], [0.00946, 4.2325], [0.0, 4.12869]], "depth": 0.06});
  if (!endpoint_panel_front_1) {
    mesh_panel_front_1Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_panel_front_1 = new THREE.Mesh(
    mesh_panel_front_1Geometry,
    materialMap["printed-panel"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_panel_front_1.name = "Front panel (statue head)";
  if (endpoint_panel_front_1) {
    mesh_panel_front_1.position.copy(endpoint_panel_front_1.midpoint);
    mesh_panel_front_1.quaternion.copy(endpoint_panel_front_1.quaternion);
  }
  mesh_panel_front_1.castShadow = options.castShadow ?? true;
  mesh_panel_front_1.receiveShadow = options.receiveShadow ?? true;
  mesh_panel_front_1.userData.sculptComponent = {"id": "panel-front", "name": "Front panel (statue head)", "level": "macro", "role": "body", "importance": 0.9, "confidence": 0.8, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Thin planar slab: a rounded quad extruded by panel thickness; flat faces carry a projected print.", "geometryDescriptor": {"profile2D": {"points": [[0.0, -3.5971], [0.00946, -3.70143], [0.03783, -3.78735], [0.08512, -3.85486], [0.15133, -3.90397], [0.23645, -3.93466], [0.34049, -3.94694], [9.55689, -4.19685], [9.66093, -4.19021], [9.74605, -4.16414], [9.81226, -4.11863], [9.85955, -4.05368], [9.88792, -3.96929], [9.89738, -3.86547], [9.89738, 3.8542], [9.88792, 3.95854], [9.85955, 4.04448], [9.81226, 4.11202], [9.74605, 4.16116], [9.66093, 4.19191], [9.5569, 4.20425], [0.34048, 4.45986], [0.23645, 4.45328], [0.15133, 4.42726], [0.08512, 4.38179], [0.03783, 4.31687], [0.00946, 4.2325], [0.0, 4.12869]], "depth": 0.06}, "edgeTreatment": {"type": "fillet-in-profile", "bevelRadius": 0.2147, "segments": 6}, "uvStrategy": "reference-camera projection (UV = reference pixel of each vertex)", "projection": {"mode": "reference-camera-projection", "camera": "referenceCamera", "imageCorners": {"TL": [90, 285], "TR": [352, 140], "BR": [352, 885], "BL": [90, 712]}, "edgeDepths": {"left": 17.46, "right": 10.0}}, "topologyIntent": "planar slab", "deformationStack": [], "normalStrategy": "flat faces"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.0, "height": 1.0, "depth": 1.0, "units": "relative", "confidence": 0.5}, "transform": {"position": [-8.26334, 0.0, -6.49943], "rotation": [0.0, -0.85373, 0.0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-body", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [{"id": "panel-front-face", "localPosition": [0, 0, 0], "normal": [0, 0, 1]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "panel-front", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "printed-panel"}}, "material": "printed-panel", "materialLayers": ["printed-panel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "projected-print", "type": "projected-decal", "detailRef": "printed-statue"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(1, 168, 250, 1.0)", "secondaryAlbedo": "rgba(214, 0, 18, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "printed-panel"}, "materialRegions": [{"regionId": "print", "materialId": "printed-panel", "profileId": "plastic.glossy", "crop": {"path": "evidence/material-evidence/00-print.png", "bbox": {"x": 110, "y": 420, "width": 200, "height": 220}, "sourceWidth": 1024, "sourceHeight": 1024, "loaderWarnings": [], "coverage": 0.042}}]};
  node_panel_front_1.add(mesh_panel_front_1);
  meshes["panel-front"] = mesh_panel_front_1;
  colliders["panel-front"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["panel-front"] ??= [];
  destructionGroups["panel-front"].push(node_panel_front_1);
  const socket_panel_front_panel_front_face_0 = new THREE.Object3D();
  socket_panel_front_panel_front_face_0.name = "panel-front-face";
  socket_panel_front_panel_front_face_0.position.set(0.0, 0.0, 0.0);
  socket_panel_front_panel_front_face_0.rotation.set(0, 0, 0);
  socket_panel_front_panel_front_face_0.userData.socket = {"id": "panel-front-face", "localPosition": [0, 0, 0], "normal": [0, 0, 1]};
  node_panel_front_1.add(socket_panel_front_panel_front_face_0);
  sockets["panel-front:panel-front-face"] = socket_panel_front_panel_front_face_0;

  const endpoint_panel_front_rim_2 = makeAttachmentEndpoint(null);
  const node_panel_front_rim_2 = new THREE.Group();
  node_panel_front_rim_2.name = "Front panel (statue head) rim frame__pivot";
  node_panel_front_rim_2.scale.set(1, 1, 1);
  if (endpoint_panel_front_rim_2) {
    node_panel_front_rim_2.position.copy(endpoint_panel_front_rim_2.start);
    node_panel_front_rim_2.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_panel_front_rim_2.position.set(0.0, 0.0, 0.012);
    node_panel_front_rim_2.rotation.set(0.0, 0.0, 0.0);
  }
  node_panel_front_rim_2.userData.sculptComponent = {"id": "panel-front-rim", "name": "Front panel (statue head) rim frame", "level": "meso", "role": "trim", "importance": 0.6, "confidence": 0.8, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Emissive frame: outer rounded quad minus inset hole, extruded slightly proud of the slab.", "geometryDescriptor": {"profile2D": {"points": [[0.0, -3.5971], [0.00946, -3.70143], [0.03783, -3.78735], [0.08512, -3.85486], [0.15133, -3.90397], [0.23645, -3.93466], [0.34049, -3.94694], [9.55689, -4.19685], [9.66093, -4.19021], [9.74605, -4.16414], [9.81226, -4.11863], [9.85955, -4.05368], [9.88792, -3.96929], [9.89738, -3.86547], [9.89738, 3.8542], [9.88792, 3.95854], [9.85955, 4.04448], [9.81226, 4.11202], [9.74605, 4.16116], [9.66093, 4.19191], [9.5569, 4.20425], [0.34048, 4.45986], [0.23645, 4.45328], [0.15133, 4.42726], [0.08512, 4.38179], [0.03783, 4.31687], [0.00946, 4.2325], [0.0, 4.12869]], "holes": [[[0.13934, -3.60082], [0.14493, -3.66247], [0.1617, -3.71325], [0.18964, -3.75314], [0.22876, -3.78216], [0.27906, -3.80029], [0.34054, -3.80755], [9.55684, -4.05746], [9.61832, -4.05354], [9.66862, -4.03813], [9.70774, -4.01123], [9.73568, -3.97285], [9.75245, -3.92299], [9.75804, -3.86164], [9.75804, 3.85801], [9.75245, 3.91966], [9.73568, 3.97045], [9.70774, 4.01036], [9.66862, 4.0394], [9.61832, 4.05756], [9.55684, 4.06486], [0.34054, 4.32046], [0.27906, 4.31657], [0.22876, 4.3012], [0.18964, 4.27433], [0.1617, 4.23597], [0.14493, 4.18611], [0.13934, 4.12477]]], "depth": 0.096}, "edgeTreatment": {"type": "fillet-in-profile", "bevelRadius": 0.2147, "segments": 6}, "uvStrategy": "generated procedural coordinates", "topologyIntent": "frame ring", "deformationStack": [], "normalStrategy": "flat faces"}, "parent": "panel-front", "attachment": {"parentSocket": "panel-front-face", "contactType": "overlap", "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "embed": 0.06, "gapTolerance": 0.0}, "dimensions": {"width": 1.0, "height": 1.0, "depth": 1.0, "units": "relative", "confidence": 0.5}, "transform": {"position": [0, 0, 0.012], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "attached-trim", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "panel-front-rim", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "panel-rim-cyan"}}, "material": "panel-rim-cyan", "materialLayers": ["panel-rim-cyan"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "panel-front-rim-rim-glow", "type": "emissive-contour", "detailRef": "rim-glow-front"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "rimColor": "#1E9BFF", "colorMaterialRecipe": {"dominantAlbedo": "rgba(33, 213, 251, 1.0)", "secondaryAlbedo": "rgba(30, 155, 255, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "panel-rim-cyan"}, "materialRegions": [{"regionId": "rim", "materialId": "panel-rim-cyan", "profileId": "plastic.glossy", "crop": {"path": "evidence/material-evidence/02-rim.png", "bbox": {"x": 84, "y": 330, "width": 12, "height": 300}, "sourceWidth": 1024, "sourceHeight": 1024, "loaderWarnings": [], "coverage": 0.0034}}]};
  node_panel_front_rim_2.userData.actionProfile = {"animationRole": "attached-trim", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "panel-front-rim", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "panel-rim-cyan"}};
  (nodes["panel-front"] ?? root).add(node_panel_front_rim_2);
  nodes["panel-front-rim"] = node_panel_front_rim_2;
  const mesh_panel_front_rim_2Geometry = endpoint_panel_front_rim_2
    ? new THREE.CylinderGeometry(endpoint_panel_front_rim_2.endRadius, endpoint_panel_front_rim_2.baseRadius, endpoint_panel_front_rim_2.length, 32, 12)
    : buildExtrudeGeometry({"points": [[0.0, -3.5971], [0.00946, -3.70143], [0.03783, -3.78735], [0.08512, -3.85486], [0.15133, -3.90397], [0.23645, -3.93466], [0.34049, -3.94694], [9.55689, -4.19685], [9.66093, -4.19021], [9.74605, -4.16414], [9.81226, -4.11863], [9.85955, -4.05368], [9.88792, -3.96929], [9.89738, -3.86547], [9.89738, 3.8542], [9.88792, 3.95854], [9.85955, 4.04448], [9.81226, 4.11202], [9.74605, 4.16116], [9.66093, 4.19191], [9.5569, 4.20425], [0.34048, 4.45986], [0.23645, 4.45328], [0.15133, 4.42726], [0.08512, 4.38179], [0.03783, 4.31687], [0.00946, 4.2325], [0.0, 4.12869]], "holes": [[[0.13934, -3.60082], [0.14493, -3.66247], [0.1617, -3.71325], [0.18964, -3.75314], [0.22876, -3.78216], [0.27906, -3.80029], [0.34054, -3.80755], [9.55684, -4.05746], [9.61832, -4.05354], [9.66862, -4.03813], [9.70774, -4.01123], [9.73568, -3.97285], [9.75245, -3.92299], [9.75804, -3.86164], [9.75804, 3.85801], [9.75245, 3.91966], [9.73568, 3.97045], [9.70774, 4.01036], [9.66862, 4.0394], [9.61832, 4.05756], [9.55684, 4.06486], [0.34054, 4.32046], [0.27906, 4.31657], [0.22876, 4.3012], [0.18964, 4.27433], [0.1617, 4.23597], [0.14493, 4.18611], [0.13934, 4.12477]]], "depth": 0.096});
  if (!endpoint_panel_front_rim_2) {
    mesh_panel_front_rim_2Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_panel_front_rim_2 = new THREE.Mesh(
    mesh_panel_front_rim_2Geometry,
    materialMap["panel-rim-cyan"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_panel_front_rim_2.name = "Front panel (statue head) rim frame";
  if (endpoint_panel_front_rim_2) {
    mesh_panel_front_rim_2.position.copy(endpoint_panel_front_rim_2.midpoint);
    mesh_panel_front_rim_2.quaternion.copy(endpoint_panel_front_rim_2.quaternion);
  }
  mesh_panel_front_rim_2.castShadow = options.castShadow ?? true;
  mesh_panel_front_rim_2.receiveShadow = options.receiveShadow ?? true;
  mesh_panel_front_rim_2.userData.sculptComponent = {"id": "panel-front-rim", "name": "Front panel (statue head) rim frame", "level": "meso", "role": "trim", "importance": 0.6, "confidence": 0.8, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Emissive frame: outer rounded quad minus inset hole, extruded slightly proud of the slab.", "geometryDescriptor": {"profile2D": {"points": [[0.0, -3.5971], [0.00946, -3.70143], [0.03783, -3.78735], [0.08512, -3.85486], [0.15133, -3.90397], [0.23645, -3.93466], [0.34049, -3.94694], [9.55689, -4.19685], [9.66093, -4.19021], [9.74605, -4.16414], [9.81226, -4.11863], [9.85955, -4.05368], [9.88792, -3.96929], [9.89738, -3.86547], [9.89738, 3.8542], [9.88792, 3.95854], [9.85955, 4.04448], [9.81226, 4.11202], [9.74605, 4.16116], [9.66093, 4.19191], [9.5569, 4.20425], [0.34048, 4.45986], [0.23645, 4.45328], [0.15133, 4.42726], [0.08512, 4.38179], [0.03783, 4.31687], [0.00946, 4.2325], [0.0, 4.12869]], "holes": [[[0.13934, -3.60082], [0.14493, -3.66247], [0.1617, -3.71325], [0.18964, -3.75314], [0.22876, -3.78216], [0.27906, -3.80029], [0.34054, -3.80755], [9.55684, -4.05746], [9.61832, -4.05354], [9.66862, -4.03813], [9.70774, -4.01123], [9.73568, -3.97285], [9.75245, -3.92299], [9.75804, -3.86164], [9.75804, 3.85801], [9.75245, 3.91966], [9.73568, 3.97045], [9.70774, 4.01036], [9.66862, 4.0394], [9.61832, 4.05756], [9.55684, 4.06486], [0.34054, 4.32046], [0.27906, 4.31657], [0.22876, 4.3012], [0.18964, 4.27433], [0.1617, 4.23597], [0.14493, 4.18611], [0.13934, 4.12477]]], "depth": 0.096}, "edgeTreatment": {"type": "fillet-in-profile", "bevelRadius": 0.2147, "segments": 6}, "uvStrategy": "generated procedural coordinates", "topologyIntent": "frame ring", "deformationStack": [], "normalStrategy": "flat faces"}, "parent": "panel-front", "attachment": {"parentSocket": "panel-front-face", "contactType": "overlap", "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "embed": 0.06, "gapTolerance": 0.0}, "dimensions": {"width": 1.0, "height": 1.0, "depth": 1.0, "units": "relative", "confidence": 0.5}, "transform": {"position": [0, 0, 0.012], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "attached-trim", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "panel-front-rim", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "panel-rim-cyan"}}, "material": "panel-rim-cyan", "materialLayers": ["panel-rim-cyan"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "panel-front-rim-rim-glow", "type": "emissive-contour", "detailRef": "rim-glow-front"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "rimColor": "#1E9BFF", "colorMaterialRecipe": {"dominantAlbedo": "rgba(33, 213, 251, 1.0)", "secondaryAlbedo": "rgba(30, 155, 255, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "panel-rim-cyan"}, "materialRegions": [{"regionId": "rim", "materialId": "panel-rim-cyan", "profileId": "plastic.glossy", "crop": {"path": "evidence/material-evidence/02-rim.png", "bbox": {"x": 84, "y": 330, "width": 12, "height": 300}, "sourceWidth": 1024, "sourceHeight": 1024, "loaderWarnings": [], "coverage": 0.0034}}]};
  node_panel_front_rim_2.add(mesh_panel_front_rim_2);
  meshes["panel-front-rim"] = mesh_panel_front_rim_2;
  colliders["panel-front-rim"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["panel-front-rim"] ??= [];
  destructionGroups["panel-front-rim"].push(node_panel_front_rim_2);

  const endpoint_panel_glass_3 = makeAttachmentEndpoint(null);
  const node_panel_glass_3 = new THREE.Group();
  node_panel_glass_3.name = "Glass panel__pivot";
  node_panel_glass_3.scale.set(1, 1, 1);
  if (endpoint_panel_glass_3) {
    node_panel_glass_3.position.copy(endpoint_panel_glass_3.start);
    node_panel_glass_3.rotation.set(0.0, -0.92587, 0.0);
  } else {
    node_panel_glass_3.position.set(-4.08822, 0.0, -3.03607);
    node_panel_glass_3.rotation.set(0.0, -0.92587, 0.0);
  }
  node_panel_glass_3.userData.sculptComponent = {"id": "panel-glass", "name": "Glass panel", "level": "macro", "role": "body", "importance": 0.9, "confidence": 0.8, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Thin planar slab: a rounded quad extruded by panel thickness; flat faces carry a projected print.", "geometryDescriptor": {"profile2D": {"points": [[0.0, -2.59714], [0.00806, -2.68724], [0.03222, -2.76295], [0.0725, -2.82428], [0.12889, -2.87123], [0.20139, -2.90379], [0.29, -2.92197], [5.30347, -3.49185], [5.39208, -3.49381], [5.46458, -3.47773], [5.52097, -3.44361], [5.56124, -3.39143], [5.58541, -3.32121], [5.59347, -3.23295], [5.59347, 2.57742], [5.58541, 2.66751], [5.56124, 2.74323], [5.52097, 2.80455], [5.46458, 2.8515], [5.39208, 2.88405], [5.30346, 2.90223], [0.29, 3.47175], [0.20139, 3.47371], [0.12889, 3.45763], [0.0725, 3.42349], [0.03222, 3.37132], [0.00806, 3.3011], [0.0, 3.21283]], "depth": 0.06}, "edgeTreatment": {"type": "fillet-in-profile", "bevelRadius": 0.184, "segments": 6}, "uvStrategy": "reference-camera projection (UV = reference pixel of each vertex)", "projection": {"mode": "reference-camera-projection", "camera": "referenceCamera", "imageCorners": {"TL": [250, 290], "TR": [440, 245], "BR": [440, 840], "BL": [250, 695]}, "edgeDepths": {"left": 14.0, "right": 9.53}}, "topologyIntent": "planar slab", "deformationStack": [], "normalStrategy": "flat faces"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.0, "height": 1.0, "depth": 1.0, "units": "relative", "confidence": 0.5}, "transform": {"position": [-4.08822, 0.0, -3.03607], "rotation": [0.0, -0.92587, 0.0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-body", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [{"id": "panel-glass-face", "localPosition": [0, 0, 0], "normal": [0, 0, 1]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "panel-glass", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "glass"}}, "material": "glass", "materialLayers": ["glass"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(169, 52, 131, 1.0)", "secondaryAlbedo": "rgba(255, 255, 255, 0.3)", "materialClass": "glass", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "glass"}, "materialRegions": [{"regionId": "glass", "materialId": "glass", "profileId": "glass.clear", "crop": {"path": "evidence/material-evidence/01-glass.png", "bbox": {"x": 362, "y": 380, "width": 70, "height": 280}, "sourceWidth": 1024, "sourceHeight": 1024, "loaderWarnings": [], "coverage": 0.0187}}]};
  node_panel_glass_3.userData.actionProfile = {"animationRole": "static-body", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [{"id": "panel-glass-face", "localPosition": [0, 0, 0], "normal": [0, 0, 1]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "panel-glass", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "glass"}};
  (nodes["root"] ?? root).add(node_panel_glass_3);
  nodes["panel-glass"] = node_panel_glass_3;
  const mesh_panel_glass_3Geometry = endpoint_panel_glass_3
    ? new THREE.CylinderGeometry(endpoint_panel_glass_3.endRadius, endpoint_panel_glass_3.baseRadius, endpoint_panel_glass_3.length, 32, 12)
    : buildExtrudeGeometry({"points": [[0.0, -2.59714], [0.00806, -2.68724], [0.03222, -2.76295], [0.0725, -2.82428], [0.12889, -2.87123], [0.20139, -2.90379], [0.29, -2.92197], [5.30347, -3.49185], [5.39208, -3.49381], [5.46458, -3.47773], [5.52097, -3.44361], [5.56124, -3.39143], [5.58541, -3.32121], [5.59347, -3.23295], [5.59347, 2.57742], [5.58541, 2.66751], [5.56124, 2.74323], [5.52097, 2.80455], [5.46458, 2.8515], [5.39208, 2.88405], [5.30346, 2.90223], [0.29, 3.47175], [0.20139, 3.47371], [0.12889, 3.45763], [0.0725, 3.42349], [0.03222, 3.37132], [0.00806, 3.3011], [0.0, 3.21283]], "depth": 0.06});
  if (!endpoint_panel_glass_3) {
    mesh_panel_glass_3Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_panel_glass_3 = new THREE.Mesh(
    mesh_panel_glass_3Geometry,
    materialMap["glass"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_panel_glass_3.name = "Glass panel";
  if (endpoint_panel_glass_3) {
    mesh_panel_glass_3.position.copy(endpoint_panel_glass_3.midpoint);
    mesh_panel_glass_3.quaternion.copy(endpoint_panel_glass_3.quaternion);
  }
  mesh_panel_glass_3.castShadow = options.castShadow ?? true;
  mesh_panel_glass_3.receiveShadow = options.receiveShadow ?? true;
  mesh_panel_glass_3.userData.sculptComponent = {"id": "panel-glass", "name": "Glass panel", "level": "macro", "role": "body", "importance": 0.9, "confidence": 0.8, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Thin planar slab: a rounded quad extruded by panel thickness; flat faces carry a projected print.", "geometryDescriptor": {"profile2D": {"points": [[0.0, -2.59714], [0.00806, -2.68724], [0.03222, -2.76295], [0.0725, -2.82428], [0.12889, -2.87123], [0.20139, -2.90379], [0.29, -2.92197], [5.30347, -3.49185], [5.39208, -3.49381], [5.46458, -3.47773], [5.52097, -3.44361], [5.56124, -3.39143], [5.58541, -3.32121], [5.59347, -3.23295], [5.59347, 2.57742], [5.58541, 2.66751], [5.56124, 2.74323], [5.52097, 2.80455], [5.46458, 2.8515], [5.39208, 2.88405], [5.30346, 2.90223], [0.29, 3.47175], [0.20139, 3.47371], [0.12889, 3.45763], [0.0725, 3.42349], [0.03222, 3.37132], [0.00806, 3.3011], [0.0, 3.21283]], "depth": 0.06}, "edgeTreatment": {"type": "fillet-in-profile", "bevelRadius": 0.184, "segments": 6}, "uvStrategy": "reference-camera projection (UV = reference pixel of each vertex)", "projection": {"mode": "reference-camera-projection", "camera": "referenceCamera", "imageCorners": {"TL": [250, 290], "TR": [440, 245], "BR": [440, 840], "BL": [250, 695]}, "edgeDepths": {"left": 14.0, "right": 9.53}}, "topologyIntent": "planar slab", "deformationStack": [], "normalStrategy": "flat faces"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.0, "height": 1.0, "depth": 1.0, "units": "relative", "confidence": 0.5}, "transform": {"position": [-4.08822, 0.0, -3.03607], "rotation": [0.0, -0.92587, 0.0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-body", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [{"id": "panel-glass-face", "localPosition": [0, 0, 0], "normal": [0, 0, 1]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "panel-glass", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "glass"}}, "material": "glass", "materialLayers": ["glass"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(169, 52, 131, 1.0)", "secondaryAlbedo": "rgba(255, 255, 255, 0.3)", "materialClass": "glass", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "glass"}, "materialRegions": [{"regionId": "glass", "materialId": "glass", "profileId": "glass.clear", "crop": {"path": "evidence/material-evidence/01-glass.png", "bbox": {"x": 362, "y": 380, "width": 70, "height": 280}, "sourceWidth": 1024, "sourceHeight": 1024, "loaderWarnings": [], "coverage": 0.0187}}]};
  node_panel_glass_3.add(mesh_panel_glass_3);
  meshes["panel-glass"] = mesh_panel_glass_3;
  colliders["panel-glass"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["panel-glass"] ??= [];
  destructionGroups["panel-glass"].push(node_panel_glass_3);
  const socket_panel_glass_panel_glass_face_0 = new THREE.Object3D();
  socket_panel_glass_panel_glass_face_0.name = "panel-glass-face";
  socket_panel_glass_panel_glass_face_0.position.set(0.0, 0.0, 0.0);
  socket_panel_glass_panel_glass_face_0.rotation.set(0, 0, 0);
  socket_panel_glass_panel_glass_face_0.userData.socket = {"id": "panel-glass-face", "localPosition": [0, 0, 0], "normal": [0, 0, 1]};
  node_panel_glass_3.add(socket_panel_glass_panel_glass_face_0);
  sockets["panel-glass:panel-glass-face"] = socket_panel_glass_panel_glass_face_0;

  const endpoint_panel_glass_rim_4 = makeAttachmentEndpoint(null);
  const node_panel_glass_rim_4 = new THREE.Group();
  node_panel_glass_rim_4.name = "Glass panel rim frame__pivot";
  node_panel_glass_rim_4.scale.set(1, 1, 1);
  if (endpoint_panel_glass_rim_4) {
    node_panel_glass_rim_4.position.copy(endpoint_panel_glass_rim_4.start);
    node_panel_glass_rim_4.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_panel_glass_rim_4.position.set(0.0, 0.0, 0.012);
    node_panel_glass_rim_4.rotation.set(0.0, 0.0, 0.0);
  }
  node_panel_glass_rim_4.userData.sculptComponent = {"id": "panel-glass-rim", "name": "Glass panel rim frame", "level": "meso", "role": "trim", "importance": 0.6, "confidence": 0.8, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Emissive frame: outer rounded quad minus inset hole, extruded slightly proud of the slab.", "geometryDescriptor": {"profile2D": {"points": [[0.0, -2.59714], [0.00806, -2.68724], [0.03222, -2.76295], [0.0725, -2.82428], [0.12889, -2.87123], [0.20139, -2.90379], [0.29, -2.92197], [5.30347, -3.49185], [5.39208, -3.49381], [5.46458, -3.47773], [5.52097, -3.44361], [5.56124, -3.39143], [5.58541, -3.32121], [5.59347, -3.23295], [5.59347, 2.57742], [5.58541, 2.66751], [5.56124, 2.74323], [5.52097, 2.80455], [5.46458, 2.8515], [5.39208, 2.88405], [5.30346, 2.90223], [0.29, 3.47175], [0.20139, 3.47371], [0.12889, 3.45763], [0.0725, 3.42349], [0.03222, 3.37132], [0.00806, 3.3011], [0.0, 3.21283]], "holes": [[[0.1194, -2.60994], [0.12416, -2.66318], [0.13844, -2.70792], [0.16224, -2.74416], [0.19556, -2.7719], [0.2384, -2.79115], [0.29076, -2.80189], [5.3027, -3.37159], [5.35506, -3.37276], [5.3979, -3.36325], [5.43123, -3.34309], [5.45503, -3.31226], [5.46931, -3.27076], [5.47407, -3.21861], [5.47407, 2.59021], [5.46931, 2.64345], [5.45503, 2.68819], [5.43123, 2.72443], [5.3979, 2.75217], [5.35506, 2.77141], [5.3027, 2.78215], [0.29076, 3.3515], [0.2384, 3.35266], [0.19556, 3.34315], [0.16224, 3.32298], [0.13844, 3.29215], [0.12416, 3.25066], [0.1194, 3.1985]]], "depth": 0.096}, "edgeTreatment": {"type": "fillet-in-profile", "bevelRadius": 0.184, "segments": 6}, "uvStrategy": "generated procedural coordinates", "topologyIntent": "frame ring", "deformationStack": [], "normalStrategy": "flat faces"}, "parent": "panel-glass", "attachment": {"parentSocket": "panel-glass-face", "contactType": "overlap", "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "embed": 0.06, "gapTolerance": 0.0}, "dimensions": {"width": 1.0, "height": 1.0, "depth": 1.0, "units": "relative", "confidence": 0.5}, "transform": {"position": [0, 0, 0.012], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "attached-trim", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "panel-glass-rim", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "panel-rim-white"}}, "material": "panel-rim-white", "materialLayers": ["panel-rim-white"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "rim-glow", "type": "emissive-contour", "detailRef": "rim-glow-front"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "rimColor": "#BFF4FF", "colorMaterialRecipe": {"dominantAlbedo": "rgba(9, 153, 250, 1.0)", "secondaryAlbedo": "rgba(158, 235, 255, 1.0)", "materialClass": "glass", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "panel-rim-white"}, "materialRegions": [{"regionId": "rim", "materialId": "panel-rim-white", "profileId": "glass.clear", "crop": {"path": "evidence/material-evidence/03-rim.png", "bbox": {"x": 244, "y": 330, "width": 10, "height": 250}, "sourceWidth": 1024, "sourceHeight": 1024, "loaderWarnings": [], "coverage": 0.0024}}]};
  node_panel_glass_rim_4.userData.actionProfile = {"animationRole": "attached-trim", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "panel-glass-rim", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "panel-rim-white"}};
  (nodes["panel-glass"] ?? root).add(node_panel_glass_rim_4);
  nodes["panel-glass-rim"] = node_panel_glass_rim_4;
  const mesh_panel_glass_rim_4Geometry = endpoint_panel_glass_rim_4
    ? new THREE.CylinderGeometry(endpoint_panel_glass_rim_4.endRadius, endpoint_panel_glass_rim_4.baseRadius, endpoint_panel_glass_rim_4.length, 32, 12)
    : buildExtrudeGeometry({"points": [[0.0, -2.59714], [0.00806, -2.68724], [0.03222, -2.76295], [0.0725, -2.82428], [0.12889, -2.87123], [0.20139, -2.90379], [0.29, -2.92197], [5.30347, -3.49185], [5.39208, -3.49381], [5.46458, -3.47773], [5.52097, -3.44361], [5.56124, -3.39143], [5.58541, -3.32121], [5.59347, -3.23295], [5.59347, 2.57742], [5.58541, 2.66751], [5.56124, 2.74323], [5.52097, 2.80455], [5.46458, 2.8515], [5.39208, 2.88405], [5.30346, 2.90223], [0.29, 3.47175], [0.20139, 3.47371], [0.12889, 3.45763], [0.0725, 3.42349], [0.03222, 3.37132], [0.00806, 3.3011], [0.0, 3.21283]], "holes": [[[0.1194, -2.60994], [0.12416, -2.66318], [0.13844, -2.70792], [0.16224, -2.74416], [0.19556, -2.7719], [0.2384, -2.79115], [0.29076, -2.80189], [5.3027, -3.37159], [5.35506, -3.37276], [5.3979, -3.36325], [5.43123, -3.34309], [5.45503, -3.31226], [5.46931, -3.27076], [5.47407, -3.21861], [5.47407, 2.59021], [5.46931, 2.64345], [5.45503, 2.68819], [5.43123, 2.72443], [5.3979, 2.75217], [5.35506, 2.77141], [5.3027, 2.78215], [0.29076, 3.3515], [0.2384, 3.35266], [0.19556, 3.34315], [0.16224, 3.32298], [0.13844, 3.29215], [0.12416, 3.25066], [0.1194, 3.1985]]], "depth": 0.096});
  if (!endpoint_panel_glass_rim_4) {
    mesh_panel_glass_rim_4Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_panel_glass_rim_4 = new THREE.Mesh(
    mesh_panel_glass_rim_4Geometry,
    materialMap["panel-rim-white"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_panel_glass_rim_4.name = "Glass panel rim frame";
  if (endpoint_panel_glass_rim_4) {
    mesh_panel_glass_rim_4.position.copy(endpoint_panel_glass_rim_4.midpoint);
    mesh_panel_glass_rim_4.quaternion.copy(endpoint_panel_glass_rim_4.quaternion);
  }
  mesh_panel_glass_rim_4.castShadow = options.castShadow ?? true;
  mesh_panel_glass_rim_4.receiveShadow = options.receiveShadow ?? true;
  mesh_panel_glass_rim_4.userData.sculptComponent = {"id": "panel-glass-rim", "name": "Glass panel rim frame", "level": "meso", "role": "trim", "importance": 0.6, "confidence": 0.8, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Emissive frame: outer rounded quad minus inset hole, extruded slightly proud of the slab.", "geometryDescriptor": {"profile2D": {"points": [[0.0, -2.59714], [0.00806, -2.68724], [0.03222, -2.76295], [0.0725, -2.82428], [0.12889, -2.87123], [0.20139, -2.90379], [0.29, -2.92197], [5.30347, -3.49185], [5.39208, -3.49381], [5.46458, -3.47773], [5.52097, -3.44361], [5.56124, -3.39143], [5.58541, -3.32121], [5.59347, -3.23295], [5.59347, 2.57742], [5.58541, 2.66751], [5.56124, 2.74323], [5.52097, 2.80455], [5.46458, 2.8515], [5.39208, 2.88405], [5.30346, 2.90223], [0.29, 3.47175], [0.20139, 3.47371], [0.12889, 3.45763], [0.0725, 3.42349], [0.03222, 3.37132], [0.00806, 3.3011], [0.0, 3.21283]], "holes": [[[0.1194, -2.60994], [0.12416, -2.66318], [0.13844, -2.70792], [0.16224, -2.74416], [0.19556, -2.7719], [0.2384, -2.79115], [0.29076, -2.80189], [5.3027, -3.37159], [5.35506, -3.37276], [5.3979, -3.36325], [5.43123, -3.34309], [5.45503, -3.31226], [5.46931, -3.27076], [5.47407, -3.21861], [5.47407, 2.59021], [5.46931, 2.64345], [5.45503, 2.68819], [5.43123, 2.72443], [5.3979, 2.75217], [5.35506, 2.77141], [5.3027, 2.78215], [0.29076, 3.3515], [0.2384, 3.35266], [0.19556, 3.34315], [0.16224, 3.32298], [0.13844, 3.29215], [0.12416, 3.25066], [0.1194, 3.1985]]], "depth": 0.096}, "edgeTreatment": {"type": "fillet-in-profile", "bevelRadius": 0.184, "segments": 6}, "uvStrategy": "generated procedural coordinates", "topologyIntent": "frame ring", "deformationStack": [], "normalStrategy": "flat faces"}, "parent": "panel-glass", "attachment": {"parentSocket": "panel-glass-face", "contactType": "overlap", "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "embed": 0.06, "gapTolerance": 0.0}, "dimensions": {"width": 1.0, "height": 1.0, "depth": 1.0, "units": "relative", "confidence": 0.5}, "transform": {"position": [0, 0, 0.012], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "attached-trim", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "panel-glass-rim", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "panel-rim-white"}}, "material": "panel-rim-white", "materialLayers": ["panel-rim-white"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "rim-glow", "type": "emissive-contour", "detailRef": "rim-glow-front"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "rimColor": "#BFF4FF", "colorMaterialRecipe": {"dominantAlbedo": "rgba(9, 153, 250, 1.0)", "secondaryAlbedo": "rgba(158, 235, 255, 1.0)", "materialClass": "glass", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "panel-rim-white"}, "materialRegions": [{"regionId": "rim", "materialId": "panel-rim-white", "profileId": "glass.clear", "crop": {"path": "evidence/material-evidence/03-rim.png", "bbox": {"x": 244, "y": 330, "width": 10, "height": 250}, "sourceWidth": 1024, "sourceHeight": 1024, "loaderWarnings": [], "coverage": 0.0024}}]};
  node_panel_glass_rim_4.add(mesh_panel_glass_rim_4);
  meshes["panel-glass-rim"] = mesh_panel_glass_rim_4;
  colliders["panel-glass-rim"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["panel-glass-rim"] ??= [];
  destructionGroups["panel-glass-rim"].push(node_panel_glass_rim_4);

  const endpoint_panel_middle_5 = makeAttachmentEndpoint(null);
  const node_panel_middle_5 = new THREE.Group();
  node_panel_middle_5.name = "Middle panel (column)__pivot";
  node_panel_middle_5.scale.set(1, 1, 1);
  if (endpoint_panel_middle_5) {
    node_panel_middle_5.position.copy(endpoint_panel_middle_5.start);
    node_panel_middle_5.rotation.set(0.0, -0.86838, 0.0);
  } else {
    node_panel_middle_5.position.set(-2.07867, 0.0, -1.03876);
    node_panel_middle_5.rotation.set(0.0, -0.86838, 0.0);
  }
  node_panel_middle_5.userData.sculptComponent = {"id": "panel-middle", "name": "Middle panel (column)", "level": "macro", "role": "body", "importance": 0.9, "confidence": 0.8, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Thin planar slab: a rounded quad extruded by panel thickness; flat faces carry a projected print.", "geometryDescriptor": {"profile2D": {"points": [[0.0, -2.81989], [0.00737, -2.90112], [0.02947, -2.9679], [0.06632, -3.02025], [0.1179, -3.05815], [0.18421, -3.08163], [0.26527, -3.09066], [3.15417, -3.14993], [3.23523, -3.14423], [3.30154, -3.12348], [3.35312, -3.08769], [3.38996, -3.03685], [3.41207, -2.97097], [3.41944, -2.89006], [3.41944, 3.40889], [3.41207, 3.49004], [3.38996, 3.55658], [3.35311, 3.60853], [3.30152, 3.64589], [3.2352, 3.66865], [3.15413, 3.67681], [0.26531, 3.70508], [0.18424, 3.6985], [0.11792, 3.67704], [0.06633, 3.64069], [0.02948, 3.58946], [0.00737, 3.52335], [0.0, 3.44235]], "depth": 0.06}, "edgeTreatment": {"type": "fillet-in-profile", "bevelRadius": 0.1673, "segments": 6}, "uvStrategy": "reference-camera projection (UV = reference pixel of each vertex)", "projection": {"mode": "reference-camera-projection", "camera": "referenceCamera", "imageCorners": {"TL": [355, 238], "TR": [520, 165], "BR": [520, 810], "BL": [355, 740]}, "edgeDepths": {"left": 12.0, "right": 9.39}}, "topologyIntent": "planar slab", "deformationStack": [], "normalStrategy": "flat faces"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.0, "height": 1.0, "depth": 1.0, "units": "relative", "confidence": 0.5}, "transform": {"position": [-2.07867, 0.0, -1.03876], "rotation": [0.0, -0.86838, 0.0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-body", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [{"id": "panel-middle-face", "localPosition": [0, 0, 0], "normal": [0, 0, 1]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "panel-middle", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "printed-panel"}}, "material": "printed-panel", "materialLayers": ["printed-panel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "projected-print", "type": "projected-decal", "detailRef": "printed-column"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(1, 168, 250, 1.0)", "secondaryAlbedo": "rgba(214, 0, 18, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}};
  node_panel_middle_5.userData.actionProfile = {"animationRole": "static-body", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [{"id": "panel-middle-face", "localPosition": [0, 0, 0], "normal": [0, 0, 1]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "panel-middle", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "printed-panel"}};
  (nodes["root"] ?? root).add(node_panel_middle_5);
  nodes["panel-middle"] = node_panel_middle_5;
  const mesh_panel_middle_5Geometry = endpoint_panel_middle_5
    ? new THREE.CylinderGeometry(endpoint_panel_middle_5.endRadius, endpoint_panel_middle_5.baseRadius, endpoint_panel_middle_5.length, 32, 12)
    : buildExtrudeGeometry({"points": [[0.0, -2.81989], [0.00737, -2.90112], [0.02947, -2.9679], [0.06632, -3.02025], [0.1179, -3.05815], [0.18421, -3.08163], [0.26527, -3.09066], [3.15417, -3.14993], [3.23523, -3.14423], [3.30154, -3.12348], [3.35312, -3.08769], [3.38996, -3.03685], [3.41207, -2.97097], [3.41944, -2.89006], [3.41944, 3.40889], [3.41207, 3.49004], [3.38996, 3.55658], [3.35311, 3.60853], [3.30152, 3.64589], [3.2352, 3.66865], [3.15413, 3.67681], [0.26531, 3.70508], [0.18424, 3.6985], [0.11792, 3.67704], [0.06633, 3.64069], [0.02948, 3.58946], [0.00737, 3.52335], [0.0, 3.44235]], "depth": 0.06});
  if (!endpoint_panel_middle_5) {
    mesh_panel_middle_5Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_panel_middle_5 = new THREE.Mesh(
    mesh_panel_middle_5Geometry,
    materialMap["printed-panel"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_panel_middle_5.name = "Middle panel (column)";
  if (endpoint_panel_middle_5) {
    mesh_panel_middle_5.position.copy(endpoint_panel_middle_5.midpoint);
    mesh_panel_middle_5.quaternion.copy(endpoint_panel_middle_5.quaternion);
  }
  mesh_panel_middle_5.castShadow = options.castShadow ?? true;
  mesh_panel_middle_5.receiveShadow = options.receiveShadow ?? true;
  mesh_panel_middle_5.userData.sculptComponent = {"id": "panel-middle", "name": "Middle panel (column)", "level": "macro", "role": "body", "importance": 0.9, "confidence": 0.8, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Thin planar slab: a rounded quad extruded by panel thickness; flat faces carry a projected print.", "geometryDescriptor": {"profile2D": {"points": [[0.0, -2.81989], [0.00737, -2.90112], [0.02947, -2.9679], [0.06632, -3.02025], [0.1179, -3.05815], [0.18421, -3.08163], [0.26527, -3.09066], [3.15417, -3.14993], [3.23523, -3.14423], [3.30154, -3.12348], [3.35312, -3.08769], [3.38996, -3.03685], [3.41207, -2.97097], [3.41944, -2.89006], [3.41944, 3.40889], [3.41207, 3.49004], [3.38996, 3.55658], [3.35311, 3.60853], [3.30152, 3.64589], [3.2352, 3.66865], [3.15413, 3.67681], [0.26531, 3.70508], [0.18424, 3.6985], [0.11792, 3.67704], [0.06633, 3.64069], [0.02948, 3.58946], [0.00737, 3.52335], [0.0, 3.44235]], "depth": 0.06}, "edgeTreatment": {"type": "fillet-in-profile", "bevelRadius": 0.1673, "segments": 6}, "uvStrategy": "reference-camera projection (UV = reference pixel of each vertex)", "projection": {"mode": "reference-camera-projection", "camera": "referenceCamera", "imageCorners": {"TL": [355, 238], "TR": [520, 165], "BR": [520, 810], "BL": [355, 740]}, "edgeDepths": {"left": 12.0, "right": 9.39}}, "topologyIntent": "planar slab", "deformationStack": [], "normalStrategy": "flat faces"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.0, "height": 1.0, "depth": 1.0, "units": "relative", "confidence": 0.5}, "transform": {"position": [-2.07867, 0.0, -1.03876], "rotation": [0.0, -0.86838, 0.0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-body", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [{"id": "panel-middle-face", "localPosition": [0, 0, 0], "normal": [0, 0, 1]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "panel-middle", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "printed-panel"}}, "material": "printed-panel", "materialLayers": ["printed-panel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "projected-print", "type": "projected-decal", "detailRef": "printed-column"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(1, 168, 250, 1.0)", "secondaryAlbedo": "rgba(214, 0, 18, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}};
  node_panel_middle_5.add(mesh_panel_middle_5);
  meshes["panel-middle"] = mesh_panel_middle_5;
  colliders["panel-middle"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["panel-middle"] ??= [];
  destructionGroups["panel-middle"].push(node_panel_middle_5);
  const socket_panel_middle_panel_middle_face_0 = new THREE.Object3D();
  socket_panel_middle_panel_middle_face_0.name = "panel-middle-face";
  socket_panel_middle_panel_middle_face_0.position.set(0.0, 0.0, 0.0);
  socket_panel_middle_panel_middle_face_0.rotation.set(0, 0, 0);
  socket_panel_middle_panel_middle_face_0.userData.socket = {"id": "panel-middle-face", "localPosition": [0, 0, 0], "normal": [0, 0, 1]};
  node_panel_middle_5.add(socket_panel_middle_panel_middle_face_0);
  sockets["panel-middle:panel-middle-face"] = socket_panel_middle_panel_middle_face_0;

  const endpoint_panel_middle_rim_6 = makeAttachmentEndpoint(null);
  const node_panel_middle_rim_6 = new THREE.Group();
  node_panel_middle_rim_6.name = "Middle panel (column) rim frame__pivot";
  node_panel_middle_rim_6.scale.set(1, 1, 1);
  if (endpoint_panel_middle_rim_6) {
    node_panel_middle_rim_6.position.copy(endpoint_panel_middle_rim_6.start);
    node_panel_middle_rim_6.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_panel_middle_rim_6.position.set(0.0, 0.0, 0.012);
    node_panel_middle_rim_6.rotation.set(0.0, 0.0, 0.0);
  }
  node_panel_middle_rim_6.userData.sculptComponent = {"id": "panel-middle-rim", "name": "Middle panel (column) rim frame", "level": "meso", "role": "trim", "importance": 0.6, "confidence": 0.8, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Emissive frame: outer rounded quad minus inset hole, extruded slightly proud of the slab.", "geometryDescriptor": {"profile2D": {"points": [[0.0, -2.81989], [0.00737, -2.90112], [0.02947, -2.9679], [0.06632, -3.02025], [0.1179, -3.05815], [0.18421, -3.08163], [0.26527, -3.09066], [3.15417, -3.14993], [3.23523, -3.14423], [3.30154, -3.12348], [3.35312, -3.08769], [3.38996, -3.03685], [3.41207, -2.97097], [3.41944, -2.89006], [3.41944, 3.40889], [3.41207, 3.49004], [3.38996, 3.55658], [3.35311, 3.60853], [3.30152, 3.64589], [3.2352, 3.66865], [3.15413, 3.67681], [0.26531, 3.70508], [0.18424, 3.6985], [0.11792, 3.67704], [0.06633, 3.64069], [0.02948, 3.58946], [0.00737, 3.52335], [0.0, 3.44235]], "holes": [[[0.10854, -2.8221], [0.11289, -2.87009], [0.12596, -2.90956], [0.14773, -2.94049], [0.17821, -2.96289], [0.21739, -2.97676], [0.26529, -2.9821], [3.15415, -3.04137], [3.20205, -3.038], [3.24123, -3.02574], [3.27171, -3.00459], [3.29348, -2.97455], [3.30654, -2.93562], [3.3109, -2.88781], [3.3109, 3.40995], [3.30654, 3.4579], [3.29348, 3.49722], [3.2717, 3.52792], [3.24122, 3.54999], [3.20203, 3.56344], [3.15412, 3.56826], [0.26531, 3.59653], [0.21741, 3.59264], [0.17822, 3.57996], [0.14773, 3.55848], [0.12596, 3.52821], [0.1129, 3.48915], [0.10854, 3.44128]]], "depth": 0.096}, "edgeTreatment": {"type": "fillet-in-profile", "bevelRadius": 0.1673, "segments": 6}, "uvStrategy": "generated procedural coordinates", "topologyIntent": "frame ring", "deformationStack": [], "normalStrategy": "flat faces"}, "parent": "panel-middle", "attachment": {"parentSocket": "panel-middle-face", "contactType": "overlap", "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "embed": 0.06, "gapTolerance": 0.0}, "dimensions": {"width": 1.0, "height": 1.0, "depth": 1.0, "units": "relative", "confidence": 0.5}, "transform": {"position": [0, 0, 0.012], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "attached-trim", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "panel-middle-rim", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "panel-rim-red"}}, "material": "panel-rim-red", "materialLayers": ["panel-rim-red"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "panel-middle-rim-rim-glow", "type": "emissive-contour", "detailRef": "rim-glow-middle"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "rimColor": "#FF2A2A", "colorMaterialRecipe": {"dominantAlbedo": "rgba(241, 31, 85, 1.0)", "secondaryAlbedo": "rgba(255, 42, 42, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "panel-rim-red"}, "materialRegions": [{"regionId": "rim", "materialId": "panel-rim-red", "profileId": "plastic.glossy", "crop": {"path": "evidence/material-evidence/04-rim.png", "bbox": {"x": 512, "y": 200, "width": 10, "height": 300}, "sourceWidth": 1024, "sourceHeight": 1024, "loaderWarnings": [], "coverage": 0.0029}}]};
  node_panel_middle_rim_6.userData.actionProfile = {"animationRole": "attached-trim", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "panel-middle-rim", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "panel-rim-red"}};
  (nodes["panel-middle"] ?? root).add(node_panel_middle_rim_6);
  nodes["panel-middle-rim"] = node_panel_middle_rim_6;
  const mesh_panel_middle_rim_6Geometry = endpoint_panel_middle_rim_6
    ? new THREE.CylinderGeometry(endpoint_panel_middle_rim_6.endRadius, endpoint_panel_middle_rim_6.baseRadius, endpoint_panel_middle_rim_6.length, 32, 12)
    : buildExtrudeGeometry({"points": [[0.0, -2.81989], [0.00737, -2.90112], [0.02947, -2.9679], [0.06632, -3.02025], [0.1179, -3.05815], [0.18421, -3.08163], [0.26527, -3.09066], [3.15417, -3.14993], [3.23523, -3.14423], [3.30154, -3.12348], [3.35312, -3.08769], [3.38996, -3.03685], [3.41207, -2.97097], [3.41944, -2.89006], [3.41944, 3.40889], [3.41207, 3.49004], [3.38996, 3.55658], [3.35311, 3.60853], [3.30152, 3.64589], [3.2352, 3.66865], [3.15413, 3.67681], [0.26531, 3.70508], [0.18424, 3.6985], [0.11792, 3.67704], [0.06633, 3.64069], [0.02948, 3.58946], [0.00737, 3.52335], [0.0, 3.44235]], "holes": [[[0.10854, -2.8221], [0.11289, -2.87009], [0.12596, -2.90956], [0.14773, -2.94049], [0.17821, -2.96289], [0.21739, -2.97676], [0.26529, -2.9821], [3.15415, -3.04137], [3.20205, -3.038], [3.24123, -3.02574], [3.27171, -3.00459], [3.29348, -2.97455], [3.30654, -2.93562], [3.3109, -2.88781], [3.3109, 3.40995], [3.30654, 3.4579], [3.29348, 3.49722], [3.2717, 3.52792], [3.24122, 3.54999], [3.20203, 3.56344], [3.15412, 3.56826], [0.26531, 3.59653], [0.21741, 3.59264], [0.17822, 3.57996], [0.14773, 3.55848], [0.12596, 3.52821], [0.1129, 3.48915], [0.10854, 3.44128]]], "depth": 0.096});
  if (!endpoint_panel_middle_rim_6) {
    mesh_panel_middle_rim_6Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_panel_middle_rim_6 = new THREE.Mesh(
    mesh_panel_middle_rim_6Geometry,
    materialMap["panel-rim-red"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_panel_middle_rim_6.name = "Middle panel (column) rim frame";
  if (endpoint_panel_middle_rim_6) {
    mesh_panel_middle_rim_6.position.copy(endpoint_panel_middle_rim_6.midpoint);
    mesh_panel_middle_rim_6.quaternion.copy(endpoint_panel_middle_rim_6.quaternion);
  }
  mesh_panel_middle_rim_6.castShadow = options.castShadow ?? true;
  mesh_panel_middle_rim_6.receiveShadow = options.receiveShadow ?? true;
  mesh_panel_middle_rim_6.userData.sculptComponent = {"id": "panel-middle-rim", "name": "Middle panel (column) rim frame", "level": "meso", "role": "trim", "importance": 0.6, "confidence": 0.8, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Emissive frame: outer rounded quad minus inset hole, extruded slightly proud of the slab.", "geometryDescriptor": {"profile2D": {"points": [[0.0, -2.81989], [0.00737, -2.90112], [0.02947, -2.9679], [0.06632, -3.02025], [0.1179, -3.05815], [0.18421, -3.08163], [0.26527, -3.09066], [3.15417, -3.14993], [3.23523, -3.14423], [3.30154, -3.12348], [3.35312, -3.08769], [3.38996, -3.03685], [3.41207, -2.97097], [3.41944, -2.89006], [3.41944, 3.40889], [3.41207, 3.49004], [3.38996, 3.55658], [3.35311, 3.60853], [3.30152, 3.64589], [3.2352, 3.66865], [3.15413, 3.67681], [0.26531, 3.70508], [0.18424, 3.6985], [0.11792, 3.67704], [0.06633, 3.64069], [0.02948, 3.58946], [0.00737, 3.52335], [0.0, 3.44235]], "holes": [[[0.10854, -2.8221], [0.11289, -2.87009], [0.12596, -2.90956], [0.14773, -2.94049], [0.17821, -2.96289], [0.21739, -2.97676], [0.26529, -2.9821], [3.15415, -3.04137], [3.20205, -3.038], [3.24123, -3.02574], [3.27171, -3.00459], [3.29348, -2.97455], [3.30654, -2.93562], [3.3109, -2.88781], [3.3109, 3.40995], [3.30654, 3.4579], [3.29348, 3.49722], [3.2717, 3.52792], [3.24122, 3.54999], [3.20203, 3.56344], [3.15412, 3.56826], [0.26531, 3.59653], [0.21741, 3.59264], [0.17822, 3.57996], [0.14773, 3.55848], [0.12596, 3.52821], [0.1129, 3.48915], [0.10854, 3.44128]]], "depth": 0.096}, "edgeTreatment": {"type": "fillet-in-profile", "bevelRadius": 0.1673, "segments": 6}, "uvStrategy": "generated procedural coordinates", "topologyIntent": "frame ring", "deformationStack": [], "normalStrategy": "flat faces"}, "parent": "panel-middle", "attachment": {"parentSocket": "panel-middle-face", "contactType": "overlap", "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "embed": 0.06, "gapTolerance": 0.0}, "dimensions": {"width": 1.0, "height": 1.0, "depth": 1.0, "units": "relative", "confidence": 0.5}, "transform": {"position": [0, 0, 0.012], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "attached-trim", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "panel-middle-rim", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "panel-rim-red"}}, "material": "panel-rim-red", "materialLayers": ["panel-rim-red"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "panel-middle-rim-rim-glow", "type": "emissive-contour", "detailRef": "rim-glow-middle"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "rimColor": "#FF2A2A", "colorMaterialRecipe": {"dominantAlbedo": "rgba(241, 31, 85, 1.0)", "secondaryAlbedo": "rgba(255, 42, 42, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "panel-rim-red"}, "materialRegions": [{"regionId": "rim", "materialId": "panel-rim-red", "profileId": "plastic.glossy", "crop": {"path": "evidence/material-evidence/04-rim.png", "bbox": {"x": 512, "y": 200, "width": 10, "height": 300}, "sourceWidth": 1024, "sourceHeight": 1024, "loaderWarnings": [], "coverage": 0.0029}}]};
  node_panel_middle_rim_6.add(mesh_panel_middle_rim_6);
  meshes["panel-middle-rim"] = mesh_panel_middle_rim_6;
  colliders["panel-middle-rim"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["panel-middle-rim"] ??= [];
  destructionGroups["panel-middle-rim"].push(node_panel_middle_rim_6);

  const endpoint_panel_back_7 = makeAttachmentEndpoint(null);
  const node_panel_back_7 = new THREE.Group();
  node_panel_back_7.name = "Back panel (relief)__pivot";
  node_panel_back_7.scale.set(1, 1, 1);
  if (endpoint_panel_back_7) {
    node_panel_back_7.position.copy(endpoint_panel_back_7.start);
    node_panel_back_7.rotation.set(0.0, -0.92635, 0.0);
  } else {
    node_panel_back_7.position.set(0.1472, 0.0, -0.03605);
    node_panel_back_7.rotation.set(0.0, -0.92635, 0.0);
  }
  node_panel_back_7.userData.sculptComponent = {"id": "panel-back", "name": "Back panel (relief)", "level": "macro", "role": "body", "importance": 0.9, "confidence": 0.8, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Thin planar slab: a rounded quad extruded by panel thickness; flat faces carry a projected print.", "geometryDescriptor": {"profile2D": {"points": [[0.0, -2.45252], [0.00699, -2.52937], [0.02795, -2.59222], [0.06289, -2.64106], [0.1118, -2.6759], [0.17469, -2.69674], [0.25155, -2.70358], [1.89997, -2.70033], [1.97684, -2.69319], [2.03973, -2.6721], [2.08864, -2.63707], [2.12358, -2.58809], [2.14454, -2.52516], [2.15153, -2.44828], [2.15153, 2.8564], [2.14454, 2.93324], [2.12358, 2.99606], [2.08864, 3.04486], [2.03973, 3.07964], [1.97684, 3.1004], [1.89997, 3.10714], [0.25155, 3.10181], [0.17469, 3.09458], [0.1118, 3.07341], [0.06289, 3.03832], [0.02795, 2.98929], [0.00699, 2.92634], [0.0, 2.84945]], "depth": 0.06}, "edgeTreatment": {"type": "fillet-in-profile", "bevelRadius": 0.1586, "segments": 6}, "uvStrategy": "reference-camera projection (UV = reference pixel of each vertex)", "projection": {"mode": "reference-camera-projection", "camera": "referenceCamera", "imageCorners": {"TL": [520, 262], "TR": [645, 215], "BR": [645, 770], "BL": [520, 730]}, "edgeDepths": {"left": 11.0, "right": 9.28}}, "topologyIntent": "planar slab", "deformationStack": [], "normalStrategy": "flat faces"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.0, "height": 1.0, "depth": 1.0, "units": "relative", "confidence": 0.5}, "transform": {"position": [0.1472, 0.0, -0.03605], "rotation": [0.0, -0.92635, 0.0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-body", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [{"id": "panel-back-face", "localPosition": [0, 0, 0], "normal": [0, 0, 1]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "panel-back", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "printed-panel"}}, "material": "printed-panel", "materialLayers": ["printed-panel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "projected-print", "type": "projected-decal", "detailRef": "printed-column"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(1, 168, 250, 1.0)", "secondaryAlbedo": "rgba(214, 0, 18, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}};
  node_panel_back_7.userData.actionProfile = {"animationRole": "static-body", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [{"id": "panel-back-face", "localPosition": [0, 0, 0], "normal": [0, 0, 1]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "panel-back", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "printed-panel"}};
  (nodes["root"] ?? root).add(node_panel_back_7);
  nodes["panel-back"] = node_panel_back_7;
  const mesh_panel_back_7Geometry = endpoint_panel_back_7
    ? new THREE.CylinderGeometry(endpoint_panel_back_7.endRadius, endpoint_panel_back_7.baseRadius, endpoint_panel_back_7.length, 32, 12)
    : buildExtrudeGeometry({"points": [[0.0, -2.45252], [0.00699, -2.52937], [0.02795, -2.59222], [0.06289, -2.64106], [0.1118, -2.6759], [0.17469, -2.69674], [0.25155, -2.70358], [1.89997, -2.70033], [1.97684, -2.69319], [2.03973, -2.6721], [2.08864, -2.63707], [2.12358, -2.58809], [2.14454, -2.52516], [2.15153, -2.44828], [2.15153, 2.8564], [2.14454, 2.93324], [2.12358, 2.99606], [2.08864, 3.04486], [2.03973, 3.07964], [1.97684, 3.1004], [1.89997, 3.10714], [0.25155, 3.10181], [0.17469, 3.09458], [0.1118, 3.07341], [0.06289, 3.03832], [0.02795, 2.98929], [0.00699, 2.92634], [0.0, 2.84945]], "depth": 0.06});
  if (!endpoint_panel_back_7) {
    mesh_panel_back_7Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_panel_back_7 = new THREE.Mesh(
    mesh_panel_back_7Geometry,
    materialMap["printed-panel"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_panel_back_7.name = "Back panel (relief)";
  if (endpoint_panel_back_7) {
    mesh_panel_back_7.position.copy(endpoint_panel_back_7.midpoint);
    mesh_panel_back_7.quaternion.copy(endpoint_panel_back_7.quaternion);
  }
  mesh_panel_back_7.castShadow = options.castShadow ?? true;
  mesh_panel_back_7.receiveShadow = options.receiveShadow ?? true;
  mesh_panel_back_7.userData.sculptComponent = {"id": "panel-back", "name": "Back panel (relief)", "level": "macro", "role": "body", "importance": 0.9, "confidence": 0.8, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Thin planar slab: a rounded quad extruded by panel thickness; flat faces carry a projected print.", "geometryDescriptor": {"profile2D": {"points": [[0.0, -2.45252], [0.00699, -2.52937], [0.02795, -2.59222], [0.06289, -2.64106], [0.1118, -2.6759], [0.17469, -2.69674], [0.25155, -2.70358], [1.89997, -2.70033], [1.97684, -2.69319], [2.03973, -2.6721], [2.08864, -2.63707], [2.12358, -2.58809], [2.14454, -2.52516], [2.15153, -2.44828], [2.15153, 2.8564], [2.14454, 2.93324], [2.12358, 2.99606], [2.08864, 3.04486], [2.03973, 3.07964], [1.97684, 3.1004], [1.89997, 3.10714], [0.25155, 3.10181], [0.17469, 3.09458], [0.1118, 3.07341], [0.06289, 3.03832], [0.02795, 2.98929], [0.00699, 2.92634], [0.0, 2.84945]], "depth": 0.06}, "edgeTreatment": {"type": "fillet-in-profile", "bevelRadius": 0.1586, "segments": 6}, "uvStrategy": "reference-camera projection (UV = reference pixel of each vertex)", "projection": {"mode": "reference-camera-projection", "camera": "referenceCamera", "imageCorners": {"TL": [520, 262], "TR": [645, 215], "BR": [645, 770], "BL": [520, 730]}, "edgeDepths": {"left": 11.0, "right": 9.28}}, "topologyIntent": "planar slab", "deformationStack": [], "normalStrategy": "flat faces"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.0, "height": 1.0, "depth": 1.0, "units": "relative", "confidence": 0.5}, "transform": {"position": [0.1472, 0.0, -0.03605], "rotation": [0.0, -0.92635, 0.0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-body", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [{"id": "panel-back-face", "localPosition": [0, 0, 0], "normal": [0, 0, 1]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "panel-back", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "printed-panel"}}, "material": "printed-panel", "materialLayers": ["printed-panel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "projected-print", "type": "projected-decal", "detailRef": "printed-column"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(1, 168, 250, 1.0)", "secondaryAlbedo": "rgba(214, 0, 18, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}};
  node_panel_back_7.add(mesh_panel_back_7);
  meshes["panel-back"] = mesh_panel_back_7;
  colliders["panel-back"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["panel-back"] ??= [];
  destructionGroups["panel-back"].push(node_panel_back_7);
  const socket_panel_back_panel_back_face_0 = new THREE.Object3D();
  socket_panel_back_panel_back_face_0.name = "panel-back-face";
  socket_panel_back_panel_back_face_0.position.set(0.0, 0.0, 0.0);
  socket_panel_back_panel_back_face_0.rotation.set(0, 0, 0);
  socket_panel_back_panel_back_face_0.userData.socket = {"id": "panel-back-face", "localPosition": [0, 0, 0], "normal": [0, 0, 1]};
  node_panel_back_7.add(socket_panel_back_panel_back_face_0);
  sockets["panel-back:panel-back-face"] = socket_panel_back_panel_back_face_0;

  const endpoint_panel_back_rim_8 = makeAttachmentEndpoint(null);
  const node_panel_back_rim_8 = new THREE.Group();
  node_panel_back_rim_8.name = "Back panel (relief) rim frame__pivot";
  node_panel_back_rim_8.scale.set(1, 1, 1);
  if (endpoint_panel_back_rim_8) {
    node_panel_back_rim_8.position.copy(endpoint_panel_back_rim_8.start);
    node_panel_back_rim_8.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_panel_back_rim_8.position.set(0.0, 0.0, 0.012);
    node_panel_back_rim_8.rotation.set(0.0, 0.0, 0.0);
  }
  node_panel_back_rim_8.userData.sculptComponent = {"id": "panel-back-rim", "name": "Back panel (relief) rim frame", "level": "meso", "role": "trim", "importance": 0.6, "confidence": 0.8, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Emissive frame: outer rounded quad minus inset hole, extruded slightly proud of the slab.", "geometryDescriptor": {"profile2D": {"points": [[0.0, -2.45252], [0.00699, -2.52937], [0.02795, -2.59222], [0.06289, -2.64106], [0.1118, -2.6759], [0.17469, -2.69674], [0.25155, -2.70358], [1.89997, -2.70033], [1.97684, -2.69319], [2.03973, -2.6721], [2.08864, -2.63707], [2.12358, -2.58809], [2.14454, -2.52516], [2.15153, -2.44828], [2.15153, 2.8564], [2.14454, 2.93324], [2.12358, 2.99606], [2.08864, 3.04486], [2.03973, 3.07964], [1.97684, 3.1004], [1.89997, 3.10714], [0.25155, 3.10181], [0.17469, 3.09458], [0.1118, 3.07341], [0.06289, 3.03832], [0.02795, 2.98929], [0.00699, 2.92634], [0.0, 2.84945]], "holes": [[[0.10291, -2.45232], [0.10704, -2.49773], [0.11942, -2.53487], [0.14007, -2.56373], [0.16897, -2.58432], [0.20613, -2.59663], [0.25155, -2.60067], [1.89997, -2.59742], [1.94539, -2.5932], [1.98255, -2.58074], [2.01146, -2.56004], [2.0321, -2.5311], [2.04449, -2.49391], [2.04862, -2.44848], [2.04862, 2.85606], [2.04449, 2.90147], [2.0321, 2.93859], [2.01146, 2.96743], [1.98255, 2.98798], [1.94539, 3.00025], [1.89997, 3.00423], [0.25155, 2.99891], [0.20613, 2.99463], [0.16897, 2.98212], [0.14007, 2.96138], [0.11942, 2.93241], [0.10704, 2.89521], [0.10291, 2.84978]]], "depth": 0.096}, "edgeTreatment": {"type": "fillet-in-profile", "bevelRadius": 0.1586, "segments": 6}, "uvStrategy": "generated procedural coordinates", "topologyIntent": "frame ring", "deformationStack": [], "normalStrategy": "flat faces"}, "parent": "panel-back", "attachment": {"parentSocket": "panel-back-face", "contactType": "overlap", "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "embed": 0.06, "gapTolerance": 0.0}, "dimensions": {"width": 1.0, "height": 1.0, "depth": 1.0, "units": "relative", "confidence": 0.5}, "transform": {"position": [0, 0, 0.012], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "attached-trim", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "panel-back-rim", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "panel-rim-sky"}}, "material": "panel-rim-sky", "materialLayers": ["panel-rim-sky"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "panel-back-rim-rim-glow", "type": "emissive-contour", "detailRef": "rim-glow-back"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "rimColor": "#2AA8FF", "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 102, 185, 1.0)", "secondaryAlbedo": "rgba(42, 168, 255, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "panel-rim-sky"}, "materialRegions": [{"regionId": "rim", "materialId": "panel-rim-sky", "profileId": "plastic.glossy", "crop": {"path": "evidence/material-evidence/05-rim.png", "bbox": {"x": 639, "y": 240, "width": 8, "height": 200}, "sourceWidth": 1024, "sourceHeight": 1024, "loaderWarnings": [], "coverage": 0.0015}}]};
  node_panel_back_rim_8.userData.actionProfile = {"animationRole": "attached-trim", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "panel-back-rim", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "panel-rim-sky"}};
  (nodes["panel-back"] ?? root).add(node_panel_back_rim_8);
  nodes["panel-back-rim"] = node_panel_back_rim_8;
  const mesh_panel_back_rim_8Geometry = endpoint_panel_back_rim_8
    ? new THREE.CylinderGeometry(endpoint_panel_back_rim_8.endRadius, endpoint_panel_back_rim_8.baseRadius, endpoint_panel_back_rim_8.length, 32, 12)
    : buildExtrudeGeometry({"points": [[0.0, -2.45252], [0.00699, -2.52937], [0.02795, -2.59222], [0.06289, -2.64106], [0.1118, -2.6759], [0.17469, -2.69674], [0.25155, -2.70358], [1.89997, -2.70033], [1.97684, -2.69319], [2.03973, -2.6721], [2.08864, -2.63707], [2.12358, -2.58809], [2.14454, -2.52516], [2.15153, -2.44828], [2.15153, 2.8564], [2.14454, 2.93324], [2.12358, 2.99606], [2.08864, 3.04486], [2.03973, 3.07964], [1.97684, 3.1004], [1.89997, 3.10714], [0.25155, 3.10181], [0.17469, 3.09458], [0.1118, 3.07341], [0.06289, 3.03832], [0.02795, 2.98929], [0.00699, 2.92634], [0.0, 2.84945]], "holes": [[[0.10291, -2.45232], [0.10704, -2.49773], [0.11942, -2.53487], [0.14007, -2.56373], [0.16897, -2.58432], [0.20613, -2.59663], [0.25155, -2.60067], [1.89997, -2.59742], [1.94539, -2.5932], [1.98255, -2.58074], [2.01146, -2.56004], [2.0321, -2.5311], [2.04449, -2.49391], [2.04862, -2.44848], [2.04862, 2.85606], [2.04449, 2.90147], [2.0321, 2.93859], [2.01146, 2.96743], [1.98255, 2.98798], [1.94539, 3.00025], [1.89997, 3.00423], [0.25155, 2.99891], [0.20613, 2.99463], [0.16897, 2.98212], [0.14007, 2.96138], [0.11942, 2.93241], [0.10704, 2.89521], [0.10291, 2.84978]]], "depth": 0.096});
  if (!endpoint_panel_back_rim_8) {
    mesh_panel_back_rim_8Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_panel_back_rim_8 = new THREE.Mesh(
    mesh_panel_back_rim_8Geometry,
    materialMap["panel-rim-sky"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_panel_back_rim_8.name = "Back panel (relief) rim frame";
  if (endpoint_panel_back_rim_8) {
    mesh_panel_back_rim_8.position.copy(endpoint_panel_back_rim_8.midpoint);
    mesh_panel_back_rim_8.quaternion.copy(endpoint_panel_back_rim_8.quaternion);
  }
  mesh_panel_back_rim_8.castShadow = options.castShadow ?? true;
  mesh_panel_back_rim_8.receiveShadow = options.receiveShadow ?? true;
  mesh_panel_back_rim_8.userData.sculptComponent = {"id": "panel-back-rim", "name": "Back panel (relief) rim frame", "level": "meso", "role": "trim", "importance": 0.6, "confidence": 0.8, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Emissive frame: outer rounded quad minus inset hole, extruded slightly proud of the slab.", "geometryDescriptor": {"profile2D": {"points": [[0.0, -2.45252], [0.00699, -2.52937], [0.02795, -2.59222], [0.06289, -2.64106], [0.1118, -2.6759], [0.17469, -2.69674], [0.25155, -2.70358], [1.89997, -2.70033], [1.97684, -2.69319], [2.03973, -2.6721], [2.08864, -2.63707], [2.12358, -2.58809], [2.14454, -2.52516], [2.15153, -2.44828], [2.15153, 2.8564], [2.14454, 2.93324], [2.12358, 2.99606], [2.08864, 3.04486], [2.03973, 3.07964], [1.97684, 3.1004], [1.89997, 3.10714], [0.25155, 3.10181], [0.17469, 3.09458], [0.1118, 3.07341], [0.06289, 3.03832], [0.02795, 2.98929], [0.00699, 2.92634], [0.0, 2.84945]], "holes": [[[0.10291, -2.45232], [0.10704, -2.49773], [0.11942, -2.53487], [0.14007, -2.56373], [0.16897, -2.58432], [0.20613, -2.59663], [0.25155, -2.60067], [1.89997, -2.59742], [1.94539, -2.5932], [1.98255, -2.58074], [2.01146, -2.56004], [2.0321, -2.5311], [2.04449, -2.49391], [2.04862, -2.44848], [2.04862, 2.85606], [2.04449, 2.90147], [2.0321, 2.93859], [2.01146, 2.96743], [1.98255, 2.98798], [1.94539, 3.00025], [1.89997, 3.00423], [0.25155, 2.99891], [0.20613, 2.99463], [0.16897, 2.98212], [0.14007, 2.96138], [0.11942, 2.93241], [0.10704, 2.89521], [0.10291, 2.84978]]], "depth": 0.096}, "edgeTreatment": {"type": "fillet-in-profile", "bevelRadius": 0.1586, "segments": 6}, "uvStrategy": "generated procedural coordinates", "topologyIntent": "frame ring", "deformationStack": [], "normalStrategy": "flat faces"}, "parent": "panel-back", "attachment": {"parentSocket": "panel-back-face", "contactType": "overlap", "localStart": [0, 0, 0], "localEnd": [0, 0, 0], "embed": 0.06, "gapTolerance": 0.0}, "dimensions": {"width": 1.0, "height": 1.0, "depth": 1.0, "units": "relative", "confidence": 0.5}, "transform": {"position": [0, 0, 0.012], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "attached-trim", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "panel-back-rim", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "panel-rim-sky"}}, "material": "panel-rim-sky", "materialLayers": ["panel-rim-sky"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "panel-back-rim-rim-glow", "type": "emissive-contour", "detailRef": "rim-glow-back"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "rimColor": "#2AA8FF", "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 102, 185, 1.0)", "secondaryAlbedo": "rgba(42, 168, 255, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "panel-rim-sky"}, "materialRegions": [{"regionId": "rim", "materialId": "panel-rim-sky", "profileId": "plastic.glossy", "crop": {"path": "evidence/material-evidence/05-rim.png", "bbox": {"x": 639, "y": 240, "width": 8, "height": 200}, "sourceWidth": 1024, "sourceHeight": 1024, "loaderWarnings": [], "coverage": 0.0015}}]};
  node_panel_back_rim_8.add(mesh_panel_back_rim_8);
  meshes["panel-back-rim"] = mesh_panel_back_rim_8;
  colliders["panel-back-rim"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["panel-back-rim"] ??= [];
  destructionGroups["panel-back-rim"].push(node_panel_back_rim_8);

  const endpoint_glyph_4_9 = makeAttachmentEndpoint(null);
  const node_glyph_4_9 = new THREE.Group();
  node_glyph_4_9.name = "Glyph 4__pivot";
  node_glyph_4_9.scale.set(1, 1, 1);
  if (endpoint_glyph_4_9) {
    node_glyph_4_9.position.copy(endpoint_glyph_4_9.start);
    node_glyph_4_9.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_glyph_4_9.position.set(0.0, 0.0, 1.98);
    node_glyph_4_9.rotation.set(0.0, 0.0, 0.0);
  }
  node_glyph_4_9.userData.sculptComponent = {"id": "glyph-4", "name": "Glyph 4", "level": "macro", "role": "body", "importance": 0.9, "confidence": 0.8, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Letterform: planar outline with counter hole, extruded; bevel on front edges.", "geometryDescriptor": {"profile2D": {"points": [[1.01217, -3.15558], [0.96216, -3.15003], [0.92326, -3.13335], [0.89547, -3.10557], [0.8788, -3.06667], [0.87324, -3.01666], [0.87324, -2.57011], [0.86769, -2.5201], [0.85102, -2.4812], [0.82323, -2.45342], [0.78433, -2.43675], [0.73432, -2.43119], [-0.79882, -2.43119], [-0.84222, -2.42726], [-0.88114, -2.41547], [-0.91557, -2.39582], [-0.94552, -2.36831], [-0.97098, -2.33295], [-0.98388, -2.31112], [-1.00205, -2.2721], [-1.0101, -2.23362], [-1.00804, -2.1957], [-0.99587, -2.15833], [-0.97358, -2.12151], [0.79003, 0.23607], [0.82554, 0.27611], [0.86551, 0.30726], [0.90994, 0.32951], [0.95883, 0.34286], [1.01217, 0.34731], [1.49841, 0.34731], [1.54842, 0.34175], [1.58732, 0.32508], [1.6151, 0.2973], [1.63177, 0.2584], [1.63733, 0.20838], [1.63733, -3.01666], [1.63177, -3.06667], [1.6151, -3.10557], [1.58732, -3.13335], [1.54842, -3.15003], [1.49841, -3.15558]], "holes": [[[0.90301, -0.67478], [0.10916, -1.86556], [0.90301, -1.86556]]], "depth": 0.22}, "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.05, "segments": 3}, "uvStrategy": "reference-camera projection on front cap; gradient on walls", "topologyIntent": "extruded glyph", "deformationStack": [], "normalStrategy": "smooth bevel"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.0, "height": 1.0, "depth": 1.0, "units": "relative", "confidence": 0.5}, "transform": {"position": [0.0, 0.0, 1.98], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-body", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glyph-4", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "glyph-4-gloss"}}, "material": "glyph-gloss", "materialLayers": ["glyph-4-gloss"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "glyph-4-counter", "type": "hole", "detailRef": "glyph4-counter"}, {"id": "glyph-4-bevel", "type": "chamfer", "detailRef": "glyph-bevel"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(34, 140, 250, 1.0)", "secondaryAlbedo": "rgba(0, 90, 230, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "colorGradient": {"type": "linear", "axis": "vertical", "stops": [{"color": "rgba(90, 250, 251, 1.0)", "position": 0.0}, {"color": "rgba(0, 146, 250, 1.0)", "position": 0.55}, {"color": "rgba(255, 170, 120, 1.0)", "position": 1.0}]}, "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "glyph-4-gloss"}, "materialRegions": [{"regionId": "cap", "materialId": "glyph-4-gloss", "profileId": "plastic.glossy", "crop": {"path": "evidence/material-evidence/06-cap.png", "bbox": {"x": 610, "y": 500, "width": 60, "height": 200}, "sourceWidth": 1024, "sourceHeight": 1024, "loaderWarnings": [], "coverage": 0.0114}}, {"regionId": "clearcoat", "materialId": "glyph-gloss", "profileId": "plastic.glossy", "crop": {"path": "evidence/material-evidence/08-clearcoat.png", "bbox": {"x": 612, "y": 600, "width": 56, "height": 120}, "sourceWidth": 1024, "sourceHeight": 1024, "loaderWarnings": [], "coverage": 0.0064}}]};
  node_glyph_4_9.userData.actionProfile = {"animationRole": "static-body", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glyph-4", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "glyph-4-gloss"}};
  (nodes["root"] ?? root).add(node_glyph_4_9);
  nodes["glyph-4"] = node_glyph_4_9;
  const mesh_glyph_4_9Geometry = endpoint_glyph_4_9
    ? new THREE.CylinderGeometry(endpoint_glyph_4_9.endRadius, endpoint_glyph_4_9.baseRadius, endpoint_glyph_4_9.length, 32, 12)
    : buildExtrudeGeometry({"points": [[1.01217, -3.15558], [0.96216, -3.15003], [0.92326, -3.13335], [0.89547, -3.10557], [0.8788, -3.06667], [0.87324, -3.01666], [0.87324, -2.57011], [0.86769, -2.5201], [0.85102, -2.4812], [0.82323, -2.45342], [0.78433, -2.43675], [0.73432, -2.43119], [-0.79882, -2.43119], [-0.84222, -2.42726], [-0.88114, -2.41547], [-0.91557, -2.39582], [-0.94552, -2.36831], [-0.97098, -2.33295], [-0.98388, -2.31112], [-1.00205, -2.2721], [-1.0101, -2.23362], [-1.00804, -2.1957], [-0.99587, -2.15833], [-0.97358, -2.12151], [0.79003, 0.23607], [0.82554, 0.27611], [0.86551, 0.30726], [0.90994, 0.32951], [0.95883, 0.34286], [1.01217, 0.34731], [1.49841, 0.34731], [1.54842, 0.34175], [1.58732, 0.32508], [1.6151, 0.2973], [1.63177, 0.2584], [1.63733, 0.20838], [1.63733, -3.01666], [1.63177, -3.06667], [1.6151, -3.10557], [1.58732, -3.13335], [1.54842, -3.15003], [1.49841, -3.15558]], "holes": [[[0.90301, -0.67478], [0.10916, -1.86556], [0.90301, -1.86556]]], "depth": 0.22});
  if (!endpoint_glyph_4_9) {
    mesh_glyph_4_9Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_glyph_4_9 = new THREE.Mesh(
    mesh_glyph_4_9Geometry,
    materialMap["glyph-gloss"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_glyph_4_9.name = "Glyph 4";
  if (endpoint_glyph_4_9) {
    mesh_glyph_4_9.position.copy(endpoint_glyph_4_9.midpoint);
    mesh_glyph_4_9.quaternion.copy(endpoint_glyph_4_9.quaternion);
  }
  mesh_glyph_4_9.castShadow = options.castShadow ?? true;
  mesh_glyph_4_9.receiveShadow = options.receiveShadow ?? true;
  mesh_glyph_4_9.userData.sculptComponent = {"id": "glyph-4", "name": "Glyph 4", "level": "macro", "role": "body", "importance": 0.9, "confidence": 0.8, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Letterform: planar outline with counter hole, extruded; bevel on front edges.", "geometryDescriptor": {"profile2D": {"points": [[1.01217, -3.15558], [0.96216, -3.15003], [0.92326, -3.13335], [0.89547, -3.10557], [0.8788, -3.06667], [0.87324, -3.01666], [0.87324, -2.57011], [0.86769, -2.5201], [0.85102, -2.4812], [0.82323, -2.45342], [0.78433, -2.43675], [0.73432, -2.43119], [-0.79882, -2.43119], [-0.84222, -2.42726], [-0.88114, -2.41547], [-0.91557, -2.39582], [-0.94552, -2.36831], [-0.97098, -2.33295], [-0.98388, -2.31112], [-1.00205, -2.2721], [-1.0101, -2.23362], [-1.00804, -2.1957], [-0.99587, -2.15833], [-0.97358, -2.12151], [0.79003, 0.23607], [0.82554, 0.27611], [0.86551, 0.30726], [0.90994, 0.32951], [0.95883, 0.34286], [1.01217, 0.34731], [1.49841, 0.34731], [1.54842, 0.34175], [1.58732, 0.32508], [1.6151, 0.2973], [1.63177, 0.2584], [1.63733, 0.20838], [1.63733, -3.01666], [1.63177, -3.06667], [1.6151, -3.10557], [1.58732, -3.13335], [1.54842, -3.15003], [1.49841, -3.15558]], "holes": [[[0.90301, -0.67478], [0.10916, -1.86556], [0.90301, -1.86556]]], "depth": 0.22}, "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.05, "segments": 3}, "uvStrategy": "reference-camera projection on front cap; gradient on walls", "topologyIntent": "extruded glyph", "deformationStack": [], "normalStrategy": "smooth bevel"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.0, "height": 1.0, "depth": 1.0, "units": "relative", "confidence": 0.5}, "transform": {"position": [0.0, 0.0, 1.98], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-body", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glyph-4", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "glyph-4-gloss"}}, "material": "glyph-gloss", "materialLayers": ["glyph-4-gloss"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "glyph-4-counter", "type": "hole", "detailRef": "glyph4-counter"}, {"id": "glyph-4-bevel", "type": "chamfer", "detailRef": "glyph-bevel"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(34, 140, 250, 1.0)", "secondaryAlbedo": "rgba(0, 90, 230, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "colorGradient": {"type": "linear", "axis": "vertical", "stops": [{"color": "rgba(90, 250, 251, 1.0)", "position": 0.0}, {"color": "rgba(0, 146, 250, 1.0)", "position": 0.55}, {"color": "rgba(255, 170, 120, 1.0)", "position": 1.0}]}, "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "glyph-4-gloss"}, "materialRegions": [{"regionId": "cap", "materialId": "glyph-4-gloss", "profileId": "plastic.glossy", "crop": {"path": "evidence/material-evidence/06-cap.png", "bbox": {"x": 610, "y": 500, "width": 60, "height": 200}, "sourceWidth": 1024, "sourceHeight": 1024, "loaderWarnings": [], "coverage": 0.0114}}, {"regionId": "clearcoat", "materialId": "glyph-gloss", "profileId": "plastic.glossy", "crop": {"path": "evidence/material-evidence/08-clearcoat.png", "bbox": {"x": 612, "y": 600, "width": 56, "height": 120}, "sourceWidth": 1024, "sourceHeight": 1024, "loaderWarnings": [], "coverage": 0.0064}}]};
  node_glyph_4_9.add(mesh_glyph_4_9);
  meshes["glyph-4"] = mesh_glyph_4_9;
  colliders["glyph-4"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["glyph-4"] ??= [];
  destructionGroups["glyph-4"].push(node_glyph_4_9);

  const endpoint_glyph_d_10 = makeAttachmentEndpoint(null);
  const node_glyph_d_10 = new THREE.Group();
  node_glyph_d_10.name = "Glyph D__pivot";
  node_glyph_d_10.scale.set(1, 1, 1);
  if (endpoint_glyph_d_10) {
    node_glyph_d_10.position.copy(endpoint_glyph_d_10.start);
    node_glyph_d_10.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_glyph_d_10.position.set(0.0, 0.0, 1.98);
    node_glyph_d_10.rotation.set(0.0, 0.0, 0.0);
  }
  node_glyph_d_10.userData.sculptComponent = {"id": "glyph-d", "name": "Glyph D", "level": "macro", "role": "body", "importance": 0.9, "confidence": 0.8, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Letterform: planar outline with counter hole, extruded; bevel on front edges.", "geometryDescriptor": {"profile2D": {"points": [[1.88541, -3.15558], [1.83183, -3.14963], [1.79015, -3.13177], [1.76038, -3.102], [1.74252, -3.06032], [1.73656, -3.00673], [1.73656, 0.21831], [1.74252, 0.27189], [1.76038, 0.31357], [1.79015, 0.34334], [1.83183, 0.3612], [1.88541, 0.36716], [2.86216, 0.36716], [2.88823, 0.36696], [2.91428, 0.36636], [2.94032, 0.36536], [2.96634, 0.36397], [2.99234, 0.36217], [3.00679, 0.36107], [3.03273, 0.35868], [3.05855, 0.35552], [3.08425, 0.35158], [3.10983, 0.34685], [3.13529, 0.34135], [3.15023, 0.33788], [3.17578, 0.33156], [3.20111, 0.3245], [3.22621, 0.3167], [3.25108, 0.30816], [3.27571, 0.29888], [3.29086, 0.29292], [3.31572, 0.28274], [3.34026, 0.27188], [3.36447, 0.26034], [3.38836, 0.24812], [3.41192, 0.23522], [3.42692, 0.22674], [3.45078, 0.21283], [3.47424, 0.19831], [3.4973, 0.18318], [3.51996, 0.16745], [3.54222, 0.15111], [3.5567, 0.14018], [3.57927, 0.12271], [3.60137, 0.10471], [3.62302, 0.08618], [3.64421, 0.06711], [3.66494, 0.04752], [3.67857, 0.03432], [3.69956, 0.01351], [3.72005, -0.00775], [3.74003, -0.02947], [3.75953, -0.05165], [3.77852, -0.07429], [3.79099, -0.08951], [3.81014, -0.11339], [3.82876, -0.13767], [3.84686, -0.16233], [3.86443, -0.18737], [3.88147, -0.21281], [3.89255, -0.22974], [3.90962, -0.25641], [3.92615, -0.2834], [3.94213, -0.31072], [3.95757, -0.33835], [3.97245, -0.3663], [3.98197, -0.38462], [3.99675, -0.41374], [4.01098, -0.44313], [4.02464, -0.47277], [4.03775, -0.50267], [4.05029, -0.53283], [4.05812, -0.55219], [4.07044, -0.58341], [4.08218, -0.61483], [4.09335, -0.64645], [4.10395, -0.67827], [4.11398, -0.71029], [4.12006, -0.73035], [4.12974, -0.76327], [4.13884, -0.79634], [4.14737, -0.82956], [4.15532, -0.86292], [4.16269, -0.89644], [4.167, -0.91686], [4.17392, -0.95107], [4.18026, -0.98538], [4.18602, -1.01979], [4.1912, -1.05429], [4.1958, -1.08889], [4.19835, -1.10937], [4.20242, -1.14445], [4.20591, -1.17957], [4.20882, -1.21474], [4.21114, -1.24996], [4.21288, -1.28523], [4.21372, -1.30547], [4.21488, -1.34097], [4.21547, -1.37646], [4.21547, -1.41196], [4.21488, -1.44746], [4.21372, -1.48296], [4.21288, -1.50319], [4.21114, -1.53846], [4.20882, -1.57368], [4.20591, -1.60885], [4.20242, -1.64398], [4.19835, -1.67905], [4.1958, -1.69953], [4.1912, -1.73413], [4.18602, -1.76864], [4.18026, -1.80304], [4.17392, -1.83735], [4.167, -1.87157], [4.16269, -1.89199], [4.15532, -1.9255], [4.14737, -1.95887], [4.13884, -1.99208], [4.12974, -2.02515], [4.12006, -2.05808], [4.11398, -2.07813], [4.10395, -2.11016], [4.09335, -2.14198], [4.08218, -2.1736], [4.07044, -2.20502], [4.05812, -2.23624], [4.05029, -2.25559], [4.03775, -2.28575], [4.02464, -2.31566], [4.01098, -2.3453], [3.99675, -2.37468], [3.98197, -2.40381], [3.97245, -2.42212], [3.95757, -2.45008], [3.94213, -2.47771], [3.92615, -2.50502], [3.90962, -2.53201], [3.89255, -2.55869], [3.88147, -2.57562], [3.86443, -2.60105], [3.84686, -2.6261], [3.82876, -2.65076], [3.81014, -2.67503], [3.79099, -2.69892], [3.77852, -2.71413], [3.75953, -2.73677], [3.74003, -2.75895], [3.72005, -2.78068], [3.69956, -2.80194], [3.67857, -2.82274], [3.66494, -2.83594], [3.64421, -2.85554], [3.62302, -2.87461], [3.60137, -2.89314], [3.57927, -2.91114], [3.5567, -2.9286], [3.54222, -2.93953], [3.51996, -2.95588], [3.4973, -2.97161], [3.47424, -2.98674], [3.45078, -3.00126], [3.42692, -3.01517], [3.41192, -3.02365], [3.38836, -3.03655], [3.36447, -3.04876], [3.34026, -3.0603], [3.31572, -3.07116], [3.29086, -3.08135], [3.27571, -3.0873], [3.25108, -3.09658], [3.22621, -3.10512], [3.20111, -3.11292], [3.17578, -3.11999], [3.15023, -3.12631], [3.13529, -3.12978], [3.10983, -3.13528], [3.08425, -3.14], [3.05855, -3.14394], [3.03273, -3.14711], [3.00679, -3.14949], [2.99234, -3.1506], [2.96634, -3.15239], [2.94032, -3.15379], [2.91428, -3.15479], [2.88823, -3.15538], [2.86216, -3.15558]], "holes": [[[2.39149, -2.49073], [2.39149, -0.2977], [2.65942, -0.2977], [2.78826, -0.3112], [2.91393, -0.35136], [3.03334, -0.41721], [3.14354, -0.50711], [3.24181, -0.61886], [3.32575, -0.7497], [3.39328, -0.8964], [3.44273, -1.05537], [3.47291, -1.22268], [3.48305, -1.39421], [3.47291, -1.56574], [3.44273, -1.73305], [3.39328, -1.89202], [3.32575, -2.03873], [3.24181, -2.16956], [3.14354, -2.28131], [3.03334, -2.37121], [2.91393, -2.43706], [2.78826, -2.47723], [2.65942, -2.49073]]], "depth": 0.22}, "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.05, "segments": 3}, "uvStrategy": "reference-camera projection on front cap; gradient on walls", "topologyIntent": "extruded glyph", "deformationStack": [], "normalStrategy": "smooth bevel"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.0, "height": 1.0, "depth": 1.0, "units": "relative", "confidence": 0.5}, "transform": {"position": [0.0, 0.0, 1.98], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-body", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glyph-d", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "glyph-d-gloss"}}, "material": "glyph-d-gloss", "materialLayers": ["glyph-d-gloss"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "glyph-d-counter", "type": "hole", "detailRef": "glyphD-counter"}, {"id": "bevel", "type": "chamfer", "detailRef": "glyph-bevel"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(174, 38, 173, 1.0)", "secondaryAlbedo": "rgba(114, 17, 241, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "colorGradient": {"type": "linear", "axis": "vertical", "stops": [{"color": "rgba(90, 20, 230, 1.0)", "position": 0.0}, {"color": "rgba(237, 43, 130, 1.0)", "position": 0.5}, {"color": "rgba(251, 75, 81, 1.0)", "position": 1.0}]}, "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "glyph-d-gloss"}, "materialRegions": [{"regionId": "cap", "materialId": "glyph-d-gloss", "profileId": "plastic.glossy", "crop": {"path": "evidence/material-evidence/07-cap.png", "bbox": {"x": 700, "y": 500, "width": 45, "height": 250}, "sourceWidth": 1024, "sourceHeight": 1024, "loaderWarnings": [], "coverage": 0.0107}}]};
  node_glyph_d_10.userData.actionProfile = {"animationRole": "static-body", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glyph-d", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "glyph-d-gloss"}};
  (nodes["root"] ?? root).add(node_glyph_d_10);
  nodes["glyph-d"] = node_glyph_d_10;
  const mesh_glyph_d_10Geometry = endpoint_glyph_d_10
    ? new THREE.CylinderGeometry(endpoint_glyph_d_10.endRadius, endpoint_glyph_d_10.baseRadius, endpoint_glyph_d_10.length, 32, 12)
    : buildExtrudeGeometry({"points": [[1.88541, -3.15558], [1.83183, -3.14963], [1.79015, -3.13177], [1.76038, -3.102], [1.74252, -3.06032], [1.73656, -3.00673], [1.73656, 0.21831], [1.74252, 0.27189], [1.76038, 0.31357], [1.79015, 0.34334], [1.83183, 0.3612], [1.88541, 0.36716], [2.86216, 0.36716], [2.88823, 0.36696], [2.91428, 0.36636], [2.94032, 0.36536], [2.96634, 0.36397], [2.99234, 0.36217], [3.00679, 0.36107], [3.03273, 0.35868], [3.05855, 0.35552], [3.08425, 0.35158], [3.10983, 0.34685], [3.13529, 0.34135], [3.15023, 0.33788], [3.17578, 0.33156], [3.20111, 0.3245], [3.22621, 0.3167], [3.25108, 0.30816], [3.27571, 0.29888], [3.29086, 0.29292], [3.31572, 0.28274], [3.34026, 0.27188], [3.36447, 0.26034], [3.38836, 0.24812], [3.41192, 0.23522], [3.42692, 0.22674], [3.45078, 0.21283], [3.47424, 0.19831], [3.4973, 0.18318], [3.51996, 0.16745], [3.54222, 0.15111], [3.5567, 0.14018], [3.57927, 0.12271], [3.60137, 0.10471], [3.62302, 0.08618], [3.64421, 0.06711], [3.66494, 0.04752], [3.67857, 0.03432], [3.69956, 0.01351], [3.72005, -0.00775], [3.74003, -0.02947], [3.75953, -0.05165], [3.77852, -0.07429], [3.79099, -0.08951], [3.81014, -0.11339], [3.82876, -0.13767], [3.84686, -0.16233], [3.86443, -0.18737], [3.88147, -0.21281], [3.89255, -0.22974], [3.90962, -0.25641], [3.92615, -0.2834], [3.94213, -0.31072], [3.95757, -0.33835], [3.97245, -0.3663], [3.98197, -0.38462], [3.99675, -0.41374], [4.01098, -0.44313], [4.02464, -0.47277], [4.03775, -0.50267], [4.05029, -0.53283], [4.05812, -0.55219], [4.07044, -0.58341], [4.08218, -0.61483], [4.09335, -0.64645], [4.10395, -0.67827], [4.11398, -0.71029], [4.12006, -0.73035], [4.12974, -0.76327], [4.13884, -0.79634], [4.14737, -0.82956], [4.15532, -0.86292], [4.16269, -0.89644], [4.167, -0.91686], [4.17392, -0.95107], [4.18026, -0.98538], [4.18602, -1.01979], [4.1912, -1.05429], [4.1958, -1.08889], [4.19835, -1.10937], [4.20242, -1.14445], [4.20591, -1.17957], [4.20882, -1.21474], [4.21114, -1.24996], [4.21288, -1.28523], [4.21372, -1.30547], [4.21488, -1.34097], [4.21547, -1.37646], [4.21547, -1.41196], [4.21488, -1.44746], [4.21372, -1.48296], [4.21288, -1.50319], [4.21114, -1.53846], [4.20882, -1.57368], [4.20591, -1.60885], [4.20242, -1.64398], [4.19835, -1.67905], [4.1958, -1.69953], [4.1912, -1.73413], [4.18602, -1.76864], [4.18026, -1.80304], [4.17392, -1.83735], [4.167, -1.87157], [4.16269, -1.89199], [4.15532, -1.9255], [4.14737, -1.95887], [4.13884, -1.99208], [4.12974, -2.02515], [4.12006, -2.05808], [4.11398, -2.07813], [4.10395, -2.11016], [4.09335, -2.14198], [4.08218, -2.1736], [4.07044, -2.20502], [4.05812, -2.23624], [4.05029, -2.25559], [4.03775, -2.28575], [4.02464, -2.31566], [4.01098, -2.3453], [3.99675, -2.37468], [3.98197, -2.40381], [3.97245, -2.42212], [3.95757, -2.45008], [3.94213, -2.47771], [3.92615, -2.50502], [3.90962, -2.53201], [3.89255, -2.55869], [3.88147, -2.57562], [3.86443, -2.60105], [3.84686, -2.6261], [3.82876, -2.65076], [3.81014, -2.67503], [3.79099, -2.69892], [3.77852, -2.71413], [3.75953, -2.73677], [3.74003, -2.75895], [3.72005, -2.78068], [3.69956, -2.80194], [3.67857, -2.82274], [3.66494, -2.83594], [3.64421, -2.85554], [3.62302, -2.87461], [3.60137, -2.89314], [3.57927, -2.91114], [3.5567, -2.9286], [3.54222, -2.93953], [3.51996, -2.95588], [3.4973, -2.97161], [3.47424, -2.98674], [3.45078, -3.00126], [3.42692, -3.01517], [3.41192, -3.02365], [3.38836, -3.03655], [3.36447, -3.04876], [3.34026, -3.0603], [3.31572, -3.07116], [3.29086, -3.08135], [3.27571, -3.0873], [3.25108, -3.09658], [3.22621, -3.10512], [3.20111, -3.11292], [3.17578, -3.11999], [3.15023, -3.12631], [3.13529, -3.12978], [3.10983, -3.13528], [3.08425, -3.14], [3.05855, -3.14394], [3.03273, -3.14711], [3.00679, -3.14949], [2.99234, -3.1506], [2.96634, -3.15239], [2.94032, -3.15379], [2.91428, -3.15479], [2.88823, -3.15538], [2.86216, -3.15558]], "holes": [[[2.39149, -2.49073], [2.39149, -0.2977], [2.65942, -0.2977], [2.78826, -0.3112], [2.91393, -0.35136], [3.03334, -0.41721], [3.14354, -0.50711], [3.24181, -0.61886], [3.32575, -0.7497], [3.39328, -0.8964], [3.44273, -1.05537], [3.47291, -1.22268], [3.48305, -1.39421], [3.47291, -1.56574], [3.44273, -1.73305], [3.39328, -1.89202], [3.32575, -2.03873], [3.24181, -2.16956], [3.14354, -2.28131], [3.03334, -2.37121], [2.91393, -2.43706], [2.78826, -2.47723], [2.65942, -2.49073]]], "depth": 0.22});
  if (!endpoint_glyph_d_10) {
    mesh_glyph_d_10Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_glyph_d_10 = new THREE.Mesh(
    mesh_glyph_d_10Geometry,
    materialMap["glyph-d-gloss"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_glyph_d_10.name = "Glyph D";
  if (endpoint_glyph_d_10) {
    mesh_glyph_d_10.position.copy(endpoint_glyph_d_10.midpoint);
    mesh_glyph_d_10.quaternion.copy(endpoint_glyph_d_10.quaternion);
  }
  mesh_glyph_d_10.castShadow = options.castShadow ?? true;
  mesh_glyph_d_10.receiveShadow = options.receiveShadow ?? true;
  mesh_glyph_d_10.userData.sculptComponent = {"id": "glyph-d", "name": "Glyph D", "level": "macro", "role": "body", "importance": 0.9, "confidence": 0.8, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Letterform: planar outline with counter hole, extruded; bevel on front edges.", "geometryDescriptor": {"profile2D": {"points": [[1.88541, -3.15558], [1.83183, -3.14963], [1.79015, -3.13177], [1.76038, -3.102], [1.74252, -3.06032], [1.73656, -3.00673], [1.73656, 0.21831], [1.74252, 0.27189], [1.76038, 0.31357], [1.79015, 0.34334], [1.83183, 0.3612], [1.88541, 0.36716], [2.86216, 0.36716], [2.88823, 0.36696], [2.91428, 0.36636], [2.94032, 0.36536], [2.96634, 0.36397], [2.99234, 0.36217], [3.00679, 0.36107], [3.03273, 0.35868], [3.05855, 0.35552], [3.08425, 0.35158], [3.10983, 0.34685], [3.13529, 0.34135], [3.15023, 0.33788], [3.17578, 0.33156], [3.20111, 0.3245], [3.22621, 0.3167], [3.25108, 0.30816], [3.27571, 0.29888], [3.29086, 0.29292], [3.31572, 0.28274], [3.34026, 0.27188], [3.36447, 0.26034], [3.38836, 0.24812], [3.41192, 0.23522], [3.42692, 0.22674], [3.45078, 0.21283], [3.47424, 0.19831], [3.4973, 0.18318], [3.51996, 0.16745], [3.54222, 0.15111], [3.5567, 0.14018], [3.57927, 0.12271], [3.60137, 0.10471], [3.62302, 0.08618], [3.64421, 0.06711], [3.66494, 0.04752], [3.67857, 0.03432], [3.69956, 0.01351], [3.72005, -0.00775], [3.74003, -0.02947], [3.75953, -0.05165], [3.77852, -0.07429], [3.79099, -0.08951], [3.81014, -0.11339], [3.82876, -0.13767], [3.84686, -0.16233], [3.86443, -0.18737], [3.88147, -0.21281], [3.89255, -0.22974], [3.90962, -0.25641], [3.92615, -0.2834], [3.94213, -0.31072], [3.95757, -0.33835], [3.97245, -0.3663], [3.98197, -0.38462], [3.99675, -0.41374], [4.01098, -0.44313], [4.02464, -0.47277], [4.03775, -0.50267], [4.05029, -0.53283], [4.05812, -0.55219], [4.07044, -0.58341], [4.08218, -0.61483], [4.09335, -0.64645], [4.10395, -0.67827], [4.11398, -0.71029], [4.12006, -0.73035], [4.12974, -0.76327], [4.13884, -0.79634], [4.14737, -0.82956], [4.15532, -0.86292], [4.16269, -0.89644], [4.167, -0.91686], [4.17392, -0.95107], [4.18026, -0.98538], [4.18602, -1.01979], [4.1912, -1.05429], [4.1958, -1.08889], [4.19835, -1.10937], [4.20242, -1.14445], [4.20591, -1.17957], [4.20882, -1.21474], [4.21114, -1.24996], [4.21288, -1.28523], [4.21372, -1.30547], [4.21488, -1.34097], [4.21547, -1.37646], [4.21547, -1.41196], [4.21488, -1.44746], [4.21372, -1.48296], [4.21288, -1.50319], [4.21114, -1.53846], [4.20882, -1.57368], [4.20591, -1.60885], [4.20242, -1.64398], [4.19835, -1.67905], [4.1958, -1.69953], [4.1912, -1.73413], [4.18602, -1.76864], [4.18026, -1.80304], [4.17392, -1.83735], [4.167, -1.87157], [4.16269, -1.89199], [4.15532, -1.9255], [4.14737, -1.95887], [4.13884, -1.99208], [4.12974, -2.02515], [4.12006, -2.05808], [4.11398, -2.07813], [4.10395, -2.11016], [4.09335, -2.14198], [4.08218, -2.1736], [4.07044, -2.20502], [4.05812, -2.23624], [4.05029, -2.25559], [4.03775, -2.28575], [4.02464, -2.31566], [4.01098, -2.3453], [3.99675, -2.37468], [3.98197, -2.40381], [3.97245, -2.42212], [3.95757, -2.45008], [3.94213, -2.47771], [3.92615, -2.50502], [3.90962, -2.53201], [3.89255, -2.55869], [3.88147, -2.57562], [3.86443, -2.60105], [3.84686, -2.6261], [3.82876, -2.65076], [3.81014, -2.67503], [3.79099, -2.69892], [3.77852, -2.71413], [3.75953, -2.73677], [3.74003, -2.75895], [3.72005, -2.78068], [3.69956, -2.80194], [3.67857, -2.82274], [3.66494, -2.83594], [3.64421, -2.85554], [3.62302, -2.87461], [3.60137, -2.89314], [3.57927, -2.91114], [3.5567, -2.9286], [3.54222, -2.93953], [3.51996, -2.95588], [3.4973, -2.97161], [3.47424, -2.98674], [3.45078, -3.00126], [3.42692, -3.01517], [3.41192, -3.02365], [3.38836, -3.03655], [3.36447, -3.04876], [3.34026, -3.0603], [3.31572, -3.07116], [3.29086, -3.08135], [3.27571, -3.0873], [3.25108, -3.09658], [3.22621, -3.10512], [3.20111, -3.11292], [3.17578, -3.11999], [3.15023, -3.12631], [3.13529, -3.12978], [3.10983, -3.13528], [3.08425, -3.14], [3.05855, -3.14394], [3.03273, -3.14711], [3.00679, -3.14949], [2.99234, -3.1506], [2.96634, -3.15239], [2.94032, -3.15379], [2.91428, -3.15479], [2.88823, -3.15538], [2.86216, -3.15558]], "holes": [[[2.39149, -2.49073], [2.39149, -0.2977], [2.65942, -0.2977], [2.78826, -0.3112], [2.91393, -0.35136], [3.03334, -0.41721], [3.14354, -0.50711], [3.24181, -0.61886], [3.32575, -0.7497], [3.39328, -0.8964], [3.44273, -1.05537], [3.47291, -1.22268], [3.48305, -1.39421], [3.47291, -1.56574], [3.44273, -1.73305], [3.39328, -1.89202], [3.32575, -2.03873], [3.24181, -2.16956], [3.14354, -2.28131], [3.03334, -2.37121], [2.91393, -2.43706], [2.78826, -2.47723], [2.65942, -2.49073]]], "depth": 0.22}, "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.05, "segments": 3}, "uvStrategy": "reference-camera projection on front cap; gradient on walls", "topologyIntent": "extruded glyph", "deformationStack": [], "normalStrategy": "smooth bevel"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.0, "height": 1.0, "depth": 1.0, "units": "relative", "confidence": 0.5}, "transform": {"position": [0.0, 0.0, 1.98], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-body", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "glyph-d", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "glyph-d-gloss"}}, "material": "glyph-d-gloss", "materialLayers": ["glyph-d-gloss"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "glyph-d-counter", "type": "hole", "detailRef": "glyphD-counter"}, {"id": "bevel", "type": "chamfer", "detailRef": "glyph-bevel"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(174, 38, 173, 1.0)", "secondaryAlbedo": "rgba(114, 17, 241, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "colorGradient": {"type": "linear", "axis": "vertical", "stops": [{"color": "rgba(90, 20, 230, 1.0)", "position": 0.0}, {"color": "rgba(237, 43, 130, 1.0)", "position": 0.5}, {"color": "rgba(251, 75, 81, 1.0)", "position": 1.0}]}, "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "glyph-d-gloss"}, "materialRegions": [{"regionId": "cap", "materialId": "glyph-d-gloss", "profileId": "plastic.glossy", "crop": {"path": "evidence/material-evidence/07-cap.png", "bbox": {"x": 700, "y": 500, "width": 45, "height": 250}, "sourceWidth": 1024, "sourceHeight": 1024, "loaderWarnings": [], "coverage": 0.0107}}]};
  node_glyph_d_10.add(mesh_glyph_d_10);
  meshes["glyph-d"] = mesh_glyph_d_10;
  colliders["glyph-d"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["glyph-d"] ??= [];
  destructionGroups["glyph-d"].push(node_glyph_d_10);

  const endpoint_sphere_cluster_11 = makeAttachmentEndpoint(null);
  const node_sphere_cluster_11 = new THREE.Group();
  node_sphere_cluster_11.name = "Sphere cluster__pivot";
  node_sphere_cluster_11.scale.set(1, 1, 1);
  if (endpoint_sphere_cluster_11) {
    node_sphere_cluster_11.position.copy(endpoint_sphere_cluster_11.start);
    node_sphere_cluster_11.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_sphere_cluster_11.position.set(0.0, 0.0, 0.0);
    node_sphere_cluster_11.rotation.set(0.0, 0.0, 0.0);
  }
  node_sphere_cluster_11.userData.sculptComponent = {"id": "sphere-cluster", "name": "Sphere cluster", "level": "meso", "role": "group", "importance": 0.6, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Grouping pivot for the 11 spheres.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.001, "height": 0.001, "depth": 0.001, "units": "world", "confidence": 1.0}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "group-pivot", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sphere-cluster", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "sphere-blue"}}, "material": "sphere-blue", "materialLayers": ["sphere-blue"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "groupOnly": true, "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 164, 251, 1.0)", "secondaryAlbedo": "rgba(90, 210, 255, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}};
  node_sphere_cluster_11.userData.actionProfile = {"animationRole": "group-pivot", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sphere-cluster", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "sphere-blue"}};
  (nodes["root"] ?? root).add(node_sphere_cluster_11);
  nodes["sphere-cluster"] = node_sphere_cluster_11;
  const mesh_sphere_cluster_11Geometry = endpoint_sphere_cluster_11
    ? new THREE.CylinderGeometry(endpoint_sphere_cluster_11.endRadius, endpoint_sphere_cluster_11.baseRadius, endpoint_sphere_cluster_11.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_sphere_cluster_11) {
    mesh_sphere_cluster_11Geometry.scale(0.001, 0.001, 0.001);
  }
  const mesh_sphere_cluster_11 = new THREE.Mesh(
    mesh_sphere_cluster_11Geometry,
    materialMap["sphere-blue"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_sphere_cluster_11.name = "Sphere cluster";
  if (endpoint_sphere_cluster_11) {
    mesh_sphere_cluster_11.position.copy(endpoint_sphere_cluster_11.midpoint);
    mesh_sphere_cluster_11.quaternion.copy(endpoint_sphere_cluster_11.quaternion);
  }
  mesh_sphere_cluster_11.castShadow = options.castShadow ?? true;
  mesh_sphere_cluster_11.receiveShadow = options.receiveShadow ?? true;
  mesh_sphere_cluster_11.userData.sculptComponent = {"id": "sphere-cluster", "name": "Sphere cluster", "level": "meso", "role": "group", "importance": 0.6, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Grouping pivot for the 11 spheres.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.001, "height": 0.001, "depth": 0.001, "units": "world", "confidence": 1.0}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "group-pivot", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sphere-cluster", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "sphere-blue"}}, "material": "sphere-blue", "materialLayers": ["sphere-blue"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "groupOnly": true, "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 164, 251, 1.0)", "secondaryAlbedo": "rgba(90, 210, 255, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}};
  node_sphere_cluster_11.add(mesh_sphere_cluster_11);
  meshes["sphere-cluster"] = mesh_sphere_cluster_11;
  colliders["sphere-cluster"] = {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["sphere-cluster"] ??= [];
  destructionGroups["sphere-cluster"].push(node_sphere_cluster_11);

  const endpoint_sphere_01_12 = makeAttachmentEndpoint(null);
  const node_sphere_01_12 = new THREE.Group();
  node_sphere_01_12.name = "Sphere 1__pivot";
  node_sphere_01_12.scale.set(1, 1, 1);
  if (endpoint_sphere_01_12) {
    node_sphere_01_12.position.copy(endpoint_sphere_01_12.start);
    node_sphere_01_12.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_sphere_01_12.position.set(1.51442, 0.78596, 2.5);
    node_sphere_01_12.rotation.set(0.0, 0.0, 0.0);
  }
  node_sphere_01_12.userData.sculptComponent = {"id": "sphere-01", "name": "Sphere 1", "level": "micro", "role": "detail", "importance": 0.4, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Perfect sphere prop; UV sphere tessellation.", "geometryDescriptor": {"uvStrategy": "sphere uv", "topologyIntent": "uv sphere", "deformationStack": [], "normalStrategy": "smooth", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}}, "parent": "sphere-cluster", "attachment": null, "dimensions": {"width": 0.57509, "height": 0.57509, "depth": 0.57509, "units": "world", "confidence": 0.85}, "transform": {"position": [1.51442, 0.78596, 2.5], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "floating-prop", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sphere-01", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "sphere-blue"}}, "material": "sphere-blue", "materialLayers": ["sphere-blue"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "specular-dot", "type": "gloss", "detailRef": "sphere-specular"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 164, 251, 1.0)", "secondaryAlbedo": "rgba(90, 210, 255, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "sphere-blue"}, "materialRegions": [{"regionId": "sphere", "materialId": "sphere-blue", "profileId": "plastic.glossy", "crop": {"path": "evidence/material-evidence/09-sphere.png", "bbox": {"x": 652, "y": 412, "width": 36, "height": 36}, "sourceWidth": 1024, "sourceHeight": 1024, "loaderWarnings": [], "coverage": 0.0012}}]};
  node_sphere_01_12.userData.actionProfile = {"animationRole": "floating-prop", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sphere-01", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "sphere-blue"}};
  (nodes["sphere-cluster"] ?? root).add(node_sphere_01_12);
  nodes["sphere-01"] = node_sphere_01_12;
  const mesh_sphere_01_12Geometry = endpoint_sphere_01_12
    ? new THREE.CylinderGeometry(endpoint_sphere_01_12.endRadius, endpoint_sphere_01_12.baseRadius, endpoint_sphere_01_12.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_sphere_01_12) {
    mesh_sphere_01_12Geometry.scale(0.57509, 0.57509, 0.57509);
  }
  const mesh_sphere_01_12 = new THREE.Mesh(
    mesh_sphere_01_12Geometry,
    materialMap["sphere-blue"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_sphere_01_12.name = "Sphere 1";
  if (endpoint_sphere_01_12) {
    mesh_sphere_01_12.position.copy(endpoint_sphere_01_12.midpoint);
    mesh_sphere_01_12.quaternion.copy(endpoint_sphere_01_12.quaternion);
  }
  mesh_sphere_01_12.castShadow = options.castShadow ?? true;
  mesh_sphere_01_12.receiveShadow = options.receiveShadow ?? true;
  mesh_sphere_01_12.userData.sculptComponent = {"id": "sphere-01", "name": "Sphere 1", "level": "micro", "role": "detail", "importance": 0.4, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Perfect sphere prop; UV sphere tessellation.", "geometryDescriptor": {"uvStrategy": "sphere uv", "topologyIntent": "uv sphere", "deformationStack": [], "normalStrategy": "smooth", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}}, "parent": "sphere-cluster", "attachment": null, "dimensions": {"width": 0.57509, "height": 0.57509, "depth": 0.57509, "units": "world", "confidence": 0.85}, "transform": {"position": [1.51442, 0.78596, 2.5], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "floating-prop", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sphere-01", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "sphere-blue"}}, "material": "sphere-blue", "materialLayers": ["sphere-blue"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "specular-dot", "type": "gloss", "detailRef": "sphere-specular"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 164, 251, 1.0)", "secondaryAlbedo": "rgba(90, 210, 255, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "sphere-blue"}, "materialRegions": [{"regionId": "sphere", "materialId": "sphere-blue", "profileId": "plastic.glossy", "crop": {"path": "evidence/material-evidence/09-sphere.png", "bbox": {"x": 652, "y": 412, "width": 36, "height": 36}, "sourceWidth": 1024, "sourceHeight": 1024, "loaderWarnings": [], "coverage": 0.0012}}]};
  node_sphere_01_12.add(mesh_sphere_01_12);
  meshes["sphere-01"] = mesh_sphere_01_12;
  colliders["sphere-01"] = {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["sphere-01"] ??= [];
  destructionGroups["sphere-01"].push(node_sphere_01_12);

  const endpoint_sphere_02_13 = makeAttachmentEndpoint(null);
  const node_sphere_02_13 = new THREE.Group();
  node_sphere_02_13.name = "Sphere 2__pivot";
  node_sphere_02_13.scale.set(1, 1, 1);
  if (endpoint_sphere_02_13) {
    node_sphere_02_13.position.copy(endpoint_sphere_02_13.start);
    node_sphere_02_13.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_sphere_02_13.position.set(2.06741, 1.1441, 2.1);
    node_sphere_02_13.rotation.set(0.0, 0.0, 0.0);
  }
  node_sphere_02_13.userData.sculptComponent = {"id": "sphere-02", "name": "Sphere 2", "level": "micro", "role": "detail", "importance": 0.4, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Perfect sphere prop; UV sphere tessellation.", "geometryDescriptor": {"uvStrategy": "sphere uv", "topologyIntent": "uv sphere", "deformationStack": [], "normalStrategy": "smooth", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}}, "parent": "sphere-cluster", "attachment": null, "dimensions": {"width": 0.26094, "height": 0.26094, "depth": 0.26094, "units": "world", "confidence": 0.85}, "transform": {"position": [2.06741, 1.1441, 2.1], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "floating-prop", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sphere-02", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "sphere-blue"}}, "material": "sphere-blue", "materialLayers": ["sphere-blue"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "specular-dot", "type": "gloss", "detailRef": "sphere-specular"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 164, 251, 1.0)", "secondaryAlbedo": "rgba(90, 210, 255, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}};
  node_sphere_02_13.userData.actionProfile = {"animationRole": "floating-prop", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sphere-02", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "sphere-blue"}};
  (nodes["sphere-cluster"] ?? root).add(node_sphere_02_13);
  nodes["sphere-02"] = node_sphere_02_13;
  const mesh_sphere_02_13Geometry = endpoint_sphere_02_13
    ? new THREE.CylinderGeometry(endpoint_sphere_02_13.endRadius, endpoint_sphere_02_13.baseRadius, endpoint_sphere_02_13.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_sphere_02_13) {
    mesh_sphere_02_13Geometry.scale(0.26094, 0.26094, 0.26094);
  }
  const mesh_sphere_02_13 = new THREE.Mesh(
    mesh_sphere_02_13Geometry,
    materialMap["sphere-blue"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_sphere_02_13.name = "Sphere 2";
  if (endpoint_sphere_02_13) {
    mesh_sphere_02_13.position.copy(endpoint_sphere_02_13.midpoint);
    mesh_sphere_02_13.quaternion.copy(endpoint_sphere_02_13.quaternion);
  }
  mesh_sphere_02_13.castShadow = options.castShadow ?? true;
  mesh_sphere_02_13.receiveShadow = options.receiveShadow ?? true;
  mesh_sphere_02_13.userData.sculptComponent = {"id": "sphere-02", "name": "Sphere 2", "level": "micro", "role": "detail", "importance": 0.4, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Perfect sphere prop; UV sphere tessellation.", "geometryDescriptor": {"uvStrategy": "sphere uv", "topologyIntent": "uv sphere", "deformationStack": [], "normalStrategy": "smooth", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}}, "parent": "sphere-cluster", "attachment": null, "dimensions": {"width": 0.26094, "height": 0.26094, "depth": 0.26094, "units": "world", "confidence": 0.85}, "transform": {"position": [2.06741, 1.1441, 2.1], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "floating-prop", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sphere-02", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "sphere-blue"}}, "material": "sphere-blue", "materialLayers": ["sphere-blue"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "specular-dot", "type": "gloss", "detailRef": "sphere-specular"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 164, 251, 1.0)", "secondaryAlbedo": "rgba(90, 210, 255, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}};
  node_sphere_02_13.add(mesh_sphere_02_13);
  meshes["sphere-02"] = mesh_sphere_02_13;
  colliders["sphere-02"] = {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["sphere-02"] ??= [];
  destructionGroups["sphere-02"].push(node_sphere_02_13);

  const endpoint_sphere_03_14 = makeAttachmentEndpoint(null);
  const node_sphere_03_14 = new THREE.Group();
  node_sphere_03_14.name = "Sphere 3__pivot";
  node_sphere_03_14.scale.set(1, 1, 1);
  if (endpoint_sphere_03_14) {
    node_sphere_03_14.position.copy(endpoint_sphere_03_14.start);
    node_sphere_03_14.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_sphere_03_14.position.set(0.07848, 0.78484, 2.3);
    node_sphere_03_14.rotation.set(0.0, 0.0, 0.0);
  }
  node_sphere_03_14.userData.sculptComponent = {"id": "sphere-03", "name": "Sphere 3", "level": "micro", "role": "detail", "importance": 0.4, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Perfect sphere prop; UV sphere tessellation.", "geometryDescriptor": {"uvStrategy": "sphere uv", "topologyIntent": "uv sphere", "deformationStack": [], "normalStrategy": "smooth", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}}, "parent": "sphere-cluster", "attachment": null, "dimensions": {"width": 0.21583, "height": 0.21583, "depth": 0.21583, "units": "world", "confidence": 0.85}, "transform": {"position": [0.07848, 0.78484, 2.3], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "floating-prop", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sphere-03", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "sphere-blue"}}, "material": "sphere-blue", "materialLayers": ["sphere-blue"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "specular-dot", "type": "gloss", "detailRef": "sphere-specular"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 164, 251, 1.0)", "secondaryAlbedo": "rgba(90, 210, 255, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}};
  node_sphere_03_14.userData.actionProfile = {"animationRole": "floating-prop", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sphere-03", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "sphere-blue"}};
  (nodes["sphere-cluster"] ?? root).add(node_sphere_03_14);
  nodes["sphere-03"] = node_sphere_03_14;
  const mesh_sphere_03_14Geometry = endpoint_sphere_03_14
    ? new THREE.CylinderGeometry(endpoint_sphere_03_14.endRadius, endpoint_sphere_03_14.baseRadius, endpoint_sphere_03_14.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_sphere_03_14) {
    mesh_sphere_03_14Geometry.scale(0.21583, 0.21583, 0.21583);
  }
  const mesh_sphere_03_14 = new THREE.Mesh(
    mesh_sphere_03_14Geometry,
    materialMap["sphere-blue"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_sphere_03_14.name = "Sphere 3";
  if (endpoint_sphere_03_14) {
    mesh_sphere_03_14.position.copy(endpoint_sphere_03_14.midpoint);
    mesh_sphere_03_14.quaternion.copy(endpoint_sphere_03_14.quaternion);
  }
  mesh_sphere_03_14.castShadow = options.castShadow ?? true;
  mesh_sphere_03_14.receiveShadow = options.receiveShadow ?? true;
  mesh_sphere_03_14.userData.sculptComponent = {"id": "sphere-03", "name": "Sphere 3", "level": "micro", "role": "detail", "importance": 0.4, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Perfect sphere prop; UV sphere tessellation.", "geometryDescriptor": {"uvStrategy": "sphere uv", "topologyIntent": "uv sphere", "deformationStack": [], "normalStrategy": "smooth", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}}, "parent": "sphere-cluster", "attachment": null, "dimensions": {"width": 0.21583, "height": 0.21583, "depth": 0.21583, "units": "world", "confidence": 0.85}, "transform": {"position": [0.07848, 0.78484, 2.3], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "floating-prop", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sphere-03", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "sphere-blue"}}, "material": "sphere-blue", "materialLayers": ["sphere-blue"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "specular-dot", "type": "gloss", "detailRef": "sphere-specular"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 164, 251, 1.0)", "secondaryAlbedo": "rgba(90, 210, 255, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}};
  node_sphere_03_14.add(mesh_sphere_03_14);
  meshes["sphere-03"] = mesh_sphere_03_14;
  colliders["sphere-03"] = {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["sphere-03"] ??= [];
  destructionGroups["sphere-03"].push(node_sphere_03_14);

  const endpoint_sphere_04_15 = makeAttachmentEndpoint(null);
  const node_sphere_04_15 = new THREE.Group();
  node_sphere_04_15.name = "Sphere 4__pivot";
  node_sphere_04_15.scale.set(1, 1, 1);
  if (endpoint_sphere_04_15) {
    node_sphere_04_15.position.copy(endpoint_sphere_04_15.start);
    node_sphere_04_15.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_sphere_04_15.position.set(0.30886, 0.11231, 2.7);
    node_sphere_04_15.rotation.set(0.0, 0.0, 0.0);
  }
  node_sphere_04_15.userData.sculptComponent = {"id": "sphere-04", "name": "Sphere 4", "level": "micro", "role": "detail", "importance": 0.4, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Perfect sphere prop; UV sphere tessellation.", "geometryDescriptor": {"uvStrategy": "sphere uv", "topologyIntent": "uv sphere", "deformationStack": [], "normalStrategy": "smooth", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}}, "parent": "sphere-cluster", "attachment": null, "dimensions": {"width": 0.33694, "height": 0.33694, "depth": 0.33694, "units": "world", "confidence": 0.85}, "transform": {"position": [0.30886, 0.11231, 2.7], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "floating-prop", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sphere-04", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "sphere-blue"}}, "material": "sphere-blue", "materialLayers": ["sphere-blue"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "specular-dot", "type": "gloss", "detailRef": "sphere-specular"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 164, 251, 1.0)", "secondaryAlbedo": "rgba(90, 210, 255, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}};
  node_sphere_04_15.userData.actionProfile = {"animationRole": "floating-prop", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sphere-04", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "sphere-blue"}};
  (nodes["sphere-cluster"] ?? root).add(node_sphere_04_15);
  nodes["sphere-04"] = node_sphere_04_15;
  const mesh_sphere_04_15Geometry = endpoint_sphere_04_15
    ? new THREE.CylinderGeometry(endpoint_sphere_04_15.endRadius, endpoint_sphere_04_15.baseRadius, endpoint_sphere_04_15.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_sphere_04_15) {
    mesh_sphere_04_15Geometry.scale(0.33694, 0.33694, 0.33694);
  }
  const mesh_sphere_04_15 = new THREE.Mesh(
    mesh_sphere_04_15Geometry,
    materialMap["sphere-blue"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_sphere_04_15.name = "Sphere 4";
  if (endpoint_sphere_04_15) {
    mesh_sphere_04_15.position.copy(endpoint_sphere_04_15.midpoint);
    mesh_sphere_04_15.quaternion.copy(endpoint_sphere_04_15.quaternion);
  }
  mesh_sphere_04_15.castShadow = options.castShadow ?? true;
  mesh_sphere_04_15.receiveShadow = options.receiveShadow ?? true;
  mesh_sphere_04_15.userData.sculptComponent = {"id": "sphere-04", "name": "Sphere 4", "level": "micro", "role": "detail", "importance": 0.4, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Perfect sphere prop; UV sphere tessellation.", "geometryDescriptor": {"uvStrategy": "sphere uv", "topologyIntent": "uv sphere", "deformationStack": [], "normalStrategy": "smooth", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}}, "parent": "sphere-cluster", "attachment": null, "dimensions": {"width": 0.33694, "height": 0.33694, "depth": 0.33694, "units": "world", "confidence": 0.85}, "transform": {"position": [0.30886, 0.11231, 2.7], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "floating-prop", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sphere-04", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "sphere-blue"}}, "material": "sphere-blue", "materialLayers": ["sphere-blue"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "specular-dot", "type": "gloss", "detailRef": "sphere-specular"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 164, 251, 1.0)", "secondaryAlbedo": "rgba(90, 210, 255, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}};
  node_sphere_04_15.add(mesh_sphere_04_15);
  meshes["sphere-04"] = mesh_sphere_04_15;
  colliders["sphere-04"] = {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["sphere-04"] ??= [];
  destructionGroups["sphere-04"].push(node_sphere_04_15);

  const endpoint_sphere_05_16 = makeAttachmentEndpoint(null);
  const node_sphere_05_16 = new THREE.Group();
  node_sphere_05_16.name = "Sphere 5__pivot";
  node_sphere_05_16.scale.set(1, 1, 1);
  if (endpoint_sphere_05_16) {
    node_sphere_05_16.position.copy(endpoint_sphere_05_16.start);
    node_sphere_05_16.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_sphere_05_16.position.set(-0.02808, -0.37438, 2.7);
    node_sphere_05_16.rotation.set(0.0, 0.0, 0.0);
  }
  node_sphere_05_16.userData.sculptComponent = {"id": "sphere-05", "name": "Sphere 5", "level": "micro", "role": "detail", "importance": 0.4, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Perfect sphere prop; UV sphere tessellation.", "geometryDescriptor": {"uvStrategy": "sphere uv", "topologyIntent": "uv sphere", "deformationStack": [], "normalStrategy": "smooth", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}}, "parent": "sphere-cluster", "attachment": null, "dimensions": {"width": 0.37438, "height": 0.37438, "depth": 0.37438, "units": "world", "confidence": 0.85}, "transform": {"position": [-0.02808, -0.37438, 2.7], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "floating-prop", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sphere-05", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "sphere-blue"}}, "material": "sphere-gloss", "materialLayers": ["sphere-blue"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "specular-dot", "type": "gloss", "detailRef": "sphere-specular"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 143, 251, 1.0)", "secondaryAlbedo": "rgba(90, 210, 255, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "sphere-gloss"}, "materialRegions": [{"regionId": "gloss", "materialId": "sphere-gloss", "profileId": "plastic.glossy", "crop": {"path": "evidence/material-evidence/12-gloss.png", "bbox": {"x": 495, "y": 538, "width": 28, "height": 28}, "sourceWidth": 1024, "sourceHeight": 1024, "loaderWarnings": [], "coverage": 0.0007}}]};
  node_sphere_05_16.userData.actionProfile = {"animationRole": "floating-prop", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sphere-05", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "sphere-blue"}};
  (nodes["sphere-cluster"] ?? root).add(node_sphere_05_16);
  nodes["sphere-05"] = node_sphere_05_16;
  const mesh_sphere_05_16Geometry = endpoint_sphere_05_16
    ? new THREE.CylinderGeometry(endpoint_sphere_05_16.endRadius, endpoint_sphere_05_16.baseRadius, endpoint_sphere_05_16.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_sphere_05_16) {
    mesh_sphere_05_16Geometry.scale(0.37438, 0.37438, 0.37438);
  }
  const mesh_sphere_05_16 = new THREE.Mesh(
    mesh_sphere_05_16Geometry,
    materialMap["sphere-gloss"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_sphere_05_16.name = "Sphere 5";
  if (endpoint_sphere_05_16) {
    mesh_sphere_05_16.position.copy(endpoint_sphere_05_16.midpoint);
    mesh_sphere_05_16.quaternion.copy(endpoint_sphere_05_16.quaternion);
  }
  mesh_sphere_05_16.castShadow = options.castShadow ?? true;
  mesh_sphere_05_16.receiveShadow = options.receiveShadow ?? true;
  mesh_sphere_05_16.userData.sculptComponent = {"id": "sphere-05", "name": "Sphere 5", "level": "micro", "role": "detail", "importance": 0.4, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Perfect sphere prop; UV sphere tessellation.", "geometryDescriptor": {"uvStrategy": "sphere uv", "topologyIntent": "uv sphere", "deformationStack": [], "normalStrategy": "smooth", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}}, "parent": "sphere-cluster", "attachment": null, "dimensions": {"width": 0.37438, "height": 0.37438, "depth": 0.37438, "units": "world", "confidence": 0.85}, "transform": {"position": [-0.02808, -0.37438, 2.7], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "floating-prop", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sphere-05", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "sphere-blue"}}, "material": "sphere-gloss", "materialLayers": ["sphere-blue"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "specular-dot", "type": "gloss", "detailRef": "sphere-specular"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 143, 251, 1.0)", "secondaryAlbedo": "rgba(90, 210, 255, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "sphere-gloss"}, "materialRegions": [{"regionId": "gloss", "materialId": "sphere-gloss", "profileId": "plastic.glossy", "crop": {"path": "evidence/material-evidence/12-gloss.png", "bbox": {"x": 495, "y": 538, "width": 28, "height": 28}, "sourceWidth": 1024, "sourceHeight": 1024, "loaderWarnings": [], "coverage": 0.0007}}]};
  node_sphere_05_16.add(mesh_sphere_05_16);
  meshes["sphere-05"] = mesh_sphere_05_16;
  colliders["sphere-05"] = {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["sphere-05"] ??= [];
  destructionGroups["sphere-05"].push(node_sphere_05_16);

  const endpoint_sphere_06_17 = makeAttachmentEndpoint(null);
  const node_sphere_06_17 = new THREE.Group();
  node_sphere_06_17.name = "Sphere 6__pivot";
  node_sphere_06_17.scale.set(1, 1, 1);
  if (endpoint_sphere_06_17) {
    node_sphere_06_17.position.copy(endpoint_sphere_06_17.start);
    node_sphere_06_17.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_sphere_06_17.position.set(0.26522, -0.2368, 2.6);
    node_sphere_06_17.rotation.set(0.0, 0.0, 0.0);
  }
  node_sphere_06_17.userData.sculptComponent = {"id": "sphere-06", "name": "Sphere 6", "level": "micro", "role": "detail", "importance": 0.4, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Perfect sphere prop; UV sphere tessellation.", "geometryDescriptor": {"uvStrategy": "sphere uv", "topologyIntent": "uv sphere", "deformationStack": [], "normalStrategy": "smooth", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}}, "parent": "sphere-cluster", "attachment": null, "dimensions": {"width": 0.11367, "height": 0.11367, "depth": 0.11367, "units": "world", "confidence": 0.85}, "transform": {"position": [0.26522, -0.2368, 2.6], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "floating-prop", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sphere-06", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "sphere-blue"}}, "material": "sphere-blue", "materialLayers": ["sphere-blue"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "specular-dot", "type": "gloss", "detailRef": "sphere-specular"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 164, 251, 1.0)", "secondaryAlbedo": "rgba(90, 210, 255, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}};
  node_sphere_06_17.userData.actionProfile = {"animationRole": "floating-prop", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sphere-06", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "sphere-blue"}};
  (nodes["sphere-cluster"] ?? root).add(node_sphere_06_17);
  nodes["sphere-06"] = node_sphere_06_17;
  const mesh_sphere_06_17Geometry = endpoint_sphere_06_17
    ? new THREE.CylinderGeometry(endpoint_sphere_06_17.endRadius, endpoint_sphere_06_17.baseRadius, endpoint_sphere_06_17.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_sphere_06_17) {
    mesh_sphere_06_17Geometry.scale(0.11367, 0.11367, 0.11367);
  }
  const mesh_sphere_06_17 = new THREE.Mesh(
    mesh_sphere_06_17Geometry,
    materialMap["sphere-blue"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_sphere_06_17.name = "Sphere 6";
  if (endpoint_sphere_06_17) {
    mesh_sphere_06_17.position.copy(endpoint_sphere_06_17.midpoint);
    mesh_sphere_06_17.quaternion.copy(endpoint_sphere_06_17.quaternion);
  }
  mesh_sphere_06_17.castShadow = options.castShadow ?? true;
  mesh_sphere_06_17.receiveShadow = options.receiveShadow ?? true;
  mesh_sphere_06_17.userData.sculptComponent = {"id": "sphere-06", "name": "Sphere 6", "level": "micro", "role": "detail", "importance": 0.4, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Perfect sphere prop; UV sphere tessellation.", "geometryDescriptor": {"uvStrategy": "sphere uv", "topologyIntent": "uv sphere", "deformationStack": [], "normalStrategy": "smooth", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}}, "parent": "sphere-cluster", "attachment": null, "dimensions": {"width": 0.11367, "height": 0.11367, "depth": 0.11367, "units": "world", "confidence": 0.85}, "transform": {"position": [0.26522, -0.2368, 2.6], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "floating-prop", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sphere-06", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "sphere-blue"}}, "material": "sphere-blue", "materialLayers": ["sphere-blue"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "specular-dot", "type": "gloss", "detailRef": "sphere-specular"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 164, 251, 1.0)", "secondaryAlbedo": "rgba(90, 210, 255, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}};
  node_sphere_06_17.add(mesh_sphere_06_17);
  meshes["sphere-06"] = mesh_sphere_06_17;
  colliders["sphere-06"] = {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["sphere-06"] ??= [];
  destructionGroups["sphere-06"].push(node_sphere_06_17);

  const endpoint_sphere_07_18 = makeAttachmentEndpoint(null);
  const node_sphere_07_18 = new THREE.Group();
  node_sphere_07_18.name = "Sphere 7__pivot";
  node_sphere_07_18.scale.set(1, 1, 1);
  if (endpoint_sphere_07_18) {
    node_sphere_07_18.position.copy(endpoint_sphere_07_18.start);
    node_sphere_07_18.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_sphere_07_18.position.set(4.17496, -0.26094, 2.1);
    node_sphere_07_18.rotation.set(0.0, 0.0, 0.0);
  }
  node_sphere_07_18.userData.sculptComponent = {"id": "sphere-07", "name": "Sphere 7", "level": "micro", "role": "detail", "importance": 0.4, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Perfect sphere prop; UV sphere tessellation.", "geometryDescriptor": {"uvStrategy": "sphere uv", "topologyIntent": "uv sphere", "deformationStack": [], "normalStrategy": "smooth", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}}, "parent": "sphere-cluster", "attachment": null, "dimensions": {"width": 0.26094, "height": 0.26094, "depth": 0.26094, "units": "world", "confidence": 0.85}, "transform": {"position": [4.17496, -0.26094, 2.1], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "floating-prop", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sphere-07", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "sphere-red"}}, "material": "sphere-red", "materialLayers": ["sphere-red"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "specular-dot", "type": "gloss", "detailRef": "sphere-specular"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(250, 32, 87, 1.0)", "secondaryAlbedo": "rgba(255, 96, 112, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}};
  node_sphere_07_18.userData.actionProfile = {"animationRole": "floating-prop", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sphere-07", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "sphere-red"}};
  (nodes["sphere-cluster"] ?? root).add(node_sphere_07_18);
  nodes["sphere-07"] = node_sphere_07_18;
  const mesh_sphere_07_18Geometry = endpoint_sphere_07_18
    ? new THREE.CylinderGeometry(endpoint_sphere_07_18.endRadius, endpoint_sphere_07_18.baseRadius, endpoint_sphere_07_18.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_sphere_07_18) {
    mesh_sphere_07_18Geometry.scale(0.26094, 0.26094, 0.26094);
  }
  const mesh_sphere_07_18 = new THREE.Mesh(
    mesh_sphere_07_18Geometry,
    materialMap["sphere-red"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_sphere_07_18.name = "Sphere 7";
  if (endpoint_sphere_07_18) {
    mesh_sphere_07_18.position.copy(endpoint_sphere_07_18.midpoint);
    mesh_sphere_07_18.quaternion.copy(endpoint_sphere_07_18.quaternion);
  }
  mesh_sphere_07_18.castShadow = options.castShadow ?? true;
  mesh_sphere_07_18.receiveShadow = options.receiveShadow ?? true;
  mesh_sphere_07_18.userData.sculptComponent = {"id": "sphere-07", "name": "Sphere 7", "level": "micro", "role": "detail", "importance": 0.4, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Perfect sphere prop; UV sphere tessellation.", "geometryDescriptor": {"uvStrategy": "sphere uv", "topologyIntent": "uv sphere", "deformationStack": [], "normalStrategy": "smooth", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}}, "parent": "sphere-cluster", "attachment": null, "dimensions": {"width": 0.26094, "height": 0.26094, "depth": 0.26094, "units": "world", "confidence": 0.85}, "transform": {"position": [4.17496, -0.26094, 2.1], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "floating-prop", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sphere-07", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "sphere-red"}}, "material": "sphere-red", "materialLayers": ["sphere-red"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "specular-dot", "type": "gloss", "detailRef": "sphere-specular"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(250, 32, 87, 1.0)", "secondaryAlbedo": "rgba(255, 96, 112, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}};
  node_sphere_07_18.add(mesh_sphere_07_18);
  meshes["sphere-07"] = mesh_sphere_07_18;
  colliders["sphere-07"] = {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["sphere-07"] ??= [];
  destructionGroups["sphere-07"].push(node_sphere_07_18);

  const endpoint_sphere_08_19 = makeAttachmentEndpoint(null);
  const node_sphere_08_19 = new THREE.Group();
  node_sphere_08_19.name = "Sphere 8__pivot";
  node_sphere_08_19.scale.set(1, 1, 1);
  if (endpoint_sphere_08_19) {
    node_sphere_08_19.position.copy(endpoint_sphere_08_19.start);
    node_sphere_08_19.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_sphere_08_19.position.set(2.57056, -1.33151, 2.8);
    node_sphere_08_19.rotation.set(0.0, 0.0, 0.0);
  }
  node_sphere_08_19.userData.sculptComponent = {"id": "sphere-08", "name": "Sphere 8", "level": "micro", "role": "detail", "importance": 0.4, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Perfect sphere prop; UV sphere tessellation.", "geometryDescriptor": {"uvStrategy": "sphere uv", "topologyIntent": "uv sphere", "deformationStack": [], "normalStrategy": "smooth", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}}, "parent": "sphere-cluster", "attachment": null, "dimensions": {"width": 0.31439, "height": 0.31439, "depth": 0.31439, "units": "world", "confidence": 0.85}, "transform": {"position": [2.57056, -1.33151, 2.8], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "floating-prop", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sphere-08", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "sphere-red"}}, "material": "sphere-red", "materialLayers": ["sphere-red"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "specular-dot", "type": "gloss", "detailRef": "sphere-specular"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(250, 32, 87, 1.0)", "secondaryAlbedo": "rgba(255, 96, 112, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "sphere-red"}, "materialRegions": [{"regionId": "sphere", "materialId": "sphere-red", "profileId": "plastic.glossy", "crop": {"path": "evidence/material-evidence/10-sphere.png", "bbox": {"x": 780, "y": 646, "width": 20, "height": 20}, "sourceWidth": 1024, "sourceHeight": 1024, "loaderWarnings": [], "coverage": 0.0004}}]};
  node_sphere_08_19.userData.actionProfile = {"animationRole": "floating-prop", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sphere-08", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "sphere-red"}};
  (nodes["sphere-cluster"] ?? root).add(node_sphere_08_19);
  nodes["sphere-08"] = node_sphere_08_19;
  const mesh_sphere_08_19Geometry = endpoint_sphere_08_19
    ? new THREE.CylinderGeometry(endpoint_sphere_08_19.endRadius, endpoint_sphere_08_19.baseRadius, endpoint_sphere_08_19.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_sphere_08_19) {
    mesh_sphere_08_19Geometry.scale(0.31439, 0.31439, 0.31439);
  }
  const mesh_sphere_08_19 = new THREE.Mesh(
    mesh_sphere_08_19Geometry,
    materialMap["sphere-red"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_sphere_08_19.name = "Sphere 8";
  if (endpoint_sphere_08_19) {
    mesh_sphere_08_19.position.copy(endpoint_sphere_08_19.midpoint);
    mesh_sphere_08_19.quaternion.copy(endpoint_sphere_08_19.quaternion);
  }
  mesh_sphere_08_19.castShadow = options.castShadow ?? true;
  mesh_sphere_08_19.receiveShadow = options.receiveShadow ?? true;
  mesh_sphere_08_19.userData.sculptComponent = {"id": "sphere-08", "name": "Sphere 8", "level": "micro", "role": "detail", "importance": 0.4, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Perfect sphere prop; UV sphere tessellation.", "geometryDescriptor": {"uvStrategy": "sphere uv", "topologyIntent": "uv sphere", "deformationStack": [], "normalStrategy": "smooth", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}}, "parent": "sphere-cluster", "attachment": null, "dimensions": {"width": 0.31439, "height": 0.31439, "depth": 0.31439, "units": "world", "confidence": 0.85}, "transform": {"position": [2.57056, -1.33151, 2.8], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "floating-prop", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sphere-08", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "sphere-red"}}, "material": "sphere-red", "materialLayers": ["sphere-red"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "specular-dot", "type": "gloss", "detailRef": "sphere-specular"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(250, 32, 87, 1.0)", "secondaryAlbedo": "rgba(255, 96, 112, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "sphere-red"}, "materialRegions": [{"regionId": "sphere", "materialId": "sphere-red", "profileId": "plastic.glossy", "crop": {"path": "evidence/material-evidence/10-sphere.png", "bbox": {"x": 780, "y": 646, "width": 20, "height": 20}, "sourceWidth": 1024, "sourceHeight": 1024, "loaderWarnings": [], "coverage": 0.0004}}]};
  node_sphere_08_19.add(mesh_sphere_08_19);
  meshes["sphere-08"] = mesh_sphere_08_19;
  colliders["sphere-08"] = {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["sphere-08"] ??= [];
  destructionGroups["sphere-08"].push(node_sphere_08_19);

  const endpoint_sphere_09_20 = makeAttachmentEndpoint(null);
  const node_sphere_09_20 = new THREE.Group();
  node_sphere_09_20.name = "Sphere 9__pivot";
  node_sphere_09_20.scale.set(1, 1, 1);
  if (endpoint_sphere_09_20) {
    node_sphere_09_20.position.copy(endpoint_sphere_09_20.start);
    node_sphere_09_20.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_sphere_09_20.position.set(2.68536, -1.70803, 2.9);
    node_sphere_09_20.rotation.set(0.0, 0.0, 0.0);
  }
  node_sphere_09_20.userData.sculptComponent = {"id": "sphere-09", "name": "Sphere 9", "level": "micro", "role": "detail", "importance": 0.4, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Perfect sphere prop; UV sphere tessellation.", "geometryDescriptor": {"uvStrategy": "sphere uv", "topologyIntent": "uv sphere", "deformationStack": [], "normalStrategy": "smooth", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}}, "parent": "sphere-cluster", "attachment": null, "dimensions": {"width": 0.32882, "height": 0.32882, "depth": 0.32882, "units": "world", "confidence": 0.85}, "transform": {"position": [2.68536, -1.70803, 2.9], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "floating-prop", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sphere-09", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "sphere-violet"}}, "material": "sphere-violet", "materialLayers": ["sphere-violet"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "specular-dot", "type": "gloss", "detailRef": "sphere-specular"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(135, 60, 248, 1.0)", "secondaryAlbedo": "rgba(192, 144, 255, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "sphere-violet"}, "materialRegions": [{"regionId": "sphere", "materialId": "sphere-violet", "profileId": "plastic.glossy", "crop": {"path": "evidence/material-evidence/11-sphere.png", "bbox": {"x": 796, "y": 689, "width": 20, "height": 20}, "sourceWidth": 1024, "sourceHeight": 1024, "loaderWarnings": [], "coverage": 0.0004}}]};
  node_sphere_09_20.userData.actionProfile = {"animationRole": "floating-prop", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sphere-09", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "sphere-violet"}};
  (nodes["sphere-cluster"] ?? root).add(node_sphere_09_20);
  nodes["sphere-09"] = node_sphere_09_20;
  const mesh_sphere_09_20Geometry = endpoint_sphere_09_20
    ? new THREE.CylinderGeometry(endpoint_sphere_09_20.endRadius, endpoint_sphere_09_20.baseRadius, endpoint_sphere_09_20.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_sphere_09_20) {
    mesh_sphere_09_20Geometry.scale(0.32882, 0.32882, 0.32882);
  }
  const mesh_sphere_09_20 = new THREE.Mesh(
    mesh_sphere_09_20Geometry,
    materialMap["sphere-violet"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_sphere_09_20.name = "Sphere 9";
  if (endpoint_sphere_09_20) {
    mesh_sphere_09_20.position.copy(endpoint_sphere_09_20.midpoint);
    mesh_sphere_09_20.quaternion.copy(endpoint_sphere_09_20.quaternion);
  }
  mesh_sphere_09_20.castShadow = options.castShadow ?? true;
  mesh_sphere_09_20.receiveShadow = options.receiveShadow ?? true;
  mesh_sphere_09_20.userData.sculptComponent = {"id": "sphere-09", "name": "Sphere 9", "level": "micro", "role": "detail", "importance": 0.4, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Perfect sphere prop; UV sphere tessellation.", "geometryDescriptor": {"uvStrategy": "sphere uv", "topologyIntent": "uv sphere", "deformationStack": [], "normalStrategy": "smooth", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}}, "parent": "sphere-cluster", "attachment": null, "dimensions": {"width": 0.32882, "height": 0.32882, "depth": 0.32882, "units": "world", "confidence": 0.85}, "transform": {"position": [2.68536, -1.70803, 2.9], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "floating-prop", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sphere-09", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "sphere-violet"}}, "material": "sphere-violet", "materialLayers": ["sphere-violet"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "specular-dot", "type": "gloss", "detailRef": "sphere-specular"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(135, 60, 248, 1.0)", "secondaryAlbedo": "rgba(192, 144, 255, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "sphere-violet"}, "materialRegions": [{"regionId": "sphere", "materialId": "sphere-violet", "profileId": "plastic.glossy", "crop": {"path": "evidence/material-evidence/11-sphere.png", "bbox": {"x": 796, "y": 689, "width": 20, "height": 20}, "sourceWidth": 1024, "sourceHeight": 1024, "loaderWarnings": [], "coverage": 0.0004}}]};
  node_sphere_09_20.add(mesh_sphere_09_20);
  meshes["sphere-09"] = mesh_sphere_09_20;
  colliders["sphere-09"] = {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["sphere-09"] ??= [];
  destructionGroups["sphere-09"].push(node_sphere_09_20);

  const endpoint_sphere_10_21 = makeAttachmentEndpoint(null);
  const node_sphere_10_21 = new THREE.Group();
  node_sphere_10_21.name = "Sphere 10__pivot";
  node_sphere_10_21.scale.set(1, 1, 1);
  if (endpoint_sphere_10_21) {
    node_sphere_10_21.position.copy(endpoint_sphere_10_21.start);
    node_sphere_10_21.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_sphere_10_21.position.set(0.5363, -2.68152, 2.8);
    node_sphere_10_21.rotation.set(0.0, 0.0, 0.0);
  }
  node_sphere_10_21.userData.sculptComponent = {"id": "sphere-10", "name": "Sphere 10", "level": "micro", "role": "detail", "importance": 0.4, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Perfect sphere prop; UV sphere tessellation.", "geometryDescriptor": {"uvStrategy": "sphere uv", "topologyIntent": "uv sphere", "deformationStack": [], "normalStrategy": "smooth", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}}, "parent": "sphere-cluster", "attachment": null, "dimensions": {"width": 0.35137, "height": 0.35137, "depth": 0.35137, "units": "world", "confidence": 0.85}, "transform": {"position": [0.5363, -2.68152, 2.8], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "floating-prop", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sphere-10", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "sphere-blue"}}, "material": "sphere-blue", "materialLayers": ["sphere-blue"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "specular-dot", "type": "gloss", "detailRef": "sphere-specular"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 164, 251, 1.0)", "secondaryAlbedo": "rgba(90, 210, 255, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}};
  node_sphere_10_21.userData.actionProfile = {"animationRole": "floating-prop", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sphere-10", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "sphere-blue"}};
  (nodes["sphere-cluster"] ?? root).add(node_sphere_10_21);
  nodes["sphere-10"] = node_sphere_10_21;
  const mesh_sphere_10_21Geometry = endpoint_sphere_10_21
    ? new THREE.CylinderGeometry(endpoint_sphere_10_21.endRadius, endpoint_sphere_10_21.baseRadius, endpoint_sphere_10_21.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_sphere_10_21) {
    mesh_sphere_10_21Geometry.scale(0.35137, 0.35137, 0.35137);
  }
  const mesh_sphere_10_21 = new THREE.Mesh(
    mesh_sphere_10_21Geometry,
    materialMap["sphere-blue"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_sphere_10_21.name = "Sphere 10";
  if (endpoint_sphere_10_21) {
    mesh_sphere_10_21.position.copy(endpoint_sphere_10_21.midpoint);
    mesh_sphere_10_21.quaternion.copy(endpoint_sphere_10_21.quaternion);
  }
  mesh_sphere_10_21.castShadow = options.castShadow ?? true;
  mesh_sphere_10_21.receiveShadow = options.receiveShadow ?? true;
  mesh_sphere_10_21.userData.sculptComponent = {"id": "sphere-10", "name": "Sphere 10", "level": "micro", "role": "detail", "importance": 0.4, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Perfect sphere prop; UV sphere tessellation.", "geometryDescriptor": {"uvStrategy": "sphere uv", "topologyIntent": "uv sphere", "deformationStack": [], "normalStrategy": "smooth", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}}, "parent": "sphere-cluster", "attachment": null, "dimensions": {"width": 0.35137, "height": 0.35137, "depth": 0.35137, "units": "world", "confidence": 0.85}, "transform": {"position": [0.5363, -2.68152, 2.8], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "floating-prop", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sphere-10", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "sphere-blue"}}, "material": "sphere-blue", "materialLayers": ["sphere-blue"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "specular-dot", "type": "gloss", "detailRef": "sphere-specular"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 164, 251, 1.0)", "secondaryAlbedo": "rgba(90, 210, 255, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}};
  node_sphere_10_21.add(mesh_sphere_10_21);
  meshes["sphere-10"] = mesh_sphere_10_21;
  colliders["sphere-10"] = {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["sphere-10"] ??= [];
  destructionGroups["sphere-10"].push(node_sphere_10_21);

  const endpoint_sphere_11_22 = makeAttachmentEndpoint(null);
  const node_sphere_11_22 = new THREE.Group();
  node_sphere_11_22.name = "Sphere 11__pivot";
  node_sphere_11_22.scale.set(1, 1, 1);
  if (endpoint_sphere_11_22) {
    node_sphere_11_22.position.copy(endpoint_sphere_11_22.start);
    node_sphere_11_22.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_sphere_11_22.position.set(0.25575, -3.00267, 2.6);
    node_sphere_11_22.rotation.set(0.0, 0.0, 0.0);
  }
  node_sphere_11_22.userData.sculptComponent = {"id": "sphere-11", "name": "Sphere 11", "level": "micro", "role": "detail", "importance": 0.4, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Perfect sphere prop; UV sphere tessellation.", "geometryDescriptor": {"uvStrategy": "sphere uv", "topologyIntent": "uv sphere", "deformationStack": [], "normalStrategy": "smooth", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}}, "parent": "sphere-cluster", "attachment": null, "dimensions": {"width": 0.18944, "height": 0.18944, "depth": 0.18944, "units": "world", "confidence": 0.85}, "transform": {"position": [0.25575, -3.00267, 2.6], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "floating-prop", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sphere-11", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "sphere-blue"}}, "material": "sphere-blue", "materialLayers": ["sphere-blue"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "specular-dot", "type": "gloss", "detailRef": "sphere-specular"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 164, 251, 1.0)", "secondaryAlbedo": "rgba(90, 210, 255, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}};
  node_sphere_11_22.userData.actionProfile = {"animationRole": "floating-prop", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sphere-11", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "sphere-blue"}};
  (nodes["sphere-cluster"] ?? root).add(node_sphere_11_22);
  nodes["sphere-11"] = node_sphere_11_22;
  const mesh_sphere_11_22Geometry = endpoint_sphere_11_22
    ? new THREE.CylinderGeometry(endpoint_sphere_11_22.endRadius, endpoint_sphere_11_22.baseRadius, endpoint_sphere_11_22.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_sphere_11_22) {
    mesh_sphere_11_22Geometry.scale(0.18944, 0.18944, 0.18944);
  }
  const mesh_sphere_11_22 = new THREE.Mesh(
    mesh_sphere_11_22Geometry,
    materialMap["sphere-blue"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_sphere_11_22.name = "Sphere 11";
  if (endpoint_sphere_11_22) {
    mesh_sphere_11_22.position.copy(endpoint_sphere_11_22.midpoint);
    mesh_sphere_11_22.quaternion.copy(endpoint_sphere_11_22.quaternion);
  }
  mesh_sphere_11_22.castShadow = options.castShadow ?? true;
  mesh_sphere_11_22.receiveShadow = options.receiveShadow ?? true;
  mesh_sphere_11_22.userData.sculptComponent = {"id": "sphere-11", "name": "Sphere 11", "level": "micro", "role": "detail", "importance": 0.4, "confidence": 0.8, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Perfect sphere prop; UV sphere tessellation.", "geometryDescriptor": {"uvStrategy": "sphere uv", "topologyIntent": "uv sphere", "deformationStack": [], "normalStrategy": "smooth", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}}, "parent": "sphere-cluster", "attachment": null, "dimensions": {"width": 0.18944, "height": 0.18944, "depth": 0.18944, "units": "world", "confidence": 0.85}, "transform": {"position": [0.25575, -3.00267, 2.6], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "floating-prop", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sphere-11", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "sphere-blue"}}, "material": "sphere-blue", "materialLayers": ["sphere-blue"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "specular-dot", "type": "gloss", "detailRef": "sphere-specular"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 164, 251, 1.0)", "secondaryAlbedo": "rgba(90, 210, 255, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"], "dominantAlbedoSource": "median of material-regions.json crop in ref.png (visible colour incl. baked glow)"}};
  node_sphere_11_22.add(mesh_sphere_11_22);
  meshes["sphere-11"] = mesh_sphere_11_22;
  colliders["sphere-11"] = {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["sphere-11"] ??= [];
  destructionGroups["sphere-11"].push(node_sphere_11_22);

  // repetition system: satellite-spheres (InstancedMesh, radial, count=11, level=meso)
  {
    const parent = nodes["root"] ?? root;
    const geo = new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
    const mat = materialMap["printed-panel"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 });
    // Contract (PLAN_1.5 WS-E): instanceScale is ABSOLUTE, in the parent pivot's
    // local units -- it is never multiplied by the parent component's own declared
    // dimensional scale. This falls out of the same fix as componentTree: the pivot
    // Group this cluster is parented to always carries identity scale (dimensions are
    // baked into that component's OWN geometry, not exposed on the Group), so an
    // instanced fastener/tooth/spoke sized [0.05, 0.05, 0.05] renders at exactly that
    // size regardless of how non-uniformly its host component is shaped, and a
    // `radial` ring's placement stays circular instead of being squashed into an
    // ellipse by a non-uniform host.
    const scl = [0.1, 0.1, 0.1];
    const axis = new THREE.Vector3(0.0, 0.0, 1.0).normalize();
    const radius = 0.0;
    const seed = Math.abs(axis.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const perp = new THREE.Vector3().crossVectors(axis, seed).normalize();
    // One InstancedMesh = one draw call for all repeated parts (teeth/fasteners/spokes),
    // replacing the former per-instance Mesh clone loop (real-time perf principle).
    const cluster = new THREE.InstancedMesh(geo, mat, 11);
    const _m = new THREE.Matrix4();
    const _p = new THREE.Vector3();
    const _q = new THREE.Quaternion();
    const _s = new THREE.Vector3(scl[0], scl[1], scl[2]);
    for (let i = 0; i < 11; i++) {
      const ang = ((0.0) + (i * 360) / 11) * Math.PI / 180;
      const dir = perp.clone().applyQuaternion(new THREE.Quaternion().setFromAxisAngle(axis, ang));
      _p.copy(radius > 0 ? dir.clone().multiplyScalar(radius * 0.5) : new THREE.Vector3());
      _q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
      _m.compose(_p, _q, _s);
      cluster.setMatrixAt(i, _m);
    }
    cluster.instanceMatrix.needsUpdate = true;
    cluster.castShadow = options.castShadow ?? true;
    cluster.receiveShadow = options.receiveShadow ?? true;
    cluster.name = "satellite-spheres";
    parent.add(cluster);
  }

  root.userData.sculptRuntime = { nodes, meshes, sockets, colliders, destructionGroups } satisfies ProceduralModelRuntime;
  root.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  root.userData.actionReadiness = {
    note: 'Use root.userData.sculptRuntime.nodes for transforms, sockets for attachments, colliders for physics proxies, and destructionGroups for breakable sets.',
  };
  return root;
}

export function createIcon4DEmblemLookDevLights(
  mode: 'neutral' | 'grazing' | 'reference' = 'neutral',
): THREE.Group {
  const lights = new THREE.Group();
  lights.name = "Icon 4D Emblem look-dev lights";
  const hemi = new THREE.HemisphereLight(
    mode === 'reference' ? 0xfff0d6 : 0xf2f4ff,
    0x363b42,
    mode === 'grazing' ? 0.28 : mode === 'reference' ? 0.72 : 0.85,
  );
  lights.add(hemi);
  const key = new THREE.DirectionalLight(
    mode === 'reference' ? 0xffcf8a : 0xfff4e8,
    mode === 'grazing' ? 4.2 : mode === 'reference' ? 2.6 : 2.15,
  );
  if (mode === 'grazing') key.position.set(7.5, 1.1, 4.0);
  else if (mode === 'reference') key.position.set(-4.5, 7.5, 5.0);
  else key.position.set(-4.0, 6.0, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.018;
  key.shadow.radius = 7;
  key.shadow.blurSamples = 24;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -2.6;
  key.shadow.camera.right = 2.6;
  key.shadow.camera.top = 2.6;
  key.shadow.camera.bottom = -2.6;
  key.shadow.camera.updateProjectionMatrix();
  lights.add(key);
  const fill = new THREE.DirectionalLight(0xa8c4ff, mode === 'grazing' ? 0.12 : 0.42);
  fill.position.set(4.0, 3.0, 3.5);
  lights.add(fill);
  const rim = new THREE.DirectionalLight(0xfff1c4, mode === 'grazing' ? 0.28 : 0.85);
  rim.position.set(0.5, 4.5, -6.0);
  lights.add(rim);
  lights.userData.reviewMode = mode;
  lights.userData.lightingFromPhoto = [{"id": "key", "type": "directional", "direction": [-0.5, 0.8, 0.6], "intensity": 1.6, "color": "#FFFFFF", "evidence": "sphere/glyph highlights upper-left"}, {"id": "fill", "type": "directional", "direction": [0.7, 0.2, 0.5], "intensity": 0.5, "color": "#CFE6FF", "evidence": "soft right-side fill on D bowl"}, {"id": "rim", "type": "directional", "direction": [0.2, 0.4, -1.0], "intensity": 0.8, "color": "#FF7AD0", "evidence": "pink/cyan edge glow along glyph silhouettes"}, {"id": "env", "type": "environment", "intensity": 0.9, "source": "RoomEnvironment PMREM", "evidence": "glossy reflections on glyphs and spheres"}, {"id": "tone", "type": "renderer", "toneMapping": "ACES filmic", "exposure": 1.05, "outputColorSpace": "sRGB", "evidence": "saturated but unclipped palette"}, {"id": "shadow", "type": "shadow-policy", "contactShadow": "none (floating emblem on transparent bg); ambient occlusion minimal", "evidence": "no ground plane in reference"}];
  lights.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  return lights;
}

// PBR materials (clearcoat/iridescence/transmission/anisotropy) need an environment
// map to visually behave as intended — call this once per renderer and assign the
// result to scene.environment before rendering. No external HDR asset required.
export function createIcon4DEmblemEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return texture;
}

// Plan 1.3 §3.2 — auto-framing by bounding box. The Divine Eye can only compare a
// render to the reference if the object is FRAMED consistently (an object framed
// differently scores as wrong even when its shape is right). This positions the camera
// deterministically from the object's bounding box so it fills the frame at a stable
// margin, and sets near/far to the object scale. Call after adding the model to the
// scene, and again on resize (after updating camera.aspect).
export function frameIcon4DEmblemCamera(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  options: { margin?: number; azimuthDeg?: number; elevationDeg?: number } = {},
): void {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const margin = options.margin ?? 1.15;
  const maxDim = Math.max(size.x, size.y, size.z) * margin;
  const fov = (camera.fov * Math.PI) / 180;
  // distance so the largest object dimension fits vertically in the frame
  const distance = (maxDim / 2) / Math.tan(fov / 2);
  const az = ((options.azimuthDeg ?? 0) * Math.PI) / 180;
  const el = ((options.elevationDeg ?? 0) * Math.PI) / 180;
  const dir = new THREE.Vector3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    Math.cos(az) * Math.cos(el),
  );
  camera.position.copy(center).addScaledVector(dir, distance);
  camera.near = Math.max(0.01, distance - maxDim);
  camera.far = distance + maxDim * 2;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}

// Plan 1.3 §3.2c — PRESENTATION composer (DOF + bloom). CRITICAL (R-POSTFX): this is
// for the showcase/hero render ONLY. The Divine Eye's EVALUATION render MUST use a
// plain renderer with NO composer — bloom blows highlights and DOF blurs edges, which
// would corrupt the deterministic IoU/DCD/edge/blowout signals. Enable dof/bloom ONLY
// when the reference photo actually exhibits them (detect_reference_effects.py authorizes).
export function createIcon4DEmblemPresentationComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: { dof?: boolean; bloom?: boolean; bloomStrength?: number; dofFocus?: number; dofAperture?: number } = {},
): EffectComposer {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  if (options.dof) {
    composer.addPass(new BokehPass(scene, camera, {
      focus: options.dofFocus ?? 10.0,
      aperture: options.dofAperture ?? 0.0002,
      maxblur: 0.01,
    }));
  }
  if (options.bloom) {
    const size = new THREE.Vector2();
    renderer.getSize(size);
    composer.addPass(new UnrealBloomPass(size, options.bloomStrength ?? 0.4, 0.4, 0.85));
  }
  return composer;
}

export function configureIcon4DEmblemRenderer(renderer: THREE.WebGLRenderer): void {
  // Load-bearing for view-dependent finishes (anodized / Doppler): without ACES + sRGB
  // the environment reflection reads flat/washed instead of a believable metal response.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

export function createIcon4DEmblemInspectControls(
  camera: THREE.Camera,
  domElement: HTMLElement,
): OrbitControls {
  // View-dependent finishes only read correctly once the user orbits — their color
  // comes from the environment reflection, not albedo, so free rotation matters here.
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.minDistance = 1.0;
  controls.maxDistance = 8.0;
  controls.autoRotate = false;
  return controls;
}
