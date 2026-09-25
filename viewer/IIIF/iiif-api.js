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

export async function loadIIIFManifest(manifestUrlOrJson) {
  let iiifManifest = new IIIFManifest(manifestUrlOrJson);
  await iiifManifest.loadManifest();
  let modelTarget;
  const modelTargets = [];
  let filteredAnnos;
  let i = 0;
  iiifManifest.modelUrls = new Array();

  if (iiifManifest.scenes.length > 0) {
    for (const [i, scene] of iiifManifest.scenes.entries()) { //TODO: support multiple scenes const manifestScene = scene;
    //if (!scene) return;
      // Root scene
      const manifestScene = iiifManifest.scenes[i];

      // Add scene BG color (getBackgroundColor() returns a Color instance;
      // downstream code expects a plain CSS hex string, same as the AIM3D loader)
      const backgroundColor = await manifestScene.getBackgroundColor();
      iiifManifest.scenes[i].background = backgroundColor?.CSS ?? null;

      // Load individual model annotations
      const annos = iiifManifest.annotationsFromScene(manifestScene);

      // Models only: cameras and lights are painted into the scene too
      // (applied separately, IIIF/presentation4.js), possibly wrapped in a
      // SpecificResource as well.
      filteredAnnos = annos.filter((anno) => {
        const body = anno.getBody()[0];
        const rawBody = anno.__jsonld?.body;
        return (
          anno.getMotivation()?.[0] === "painting" &&
          (rawBody ? isModelBody(rawBody) : (resolvesToSpecificResource(body) || body?.getType() === "model"))
        );
      });

      filteredAnnos.forEach((modelAnnotation) => {
        let modelUrl;
        if (resolvesToSpecificResource(modelAnnotation.getBody()[0])) {
          modelUrl = modelAnnotation.getBody()[0].getSource()?.id;
        } else {
          modelUrl = modelAnnotation.getBody()[0].id;
        }
        modelTarget = modelAnnotation.getTarget();
        if (modelUrl && modelTarget) {
          iiifManifest.modelUrls.push(modelUrl);
          modelTargets.push(modelTarget);
        }
      });
    }
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
