import {} from "@iiif/3d-manifesto-dev";
import { IIIFManifest } from "./iiif";
import { matrixTransformConfig, scenePlacements } from "./presentation4.js";

// The models of one Scene of the manifest (`sceneIndex`, else its first); a
// manifest's Scenes are shown one at a time. Models come from the manifest
// JSON (scenePlacements): with their whole transform, including those of
// Scenes nested in the one shown.
export async function loadIIIFManifest(manifestUrlOrJson, { sceneIndex } = {}) {
  let iiifManifest = new IIIFManifest(manifestUrlOrJson);
  await iiifManifest.loadManifest();

  // Every scene's background colour, so that it can be looked up by index
  // (getBackgroundColor() returns a Color instance; downstream code expects a
  // plain CSS hex string, same as the AIM3D loader).
  for (const scene of iiifManifest.scenes) {
    const backgroundColor = await scene.getBackgroundColor();
    scene.background = backgroundColor?.CSS ?? null;
  }

  const manifestJson = manifestUrlOrJson && typeof manifestUrlOrJson === "object"
    ? manifestUrlOrJson
    : iiifManifest.manifest?.__jsonld;
  const placements = scenePlacements(manifestJson, sceneIndex);
  iiifManifest.modelUrls = placements.models.map((placement) => placement.url);

  return {
    manifest: iiifManifest.manifest,
    scenes: iiifManifest.scenes,
    // annotations, modelUrls and placements.models are index-aligned.
    annotations: placements.models.map((placement) => placement.annotation),
    modelUrls: iiifManifest.modelUrls,
    placements,
  };
}

// Position, rotation and scale of the model being loaded (objectsConfig.index)
// from its placement in the scene.
export async function getAnnotations(iiifManifest, objectsConfig) {
  const ind = objectsConfig.index || 0;
  const placement = iiifManifest.placements?.models?.[ind];
  if (!placement) return;
  Object.assign(objectsConfig.models[ind], matrixTransformConfig(placement.matrix));
  return iiifManifest.annotations;
}
