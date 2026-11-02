import THREE from "./init.js";

// Volumes: microscope image stacks (Leica .lif, converted by the worker -
// worker/lif.py) drawn by ray marching through 3D textures. Loaded
// dynamically by loaders.js, like splats.js, with the first volume.
//
// The worker writes a manifest (<name>.dfgvol, JSON) listing the stacks of
// the file, each with its 8-bit voxels in a gzip file next to it (channel by
// channel, x fastest), its voxel size in µm and its channels' colours and
// value ranges. One stack is shown at a time; loadVolumeSeries() switches.
// A .lif, TIFF stack, NRRD, NIfTI or MetaImage file opened without the
// worker (from the disk, or a URL) is read here in the browser -
// lif-reader.js, tiff-reader.js, raw-volume-reader.js - into the same
// manifest and voxels.
//
// The stack is a unit box under a group (afterLoad() resets the root's
// transform), scaled to its size in µm - the scene unit is a micrometre
// (detectFileUnit(), editor/model-units.js) - and turned so the image
// planes lie flat and the stack's Z points up. Its back faces are drawn, so
// the camera may also go inside; each pixel marches through the box from
// the camera, roughly a step per voxel (times the "sampling"), with a
// random start against banding:
//
//   mip  the maximum of each channel along the ray, channels added in their
//        colours - the usual first look at fluorescence;
//   dvr  emission and absorption: each voxel glows in its channels' colours
//        and hides what is behind it as much as it is bright (× density);
//   iso  the first point where a channel crosses the threshold, shaded by
//        the gradient of that channel as a surface lit from the camera.
//
// Each channel has its window: values below `low` are left out and those
// above `high` are full. The box is not picked (its faces are not the
// sample's surface) and casts no shadows; clipping planes do not cut it.

export const MAX_CHANNELS = 4;
export const VOLUME_MODES = ["mip", "dvr", "iso"];
const MAX_STEPS = 1536;
const DEFAULT_DENSITY = 0.01;

// Each instance's textures, by mesh (not in userData, which is serialised).
const textures = new WeakMap();
// A file opened directly (lif-reader.js, tiff-reader.js), by mesh: reads its
// stacks itself.
const directReaders = new WeakMap();

async function gunzip(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const vertexShader = /* glsl */ `
  out vec3 vOrigin;
  out vec3 vDirection;

  void main() {
    mat4 toLocal = inverse(modelMatrix);
    if (projectionMatrix[3][3] == 1.0) {
      // Orthographic: parallel rays along the camera's view direction.
      vec3 forward = -vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
      vec3 direction = normalize((toLocal * vec4(forward, 0.0)).xyz);
      vOrigin = position - direction * 4.0;
      vDirection = direction * 4.0;
    } else {
      vOrigin = (toLocal * vec4(cameraPosition, 1.0)).xyz;
      vDirection = position - vOrigin;
    }
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  precision highp sampler3D;

  uniform sampler3D uVolume0;
  uniform sampler3D uVolume1;
  uniform sampler3D uVolume2;
  uniform sampler3D uVolume3;
  uniform int uChannelCount;
  uniform vec3 uColor[${MAX_CHANNELS}];
  uniform vec2 uWindow[${MAX_CHANNELS}];
  uniform float uOn[${MAX_CHANNELS}];
  uniform int uMode;
  uniform int uIsoChannel;
  uniform float uIso;
  uniform float uDensity;
  uniform float uBrightness;
  uniform float uSampling;
  uniform vec3 uDims;
  uniform vec3 uSize;

  in vec3 vOrigin;
  in vec3 vDirection;
  out vec4 outColor;

  vec2 hitBox(vec3 origin, vec3 direction) {
    vec3 reciprocal = 1.0 / direction;
    vec3 t0 = (vec3(-0.5) - origin) * reciprocal;
    vec3 t1 = (vec3(0.5) - origin) * reciprocal;
    vec3 near = min(t0, t1);
    vec3 far = max(t0, t1);
    return vec2(max(max(near.x, near.y), near.z), min(min(far.x, far.y), far.z));
  }

  float windowed(float value, int channel) {
    vec2 w = uWindow[channel];
    return clamp((value - w.x) / max(w.y - w.x, 1e-4), 0.0, 1.0) * uOn[channel];
  }

  float raw(int channel, vec3 p) {
    if (channel == 0) return texture(uVolume0, p).r;
    if (channel == 1) return texture(uVolume1, p).r;
    if (channel == 2) return texture(uVolume2, p).r;
    return texture(uVolume3, p).r;
  }

  vec4 sampleAll(vec3 p) {
    vec4 v = vec4(0.0);
    v.x = windowed(texture(uVolume0, p).r, 0);
    if (uChannelCount > 1) v.y = windowed(texture(uVolume1, p).r, 1);
    if (uChannelCount > 2) v.z = windowed(texture(uVolume2, p).r, 2);
    if (uChannelCount > 3) v.w = windowed(texture(uVolume3, p).r, 3);
    return v;
  }

  vec3 colorOf(vec4 v) {
    return uColor[0] * v.x + uColor[1] * v.y + uColor[2] * v.z + uColor[3] * v.w;
  }

  float isoValue(vec3 p) {
    return windowed(raw(uIsoChannel, p), uIsoChannel);
  }

  void main() {
    vec3 direction = normalize(vDirection);
    vec2 bounds = hitBox(vOrigin, direction);
    if (bounds.x > bounds.y) discard;
    bounds.x = max(bounds.x, 0.0);
    float stepSize = 1.0 / (length(direction * uDims) * uSampling);
    float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    float t = bounds.x + stepSize * jitter;

    if (uMode == 0) {
      vec4 peak = vec4(0.0);
      for (int i = 0; i < ${MAX_STEPS}; i++) {
        if (t > bounds.y) break;
        peak = max(peak, sampleAll(vOrigin + direction * t + 0.5));
        t += stepSize;
      }
      vec3 color = colorOf(peak) * uBrightness;
      float alpha = clamp(max(max(color.r, color.g), color.b), 0.0, 1.0);
      if (alpha < 0.004) discard;
      outColor = vec4(min(color / alpha, vec3(1.0)), alpha);
      return;
    }

    if (uMode == 1) {
      vec4 sum = vec4(0.0);
      for (int i = 0; i < ${MAX_STEPS}; i++) {
        if (t > bounds.y || sum.a > 0.98) break;
        vec4 v = sampleAll(vOrigin + direction * t + 0.5);
        float strongest = max(max(v.x, v.y), max(v.z, v.w));
        if (strongest > 0.0) {
          // Opacity per voxel, corrected for the step length.
          float alpha = 1.0 - pow(1.0 - clamp(strongest * uDensity, 0.0, 0.999), 1.0 / uSampling);
          vec3 color = colorOf(v) / strongest * uBrightness;
          sum.rgb += (1.0 - sum.a) * alpha * color;
          sum.a += (1.0 - sum.a) * alpha;
        }
        t += stepSize;
      }
      if (sum.a < 0.004) discard;
      outColor = vec4(min(sum.rgb / sum.a, vec3(1.0)), sum.a);
      return;
    }

    for (int i = 0; i < ${MAX_STEPS}; i++) {
      if (t > bounds.y) break;
      float value = isoValue(vOrigin + direction * t + 0.5);
      if (value >= uIso && i > 0) {
        // The crossing, between the last step and this one.
        float a = t - stepSize;
        float b = t;
        for (int k = 0; k < 5; k++) {
          float m = 0.5 * (a + b);
          if (isoValue(vOrigin + direction * m + 0.5) >= uIso) b = m; else a = m;
        }
        vec3 p = vOrigin + direction * b + 0.5;
        vec3 d = 1.0 / uDims;
        vec3 gradient = vec3(
          isoValue(p + vec3(d.x, 0.0, 0.0)) - isoValue(p - vec3(d.x, 0.0, 0.0)),
          isoValue(p + vec3(0.0, d.y, 0.0)) - isoValue(p - vec3(0.0, d.y, 0.0)),
          isoValue(p + vec3(0.0, 0.0, d.z)) - isoValue(p - vec3(0.0, 0.0, d.z))
        );
        // In µm, where the box is not a cube: the gradient over the size.
        vec3 normal = length(gradient) > 0.0 ? normalize(gradient / uSize) : -direction;
        float facing = abs(dot(normal, normalize(direction * uSize)));
        vec3 color = uColor[uIsoChannel] * (0.25 + 0.75 * facing) + vec3(0.25) * pow(facing, 24.0);
        outColor = vec4(min(color * uBrightness, vec3(1.0)), 1.0);
        return;
      }
      t += stepSize;
    }
    discard;
  }
`;

function createMaterial() {
  const empty = volumeTexture(new Uint8Array(1), 1, 1, 1);
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader,
    fragmentShader,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uVolume0: { value: empty },
      uVolume1: { value: empty },
      uVolume2: { value: empty },
      uVolume3: { value: empty },
      uChannelCount: { value: 1 },
      uColor: { value: Array.from({ length: MAX_CHANNELS }, () => new THREE.Color(0xffffff)) },
      uWindow: { value: Array.from({ length: MAX_CHANNELS }, () => new THREE.Vector2(0, 1)) },
      uOn: { value: new Array(MAX_CHANNELS).fill(0) },
      uMode: { value: 0 },
      uIsoChannel: { value: 0 },
      uIso: { value: 0.3 },
      uDensity: { value: DEFAULT_DENSITY },
      uBrightness: { value: 1 },
      uSampling: { value: 1 },
      uDims: { value: new THREE.Vector3(1, 1, 1) },
      uSize: { value: new THREE.Vector3(1, 1, 1) },
    },
  });
}

function volumeTexture(data, x, y, z) {
  const texture = new THREE.Data3DTexture(data, x, y, z);
  texture.format = THREE.RedFormat;
  texture.type = THREE.UnsignedByteType;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = texture.wrapR = THREE.ClampToEdgeWrapping;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}

// The display settings of a stack's channels, from the manifest: transmitted
// light (a detector named "Trans ...") starts hidden, since it fills the
// whole box; the window starts at half the channel's threshold, above the
// background noise.
function channelSettings(series) {
  return series.channels.slice(0, MAX_CHANNELS).map((channel) => ({
    name: channel.name,
    on: !/^trans\b/i.test(channel.name),
    color: channel.color || "#ffffff",
    low: Math.min(0.5, (Number(channel.threshold) || 0) * 0.5),
    high: 1,
  }));
}

export function getVolumeMesh(root) {
  let mesh = null;
  root?.traverse?.((child) => {
    if (!mesh && child.userData?.isVolume && child.isMesh) mesh = child;
  });
  return mesh;
}

// Pushes mesh.userData.volume (the settings the panel changes) into the shader.
export function applyVolumeSettings(root) {
  const mesh = getVolumeMesh(root);
  const state = mesh?.userData.volume;
  if (!state) return;
  const uniforms = mesh.material.uniforms;
  uniforms.uMode.value = Math.max(0, VOLUME_MODES.indexOf(state.mode));
  state.channels.forEach((channel, i) => {
    uniforms.uColor.value[i].set(channel.color);
    uniforms.uWindow.value[i].set(channel.low, Math.max(channel.high, channel.low + 0.004));
    uniforms.uOn.value[i] = channel.on ? 1 : 0;
  });
  uniforms.uIsoChannel.value = Math.min(state.isoChannel, state.channels.length - 1);
  uniforms.uIso.value = state.iso;
  uniforms.uDensity.value = state.density;
  uniforms.uBrightness.value = state.brightness;
  uniforms.uSampling.value = state.sampling;
}

// The voxels of a converted stack, next to its manifest.
async function fetchSeriesBytes(state, series, onProgress) {
  const response = await fetch(new URL(series.data, state.url).href);
  if (!response.ok) throw new Error(`Volume data ${series.data}: HTTP ${response.status}`);
  const total = Number(response.headers.get("Content-Length")) || 0;
  let bytes;
  if (onProgress && response.body && total) {
    const reader = response.body.getReader();
    const parts = [];
    let loaded = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
      loaded += value.length;
      onProgress({ loaded, total });
    }
    bytes = new Uint8Array(loaded);
    let at = 0;
    parts.forEach((part) => {
      bytes.set(part, at);
      at += part.length;
    });
  } else {
    bytes = new Uint8Array(await response.arrayBuffer());
  }
  // A .gz is served as it is; behind a proxy that decodes it, it arrives unpacked.
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = await gunzip(bytes);
  return bytes;
}

// Shows stack `index` of the manifest: reads its voxels and replaces the
// textures, size and channel settings.
export async function loadVolumeSeries(root, index, { onProgress } = {}) {
  const mesh = getVolumeMesh(root);
  const state = mesh?.userData.volume;
  const series = state?.manifest.series[index];
  if (!series) throw new Error(`No image stack ${index} in the volume`);
  const direct = directReaders.get(mesh);
  const bytes = direct ? await direct.loadSeries(index, { onProgress }) : await fetchSeriesBytes(state, series, onProgress);
  const [nx, ny, nz] = series.dims;
  const voxels = nx * ny * nz;
  if (bytes.length < voxels * series.channels.length) {
    throw new Error(`Volume data of ${series.name} is shorter than ${nx}×${ny}×${nz}×${series.channels.length}`);
  }

  const uniforms = mesh.material.uniforms;
  (textures.get(mesh) || []).forEach((texture) => texture.dispose());
  const created = series.channels.slice(0, MAX_CHANNELS).map((_channel, c) => (
    volumeTexture(bytes.subarray(c * voxels, (c + 1) * voxels), nx, ny, nz)
  ));
  textures.set(mesh, created);
  created.forEach((texture, c) => {
    uniforms[`uVolume${c}`].value = texture;
  });
  uniforms.uChannelCount.value = created.length;
  uniforms.uDims.value.set(nx, ny, nz);
  const [vx, vy, vz] = series.voxelSize;
  uniforms.uSize.value.set(nx * vx, ny * vy, nz * vz);
  mesh.scale.copy(uniforms.uSize.value);
  mesh.updateMatrixWorld(true);

  state.seriesIndex = index;
  state.channels = channelSettings(series);
  state.isoChannel = Math.max(0, state.channels.findIndex((channel) => channel.on));
  // A quarter of the way from the channel's Otsu threshold to full: Otsu
  // alone splits off the background and leaves its noise on the surface.
  const otsu = Number(series.channels[state.isoChannel]?.threshold) || 0.2;
  state.iso = Math.min(0.9, otsu + (1 - otsu) * 0.25);
  // "µm", or "px" when the file does not say (editor/model-units.js).
  root.userData.volumeSeries = { name: series.name, dims: series.dims, voxelSize: series.voxelSize, unit: series.unit || "µm" };
  applyVolumeSettings(root);
  return series;
}

function createVolumeRoot(manifest, url, name) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), createMaterial());
  mesh.name = "Volume";
  // Image planes flat, the stack's Z up.
  mesh.rotation.x = -Math.PI / 2;
  mesh.raycast = () => {};
  mesh.userData.isVolume = true;
  mesh.userData.volume = {
    url,
    manifest,
    seriesIndex: 0,
    mode: "mip",
    channels: [],
    isoChannel: 0,
    iso: 0.3,
    density: DEFAULT_DENSITY,
    brightness: 1,
    sampling: 1,
  };
  const root = new THREE.Group();
  root.name = name;
  root.userData.isVolume = true;
  root.add(mesh);
  return root;
}

// The volume of the manifest at url (absolute), with its first stack loaded.
export async function buildVolumeModel(url, { name = "Volume", onProgress } = {}) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Volume manifest: HTTP ${response.status}`);
  const manifest = await response.json();
  if (manifest?.format !== "dfg-volume" || !manifest.series?.length) {
    throw new Error("Not a volume manifest, or no image stack in it");
  }
  const root = createVolumeRoot(manifest, url, name);
  await loadVolumeSeries(root, 0, { onProgress });
  return root;
}

// Readers of the formats opened without the worker, by model extension.
const DIRECT_READERS = {
  lif: async (source, fileName) => (await import("./lif-reader.js")).openLif(source, fileName),
  tiff: async (source, fileName, siblings) => (await import("./tiff-reader.js")).openTiff(source, fileName, siblings),
  raw: async (source, fileName, siblings) => (await import("./raw-volume-reader.js")).openRawVolume(source, fileName, siblings),
};
const DIRECT_FORMATS = { lif: "lif", tif: "tiff", tiff: "tiff", nrrd: "raw", nhdr: "raw", nii: "raw", mha: "raw", mhd: "raw" };
export const DIRECT_VOLUME_EXTENSIONS = Object.keys(DIRECT_FORMATS);

// An image stack read in the browser from a File ({ file }) or a URL
// ({ url }), with its first stack loaded; siblings: the other files of the
// archive it came from (TIFF slices, a .nhdr's or .mhd's data file).
export async function buildDirectVolumeModel(extension, source, { name = "Volume", fileName = "image", siblings = null, onProgress } = {}) {
  const reader = await DIRECT_READERS[DIRECT_FORMATS[extension]](source, fileName, siblings);
  const root = createVolumeRoot(reader.manifest, null, name);
  directReaders.set(getVolumeMesh(root), reader);
  await loadVolumeSeries(root, 0, { onProgress });
  return root;
}

export function disposeVolume(mesh) {
  (textures.get(mesh) || []).forEach((texture) => texture.dispose());
  textures.delete(mesh);
  directReaders.delete(mesh);
  Object.values(mesh.material?.uniforms || {}).forEach(({ value }) => {
    if (value?.isTexture) value.dispose();
  });
}
