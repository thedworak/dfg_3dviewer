import { core } from "../core.js";

const BUILD = (typeof __BUILD__ !== "undefined") ? __BUILD__ : "";

export function captureAndUploadThumbnail(viewer) {
  core.camera.aspect = 1;
  core.camera.updateProjectionMatrix();
  core.renderer.setSize(1024, 1024);
  core.renderer.render(core.scene, core.camera);

  viewer.mainCanvas.toBlob((imgBlob) => {
    if (!imgBlob) {
      console.error("Failed to capture screenshot");
      return;
    }

    if (!(imgBlob instanceof Blob) || imgBlob.size === 0) {
      console.error("Invalid blob data");
      return;
    }

    if (!["image/png", "image/jpeg"].includes(imgBlob.type)) {
      console.error("Invalid blob type:", imgBlob.type);
      return;
    }

    const fileform = new FormData();
    fileform.append("path", core.fileObject.path);
    fileform.append("filename", core.fileObject.basename);
    fileform.append("data", imgBlob, "thumbnail.png");
    console.log("Uploading thumbnail for entity ID:", core.CONFIG.entity.id);
    fileform.append("wisski_individual", core.CONFIG.entity.id);
    // Standalone (Docker, localhost): the page's own /api/, which nginx or
    // the dev server passes to the worker - mainUrl there is the WissKI
    // instance the metadata comes from, not this viewer's backend.
    const base = ((BUILD === "drupal" && core.CONFIG?.mainUrl) || window.location.origin || "").replace(/\/+$/, "");
    const defaultEndpoint = "/api/editor/upload-thumbnail";
    const configuredEndpoint = String(core.CONFIG?.api?.thumbnailUploadEndpoint || defaultEndpoint).trim();
    let callUrl = `${base}${defaultEndpoint}`;

    try {
      callUrl = new URL(configuredEndpoint || defaultEndpoint, `${base}/`).toString();
    } catch (_error) {
      console.warn("Invalid api.thumbnailUploadEndpoint, using default", configuredEndpoint);
    }

    console.log("Preparing call for ", callUrl);

    fetch(callUrl, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "X-CSRF-Token": window.CSRF_TOKEN
      },
      body: fileform
    })
    .then(async (res) => {
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error || "Upload failed");
      console.log("Thumbnail uploaded:", data.message || data);
      return data;
    })
    .catch((error) => console.error("Thumbnail upload failed:", error));
  }, "image/png");

  core.renderer.setPixelRatio(devicePixelRatio);
  core.camera.aspect = core.CONFIG.viewer.canvasDimensions.x / core.CONFIG.viewer.canvasDimensions.y;
  core.camera.updateProjectionMatrix();
  core.renderer.setSize(core.CONFIG.viewer.canvasDimensions.x, core.CONFIG.viewer.canvasDimensions.y);
}
