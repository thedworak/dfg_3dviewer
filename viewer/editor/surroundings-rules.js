// Generated surroundings: a typical setting around the model - a settlement,
// fields, a forest - worked out from its metadata alone (what it is, its
// century, its region). Pure: no three.js, no viewer. Two steps:
//
//   suggestSurroundings(facts)   metadata -> parameters { kind, period, year,
//                                season, seed, density }, or why not
//   layoutSurroundings(params)   parameters -> a layout in metres around the
//                                model at the origin: blocks (houses, a
//                                church, towers), walls, roads, fields, trees
//
// editor/surroundings.js draws the layout. The same parameters always give
// the same layout (the seed), so a manifest stores the parameters only.
//
// What is generated is a hypothesis about the kind of place, not about this
// place: nothing here knows where a real road ran. It is drawn schematically
// and marked as generated for that reason.
//
// Covered so far: Central Europe, about 900-1945. Other periods and regions
// get no surroundings rather than wrong ones.

export const SURROUNDINGS_KINDS = ["castle", "town", "church", "village"];
export const SURROUNDINGS_PERIODS = ["early-medieval", "medieval", "early-modern", "industrial", "modern"];
// The years covered.
export const SURROUNDINGS_YEARS = [900, 1945];
export const SURROUNDINGS_SEASONS = ["spring", "summer", "autumn", "winter"];
// How they are drawn (editor/surroundings.js): plain pale shapes, or with
// the materials, openings, vegetation and haze of the period. Both are
// marked as generated.
export const SURROUNDINGS_STYLES = ["schematic", "realistic"];
// The ground: generated low hills, or the real terrain of the place from
// elevation data (editor/surroundings-terrain.js; needs `latitude` and
// `longitude`).
export const SURROUNDINGS_TERRAINS = ["generated", "real"];
// What masonry is built of: brick on the northern lowlands (brick Gothic),
// stone in the uplands and mountains to the south.
export const SURROUNDINGS_MASONRY = ["brick", "stone"];
export const SURROUNDINGS_DEFAULTS = {
  kind: "castle", period: "medieval", year: 1350, season: "summer", seed: 1, density: 0.6, style: "schematic",
  water: true, terrain: "generated", latitude: null, longitude: null, masonry: "brick",
  // Following the 4D timeline's year (editor/surroundings.js): the period
  // and how far the settlement has grown (`growth`, 0-1, of its houses).
  followTimeline: false, growth: 1,
  // GeoJSON of the water as it was, digitised from an old map
  // (editor/surroundings-map.js): used before any map on the real terrain.
  waterUrl: null,
  // GeoJSON of an old map's roads, fields, buildings and walls (with dates)
  // that take the place of the generated ones (surroundings-map.js).
  layoutUrl: null,
  // An old map's tiles draped over the ground: { url ({z}/{x}/{y}),
  // opacity, attribution } (surroundings-terrain.js, loadMapOverlay).
  mapOverlay: null,
};

// Stone or brick for a place: stone south of the Sudetes and the
// Carpathians' foothills, in Bohemia and Moravia, in southern and western
// Germany; brick on the lowlands to the north (Pomerania, Prussia, Greater
// Poland, Masovia, Silesia, Lesser Poland's brick towns). A rough line, said
// so in the reasons.
export function surroundingsMasonry(location) {
  if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) return null;
  const { latitude: lat, longitude: lon } = location;
  if (lat < 49.6) return "stone";
  if (lat < 50.9 && lon >= 12 && lon <= 17.2) return "stone";
  if (lat < 50.5 && lon < 12) return "stone";
  return "brick";
}

// How far a settlement has grown by a year (0-1 of its houses): from a
// third at the start of its period to all of them at its end.
export function surroundingsGrowth(year) {
  if (!Number.isFinite(year)) return 1;
  const [start, end] = year < 1250 ? [900, 1250] : year < 1550 ? [1250, 1550] : year <= 1800 ? [1550, 1800] : year <= 1914 ? [1800, 1914] : [1914, 1945];
  return Math.round((0.35 + 0.65 * smoothstep(start, end, year)) * 20) / 20;
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Stems in text made lower case without diacritics (scene-rules.js,
// normalizeSceneText); `=word` only as a whole word. The first kind found,
// in this order, wins: a castle's text often names its town too.
const KIND_WORDS = {
  castle: ["castle", "zamek", "zamk", "=burg", "burgruine", "fortress", "twierdz", "festung", "stronghold", "=grod", "grodzisk", "burgwall", "=keep", "donjon", "warowni"],
  town: ["=town", "=city", "miasto", "miast", "=stadt", "rynek", "marktplatz", "town hall", "ratusz", "rathaus", "kamienic", "tenement", "burgher", "mieszczan", "stadtmauer", "mury miejskie", "cathedral", "katedr", "kathedral"],
  church: ["church", "kosciol", "kosciel", "kirche", "chapel", "kaplic", "kapelle", "monaster", "klasztor", "kloster", "abbey", "opactw"],
  village: ["village", "=wies", "=wsi", "=dorf", "cottage", "chalup", "chata", "farmstead", "zagrod", "gehoft", "=mill", "mlyn", "muhle", "barn", "stodol", "scheune", "manor", "=dwor", "gutshaus"],
};

const KIND_PATTERNS = Object.fromEntries(Object.entries(KIND_WORDS).map(([kind, words]) => [kind, words.map((entry) => {
  const whole = entry.startsWith("=");
  const word = (whole ? entry.slice(1) : entry).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${word}${whole ? "(?![a-z0-9])" : ""}`);
})]));

export function findSurroundingsKind(normalizedText) {
  const text = String(normalizedText || "");
  return SURROUNDINGS_KINDS.find((kind) => KIND_PATTERNS[kind].some((pattern) => pattern.test(text))) || null;
}

export function surroundingsPeriod(year) {
  if (!Number.isFinite(year)) return null;
  if (year >= 900 && year < 1250) return "early-medieval";
  if (year >= 1250 && year < 1550) return "medieval";
  if (year >= 1550 && year <= 1800) return "early-modern";
  if (year > 1800 && year <= 1914) return "industrial";
  if (year > 1914 && year <= 1945) return "modern";
  return null;
}

// Central Europe, roughly: the Rhine to the Bug, the Alps to the Baltic.
export function inSurroundingsRegion(location) {
  return Boolean(location) && location.latitude >= 45 && location.latitude <= 57 && location.longitude >= 5 && location.longitude <= 30;
}

// FNV-1a, 32 bits.
export function surroundingsSeed(text) {
  let hash = 0x811c9dc5;
  const value = String(text || "");
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * The surroundings for a model's facts: { value, reasons, confidence }.
 * `value.enabled` false with the reason where none can be generated.
 *
 *   normalizedText  the texts, normalised (scene-rules.js)
 *   year            { year, source } or null
 *   location        { latitude, longitude } or null
 *   sizeClass       "object" | "large-object" | "building" | "site" | null
 *   season          a season the texts name, or null
 *   unitSource      where the model's unit came from ("default": unknown)
 */
export function suggestSurroundings({ normalizedText = "", year = null, location = null, sizeClass = null, season = null, unitSource = null } = {}) {
  const off = (key, extra = {}) => ({ value: { enabled: false }, reasons: [{ key, ...extra }], confidence: 0.7 });
  if (sizeClass !== "building" && sizeClass !== "site") return off("surroundingsSmall");
  const kind = findSurroundingsKind(normalizedText);
  if (!kind) return off("surroundingsNoType");
  if (!year) return off("surroundingsNoYear");
  const period = surroundingsPeriod(year.year);
  if (!period) return off("surroundingsOtherPeriod", { year: year.year });
  if (location && !inSurroundingsRegion(location)) return off("surroundingsOtherRegion");

  const reasons = [
    { key: "surroundingsType", kind },
    { key: "surroundingsPeriod", period, year: year.year },
    { key: "surroundingsTypical" },
  ];
  let confidence = 0.9;
  if (year.source === "century") confidence *= 0.9;
  if (!location) {
    confidence *= 0.8;
    reasons.push({ key: "surroundingsNoPlace" });
  }
  if (location) reasons.push({ key: "surroundingsTerrainReal" });
  const masonry = surroundingsMasonry(location);
  if (masonry) reasons.push({ key: "surroundingsMasonry", masonry });
  if (year.source === "timeline") reasons.push({ key: "surroundingsTimeline" });
  if (kind === "castle") reasons.push({ key: "surroundingsMoat" });
  // The houses are in metres: against a model of an unknown unit their
  // scale is a guess.
  if (unitSource === "default") {
    confidence *= 0.6;
    reasons.push({ key: "surroundingsUnitUnknown" });
  }
  return {
    value: {
      enabled: true,
      kind,
      period,
      year: year.year,
      season: SURROUNDINGS_SEASONS.includes(season) ? season : "summer",
      seed: surroundingsSeed(`${kind}|${year.year}|${normalizedText.slice(0, 400)}`),
      density: SURROUNDINGS_DEFAULTS.density,
      water: true,
      // The real terrain where the place is known.
      ...(location ? { terrain: "real", latitude: location.latitude, longitude: location.longitude } : { terrain: "generated" }),
      masonry: surroundingsMasonry(location) || SURROUNDINGS_DEFAULTS.masonry,
      // A year from the timeline: the surroundings follow it.
      followTimeline: year.source === "timeline",
      growth: year.source === "timeline" ? surroundingsGrowth(year.year) : 1,
    },
    reasons,
    confidence,
  };
}

// An old map's tiles: a URL with {z}, {x} and {y}; opacity 0-1 (0.85);
// the attribution its licence asks for. Null if not usable.
export function normalizeMapOverlay(overlay) {
  if (!overlay || typeof overlay !== "object" || typeof overlay.url !== "string") return null;
  const url = overlay.url.trim();
  if (!["{z}", "{x}", "{y}"].every((part) => url.includes(part))) return null;
  return {
    url,
    opacity: Number.isFinite(overlay.opacity) ? clamp(overlay.opacity, 0, 1) : 0.85,
    attribution: typeof overlay.attribution === "string" ? overlay.attribution.trim() : "",
  };
}

// Parameters as stored: the known keys, valid, the rest defaulted.
export function normalizeSurroundings(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const year = Number.isFinite(source.year) ? Math.round(source.year) : SURROUNDINGS_DEFAULTS.year;
  const placed = Number.isFinite(source.latitude) && Math.abs(source.latitude) <= 85
    && Number.isFinite(source.longitude) && Math.abs(source.longitude) <= 180;
  return {
    kind: SURROUNDINGS_KINDS.includes(source.kind) ? source.kind : SURROUNDINGS_DEFAULTS.kind,
    period: SURROUNDINGS_PERIODS.includes(source.period) ? source.period : surroundingsPeriod(year) || SURROUNDINGS_DEFAULTS.period,
    year,
    season: SURROUNDINGS_SEASONS.includes(source.season) ? source.season : SURROUNDINGS_DEFAULTS.season,
    seed: Number.isFinite(source.seed) ? Math.abs(Math.round(source.seed)) >>> 0 : SURROUNDINGS_DEFAULTS.seed,
    density: Number.isFinite(source.density) ? clamp(source.density, 0, 1) : SURROUNDINGS_DEFAULTS.density,
    style: SURROUNDINGS_STYLES.includes(source.style) ? source.style : SURROUNDINGS_DEFAULTS.style,
    water: typeof source.water === "boolean" ? source.water : SURROUNDINGS_DEFAULTS.water,
    terrain: placed && source.terrain === "real" ? "real" : "generated",
    latitude: placed ? source.latitude : null,
    longitude: placed ? source.longitude : null,
    masonry: SURROUNDINGS_MASONRY.includes(source.masonry) ? source.masonry : SURROUNDINGS_DEFAULTS.masonry,
    followTimeline: source.followTimeline === true,
    growth: Number.isFinite(source.growth) ? clamp(source.growth, 0, 1) : SURROUNDINGS_DEFAULTS.growth,
    waterUrl: typeof source.waterUrl === "string" && source.waterUrl.trim() ? source.waterUrl.trim() : null,
    layoutUrl: typeof source.layoutUrl === "string" && source.layoutUrl.trim() ? source.layoutUrl.trim() : null,
    mapOverlay: normalizeMapOverlay(source.mapOverlay),
  };
}

// ---- the layout -----------------------------------------------------------------

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Value noise on a lattice, 0 to 1.
export function surroundingsNoise(seed, x, z) {
  return latticeNoise(seed, x, z);
}

function latticeNoise(seed, x, z) {
  const corner = (ix, iz) => {
    let h = Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iz, 0x165667b1) ^ seed;
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = corner(ix, iz) + (corner(ix + 1, iz) - corner(ix, iz)) * sx;
  const b = corner(ix, iz + 1) + (corner(ix + 1, iz + 1) - corner(ix, iz + 1)) * sx;
  return a + (b - a) * sz;
}

// How deep the water's bed lies under the banks, and the water under them.
const WATER_BED = 1.8;
const WATER_LEVEL = 0.55;

// The signed distance of a place to the water's edge, in metres: negative
// in the water; Infinity without water.
export function surroundingsWaterDistance(layout, x, z) {
  const water = layout.water;
  if (!water) return Infinity;
  let best = Infinity;
  if (water.river) {
    const { points, width, box } = water.river;
    // Far from the river's box: no need to measure it.
    const outside = Math.max(box[0] - x, x - box[2], box[1] - z, z - box[3], 0);
    best = outside > 200 ? outside : distanceToPolyline(points, x, z) - width / 2;
  }
  if (water.map) best = Math.min(best, water.map.distance(x, z));
  if (water.moat) {
    const d = Math.hypot(x, z);
    const { inner, outer } = water.moat;
    best = Math.min(best, d < inner ? inner - d : d > outer ? d - outer : -Math.min(d - inner, outer - d));
  }
  return best;
}

// The ground before the water's bed is cut: the real terrain where its
// elevation is known (layout.heightfield), else low generated hills towards
// the rim, lower along a river's valley.
export function surroundingsGroundHeight(layout, x, z) {
  if (typeof layout.heightfield === "function") return layout.heightfield(x, z);
  const distance = Math.hypot(x, z);
  let rise = smoothstep(layout.flat, layout.extent, distance);
  if (rise === 0) return 0;
  const river = layout.water?.river;
  if (river) rise *= smoothstep(river.width / 2 + 10, river.width / 2 + 140, surroundingsWaterDistance(layout, x, z) + river.width / 2);
  const scale = layout.extent / 3;
  const noise = latticeNoise(layout.seed, x / scale, z / scale) * 0.7 + latticeNoise(layout.seed + 7, (x / scale) * 2.3, (z / scale) * 2.3) * 0.3;
  return layout.extent * 0.07 * rise * (noise - 0.25);
}

// The ground's height at a place of a layout: flat where things are built,
// low hills towards the rim (or the real terrain), a bed under the water.
export function surroundingsTerrainHeight(layout, x, z) {
  const ground = surroundingsGroundHeight(layout, x, z);
  if (!layout.water || (!layout.water.river && !layout.water.moat && !layout.water.map)) return ground;
  const edge = surroundingsWaterDistance(layout, x, z);
  return edge > 5 ? ground : ground - WATER_BED * (1 - smoothstep(-1.5, 5, edge));
}

// The water's surface at a place: below the banks.
export function surroundingsWaterLevel(layout, x, z) {
  return surroundingsGroundHeight(layout, x, z) - WATER_LEVEL;
}

function distanceToPolyline(points, x, z) {
  let best = Infinity;
  for (let index = 0; index < points.length - 1; index += 1) {
    const [ax, az] = points[index];
    const [bx, bz] = points[index + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const length = dx * dx + dz * dz || 1;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / length, 0, 1);
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
}

function insideField(field, x, z, margin = 0) {
  // An old map's field: its own outline.
  if (field.polygon) {
    let inside = false;
    const ring = field.polygon;
    for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
      const [ax, az] = ring[index];
      const [bx, bz] = ring[previous];
      if ((az > z) !== (bz > z) && x < ax + ((z - az) * (bx - ax)) / (bz - az)) inside = !inside;
    }
    return inside || (margin > 0 && distanceToPolyline([...ring, ring[0]], x, z) < margin);
  }
  const cos = Math.cos(-field.angle);
  const sin = Math.sin(-field.angle);
  const dx = x - field.x;
  const dz = z - field.z;
  const lx = dx * cos - dz * sin;
  const lz = dx * sin + dz * cos;
  return Math.abs(lx) <= field.w / 2 + margin && Math.abs(lz) <= field.d / 2 + margin;
}

/**
 * The layout of `params` around a model of footprint radius `site.radius`
 * (metres), the model at the origin, x and z across, in metres:
 *
 *   extent, flat, clear   radii: the whole, the flat middle, kept free
 *   blocks   [{ x, z, w, d, h, angle, roof, roofHeight, ridge, role }]
 *            roof: "gable" | "pyramid" | "none"; ridge "w" | "d": the side
 *            the ridge runs along; role: "house" | "church" | "tower"
 *   walls    [{ ax, az, bx, bz, h, t, kind }]  kind: "palisade" | "masonry"
 *   roads    [{ points: [[x, z], ...], width }]
 *   fields   [{ x, z, w, d, angle, tone }]  tone 0-2
 *   trees    [{ x, z, r, h, kind }]  kind: "conifer" | "broadleaf"
 *   water    { river: { points, width, box } | null, moat: { inner, outer } | null,
 *            map: the real water (surroundings-map.js, createMapWater) | null }
 *            a moat round a castle; a river past a town or a village
 *            (by the seed; none on the real terrain, whose rivers are not
 *            known here)
 *   bridges  [{ x, z, angle, length, width }]  where a road crosses water
 *
 * `site.mapWater`: the place's real water (on the real terrain): the
 * settlement beside a castle moves to dry land, and nothing is built in it.
 */
export function layoutSurroundings(input = {}, site = {}) {
  const params = normalizeSurroundings(input);
  const rng = mulberry32(params.seed);
  const range = (min, max) => min + (max - min) * rng();
  const early = params.period === "early-medieval";
  const town = params.kind === "town";
  const burgher = town && !early;
  // 1550-1800: taller town houses, a baroque church, bastions.
  const modern = params.period === "early-modern";
  // 1800-1914: tenements, a boulevard where the walls stood, a railway with
  // its station, factories, a neo-Gothic church.
  // (and 1914-1945, which keeps them, with flat-roofed blocks of flats)
  const industrial = params.period === "industrial" || params.period === "modern";
  const twentieth = params.period === "modern";
  // An old map's roads, fields, buildings and walls (in metres, of the
  // year; surroundings-map.js, readMapLayout): they take the place of the
  // generated ones of their kind.
  const mapLayout = site.mapLayout && params.latitude != null ? site.mapLayout : null;
  const mapped = (key) => Boolean(mapLayout?.[key]?.length);

  const radius = clamp(Number(site.radius) || 20, 6, 5000);
  // Nothing generated stands this close to the model.
  const clear = radius * 1.2 + 8;
  // The settlement: a circle of houses along the roads.
  const zoneRadius = town ? 95 + 40 * params.density : 40 + 30 * params.density;
  let direction = rng() * Math.PI * 2;
  // The real water (the real terrain's map, or an old map read): given by
  // the viewer only where it belongs.
  const mapWater = params.water ? site.mapWater || null : null;
  // A castle's settlement on dry land: the first of eight directions round
  // the castle whose middle is clear of the real water.
  if (mapWater && params.kind === "castle") {
    const distance = (radius * 1.2 + 8) + zoneRadius + 12;
    const dry = [0, 1, -1, 2, -2, 3, -3, 4].map((step) => direction + (step * Math.PI) / 4)
      .find((angle) => mapWater.distance(Math.cos(angle) * distance, Math.sin(angle) * distance) > zoneRadius * 0.4);
    if (dry != null) direction = dry;
  }
  const ux = Math.cos(direction);
  const uz = Math.sin(direction);
  // A castle looks down on its settlement, beside it; a church, a house or a
  // town's building stands in the middle of theirs.
  const beside = params.kind === "castle";
  const zoneDistance = beside ? clear + zoneRadius + 12 : 0;
  const zone = { x: ux * zoneDistance, z: uz * zoneDistance, r: beside ? zoneRadius : zoneRadius + clear };
  const reach = zoneDistance + zone.r;
  // Room for the fields round the settlement before the hills begin.
  const extent = Math.max(260, (reach + 185) / 0.6);
  const flat = extent * 0.6;
  const layout = { params, seed: params.seed, extent, flat, clear, zone, blocks: [], walls: [], roads: [], fields: [], trees: [], water: { river: null, moat: null, map: mapWater }, bridges: [] };

  // ---- roads. The first two reach the rim (a wall opens for them).
  const ray = (fromX, fromZ, angle, length, steps = 4) => {
    const points = [[fromX, fromZ]];
    let heading = angle;
    for (let step = 1; step <= steps; step += 1) {
      heading += range(-0.1, 0.1);
      const [x, z] = points[points.length - 1];
      points.push([x + Math.cos(heading) * (length / steps), z + Math.sin(heading) * (length / steps)]);
    }
    return points;
  };
  // Through a place, `back` behind it and `forward` ahead.
  const line = (x, z, angle, back, forward) => [...ray(x, z, angle + Math.PI, back).reverse(), ...ray(x, z, angle, forward).slice(1)];
  const across = direction + Math.PI / 2;
  const vx = Math.cos(across);
  const vz = Math.sin(across);
  const out = extent * 1.05;
  // Where the roads meet: the settlement's middle; beside the model where
  // the model is the middle.
  const pass = clear + 5;
  const hub = beside ? { x: zone.x, z: zone.z } : { x: vx * pass, z: vz * pass };
  if (beside) {
    // From the castle through the settlement and on; a lane across.
    layout.roads.push({ points: line(hub.x, hub.z, direction, zoneDistance - radius, out), width: 4.5 });
    layout.roads.push({ points: line(hub.x, hub.z, across, zone.r * 0.9, out), width: 3.5 });
    layout.roads.push({ points: line(hub.x + ux * zone.r * 0.5, hub.z + uz * zone.r * 0.5, across, zone.r * 0.7, zone.r * 0.7), width: 3 });
  } else if (town) {
    // Streets past the model on every side, a block apart.
    const inside = zone.r * 0.9;
    layout.roads.push({ points: line(hub.x, hub.z, direction, out, out), width: 6 });
    layout.roads.push({ points: line(ux * pass, uz * pass, across, out, out), width: 6 });
    layout.roads.push({ points: line(-hub.x, -hub.z, direction, inside, inside), width: 4.5 });
    layout.roads.push({ points: line(-ux * pass, -uz * pass, across, inside, inside), width: 4.5 });
    [1, -1].forEach((hand) => {
      const offset = (pass + 46) * hand;
      if (pass + 46 > inside - 12) return;
      const half = Math.sqrt(inside * inside - offset * offset);
      layout.roads.push({ points: line(vx * offset, vz * offset, direction, half, half), width: 4 });
      layout.roads.push({ points: line(ux * offset, uz * offset, across, half, half), width: 4 });
    });
  } else {
    // A road past the church or the house, and one leaving it.
    layout.roads.push({ points: line(hub.x, hub.z, direction, out, out), width: 4.5 });
    layout.roads.push({ points: ray(hub.x, hub.z, across, out), width: 3.5 });
    layout.roads.push({ points: line(-hub.x, -hub.z, direction, zone.r * 0.8, zone.r * 0.8), width: 3 });
  }
  // After 1800 the walls are gone: a boulevard round the old town.
  if (town && industrial) {
    const ring = [];
    for (let step = 0; step <= 48; step += 1) {
      const angle = (step / 48) * Math.PI * 2;
      ring.push([zone.x + Math.cos(angle) * (zone.r + 8), zone.z + Math.sin(angle) * (zone.r + 8)]);
    }
    layout.roads.push({ points: ring, width: 14, boulevard: true });
  }
  // The old map's roads instead.
  if (mapped("roads")) layout.roads = mapLayout.roads.map((road) => ({ points: road.points, width: road.width }));

  // ---- the railway (after 1800): past the settlement, its station on the
  // settlement's side, a road from the station into it. Its own numbers.
  const railRng = mulberry32((params.seed ^ 0x27d4eb2f) >>> 0);
  const railRange = (min, max) => min + (max - min) * railRng();
  layout.railway = null;
  let station = null;
  if (industrial && !mapped("roads")) {
    const side = railRange(0, Math.PI * 2);
    const offset = (beside ? zoneDistance + zone.r : zone.r) + railRange(35, 60);
    const nx = Math.cos(side);
    const nz = Math.sin(side);
    const bend = railRange(-0.08, 0.08);
    const points = [];
    for (let along = -extent * 1.3; along <= extent * 1.3 + 1; along += 20) {
      const lateral = offset + bend * (along * along) / extent;
      points.push([zone.x * 0 + nx * lateral - nz * along, nz * lateral + nx * along]);
    }
    if (points.every(([x, z]) => Math.hypot(x, z) > clear + 12)) {
      layout.railway = { points, width: 8 };
      // The station where the line passes nearest the settlement.
      const centre = beside ? zone : { x: 0, z: 0 };
      const nearest = points.reduce((best, point) => (Math.hypot(point[0] - centre.x, point[1] - centre.z) < Math.hypot(best[0] - centre.x, best[1] - centre.z) ? point : best));
      const heading = Math.atan2(nx, -nz);
      const sx = nearest[0] - nx * 18;
      const sz = nearest[1] - nz * 18;
      station = { x: sx, z: sz, w: 36, d: 12, h: 8, angle: heading, roof: "gable", roofHeight: 4, ridge: "w", role: "station" };
      layout.roads.push({ points: [[sx - nx * 8, sz - nz * 8], [hub.x, hub.z]], width: 7 });
    }
  }
  const railFree = (x, z, margin) => !layout.railway || distanceToPolyline(layout.railway.points, x, z) > layout.railway.width / 2 + margin;

  // ---- water: a random number generator of its own, so the rest of a
  // layout stays as it was for a seed.
  const waterRng = mulberry32((params.seed ^ 0x5bd1e995) >>> 0);
  const waterRange = (min, max) => min + (max - min) * waterRng();
  if (params.water) {
    if (params.kind === "castle" && radius < 150) {
      // A moat round the castle; narrower round an early stronghold.
      const inner = radius * 1.03 + 3;
      layout.water.moat = { inner, outer: inner + (early ? 6 : 9) };
    } else if (params.kind !== "castle" && params.terrain !== "real" && !mapWater && waterRng() < (town ? 0.75 : 0.5)) {
      // A river past the model, meandering, from rim to rim.
      const width = town ? waterRange(16, 26) : waterRange(7, 12);
      const angle = waterRange(0, Math.PI);
      const tx = Math.cos(angle);
      const tz = Math.sin(angle);
      const amplitude = waterRange(8, 24);
      const offset = (waterRng() < 0.5 ? -1 : 1) * (clear + width / 2 + 10 + amplitude + waterRange(0, 30));
      const wave = waterRange(160, 260);
      const phase = waterRange(0, Math.PI * 2);
      const points = [];
      for (let along = -extent * 1.4; along <= extent * 1.4 + 1; along += 12) {
        const lateral = offset + Math.sin((along / wave) * Math.PI * 2 + phase) * amplitude;
        points.push([tx * along - tz * lateral, tz * along + tx * lateral]);
      }
      const xs = points.map(([x]) => x);
      const zs = points.map(([, z]) => z);
      layout.water.river = { points, width, box: [Math.min(...xs) - width, Math.min(...zs) - width, Math.max(...xs) + width, Math.max(...zs) + width] };
    }
  }
  const wet = (x, z, margin = 0) => surroundingsWaterDistance(layout, x, z) < margin;
  // Where a road meets the water: a bridge where it crosses, steeply
  // enough; a road that would run along the water ends at its bank instead
  // (split in two).
  const riverHeading = (x, z) => {
    if (mapWater) {
      const heading = mapWater.heading(x, z);
      if (heading != null) return heading;
    }
    const points = layout.water.river?.points;
    if (!points) return null;
    let best = 0;
    let bestDistance = Infinity;
    for (let index = 0; index < points.length - 1; index += 1) {
      const distance = Math.hypot(points[index][0] - x, points[index][1] - z);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    }
    return Math.atan2(points[best + 1][1] - points[best][1], points[best + 1][0] - points[best][0]);
  };
  const split = [];
  layout.roads.forEach((road) => {
    const samples = road.points.flatMap(([x, z], index) => {
      if (index === road.points.length - 1) return [[x, z]];
      const [nx, nz] = road.points[index + 1];
      const steps = Math.max(1, Math.ceil(Math.hypot(nx - x, nz - z) / 2));
      return Array.from({ length: steps }, (_item, step) => [x + ((nx - x) * step) / steps, z + ((nz - z) * step) / steps]);
    });
    // A road that never meets the water stays as it is.
    if (!samples.some(([x, z]) => wet(x, z, 1.5))) {
      split.push(road);
      return;
    }
    let piece = [];
    let start = null;
    const finish = () => {
      if (piece.length >= 2) split.push({ ...road, points: piece.filter((_point, index) => index % 4 === 0 || index === piece.length - 1) });
      piece = [];
    };
    samples.forEach(([x, z], index) => {
      const inWater = wet(x, z, 1.5);
      if (inWater && start == null) start = index;
      if (!inWater && start == null) {
        piece.push([x, z]);
        return;
      }
      if (inWater && index < samples.length - 1) return;
      // Out of the water again (or at the road's end): a crossing?
      const [ax, az] = samples[Math.max(start - 1, 0)];
      const [bx, bz] = samples[index];
      const length = Math.hypot(bx - ax, bz - az);
      const heading = Math.atan2(bz - az, bx - ax);
      const along = riverHeading((ax + bx) / 2, (az + bz) / 2);
      const steep = along == null || Math.abs(Math.sin(heading - along)) > 0.6;
      if (inWater || !steep || length >= 70) {
        finish();
      } else {
        if (length > 1) layout.bridges.push({ x: (ax + bx) / 2, z: (az + bz) / 2, angle: heading, length: length + 4, width: road.width + 1.2 });
        for (let fill = start; fill <= index; fill += 1) piece.push(samples[fill]);
      }
      if (!inWater) piece.push([x, z]);
      start = null;
    });
    finish();
  });
  layout.roads = split;

  // ---- buildings: what is taken, as circles
  const taken = [];
  const free = (x, z, r) => Math.hypot(x, z) >= clear + r
    && !wet(x, z, r + 3)
    && railFree(x, z, r + 4)
    && taken.every((circle) => Math.hypot(x - circle.x, z - circle.z) >= r + circle.r);
  const take = (x, z, r) => taken.push({ x, z, r });

  // The old map's buildings, as they stood.
  if (mapped("buildings")) {
    mapLayout.buildings.forEach((building) => {
      if (Math.hypot(building.x, building.z) < clear * 0.8) return;
      take(building.x, building.z, Math.min(building.w, building.d) / 2);
      layout.blocks.push({ ...building });
    });
  }
  // The station, and factories with their chimneys along the line.
  if (station && free(station.x, station.z, 8)) {
    take(station.x, station.z, 10);
    layout.blocks.push(station);
    if (town) {
      const [nx, nz] = [Math.cos(station.angle), Math.sin(station.angle)];
      const toward = [Math.sin(station.angle), -Math.cos(station.angle)];
      const count = 2 + Math.floor(railRng() * 3);
      for (let index = 0; index < count; index += 1) {
        const along = (index % 2 ? 1 : -1) * railRange(70, 200);
        const w = railRange(40, 60);
        const d = railRange(18, 26);
        const fx = station.x + nx * along - toward[0] * railRange(-6, 6) - toward[0] * 14;
        const fz = station.z + nz * along - toward[1] * railRange(-6, 6) - toward[1] * 14;
        const chimney = railRange(28, 40);
        if (!free(fx, fz, d / 2 + 2)) continue;
        take(fx, fz, Math.min(w, d) / 2 + 2);
        layout.blocks.push({ x: fx, z: fz, w, d, h: 9, angle: station.angle, roof: "sawtooth", roofHeight: 3.5, ridge: "w", role: "factory" });
        const cx = fx + nx * (w / 2 + 4);
        const cz = fz + nz * (w / 2 + 4);
        if (free(cx, cz, 2)) {
          take(cx, cz, 2.5);
          layout.blocks.push({ x: cx, z: cz, w: 3.2, d: 3.2, h: chimney, angle: station.angle, roof: "none", roofHeight: 0, ridge: "w", role: "chimney" });
        }
      }
    }
  }

  // A church for the settlement, unless the model is one: by the hub, off
  // the road. Timber and small before the mid 13th century.
  if (params.kind !== "church" && !mapped("buildings")) {
    const angle = direction + range(-0.2, 0.2);
    const nave = early ? { w: 6, d: 11, h: 4.5 } : modern ? { w: 11, d: 24, h: 12 } : industrial ? { w: 13, d: 30, h: 15 } : { w: 9, d: 19, h: 8 };
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const side2 = attempt % 2 ? 1 : -1;
      const distance = 14 + attempt * 4;
      const x = hub.x + vx * distance * side2 + ux * range(8, 24);
      const z = hub.z + vz * distance * side2 + uz * range(8, 24);
      const r = nave.d / 2 + 6;
      if (!free(x, z, r) || layout.roads.some((road) => distanceToPolyline(road.points, x, z) < nave.w / 2 + road.width)) continue;
      take(x, z, r);
      layout.blocks.push({ x, z, ...nave, angle, roof: "gable", roofHeight: nave.w * 0.75, ridge: "d", role: "church" });
      if (!early) {
        // The tower at the west end.
        const tx = x + Math.sin(angle) * (nave.d / 2 + 2.5);
        const tz = z - Math.cos(angle) * (nave.d / 2 + 2.5);
        // A baroque tower: taller, under an onion dome.
        // A neo-Gothic one after 1800: a tall, slender spire.
        layout.blocks.push(modern
          ? { x: tx, z: tz, w: 7, d: 7, h: 28, angle, roof: "onion", roofHeight: 12, ridge: "d", role: "church" }
          : industrial
            ? { x: tx, z: tz, w: 7, d: 7, h: 36, angle, roof: "pyramid", roofHeight: 26, ridge: "d", role: "church" }
            : { x: tx, z: tz, w: 5.5, d: 5.5, h: 17, angle, roof: "pyramid", roofHeight: 7, ridge: "d", role: "church" });
      }
      break;
    }
  }

  // Houses along the roads, both sides, thinning towards the zone's edge.
  const candidates = [];
  layout.roads.forEach((road, roadIndex) => {
    const points = road.points;
    for (let index = 0; index < points.length - 1; index += 1) {
      const [ax, az] = points[index];
      const [bx, bz] = points[index + 1];
      const length = Math.hypot(bx - ax, bz - az);
      const heading = Math.atan2(bz - az, bx - ax);
      let at = range(0, 4);
      while (at < length) {
        const lot = town ? (twentieth ? range(22, 32) : industrial ? range(12, 18) : range(6, 9)) : range(8, 12);
        const px = ax + Math.cos(heading) * (at + lot / 2);
        const pz = az + Math.sin(heading) * (at + lot / 2);
        at += lot;
        const fromZone = Math.hypot(px - zone.x, pz - zone.z) / zone.r;
        if (fromZone > 1) continue;
        for (const hand of [-1, 1]) {
          // All of a house's numbers first, so the same lot gets the same
          // house however many stand (growth: the settlement grows by
          // adding houses, not by moving them).
          const roll = rng();
          const w = town ? lot - range(0.5, 1.5) : range(5, 8);
          const d = burgher ? (twentieth ? range(12, 14) : industrial ? range(14, 18) : modern ? range(12, 16) : range(10, 15)) : range(7, 11);
          const h = burgher ? (twentieth ? range(15, 21) : industrial ? range(12, 16) : modern ? range(8, 12) : range(5, 8.5)) : early ? range(2.2, 3) : range(2.6, 4);
          const setback = road.width / 2 + range(1, town ? 2 : 5) + d / 2;
          const turn = range(-0.06, 0.06);
          const pitch = range(0.6, 0.85);
          // Fewer towards the edge, fewer on the lesser roads; the share
          // built by the year (growth).
          const chance = (town ? 0.95 : 0.6 + 0.4 * params.density) * (1 - smoothstep(0.7, 1, fromZone)) * (roadIndex > 1 ? 0.85 : 1);
          // Deep, tall houses gable to the street only in a chartered town.
          const x = px + Math.cos(heading + Math.PI / 2) * setback * hand;
          const z = pz + Math.sin(heading + Math.PI / 2) * setback * hand;
          candidates.push({
            order: roll / Math.max(chance, 1e-6),
            road,
            x, z,
            r: Math.min(w, d) / 2 + (town ? 0.2 : 1.5),
            // The front (w) to the road. A town's houses turn their gables
            // to the street; a village's their eaves.
            block: {
              x, z, w, d, h,
              angle: heading + turn,
              // A block of flats after 1914: flat.
              roof: twentieth && burgher ? "none" : "gable",
              // A tenement's low roof along the street.
              roofHeight: industrial && burgher ? d * 0.18 : (burgher ? w : Math.min(w, d)) * pitch,
              ridge: burgher && !industrial ? "d" : "w",
              role: "house",
            },
          });
        }
      }
    }
  });
  // Built in a fixed order (the lot's own number against its chance), as
  // many as the growth allows: a house standing at a lower growth stands at
  // a higher one too, never pushed out by one built later.
  candidates.sort((a, b) => a.order - b.order);
  candidates.forEach(({ order, road, x, z, r, block }) => {
    if (order > params.growth || mapped("buildings")) return;
    if (!free(x, z, r)) return;
    if (layout.roads.some((other) => other !== road && distanceToPolyline(other.points, x, z) < Math.max(block.w, block.d) / 2 + other.width / 2)) return;
    take(x, z, r);
    layout.blocks.push(block);
  });

  // ---- a wall: a town's ring with towers; a palisade round an early
  // town or the settlement below a stronghold; after 1550 a town's ring of
  // earthen ramparts with bastions. Open where a road or the water passes.
  if (mapped("walls")) {
    mapLayout.walls.forEach((wall) => {
      for (let index = 0; index < wall.points.length - 1; index += 1) {
        const [ax, az] = wall.points[index];
        const [bx, bz] = wall.points[index + 1];
        const kind = wall.kind;
        layout.walls.push({ ax, az, bx, bz, h: kind === "palisade" ? 3.6 : kind === "rampart" ? 6 : 7, t: kind === "palisade" ? 0.5 : kind === "rampart" ? 10 : 1.6, kind });
      }
    });
  } else if (mapped("roads") || mapped("buildings") || industrial) {
    // What the old map shows, or no walls after 1800.
  } else if (town && modern) {
    const ringRadius = zone.r + 26;
    const bastions = 6 + Math.floor(rng() * 2);
    const start = rng() * Math.PI * 2;
    const spread = 0.13;
    const at = (radius, angle) => [zone.x + Math.cos(angle) * radius, zone.z + Math.sin(angle) * radius];
    // Round the ring: each bastion's left shoulder, its point, its right
    // shoulder; the curtain to the next.
    const trace = [];
    for (let index = 0; index < bastions; index += 1) {
      const angle = start + (index / bastions) * Math.PI * 2;
      trace.push(at(ringRadius, angle - spread), at(ringRadius + 22, angle), at(ringRadius, angle + spread));
    }
    trace.forEach(([ax, az], index) => {
      const [bx, bz] = trace[(index + 1) % trace.length];
      const length = Math.hypot(bx - ax, bz - az);
      // Curtains long, with room for a gate; split so a road opens a part.
      const pieces = Math.max(1, Math.round(length / 24));
      for (let piece = 0; piece < pieces; piece += 1) {
        const px = ax + ((bx - ax) * piece) / pieces;
        const pz = az + ((bz - az) * piece) / pieces;
        const qx = ax + ((bx - ax) * (piece + 1)) / pieces;
        const qz = az + ((bz - az) * (piece + 1)) / pieces;
        const mx = (px + qx) / 2;
        const mz = (pz + qz) / 2;
        const gate = layout.roads.slice(0, 2).some((road) => distanceToPolyline(road.points, mx, mz) < (length / pieces) * 0.55);
        if (gate || Math.hypot(mx, mz) < clear || wet(mx, mz, length / pieces / 2 + 4)) continue;
        layout.walls.push({ ax: px, az: pz, bx: qx, bz: qz, h: 6, t: 10, kind: "rampart" });
      }
    });
  } else if (town || (early && beside)) {
    const masonry = town && !early;
    const ringRadius = zone.r + (masonry ? 14 : 9);
    const segments = 30;
    const start = rng() * Math.PI * 2;
    const ring = Array.from({ length: segments }, (_item, index) => {
      const angle = start + (index / segments) * Math.PI * 2;
      const r = ringRadius * (1 + 0.05 * Math.sin(angle * 3 + start) + range(-0.02, 0.02));
      return [zone.x + Math.cos(angle) * r, zone.z + Math.sin(angle) * r];
    });
    ring.forEach(([ax, az], index) => {
      const [bx, bz] = ring[(index + 1) % segments];
      const mx = (ax + bx) / 2;
      const mz = (az + bz) / 2;
      const gate = layout.roads.slice(0, 2).some((road) => distanceToPolyline(road.points, mx, mz) < Math.hypot(bx - ax, bz - az) * 0.55);
      // Not through the model; open where the river passes (a water gate).
      if (Math.hypot(mx, mz) < clear || wet(mx, mz, Math.hypot(bx - ax, bz - az) / 2 + 2)) return;
      if (!gate) layout.walls.push({ ax, az, bx, bz, h: masonry ? 7 : 3.6, t: masonry ? 1.6 : 0.5, kind: masonry ? "masonry" : "palisade" });
      if (masonry && (gate || index % 4 === 0)) {
        layout.blocks.push({ x: ax, z: az, w: 6, d: 6, h: gate ? 13 : 10, angle: Math.atan2(bz - az, bx - ax), roof: "pyramid", roofHeight: 4.5, ridge: "d", role: "tower" });
      }
    });
  }

  // ---- fields: bundles of long strips beyond the settlement (or the old
  // map's)
  if (mapped("fields")) mapLayout.fields.forEach((field) => layout.fields.push({ ...field }));
  const bundles = mapped("fields") ? 0 : 3 + Math.floor(rng() * 3);
  for (let bundle = 0; bundle < bundles; bundle += 1) {
    const angle = direction + ((bundle + range(0.1, 0.9)) / bundles) * Math.PI * 2;
    const length = range(80, 140);
    const distance = zone.r + 15 + length / 2 + range(0, 25);
    const cx = zone.x + Math.cos(angle) * distance;
    const cz = zone.z + Math.sin(angle) * distance;
    const strips = 4 + Math.floor(rng() * 5);
    const stripWidth = range(8, 13);
    // The strips run away from the middle, side by side.
    for (let strip = 0; strip < strips; strip += 1) {
      const shift = (strip - (strips - 1) / 2) * stripWidth;
      const x = cx + Math.cos(angle + Math.PI / 2) * shift;
      const z = cz + Math.sin(angle + Math.PI / 2) * shift;
      if (Math.hypot(x, z) < clear + length / 2) continue;
      const half = (length / 2) * 0.95;
      if ([-half, 0, half].some((along) => wet(x + Math.cos(angle) * along, z + Math.sin(angle) * along, stripWidth / 2 + 4))) continue;
      if ([-half, 0, half].some((along) => !railFree(x + Math.cos(angle) * along, z + Math.sin(angle) * along, stripWidth / 2 + 3))) continue;
      layout.fields.push({ x, z, w: length * range(0.85, 1), d: stripWidth - 0.6, angle, tone: (strip + bundle) % 3 });
    }
  }

  // ---- trees: a forest in clumps towards the rim, clear of roads and fields
  const wanted = Math.round(clamp((extent * extent) / 160, 300, 1400));
  const clumpScale = extent / 4;
  for (let attempt = 0; attempt < wanted * 8 && layout.trees.length < wanted; attempt += 1) {
    const distance = Math.sqrt(range(0.08, 1.2)) * extent;
    const angle = rng() * Math.PI * 2;
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    const share = distance / extent;
    const clump = latticeNoise(params.seed + 3, x / clumpScale, z / clumpScale);
    if (rng() > smoothstep(0.3, 0.75, share) * smoothstep(0.3, 0.6, clump) + 0.02) continue;
    if (distance < clear + 6 || Math.hypot(x - zone.x, z - zone.z) < zone.r + 16) continue;
    if (layout.roads.some((road) => distanceToPolyline(road.points, x, z) < road.width / 2 + 5)) continue;
    if (layout.fields.some((field) => insideField(field, x, z, 3))) continue;
    if (wet(x, z, 4) || !railFree(x, z, 5)) continue;
    const conifer = rng() < 0.35;
    const h = conifer ? range(11, 19) : range(8, 15);
    layout.trees.push({ x, z, h, r: conifer ? h * range(0.16, 0.22) : h * range(0.28, 0.38), kind: conifer ? "conifer" : "broadleaf" });
  }
  // An avenue along the boulevard.
  layout.roads.filter((road) => road.boulevard).forEach((road) => {
    for (let index = 0; index < road.points.length - 1; index += 1) {
      const [ax, az] = road.points[index];
      const [bx, bz] = road.points[index + 1];
      const length = Math.hypot(bx - ax, bz - az) || 1;
      for (let at = 0; at < length; at += 10) {
        const px = ax + ((bx - ax) * at) / length;
        const pz = az + ((bz - az) * at) / length;
        [-1, 1].forEach((hand) => {
          const tx = px - ((bz - az) / length) * (road.width / 2 - 1.2) * hand;
          const tz = pz + ((bx - ax) / length) * (road.width / 2 - 1.2) * hand;
          if (Math.hypot(tx, tz) < clear + 4 || wet(tx, tz, 2)) return;
          if (taken.some((circle) => Math.hypot(tx - circle.x, tz - circle.z) < circle.r + 1)) return;
          layout.trees.push({ x: tx, z: tz, h: 11, r: 3.6, kind: "broadleaf" });
        });
      }
    }
  });
  // Railway bridges where the line crosses water.
  if (layout.railway) {
    const points = layout.railway.points;
    let start = null;
    points.forEach(([x, z], index) => {
      const inWater = wet(x, z, 2);
      if (inWater && start == null) start = Math.max(index - 1, 0);
      if (!inWater && start != null) {
        const [ax, az] = points[start];
        layout.bridges.push({ x: (ax + x) / 2, z: (az + z) / 2, angle: Math.atan2(z - az, x - ax), length: Math.hypot(x - ax, z - az) + 6, width: 9, railway: true });
        start = null;
      }
    });
  }
  // Willows and alders along a river's banks, where there is room.
  const river = layout.water.river;
  if (river) {
    river.points.forEach(([x, z], index) => {
      if (index === river.points.length - 1) return;
      const [nx, nz] = river.points[index + 1];
      const length = Math.hypot(nx - x, nz - z) || 1;
      [-1, 1].forEach((hand) => {
        if (waterRng() > 0.45) return;
        const out = river.width / 2 + waterRange(2.5, 6);
        const tx = x - ((nz - z) / length) * out * hand;
        const tz = z + ((nx - x) / length) * out * hand;
        const distance = Math.hypot(tx, tz);
        if (distance < clear + 6 || distance > extent * 1.1) return;
        if (taken.some((circle) => Math.hypot(tx - circle.x, tz - circle.z) < circle.r + 3)) return;
        if (layout.roads.some((road) => distanceToPolyline(road.points, tx, tz) < road.width / 2 + 3)) return;
        if (layout.fields.some((field) => insideField(field, tx, tz, 2))) return;
        const h = waterRange(7, 11);
        layout.trees.push({ x: tx, z: tz, h, r: h * waterRange(0.32, 0.42), kind: "broadleaf" });
      });
    });
  }
  return layout;
}
