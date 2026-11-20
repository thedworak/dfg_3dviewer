// The pagoda's textures, made here from noise - no outside images, so the
// model is entirely the project's own. Every texture tiles (periodic noise),
// so the model repeats them at the scale of scripts/pagoda/pagoda.mjs
// MATERIALS.
//
// The five parts the time travel changes (paint, plaster, roof, bronze,
// door) come in three ages: "fresh" (just built or restored), "mid" and
// "old" - the model's own look, today. Only the colour changes between
// them (the intro swaps the base colour map), so each material's metalness
// and roughness suit all three.
//
// Each texture: { color: Uint8Array RGB, normal?: Uint8Array RGB, size }.

// ------------------------------------------------------------------ noise

function hash(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Periodic noise on a non-square lattice: px cells along u, py along v.
function makeNoise2(seed) {
  const rnd = hash(seed);
  const size = 512;
  const table = new Float32Array(size * size);
  for (let i = 0; i < table.length; i += 1) table[i] = rnd();
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const at = (x, y) => table[y * size + x];
  const one = (x, y, px, py) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = fade(x - xi);
    const fy = fade(y - yi);
    const x0 = ((xi % px) + px) % px;
    const y0 = ((yi % py) + py) % py;
    const x1 = (x0 + 1) % px;
    const y1 = (y0 + 1) % py;
    const a = at(x0 % size, y0 % size);
    const b = at(x1 % size, y0 % size);
    const c = at(x0 % size, y1 % size);
    const d = at(x1 % size, y1 % size);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  // fractal: u, v in [0, 1); px, py integers.
  return (u, v, px, py, octaves = 5, gain = 0.5) => {
    let sum = 0;
    let amp = 1;
    let norm = 0;
    for (let o = 0; o < octaves; o += 1) {
      const fx = px << o;
      const fy = py << o;
      sum += amp * one(u * fx, v * fy, fx, fy);
      norm += amp;
      amp *= gain;
    }
    return sum / norm;
  };
}

// ---------------------------------------------------------------- helpers

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const fract = (x) => x - Math.floor(x);

// Fills a texture: fn(u, v, x, y) -> { c: [r, g, b] in 0..1, h?: height }.
function paint(size, fn, normalStrength = 0) {
  const color = new Uint8Array(size * size * 3);
  const height = normalStrength ? new Float32Array(size * size) : null;
  for (let y = 0; y < size; y += 1) {
    const v = (y + 0.5) / size;
    for (let x = 0; x < size; x += 1) {
      const u = (x + 0.5) / size;
      const out = fn(u, v, x, y);
      const k = (y * size + x) * 3;
      color[k] = Math.round(clamp01(out.c[0]) * 255);
      color[k + 1] = Math.round(clamp01(out.c[1]) * 255);
      color[k + 2] = Math.round(clamp01(out.c[2]) * 255);
      if (height) height[y * size + x] = out.h ?? 0;
    }
  }
  return { color, normal: height ? normalFromHeight(height, size, normalStrength) : null, size };
}

// A tangent-space normal map (glTF: +Y up in the image = +V) from a height
// field, wrapping at the edges.
function normalFromHeight(h, size, strength) {
  const out = new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y += 1) {
    const ym = (y - 1 + size) % size;
    const yp = (y + 1) % size;
    for (let x = 0; x < size; x += 1) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;
      const dx = (h[y * size + xp] - h[y * size + xm]) * strength;
      const dy = (h[yp * size + x] - h[ym * size + x]) * strength;
      // Image rows go down while V goes up in glTF's flipped convention:
      // three reads row 0 as v = 0, so +y in rows is +v.
      let nx = -dx;
      let ny = -dy;
      let nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l;
      ny /= l;
      nz /= l;
      const k = (y * size + x) * 3;
      out[k] = Math.round((nx * 0.5 + 0.5) * 255);
      out[k + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      out[k + 2] = Math.round((nz * 0.5 + 0.5) * 255);
    }
  }
  return out;
}

// Wood grain along u: rings bent by noise. Returns 0..1 (dark lines high).
function grain(n, u, v, rings = 22, plankRows = 1, seedShift = 0) {
  const warp = n(u, v, 2, 8, 3) - 0.5;
  const fine = n(u, v, 16, 64, 2);
  const t = (v + seedShift) * rings + warp * 3.0 + n(u, v, 1, 4, 2) * 2.0;
  const ring = Math.abs(Math.sin(Math.PI * t));
  return clamp01(ring ** 6 * 0.7 + fine * 0.35 - 0.1 + 0 * plankRows);
}

// ------------------------------------------------------------- the textures

// Vermilion paint over wood (pillars, beams, brackets, rafters, railings).
function paintTexture(age, size) {
  const n = makeNoise2(11);
  const nWear = makeNoise2(12);
  const fresh = hex('#c43a26');
  const mid = hex('#b24a30');
  const old = hex('#9e4c34');
  const woodLight = hex('#8a6a4a');
  const woodDark = hex('#4d3a2a');
  const base = age === 'fresh' ? fresh : age === 'mid' ? mid : old;
  return paint(size, (u, v) => {
    const g = grain(n, u, v, 18);
    const cloud = n(u, v, 3, 3, 5);
    let c = mix3(base, mix3(base, [base[0] * 0.8, base[1] * 0.75, base[2] * 0.7], 1), cloud * 0.5);
    // Brush strokes along the grain.
    const strokes = n(u, v, 1, 24, 3);
    c = c.map((x) => x * (0.94 + strokes * 0.1));
    // Grain shows through the paint as it thins.
    const thin = age === 'fresh' ? 0.04 : age === 'mid' ? 0.12 : 0.22;
    c = mix3(c, [c[0] * 0.75, c[1] * 0.7, c[2] * 0.7], g * thin * 2);
    let h = -g * 0.3;
    if (age !== 'fresh') {
      // Worn patches: bare wood where the paint is gone.
      const wear = nWear(u, v, 8, 8, 5);
      const limit = age === 'mid' ? 0.8 : 0.7;
      const bare = smooth(limit, limit + 0.04, wear);
      const wood = mix3(woodLight, woodDark, g);
      const greyed = age === 'old' ? mix3(wood, [0.45, 0.43, 0.4], 0.45) : wood;
      c = mix3(c, greyed, bare);
      h -= bare * 0.5;
      // Chalky fading and dark grime in the hollows.
      const chalk = age === 'old' ? 0.12 : 0.05;
      c = mix3(c, [0.85, 0.66, 0.55], chalk * (1 - bare) * (0.5 + cloud));
      const grime = nWear(u, v, 8, 2, 4);
      c = c.map((x) => x * (1 - (age === 'old' ? 0.25 : 0.12) * smooth(0.45, 0.8, grime)));
    }
    return { c, h };
  }, 3);
}

// Lime plaster walls (and the soffit boards, whitewashed).
function plasterTexture(age, size) {
  const n = makeNoise2(21);
  const n2 = makeNoise2(22);
  return paint(size, (u, v) => {
    const cloud = n(u, v, 4, 4, 6);
    const fine = n(u, v, 32, 32, 2);
    let c = mix3(hex('#f1ede2'), hex('#e3dccb'), cloud * 0.8);
    c = c.map((x) => x * (0.97 + fine * 0.05));
    let h = cloud * 0.4 + fine * 0.15;
    if (age !== 'fresh') {
      // Grey streaks from the top (rain), stronger with age; textures run
      // with v down the wall in the shader's convention.
      const streak = n2(u, v, 24, 1, 3);
      const amount = age === 'mid' ? 0.12 : 0.3;
      c = mix3(c, hex('#8f8c84'), amount * smooth(0.45, 0.85, streak) * (0.6 + cloud * 0.6));
      // Yellowed patches.
      c = mix3(c, hex('#d8c79c'), (age === 'mid' ? 0.15 : 0.3) * smooth(0.5, 0.8, n2(u, v, 3, 3, 4)));
    }
    if (age === 'old') {
      // Spalled patches with the clay under the lime.
      const spall = n2(u, v, 6, 6, 5);
      const bare = smooth(0.76, 0.78, spall);
      c = mix3(c, mix3(hex('#a8835a'), hex('#7d5e3e'), fine), bare);
      h -= bare * 0.6;
      // Hairline cracks.
      const crack = Math.abs(n2(u, v, 5, 5, 4) - 0.5);
      const line = 1 - smooth(0.0, 0.012, crack);
      c = c.map((x) => x * (1 - line * 0.35));
      h -= line * 0.3;
    }
    return { c, h };
  }, 2);
}

// Roof tiles: u across the eaves (four round tiles per repeat, troughs at
// u = 0, 0.25, ...), v up the slope (four courses per repeat).
function roofTexture(age, size) {
  const n = makeNoise2(31);
  const n2 = makeNoise2(32);
  const fresh = hex('#4a5058');
  const mid = hex('#6a6d70');
  const old = hex('#5e605c');
  const base = age === 'fresh' ? fresh : age === 'mid' ? mid : old;
  return paint(size, (u, v) => {
    const col = fract(u * 4);
    const row = fract(v * 4);
    // The courses: each tile's lower edge laps over the next.
    const lap = smooth(0.0, 0.08, row) * (1 - smooth(0.9, 1.0, row) * 0.5);
    const crest = Math.sin(Math.PI * col); // 1 on the round tile
    const tileId = Math.floor(u * 4) + Math.floor(v * 4) * 7;
    const tone = 0.92 + 0.16 * fract(Math.sin(tileId * 12.9898) * 43758.5453);
    const cloud = n(u, v, 4, 4, 5);
    let c = base.map((x) => x * tone * (0.85 + 0.25 * cloud));
    // Darker in the troughs and under the laps (dirt and shade).
    c = c.map((x) => x * (0.72 + 0.28 * crest) * (0.65 + 0.35 * lap));
    // A glaze sheen on the fresh ones.
    if (age === 'fresh') c = c.map((x, i) => x + (i === 2 ? 0.03 : 0.015) * crest);
    let h = crest * 0.6 + lap * 0.5 + cloud * 0.1;
    if (age !== 'fresh') {
      // Lichen: pale and yellow spots on the crests.
      const spots = n2(u, v, 24, 24, 3);
      const lichen = smooth(0.72, 0.76, spots) * (age === 'old' ? 0.7 : 0.35);
      c = mix3(c, mix3(hex('#a9a68a'), hex('#9a925a'), n(u, v, 8, 8, 2)), lichen * 0.6);
      // Moss in the troughs, thick on the old roof.
      const moss = (1 - crest) * smooth(0.4, 0.7, n2(u, v, 6, 6, 5));
      const amount = age === 'old' ? 0.65 : 0.25;
      c = mix3(c, mix3(hex('#3f4c26'), hex('#5a6630'), cloud), moss * amount);
      h += moss * amount * 0.2;
    }
    return { c, h };
  }, 3);
}

// Bronze: gilt when new, brown patina, then verdigris.
function bronzeTexture(age, size) {
  const n = makeNoise2(41);
  const n2 = makeNoise2(42);
  return paint(size, (u, v) => {
    const cloud = n(u, v, 4, 4, 5);
    const fine = n(u, v, 32, 32, 2);
    let c;
    if (age === 'fresh') {
      c = mix3(hex('#d8b26a'), hex('#b8893f'), cloud);
      c = c.map((x) => x * (0.95 + fine * 0.08));
    } else if (age === 'mid') {
      c = mix3(hex('#7a5a36'), hex('#4e3a26'), cloud);
      c = mix3(c, hex('#b08a50'), smooth(0.7, 0.8, n2(u, v, 6, 6, 4)) * 0.6); // gilt left
      c = mix3(c, hex('#6f8f78'), smooth(0.65, 0.85, n2(u, v, 3, 3, 4)) * 0.4);
    } else {
      c = mix3(hex('#5f9c86'), hex('#3f6f60'), cloud);
      c = mix3(c, hex('#8cc0a8'), smooth(0.55, 0.85, fine) * 0.4);
      // Dark streaks and the brown under it.
      const streak = n2(u, v, 18, 2, 3);
      c = mix3(c, hex('#3a3a30'), smooth(0.6, 0.85, streak) * 0.55);
      c = mix3(c, hex('#6a5034'), smooth(0.72, 0.78, n2(u, v, 5, 5, 4)) * 0.7);
    }
    return { c, h: cloud * 0.3 + fine * 0.2 };
  }, 2);
}

// Door planks: grain along u (the long side of a leaf), four planks per
// repeat across v.
function doorTexture(age, size) {
  const n = makeNoise2(51);
  const n2 = makeNoise2(52);
  const tones = age === 'fresh'
    ? [hex('#c9a06a'), hex('#9b7044')]
    : age === 'mid' ? [hex('#8e6440'), hex('#5a3c24')] : [hex('#8a8479'), hex('#56504a')];
  return paint(size, (u, v) => {
    const plank = Math.floor(v * 4);
    const pv = fract(v * 4);
    const g = grain(n, u + plank * 0.37, v, 26, 1, plank * 0.21);
    const tone = 0.9 + 0.2 * fract(Math.sin(plank * 78.233) * 43758.5453);
    let c = mix3(tones[0], tones[1], g).map((x) => x * tone);
    const seam = 1 - smooth(0.0, 0.02, pv) * (1 - smooth(0.98, 1.0, pv));
    c = c.map((x) => x * (1 - seam * 0.6));
    let h = -g * 0.3 - seam;
    if (age === 'old') {
      // Silvered wood, open cracks along the grain.
      const crack = smooth(0.82, 0.9, n2(u, v, 2, 40, 3)) * smooth(0.5, 0.7, n2(u, v, 3, 3, 3));
      c = c.map((x) => x * (1 - crack * 0.55));
      h -= crack * 0.5;
      c = mix3(c, hex('#a29c90'), 0.15 * n(u, v, 3, 3, 4));
    }
    if (age === 'mid') c = mix3(c, hex('#3d2b1e'), 0.2 * smooth(0.5, 0.8, n2(u, v, 4, 4, 4)));
    return { c, h };
  }, 3);
}

// Granite blocks: courses of 0.4 m (four per repeat), blocks 0.8 m long,
// staggered.
function stoneTexture(size) {
  const n = makeNoise2(61);
  const n2 = makeNoise2(62);
  return paint(size, (u, v) => {
    const rows = 4;
    const row = Math.floor(v * rows);
    const ru = u * 2 + (row % 2) * 0.5;
    const block = Math.floor(ru);
    const bu = fract(ru);
    const bv = fract(v * rows);
    const id = block * 13 + row * 7;
    const tone = 0.88 + 0.18 * fract(Math.sin(id * 12.9898) * 43758.5453);
    const speck = n(u, v, 128, 128, 1);
    const cloud = n(u, v, 6, 6, 4);
    let c = mix3(hex('#9c978e'), hex('#7d7870'), cloud).map((x) => x * tone);
    c = mix3(c, speck > 0.62 ? hex('#3c3a37') : speck < 0.3 ? hex('#cfcac0') : c, 0.5);
    const edge = Math.min(bu, 1 - bu, (bv) * 0.5, (1 - bv) * 0.5);
    const joint = 1 - smooth(0.0, 0.012, edge);
    c = mix3(c, hex('#5a5650'), joint * 0.8);
    // Weathered, darker near the bottom of each block, a little lichen.
    c = c.map((x) => x * (0.92 + 0.08 * bv));
    c = mix3(c, hex('#8b8a68'), 0.25 * smooth(0.68, 0.75, n2(u, v, 8, 8, 4)));
    const chip = smooth(0.0, 0.03, edge) * (0.9 + cloud * 0.2);
    return { c, h: chip * 0.8 + cloud * 0.2 + speck * 0.05 };
  }, 4);
}

// Dark natural wood: floors, shutters, the ceilings, the central pillar.
function woodTexture(size) {
  const n = makeNoise2(71);
  return paint(size, (u, v) => {
    const plank = Math.floor(v * 8);
    const pv = fract(v * 8);
    const g = grain(n, u * 1 + plank * 0.53, v * 2, 30, 1, plank * 0.17);
    const tone = 0.85 + 0.25 * fract(Math.sin(plank * 91.7) * 43758.5453);
    let c = mix3(hex('#6b4b30'), hex('#3a2818'), g).map((x) => x * tone);
    const seam = 1 - smooth(0.0, 0.03, pv) * (1 - smooth(0.97, 1.0, pv));
    c = c.map((x) => x * (1 - seam * 0.6));
    return { c, h: -g * 0.25 - seam * 0.8 };
  }, 3);
}

// One coffer of the ceiling: a dark green frame and a painted rosette.
function ceilingTexture(size) {
  const n = makeNoise2(81);
  return paint(size, (u, v) => {
    const x = u - 0.5;
    const y = v - 0.5;
    const edge = Math.max(Math.abs(x), Math.abs(y));
    let c;
    if (edge > 0.44) c = hex('#2f4a3a');
    else if (edge > 0.41) c = hex('#c9a24a'); // gilt fillet
    else {
      const r = Math.hypot(x, y) / 0.41;
      const a = Math.atan2(y, x);
      const petals8 = Math.cos(a * 8);
      const petals4 = Math.cos(a * 4 + Math.PI / 4);
      c = hex('#24476b'); // blue ground
      // Outer leaves (green), petals (red, white edge), centre (gold).
      const leaf = r < 0.92 - 0.12 * (1 - Math.abs(petals4)) && r > 0.55;
      if (leaf) c = mix3(hex('#3f7a52'), hex('#8fc49a'), (r - 0.55) / 0.4);
      const petalR = 0.62 + 0.18 * Math.max(0, petals8);
      if (r < petalR) c = mix3(hex('#d4553f'), hex('#f3e6d0'), smooth(petalR - 0.1, petalR, r));
      if (r < 0.28) c = mix3(hex('#f1c75a'), hex('#b5802c'), r / 0.28);
      if (r < 0.1) c = hex('#e8e0c8');
    }
    const age = n(u, v, 4, 4, 4);
    c = c.map((k) => k * (0.82 + age * 0.22));
    return { c };
  });
}

function lacquerTexture(size) {
  const n = makeNoise2(91);
  return paint(size, (u, v) => {
    const cloud = n(u, v, 3, 3, 5);
    const worn = smooth(0.7, 0.85, n(u, v, 6, 6, 4));
    const c = mix3(mix3(hex('#141110'), hex('#221816'), cloud), hex('#7a2a1c'), worn * 0.6);
    return { c };
  });
}

// Gold leaf in squares (0.1 m) with fine seams.
function goldTexture(size) {
  const n = makeNoise2(101);
  return paint(size, (u, v) => {
    const sq = 8;
    const id = Math.floor(u * sq) + Math.floor(v * sq) * 17;
    const tone = 0.9 + 0.15 * fract(Math.sin(id * 4.1) * 43758.5453);
    const edge = Math.min(fract(u * sq), 1 - fract(u * sq), fract(v * sq), 1 - fract(v * sq));
    const seam = 1 - smooth(0.0, 0.03, edge);
    const cloud = n(u, v, 4, 4, 4);
    let c = mix3(hex('#e9c46a'), hex('#b8892e'), cloud).map((x) => x * tone);
    c = c.map((x) => x * (1 - seam * 0.2));
    c = mix3(c, hex('#5a4020'), 0.3 * smooth(0.7, 0.9, n(u, v, 12, 12, 3)));
    return { c, h: -seam * 0.2 };
  }, 1);
}

// The inside walls: clouds and flowers on a warm ground, faded.
function muralTexture(size) {
  const n = makeNoise2(111);
  const n2 = makeNoise2(112);
  return paint(size, (u, v) => {
    const ground = mix3(hex('#e8dcc0'), hex('#d4c49e'), n(u, v, 4, 4, 5));
    let c = ground;
    // Stylised clouds: bands of noise with outlines.
    const cloud = n2(u, v, 3, 2, 4);
    const band = smooth(0.56, 0.58, cloud);
    const outline = 1 - smooth(0.0, 0.012, Math.abs(cloud - 0.57));
    c = mix3(c, hex('#f4efe4'), band * 0.8);
    c = mix3(c, hex('#4a6f8a'), outline * 0.7);
    // Scattered flowers (red with a gold centre) on a lattice.
    const fu = fract(u * 5 + (Math.floor(v * 4) % 2) * 0.5) - 0.5;
    const fv = fract(v * 4) - 0.5;
    const r = Math.hypot(fu, fv * 1.25);
    const a = Math.atan2(fv, fu);
    const petal = 0.16 + 0.06 * Math.cos(a * 5);
    if (r < petal && band < 0.5) c = mix3(hex('#c4483a'), hex('#e9a090'), r / petal);
    if (r < 0.05 && band < 0.5) c = hex('#d8a83a');
    // Faded and soot-darkened.
    c = mix3(c, ground, 0.25 + 0.2 * n(u, v, 6, 6, 3));
    c = c.map((x) => x * (0.85 + 0.15 * n(u, v, 2, 2, 3)));
    return { c };
  });
}

// What every material gets: { color, normal?, size } and the material's
// PBR factors. ages: the time travel's parts have all three.
export const TEXTURES = {
  paint: { make: paintTexture, ages: true, size: 2048, metallic: 0, roughness: 0.62 },
  plaster: { make: plasterTexture, ages: true, size: 2048, metallic: 0, roughness: 0.9 },
  roof: { make: roofTexture, ages: true, size: 2048, metallic: 0, roughness: 0.55 },
  bronze: { make: bronzeTexture, ages: true, size: 1024, metallic: 0.45, roughness: 0.5 },
  door: { make: doorTexture, ages: true, size: 1024, metallic: 0, roughness: 0.75 },
  stone: { make: stoneTexture, size: 2048, metallic: 0, roughness: 0.85 },
  wood: { make: woodTexture, size: 1024, metallic: 0, roughness: 0.7 },
  ceiling: { make: ceilingTexture, size: 512, metallic: 0, roughness: 0.75 },
  lacquer: { make: lacquerTexture, size: 512, metallic: 0, roughness: 0.25 },
  gold: { make: goldTexture, size: 512, metallic: 1, roughness: 0.3 },
  mural: { make: muralTexture, size: 1024, metallic: 0, roughness: 0.85 },
};

export const AGES = ['fresh', 'mid', 'old'];

// A texture of a material at an age ("old" for the model itself; the
// others have one look).
export function makeTexture(name, age = 'old', size) {
  const spec = TEXTURES[name];
  const px = size || spec.size;
  return spec.ages ? spec.make(age, px) : spec.make(px);
}

