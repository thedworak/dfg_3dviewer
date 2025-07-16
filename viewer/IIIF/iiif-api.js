import {} from "@iiif/3d-manifesto-dev";
import { IIIFManifest } from "./iiif";

export async function loadIIIFManifest(manifestUrlOrJson) {
  let iiifManifest = new IIIFManifest(manifestUrlOrJson);
  await iiifManifest.loadManifest();
  let filteredAnnos;

  if (iiifManifest.scenes.length > 0) {
    iiifManifest.scenes.forEach((scene) => {
      // Root scene
      const manifestScene = scene;

      // Load individual model annotations
      const annos = iiifManifest.annotationsFromScene(manifestScene);

      filteredAnnos = annos.filter((anno) => {
        const body = anno.getBody()[0];
        return (
          anno.getMotivation()?.[0] === "painting" &&
          (body.isSpecificResource || body?.getType() === "model")
        );
      });
    });
  }
  return {
    manifest: iiifManifest.manifest,
    scenes: iiifManifest.scenes,
    annotations: filteredAnnos,
  };
}

export async function getAnnotations(filteredAnnos, CONFIG) {
  await Promise.all(
    filteredAnnos.map(async (modelAnnotation) => {
      if (modelAnnotation.getBody()[0].isSpecificResource) {
        let transforms = [];

        try {
          const body = modelAnnotation.getBody?.();
          const first = Array.isArray(body) ? body[0] : null;
          transforms = first?.getTransform?.() || [];
        } catch (e) {
          console.warn("Failed to read transform");
        }

        // ✅ Correct use of async-safe loop
        for (const transform of transforms) {
          if (!transform.isTransform) continue;

          const transformHandlers = [
            {
              key: "isScaleTransform",
              action: () => {
                const scale = transform.getScale();
                if (scale) {
                  console.log("scaling");
                  CONFIG.model.scale = scale;
                }
              },
            },
            {
              key: "isRotateTransform",
              action: () => {
                const rotation = transform.getRotation();
                if (rotation) {
                  console.log("rotating");
                  CONFIG.model.rotation = rotation;
                }
              },
            },
            {
              key: "isTranslateTransform",
              action: () => {
                const translation = transform.getTranslation();
                if (translation) {
                  console.log("translating");
                  CONFIG.model.position = translation;
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
    })
  );

  return filteredAnnos;
}
