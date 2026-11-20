import { a as core, b as readImageMetadata } from './main-Crzs4l-Y.js';
import { eS as MathUtils, aM as Group, h as Mesh, bp as PlaneGeometry, f_ as WebGLRenderTarget, a2 as OrthographicCamera, i as Scene, ab as Texture, a4 as NoColorSpace, L as LinearMipmapLinearFilter, j as LinearFilter, a7 as NearestFilter, ak as DataTexture, fj as ShaderMaterial, M as Matrix3, V as Vector3, Q as Vector2 } from './three-DQIwNvhE.js';
import './feature-icons-DdmKTgW2.js';
import './model-extension-BDXGpmfH.js';
import './intro-scene-D_WhMe6N.js';
import './room-acoustics-Bwk-VQOn.js';
import './_commonjsHelpers-1n8l_yFW.js';
import './slice-stack-HPsHxT3J.js';
import './image-slices-reader-BDYkC6Bg.js';
import './volume-voxels-CI6ldnye.js';

// 2D images (JPEG, PNG, WebP, AVIF, GIF, BMP): one image, or a set of them
// (a .zip of photos, several files dropped at once), shown as a plane facing
// the camera and enhanced on the GPU. Loaded dynamically by loaders.js.
//
// The plane is the image's size in metres when the file gives its
// resolution (DPI: a scan, a document), so the ruler measures the object;
// else one scene unit per pixel. Its shader (FRAGMENT) applies, in order:
//
//   sharpen      unsharp mask (the pixel against its four neighbours)
//   dstretch     decorrelation stretch: the colours rotated onto their
//                principal axes, each stretched to the same spread and
//                rotated back - faint pigments (rock art, faded ink, a
//                palimpsest) stand out in strong colours
//   levels       auto levels: each channel from its 0.5th to its 99.5th
//                percentile stretched to the full range
//   equalize     histogram equalisation of the luminance (a LUT)
//   channel      all, red, green, blue or the luminance alone
//   brightness, contrast, gamma, saturation
//   relief       embossed in a light direction: worn inscriptions, tool
//                marks, coins (as a raking light does to a 3D model)
//   edges        Sobel edges
//   invert
//   falseColor   the luminance through a colour map (inferno, viridis,
//                turbo): small differences in brightness seen as hues
//
// and, comparing, shows the original left of `split`. Transparency over a
// checkerboard. The statistics (histogram, percentiles, LUT, colour
// covariance) come once per image from a copy at most STATS_SIZE pixels
// across. Settings (root.userData.image) are JSON and shared by the images
// of a set.

const IMAGE_FILTER_DEFAULTS = Object.freeze({
  brightness: 0,
  contrast: 1,
  gamma: 1,
  saturation: 1,
  invert: false,
  channel: "rgb",
  autoLevels: false,
  equalize: false,
  sharpen: 0,
  relief: 0,
  reliefAngle: 135,
  edges: 0,
  dstretch: false,
  falseColor: "none",
  compare: false,
  split: 0.5,
});
const IMAGE_CHANNELS = ["rgb", "red", "green", "blue", "luminance"];
const FALSE_COLOR_MAPS = ["none", "inferno", "viridis", "turbo"];
const STATS_SIZE = 512;
const MAX_TEXTURE = 8192;
const THUMBNAIL_SIZE = 160;

const states = new WeakMap();
const getImageState = (root) => states.get(root) || null;

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Colour maps: polynomial fits of matplotlib's inferno and viridis and of
// Google's turbo.
const FRAGMENT = /* glsl */ `
  uniform sampler2D map;
  uniform sampler2D lut;
  uniform vec2 texel;
  uniform float brightness;
  uniform float contrast;
  uniform float gamma;
  uniform float saturation;
  uniform float sharpen;
  uniform float relief;
  uniform float reliefAngle;
  uniform float edges;
  uniform float split;
  uniform bool invert;
  uniform bool equalize;
  uniform bool dstretch;
  uniform bool levels;
  uniform bool encodeLinear;
  uniform int channel;
  uniform int falseColor;
  uniform vec3 levelLow;
  uniform vec3 levelHigh;
  uniform vec3 dMean;
  uniform mat3 dMatrix;
  varying vec2 vUv;

  vec4 tex(vec2 uv) { return texture2D(map, vec2(uv.x, 1.0 - uv.y)); }
  float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

  vec3 inferno(float t) {
    const vec3 c0 = vec3(0.0002189403691192265, 0.001651004631001012, -0.01948089843709184);
    const vec3 c1 = vec3(0.1065134194856116, 0.5639564367884091, 3.932712388889277);
    const vec3 c2 = vec3(11.60249308247187, -3.972853965665698, -15.9423941062914);
    const vec3 c3 = vec3(-41.70399613139459, 17.43639888205313, 44.35414519872813);
    const vec3 c4 = vec3(77.162935699427, -33.40235894210092, -81.80730925738993);
    const vec3 c5 = vec3(-71.31942824499214, 32.62606426397723, 73.20951985803202);
    const vec3 c6 = vec3(25.13112622477341, -12.24266895238567, -23.07032500287172);
    return c0 + t * (c1 + t * (c2 + t * (c3 + t * (c4 + t * (c5 + t * c6)))));
  }
  vec3 viridis(float t) {
    const vec3 c0 = vec3(0.2777273272234177, 0.005407344544966578, 0.3340998053353061);
    const vec3 c1 = vec3(0.1050930431085774, 1.404613529898575, 1.384590162594685);
    const vec3 c2 = vec3(-0.3308618287255563, 0.214847559468213, 0.09509516302823659);
    const vec3 c3 = vec3(-4.634230498983486, -5.799100973351585, -19.33244095627987);
    const vec3 c4 = vec3(6.228269936347081, 14.17993336680509, 56.69055260068105);
    const vec3 c5 = vec3(4.776384997670288, -13.74514537774601, -65.35303263337234);
    const vec3 c6 = vec3(-5.435455855934631, 4.645852612178535, 26.3124352495832);
    return c0 + t * (c1 + t * (c2 + t * (c3 + t * (c4 + t * (c5 + t * c6)))));
  }
  vec3 turbo(float t) {
    const vec4 kr = vec4(0.13572138, 4.61539260, -42.66032258, 132.13108234);
    const vec4 kg = vec4(0.09140261, 2.19418839, 4.84296658, -14.18503333);
    const vec4 kb = vec4(0.10667330, 12.64194608, -60.58204836, 110.36276771);
    const vec2 kr2 = vec2(-152.94239396, 59.28637943);
    const vec2 kg2 = vec2(4.27729857, 2.82956604);
    const vec2 kb2 = vec2(-89.90310912, 27.34824973);
    vec4 v4 = vec4(1.0, t, t * t, t * t * t);
    vec2 v2 = v4.zw * v4.z;
    return vec3(dot(v4, kr) + dot(v2, kr2), dot(v4, kg) + dot(v2, kg2), dot(v4, kb) + dot(v2, kb2));
  }
  vec3 toLinear(vec3 c) {
    return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
  }

  void main() {
    vec4 source = tex(vUv);
    vec3 c = source.rgb;
    if (sharpen > 0.0) {
      vec3 around = tex(vUv + vec2(texel.x, 0.0)).rgb + tex(vUv - vec2(texel.x, 0.0)).rgb
        + tex(vUv + vec2(0.0, texel.y)).rgb + tex(vUv - vec2(0.0, texel.y)).rgb;
      c = clamp(c + sharpen * (4.0 * c - around), 0.0, 1.0);
    }
    if (dstretch) c = clamp(dMatrix * (c - dMean) + vec3(0.5), 0.0, 1.0);
    if (levels) c = clamp((c - levelLow) / max(levelHigh - levelLow, vec3(0.004)), 0.0, 1.0);
    if (equalize) {
      float y = luma(c);
      float mapped = texture2D(lut, vec2(y * (255.0 / 256.0) + 0.5 / 256.0, 0.5)).r;
      c = clamp(c * (mapped / max(y, 0.004)), 0.0, 1.0);
    }
    if (channel == 1) c = vec3(c.r);
    else if (channel == 2) c = vec3(c.g);
    else if (channel == 3) c = vec3(c.b);
    else if (channel == 4) c = vec3(luma(c));
    c = (c - 0.5) * contrast + 0.5 + brightness;
    c = pow(clamp(c, 0.0, 1.0), vec3(1.0 / gamma));
    c = clamp(mix(vec3(luma(c)), c, saturation), 0.0, 1.0);
    if (relief > 0.0) {
      vec2 d = vec2(cos(reliefAngle), sin(reliefAngle)) * texel * 1.5;
      float shade = clamp(0.5 + (luma(tex(vUv - d).rgb) - luma(tex(vUv + d).rgb)) * 4.0, 0.0, 1.0);
      c = mix(c, vec3(shade), relief);
    }
    if (edges > 0.0) {
      float tl = luma(tex(vUv + vec2(-texel.x, texel.y)).rgb);
      float t = luma(tex(vUv + vec2(0.0, texel.y)).rgb);
      float tr = luma(tex(vUv + texel).rgb);
      float l = luma(tex(vUv - vec2(texel.x, 0.0)).rgb);
      float r = luma(tex(vUv + vec2(texel.x, 0.0)).rgb);
      float bl = luma(tex(vUv - texel).rgb);
      float b = luma(tex(vUv - vec2(0.0, texel.y)).rgb);
      float br = luma(tex(vUv + vec2(texel.x, -texel.y)).rgb);
      float gx = tr + 2.0 * r + br - tl - 2.0 * l - bl;
      float gy = tl + 2.0 * t + tr - bl - 2.0 * b - br;
      c = mix(c, vec3(clamp(length(vec2(gx, gy)) * 1.5, 0.0, 1.0)), edges);
    }
    if (invert) c = 1.0 - c;
    if (falseColor == 1) c = inferno(luma(c));
    else if (falseColor == 2) c = viridis(luma(c));
    else if (falseColor == 3) c = turbo(luma(c));
    c = clamp(c, 0.0, 1.0);
    if (split >= 0.0 && vUv.x < split) c = source.rgb;
    // Transparency over a checkerboard.
    float check = mod(floor(gl_FragCoord.x / 8.0) + floor(gl_FragCoord.y / 8.0), 2.0);
    c = mix(vec3(0.78 + 0.12 * check), c, source.a);
    if (split >= 0.0 && abs(vUv.x - split) < texel.x * 1.5) c = vec3(1.0, 0.72, 0.3);
    gl_FragColor = vec4(encodeLinear ? toLinear(c) : c, 1.0);
    #include <colorspace_fragment>
  }
`;

function createMaterial() {
  const lut = new DataTexture(new Uint8Array(256 * 4).fill(255), 256, 1);
  lut.needsUpdate = true;
  return new ShaderMaterial({
    name: "Image",
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    toneMapped: false,
    uniforms: {
      map: { value: null },
      lut: { value: lut },
      texel: { value: new Vector2(1 / 1024, 1 / 1024) },
      brightness: { value: 0 },
      contrast: { value: 1 },
      gamma: { value: 1 },
      saturation: { value: 1 },
      sharpen: { value: 0 },
      relief: { value: 0 },
      reliefAngle: { value: 0 },
      edges: { value: 0 },
      split: { value: -1 },
      invert: { value: false },
      equalize: { value: false },
      dstretch: { value: false },
      levels: { value: false },
      encodeLinear: { value: true },
      channel: { value: 0 },
      falseColor: { value: 0 },
      levelLow: { value: new Vector3(0, 0, 0) },
      levelHigh: { value: new Vector3(1, 1, 1) },
      dMean: { value: new Vector3(0.5, 0.5, 0.5) },
      dMatrix: { value: new Matrix3() },
    },
  });
}

// ---- statistics ----

// Eigen decomposition of a symmetric 3×3 matrix (Jacobi rotations):
// { values: [3], vectors: [3][3] (columns) }.
function symmetricEigen(m) {
  const a = m.map((row) => row.slice());
  const v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 32; sweep++) {
    let off = 0;
    for (let p = 0; p < 3; p++) for (let q = p + 1; q < 3; q++) off += a[p][q] ** 2;
    if (off < 1e-14) break;
    for (let p = 0; p < 3; p++) {
      for (let q = p + 1; q < 3; q++) {
        if (Math.abs(a[p][q]) < 1e-15) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < 3; k++) {
          const akp = a[k][p];
          const akq = a[k][q];
          a[k][p] = c * akp - s * akq;
          a[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < 3; k++) {
          const apk = a[p][k];
          const aqk = a[q][k];
          a[p][k] = c * apk - s * aqk;
          a[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < 3; k++) {
          const vkp = v[k][p];
          const vkq = v[k][q];
          v[k][p] = c * vkp - s * vkq;
          v[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }
  return { values: [a[0][0], a[1][1], a[2][2]], vectors: v };
}

// Histogram, percentiles, the equalisation LUT and the decorrelation
// stretch of RGBA pixels (0..255).
function imageStatistics(pixels) {
  const histogram = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
  let count = 0;
  const sum = [0, 0, 0];
  const products = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 8) continue;
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    histogram[0][r] += 1;
    histogram[1][g] += 1;
    histogram[2][b] += 1;
    histogram[3][Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b)] += 1;
    const x = r / 255;
    const y = g / 255;
    const z = b / 255;
    sum[0] += x; sum[1] += y; sum[2] += z;
    products[0] += x * x; products[1] += x * y; products[2] += x * z;
    products[3] += y * y; products[4] += y * z; products[5] += z * z;
    count += 1;
  }
  const n = Math.max(1, count);
  const percentile = (bins, fraction) => {
    const goal = fraction * n;
    let total = 0;
    for (let i = 0; i < 256; i++) {
      total += bins[i];
      if (total >= goal) return i / 255;
    }
    return 1;
  };
  const low = [0, 1, 2].map((c) => percentile(histogram[c], 0.005));
  const high = [0, 1, 2].map((c) => Math.max(percentile(histogram[c], 0.995), low[c] + 1 / 255));
  // Equalisation: the luminance's cumulative distribution.
  const lut = new Uint8Array(256 * 4);
  let total = 0;
  for (let i = 0; i < 256; i++) {
    total += histogram[3][i];
    const value = Math.round((total / n) * 255);
    lut.set([value, value, value, 255], i * 4);
  }
  // Decorrelation stretch: T = V · diag(target / sqrt(λ)) · Vᵀ.
  const mean = sum.map((value) => value / n);
  const cov = (k, a, b) => products[k] / n - mean[a] * mean[b];
  const covariance = [
    [cov(0, 0, 0), cov(1, 0, 1), cov(2, 0, 2)],
    [cov(1, 0, 1), cov(3, 1, 1), cov(4, 1, 2)],
    [cov(2, 0, 2), cov(4, 1, 2), cov(5, 2, 2)],
  ];
  const { values, vectors } = symmetricEigen(covariance);
  const target = 0.15;
  const scale = values.map((value) => target / Math.sqrt(Math.max(value, 1e-6)));
  const matrix = [0, 1, 2].map((row) => [0, 1, 2].map((column) => (
    [0, 1, 2].reduce((acc, k) => acc + vectors[row][k] * scale[k] * vectors[column][k], 0)
  )));
  return { histogram, count, low, high, lut, dstretch: { mean, matrix } };
}

// ---- loading ----

async function itemBytes(item) {
  if (item.file) return item.file.arrayBuffer();
  const response = await fetch(item.url);
  if (!response.ok) throw new Error(`Could not load ${item.name} (${response.status}).`);
  return response.arrayBuffer();
}

function maxTextureSize() {
  return Math.min(MAX_TEXTURE, core.renderer?.capabilities?.maxTextureSize || 4096);
}

// The image decoded, upright (EXIF orientation), at most the texture size.
async function decode(blob) {
  const options = { imageOrientation: "from-image", premultiplyAlpha: "none", colorSpaceConversion: "none" };
  let bitmap = await createImageBitmap(blob, options);
  const limit = maxTextureSize();
  const largest = Math.max(bitmap.width, bitmap.height);
  if (largest > limit) {
    const factor = limit / largest;
    const resized = await createImageBitmap(blob, {
      ...options,
      resizeWidth: Math.max(1, Math.round(bitmap.width * factor)),
      resizeHeight: Math.max(1, Math.round(bitmap.height * factor)),
      resizeQuality: "high",
    });
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return { bitmap: resized, width: size.width, height: size.height };
  }
  return { bitmap, width: bitmap.width, height: bitmap.height };
}

function statisticsOf(bitmap) {
  const factor = Math.min(1, STATS_SIZE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * factor));
  const height = Math.max(1, Math.round(bitmap.height * factor));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(bitmap, 0, 0, width, height);
  return imageStatistics(context.getImageData(0, 0, width, height).data);
}

// A small JPEG of the image for the filmstrip (a data: URL).
async function imageThumbnail(item) {
  if (item.thumbnail) return item.thumbnail;
  const blob = item.file || await (await fetch(item.url)).blob();
  const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
  const factor = Math.min(1, THUMBNAIL_SIZE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * factor));
  canvas.height = Math.max(1, Math.round(bitmap.height * factor));
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  item.thumbnail = canvas.toDataURL("image/jpeg", 0.8);
  return item.thumbnail;
}

// items: [{ name, file } | { name, url }], the set (one item: one image).
async function buildImageModel(items, { index = 0, name = "Image" } = {}) {
  const root = new Group();
  root.name = name;
  root.userData.isImage2D = true;
  root.userData.image = { ...IMAGE_FILTER_DEFAULTS };
  // Seen straight on (viewer-utils.js fitCameraToCenteredObject).
  root.userData.viewDirection = [0, 0, -1];
  const material = createMaterial();
  const plane = new Mesh(new PlaneGeometry(1, 1), material);
  plane.name = "Image";
  plane.userData.isImagePlane = true;
  root.add(plane);
  const state = { root, plane, material, items, index: -1, texture: null, stats: null, loading: null, listeners: new Set() };
  states.set(root, state);
  await showImage(root, index);
  return root;
}

function onImageChange(root, listener) {
  const state = states.get(root);
  state?.listeners.add(listener);
  return () => state?.listeners.delete(listener);
}

// Shows image `index` of the set: its texture, its size, its statistics;
// the settings stay.
async function showImage(root, index) {
  const state = states.get(root);
  if (!state) return false;
  const count = state.items.length;
  const next = ((index % count) + count) % count;
  const item = state.items[next];
  const token = {};
  state.loading = token;
  const bytes = await itemBytes(item);
  const metadata = readImageMetadata(bytes, item.name.split(".").pop());
  const { bitmap, width, height } = await decode(new Blob([bytes]));
  if (state.loading !== token || !states.has(root)) {
    bitmap.close();
    return false;
  }
  const stats = statisticsOf(bitmap);
  const texture = new Texture(bitmap);
  texture.flipY = false;
  texture.colorSpace = NoColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = bitmap.width < width ? LinearFilter : NearestFilter;
  texture.anisotropy = core.renderer?.capabilities?.getMaxAnisotropy?.() || 1;
  texture.needsUpdate = true;
  const previous = state.texture;
  state.texture = texture;
  state.stats = stats;
  state.index = next;
  state.loading = null;
  if (previous) {
    previous.image?.close?.();
    previous.dispose();
  }
  // Metres per pixel from the resolution; else a unit per pixel.
  const metersPerPixel = metadata.dpi ? 0.0254 / metadata.dpi : null;
  const unit = metersPerPixel || 1;
  state.plane.scale.set(width * unit, height * unit, 1);
  state.plane.updateMatrixWorld(true);
  root.userData.imageMetersPerUnit = metersPerPixel ? 1 : null;
  root.userData.imageInfo = {
    name: item.name,
    index: next,
    count,
    size: bytes.byteLength,
    width,
    height,
    shown: [bitmap.width, bitmap.height],
    metersPerPixel,
    ...metadata,
    tags: metadata.tags,
  };
  const uniforms = state.material.uniforms;
  uniforms.map.value = texture;
  uniforms.texel.value.set(1 / bitmap.width, 1 / bitmap.height);
  uniforms.levelLow.value.fromArray(stats.low);
  uniforms.levelHigh.value.fromArray(stats.high);
  uniforms.lut.value.image.data.set(stats.lut);
  uniforms.lut.value.needsUpdate = true;
  uniforms.dMean.value.fromArray(stats.dstretch.mean);
  const m = stats.dstretch.matrix;
  uniforms.dMatrix.value.set(m[0][0], m[0][1], m[0][2], m[1][0], m[1][1], m[1][2], m[2][0], m[2][1], m[2][2]);
  applyImageSettings(root);
  state.listeners.forEach((listener) => listener("image"));
  return true;
}

// The settings (root.userData.image) into the shader.
function applyImageSettings(root) {
  const state = states.get(root);
  if (!state) return;
  const s = root.userData.image;
  const u = state.material.uniforms;
  u.brightness.value = s.brightness;
  u.contrast.value = s.contrast;
  u.gamma.value = s.gamma;
  u.saturation.value = s.saturation;
  u.invert.value = Boolean(s.invert);
  u.channel.value = Math.max(0, IMAGE_CHANNELS.indexOf(s.channel));
  u.levels.value = Boolean(s.autoLevels);
  u.equalize.value = Boolean(s.equalize);
  u.sharpen.value = s.sharpen;
  u.relief.value = s.relief;
  u.reliefAngle.value = MathUtils.degToRad(s.reliefAngle);
  u.edges.value = s.edges;
  u.dstretch.value = Boolean(s.dstretch);
  u.falseColor.value = Math.max(0, FALSE_COLOR_MAPS.indexOf(s.falseColor));
  u.split.value = s.compare ? s.split : -1;
}

// The image as enhanced, at the resolution it is shown in, as a PNG Blob
// (no comparison line, no checkerboard behind opaque pixels).
async function renderEnhancedImage(root) {
  const state = states.get(root);
  const renderer = core.renderer;
  if (!state?.texture || !renderer?.isWebGLRenderer) return null;
  const { width, height } = state.texture.image;
  const target = new WebGLRenderTarget(width, height);
  const camera = new OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 2);
  camera.position.z = 1;
  const scene = new Scene();
  const quad = new Mesh(new PlaneGeometry(1, 1), state.material);
  scene.add(quad);
  const u = state.material.uniforms;
  const split = u.split.value;
  u.split.value = -1;
  u.encodeLinear.value = false;
  const previous = renderer.getRenderTarget();
  const pixels = new Uint8Array(width * height * 4);
  try {
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
  } finally {
    renderer.setRenderTarget(previous);
    u.split.value = split;
    u.encodeLinear.value = true;
    target.dispose();
    quad.geometry.dispose();
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const image = new ImageData(width, height);
  const row = width * 4;
  // WebGL rows run bottom-up.
  for (let y = 0; y < height; y++) image.data.set(pixels.subarray((height - 1 - y) * row, (height - y) * row), y * row);
  canvas.getContext("2d").putImageData(image, 0, 0);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

function disposeImage(root) {
  const state = states.get(root);
  if (!state) return;
  states.delete(root);
  state.loading = null;
  state.listeners.clear();
  state.texture?.image?.close?.();
  state.texture?.dispose();
  state.material.uniforms.lut.value.dispose();
  state.material.dispose();
  state.plane.geometry.dispose();
}

export { FALSE_COLOR_MAPS, IMAGE_CHANNELS, IMAGE_FILTER_DEFAULTS, applyImageSettings, buildImageModel, disposeImage, getImageState, imageStatistics, imageThumbnail, onImageChange, renderEnhancedImage, showImage };
//# sourceMappingURL=image2d-Cy9K0Gis.js.map
