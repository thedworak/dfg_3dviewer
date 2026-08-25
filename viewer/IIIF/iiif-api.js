import {} from "@iiif/3d-manifesto-dev";
import { IIIFManifest } from "./iiif";

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

      filteredAnnos = annos.filter((anno) => {
        const body = anno.getBody()[0];
        return (
          anno.getMotivation()?.[0] === "painting" &&
          (resolvesToSpecificResource(body) || body?.getType() === "model")
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
        if (resolvesToSpecificResource(modelAnnotation.getBody()[0])) {
          let transforms = new Array();

          try {
            const body = modelAnnotation.getBody?.();
            const first = Array.isArray(body) ? body[0] : null;
            transforms = first?.getTransform?.() || [];
          } catch (e) {
            // No transforms present so keep defaults
            //objectsConfig.models[ind].scale = {x: 1, y: 1, z: 1};
            //objectsConfig.models[ind].rotation = {x: 0, y: 0, z: 0};
            //objectsConfig.models[ind].position = {x: 0, y: 0, z: 0};
            //console.log("No transform present in specific resource body");
          }
          // Correct use of async-safe loop
          for (const transform of transforms) {
            if (!transform.isTransform) continue;

            const transformHandlers = [
              {
                key: "isScaleTransform",
                action: () => {
                  const scale = transform.getScale();
                  if (scale) {
                    objectsConfig.models[ind].scale = scale;
                  }
                  else {
                    objectsConfig.models[ind].scale = {x: 1, y: 1, z: 1};
                    console.log("No scale defined in scale transform");
                  }
                },
              },
              {
                key: "isRotateTransform",
                action: () => {
                  const rotation = transform.getRotation();
                  if (rotation) {
                    objectsConfig.models[ind].rotation = rotation;
                  }
                  else { 
                    objectsConfig.models[ind].rotation = {x: 0, y: 0, z: 0};
                    console.log("No rotation defined in rotate transform");
                  }
                },
              },
              {
                key: "isTranslateTransform",
                action: () => {
                  const translation = transform.getTranslation();
                  if (translation) {
                    objectsConfig.models[ind].position = translation;
                  }
                  else { 
                    objectsConfig.models[ind].position = {x: 0, y: 0, z: 0};
                  }
                },
              },
            ];

            for (const { key, action } of transformHandlers) {
              if (transform[key]) {
                action();
              }
            }
          }
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
