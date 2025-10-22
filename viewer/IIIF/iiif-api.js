import {} from "@iiif/3d-manifesto-dev";
import { IIIFManifest } from "./iiif";

export async function loadIIIFManifest(manifestUrlOrJson) {
  let iiifManifest = new IIIFManifest(manifestUrlOrJson);
  await iiifManifest.loadManifest();
  let modelTarget;
  let filteredAnnos;
  let i = 0;
  iiifManifest.modelUrls = new Array();

  console.log(iiifManifest);

  if (iiifManifest.scenes.length > 0) {
    for (const [i, scene] of iiifManifest.scenes.entries()) { //TODO: support multiple scenes const manifestScene = scene;
    //if (!scene) return;
      // Root scene
      const manifestScene = iiifManifest.scenes[i];

      // Add scene BG color
      iiifManifest.scenes[i].background = await manifestScene.getBackgroundColor();

      // Load individual model annotations
      const annos = iiifManifest.annotationsFromScene(manifestScene);

      filteredAnnos = annos.filter((anno) => {
        const body = anno.getBody()[0];
        return (
          anno.getMotivation()?.[0] === "painting" &&
          (body.isSpecificResource || body?.getType() === "model")
        );
      });

      filteredAnnos.forEach((modelAnnotation) => {
        let modelUrl;
        if (modelAnnotation.getBody()[0].isSpecificResource) {
          modelUrl = modelAnnotation.getBody()[0].getSource()?.id;
        } else {
          modelUrl = modelAnnotation.getBody()[0].id;
        }
        modelTarget = modelAnnotation.getTarget();
        //console.log("Model URL:", modelUrl, " Model Target:", modelTarget);
        if (modelUrl && modelTarget) {
          iiifManifest.modelUrls.push(modelUrl);
        }
      });
    }
  }
  return {
    manifest: iiifManifest.manifest,
    scenes: iiifManifest.scenes,
    annotations: filteredAnnos,
    modelUrls: iiifManifest.modelUrls,
    modelTarget: modelTarget
  };
}

export async function getAnnotations(iiifManifest, objectsConfig) {
  let ind = objectsConfig.index || 0;
  console.log("Getting annotations for model index:", ind);
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
        console.log("Processing annotation", ind + 1, "of", iiifManifest.annotations.length);
        if (modelAnnotation.getBody()[0].isSpecificResource) {
          let transforms = new Array();

          try {
            const body = modelAnnotation.getBody?.();
            console.log("Model body:", body);
            const first = Array.isArray(body) ? body[0] : null;
            transforms = first?.getTransform?.() || [];
          } catch (e) {
            // No transforms present so keep defaults
            //objectsConfig.models[ind].scale = {x: 1, y: 1, z: 1};
            //objectsConfig.models[ind].rotation = {x: 0, y: 0, z: 0};
            //objectsConfig.models[ind].position = {x: 0, y: 0, z: 0};
            console.warn("Failed to read transform");
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
                    //console.log("scaling");
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
                    //console.log("rotating");
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
                    //console.log("translating");
                    objectsConfig.models[ind].position = translation;
                  }
                  else { 
                    objectsConfig.models[ind].position = {x: 0, y: 0, z: 0};
                    console.log("No position defined in translate transform");
                  }
                },
              },
            ];

            for (const { key, action } of transformHandlers) {
              if (transform[key]) {
                //console.log( "Applying transform:", key);
                action();
              }
            }
          }
        }

        // Position model within target scene if position selector present
        if (iiifManifest.modelTarget.isSpecificResource == true) {
          const selector = iiifManifest.modelTarget.getSelector();
          if (selector && selector.isPointSelector) {
            const position = selector.getLocation();
            console.log(objectsConfig.models[ind].position, position, selector);
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
