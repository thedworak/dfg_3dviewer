import { AIM3DManifest } from "./manifesto";
import { isModelBody, modelTransformConfig, modelUrlOf } from "../IIIF/presentation4.js";
import {
  formatAIM3DManifestValidationErrors,
  normalizeAIM3DManifest,
  validateAIM3DManifest,
} from "./aim3dviewer-validation.js";

// The models of one Scene of the manifest (`sceneIndex`, else the first).
export async function loadAIM3IFManifest(manifestUrlOrJson, { sceneIndex = 0 } = {}) {
  const aim3dManifest = new AIM3DManifest(manifestUrlOrJson);

  await aim3dManifest.loadManifest();

  normalizeAIM3DManifest(aim3dManifest.manifest);

  const validation = validateAIM3DManifest(aim3dManifest.manifest);
  if (!validation.valid) {
    const detail = formatAIM3DManifestValidationErrors(validation.errors);
    throw new Error(`Invalid AIM3D manifest.\n${detail}`);
  }

  const modelUrls = [];
  let modelTarget = null;
  const filteredAnnos = [];

  for (const scene of aim3dManifest.scenes) {
    // Leave background unset (rather than defaulting to black) when the
    // manifest doesn't specify one, so the viewer's own default background
    // applies - matching how the IIIF loader handles a missing color.
    scene.background = scene.backgroundColor || null;
  }

  const shownScene = aim3dManifest.scenes[sceneIndex] || aim3dManifest.scenes[0];
  if (shownScene) {
    const annos = aim3dManifest.annotationsFromScene(shownScene);
    // A Model body, or (Presentation 4 export with transforms) a
    // SpecificResource around one - never the scene's cameras or lights.
    for (const anno of annos) {
      if (!anno.motivation?.includes("painting") || !isModelBody(anno.body)) continue;
      const modelUrl = modelUrlOf(anno.body);
      // annotations and modelUrls stay index-aligned.
      if (!modelUrl) continue;
      filteredAnnos.push(anno);
      modelUrls.push(modelUrl);
      modelTarget = anno.target;
    }
  }

  aim3dManifest.modelUrls = modelUrls;
  aim3dManifest.modelTarget = modelTarget;

  return {
    manifest: aim3dManifest.manifest,
    scenes: aim3dManifest.scenes,
    annotations: filteredAnnos,
    modelUrls,
    modelTarget
  };
}


// Position, rotation and scale of the model being loaded (objectsConfig.index)
// from its painting annotation: the body's transform list, then the target's
// PointSelector. AIM3DViewer.modelTransform, the first model's exact viewer
// transform and rendering flags, is applied after loading
// (Viewer.apply3IFManifestModelTransform).
export function applyManifestConfig(loadedManifest, objectsConfig) {
  const index = objectsConfig.index || 0;
  const model = objectsConfig.models?.[index];
  const annotation = loadedManifest?.annotations?.[index];
  if (!model || !annotation) return;

  const body = Array.isArray(annotation.body) ? annotation.body[0] : annotation.body;
  if (body?.type === "SpecificResource" && Array.isArray(body.transform)) {
    Object.assign(model, modelTransformConfig(body.transform));
  }

  const target = Array.isArray(annotation.target) ? annotation.target[0] : annotation.target;
  const point = (Array.isArray(target?.selector) ? target.selector : [target?.selector])
    .find((selector) => selector?.type === "PointSelector");
  if (point) {
    model.position = {
      x: (model.position?.x || 0) + (Number(point.x) || 0),
      y: (model.position?.y || 0) + (Number(point.y) || 0),
      z: (model.position?.z || 0) + (Number(point.z) || 0),
    };
  }
}

export function getManifestWindowState(manifest) {
  const windowState = manifest?.AIM3DViewer?.viewer?.window;
  if (!windowState) return null;

  const position = Array.isArray(windowState.position)
    ? { x: windowState.position[0], y: windowState.position[1] }
    : windowState.position;

  return {
    position,
    size: windowState.size,
  };
}

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

// Position/size are stored as {x, y} / {width, height} in viewer-settings.json.
function toXY(value) {
  if (Array.isArray(value)) return { x: value[0], y: value[1] };
  return isPlainObject(value) ? { x: value.x, y: value.y } : undefined;
}

function toPanelState(panel) {
  if (!isPlainObject(panel)) return undefined;
  const state = {};
  const position = toXY(panel.position);
  if (position) state.position = position;
  if (isPlainObject(panel.size)) state.size = { ...panel.size };
  return state;
}

// Merges the deployment settings carried by an AIM3D manifest into `config`
// (the object loaded from viewer-settings.json). viewer-settings.json stays the
// fallback: only values the manifest actually defines are overwritten, so
// manifests written before these fields existed leave the config untouched.
//
// Bootstrap keys that are needed *before* a manifest can be fetched (the
// manifest URL/source in entity.metadata, viewer.lightweight, viewer.editor)
// intentionally remain viewer-settings.json only.
//
// Settings with runtime side effects (theme, toolbars, performance mode, ...)
// are applied separately by Viewer.import3IFManifest().
export function applyManifestSettings(manifest, config) {
  const block = manifest?.AIM3DViewer;
  if (!isPlainObject(block) || !isPlainObject(config)) return false;

  const viewer = isPlainObject(block.viewer) ? block.viewer : {};
  const integration = isPlainObject(block.integration) ? block.integration : {};
  let applied = false;
  const set = (target, key, value) => {
    if (value === undefined) return;
    target[key] = value;
    applied = true;
  };

  config.viewer ??= {};
  config.entity ??= {};

  set(config, "mainUrl", nonEmptyString(viewer.mainUrl));
  set(config, "baseModulePath", nonEmptyString(viewer.baseModulePath));
  set(config.viewer, "background", nonEmptyString(viewer.background));
  if (isPlainObject(viewer.credits)) set(config.viewer, "credits", structuredClone(viewer.credits));
  if (isPlainObject(viewer.auth)) set(config.viewer, "auth", { ...viewer.auth });
  set(config.viewer, "manifestoForm", toPanelState(viewer.manifestoForm));
  set(config.viewer, "metadataContainer", toPanelState(viewer.metadataContainer));

  set(config.entity, "exportViewerUrl", nonEmptyString(integration.exportViewerUrl));
  if (isPlainObject(integration.api)) {
    config.api ??= {};
    set(config.api, "thumbnailUploadEndpoint", nonEmptyString(integration.api.thumbnailUploadEndpoint));
  }

  return applied;
}

// Settings that decide how the UI is *built* (viewer.lightweight, viewer.editor,
// viewer.sandbox, viewer.presentationMode) must be known before any UI exists,
// i.e. before the regular manifest load. Viewer.MainInit() therefore peeks at
// the configured AIM3D manifest and calls this. Only strict booleans are
// accepted; anything else leaves the viewer-settings.json value in place.
export function applyManifestBootstrapSettings(manifest, config) {
  const viewer = manifest?.AIM3DViewer?.viewer;
  if (!isPlainObject(viewer) || !isPlainObject(config)) return false;

  let applied = false;
  config.viewer ??= {};
  // manifest key -> viewer-settings.json key
  const keys = {
    lightweight: "lightweight",
    editor: "editor",
    sandbox: "sandboxMode",
    presentationMode: "presentationMode",
  };
  for (const [manifestKey, configKey] of Object.entries(keys)) {
    if (typeof viewer[manifestKey] === "boolean") {
      config.viewer[configKey] = viewer[manifestKey];
      applied = true;
    }
  }
  return applied;
}
