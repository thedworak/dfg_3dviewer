// The real water round a place, for the generated surroundings on the real
// terrain (editor/surroundings.js, `terrain: "real"`): rivers and streams,
// lakes and the coastline, from the first of these that has any:
//
//   1. a file (`waterUrl`): GeoJSON digitised from an old map by whoever
//      made the model - the water as it was, with `start_date` / `end_date`
//      where it changed (waterGeoJsonToAnswer)
//   2. OpenHistoricalMap (its Overpass API): dated features, kept where
//      they existed in the surroundings' year (filterByYear)
//   3. OpenStreetMap (the Overpass API, a list of servers tried in turn:
//      your own first - docker-compose.yml's `overpass` profile - then the
//      public one): today's water
//
// Left out on purpose:
//   - reservoirs, basins, canals, ponds, ditches: mostly dug or dammed in
//     modern times (Lake Czorsztyn round Niedzica castle filled in 1997)
//   - roads: today's roads say little of medieval ones; the surroundings'
//     roads stay generated
// Rivers move and lakes shrink over centuries: the water is today's, which
// docs/surroundings.md says.
//
// Only the place and a radius go out (in the query). `viewer.surroundings.
// mapUrl` in viewer-settings.json changes the server; null switches the
// map water off.
//
// The features become one signed distance (metres to the water's edge,
// negative in the water), which the layout and the terrain read like the
// generated river's (surroundings-rules.js, layout.water.map).

export const DEFAULT_MAP_URL = "https://overpass-api.de/api/interpreter";
export const DEFAULT_HISTORICAL_MAP_URL = "https://overpass-api.openhistoricalmap.org/api/interpreter";
const MODERN_WATER = "reservoir|basin|canal|pond|wastewater|ditch|fishpond|moat|lock|swimming_pool|stream_pool|reflecting_pool";
// Widths of a river and a stream drawn from their centre line, in metres,
// where OSM gives none.
const WIDTH = { river: 14, stream: 3.5 };
// Distances beyond this are not worked out exactly (the layout and the
// terrain need them near the water only).
const REACH = 220;
const CELL = 60;
const cache = new Map();

// The Overpass query for the water within `radius` metres of a place;
// `dated`: every kind of water (a dated source says when it was there).
export function mapWaterQuery(latitude, longitude, radius, { dated = false } = {}) {
  const around = `(around:${Math.round(radius)},${latitude.toFixed(6)},${longitude.toFixed(6)})`;
  const natural = dated ? '["natural"="water"]' : `["natural"="water"]["water"!~"^(${MODERN_WATER})$"]`;
  return `[out:json][timeout:25];(way["waterway"~"^(river|stream)$"]${around};way${natural}${around};relation${natural}${around};way["natural"="coastline"]${around};);out geom;`;
}

// Metres east and north of a place, turned into the layout's x and z
// (north is -Z turned clockwise by `north` degrees, as the sun study's).
export function mapProjector(latitude, longitude, north = 0) {
  const angle = (north * Math.PI) / 180;
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  const metresEast = 111320 * Math.cos((latitude * Math.PI) / 180);
  const metresNorth = 110540;
  return (lat, lon) => {
    const east = (lon - longitude) * metresEast;
    const northing = (lat - latitude) * metresNorth;
    return [east * cos + northing * sin, east * sin - northing * cos];
  };
}

// The other way: the layout's metres (x, z) back to [longitude, latitude],
// as GeoJSON writes them.
export function mapUnprojector(latitude, longitude, north = 0) {
  const angle = (north * Math.PI) / 180;
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  const metresEast = 111320 * Math.cos((latitude * Math.PI) / 180);
  const metresNorth = 110540;
  return (x, z) => {
    const east = x * cos + z * sin;
    const northing = x * sin - z * cos;
    return [longitude + east / metresEast, latitude + northing / metresNorth];
  };
}

/**
 * The water of an Overpass answer ({ elements } with `out geom`), in the
 * layout's metres: { lines: [{ points, width, kind }], areas: [{ segments,
 * box }], coast: [[x, z], ...] polylines }.
 */
export function readMapWater(answer, project, { modern = false } = {}) {
  const lines = [];
  const areas = [];
  const coast = [];
  const toPoints = (geometry) => (Array.isArray(geometry) ? geometry.filter((node) => Number.isFinite(node?.lat) && Number.isFinite(node?.lon)).map((node) => project(node.lat, node.lon)) : []);
  const area = (rings) => {
    const segments = [];
    rings.forEach((points) => {
      for (let index = 0; index < points.length - 1; index += 1) segments.push([...points[index], ...points[index + 1]]);
    });
    if (!segments.length) return;
    const xs = segments.flatMap((segment) => [segment[0], segment[2]]);
    const zs = segments.flatMap((segment) => [segment[1], segment[3]]);
    areas.push({ segments, box: [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)] });
  };
  const modernWater = new RegExp(`^(${MODERN_WATER})$`);
  (answer?.elements || []).forEach((element) => {
    const tags = element.tags || {};
    // Dammed or dug in modern times (the query leaves them out already);
    // dated sources keep them (a medieval fishpond is history too).
    if (!modern && tags.natural === "water" && modernWater.test(tags.water || "")) return;
    if (element.type === "way" && tags.waterway) {
      const points = toPoints(element.geometry);
      const width = Number.parseFloat(tags.width);
      if (points.length >= 2) lines.push({ points, width: Number.isFinite(width) && width > 0 ? width : WIDTH[tags.waterway] || 4, kind: tags.waterway });
    } else if (element.type === "way" && tags.natural === "coastline") {
      const points = toPoints(element.geometry);
      if (points.length >= 2) coast.push(points);
    } else if (element.type === "way" && tags.natural === "water") {
      const points = toPoints(element.geometry);
      if (points.length >= 3) area([points]);
    } else if (element.type === "relation" && tags.natural === "water") {
      // Outer and inner rings alike: the crossings decide what is inside
      // (an island is outside), so the ways need not be joined.
      area((element.members || []).filter((member) => member.type === "way").map((member) => toPoints(member.geometry)).filter((points) => points.length >= 2));
    }
  });
  return { lines, areas, coast };
}

function segmentDistance(x, z, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const length = dx * dx + dz * dz || 1;
  const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / length));
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
}

/**
 * The water of readMapWater() as functions for the layout:
 *   distance(x, z)   metres to the water's edge, negative in it; beyond
 *                    REACH metres from any edge at least REACH (or -REACH
 *                    far out at sea)
 *   heading(x, z)    the direction (radians) of the nearest river or coast
 *   count            how many features
 * `radius`: how far round the place it is needed.
 */
export function createMapWater(water, radius) {
  const { lines, areas, coast } = water;
  // Every edge in a grid of cells, with what it belongs to.
  const grid = new Map();
  const add = (ax, az, bx, bz, entry) => {
    const x0 = Math.floor((Math.min(ax, bx) - REACH) / CELL);
    const x1 = Math.floor((Math.max(ax, bx) + REACH) / CELL);
    const z0 = Math.floor((Math.min(az, bz) - REACH) / CELL);
    const z1 = Math.floor((Math.max(az, bz) + REACH) / CELL);
    // Edges far outside the area are not needed.
    if (x1 * CELL < -radius - REACH || x0 * CELL > radius + REACH || z1 * CELL < -radius - REACH || z0 * CELL > radius + REACH) return;
    for (let cx = Math.max(x0, Math.floor((-radius - REACH) / CELL)); cx <= Math.min(x1, Math.floor((radius + REACH) / CELL)); cx += 1) {
      for (let cz = Math.max(z0, Math.floor((-radius - REACH) / CELL)); cz <= Math.min(z1, Math.floor((radius + REACH) / CELL)); cz += 1) {
        const key = `${cx},${cz}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push([ax, az, bx, bz, entry]);
      }
    }
  };
  lines.forEach((line) => {
    for (let index = 0; index < line.points.length - 1; index += 1) add(...line.points[index], ...line.points[index + 1], { kind: "line", half: line.width / 2 });
  });
  areas.forEach((entry) => entry.segments.forEach(([ax, az, bx, bz]) => add(ax, az, bx, bz, { kind: "area" })));
  coast.forEach((points) => {
    for (let index = 0; index < points.length - 1; index += 1) add(...points[index], ...points[index + 1], { kind: "coast" });
  });

  const insideArea = (x, z) => areas.some(({ segments, box }) => {
    if (x < box[0] || x > box[2] || z < box[1] || z > box[3]) return false;
    let inside = false;
    for (const [ax, az, bx, bz] of segments) {
      if ((az > z) !== (bz > z) && x < ax + ((z - az) * (bx - ax)) / (bz - az)) inside = !inside;
    }
    return inside;
  });
  // On the sea's side of the nearest coast: OSM draws the coastline with
  // the land on its left and the water on its right (looking along it, in
  // east and north); the layout's z points south, so in x and z the water
  // is on the left.
  const coastSide = (x, z, segment) => {
    const [ax, az, bx, bz] = segment;
    return (bx - ax) * (z - az) - (bz - az) * (x - ax) > 0;
  };
  // Far from any coast: which side, from a coarse grid worked out once.
  let seaGrid = null;
  const seaCell = 100;
  const nearestCoast = (x, z, limit) => {
    let best = null;
    let bestDistance = limit;
    coast.forEach((points) => {
      for (let index = 0; index < points.length - 1; index += 1) {
        const distance = segmentDistance(x, z, ...points[index], ...points[index + 1]);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = [...points[index], ...points[index + 1]];
        }
      }
    });
    return best;
  };
  const farAtSea = (x, z) => {
    if (!coast.length) return false;
    if (!seaGrid) {
      seaGrid = new Map();
      const span = Math.ceil((radius + REACH) / seaCell);
      for (let cx = -span; cx <= span; cx += 1) {
        for (let cz = -span; cz <= span; cz += 1) {
          const px = (cx + 0.5) * seaCell;
          const pz = (cz + 0.5) * seaCell;
          const segment = nearestCoast(px, pz, Infinity);
          seaGrid.set(`${cx},${cz}`, segment ? coastSide(px, pz, segment) : false);
        }
      }
    }
    return seaGrid.get(`${Math.floor(x / seaCell)},${Math.floor(z / seaCell)}`) === true;
  };

  const nearest = (x, z) => {
    const edges = grid.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`);
    let line = Infinity;
    let edge = Infinity;
    let coastDistance = Infinity;
    let coastSegment = null;
    let heading = null;
    let headingDistance = Infinity;
    (edges || []).forEach(([ax, az, bx, bz, entry]) => {
      const distance = segmentDistance(x, z, ax, az, bx, bz);
      if (entry.kind === "line") line = Math.min(line, distance - entry.half);
      else if (entry.kind === "area") edge = Math.min(edge, distance);
      else if (distance < coastDistance) {
        coastDistance = distance;
        coastSegment = [ax, az, bx, bz];
      }
      if (entry.kind !== "area" && distance < headingDistance) {
        headingDistance = distance;
        heading = Math.atan2(bz - az, bx - ax);
      }
    });
    return { line, edge, coastDistance, coastSegment, heading };
  };

  const distance = (x, z) => {
    const { line, edge, coastDistance, coastSegment } = nearest(x, z);
    let best = Math.min(line, REACH);
    if (areas.length) {
      const inside = insideArea(x, z);
      if (inside) best = Math.min(best, -Math.min(edge, REACH));
      else best = Math.min(best, edge);
    }
    if (coastSegment) best = Math.min(best, coastSide(x, z, coastSegment) ? -coastDistance : coastDistance);
    else if (farAtSea(x, z)) best = Math.min(best, -REACH);
    return best;
  };
  return {
    distance,
    heading: (x, z) => nearest(x, z).heading,
    count: lines.length + areas.length + coast.length,
  };
}

// The first year in a date ("1350", "1350-05-01", "~1350", "c. 1350");
// null for none.
export function dateYear(value) {
  const match = String(value ?? "").match(/-?\d{3,4}/);
  return match ? Number(match[0]) : null;
}

// The elements that existed in `year`: from their start (or always) until
// before their end (or still). Undated ones are kept.
export function filterByYear(answer, year) {
  if (!Number.isFinite(year)) return answer;
  const existed = (tags = {}) => {
    const start = dateYear(tags.start_date);
    const end = dateYear(tags.end_date);
    return (start == null || start <= year) && (end == null || end > year);
  };
  return { ...answer, elements: (answer?.elements || []).filter((element) => existed(element.tags)) };
}

// A GeoJSON FeatureCollection - an old map digitised - as an Overpass
// answer. A feature's properties are OSM's tags or a `kind`:
//   water   "river", "stream" (lines, `width` in metres), "lake", "sea"
//           (polygons; holes are islands), "coastline" (a line, the water
//           on its right)
//   layout  "road" (a line, `width`), "field" (a polygon), "building" (a
//           polygon; `height` in metres, `roof` gable | pyramid | onion |
//           none, `role` house | church | tower), "wall", "palisade",
//           "rampart" (lines)
// `start_date` / `end_date` (a year, or a date starting with one) say when
// a feature existed. A line of no kind and no tags is taken for a river.
export function mapGeoJsonToAnswer(geojson) {
  const elements = [];
  const node = ([lon, lat]) => ({ lat, lon });
  const features = geojson?.type === "FeatureCollection" ? geojson.features : geojson?.type === "Feature" ? [geojson] : [];
  const KINDS = {
    river: { waterway: "river" },
    stream: { waterway: "stream" },
    lake: { natural: "water" },
    sea: { natural: "water" },
    coastline: { natural: "coastline" },
    road: { highway: "road" },
    field: { landuse: "farmland" },
    building: { building: "yes" },
    wall: { barrier: "city_wall", surroundings_wall: "masonry" },
    palisade: { barrier: "wall", surroundings_wall: "palisade" },
    rampart: { barrier: "city_wall", surroundings_wall: "rampart" },
  };
  (features || []).forEach((feature, index) => {
    const props = feature?.properties || {};
    const geometry = feature?.geometry;
    if (!geometry) return;
    const tags = { ...props, ...(KINDS[props.kind] || {}) };
    if (props.width != null) tags.width = String(props.width);
    const known = ["waterway", "natural", "highway", "landuse", "building", "barrier"].some((key) => tags[key]);
    const lines = geometry.type === "LineString" ? [geometry.coordinates] : geometry.type === "MultiLineString" ? geometry.coordinates : [];
    lines.forEach((coordinates) => elements.push({ type: "way", id: `file-${index}`, tags: known ? tags : { ...tags, waterway: "river" }, geometry: coordinates.map(node) }));
    const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
    polygons.forEach((rings) => elements.push({
      type: "relation",
      id: `file-${index}`,
      tags: known ? tags : { ...tags, natural: "water" },
      members: rings.map((ring, ringIndex) => ({ type: "way", role: ringIndex ? "inner" : "outer", geometry: ring.map(node) })),
    }));
  });
  return { elements };
}

// Kept for the water file's name.
export const waterGeoJsonToAnswer = mapGeoJsonToAnswer;

function hull(points) {
  const sorted = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (sorted.length < 3) return sorted;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list) => {
    const out = [];
    list.forEach((point) => {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], point) <= 0) out.pop();
      out.push(point);
    });
    return out;
  };
  const lower = half(sorted);
  const upper = half(sorted.slice().reverse());
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

// The smallest rectangle round points, turned any way: { x, z, w, d, angle }
// - `w` along `angle`.
export function minimumRectangle(points) {
  const outline = hull(points);
  let best = null;
  for (let index = 0; index < outline.length; index += 1) {
    const [ax, az] = outline[index];
    const [bx, bz] = outline[(index + 1) % outline.length];
    const angle = Math.atan2(bz - az, bx - ax);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    let minU = Infinity;
    let maxU = -Infinity;
    let minV = Infinity;
    let maxV = -Infinity;
    outline.forEach(([x, z]) => {
      const u = x * cos + z * sin;
      const v = -x * sin + z * cos;
      minU = Math.min(minU, u);
      maxU = Math.max(maxU, u);
      minV = Math.min(minV, v);
      maxV = Math.max(maxV, v);
    });
    const area = (maxU - minU) * (maxV - minV);
    if (!best || area < best.area) {
      const u = (minU + maxU) / 2;
      const v = (minV + maxV) / 2;
      best = { area, x: u * cos - v * sin, z: u * sin + v * cos, w: maxU - minU, d: maxV - minV, angle };
    }
  }
  if (!best) return null;
  const { area: _area, ...rectangle } = best;
  return rectangle;
}

/**
 * An old map's layout in an answer (mapGeoJsonToAnswer, of the year: filter
 * it with filterByYear first), in the layout's metres: { roads: [{ points,
 * width }], fields: [{ polygon, x, z, w, d, angle, tone }], buildings:
 * [block], walls: [{ points, kind }] } - as surroundings-rules.js's
 * layoutSurroundings(params, { mapLayout }) reads them.
 */
export function readMapLayout(answer, project) {
  const roads = [];
  const fields = [];
  const buildings = [];
  const walls = [];
  const toPoints = (geometry) => (Array.isArray(geometry) ? geometry.filter((item) => Number.isFinite(item?.lat) && Number.isFinite(item?.lon)).map((item) => project(item.lat, item.lon)) : []);
  const outer = (element) => (element.type === "way" ? toPoints(element.geometry) : toPoints((element.members || []).find((member) => member.role !== "inner")?.geometry));
  (answer?.elements || []).forEach((element, index) => {
    const tags = element.tags || {};
    if (tags.highway && element.type === "way") {
      const points = toPoints(element.geometry);
      const width = Number.parseFloat(tags.width);
      if (points.length >= 2) roads.push({ points, width: Number.isFinite(width) && width > 0 ? width : ["primary", "secondary", "trunk"].includes(tags.highway) ? 7 : 4.5 });
    } else if ((tags.barrier || tags.surroundings_wall) && element.type === "way") {
      const points = toPoints(element.geometry);
      const kind = ["masonry", "palisade", "rampart"].includes(tags.surroundings_wall) ? tags.surroundings_wall : "masonry";
      if (points.length >= 2) walls.push({ points, kind });
    } else if (tags.landuse === "farmland" || tags.landuse === "meadow") {
      const ring = outer(element);
      if (ring.length < 3) return;
      const polygon = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring;
      const rectangle = minimumRectangle(polygon);
      if (rectangle) fields.push({ ...rectangle, polygon, tone: index % 3 });
    } else if (tags.building) {
      const ring = outer(element);
      if (ring.length < 3) return;
      const rectangle = minimumRectangle(ring);
      if (!rectangle || rectangle.w < 1 || rectangle.d < 1) return;
      const role = ["church", "tower", "house", "station", "factory", "chimney"].includes(tags.role) ? tags.role : tags.building === "church" ? "church" : "house";
      const levels = Number.parseFloat(tags["building:levels"]);
      const height = Number.parseFloat(tags.height);
      const h = Number.isFinite(height) && height > 0 ? height : Number.isFinite(levels) ? levels * 3 : role === "church" ? 12 : role === "tower" ? 20 : 5;
      const roof = ["gable", "pyramid", "onion", "none", "sawtooth"].includes(tags.roof) ? tags.roof : role === "tower" ? "pyramid" : "gable";
      // The ridge along the longer side.
      buildings.push({ ...rectangle, h, roof, roofHeight: roof === "none" ? 0 : Math.min(rectangle.w, rectangle.d) * (roof === "pyramid" ? 0.8 : 0.6), ridge: rectangle.w >= rectangle.d ? "w" : "d", role });
    }
  });
  return { roads, fields, buildings, walls };
}

// A server that does not answer in time is given up (the next source is
// asked).
const TIMEOUT = 25000;

async function overpass(url, query) {
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), TIMEOUT) : null;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
      credentials: "omit",
      signal: controller?.signal,
    });
    if (!response.ok) throw new Error(`Overpass ${response.status}: ${url}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

// A query asked of the servers in turn (the first that answers), once per
// `key`; rejects if none does.
export async function askOverpass(urls, query, key) {
  let failure = null;
  for (const url of urls || []) {
    try {
      return await once(`${key}|${url}`, () => overpass(url, query));
    } catch (error) {
      failure = error;
    }
  }
  throw failure || new Error("No map server");
}

const hasWater = (answer) => (answer?.elements || []).some((element) => element.tags?.waterway || element.tags?.natural === "water" || element.tags?.natural === "coastline");

/**
 * The water round a place from the first source that has any (see the top
 * of this file): { source: "file" | "historical" | "today", answer,
 * dated } - `dated`: filter it by the year (filterByYear) before use.
 * Each source is fetched once whatever the year; asked again for another
 * year, the choice is made again from what is loaded.
 *   fileUrl          GeoJSON of the water (waterGeoJsonToAnswer)
 *   historicalUrl    OpenHistoricalMap's Overpass API (null: skipped)
 *   mapUrls          OpenStreetMap's Overpass APIs, tried in turn
 *   year             the surroundings' year: the historical source counts
 *                    only if it has water in that year
 */
export async function loadWaterSources({ latitude, longitude, radius, year = null, fileUrl = null, historicalUrl = DEFAULT_HISTORICAL_MAP_URL, mapUrls = [DEFAULT_MAP_URL] }) {
  const place = [latitude.toFixed(5), longitude.toFixed(5), Math.round(radius)].join("|");
  const inYear = (answer) => hasWater(Number.isFinite(year) ? filterByYear(answer, year) : answer);
  if (fileUrl) {
    try {
      const answer = await once(`file|${fileUrl}`, async () => {
        const response = await fetch(fileUrl, { credentials: "omit" });
        if (!response.ok) throw new Error(`Water file ${response.status}: ${fileUrl}`);
        return waterGeoJsonToAnswer(await response.json());
      });
      if (inYear(answer)) return { source: "file", answer, dated: true };
    } catch (error) {
      console.warn("The water file could not be read; the maps instead", error);
    }
  }
  if (historicalUrl) {
    try {
      const answer = await once(`historical|${historicalUrl}|${place}`, () => overpass(historicalUrl, mapWaterQuery(latitude, longitude, radius, { dated: true })));
      if (inYear(answer)) return { source: "historical", answer, dated: true };
    } catch (error) {
      console.warn("OpenHistoricalMap could not be asked; today's water instead", error);
    }
  }
  let failure = null;
  for (const url of mapUrls) {
    try {
      const answer = await once(`today|${url}|${place}`, () => overpass(url, mapWaterQuery(latitude, longitude, radius)));
      return { source: "today", answer, dated: false };
    } catch (error) {
      failure = error;
    }
  }
  throw failure || new Error("No map server");
}

// OpenHistoricalMap's roads, buildings, fields and town walls round a place
// (dated; filter them by the year): fetched once.
export function historicalLayoutQuery(latitude, longitude, radius) {
  const around = `(around:${Math.round(radius)},${latitude.toFixed(6)},${longitude.toFixed(6)})`;
  return `[out:json][timeout:25];(way["highway"]${around};way["building"]${around};relation["building"]${around};way["landuse"~"^(farmland|meadow)$"]${around};way["barrier"="city_wall"]${around};);out geom;`;
}

export function loadHistoricalLayout({ latitude, longitude, radius, url = DEFAULT_HISTORICAL_MAP_URL }) {
  const place = [latitude.toFixed(5), longitude.toFixed(5), Math.round(radius)].join("|");
  return once(`historical-layout|${url}|${place}`, () => overpass(url, historicalLayoutQuery(latitude, longitude, radius)));
}

// An old map's layout (GeoJSON, mapGeoJsonToAnswer): fetched once.
export function loadMapLayout(url) {
  return once(`layout|${url}`, async () => {
    const response = await fetch(url, { credentials: "omit" });
    if (!response.ok) throw new Error(`Layout file ${response.status}: ${url}`);
    return mapGeoJsonToAnswer(await response.json());
  });
}

// Each source fetched once (whatever the year); a failure is not kept.
function once(key, load) {
  if (cache.has(key)) return cache.get(key);
  const promise = load();
  cache.set(key, promise);
  promise.catch(() => cache.delete(key));
  return promise;
}
