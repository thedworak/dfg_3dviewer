// Room acoustics worked out from a model's geometry (auralization): how a
// sound would be heard in the reconstructed building.
//
// No three.js here: it runs in a Web Worker (room-acoustics-worker.js), or
// on the main thread without one.
//
//   1. The model's triangles, in world coordinates, go into a bounding
//      volume hierarchy (BVH), each with its surface material.
//   2. Rays leave the listening point in all directions (stochastic ray
//      tracing). At each wall a ray loses the material's absorption, per
//      octave band (125 Hz to 4 kHz), and the air takes its part along the
//      way. A ray that leaves the model is lost: an open door, a window
//      without glass, a ruin without a roof absorb everything.
//   3. Each reflection sends its share back to the listening point if the
//      point can be seen from it ("diffuse rain": the walls are taken to
//      scatter like a rough, ornamented surface does). The shares arrive
//      later by the length of their path: an energy histogram, per band.
//   4. The reverberation time of each band comes from the histogram's decay
//      (Schroeder's backward integration, T20 x 3); Eyring's formula from
//      the mean free path and the mean absorption when the decay is too
//      short to fit.
//   5. The impulse response: noise in each band, shaped by the histogram
//      for the early reflections (up to 80 ms) and by a smooth exponential
//      decay at the band's reverberation time after that. Stereo, with a
//      different noise in each ear. Its energy is 1: how loud it is heard
//      is `reverberantEnergy`, the diffuse field of a room of that volume
//      and reverberation time against a source's direct sound (sendGain).
//
// Lengths are in scene units; `metersPerUnit` turns them into meters for
// the speed of sound and the air.

export const SPEED_OF_SOUND = 343;
export const BANDS = [125, 250, 500, 1000, 2000, 4000];

// Absorption coefficients per octave band (125 Hz ... 4 kHz), the usual
// tabulated values for such surfaces.
export const ROOM_MATERIALS = {
  stone: [0.01, 0.01, 0.015, 0.02, 0.02, 0.025],
  plaster: [0.013, 0.015, 0.02, 0.03, 0.04, 0.05],
  brick: [0.03, 0.03, 0.03, 0.04, 0.05, 0.07],
  wood: [0.15, 0.11, 0.1, 0.07, 0.06, 0.07],
  glass: [0.35, 0.25, 0.18, 0.12, 0.07, 0.04],
  fabric: [0.07, 0.31, 0.49, 0.75, 0.7, 0.6],
  ground: [0.11, 0.26, 0.6, 0.69, 0.92, 0.99],
};
export const ROOM_MATERIAL_NAMES = Object.keys(ROOM_MATERIALS);

// What covers the floors (surfaces facing up): their own material, empty
// wooden pews or benches, or the same with people on them.
export const FLOOR_COVERS = {
  pews: [0.1, 0.15, 0.18, 0.2, 0.2, 0.2],
  people: [0.39, 0.57, 0.8, 0.94, 0.92, 0.87],
};
export const FLOOR_COVER_NAMES = ["material", ...Object.keys(FLOOR_COVERS)];

// Air absorption, energy per meter (20 °C, 50% humidity).
const AIR = [0.0001, 0.0003, 0.0006, 0.001, 0.0019, 0.0058];

// A material's name (or its texture's) -> one of ROOM_MATERIALS, or null.
const MATERIAL_WORDS = [
  ["glass", /glass|glas|szk[łl]|window|fenster|okn|vitr/i],
  ["wood", /wood|holz|drew|drzew|timber|oak|pine|plank|beam|eiche|dąb|dab|sosn|parquet|parkiet|deska|board|bench|ławk|lawk|pew/i],
  ["fabric", /fabric|cloth|curtain|textile|carpet|rug|dywan|tkanin|zasł|zasl|stoff|vorhang|teppich|velvet|seat|cushion/i],
  ["ground", /grass|ground|terrain|soil|earth|gras|erde|boden|ziemi|traw|gleb|lawn|dirt|sand/i],
  ["brick", /brick|ziegel|ceg[łl]|klinkier|terracotta/i],
  // Not "wall" or "ceiling": those say where, not what.
  ["plaster", /plaster|putz|tynk|stucco|stuk|lime ?wash|whitewash/i],
  ["stone", /stone|stein|kamie|marble|marmor|marmur|granit|concrete|beton|tile|fliese|płyt|plyt|slate|limestone|sandstone|piaskowc|rock/i],
];

export function materialFromName(name) {
  const text = String(name || "");
  if (!text) return null;
  const found = MATERIAL_WORDS.find(([, pattern]) => pattern.test(text));
  return found ? found[0] : null;
}

// ---- BVH -----------------------------------------------------------------

const LEAF_SIZE = 4;

// positions: Float32Array, 9 numbers per triangle (world coordinates).
export function buildBVH(positions) {
  const count = Math.floor(positions.length / 9);
  const order = new Uint32Array(count);
  const centroids = new Float32Array(count * 3);
  const boxes = new Float32Array(count * 6);
  for (let i = 0; i < count; i += 1) {
    order[i] = i;
    const o = i * 9;
    for (let axis = 0; axis < 3; axis += 1) {
      const a = positions[o + axis];
      const b = positions[o + 3 + axis];
      const c = positions[o + 6 + axis];
      const min = Math.min(a, b, c);
      const max = Math.max(a, b, c);
      boxes[i * 6 + axis] = min;
      boxes[i * 6 + 3 + axis] = max;
      centroids[i * 3 + axis] = (min + max) * 0.5;
    }
  }
  // Nodes: box (6), then left child / first triangle, right child / count
  // (negative count marks a leaf).
  const maxNodes = Math.max(1, 2 * Math.ceil(count / LEAF_SIZE) + 1);
  let nodeBoxes = new Float32Array(maxNodes * 6);
  let nodeData = new Int32Array(maxNodes * 2);
  let nodes = 0;
  const grow = () => {
    const boxesNext = new Float32Array(nodeBoxes.length * 2);
    boxesNext.set(nodeBoxes);
    nodeBoxes = boxesNext;
    const dataNext = new Int32Array(nodeData.length * 2);
    dataNext.set(nodeData);
    nodeData = dataNext;
  };
  const stack = [[0, count, -1, 0]];
  const root = nodes;
  while (stack.length) {
    const [start, end, parent, side] = stack.pop();
    if (nodes * 6 >= nodeBoxes.length) grow();
    const node = nodes;
    nodes += 1;
    if (parent >= 0) nodeData[parent * 2 + side] = node;
    let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    let cMinX = Infinity, cMinY = Infinity, cMinZ = Infinity, cMaxX = -Infinity, cMaxY = -Infinity, cMaxZ = -Infinity;
    for (let i = start; i < end; i += 1) {
      const tri = order[i];
      const b = tri * 6;
      if (boxes[b] < minX) minX = boxes[b];
      if (boxes[b + 1] < minY) minY = boxes[b + 1];
      if (boxes[b + 2] < minZ) minZ = boxes[b + 2];
      if (boxes[b + 3] > maxX) maxX = boxes[b + 3];
      if (boxes[b + 4] > maxY) maxY = boxes[b + 4];
      if (boxes[b + 5] > maxZ) maxZ = boxes[b + 5];
      const c = tri * 3;
      if (centroids[c] < cMinX) cMinX = centroids[c];
      if (centroids[c + 1] < cMinY) cMinY = centroids[c + 1];
      if (centroids[c + 2] < cMinZ) cMinZ = centroids[c + 2];
      if (centroids[c] > cMaxX) cMaxX = centroids[c];
      if (centroids[c + 1] > cMaxY) cMaxY = centroids[c + 1];
      if (centroids[c + 2] > cMaxZ) cMaxZ = centroids[c + 2];
    }
    nodeBoxes.set([minX, minY, minZ, maxX, maxY, maxZ], node * 6);
    const size = [cMaxX - cMinX, cMaxY - cMinY, cMaxZ - cMinZ];
    const axis = size[0] >= size[1] && size[0] >= size[2] ? 0 : size[1] >= size[2] ? 1 : 2;
    if (end - start <= LEAF_SIZE || !(size[axis] > 0)) {
      nodeData[node * 2] = start;
      nodeData[node * 2 + 1] = -(end - start);
      continue;
    }
    // Split at the middle of the centroids (fast, good enough for walls).
    const split = [cMinX, cMinY, cMinZ][axis] + size[axis] * 0.5;
    let i = start;
    let j = end - 1;
    while (i <= j) {
      if (centroids[order[i] * 3 + axis] < split) i += 1;
      else {
        const swap = order[i];
        order[i] = order[j];
        order[j] = swap;
        j -= 1;
      }
    }
    let middle = i;
    if (middle === start || middle === end) middle = (start + end) >> 1;
    stack.push([middle, end, node, 1], [start, middle, node, 0]);
  }
  // Triangles in the leaves' order, for locality.
  const sorted = new Float32Array(count * 9);
  for (let i = 0; i < count; i += 1) sorted.set(positions.subarray(order[i] * 9, order[i] * 9 + 9), i * 9);
  return { positions: sorted, order, nodeBoxes, nodeData, root, count };
}

const EPSILON = 1e-9;

// The nearest triangle along the ray within maxT: { t, triangle } (the
// index in the BVH's order) or null. With `any`, the first one found.
export function intersectBVH(bvh, ox, oy, oz, dx, dy, dz, maxT, any = false) {
  const { positions, nodeBoxes, nodeData } = bvh;
  if (!bvh.count) return null;
  const ix = 1 / dx;
  const iy = 1 / dy;
  const iz = 1 / dz;
  let bestT = maxT;
  let best = -1;
  const stack = bvh.stack || (bvh.stack = new Int32Array(128));
  let top = 0;
  stack[top++] = bvh.root;
  while (top > 0) {
    const node = stack[--top];
    const b = node * 6;
    let t1 = (nodeBoxes[b] - ox) * ix;
    let t2 = (nodeBoxes[b + 3] - ox) * ix;
    let tmin = Math.min(t1, t2);
    let tmax = Math.max(t1, t2);
    t1 = (nodeBoxes[b + 1] - oy) * iy;
    t2 = (nodeBoxes[b + 4] - oy) * iy;
    tmin = Math.max(tmin, Math.min(t1, t2));
    tmax = Math.min(tmax, Math.max(t1, t2));
    t1 = (nodeBoxes[b + 2] - oz) * iz;
    t2 = (nodeBoxes[b + 5] - oz) * iz;
    tmin = Math.max(tmin, Math.min(t1, t2));
    tmax = Math.min(tmax, Math.max(t1, t2));
    if (tmax < Math.max(tmin, 0) || tmin > bestT) continue;
    const first = nodeData[node * 2];
    const second = nodeData[node * 2 + 1];
    if (second < 0) {
      for (let k = first, end = first - second; k < end; k += 1) {
        const o = k * 9;
        const ax = positions[o], ay = positions[o + 1], az = positions[o + 2];
        const e1x = positions[o + 3] - ax, e1y = positions[o + 4] - ay, e1z = positions[o + 5] - az;
        const e2x = positions[o + 6] - ax, e2y = positions[o + 7] - ay, e2z = positions[o + 8] - az;
        const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
        const det = e1x * px + e1y * py + e1z * pz;
        if (det > -EPSILON && det < EPSILON) continue;
        const inv = 1 / det;
        const sx = ox - ax, sy = oy - ay, sz = oz - az;
        const u = (sx * px + sy * py + sz * pz) * inv;
        if (u < 0 || u > 1) continue;
        const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
        const v = (dx * qx + dy * qy + dz * qz) * inv;
        if (v < 0 || u + v > 1) continue;
        const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
        if (t > EPSILON && t < bestT) {
          bestT = t;
          best = k;
          if (any) return { t, triangle: k };
        }
      }
    } else {
      if (top + 2 > stack.length) {
        const bigger = new Int32Array(stack.length * 2);
        bigger.set(stack);
        bvh.stack = bigger;
        return intersectBVH(bvh, ox, oy, oz, dx, dy, dz, maxT, any);
      }
      stack[top++] = second;
      stack[top++] = first;
    }
  }
  return best >= 0 ? { t: bestT, triangle: best } : null;
}

// ---- a small seeded random number generator: the same room, the same
// result -------------------------------------------------------------------

function random(seed = 1) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}

function gaussian(rand) {
  const u = Math.max(rand(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

// ---- the ray tracing -----------------------------------------------------

const BIN_SECONDS = 0.002;
const EARLY_SECONDS = 0.08;
const MAX_SECONDS = 10;
// A ray ends 45 dB down: enough for the T20 fit (-5 to -25 dB) and the
// early-to-late balance; the late tail is the fitted decay.
const MIN_ENERGY = 10 ** -4.5;

// geometry: { positions (Float32Array, 9 per triangle), materials
//   (Uint8Array, an index into ROOM_MATERIAL_NAMES per triangle, 255: the
//   default), size (the model's diagonal) }
// options: { position [x, y, z], material (the default), floor (one of
//   FLOOR_COVER_NAMES; up is +y), metersPerUnit, rays, scattering (0..1: how
//   much of a reflection goes in any direction), seed, budget (ms: fewer
//   rays when the model is slow to trace), onProgress(0..1) }
export function traceRoom(geometry, options = {}) {
  const started = Date.now();
  const bvh = geometry.bvh || buildBVH(geometry.positions);
  const metersPerUnit = options.metersPerUnit > 0 ? options.metersPerUnit : 1;
  const defaultName = ROOM_MATERIALS[options.material] ? options.material : "plaster";
  const absorptions = ROOM_MATERIAL_NAMES.map((name) => ROOM_MATERIALS[name]);
  const defaultIndex = ROOM_MATERIAL_NAMES.indexOf(defaultName);
  const materials = geometry.materials;
  const floor = FLOOR_COVERS[options.floor] || null;
  const planned = Math.max(64, Math.round(options.rays || 3000));
  const budget = options.budget > 0 ? options.budget : Infinity;
  let rays = planned;
  const scattering = Number.isFinite(options.scattering) ? Math.min(1, Math.max(0, options.scattering)) : 0.4;
  const rand = random(options.seed || 7);
  const [px, py, pz] = options.position || [0, 0, 0];
  const size = geometry.size > 0 ? geometry.size : 1;
  // Farther than the model is out.
  const reach = size * 2;
  const bands = BANDS.length;
  const bins = Math.ceil(MAX_SECONDS / BIN_SECONDS);
  const histogram = BANDS.map(() => new Float64Array(bins));
  const unitsPerSecond = SPEED_OF_SOUND / metersPerUnit;
  const air = AIR.map((value) => value * metersPerUnit);
  // Statistics for Eyring and the room's size.
  let segments = 0;
  let segmentLength = 0;
  let reflections = 0;
  const absorbed = new Float64Array(bands);
  let escapedFirst = 0;
  let volumeSum = 0;
  const materialHits = new Float64Array(ROOM_MATERIAL_NAMES.length + 1);
  const energy = new Float64Array(bands);
  const progressStep = Math.max(1, Math.floor(planned / 50));

  for (let ray = 0; ray < rays; ray += 1) {
    // Out of time: the rays traced so far stand for all of them.
    if (ray >= 64 && ray % 16 === 0 && Date.now() - started > budget) {
      rays = ray;
      break;
    }
    // Any direction, evenly.
    const z = 1 - 2 * rand();
    const r = Math.sqrt(Math.max(0, 1 - z * z));
    const phi = 2 * Math.PI * rand();
    let dx = r * Math.cos(phi);
    let dy = z;
    let dz = r * Math.sin(phi);
    let ox = px, oy = py, oz = pz;
    let path = 0;
    energy.fill(1 / planned);
    for (let bounce = 0; bounce < 400; bounce += 1) {
      const hit = intersectBVH(bvh, ox, oy, oz, dx, dy, dz, reach);
      if (!hit) {
        if (bounce === 0) {
          escapedFirst += 1;
        }
        // Out of the model: everything left is lost.
        reflections += 1;
        for (let b = 0; b < bands; b += 1) absorbed[b] += 1;
        materialHits[ROOM_MATERIAL_NAMES.length] += 1;
        break;
      }
      const t = hit.t;
      if (bounce === 0) {
        volumeSum += t ** 3;
      }
      segments += 1;
      segmentLength += t;
      path += t;
      const hx = ox + dx * t, hy = oy + dy * t, hz = oz + dz * t;
      // The triangle's normal, towards where the ray came from.
      const o = hit.triangle * 9;
      const pos = bvh.positions;
      const e1x = pos[o + 3] - pos[o], e1y = pos[o + 4] - pos[o + 1], e1z = pos[o + 5] - pos[o + 2];
      const e2x = pos[o + 6] - pos[o], e2y = pos[o + 7] - pos[o + 1], e2z = pos[o + 8] - pos[o + 2];
      let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl; ny /= nl; nz /= nl;
      if (nx * dx + ny * dy + nz * dz > 0) { nx = -nx; ny = -ny; nz = -nz; }
      const original = bvh.order[hit.triangle];
      const stored = materials ? materials[original] : 255;
      const materialIndex = stored < absorptions.length ? stored : defaultIndex;
      // A floor, under pews or people.
      const alpha = floor && ny > 0.7 ? floor : absorptions[materialIndex];
      materialHits[materialIndex] += 1;
      reflections += 1;
      let left = 0;
      const meters = t * metersPerUnit;
      for (let b = 0; b < bands; b += 1) {
        absorbed[b] += alpha[b];
        energy[b] *= (1 - alpha[b]) * Math.exp(-AIR[b] * meters);
        left += energy[b];
      }
      // Off the wall a little, so that the next ray does not hit it again.
      const lift = size * 1e-5;
      ox = hx + nx * lift; oy = hy + ny * lift; oz = hz + nz * lift;
      // Diffuse rain: the share heard at the listening point, if seen.
      const lx = px - ox, ly = py - oy, lz = pz - oz;
      const distance = Math.hypot(lx, ly, lz);
      if (distance > 0) {
        const cos = (lx * nx + ly * ny + lz * nz) / distance;
        if (cos > 0 && !intersectBVH(bvh, ox, oy, oz, lx / distance, ly / distance, lz / distance, distance, true)) {
          const time = (path + distance) / unitsPerSecond;
          const bin = Math.floor(time / BIN_SECONDS);
          if (bin < bins) {
            // Lambert's law, into a sphere of radius 1 (as the direct sound
            // in sendGain is): cos / π · π / d².
            const share = cos / (distance * distance);
            for (let b = 0; b < bands; b += 1) {
              histogram[b][bin] += energy[b] * share * Math.exp(-air[b] * distance);
            }
          }
        }
      }
      if (left < MIN_ENERGY * bands / planned || path / unitsPerSecond > MAX_SECONDS) break;
      // The next direction: mirrored, or (scattered) anywhere off the wall.
      if (rand() < scattering) {
        // Cosine-weighted around the normal.
        const u = rand();
        const angle = 2 * Math.PI * rand();
        const sr = Math.sqrt(u);
        const tx0 = Math.abs(nx) < 0.9 ? 1 : 0;
        const ty0 = tx0 ? 0 : 1;
        // A tangent and a bitangent.
        let tx = ty0 * nz - 0 * ny, ty = 0 * nx - tx0 * nz, tz = tx0 * ny - ty0 * nx;
        const tl = Math.hypot(tx, ty, tz) || 1;
        tx /= tl; ty /= tl; tz /= tl;
        const bx = ny * tz - nz * ty, by = nz * tx - nx * tz, bz = nx * ty - ny * tx;
        const a = sr * Math.cos(angle);
        const c = sr * Math.sin(angle);
        const n = Math.sqrt(Math.max(0, 1 - u));
        dx = tx * a + bx * c + nx * n;
        dy = ty * a + by * c + ny * n;
        dz = tz * a + bz * c + nz * n;
      } else {
        const dot = dx * nx + dy * ny + dz * nz;
        dx -= 2 * dot * nx; dy -= 2 * dot * ny; dz -= 2 * dot * nz;
      }
      const dl = Math.hypot(dx, dy, dz) || 1;
      dx /= dl; dy /= dl; dz /= dl;
    }
    if (options.onProgress && ray % progressStep === 0) options.onProgress(Math.max(ray / planned, (Date.now() - started) / budget));
  }
  // Each ray carried 1 / planned: scaled up when fewer were traced.
  if (rays < planned) histogram.forEach((band) => { for (let i = 0; i < band.length; i += 1) band[i] *= planned / rays; });

  // ---- what the histogram says ----
  const meanFreePath = segments ? (segmentLength / segments) * metersPerUnit : 0;
  const meanAbsorption = BANDS.map((_, b) => (reflections ? absorbed[b] / reflections : 1));
  const volume = (4 / 3) * Math.PI * (volumeSum / rays) * metersPerUnit ** 3;
  const eyring = BANDS.map((_, b) => {
    const a = Math.min(0.999, Math.max(1e-4, meanAbsorption[b]));
    if (!(meanFreePath > 0)) return 0;
    return 13.8155 / (SPEED_OF_SOUND * (-Math.log(1 - a) / meanFreePath + AIR[b]));
  });
  const decay = BANDS.map((_, b) => schroederRT(histogram[b]));
  const rt = BANDS.map((_, b) => {
    const value = decay[b] || eyring[b];
    return Math.min(12, Math.max(0.05, value || 0.05));
  });
  // The listening point is where the sound starts too: the floor under it
  // and a wall beside it would send back far more than they do from a
  // source across the room. So the early reflections are held to three
  // times the late decay carried back to their time - still heard, not
  // ruling - and the level of the reverberant field is the diffuse field's
  // (below), not the histogram's.
  const earlyBins = Math.round(EARLY_SECONDS / BIN_SECONDS);
  const shaped = histogram.map((band, b) => {
    const k = 13.8155 / rt[b];
    let late = 0;
    for (let i = earlyBins; i < band.length; i += 1) late += band[i];
    if (!(late > 0)) return band;
    // Energy per bin of the late decay, carried back: late = L e^(-k te) / k.
    const perSecond = late * k * Math.exp(k * EARLY_SECONDS);
    const out = Float64Array.from(band);
    for (let i = 0; i < earlyBins; i += 1) {
      const cap = 3 * perSecond * Math.exp(-k * (i + 0.5) * BIN_SECONDS) * BIN_SECONDS;
      if (out[i] > cap) out[i] = cap;
    }
    return out;
  });
  const totals = shaped.map((band) => band.reduce((sum, value) => sum + value, 0));
  // Clarity (C80) and definition (D50) of the mid bands (500 Hz, 1 kHz).
  const sumUntil = (band, seconds) => {
    const end = Math.min(band.length, Math.round(seconds / BIN_SECONDS));
    let sum = 0;
    for (let i = 0; i < end; i += 1) sum += band[i];
    return sum;
  };
  const mid = [2, 3];
  const early80 = mid.reduce((sum, b) => sum + sumUntil(shaped[b], 0.08), 0);
  const early50 = mid.reduce((sum, b) => sum + sumUntil(shaped[b], 0.05), 0);
  const all = mid.reduce((sum, b) => sum + totals[b], 0);
  const rtMid = (rt[2] + rt[3]) / 2;
  // The diffuse field: the room's absorption area A = 0.161 V / T (m²)
  // makes it as loud as a source's direct sound at the critical distance
  // sqrt(A / 16π). In the units of sendGain: 1 / (4 rc²), rc in scene units.
  const absorptionArea = volume > 0 ? (0.161 * volume) / rtMid : 0;
  const criticalMeters = absorptionArea > 0 ? Math.sqrt(absorptionArea / (16 * Math.PI)) : Infinity;
  const criticalDistance = criticalMeters / metersPerUnit;
  const reverberantEnergy = Number.isFinite(criticalDistance) && criticalDistance > 0 ? 1 / (4 * criticalDistance * criticalDistance) : 0;
  const surfaces = {};
  const hits = materialHits.reduce((sum, value) => sum + value, 0) || 1;
  ROOM_MATERIAL_NAMES.forEach((name, index) => {
    if (materialHits[index] > 0) surfaces[name] = materialHits[index] / hits;
  });
  if (materialHits[ROOM_MATERIAL_NAMES.length] > 0) surfaces.open = materialHits[ROOM_MATERIAL_NAMES.length] / hits;
  return {
    bands: BANDS.slice(),
    rt,
    rtFromDecay: decay.map((value) => value || null),
    rtEyring: eyring,
    rtMid,
    // Energy, in units of the direct sound at 1 scene unit from a source.
    reverberantEnergy,
    bandEnergy: totals,
    absorptionArea,
    // Scene units.
    criticalDistance,
    c80: all > early80 ? 10 * Math.log10(early80 / Math.max(all - early80, 1e-30)) : null,
    d50: all > 0 ? early50 / all : null,
    // The share of the directions that see out of the model.
    openness: escapedFirst / rays,
    volume,
    meanFreePath,
    meanAbsorption,
    surfaces,
    rays,
    triangles: bvh.count,
    histogram: shaped.map((band) => Float32Array.from(band.subarray(0, Math.ceil(Math.min(MAX_SECONDS, Math.max(...rt) * 1.5 + EARLY_SECONDS) / BIN_SECONDS)))),
    binSeconds: BIN_SECONDS,
    milliseconds: Date.now() - started,
  };
}

// The reverberation time from a histogram's decay: Schroeder's backward
// integral, a line fitted from -5 to -25 dB (T20), times three. null when
// the decay does not reach -25 dB or rests on too few bins.
export function schroederRT(band, binSeconds = BIN_SECONDS) {
  const total = band.reduce((sum, value) => sum + value, 0);
  if (!(total > 0)) return null;
  const curve = new Float64Array(band.length);
  let remaining = total;
  for (let i = 0; i < band.length; i += 1) {
    curve[i] = 10 * Math.log10(Math.max(remaining / total, 1e-30));
    remaining -= band[i];
  }
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, n = 0;
  for (let i = 0; i < curve.length; i += 1) {
    if (curve[i] > -5) continue;
    if (curve[i] < -25) break;
    const x = i * binSeconds;
    sumX += x; sumY += curve[i]; sumXY += x * curve[i]; sumXX += x * x; n += 1;
  }
  if (n < 5 || curve[curve.length - 1] > -25) return null;
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  if (!(slope < 0)) return null;
  return -60 / slope;
}

// ---- the impulse response --------------------------------------------------

// A second-order band-pass (RBJ cookbook, constant 0 dB peak gain).
function bandPass(frequency, sampleRate, q = Math.SQRT1_2) {
  const w = (2 * Math.PI * Math.min(frequency, sampleRate * 0.45)) / sampleRate;
  const alpha = Math.sin(w) / (2 * q);
  const a0 = 1 + alpha;
  return { b0: alpha / a0, b2: -alpha / a0, a1: (-2 * Math.cos(w)) / a0, a2: (1 - alpha) / a0 };
}

// result: traceRoom's. Returns { channels: [left, right], sampleRate,
// seconds }; each channel's energy is 1.
export function synthesizeImpulseResponse(result, sampleRate = 48000, { seed = 11 } = {}) {
  const rand = random(seed);
  const longest = Math.max(...result.rt);
  const seconds = Math.min(MAX_SECONDS, EARLY_SECONDS + longest * 1.1 + 0.05);
  const length = Math.max(1, Math.round(seconds * sampleRate));
  const channels = [new Float32Array(length), new Float32Array(length)];
  const binSeconds = result.binSeconds || BIN_SECONDS;
  const earlyBins = Math.round(EARLY_SECONDS / binSeconds);
  const totalEnergy = result.bandEnergy.reduce((sum, value) => sum + value, 0) || 1;
  const band = new Float32Array(length);
  result.bands.forEach((frequency, b) => {
    if (frequency >= sampleRate * 0.45) return;
    const histogram = result.histogram[b];
    const share = result.bandEnergy[b] / totalEnergy;
    if (!(share > 0)) return;
    // The envelope (energy per second): the histogram early, then an
    // exponential with the band's reverberation time carrying the rest.
    let earlyEnergy = 0;
    for (let i = 0; i < Math.min(earlyBins, histogram.length); i += 1) earlyEnergy += histogram[i];
    const lateEnergy = Math.max(result.bandEnergy[b] - earlyEnergy, 0);
    const k = 13.8155 / result.rt[b];
    const amplitude = lateEnergy * k * Math.exp(k * EARLY_SECONDS);
    const envelope = new Float32Array(length);
    for (let i = 0; i < length; i += 1) {
      const time = i / sampleRate;
      let density;
      if (time < EARLY_SECONDS) {
        const bin = Math.min(histogram.length - 1, Math.floor(time / binSeconds));
        density = histogram[bin] / binSeconds;
      } else {
        density = amplitude * Math.exp(-k * time);
      }
      envelope[i] = Math.sqrt(Math.max(density, 0));
    }
    // Fade the last 5% out.
    const fade = Math.max(1, Math.round(length * 0.05));
    for (let i = length - fade; i < length; i += 1) envelope[i] *= (length - i) / fade;
    const filter = bandPass(frequency, sampleRate);
    channels.forEach((channel) => {
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      let energy = 0;
      for (let i = 0; i < length; i += 1) {
        const x = gaussian(rand);
        const y = filter.b0 * x + filter.b2 * x2 - filter.a1 * y1 - filter.a2 * y2;
        x2 = x1; x1 = x; y2 = y1; y1 = y;
        band[i] = y * envelope[i];
        energy += band[i] * band[i];
      }
      // This band's share of the energy.
      const gain = energy > 0 ? Math.sqrt(share / energy) : 0;
      for (let i = 0; i < length; i += 1) channel[i] += band[i] * gain;
    });
  });
  channels.forEach((channel) => {
    let energy = 0;
    for (let i = 0; i < length; i += 1) energy += channel[i] * channel[i];
    const gain = energy > 0 ? 1 / Math.sqrt(energy) : 0;
    for (let i = 0; i < length; i += 1) channel[i] *= gain;
  });
  return { channels, sampleRate, seconds };
}

// How loud the room's reverberation is for a source at full volume up to
// `distance` (scene units): the reverberant field against the source's
// direct sound, as amplitude. The direct sound at 1 unit from a source is
// 1/4 in the units of reverberantEnergy (a sphere of radius 1 catches
// π / 4π of a unit power at distance 1).
export function sendGain(result, distance) {
  if (!result || !(result.reverberantEnergy > 0) || !(distance > 0)) return 0;
  return Math.min(4, Math.sqrt(4 * distance * distance * result.reverberantEnergy));
}

export function acousticsTransferables(response) {
  return response?.channels?.map((channel) => channel.buffer) || [];
}

// The whole job: trace, then synthesize. For the worker and the main thread.
export function computeRoomAcoustics(geometry, options = {}) {
  const result = traceRoom(geometry, options);
  const response = synthesizeImpulseResponse(result, options.sampleRate || 48000, { seed: (options.seed || 7) + 4 });
  return { result, response };
}
