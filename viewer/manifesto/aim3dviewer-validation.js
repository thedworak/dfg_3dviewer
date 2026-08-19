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

function validateViewer(viewer, path, errors) {
  if (!isPlainObject(viewer)) {
    pushError(errors, path, "must be an object");
    return;
  }
  if (viewer.container !== undefined) validateString(viewer.container, `${path}.container`, errors);
  if (viewer.mailUrl !== undefined) validateString(viewer.mailUrl, `${path}.mailUrl`, errors);
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
  [
    "presentationMode",
    "sandbox",
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
  if (modelTransform.wireframe !== undefined) validateBoolean(modelTransform.wireframe, `${path}.wireframe`, errors);
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
  if (block.integration !== undefined && !isPlainObject(block.integration)) pushError(errors, `${path}.integration`, "must be an object");
  if (block.lights !== undefined) {
    if (!Array.isArray(block.lights)) {
      pushError(errors, `${path}.lights`, "must be an array");
    } else {
      block.lights.forEach((light, index) => validateLight(light, `${path}.lights[${index}]`, errors));
    }
  }
  if (block.modelTransform !== undefined) validateModelTransform(block.modelTransform, `${path}.modelTransform`, errors);
  if (block.clipping !== undefined) validateClipping(block.clipping, `${path}.clipping`, errors);
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
