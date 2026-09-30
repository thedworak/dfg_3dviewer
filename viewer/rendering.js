import THREE from "./init.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";
import { FXAAPass } from "three/examples/jsm/postprocessing/FXAAPass.js";
import { core, setCore } from "./core.js";

// Tone mapping and the optional post-processing chain of the main canvas.
//
// Settings shape (viewer-settings.json viewer.rendering, AIM3D manifest
// AIM3DViewer.viewer.rendering):
//   { toneMapping: "neutral", exposure: 1,
//     postprocessing: { enabled: false, antialias: "msaa" } }
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
  }),
});

const MSAA_SAMPLES = 4;

let composer = null;
let renderPass = null;
// Antialias mode the current composer was built for.
let composerAntialias = null;
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
    const { enabled, antialias } = input.postprocessing;
    if (typeof enabled === "boolean") result.postprocessing.enabled = enabled;
    if (ANTIALIAS_MODES.includes(antialias)) result.postprocessing.antialias = antialias;
  }
  return result;
}

export function getRenderingSettings() {
  return cloneSettings(core.rendering || RENDERING_DEFAULTS);
}

export function isPostProcessingActive() {
  return composer !== null;
}

function disposeComposer() {
  if (!composer) return;
  composer.passes.forEach((pass) => pass.dispose?.());
  composer.dispose();
  composer = null;
  renderPass = null;
  composerAntialias = null;
}

function buildComposer(renderer, antialias) {
  const renderTarget = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    samples: antialias === "msaa" ? MSAA_SAMPLES : 0,
  });

  composer = new EffectComposer(renderer, renderTarget);
  renderPass = new RenderPass(core.scene, core.camera);
  composer.addPass(renderPass);
  // SMAA works on linear colors (before OutputPass), FXAA on the final
  // sRGB image (after it).
  if (antialias === "smaa") composer.addPass(new SMAAPass());
  composer.addPass(new OutputPass());
  if (antialias === "fxaa") composer.addPass(new FXAAPass());
  composerAntialias = antialias;
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

  const { enabled, antialias } = settings.postprocessing;
  if (!enabled) {
    disposeComposer();
  } else if (composerAntialias !== antialias) {
    disposeComposer();
    buildComposer(renderer, antialias);
  }
  return settings;
}

// Called once the main renderer exists. `configSettings` is the deployment's
// viewer-settings.json viewer.rendering, a fallback for the defaults.
export function initRendering(renderer, configSettings) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  setCore("rendering", normalizeRenderingSettings(configSettings));
  return applyRenderingSettings();
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
  // Follow the canvas size (layout changes, thumbnail capture) without
  // every resize path having to know about the composer.
  syncComposerSize(renderer);
  composer.render();
}
