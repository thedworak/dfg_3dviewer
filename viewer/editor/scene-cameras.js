import THREE from "../init.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { applyCamera, stopCameraIntro } from "../IIIF/presentation4.js";

// The scene's cameras, as the lights are the scene's lights
// (scene-lights.js): several saved views of the model - each with where it
// stands, where it looks and its lens - brought by a manifest (IIIF
// Presentation 4 PerspectiveCamera / OrthographicCamera painting
// annotations) or added in the cameras window (cameras-panel.js) from the
// current view. One of them is chosen; the view switches between them,
// flying from one to the next. They go out with the exported manifest, the
// first one as the scene's start view, and away with the model.
//
// Like a light, the chosen camera has handles (TransformControls) while the
// cameras window is open: "position" moves where it stands, "target" where
// it looks; the fields and its icon (camera-markers.js) follow the drag.
//
// A camera here is a plain record:
//   { id, label, type, position: Vector3, target: Vector3,
//     fov, viewHeight, near, far }

export const SCENE_CAMERA_TYPES = ["PerspectiveCamera", "OrthographicCamera"];
// What the handles move: where the camera stands, or where it looks.
export const SCENE_CAMERA_HANDLES = ["position", "target"];
// How long the view flies to a camera.
const FLIGHT_MS = 900;
const FOV_RANGE = [5, 120];

const CAMERA_TYPE_LABELS = {
  PerspectiveCamera: ["gui.cameraTypePerspective", "Perspective"],
  OrthographicCamera: ["gui.cameraTypeOrthographic", "Orthographic"],
};

export function cameraTypeLabel(type) {
  const [key, fallback] = CAMERA_TYPE_LABELS[type] || [type, type];
  return t(key, fallback);
}

const finite = (value) => (Number.isFinite(Number(value)) && value !== null && value !== "" ? Number(value) : null);
const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - ((-2 * x + 2) ** 3) / 2);

// Middle of the loaded models, for a camera with a direction but no lookAt.
function modelCenter() {
  const box = new THREE.Box3();
  (core.mainObject || []).flat().forEach((object) => {
    if (object?.isObject3D) box.expandByObject(object);
  });
  return box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3());
}

// A camera of the manifest (presentation4.js readSceneContent) as a record.
export function sceneCameraFromManifest(camera) {
  if (!camera?.position) return null;
  const position = camera.position.clone();
  const target = camera.lookAt?.clone?.()
    || position.clone().addScaledVector(
      camera.direction ?? new THREE.Vector3(0, 0, -1),
      Math.max(position.distanceTo(modelCenter()), 1e-3),
    );
  return {
    id: camera.annotationId || camera.id || null,
    label: camera.label || "",
    type: camera.type === "OrthographicCamera" ? "OrthographicCamera" : "PerspectiveCamera",
    position,
    target,
    fov: finite(camera.fieldOfView),
    viewHeight: finite(camera.viewHeight),
    near: finite(camera.near),
    far: finite(camera.far),
  };
}

// The current view as a record.
export function sceneCameraFromView(label = "") {
  const camera = core.camera;
  if (!camera || !core.controls) return null;
  const ortho = camera.isOrthographicCamera === true;
  return {
    id: null,
    label,
    type: ortho ? "OrthographicCamera" : "PerspectiveCamera",
    position: camera.position.clone(),
    target: core.controls.target.clone(),
    fov: ortho ? null : camera.fov,
    viewHeight: ortho ? (camera.top - camera.bottom) / (camera.zoom || 1) : null,
    near: null,
    far: null,
  };
}

// What applyCamera (presentation4.js) takes.
function applicable(record) {
  return {
    type: record.type,
    position: record.position.clone(),
    lookAt: record.target.clone(),
    direction: record.target.clone().sub(record.position).normalize(),
    fieldOfView: record.fov ?? NaN,
    viewHeight: record.viewHeight ?? NaN,
    near: record.near ?? NaN,
    far: record.far ?? NaN,
  };
}

export function attachSceneCameras(Viewer) {
  let flight = null;
  let controlsBound = false;
  // The handles: one TransformControls on a stand-in at the chosen
  // camera's position or target, made the first time they are used.
  let handles = null;
  let handleMode = "";
  const handle = new THREE.Object3D();
  handle.name = "scene-camera-handle";
  handle.userData.isEditorHelper = true;

  const ensureHandles = () => {
    if (!core.scene || !core.camera || !core.renderer || core.PRESENTATION_MODE) return null;
    if (!handles) {
      handles = new TransformControls(core.camera, core.renderer.domElement);
      handles.space = "world";
      handles.setMode("translate");
      handles.addEventListener("change", () => Viewer.render?.());
      handles.addEventListener("dragging-changed", (event) => {
        if (core.controls) core.controls.enabled = !event.value;
      });
      handles.addEventListener("objectChange", () => {
        const camera = Viewer.getActiveSceneCamera();
        if (!camera || !handleMode) return;
        camera[handleMode].copy(handle.position);
        Viewer.syncCamerasPanel?.();
      });
      core.transformControlSceneCamera = handles;
    }
    // The scene may be a new one since (another model).
    if (handle.parent !== core.scene) core.scene.add(handle);
    if (handles.getHelper().parent !== core.scene) core.scene.add(handles.getHelper());
    // And the view's camera (perspective / orthographic).
    handles.camera = core.camera;
    return handles;
  };

  // The handles on the chosen camera, while the window is open.
  const placeHandles = () => {
    const camera = Viewer.getActiveSceneCamera();
    if (!handleMode || !camera || Viewer.isCamerasPanelOpen?.() !== true) {
      handles?.detach();
      return;
    }
    if (!ensureHandles()) return;
    if (!handles.dragging) {
      handle.position.copy(camera[handleMode]);
      handle.updateMatrixWorld(true);
    }
    if (handles.object !== handle) handles.attach(handle);
  };

  // A drag of the view ends a flight.
  const bindControls = () => {
    if (controlsBound || !core.controls?.addEventListener) return;
    controlsBound = true;
    core.controls.addEventListener("start", () => {
      if (flight) flight = null;
    });
  };

  const refresh = () => {
    placeHandles();
    Viewer.syncCamerasPanel?.();
    Viewer.updateManifestCameraSwitch?.();
    Viewer.updateEditorToolbarState?.();
  };

  Object.assign(Viewer, {
    sceneCameras: [],
    activeSceneCamera: null,

    // "position", "target" or "" (no handles).
    getSceneCameraHandles() {
      return handleMode;
    },

    setSceneCameraHandles(mode = "") {
      handleMode = SCENE_CAMERA_HANDLES.includes(mode) ? mode : "";
      placeHandles();
      Viewer.syncCamerasPanel?.();
    },

    toggleSceneCameraHandles(mode) {
      Viewer.setSceneCameraHandles(handleMode === mode ? "" : mode);
    },

    getSceneCameras() {
      return Viewer.sceneCameras;
    },

    getActiveSceneCamera() {
      const camera = Viewer.activeSceneCamera;
      return camera && Viewer.sceneCameras.includes(camera) ? camera : Viewer.sceneCameras[0] ?? null;
    },

    // Its own name, or (`named` false, or none given) "Camera n".
    getSceneCameraLabel(camera, { named = true } = {}) {
      if (!camera) return "";
      if (named && camera.label) return String(camera.label);
      const index = Viewer.sceneCameras.indexOf(camera);
      return t("manifesto.cameraNumber", { number: index + 1 }, "Camera {number}");
    },

    // The manifest's cameras (main.js, after a manifest is read); `active`
    // is the one shown first.
    setSceneCameras(cameras = [], active = null) {
      flight = null;
      handleMode = "";
      Viewer.sceneCameras = cameras.map(sceneCameraFromManifest).filter(Boolean);
      const index = active ? cameras.indexOf(active) : -1;
      Viewer.activeSceneCamera = Viewer.sceneCameras[Math.max(index, 0)] ?? null;
      refresh();
    },

    clearSceneCameras() {
      flight = null;
      handleMode = "";
      Viewer.sceneCameras = [];
      Viewer.activeSceneCamera = null;
      refresh();
    },

    // Chooses a camera without moving the view.
    selectSceneCamera(camera) {
      if (!Viewer.sceneCameras.includes(camera)) return;
      Viewer.activeSceneCamera = camera;
      refresh();
    },

    // Whether the view is the camera's (where it stands, where it looks).
    isViewingSceneCamera(camera) {
      if (!camera || !core.camera || !core.controls || flight) return false;
      const scale = Math.max(camera.position.distanceTo(camera.target), 1e-6) * 1e-3;
      return core.camera.position.distanceTo(camera.position) <= scale
        && core.controls.target.distanceTo(camera.target) <= scale;
    },

    // Chooses the camera and looks through it - flying there, unless its
    // projection differs from the view's or `animate` is false.
    viewSceneCamera(camera = Viewer.getActiveSceneCamera(), { animate = true } = {}) {
      if (!camera || !core.camera || !core.controls) return false;
      Viewer.activeSceneCamera = camera;
      bindControls();
      const sameProjection = (camera.type === "OrthographicCamera") === (core.camera.isOrthographicCamera === true);
      if (!animate || !sameProjection || window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
        flight = null;
        applyCamera(applicable(camera), Viewer);
        refresh();
        return true;
      }
      stopCameraIntro();
      const fromFov = core.camera.isPerspectiveCamera ? core.camera.fov : null;
      flight = {
        camera,
        start: performance.now(),
        fromPosition: core.camera.position.clone(),
        fromTarget: core.controls.target.clone(),
        fromFov,
        toFov: fromFov != null && camera.fov != null
          ? THREE.MathUtils.clamp(camera.fov, FOV_RANGE[0], FOV_RANGE[1])
          : fromFov,
      };
      // The far plane reaches the camera's position from the start.
      const distance = camera.position.distanceTo(camera.target);
      if (core.controls.maxDistance < distance * 2) core.controls.maxDistance = distance * 2;
      refresh();
      return true;
    },

    // The previous (-1) or next (+1) camera, round the list, looked through.
    stepSceneCamera(step = 1) {
      const cameras = Viewer.sceneCameras;
      if (!cameras.length) return null;
      const index = cameras.indexOf(Viewer.getActiveSceneCamera());
      const next = cameras[(index + step + cameras.length) % cameras.length];
      Viewer.viewSceneCamera(next);
      return next;
    },

    // Every frame (main.js animate): the view on its way to a camera.
    updateSceneCameraFlight(time = performance.now()) {
      if (!flight || !core.camera || !core.controls) return;
      const progress = Math.min(1, (time - flight.start) / FLIGHT_MS);
      const eased = easeInOutCubic(Math.max(0, progress));
      const { camera } = flight;
      core.camera.position.lerpVectors(flight.fromPosition, camera.position, eased);
      core.controls.target.lerpVectors(flight.fromTarget, camera.target, eased);
      if (flight.fromFov != null && flight.toFov != null && flight.fromFov !== flight.toFov) {
        core.camera.fov = THREE.MathUtils.lerp(flight.fromFov, flight.toFov, eased);
        core.camera.updateProjectionMatrix();
      }
      core.cameraLight?.position?.copy?.(core.camera.position);
      core.controls.update();
      if (progress >= 1) {
        flight = null;
        // Exactly the camera: its lens, near and far; "Reset camera" too.
        applyCamera(applicable(camera), Viewer);
        Viewer.syncCamerasPanel?.();
      }
    },

    // A camera where the view is now, chosen.
    addSceneCameraFromView() {
      const camera = sceneCameraFromView();
      if (!camera) return null;
      Viewer.sceneCameras.push(camera);
      Viewer.activeSceneCamera = camera;
      refresh();
      return camera;
    },

    // The chosen camera moved to the current view (its name stays).
    updateSceneCameraFromView(camera = Viewer.getActiveSceneCamera()) {
      const view = sceneCameraFromView();
      if (!camera || !view) return false;
      Object.assign(camera, { ...view, id: camera.id, label: camera.label });
      refresh();
      return true;
    },

    removeActiveSceneCamera() {
      const camera = Viewer.getActiveSceneCamera();
      const index = Viewer.sceneCameras.indexOf(camera);
      if (index < 0) return false;
      if (flight?.camera === camera) flight = null;
      Viewer.sceneCameras.splice(index, 1);
      Viewer.activeSceneCamera = Viewer.sceneCameras[Math.min(index, Viewer.sceneCameras.length - 1)] ?? null;
      refresh();
      return true;
    },

    // First in the list: the scene's start view in the exported manifest.
    makeStartSceneCamera(camera = Viewer.getActiveSceneCamera()) {
      const index = Viewer.sceneCameras.indexOf(camera);
      if (index <= 0) return false;
      Viewer.sceneCameras.splice(index, 1);
      Viewer.sceneCameras.unshift(camera);
      refresh();
      return true;
    },

    // One property of the chosen camera, from the window; if the view is
    // the camera's, the view follows.
    setSceneCameraProperty(key, value) {
      const camera = Viewer.getActiveSceneCamera();
      if (!camera) return;
      const viewing = Viewer.isViewingSceneCamera(camera);
      if (key === "label") {
        camera.label = String(value ?? "");
      } else if (key === "type" && SCENE_CAMERA_TYPES.includes(value)) {
        camera.type = value;
        if (value === "OrthographicCamera" && camera.viewHeight == null) {
          const fov = THREE.MathUtils.degToRad(camera.fov ?? core.camera?.fov ?? 45);
          camera.viewHeight = 2 * Math.tan(fov / 2) * camera.position.distanceTo(camera.target);
        }
        if (value === "PerspectiveCamera" && camera.fov == null) camera.fov = core.camera?.fov ?? 45;
      } else if (key === "fov" && Number.isFinite(Number(value))) {
        camera.fov = THREE.MathUtils.clamp(Number(value), FOV_RANGE[0], FOV_RANGE[1]);
      } else if ((key === "position" || key === "target") && Array.isArray(value) && value.every(Number.isFinite)) {
        camera[key].fromArray(value);
      } else {
        return;
      }
      if (viewing && key !== "label") applyCamera(applicable(camera), Viewer);
      refresh();
    },
  });
}
