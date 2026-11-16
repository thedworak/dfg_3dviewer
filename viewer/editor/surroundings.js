import THREE from "../init.js";
import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import {
  SURROUNDINGS_DEFAULTS,
  SURROUNDINGS_KINDS,
  layoutSurroundings,
  normalizeSurroundings,
  surroundingsGroundHeight,
  surroundingsGrowth,
  surroundingsPeriod,
  surroundingsTerrainHeight,
} from "./surroundings-rules.js";
import {
  buildRealisticSurroundings,
  buildSurroundingsShadows,
  buildSurroundingsWater,
  createSurroundingsUniforms,
  createSurroundingsWriter as createWriter,
  surroundingsBlockFoot,
  triangulateGround,
} from "./surroundings-realistic.js";
import { DEFAULT_ELEVATION_URL, createHeightfield, loadElevation, loadMapOverlay } from "./surroundings-terrain.js";
import { readOldMap } from "../ai/old-map-reader.js";
import { attachSurroundingsPanel } from "./surroundings-panel.js";
import { aiAvailability } from "../ai/ai-client.js";
import {
  DEFAULT_HISTORICAL_MAP_URL,
  DEFAULT_MAP_URL,
  createMapWater,
  filterByYear,
  loadHistoricalLayout,
  loadMapLayout,
  mapGeoJsonToAnswer,
  loadWaterSources,
  readMapLayout,
  mapProjector,
  readMapWater,
} from "./surroundings-map.js";

// Generated surroundings: the layout of editor/surroundings-rules.js drawn
// round the model - a settlement, fields, a forest, low hills - to say what
// kind of place the object stood in. Switched on from the Suggested scene
// (editor/scene-suggest.js), a manifest (AIM3DViewer.surroundings) or
// Viewer.setSurroundingsOptions().
//
// It is a hypothesis about the kind of place and must not be mistaken for
// the model:
//   - by default drawn as plain, pale, flat-shaded shapes without textures,
//     the ground fading out and the forest thinning towards the rim; the
//     realistic look (`style: "realistic"`, editor/surroundings-realistic.js)
//     gives them the materials, openings, vegetation and haze of the period,
//     with the same marks below;
//   - a badge over the view says it is generated, while it is on;
//   - not part of the model: no picking, no measuring, not in the model's
//     box (camera framing, ground, sun and weather sizes), nor in exports
//     of the model. One group in the scene, `userData.isSurroundings`.
//
// The layout is in metres; the group is scaled to the model's unit
// (editor/model-units.js) and stands at the model's ground.
//
// The realistic look moves: each frame (updateSurroundings, main.js) the
// wind sways the trees and drifts the smoke, the water ripples, and the
// shadows cast by the sun (or the key light) follow it. `terrain: "real"`
// loads the place's elevation (editor/surroundings-terrain.js) and draws
// the surroundings again on it once it is there.

// How strong a cast shadow is in full sun, and how often (ms) at most it is
// worked out again while the light moves.
const SHADOW_STRENGTH = 0.5;
const SHADOW_INTERVAL = 100;
// How far beyond the model's footprint (metres) the sun's shadow map
// reaches while the realistic surroundings are shown: their houses and
// trees there cast real shadows on each other's walls and on the model, and
// take the model's (viewer.surroundings.shadowReach; 0: projected only).
const SHADOW_REACH = 80;
// While following the timeline: drawn again at most this often (ms).
const TIMELINE_INTERVAL = 700;
// A building's footprint, its half-diagonal in metres: wider is taken as a
// model in another unit, where its unit is not known (getSurroundingsSite).
const SITE_MAX_RADIUS = 150;
const SITE_MIN_RADIUS = 2;

// Colours (sRGB): [summer, winter].
const PALETTE = {
  ground: [0xc9c7b8, 0xe9ebee],
  field: [[0xd3cdb2, 0xc4c6a8, 0xbdb9a2], [0xe2e4e6, 0xdcdfe2, 0xe6e7e9]],
  road: [0xdcd6c8, 0xd4d3d0],
  wall: [0xd8d2c6, 0xd6d2cb],
  masonry: [0xcfc6b8, 0xcbc5bc],
  roof: [0xb3a898, 0xeceef0],
  conifer: [0x9fae9b, 0xb9c4bd],
  broadleaf: [0xb1bda4, 0xb8b4ad],
  trunk: [0xb0a696, 0xa9a297],
};

function colour(entry, winter, tone = null) {
  const value = entry[winter ? 1 : 0];
  return new THREE.Color(tone == null ? value : value[tone]);
}

const v = (x, y, z) => new THREE.Vector3(x, y, z);

// A box with a roof: `w` along its own x (turned by `angle`), `d` along z.
function writeBlock(writer, block, y, wallColor, roofColor) {
  const cos = Math.cos(block.angle);
  const sin = Math.sin(block.angle);
  const at = (lx, ly, lz) => v(block.x + lx * cos - lz * sin, y + ly, block.z + lx * sin + lz * cos);
  const hw = block.w / 2;
  const hd = block.d / 2;
  const h = block.h;
  // Corners, counter-clockwise seen from above: bottom, then top.
  const base = [at(-hw, -0.5, -hd), at(hw, -0.5, -hd), at(hw, -0.5, hd), at(-hw, -0.5, hd)];
  const top = [at(-hw, h, -hd), at(hw, h, -hd), at(hw, h, hd), at(-hw, h, hd)];
  for (let side = 0; side < 4; side += 1) {
    const next = (side + 1) % 4;
    writer.quad(base[next], base[side], top[side], top[next], wallColor);
  }
  // An onion dome drawn plain is a pyramid.
  if (block.roof === "pyramid" || block.roof === "onion") {
    const apex = at(0, h + block.roofHeight, 0);
    for (let side = 0; side < 4; side += 1) writer.tri(top[(side + 1) % 4], top[side], apex, roofColor);
  } else if (block.roof === "gable") {
    const rise = h + block.roofHeight;
    if (block.ridge === "w") {
      const r0 = at(-hw, rise, 0);
      const r1 = at(hw, rise, 0);
      writer.quad(top[1], top[0], r0, r1, roofColor);
      writer.quad(top[3], top[2], r1, r0, roofColor);
      writer.tri(top[0], top[3], r0, wallColor);
      writer.tri(top[2], top[1], r1, wallColor);
    } else {
      const r0 = at(0, rise, -hd);
      const r1 = at(0, rise, hd);
      writer.quad(top[0], top[3], r1, r0, roofColor);
      writer.quad(top[2], top[1], r0, r1, roofColor);
      writer.tri(top[1], top[0], r0, wallColor);
      writer.tri(top[3], top[2], r1, wallColor);
    }
  } else {
    writer.quad(top[0], top[3], top[2], top[1], roofColor);
  }
}

// A trunk under a cone (a conifer) or under a faceted crown (a broadleaf).
function writeTree(writer, tree, y, color, trunkColor, winter) {
  const sides = 6;
  const conifer = tree.kind === "conifer";
  // Bare in winter: a broadleaf's crown is thinner.
  const radius = tree.r * (!conifer && winter ? 0.7 : 1);
  const turn = (Math.abs(tree.x * 12.9898 + tree.z * 78.233) % 1) * Math.PI;
  const ring = (share, height) => Array.from({ length: sides }, (_item, index) => {
    const angle = turn + (index / sides) * Math.PI * 2;
    return v(tree.x + Math.cos(angle) * radius * share, y + tree.h * height, tree.z + Math.sin(angle) * radius * share);
  });
  const band = (lower, upper, tone) => {
    for (let side = 0; side < sides; side += 1) {
      const next = (side + 1) % sides;
      writer.quad(lower[next], lower[side], upper[side], upper[next], tone);
    }
  };
  const cap = (points, tip, tone) => {
    for (let side = 0; side < sides; side += 1) writer.tri(points[(side + 1) % sides], points[side], tip, tone);
  };
  const crownFrom = conifer ? 0.14 : 0.26;
  band(ring(0.1, -0.03), ring(0.1, crownFrom + 0.04), trunkColor);
  const apex = v(tree.x, y + tree.h, tree.z);
  if (conifer) {
    cap(ring(1, crownFrom), apex, color);
    return;
  }
  const lower = ring(0.7, crownFrom);
  const widest = ring(1, 0.52);
  const upper = ring(0.62, 0.84);
  cap(lower, v(tree.x, y + tree.h * (crownFrom - 0.04), tree.z), color);
  band(lower, widest, color);
  band(widest, upper, color);
  cap(upper, apex, color);
}

// The layout as meshes: { meshes, triangles, farthest } - `farthest` how far
// out they reach, in metres.
export function buildSurroundingsMeshes(layout, { uniforms = null, nearRadius = 0 } = {}) {
  const built = layout.params.style === "realistic" ? buildRealisticSurroundings(layout, { uniforms, nearRadius }) : buildSchematicSurroundings(layout);
  built.meshes.forEach((mesh) => {
    mesh.raycast = () => {};
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.userData.isSurroundings = true;
  });
  return built;
}

// Two meshes: the ground (terrain, fields, roads) and what stands on it.
function buildSchematicSurroundings(layout) {
  const winter = layout.params.season === "winter";
  const extent = layout.extent;
  // Opaque in the middle, gone at the rim.
  const fade = (x, z) => 1 - THREE.MathUtils.smoothstep(Math.hypot(x, z), extent * 0.72, extent * 1.08);
  const height = (x, z) => surroundingsTerrainHeight(layout, x, z);

  const ground = createWriter(fade);
  const groundColor = colour(PALETTE.ground, winter);
  const rings = 56;
  const segments = 96;
  const rim = extent * 1.1;
  const point = (ring, segment) => {
    // Rings closer together in the middle, where things stand (a moat's
    // banks).
    const radius = rim * (ring / rings) ** 1.6;
    const angle = (segment / segments) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    return v(x, height(x, z), z);
  };
  for (let ring = 0; ring < rings; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const p = point(ring, segment);
      const q = point(ring + 1, segment);
      const r = point(ring + 1, segment + 1);
      const s = point(ring, segment + 1);
      if (ring === 0) ground.tri(p, r, q, groundColor);
      else ground.quad(p, s, r, q, groundColor);
    }
  }
  // Fields and roads lie on the ground, a little above it.
  layout.fields.forEach((field) => {
    // An old map's field: its own outline.
    if (field.polygon) {
      triangulateGround(field.polygon).forEach((face) => {
        const [a, b, c] = face.map(([x, z]) => v(x, height(x, z) + 0.2, z));
        ground.tri(a, b, c, colour(PALETTE.field, winter, field.tone), { want: new THREE.Vector3(0, 1, 0) });
      });
      return;
    }
    const cos = Math.cos(field.angle);
    const sin = Math.sin(field.angle);
    const corner = (lx, lz) => {
      const x = field.x + lx * cos - lz * sin;
      const z = field.z + lx * sin + lz * cos;
      return v(x, height(x, z) + 0.2, z);
    };
    const hw = field.w / 2;
    const hd = field.d / 2;
    ground.quad(corner(-hw, -hd), corner(-hw, hd), corner(hw, hd), corner(hw, -hd), colour(PALETTE.field, winter, field.tone));
  });
  const roadColor = colour(PALETTE.road, winter);
  // The railway's bed drawn as a road.
  [...layout.roads, ...(layout.railway ? [{ points: layout.railway.points, width: 5.2 }] : [])].forEach((road) => {
    const half = road.width / 2;
    const edges = road.points.map(([x, z], index) => {
      const [px, pz] = road.points[Math.max(index - 1, 0)];
      const [nx, nz] = road.points[Math.min(index + 1, road.points.length - 1)];
      const length = Math.hypot(nx - px, nz - pz) || 1;
      const ox = (-(nz - pz) / length) * half;
      const oz = ((nx - px) / length) * half;
      return [v(x + ox, height(x + ox, z + oz) + 0.4, z + oz), v(x - ox, height(x - ox, z - oz) + 0.4, z - oz)];
    });
    for (let index = 0; index < edges.length - 1; index += 1) {
      ground.quad(edges[index][0], edges[index + 1][0], edges[index + 1][1], edges[index][1], roadColor);
    }
  });

  const built = createWriter(() => 1);
  const wall = colour(PALETTE.wall, winter);
  const masonry = colour(PALETTE.masonry, winter);
  const roof = colour(PALETTE.roof, winter);
  layout.blocks.forEach((block) => {
    writeBlock(built, block, surroundingsBlockFoot(layout, block), block.role === "house" ? wall : masonry, roof);
  });
  // Bridges: a plain deck.
  layout.bridges.forEach((bridge) => {
    writeBlock(built, { x: bridge.x, z: bridge.z, w: bridge.length, d: bridge.width, h: 0.4, angle: bridge.angle, roof: "none" }, surroundingsGroundHeight(layout, bridge.x, bridge.z) + 0.35, wall, wall);
  });
  layout.walls.forEach((segment) => {
    const x = (segment.ax + segment.bx) / 2;
    const z = (segment.az + segment.bz) / 2;
    writeBlock(built, {
      x, z,
      w: Math.hypot(segment.bx - segment.ax, segment.bz - segment.az) + segment.t,
      d: segment.t,
      h: segment.h,
      angle: Math.atan2(segment.bz - segment.az, segment.bx - segment.ax),
      roof: "none",
    }, height(x, z), segment.kind === "masonry" ? masonry : wall, segment.kind === "masonry" ? masonry : wall);
  });
  const conifer = colour(PALETTE.conifer, winter);
  const broadleaf = colour(PALETTE.broadleaf, winter);
  const trunk = colour(PALETTE.trunk, winter);
  layout.trees.forEach((tree) => {
    // Smaller towards the rim, none beyond it.
    const size = fade(tree.x, tree.z);
    if (size < 0.15) return;
    writeTree(built, { ...tree, h: tree.h * size, r: tree.r * size }, height(tree.x, tree.z), tree.kind === "conifer" ? conifer : broadleaf, trunk, winter);
  });

  // The ground fades out towards the rim; what stands on it is opaque and
  // thins out there instead. Front faces only: drawn from both sides, the
  // viewer's logarithmic depth leaves specks of the back faces along every
  // outline.
  const material = (transparent) => new THREE.MeshStandardMaterial({
    vertexColors: true,
    transparent,
    roughness: 1,
    metalness: 0,
  });
  const meshes = [
    new THREE.Mesh(ground.geometry(), material(true)),
    new THREE.Mesh(built.geometry(), material(false)),
  ];
  meshes[0].name = "surroundings-ground";
  meshes[1].name = "surroundings-built";
  // Under the viewer's own ground (shadow, grid), which is drawn over it.
  meshes[0].renderOrder = -3;
  meshes[1].renderOrder = -2;
  const water = buildSurroundingsWater(layout, { fade });
  if (water) meshes.push(water);
  return { meshes, triangles: ground.triangles() + built.triangles(), farthest: extent * 1.1, casters: null };
}

// An old map draped over the ground: a grid out to the rim, a little above
// the ground (over the fields and roads), its corners placed on the map's
// pixels (Web Mercator round the place, north as the sun study's), fading
// out at the rim and where the map ends.
export function buildOverlayMesh(layout, overlay, { north = 0, opacity = 0.85 } = {}) {
  const rim = layout.extent * 1.2;
  const rings = 64;
  const segments = 128;
  const angle = (north * Math.PI) / 180;
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  const positions = [];
  const uvs = [];
  const colors = [];
  for (let ring = 0; ring <= rings; ring += 1) {
    const radius = rim * (ring / rings) ** 1.6;
    for (let segment = 0; segment <= segments; segment += 1) {
      const turn = (segment / segments) * Math.PI * 2;
      const x = Math.cos(turn) * radius;
      const z = Math.sin(turn) * radius;
      const easting = x * cos + z * sin;
      const northing = x * sin - z * cos;
      const u = (overlay.origin.x + easting / overlay.metresPerPixel) / overlay.width;
      const w = (overlay.origin.y - northing / overlay.metresPerPixel) / overlay.height;
      const inside = u > 0.002 && u < 0.998 && w > 0.002 && w < 0.998;
      positions.push(x, surroundingsTerrainHeight(layout, x, z) + 0.6, z);
      uvs.push(u, w);
      colors.push(1, 1, 1, inside ? 1 - THREE.MathUtils.smoothstep(radius, rim * 0.75, rim * 0.98) : 0);
    }
  }
  const indices = [];
  for (let ring = 0; ring < rings; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const a = ring * (segments + 1) + segment;
      const b = a + segments + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 4));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  // Faces up whichever way the grid winds.
  if (geometry.getAttribute("normal").getY(segments + 2) < 0) {
    geometry.setIndex(indices.map((_value, index) => indices[index - (index % 3) + [0, 2, 1][index % 3]]));
    geometry.computeVertexNormals();
  }
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    map: overlay.texture,
    vertexColors: true,
    transparent: true,
    opacity,
    depthWrite: false,
    roughness: 1,
    metalness: 0,
  }));
  mesh.name = "surroundings-oldmap";
  mesh.renderOrder = -2.4;
  mesh.raycast = () => {};
  mesh.frustumCulled = false;
  mesh.userData.isSurroundings = true;
  return mesh;
}

export function attachSurroundings(Viewer) {
  // Their window (Look > Generated surroundings).
  attachSurroundingsPanel(Viewer);
  Object.assign(Viewer, {
    // The parameters (surroundings-rules.js) and whether they are drawn.
    surroundings: { enabled: false, ...SURROUNDINGS_DEFAULTS },
    surroundingsObjects: null,
    surroundingsBadge: null,
    // The shaders' uniforms (time, wind, smoke), kept across rebuilds.
    surroundingsUniforms: null,
    // The real terrain: "none" | "loading" | "real" | "failed", for which
    // place (key), and its elevation once loaded.
    surroundingsTerrain: { state: "none", key: "", elevation: null },
    // The real water from the map, likewise: its features and, for a north,
    // the distance it gives (surroundings-map.js).
    surroundingsMap: { state: "none", key: "", loaded: null, water: null, waterKey: "", source: null },
    // Following the timeline: the year last seen, whether it is outside the
    // years covered, a change waiting to be drawn, when it was last drawn.
    surroundingsTimeline: { year: null, outside: false, pending: null, drawn: 0 },
    // An old map: its layout file (roads, fields, buildings, walls) and its
    // tiles draped over the ground, each once loaded.
    // The AI's reading of the draped map: aiState "none" | "sending" |
    // "reading" | "done" | "failed"; aiOffered once the worker says so.
    surroundingsOldMap: {
      layoutState: "none", layoutKey: "", layoutAnswer: null, layoutSource: null,
      overlayState: "none", overlayKey: "", overlay: null, texture: null,
      ohmKey: "", ohmAnswer: null,
      aiState: "none", aiAnswer: null, aiGeojson: null, aiError: "", aiOffered: false,
    },

    getSurroundingsModelRoots() {
      const slots = Array.isArray(core.mainObject) ? core.mainObject : [core.mainObject];
      return slots.flat().filter((item) => item?.isObject3D && !item.userData?.isSurroundings);
    },

    // Where the surroundings go: the model's middle on its ground, its
    // footprint's radius in metres, metres per unit of the scene.
    getSurroundingsSite() {
      const box = new THREE.Box3();
      Viewer.getSurroundingsModelRoots().forEach((root) => {
        try {
          box.expandByObject(root);
        } catch (_error) {
          // Streamed or splat objects without a plain geometry.
        }
      });
      if (box.isEmpty()) return null;
      const unit = Viewer.resolveModelUnit?.() || { meters: 1, source: "default" };
      let meters = unit.meters || 1;
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const ground = core.basicGrid?.isObject3D ? core.basicGrid.getWorldPosition(new THREE.Vector3()).y : box.min.y;
      const footprint = Math.hypot(size.x, size.z) / 2;
      // No unit known (glTF says metres, but models made in centimetres or
      // millimetres are often exported as they are): a footprint wider than
      // any building in metres is taken in the unit that makes it one.
      let unitGuessed = false;
      if ((unit.source === "default" || unit.source === "config") && footprint * meters > SITE_MAX_RADIUS) {
        const guess = [0.01, 0.001].find((candidate) => footprint * candidate <= SITE_MAX_RADIUS && footprint * candidate >= SITE_MIN_RADIUS);
        if (guess) {
          meters = guess;
          unitGuessed = true;
        }
      }
      return {
        center: new THREE.Vector3(center.x, ground, center.z),
        radius: footprint * meters,
        meters,
        unitGuessed,
      };
    },

    setSurroundings(enabled) {
      const on = enabled === true;
      if (on === Viewer.surroundings.enabled && (!on || Viewer.surroundingsObjects)) return on;
      Viewer.surroundings.enabled = on;
      if (on) Viewer.rebuildSurroundings();
      else Viewer.removeSurroundingsObjects();
      Viewer.syncSurroundingsBadge();
      Viewer.updateEditorToolbarState?.();
      return Viewer.surroundings.enabled;
    },

    // { kind, period, year, season, seed, density, style }, and `enabled`; switched
    // on unless `enabled` is false.
    setSurroundingsOptions(options = {}) {
      const { enabled, ...rest } = options && typeof options === "object" ? options : {};
      const current = Viewer.surroundings;
      Viewer.fillSurroundingsPlace(rest);
      // A year without a period: the year's period.
      if (Number.isFinite(rest.year) && rest.period == null && surroundingsPeriod(rest.year)) rest.period = surroundingsPeriod(rest.year);
      Object.assign(current, normalizeSurroundings({ ...current, ...rest }));
      if (enabled === false) return Viewer.setSurroundings(false);
      current.enabled = true;
      Viewer.rebuildSurroundings();
      Viewer.syncSurroundingsBadge();
      Viewer.updateEditorToolbarState?.();
      return current.enabled;
    },

    // The real terrain asked for without a place: the place the manifest
    // sets (the sun study's), if any.
    fillSurroundingsPlace(options) {
      if (options.terrain !== "real" || (Number.isFinite(options.latitude) && Number.isFinite(options.longitude))) return;
      const sun = Viewer.sunStudy;
      if (sun?.locationSet && Number.isFinite(sun.latitude) && Number.isFinite(sun.longitude)) {
        options.latitude = sun.latitude;
        options.longitude = sun.longitude;
      }
    },

    // Another layout of the same kind: a new seed.
    reshuffleSurroundings() {
      return Viewer.setSurroundingsOptions({ seed: (Viewer.surroundings.seed * 1664525 + 1013904223) >>> 0 });
    },

    rebuildSurroundings() {
      Viewer.removeSurroundingsObjects();
      const site = core.scene ? Viewer.getSurroundingsSite() : null;
      if (!site) {
        Viewer.surroundings.enabled = false;
        return false;
      }
      // The real water (on the real terrain) changes the layout: laid out
      // once more with it once it is there.
      const base = layoutSurroundings(Viewer.surroundings, { radius: site.radius });
      const mapWater = Viewer.getSurroundingsMapWater(base);
      const mapLayout = Viewer.getSurroundingsMapLayout(base);
      const layout = mapWater || mapLayout ? layoutSurroundings(Viewer.surroundings, { radius: site.radius, mapWater, mapLayout }) : base;
      Viewer.applySurroundingsTerrain(layout);
      const realistic = Viewer.surroundings.style === "realistic";
      // The shaders are WebGL's: without them under WebGPU.
      const shaders = realistic && core.rendererBackend !== "webgpu";
      if (shaders) Viewer.surroundingsUniforms ??= createSurroundingsUniforms();
      // What stands within the sun's shadow map's reach: a mesh of its own.
      const nearRadius = realistic && core.rendererBackend !== "webgpu" ? Math.max(0, site.radius + Viewer.getSurroundingsShadowReachMetres() - 25) : 0;
      const { meshes, triangles, farthest, casters } = buildSurroundingsMeshes(layout, { uniforms: shaders ? Viewer.surroundingsUniforms : null, nearRadius });
      const group = new THREE.Group();
      group.name = "surroundings";
      group.userData.isSurroundings = true;
      group.add(...meshes);
      // A hair below the model's ground, in metres.
      group.position.copy(site.center);
      group.position.y -= 0.03 / site.meters;
      group.scale.setScalar(1 / site.meters);
      core.scene.add(group);
      // The camera sees out to the horizon from as far as it may go; put
      // back when they go (unless a new model has set its own meanwhile).
      const camera = core.camera;
      let far = null;
      if (camera) {
        const needed = farthest / site.meters + (core.controls?.maxDistance || 0);
        if (Number.isFinite(needed) && needed > camera.far) {
          far = { before: camera.far, set: needed };
          camera.far = needed;
          camera.updateProjectionMatrix();
        }
      }
      // Cast shadows: worked out from the light in updateSurroundings().
      let shadows = null;
      if (casters?.length) {
        const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({
          vertexColors: true,
          transparent: true,
          depthWrite: true,
          depthFunc: THREE.LessDepth,
          side: THREE.DoubleSide,
          toneMapped: false,
        }));
        mesh.name = "surroundings-shadows";
        mesh.renderOrder = -1.9;
        mesh.raycast = () => {};
        mesh.frustumCulled = false;
        mesh.userData.isSurroundings = true;
        group.add(mesh);
        shadows = { mesh, casters, key: "", time: -Infinity };
      }
      // A year of the timeline the surroundings do not cover: hidden.
      if (Viewer.surroundings.followTimeline && Viewer.surroundingsTimeline.outside) group.visible = false;
      // The old map draped over the ground, once its tiles are there.
      const overlay = Viewer.getSurroundingsOverlay(layout);
      if (overlay) group.add(buildOverlayMesh(layout, overlay, { north: Viewer.sunStudy?.north || 0, opacity: Viewer.surroundings.mapOverlay.opacity }));
      Viewer.surroundingsObjects = { group, layout, triangles, site, far, shadows };
      Viewer.updateSurroundings(0, { force: true });
      return true;
    },

    // The source of elevation tiles: viewer.surroundings.elevationUrl of the
    // settings (null or "" switches the real terrain off), else the open
    // Terrain Tiles.
    getSurroundingsElevationUrl() {
      const configured = core.CONFIG?.viewer?.surroundings?.elevationUrl;
      if (configured === null || configured === "" || configured === false) return null;
      return typeof configured === "string" ? configured : DEFAULT_ELEVATION_URL;
    },

    // The real terrain under a layout, where it is asked for: its heights
    // if loaded; else loaded now, and the surroundings drawn again when
    // they are there (still the same place). Meanwhile the generated hills.
    applySurroundingsTerrain(layout) {
      const state = Viewer.surroundings;
      const terrain = Viewer.surroundingsTerrain;
      const url = Viewer.getSurroundingsElevationUrl();
      if (state.terrain !== "real" || !url) {
        Object.assign(terrain, { state: state.terrain === "real" ? "failed" : "none", key: "", elevation: null });
        return false;
      }
      const radius = layout.extent * 1.8;
      const key = [state.latitude, state.longitude, Math.round(radius), url].join("|");
      if (terrain.key === key && terrain.elevation) {
        layout.heightfield = createHeightfield(terrain.elevation, { north: Viewer.sunStudy?.north || 0, flat: layout.clear * 0.9, blend: layout.clear * 2 });
        return true;
      }
      if (terrain.key === key && (terrain.state === "loading" || terrain.state === "failed")) return false;
      Object.assign(terrain, { state: "loading", key, elevation: null });
      loadElevation({ latitude: state.latitude, longitude: state.longitude, radius, url })
        .then((elevation) => {
          if (terrain.key !== key) return;
          Object.assign(terrain, { state: "real", elevation });
          if (Viewer.surroundings.enabled) Viewer.rebuildSurroundings();
          Viewer.syncSurroundingsBadge();
        })
        .catch((error) => {
          if (terrain.key !== key) return;
          console.warn("The terrain's elevation could not be loaded; the surroundings keep generated hills", error);
          terrain.state = "failed";
          Viewer.syncSurroundingsBadge();
        });
      return false;
    },

    // The servers of today's water, tried in turn: viewer.surroundings.
    // mapUrl of the settings - one URL or a list (your own Overpass first,
    // docs/docker.md) - null or "" for none; else the public Overpass API.
    getSurroundingsMapUrls() {
      const configured = core.CONFIG?.viewer?.surroundings?.mapUrl;
      if (configured === null || configured === "" || configured === false) return [];
      if (Array.isArray(configured)) return configured.filter((url) => typeof url === "string" && url);
      return [typeof configured === "string" ? configured : DEFAULT_MAP_URL];
    },

    // OpenHistoricalMap's Overpass API: viewer.surroundings.historicalMapUrl
    // (null or "" switches it off).
    getSurroundingsHistoricalMapUrl() {
      const configured = core.CONFIG?.viewer?.surroundings?.historicalMapUrl;
      if (configured === null || configured === "" || configured === false) return null;
      return typeof configured === "string" ? configured : DEFAULT_HISTORICAL_MAP_URL;
    },

    // The real water round the place for a layout (createMapWater), where
    // the real terrain is asked for: from the manifest's file, else
    // OpenHistoricalMap (if it has water in the year), else today's map
    // (surroundings-map.js, loadWaterSources). The source is chosen when it
    // is loaded; a dated source is then filtered by each year shown. Loaded
    // in the background, the surroundings drawn again when it is there; null
    // meanwhile.
    getSurroundingsMapWater(layout) {
      const state = Viewer.surroundings;
      const map = Viewer.surroundingsMap;
      const mapUrls = Viewer.getSurroundingsMapUrls();
      const historicalUrl = Viewer.getSurroundingsHistoricalMapUrl();
      const fileUrl = state.waterUrl || null;
      // The old map's water read by AI, first (any terrain).
      const read = Viewer.surroundingsOldMap.aiAnswer;
      if (state.water && read && state.mapOverlay && state.latitude != null && !fileUrl) {
        const water = createMapWater(readMapWater(filterByYear(read, state.year), mapProjector(state.latitude, state.longitude, Viewer.sunStudy?.north || 0), { modern: true }), layout.extent * 1.25);
        if (water.count) {
          Object.assign(map, { state: "real", source: "ai", water });
          return water;
        }
      }
      if (state.terrain !== "real" || !state.water || (!mapUrls.length && !historicalUrl && !fileUrl)) {
        Object.assign(map, { state: "none", key: "", loaded: null, water: null, waterKey: "", source: null });
        return null;
      }
      const radius = layout.extent * 1.25;
      const key = [state.latitude, state.longitude, Math.round(radius), fileUrl, historicalUrl, mapUrls.join(",")].join("|");
      if (map.key === key && map.loaded) {
        const north = Viewer.sunStudy?.north || 0;
        const answer = map.loaded.dated ? filterByYear(map.loaded.answer, state.year) : map.loaded.answer;
        const waterKey = `${key}|${north}|${Viewer.surroundingsWaterSignature(answer)}`;
        if (map.waterKey !== waterKey) {
          map.water = createMapWater(readMapWater(answer, mapProjector(state.latitude, state.longitude, north), { modern: map.loaded.dated }), radius);
          map.waterKey = waterKey;
        }
        return map.water.count ? map.water : null;
      }
      if (map.key === key) return null;
      Object.assign(map, { state: "loading", key, loaded: null, water: null, waterKey: "", source: null });
      loadWaterSources({ latitude: state.latitude, longitude: state.longitude, radius, year: state.year, fileUrl, historicalUrl, mapUrls })
        .then((loaded) => {
          if (map.key !== key) return;
          Object.assign(map, { state: "real", loaded, source: loaded.source });
          if (Viewer.surroundings.enabled) Viewer.rebuildSurroundings();
          Viewer.syncSurroundingsBadge();
        })
        .catch((error) => {
          if (map.key !== key) return;
          console.warn("The water could not be loaded; the surroundings have none of it", error);
          map.state = "failed";
          Viewer.syncSurroundingsBadge();
        });
      return null;
    },

    // What of the dated sources (the water, the old map's layout) a year
    // shows.
    surroundingsDatedSignature(year) {
      const water = Viewer.surroundingsMap.loaded?.dated ? Viewer.surroundingsWaterSignature(filterByYear(Viewer.surroundingsMap.loaded.answer, year)) : "";
      const answer = Viewer.surroundingsOldMap.layoutAnswer;
      return `${water}|${answer ? Viewer.surroundingsWaterSignature(filterByYear(answer, year)) : ""}`;
    },

    // An old map's layout for the year (readMapLayout), where the
    // surroundings have a layout file and a place: once loaded (then drawn
    // again); null meanwhile, or without one.
    getSurroundingsMapLayout(base) {
      const state = Viewer.surroundings;
      const old = Viewer.surroundingsOldMap;
      old.layoutSource = null;
      if (state.latitude == null || state.longitude == null) return null;
      const project = () => mapProjector(state.latitude, state.longitude, Viewer.sunStudy?.north || 0);
      const usable = (answer) => {
        const layout = readMapLayout(filterByYear(answer, state.year), project());
        return layout.roads.length || layout.fields.length || layout.buildings.length || layout.walls.length ? layout : null;
      };
      // 1. The manifest's file.
      if (state.layoutUrl) {
        const key = state.layoutUrl;
        if (old.layoutKey === key && old.layoutAnswer) {
          old.layoutSource = "file";
          return usable(old.layoutAnswer);
        }
        if (old.layoutKey !== key) {
          Object.assign(old, { layoutState: "loading", layoutKey: key, layoutAnswer: null });
          loadMapLayout(key)
            .then((answer) => {
              if (old.layoutKey !== key) return;
              Object.assign(old, { layoutState: "real", layoutAnswer: answer });
              if (Viewer.surroundings.enabled) Viewer.rebuildSurroundings();
              Viewer.syncSurroundingsBadge();
            })
            .catch((error) => {
              if (old.layoutKey !== key) return;
              console.warn("The old map's layout could not be read; the surroundings stay generated", error);
              old.layoutState = "failed";
              Viewer.syncSurroundingsBadge();
            });
        }
        if (old.layoutState === "loading") return null;
      } else {
        Object.assign(old, { layoutState: "none", layoutKey: "", layoutAnswer: null });
      }
      // 2. The old map draped over the ground, read by AI (while it is
      // draped).
      if (old.aiAnswer && state.mapOverlay) {
        const layout = usable(old.aiAnswer);
        if (layout) {
          old.layoutSource = "ai";
          return layout;
        }
      }
      // 3. OpenHistoricalMap's roads and buildings of the year, on the real
      // terrain.
      const url = Viewer.getSurroundingsHistoricalMapUrl();
      if (state.terrain !== "real" || !url || !base) return null;
      const radius = base.extent * 1.1;
      const key = [state.latitude, state.longitude, Math.round(radius), url].join("|");
      if (old.ohmKey === key && old.ohmAnswer) {
        const layout = usable(old.ohmAnswer);
        if (layout) old.layoutSource = "historical";
        return layout;
      }
      if (old.ohmKey === key) return null;
      Object.assign(old, { ohmKey: key, ohmAnswer: null });
      loadHistoricalLayout({ latitude: state.latitude, longitude: state.longitude, radius, url })
        .then((answer) => {
          if (old.ohmKey !== key) return;
          old.ohmAnswer = answer;
          // Drawn again only if the year has any of it.
          if (Viewer.surroundings.enabled && usable(answer)) Viewer.rebuildSurroundings();
          Viewer.syncSurroundingsBadge();
        })
        .catch((error) => console.warn("OpenHistoricalMap's roads and buildings could not be loaded", error));
      return null;
    },

    // The old map draped over the ground read by the worker's AI
    // (viewer/ai/old-map-reader.js): its roads, buildings, fields, water
    // and walls then shape the surroundings, marked as read by AI, and can
    // be saved as GeoJSON to be checked and corrected.
    async readSurroundingsOldMap() {
      const old = Viewer.surroundingsOldMap;
      if (!old.overlay || old.aiState === "sending" || old.aiState === "reading") return null;
      const key = old.overlayKey;
      const progress = (stateName) => {
        if (old.overlayKey !== key) return;
        old.aiState = stateName;
        Viewer.syncSurroundingsBadge();
      };
      Object.assign(old, { aiError: "" });
      try {
        const geojson = await readOldMap(old.overlay, { year: Viewer.surroundings.year, onProgress: progress });
        if (old.overlayKey !== key) return null;
        Object.assign(old, { aiState: "done", aiGeojson: geojson, aiAnswer: mapGeoJsonToAnswer(geojson) });
        Viewer.rebuildSurroundings();
        Viewer.syncSurroundingsBadge();
        return geojson;
      } catch (error) {
        if (old.overlayKey !== key) return null;
        Object.assign(old, { aiState: "failed", aiError: error?.message || "" });
        Viewer.syncSurroundingsBadge();
        return null;
      }
    },

    // The AI's reading as a GeoJSON file to save.
    downloadSurroundingsOldMap() {
      const geojson = Viewer.surroundingsOldMap.aiGeojson;
      if (!geojson) return false;
      const url = URL.createObjectURL(new Blob([JSON.stringify(geojson, null, 1)], { type: "application/geo+json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "old-map-read-by-ai.geojson";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    },

    // An old map's tiles round the place (loadMapOverlay), with a texture:
    // once loaded (then drawn again); null meanwhile, or without one.
    getSurroundingsOverlay(layout) {
      const state = Viewer.surroundings;
      const old = Viewer.surroundingsOldMap;
      const overlay = state.mapOverlay;
      if (!overlay || state.latitude == null || state.longitude == null) {
        old.texture?.dispose();
        // The AI's reading went with its map.
        Object.assign(old, { overlayState: "none", overlayKey: "", overlay: null, texture: null, aiState: "none", aiAnswer: null, aiGeojson: null, aiError: "" });
        return null;
      }
      const radius = layout.extent * 1.2;
      const key = [state.latitude, state.longitude, Math.round(radius), overlay.url].join("|");
      if (old.overlayKey === key && old.overlay) return old.overlay;
      if (old.overlayKey === key) return null;
      old.texture?.dispose();
      Object.assign(old, { overlayState: "loading", overlayKey: key, overlay: null, texture: null, aiState: "none", aiAnswer: null, aiGeojson: null, aiError: "" });
      aiAvailability("old-map").then((offered) => {
        if (old.overlayKey !== key) return;
        old.aiOffered = offered === "on";
        Viewer.syncSurroundingsBadge();
      }).catch(() => {});
      loadMapOverlay({ latitude: state.latitude, longitude: state.longitude, radius, url: overlay.url })
        .then((tiles) => {
          if (old.overlayKey !== key) return;
          const texture = new THREE.CanvasTexture(tiles.canvas);
          texture.flipY = false;
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = 4;
          Object.assign(old, { overlayState: "real", overlay: { ...tiles, texture }, texture });
          if (Viewer.surroundings.enabled) Viewer.rebuildSurroundings();
          Viewer.syncSurroundingsBadge();
        })
        .catch((error) => {
          if (old.overlayKey !== key) return;
          console.warn("The old map's tiles could not be loaded", error);
          old.overlayState = "failed";
          Viewer.syncSurroundingsBadge();
        });
      return null;
    },

    // Which elements of the water are shown: when the year changes it, the
    // surroundings are laid out again.
    surroundingsWaterSignature(answer) {
      return (answer?.elements || []).map((element, index) => element.id ?? index).join(",");
    },

    // Following the 4D timeline's year: its period and how far the
    // settlement has grown; hidden in years the surroundings do not cover.
    // Drawn again at most every TIMELINE_INTERVAL ms.
    followSurroundingsTimeline(now) {
      const state = Viewer.surroundings;
      const follow = Viewer.surroundingsTimeline;
      const objects = Viewer.surroundingsObjects;
      if (!state.followTimeline || !Viewer.hasTimeline?.()) {
        if (follow.outside && objects) objects.group.visible = true;
        follow.outside = false;
        return;
      }
      const year = Math.round(Viewer.getTimelineYear?.());
      if (Number.isFinite(year) && year !== follow.year) {
        follow.year = year;
        const period = surroundingsPeriod(year);
        follow.outside = !period;
        if (objects) objects.group.visible = Boolean(period);
        if (period) {
          const before = Viewer.surroundingsDatedSignature(state.year);
          state.year = year;
          const growth = surroundingsGrowth(year);
          // The dated water or old map of the new year differs: laid out
          // again too.
          const waterChanged = before !== Viewer.surroundingsDatedSignature(year);
          follow.pending = period !== state.period || growth !== state.growth || waterChanged ? { period, growth } : null;
        }
        Viewer.syncSurroundingsBadge();
      }
      if (follow.pending && now - follow.drawn >= TIMELINE_INTERVAL) {
        Object.assign(state, follow.pending);
        follow.pending = null;
        follow.drawn = now;
        Viewer.rebuildSurroundings();
        Viewer.syncSurroundingsBadge();
      }
    },

    // How far round the model the sun's shadow map must reach (scene units),
    // read by editor/sun-study.js: 0 unless the realistic surroundings are
    // shown under the sun.
    getSunShadowReach() {
      const objects = Viewer.surroundingsObjects;
      if (!objects || Viewer.surroundings.style !== "realistic" || Viewer.sunStudy?.enabled !== true || core.rendererBackend === "webgpu") return 0;
      const metres = Viewer.getSurroundingsShadowReachMetres();
      return metres > 0 ? (objects.site.radius + metres) / objects.site.meters : 0;
    },

    // viewer.surroundings.shadowReach (metres beyond the model's footprint).
    getSurroundingsShadowReachMetres() {
      const configured = Number(core.CONFIG?.viewer?.surroundings?.shadowReach);
      return Number.isFinite(configured) && configured >= 0 ? configured : SHADOW_REACH;
    },

    // Where the light that casts the shadows comes from: the sun of the sun
    // study while it is on, else the key light. { direction (travelling),
    // strength } or null.
    getSurroundingsLight() {
      const sunLight = Viewer.sunStudy?.enabled ? Viewer.sunObjects?.light : null;
      const light = sunLight || core.dirLight;
      if (!light?.isDirectionalLight || light.visible === false || !(light.intensity > 0)) return null;
      const from = light.getWorldPosition(new THREE.Vector3());
      const to = light.target ? light.target.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3();
      const direction = to.sub(from);
      if (direction.lengthSq() === 0) return null;
      direction.normalize();
      // Weaker as the sun sinks; faint under clouds, fog or rain.
      let strength = SHADOW_STRENGTH * THREE.MathUtils.smoothstep(Math.asin(Math.max(-1, Math.min(1, -direction.y))), 0.03, 0.2);
      const weather = Viewer.weather;
      if (weather?.enabled && weather.type && weather.type !== "clear") strength *= 1 - 0.8 * Math.min(1, (weather.intensity ?? 0.6) + 0.3);
      return { direction, strength };
    },

    // Every frame (main.js animate): the time and the wind of the shaders,
    // the size of the smoke, the shadows as the light moves.
    updateSurroundings(delta = 0, { force = false } = {}) {
      if (!Viewer.surroundingsObjects) return;
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      Viewer.followSurroundingsTimeline(now);
      const objects = Viewer.surroundingsObjects;
      if (!objects) return;
      const uniforms = Viewer.surroundingsUniforms;
      if (uniforms) {
        uniforms.surroundingsTime.value = (uniforms.surroundingsTime.value + delta) % 3600;
        const weather = Viewer.weather;
        const on = weather?.enabled === true;
        const wind = on ? 0.15 + (weather.wind ?? 0.2) : 0.3;
        const angle = (((on ? weather.windDirection : 230) ?? 230) * Math.PI) / 180;
        uniforms.surroundingsWind.value = wind;
        uniforms.surroundingsWindDir.value.set(Math.sin(angle), -Math.cos(angle));
        uniforms.smokeWind.value.set(Math.sin(angle), -Math.cos(angle)).multiplyScalar(0.4 + wind * 4);
        uniforms.surroundingsRipple.value = 0.06 + wind * 0.12;
        const camera = core.camera;
        if (camera?.isPerspectiveCamera && core.renderer) {
          const height = core.renderer.getDrawingBufferSize?.(new THREE.Vector2()).y || 800;
          uniforms.smokeScale.value = height / (2 * Math.tan((camera.fov * Math.PI) / 360));
        }
        uniforms.smokeUnit.value = objects.group.scale.x;
      }
      // Under the sun, near the model: real shadows (the sun's shadow map).
      const reach = Viewer.getSunShadowReach();
      const mapped = reach > 0;
      objects.group.children.forEach((mesh) => {
        if (mesh.name !== "surroundings-near" && mesh.name !== "surroundings-ground") return;
        mesh.castShadow = mapped && mesh.name === "surroundings-near";
        mesh.receiveShadow = mapped;
      });
      const shadows = objects.shadows;
      if (!shadows) return;
      if (!force && now - shadows.time < SHADOW_INTERVAL) return;
      const light = Viewer.getSurroundingsLight();
      // The casters the shadow map covers, not projected again (25 m short
      // of its edge, where a long shadow would be cut off).
      const skipWithin = mapped ? Math.max(0, objects.site.radius + Viewer.getSurroundingsShadowReachMetres() - 25) : 0;
      const key = light ? `${light.direction.toArray().map((value) => value.toFixed(3)).join(",")}|${light.strength.toFixed(2)}|${skipWithin.toFixed(0)}` : "none";
      if (key === shadows.key) return;
      shadows.key = key;
      shadows.time = now;
      buildSurroundingsShadows(shadows.casters, light?.direction || new THREE.Vector3(0, 1, 0), light?.strength || 0, shadows.mesh.geometry, { skipWithin });
    },

    removeSurroundingsObjects() {
      const objects = Viewer.surroundingsObjects;
      Viewer.surroundingsObjects = null;
      if (!objects) return;
      objects.group.removeFromParent();
      const camera = core.camera;
      if (objects.far && camera && camera.far === objects.far.set) {
        camera.far = objects.far.before;
        camera.updateProjectionMatrix();
      }
      objects.group.traverse((object) => {
        object.geometry?.dispose();
        object.material?.dispose();
      });
    },

    // The badge over the view while generated surroundings are shown: what
    // they are, another layout, off.
    syncSurroundingsBadge() {
      const state = Viewer.surroundings;
      Viewer.syncSurroundingsPanel?.();
      const show = state.enabled && Boolean(Viewer.surroundingsObjects) && Boolean(core.container) && Viewer.urlOptions?.hideUi !== true;
      if (!show) {
        Viewer.surroundingsBadge?.root.remove();
        Viewer.surroundingsBadge = null;
        return;
      }
      if (!Viewer.surroundingsBadge) {
        const root = document.createElement("div");
        root.className = "viewer-surroundings-badge";
        root.id = "viewerSurroundingsBadge";
        root.setAttribute("role", "note");
        const text = document.createElement("span");
        text.className = "viewer-surroundings-badge_text";
        const reshuffle = document.createElement("button");
        reshuffle.type = "button";
        reshuffle.className = "viewer-surroundings-badge_button";
        reshuffle.dataset.action = "reshuffle";
        reshuffle.textContent = "↻";
        reshuffle.addEventListener("click", () => Viewer.reshuffleSurroundings());
        const style = document.createElement("button");
        style.type = "button";
        style.className = "viewer-surroundings-badge_button";
        style.dataset.action = "style";
        // A circle half filled: the look, plain or realistic.
        style.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 2a6 6 0 0 1 0 12z" fill="currentColor"/></svg>';
        style.addEventListener("click", () => Viewer.setSurroundingsOptions({ style: Viewer.surroundings.style === "realistic" ? "schematic" : "realistic" }));
        const off = document.createElement("button");
        off.type = "button";
        off.className = "viewer-surroundings-badge_button";
        off.dataset.action = "off";
        off.textContent = "×";
        off.addEventListener("click", () => Viewer.setSurroundings(false));
        // Reading the draped old map (AI), and saving what was read.
        const read = document.createElement("button");
        read.type = "button";
        read.className = "viewer-surroundings-badge_button";
        read.dataset.action = "read-map";
        read.textContent = "✎";
        read.addEventListener("click", () => Viewer.readSurroundingsOldMap());
        const save = document.createElement("button");
        save.type = "button";
        save.className = "viewer-surroundings-badge_button";
        save.dataset.action = "save-map";
        save.textContent = "⤓";
        save.addEventListener("click", () => Viewer.downloadSurroundingsOldMap());
        root.append(text, read, save, style, reshuffle, off);
        ["pointerdown", "pointerup", "wheel"].forEach((type) => root.addEventListener(type, (event) => event.stopPropagation()));
        core.container.append(root);
        Viewer.surroundingsBadge = { root, text, read, save, style, reshuffle, off };
      }
      const badge = Viewer.surroundingsBadge;
      badge.text.textContent = t("surroundings.badge", { what: Viewer.describeSurroundings() }, "Generated surroundings: {what}. A typical setting, not this place's.");
      const old = Viewer.surroundingsOldMap;
      const busy = old.aiState === "sending" || old.aiState === "reading";
      badge.read.hidden = !(old.overlay && old.aiOffered);
      badge.read.disabled = busy;
      badge.read.title = t("surroundings.oldMap.read", "Read the old map's roads and buildings (AI)");
      badge.read.setAttribute("aria-label", badge.read.title);
      badge.save.hidden = !old.aiGeojson;
      badge.save.title = t("surroundings.oldMap.save", "Save what was read (GeoJSON), to check and correct it");
      badge.save.setAttribute("aria-label", badge.save.title);
      const realistic = state.style === "realistic";
      badge.root.dataset.style = state.style;
      badge.style.title = realistic ? t("surroundings.toSchematic", "Schematic look") : t("surroundings.toRealistic", "Realistic look");
      badge.style.setAttribute("aria-label", badge.style.title);
      badge.style.setAttribute("aria-pressed", realistic ? "true" : "false");
      badge.reshuffle.title = t("surroundings.reshuffle", "Another layout");
      badge.reshuffle.setAttribute("aria-label", badge.reshuffle.title);
      badge.off.title = t("surroundings.off", "Remove the generated surroundings");
      badge.off.setAttribute("aria-label", badge.off.title);
    },

    // "a castle's settlement, 14th century (about 1350)".
    describeSurroundings(value = Viewer.surroundings) {
      const kind = t(`surroundings.kind.${value.kind}`, value.kind);
      const period = t(`surroundings.period.${value.period}`, value.period);
      const parts = [kind, period];
      if (value === Viewer.surroundings) {
        const follow = Viewer.surroundingsTimeline;
        if (value.followTimeline && Viewer.hasTimeline?.() && Number.isFinite(follow.year)) {
          if (follow.outside) return t("surroundings.timeline.outside", { year: follow.year }, "none for {year} (they cover 900-1945)");
          parts.push(t("surroundings.timeline.year", { year: follow.year }, "{year}, following the timeline"));
        }
        if (value.terrain === "real") {
          const terrain = Viewer.surroundingsTerrain.state;
          if (terrain === "real") parts.push(t("surroundings.terrain.real", "on the place's real terrain"));
          else if (terrain === "loading") parts.push(t("surroundings.terrain.loading", "loading the terrain…"));
          else parts.push(t("surroundings.terrain.failed", "generated hills (the terrain could not be loaded)"));
          const map = Viewer.surroundingsMap.state;
          const source = Viewer.surroundingsMap.source;
          if (map === "real" && source === "ai") parts.push(t("surroundings.terrain.mapAi", "the water read from the old map by AI"));
          else if (map === "real" && source === "file") parts.push(t("surroundings.terrain.mapFile", { year: value.year }, "the water of {year} from the model's own map"));
          else if (map === "real" && source === "historical") parts.push(t("surroundings.terrain.mapHistorical", { year: value.year }, "the water of {year} (© OpenHistoricalMap contributors)"));
          else if (map === "real" && Viewer.surroundingsMap.water?.count) parts.push(t("surroundings.terrain.map", "today's rivers and lakes (© OpenStreetMap contributors)"));
          else if (map === "loading") parts.push(t("surroundings.terrain.mapLoading", "loading the water…"));
        }
        const site = Viewer.surroundingsObjects?.site;
        if (site?.unitGuessed) parts.push(t("surroundings.unitGuessed", { unit: site.meters === 0.01 ? "cm" : "mm" }, "the model taken as in {unit} (its unit is not known)"));
        const old = Viewer.surroundingsOldMap;
        if (old.layoutSource === "file") parts.push(t("surroundings.oldMap.layout", { year: value.year }, "roads and buildings of {year} from the old map"));
        else if (old.layoutSource === "ai") parts.push(t("surroundings.oldMap.layoutAi", "roads and buildings read from the old map by AI - check them"));
        else if (old.layoutSource === "historical") parts.push(t("surroundings.oldMap.layoutHistorical", { year: value.year }, "roads and buildings of {year} (© OpenHistoricalMap contributors)"));
        if (old.aiState === "sending" || old.aiState === "reading") parts.push(t("surroundings.oldMap.reading", "the AI is reading the old map…"));
        else if (old.aiState === "failed") parts.push(t("surroundings.oldMap.readFailed", { error: old.aiError }, "the old map could not be read: {error}"));
        if (value.mapOverlay && old.overlayState === "real") parts.push(t("surroundings.oldMap.overlay", { attribution: value.mapOverlay.attribution || new URL(value.mapOverlay.url.replace(/[{}]/g, ""), window.location.href).host }, "on an old map ({attribution})"));
        else if (value.mapOverlay && old.overlayState === "failed") parts.push(t("surroundings.oldMap.overlayFailed", "the old map could not be loaded"));
      }
      return parts.join(", ");
    },

    updateSurroundingsLabels() {
      Viewer.updateSurroundingsPanelLabels?.();
      Viewer.syncSurroundingsBadge();
    },

    // ---- manifests ------------------------------------------------------------

    // AIM3DViewer.surroundings of an exported manifest: only while on.
    // `generated` says what they are to whoever reads the manifest.
    getSurroundingsForExport() {
      const state = Viewer.surroundings;
      if (!state.enabled) return undefined;
      return {
        generated: true,
        kind: state.kind,
        period: state.period,
        year: state.year,
        season: state.season,
        seed: state.seed,
        density: Math.round(state.density * 100) / 100,
        style: state.style,
        water: state.water,
        terrain: state.terrain,
        masonry: state.masonry,
        ...(state.waterUrl ? { waterUrl: state.waterUrl } : {}),
        ...(state.layoutUrl ? { layoutUrl: state.layoutUrl } : {}),
        ...(state.mapOverlay ? { mapOverlay: { ...state.mapOverlay } } : {}),
        ...(state.followTimeline ? { followTimeline: true } : {}),
        ...(state.terrain === "real" ? { latitude: state.latitude, longitude: state.longitude } : {}),
      };
    },

    // A manifest's surroundings (absent: none).
    apply3IFManifestSurroundings(config) {
      const valid = config && typeof config === "object" && !Array.isArray(config) && SURROUNDINGS_KINDS.includes(config.kind);
      if (!valid) {
        Viewer.setSurroundings(false);
        return false;
      }
      // Whole: what the block leaves out is the default, not what was on.
      const block = { ...config };
      Viewer.fillSurroundingsPlace(block);
      // The water's file next to the manifest, where it is a relative path.
      const base = Viewer.currentManifest?.baseUrl;
      const resolve = (url) => {
        if (typeof url !== "string" || !base || /^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
        try {
          // The braces of a tile URL kept as they are.
          return decodeURI(new URL(url, new URL(base, window.location.href)).href);
        } catch (_error) {
          return url;
        }
      };
      block.waterUrl = resolve(block.waterUrl);
      block.layoutUrl = resolve(block.layoutUrl);
      if (block.mapOverlay && typeof block.mapOverlay === "object") block.mapOverlay = { ...block.mapOverlay, url: resolve(block.mapOverlay.url) };
      Object.assign(Viewer.surroundings, normalizeSurroundings(block));
      return Viewer.setSurroundingsOptions({}) === true;
    },

    // Before a new model: they were the old one's.
    disposeSurroundings() {
      Viewer.setSurroundings(false);
      Object.assign(Viewer.surroundingsTerrain, { state: "none", key: "", elevation: null });
      Object.assign(Viewer.surroundingsMap, { state: "none", key: "", loaded: null, water: null, waterKey: "", source: null });
      Viewer.surroundingsOldMap.texture?.dispose();
      Object.assign(Viewer.surroundingsOldMap, {
        layoutState: "none", layoutKey: "", layoutAnswer: null, layoutSource: null, overlayState: "none", overlayKey: "", overlay: null, texture: null,
        ohmKey: "", ohmAnswer: null, aiState: "none", aiAnswer: null, aiGeojson: null, aiError: "", aiOffered: false,
      });
      Object.assign(Viewer.surroundingsTimeline, { year: null, outside: false, pending: null, drawn: 0 });
      Object.assign(Viewer.surroundings, SURROUNDINGS_DEFAULTS);
      Viewer.syncSurroundingsPanel?.();
    },
  });
}
