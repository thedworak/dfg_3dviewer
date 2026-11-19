import THREE from "../init.js";
import {
  hasSurroundingsGridWater,
  surroundingsGridWaterDistance,
  surroundingsGroundHeight,
  surroundingsNoise,
  surroundingsTerrainHeight,
  surroundingsWaterLevel,
} from "./surroundings-rules.js";

// The realistic look of the generated surroundings (editor/surroundings.js):
// the same layout (editor/surroundings-rules.js) drawn with what makes a
// distant view read as real, still without textures:
//
//   - materials of the period and place: timber and thatch in villages and
//     before about 1250; plaster, brick and tiles in a late medieval town;
//     a brick church with a tiled roof (Central Europe's brick Gothic);
//     each house a little different
//   - roofs with eaves and an underside, doors and windows, merlons on a
//     town wall, pointed stakes on a palisade
//   - baked light: walls darker at the foot, a soft contact shadow round
//     each house, tree and haystack (a transparent layer of its own)
//   - the ground: a meadow varied by noise, trodden earth in the
//     settlement, crops of the season in furrowed strips, earthen roads with
//     a grass strip, haystacks in summer and autumn
//   - trees of irregular shape and colour, autumn foliage, bare in winter
//   - aerial perspective: colours fading into a haze with the distance, and
//     a ring of low hills that closes the horizon (the real heights there
//     where the real terrain is loaded)
//   - surface detail: procedural patterns (thatch, tiles, shingles, brick,
//     plaster, logs, grass, crops, earth, leaves) in one atlas, multiplied
//     into the colours in metres, so they keep their scale
//   - water with ripples (ice in winter), bridges
//   - shadows cast by the sun or the key light (projected onto the ground,
//     followed as the light moves; editor/surroundings.js)
//   - trees swaying and smoke drifting in the wind (the weather's, if on)
//
// The shaders (detail, sway, ripples, smoke) are WebGL's; with the WebGPU
// renderer the look is drawn without them.
//
// The look changes, not what is claimed: the layout, the badge and the
// manifest's `generated: true` are the same as for the schematic look.

const smoothstep = THREE.MathUtils.smoothstep;
const v = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);

// 0 to 1 from a place and a key: the same house gets the same colour.
export function surroundingsHash(x, z, key = 0) {
  const s = Math.sin(x * 12.9898 + z * 78.233 + key * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Triangles with a colour and an opacity per corner, flat shaded.
 *   fade(x, z)            opacity at a place (1: opaque)
 *   tint(x, z, colour)    changes a corner's colour in place (the haze)
 * tri(p, q, r, colour, extra) / quad(p, q, r, s, colour, extra), extra:
 *   want     a direction the face should look to (its winding is turned)
 *   shades   a factor per corner (baked light)
 *   colors   a colour per corner instead of `colour`
 *   alphas   an opacity per corner, times fade()
 *   raw      no tint (shadows)
 *   tile     a pattern of the detail atlas (DETAIL), laid in metres on the
 *            face: along it horizontally, and up it
 *   sway     { base, rate, phase }: how far a corner moves in the wind -
 *            `rate` times its height over `base`, squared
 */
export function createSurroundingsWriter(fade, tint = null) {
  const positions = [];
  const normals = [];
  const colors = [];
  const details = [];
  const sways = [];
  const tangent = new THREE.Vector3();
  const bitangent = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const scratch = new THREE.Color();
  const tri = (p, q, r, color, extra = {}) => {
    a.subVectors(q, p);
    b.subVectors(r, p);
    normal.crossVectors(a, b);
    let order = [0, 1, 2];
    if (extra.want && normal.dot(extra.want) < 0) {
      order = [0, 2, 1];
      normal.negate();
    }
    normal.normalize();
    const points = [p, q, r];
    const tile = extra.tile || 0;
    if (tile) {
      tangent.crossVectors(UP, normal);
      if (tangent.lengthSq() < 1e-6) tangent.set(1, 0, 0);
      tangent.normalize();
      bitangent.crossVectors(normal, tangent);
    }
    const scale = DETAIL_SCALE[tile] || 1;
    order.forEach((index) => {
      const point = points[index];
      if (tile) details.push(point.dot(tangent) / scale, point.dot(bitangent) / scale, tile);
      else details.push(0, 0, 0);
      if (extra.sway) {
        const above = Math.max(0, point.y - extra.sway.base);
        sways.push(above * above * extra.sway.rate, extra.sway.phase);
      } else sways.push(0, 0);
      scratch.copy(extra.colors ? extra.colors[index] : color);
      if (extra.shades) scratch.multiplyScalar(extra.shades[index]);
      if (tint && !extra.raw) tint(point.x, point.z, scratch);
      positions.push(point.x, point.y, point.z);
      normals.push(normal.x, normal.y, normal.z);
      colors.push(scratch.r, scratch.g, scratch.b, fade(point.x, point.z) * (extra.alphas ? extra.alphas[index] : 1));
    });
  };
  // The corners of a quad's two triangles: p q r and p r s.
  const pick = (extra, indices) => {
    const out = { ...extra };
    ["shades", "colors", "alphas"].forEach((key) => {
      if (extra[key]) out[key] = indices.map((index) => extra[key][index]);
    });
    return out;
  };
  return {
    tri,
    quad: (p, q, r, s, color, extra = {}) => {
      tri(p, q, r, color, pick(extra, [0, 1, 2]));
      tri(p, r, s, color, pick(extra, [0, 2, 3]));
    },
    geometry: () => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 4));
      geometry.setAttribute("surroundingsDetail", new THREE.Float32BufferAttribute(details, 3));
      geometry.setAttribute("surroundingsSway", new THREE.Float32BufferAttribute(sways, 2));
      return geometry;
    },
    triangles: () => positions.length / 9,
  };
}

// ---- surface detail ---------------------------------------------------------------

// The patterns of the atlas (4 x 4 cells), and how many metres one repeat
// covers.
export const DETAIL = { none: 0, thatch: 1, tiles: 2, shingle: 3, brick: 4, plaster: 5, logs: 6, grass: 7, crops: 8, earth: 9, leaves: 10, snow: 11, planks: 12, stone: 13 };
const DETAIL_SCALE = [1, 2.2, 1.6, 1.4, 1.3, 3, 1.8, 5, 3, 4, 2.5, 6, 2, 2.4];
const CELL = 256;
let atlas = null;

// The patterns drawn once, grey around the middle (multiplied by two in
// the shader, so the colours keep their brightness), each wrapping round.
export function getSurroundingsDetailAtlas() {
  if (atlas) return atlas;
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = CELL * 4;
  canvas.height = CELL * 4;
  const g = canvas.getContext("2d");
  let state = 0x1234567;
  const rnd = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const grey = (value, alpha = 1) => `rgba(${value | 0},${value | 0},${value | 0},${alpha})`;
  // Drawn at its place and wrapped round the cell's edges.
  const wrapped = (draw) => [-CELL, 0, CELL].forEach((dx) => [-CELL, 0, CELL].forEach((dy) => {
    g.save();
    g.translate(dx, dy);
    draw();
    g.restore();
  }));
  const cell = (tile, draw) => {
    g.save();
    g.translate((tile % 4) * CELL, Math.floor(tile / 4) * CELL);
    g.beginPath();
    g.rect(0, 0, CELL, CELL);
    g.clip();
    g.fillStyle = grey(128);
    g.fillRect(0, 0, CELL, CELL);
    draw();
    g.restore();
  };
  const speckle = (count, min, max, size, alpha = 0.6) => {
    for (let index = 0; index < count; index += 1) {
      const x = rnd() * CELL;
      const y = rnd() * CELL;
      const s = size * (0.5 + rnd());
      const value = min + (max - min) * rnd();
      wrapped(() => {
        g.fillStyle = grey(value, alpha);
        g.fillRect(x, y, s, s);
      });
    }
  };
  const blotches = (count, min, max, radius, alpha) => {
    for (let index = 0; index < count; index += 1) {
      const x = rnd() * CELL;
      const y = rnd() * CELL;
      const r = radius * (0.5 + rnd());
      const value = min + (max - min) * rnd();
      wrapped(() => {
        const gradient = g.createRadialGradient(x, y, 0, x, y, r);
        gradient.addColorStop(0, grey(value, alpha));
        gradient.addColorStop(1, grey(value, 0));
        g.fillStyle = gradient;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      });
    }
  };
  // Thatch: straws up the slope, in courses.
  cell(DETAIL.thatch, () => {
    g.lineWidth = 1.6;
    for (let index = 0; index < 1600; index += 1) {
      const x = rnd() * CELL;
      const y = rnd() * CELL;
      const length = 16 + rnd() * 26;
      const lean = (rnd() - 0.5) * 0.3;
      const value = 85 + rnd() * 95;
      wrapped(() => {
        g.strokeStyle = grey(value, 0.7);
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + lean * length, y + length);
        g.stroke();
      });
    }
    for (let y = 0; y < CELL; y += 64) {
      g.fillStyle = grey(60, 0.18);
      g.fillRect(0, y, CELL, 10);
    }
  });
  // Roof tiles, shingles: courses of overlapping pieces, a shadow under each.
  const courses = (tile, rows, widthMin, widthMax, valueMin, valueMax) => cell(tile, () => {
    const height = CELL / rows;
    for (let row = 0; row < rows; row += 1) {
      let x = (row % 2) * widthMin * 0.5 - widthMax;
      while (x < CELL + widthMax) {
        const width = widthMin + rnd() * (widthMax - widthMin);
        const value = valueMin + rnd() * (valueMax - valueMin);
        const y = row * height;
        const left = x;
        wrapped(() => {
          g.fillStyle = grey(value);
          g.fillRect(left, y, width, height);
          g.fillStyle = grey(55, 0.8);
          g.fillRect(left, y + height - 3, width, 3);
          g.fillStyle = grey(80, 0.7);
          g.fillRect(left, y, 2, height);
          g.fillStyle = grey(175, 0.35);
          g.fillRect(left + 2, y, width - 2, 2);
        });
        x += width;
      }
    }
  });
  courses(DETAIL.tiles, 8, 22, 26, 112, 150);
  courses(DETAIL.shingle, 13, 10, 20, 100, 160);
  // Brick: courses with lighter mortar.
  cell(DETAIL.brick, () => {
    const rows = 16;
    const height = CELL / rows;
    g.fillStyle = grey(180);
    g.fillRect(0, 0, CELL, CELL);
    for (let row = 0; row < rows; row += 1) {
      const offset = (row % 2) * 28;
      for (let x = -56 + offset; x < CELL; x += 56) {
        g.fillStyle = grey(95 + rnd() * 60);
        g.fillRect(x + 1, row * height + 1, 54, height - 2);
      }
    }
  });
  // Plaster: soft blotches and a fine grain.
  cell(DETAIL.plaster, () => {
    blotches(160, 105, 155, 30, 0.25);
    speckle(2500, 100, 160, 1.2, 0.35);
  });
  // Logs laid one on another, with gaps and grain.
  cell(DETAIL.logs, () => {
    const logs = 7;
    const height = CELL / logs;
    for (let index = 0; index < logs; index += 1) {
      const y = index * height;
      const gradient = g.createLinearGradient(0, y, 0, y + height);
      gradient.addColorStop(0, grey(80));
      gradient.addColorStop(0.25, grey(150));
      gradient.addColorStop(0.7, grey(135));
      gradient.addColorStop(1, grey(65));
      g.fillStyle = gradient;
      g.fillRect(0, y, CELL, height);
      g.lineWidth = 1;
      for (let line = 0; line < 5; line += 1) {
        const ly = y + height * (0.2 + 0.6 * rnd());
        g.strokeStyle = grey(95, 0.35);
        g.beginPath();
        g.moveTo(0, ly);
        g.lineTo(CELL, ly + (rnd() - 0.5) * 4);
        g.stroke();
      }
    }
  });
  // Grass: blades as dots, patches.
  cell(DETAIL.grass, () => {
    blotches(60, 100, 160, 40, 0.3);
    speckle(6000, 70, 185, 1.6, 0.55);
  });
  // Crops: rows.
  cell(DETAIL.crops, () => {
    for (let x = 0; x < CELL; x += 8) {
      g.fillStyle = grey(95 + rnd() * 20);
      g.fillRect(x, 0, 3, CELL);
      g.fillStyle = grey(150 + rnd() * 20);
      g.fillRect(x + 4, 0, 3, CELL);
    }
    speckle(2500, 90, 170, 1.4, 0.4);
  });
  // Earth: grain and pebbles.
  cell(DETAIL.earth, () => {
    blotches(80, 100, 155, 26, 0.3);
    speckle(3500, 80, 175, 1.8, 0.5);
    speckle(220, 150, 200, 3, 0.7);
  });
  // Leaves: clusters, light on top, dark between.
  cell(DETAIL.leaves, () => {
    g.fillStyle = grey(95);
    g.fillRect(0, 0, CELL, CELL);
    for (let index = 0; index < 900; index += 1) {
      const x = rnd() * CELL;
      const y = rnd() * CELL;
      const r = 3 + rnd() * 6;
      const value = 105 + rnd() * 80;
      wrapped(() => {
        g.fillStyle = grey(value, 0.85);
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      });
    }
  });
  // Snow: barely anything.
  cell(DETAIL.snow, () => blotches(80, 118, 138, 40, 0.4));
  // Planks: boards along the face.
  cell(DETAIL.planks, () => {
    for (let x = 0; x < CELL; x += 32) {
      g.fillStyle = grey(110 + rnd() * 40);
      g.fillRect(x, 0, 30, CELL);
      g.fillStyle = grey(55, 0.8);
      g.fillRect(x + 30, 0, 2, CELL);
    }
  });
  // Stone: courses of dressed blocks of uneven size, dark joints.
  cell(DETAIL.stone, () => {
    g.fillStyle = grey(70);
    g.fillRect(0, 0, CELL, CELL);
    let y = 0;
    const heights = [];
    while (y < CELL) {
      const height = Math.min(22 + rnd() * 18, CELL - y);
      heights.push([y, height]);
      y += height;
    }
    heights.forEach(([top, height]) => {
      let x = -rnd() * 40;
      while (x < CELL) {
        const width = 30 + rnd() * 45;
        const value = 108 + rnd() * 60;
        g.fillStyle = grey(value);
        g.fillRect(x + 1.5, top + 1.5, width - 3, height - 3);
        g.fillStyle = grey(value + 20, 0.5);
        g.fillRect(x + 1.5, top + 1.5, width - 3, 2);
        x += width;
      }
    });
    speckle(1800, 90, 170, 1.4, 0.3);
  });
  atlas = new THREE.CanvasTexture(canvas);
  atlas.flipY = false;
  atlas.colorSpace = THREE.NoColorSpace;
  atlas.wrapS = THREE.ClampToEdgeWrapping;
  atlas.wrapT = THREE.ClampToEdgeWrapping;
  atlas.anisotropy = 4;
  atlas.generateMipmaps = true;
  atlas.minFilter = THREE.LinearMipmapLinearFilter;
  return atlas;
}

// The uniforms the surroundings' shaders share; editor/surroundings.js
// moves them each frame.
export function createSurroundingsUniforms() {
  return {
    surroundingsTime: { value: 0 },
    surroundingsWind: { value: 0.3 },
    surroundingsWindDir: { value: new THREE.Vector2(0.77, 0.64) },
    surroundingsAtlas: { value: getSurroundingsDetailAtlas() },
    surroundingsDetailAmount: { value: 0.6 },
    surroundingsRipple: { value: 0.1 },
    smokeWind: { value: new THREE.Vector2(0.5, 0.4) },
    smokeScale: { value: 600 },
    smokeUnit: { value: 1 },
  };
}

/**
 * A lit material for the surroundings' vertex colours; with `uniforms`
 * (WebGL), the detail atlas, the sway in the wind and, for `water`,
 * ripples.
 */
export function createSurroundingsMaterial({ transparent = false, uniforms = null, water = false, ...props } = {}) {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    transparent,
    depthWrite: !transparent,
    roughness: 1,
    metalness: 0,
    ...props,
  });
  if (!uniforms) return material;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>
attribute vec3 surroundingsDetail;
attribute vec2 surroundingsSway;
uniform float surroundingsTime;
uniform float surroundingsWind;
uniform vec2 surroundingsWindDir;
varying vec3 vSurroundingsDetail;
varying vec2 vSurroundingsPlace;`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
vSurroundingsDetail = surroundingsDetail;
vSurroundingsPlace = position.xz;
float surroundingsSwing = sin( surroundingsTime * 1.6 + surroundingsSway.y ) * 0.7 + sin( surroundingsTime * 2.9 + surroundingsSway.y * 1.7 ) * 0.3;
transformed.xz += surroundingsWindDir * ( surroundingsSwing + 0.6 ) * surroundingsSway.x * surroundingsWind;`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
uniform sampler2D surroundingsAtlas;
uniform float surroundingsDetailAmount;
uniform float surroundingsTime;
uniform float surroundingsRipple;
varying vec3 vSurroundingsDetail;
varying vec2 vSurroundingsPlace;`)
      .replace("#include <color_fragment>", `#include <color_fragment>
if ( vSurroundingsDetail.z > 0.5 ) {
  float surroundingsTile = floor( vSurroundingsDetail.z + 0.5 );
  vec2 surroundingsCell = vec2( mod( surroundingsTile, 4.0 ), floor( surroundingsTile / 4.0 ) );
  vec2 surroundingsUv = ( surroundingsCell + 0.04 + fract( vSurroundingsDetail.xy ) * 0.92 ) / 4.0;
  vec2 surroundingsDx = dFdx( vSurroundingsDetail.xy );
  vec2 surroundingsDy = dFdy( vSurroundingsDetail.xy );
  vec3 surroundingsPattern = textureGrad( surroundingsAtlas, surroundingsUv, surroundingsDx * 0.23, surroundingsDy * 0.23 ).rgb;
  // Gone where a repeat is smaller than a few pixels (no moire far away).
  float surroundingsFar = smoothstep( 0.05, 0.3, max( length( surroundingsDx ), length( surroundingsDy ) ) );
  diffuseColor.rgb *= mix( vec3( 1.0 ), surroundingsPattern * 2.0, surroundingsDetailAmount * ( 1.0 - surroundingsFar ) );
}`);
    if (water) {
      shader.fragmentShader = shader.fragmentShader.replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
vec2 surroundingsWave = vSurroundingsPlace * 0.35;
vec2 surroundingsRipples = vec2(
  sin( surroundingsWave.x * 1.7 + surroundingsTime * 1.3 ) + sin( surroundingsWave.x * 0.9 + surroundingsWave.y * 1.3 - surroundingsTime * 0.8 ) * 0.6 + sin( surroundingsWave.y * 2.3 + surroundingsTime * 1.7 ) * 0.4,
  cos( surroundingsWave.y * 1.5 + surroundingsTime * 1.1 ) + cos( surroundingsWave.x * 1.2 - surroundingsWave.y * 0.7 + surroundingsTime * 0.9 ) * 0.6 + cos( surroundingsWave.x * 2.1 - surroundingsTime * 1.5 ) * 0.4
);
normal = normalize( normal + ( viewMatrix * vec4( surroundingsRipples.x, 0.0, surroundingsRipples.y, 0.0 ) ).xyz * surroundingsRipple );`);
    }
  };
  material.customProgramCacheKey = () => (water ? "surroundings-water" : "surroundings");
  return material;
}

// Colours (sRGB) by season.
const GROUND = {
  meadow: { spring: 0x86a35a, summer: 0x7b8f4e, autumn: 0x8b8a57, winter: 0xeef1f4 },
  earth: { spring: 0x8d7a5c, summer: 0x9a8566, autumn: 0x86705a, winter: 0xdcdad6 },
  crops: {
    spring: [0x9cb565, 0x7e6a4c, 0x8faa5c],
    summer: [0xcdb56c, 0x93a75c, 0xb79c5e],
    autumn: [0xb7a272, 0x6f5b45, 0x8c9358],
    winter: [0xe9ecef, 0xdde1e4, 0xd6d8d8],
  },
  haze: { spring: 0xc6d3de, summer: 0xc8d3dc, autumn: 0xcfd2d3, winter: 0xdfe5eb },
};
// The south: dry grass, pale earth, vineyards and stubble.
const GROUND_MED = {
  meadow: { spring: 0x8b9c5c, summer: 0x9f9c66, autumn: 0x979463, winter: 0x87955f },
  earth: { spring: 0xab9474, summer: 0xb59c78, autumn: 0xa58c6c, winter: 0xa28b6c },
  crops: {
    spring: [0x9cae62, 0x8a7a55, 0x7f9a58],
    summer: [0xd9bf7b, 0x7d8a4e, 0xc4a86a],
    autumn: [0xb59d6c, 0x8a6a48, 0x7c7f4c],
    winter: [0x9a9466, 0x8c7a5c, 0x8a915e],
  },
  haze: { spring: 0xd2dbe2, summer: 0xdcdcd6, autumn: 0xd8d8d2, winter: 0xd6dde2 },
};
const FOLIAGE = {
  broadleaf: { spring: [0x86a852, 0x95b35e, 0x7d9d4c], summer: [0x587538, 0x4d6a33, 0x67803f], autumn: [0xb47a2e, 0x9c5a28, 0x8f8a3a, 0xa86d2c], winter: [0x766d62, 0x6e665c] },
  conifer: { spring: [0x3d5a3c, 0x46613f], summer: [0x3d5a3c, 0x46613f, 0x355238], autumn: [0x3d5a3c, 0x46613f], winter: [0x56685f, 0x5e6f66] },
  // Evergreen, the year round.
  cypress: { spring: [0x2f4430, 0x34492f], summer: [0x2f4430, 0x34492f], autumn: [0x2f4430, 0x34492f], winter: [0x34463a, 0x3a4b3e] },
  olive: { spring: [0x7f8c62, 0x88936b], summer: [0x7d8a63, 0x86916c, 0x738062], autumn: [0x7d8a63, 0x738062], winter: [0x7a8462, 0x737e60] },
};
const BUILT = {
  timber: 0x7b5b3e,
  clay: 0xcdbf9f,
  plaster: [0xdcd0b4, 0xcdb894, 0xe2d9c6, 0xd6c3a0],
  // Baroque facades: ochre, rose, pale green, white.
  baroque: [0xe3cfa0, 0xe6c3b4, 0xcfd8c0, 0xe8e2d4, 0xd9b98c],
  copper: 0x5e8a74,
  // Modernist render: white, cream, light grey.
  modernist: [0xe8e4da, 0xd9d4c8, 0xcfc8b8, 0xe2ddd0],
  // 19th-century plaster: grey, ochre, sand.
  industrial: [0xd8cfbf, 0xc9b79c, 0xbfb5a8, 0xd6c6a6, 0xcbc3b5],
  brick: 0x99482f,
  stone: 0xb0a898,
  thatch: 0x8e7b54,
  shingle: 0x766b5f,
  tiles: [0x8f4c38, 0x84473a, 0x99573f],
  slate: 0x4b4744,
  palisade: 0x6a5139,
  opening: 0x2b2420,
  trunk: 0x5a4636,
  hay: 0xb89c5c,
  snow: 0xf1f3f5,
  // The south: render in lime, ochre and sienna; pale limestone.
  stucco: [0xeae0c9, 0xe4cfa6, 0xd9b585, 0xf0ebe0, 0xd8a77e, 0xe6d6b8],
  limestone: 0xcbbd9e,
  // Prefabricated panels; silicate brick; asbestos-cement roofs.
  prefab: [0xcbc8bf, 0xd8d2c4, 0xbfc3c0, 0xe0d9c8, 0xc4bcae],
  silicate: 0xd5d1c3,
  asbestos: 0x8d8f8b,
  // The North: Falu red, ochre and white paint on timber; turf roofs.
  falu: [0x8a2f23, 0x93342a, 0x7f2b22],
  nordicPaint: [0xc89b4a, 0xe8e4da, 0xd9c08a],
  turf: 0x6f6a3e,
  // The British Isles: sandstone and limestone, whitewash, red brick.
  britishStone: [0xb9a37f, 0xa89474, 0xc4b38f],
  whitewash: 0xece6d8,
  redBrick: 0x8c4430,
  lead: 0x6d7275,
  // The East: whitewashed clay, painted tin, a blue or green dome.
  tin: [0x6c8a7a, 0x8a8f94, 0x7a6a5a],
  dome: [0x3f6f8f, 0x4f7f5f, 0x5e8a74],
  // After 1990: renovated estates in pastels; villas; a shop's cladding.
  pastel: [0xe9d7a0, 0xc9dbe8, 0xe8c4b4, 0xd4e3c4, 0xe6e0d2],
  anthracite: 0x3f4043,
  cladding: 0xd9dadb,
};

const colour = (hex) => new THREE.Color(hex);
const choose = (list, unit) => list[Math.min(list.length - 1, Math.floor(unit * list.length))];

// A colour a little different for each place.
function vary(hex, x, z, amount = 1) {
  const value = colour(hex);
  value.offsetHSL((surroundingsHash(x, z, 1) - 0.5) * 0.02 * amount, (surroundingsHash(x, z, 2) - 0.5) * 0.1 * amount, (surroundingsHash(x, z, 3) - 0.5) * 0.08 * amount);
  return value;
}

// What a block is built of: { wall, roof, overhang, openings, wallTile,
// roofTile } (DETAIL patterns).
function blockLook(block, params) {
  const early = params.period === "early-medieval";
  const modern = params.period === "early-modern";
  const industrial = params.period === "industrial" || params.period === "modern" || params.period === "postwar" || params.period === "contemporary";
  const twentieth = params.period === "modern" || params.period === "postwar" || params.period === "contemporary";
  const postwar = params.period === "postwar" || params.period === "contemporary";
  const med = params.region === "mediterranean";
  // Brick or stone, by the region (surroundings-rules.js, surroundingsMasonry).
  const stone = params.masonry === "stone" || med || params.region === "nordic" || params.region === "british";
  const masonryColour = (amount) => vary(stone ? (med ? BUILT.limestone : BUILT.stone) : BUILT.brick, block.x, block.z, amount);
  const masonryTile = stone ? DETAIL.stone : DETAIL.brick;
  const winter = params.season === "winter";
  const town = params.kind === "town" || params.kind === "port";
  const pick = (key) => surroundingsHash(block.x, block.z, key);
  const stucco = (amount = 1) => vary(choose(BUILT.stucco, pick(5)), block.x, block.z, amount);
  const tiles = () => vary(choose(BUILT.tiles, pick(7)), block.x, block.z, 0.6);
  let wall;
  let roof;
  let wallTile;
  let roofTile;
  let overhang = 0.5;
  let openings = "cottage";
  if (block.role === "estate") {
    // A block of prefabricated panels, a flat tarred roof.
    wall = vary(choose(BUILT.prefab, pick(5)), block.x, block.z, 0.4);
    wallTile = DETAIL.plaster;
    roof = colour(0x58544f);
    roofTile = 0;
    openings = "townhouse";
    overhang = 0;
  } else if (block.role === "farm") {
    // A collective farm's shed: silicate brick or grey render, asbestos.
    wall = vary(pick(4) < 0.5 ? BUILT.silicate : BUILT.prefab[2], block.x, block.z, 0.5);
    wallTile = pick(4) < 0.5 ? DETAIL.brick : DETAIL.plaster;
    roof = vary(BUILT.asbestos, block.x, block.z, 0.4);
    roofTile = DETAIL.shingle;
    openings = "barn";
    overhang = 0.3;
  } else if (block.role === "barn" || block.role === "granary") {
    // Timber under thatch or shingle; brick and tiles after 1800; stone in
    // the south.
    const masonryBarn = med || industrial || (block.role === "granary" && !early && pick(4) < 0.5);
    wall = med ? masonryColour(0.6) : masonryBarn ? masonryColour(0.7) : vary(BUILT.timber, block.x, block.z);
    wallTile = med ? DETAIL.stone : masonryBarn ? (stone ? DETAIL.stone : DETAIL.brick) : DETAIL.planks;
    const tiled = med || industrial;
    roof = tiled ? (postwar ? vary(BUILT.asbestos, block.x, block.z, 0.4) : tiles()) : pick(6) < 0.6 ? vary(BUILT.thatch, block.x, block.z) : vary(BUILT.shingle, block.x, block.z, 0.6);
    roofTile = tiled ? DETAIL.tiles : pick(6) < 0.6 ? DETAIL.thatch : DETAIL.shingle;
    openings = block.role === "granary" ? "tower" : "barn";
    overhang = 0.5;
  } else if (block.role === "manor" || block.role === "cloister") {
    // White or ochre render (stone in the south and before 1550 for a
    // monastery), tiles or shingle.
    const bare = block.role === "cloister" && !med && !modern && !industrial;
    wall = med ? stucco(0.6) : bare ? masonryColour(0.5) : vary(block.role === "manor" ? BUILT.baroque[3] : choose(BUILT.baroque, pick(5)), block.x, block.z, 0.4);
    wallTile = bare ? masonryTile : DETAIL.plaster;
    const shingled = block.role === "manor" && !med && !industrial && pick(6) < 0.6;
    roof = shingled ? vary(BUILT.shingle, block.x, block.z, 0.6) : tiles();
    roofTile = shingled ? DETAIL.shingle : DETAIL.tiles;
    openings = "townhouse";
    overhang = 0.45;
  } else if (block.role === "warehouse") {
    // A port's warehouse: brick (or half-timber before 1550), steep tiles;
    // limestone in the south.
    const timber = !med && (early || params.period === "medieval") && pick(4) < 0.4;
    wall = med ? masonryColour(0.6) : timber ? vary(BUILT.palisade, block.x, block.z) : vary(BUILT.brick, block.x, block.z, 0.6);
    wallTile = med ? DETAIL.stone : timber ? DETAIL.planks : DETAIL.brick;
    roof = tiles();
    roofTile = DETAIL.tiles;
    openings = "townhouse";
    overhang = 0.3;
  } else if (block.role === "campanile") {
    wall = masonryColour(0.4);
    wallTile = DETAIL.stone;
    roof = tiles();
    roofTile = DETAIL.tiles;
    openings = "tower";
    overhang = 0.3;
  } else if (block.role === "church") {
    // After 1550 a plastered church, its dome copper gone green or shingled.
    // In the south pale stone, a low tiled roof.
    wall = med && !early ? (modern ? stucco(0.4) : masonryColour(0.4)) : early ? vary(BUILT.timber, block.x, block.z) : modern ? vary(BUILT.baroque[3], block.x, block.z, 0.5) : masonryColour(0.5);
    wallTile = med && !early ? (modern ? DETAIL.plaster : DETAIL.stone) : early ? DETAIL.logs : modern ? DETAIL.plaster : masonryTile;
    roof = colour(med && !early && block.roof === "gable" ? BUILT.tiles[0] : early ? BUILT.shingle : block.roof === "onion" ? (pick(8) < 0.6 ? BUILT.copper : BUILT.slate) : block.roof === "pyramid" ? BUILT.slate : BUILT.tiles[1]);
    roofTile = early || block.roof === "pyramid" || block.roof === "onion" ? DETAIL.shingle : DETAIL.tiles;
    openings = block.roof === "pyramid" ? "tower" : early ? "chapel" : "church";
    overhang = 0.4;
  } else if (block.role === "factory" || block.role === "factory-hall" || block.role === "chimney") {
    // Brick (always, after 1800), a tarred roof with glazed teeth.
    wall = vary(BUILT.brick, block.x, block.z, 0.6);
    wallTile = DETAIL.brick;
    roof = colour(0x45413e);
    roofTile = DETAIL.shingle;
    openings = block.role === "factory" || block.role === "factory-hall" ? "factory" : null;
    overhang = 0.2;
  } else if (block.role === "station") {
    wall = vary(BUILT.industrial[1], block.x, block.z, 0.5);
    wallTile = DETAIL.plaster;
    roof = colour(BUILT.slate);
    roofTile = DETAIL.shingle;
    openings = "townhouse";
    overhang = 0.8;
  } else if (block.role === "tower") {
    wall = masonryColour(0.5);
    wallTile = masonryTile;
    roof = colour(BUILT.slate);
    roofTile = DETAIL.shingle;
    openings = "tower";
    overhang = 0.3;
  } else if (med && block.role === "house") {
    // The south: render or bare stone, low terracotta roofs (or a flat
    // terrace); tenements and blocks of flats as in the north.
    const bareStone = pick(4) < (town ? 0.2 : 0.45) && !industrial;
    wall = bareStone ? masonryColour(0.8) : stucco();
    wallTile = bareStone ? DETAIL.stone : DETAIL.plaster;
    roof = block.roof === "none" ? colour(0xb9ab92) : tiles();
    roofTile = block.roof === "none" ? DETAIL.plaster : DETAIL.tiles;
    openings = town || block.h > 5 ? "townhouse" : "cottage";
    overhang = 0.3;
    if (twentieth && block.roof === "none" && town) {
      wall = vary(choose(BUILT.modernist, pick(5)), block.x, block.z, 0.5);
      roof = colour(0x58544f);
      roofTile = 0;
      overhang = 0;
    }
  } else if (block.market) {
    // A shtetl's house on the square: planks or white clay, a tall shingled
    // roof; brick or plaster on two storeys after 1800.
    const plastered = industrial ? pick(4) < 0.7 : pick(4) < 0.35;
    wall = plastered ? (industrial && pick(5) < 0.4 ? vary(BUILT.brick, block.x, block.z) : vary(choose(BUILT.plaster, pick(5)), block.x, block.z)) : vary(BUILT.timber, block.x, block.z);
    wallTile = plastered ? (industrial && pick(5) < 0.4 ? DETAIL.brick : DETAIL.plaster) : DETAIL.planks;
    const tinned = industrial && pick(6) < 0.5;
    roof = tinned ? colour(0x7d8288) : vary(BUILT.shingle, block.x, block.z, 0.6);
    roofTile = DETAIL.shingle;
    openings = "townhouse";
    overhang = 0.5;
  } else if (town && !early) {
    // A burgher's house: plastered or brick, tiled or shingled; a
    // tenement after 1800: grey and ochre plaster or brick, tiles, slate or tin.
    const brick = pick(4) < (industrial ? 0.3 : 0.25);
    wall = brick && !modern ? (industrial ? vary(BUILT.brick, block.x, block.z) : masonryColour(1)) : vary(choose(industrial ? BUILT.industrial : modern ? BUILT.baroque : BUILT.plaster, pick(5)), block.x, block.z);
    wallTile = brick && !modern ? (industrial ? DETAIL.brick : masonryTile) : DETAIL.plaster;
    const tiled = pick(6) < (modern ? 0.85 : industrial ? 0.5 : 0.7);
    roof = tiled ? vary(choose(BUILT.tiles, pick(7)), block.x, block.z, 0.6) : industrial ? colour(pick(7) < 0.5 ? BUILT.slate : 0x7d8288) : vary(BUILT.shingle, block.x, block.z, 0.6);
    roofTile = tiled ? DETAIL.tiles : DETAIL.shingle;
    openings = "townhouse";
    overhang = 0.35;
    // A flat-roofed block of flats: light render, a tarred roof.
    if (twentieth && block.roof === "none") {
      wall = vary(choose(BUILT.modernist, pick(5)), block.x, block.z, 0.5);
      wallTile = DETAIL.plaster;
      roof = colour(0x58544f);
      roofTile = 0;
      overhang = 0;
    }
  } else {
    // A cottage: logs, some with clay; thatched, a few shingled.
    const clay = !early && pick(4) < (modern ? 0.6 : 0.45);
    wall = clay ? vary(BUILT.clay, block.x, block.z) : vary(BUILT.timber, block.x, block.z);
    wallTile = clay ? DETAIL.plaster : DETAIL.logs;
    const thatched = pick(6) < (early ? 0.85 : 0.75);
    roof = thatched ? vary(BUILT.thatch, block.x, block.z) : vary(BUILT.shingle, block.x, block.z);
    roofTile = thatched ? DETAIL.thatch : DETAIL.shingle;
    overhang = 0.6;
  }
  // ---- the other regions' houses and churches; what came after 1990
  const region = params.region;
  const house = block.role === "house" && !block.market && block.roof !== "none";
  const twoStorey = block.h > 5;
  if (region === "nordic" && house) {
    // Painted timber: mostly Falu red, some ochre or white (more of those
    // in a town after 1800); turf roofs until about 1800, then tiles.
    const red = pick(4) < (industrial && town ? 0.35 : 0.65);
    wall = vary(red ? choose(BUILT.falu, pick(5)) : choose(BUILT.nordicPaint, pick(5)), block.x, block.z, 0.6);
    wallTile = DETAIL.planks;
    const turf = !industrial && (early || params.period === "medieval" || pick(6) < 0.5);
    roof = turf ? vary(BUILT.turf, block.x, block.z, 0.8) : pick(7) < 0.6 ? tiles() : colour(BUILT.slate);
    roofTile = turf ? DETAIL.grass : DETAIL.tiles;
    openings = town || twoStorey ? "townhouse" : "cottage";
  } else if (region === "british" && house) {
    if (town && industrial) {
      // Terraces: red brick under slate.
      wall = vary(BUILT.redBrick, block.x, block.z, 0.6);
      wallTile = DETAIL.brick;
      roof = colour(BUILT.slate);
      roofTile = DETAIL.shingle;
      openings = "townhouse";
    } else if (town) {
      // Timber-framed and rendered, or brick and stucco after 1550.
      wall = modern && pick(4) < 0.5 ? vary(BUILT.redBrick, block.x, block.z, 0.6) : vary(pick(4) < 0.5 ? BUILT.whitewash : choose(BUILT.plaster, pick(5)), block.x, block.z, 0.5);
      wallTile = modern && pick(4) < 0.5 ? DETAIL.brick : DETAIL.plaster;
      roof = pick(6) < 0.5 ? colour(BUILT.slate) : tiles();
      roofTile = DETAIL.tiles;
      openings = "townhouse";
    } else {
      // Cottages: stone or whitewash, thatch until the slate came by rail.
      const whitewashed = pick(4) < 0.4;
      wall = whitewashed ? vary(BUILT.whitewash, block.x, block.z, 0.4) : vary(choose(BUILT.britishStone, pick(5)), block.x, block.z, 0.6);
      wallTile = whitewashed ? DETAIL.plaster : DETAIL.stone;
      const thatched = !industrial || pick(6) < 0.25;
      roof = thatched ? vary(BUILT.thatch, block.x, block.z) : colour(BUILT.slate);
      roofTile = thatched ? DETAIL.thatch : DETAIL.shingle;
      openings = "cottage";
    }
  } else if (region === "eastern" && house && !town) {
    // Log houses, half of them whitewashed clay; thatch, tin after 1914.
    const white = pick(4) < 0.5;
    wall = white ? vary(BUILT.whitewash, block.x, block.z, 0.4) : vary(BUILT.timber, block.x, block.z);
    wallTile = white ? DETAIL.plaster : DETAIL.logs;
    const tinned = twentieth && pick(6) < 0.6;
    roof = tinned ? vary(choose(BUILT.tin, pick(7)), block.x, block.z, 0.5) : vary(BUILT.thatch, block.x, block.z);
    roofTile = tinned ? DETAIL.shingle : DETAIL.thatch;
    openings = "cottage";
  } else if (block.role === "church" && region === "nordic" && !early) {
    // Whitewashed, under shingle or dark tiles.
    wall = vary(BUILT.whitewash, block.x, block.z, 0.3);
    wallTile = DETAIL.plaster;
    roof = colour(block.roof === "gable" && pick(6) < 0.5 ? BUILT.tiles[2] : BUILT.shingle);
    roofTile = DETAIL.shingle;
  } else if (block.role === "church" && region === "british" && !early) {
    // Stone under lead or slate.
    wall = vary(choose(BUILT.britishStone, pick(5)), block.x, block.z, 0.4);
    wallTile = DETAIL.stone;
    roof = colour(block.roof === "gable" ? BUILT.lead : BUILT.slate);
    roofTile = DETAIL.shingle;
  } else if (block.role === "church" && region === "eastern") {
    // A wooden church (white after 1800), its dome blue or green.
    wall = industrial ? vary(BUILT.whitewash, block.x, block.z, 0.3) : vary(BUILT.timber, block.x, block.z);
    wallTile = industrial ? DETAIL.plaster : DETAIL.logs;
    roof = block.roof === "onion" ? colour(choose(BUILT.dome, pick(8))) : vary(BUILT.shingle, block.x, block.z, 0.5);
    roofTile = DETAIL.shingle;
  }
  if (block.role === "estate" && block.renovated) {
    wall = vary(choose(BUILT.pastel, pick(5)), block.x, block.z, 0.4);
  } else if (block.role === "villa") {
    wall = vary(choose(BUILT.pastel, pick(5)), block.x, block.z, 0.5);
    wallTile = DETAIL.plaster;
    roof = pick(6) < 0.5 ? colour(BUILT.anthracite) : tiles();
    roofTile = DETAIL.tiles;
    openings = "townhouse";
    overhang = 0.5;
  } else if (block.role === "store") {
    wall = colour(BUILT.cladding);
    wallTile = DETAIL.plaster;
    roof = colour(0x77797b);
    roofTile = 0;
    openings = null;
    overhang = 0;
  }
  // A burnt-out shell: soot-blackened, roofless, its windows empty.
  if (block.ruin) {
    wall = wall.clone().lerp(colour(0x3b322c), 0.6);
    roof = colour(0x3a332e);
    roofTile = DETAIL.earth;
    openings = "townhouse";
    overhang = 0;
  }
  if (winter && block.roof !== "none") {
    roof = colour(BUILT.snow).lerp(roof, 0.12);
    roofTile = DETAIL.snow;
  }
  return { wall, roof, overhang, openings, opening: colour(BUILT.opening), wallTile, roofTile, ...(block.ruin ? { flatTop: roof } : {}) };
}

// A block with eaves, an underside, doors and windows, walls darker at the
// foot. `w` along its own x (turned by `angle`), `d` along z.
function writeDetailedBlock(writer, block, y, look) {
  const cos = Math.cos(block.angle);
  const sin = Math.sin(block.angle);
  const at = (lx, ly, lz) => v(block.x + lx * cos - lz * sin, y + ly, block.z + lx * sin + lz * cos);
  const dir = (lx, lz) => v(lx * cos - lz * sin, 0, lx * sin + lz * cos);
  const hw = block.w / 2;
  const hd = block.d / 2;
  // A ruin: each corner broken off at its own height; openings only below
  // the lowest.
  const ruin = block.ruin === true;
  const tops = ruin ? [0, 1, 2, 3].map((corner) => block.h * (0.55 + 0.45 * surroundingsHash(block.x + corner * 7.1, block.z, 50))) : [block.h, block.h, block.h, block.h];
  const h = ruin ? Math.min(...tops) : block.h;
  const base = [at(-hw, -0.5, -hd), at(hw, -0.5, -hd), at(hw, -0.5, hd), at(-hw, -0.5, hd)];
  const top = [at(-hw, tops[0], -hd), at(hw, tops[1], -hd), at(hw, tops[2], hd), at(-hw, tops[3], hd)];
  // Side i runs from corner i to i + 1: -z, +x, +z, -x.
  const outward = [dir(0, -1), dir(1, 0), dir(0, 1), dir(-1, 0)];
  const foot = Math.min(1, 2.2 / Math.max(h, 0.1));
  // A chimney is round (below), not a box.
  for (let side = 0; side < (block.role === "chimney" ? 0 : 4); side += 1) {
    const next = (side + 1) % 4;
    // Darker at the foot (baked occlusion), over the lowest couple of metres.
    const low = 0.62;
    const high = 1 - (1 - low) * (1 - foot) * 0.15;
    writer.quad(base[side], base[next], top[next], top[side], look.wall, { want: outward[side], shades: [low, low, high, high], tile: look.wallTile });
  }

  const o = look.overhang;
  if (ruin) {
    // The walls' inner faces, darker; rubble heaped inside.
    const inner = look.wall.clone().multiplyScalar(0.6);
    for (let side = 0; side < 4; side += 1) {
      const next = (side + 1) % 4;
      writer.quad(base[side], base[next], top[next], top[side], inner, { want: outward[side].clone().negate(), shades: [0.6, 0.6, 0.85, 0.85], tile: look.wallTile });
    }
    const rubble = [at(-hw, h * 0.22, -hd), at(hw, h * 0.18, -hd), at(hw, h * 0.26, hd), at(-hw, h * 0.2, hd)];
    writer.quad(rubble[0], rubble[1], rubble[2], rubble[3], look.roof, { want: UP, tile: DETAIL.earth });
  } else if (block.roof === "gable") {
    const alongW = block.ridge === "w";
    const span = alongW ? hd : hw;
    const length = alongW ? hw : hd;
    const rise = h + block.roofHeight;
    const eave = h - o * (block.roofHeight / span);
    const reach = length + o * 0.6;
    const P = (along, across, height) => (alongW ? at(along, height, across) : at(across, height, along));
    [-1, 1].forEach((hand) => {
      const e0 = P(-reach, hand * (span + o), eave);
      const e1 = P(reach, hand * (span + o), eave);
      const r1 = P(reach, 0, rise);
      const r0 = P(-reach, 0, rise);
      writer.quad(e0, e1, r1, r0, look.roof, { want: UP, shades: [0.86, 0.86, 1.04, 1.04], tile: look.roofTile });
      writer.quad(e0, e1, r1, r0, look.roof, { want: DOWN, shades: [0.38, 0.38, 0.38, 0.38], tile: look.roofTile });
      const g0 = P(hand * length, -span, h);
      const g1 = P(hand * length, span, h);
      writer.tri(g0, g1, P(hand * length, 0, rise), look.wall, { want: alongW ? dir(hand, 0) : dir(0, hand), tile: look.wallTile });
    });
  } else if (block.role === "chimney") {
    // A tapering round chimney.
    const sides = 12;
    const base = Math.min(hw, hd) * 1.1;
    const ring = (radius, height) => Array.from({ length: sides }, (_item, index) => {
      const angle = (index / sides) * Math.PI * 2;
      return at(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
    });
    const lower = ring(base, -0.5);
    const upper = ring(base * 0.6, h);
    for (let side = 0; side < sides; side += 1) {
      const next = (side + 1) % sides;
      writer.quad(lower[side], lower[next], upper[next], upper[side], look.wall, { want: v(lower[side].x - block.x, 0, lower[side].z - block.z), shades: [0.7, 0.7, 1, 1], tile: look.wallTile });
    }
    const crown = ring(base * 0.7, h + 0.6);
    for (let side = 0; side < sides; side += 1) {
      const next = (side + 1) % sides;
      writer.quad(upper[side], upper[next], crown[next], crown[side], look.wall, { want: v(upper[side].x - block.x, 0, upper[side].z - block.z), tile: look.wallTile });
    }
  } else if (block.roof === "sawtooth") {
    // Teeth across the hall: a glazed upright face, a slope behind it.
    const teeth = Math.max(2, Math.round(block.d / 6));
    const glass = colour(0x3b4145);
    for (let tooth = 0; tooth < teeth; tooth += 1) {
      const z0 = -hd + (tooth * block.d) / teeth;
      const z1 = z0 + block.d / teeth;
      const peak = h + block.roofHeight;
      writer.quad(at(-hw, h, z0), at(hw, h, z0), at(hw, peak, z1), at(-hw, peak, z1), look.roof, { want: UP, tile: look.roofTile });
      writer.quad(at(hw, h, z1), at(-hw, h, z1), at(-hw, peak, z1), at(hw, peak, z1), glass, { want: dir(0, 1) });
      [-1, 1].forEach((hand) => writer.tri(at(hand * hw, h, z0), at(hand * hw, h, z1), at(hand * hw, peak, z1), look.wall, { want: dir(hand, 0), tile: look.wallTile }));
    }
  } else if (block.roof === "onion") {
    // A baroque dome: a bulb, a neck, a lantern, a small bulb and a spire,
    // turned round the tower's axis; the tower's top covered under it.
    writer.quad(top[0], top[1], top[2], top[3], look.roof, { want: UP, tile: look.roofTile });
    const sides = 14;
    const r0 = Math.min(hw, hd);
    const profile = [[1, 0], [1.18, 0.16], [1.02, 0.3], [0.42, 0.46], [0.3, 0.52], [0.36, 0.58], [0.36, 0.66], [0.28, 0.7], [0.24, 0.78], [0.12, 0.84], [0, 1]];
    const rings = profile.map(([share, rise]) => Array.from({ length: sides }, (_item, index) => {
      const angle = (index / sides) * Math.PI * 2;
      return at(Math.cos(angle) * r0 * share, h + block.roofHeight * rise, Math.sin(angle) * r0 * share);
    }));
    for (let ring = 0; ring < rings.length - 1; ring += 1) {
      for (let side = 0; side < sides; side += 1) {
        const next = (side + 1) % sides;
        const lower = rings[ring];
        const upper = rings[ring + 1];
        const out = v(lower[side].x - block.x, 0, lower[side].z - block.z);
        const shade = 0.85 + 0.2 * (ring / rings.length);
        writer.quad(lower[side], lower[next], upper[next], upper[side], look.roof, { want: out.lengthSq() > 1e-9 ? out.add(v(0, 0.3, 0)) : UP, shades: [shade, shade, shade + 0.05, shade + 0.05] });
      }
    }
  } else if (block.roof === "pyramid") {
    const eave = h - o * (block.roofHeight / Math.min(hw, hd));
    const eaves = [at(-hw - o, eave, -hd - o), at(hw + o, eave, -hd - o), at(hw + o, eave, hd + o), at(-hw - o, eave, hd + o)];
    const apex = at(0, h + block.roofHeight, 0);
    for (let side = 0; side < 4; side += 1) {
      writer.tri(eaves[side], eaves[(side + 1) % 4], apex, look.roof, { want: UP, shades: [0.86, 0.86, 1.04], tile: look.roofTile });
    }
    writer.quad(eaves[0], eaves[1], eaves[2], eaves[3], look.roof, { want: DOWN, shades: [0.38, 0.38, 0.38, 0.38], tile: look.roofTile });
  } else {
    writer.quad(top[0], top[1], top[2], top[3], look.flatTop ?? look.wall, { want: UP, shades: [1.05, 1.05, 1.05, 1.05], tile: look.roofTile ?? look.wallTile });
  }

  // Doors and windows: dark panes just in front of the wall.
  const opening = (side, u, y0, width, height) => {
    const off = 0.06;
    const P = (along, ly) => (side === 0 ? at(along, ly, -hd - off)
      : side === 2 ? at(along, ly, hd + off)
        : side === 1 ? at(hw + off, ly, along) : at(-hw - off, ly, along));
    writer.quad(P(u - width / 2, y0), P(u + width / 2, y0), P(u + width / 2, y0 + height), P(u - width / 2, y0 + height), look.opening, { want: outward[side] });
  };
  switch (look.openings) {
    case "cottage": {
      opening(0, 0, 0, 1, Math.min(1.9, h * 0.75));
      [0, 2].forEach((side) => [-1, 1].forEach((hand) => opening(side, hand * hw * 0.55, h * 0.42, 0.55, 0.45)));
      if (h > 2.4) [1, 3].forEach((side) => opening(side, 0, h * 0.5, 0.5, 0.45));
      break;
    }
    case "townhouse": {
      const floors = Math.max(1, Math.floor((h - 0.4) / 2.6));
      const columns = Math.max(1, Math.floor(block.w / 2.1));
      [0, 2].forEach((side) => {
        for (let floor = 0; floor < floors; floor += 1) {
          for (let column = 0; column < columns; column += 1) {
            const u = -hw + ((column + 0.5) * block.w) / columns;
            if (floor === 0 && column === Math.floor(columns / 2)) opening(side, u, 0, 1.2, 2.2);
            else opening(side, u, 0.9 + floor * 2.6, 0.75, 1.1);
          }
        }
      });
      break;
    }
    case "church":
    case "chapel": {
      const tall = look.openings === "church";
      const count = Math.max(2, Math.floor(block.d / 4.5));
      [1, 3].forEach((side) => {
        for (let index = 0; index < count; index += 1) {
          const u = -hd + ((index + 0.5) * block.d) / count;
          if (tall) opening(side, u, h * 0.25, 0.9, Math.min(3.6, h * 0.5));
          else opening(side, u, h * 0.45, 0.5, 0.8);
        }
      });
      opening(1, -hd * 0.55, 0, tall ? 1.6 : 1.1, Math.min(tall ? 3.2 : 2.1, h * 0.55));
      if (tall) opening(2, 0, h * 0.3, 1.4, Math.min(4.5, h * 0.6));
      break;
    }
    case "factory": {
      // Rows of tall windows along the long sides.
      const count = Math.max(2, Math.floor(block.w / 4));
      [0, 2].forEach((side) => {
        for (let index = 0; index < count; index += 1) opening(side, -hw + ((index + 0.5) * block.w) / count, 1.5, 1.8, Math.min(4, h * 0.55));
      });
      opening(1, 0, 0, 4, 4.2);
      break;
    }
    case "tower": {
      for (let side = 0; side < 4; side += 1) opening(side, 0, h * 0.72, 0.45, Math.min(1.3, h * 0.12));
      break;
    }
    case "barn": {
      // Wide gates on the long sides, a few small windows.
      const long = block.w >= block.d;
      const sides = long ? [0, 2] : [1, 3];
      const length = long ? block.w : block.d;
      const gates = Math.max(1, Math.round(length / 22));
      sides.forEach((side) => {
        for (let index = 0; index < gates; index += 1) opening(side, -length / 2 + ((index + 0.5) * length) / gates, 0, 3.2, Math.min(3.4, h * 0.8));
      });
      break;
    }
    default:
  }
}

// A polygon ([[x, z], ...]) on the ground as triangles: [[a, b, c], ...]
// of its points.
export function triangulateGround(polygon) {
  const contour = polygon.map(([x, z]) => new THREE.Vector2(x, z));
  if (THREE.ShapeUtils.isClockWise(contour)) contour.reverse();
  const points = contour.map((point) => [point.x, point.y]);
  return THREE.ShapeUtils.triangulateShape(contour, []).map((face) => face.map((index) => points[index]));
}

// A box (merlons).
function writeBox(writer, cx, cz, angle, hw, hd, y0, y1, color, tile = DETAIL.brick) {
  writeDetailedBlock(writer, { x: cx, z: cz, w: hw * 2, d: hd * 2, h: y1 - y0, angle, roof: "none" }, y0, {
    wall: color, roof: color, overhang: 0, openings: null, opening: color, wallTile: tile, roofTile: tile,
  });
}

// A town wall with merlons, or a palisade with pointed stakes.
function writeWall(writer, segment, height, look) {
  const x = (segment.ax + segment.bx) / 2;
  const z = (segment.az + segment.bz) / 2;
  const length = Math.hypot(segment.bx - segment.ax, segment.bz - segment.az) + segment.t;
  const angle = Math.atan2(segment.bz - segment.az, segment.bx - segment.ax);
  const y = height(x, z);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const at = (lx, ly, lz) => v(x + lx * cos - lz * sin, y + ly, z + lx * sin + lz * cos);
  if (segment.kind === "rampart") {
    // An earthen rampart: faced slopes (a steep scarp outside, a gentler one
    // inside), grass on its broad top.
    const half = length / 2;
    const foot = segment.t / 2;
    const crown = segment.t / 4;
    const h = segment.h;
    const corners = (lz, ly) => [at(-half, ly, lz), at(half, ly, lz)];
    const [outFoot0, outFoot1] = corners(-foot, -0.5);
    const [outTop0, outTop1] = corners(-crown, h);
    const [inTop0, inTop1] = corners(crown, h);
    const [inFoot0, inFoot1] = corners(foot * 1.4, -0.5);
    const side = (lz) => v(-sin * lz, 0, cos * lz);
    writer.quad(outFoot0, outFoot1, outTop1, outTop0, look.wall, { want: side(-1).add(v(0, 0.3, 0)), shades: [0.7, 0.7, 1, 1], tile: look.wallTile });
    writer.quad(outTop0, outTop1, inTop1, inTop0, look.top || look.wall, { want: UP, tile: DETAIL.grass });
    writer.quad(inTop0, inTop1, inFoot1, inFoot0, look.top || look.wall, { want: side(1).add(v(0, 0.6, 0)), shades: [1, 1, 0.8, 0.8], tile: DETAIL.grass });
    // The ends, where a gate or a bastion's point breaks it.
    [[-half, -1], [half, 1]].forEach(([lx, hand]) => {
      writer.quad(at(lx, -0.5, -foot), at(lx, h, -crown), at(lx, h, crown), at(lx, -0.5, foot * 1.4), look.wall, { want: v(cos * hand, 0, sin * hand), tile: look.wallTile });
    });
    return;
  }
  writeDetailedBlock(writer, { x, z, w: length, d: segment.t, h: segment.h, angle, roof: "none" }, y, look);
  if (segment.kind === "masonry") {
    for (let along = -length / 2 + 0.6; along < length / 2 - 0.6; along += 2.2) {
      writeBox(writer, x + (along + 0.5) * cos, z + (along + 0.5) * sin, angle, 0.5, segment.t / 2, y + segment.h - 0.05, y + segment.h + 0.9, look.wall, look.wallTile);
    }
    return;
  }
  // Stakes: teeth on both faces.
  const tooth = 0.45;
  for (let along = -length / 2; along < length / 2 - tooth / 2; along += tooth) {
    [-1, 1].forEach((hand) => {
      const lz = (hand * segment.t) / 2;
      writer.tri(at(along, segment.h, lz), at(along + tooth, segment.h, lz), at(along + tooth / 2, segment.h + 0.5, lz), look.wall, { want: v(-sin * hand, 0, cos * hand), tile: look.wallTile });
    });
  }
}

// A tree: a trunk under an irregular crown, its colour its own.
// `simple`: far away (deep in the haze), fewer sides and tiers.
function writeDetailedTree(writer, tree, y, season, { simple = false } = {}) {
  // A cypress is a slender conifer; an olive an evergreen broadleaf.
  const conifer = tree.kind === "conifer" || tree.kind === "cypress";
  const bare = tree.kind === "broadleaf" && season === "winter";
  const sides = simple ? 5 : conifer ? 7 : 8;
  const palette = (FOLIAGE[tree.kind] || FOLIAGE[conifer ? "conifer" : "broadleaf"])[season];
  const color = vary(choose(palette, surroundingsHash(tree.x, tree.z, 9)), tree.x, tree.z, 1.5);
  const trunk = colour(BUILT.trunk);
  const radius = tree.r * (bare ? 0.75 : 1);
  const turn = surroundingsHash(tree.x, tree.z, 8) * Math.PI * 2;
  // Each corner of a ring its own distance out: an irregular outline.
  const ring = (share, height, key) => Array.from({ length: sides }, (_item, index) => {
    const angle = turn + (index / sides) * Math.PI * 2;
    const wobble = 0.82 + 0.36 * surroundingsHash(tree.x + index, tree.z, key);
    return v(tree.x + Math.cos(angle) * radius * share * wobble, y + tree.h * height, tree.z + Math.sin(angle) * radius * share * wobble);
  });
  // In the wind: the crown more than the trunk, the top most.
  const sway = { base: y + tree.h * 0.1, rate: 0.5 / (tree.h * tree.h), phase: surroundingsHash(tree.x, tree.z, 10) * 6.28 };
  const leaves = bare ? 0 : DETAIL.leaves;
  const band = (lower, upper, tone, shades, tile = leaves) => {
    for (let side = 0; side < sides; side += 1) {
      const next = (side + 1) % sides;
      writer.quad(lower[side], lower[next], upper[next], upper[side], tone, { want: v(lower[side].x - tree.x, 0, lower[side].z - tree.z), shades, sway, tile });
    }
  };
  const cap = (points, tip, tone, want, shades) => {
    for (let side = 0; side < sides; side += 1) writer.tri(points[side], points[(side + 1) % sides], tip, tone, { want, shades, sway, tile: leaves });
  };
  const crownFrom = tree.kind === "cypress" ? 0.06 : conifer ? 0.12 : tree.kind === "olive" ? 0.36 : 0.28;
  band(ring(0.07, -0.03, 1), ring(0.07, crownFrom + 0.06, 1), trunk, [0.7, 0.7, 1, 1], 0);
  const apex = v(tree.x, y + tree.h, tree.z);
  if (conifer && simple) {
    const lower = ring(1, crownFrom, 2);
    cap(lower, apex, color, UP, [0.75, 0.75, 1.05]);
    return;
  }
  if (simple) {
    const widest = ring(1, 0.5, 5);
    cap(widest, v(tree.x, y + tree.h * crownFrom, tree.z), color, DOWN, [0.55, 0.55, 0.55]);
    cap(widest, apex, color, UP, [0.85, 0.85, 1.08]);
    return;
  }
  if (conifer) {
    // Two tiers, the lower wider.
    const lower = ring(1, crownFrom, 2);
    const middle = ring(0.62, 0.55, 3);
    const middleInner = ring(0.42, 0.55, 3);
    band(lower, middle, color, [0.72, 0.72, 0.95, 0.95]);
    cap(lower, v(tree.x, y + tree.h * crownFrom, tree.z), color, DOWN, [0.5, 0.5, 0.5]);
    band(middleInner, ring(0.62, 0.5, 3), color, [0.8, 0.8, 0.8, 0.8]);
    cap(middleInner, apex, color, UP, [0.85, 0.85, 1.08]);
    return;
  }
  const lower = ring(0.72, crownFrom, 4);
  const widest = ring(1, 0.55, 5);
  const upper = ring(0.66, 0.85, 6);
  // Lit from above: darker underneath (baked).
  cap(lower, v(tree.x, y + tree.h * (crownFrom - 0.05), tree.z), color, DOWN, [0.5, 0.5, 0.5]);
  band(lower, widest, color, [0.62, 0.62, 0.9, 0.9]);
  band(widest, upper, color, [0.9, 0.9, 1.02, 1.02]);
  cap(upper, apex, color, UP, [1.02, 1.02, 1.1]);
}

// A haystack: a rounded cone.
function writeHaystack(writer, x, z, y, h, color) {
  const sides = 8;
  const ring = (radius, at) => Array.from({ length: sides }, (_item, index) => {
    const angle = (index / sides) * Math.PI * 2;
    return v(x + Math.cos(angle) * radius, y + at, z + Math.sin(angle) * radius);
  });
  const foot = ring(1.4, -0.3);
  const shoulder = ring(1.15, h * 0.55);
  const apex = v(x, y + h, z);
  for (let side = 0; side < sides; side += 1) {
    const next = (side + 1) % sides;
    const out = v(foot[side].x - x, 0, foot[side].z - z);
    writer.quad(foot[side], foot[next], shoulder[next], shoulder[side], color, { want: out, shades: [0.7, 0.7, 0.98, 0.98], tile: DETAIL.thatch });
    writer.tri(shoulder[side], shoulder[next], apex, color, { want: UP, shades: [0.98, 0.98, 1.08], tile: DETAIL.thatch });
  }
}

// The lowest ground under a block's corners: on a slope it stands on the
// low side, its uphill side in the ground.
export function surroundingsBlockFoot(layout, block) {
  const cos = Math.cos(block.angle);
  const sin = Math.sin(block.angle);
  const hw = block.w / 2;
  const hd = block.d / 2;
  return Math.min(...[[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd], [0, 0]].map(([lx, lz]) => (
    surroundingsTerrainHeight(layout, block.x + lx * cos - lz * sin, block.z + lx * sin + lz * cos)
  )));
}

const WATER = { spring: 0x4a6870, summer: 0x3f5f68, autumn: 0x4d5f60, winter: 0xcad8de };
// How far past the water's edge its surface reaches: to where the bank
// rises above it (surroundings-rules.js: the bed's slope).
const WATER_REACH = 2.8;

/**
 * The water (a river, a moat) as one mesh, or null: flat at the water's
 * level, out to where the banks rise above it.
 *   realistic   its colour of the season and, with `uniforms`, ripples
 *               (ice in winter); else pale
 */
export function buildSurroundingsWater(layout, { realistic = false, uniforms = null, fade = () => 1, tint = null } = {}) {
  const water = layout.water;
  if (!water || (!water.river && !water.moat && !hasSurroundingsGridWater(layout))) return null;
  const winter = layout.params.season === "winter";
  const writer = createSurroundingsWriter(fade, tint);
  const color = colour(realistic ? WATER[layout.params.season] : 0xb5c3cb);
  const level = (x, z) => surroundingsWaterLevel(layout, x, z);
  const rim = layout.extent * 1.2;
  if (water.river) {
    const half = water.river.width / 2 + WATER_REACH;
    const points = [];
    water.river.points.forEach(([x, z], index) => {
      if (index === water.river.points.length - 1) return;
      const [nx, nz] = water.river.points[index + 1];
      for (let step = 0; step < 2; step += 1) points.push([x + ((nx - x) * step) / 2, z + ((nz - z) * step) / 2]);
    });
    const edges = points.map(([x, z], index) => {
      const [px, pz] = points[Math.max(index - 1, 0)];
      const [nx, nz] = points[Math.min(index + 1, points.length - 1)];
      const length = Math.hypot(nx - px, nz - pz) || 1;
      const ox = (-(nz - pz) / length) * half;
      const oz = ((nx - px) / length) * half;
      return [v(x + ox, level(x, z), z + oz), v(x - ox, level(x, z), z - oz), Math.hypot(x, z) < rim];
    });
    for (let index = 0; index < edges.length - 1; index += 1) {
      if (!edges[index][2] && !edges[index + 1][2]) continue;
      writer.quad(edges[index][0], edges[index + 1][0], edges[index + 1][1], edges[index][1], color, { want: UP });
    }
  }
  if (water.moat) {
    const segments = 96;
    const inner = Math.max(water.moat.inner - WATER_REACH, 0.5);
    const outer = water.moat.outer + WATER_REACH;
    const at = (radius, index) => {
      const angle = (index / segments) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      return v(x, level(x, z), z);
    };
    for (let index = 0; index < segments; index += 1) {
      writer.quad(at(inner, index), at(outer, index), at(outer, index + 1), at(inner, index + 1), color, { want: UP });
    }
  }
  if (hasSurroundingsGridWater(layout)) {
    // The real water, a port's sea, ponds: cells of a grid where it
    // reaches, each row's cells joined into runs.
    const cell = 5;
    const span = Math.ceil(rim / cell);
    for (let row = -span; row < span; row += 1) {
      const z0 = row * cell;
      const z1 = z0 + cell;
      let start = null;
      for (let column = -span; column <= span; column += 1) {
        const x = column * cell;
        const inside = column < span && Math.hypot(x + cell / 2, z0 + cell / 2) < rim
          && surroundingsGridWaterDistance(layout, x + cell / 2, z0 + cell / 2) < WATER_REACH + cell * 0.71;
        if (inside && start == null) start = x;
        if (!inside && start != null) {
          writer.quad(v(start, level(start, z0), z0), v(x, level(x, z0), z0), v(x, level(x, z1), z1), v(start, level(start, z1), z1), color, { want: UP });
          start = null;
        }
      }
    }
  }
  const material = realistic
    ? createSurroundingsMaterial({ transparent: true, opacity: winter ? 0.97 : 0.88, roughness: winter ? 0.35 : 0.06, uniforms, water: !winter })
    : createSurroundingsMaterial({ roughness: 0.6 });
  const mesh = new THREE.Mesh(writer.geometry(), material);
  mesh.name = "surroundings-water";
  // Before the shadows (transparent, drawn by renderOrder).
  mesh.renderOrder = -2.5;
  return mesh;
}

// A timber bridge: a deck and two railings.
function writeBridge(writer, bridge, layout, color) {
  const ground = surroundingsGroundHeight(layout, bridge.x, bridge.z);
  writeBox(writer, bridge.x, bridge.z, bridge.angle, bridge.length / 2, bridge.width / 2, ground + 0.3, ground + 0.75, color, DETAIL.planks);
  [-1, 1].forEach((hand) => {
    const offset = (bridge.width / 2 - 0.1) * hand;
    writeBox(writer, bridge.x - Math.sin(bridge.angle) * offset, bridge.z + Math.cos(bridge.angle) * offset, bridge.angle, bridge.length / 2, 0.08, ground + 0.75, ground + 1.75, color, DETAIL.planks);
  });
}

// ---- cast shadows -----------------------------------------------------------------

// The convex hull of [x, z] points, counter-clockwise (Andrew's).
function convexHull(points) {
  const sorted = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (sorted.length < 3) return sorted;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  sorted.forEach((point) => {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop();
    lower.push(point);
  });
  const upper = [];
  sorted.slice().reverse().forEach((point) => {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop();
    upper.push(point);
  });
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/**
 * The shadows of `casters` ([{ y, points: [x, y, z, ...], slope }]: what
 * stands on the ground at height y, the ground's slope under it [x0, z0,
 * dh/dx, dh/dz]) for light travelling along `direction`, projected onto
 * the ground: each a dark polygon with a soft rim, laid on the slope. Written into
 * `geometry` (position, color with alpha). Overlapping shadows do not
 * darken twice: they lie at one height and the material draws only the
 * nearer of equal depths. `skipWithin`: casters standing nearer than this
 * (metres from the model) are left to the sun's shadow map.
 */
export function buildSurroundingsShadows(casters, direction, strength, geometry = new THREE.BufferGeometry(), { skipWithin = 0 } = {}) {
  const cores = [];
  const rims = [];
  if (direction.y < -0.02 && strength > 0) {
    let dx = direction.x / -direction.y;
    let dz = direction.z / -direction.y;
    // A low sun: at most six times as long as high.
    const reach = Math.hypot(dx, dz);
    if (reach > 6) {
      dx *= 6 / reach;
      dz *= 6 / reach;
    }
    const soft = 0.9;
    casters.forEach((caster) => {
      // Near the model the sun's shadow map draws them (cast and taken).
      if (skipWithin > 0 && Math.hypot(caster.points[0], caster.points[2]) < skipWithin) return;
      const projected = [];
      for (let index = 0; index < caster.points.length; index += 3) {
        const above = Math.max(0, caster.points[index + 1] - caster.y);
        projected.push([caster.points[index] + dx * above, caster.points[index + 2] + dz * above]);
      }
      const hull = convexHull(projected);
      if (hull.length < 3) return;
      const [x0, z0, gx, gz] = caster.slope || [0, 0, 0, 0];
      const lift = (x, z) => caster.y + 0.55 + gx * (x - x0) + gz * (z - z0);
      const cx = hull.reduce((sum, point) => sum + point[0], 0) / hull.length;
      const cz = hull.reduce((sum, point) => sum + point[1], 0) / hull.length;
      for (let index = 1; index < hull.length - 1; index += 1) {
        [hull[0], hull[index], hull[index + 1]].forEach(([x, z]) => cores.push(x, lift(x, z), z, strength));
      }
      const out = hull.map(([x, z]) => {
        const length = Math.hypot(x - cx, z - cz) || 1;
        return [x + ((x - cx) / length) * soft, z + ((z - cz) / length) * soft];
      });
      hull.forEach((point, index) => {
        const next = (index + 1) % hull.length;
        const quad = [[point, strength], [hull[next], strength], [out[next], 0], [point, strength], [out[next], 0], [out[index], 0]];
        quad.forEach(([[x, z], alpha]) => rims.push(x, lift(x, z), z, alpha));
      });
    });
  }
  // Cores first: a rim drawn first would keep a neighbour's core out.
  const all = cores.concat(rims);
  const count = all.length / 4;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 4);
  for (let index = 0; index < count; index += 1) {
    positions[index * 3] = all[index * 4];
    positions[index * 3 + 1] = all[index * 4 + 1];
    positions[index * 3 + 2] = all[index * 4 + 2];
    colors[index * 4 + 3] = all[index * 4 + 3];
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 4));
  geometry.computeBoundingSphere();
  return geometry;
}

// ---- smoke ------------------------------------------------------------------------

/**
 * Smoke rising from roofs and drifting with the wind: points of a shader
 * that moves them by the time (uniforms.surroundingsTime). `sources`: [x,
 * y, z] where it leaves the roof. editor/surroundings.js sets smokeWind
 * (metres a second), smokeScale (pixels per unit at distance 1) and
 * smokeUnit (the group's scale).
 */
export function createSurroundingsSmoke(sources, uniforms, { winter = false } = {}) {
  if (!sources.length || !uniforms) return null;
  const perSource = 16;
  const positions = new Float32Array(sources.length * perSource * 3);
  const seeds = new Float32Array(sources.length * perSource * 2);
  sources.forEach(([x, y, z], source) => {
    for (let index = 0; index < perSource; index += 1) {
      const at = source * perSource + index;
      positions.set([x, y, z], at * 3);
      seeds.set([index / perSource + surroundingsHash(x, z, index) * 0.05, surroundingsHash(z, x, index)], at * 2);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("smokeSeed", new THREE.BufferAttribute(seeds, 2));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      surroundingsTime: uniforms.surroundingsTime,
      smokeWind: uniforms.smokeWind,
      smokeScale: uniforms.smokeScale,
      smokeUnit: uniforms.smokeUnit,
      smokeColor: { value: colour(winter ? 0xd9d7d3 : 0xc6c1b8) },
    },
    vertexShader: `#include <common>
#include <logdepthbuf_pars_vertex>
attribute vec2 smokeSeed;
uniform float surroundingsTime;
uniform vec2 smokeWind;
uniform float smokeScale;
uniform float smokeUnit;
varying float vSmokeAlpha;
void main() {
  float life = 10.0;
  float age = fract( surroundingsTime / life + smokeSeed.x );
  float t = age * life;
  vec3 p = position;
  p.y += t * 0.9 + t * t * 0.02;
  p.xz += smokeWind * t * ( 0.3 + age ) + vec2( sin( smokeSeed.y * 6.28 + surroundingsTime * 0.5 ), cos( smokeSeed.y * 4.1 + surroundingsTime * 0.4 ) ) * age * 1.5;
  vec4 mv = modelViewMatrix * vec4( p, 1.0 );
  gl_Position = projectionMatrix * mv;
  gl_PointSize = ( 0.8 + age * 5.0 ) * smokeUnit * smokeScale / max( -mv.z, 0.001 );
  vSmokeAlpha = smoothstep( 0.0, 0.08, age ) * ( 1.0 - age ) * 0.5;
  #include <logdepthbuf_vertex>
}`,
    fragmentShader: `#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 smokeColor;
varying float vSmokeAlpha;
void main() {
  #include <logdepthbuf_fragment>
  vec2 c = gl_PointCoord - 0.5;
  float d = dot( c, c ) * 4.0;
  if ( d > 1.0 ) discard;
  gl_FragColor = vec4( smokeColor, vSmokeAlpha * ( 1.0 - d ) * ( 1.0 - d ) );
  #include <colorspace_fragment>
}`,
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.name = "surroundings-smoke";
  points.renderOrder = 5;
  return points;
}

/**
 * The layout drawn realistically: { meshes: [ground, shade, built, water?,
 * smoke?], triangles, farthest, casters } - `farthest` the distance of the
 * horizon's hills in metres, `casters` what casts shadows
 * (buildSurroundingsShadows). With `uniforms` (createSurroundingsUniforms,
 * WebGL) the detail, the wind, ripples and smoke. What stands within
 * `nearRadius` metres of the model is a mesh of its own
 * ("surroundings-near"): the one the sun's shadow map draws (cast and
 * taken), small enough to draw every frame.
 */
/**
 * `detail`: "full", or "light" for phones and weak devices (fewer ground
 * rings, a sparser far wood, no smoke, no haystacks, simpler from nearer).
 * Either way what stands far out (past `lod`, deep in the haze) is drawn
 * simpler: trees with fewer sides, without their soft or cast shadows;
 * houses without doors, windows or eaves.
 */
export function buildRealisticSurroundings(layout, { uniforms = null, nearRadius = 0, detail = "full" } = {}) {
  const params = layout.params;
  const light = detail === "light";
  const lod = layout.extent * (light ? 0.3 : 0.55);
  const far = (x, z) => Math.hypot(x, z) > lod;
  const season = params.season;
  const winter = season === "winter";
  const extent = layout.extent;
  const seed = layout.seed;
  const height = (x, z) => surroundingsTerrainHeight(layout, x, z);
  const med = params.region === "mediterranean";
  const palette = med ? GROUND_MED : GROUND;
  const haze = colour(palette.haze[season]);
  // Aerial perspective: farther colours closer to the haze.
  const tint = (x, z, value) => value.lerp(haze, 0.62 * smoothstep(Math.hypot(x, z), extent * 0.18, extent * 1.6));
  const opaque = () => 1;

  // ---- the ground: one opaque sheet out to the hills
  const ground = createSurroundingsWriter(opaque, tint);
  const meadow = colour(palette.meadow[season]);
  const earth = colour(palette.earth[season]);
  const zone = layout.zone;
  const groundAt = (x, z) => {
    const patches = surroundingsNoise(seed + 11, x / 45, z / 45) * 0.7 + surroundingsNoise(seed + 12, x / 12, z / 12) * 0.3;
    const value = meadow.clone().multiplyScalar(0.86 + 0.26 * patches);
    // Trodden earth in the settlement.
    const trodden = (1 - smoothstep(Math.hypot(x - zone.x, z - zone.z), zone.r * 0.55, zone.r * 1.05)) * (winter ? 0.15 : 0.4);
    return value.lerp(earth, trodden * (0.6 + 0.4 * patches));
  };
  // Rings close together near the model (a moat's banks), wider out.
  const rings = light ? 44 : 72;
  const segments = light ? 96 : 144;
  const rim = extent * 1.2;
  const grid = [];
  for (let ring = 0; ring <= rings; ring += 1) {
    const row = [];
    const radius = rim * (ring / rings) ** 1.6;
    for (let segment = 0; segment <= segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      row.push({ point: v(x, height(x, z), z), color: groundAt(x, z) });
    }
    grid.push(row);
  }
  for (let ring = 0; ring < rings; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const p = grid[ring][segment];
      const q = grid[ring + 1][segment];
      const r = grid[ring + 1][segment + 1];
      const s = grid[ring][segment + 1];
      const tile = winter ? DETAIL.snow : DETAIL.grass;
      if (ring === 0) ground.tri(p.point, q.point, r.point, meadow, { want: UP, colors: [p.color, q.color, r.color], tile });
      else ground.quad(p.point, q.point, r.point, s.point, meadow, { want: UP, colors: [p.color, q.color, r.color, s.color], tile });
    }
  }
  // Fields: crops of the season in furrows along the strip.
  const crops = palette.crops[season];
  const asphalt = colour(winter ? 0xd8d8d8 : 0x6b6d70);
  layout.fields.forEach((field) => {
    // A car park: asphalt.
    if (field.parking) {
      const cos = Math.cos(field.angle);
      const sin = Math.sin(field.angle);
      const corner = (lx, lz) => {
        const x = field.x + lx * cos - lz * sin;
        const z = field.z + lx * sin + lz * cos;
        return v(x, height(x, z) + 0.3, z);
      };
      ground.quad(corner(-field.w / 2, -field.d / 2), corner(field.w / 2, -field.d / 2), corner(field.w / 2, field.d / 2), corner(-field.w / 2, field.d / 2), asphalt, { want: UP, tile: winter ? DETAIL.snow : DETAIL.earth });
      return;
    }
    // An old map's field: its own outline.
    if (field.polygon) {
      const crop = vary(crops[field.tone], field.x, field.z, 1.2);
      triangulateGround(field.polygon).forEach((face) => {
        const [a, b, c] = face.map(([x, z]) => v(x, height(x, z) + 0.2, z));
        ground.tri(a, b, c, crop, { want: UP, tile: winter ? DETAIL.snow : DETAIL.crops });
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
    const crop = vary(crops[field.tone], field.x, field.z, 1.2);
    const hw = field.w / 2;
    const furrows = 4;
    for (let index = 0; index < furrows; index += 1) {
      const z0 = -field.d / 2 + (index * field.d) / furrows;
      const z1 = z0 + field.d / furrows;
      const shade = index % 2 ? 0.9 : 1;
      // Split along the length too, so the haze grades along the strip.
      for (let part = 0; part < 4; part += 1) {
        const x0 = -hw + (part * field.w) / 4;
        const x1 = x0 + field.w / 4;
        ground.quad(corner(x0, z0), corner(x1, z0), corner(x1, z1), corner(x0, z1), crop, { want: UP, shades: [shade, shade, shade, shade], tile: winter ? DETAIL.snow : DETAIL.crops });
      }
    }
  });
  // Roads: earth, and a strip of grass between the ruts of the lesser ones.
  const road = colour(winter ? 0xd2cfc9 : 0x8f7a5e);
  const strip = (points, half, lift, tone, tile) => {
    const edges = points.map(([x, z], index) => {
      const [px, pz] = points[Math.max(index - 1, 0)];
      const [nx, nz] = points[Math.min(index + 1, points.length - 1)];
      const length = Math.hypot(nx - px, nz - pz) || 1;
      const ox = (-(nz - pz) / length) * half;
      const oz = ((nx - px) / length) * half;
      return [v(x + ox, height(x + ox, z + oz) + lift, z + oz), v(x - ox, height(x - ox, z - oz) + lift, z - oz)];
    });
    for (let index = 0; index < edges.length - 1; index += 1) {
      ground.quad(edges[index][0], edges[index + 1][0], edges[index + 1][1], edges[index][1], tone, { want: UP, tile });
    }
  };
  // Roads in pieces of at most 20 m, so they follow the hills and the haze.
  const densify = (points) => points.flatMap(([x, z], index) => {
    if (index === points.length - 1) return [[x, z]];
    const [nx, nz] = points[index + 1];
    const steps = Math.max(1, Math.ceil(Math.hypot(nx - x, nz - z) / 20));
    return Array.from({ length: steps }, (_item, step) => [x + ((nx - x) * step) / steps, z + ((nz - z) * step) / steps]);
  });
  // After 1800 a town's streets are paved.
  const paved = (params.period === "industrial" || params.period === "modern" || params.period === "postwar" || params.period === "contemporary") && (params.kind === "town" || params.kind === "port");
  const cobbles = colour(winter ? 0xcfcdca : 0x8b8781);
  layout.roads.forEach((entry) => {
    const points = densify(entry.points);
    const stone = paved && (entry.boulevard || Math.hypot(points[0][0] - layout.zone.x, points[0][1] - layout.zone.z) < layout.zone.r * 1.3);
    strip(points, entry.width / 2, 0.4, stone ? cobbles : road, winter ? DETAIL.snow : stone ? DETAIL.stone : DETAIL.earth);
    if (entry.width <= 4.5 && !winter && !stone) strip(points, 0.35, 0.45, meadow.clone().lerp(road, 0.3), DETAIL.grass);
  });
  // The railway: a bed of ballast (the rails stand on it, below).
  if (layout.railway) strip(densify(layout.railway.points), 2.6, 0.45, colour(winter ? 0xbdb9b3 : 0x857c71), DETAIL.earth);

  // ---- baked shadows: soft dark patches under what stands, transparent
  const shade = createSurroundingsWriter(opaque, null);
  const black = colour(0x000000);
  const blobRect = (cx, cz, angle, hw, hd, margin, strength) => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const at = (lx, lz) => {
      const x = cx + lx * cos - lz * sin;
      const z = cz + lx * sin + lz * cos;
      return v(x, height(x, z) + 0.5, z);
    };
    const inner = [at(-hw, -hd), at(hw, -hd), at(hw, hd), at(-hw, hd)];
    const outer = [at(-hw - margin, -hd - margin), at(hw + margin, -hd - margin), at(hw + margin, hd + margin), at(-hw - margin, hd + margin)];
    shade.quad(inner[0], inner[1], inner[2], inner[3], black, { want: UP, raw: true, alphas: [strength, strength, strength, strength] });
    for (let side = 0; side < 4; side += 1) {
      const next = (side + 1) % 4;
      shade.quad(outer[side], outer[next], inner[next], inner[side], black, { want: UP, raw: true, alphas: [0, 0, strength, strength] });
    }
  };
  const blobRound = (cx, cz, r, strength) => {
    const sides = 8;
    const center = v(cx, height(cx, cz) + 0.5, cz);
    const ring = (radius) => Array.from({ length: sides }, (_item, index) => {
      const angle = (index / sides) * Math.PI * 2;
      const x = cx + Math.cos(angle) * radius;
      const z = cz + Math.sin(angle) * radius;
      return v(x, height(x, z) + 0.5, z);
    });
    const inner = ring(r * 0.55);
    const outer = ring(r * 1.25);
    for (let side = 0; side < sides; side += 1) {
      const next = (side + 1) % sides;
      shade.tri(center, inner[side], inner[next], black, { want: UP, raw: true, alphas: [strength, strength, strength] });
      shade.quad(outer[side], outer[next], inner[next], inner[side], black, { want: UP, raw: true, alphas: [0, 0, strength, strength] });
    }
  };

  // ---- what stands on the ground; what casts shadows; where smoke rises
  const built = createSurroundingsWriter(opaque, tint);
  const near = createSurroundingsWriter(opaque, tint);
  const writerAt = (x, z) => (nearRadius > 0 && Math.hypot(x, z) < nearRadius ? near : built);
  const casters = [];
  const smoke = [];
  // The ground's slope round a place, over 3 m each way.
  const slope = (x, z) => {
    const gx = (height(x + 3, z) - height(x - 3, z)) / 6;
    const gz = (height(x, z + 3) - height(x, z - 3)) / 6;
    return gx === 0 && gz === 0 ? null : [x, z, gx, gz];
  };
  const smoking = { winter: 0.35, autumn: 0.25, spring: 0.15, summer: 0.08 }[season];
  layout.blocks.forEach((block) => {
    const y = surroundingsBlockFoot(layout, block);
    const look = blockLook(block, params);
    if (far(block.x, block.z)) Object.assign(look, { openings: null, overhang: Math.min(look.overhang, 0.15) });
    writeDetailedBlock(writerAt(block.x, block.z), block, y, look);
    blobRect(block.x, block.z, block.angle, block.w / 2, block.d / 2, Math.min(3, 0.4 * block.h + 0.8), 0.42);
    const cos = Math.cos(block.angle);
    const sin = Math.sin(block.angle);
    const at = (lx, ly, lz) => [block.x + lx * cos - lz * sin, y + ly, block.z + lx * sin + lz * cos];
    const hw = block.w / 2;
    const hd = block.d / 2;
    const points = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].flatMap(([lx, lz]) => [...at(lx, 0, lz), ...at(lx, block.h, lz)]);
    const rise = block.h + (block.roofHeight || 0);
    if (block.roof === "pyramid") points.push(...at(0, rise, 0));
    else if (block.roof === "gable") points.push(...(block.ridge === "w" ? [...at(-hw, rise, 0), ...at(hw, rise, 0)] : [...at(0, rise, -hd), ...at(0, rise, hd)]));
    casters.push({ y, points, slope: slope(block.x, block.z) });
    // Smoke from some houses' roofs (through the thatch, or a chimney).
    if (light) return;
    if (block.role === "house" && surroundingsHash(block.x, block.z, 30) < smoking * (params.period === "industrial" || params.period === "modern" ? 2.5 : 1)) smoke.push(at(0, rise - 0.3, 0));
    // A factory's chimney always smokes, thickly.
    if (block.role === "chimney") for (let puff = 0; puff < 3; puff += 1) smoke.push(at(0, block.h, 0));
  });
  layout.bridges.forEach((bridge) => writeBridge(writerAt(bridge.x, bridge.z), bridge, layout, bridge.railway ? colour(BUILT.slate) : vary(BUILT.palisade, bridge.x, bridge.z, 0.5)));
  // Rails: two lines of steel on the ballast.
  if (layout.railway) {
    const steel = colour(0x4d4b48);
    const points = layout.railway.points;
    for (let index = 0; index < points.length - 1; index += 1) {
      const [ax, az] = points[index];
      const [bx, bz] = points[index + 1];
      const angle = Math.atan2(bz - az, bx - ax);
      const length = Math.hypot(bx - ax, bz - az);
      [-0.75, 0.75].forEach((offset) => {
        const cx = (ax + bx) / 2 - Math.sin(angle) * offset;
        const cz = (az + bz) / 2 + Math.cos(angle) * offset;
        if (Math.hypot(cx, cz) > extent * 1.12) return;
        const y = surroundingsGroundHeight(layout, cx, cz) + 0.5;
        writeBox(writerAt(cx, cz), cx, cz, angle, length / 2 + 0.05, 0.05, y, y + 0.2, steel, 0);
      });
    }
  }
  const early = params.period === "early-medieval";
  layout.walls.forEach((segment) => {
    const masonry = segment.kind === "masonry" || segment.kind === "rampart";
    const look = {
      wall: masonry ? vary(params.masonry === "stone" ? BUILT.stone : BUILT.brick, segment.ax, segment.az, 0.4) : vary(BUILT.palisade, segment.ax, segment.az, 0.6),
      wallTile: masonry ? (params.masonry === "stone" ? DETAIL.stone : DETAIL.brick) : DETAIL.planks,
      // A rampart's grass.
      top: meadow,
      overhang: 0,
      openings: null,
    };
    writeWall(writerAt((segment.ax + segment.bx) / 2, (segment.az + segment.bz) / 2), segment, height, look);
    const top = segment.h + (segment.kind === "masonry" ? 0.9 : segment.kind === "rampart" ? 0 : 0.5);
    const y = height((segment.ax + segment.bx) / 2, (segment.az + segment.bz) / 2);
    casters.push({ y, points: [segment.ax, y, segment.az, segment.bx, y, segment.bz, segment.ax, y + top, segment.az, segment.bx, y + top, segment.bz], slope: slope((segment.ax + segment.bx) / 2, (segment.az + segment.bz) / 2) });
    blobRect((segment.ax + segment.bx) / 2, (segment.az + segment.bz) / 2, Math.atan2(segment.bz - segment.az, segment.bx - segment.ax),
      Math.hypot(segment.bx - segment.ax, segment.bz - segment.az) / 2, segment.t / 2, masonry ? 2.2 : 1.2, 0.35);
  });
  const treeLimit = extent * 1.12;
  layout.trees.forEach((tree) => {
    if (Math.hypot(tree.x, tree.z) > treeLimit) return;
    const y = height(tree.x, tree.z);
    // Far out: simpler, without shadows; on a light device fewer too.
    if (far(tree.x, tree.z)) {
      if (light && surroundingsHash(tree.x, tree.z, 40) < 0.45) return;
      writeDetailedTree(writerAt(tree.x, tree.z), tree, y, season, { simple: true });
      return;
    }
    writeDetailedTree(writerAt(tree.x, tree.z), tree, y, season);
    blobRound(tree.x, tree.z, tree.r, 0.3);
    const conifer = tree.kind === "conifer" || tree.kind === "cypress";
    const radius = tree.r * (tree.kind === "broadleaf" && winter ? 0.75 : 1);
    const crown = [];
    for (let index = 0; index < 6; index += 1) {
      const angle = (index / 6) * Math.PI * 2;
      crown.push(tree.x + Math.cos(angle) * radius, y + tree.h * (conifer ? 0.14 : 0.55), tree.z + Math.sin(angle) * radius);
    }
    casters.push({ y, points: [tree.x, y, tree.z, ...crown, tree.x, y + tree.h, tree.z], slope: slope(tree.x, tree.z) });
  });
  // Haystacks in the fields, once the hay is made.
  if (!light && (season === "summer" || season === "autumn")) {
    layout.fields.forEach((field) => {
      if (field.parking || surroundingsHash(field.x, field.z, 21) > 0.35) return;
      const count = 2 + Math.floor(surroundingsHash(field.x, field.z, 22) * 3);
      for (let index = 0; index < count; index += 1) {
        const along = ((index + 0.5) / count - 0.5) * field.w * 0.8;
        const x = field.x + along * Math.cos(field.angle);
        const z = field.z + along * Math.sin(field.angle);
        const y = height(x, z);
        const tall = early ? 2.4 : 2.9;
        writeHaystack(writerAt(x, z), x, z, y, tall, vary(BUILT.hay, x, z));
        blobRound(x, z, 1.6, 0.3);
        casters.push({ y, points: [x - 1.4, y, z, x + 1.4, y, z, x, y, z - 1.4, x, y, z + 1.4, x, y + tall, z], slope: slope(x, z) });
      }
    });
  }

  // ---- the horizon: low wooded hills beyond the rim, deep in the haze
  const hillHeight = extent * 0.05;
  const hillColor = colour(med ? FOLIAGE.olive.summer[2] : FOLIAGE.conifer.summer[0]).lerp(meadow, med ? 0.55 : 0.35);
  const real = typeof layout.heightfield === "function";
  const realLift = (radius) => (angle) => height(Math.cos(angle) * radius, Math.sin(angle) * radius);
  const rows = real ? [
    { radius: rim * 0.98, lift: (angle) => realLift(rim * 0.98)(angle) - 1 },
    { radius: extent * 1.45, lift: realLift(extent * 1.45) },
    { radius: extent * 1.75, lift: realLift(extent * 1.75) },
  ] : [
    { radius: rim * 0.98, lift: () => -1 },
    { radius: extent * 1.45, lift: (angle) => hillHeight * (0.35 + 0.65 * surroundingsNoise(seed + 31, Math.cos(angle) * 3 + 5, Math.sin(angle) * 3 + 5)) },
    { radius: extent * 1.75, lift: (angle) => hillHeight * 0.3 * surroundingsNoise(seed + 32, Math.cos(angle) * 4 + 9, Math.sin(angle) * 4 + 9) },
  ];
  const hillSegments = 120;
  const hillRows = rows.map((row) => Array.from({ length: hillSegments + 1 }, (_item, index) => {
    const angle = (index / hillSegments) * Math.PI * 2;
    return v(Math.cos(angle) * row.radius, row.lift(angle), Math.sin(angle) * row.radius);
  }));
  for (let row = 0; row < hillRows.length - 1; row += 1) {
    for (let index = 0; index < hillSegments; index += 1) {
      const p = hillRows[row][index];
      const q = hillRows[row + 1][index];
      const r = hillRows[row + 1][index + 1];
      const s = hillRows[row][index + 1];
      built.quad(p, q, r, s, winter ? colour(0xdfe3e6) : hillColor, { want: UP, shades: row === 0 ? [0.95, 1.05, 1.05, 0.95] : [1.05, 1, 1, 1.05], tile: winter ? DETAIL.snow : DETAIL.leaves });
    }
  }

  const meshes = [
    new THREE.Mesh(ground.geometry(), createSurroundingsMaterial({ uniforms })),
    new THREE.Mesh(shade.geometry(), createSurroundingsMaterial({ transparent: true })),
    new THREE.Mesh(built.geometry(), createSurroundingsMaterial({ uniforms })),
  ];
  meshes[0].name = "surroundings-ground";
  meshes[1].name = "surroundings-shade";
  meshes[2].name = "surroundings-built";
  meshes[0].renderOrder = -3;
  meshes[1].renderOrder = -2;
  meshes[2].renderOrder = -2;
  if (near.triangles() > 0) {
    const mesh = new THREE.Mesh(near.geometry(), createSurroundingsMaterial({ uniforms }));
    mesh.name = "surroundings-near";
    mesh.renderOrder = -2;
    meshes.push(mesh);
  }
  const water = buildSurroundingsWater(layout, { realistic: true, uniforms, tint });
  if (water) meshes.push(water);
  const smokeMesh = createSurroundingsSmoke(smoke, uniforms, { winter });
  if (smokeMesh) meshes.push(smokeMesh);
  return {
    meshes,
    triangles: ground.triangles() + shade.triangles() + built.triangles() + near.triangles() + (water ? water.geometry.attributes.position.count / 3 : 0),
    farthest: extent * 1.75,
    casters,
    smokeSources: smoke.length,
  };
}
