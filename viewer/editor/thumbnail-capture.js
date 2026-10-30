import THREE from "../init.js";
import { core } from "../core.js";
import { getModuleAssetBasePath } from "../loaders.js";
import { isAIM3DManifest } from "../manifesto/aim3dviewer-validation.js";
import { renderFrame } from "../rendering.js";
import { apiUrl, appRequestHeaders, remoteAssetUrl } from "../remote.js";
import { renderManifestGalleryImages } from "../ui/thumbnail-gallery.js";
import { toastHelper } from "../viewer-utils.js";
import { workerJobId } from "../worker-model.js";

const BUILD = (typeof __BUILD__ !== "undefined") ? __BUILD__ : "";

// Drupal: ThumbnailUploadController (dfg_3dviewer.routing.yml), which writes
// next to any model in the site's files. Docker/standalone and the app: the
// worker (worker/server.py), which only has the models uploaded to it.
const DRUPAL_ENDPOINT = "/api/editor/upload-thumbnail";
const WORKER_ENDPOINT = "/api/model/thumbnail";

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
  // Only a refresh - the image is saved either way.
  const job = await fetchJob(jobId);
  if (job?.imageUrls?.length && showsGallery(viewer)) {
    viewer.renderModelGalleryImages(job.imageUrls.map(remoteAssetUrl));
  }
  if (viewer.modelsPanel?.hidden === false) viewer.loadModelsList?.();
}

function showsGallery(viewer) {
  const galleryCfg = core.CONFIG?.viewer?.gallery;
  return (galleryCfg?.build === true || galleryCfg?.buildFake === true) && !core.SANDBOX_MODE && !viewer.isEmbedMode?.();
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
    core.renderer.setPixelRatio(window.Viewer?.getRenderPixelRatio?.() ?? devicePixelRatio);
    core.camera.aspect = core.CONFIG.viewer.canvasDimensions.x / core.CONFIG.viewer.canvasDimensions.y;
    core.camera.updateProjectionMatrix();
    core.renderer.setSize(core.CONFIG.viewer.canvasDimensions.x, core.CONFIG.viewer.canvasDimensions.y);
  }
}

// Every render carries a small ExPlora4D logo in its bottom right corner:
// WATERMARK_WIDTH of the image's width, WATERMARK_MARGIN from its edges (as
// scripts/render.py does for the Blender renders).
const WATERMARK_WIDTH = 0.1;
const WATERMARK_MARGIN = 0.02;
const WATERMARK_OPACITY = 0.8;
let watermarkImage = null;

// Loaded before the views are rendered: they are drawn synchronously.
function loadWatermark() {
  watermarkImage ??= new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    // Without the logo the renders still go out.
    image.onerror = () => resolve(null);
    image.src = `${getModuleAssetBasePath()}/img/logo/ExPlora4D.webp`;
  });
  return watermarkImage;
}

// A copy of `source` (the rendered canvas) with the logo. drawImage copies
// the WebGL canvas when called, so it has to run in the same task as the
// render.
function withWatermark(source, logo) {
  if (!logo?.naturalWidth) return source;
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext("2d");
  context.drawImage(source, 0, 0);
  const width = Math.round(canvas.width * WATERMARK_WIDTH);
  const height = Math.round(width * logo.naturalHeight / logo.naturalWidth);
  const margin = Math.round(canvas.width * WATERMARK_MARGIN);
  context.globalAlpha = WATERMARK_OPACITY;
  context.drawImage(logo, canvas.width - width - margin, canvas.height - height - margin, width, height);
  return canvas;
}

function canvasToPng(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob instanceof Blob && blob.size > 0 && blob.type === "image/png") resolve(blob);
      else reject(new Error("Failed to capture the canvas"));
    }, "image/png");
  });
}

// Renders the current camera view and snapshots it, with the logo
// (loadWatermark).
function renderToBlob(viewer, logo) {
  // WebGPU: drawn into a target and read back (rendering-webgpu.js); the
  // drawing is queued now, at the capture size, the reading follows.
  if (core.rendererBackend === "webgpu" && core.webgpuRendering) {
    const { width, height } = core.renderer.domElement;
    return core.webgpuRendering.captureWebGPUFrame(core.renderer, width, height)
      .then((canvas) => canvasToPng(withWatermark(canvas, logo)));
  }
  // Through the post-processing chain when it is on, like the live canvas.
  renderFrame();
  return canvasToPng(withWatermark(viewer.mainCanvas, logo));
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

// The views of one of the viewer's own AIM3D manifests (manifests/<name>.json,
// bundled with it): rendered here, sent to the worker with the manifest
// (worker/manifests.py), which keeps both - the viewer loads its copy
// from then on (main.js getManifestJson). Answers the updated manifest.
async function uploadManifestThumbnails(name, manifest, captures) {
  const fileform = new FormData();
  fileform.append("manifest", JSON.stringify(manifest));
  fileform.append("baseUrl", new URL(apiUrl(`/api/manifests/${name}/`), window.location.href).href);
  captures.forEach(({ view, blob }) => fileform.append(view, blob, `${view}.png`));
  const res = await fetch(apiUrl(`/api/manifests/${name}/thumbnails`), {
    method: "POST",
    credentials: "same-origin",
    headers: appRequestHeaders(),
    body: fileform,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.manifest) throw new Error(data.error || `Upload failed (HTTP ${res.status})`);
  return data.manifest;
}

// The name of the viewer's own manifest at `url` (manifests/<name>.json
// next to the page), else null.
export function bundledManifestName(url) {
  if (typeof url !== "string" || !url) return null;
  try {
    const base = new URL("manifests/", document.baseURI).href;
    const { href } = new URL(url, document.baseURI);
    const match = href.startsWith(base) && href.slice(base.length).match(/^([A-Za-z0-9][A-Za-z0-9_.-]*)\.json$/);
    return match && match[1] !== "index" ? match[1] : null;
  } catch {
    return null;
  }
}

// Where the thumbnails of what is on screen go: Drupal's entity, the
// AIM3D manifest shown (one of the viewer's own), the worker's job of the
// model, or nowhere (null).
function thumbnailTarget(viewer) {
  if (BUILD === "drupal") return { kind: "drupal" };
  const manifest = viewer.currentManifest;
  const name = manifest?.type === "url" && isAIM3DManifest(manifest.json) ? bundledManifestName(manifest.source) : null;
  if (name) return { kind: "manifest", name };
  const jobId = workerJobId(core.fileObject.path);
  return jobId ? { kind: "job", jobId } : null;
}

async function fetchJob(jobId) {
  try {
    const response = await fetch(apiUrl("/api/jobs"), { cache: "no-store", headers: appRequestHeaders() });
    if (!response.ok) return null;
    return ((await response.json()).jobs || []).find((entry) => entry.id === jobId) || null;
  } catch {
    return null;
  }
}

let accessCheck = 0;

// Whether the thumbnail buttons can be used (viewer.thumbnailAccess, read
// by editor-toolbar.js updateEditorToolbarState): a manifest's thumbnails
// by admins, a model's by its owner or an admin (or anyone on a worker
// without accounts), Drupal's by whom Drupal lets in; never by default.
// Called when a model is shown and when the account changes.
export async function refreshThumbnailAccess(viewer) {
  const check = ++accessCheck;
  const target = thumbnailTarget(viewer);
  let allowed = false;
  if (target?.kind === "drupal") allowed = true;
  else if (target?.kind === "manifest") allowed = viewer.isAdminUser?.() === true;
  else if (target?.kind === "job") allowed = (await fetchJob(target.jobId))?.canDelete === true;
  if (check !== accessCheck) return;
  viewer.thumbnailAccess = allowed;
  viewer.updateEditorToolbarState?.();
  viewer.syncPublishSteps?.();
}

// The target of a click, or null after telling the user why its
// thumbnails cannot be changed: only uploaded models (not the bundled
// examples or a file opened from this device) and the viewer's own
// manifests. The worker checks who may too (403); asking first spares
// rendering views it would reject.
async function requireTarget(viewer) {
  const target = thumbnailTarget(viewer);
  if (!target) {
    toastHelper("previewNotUploaded", "info");
    return null;
  }
  if (target.kind === "manifest" && viewer.isAdminUser?.() !== true) {
    toastHelper("thumbnailsAdminOnly", "warning");
    return null;
  }
  if (target.kind === "job" && (await fetchJob(target.jobId))?.canDelete === false) {
    toastHelper("thumbnailsNotOwner", "warning");
    return null;
  }
  return target;
}

// The manifest's views sent with the manifest as stored (the bundled one, or
// the worker's copy with earlier thumbnails - not the copy on screen, which
// loading may have changed), then shown in its gallery.
async function saveManifestThumbnails(viewer, name, captures) {
  const manifest = await uploadManifestThumbnails(name, await viewer.getManifestJson(viewer.currentManifest.source, "url"), captures);
  viewer.currentManifest.json = manifest;
  if (showsGallery(viewer)) renderManifestGalleryImages(viewer, manifest.AIM3DViewer?.thumbnails);
}

// "Change main thumbnail": the current view as <model>_side45.png.
export async function captureAndUploadThumbnail(viewer) {
  const target = await requireTarget(viewer);
  if (!target) return;
  const logo = await loadWatermark();

  let capture;
  try {
    capture = withCaptureCanvas(() => renderToBlob(viewer, logo));
  } catch (error) {
    capture = Promise.reject(error);
  }
  capture
    .then(async (blob) => {
      if (target.kind === "manifest") {
        await saveManifestThumbnails(viewer, target.name, [{ view: "side45", blob }]);
      } else {
        await uploadThumbnail(blob, "side45");
        if (target.kind === "job") refreshWorkerThumbnails(viewer, target.jobId);
      }
      toastHelper("previewSaved", "success");
    })
    .catch((error) => {
      console.error("Thumbnail upload failed:", error);
      toastHelper("previewSaveError", "error");
    });
}

// Where the camera goes for one of ALL_VIEWS, framing the model's box like
// render.py: level with its centre, angle 0 in front, turning
// counter-clockwise seen from above; "top" straight down, the front below.
// The front is +Z (glTF's) turned by `front` degrees: the side the start
// view looks from (editor/publish-check.js getThumbnailFrontAngle).
function placeCaptureCamera(view, box, front = 0) {
  const camera = core.camera;
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  let direction;
  let halfWidth;
  let halfHeight;
  let halfDepth;
  if (view === "top") {
    const toFront = THREE.MathUtils.degToRad(front);
    const sin = Math.sin(toFront);
    const cos = Math.cos(toFront);
    direction = new THREE.Vector3(0, 1, 0);
    halfWidth = Math.abs(size.x / 2 * cos) + Math.abs(size.z / 2 * sin);
    halfHeight = Math.abs(size.x / 2 * sin) + Math.abs(size.z / 2 * cos);
    halfDepth = size.y / 2;
    camera.up.set(-sin, 0, -cos);
  } else {
    const angle = THREE.MathUtils.degToRad(Number(view.slice(4)) + front);
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
    const target = await requireTarget(viewer);
    if (target) await renderAndUploadAllViews(viewer, target);
  } finally {
    generatingThumbnails = false;
  }
}

async function renderAndUploadAllViews(viewer, target) {
  const box = modelBox();
  if (box.isEmpty()) {
    toastHelper("previewSaveError", "error");
    return;
  }
  const logo = await loadWatermark();

  toastHelper("thumbnailsGenerating", "info");
  const front = viewer.getThumbnailFrontAngle?.(box) ?? 0;
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
          placeCaptureCamera(view, box, front);
          return renderToBlob(viewer, logo).then((blob) => ({ view, blob }));
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
    const views = await Promise.all(captures);
    if (target.kind === "manifest") {
      await saveManifestThumbnails(viewer, target.name, views);
    } else {
      for (const { view, blob } of views) {
        await uploadThumbnail(blob, view);
      }
      refreshWorkerThumbnails(viewer, target.jobId);
    }
    toastHelper("thumbnailsGenerated", "success");
  } catch (error) {
    console.error("Generating thumbnails failed:", error);
    toastHelper("previewSaveError", "error");
  }
}
