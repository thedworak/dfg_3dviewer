import { surroundingsWaterDistance } from "./surroundings-rules.js";

// Life in the generated surroundings (editor/surroundings-life-mesh.js
// draws and moves it): people walking the settlement's streets, carts and
// later cars on its roads, boats on its water. Like the rest, a typical
// picture, not this place's - marked as generated, no part of the model.
//
// Pure: no three.js. The same layout always gives the same life.
//
//   people     [{ path, speed, start, side, colour }]  walking to and fro
//              along a stretch of a street in the settlement
//   vehicles   [{ path, speed, start, side, kind }]  "cart" | "car", to
//              and fro along a road
//   boats      [{ path, speed, start, kind, loop }]  "rowing" | "sail" |
//              "motor", on a river, a moat, a port's water, a pond
//
// A path: { points: [[x, z], ...], lengths (cumulative), length }.

// People's clothes: undyed wool and linen, dyed blue, red, green, brown;
// later darker cloth; after 1945 brighter.
const CLOTHES = {
  early: [0x8a7b62, 0x6f5f4a, 0xa69478, 0x5d6b7a, 0x7a3e33, 0x5f6b45],
  later: [0x3f3a36, 0x5a4a3c, 0x2f3a4a, 0x6b5a48, 0x7a3e33, 0x8a7b62],
  modern: [0x2f4f7a, 0x8a2f2f, 0x3f6f4f, 0xc9a24a, 0x4a4a4a, 0xd8d0c0, 0x6f4a7a],
};

function rngOf(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function lifePath(points) {
  const lengths = [0];
  for (let index = 1; index < points.length; index += 1) {
    lengths.push(lengths[index - 1] + Math.hypot(points[index][0] - points[index - 1][0], points[index][1] - points[index - 1][1]));
  }
  return { points, lengths, length: lengths[lengths.length - 1] };
}

/**
 * Where along a path at `distance` (to and fro, or round a loop):
 * { x, z, heading } - heading the direction of travel (radians, atan2 of
 * dz, dx).
 */
export function lifeAt(path, distance, loop = false) {
  const length = path.length || 1;
  let along = ((distance % (2 * length)) + 2 * length) % (2 * length);
  let back = false;
  if (loop) along %= length;
  else if (along > length) {
    along = 2 * length - along;
    back = true;
  }
  const { points, lengths } = path;
  let index = 1;
  while (index < lengths.length - 1 && lengths[index] < along) index += 1;
  const [ax, az] = points[index - 1];
  const [bx, bz] = points[index];
  const span = lengths[index] - lengths[index - 1] || 1;
  const t = (along - lengths[index - 1]) / span;
  const heading = Math.atan2(bz - az, bx - ax) + (back ? Math.PI : 0);
  return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, heading };
}

// The part of a polyline within `radius` of a place (the longest run).
function clipTo(points, cx, cz, radius) {
  let best = [];
  let run = [];
  points.forEach((point) => {
    if (Math.hypot(point[0] - cx, point[1] - cz) <= radius) run.push(point);
    else {
      if (run.length > best.length) best = run;
      run = [];
    }
  });
  return run.length > best.length ? run : best;
}

/**
 * The life of a layout (surroundings-rules.js, layoutSurroundings).
 *   light   a phone or a weak device: half as much
 */
export function planSurroundingsLife(layout, { light = false } = {}) {
  const params = layout.params;
  const rng = rngOf((layout.seed ^ 0x1f123bb5) >>> 0);
  const range = (min, max) => min + (max - min) * rng();
  const zone = layout.zone;
  const period = params.period;
  const winter = params.season === "winter";
  const town = params.kind === "town" || params.kind === "port";
  const share = (light ? 0.5 : 1) * (0.6 + 0.6 * params.density);
  const clothes = period === "postwar" || period === "contemporary" ? CLOTHES.modern : period === "early-medieval" || period === "medieval" ? CLOTHES.early : CLOTHES.later;
  const wet = (x, z) => surroundingsWaterDistance(layout, x, z) < 1.5;
  const people = [];
  const vehicles = [];
  const boats = [];

  // ---- people: a stretch of a street each, in the settlement
  const streets = layout.roads
    .filter((road) => !road.boulevard || town)
    .map((road) => ({ road, points: clipTo(road.points, zone.x, zone.z, zone.r * 1.05) }))
    .filter(({ points }) => points.length >= 2);
  const wantedPeople = Math.round((town ? 70 : params.kind === "shtetl" ? 50 : 24) * share * (winter ? 0.6 : 1));
  for (let index = 0; index < wantedPeople && streets.length; index += 1) {
    const { road, points } = streets[Math.floor(rng() * streets.length)];
    const full = lifePath(points);
    // A stretch of 30-90 m of it.
    const stretch = Math.min(full.length, range(30, 90));
    const from = range(0, Math.max(0, full.length - stretch));
    const picked = [];
    for (let at = from; at <= from + stretch + 0.01; at += 4) {
      const { x, z } = lifeAt(full, Math.min(at, full.length));
      picked.push([x, z]);
    }
    if (picked.length < 2 || picked.some(([x, z]) => wet(x, z))) continue;
    people.push({
      path: lifePath(picked),
      speed: range(0.9, 1.5),
      start: range(0, 200),
      side: (rng() < 0.5 ? -1 : 1) * (road.width / 2 - range(0.4, 1)),
      colour: clothes[Math.floor(rng() * clothes.length)],
    });
  }

  // ---- vehicles on the roads: carts until the cars come
  const cars = { "early-medieval": 0, medieval: 0, "early-modern": 0, industrial: 0, modern: 0.4, postwar: 0.8, contemporary: 1 }[period] ?? 0;
  const count = Math.round(({ "early-medieval": 2, medieval: 4, "early-modern": 5, industrial: 7, modern: 8, postwar: 10, contemporary: 14 }[period] ?? 4) * share * (town ? 1.4 : 1));
  const roads = layout.roads.filter((road) => road.width >= 4.5 && !road.market && road.points.length >= 2)
    .map((road) => clipTo(road.points, 0, 0, layout.extent * 0.95))
    .filter((points) => points.length >= 2);
  for (let index = 0; index < count && roads.length; index += 1) {
    const points = roads[index % roads.length];
    const path = lifePath(points);
    // (across bridges too: the roads stop at the banks elsewhere)
    if (path.length < 40) continue;
    const car = rng() < cars;
    vehicles.push({ path, speed: car ? range(8, 13) : range(1.2, 1.8), start: range(0, path.length * 2), side: (rng() < 0.5 ? -1 : 1) * 1.2, kind: car ? "car" : "cart" });
  }

  // ---- boats: none on the ice
  if (!winter && params.water) {
    const water = layout.water;
    const boatKind = () => (period === "postwar" || period === "contemporary" ? (rng() < 0.6 ? "motor" : "rowing") : rng() < (params.kind === "port" ? 0.6 : 0.15) ? "sail" : "rowing");
    if (water.river) {
      const points = clipTo(water.river.points, 0, 0, layout.extent * 0.9);
      const path = lifePath(points);
      for (let index = 0; index < Math.round(4 * share); index += 1) {
        if (path.length > 60) boats.push({ path, speed: range(1.2, 2.5), start: range(0, path.length * 2), kind: boatKind(), loop: false, side: range(-0.25, 0.25) * water.river.width });
      }
    }
    if (water.moat) {
      const radius = (water.moat.inner + water.moat.outer) / 2;
      const points = Array.from({ length: 49 }, (_item, index) => [Math.cos((index / 48) * Math.PI * 2) * radius, Math.sin((index / 48) * Math.PI * 2) * radius]);
      boats.push({ path: lifePath(points), speed: range(0.8, 1.4), start: range(0, 200), kind: "rowing", loop: true, side: 0 });
    }
    if (water.coast) {
      const { nx, nz, offset } = water.coast;
      for (let index = 0; index < Math.round(6 * share); index += 1) {
        const out = offset + range(25, 140);
        const half = range(80, 220);
        const points = [[-nz * -half + nx * out, nx * -half + nz * out], [-nz * half + nx * out, nx * half + nz * out]];
        boats.push({ path: lifePath(points), speed: range(1.5, 4), start: range(0, half * 4), kind: boatKind(), loop: false, side: 0 });
      }
    }
    (water.ponds || []).forEach((pond) => {
      const points = Array.from({ length: 33 }, (_item, index) => {
        const angle = (index / 32) * Math.PI * 2;
        const lx = Math.cos(angle) * pond.rx * 0.55;
        const lz = Math.sin(angle) * pond.rz * 0.55;
        return [pond.x + lx * Math.cos(pond.angle) - lz * Math.sin(pond.angle), pond.z + lx * Math.sin(pond.angle) + lz * Math.cos(pond.angle)];
      });
      boats.push({ path: lifePath(points), speed: range(0.5, 0.9), start: range(0, 100), kind: "rowing", loop: true, side: 0 });
    });
  }
  return { people, vehicles, boats };
}
