import { c as core } from './main.js';
import { LAZPerfLoader } from '@loaders.gl/las';
import { T as THREE } from './three.js';

// Direct loading of LAS / LAZ point clouds (no server conversion), e.g. for
// drag and drop in the sandbox. Parsed on the main thread with loaders.gl's
// laz-perf build (WebAssembly embedded in the bundle, nothing fetched), so
// very large clouds are thinned to viewer.pointCloud.maxPoints (default 5
// million) - for full-resolution streaming, convert them to 3D Tiles with the
// worker (worker/pointcloud.py).
//
// Loaded dynamically by loaders.js, so this module (and laz-perf) is only
// downloaded when a LAS/LAZ file is opened.

const DEFAULT_MAX_POINTS = 5_000_000;
const DEFAULT_POINT_SIZE = 2;

// Number of point records from the LAS header (1.0-1.4).
function readLasPointCount(buffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 227 || String.fromCharCode(...new Uint8Array(buffer, 0, 4)) !== "LASF") {
    throw new Error("Not a LAS/LAZ file (missing LASF signature)");
  }
  const minor = view.getUint8(25);
  const legacyCount = view.getUint32(107, true);
  if (minor >= 4 && view.byteLength >= 255) {
    const count = Number(view.getBigUint64(247, true));
    if (count > 0) return count;
  }
  return legacyCount;
}

function getPointCloudOptions() {
  const config = core.CONFIG?.viewer?.pointCloud || {};
  const maxPoints = Number(config.maxPoints);
  const pointSize = Number(config.pointSize);
  return {
    maxPoints: Number.isFinite(maxPoints) && maxPoints > 0 ? maxPoints : DEFAULT_MAX_POINTS,
    pointSize: Number.isFinite(pointSize) && pointSize > 0 ? pointSize : DEFAULT_POINT_SIZE,
  };
}

// Colour per point: RGB when the file has it, otherwise intensity, otherwise
// a height ramp, so a cloud without colours is still readable.
function buildColors(attributes, positions, count) {
  const colors = new Uint8Array(count * 3);
  const rgba = attributes.COLOR_0?.value;
  if (rgba && rgba.length >= count * 4) {
    let anyColor = false;
    for (let i = 0; i < count; i += 1) {
      colors[i * 3] = rgba[i * 4];
      colors[i * 3 + 1] = rgba[i * 4 + 1];
      colors[i * 3 + 2] = rgba[i * 4 + 2];
      anyColor = anyColor || rgba[i * 4] || rgba[i * 4 + 1] || rgba[i * 4 + 2];
    }
    if (anyColor) return { colors, mode: "rgb" };
  }

  const intensity = attributes.intensity?.value;
  if (intensity && intensity.length >= count) {
    let max = 0;
    for (let i = 0; i < count; i += 1) max = Math.max(max, intensity[i]);
    if (max > 0) {
      for (let i = 0; i < count; i += 1) {
        const value = Math.round(40 + (intensity[i] / max) * 215);
        colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = value;
      }
      return { colors, mode: "intensity" };
    }
  }

  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < count; i += 1) {
    minZ = Math.min(minZ, positions[i * 3 + 2]);
    maxZ = Math.max(maxZ, positions[i * 3 + 2]);
  }
  const range = maxZ - minZ || 1;
  const color = new THREE.Color();
  for (let i = 0; i < count; i += 1) {
    const t = (positions[i * 3 + 2] - minZ) / range;
    // Blue (low) through green to red (high).
    color.setHSL((1 - t) * 0.66, 0.85, 0.5);
    colors[i * 3] = Math.round(color.r * 255);
    colors[i * 3 + 1] = Math.round(color.g * 255);
    colors[i * 3 + 2] = Math.round(color.b * 255);
  }
  return { colors, mode: "height" };
}

// Parses a LAS/LAZ buffer into a model root: a Group (left at the origin for
// the viewer to place) holding the Points, re-centred and turned from the
// Z-up LAS convention to Y-up.
function buildLasPointCloud(buffer, name = "Point cloud") {
  const { maxPoints, pointSize } = getPointCloudOptions();
  const totalPoints = readLasPointCount(buffer);
  const skip = Math.max(1, Math.ceil(totalPoints / maxPoints));

  // fp64: UTM/national grid coordinates (hundreds of km) do not survive
  // Float32; they are re-centred in double precision below.
  const mesh = LAZPerfLoader.parseSync(buffer, { las: { fp64: true, skip, colorDepth: "auto" }, worker: false });
  const source = mesh.attributes.POSITION.value;
  const count = Math.floor(source.length / 3);
  if (count === 0) throw new Error("The point cloud contains no points.");

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < count; i += 1) {
    for (let axis = 0; axis < 3; axis += 1) {
      const value = source[i * 3 + axis];
      if (value < min[axis]) min[axis] = value;
      if (value > max[axis]) max[axis] = value;
    }
  }
  const center = min.map((value, axis) => (value + max[axis]) / 2);
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i += 1) {
    positions[i] = source[i] - center[i % 3];
  }

  const { colors, mode } = buildColors(mesh.attributes, positions, count);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3, true));
  if (mesh.attributes.intensity?.value) {
    geometry.setAttribute("intensity", new THREE.BufferAttribute(mesh.attributes.intensity.value, 1));
  }
  if (mesh.attributes.classification?.value) {
    geometry.setAttribute("classification", new THREE.BufferAttribute(mesh.attributes.classification.value, 1));
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const material = new THREE.PointsMaterial({
    size: pointSize,
    // Screen-space size: works whatever the units of the scan are.
    sizeAttenuation: false,
    vertexColors: true,
  });
  const points = new THREE.Points(geometry, material);
  points.name = name;
  points.rotation.x = -Math.PI / 2;
  points.userData.pointCloud = {
    totalPoints,
    loadedPoints: count,
    skip,
    colorMode: mode,
    // Original coordinates of the scene origin, e.g. for exporting measurements.
    originOffset: center,
  };

  const root = new THREE.Group();
  root.name = name;
  root.add(points);
  return root;
}

export { buildLasPointCloud, readLasPointCount };
//# sourceMappingURL=pointcloud-las.js.map
