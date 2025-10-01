import {} from "@iiif/3d-manifesto-dev";
import { IIIFManifest } from "./iiif";

export async function loadIIIFManifest(manifestUrlOrJson) {
  let iiifManifest = new IIIFManifest(manifestUrlOrJson);
  await iiifManifest.loadManifest();
  let filteredAnnos;
  let i = 0;

  if (iiifManifest.scenes.length > 0) {
    //iiifManifest.scenes.forEach((scene) => { //TODO: support multiple scenes const manifestScene = scene;
    //if (!scene) return;
      // Root scene
      const manifestScene = iiifManifest.scenes[i];

      // Add scene BG color
      iiifManifest.scenes[i].background = await manifestScene.getBackgroundColor();

      // Load individual model annotations
      const annos = iiifManifest.annotationsFromScene(manifestScene);
      iiifManifest.modelUrls = new Array();

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
        const modelTarget = modelAnnotation.getTarget();
        if (modelUrl && modelTarget) {
          iiifManifest.modelUrls.push(modelUrl);
        }
      });
    //});
    i++;
  }
  return {
    manifest: iiifManifest.manifest,
    scenes: iiifManifest.scenes,
    annotations: filteredAnnos,
    modelUrls: iiifManifest.modelUrls
  };
}

export async function getAnnotations(iiifManifest, objectsConfig) {
  var ind = 0;
  await Promise.all(
    iiifManifest.annotations.map(async (modelAnnotation) => {
      console.log("Processing annotation", ind, "of", iiifManifest.annotations.length);
      if (modelAnnotation.getBody()[0].isSpecificResource) {
        let transforms = [];

        try {
          const body = modelAnnotation.getBody?.();
          const first = Array.isArray(body) ? body[0] : null;
          transforms = first?.getTransform?.() || [];
        } catch (e) {
          console.warn("Failed to read transform");
        }
        console.log("Transforms", transforms);
        // Correct use of async-safe loop
        for (const transform of transforms) {
          if (!transform.isTransform) continue;

          var transforms = new Array();

          const transformHandlers = [
            {
              key: "isScaleTransform",
              action: () => {
                const scale = transform.getScale();
                if (scale) {
                  console.log("scaling");
                  objectsConfig.models.push({scale: scale});
                }
                else objectsConfig.models[0].scale = { x: 1, y: 1, z: 1};
              },
            },
            {
              key: "isRotateTransform",
              action: () => {
                const rotation = transform.getRotation();
                if (rotation) {
                  console.log("rotating");
                  objectsConfig.models[0].rotation = rotation;
                }
                else objectsConfig.models[0].rotation = { x: 0, y: 0, z: 0};
              },
            },
            {
              key: "isTranslateTransform",
              action: () => {
                const translation = transform.getTranslation();
                if (translation) {
                  console.log("translating");
                  objectsConfig.models[0].position = translation;
                }
                else objectsConfig.models[0].position = { x: 0, y: 0, z: 0};
              },
            },
          ];

          for (const { key, action } of transformHandlers) {
            if (transform[key]) {
              console.log( "Applying transform:", key);
              action();
            }
          }
        }
      }
      ind++;
    })
  );

  return iiifManifest.annotations;
}
