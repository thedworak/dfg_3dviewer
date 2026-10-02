import THREE from "./init.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";
import { FXAAPass } from "three/examples/jsm/postprocessing/FXAAPass.js";
import { core, setCore } from "./core.js";
import { ModelGTAOPass } from "./rendering-ao.js";

// Tone mapping and the optional post-processing chain of the main canvas.
//
// Settings shape (viewer-settings.json viewer.rendering, AIM3D manifest
// AIM3DViewer.viewer.rendering):
//   { toneMapping: "neutral", exposure: 1,
//     postprocessing: { enabled: false, antialias: "msaa", ao: false, aoIntensity: 1 } }
//
// Ambient occlusion (ao) needs the chain: switching it on runs the chain even
// with post-processing itself off (rendering-ao.js).
//
// Without post-processing the renderer tone maps while drawing to the canvas.
// With it the scene is drawn into a linear half-float target and OutputPass
// applies the same renderer.toneMapping / exposure and the sRGB conversion,
// so switching the chain on or off does not change the image's tonality.

export const TONE_MAPPING_MODES = {
  none: THREE.NoToneMapping,
  linear: THREE.LinearToneMapping,
  reinhard: THREE.ReinhardToneMapping,
  cineon: THREE.CineonToneMapping,
  aces: THREE.ACESFilmicToneMapping,
  agx: THREE.AgXToneMapping,
  neutral: THREE.NeutralToneMapping,
};

// msaa: multisampled render target, smaa/fxaa: screen-space passes.
export const ANTIALIAS_MODES = ["msaa", "smaa", "fxaa", "none"];

export const RENDERING_DEFAULTS = Object.freeze({
  toneMapping: "neutral",
  exposure: 1,
  postprocessing: Object.freeze({
    enabled: false,
    antialias: "msaa",
    ao: false,
    aoIntensity: 1,
  }),
});

const MSAA_SAMPLES = 4;
// Strength of the ambient occlusion, 0 (none) to AO_INTENSITY_MAX.
export const AO_INTENSITY_MAX = 2;

let composer = null;
let renderPass = null;
let aoPass = null;
// Antialias mode and ambient occlusion the current composer was built for.
let composerAntialias = null;
let composerAo = null;
const canvasSize = new THREE.Vector2();

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function cloneSettings(settings) {
  return {
    toneMapping: settings.toneMapping,
    exposure: settings.exposure,
    postprocessing: { ...settings.postprocessing },
  };
}

// `input` merged over `base`; unknown or malformed values keep the base value.
export function normalizeRenderingSettings(input, base = RENDERING_DEFAULTS) {
  const result = cloneSettings(base);
  if (!isPlainObject(input)) return result;

  const toneMapping = typeof input.toneMapping === "string" ? input.toneMapping.trim().toLowerCase() : "";
  if (toneMapping in TONE_MAPPING_MODES) result.toneMapping = toneMapping;

  const exposure = Number(input.exposure);
  if (input.exposure !== undefined && input.exposure !== null && Number.isFinite(exposure) && exposure >= 0) {
    result.exposure = exposure;
  }

  if (isPlainObject(input.postprocessing)) {
    const { enabled, antialias, ao, aoIntensity } = input.postprocessing;
    if (typeof enabled === "boolean") result.postprocessing.enabled = enabled;
    if (ANTIALIAS_MODES.includes(antialias)) result.postprocessing.antialias = antialias;
    if (typeof ao === "boolean") result.postprocessing.ao = ao;
    const intensity = Number(aoIntensity);
    if (aoIntensity !== undefined && aoIntensity !== null && Number.isFinite(intensity)) {
      result.postprocessing.aoIntensity = Math.min(AO_INTENSITY_MAX, Math.max(0, intensity));
    }
  }
  return result;
}

export function getRenderingSettings() {
  return cloneSettings(core.rendering || RENDERING_DEFAULTS);
}

export function isPostProcessingActive() {
  return composer !== null;
}

export function isAmbientOcclusionActive() {
  return aoPass !== null;
}

function disposeComposer() {
  if (!composer) return;
  composer.passes.forEach((pass) => pass.dispose?.());
  composer.dispose();
  composer = null;
  renderPass = null;
  aoPass = null;
  composerAntialias = null;
  composerAo = null;
}

function buildComposer(renderer, antialias, ao) {
  const renderTarget = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    samples: antialias === "msaa" ? MSAA_SAMPLES : 0,
  });

  composer = new EffectComposer(renderer, renderTarget);
  renderPass = new RenderPass(core.scene, core.camera);
  composer.addPass(renderPass);
  if (ao) {
    aoPass = new ModelGTAOPass(core.scene, core.camera);
    composer.addPass(aoPass);
  }
  // SMAA works on linear colors (before OutputPass), FXAA on the final
  // sRGB image (after it).
  if (antialias === "smaa") composer.addPass(new SMAAPass());
  composer.addPass(new OutputPass());
  if (antialias === "fxaa") composer.addPass(new FXAAPass());
  composerAntialias = antialias;
  composerAo = ao;
  syncComposerSize(renderer);
}

// Keeps the composer's buffers and passes at the canvas size.
function syncComposerSize(renderer) {
  renderer.getSize(canvasSize);
  const pixelRatio = renderer.getPixelRatio();
  if (composer._width === canvasSize.x && composer._height === canvasSize.y && composer._pixelRatio === pixelRatio) return;
  composer.setPixelRatio(pixelRatio);
  composer.setSize(canvasSize.x, canvasSize.y);
}

// Merges `patch` into the current settings and applies them to the renderer.
export function applyRenderingSettings(patch = {}) {
  const settings = normalizeRenderingSettings(patch, core.rendering || RENDERING_DEFAULTS);
  setCore("rendering", settings);

  const renderer = core.renderer;
  if (!renderer) return settings;

  // Materials pick the new mode up by themselves: the renderer recompiles a
  // program whose tone mapping no longer matches.
  renderer.toneMapping = TONE_MAPPING_MODES[settings.toneMapping];
  renderer.toneMappingExposure = settings.exposure;

  const { enabled, antialias, ao, aoIntensity } = settings.postprocessing;
  if (!enabled && !ao) {
    disposeComposer();
  } else if (composerAntialias !== antialias || composerAo !== ao) {
    disposeComposer();
    buildComposer(renderer, antialias, ao);
  }
  if (aoPass) aoPass.blendIntensity = aoIntensity;
  return settings;
}

// Called once the main renderer exists. `configSettings` is the deployment's
// viewer-settings.json viewer.rendering, a fallback for the defaults.
export function initRendering(renderer, configSettings) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  setCore("rendering", normalizeRenderingSettings(configSettings));
  return applyRenderingSettings();
}

// Tone mapping previews (Rendering > Tone mapping menu): the current view
// drawn once into a small linear half-float target, then tone mapped into an
// 8-bit target by one OutputPass per mode and read back into each canvas.
// Nothing is drawn to the main canvas.
const PREVIEW_CSS_WIDTH = 64;
let previewSource = null;
let previewOutput = null;
// Mode -> OutputPass: one each, so switching modes does not recompile.
const previewPasses = new Map();

// `canvases` maps a TONE_MAPPING_MODES key to the canvas to draw it into.
// Returns false when there is nothing to draw yet.
export function renderToneMappingPreviews(canvases) {
  const renderer = core.renderer;
  if (!renderer || !core.scene || !core.camera) return false;
  renderer.getSize(canvasSize);
  if (!canvasSize.x || !canvasSize.y) return false;

  // The canvas's aspect, so the camera's projection fits as it is.
  const width = Math.round(PREVIEW_CSS_WIDTH * Math.min(window.devicePixelRatio || 1, 2));
  const height = Math.max(1, Math.round((width * canvasSize.y) / canvasSize.x));
  if (!previewSource) {
    previewSource = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType, samples: MSAA_SAMPLES });
    previewOutput = new THREE.WebGLRenderTarget(width, height);
  }
  previewSource.setSize(width, height);
  previewOutput.setSize(width, height);

  const previousTarget = renderer.getRenderTarget();
  const previousToneMapping = renderer.toneMapping;
  const pixels = new Uint8Array(width * height * 4);
  try {
    // Into a render target the renderer neither tone maps nor encodes sRGB.
    renderer.setRenderTarget(previewSource);
    renderer.render(core.scene, core.camera);

    Object.entries(canvases).forEach(([mode, canvas]) => {
      if (!(mode in TONE_MAPPING_MODES) || !canvas) return;
      let pass = previewPasses.get(mode);
      if (!pass) {
        pass = new OutputPass();
        previewPasses.set(mode, pass);
      }
      // OutputPass takes its tone mapping and exposure from the renderer.
      renderer.toneMapping = TONE_MAPPING_MODES[mode];
      pass.render(renderer, previewOutput, previewSource);
      renderer.readRenderTargetPixels(previewOutput, 0, 0, width, height, pixels);

      // WebGL rows run bottom-up.
      const image = new ImageData(width, height);
      const rowLength = width * 4;
      for (let row = 0; row < height; row++) {
        const from = (height - 1 - row) * rowLength;
        image.data.set(pixels.subarray(from, from + rowLength), row * rowLength);
      }
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").putImageData(image, 0, 0);
    });
  } finally {
    renderer.toneMapping = previousToneMapping;
    renderer.setRenderTarget(previousTarget);
  }
  return true;
}

// Draws one frame of the main scene to the canvas.
export function renderFrame(renderer = core.renderer) {
  if (!renderer || !core.scene || !core.camera) return;
  if (!composer) {
    renderer.render(core.scene, core.camera);
    return;
  }
  // setCameraProjection() swaps core.camera and loaders may replace the
  // scene, so rebind every frame.
  renderPass.scene = core.scene;
  renderPass.camera = core.camera;
  aoPass?.sync(core.scene, core.camera);
  // Follow the canvas size (layout changes, thumbnail capture) without
  // every resize path having to know about the composer.
  syncComposerSize(renderer);
  composer.render();
}
