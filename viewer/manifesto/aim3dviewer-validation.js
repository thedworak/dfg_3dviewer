import {
  certaintyAssessmentErrors,
  certaintyScaleErrors,
  normalizeCertaintyScale,
} from "./certainty-scale.js";

// Keep in sync with TONE_MAPPING_MODES / ANTIALIAS_MODES in viewer/rendering.js
// (not imported: this module also runs in Node without three.js).
export const RENDERING_TONE_MAPPINGS = ["none", "linear", "reinhard", "cineon", "aces", "agx", "neutral"];
export const RENDERING_ANTIALIAS_MODES = ["msaa", "smaa", "fxaa", "none"];
// Keep in sync with WEATHER_TYPES in viewer/editor/weather.js (same reason).
export const WEATHER_TYPES = ["clear", "fog", "rain", "snow", "storm"];
// Keep in sync with SHADING_MODES in viewer/editor/shading.js (same reason).
export const SHADING_MODES = ["original", "standard", "phong", "lambert", "toon", "flat", "clay", "matcap", "normals", "custom"];
// Keep in sync with MATERIAL_PRESETS in viewer/editor/material-presets.js.
export const MATERIAL_PRESET_KEYS = [
  "glass", "frostedGlass", "tintedGlass", "water", "lightWood", "darkWood", "varnishedWood",
  "plaster", "paintedWall", "concrete", "brick", "sandstone", "marble", "terracotta", "ceramic",
  "steel", "aluminium", "iron", "brass", "gold", "copper", "bronze", "mirror",
  "plastic", "rubber", "fabric", "clay", "light",
];
// Keep in sync with UP_AXES in viewer/up-axis.js (same reason).
export const MODEL_UP_AXES = ["Y+", "Y-", "Z+", "Z-", "X+", "X-"];
// Keep in sync with TIMELINE_TRANSITIONS / TIMELINE_STAGE_TYPES in viewer/timeline.js.
export const TIMELINE_TRANSITIONS = ["interpolate", "step"];
export const TIMELINE_STAGE_TYPES = ["documented", "modelled"];
// Keep in sync with COMPARE_MODES / COMPARE_KINDS in viewer/editor/compare.js.
export const COMPARE_MODES = ["swipe", "split"];
export const COMPARE_KINDS = ["content", "look"];
export const COMPARE_LIGHTINGS = ["current", "noEnvironment", "neutral", "sunny", "studio", "goldenHour", "raking"];

function isPlainObject(value) {
  return value != null && typeof value === "object" && Array.isArray(value) === false;
}

export function isAIM3DManifest(manifest) {
  return isPlainObject(manifest) && Object.hasOwn(manifest, "AIM3DViewer");
}

function parseFiniteNumber(value) {
  if (isFiniteNumber(value)) return value;
  if (typeof value !== "string" || value.trim() === "") return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// Older viewer exports kept values from viewer-settings.json verbatim. Normalize
// those compatible values before validating the canonical AIM3D representation.
export function normalizeAIM3DManifest(manifest) {
  const viewer = manifest?.AIM3DViewer?.viewer;
  if (!isPlainObject(viewer)) return manifest;

  if (Array.isArray(viewer.scale)) {
    viewer.scale = viewer.scale.map((value) => parseFiniteNumber(value) ?? value);
  } else if (isPlainObject(viewer.scale)) {
    ["x", "y"].forEach((axis) => {
      viewer.scale[axis] = parseFiniteNumber(viewer.scale[axis]) ?? viewer.scale[axis];
    });
  }

  if (isPlainObject(viewer.performance)) {
    const mode = viewer.performance.Performance ?? viewer.performance.performance;
    if (typeof mode === "string" && mode.trim() !== "") {
      viewer.performance = mode;
    }
  }

  return manifest;
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isString(value) {
  return typeof value === "string";
}

function pushError(errors, path, message) {
  errors.push({ path, message });
}

function validateVector(value, path, errors, expectedLength = 3) {
  if (Array.isArray(value)) {
    if (value.length < expectedLength) {
      pushError(errors, path, `must contain at least ${expectedLength} numbers`);
      return;
    }
    value.slice(0, expectedLength).forEach((item, index) => {
      if (!isFiniteNumber(item)) {
        pushError(errors, `${path}[${index}]`, "must be a finite number");
      }
    });
    return;
  }

  if (isPlainObject(value)) {
    const keys = expectedLength === 2 ? ["x", "y"] : ["x", "y", "z"];
    keys.forEach((key) => {
      if (!isFiniteNumber(value[key])) {
        pushError(errors, `${path}.${key}`, "must be a finite number");
      }
    });
    return;
  }

  pushError(errors, path, `must be a ${expectedLength}D vector array or object`);
}

function validateBoolean(value, path, errors) {
  if (typeof value !== "boolean") {
    pushError(errors, path, "must be a boolean");
  }
}

function validateNumber(value, path, errors) {
  if (!isFiniteNumber(value)) {
    pushError(errors, path, "must be a finite number");
  }
}

function validateString(value, path, errors) {
  if (!isString(value)) {
    pushError(errors, path, "must be a string");
  }
}

function validateEnum(value, allowedValues, path, errors) {
  if (!allowedValues.includes(value)) {
    pushError(errors, path, `must be one of: ${allowedValues.join(", ")}`);
  }
}

function validateLight(light, path, errors) {
  if (!isPlainObject(light)) {
    pushError(errors, path, "must be an object");
    return;
  }
  if (light.type !== undefined) validateString(light.type, `${path}.type`, errors);
  if (light.position !== undefined) validateVector(light.position, `${path}.position`, errors, 3);
  if (light.target !== undefined) validateVector(light.target, `${path}.target`, errors, 3);
  if (light.color !== undefined) validateString(light.color, `${path}.color`, errors);
  if (light.intensity !== undefined) validateNumber(light.intensity, `${path}.intensity`, errors);
  if (light.name !== undefined) validateString(light.name, `${path}.name`, errors);
  if (light.castShadow !== undefined) validateBoolean(light.castShadow, `${path}.castShadow`, errors);
}

// AIM3DViewer.rakingLight (editor/raking-light.js): direction 0-360 and
// height 1-89 degrees.
function validateRakingLight(rakingLight, path, errors) {
  if (!isPlainObject(rakingLight)) {
    pushError(errors, path, "must be an object");
    return;
  }
  if (rakingLight.enabled !== undefined) validateBoolean(rakingLight.enabled, `${path}.enabled`, errors);
  if (rakingLight.sweep !== undefined) validateBoolean(rakingLight.sweep, `${path}.sweep`, errors);
  if (rakingLight.direction !== undefined) {
    if (!isFiniteNumber(rakingLight.direction) || rakingLight.direction < 0 || rakingLight.direction > 360) {
      pushError(errors, `${path}.direction`, "must be a number from 0 to 360");
    }
  }
  if (rakingLight.height !== undefined) {
    if (!isFiniteNumber(rakingLight.height) || rakingLight.height < 1 || rakingLight.height > 89) {
      pushError(errors, `${path}.height`, "must be a number from 1 to 89");
    }
  }
}

function validateClipping(clipping, path, errors) {
  if (!isPlainObject(clipping)) {
    pushError(errors, path, "must be an object");
    return;
  }
  if (clipping.mode !== undefined) {
    if (!isPlainObject(clipping.mode)) {
      pushError(errors, `${path}.mode`, "must be an object");
    } else {
      ["x", "y", "z"].forEach((axis) => {
        if (clipping.mode[axis] !== undefined) validateBoolean(clipping.mode[axis], `${path}.mode.${axis}`, errors);
      });
    }
  }
  if (clipping.constants !== undefined) validateVector(clipping.constants, `${path}.constants`, errors, 3);
  if (clipping.outlineVisible !== undefined) validateBoolean(clipping.outlineVisible, `${path}.outlineVisible`, errors);
  if (clipping.outline !== undefined) validateBoolean(clipping.outline, `${path}.outline`, errors);
}

function validateCamera(camera, path, errors) {
  if (!isPlainObject(camera)) {
    pushError(errors, path, "must be an object");
    return;
  }
  if (camera.position !== undefined) validateVector(camera.position, `${path}.position`, errors, 3);
  if (camera.target !== undefined) validateVector(camera.target, `${path}.target`, errors, 3);
  if (camera.up !== undefined) validateVector(camera.up, `${path}.up`, errors, 3);
  if (camera.fov !== undefined) validateNumber(camera.fov, `${path}.fov`, errors);
  if (camera.zoom !== undefined) validateNumber(camera.zoom, `${path}.zoom`, errors);
  if (camera.distance !== undefined) validateNumber(camera.distance, `${path}.distance`, errors);
  if (camera.perspectiveMode !== undefined) validateEnum(camera.perspectiveMode, ["perspective", "orthographic"], `${path}.perspectiveMode`, errors);
}

function validatePanelState(panel, path, errors) {
  if (!isPlainObject(panel)) {
    pushError(errors, path, "must be an object");
    return;
  }
  if (panel.position !== undefined) validateVector(panel.position, `${path}.position`, errors, 2);
  if (panel.size !== undefined) {
    if (!isPlainObject(panel.size)) {
      pushError(errors, `${path}.size`, "must be an object");
    } else {
      // viewer-settings.json uses null for "not sized yet".
      ["width", "height"].forEach((key) => {
        if (panel.size[key] != null) validateNumber(panel.size[key], `${path}.size.${key}`, errors);
      });
    }
  }
}

function validateIntegration(integration, path, errors) {
  if (!isPlainObject(integration)) {
    pushError(errors, path, "must be an object");
    return;
  }
  if (integration.exportViewerUrl !== undefined) validateString(integration.exportViewerUrl, `${path}.exportViewerUrl`, errors);
  if (integration.api !== undefined) {
    if (!isPlainObject(integration.api)) {
      pushError(errors, `${path}.api`, "must be an object");
    } else if (integration.api.thumbnailUploadEndpoint !== undefined) {
      validateString(integration.api.thumbnailUploadEndpoint, `${path}.api.thumbnailUploadEndpoint`, errors);
    }
  }
}

function validateViewer(viewer, path, errors) {
  if (!isPlainObject(viewer)) {
    pushError(errors, path, "must be an object");
    return;
  }
  if (viewer.container !== undefined) validateString(viewer.container, `${path}.container`, errors);
  if (viewer.mailUrl !== undefined) validateString(viewer.mailUrl, `${path}.mailUrl`, errors);
  if (viewer.mainUrl !== undefined) validateString(viewer.mainUrl, `${path}.mainUrl`, errors);
  if (viewer.baseModulePath !== undefined) validateString(viewer.baseModulePath, `${path}.baseModulePath`, errors);
  if (viewer.background !== undefined) validateString(viewer.background, `${path}.background`, errors);
  if (viewer.credits !== undefined && !isPlainObject(viewer.credits)) pushError(errors, `${path}.credits`, "must be an object");
  if (viewer.auth !== undefined) {
    if (!isPlainObject(viewer.auth)) {
      pushError(errors, `${path}.auth`, "must be an object");
    } else {
      ["enabled", "allowRegistration"].forEach((key) => {
        if (viewer.auth[key] !== undefined) validateBoolean(viewer.auth[key], `${path}.auth.${key}`, errors);
      });
    }
  }
  ["manifestoForm", "metadataContainer"].forEach((key) => {
    if (viewer[key] !== undefined) validatePanelState(viewer[key], `${path}.${key}`, errors);
  });
  if (viewer.baseNamespace !== undefined) validateString(viewer.baseNamespace, `${path}.baseNamespace`, errors);
  if (viewer.metadataUrl !== undefined) validateString(viewer.metadataUrl, `${path}.metadataUrl`, errors);
  if (viewer.theme !== undefined) validateEnum(viewer.theme, ["light", "dark"], `${path}.theme`, errors);
  if (viewer.language !== undefined) validateEnum(viewer.language, ["en", "pl", "de"], `${path}.language`, errors);
  if (viewer.backgroundColor !== undefined) validateString(viewer.backgroundColor, `${path}.backgroundColor`, errors);
  if (viewer.environmentMap !== undefined) {
    if (!isPlainObject(viewer.environmentMap)) {
      pushError(errors, `${path}.environmentMap`, "must be an object");
    } else {
      if (viewer.environmentMap.intensity !== undefined) validateNumber(viewer.environmentMap.intensity, `${path}.environmentMap.intensity`, errors);
      if (viewer.environmentMap.preset !== undefined) validateString(viewer.environmentMap.preset, `${path}.environmentMap.preset`, errors);
      if (viewer.environmentMap.enabled !== undefined) validateBoolean(viewer.environmentMap.enabled, `${path}.environmentMap.enabled`, errors);
    }
  }
  if (viewer.splatLighting !== undefined) {
    const splatLighting = viewer.splatLighting;
    if (!isPlainObject(splatLighting)) {
      pushError(errors, `${path}.splatLighting`, "must be an object");
    } else {
      if (splatLighting.enabled !== undefined) validateBoolean(splatLighting.enabled, `${path}.splatLighting.enabled`, errors);
      ["strength", "occlusion"].forEach((key) => {
        const value = splatLighting[key];
        if (value !== undefined && (!isFiniteNumber(value) || value < 0 || value > 1)) {
          pushError(errors, `${path}.splatLighting.${key}`, "must be a number from 0 to 1");
        }
      });
    }
  }
  if (viewer.rendering !== undefined) {
    const rendering = viewer.rendering;
    if (!isPlainObject(rendering)) {
      pushError(errors, `${path}.rendering`, "must be an object");
    } else {
      if (rendering.toneMapping !== undefined) validateEnum(rendering.toneMapping, RENDERING_TONE_MAPPINGS, `${path}.rendering.toneMapping`, errors);
      if (rendering.exposure !== undefined) {
        validateNumber(rendering.exposure, `${path}.rendering.exposure`, errors);
        if (Number.isFinite(rendering.exposure) && rendering.exposure < 0) pushError(errors, `${path}.rendering.exposure`, "must be >= 0");
      }
      if (rendering.postprocessing !== undefined) {
        const postprocessing = rendering.postprocessing;
        if (!isPlainObject(postprocessing)) {
          pushError(errors, `${path}.rendering.postprocessing`, "must be an object");
        } else {
          if (postprocessing.enabled !== undefined) validateBoolean(postprocessing.enabled, `${path}.rendering.postprocessing.enabled`, errors);
          if (postprocessing.antialias !== undefined) validateEnum(postprocessing.antialias, RENDERING_ANTIALIAS_MODES, `${path}.rendering.postprocessing.antialias`, errors);
          if (postprocessing.ao !== undefined) validateBoolean(postprocessing.ao, `${path}.rendering.postprocessing.ao`, errors);
          if (postprocessing.aoIntensity !== undefined) {
            if (!isFiniteNumber(postprocessing.aoIntensity) || postprocessing.aoIntensity < 0 || postprocessing.aoIntensity > 2) {
              pushError(errors, `${path}.rendering.postprocessing.aoIntensity`, "must be a number from 0 to 2");
            }
          }
        }
      }
    }
  }
  [
    "presentationMode",
    "sandbox",
    "lightweight",
    "editor",
    "autorotate",
    "disableInteraction",
    "hideUi",
    "hideMetadata",
    "showNotifications",
  ].forEach((key) => {
    if (viewer[key] !== undefined) validateBoolean(viewer[key], `${path}.${key}`, errors);
  });
  if (viewer.autorotateSpeed !== undefined) validateNumber(viewer.autorotateSpeed, `${path}.autorotateSpeed`, errors);
  if (viewer.scale !== undefined) validateVector(viewer.scale, `${path}.scale`, errors, 2);
  if (viewer.window !== undefined) {
    if (!isPlainObject(viewer.window)) {
      pushError(errors, `${path}.window`, "must be an object");
    } else {
      if (viewer.window.position !== undefined) {
        validateVector(viewer.window.position, `${path}.window.position`, errors, 2);
      }
      if (viewer.window.size !== undefined) {
        if (!isPlainObject(viewer.window.size)) {
          pushError(errors, `${path}.window.size`, "must be an object");
        } else {
          if (viewer.window.size.width !== undefined) validateNumber(viewer.window.size.width, `${path}.window.size.width`, errors);
          if (viewer.window.size.height !== undefined) validateNumber(viewer.window.size.height, `${path}.window.size.height`, errors);
        }
      }
    }
  }
  if (viewer.performance !== undefined) validateString(viewer.performance, `${path}.performance`, errors);
  if (viewer.units !== undefined && !(isFiniteNumber(viewer.units) || isString(viewer.units))) {
    pushError(errors, `${path}.units`, "must be a finite number or string");
  }
  if (viewer.gallery !== undefined && !isPlainObject(viewer.gallery)) pushError(errors, `${path}.gallery`, "must be an object");
  if (viewer.editorToolbar !== undefined) {
    if (!isPlainObject(viewer.editorToolbar)) {
      pushError(errors, `${path}.editorToolbar`, "must be an object");
    } else {
      if (viewer.editorToolbar.enabled !== undefined) validateBoolean(viewer.editorToolbar.enabled, `${path}.editorToolbar.enabled`, errors);
      if (viewer.editorToolbar.position !== undefined) validateVector(viewer.editorToolbar.position, `${path}.editorToolbar.position`, errors, 2);
      if (viewer.editorToolbar.expanded !== undefined) validateBoolean(viewer.editorToolbar.expanded, `${path}.editorToolbar.expanded`, errors);
      if (viewer.editorToolbar.visible !== undefined) validateBoolean(viewer.editorToolbar.visible, `${path}.editorToolbar.visible`, errors);
    }
  }
  if (viewer.menuToolbar !== undefined) {
    if (!isPlainObject(viewer.menuToolbar)) {
      pushError(errors, `${path}.menuToolbar`, "must be an object");
    } else {
      if (viewer.menuToolbar.enabled !== undefined) validateBoolean(viewer.menuToolbar.enabled, `${path}.menuToolbar.enabled`, errors);
      if (viewer.menuToolbar.position !== undefined) validateVector(viewer.menuToolbar.position, `${path}.menuToolbar.position`, errors, 2);
    }
  }
  if (viewer.clipping !== undefined) validateClipping(viewer.clipping, `${path}.clipping`, errors);
  if (viewer.tour !== undefined) {
    if (!isPlainObject(viewer.tour)) {
      pushError(errors, `${path}.tour`, "must be an object");
    } else {
      ["autostart", "autoplay", "loop"].forEach((key) => {
        if (viewer.tour[key] !== undefined) validateBoolean(viewer.tour[key], `${path}.tour.${key}`, errors);
      });
      if (viewer.tour.stepDuration !== undefined) {
        validateNumber(viewer.tour.stepDuration, `${path}.tour.stepDuration`, errors);
        if (Number.isFinite(viewer.tour.stepDuration) && viewer.tour.stepDuration <= 0) pushError(errors, `${path}.tour.stepDuration`, "must be > 0");
      }
      if (viewer.tour.transitionDuration !== undefined) {
        validateNumber(viewer.tour.transitionDuration, `${path}.tour.transitionDuration`, errors);
        if (Number.isFinite(viewer.tour.transitionDuration) && viewer.tour.transitionDuration < 0) pushError(errors, `${path}.tour.transitionDuration`, "must be >= 0");
      }
    }
  }
}

function validateModelTransform(modelTransform, path, errors) {
  if (!isPlainObject(modelTransform)) {
    pushError(errors, path, "must be an object");
    return;
  }
  if (modelTransform.position !== undefined) validateVector(modelTransform.position, `${path}.position`, errors, 3);
  if (modelTransform.scale !== undefined) validateVector(modelTransform.scale, `${path}.scale`, errors, 3);
  if (modelTransform.rotation !== undefined) {
    if (!isPlainObject(modelTransform.rotation)) {
      pushError(errors, `${path}.rotation`, "must be an object");
    } else {
      ["x", "y", "z"].forEach((key) => {
        if (modelTransform.rotation[key] !== undefined) validateNumber(modelTransform.rotation[key], `${path}.rotation.${key}`, errors);
      });
      if (modelTransform.rotation.order !== undefined) validateString(modelTransform.rotation.order, `${path}.rotation.order`, errors);
    }
  }
  if (modelTransform.upAxis !== undefined) validateEnum(modelTransform.upAxis, MODEL_UP_AXES, `${path}.upAxis`, errors);
  if (modelTransform.wireframe !== undefined) validateBoolean(modelTransform.wireframe, `${path}.wireframe`, errors);
  if (modelTransform.shadingMode !== undefined) {
    validateEnum(modelTransform.shadingMode, SHADING_MODES, `${path}.shadingMode`, errors);
  }
  if (modelTransform.customShader !== undefined) {
    if (!isPlainObject(modelTransform.customShader)) {
      pushError(errors, `${path}.customShader`, "must be an object");
    } else {
      if (modelTransform.customShader.vertexShader !== undefined) {
        validateString(modelTransform.customShader.vertexShader, `${path}.customShader.vertexShader`, errors);
      }
      if (modelTransform.customShader.fragmentShader !== undefined) {
        validateString(modelTransform.customShader.fragmentShader, `${path}.customShader.fragmentShader`, errors);
      }
    }
  }
}

// IIIF language map ({ "pl": ["..."] }) or a plain string.
function validateLanguageMap(value, path, errors) {
  if (isString(value)) return;
  if (!isPlainObject(value)) {
    pushError(errors, path, "must be a string or a language map");
    return;
  }
  Object.entries(value).forEach(([lang, texts]) => {
    if (!Array.isArray(texts) || !texts.every(isString)) {
      pushError(errors, `${path}.${lang}`, "must be an array of strings");
    }
  });
}

// AIM3DViewer.thumbnails (ui/thumbnail-gallery.js): URLs, or { src, label }.
function validateThumbnails(thumbnails, path, errors) {
  if (!Array.isArray(thumbnails)) {
    pushError(errors, path, "must be an array");
    return;
  }
  thumbnails.forEach((entry, index) => {
    const entryPath = `${path}[${index}]`;
    if (isString(entry)) {
      if (!entry.trim()) pushError(errors, entryPath, "must not be empty");
      return;
    }
    if (!isPlainObject(entry) || !isString(entry.src) || !entry.src.trim()) {
      pushError(errors, entryPath, "must be a URL or an object with a non-empty src");
      return;
    }
    if (entry.label !== undefined) validateLanguageMap(entry.label, `${entryPath}.label`, errors);
  });
}

// AIM3DViewer.timeline (timeline.js): the 4D stages of the model.
function validateTimeline(timeline, path, errors) {
  if (!isPlainObject(timeline)) {
    pushError(errors, path, "must be an object");
    return;
  }
  ["enabled", "showPanel"].forEach((key) => {
    if (timeline[key] !== undefined) validateBoolean(timeline[key], `${path}.${key}`, errors);
  });
  ["year", "startYear", "endYear"].forEach((key) => {
    if (timeline[key] !== undefined) validateNumber(timeline[key], `${path}.${key}`, errors);
  });
  if (isFiniteNumber(timeline.startYear) && isFiniteNumber(timeline.endYear) && timeline.startYear > timeline.endYear) {
    pushError(errors, `${path}.endYear`, "must not be before startYear");
  }
  if (timeline.label !== undefined) validateLanguageMap(timeline.label, `${path}.label`, errors);
  if (timeline.description !== undefined) validateLanguageMap(timeline.description, `${path}.description`, errors);
  if (timeline.transition !== undefined) validateEnum(timeline.transition, TIMELINE_TRANSITIONS, `${path}.transition`, errors);
  if (timeline.transitionDuration !== undefined && (!isFiniteNumber(timeline.transitionDuration) || timeline.transitionDuration < 0)) {
    pushError(errors, `${path}.transitionDuration`, "must be a number >= 0");
  }
  if (timeline.playback !== undefined) {
    const playback = timeline.playback;
    if (!isPlainObject(playback)) {
      pushError(errors, `${path}.playback`, "must be an object");
    } else {
      if (playback.autoplay !== undefined) validateBoolean(playback.autoplay, `${path}.playback.autoplay`, errors);
      if (playback.loop !== undefined) validateBoolean(playback.loop, `${path}.playback.loop`, errors);
      if (playback.yearsPerSecond !== undefined && (!isFiniteNumber(playback.yearsPerSecond) || playback.yearsPerSecond <= 0)) {
        pushError(errors, `${path}.playback.yearsPerSecond`, "must be a number > 0");
      }
      if (playback.speed !== undefined && (!isFiniteNumber(playback.speed) || playback.speed <= 0)) {
        pushError(errors, `${path}.playback.speed`, "must be a number > 0");
      }
      if (playback.pauseAtEvents !== undefined && (!isFiniteNumber(playback.pauseAtEvents) || playback.pauseAtEvents < 0)) {
        pushError(errors, `${path}.playback.pauseAtEvents`, "must be a number >= 0");
      }
    }
  }
  if (timeline.stages === undefined) return;
  if (!Array.isArray(timeline.stages)) {
    pushError(errors, `${path}.stages`, "must be an array");
    return;
  }
  timeline.stages.forEach((stage, index) => {
    const stagePath = `${path}.stages[${index}]`;
    if (!isPlainObject(stage)) {
      pushError(errors, stagePath, "must be an object");
      return;
    }
    validateNumber(stage.year, `${stagePath}.year`, errors);
    if (stage.type !== undefined) validateEnum(stage.type, TIMELINE_STAGE_TYPES, `${stagePath}.type`, errors);
    if (stage.approximate !== undefined) validateBoolean(stage.approximate, `${stagePath}.approximate`, errors);
    ["yearLabel", "label", "description", "source"].forEach((key) => {
      if (stage[key] !== undefined) validateLanguageMap(stage[key], `${stagePath}.${key}`, errors);
    });
    if (stage.nodes !== undefined && !(Array.isArray(stage.nodes) && stage.nodes.every(isString))) {
      pushError(errors, `${stagePath}.nodes`, "must be an array of node names");
    }
  });
}

// AIM3DViewer.variants (editor/compare.js): reconstruction variants.
function validateVariants(variants, path, errors) {
  if (!isPlainObject(variants)) {
    pushError(errors, path, "must be an object");
    return;
  }
  ["enabled", "showPanel"].forEach((key) => {
    if (variants[key] !== undefined) validateBoolean(variants[key], `${path}.${key}`, errors);
  });
  if (variants.label !== undefined) validateLanguageMap(variants.label, `${path}.label`, errors);
  if (variants.description !== undefined) validateLanguageMap(variants.description, `${path}.description`, errors);
  if (variants.active !== undefined) validateString(variants.active, `${path}.active`, errors);
  if (variants.items === undefined) return;
  if (!Array.isArray(variants.items)) {
    pushError(errors, `${path}.items`, "must be an array");
    return;
  }
  const ids = new Set();
  variants.items.forEach((item, index) => {
    const itemPath = `${path}.items[${index}]`;
    if (!isPlainObject(item)) {
      pushError(errors, itemPath, "must be an object");
      return;
    }
    validateString(item.id, `${itemPath}.id`, errors);
    if (isString(item.id)) {
      if (ids.has(item.id)) pushError(errors, `${itemPath}.id`, "must be unique");
      ids.add(item.id);
    }
    ["label", "description", "source"].forEach((key) => {
      if (item[key] !== undefined) validateLanguageMap(item[key], `${itemPath}.${key}`, errors);
    });
    if (item.certainty !== undefined) validateNumber(item.certainty, `${itemPath}.certainty`, errors);
    if (item.nodes !== undefined && !(Array.isArray(item.nodes) && item.nodes.every(isString))) {
      pushError(errors, `${itemPath}.nodes`, "must be an array of node names");
    }
  });
  if (isString(variants.active) && ids.size && !ids.has(variants.active)) {
    pushError(errors, `${path}.active`, "must be the id of one of the items");
  }
}

// AIM3DViewer.compare (editor/compare.js): the comparison view.
function validateCompare(compare, path, errors) {
  if (!isPlainObject(compare)) {
    pushError(errors, path, "must be an object");
    return;
  }
  if (compare.enabled !== undefined) validateBoolean(compare.enabled, `${path}.enabled`, errors);
  if (compare.mode !== undefined) validateEnum(compare.mode, COMPARE_MODES, `${path}.mode`, errors);
  if (compare.kind !== undefined) validateEnum(compare.kind, COMPARE_KINDS, `${path}.kind`, errors);
  const look = compare.kind === "look";
  if (compare.position !== undefined && (!isFiniteNumber(compare.position) || compare.position < 0 || compare.position > 1)) {
    pushError(errors, `${path}.position`, "must be a number from 0 to 1");
  }
  ["left", "right"].forEach((key) => {
    const side = compare[key];
    if (side === undefined) return;
    const sidePath = `${path}.${key}`;
    if (!isPlainObject(side)) {
      pushError(errors, sidePath, look ? "must be an object with a shading mode or a lighting" : "must be an object with a variant or a year");
      return;
    }
    if (look) {
      if (side.shading === undefined && side.lighting === undefined) pushError(errors, sidePath, "must have a shading mode or a lighting");
      if (side.shading !== undefined) validateEnum(side.shading, SHADING_MODES, `${sidePath}.shading`, errors);
      if (side.lighting !== undefined) validateEnum(side.lighting, COMPARE_LIGHTINGS, `${sidePath}.lighting`, errors);
      return;
    }
    if (side.variant !== undefined) validateString(side.variant, `${sidePath}.variant`, errors);
    if (side.year !== undefined) validateNumber(side.year, `${sidePath}.year`, errors);
    if (side.variant === undefined && side.year === undefined) pushError(errors, sidePath, "must have a variant or a year");
  });
}

// AIM3DViewer.photos (editor/photo-overlay.js): historical photos and the
// views they were taken from.
function validatePhotos(photos, path, errors) {
  if (!Array.isArray(photos)) {
    pushError(errors, path, "must be an array");
    return;
  }
  const ids = new Set();
  photos.forEach((photo, index) => {
    const photoPath = `${path}[${index}]`;
    if (!isPlainObject(photo)) {
      pushError(errors, photoPath, "must be an object");
      return;
    }
    const service = typeof photo.service === "string" || isPlainObject(photo.service);
    if (!isString(photo.src) && !service) pushError(errors, photoPath, "must have a src or a IIIF Image API service");
    if (photo.src !== undefined) validateString(photo.src, `${photoPath}.src`, errors);
    if (photo.id !== undefined) {
      validateString(photo.id, `${photoPath}.id`, errors);
      if (ids.has(photo.id)) pushError(errors, `${photoPath}.id`, "must be unique");
      ids.add(photo.id);
    }
    ["label", "description", "source"].forEach((key) => {
      if (photo[key] !== undefined) validateLanguageMap(photo[key], `${photoPath}.${key}`, errors);
    });
    if (photo.year !== undefined) validateNumber(photo.year, `${photoPath}.year`, errors);
    if (photo.opacity !== undefined && (!isFiniteNumber(photo.opacity) || photo.opacity < 0 || photo.opacity > 1)) {
      pushError(errors, `${photoPath}.opacity`, "must be a number from 0 to 1");
    }
    if (photo.view === undefined) return;
    const view = photo.view;
    if (!isPlainObject(view)) {
      pushError(errors, `${photoPath}.view`, "must be an object");
      return;
    }
    ["position", "target"].forEach((key) => {
      const value = view[key];
      if (!(Array.isArray(value) && value.length === 3 && value.every(isFiniteNumber))) {
        pushError(errors, `${photoPath}.view.${key}`, "must be an array of 3 numbers");
      }
    });
    if (view.fov !== undefined && (!isFiniteNumber(view.fov) || view.fov <= 0 || view.fov >= 180)) {
      pushError(errors, `${photoPath}.view.fov`, "must be a number between 0 and 180");
    }
    if (view.roll !== undefined) validateNumber(view.roll, `${photoPath}.view.roll`, errors);
  });
}

// AIM3DViewer.location (editor/sun-study.js): where the model stands.
function validateLocation(location, path, errors) {
  if (!isPlainObject(location)) {
    pushError(errors, path, "must be an object");
    return;
  }
  if (!isFiniteNumber(location.latitude) || location.latitude < -90 || location.latitude > 90) {
    pushError(errors, `${path}.latitude`, "must be a number from -90 to 90");
  }
  if (!isFiniteNumber(location.longitude) || location.longitude < -180 || location.longitude > 180) {
    pushError(errors, `${path}.longitude`, "must be a number from -180 to 180");
  }
  if (location.north !== undefined) validateNumber(location.north, `${path}.north`, errors);
  if (location.utcOffset !== undefined && (!isFiniteNumber(location.utcOffset) || location.utcOffset < -14 || location.utcOffset > 14)) {
    pushError(errors, `${path}.utcOffset`, "must be a number of hours from -14 to 14");
  }
}

// AIM3DViewer.sun (editor/sun-study.js): the sun on a day and hour.
function validateSun(sun, path, errors) {
  if (!isPlainObject(sun)) {
    pushError(errors, path, "must be an object");
    return;
  }
  ["enabled", "followTimeline", "animate"].forEach((key) => {
    if (sun[key] !== undefined) validateBoolean(sun[key], `${path}.${key}`, errors);
  });
  if (sun.date !== undefined && !(isString(sun.date) && /^(-?\d{1,4}-)?(0?[1-9]|1[0-2])-(0?[1-9]|[12]\d|3[01])$/.test(sun.date.trim()))) {
    pushError(errors, `${path}.date`, 'must be "MM-DD" or "YYYY-MM-DD"');
  }
  if (sun.time !== undefined && !(isString(sun.time) && /^([01]?\d|2[0-3]):[0-5]\d$|^24:00$/.test(sun.time.trim()))) {
    pushError(errors, `${path}.time`, 'must be "HH:MM"');
  }
}

// AIM3DViewer.weather (editor/weather.js): the weather around the model.
function validateWeather(weather, path, errors) {
  if (!isPlainObject(weather)) {
    pushError(errors, path, "must be an object");
    return;
  }
  if (!WEATHER_TYPES.includes(weather.type)) {
    pushError(errors, `${path}.type`, `must be one of ${WEATHER_TYPES.join(", ")}`);
  }
  ["intensity", "wind", "mistHeight", "mistDensity", "mistSpread"].forEach((key) => {
    if (weather[key] !== undefined && (!isFiniteNumber(weather[key]) || weather[key] < 0 || weather[key] > 1)) {
      pushError(errors, `${path}.${key}`, "must be a number from 0 to 1");
    }
  });
  if (weather.windDirection !== undefined) validateNumber(weather.windDirection, `${path}.windDirection`, errors);
  ["sky", "surfaces"].forEach((key) => {
    if (weather[key] !== undefined) validateBoolean(weather[key], `${path}.${key}`, errors);
  });
}

// AIM3DViewer.materials (editor/materials-editor.js): the materials edited,
// by their place in the model and name.
const MATERIAL_UNIT_PARAMS = ["roughness", "metalness", "opacity", "transmission", "clearcoat", "clearcoatRoughness", "sheen"];
function validateMaterials(materials, path, errors) {
  if (!Array.isArray(materials)) {
    pushError(errors, path, "must be an array");
    return;
  }
  materials.forEach((entry, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isPlainObject(entry)) {
      pushError(errors, itemPath, "must be an object");
      return;
    }
    if (entry.index !== undefined && !(Number.isInteger(entry.index) && entry.index >= 0)) {
      pushError(errors, `${itemPath}.index`, "must be a whole number from 0");
    }
    if (entry.index === undefined && !entry.name) pushError(errors, itemPath, "needs an index or a name");
    if (entry.name !== undefined) validateString(entry.name, `${itemPath}.name`, errors);
    if (entry.preset !== undefined && entry.preset !== null) validateEnum(entry.preset, MATERIAL_PRESET_KEYS, `${itemPath}.preset`, errors);
    if (entry.keepTexture !== undefined) validateBoolean(entry.keepTexture, `${itemPath}.keepTexture`, errors);
    const params = entry.params;
    if (params === undefined) return;
    if (!isPlainObject(params)) {
      pushError(errors, `${itemPath}.params`, "must be an object");
      return;
    }
    ["color", "emissive"].forEach((key) => {
      if (params[key] !== undefined && !(isString(params[key]) && /^#[0-9a-f]{6}$/i.test(params[key]))) {
        pushError(errors, `${itemPath}.params.${key}`, 'must be a colour "#rrggbb"');
      }
    });
    MATERIAL_UNIT_PARAMS.forEach((key) => {
      if (params[key] !== undefined && (!isFiniteNumber(params[key]) || params[key] < 0 || params[key] > 1)) {
        pushError(errors, `${itemPath}.params.${key}`, "must be a number from 0 to 1");
      }
    });
    ["thickness", "ior", "emissiveIntensity"].forEach((key) => {
      if (params[key] !== undefined && (!isFiniteNumber(params[key]) || params[key] < 0)) {
        pushError(errors, `${itemPath}.params.${key}`, "must be a number from 0");
      }
    });
    if (params.doubleSided !== undefined) validateBoolean(params.doubleSided, `${itemPath}.params.doubleSided`, errors);
  });
}

// AIM3DViewer.sceneSuggest (editor/scene-suggest.js): the Suggested scene
// window open on load, for a purpose.
function validateSceneSuggest(sceneSuggest, path, errors) {
  if (!isPlainObject(sceneSuggest)) {
    pushError(errors, path, "must be an object");
    return;
  }
  if (sceneSuggest.open !== undefined) validateBoolean(sceneSuggest.open, `${path}.open`, errors);
  if (sceneSuggest.purpose !== undefined) validateEnum(sceneSuggest.purpose, ["documentation", "presentation"], `${path}.purpose`, errors);
}

function validateAIM3DViewerBlock(block, path, errors) {
  if (!isPlainObject(block)) {
    pushError(errors, path, "must be an object");
    return;
  }
  if (block.version !== undefined) validateString(block.version, `${path}.version`, errors);
  if (block.generatedAt !== undefined) validateString(block.generatedAt, `${path}.generatedAt`, errors);
  if (block.camera !== undefined) validateCamera(block.camera, `${path}.camera`, errors);
  if (block.viewer !== undefined) validateViewer(block.viewer, `${path}.viewer`, errors);
  if (block.integration !== undefined) validateIntegration(block.integration, `${path}.integration`, errors);
  if (block.lights !== undefined) {
    if (!Array.isArray(block.lights)) {
      pushError(errors, `${path}.lights`, "must be an array");
    } else {
      block.lights.forEach((light, index) => validateLight(light, `${path}.lights[${index}]`, errors));
    }
  }
  if (block.modelTransform !== undefined) validateModelTransform(block.modelTransform, `${path}.modelTransform`, errors);
  if (block.clipping !== undefined) validateClipping(block.clipping, `${path}.clipping`, errors);
  if (block.rakingLight !== undefined) validateRakingLight(block.rakingLight, `${path}.rakingLight`, errors);
  if (block.timeline !== undefined) validateTimeline(block.timeline, `${path}.timeline`, errors);
  if (block.variants !== undefined) validateVariants(block.variants, `${path}.variants`, errors);
  if (block.compare !== undefined) validateCompare(block.compare, `${path}.compare`, errors);
  if (block.photos !== undefined) validatePhotos(block.photos, `${path}.photos`, errors);
  if (block.location !== undefined) validateLocation(block.location, `${path}.location`, errors);
  if (block.sun !== undefined) validateSun(block.sun, `${path}.sun`, errors);
  if (block.weather !== undefined) validateWeather(block.weather, `${path}.weather`, errors);
  if (block.sceneSuggest !== undefined) validateSceneSuggest(block.sceneSuggest, `${path}.sceneSuggest`, errors);
  if (block.materials !== undefined) validateMaterials(block.materials, `${path}.materials`, errors);
  if (block.thumbnails !== undefined) validateThumbnails(block.thumbnails, `${path}.thumbnails`, errors);
  if (block.certainty !== undefined) {
    certaintyScaleErrors(block.certainty, `${path}.certainty`).forEach(([errorPath, message]) => pushError(errors, errorPath, message));
  }
}

// Level of Certainty assessments on the annotations of every Scene and of
// the manifest itself, checked against the manifest's scale (or the default).
function validateCertaintyAssessments(manifest, errors) {
  const scale = normalizeCertaintyScale(manifest.AIM3DViewer?.certainty);
  const pages = [
    ...(Array.isArray(manifest.items) ? manifest.items : []).flatMap((item, itemIndex) => (
      Array.isArray(item?.annotations)
        ? item.annotations.map((page, pageIndex) => [page, `$.items[${itemIndex}].annotations[${pageIndex}]`])
        : []
    )),
    ...(Array.isArray(manifest.annotations)
      ? manifest.annotations.map((page, pageIndex) => [page, `$.annotations[${pageIndex}]`])
      : []),
  ];
  pages.forEach(([page, pagePath]) => {
    (Array.isArray(page?.items) ? page.items : []).forEach((annotation, index) => {
      const certainty = annotation?.AIM3DViewer?.certainty;
      if (certainty === undefined) return;
      certaintyAssessmentErrors(certainty, `${pagePath}.items[${index}].AIM3DViewer.certainty`, scale)
        .forEach(([errorPath, message]) => pushError(errors, errorPath, message));
    });
  });
}

export function validateAIM3DManifest(manifest, options = {}) {
  const { requireCustomBlock = false } = options;
  const errors = [];

  if (!isPlainObject(manifest)) {
    pushError(errors, "$", "must be an object");
    return { valid: false, errors };
  }

  if (manifest.id !== undefined) validateString(manifest.id, "$.id", errors);
  if (manifest.type !== undefined) validateString(manifest.type, "$.type", errors);
  if (manifest.type !== undefined && manifest.type !== "Manifest") {
    pushError(errors, "$.type", 'must equal "Manifest"');
  }
  if (manifest.items !== undefined && !Array.isArray(manifest.items)) {
    pushError(errors, "$.items", "must be an array");
  }
  if (requireCustomBlock && !isPlainObject(manifest.AIM3DViewer)) {
    pushError(errors, "$.AIM3DViewer", "is required and must be an object");
  }
  if (manifest.AIM3DViewer !== undefined) {
    validateAIM3DViewerBlock(manifest.AIM3DViewer, "$.AIM3DViewer", errors);
  }
  validateCertaintyAssessments(manifest, errors);

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function formatAIM3DManifestValidationErrors(errors, maxErrors = 8) {
  if (!Array.isArray(errors) || errors.length === 0) return "";
  const visibleErrors = errors.slice(0, maxErrors).map((error) => `${error.path} ${error.message}`);
  const remainingCount = errors.length - visibleErrors.length;
  if (remainingCount > 0) {
    visibleErrors.push(`...and ${remainingCount} more error${remainingCount === 1 ? "" : "s"}`);
  }
  return visibleErrors.join("\n");
}
