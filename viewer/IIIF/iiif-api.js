import {} from "@iiif/3d-manifesto-dev";
import { IIIFManifest } from "./iiif";
import { isModelBody, modelTransformConfig } from "./presentation4.js";

// Annotation bodies are always parsed as plain AnnotationBody instances, where
// isSpecificResource is an inherited METHOD (checking the JSON "type"), even when
// the body's own JSON shape is "SpecificResource" wrapping a Model/Light/Camera.
// Annotation TARGETS shaped as SpecificResource, on the other hand, are parsed as
// actual SpecificResource instances, which shadow it with a boolean `true` OWN
// property instead. Reading `.isSpecificResource` without calling it would  be
// truthy in both cases regardless of the real answer, so this checks both shapes.
function resolvesToSpecificResource(value) {
  if (typeof value?.isSpecificResource === "function") return value.isSpecificResource();
  return value?.isSpecificResource === true;
}

// The models of one Scene of the manifest (`sceneIndex`, else the first); a
// manifest's Scenes are shown one at a time.
export async function loadIIIFManifest(manifestUrlOrJson, { sceneIndex = 0 } = {}) {
  let iiifManifest = new IIIFManifest(manifestUrlOrJson);
  await iiifManifest.loadManifest();
  let modelTarget;
  const modelTargets = [];
  const filteredAnnos = [];
  iiifManifest.modelUrls = new Array();

  // Every scene's background colour, so that it can be looked up by index
  // (getBackgroundColor() returns a Color instance; downstream code expects a
  // plain CSS hex string, same as the AIM3D loader).
  for (const scene of iiifManifest.scenes) {
    const backgroundColor = await scene.getBackgroundColor();
    scene.background = backgroundColor?.CSS ?? null;
  }

  const manifestScene = iiifManifest.scenes[sceneIndex] || iiifManifest.scenes[0];
  if (manifestScene) {
    const annos = iiifManifest.annotationsFromScene(manifestScene);

    // Models only: cameras and lights are painted into the scene too
    // (applied separately, IIIF/presentation4.js), possibly wrapped in a
    // SpecificResource as well.
    annos
      .filter((anno) => {
        const body = anno.getBody()[0];
        const rawBody = anno.__jsonld?.body;
        return (
          anno.getMotivation()?.[0] === "painting" &&
          (rawBody ? isModelBody(rawBody) : (resolvesToSpecificResource(body) || body?.getType() === "model"))
        );
      })
      .forEach((modelAnnotation) => {
        let modelUrl;
        if (resolvesToSpecificResource(modelAnnotation.getBody()[0])) {
          modelUrl = modelAnnotation.getBody()[0].getSource()?.id;
        } else {
          modelUrl = modelAnnotation.getBody()[0].id;
        }
        const target = modelAnnotation.getTarget();
        // annotations, modelUrls and modelTargets stay index-aligned.
        if (modelUrl && target) {
          modelTarget = target;
          filteredAnnos.push(modelAnnotation);
          iiifManifest.modelUrls.push(modelUrl);
          modelTargets.push(target);
        }
      });
  }
  return {
    manifest: iiifManifest.manifest,
    scenes: iiifManifest.scenes,
    annotations: filteredAnnos,
    modelUrls: iiifManifest.modelUrls,
    modelTarget: modelTarget,
    // One target per entry in modelUrls/annotations - a manifest can place
    // several models in the same scene, each with its own position selector.
    modelTargets,
  };
}

export async function getAnnotations(iiifManifest, objectsConfig) {
  let ind = objectsConfig.index || 0;
  const modelAnnotations = iiifManifest.annotations[ind];
  if (!modelAnnotations) return;

  const target = iiifManifest.annotations?.[ind];

  if (target == null) {
    // handle missing (out-of-range or undefined)
    throw new Error(`No annotation at index ${ind}`);
  }

  // make sure we have an array to map over
  const items = Array.isArray(target) ? target : [target];

  await Promise.all(
    items.map(async (modelAnnotation) => {       
        // The body's transform list, composed in the order listed (a
        // SpecificResource around the model); read from the JSON, since the
        // parsed transforms lose their order and repeats.
        const rawBody = Array.isArray(modelAnnotation.__jsonld?.body)
          ? modelAnnotation.__jsonld.body[0]
          : modelAnnotation.__jsonld?.body;
        if (rawBody?.type === "SpecificResource" && Array.isArray(rawBody.transform)) {
          Object.assign(objectsConfig.models[ind], modelTransformConfig(rawBody.transform));
        }

        // Position model within target scene if position selector present.
        // Each model annotation carries its own target, so index into
        // modelTargets rather than reusing whichever one loaded last.
        const currentTarget = iiifManifest.modelTargets?.[ind] ?? iiifManifest.modelTarget;
        if (resolvesToSpecificResource(currentTarget)) {
          const selector = currentTarget.getSelector();
          if (selector && selector.isPointSelector) {
            const position = selector.getLocation();
            if (position) {
              objectsConfig.models[ind].position.x += position.x;
              objectsConfig.models[ind].position.y += position.y;
              objectsConfig.models[ind].position.z += position.z;
            }
          }
        }
        }));
  
  return iiifManifest.annotations;
}
