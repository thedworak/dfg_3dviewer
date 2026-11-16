import { askOverpass, dateYear } from "./surroundings-map.js";
import { worldPixel } from "./surroundings-terrain.js";

// The terrain as it was (editor/surroundings.js, the real terrain): today's
// elevation shows what was made later - a reservoir's lake over an old
// valley, a quarry's pit, a spoil heap or a landfill, a dam or an
// embankment across the land. Their outlines come from OpenStreetMap (the
// same Overpass servers as the water); for a year before each was made, the
// ground within its outline is drawn again from the ground round it.
//
// What is put back is an estimate: a pit filled and a heap taken down to
// the level round them, a dam or an embankment to the ground on either
// side; under a reservoir a valley sinking towards its middle (the lake
// hides the old floor: its depth is guessed from its size).
//
// Pure: no three.js.

// The kinds, and the year taken where the map gives no `start_date`
// (most reservoirs and large quarries are of the 20th century; spoil heaps
// and embankments of the railways and the mines of the 19th).
export const TERRAIN_CHANGE_YEARS = { reservoir: 1900, dam: 1900, quarry: 1850, landfill: 1950, heap: 1850, embankment: 1850 };
// A line's width (metres): a dam, an embankment.
const LINE_WIDTHS = { dam: 30, embankment: 14 };

export function terrainChangesQuery(latitude, longitude, radius) {
  const around = `(around:${Math.round(radius)},${latitude.toFixed(6)},${longitude.toFixed(6)})`;
  return `[out:json][timeout:25];(way["water"~"^(reservoir|basin)$"]${around};relation["water"~"^(reservoir|basin)$"]${around};way["landuse"~"^(reservoir|basin|quarry|landfill)$"]${around};relation["landuse"~"^(quarry|landfill)$"]${around};way["waterway"="dam"]${around};way["man_made"~"^(spoil_heap|embankment|dyke)$"]${around};);out geom;`;
}

// The later changes round a place, from the first server that answers
// (OpenStreetMap's Overpass: viewer.surroundings.mapUrl), once per place.
export async function loadTerrainChanges({ latitude, longitude, radius, mapUrls }) {
  const place = [latitude.toFixed(5), longitude.toFixed(5), Math.round(radius)].join("|");
  return readTerrainChanges(await askOverpass(mapUrls, terrainChangesQuery(latitude, longitude, radius), `terrain-changes|${place}`));
}

function kindOf(tags = {}) {
  if (tags.water === "reservoir" || tags.water === "basin" || tags.landuse === "reservoir" || tags.landuse === "basin") return "reservoir";
  if (tags.waterway === "dam") return "dam";
  if (tags.landuse === "quarry") return "quarry";
  if (tags.landuse === "landfill") return "landfill";
  if (tags.man_made === "spoil_heap") return "heap";
  if (tags.man_made === "embankment" || tags.man_made === "dyke") return "embankment";
  return null;
}

/**
 * The later changes of an Overpass answer (`out geom`): [{ id, kind, year,
 * dated, ring: [[lat, lon], ...] (closed) | null, line: [[lat, lon], ...] |
 * null, width }]. `year`: when it was made (start_date, else the kind's).
 */
export function readTerrainChanges(answer) {
  const changes = [];
  (answer?.elements || []).forEach((element) => {
    const kind = kindOf(element.tags);
    if (!kind) return;
    const start = dateYear(element.tags?.start_date ?? element.tags?.["construction:start_date"]);
    const year = start ?? TERRAIN_CHANGE_YEARS[kind];
    const points = (geometry) => (geometry || []).map((node) => [node.lat, node.lon]);
    const ways = element.type === "relation"
      ? (element.members || []).filter((member) => member.role !== "inner").map((member) => points(member.geometry))
      : [points(element.geometry)];
    ways.forEach((list, index) => {
      if (list.length < 2) return;
      const closed = list.length > 3 && list[0][0] === list.at(-1)[0] && list[0][1] === list.at(-1)[1];
      const id = `${element.type}/${element.id}${ways.length > 1 ? `#${index}` : ""}`;
      if (closed && kind !== "dam" && kind !== "embankment") changes.push({ id, kind, year, dated: start != null, ring: list, line: null, width: 0 });
      else changes.push({ id, kind, year, dated: start != null, ring: null, line: list, width: LINE_WIDTHS[kind] || 14 });
    });
  });
  return changes;
}

// The changes not yet made in `year` (null: none).
export function changesBefore(changes, year) {
  return Number.isFinite(year) ? (changes || []).filter((change) => change.year > year) : [];
}

/**
 * Today's elevation (surroundings-terrain.js, loadElevation) with the
 * `changes` taken away: a new elevation (the same grid, its own heights),
 * or the same one where there is nothing to take away.
 *   place   { latitude, longitude } the elevation is round
 */
export function restoreElevation(elevation, changes, place) {
  if (!changes?.length) return elevation;
  const { width, height, zoom, origin } = elevation;
  const heights = new Float32Array(elevation.heights);
  const centre = worldPixel(place.latitude, place.longitude, zoom);
  const toGrid = ([lat, lon]) => {
    const world = worldPixel(lat, lon, zoom);
    return [world.x - centre.x + origin.x, world.y - centre.y + origin.y];
  };
  const sample = (x, y) => {
    const ix = Math.min(Math.max(Math.round(x), 0), width - 1);
    const iy = Math.min(Math.max(Math.round(y), 0), height - 1);
    return heights[iy * width + ix];
  };
  const mpp = elevation.metresPerPixel;
  // Reservoirs first: a dam across one is then put back from the valley.
  const order = { reservoir: 0, quarry: 1, landfill: 1, heap: 1, embankment: 2, dam: 3 };
  [...changes].sort((a, b) => order[a.kind] - order[b.kind]).forEach((change) => {
    if (change.ring) restoreArea(change, change.ring.map(toGrid));
    else restoreLine(change, change.line.map(toGrid));
  });
  return { ...elevation, heights, restored: changes.length };

  // Inverse-distance from samples round the outline; a reservoir's valley
  // sinks towards its middle.
  function restoreArea(change, ring) {
    const xs = ring.map(([x]) => x);
    const ys = ring.map(([, y]) => y);
    const box = [Math.floor(Math.min(...xs)) - 1, Math.floor(Math.min(...ys)) - 1, Math.ceil(Math.max(...xs)) + 1, Math.ceil(Math.max(...ys)) + 1];
    if (box[2] < 0 || box[3] < 0 || box[0] >= width || box[1] >= height) return;
    const cx = xs.reduce((sum, x) => sum + x, 0) / xs.length;
    const cy = ys.reduce((sum, y) => sum + y, 0) / ys.length;
    // Samples just outside the outline, along it.
    const samples = [];
    for (let index = 0; index < ring.length - 1; index += 1) {
      const [ax, ay] = ring[index];
      const [bx, by] = ring[index + 1];
      const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)));
      for (let step = 0; step < steps; step += 1) {
        const x = ax + ((bx - ax) * step) / steps;
        const y = ay + ((by - ay) * step) / steps;
        const out = Math.hypot(x - cx, y - cy) || 1;
        const sx = x + ((x - cx) / out) * 2;
        const sy = y + ((y - cy) / out) * 2;
        samples.push([sx, sy, sample(sx, sy)]);
      }
    }
    const stride = Math.max(1, Math.floor(samples.length / 96));
    const used = samples.filter((_item, index) => index % stride === 0);
    if (!used.length) return;
    const inside = (x, y) => {
      let hit = false;
      for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
        const [ax, ay] = ring[index];
        const [bx, by] = ring[previous];
        if ((ay > y) !== (by > y) && x < ax + ((y - ay) * (bx - ax)) / (by - ay)) hit = !hit;
      }
      return hit;
    };
    // How deep an old valley under a lake: a tenth of its size, 3-25 m.
    const area = Math.abs(ring.reduce((sum, [x, y], index) => {
      const [nx, ny] = ring[(index + 1) % ring.length];
      return sum + x * ny - nx * y;
    }, 0) / 2) * mpp * mpp;
    const depth = change.kind === "reservoir" ? Math.min(25, Math.max(3, Math.sqrt(area) * 0.1)) : 0;
    const reach = Math.max(1, Math.sqrt(area) / mpp / 2);
    for (let y = Math.max(0, box[1]); y <= Math.min(height - 1, box[3]); y += 1) {
      for (let x = Math.max(0, box[0]); x <= Math.min(width - 1, box[2]); x += 1) {
        if (!inside(x + 0.5, y + 0.5)) continue;
        let weight = 0;
        let sum = 0;
        let nearest = Infinity;
        used.forEach(([sx, sy, value]) => {
          const d2 = (sx - x - 0.5) ** 2 + (sy - y - 0.5) ** 2 + 0.25;
          nearest = Math.min(nearest, d2);
          weight += 1 / d2;
          sum += value / d2;
        });
        const toEdge = Math.sqrt(nearest);
        const sink = depth * Math.min(1, toEdge / reach) ** 0.8;
        heights[y * width + x] = sum / weight - sink;
      }
    }
  }

  // A dam or an embankment: within its width, the ground of either side.
  function restoreLine(change, line) {
    const half = change.width / 2 / mpp + 0.5;
    const segments = [];
    for (let index = 0; index < line.length - 1; index += 1) segments.push([line[index], line[index + 1]]);
    const xs = line.map(([x]) => x);
    const ys = line.map(([, y]) => y);
    const box = [Math.floor(Math.min(...xs) - half - 1), Math.floor(Math.min(...ys) - half - 1), Math.ceil(Math.max(...xs) + half + 1), Math.ceil(Math.max(...ys) + half + 1)];
    if (box[2] < 0 || box[3] < 0 || box[0] >= width || box[1] >= height) return;
    const updates = [];
    for (let y = Math.max(0, box[1]); y <= Math.min(height - 1, box[3]); y += 1) {
      for (let x = Math.max(0, box[0]); x <= Math.min(width - 1, box[2]); x += 1) {
        let best = null;
        segments.forEach(([[ax, ay], [bx, by]]) => {
          const dx = bx - ax;
          const dy = by - ay;
          const length = dx * dx + dy * dy || 1;
          const t = Math.min(1, Math.max(0, ((x + 0.5 - ax) * dx + (y + 0.5 - ay) * dy) / length));
          const px = ax + dx * t;
          const py = ay + dy * t;
          const distance = Math.hypot(x + 0.5 - px, y + 0.5 - py);
          if (!best || distance < best.distance) best = { distance, px, py, nx: -dy / Math.sqrt(length), ny: dx / Math.sqrt(length) };
        });
        if (!best || best.distance > half) continue;
        // The ground just beyond either side, mixed by how near each is.
        const side = (sign) => sample(best.px + best.nx * (half + 1.5) * sign, best.py + best.ny * (half + 1.5) * sign);
        const along = (x + 0.5 - best.px) * best.nx + (y + 0.5 - best.py) * best.ny;
        const t = Math.min(1, Math.max(0, (along + half) / (2 * half)));
        updates.push([y * width + x, side(-1) * (1 - t) + side(1) * t]);
      }
    }
    updates.forEach(([index, value]) => {
      heights[index] = value;
    });
  }
}
