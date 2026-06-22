export class AIM3DManifest {
  constructor(manifest) {
    if (typeof manifest === "string" && manifest.trim().startsWith("{")) {
      this.manifestJson = JSON.parse(manifest);
      this.manifestUrl = null;
    } else if (typeof manifest === "object") {
      this.manifestJson = manifest;
      this.manifestUrl = null;
    } else {
      this.manifestUrl = manifest;
      this.manifestJson = null;
    }
  }

  async loadManifest() {
    if (this.manifestUrl) {
      const response = await fetch(this.manifestUrl);
      this.manifestJson = await response.json();
    }

    this.manifest = this.manifestJson;

    this.scenes = this.manifest?.items?.filter(
      item => item.type === "Scene"
    ) || [];
  }

  annotationsFromScene(scene) {
    const result = [];

    for (const page of scene?.items || []) {
      if (page.type !== "AnnotationPage") continue;

      for (const annotation of page.items || []) {
        result.push(annotation);
      }
    }

    return result;
  }
}