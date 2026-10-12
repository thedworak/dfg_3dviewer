import { modelFormatOf } from "../IIIF/model-formats.js";

// The settings of a manifest for another model (the manifest form's "Use
// these settings with another model", metadata.js): the look - lights,
// rendering, environment, shading, raking light, the Level of Certainty
// scale, the viewer options - stays; what belongs to the old model goes:
//
// - its annotations, and the cameras of their saved views
// - the thumbnails (renders of the old model), the 4D timeline (its nodes)
//   and the section planes (its coordinates)
// - the model's own transform (position, rotation, scale)
// - the viewer window's place on the page (viewer.window)
// - the camera, unless keepCamera: a pose that fits one model rarely fits
//   another, and without one the viewer frames the new model itself
//
// Ids made from the old model's URL ("<model>/scene", ...) are made from the
// new one. Returns the new manifest, or null when the manifest has no model.

const bodyOf = (annotation) => {
  const body = Array.isArray(annotation?.body) ? annotation.body[0] : annotation?.body;
  return body?.type === "SpecificResource" ? body.source ?? body : body;
};
const typeOf = (annotation) => {
  const body = bodyOf(annotation);
  return (Array.isArray(body) ? body[0]?.type : body?.type) || "";
};
const isModel = (annotation) => typeOf(annotation) === "Model";
const isCamera = (annotation) => /Camera$/.test(typeOf(annotation));

export function modelUrlOfManifest(manifest) {
  for (const scene of manifest?.items || []) {
    for (const page of scene.items || []) {
      const model = (page.items || []).find(isModel);
      if (model) return bodyOf(model)?.id || null;
    }
  }
  return null;
}

const basename = (url) => String(url).split(/[?#]/)[0].split("/").pop() || url;

export function retargetManifest(manifest, modelUrl, { keepCamera = false } = {}) {
  const oldUrl = modelUrlOfManifest(manifest);
  const newUrl = String(modelUrl || "").trim();
  if (!oldUrl || !newUrl) return null;

  // Every string made from the old URL, made from the new one.
  const swap = (value) => {
    if (typeof value === "string") return value.split(oldUrl).join(newUrl);
    if (Array.isArray(value)) return value.map(swap);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, swap(item)]));
    }
    return value;
  };
  const result = swap(structuredClone(manifest));

  if (!String(result.id || "").startsWith(newUrl)) result.id = `${newUrl}/manifest.json`;
  result.label = { en: [basename(newUrl)] };
  delete result.thumbnail;

  const scene = result.items?.[0];
  if (scene) {
    scene.label = { en: [basename(newUrl)] };
    let modelPlaced = false;
    scene.items = (scene.items || []).map((page) => ({
      ...page,
      items: (page.items || []).filter((annotation) => {
        if (isModel(annotation)) {
          // The first model, as it comes; no transform of the old one.
          if (modelPlaced) return false;
          modelPlaced = true;
          const format = modelFormatOf(newUrl);
          annotation.body = { id: newUrl, type: "Model", ...(format ? { format } : {}) };
          return true;
        }
        // The default camera (the page's first) stays with keepCamera; the
        // cameras of saved views go with their annotations.
        if (isCamera(annotation)) return keepCamera && !/\/view$/.test(String(annotation.id || ""));
        return true;
      }),
    }));
    scene.annotations = (scene.annotations || []).map((page) => ({ ...page, items: [] }));
  }

  const block = result.AIM3DViewer;
  if (block && typeof block === "object") {
    block.generatedAt = new Date().toISOString();
    if (!keepCamera) delete block.camera;
    delete block.thumbnails;
    delete block.timeline;
    delete block.clipping;
    if (block.viewer) {
      delete block.viewer.clipping;
      // Where the viewer window stood on the page the settings came from.
      delete block.viewer.window;
    }
    if (block.modelTransform) {
      delete block.modelTransform.position;
      delete block.modelTransform.rotation;
      delete block.modelTransform.scale;
    }
  }
  return result;
}
