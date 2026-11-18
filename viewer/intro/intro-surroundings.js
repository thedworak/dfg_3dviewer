// The intro's surroundings through time (feature-tour.js, its last
// chapter): the viewer's generated surroundings (editor/surroundings-rules.js,
// docs/surroundings.md) round the model, through all the periods they cover
// (900-2025), a settlement of the scene's kind and region growing house by
// house, rebuilt where a new period begins. Then, seen from above, other
// kinds of place in other regions, in colour and with their life moving
// (people, carts, boats; editor/surroundings-life.js) - a glimpse of the
// realistic look and its life.
//
// The layouts are the viewer's own (the same rules, the same seeds); only
// the drawing is the intro's: light enough for a phone. Each house rises
// from the ground when it is built (a vertex shader scales it up from its
// foot); what a new period replaces sinks back, in a wave from the model
// outwards.
//
// Time runs on the viewer's slider of the periods (surroundingsYearToSlider):
// each period gets the same share, as on the slider - a century of the early
// Middle Ages changes about as much as a decade after 1945. Positions below
// are in periods (the slider's value / its steps per period).
//
// What is generated is a typical setting of a kind of place and its time,
// not a reconstruction of this place: the page says so while it shows, a
// comparison only.
//
// The layouts take a while (about 20 ms each, dozens of them), so they are
// worked out in the background a few at a time, long before the chapter.
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  SURROUNDINGS_ERAS,
  SURROUNDINGS_SLIDER_STEPS,
  layoutSurroundings,
  surroundingsSliderToYear,
  surroundingsWaterDistance,
  surroundingsYearToSlider,
} from '../editor/surroundings-rules.js';
import { lifeAt, planSurroundingsLife } from '../editor/surroundings-life.js';

// How far out it is drawn (metres): the settlement and its fields; the
// ground fades out before the generated hills begin.
const REACH = 260;
// The growth (0-1 of the houses) at the start of the first period shown,
// and at the start of each later one (the place is already there); the
// steps it is worked out at.
const FIRST_GROWTH = 0.35;
const LATER_GROWTH = 0.7;
const GROWTH_STEP = 0.1;
// Periods (positions) over which a house rises or sinks, and the wave's
// spread (from the model to the rim) where a period replaces the last.
const RISE = 0.07;
const SWAP_SPREAD = 0.22;

// The viewer's schematic colours (editor/surroundings.js PALETTE), summer.
const SCHEMATIC = {
  ground: 0xc9c7b8,
  fields: [0xd3cdb2, 0xc4c6a8, 0xbdb9a2],
  road: 0xdcd6c8,
  rail: 0x9a9488,
  walls: [0xd8d2c6],
  masonry: [0xcfc6b8],
  roofs: [0xb3a898],
  conifer: 0x9fae9b,
  broadleaf: 0xb1bda4,
  trunk: 0xb0a696,
  water: 0x8fa9bf,
};
// The realistic look, roughly: the building traditions' colours by region
// (as editor/surroundings-realistic.js has them), grass, crops, water.
const REGION_LOOK = {
  central: { walls: [0xe9e2d2, 0xd9cdb5, 0xc9b28c], masonry: [0xb5603f, 0xa65537], roofs: [0xa8462e, 0x8f3b28, 0xb0563a] },
  mediterranean: { walls: [0xeee3c9, 0xe5cfa4, 0xd9b98a], masonry: [0xd8c9a8, 0xcbb894], roofs: [0xc46a3d, 0xb85b33, 0xd27a48] },
  nordic: { walls: [0x8e2a1e, 0xa0381f, 0xc89a3a, 0xe8e2d4], masonry: [0xe8e6e0], roofs: [0x3b3b38, 0x5a4a3a, 0x4f6a3a] },
  british: { walls: [0xb8ad98, 0xa89f8c, 0x9c5a40], masonry: [0xb3aa96, 0xa39a86], roofs: [0x4a4e57, 0x3f434b, 0xb89a5a] },
  eastern: { walls: [0x7a5a3a, 0x8a6a48, 0x6a4c30], masonry: [0xe6e0d4, 0xd8cfbe], roofs: [0xa8905a, 0x8f7a4a, 0x6f8a6a] },
};
const REALISTIC = {
  ground: 0x5f7d3e,
  fields: [0xa8a04a, 0x7f9a45, 0xc2a75a, 0x8a7a42],
  road: 0xa89878,
  rail: 0x4a4238,
  conifer: 0x2f4f2a,
  broadleaf: 0x4f7a32,
  trunk: 0x5a4430,
  water: 0x2f5f7f,
};

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const later = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A year as a position on the periods' slider (in periods). */
export const positionOfYear = (year) => surroundingsYearToSlider(year) / SURROUNDINGS_SLIDER_STEPS;
/** A position (in periods) as a year. */
export const yearOfPosition = (position) => surroundingsSliderToYear(position * SURROUNDINGS_SLIDER_STEPS);

/**
 * The periods (the viewer's eras) met between two years, each with its
 * positions shown: [{ period, from, to }] (positions, in periods).
 */
export function surroundingsSpans(fromYear, toYear) {
  return SURROUNDINGS_ERAS
    .filter((era) => era.end > fromYear && era.start <= toYear)
    .map((era) => ({
      period: era.period,
      from: positionOfYear(Math.max(fromYear, era.start)),
      to: positionOfYear(Math.min(toYear, era.end)),
    }));
}

/** The dates for a timeline: the first year, each new period's, the last. */
export function surroundingsDates(fromYear, toYear) {
  const dates = [fromYear, ...SURROUNDINGS_ERAS.map((era) => era.start).filter((year) => year > fromYear && year < toYear), toYear];
  return [...new Set(dates)];
}

// Collects triangles: positions, colours and, per vertex, the foot it rises
// from, the positions it stands between (born, gone) and its distance from
// the model.
function createWriter() {
  const position = [];
  const color = [];
  const foot = [];
  const life = [];
  const distance = [];
  let current = { foot: 0, born: -1e6, gone: 1e6, distance: 0 };
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
      const clamp = (v) => Math.max(-1e6, Math.min(1e6, v));
      geometry.setAttribute('aLife', new BufferAttribute(new Float32Array(life.map(clamp)), 2));
      geometry.setAttribute('aDist', new BufferAttribute(new Float32Array(distance), 1));
      geometry.computeVertexNormals();
      return geometry;
    },
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
  const fan = (points, tip, tone) => {
    for (let side = 0; side < sides; side += 1) writer.tri(points[(side + 1) % sides], points[side], tip, tone);
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
  fan(widest, m(tree.x, tree.h * from, tree.z), crown);
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

// Rises from its foot in its time, sinks after it; the whole rises and
// sinks from the model outwards (uShow). Flat things fade instead.
// `tone` darkens the colours (the schematic look: a model town at night).
function riseMaterial(uniforms, { transparent = false, flat = false, tone = 0xffffff, name = '' } = {}) {
  // Both sides: the winding of the shapes is not relied on.
  const material = new MeshStandardMaterial({ color: tone, vertexColors: true, roughness: 1, metalness: 0, transparent, side: DoubleSide });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aFoot;
        attribute vec2 aLife;
        attribute float aDist;
        uniform float uAt;
        uniform float uShow;
        uniform float uSpan;
        varying float vRise;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float rise = smoothstep(aLife.x - ${RISE.toFixed(3)}, aLife.x, uAt)
          * (1.0 - smoothstep(aLife.y, aLife.y + ${RISE.toFixed(3)}, uAt));
        float wave = clamp(aDist / uSpan, 0.0, 1.0);
        rise *= smoothstep(wave * 0.65, wave * 0.65 + 0.35, uShow);
        vRise = rise;
        ${flat ? '' : 'transformed.y = aFoot + (transformed.y - aFoot) * rise;'}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vRise;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        if (vRise < 0.004) discard;
        ${flat ? 'diffuseColor.a *= vRise;' : ''}`);
  };
  material.customProgramCacheKey = () => `intro-surroundings-${flat ? 'flat' : 'built'}-${name}`;
  return material;
}

// The ground: a disc fading out at the rim (its colour's alpha); the
// water's colour where the layout has water (a port's sea, a pond).
function groundGeometry({ layout, colourOf, waterColour, toIntro, span }) {
  const ground = createWriter();
  const rings = 36;
  const segments = 96;
  const centre = toIntro(0, 0, 0);
  const at = (ring, segment) => {
    const r = REACH * 1.08 * (ring / rings) ** 1.2;
    const angle = (segment / segments) * Math.PI * 2;
    return [Math.cos(angle) * r, Math.sin(angle) * r];
  };
  const wet = (x, z) => layout && waterColour && surroundingsWaterDistance(layout, x, z) < 0;
  for (let ring = 0; ring < rings; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const corners = [at(ring, segment), at(ring, segment + 1), at(ring + 1, segment + 1), at(ring + 1, segment)];
      const [mx, mz] = [(corners[0][0] + corners[2][0]) / 2, (corners[0][1] + corners[2][1]) / 2];
      ground.set({ distance: (span * Math.hypot(mx, mz)) / REACH });
      const tone = wet(mx, mz) ? waterColour : colourOf(mx, mz);
      const [a, b, c, d] = corners.map(([x, z]) => toIntro(x, 0, z));
      ground.quad(a, b, c, d, tone);
    }
  }
  const geometry = ground.geometry();
  const positions = geometry.getAttribute('position');
  const colours = geometry.getAttribute('color');
  const rgba = new Float32Array(positions.count * 4);
  for (let i = 0; i < positions.count; i += 1) {
    const d = Math.hypot(positions.getX(i) - centre[0], positions.getZ(i) - centre[2]) / span;
    rgba[i * 4] = colours.getX(i);
    rgba[i * 4 + 1] = colours.getY(i);
    rgba[i * 4 + 2] = colours.getZ(i);
    rgba[i * 4 + 3] = 1 - smooth(0.62, 1.05, d);
  }
  geometry.setAttribute('color', new BufferAttribute(rgba, 4));
  return geometry;
}

function meshes(group, uniforms, { ground, flats, built }, look, name) {
  const tones = look === 'realistic' ? [0xb4b4b4, 0xd0d0d0, 0xe0e0e0] : [0x5c5c5c, 0x8a8a8a, 0xc8c8c8];
  const groundMesh = new Mesh(ground, riseMaterial(uniforms, { transparent: true, flat: true, tone: tones[0], name: `${name}-g` }));
  groundMesh.material.polygonOffset = true;
  groundMesh.material.polygonOffsetFactor = 2;
  groundMesh.material.polygonOffsetUnits = 2;
  groundMesh.renderOrder = -3;
  const flatsMesh = new Mesh(flats.geometry(), riseMaterial(uniforms, { transparent: true, flat: true, tone: tones[1], name: `${name}-f` }));
  flatsMesh.renderOrder = -2;
  const builtMesh = new Mesh(built.geometry(), riseMaterial(uniforms, { tone: tones[2], name: `${name}-b` }));
  for (const mesh of [groundMesh, flatsMesh, builtMesh]) {
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.raycast = () => {};
  }
  group.add(groundMesh, flatsMesh, builtMesh);
}

// A deterministic pick from a list (a house keeps its colour).
const pickOf = (list, x, z) => list[Math.abs(Math.round(x * 7.31 + z * 3.17)) % list.length];

/**
 * The settlement through the periods (schematic, a model town).
 * @param {object} options
 *   params     the surroundings' parameters (kind, region, masonry, seed;
 *              editor/surroundings-rules.js normalizeSurroundings)
 *   from, to   the years shown
 *   radius     the model's footprint, its half-diagonal in metres
 *   toIntro    (x, y, z) in metres round the model's middle, y from its
 *              ground -> [x, y, z] in the intro's space
 * @returns {{ group, ready, spans, dates, from, to, update(position, show) }}
 *   positions in periods (positionOfYear); `ready` resolves once drawn
 */
export function createIntroSurroundings({ params, from, to, radius, toIntro }) {
  const spans = surroundingsSpans(from, to);
  if (!spans.length) throw new Error(`no generated surroundings for ${from}-${to}`);
  const group = new Group();
  group.name = 'intro-surroundings';
  group.visible = false;
  const uniforms = { uAt: { value: spans[0].from }, uShow: { value: 0 }, uSpan: { value: 1 } };
  const centre = toIntro(0, 0, 0);
  const span = Math.hypot(toIntro(REACH, 0, 0)[0] - centre[0], toIntro(REACH, 0, 0)[2] - centre[2]);
  uniforms.uSpan.value = span;
  let built = false;

  const ready = (async () => {
    const colour = (hex) => new Color(hex);
    const wall = colour(SCHEMATIC.walls[0]);
    const masonry = colour(SCHEMATIC.masonry[0]);
    const roof = colour(SCHEMATIC.roofs[0]);
    const road = colour(SCHEMATIC.road);
    const rail = colour(SCHEMATIC.rail);
    const fields = SCHEMATIC.fields.map(colour);
    const builtWriter = createWriter();
    const flats = createWriter();
    const distanceOf = (x, z) => (Math.hypot(x, z) / REACH) * span;
    const m = (x, y, z) => toIntro(x, y, z);

    // The growth at a position within its period: a third of the houses at
    // the first period's start, most of them at a later period's.
    const growthAt = (s, index, at) => {
      const start = index === 0 ? FIRST_GROWTH : LATER_GROWTH;
      return start + (1 - start) * smooth(s.from, Math.max(s.from + 1e-3, s.to), at);
    };
    // Where in a period a growth is reached (the inverse, sampled).
    const positionOf = (s, index, growth) => {
      for (let at = s.from; at <= s.to; at += 0.005) if (growthAt(s, index, at) >= growth - 1e-6) return at;
      return s.to;
    };

    // What each period has, as items: one a period shares with the last
    // (the same house, the same road) stands on through the change instead
    // of sinking and rising again.
    let trees = null;
    let previous = new Map();
    const items = [];
    for (let index = 0; index < spans.length; index += 1) {
      const s = spans[index];
      const last = index === spans.length - 1;
      const year = Math.round((yearOfPosition(s.from) + yearOfPosition(s.to)) / 2);
      const base = { ...params, year, period: s.period, followTimeline: false };
      const firstGrowth = new Map();
      let full = null;
      for (let step = 0; ; step += 1) {
        const growth = Math.min(1, FIRST_GROWTH + step * GROWTH_STEP);
        full = layoutSurroundings({ ...base, growth }, { radius });
        for (const block of full.blocks) if (!firstGrowth.has(key(block))) firstGrowth.set(key(block), growth);
        await later(); // a frame between the layouts
        if (growth >= 1) break;
      }
      const goneAt = (x, z) => (last ? 1e6 : s.to + (Math.hypot(x, z) / REACH) * SWAP_SPREAD);
      const bornAt = (x, z, growth) => {
        const at = positionOf(s, index, growth);
        // A later period's first houses: just after the last period's went.
        return index > 0 && at <= s.from + 1e-3 ? s.from + (Math.hypot(x, z) / REACH) * SWAP_SPREAD + RISE : at;
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
        const item = { kind, x, z, born: index === 0 && growth <= FIRST_GROWTH ? -1e6 : bornAt(x, z, growth), gone, draw };
        items.push(item);
        current.set(itemKey, item);
      };
      for (const block of full.blocks) {
        const timber = block.role === 'house' || block.role === 'barn' || block.role === 'farm';
        add(`b|${key(block)}`, 'built', block.x, block.z, firstGrowth.get(key(block)) ?? 1, () => {
          builtWriter.set({ foot: m(block.x, -0.5, block.z)[1] });
          writeBlock(builtWriter, block, m, timber ? wall : masonry, roof);
        });
      }
      for (const segment of full.walls || []) {
        const x = (segment.ax + segment.bx) / 2;
        const z = (segment.az + segment.bz) / 2;
        add(`w|${Math.round(x)}|${Math.round(z)}|${Math.round(segment.h)}`, 'built', x, z, FIRST_GROWTH, () => {
          builtWriter.set({ foot: m(x, 0, z)[1] });
          writeBlock(builtWriter, {
            x, z, w: Math.hypot(segment.bx - segment.ax, segment.bz - segment.az) + segment.t, d: segment.t, h: segment.h,
            angle: Math.atan2(segment.bz - segment.az, segment.bx - segment.ax), roof: 'none',
          }, m, masonry, masonry);
        });
      }
      for (const field of full.fields) {
        if (field.polygon || Math.hypot(field.x, field.z) > REACH * 0.95) continue;
        add(`f|${Math.round(field.x)}|${Math.round(field.z)}|${Math.round(field.w)}|${Math.round(field.d)}`, 'flat', field.x, field.z, FIRST_GROWTH, () => {
          writeField(flats, field, m, fields[field.tone % fields.length]);
        });
      }
      const strip = (prefix, points, width, lift, tone) => {
        const near = points.filter(([x, z]) => Math.hypot(x, z) < REACH * 1.05);
        if (near.length < 2) return;
        const [x, z] = near[Math.floor(near.length / 2)];
        const r = Math.min(Math.hypot(x, z), REACH - 1);
        const angle = Math.atan2(z, x);
        add(`${prefix}|${near.map(([px, pz]) => `${Math.round(px)},${Math.round(pz)}`).join(';')}`, 'flat', r * Math.cos(angle), r * Math.sin(angle), FIRST_GROWTH,
          () => writeStrip(flats, near, width, lift, m, tone));
      };
      for (const way of full.roads) strip('r', way.points, way.width, 0.3, road);
      if (full.railway) strip('rail', full.railway.points, 4.2, 0.45, rail);
      trees ??= full.trees;
      previous = current;
    }
    for (const item of items) {
      const writer = item.kind === 'built' ? builtWriter : flats;
      writer.set({ foot: 0, born: item.born, gone: item.gone, distance: distanceOf(item.x, item.z) });
      item.draw();
    }
    // The trees stand through it all, thinning out towards the rim.
    builtWriter.set({ born: -1e6, gone: 1e6 });
    writeTrees(builtWriter, trees, toIntro, distanceOf, colour(SCHEMATIC.conifer), colour(SCHEMATIC.broadleaf), colour(SCHEMATIC.trunk));
    const ground = groundGeometry({ layout: null, colourOf: () => colour(SCHEMATIC.ground), toIntro, span });
    meshes(group, uniforms, { ground, flats, built: builtWriter }, 'schematic', 'run');
    built = true;
  })();
  ready.catch((error) => console.warn('[intro] surroundings:', error));

  return {
    group,
    ready,
    spans,
    from: spans[0].from,
    to: spans.at(-1).to,
    dates: surroundingsDates(from, to),
    /** The period at a position: its key (SURROUNDINGS_ERAS). */
    periodAt(position) {
      return (spans.find((s, index) => position < s.to || index === spans.length - 1) || spans[0]).period;
    },
    /**
     * @param {number} position  where on the periods' slider (in periods)
     * @param {number} show      0..1: rising out of the ground from the
     *   model outwards (0: gone)
     */
    update(position, show) {
      uniforms.uAt.value = position;
      uniforms.uShow.value = show;
      group.visible = built && show > 0.001;
    },
  };
}

function writeField(writer, field, m, tone) {
  const cos = Math.cos(field.angle);
  const sin = Math.sin(field.angle);
  const corner = (lx, lz) => m(field.x + lx * cos - lz * sin, 0.15, field.z + lx * sin + lz * cos);
  const hw = field.w / 2;
  const hd = field.d / 2;
  writer.quad(corner(-hw, -hd), corner(-hw, hd), corner(hw, hd), corner(hw, -hd), tone);
}

function writeTrees(writer, trees, toIntro, distanceOf, conifer, broadleaf, trunk) {
  for (const tree of trees || []) {
    const distance = Math.hypot(tree.x, tree.z);
    const size = 1 - smooth(REACH * 0.7, REACH, distance);
    if (size < 0.25) continue;
    writer.set({ foot: toIntro(tree.x, 0, tree.z)[1], distance: distanceOf(tree.x, tree.z) });
    writeTree(writer, { ...tree, h: tree.h * size, r: tree.r * size }, toIntro,
      tree.kind === 'conifer' || tree.kind === 'cypress' ? conifer : broadleaf, trunk);
  }
}

// --- Other kinds of place, other regions: in colour, with their life --------

// The figures (as editor/surroundings-life-mesh.js), facing +Z; larger than
// life, so they show from above. White parts take the instance's colour.
const FIGURE_SCALE = 2.6;
function part(w, h, d, x, y, z, colour) {
  const geometry = new BoxGeometry(w, h, d);
  geometry.translate(x, y, z);
  const value = new Color(colour);
  const colours = new Float32Array(geometry.attributes.position.count * 3);
  for (let index = 0; index < geometry.attributes.position.count; index += 1) value.toArray(colours, index * 3);
  geometry.setAttribute('color', new BufferAttribute(colours, 3));
  geometry.deleteAttribute('uv');
  return geometry;
}
const SHAPES = {
  person: () => mergeGeometries([part(0.46, 0.75, 0.3, 0, 1.12, 0, 0xffffff), part(0.4, 0.75, 0.26, 0, 0.38, 0, 0x5a5a5a), part(0.24, 0.26, 0.24, 0, 1.64, 0, 0xd9b49a)]),
  cart: () => mergeGeometries([part(1.4, 0.55, 2.4, 0, 0.95, 0, 0x7b5b3e), part(0.5, 0.9, 1.7, 0, 1.15, 2.2, 0x5a3e2a)]),
  car: () => mergeGeometries([part(1.7, 0.75, 4, 0, 0.6, 0, 0xffffff), part(1.5, 0.55, 2, 0, 1.25, -0.2, 0x2a3036)]),
  rowing: () => mergeGeometries([part(1.3, 0.45, 4.2, 0, 0.1, 0, 0x6a4a32), part(0.5, 0.9, 0.4, 0, 0.7, -0.4, 0xffffff)]),
  sail: () => mergeGeometries([part(2.2, 0.8, 7.5, 0, 0.2, 0, 0x5a3e2a), part(0.15, 6.5, 0.15, 0, 3.8, 0.5, 0x4a3424), part(0.06, 4.8, 3.2, 0, 4.2, -0.6, 0xeee6d2)]),
  motor: () => mergeGeometries([part(1.9, 0.6, 5.2, 0, 0.2, 0, 0xf2f2f2), part(1.4, 0.8, 1.6, 0, 0.9, -0.6, 0x2f5f8f)]),
};
const PAINT = [0x8a2f2f, 0x2f4f7a, 0xd8d8d0, 0x3f3f3f, 0x6f8f4f, 0xc9a24a];

// The life of a layout, moving: an instanced mesh a kind of figure, placed
// in the intro's space each frame. `scale`: intro units a metre.
function createLife(layout, toIntro, scale) {
  const plan = planSurroundingsLife(layout, { light: true });
  const group = new Group();
  const material = new MeshLambertMaterial({ vertexColors: true });
  const entries = [];
  const add = (shape, list, colourOf) => {
    const near = list.filter((agent) => agent.path.points.some(([x, z]) => Math.hypot(x, z) < REACH));
    if (!near.length) return;
    const mesh = new InstancedMesh(SHAPES[shape](), material, near.length);
    mesh.frustumCulled = false;
    mesh.raycast = () => {};
    const colour = new Color();
    near.forEach((agent, index) => mesh.setColorAt(index, colour.set(colourOf(agent, index))));
    group.add(mesh);
    entries.push({ mesh, list: near });
  };
  add('person', plan.people, (agent) => agent.colour);
  add('cart', plan.vehicles.filter((agent) => agent.kind === 'cart'), () => 0xffffff);
  add('car', plan.vehicles.filter((agent) => agent.kind === 'car'), (_agent, index) => PAINT[index % PAINT.length]);
  for (const kind of ['rowing', 'sail', 'motor']) add(kind, plan.boats.filter((agent) => agent.kind === kind), () => 0x8a7b62);
  const matrix = new Matrix4();
  const rotation = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const position = new Vector3();
  const size = new Vector3().setScalar(scale * FIGURE_SCALE);
  return {
    group,
    count: entries.reduce((sum, entry) => sum + entry.list.length, 0),
    update(seconds) {
      for (const { mesh, list } of entries) {
        list.forEach((agent, index) => {
          // Walking faster than life, so it reads at this distance.
          const at = lifeAt(agent.path, agent.start + agent.speed * seconds * 3, agent.loop === true);
          const side = agent.side || 0;
          const x = at.x - Math.sin(at.heading) * side;
          const z = at.z + Math.cos(at.heading) * side;
          const [px, py, pz] = toIntro(x, 0.1, z);
          rotation.setFromAxisAngle(up, Math.PI / 2 - at.heading);
          mesh.setMatrixAt(index, matrix.compose(position.set(px, py, pz), rotation, size));
        });
        mesh.instanceMatrix.needsUpdate = true;
      }
    },
  };
}

/**
 * Other kinds of place in other regions, one after another, in colour and
 * with their life moving.
 * @param {object} options
 *   variants   [{ kind, region, year, masonry? }]
 *   seed       the layouts' seed
 *   radius, toIntro  as createIntroSurroundings
 * @returns {{ group, ready, variants, update(index, show, seconds) }}
 */
export function createSurroundingsShowcase({ variants, seed = 3, radius, toIntro }) {
  const group = new Group();
  group.name = 'intro-surroundings-showcase';
  group.visible = false;
  const centre = toIntro(0, 0, 0);
  const span = Math.hypot(toIntro(REACH, 0, 0)[0] - centre[0], toIntro(REACH, 0, 0)[2] - centre[2]);
  const scale = span / REACH;
  const built = [];
  const ready = (async () => {
    for (const [index, variant] of variants.entries()) {
      await later();
      const layout = layoutSurroundings({
        kind: variant.kind, region: variant.region, year: variant.year, seed: seed + index * 17,
        masonry: variant.masonry || (variant.region === 'central' || variant.region === 'eastern' ? 'brick' : 'stone'),
        style: 'realistic', growth: 1,
      }, { radius });
      const look = REGION_LOOK[variant.region] || REGION_LOOK.central;
      const colour = (hex) => new Color(hex);
      const tones = (list) => list.map(colour);
      const walls = tones(look.walls);
      const masonry = tones(look.masonry);
      const roofs = tones(look.roofs);
      const fields = tones(REALISTIC.fields);
      const builtWriter = createWriter();
      const flats = createWriter();
      const distanceOf = (x, z) => (Math.hypot(x, z) / REACH) * span;
      for (const block of layout.blocks) {
        if (Math.hypot(block.x, block.z) > REACH) continue;
        const timber = block.role === 'house' || block.role === 'barn' || block.role === 'farm';
        builtWriter.set({ foot: toIntro(block.x, -0.5, block.z)[1], distance: distanceOf(block.x, block.z) });
        writeBlock(builtWriter, block, toIntro, pickOf(timber ? walls : masonry, block.x, block.z), pickOf(roofs, block.z, block.x));
      }
      for (const segment of layout.walls || []) {
        const x = (segment.ax + segment.bx) / 2;
        const z = (segment.az + segment.bz) / 2;
        if (Math.hypot(x, z) > REACH) continue;
        builtWriter.set({ foot: toIntro(x, 0, z)[1], distance: distanceOf(x, z) });
        writeBlock(builtWriter, {
          x, z, w: Math.hypot(segment.bx - segment.ax, segment.bz - segment.az) + segment.t, d: segment.t, h: segment.h,
          angle: Math.atan2(segment.bz - segment.az, segment.bx - segment.ax), roof: 'none',
        }, toIntro, masonry[0], masonry[0]);
      }
      writeTrees(builtWriter, layout.trees, toIntro, distanceOf, colour(REALISTIC.conifer), colour(REALISTIC.broadleaf), colour(REALISTIC.trunk));
      for (const field of layout.fields) {
        if (field.polygon || Math.hypot(field.x, field.z) > REACH * 0.95) continue;
        flats.set({ distance: distanceOf(field.x, field.z) });
        writeField(flats, field, toIntro, fields[field.tone % fields.length]);
      }
      const strip = (points, width, lift, tone) => {
        const near = points.filter(([x, z]) => Math.hypot(x, z) < REACH * 1.05);
        if (near.length < 2) return;
        flats.set({ distance: distanceOf(...near[Math.floor(near.length / 2)]) });
        writeStrip(flats, near, width, lift, toIntro, tone);
      };
      for (const way of layout.roads) strip(way.points, way.width, 0.3, colour(REALISTIC.road));
      if (layout.railway) strip(layout.railway.points, 4.2, 0.45, colour(REALISTIC.rail));
      if (layout.water.river) strip(layout.water.river.points, layout.water.river.width, 0.25, colour(REALISTIC.water));
      const grass = colour(REALISTIC.ground);
      const ground = groundGeometry({ layout, colourOf: () => grass, waterColour: colour(REALISTIC.water), toIntro, span });
      const uniforms = { uAt: { value: 0 }, uShow: { value: 0 }, uSpan: { value: span } };
      const variantGroup = new Group();
      variantGroup.visible = false;
      meshes(variantGroup, uniforms, { ground, flats, built: builtWriter }, 'realistic', `v${index}`);
      const life = createLife(layout, toIntro, scale);
      variantGroup.add(life.group);
      group.add(variantGroup);
      built[index] = { group: variantGroup, uniforms, life };
    }
  })();
  ready.catch((error) => console.warn('[intro] surroundings, the other places:', error));
  return {
    group,
    ready,
    variants,
    /**
     * @param {number[]} shows  0..1 for each variant (rising and sinking)
     * @param {number} seconds  the clock, for the life's moving
     */
    update(shows, seconds) {
      let any = false;
      shows.forEach((show, index) => {
        const entry = built[index];
        if (!entry) return;
        entry.uniforms.uShow.value = show;
        entry.group.visible = show > 0.001;
        // The figures appear once their place has risen.
        entry.life.group.visible = show > 0.85;
        if (entry.life.group.visible) entry.life.update(seconds);
        any ||= entry.group.visible;
      });
      group.visible = any;
    },
  };
}
