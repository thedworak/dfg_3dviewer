import THREE from "../init.js";
import { core } from "../core.js";
import { renderFrame } from "../rendering.js";
import { apiUrl, appRequestHeaders, remoteAssetUrl } from "../remote.js";
import { toastHelper } from "../viewer-utils.js";

const BUILD = (typeof __BUILD__ !== "undefined") ? __BUILD__ : "";

// Drupal: ThumbnailUploadController (dfg_3dviewer.routing.yml), which writes
// next to any model in the site's files. Docker/standalone and the app: the
// worker (worker/server.py), which only has the models uploaded to it.
const DRUPAL_ENDPOINT = "/api/editor/upload-thumbnail";
const WORKER_ENDPOINT = "/api/model/thumbnail";

// The worker's job id from a model folder URL (/files/<job>/...), or null.
function workerJobId(path) {
  try {
    const match = new URL(path, window.location.origin).pathname.match(/^\/files\/([A-Za-z0-9_-]+)\//);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function thumbnailUploadUrl() {
  if (BUILD === "drupal") {
    const base = (core.CONFIG?.mainUrl || window.location.origin || "").replace(/\/+$/, "");
    const configured = String(core.CONFIG?.api?.thumbnailUploadEndpoint || DRUPAL_ENDPOINT).trim();
    try {
      return new URL(configured || DRUPAL_ENDPOINT, `${base}/`).toString();
    } catch (_error) {
      console.warn("Invalid api.thumbnailUploadEndpoint, using default", configured);
      return `${base}${DRUPAL_ENDPOINT}`;
    }
  }
  // The page's own /api/ (nginx or the dev server passes it to the worker),
  // the repository in the app.
  return apiUrl(WORKER_ENDPOINT);
}

// After saving: the model's gallery and its row in the browse panel show the
// new image instead of the placeholders.
async function refreshWorkerThumbnails(viewer, jobId) {
  try {
    const response = await fetch(apiUrl("/api/jobs"), { cache: "no-store", headers: appRequestHeaders() });
    if (!response.ok) return;
    const job = ((await response.json()).jobs || []).find((entry) => entry.id === jobId);
    const galleryCfg = core.CONFIG?.viewer?.gallery;
    if (job?.imageUrls?.length && (galleryCfg?.build === true || galleryCfg?.buildFake === true) &&
        !core.SANDBOX_MODE && !viewer.isEmbedMode?.()) {
      viewer.renderModelGalleryImages(job.imageUrls.map(remoteAssetUrl));
    }
  } catch {
    // Only a refresh - the image is saved either way.
  }
  if (viewer.modelsPanel?.hidden === false) viewer.loadModelsList?.();
}

// The views scripts/render.py (Blender) renders for an uploaded model, named
// <model>_<view>.png in its views/ folder. side45 is the main thumbnail.
const SIDE_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
const ALL_VIEWS = [...SIDE_ANGLES.map((angle) => `side${angle}`), "top"];
const CAPTURE_SIZE = 1024;

// Square captures at CAPTURE_SIZE, the live canvas size restored afterwards.
function withCaptureCanvas(capture) {
  core.camera.aspect = 1;
  core.camera.updateProjectionMatrix();
  core.renderer.setSize(CAPTURE_SIZE, CAPTURE_SIZE);
  try {
    return capture();
  } finally {
    core.renderer.setPixelRatio(devicePixelRatio);
    core.camera.aspect = core.CONFIG.viewer.canvasDimensions.x / core.CONFIG.viewer.canvasDimensions.y;
    core.camera.updateProjectionMatrix();
    core.renderer.setSize(core.CONFIG.viewer.canvasDimensions.x, core.CONFIG.viewer.canvasDimensions.y);
  }
}

// Renders the current camera view and snapshots the canvas. toBlob copies
// the canvas when called, so it has to run in the same task as the render.
function renderToBlob(viewer) {
  // Through the post-processing chain when it is on, like the live canvas.
  renderFrame();
  return new Promise((resolve, reject) => {
    viewer.mainCanvas.toBlob((blob) => {
      if (blob instanceof Blob && blob.size > 0 && blob.type === "image/png") resolve(blob);
      else reject(new Error("Failed to capture the canvas"));
    }, "image/png");
  });
}

async function uploadThumbnail(blob, view = "side45") {
  const fileform = new FormData();
  fileform.append("path", core.fileObject.path);
  fileform.append("filename", core.fileObject.basename);
  fileform.append("view", view);
  fileform.append("data", blob, "thumbnail.png");
  if (BUILD === "drupal") {
    console.log("Uploading thumbnail for entity ID:", core.CONFIG.entity.id);
    fileform.append("wisski_individual", core.CONFIG.entity.id);
  }
  const callUrl = thumbnailUploadUrl();
  console.log("Preparing call for ", callUrl);

  const res = await fetch(callUrl, {
    method: "POST",
    credentials: "same-origin",
    // Drupal's CSRF token; the worker does not allow the header (CORS).
    headers: BUILD === "drupal" ? { "X-CSRF-Token": window.CSRF_TOKEN } : appRequestHeaders(),
    body: fileform,
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    // Non-JSON error page (e.g. from a proxy) - the status says enough.
  }
  if (!res.ok) throw new Error(data.error || `Upload failed (HTTP ${res.status})`);
  console.log("Thumbnail uploaded:", data.message || data);
  return data;
}

// The worker's job of the model on screen, or null after telling the user
// why its thumbnails cannot be changed: only uploaded models (not the
// bundled examples or a file opened from this device), and with accounts on
// only by their owner or an admin. The worker enforces the latter too (403,
// can_delete_job); asking first spares rendering views it would reject.
async function requireWorkerJob() {
  const jobId = workerJobId(core.fileObject.path);
  if (!jobId) {
    toastHelper("previewNotUploaded", "info");
    return null;
  }
  try {
    const response = await fetch(apiUrl("/api/jobs"), { cache: "no-store", headers: appRequestHeaders() });
    if (response.ok) {
      const job = ((await response.json()).jobs || []).find((entry) => entry.id === jobId);
      if (job?.canDelete === false) {
        toastHelper("thumbnailsNotOwner", "warning");
        return null;
      }
    }
  } catch {
    // Unknown here - the worker decides on upload.
  }
  return jobId;
}

// "Change main thumbnail": the current view as <model>_side45.png.
export async function captureAndUploadThumbnail(viewer) {
  const jobId = BUILD === "drupal" ? null : await requireWorkerJob();
  if (BUILD !== "drupal" && !jobId) return;

  let capture;
  try {
    capture = withCaptureCanvas(() => renderToBlob(viewer));
  } catch (error) {
    capture = Promise.reject(error);
  }
  capture
    .then((blob) => uploadThumbnail(blob, "side45"))
    .then(() => {
      toastHelper("previewSaved", "success");
      if (jobId) refreshWorkerThumbnails(viewer, jobId);
    })
    .catch((error) => {
      console.error("Thumbnail upload failed:", error);
      toastHelper("previewSaveError", "error");
    });
}

// Where the camera goes for one of ALL_VIEWS, framing the model's box like
// render.py: level with its centre, angle 0 in front (+Z, glTF's front),
// turning counter-clockwise seen from above; "top" straight down.
function placeCaptureCamera(view, box) {
  const camera = core.camera;
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  let direction;
  let halfWidth;
  let halfHeight;
  let halfDepth;
  if (view === "top") {
    direction = new THREE.Vector3(0, 1, 0);
    halfWidth = size.x / 2;
    halfHeight = size.z / 2;
    halfDepth = size.y / 2;
    camera.up.set(0, 0, -1);
  } else {
    const angle = THREE.MathUtils.degToRad(Number(view.slice(4)));
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    direction = new THREE.Vector3(sin, 0, cos);
    halfWidth = Math.abs(size.x / 2 * cos) + Math.abs(size.z / 2 * sin);
    halfHeight = size.y / 2;
    halfDepth = Math.abs(size.x / 2 * sin) + Math.abs(size.z / 2 * cos);
    camera.up.set(0, 1, 0);
  }
  const margin = 1.15;
  let distance;
  if (camera.isPerspectiveCamera) {
    const tanY = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const tanX = tanY * camera.aspect;
    distance = Math.max(halfWidth / tanX, halfHeight / tanY) * margin + halfDepth;
  } else {
    distance = halfDepth * 2 + Math.max(size.x, size.y, size.z);
    const frustumWidth = (camera.right - camera.left);
    const frustumHeight = (camera.top - camera.bottom);
    camera.zoom = Math.min(frustumWidth / (halfWidth * 2), frustumHeight / (halfHeight * 2)) / margin;
  }
  camera.position.copy(center).addScaledVector(direction, Math.max(distance, 0.01));
  camera.lookAt(center);
  camera.near = Math.min(camera.near, distance / 100);
  camera.far = Math.max(camera.far, distance + halfDepth * 4);
  camera.updateProjectionMatrix();
}

function modelBox() {
  const roots = (Array.isArray(core.mainObject) ? core.mainObject : [core.mainObject])
    .filter((object) => object?.isObject3D);
  const box = new THREE.Box3();
  roots.forEach((object) => box.expandByObject(object, true));
  if (box.isEmpty() && core.boundingSphere) core.boundingSphere.getBoundingBox(box);
  return box;
}

let generatingThumbnails = false;

// "Generate thumbnails": all of ALL_VIEWS from the model as it is shown now
// (materials, lighting, background), replacing the Blender renders.
export async function generateAllThumbnails(viewer) {
  if (generatingThumbnails) return;
  generatingThumbnails = true;
  try {
    const jobId = await requireWorkerJob();
    if (jobId) await renderAndUploadAllViews(viewer, jobId);
  } finally {
    generatingThumbnails = false;
  }
}

async function renderAndUploadAllViews(viewer, jobId) {
  const box = modelBox();
  if (box.isEmpty()) {
    toastHelper("previewSaveError", "error");
    return;
  }

  toastHelper("thumbnailsGenerating", "info");
  const camera = core.camera;
  const saved = {
    position: camera.position.clone(),
    quaternion: camera.quaternion.clone(),
    up: camera.up.clone(),
    zoom: camera.zoom,
    near: camera.near,
    far: camera.far,
    target: core.controls?.target?.clone(),
  };
  try {
    let captures;
    try {
      captures = withCaptureCanvas(() =>
        ALL_VIEWS.map((view) => {
          placeCaptureCamera(view, box);
          return renderToBlob(viewer).then((blob) => ({ view, blob }));
        })
      );
    } finally {
      camera.position.copy(saved.position);
      camera.quaternion.copy(saved.quaternion);
      camera.up.copy(saved.up);
      camera.zoom = saved.zoom;
      camera.near = saved.near;
      camera.far = saved.far;
      camera.updateProjectionMatrix();
      if (saved.target) core.controls.target.copy(saved.target);
      core.controls?.update?.();
      renderFrame();
    }
    for (const { view, blob } of await Promise.all(captures)) {
      await uploadThumbnail(blob, view);
    }
    toastHelper("thumbnailsGenerated", "success");
    refreshWorkerThumbnails(viewer, jobId);
  } catch (error) {
    console.error("Generating thumbnails failed:", error);
    toastHelper("previewSaveError", "error");
  }
}
