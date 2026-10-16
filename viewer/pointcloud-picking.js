import THREE from "./init.js";
import { PICKING_PASS } from "./pointcloud-material.js";

// GPU picking of point clouds: the point under the cursor, exactly as drawn.
//
// The clouds are drawn once more into a float target, only in a small square
// around the cursor (scissor), with every point writing its object id and
// index instead of its colour (the picking pass of pointcloud-material.js).
// Reading those few pixels back gives the nearest visible point: its size
// and shape, the profile slab, hidden classes and clipping planes all count,
// as they do on screen. A raycast instead tests every point of the cloud on
// the CPU (tens of ms for millions) against a fixed distance in world units.
//
// Clouds take part once their material has the colour modes
// (preparePointCloudMaterial / addColorModes); setPointRaycastSkipped then
// keeps the CPU raycast off them while the GPU picks.

const PICK_RADIUS_CSS_PX = 6;

let target = null;
let supported = null;
const clearColor = new THREE.Color();
const group = new THREE.Group();
group.matrixWorldAutoUpdate = false;
let skipPointRaycast = false;

// Points take no part in a raycast while the picking module picks them.
export function setPointRaycastSkipped(points) {
  if (points.userData.gpuPicked) return;
  points.userData.gpuPicked = true;
  points.raycast = function raycast(raycaster, intersects) {
    if (skipPointRaycast) return;
    THREE.Points.prototype.raycast.call(this, raycaster, intersects);
  };
}

export function isGpuPickingSupported(renderer) {
  if (supported === null) {
    supported = Boolean(renderer?.isWebGLRenderer && renderer.capabilities?.isWebGL2
      && renderer.extensions?.has?.("EXT_color_buffer_float"));
  }
  return supported;
}

function collectPickablePoints(roots) {
  const points = [];
  roots.forEach((root) => root?.traverseVisible?.((child) => {
    if (child.isPoints && child.material?.userData?.colorModes && child.material.uniforms?.uPickId) {
      points.push(child);
    }
  }));
  return points;
}

// Runs a raycast with the GPU-picked clouds left out (they are picked here).
export function withoutPointRaycast(callback) {
  skipPointRaycast = true;
  try {
    return callback();
  } finally {
    skipPointRaycast = false;
  }
}

// The point of the clouds under roots nearest the cursor (ndc: -1..1, as for
// a Raycaster), or null if there is none there; undefined when the renderer
// cannot pick on the GPU (then raycast). Returns a Raycaster-like hit:
// { point (world), object, index, distance, isPointCloudHit }.
export function pickPointCloud({ renderer, camera, roots, ndc }) {
  if (!isGpuPickingSupported(renderer)) return undefined;
  const points = collectPickablePoints(roots);
  if (!points.length) return null;

  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  if (!target) {
    target = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.FloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    });
  } else if (target.width !== size.x || target.height !== size.y) {
    target.setSize(size.x, size.y);
  }

  const radius = Math.max(1, Math.round(PICK_RADIUS_CSS_PX * renderer.getPixelRatio()));
  const cx = Math.round(((ndc.x + 1) / 2) * size.x);
  const cy = Math.round(((ndc.y + 1) / 2) * size.y);
  const x0 = Math.max(0, cx - radius);
  const y0 = Math.max(0, cy - radius);
  const width = Math.min(size.x, cx + radius + 1) - x0;
  const height = Math.min(size.y, cy + radius + 1) - y0;
  if (width <= 0 || height <= 0) return null;

  points.forEach((object, index) => {
    object.material.uniforms.uPickId.value = index + 1;
  });

  const previousTarget = renderer.getRenderTarget();
  const previousAlpha = renderer.getClearAlpha();
  const previousXr = renderer.xr?.enabled;
  renderer.getClearColor(clearColor);
  const pixels = new Float32Array(width * height * 4);
  PICKING_PASS.value = true;
  group.children.length = 0;
  group.children.push(...points);
  try {
    if (renderer.xr) renderer.xr.enabled = false;
    target.scissor.set(x0, y0, width, height);
    target.scissorTest = true;
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(group, camera);
    renderer.readRenderTargetPixels(target, x0, y0, width, height, pixels);
  } finally {
    group.children.length = 0;
    PICKING_PASS.value = false;
    if (renderer.xr) renderer.xr.enabled = previousXr;
    renderer.setRenderTarget(previousTarget);
    renderer.setClearColor(clearColor, previousAlpha);
  }

  // The nearest written pixel to the cursor.
  let best = -1;
  let bestDistance = Infinity;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      if (pixels[offset] < 0.5) continue;
      const distance = (x0 + x - cx) ** 2 + (y0 + y - cy) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = offset;
      }
    }
  }
  if (best < 0) return null;

  const object = points[Math.round(pixels[best]) - 1];
  const index = Math.round(pixels[best + 1]) * 65536 + Math.round(pixels[best + 2]);
  const position = object?.geometry.getAttribute("position");
  if (!position || index >= position.count) return null;
  const point = new THREE.Vector3().fromBufferAttribute(position, index).applyMatrix4(object.matrixWorld);
  return {
    point,
    object,
    index,
    distance: camera.position.distanceTo(point),
    isPointCloudHit: true,
  };
}
