import { AIM3DManifest } from "./manifesto";
import {
  formatAIM3DManifestValidationErrors,
  normalizeAIM3DManifest,
  validateAIM3DManifest,
} from "./aim3dviewer-validation.js";

export async function loadAIM3IFManifest(manifestUrlOrJson) {
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
  let filteredAnnos = [];

  for (const scene of aim3dManifest.scenes) {
    // Leave background unset (rather than defaulting to black) when the
    // manifest doesn't specify one, so the viewer's own default background
    // applies - matching how the IIIF loader handles a missing color.
    scene.background = scene.backgroundColor || null;

    const annos = aim3dManifest.annotationsFromScene(scene);

    filteredAnnos = annos.filter(
      anno =>
        anno.motivation?.includes("painting") &&
        anno.body?.type === "Model"
    );

    for (const anno of filteredAnnos) {
      const modelUrl = anno.body?.id;

      if (modelUrl) {
        modelUrls.push(modelUrl);
      }

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


export function applyManifestConfig(manifest, objectsConfig) {
  const transform =
    manifest.AIM3DViewer?.modelTransform;

  if (!transform) return;

  const model = objectsConfig.models[0];

  model.position = {
    x: transform.position?.[0] ?? 0,
    y: transform.position?.[1] ?? 0,
    z: transform.position?.[2] ?? 0
  };

  model.rotation = {
    x: transform.rotation?.x ?? 0,
    y: transform.rotation?.y ?? 0,
    z: transform.rotation?.z ?? 0
  };

  model.scale = {
    x: transform.scale?.[0] ?? 1,
    y: transform.scale?.[1] ?? 1,
    z: transform.scale?.[2] ?? 1
  };

  model.wireframe =
    transform.wireframe ?? false;

  model.shadingMode =
    transform.shadingMode ?? "standard";

  model.customShader =
    transform.customShader ?? null;
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
