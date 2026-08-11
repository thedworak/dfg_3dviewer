import { AIM3DManifest } from "./manifesto";
import { formatAIM3DManifestValidationErrors, validateAIM3DManifest } from "./aim3dviewer-validation.js";

export async function loadAIM3IFManifest(manifestUrlOrJson) {
  const aim3dManifest = new AIM3DManifest(manifestUrlOrJson);

  await aim3dManifest.loadManifest();

  const validation = validateAIM3DManifest(aim3dManifest.manifest);
  if (!validation.valid) {
    const detail = formatAIM3DManifestValidationErrors(validation.errors);
    throw new Error(`Invalid AIM3D manifest.\n${detail}`);
  }

  const modelUrls = [];
  let modelTarget = null;
  let filteredAnnos = [];

  for (const scene of aim3dManifest.scenes) {
    scene.background =
      scene.backgroundColor ||
      "#000000";

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
}