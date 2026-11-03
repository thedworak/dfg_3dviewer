import THREE from "../init.js";
import { core } from "../core.js";
import { isLightBackground } from "../background-luminance.js";

// Where each scene camera stands, as in Blender's viewport: while the
// cameras window (cameras-panel.js) is open, every camera
// (scene-cameras.js) is drawn as Blender draws one - a pyramid from where it
// stands to the frame it sees, with a filled triangle over the frame's top
// edge showing which way is up - and a dashed line to where it looks. The
// chosen one is gold (orange on a light background), the others white
// (black on a light background); the one the view is looking through
// is not drawn (the view is inside it). The icons keep their size on screen
// and show through the model. A click on one chooses that camera.

// The pyramid's depth on screen, in CSS pixels.
const MARKER_PX = 60;
const GOLD = 0xe9b264;
const ORANGE = 0xd9780f;
const WHITE = 0xffffff;
const BLACK = 0x161616;
// Frames between two looks at the background's luminance.
const BACKGROUND_EVERY = 30;
const ORDER = 999;

const worldPosition = new THREE.Vector3();
const projected = new THREE.Vector3();
const middle = new THREE.Vector3();

// A unit camera looking along +Z (Object3D.lookAt turns +Z to the target):
// apex at the origin, its frame at z = 1, half as high as `halfHeight`.
function frustumPoints(halfWidth, halfHeight) {
  const corners = [
    [-halfWidth, -halfHeight], [halfWidth, -halfHeight],
    [halfWidth, halfHeight], [-halfWidth, halfHeight],
  ].map(([x, y]) => new THREE.Vector3(x, y, 1));
  const apex = new THREE.Vector3();
  const lines = [];
  corners.forEach((corner, index) => {
    lines.push(apex, corner, corner, corners[(index + 1) % 4]);
  });
  return lines;
}

function triangleGeometry(halfWidth, halfHeight) {
  const gap = halfHeight * 0.12;
  const base = halfWidth * 0.6;
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-base, halfHeight + gap, 1),
    new THREE.Vector3(base, halfHeight + gap, 1),
    new THREE.Vector3(0, halfHeight + gap + base * 0.85, 1),
  ]);
  geometry.setIndex([0, 1, 2]);
  return geometry;
}

const overlay = (material) => Object.assign(material, { transparent: true, depthTest: false, depthWrite: false });

function makeMarker() {
  const group = new THREE.Group();
  const frustum = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    overlay(new THREE.LineBasicMaterial({ color: WHITE, opacity: 0.9 })),
  );
  const triangle = new THREE.Mesh(
    new THREE.BufferGeometry(),
    overlay(new THREE.MeshBasicMaterial({ color: WHITE, opacity: 0.9, side: THREE.DoubleSide })),
  );
  group.add(frustum, triangle);
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    overlay(new THREE.LineDashedMaterial({ color: WHITE, opacity: 0.7 })),
  );
  [frustum, triangle, line].forEach((object) => {
    object.renderOrder = ORDER;
    object.frustumCulled = false;
    // Chosen by a click on the screen (cameraAt), never by the scene's
    // raycasts (picking, measuring).
    object.raycast = () => {};
  });
  return { group, frustum, triangle, line, shape: "" };
}

// The pyramid and triangle for this lens and the viewer's aspect.
function shapeMarker(marker, camera, aspect) {
  const halfHeight = camera.type === "OrthographicCamera"
    ? 0.45
    : Math.tan(THREE.MathUtils.degToRad(THREE.MathUtils.clamp(camera.fov ?? 45, 5, 120) / 2));
  const halfWidth = halfHeight * aspect;
  const shape = `${halfWidth.toFixed(4)}|${halfHeight.toFixed(4)}`;
  if (marker.shape === shape) return;
  marker.shape = shape;
  marker.frustum.geometry.dispose();
  marker.frustum.geometry = new THREE.BufferGeometry().setFromPoints(frustumPoints(halfWidth, halfHeight));
  marker.triangle.geometry.dispose();
  marker.triangle.geometry = triangleGeometry(halfWidth, halfHeight);
}

// World units one CSS pixel covers at `position`, for the camera.
function worldPerPixel(camera, position, viewportHeight) {
  if (camera.isOrthographicCamera) return (camera.top - camera.bottom) / camera.zoom / viewportHeight;
  const distance = camera.position.distanceTo(position);
  return (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * distance) / (camera.zoom || 1) / viewportHeight;
}

export function attachCameraMarkers(Viewer) {
  const markers = new Map();
  let root = null;
  let bound = false;
  let pressed = null;
  let frame = 0;
  let lightBackground = false;

  const remove = (camera) => {
    const marker = markers.get(camera);
    if (!marker) return;
    marker.group.removeFromParent();
    marker.line.removeFromParent();
    [marker.frustum, marker.triangle, marker.line].forEach((object) => {
      object.geometry.dispose();
      object.material.dispose();
    });
    markers.delete(camera);
  };

  // The camera whose icon is under the pointer: near where it stands or
  // the middle of its pyramid.
  const cameraAt = (event) => {
    const canvas = core.renderer?.domElement;
    const view = core.camera;
    if (!root?.visible || !canvas || !view) return null;
    const rect = canvas.getBoundingClientRect();
    let best = null;
    let bestDistance = MARKER_PX * 0.6;
    const screenDistance = (point) => {
      projected.copy(point).project(view);
      if (projected.z > 1) return Infinity;
      const x = rect.left + ((projected.x + 1) / 2) * rect.width;
      const y = rect.top + ((1 - projected.y) / 2) * rect.height;
      return Math.hypot(event.clientX - x, event.clientY - y);
    };
    markers.forEach((marker, camera) => {
      if (!marker.group.visible) return;
      middle.set(0, 0, 0.5).applyMatrix4(marker.group.matrixWorld);
      const distance = Math.min(screenDistance(marker.group.position), screenDistance(middle));
      if (distance < bestDistance) {
        best = camera;
        bestDistance = distance;
      }
    });
    return best;
  };

  // Before the camera controls, the handles and picking (capture, on the
  // canvas): a click on another camera's icon chooses it.
  const bindPicking = () => {
    const canvas = core.renderer?.domElement;
    if (bound || !canvas) return;
    bound = true;
    Viewer.bindEventListener(canvas, "pointerdown", (event) => {
      pressed = null;
      if (!event.isPrimary || event.button !== 0) return;
      const camera = cameraAt(event);
      if (!camera || camera === Viewer.getActiveSceneCamera()) return;
      pressed = { camera, x: event.clientX, y: event.clientY };
      event.stopImmediatePropagation();
      event.preventDefault();
    }, { capture: true });
    Viewer.bindEventListener(canvas, "pointerup", (event) => {
      const press = pressed;
      pressed = null;
      if (!press) return;
      event.stopImmediatePropagation();
      if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > 8) return;
      Viewer.selectSceneCamera(press.camera);
    }, { capture: true });
  };

  Object.assign(Viewer, {
    // Every frame (main.js animate): the icons where the cameras are.
    updateCameraMarkers() {
      if (!core.scene || !core.camera) return;
      const visible = Viewer.isCamerasPanelOpen?.() === true;
      if (!visible) {
        if (root) root.visible = false;
        return;
      }
      if (!root) {
        root = new THREE.Group();
        root.name = "camera-markers";
        root.userData.isEditorHelper = true;
      }
      if (root.parent !== core.scene) core.scene.add(root);
      root.visible = true;
      bindPicking();

      const cameras = Viewer.getSceneCameras();
      [...markers.keys()].forEach((camera) => {
        if (!cameras.includes(camera)) remove(camera);
      });
      if (frame++ % BACKGROUND_EVERY === 0) lightBackground = isLightBackground();
      const active = Viewer.getActiveSceneCamera();
      const canvas = core.renderer?.domElement;
      const height = canvas?.clientHeight || 1;
      const aspect = canvas?.clientWidth && canvas?.clientHeight ? canvas.clientWidth / canvas.clientHeight : 1.5;
      const radius = core.lightBounds?.radius ?? 1;
      cameras.forEach((camera) => {
        let marker = markers.get(camera);
        if (!marker) {
          marker = makeMarker();
          markers.set(camera, marker);
          root.add(marker.group, marker.line);
        }
        const inside = Viewer.isViewingSceneCamera(camera);
        marker.group.visible = !inside;
        marker.line.visible = !inside;
        if (inside) return;
        const selected = camera === active;
        const color = selected ? (lightBackground ? ORANGE : GOLD) : (lightBackground ? BLACK : WHITE);
        shapeMarker(marker, camera, aspect);
        worldPosition.copy(camera.position);
        marker.group.position.copy(worldPosition);
        if (camera.target.distanceToSquared(worldPosition) > 1e-12) marker.group.lookAt(camera.target);
        const size = MARKER_PX * worldPerPixel(core.camera, worldPosition, height);
        marker.group.scale.setScalar(size);
        marker.group.updateMatrixWorld(true);
        marker.frustum.material.color.set(color);
        marker.triangle.material.color.set(color);
        marker.frustum.material.opacity = selected ? 1 : 0.8;
        marker.triangle.material.opacity = selected ? 1 : 0.8;

        // To where it looks.
        const positions = marker.line.geometry.attributes.position;
        positions.setXYZ(0, worldPosition.x, worldPosition.y, worldPosition.z);
        positions.setXYZ(1, camera.target.x, camera.target.y, camera.target.z);
        positions.needsUpdate = true;
        marker.line.computeLineDistances();
        marker.line.material.color.set(color);
        marker.line.material.opacity = selected ? 0.8 : 0.4;
        marker.line.material.dashSize = radius * 0.06;
        marker.line.material.gapSize = radius * 0.04;
      });
    },
  });
}
