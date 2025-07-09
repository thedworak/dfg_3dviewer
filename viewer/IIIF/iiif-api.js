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

    filteredAnnos.forEach((modelAnnotation) => {
      if (modelAnnotation.getBody()[0].isSpecificResource) {
        let transforms = [];

        try {
          const body = modelAnnotation.getBody?.();
          const first = Array.isArray(body) ? body[0] : null;
          transforms = first?.getTransform?.() || [];
        } catch (e) {
          console.warn("Failed to read transform");
        }
        console.log(transforms);

        transforms.forEach((transform) => {
          if (!transform.isTransform) return;

          const transformHandlers = [
            {
              key: "isScaleTransform",
              action: () => {
                const scale = transform.getScale();
                if (scale) console.log("scaling");
              },
            },
            {
              key: "isRotateTransform",
              action: () => {
                console.log("rotating");
              },
            },
            {
              key: "isTranslateTransform",
              action: () => {
                const translation = transform.getTranslation();
                if (translation) console.log("translating");
              },
            },
          ];

          transformHandlers.forEach(({ key, action }) => {
            if (transform[key]) {
              action();
            }
          });
        });
      }
    });
  }
  return {
    manifest: iiifManifest.manifest,
    scenes: iiifManifest.scenes,
    annotations: filteredAnnos,
  };
}
