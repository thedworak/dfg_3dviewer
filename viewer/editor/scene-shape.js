import THREE from "../init.js";

// The suggested scene's geometry (editor/scene-suggest.js): a few cheap
// measures of the model's shape for the rules (scene-rules.js), computed
// once per model in the browser. Nothing of the model leaves it.
//
// - Normals: the share of the surface (by area, over at most
//   SAMPLE_TRIANGLES triangles) facing up, down and sideways, and how much
//   of the footprint is covered by upward faces in the lowest tenth of the
//   height - a ground or a floor.
// - Enclosure: rays in 26 directions from inside the bounding box (its
//   centre, and lower, at a third of its height). A ray that first meets a
//   face turned towards it hits a wall seen from inside: a room, a nave, a
//   crypt. A closed building or statue seen from its own inside meets the
//   backs of its faces: that is no interior. The rays march through a grid
//   of voxels (GRID along the longest side) filled from the same sampled
//   triangles, each voxel keeping the sum of their normals - so the cost
//   does not grow with the model (three.js raycasts test every triangle).

const SAMPLE_TRIANGLES = 150000;
const GRID = 48;
// Lattice steps along one triangle's side, at most (GRID * 2 covers a
// triangle as large as the box).
const MAX_STEPS = GRID * 2;
const UP = 0.85;
const SIDEWAYS = 0.3;
const GROUND_BAND = 0.1;

const DIRECTIONS = (() => {
  const list = [];
  for (let x = -1; x <= 1; x += 1) {
    for (let y = -1; y <= 1; y += 1) {
      for (let z = -1; z <= 1; z += 1) {
        if (x || y || z) list.push(new THREE.Vector3(x, y, z).normalize());
      }
    }
  }
  return list;
})();

function collectMeshes(roots) {
  const meshes = [];
  roots.forEach((root) => root.traverse((object) => {
    if (!object.isMesh || object.userData?.isWeather || object.userData?.isGaussianSplats) return;
    if (!object.geometry?.attributes?.position) return;
    meshes.push(object);
  }));
  return meshes;
}

function triangleCount(mesh) {
  const geometry = mesh.geometry;
  const count = geometry.index ? geometry.index.count : geometry.attributes.position.count;
  return Math.floor(count / 3) * (mesh.isInstancedMesh ? mesh.count : 1);
}

// One pass over the sampled triangles: the area-weighted shares of the
// faces up, down and sideways, the footprint covered by upward faces near
// the bottom, and the voxel grid of the surface with its normals.
function sampleSurface(meshes, box, total) {
  const stride = Math.max(1, Math.ceil(total / SAMPLE_TRIANGLES));
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const size = box.getSize(new THREE.Vector3());
  const height = size.y;
  const groundTop = box.min.y + height * GROUND_BAND;
  const cell = Math.max(size.x, size.y, size.z) / GRID;
  const dims = [size.x, size.y, size.z].map((side) => Math.max(1, Math.floor(side / cell) + 1));
  const normals = new Float32Array(dims[0] * dims[1] * dims[2] * 3);
  const filled = new Uint8Array(dims[0] * dims[1] * dims[2]);
  const splat = (x, y, z, nx, ny, nz) => {
    const i = Math.min(dims[0] - 1, Math.max(0, Math.floor((x - box.min.x) / cell)));
    const j = Math.min(dims[1] - 1, Math.max(0, Math.floor((y - box.min.y) / cell)));
    const k = Math.min(dims[2] - 1, Math.max(0, Math.floor((z - box.min.z) / cell)));
    const index = (k * dims[1] + j) * dims[0] + i;
    filled[index] = 1;
    normals[index * 3] += nx;
    normals[index * 3 + 1] += ny;
    normals[index * 3 + 2] += nz;
  };
  let area = 0;
  let up = 0;
  let down = 0;
  let sideways = 0;
  let ground = 0;
  meshes.forEach((mesh) => {
    if (mesh.isInstancedMesh) return;
    const position = mesh.geometry.attributes.position;
    const index = mesh.geometry.index;
    const count = Math.floor((index ? index.count : position.count) / 3);
    const vertex = (i) => (index ? index.getX(i) : i);
    for (let triangle = 0; triangle < count; triangle += stride) {
      a.fromBufferAttribute(position, vertex(triangle * 3)).applyMatrix4(mesh.matrixWorld);
      b.fromBufferAttribute(position, vertex(triangle * 3 + 1)).applyMatrix4(mesh.matrixWorld);
      c.fromBufferAttribute(position, vertex(triangle * 3 + 2)).applyMatrix4(mesh.matrixWorld);
      normal.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a));
      const twice = normal.length();
      if (!(twice > 0)) continue;
      const faceArea = twice / 2;
      normal.divideScalar(twice);
      area += faceArea;
      if (normal.y > UP) {
        up += faceArea;
        if ((a.y + b.y + c.y) / 3 <= groundTop) ground += faceArea;
      } else if (normal.y < -UP) down += faceArea;
      else if (Math.abs(normal.y) < SIDEWAYS) sideways += faceArea;
      // A lattice of points over the triangle, half a voxel apart, so a
      // large wall leaves no gaps for the rays.
      const longest = Math.max(ab.length(), ac.length(), b.distanceTo(c));
      const steps = Math.min(MAX_STEPS, Math.max(1, Math.ceil(longest / (cell / 2))));
      if (steps === 1) {
        splat((a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3, (a.z + b.z + c.z) / 3, normal.x * faceArea, normal.y * faceArea, normal.z * faceArea);
        continue;
      }
      const weight = faceArea / ((steps + 1) * (steps + 2) / 2);
      for (let i = 0; i <= steps; i += 1) {
        for (let j = 0; j <= steps - i; j += 1) {
          const u = i / steps;
          const v = j / steps;
          splat(
            a.x + ab.x * u + ac.x * v,
            a.y + ab.y * u + ac.y * v,
            a.z + ab.z * u + ac.z * v,
            normal.x * weight, normal.y * weight, normal.z * weight,
          );
        }
      }
    }
  });
  if (!(area > 0)) return null;
  // Every stride-th triangle sampled: the ground's area is about stride
  // times the sampled one.
  const footprint = size.x * size.z;
  return {
    up: up / area,
    down: down / area,
    sideways: sideways / area,
    groundCover: footprint > 0 ? Math.min(1, (ground * stride) / footprint) : 0,
    grid: { dims, cell, normals, filled },
  };
}

// The share of rays that first meet a voxel whose faces turn towards them,
// from the better of two points inside the box.
function measureEnclosure(grid, box) {
  const { dims, cell, normals, filled } = grid;
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const low = centre.clone().setY(box.min.y + size.y / 3);
  const reach = size.length();
  const step = cell / 2;
  const point = new THREE.Vector3();
  const voxelAt = (p) => {
    const i = Math.floor((p.x - box.min.x) / cell);
    const j = Math.floor((p.y - box.min.y) / cell);
    const k = Math.floor((p.z - box.min.z) / cell);
    if (i < 0 || j < 0 || k < 0 || i >= dims[0] || j >= dims[1] || k >= dims[2]) return -2;
    const index = (k * dims[1] + j) * dims[0] + i;
    return filled[index] ? index : -1;
  };
  let best = { front: 0, back: 0 };
  [centre, low].forEach((origin) => {
    const start = voxelAt(origin);
    let front = 0;
    let back = 0;
    DIRECTIONS.forEach((direction) => {
      for (let distance = step; distance <= reach; distance += step) {
        point.copy(origin).addScaledVector(direction, distance);
        const index = voxelAt(point);
        if (index === -2) return;
        // Leaving the voxel it starts in (a wall it stands on) first.
        if (index < 0 || index === start) continue;
        const dot = normals[index * 3] * direction.x + normals[index * 3 + 1] * direction.y + normals[index * 3 + 2] * direction.z;
        if (dot < 0) front += 1;
        else back += 1;
        return;
      }
    });
    if (front > best.front || (front === best.front && back > best.back)) best = { front, back };
  });
  return { enclosure: best.front / DIRECTIONS.length, shell: best.back / DIRECTIONS.length, rays: DIRECTIONS.length };
}

/**
 * { up, down, sideways, groundCover, enclosure, shell, rays, triangles } of
 * the meshes under `roots` (in the box `box`, world units), or null without
 * meshes.
 */
export function computeSceneShape(roots, box) {
  if (!box || box.isEmpty()) return null;
  roots.forEach((root) => root.updateMatrixWorld(true));
  const meshes = collectMeshes(roots);
  const total = meshes.reduce((sum, mesh) => sum + triangleCount(mesh), 0);
  if (!total) return null;
  const normals = sampleSurface(meshes, box, total);
  if (!normals) return null;
  const rays = measureEnclosure(normals.grid, box);
  const round = (value) => (value == null ? null : Math.round(value * 1000) / 1000);
  return {
    up: round(normals.up),
    down: round(normals.down),
    sideways: round(normals.sideways),
    groundCover: round(normals.groundCover),
    enclosure: round(rays.enclosure),
    shell: round(rays.shell),
    rays: rays.rays,
    triangles: total,
  };
}
