import { core } from "../core.js";

export function captureAndUploadThumbnail(viewer) {
  core.camera.aspect = 1;
  core.camera.updateProjectionMatrix();
  core.renderer.setSize(256, 256);
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

    fetch(core.CONFIG.mainUrl + "/api/editor/upload-thumbnail", {
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
      return data;
    });
  }, "image/png");

  core.renderer.setPixelRatio(devicePixelRatio);
  core.camera.aspect = core.CONFIG.viewer.canvasDimensions.x / core.CONFIG.viewer.canvasDimensions.y;
  core.camera.updateProjectionMatrix();
  core.renderer.setSize(core.CONFIG.viewer.canvasDimensions.x, core.CONFIG.viewer.canvasDimensions.y);
}
