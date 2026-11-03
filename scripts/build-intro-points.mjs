// Samples the Wolpa Synagogue model (viewer/examples/WolpaSynagogue.glb) into
// the coloured point cloud the intro page (intro.html, viewer/intro/) puts
// together: points spread over the surface by triangle area, each with the
// colour of its texture (times the material's base colour).
//
//   node scripts/build-intro-points.mjs [count] [model.glb]
//
// Writes viewer/intro/synagogue-points.bin (little-endian):
//   char[4]   "E4DP"
//   uint32    point count
//   float32×3 bounding box min, float32×3 bounding box max
//   uint16×3  per point: position, quantized within the box
//   uint8×3   per point: sRGB colour
//   int8×3    per point: surface normal (×127)
import { NodeIO } from '@gltf-transform/core';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

const count = Number(process.argv[2]) || 200000;
const modelPath = process.argv[3] || 'viewer/examples/WolpaSynagogue.glb';
const outPath = 'viewer/intro/synagogue-points.bin';

// A small seeded generator: the same file on every run.
let seed = 0x4d3a2f1;
function random() {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function transformPoint(m, x, y, z) {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

const textureCache = new Map();
async function decodeTexture(texture) {
  if (!texture) return null;
  if (textureCache.has(texture)) return textureCache.get(texture);
  const { data, info } = await sharp(Buffer.from(texture.getImage()))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const decoded = { data, width: info.width, height: info.height };
  textureCache.set(texture, decoded);
  return decoded;
}

function sampleTexture(tex, u, v) {
  const x = ((Math.floor((u - Math.floor(u)) * tex.width) % tex.width) + tex.width) % tex.width;
  const y = ((Math.floor((v - Math.floor(v)) * tex.height) % tex.height) + tex.height) % tex.height;
  const i = (y * tex.width + x) * 4;
  return [tex.data[i], tex.data[i + 1], tex.data[i + 2]];
}

const io = new NodeIO();
const document = await io.read(modelPath);
const root = document.getRoot();

// Every triangle in world space, with what its colour comes from.
const triangles = [];
let totalArea = 0;
for (const node of root.listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  const matrix = node.getWorldMatrix();
  for (const prim of mesh.listPrimitives()) {
    if (prim.getMode() !== 4) continue; // triangles only
    const position = prim.getAttribute('POSITION');
    const normal = prim.getAttribute('NORMAL');
    const uv = prim.getAttribute('TEXCOORD_0');
    const indices = prim.getIndices();
    const material = prim.getMaterial();
    const factor = material ? material.getBaseColorFactor() : [1, 1, 1, 1];
    const texture = material && uv ? await decodeTexture(material.getBaseColorTexture()) : null;
    const source = { factor, texture };
    const vertexCount = position.getCount();
    const world = [];
    for (let i = 0; i < vertexCount; i++) {
      world.push(transformPoint(matrix, ...position.getElement(i, [])));
    }
    // Normals: the node's rotation (and scale, normalized again later).
    const normals = normal ? Array.from({ length: vertexCount }, (_, i) => {
      const [x, y, z] = normal.getElement(i, []);
      return [
        matrix[0] * x + matrix[4] * y + matrix[8] * z,
        matrix[1] * x + matrix[5] * y + matrix[9] * z,
        matrix[2] * x + matrix[6] * y + matrix[10] * z,
      ];
    }) : null;
    const uvs = uv ? Array.from({ length: vertexCount }, (_, i) => uv.getElement(i, [])) : null;
    const indexCount = indices ? indices.getCount() : vertexCount;
    for (let t = 0; t + 2 < indexCount; t += 3) {
      const a = indices ? indices.getScalar(t) : t;
      const b = indices ? indices.getScalar(t + 1) : t + 1;
      const c = indices ? indices.getScalar(t + 2) : t + 2;
      const [pa, pb, pc] = [world[a], world[b], world[c]];
      const e1 = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]];
      const e2 = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]];
      const cx = e1[1] * e2[2] - e1[2] * e2[1];
      const cy = e1[2] * e2[0] - e1[0] * e2[2];
      const cz = e1[0] * e2[1] - e1[1] * e2[0];
      const area = 0.5 * Math.hypot(cx, cy, cz);
      if (!(area > 0)) continue;
      totalArea += area;
      const face = [cx / (2 * area), cy / (2 * area), cz / (2 * area)];
      triangles.push({
        cumulative: totalArea, pa, pb, pc, face,
        na: normals?.[a], nb: normals?.[b], nc: normals?.[c],
        ua: uvs?.[a], ub: uvs?.[b], uc: uvs?.[c], source,
      });
    }
  }
}
if (!triangles.length) throw new Error(`No triangles in ${modelPath}`);

function pickTriangle(r) {
  let lo = 0;
  let hi = triangles.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (triangles[mid].cumulative < r) lo = mid + 1;
    else hi = mid;
  }
  return triangles[lo];
}

const positions = new Float32Array(count * 3);
const colors = new Uint8Array(count * 3);
const normalsOut = new Int8Array(count * 3);
const min = [Infinity, Infinity, Infinity];
const max = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < count; i++) {
  const tri = pickTriangle(random() * totalArea);
  let s = random();
  let t = random();
  if (s + t > 1) { s = 1 - s; t = 1 - t; }
  const w = 1 - s - t;
  for (let k = 0; k < 3; k++) {
    const value = tri.pa[k] * w + tri.pb[k] * s + tri.pc[k] * t;
    positions[i * 3 + k] = value;
    if (value < min[k]) min[k] = value;
    if (value > max[k]) max[k] = value;
  }
  let n = tri.face;
  if (tri.na) {
    n = [0, 1, 2].map((k) => tri.na[k] * w + tri.nb[k] * s + tri.nc[k] * t);
  }
  const length = Math.hypot(n[0], n[1], n[2]) || 1;
  for (let k = 0; k < 3; k++) normalsOut[i * 3 + k] = Math.round((n[k] / length) * 127);
  const { factor, texture } = tri.source;
  let rgb = [255, 255, 255];
  if (texture && tri.ua) {
    const u = tri.ua[0] * w + tri.ub[0] * s + tri.uc[0] * t;
    const v = tri.ua[1] * w + tri.ub[1] * s + tri.uc[1] * t;
    rgb = sampleTexture(texture, u, v);
  }
  // The factor is linear; the texel sRGB. Close enough for a point colour.
  for (let k = 0; k < 3; k++) {
    colors[i * 3 + k] = Math.max(0, Math.min(255, Math.round(rgb[k] * Math.pow(factor[k], 1 / 2.2))));
  }
}

const headerBytes = 4 + 4 + 24;
const buffer = Buffer.alloc(headerBytes + count * 12);
buffer.write('E4DP', 0, 'ascii');
buffer.writeUInt32LE(count, 4);
for (let k = 0; k < 3; k++) {
  buffer.writeFloatLE(min[k], 8 + k * 4);
  buffer.writeFloatLE(max[k], 20 + k * 4);
}
let offset = headerBytes;
for (let i = 0; i < count; i++) {
  for (let k = 0; k < 3; k++) {
    const range = max[k] - min[k] || 1;
    buffer.writeUInt16LE(Math.round(((positions[i * 3 + k] - min[k]) / range) * 65535), offset);
    offset += 2;
  }
}
Buffer.from(colors.buffer).copy(buffer, offset);
offset += count * 3;
Buffer.from(normalsOut.buffer).copy(buffer, offset);

await fs.mkdir(path.dirname(outPath), { recursive: true });
await fs.writeFile(outPath, buffer);
console.log(`${count} points from ${triangles.length} triangles -> ${outPath} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
console.log('bounds', min.map((v) => v.toFixed(1)), max.map((v) => v.toFixed(1)));
