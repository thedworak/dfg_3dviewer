// The intro's surroundings through time (feature-tour.js, its last
// chapter): the viewer's generated surroundings (editor/surroundings-rules.js,
// docs/surroundings.md) round the model, growing year by year - a settlement
// of its kind and region, its houses added as it grows, rebuilt where a new
// period begins (the railway and its station after 1800).
//
// The layout is the viewer's own (the same rules, the same seed); only the
// drawing is the intro's: plain, pale shapes like the viewer's schematic
// look, light enough for a phone. Each house rises from the ground in its
// year (a vertex shader scales it up from its foot); what a new period
// replaces sinks back, in a wave from the model outwards.
//
// What is generated is a typical setting of the kind of place and its time,
// not a reconstruction of this place: the page says so while it shows.
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import { SURROUNDINGS_ERAS, layoutSurroundings } from '../editor/surroundings-rules.js';

// How far out it is drawn (metres): the settlement and its fields; the
// ground fades out before the generated hills begin.
const REACH = 240;
// The growth (0-1 of the houses) at the start of the first period shown,
// and at the start of each later one (the town is already there).
const FIRST_GROWTH = 0.35;
const LATER_GROWTH = 0.7;
// Years over which a house rises or sinks, and the wave's spread (years
// between the model and the rim) where a period replaces the last.
const RISE_YEARS = 3;
const SWAP_SPREAD = 7;

// The viewer's schematic colours (editor/surroundings.js PALETTE), summer.
const COLOURS = {
  ground: 0xc9c7b8,
  fields: [0xd3cdb2, 0xc4c6a8, 0xbdb9a2],
  road: 0xdcd6c8,
  rail: 0x9a9488,
  wall: 0xd8d2c6,
  masonry: 0xcfc6b8,
  roof: 0xb3a898,
  conifer: 0x9fae9b,
  broadleaf: 0xb1bda4,
  trunk: 0xb0a696,
  water: 0x8fa9bf,
};

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * The periods (the viewer's eras) met between two years, each with the
 * years of it shown: [{ period, from, to }].
 */
export function surroundingsSpans(from, to) {
  return SURROUNDINGS_ERAS
    .filter((era) => era.end > from && era.start <= to)
    .map((era) => ({ period: era.period, from: Math.max(from, era.start), to: Math.min(to, era.end) }));
}

/** The dates for a timeline: the first, each new period's start, the last. */
export function surroundingsDates(from, to) {
  const dates = [from, ...surroundingsSpans(from, to).slice(1).map((span) => span.from), to];
  return [...new Set(dates)];
}

// Collects triangles: positions, colours and, per vertex, the foot it rises
// from, the years it stands (born, gone) and its distance from the model.
function createWriter() {
  const position = [];
  const color = [];
  const foot = [];
  const life = [];
  const distance = [];
  let current = { foot: 0, born: -Infinity, gone: Infinity, distance: 0 };
  const push = (p, c) => {
    position.push(p[0], p[1], p[2]);
    color.push(c.r, c.g, c.b);
    foot.push(current.foot);
    life.push(current.born, current.gone);
    distance.push(current.distance);
  };
  return {
    set(next) { current = { ...current, ...next }; },
    tri(a, b, c, col) { push(a, col); push(b, col); push(c, col); },
    quad(a, b, c, d, col) { push(a, col); push(b, col); push(c, col); push(a, col); push(c, col); push(d, col); },
    geometry() {
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new BufferAttribute(new Float32Array(position), 3));
      geometry.setAttribute('color', new BufferAttribute(new Float32Array(color), 3));
      geometry.setAttribute('aFoot', new BufferAttribute(new Float32Array(foot), 1));
      geometry.setAttribute('aLife', new BufferAttribute(new Float32Array(life.map((v) => (Number.isFinite(v) ? v : v > 0 ? 1e6 : -1e6))), 2));
      geometry.setAttribute('aDist', new BufferAttribute(new Float32Array(distance), 1));
      geometry.computeVertexNormals();
      return geometry;
    },
    get count() { return position.length / 9; },
  };
}

// A house, a church, a station: a box under its roof (as the viewer's
// writeBlock). `m` maps metres (x, y, z) to the intro's space.
function writeBlock(writer, block, m, wall, roof) {
  const cos = Math.cos(block.angle);
  const sin = Math.sin(block.angle);
  const at = (lx, ly, lz) => m(block.x + lx * cos - lz * sin, ly, block.z + lx * sin + lz * cos);
  const hw = block.w / 2;
  const hd = block.d / 2;
  const h = block.h;
  const base = [at(-hw, -0.5, -hd), at(hw, -0.5, -hd), at(hw, -0.5, hd), at(-hw, -0.5, hd)];
  const top = [at(-hw, h, -hd), at(hw, h, -hd), at(hw, h, hd), at(-hw, h, hd)];
  for (let side = 0; side < 4; side += 1) {
    const next = (side + 1) % 4;
    writer.quad(base[next], base[side], top[side], top[next], wall);
  }
  const rise = h + (block.roofHeight || 0);
  if (block.roof === 'pyramid' || block.roof === 'onion') {
    const apex = at(0, rise, 0);
    for (let side = 0; side < 4; side += 1) writer.tri(top[(side + 1) % 4], top[side], apex, roof);
  } else if (block.roof === 'gable') {
    if (block.ridge === 'w') {
      const r0 = at(-hw, rise, 0);
      const r1 = at(hw, rise, 0);
      writer.quad(top[1], top[0], r0, r1, roof);
      writer.quad(top[3], top[2], r1, r0, roof);
      writer.tri(top[0], top[3], r0, wall);
      writer.tri(top[2], top[1], r1, wall);
    } else {
      const r0 = at(0, rise, -hd);
      const r1 = at(0, rise, hd);
      writer.quad(top[0], top[3], r1, r0, roof);
      writer.quad(top[2], top[1], r0, r1, roof);
      writer.tri(top[1], top[0], r0, wall);
      writer.tri(top[3], top[2], r1, wall);
    }
  } else {
    writer.quad(top[0], top[3], top[2], top[1], roof);
  }
}

// A tree: a cone (a conifer) or a double cone (a broadleaf) on a trunk.
function writeTree(writer, tree, m, crown, trunk) {
  const sides = 5;
  const conifer = tree.kind === 'conifer' || tree.kind === 'cypress';
  const ring = (share, height) => Array.from({ length: sides }, (_item, index) => {
    const angle = (index / sides) * Math.PI * 2 + tree.x;
    return m(tree.x + Math.cos(angle) * tree.r * share, tree.h * height, tree.z + Math.sin(angle) * tree.r * share);
  });
  const fan = (points, tip, tone, down = false) => {
    for (let side = 0; side < sides; side += 1) {
      const a = points[side];
      const b = points[(side + 1) % sides];
      if (down) writer.tri(a, b, tip, tone);
      else writer.tri(b, a, tip, tone);
    }
  };
  const from = conifer ? 0.15 : 0.3;
  const stem = ring(0.12, 0);
  const stemTop = ring(0.12, from + 0.05);
  for (let side = 0; side < sides; side += 1) {
    const next = (side + 1) % sides;
    writer.quad(stem[next], stem[side], stemTop[side], stemTop[next], trunk);
  }
  const apex = m(tree.x, tree.h, tree.z);
  if (conifer) {
    fan(ring(1, from), apex, crown);
    return;
  }
  const widest = ring(1, 0.55);
  fan(widest, m(tree.x, tree.h * from, tree.z), crown, true);
  fan(widest, apex, crown);
}

// A flat strip along a polyline (a road, the railway, a river), lifted a
// little over the ground.
function writeStrip(writer, points, width, lift, m, tone) {
  const half = width / 2;
  const edges = points.map(([x, z], index) => {
    const [px, pz] = points[Math.max(index - 1, 0)];
    const [nx, nz] = points[Math.min(index + 1, points.length - 1)];
    const length = Math.hypot(nx - px, nz - pz) || 1;
    const ox = (-(nz - pz) / length) * half;
    const oz = ((nx - px) / length) * half;
    return [m(x + ox, lift, z + oz), m(x - ox, lift, z - oz)];
  });
  for (let index = 0; index < edges.length - 1; index += 1) {
    writer.quad(edges[index][0], edges[index + 1][0], edges[index + 1][1], edges[index][1], tone);
  }
}

const key = (block) => `${block.role}|${Math.round(block.x * 2)}|${Math.round(block.z * 2)}|${Math.round(block.w)}|${Math.round(block.d)}|${Math.round(block.h)}`;

// Rises from its foot in its years, sinks after them; the whole fades in
// and out from the model outwards (uShow). Flat things fade instead.
// `tone` darkens the viewer's pale colours: a model town at night, the
// ground darker than what stands on it.
function riseMaterial(uniforms, { transparent = false, flat = false, tone = 0xffffff } = {}) {
  // Both sides: the winding of the shapes is not relied on.
  const material = new MeshStandardMaterial({ color: tone, vertexColors: true, roughness: 1, metalness: 0, transparent, side: DoubleSide });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aFoot;
        attribute vec2 aLife;
        attribute float aDist;
        uniform float uYear;
        uniform float uShow;
        uniform float uSpan;
        varying float vRise;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float rise = smoothstep(aLife.x - ${RISE_YEARS.toFixed(1)}, aLife.x, uYear)
          * (1.0 - smoothstep(aLife.y, aLife.y + ${RISE_YEARS.toFixed(1)}, uYear));
        float wave = clamp(aDist / uSpan, 0.0, 1.0);
        rise *= smoothstep(wave * 0.65, wave * 0.65 + 0.35, uShow);
        vRise = rise;
        ${flat ? '' : 'transformed.y = aFoot + (transformed.y - aFoot) * rise;'}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vRise;
        uniform float uSpan;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        if (vRise < 0.004) discard;
        ${flat ? 'diffuseColor.a *= vRise;' : ''}`);
  };
  material.customProgramCacheKey = () => `intro-surroundings-${flat ? 'flat' : 'built'}`;
  return material;
}

/**
 * @param {object} options
 *   params     the surroundings' parameters (kind, region, masonry, seed;
 *              editor/surroundings-rules.js normalizeSurroundings)
 *   from, to   the years shown
 *   radius     the model's footprint, its half-diagonal in metres
 *   toIntro    (x, y, z) in metres round the model's middle, y from its
 *              ground -> [x, y, z] in the intro's space
 * @returns {{ group, update(year, show), dates, spans }}
 */
export function createIntroSurroundings({ params, from, to, radius, toIntro }) {
  const spans = surroundingsSpans(from, to);
  if (!spans.length) throw new Error(`no generated surroundings for ${from}-${to}`);
  const group = new Group();
  group.name = 'intro-surroundings';
  const uniforms = { uYear: { value: from }, uShow: { value: 0 }, uSpan: { value: 1 } };
  const centre = toIntro(0, 0, 0);
  const span = Math.hypot(toIntro(REACH, 0, 0)[0] - centre[0], toIntro(REACH, 0, 0)[2] - centre[2]);
  uniforms.uSpan.value = span;
  const distanceOf = (x, z) => (Math.hypot(x, z) / REACH) * span;

  const built = createWriter();
  const flats = createWriter();
  const colour = (hex) => new Color(hex);
  const wall = colour(COLOURS.wall);
  const masonry = colour(COLOURS.masonry);
  const roof = colour(COLOURS.roof);
  const road = colour(COLOURS.road);
  const rail = colour(COLOURS.rail);
  const conifer = colour(COLOURS.conifer);
  const broadleaf = colour(COLOURS.broadleaf);
  const trunk = colour(COLOURS.trunk);
  const water = colour(COLOURS.water);
  const fields = COLOURS.fields.map(colour);

  // The growth a year stands for, within its period: a third of the houses
  // at the first period's start, most of them at a later period's.
  const growthAt = (span_, index, year) => {
    const start = index === 0 ? FIRST_GROWTH : LATER_GROWTH;
    return start + (1 - start) * smooth(span_.from, Math.max(span_.from + 1, span_.to), year);
  };
  // The year a growth is reached in a period (the inverse, sampled).
  const yearOf = (span_, index, growth) => {
    for (let year = span_.from; year <= span_.to; year += 1) {
      if (growthAt(span_, index, year) >= growth - 1e-6) return year;
    }
    return span_.to;
  };

  // What each period has, as items { key, kind, x, z, born, gone, draw }:
  // an item a period shares with the last (the same house, the same road)
  // stands on through the change instead of sinking and rising again.
  const m = (x, y, z) => toIntro(x, y, z);
  let trees = null;
  let previous = new Map();
  const items = [];
  spans.forEach((span_, index) => {
    const last = index === spans.length - 1;
    // The period's layout at each step of its growth: a house's first step
    // is the year it is built.
    const year = Math.round(Math.min(span_.to, Math.max(span_.from, (span_.from + span_.to) / 2)));
    const base = { ...params, year, period: span_.period, followTimeline: false };
    const firstGrowth = new Map();
    let full = null;
    for (let step = 0; ; step += 1) {
      const growth = Math.min(1, FIRST_GROWTH + step * 0.05);
      full = layoutSurroundings({ ...base, growth }, { radius });
      for (const block of full.blocks) if (!firstGrowth.has(key(block))) firstGrowth.set(key(block), growth);
      if (growth >= 1) break;
    }
    // Where it is replaced by the next period: a wave out from the model.
    const goneAt = (x, z) => (last ? Infinity : span_.to + (Math.hypot(x, z) / REACH) * SWAP_SPREAD);
    const bornAt = (x, z, growth) => {
      const own = index === 0 ? from : span_.from;
      const at = Math.max(own, yearOf(span_, index, growth));
      // A later period's first houses: just after the last period's went.
      return index > 0 && at <= span_.from ? span_.from + (Math.hypot(x, z) / REACH) * SWAP_SPREAD + RISE_YEARS : at;
    };
    const current = new Map();
    const add = (itemKey, kind, x, z, growth, draw) => {
      if (Math.hypot(x, z) > REACH) return;
      const gone = goneAt(x, z);
      const before = previous.get(itemKey);
      if (before) {
        before.gone = gone; // stands on
        current.set(itemKey, before);
        return;
      }
      const item = { kind, x, z, born: bornAt(x, z, growth), gone, draw };
      items.push(item);
      current.set(itemKey, item);
    };
    for (const block of full.blocks) {
      const timber = block.role === 'house' || block.role === 'barn' || block.role === 'farm';
      add(`b|${key(block)}`, 'built', block.x, block.z, firstGrowth.get(key(block)) ?? 1, () => {
        built.set({ foot: m(block.x, -0.5, block.z)[1] });
        writeBlock(built, block, m, timber ? wall : masonry, roof);
      });
    }
    for (const segment of full.walls || []) {
      const x = (segment.ax + segment.bx) / 2;
      const z = (segment.az + segment.bz) / 2;
      add(`w|${Math.round(x)}|${Math.round(z)}|${Math.round(segment.h)}`, 'built', x, z, FIRST_GROWTH, () => {
        built.set({ foot: m(x, 0, z)[1] });
        writeBlock(built, {
          x, z, w: Math.hypot(segment.bx - segment.ax, segment.bz - segment.az) + segment.t, d: segment.t, h: segment.h,
          angle: Math.atan2(segment.bz - segment.az, segment.bx - segment.ax), roof: 'none',
        }, m, masonry, masonry);
      });
    }
    // Roads, the railway, the fields: of their period, fading in and out.
    for (const field of full.fields) {
      if (field.polygon || Math.hypot(field.x, field.z) > REACH * 0.95) continue;
      add(`f|${Math.round(field.x)}|${Math.round(field.z)}|${Math.round(field.w)}|${Math.round(field.d)}`, 'flat', field.x, field.z, FIRST_GROWTH, () => {
        const cos = Math.cos(field.angle);
        const sin = Math.sin(field.angle);
        const corner = (lx, lz) => m(field.x + lx * cos - lz * sin, 0.15, field.z + lx * sin + lz * cos);
        const hw = field.w / 2;
        const hd = field.d / 2;
        flats.quad(corner(-hw, -hd), corner(-hw, hd), corner(hw, hd), corner(hw, -hd), fields[field.tone % fields.length]);
      });
    }
    const strip = (prefix, points, width, lift, tone) => {
      const near = points.filter(([x, z]) => Math.hypot(x, z) < REACH * 1.05);
      if (near.length < 2) return;
      const [x, z] = near[Math.floor(near.length / 2)];
      const itemKey = `${prefix}|${near.map(([px, pz]) => `${Math.round(px)},${Math.round(pz)}`).join(';')}`;
      add(itemKey, 'flat', Math.min(Math.hypot(x, z), REACH - 1) * Math.cos(Math.atan2(z, x)), Math.min(Math.hypot(x, z), REACH - 1) * Math.sin(Math.atan2(z, x)), FIRST_GROWTH,
        () => writeStrip(flats, near, width, lift, m, tone));
    };
    for (const way of full.roads) strip('r', way.points, way.width, 0.3, road);
    if (full.railway) strip('rail', full.railway.points, 4.2, 0.45, rail);
    if (full.water?.river) strip('water', full.water.river.points, full.water.river.width, 0.25, water);
    trees ??= full.trees;
    previous = current;
  });
  for (const item of items) {
    const writer = item.kind === 'built' ? built : flats;
    writer.set({ foot: 0, born: item.born, gone: item.gone, distance: distanceOf(item.x, item.z) });
    item.draw();
  }

  // The trees stand through it all (the first period's), thinning out
  // towards the rim.
  for (const tree of trees || []) {
    const distance = Math.hypot(tree.x, tree.z);
    const size = 1 - smooth(REACH * 0.7, REACH, distance);
    if (size < 0.25) continue;
    built.set({ foot: toIntro(tree.x, 0, tree.z)[1], born: -Infinity, gone: Infinity, distance: distanceOf(tree.x, tree.z) });
    writeTree(built, { ...tree, h: tree.h * size, r: tree.r * size }, toIntro,
      tree.kind === 'conifer' || tree.kind === 'cypress' ? conifer : broadleaf, trunk);
  }

  // The ground: a disc fading out at the rim (its colour's alpha).
  const ground = createWriter();
  ground.set({ foot: 0, born: -Infinity, gone: Infinity, distance: 0 });
  const groundColour = colour(COLOURS.ground);
  const rings = 24;
  const segments = 72;
  const discPoint = (ring, segment) => {
    const r = REACH * 1.08 * (ring / rings);
    const angle = (segment / segments) * Math.PI * 2;
    return toIntro(Math.cos(angle) * r, 0, Math.sin(angle) * r);
  };
  for (let ring = 0; ring < rings; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      ground.set({ distance: (span * (ring + 0.5)) / rings });
      ground.quad(discPoint(ring, segment), discPoint(ring, segment + 1), discPoint(ring + 1, segment + 1), discPoint(ring + 1, segment), groundColour);
    }
  }
  const groundGeometry = ground.geometry();
  // Alpha in the colour: opaque in the middle, gone at the rim.
  const groundPositions = groundGeometry.getAttribute('position');
  const groundColours = groundGeometry.getAttribute('color');
  const rgba = new Float32Array(groundPositions.count * 4);
  for (let i = 0; i < groundPositions.count; i += 1) {
    const d = Math.hypot(groundPositions.getX(i) - centre[0], groundPositions.getZ(i) - centre[2]) / span;
    rgba[i * 4] = groundColours.getX(i);
    rgba[i * 4 + 1] = groundColours.getY(i);
    rgba[i * 4 + 2] = groundColours.getZ(i);
    rgba[i * 4 + 3] = 1 - smooth(0.62, 1.05, d);
  }
  groundGeometry.setAttribute('color', new BufferAttribute(rgba, 4));
  const groundMesh = new Mesh(groundGeometry, riseMaterial(uniforms, { transparent: true, flat: true, tone: 0x5c5c5c }));
  groundMesh.material.polygonOffset = true;
  groundMesh.material.polygonOffsetFactor = 2;
  groundMesh.material.polygonOffsetUnits = 2;
  groundMesh.renderOrder = -3;
  const flatsMesh = new Mesh(flats.geometry(), riseMaterial(uniforms, { transparent: true, flat: true, tone: 0x8a8a8a }));
  flatsMesh.renderOrder = -2;
  const builtMesh = new Mesh(built.geometry(), riseMaterial(uniforms, { tone: 0xc8c8c8 }));
  for (const mesh of [groundMesh, flatsMesh, builtMesh]) {
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.raycast = () => {};
  }
  group.add(groundMesh, flatsMesh, builtMesh);
  group.visible = false;

  return {
    group,
    spans,
    dates: surroundingsDates(from, to),
    /** The period of a year: its key (SURROUNDINGS_ERAS). */
    periodAt(year) {
      return (spans.find((s, index) => year < s.to || index === spans.length - 1) || spans[0])?.period;
    },
    /**
     * @param {number} year  the year shown
     * @param {number} show  0..1: rising out of the ground from the model
     *   outwards (0: gone)
     */
    update(year, show) {
      uniforms.uYear.value = year;
      uniforms.uShow.value = show;
      group.visible = show > 0.001;
    },
  };
}
