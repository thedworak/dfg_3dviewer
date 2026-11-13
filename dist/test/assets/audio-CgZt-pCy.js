import { r as readAudioMetadata, A as AUDIO_MIME_TYPES, c as canvasFont } from './main-Bi507_M4.js';
import { t as toDb, a as analyzeAudio } from './audio-analysis-BRwyCUP5.js';
import { V as Vector3, aM as Group, du as Box3, aq as Plane, C as Color, bb as SRGBColorSpace, a1 as Matrix4, h as Mesh, b0 as MeshStandardMaterial, ai as DoubleSide, aW as MeshBasicMaterial, B as BoxGeometry, dB as CanvasTexture, fw as Sprite, bf as SpriteMaterial, am as BufferGeometry, a9 as BufferAttribute } from './three-DQIwNvhE.js';
import './feature-icons-D3oF2ScJ.js';
import './model-extension-BDXGpmfH.js';
import './intro-scene-DnRWY5Zp.js';
import './room-acoustics-Bwk-VQOn.js';
import './_commonjsHelpers-1n8l_yFW.js';
import './slice-stack-HPsHxT3J.js';
import './image-slices-reader-BDYkC6Bg.js';
import './volume-voxels-CI6ldnye.js';

// Audio files (WAV / Broadcast Wave, MP3, FLAC, Ogg Vorbis / Opus, M4A /
// AAC, WebM): heard, and seen as a landscape. Loaded dynamically by
// loaders.js with the first audio file, like volume.js.
//
// The file is read whole: its header (audio-metadata.js) gives the format,
// the tags and the markers; the browser decodes it (decodeAudioData, at the
// file's own sample rate) for the analysis (audio-analysis.js, in a Web
// Worker): waveform, spectrogram, levels. The decoded samples are dropped
// then - playing streams the file from a blob: URL through an <audio>
// element into the Web Audio graph of AudioPlayer, where the effects are.
// A file too large to decode at once (MAX_DECODE_BYTES) is only played.
//
// The scene, under one group (afterLoad() resets the root's transform),
// SCENE_WIDTH wide whatever the duration:
//
//   the spectrogram as a terrain - time along X, frequency along Z (low at
//   the back, where sound is mostly loudest, so the landscape rises away
//   from the camera and hides little; linear or logarithmic), the level as
//   height and colour (the `range` dB below the loudest are shown);
//   the waveform lying flat in front of it, coloured where already played;
//   the playhead, a pane across both at the current time - dragged with
//   the pointer, it moves the time (editor/audio-panel.js);
//   labels: the times in front, the frequencies at the left.
//
// Settings (root.userData.audio) are JSON (userData is serialised); the
// player, the analysis and the meshes are kept here, by root.

const SCENE_WIDTH = 12;
const SCENE_DEPTH = 5;
const TERRAIN_HEIGHT = 1.8;
// The flat waveform: its half width (full scale), its gap to the terrain.
const WAVE_HALF = 0.6;
const WAVE_GAP = 0.3;
const WAVE_CENTRE = SCENE_DEPTH / 2 + WAVE_GAP + WAVE_HALF;
const FRONT = WAVE_CENTRE + WAVE_HALF;
const TERRAIN_COLUMNS = 480;
const TERRAIN_ROWS = 144;
const WAVE_COLUMNS = 1200;
// Larger files are played, not decoded (the samples would take several
// times this as 32-bit floats).
const MAX_DECODE_BYTES = 400 * 1024 * 1024;
const MIN_LOG_FREQUENCY = 20;

const FREQUENCY_SCALES = ["log", "linear"];
const CHANNEL_MODES = ["stereo", "mono", "left", "right"];
const FILTER_TYPES = ["off", "lowpass", "highpass", "bandpass", "notch"];
const REVERB_PRESETS = ["off", "room", "hall", "church"];
const REVERB_SECONDS = { room: 0.7, hall: 2.4, church: 5 };
const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

const DEFAULT_AUDIO_SETTINGS = Object.freeze({
  frequencyScale: "log",
  range: 60,
  heightScale: 1,
  showTerrain: true,
  showWaveform: true,
});

const states = new WeakMap();

const getAudioState = (root) => states.get(root) || null;

// ---- Colours ----

// Inferno (matplotlib), sRGB: dark violet to pale yellow.
const INFERNO = [
  [0, 0, 4], [40, 11, 84], [101, 21, 110], [159, 42, 99],
  [212, 72, 66], [245, 125, 21], [250, 193, 39], [252, 255, 164],
];

// t in 0..1 -> [r, g, b] in 0..255 (sRGB).
function infernoColor(t) {
  const x = Math.min(1, Math.max(0, t)) * (INFERNO.length - 1);
  const i = Math.min(INFERNO.length - 2, Math.floor(x));
  const f = x - i;
  const a = INFERNO[i];
  const b = INFERNO[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

// ---- Time and frequency ----

function formatTime(seconds, { precise = false } = {}) {
  if (!Number.isFinite(seconds) || seconds < 0) return "–:––";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const secondsText = precise ? rest.toFixed(1).padStart(4, "0") : String(Math.floor(rest)).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${secondsText}` : `${minutes}:${secondsText}`;
}

function formatFrequency(hz) {
  if (hz >= 1000) return `${Number((hz / 1000).toPrecision(hz >= 10000 ? 3 : 2))} kHz`;
  return `${Math.round(hz)} Hz`;
}

// The frequency at `fraction` (0 bottom .. 1 top) of the axis.
function frequencyAt(fraction, nyquist, scale) {
  if (scale === "linear") return fraction * nyquist;
  const low = Math.min(MIN_LOG_FREQUENCY, nyquist / 2);
  return low * Math.pow(nyquist / low, fraction);
}

// Where `hz` is on the axis (0..1), the inverse of frequencyAt().
function frequencyFraction(hz, nyquist, scale) {
  if (scale === "linear") return hz / nyquist;
  const low = Math.min(MIN_LOG_FREQUENCY, nyquist / 2);
  return Math.log(Math.max(hz, low) / low) / Math.log(nyquist / low);
}

// Frequencies worth a label on the axis.
function frequencyTicks(nyquist, scale) {
  const candidates = scale === "linear"
    ? [0.25, 0.5, 0.75].map((f) => Math.round((f * nyquist) / 1000) * 1000).filter((hz) => hz > 0)
    : [100, 1000, 10000];
  return [...new Set(candidates)].filter((hz) => hz < nyquist * 0.95);
}

// The spectrogram resampled to `columns` × `rows` (rows on the frequency
// axis, bottom first), in dB: the loudest bin of each cell.
function spectrogramGrid(spectrogram, columns, rows, scale) {
  const { columns: sourceColumns, bins, data, sampleRate, fftSize } = spectrogram;
  const nyquist = sampleRate / 2;
  const binHz = sampleRate / fftSize;
  // The bins each row covers.
  const rowBins = [];
  for (let r = 0; r < rows; r++) {
    const low = frequencyAt(r / rows, nyquist, scale) / binHz;
    const high = frequencyAt((r + 1) / rows, nyquist, scale) / binHz;
    const first = Math.min(bins - 1, Math.max(0, Math.floor(low)));
    rowBins.push([first, Math.min(bins - 1, Math.max(first, Math.ceil(high) - 1))]);
  }
  const grid = new Float32Array(columns * rows);
  for (let c = 0; c < columns; c++) {
    const from = Math.floor((c * sourceColumns) / columns);
    const to = Math.max(from + 1, Math.floor(((c + 1) * sourceColumns) / columns));
    for (let r = 0; r < rows; r++) {
      const [first, last] = rowBins[r];
      let best = 0;
      for (let sc = from; sc < to && sc < sourceColumns; sc++) {
        const base = sc * bins;
        for (let b = first; b <= last; b++) if (data[base + b] > best) best = data[base + b];
      }
      grid[c * rows + r] = toDb(best);
    }
  }
  return grid;
}

// ---- Loading ----

function runAnalysis(channels, sampleRate, onProgress) {
  const onMainThread = () => Promise.resolve(analyzeAudio({ channels, sampleRate }, { onProgress }));
  return new Promise((resolve, reject) => {
    let worker;
    try {
      worker = new Worker(new URL(new URL('audio-analysis-worker-BShiWa1C.js', import.meta.url).href), { type: "module" });
    } catch {
      onMainThread().then(resolve, reject);
      return;
    }
    let started = false;
    worker.onmessage = ({ data }) => {
      if (data?.type === "ready") {
        started = true;
        // Copies: the samples stay here for the main thread should the
        // worker fail.
        const copies = channels.map((samples) => samples.slice());
        worker.postMessage({ channels: copies, sampleRate }, copies.map((samples) => samples.buffer));
      } else if (data?.type === "progress") {
        onProgress?.(data.progress);
      } else if (data?.type === "done") {
        worker.terminate();
        resolve(data.result);
      } else if (data?.type === "error") {
        worker.terminate();
        reject(new Error(data.message));
      }
    };
    worker.onerror = (event) => {
      event.preventDefault?.();
      worker.terminate();
      if (!started) onMainThread().then(resolve, reject);
      else reject(new Error(event.message || "Audio analysis failed"));
    };
  });
}

// Whether the browser can play the file at all (when it could not decode it).
function canPlay(url) {
  return new Promise((resolve) => {
    const element = new Audio();
    const done = (value) => {
      element.removeAttribute("src");
      resolve(value);
    };
    element.preload = "metadata";
    element.addEventListener("loadedmetadata", () => done(Number.isFinite(element.duration) ? element.duration : true), { once: true });
    element.addEventListener("error", () => done(false), { once: true });
    element.src = url;
  });
}

async function decode(bytes, sampleRate) {
  const rate = Math.min(384000, Math.max(8000, sampleRate || 48000));
  const context = new OfflineAudioContext(1, 1, rate);
  return context.decodeAudioData(bytes);
}

// bytes: the file (ArrayBuffer). Resolves to the scene's root group.
async function buildAudioModel(bytes, { name = "Audio", fileName = "", extension = "", onProgress } = {}) {
  const ext = String(extension || fileName.split(".").pop() || "").toLowerCase();
  const size = bytes.byteLength;
  const metadata = readAudioMetadata(new Uint8Array(bytes), ext);
  const url = URL.createObjectURL(new Blob([bytes], { type: AUDIO_MIME_TYPES[ext] || "audio/*" }));

  let analysis = null;
  let decoded = null;
  if (size <= MAX_DECODE_BYTES) {
    try {
      // Detaches `bytes` (the blob above has its own copy).
      decoded = await decode(bytes, metadata.sampleRate);
    } catch (error) {
      console.warn("The browser could not decode the audio file", error);
    }
  }
  if (decoded) {
    const channels = [];
    for (let c = 0; c < decoded.numberOfChannels; c++) channels.push(decoded.getChannelData(c));
    metadata.sampleRate ??= decoded.sampleRate;
    metadata.channels ??= decoded.numberOfChannels;
    metadata.duration = decoded.duration;
    try {
      analysis = await runAnalysis(channels, decoded.sampleRate, (progress) => onProgress?.({ loaded: progress, total: 1 }));
    } catch (error) {
      console.warn("Could not analyse the audio file", error);
    }
  } else {
    const playable = await canPlay(url);
    if (!playable) {
      URL.revokeObjectURL(url);
      throw new Error(`This browser cannot play ${fileName || "the audio file"}.`);
    }
    if (typeof playable === "number") metadata.duration ??= playable;
  }
  if (metadata.duration && !metadata.bitrate) metadata.bitrate = Math.round((size * 8) / metadata.duration);

  const root = new Group();
  root.name = name;
  root.userData.isAudio = true;
  root.userData.audio = { ...DEFAULT_AUDIO_SETTINGS };
  // Seen from higher up than a building (viewer-utils.js): the landscape
  // and the waveform in front of it both in view.
  root.userData.viewDirection = [0.3, -0.75, -1];
  // What the file is (JSON, for the panel and the metadata).
  root.userData.audioInfo = {
    fileName,
    size,
    format: metadata.format,
    codec: metadata.codec || null,
    duration: metadata.duration ?? null,
    sampleRate: metadata.sampleRate ?? null,
    channels: metadata.channels ?? null,
    bitsPerSample: metadata.bitsPerSample ?? null,
    bitrate: metadata.bitrate ?? null,
    tags: metadata.tags,
    markers: metadata.markers,
    stats: analysis?.stats ?? null,
    analysed: Boolean(analysis),
  };

  const state = {
    root,
    url,
    analysis,
    player: new AudioPlayer(url, { channels: metadata.channels || 1, duration: metadata.duration }),
    meshes: buildScene(root, analysis, metadata),
    playedColumn: -1,
  };
  states.set(root, state);
  applyAudioSettings(root);
  return root;
}

// ---- The scene ----

function labelSprite(text) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const fontSize = 44;
  context.font = canvasFont(600, fontSize);
  const width = Math.ceil(context.measureText(text).width) + 24;
  canvas.width = width;
  canvas.height = fontSize + 20;
  context.font = canvasFont(600, fontSize);
  context.textBaseline = "middle";
  context.lineJoin = "round";
  context.lineWidth = 8;
  context.strokeStyle = "rgba(10, 8, 6, 0.85)";
  context.fillStyle = "#f4efe6";
  context.strokeText(text, 12, canvas.height / 2);
  context.fillText(text, 12, canvas.height / 2);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const sprite = new Sprite(new SpriteMaterial({ map: texture, depthWrite: false, transparent: true }));
  const height = 0.32;
  sprite.scale.set((height * canvas.width) / canvas.height, height, 1);
  sprite.userData.isAudioLabel = true;
  return sprite;
}

function terrainGeometry(columns, rows) {
  const geometry = new BufferGeometry();
  const positions = new Float32Array(columns * rows * 3);
  const colors = new Float32Array(columns * rows * 3);
  const indices = [];
  for (let c = 0; c < columns - 1; c++) {
    for (let r = 0; r < rows - 1; r++) {
      const a = c * rows + r;
      const b = (c + 1) * rows + r;
      // Counter-clockwise seen from above (+Y).
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  geometry.setIndex(indices);
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}

// Waveform: a strip on the ground from each column's lowest to its highest
// sample (positive away from the camera, as on a screen seen from above).
function waveformGeometry(peaks) {
  const columns = Math.min(WAVE_COLUMNS, peaks.buckets);
  const positions = new Float32Array(columns * 2 * 3);
  const colors = new Float32Array(columns * 2 * 3);
  for (let c = 0; c < columns; c++) {
    const from = Math.floor((c * peaks.buckets) / columns);
    const to = Math.max(from + 1, Math.floor(((c + 1) * peaks.buckets) / columns));
    let low = 0;
    let high = 0;
    peaks.min.forEach((min, ch) => {
      for (let b = from; b < to; b++) {
        if (min[b] < low) low = min[b];
        if (peaks.max[ch][b] > high) high = peaks.max[ch][b];
      }
    });
    // At least a hairline where it is silent.
    if (high - low < 0.01) { high += 0.005; low -= 0.005; }
    const x = (c / Math.max(1, columns - 1) - 0.5) * SCENE_WIDTH;
    positions.set([x, 0, -high * WAVE_HALF, x, 0, -low * WAVE_HALF], c * 6);
  }
  const indices = [];
  for (let c = 0; c < columns - 1; c++) {
    const top = c * 2;
    const bottom = top + 1;
    const nextTop = top + 2;
    const nextBottom = top + 3;
    // Counter-clockwise seen from above (+Y).
    indices.push(top, bottom, nextTop, nextTop, bottom, nextBottom);
  }
  const geometry = new BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return { geometry, columns };
}

function buildScene(root, analysis, metadata) {
  const meshes = { terrain: null, waveform: null, waveColumns: 0, playhead: null, timeLabels: [], frequencyLabels: [], base: null };
  if (analysis) {
    const terrain = new Mesh(
      terrainGeometry(TERRAIN_COLUMNS, TERRAIN_ROWS),
      new MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0, side: DoubleSide, name: "Spectrogram" }),
    );
    // Both sides, the landscape is also seen from below (loaders.js keeps it).
    terrain.material.userData.keepSide = true;
    terrain.name = "Spectrogram";
    terrain.userData.isAudioTerrain = true;
    root.add(terrain);
    meshes.terrain = terrain;

    const { geometry, columns } = waveformGeometry(analysis.peaks);
    const waveform = new Mesh(
      geometry,
      new MeshBasicMaterial({ vertexColors: true, side: DoubleSide, name: "Waveform" }),
    );
    waveform.name = "Waveform";
    waveform.material.userData.keepSide = true;
    // Just above the ground (ground.js), not in it.
    waveform.position.set(0, 0.02, WAVE_CENTRE);
    root.add(waveform);
    meshes.waveform = waveform;
    meshes.waveColumns = columns;
  } else {
    // Played only: a plain track to follow the playhead along.
    const base = new Mesh(
      new BoxGeometry(SCENE_WIDTH, 0.08, SCENE_DEPTH),
      new MeshStandardMaterial({ color: 0x3a2f52, roughness: 0.8, name: "Track" }),
    );
    base.name = "Track";
    base.position.y = 0.04;
    root.add(base);
    meshes.base = base;
  }

  const playhead = new Mesh(
    new BoxGeometry(0.035, TERRAIN_HEIGHT + 0.5, FRONT + SCENE_DEPTH / 2 + 0.1),
    new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false, name: "Playhead" }),
  );
  playhead.name = "Playhead";
  playhead.position.set(-SCENE_WIDTH / 2, (TERRAIN_HEIGHT + 0.5) / 2, (FRONT - SCENE_DEPTH / 2) / 2);
  playhead.castShadow = false;
  playhead.userData.isAudioPlayhead = true;
  root.add(playhead);
  meshes.playhead = playhead;

  const duration = metadata.duration || 0;
  if (duration > 0) {
    [0, 0.25, 0.5, 0.75, 1].forEach((fraction) => {
      const label = labelSprite(formatTime(duration * fraction));
      label.position.set((fraction - 0.5) * SCENE_WIDTH, 0.12, FRONT + 0.3);
      root.add(label);
      meshes.timeLabels.push(label);
    });
  }
  return meshes;
}

function updateFrequencyLabels(state) {
  const { root, meshes, analysis } = state;
  meshes.frequencyLabels.forEach((label) => {
    label.removeFromParent();
    label.material.map?.dispose();
    label.material.dispose();
  });
  meshes.frequencyLabels = [];
  if (!analysis || !meshes.terrain?.visible) return;
  const settings = root.userData.audio;
  const nyquist = analysis.spectrogram.sampleRate / 2;
  frequencyTicks(nyquist, settings.frequencyScale).forEach((hz) => {
    const label = labelSprite(formatFrequency(hz));
    const fraction = frequencyFraction(hz, nyquist, settings.frequencyScale);
    label.position.set(-SCENE_WIDTH / 2 - 0.75, 0.12, fraction * SCENE_DEPTH - SCENE_DEPTH / 2);
    root.add(label);
    meshes.frequencyLabels.push(label);
  });
}

function updateTerrain(state) {
  const { root, meshes, analysis } = state;
  const terrain = meshes.terrain;
  if (!terrain || !analysis) return;
  const settings = root.userData.audio;
  const grid = spectrogramGrid(analysis.spectrogram, TERRAIN_COLUMNS, TERRAIN_ROWS, settings.frequencyScale);
  const top = Math.max(analysis.spectrogram.maxDb, toDb(0) + settings.range);
  const bottom = top - settings.range;
  const positions = terrain.geometry.attributes.position.array;
  const colors = terrain.geometry.attributes.color.array;
  const color = new Color();
  for (let c = 0; c < TERRAIN_COLUMNS; c++) {
    const x = (c / (TERRAIN_COLUMNS - 1) - 0.5) * SCENE_WIDTH;
    for (let r = 0; r < TERRAIN_ROWS; r++) {
      const i = c * TERRAIN_ROWS + r;
      const level = Math.min(1, Math.max(0, (grid[i] - bottom) / settings.range));
      positions[i * 3] = x;
      positions[i * 3 + 1] = level * TERRAIN_HEIGHT * settings.heightScale;
      positions[i * 3 + 2] = (r / (TERRAIN_ROWS - 1)) * SCENE_DEPTH - SCENE_DEPTH / 2;
      const [red, green, blue] = infernoColor(level);
      color.setRGB(red / 255, green / 255, blue / 255, SRGBColorSpace);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
  }
  terrain.geometry.attributes.position.needsUpdate = true;
  terrain.geometry.attributes.color.needsUpdate = true;
  terrain.geometry.computeVertexNormals();
  terrain.geometry.computeBoundingBox();
  terrain.geometry.computeBoundingSphere();
}

const PLAYED = new Color().setRGB(0.98, 0.62, 0.2, SRGBColorSpace);
const UNPLAYED = new Color().setRGB(0.29, 0.27, 0.42, SRGBColorSpace);

function colorWaveform(state, playedColumn) {
  const waveform = state.meshes.waveform;
  if (!waveform || playedColumn === state.playedColumn) return;
  state.playedColumn = playedColumn;
  const colors = waveform.geometry.attributes.color.array;
  for (let c = 0; c < state.meshes.waveColumns; c++) {
    const shade = c <= playedColumn ? PLAYED : UNPLAYED;
    colors.set([shade.r, shade.g, shade.b, shade.r, shade.g, shade.b], c * 6);
  }
  waveform.geometry.attributes.color.needsUpdate = true;
}

// The settings (root.userData.audio) into the scene.
function applyAudioSettings(root) {
  const state = states.get(root);
  if (!state) return;
  const settings = root.userData.audio;
  const { meshes } = state;
  if (meshes.terrain) {
    meshes.terrain.visible = settings.showTerrain !== false;
    if (meshes.terrain.visible) updateTerrain(state);
  }
  if (meshes.waveform) meshes.waveform.visible = settings.showWaveform !== false;
  updateFrequencyLabels(state);
  state.playedColumn = -2;
  updateAudioScene(root);
}

// Each frame (main.js animate): the playhead and the played waveform follow
// the time; a loop region is kept to.
function updateAudioScene(root) {
  const state = states.get(root);
  if (!state) return;
  state.player.tick();
  const duration = state.player.duration;
  const fraction = duration > 0 ? Math.min(1, state.player.currentTime / duration) : 0;
  state.meshes.playhead.position.x = (fraction - 0.5) * SCENE_WIDTH;
  const columns = state.meshes.waveColumns;
  colorWaveform(state, columns && fraction > 0 ? Math.floor(fraction * (columns - 1)) : -1);
}

// ---- Dragging the playhead (editor/audio-panel.js) ----

// The pane is caught this far (scene units) to either side of it: it is
// a hairline itself.
const PLAYHEAD_GRAB = 0.2;

// A world ray in the root's own space, where the landscape is laid out.
function localRay(root, ray) {
  root.updateMatrixWorld(true);
  return ray.clone().applyMatrix4(new Matrix4().copy(root.matrixWorld).invert());
}

// Where a world ray (the pointer's) meets the playhead's pane, in the
// root's space; null when it misses.
function hitAudioPlayhead(root, ray) {
  const playhead = states.get(root)?.meshes.playhead;
  if (!playhead?.visible) return null;
  const local = localRay(root, ray);
  const x = playhead.position.x;
  const box = new Box3(
    new Vector3(x - PLAYHEAD_GRAB, 0, -SCENE_DEPTH / 2 - 0.1),
    new Vector3(x + PLAYHEAD_GRAB, TERRAIN_HEIGHT + 0.5, FRONT + 0.1),
  );
  if (!local.intersectsBox(box)) return null;
  // On the pane itself, so that the drag starts where the playhead is;
  // the box's side when the ray runs along the pane.
  const pane = new Plane(new Vector3(1, 0, 0), -x);
  return local.intersectPlane(pane, new Vector3()) || local.intersectBox(box, new Vector3());
}

// The time under a world ray: the point nearest to the ray on the line
// along the time axis through `grab` (where the pane was caught, from
// hitAudioPlayhead; its middle without), in seconds - the caught point
// stays under the pointer. Null while looking along that line.
function audioTimeAtRay(root, ray, grab = null) {
  const state = states.get(root);
  const playhead = state?.meshes.playhead;
  const duration = state?.player.duration;
  if (!playhead || !(duration > 0)) return null;
  const local = localRay(root, ray);
  const through = grab || playhead.position;
  const w0 = new Vector3(0, through.y, through.z).sub(local.origin);
  const b = local.direction.x;
  const denom = 1 - b * b;
  if (denom < 1e-3) return null;
  const x = (b * local.direction.dot(w0) - w0.x) / denom;
  return Math.min(1, Math.max(0, x / SCENE_WIDTH + 0.5)) * duration;
}

function disposeAudio(root) {
  const state = states.get(root);
  if (!state) return;
  states.delete(root);
  state.player.dispose();
  URL.revokeObjectURL(state.url);
  root.traverse((child) => {
    if (child.isSprite) child.material.map?.dispose();
  });
}

// ---- Playing ----

// A reverberation: stereo noise dying away over `seconds` (as a room of
// that reverberation time would), a little later on the right.
function impulseResponse(context, seconds) {
  const rate = context.sampleRate;
  const length = Math.max(1, Math.floor(rate * seconds));
  const buffer = context.createBuffer(2, length, rate);
  let seed = 1;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647 * 2 - 1;
  };
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    const delay = Math.floor(rate * (0.012 + c * 0.006));
    for (let i = delay; i < length; i++) {
      // -60 dB at `seconds`.
      data[i] = random() * Math.pow(10, (-3 * (i - delay)) / (length - delay));
    }
  }
  return buffer;
}

// Plays the file through Web Audio: the channels (both, mixed to one, only
// the left or the right), a filter, an even loudness (compressor), a
// reverberation, the volume - and an analyser at the end for the live views.
// The audio context starts with the first play (browsers allow sound only
// after a click).
class AudioPlayer {
  constructor(url, { channels = 2, duration = null } = {}) {
    this.channels = channels;
    this.knownDuration = duration;
    this.element = new Audio();
    this.element.preload = "auto";
    this.element.src = url;
    this.context = null;
    this.nodes = null;
    this.reverbBuffers = {};
    this.settings = {
      volume: 1,
      rate: 1,
      preservePitch: true,
      loop: false,
      region: null,
      channelMode: "stereo",
      filter: { type: "off", frequency: 1000, q: 1 },
      compressor: false,
      reverb: "off",
      reverbMix: 0.35,
    };
    this.listeners = new Set();
    ["play", "pause", "ended", "loadedmetadata", "seeked", "ratechange", "volumechange"].forEach((type) => {
      this.element.addEventListener(type, () => this.emit(type));
    });
  }

  on(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(type) {
    this.listeners.forEach((listener) => listener(type));
  }

  get duration() {
    const own = this.element.duration;
    return Number.isFinite(own) && own > 0 ? own : this.knownDuration || 0;
  }

  get currentTime() {
    return this.element.currentTime || 0;
  }

  set currentTime(seconds) {
    const time = Math.min(Math.max(0, seconds), this.duration || seconds);
    this.element.currentTime = time;
    this.emit("seeked");
  }

  get playing() {
    return !this.element.paused && !this.element.ended;
  }

  get analyser() {
    return this.nodes?.analyser || null;
  }

  ensureGraph() {
    if (this.context) return;
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    const context = new Context();
    this.context = context;
    const source = context.createMediaElementSource(this.element);
    const mono = context.createGain();
    mono.channelCount = 1;
    mono.channelCountMode = "explicit";
    mono.channelInterpretation = "speakers";
    const analyser = context.createAnalyser();
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 0.72;
    this.nodes = {
      source,
      splitter: context.createChannelSplitter(2),
      mono,
      filter: context.createBiquadFilter(),
      compressor: context.createDynamicsCompressor(),
      dry: context.createGain(),
      convolver: context.createConvolver(),
      wet: context.createGain(),
      master: context.createGain(),
      analyser,
    };
    this.nodes.compressor.threshold.value = -28;
    this.nodes.compressor.ratio.value = 6;
    this.rewire();
  }

  // What the connections depend on: only a change of these reconnects
  // the nodes (a click otherwise), the rest are the nodes' values.
  routeKey() {
    const { settings } = this;
    return [this.channels > 1 ? settings.channelMode : "stereo", settings.filter.type, settings.compressor, settings.reverb].join("|");
  }

  applyParams() {
    const nodes = this.nodes;
    if (!nodes) return;
    const { settings } = this;
    if (settings.filter.type !== "off") {
      nodes.filter.type = settings.filter.type;
      nodes.filter.frequency.value = settings.filter.frequency;
      nodes.filter.Q.value = settings.filter.q;
    }
    const reverb = Boolean(REVERB_SECONDS[settings.reverb]);
    nodes.dry.gain.value = reverb ? 1 - settings.reverbMix * 0.5 : 1;
    nodes.wet.gain.value = reverb ? settings.reverbMix : 0;
  }

  // Connects the nodes for the settings.
  rewire() {
    const nodes = this.nodes;
    if (!nodes) return;
    const { settings } = this;
    this.wiredKey = this.routeKey();
    Object.values(nodes).forEach((node) => node.disconnect());
    let tail;
    const mode = this.channels > 1 ? settings.channelMode : "stereo";
    if (mode === "left" || mode === "right") {
      nodes.source.connect(nodes.splitter);
      nodes.splitter.connect(nodes.mono, mode === "left" ? 0 : 1);
      tail = nodes.mono;
    } else if (mode === "mono") {
      nodes.source.connect(nodes.mono);
      tail = nodes.mono;
    } else {
      tail = nodes.source;
    }
    if (settings.filter.type !== "off") {
      tail.connect(nodes.filter);
      tail = nodes.filter;
    }
    if (settings.compressor) {
      tail.connect(nodes.compressor);
      tail = nodes.compressor;
    }
    tail.connect(nodes.dry);
    nodes.dry.connect(nodes.master);
    const reverb = REVERB_SECONDS[settings.reverb];
    if (reverb) {
      this.reverbBuffers[settings.reverb] ??= impulseResponse(this.context, reverb);
      if (nodes.convolver.buffer !== this.reverbBuffers[settings.reverb]) {
        // A convolver takes a new buffer only as a new node.
        nodes.convolver = this.context.createConvolver();
        nodes.convolver.buffer = this.reverbBuffers[settings.reverb];
      }
      tail.connect(nodes.convolver);
      nodes.convolver.connect(nodes.wet);
      nodes.wet.connect(nodes.master);
    }
    this.applyParams();
    nodes.master.connect(nodes.analyser);
    nodes.analyser.connect(this.context.destination);
  }

  // Changes the settings: change(settings).
  update(change) {
    change(this.settings);
    const { settings, element } = this;
    element.volume = Math.min(1, Math.max(0, settings.volume));
    element.playbackRate = settings.rate;
    element.preservesPitch = settings.preservePitch;
    element.loop = settings.loop && !settings.region;
    if (this.nodes && this.routeKey() !== this.wiredKey) this.rewire();
    else this.applyParams();
    this.emit("settings");
  }

  async play() {
    this.ensureGraph();
    await this.context?.resume?.();
    const region = this.settings.region;
    if (region && (this.currentTime < region.start || this.currentTime >= region.end - 0.02)) this.currentTime = region.start;
    else if (this.element.ended || this.currentTime >= this.duration - 0.02) this.currentTime = 0;
    await this.element.play();
  }

  pause() {
    this.element.pause();
  }

  async toggle() {
    if (this.playing) this.pause();
    else await this.play();
  }

  stop() {
    this.element.pause();
    this.currentTime = this.settings.region?.start || 0;
  }

  // Each frame: the end of a region played - again from its start (loop), or
  // stopped there.
  tick() {
    const region = this.settings.region;
    if (!region || !this.playing) return;
    if (this.currentTime >= region.end) {
      if (this.settings.loop) this.currentTime = region.start;
      else {
        this.element.pause();
        this.currentTime = region.end;
      }
    }
  }

  dispose() {
    this.listeners.clear();
    this.element.pause();
    this.element.removeAttribute("src");
    this.element.load();
    this.context?.close?.().catch(() => {});
    this.context = null;
    this.nodes = null;
  }
}

export { AudioPlayer, CHANNEL_MODES, DEFAULT_AUDIO_SETTINGS, FILTER_TYPES, FREQUENCY_SCALES, MAX_DECODE_BYTES, PLAYBACK_RATES, REVERB_PRESETS, SCENE_DEPTH, SCENE_WIDTH, TERRAIN_HEIGHT, applyAudioSettings, audioTimeAtRay, buildAudioModel, disposeAudio, formatFrequency, formatTime, frequencyAt, frequencyFraction, frequencyTicks, getAudioState, hitAudioPlayhead, infernoColor, spectrogramGrid, updateAudioScene };
//# sourceMappingURL=audio-Co9icq74.js.map
