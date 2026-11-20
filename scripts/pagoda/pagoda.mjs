// The pagoda's geometry: an original three-storey pagoda in the Japanese
// manner (not a reconstruction of any real building). Metres, +Y up, the
// front (south) towards +Z; square in plan, so most of it is written for
// the +Z side and turned four times.
//
//   stone platform with steps on four sides
//   three storeys: round pillars on three bays, tie beams, plaster walls,
//     studded double doors in the middle bay, slatted windows below
//   three-step bracket sets (tokyo) on every pillar, diagonal at corners
//   two layers of rafters, curved hip roofs of round and flat tiles with
//     upturned corners, hip ridges, end tiles and wind bells
//   a balcony with a railing round the upper storeys
//   the finial (sorin): dew basin, inverted bowl, lotus, nine rings, water
//     flame, dragon vehicle and the jewel
//   inside the ground storey: board floor, the central pillar, four inner
//     pillars, an altar with four small gilded stupas, a coffered ceiling,
//     painted walls
import { v3 } from './builder.mjs';

// Material name -> metres per texture repeat. The time travel's parts
// (scripts/build-pagoda-examples.mjs, TIME_PARTS) are paint, plaster,
// roof, bronze and door.
export const MATERIALS = {
  stone: { size: 1.6 },
  paint: { size: 1.0 },
  plaster: { size: 1.5 },
  roof: { size: 1.2 },
  bronze: { size: 0.6 },
  door: { size: 1.2 },
  wood: { size: 2.0 },
  ceiling: { size: 0.5 },
  lacquer: { size: 1.0 },
  gold: { size: 0.8 },
  mural: { size: 2.4 },
};

export const PLATFORM = { half: 5.4, height: 1.1 };
const TILE_PERIOD = 0.3;

// Storeys from the bottom. c: half the core's width; wall: pillar height;
// bracket: bracket zone height; overhang: eaves beyond the core; rise: roof
// height; pow: the roof's concavity; lift: corner upturn.
const STOREYS = [
  { c: 3.2, wall: 2.9, bracket: 1.0, overhang: 2.9, rise: 1.25, pow: 1.5, lift: 0.4, pillarR: 0.17, windows: true },
  { c: 2.65, wall: 1.75, bracket: 0.88, overhang: 2.65, rise: 1.15, pow: 1.5, lift: 0.38, pillarR: 0.15, windows: false },
  { c: 2.15, wall: 1.6, bracket: 0.84, overhang: 2.5, rise: 2.05, pow: 1.6, lift: 0.36, pillarR: 0.14, windows: false },
];
const ROOF_T = 0.28; // roof thickness (tiles to soffit)
const RAFTER_D = 0.25; // depth of the two rafter layers below the soffit
const STEP_OUT_RATIO = 0.13; // bracket step outwards, of the overhang
const PLAN_CURVE = 0.25; // eaves curve outwards towards the corners

const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// The layout of every storey: levels and the roof's parameters.
export function layout() {
  const out = [];
  let base = PLATFORM.height;
  for (let i = 0; i < STOREYS.length; i += 1) {
    const s = STOREYS[i];
    const next = STOREYS[i + 1];
    const wallTop = base + s.wall;
    const E = s.c + s.overhang;
    const Rw = next ? next.c + 0.45 : 0.55;
    const so = s.overhang * STEP_OUT_RATIO;
    const purlinZ = s.c + 3 * so;
    const vp = (E - purlinZ) / (E - Rw);
    const yE = wallTop + s.bracket - s.rise * vp ** s.pow + ROOF_T + RAFTER_D;
    const top = yE + s.rise;
    out.push({ ...s, index: i, base, wallTop, E, P: PLAN_CURVE, Rw, so, purlinZ, yE, top, last: !next });
    base = top + 0.3;
  }
  return out;
}

// The roof of a storey, in the +Z side's frame. u in [-1, 1] across (the
// hips at +-1), v in [0, 1] from the eaves up.
function roofOf(s) {
  const hw = (v) => s.E + s.P + (s.Rw - s.E - s.P) * v;
  const base = (u, v) => {
    const au = Math.abs(u);
    const x = u * hw(v);
    const d = s.E + s.P * au ** 3 + (s.Rw - s.E - s.P * au ** 3) * v;
    const y = s.yE + s.rise * v ** s.pow + s.lift * au ** 3 * (1 - v) ** 2;
    return [x, y, d];
  };
  const tiles = (u, v) => {
    const p = base(u, v);
    const phase = p[0] / TILE_PERIOD;
    const amp = 0.075 * (1 - smooth(0.9, 0.985, Math.abs(u)));
    p[1] += amp * Math.abs(Math.sin(Math.PI * phase)) ** 0.7;
    return p;
  };
  // v where the roof's plan reaches the wall line (inside it the soffit is
  // hidden) and where a straight line at x meets the hip.
  const vWall = Math.min(1, (s.E + s.P - s.c + 0.05) / (s.E + s.P - s.Rw));
  const vHip = (x) => Math.max(0, Math.min(1, (s.E + s.P - Math.abs(x)) / (s.E + s.P - s.Rw)));
  // A point under the roof at x (along the eaves) and v, depth below the
  // tiles' top (no corrugation).
  const at = (x, v, depth = 0) => {
    const u = Math.max(-1, Math.min(1, x / hw(v)));
    const p = base(u, v);
    p[1] -= depth;
    return p;
  };
  return { hw, base, tiles, vWall, vHip, at };
}

// ------------------------------------------------------------- platform

function platform(b) {
  b.setPart('Platform');
  const { half: h, height: H } = PLATFORM;
  b.box('stone', [-h - 0.12, 0, -h - 0.12], [h + 0.12, 0.28, h + 0.12]);
  b.box('stone', [-h, 0.28, -h], [h, H - 0.12, h]);
  b.box('stone', [-h - 0.08, H - 0.12, -h - 0.08], [h + 0.08, H, h + 0.08]);
  // Steps on every side, with low side walls.
  b.fourSides(() => {
    const n = 4;
    const rise = H / n;
    const tread = 0.32;
    for (let k = 0; k < n; k += 1) {
      const z0 = h + 0.08 + (n - 1 - k) * tread;
      b.box('stone', [-1.25, 0, h], [1.25, rise * (k + 1), z0 + tread]);
    }
    for (const sx of [-1, 1]) {
      const x0 = sx * 1.25;
      const x1 = sx * 1.55;
      b.box('stone', [Math.min(x0, x1), 0, h], [Math.max(x0, x1), H * 0.55, h + 0.08 + n * tread]);
      b.box('stone', [Math.min(x0, x1), H * 0.55, h], [Math.max(x0, x1), H + 0.06, h + 0.5]);
    }
  });
  // Pillar bases under the ground storey.
  const s = STOREYS[0];
  for (const x of [-s.c, -s.c / 3, s.c / 3, s.c]) {
    for (const z of [-s.c, -s.c / 3, s.c / 3, s.c]) {
      const edge = Math.abs(x) === s.c || Math.abs(z) === s.c;
      const inner = Math.abs(x) < s.c && Math.abs(z) < s.c;
      if (!edge && !inner) continue;
      if (inner) continue; // inner ones are below (inner pillars)
      b.cylinder('stone', [x, H, z], [x, H + 0.1, z], [s.pillarR + 0.12, s.pillarR + 0.06], 16);
    }
  }
}

// ------------------------------------------------------------- one storey

function pillars(b, s) {
  const xs = [-s.c, -s.c / 3, s.c / 3, s.c];
  const y0 = s.index === 0 ? s.base + 0.1 : s.base;
  const done = new Set();
  for (const x of xs) {
    for (const z of xs) {
      if (Math.abs(x) !== s.c && Math.abs(z) !== s.c) continue;
      const key = `${x.toFixed(3)},${z.toFixed(3)}`;
      if (done.has(key)) continue;
      done.add(key);
      b.cylinder('paint', [x, y0, z], [x, s.wallTop, z], [s.pillarR, s.pillarR * 0.94], 16, false);
    }
  }
}

// Doors: two leaves with studs and a frame, in the bay [x0, x1] of the
// wall at z, from y0 up to y1.
function door(b, x0, x1, y0, y1, z) {
  const frame = 0.1;
  b.box('paint', [x0, y0, z - 0.06], [x0 + frame, y1, z + 0.06]);
  b.box('paint', [x1 - frame, y0, z - 0.06], [x1, y1, z + 0.06]);
  b.box('paint', [x0, y1 - frame, z - 0.07], [x1, y1, z + 0.07]);
  b.box('paint', [x0, y0, z - 0.07], [x1, y0 + 0.12, z + 0.07]);
  const mid = (x0 + x1) / 2;
  for (const [a, c] of [[x0 + frame, mid - 0.005], [mid + 0.005, x1 - frame]]) {
    b.box('door', [a, y0 + 0.12, z - 0.03], [c, y1 - frame, z + 0.03]);
    // Rows of studs.
    const rows = Math.max(3, Math.round((y1 - y0) / 0.4));
    const cols = 3;
    for (let r = 0; r < rows; r += 1) {
      const y = y0 + 0.12 + ((r + 0.5) / rows) * (y1 - frame - y0 - 0.12);
      for (let k = 0; k < cols; k += 1) {
        const x = a + ((k + 0.5) / cols) * (c - a);
        b.cylinder('bronze', [x, y, z + 0.03], [x, y, z + 0.06], [0.03, 0.018], 6);
      }
    }
    // A ring pull.
    const px = a === x0 + frame ? c - 0.12 : a + 0.12;
    b.cylinder('bronze', [px, (y0 + y1) * 0.48, z + 0.03], [px, (y0 + y1) * 0.48, z + 0.05], 0.06, 10);
  }
}

function walls(b, s) {
  const c = s.c;
  const y0 = s.base + (s.index === 0 ? 0.1 : 0);
  const zWall = c;
  const thick = 0.12;
  const third = (2 * c) / 3;
  const doorTop = y0 + (s.index === 0 ? 2.35 : 1.6);
  b.fourSides(() => {
    // Tie beams through the pillars: base sill, waist, head, top.
    const beams = [
      [y0, y0 + 0.16],
      [s.wallTop - 0.5, s.wallTop - 0.34],
      [s.wallTop - 0.16, s.wallTop],
    ];
    if (s.index === 0) beams.push([doorTop, doorTop + 0.14]);
    for (const [ya, yb] of beams) b.box('paint', [-c, ya, zWall - 0.09], [c, yb, zWall + 0.09]);
    // Middle bay: the door, plaster above it.
    door(b, -third / 2, third / 2, y0 + 0.16, doorTop, zWall);
    const plasterUp = (x0, x1, ya, yb) => {
      if (yb - ya < 0.01) return;
      b.box('plaster', [x0, ya, zWall - thick / 2], [x1, yb, zWall + thick / 2], ['+z', '+y', '-y']);
      b.quad('mural', [x1, ya, zWall - thick / 2], [x0, ya, zWall - thick / 2], [x0, yb, zWall - thick / 2], [x1, yb, zWall - thick / 2]);
    };
    const headTop = s.index === 0 ? doorTop + 0.14 : doorTop;
    plasterUp(-third / 2, third / 2, headTop, s.wallTop - 0.5);
    plasterUp(-third / 2, third / 2, s.wallTop - 0.34, s.wallTop - 0.16);
    // Side bays.
    for (const sx of [-1, 1]) {
      const xa = sx < 0 ? -c : third / 2;
      const xb = sx < 0 ? -third / 2 : c;
      if (s.windows) {
        const sill = y0 + 0.95;
        plasterUp(xa, xb, y0 + 0.16, sill);
        b.box('paint', [xa, sill, zWall - 0.08], [xb, sill + 0.12, zWall + 0.08]);
        // Slats (renji mado).
        const top = doorTop;
        const n = Math.floor((xb - xa - 0.2) / 0.16);
        for (let k = 0; k < n; k += 1) {
          const x = xa + 0.1 + ((k + 0.5) / n) * (xb - xa - 0.2);
          b.box('paint', [x - 0.035, sill + 0.12, zWall - 0.035], [x + 0.035, top, zWall + 0.035]);
        }
        b.box('paint', [xa, top - 0.02, zWall - 0.08], [xb, top + 0.12, zWall + 0.08]);
        // Shutters dark behind the slats.
        b.quad('wood', [xa, sill + 0.12, zWall - 0.05], [xb, sill + 0.12, zWall - 0.05], [xb, top, zWall - 0.05], [xa, top, zWall - 0.05]);
        b.quad('wood', [xb, sill + 0.12, zWall - 0.051], [xa, sill + 0.12, zWall - 0.051], [xa, top, zWall - 0.051], [xb, top, zWall - 0.051]);
        plasterUp(xa, xb, top + 0.12, s.wallTop - 0.5);
      } else {
        plasterUp(xa, xb, y0 + 0.16, s.wallTop - 0.5);
      }
      plasterUp(xa, xb, s.wallTop - 0.34, s.wallTop - 0.16);
    }
  });
}

// Bracket sets: on every pillar three steps outwards, at the corners
// diagonally as well; the purlin ring at the last step carries the rafters.
function brackets(b, s, roof) {
  const c = s.c;
  const top = s.wallTop;
  // The purlin's top touches the lower rafters.
  const vp = (s.E - s.purlinZ) / (s.E - s.Rw);
  const purlinTop = roof.at(0, vp, ROOF_T + RAFTER_D)[1];
  const zone = purlinTop - 0.18 - (top + 0.12);
  const stepH = zone / 3;
  const so = s.so;
  const armW = 0.14;
  const armH = Math.min(0.18, stepH * 0.55);
  const block = Math.min(0.26, stepH * 0.75);
  // Plate on the pillars.
  b.fourSides(() => {
    b.box('paint', [-c - 0.12, top, c - 0.12], [c + 0.12, top + 0.12, c + 0.12]);
  });
  const levelY = (k) => top + 0.12 + k * stepH;
  const set = (x) => {
    // Big block on the pillar.
    b.box('paint', [x - 0.19, levelY(0), c - 0.19], [x + 0.19, levelY(0) + block, c + 0.19]);
    for (let k = 0; k < 3; k += 1) {
      const y = levelY(k) + block;
      const reach = c + so * (k + 1);
      // Arm outwards, into the wall as well.
      b.box('paint', [x - armW / 2, y, c - 0.35], [x + armW / 2, y + armH, reach + 0.12]);
      // Arm along the wall at its tip, with blocks.
      const half = k === 2 ? 0 : 0.42 - k * 0.06;
      if (half > 0) {
        b.box('paint', [x - half, y, reach - armW / 2], [x + half, y + armH, reach + armW / 2]);
        for (const dx of [-half + 0.08, half - 0.08]) {
          b.box('paint', [x + dx - 0.09, y + armH, reach - 0.09], [x + dx + 0.09, y + armH + block * 0.6, reach + 0.09]);
        }
      }
      b.box('paint', [x - 0.11, y + armH, reach - 0.11], [x + 0.11, y + armH + block * 0.7, reach + 0.11]);
      // The arm along the wall line at this level.
      if (k < 2) {
        b.box('paint', [x - 0.5, y, c - armW / 2], [x + 0.5, y + armH, c + armW / 2]);
        b.box('paint', [x - 0.42, y + armH, c - 0.09], [x - 0.24, y + armH + block * 0.6, c + 0.09]);
        b.box('paint', [x + 0.24, y + armH, c - 0.09], [x + 0.42, y + armH + block * 0.6, c + 0.09]);
      }
    }
  };
  b.fourSides(() => {
    for (const x of [-c, -c / 3, c / 3, c]) set(x);
    // Struts between the sets (kaerumata), plain blocks.
    for (const x of [-(2 * c) / 3, 0, (2 * c) / 3]) {
      b.box('paint', [x - 0.16, top + 0.12, c - 0.08], [x + 0.16, top + 0.12 + stepH * 1.2, c + 0.08]);
      b.box('paint', [x - 0.11, top + 0.12 + stepH * 1.2, c - 0.1], [x + 0.11, top + 0.12 + stepH * 1.2 + block * 0.7, c + 0.1]);
    }
    // Continuous beams along the wall line and at the second step.
    b.box('paint', [-c - 0.3, levelY(2) + block - 0.02, c - 0.07], [c + 0.3, levelY(2) + block + armH, c + 0.07]);
    b.box('paint', [-c - so * 2 - 0.2, levelY(3) - 0.02, c + so * 2 - 0.07], [c + so * 2 + 0.2, levelY(3) + 0.12, c + so * 2 + 0.07]);
    // The purlin ring.
    const pz = s.purlinZ;
    b.box('paint', [-pz - 0.12, purlinTop - 0.2, pz - 0.1], [pz + 0.12, purlinTop, pz + 0.1]);
    // Ceiling boards between the steps (visible from below).
    b.quad('plaster', [-c, levelY(1) + block - 0.01, c + 0.02], [c, levelY(1) + block - 0.01, c + 0.02], [c, levelY(1) + block - 0.01, c + so * 2], [-c, levelY(1) + block - 0.01, c + so * 2]);
  });
  // Corner sets: an arm along the diagonal, three steps.
  b.fourSides(() => {
    const d = [Math.SQRT1_2, 0, Math.SQRT1_2];
    for (let k = 0; k < 3; k += 1) {
      const y = levelY(k) + block;
      const reach = so * (k + 1) * Math.SQRT2 + 0.15;
      const a = v3.add([c, y + armH / 2, c], v3.scale(d, -0.3));
      const e = v3.add([c, y + armH / 2, c], v3.scale(d, reach));
      b.beam('paint', a, e, armW * 1.15, armH);
      const tip = v3.add([c, y + armH, c], v3.scale(d, reach - 0.15));
      b.box('paint', [tip[0] - 0.12, tip[1], tip[2] - 0.12], [tip[0] + 0.12, tip[1] + block * 0.7, tip[2] + 0.12]);
    }
  });
  return { purlinTop, stepH };
}

// Rafters in two layers, the corner rafter, the soffit, the tiles, the
// hips, end tiles and bells.
function roofParts(b, s, roof) {
  const spacing = 0.25;
  const vLower = 0.3; // lower rafters stop here, the upper ones start
  b.fourSides(() => {
    // Tiles.
    const N = Math.round((2 * (s.E + s.P)) / TILE_PERIOD) * 4;
    const nv = s.last ? 26 : 16;
    const slope = Math.hypot(s.E - s.Rw, s.rise);
    b.surface('roof', (u, v) => roof.tiles(u * 2 - 1, v), N, nv, (u, v) => [roof.tiles(u * 2 - 1, v)[0], v * slope], false);
    // Soffit from the eaves to the wall line.
    const soffit = (u, v) => {
      const p = roof.base(u * 2 - 1, v * roof.vWall);
      p[1] -= ROOF_T;
      return p;
    };
    b.surface('plaster', soffit, 48, 8, (u, v) => [soffit(u, v)[0], v * slope * roof.vWall], true);
    // The eaves' edge board.
    const edge = (u, w) => {
      const t = roof.tiles(u * 2 - 1, 0);
      const bt = roof.base(u * 2 - 1, 0);
      return [t[0], t[1] + (bt[1] - ROOF_T - t[1]) * w, t[2] + 0.002];
    };
    b.surface('paint', edge, N, 1, (u, w) => [edge(u, 0)[0], w * ROOF_T], true);
    // Round end tiles along the eaves.
    for (let k = 0; ; k += 1) {
      const x = (k + 0.5) * TILE_PERIOD;
      if (x > s.E + s.P - 0.35) break;
      for (const sx of [-1, 1]) {
        const p = roof.at(sx * x, 0);
        const u = Math.abs((sx * x) / roof.hw(0));
        if (u > 0.9) continue;
        const y = p[1] + 0.075 * 0.6;
        b.cylinder('roof', [p[0], y, p[2] - 0.05], [p[0], y, p[2] + 0.04], 0.075, 10);
      }
    }
    // Upper rafters (square) from the eaves in, lower ones (round) from
    // there to the wall line.
    for (let x = -s.E - s.P + spacing / 2; x < s.E + s.P; x += spacing) {
      const vEnd = roof.vHip(x);
      if (vEnd <= 0.02) continue;
      const v1 = Math.min(vLower, vEnd);
      const a = roof.at(x, 0, ROOF_T + 0.06);
      a[2] += 0.04;
      const e = roof.at(x, v1, ROOF_T + 0.06);
      if (Math.abs(x) / roof.hw(0) < 0.97) b.beam('paint', a, e, 0.1, 0.11);
      if (vEnd > vLower) {
        const v2 = Math.min(roof.vWall, vEnd);
        const la = roof.at(x, vLower - 0.06, ROOF_T + 0.17);
        const le = roof.at(x, v2, ROOF_T + 0.17);
        b.cylinder('paint', la, le, 0.06, 7, true);
      }
    }
    // The beam where the layers meet.
    const mz = roof.at(0, vLower - 0.04, ROOF_T + 0.17);
    const hwM = roof.hw(vLower - 0.04);
    b.box('paint', [-hwM + 0.1, mz[1] - 0.08, mz[2] - 0.09], [hwM - 0.1, mz[1] + 0.09, mz[2] + 0.09]);
  });
  // The corners: corner rafter, hip ridge, end tile and bell.
  b.fourSides(() => {
    const c0 = roof.base(1, 0);
    const cw = roof.base(1, roof.vWall);
    const d = v3.norm([1, 0, 1]);
    const tip = v3.add([c0[0], c0[1] - ROOF_T - 0.12, c0[2]], v3.scale(d, 0.3));
    b.beam('paint', [cw[0], cw[1] - ROOF_T - 0.2, cw[2]], tip, 0.2, 0.28);
    // Tip cap.
    b.beam('bronze', v3.add(tip, v3.scale(d, -0.025)), v3.add(tip, v3.scale(d, 0.012)), 0.21, 0.29);
    // Bell.
    const hang = v3.add(tip, [0, -0.14, 0]);
    b.cylinder('bronze', hang, v3.add(hang, [0, -0.25, 0]), 0.012, 5, false);
    const bell = v3.add(hang, [0, -0.6, 0]);
    b.lathe('bronze', bell, [[0.0, 0.0], [0.1, 0.02], [0.115, 0.05], [0.1, 0.16], [0.08, 0.3], [0.04, 0.34], [0.0, 0.35]], 14);
    b.box('bronze', [bell[0] - 0.004, bell[1] - 0.2, bell[2] - 0.05], [bell[0] + 0.004, bell[1] - 0.03, bell[2] + 0.05]);
    b.cylinder('bronze', [bell[0], bell[1] - 0.04, bell[2]], [bell[0], bell[1] + 0.02, bell[2]], 0.004, 4, false);
    // Hip ridge.
    const steps = 12;
    const vTop = s.last ? 0.97 : 0.98;
    let prev = null;
    for (let k = 0; k <= steps; k += 1) {
      const v = (k / steps) * vTop;
      const p = roof.base(1, v);
      p[1] += 0.1;
      if (prev) b.beam('roof', prev, p, 0.26, 0.22);
      prev = p;
    }
    // End tile (onigawara) at the hip's foot.
    const foot = roof.base(1, 0);
    b.beam('roof', v3.add(foot, [0, 0.02, 0]), v3.add(foot, v3.add(v3.scale(d, 0.1), [0, 0.04, 0])), 0.3, 0.34);
  });
}

// Under the next storey: a band on the roof, the balcony and its railing.
function balcony(b, s) {
  const c = s.c;
  const y = s.base;
  const out = c + 0.55;
  b.box('paint', [-c - 0.45, y - 0.36, -c - 0.45], [c + 0.45, y - 0.1, c + 0.45]);
  b.box('wood', [-out, y - 0.1, -out], [out, y, out]);
  b.fourSides(() => {
    b.box('paint', [-out, y - 0.16, out - 0.06], [out, y - 0.02, out + 0.03]);
    const rail = out - 0.05;
    const posts = Math.round((2 * rail) / 0.62);
    for (let k = 0; k <= posts; k += 1) {
      const x = -rail + (k / posts) * 2 * rail;
      b.box('paint', [x - 0.045, y, rail - 0.045], [x + 0.045, y + 0.78, rail + 0.045]);
    }
    b.box('paint', [-rail, y + 0.7, rail - 0.04], [rail, y + 0.78, rail + 0.04]);
    b.box('paint', [-rail, y + 0.38, rail - 0.03], [rail, y + 0.44, rail + 0.03]);
    b.box('paint', [-rail, y + 0.06, rail - 0.035], [rail, y + 0.12, rail + 0.035]);
    // Short struts between the lower rails.
    for (let k = 0; k < posts; k += 1) {
      const x = -rail + ((k + 0.5) / posts) * 2 * rail;
      b.box('paint', [x - 0.025, y + 0.12, rail - 0.025], [x + 0.025, y + 0.38, rail + 0.025]);
    }
    // Bronze finial on the corner post.
    b.lathe('bronze', [rail, y + 0.78, rail], [[0.06, 0], [0.065, 0.05], [0.05, 0.08], [0.07, 0.14], [0.045, 0.2], [0.0, 0.26]], 12);
  });
}

// Inside the ground storey.
function interior(b, s) {
  b.setPart('Interior');
  const c = s.c - 0.08;
  const y0 = s.base + 0.1;
  b.box('wood', [-c, s.base, -c], [c, y0, c], ['+y']);
  // Inner pillars and the central one.
  const ip = 1.05;
  for (const x of [-ip, ip]) {
    for (const z of [-ip, ip]) {
      b.cylinder('stone', [x, y0, z], [x, y0 + 0.08, z], 0.22, 14);
      b.cylinder('paint', [x, y0 + 0.08, z], [x, s.wallTop, z], 0.14, 16, false);
    }
  }
  // Altar (shumidan): a stepped platform round the central pillar.
  const steps = [
    [1.55, 0.0, 0.14, 'lacquer'],
    [1.45, 0.14, 0.2, 'gold'],
    [1.35, 0.2, 0.62, 'lacquer'],
    [1.45, 0.62, 0.7, 'gold'],
    [1.55, 0.7, 0.82, 'lacquer'],
  ];
  for (const [h, a, e, m] of steps) b.box(m, [-h, y0 + a, -h], [h, y0 + e, h]);
  // Four small gilded stupas (gorinto) on the altar.
  const top = y0 + 0.82;
  b.fourSides(() => {
    const p = [0, top, 1.0];
    b.box('gold', [p[0] - 0.17, p[1], p[2] - 0.17], [p[0] + 0.17, p[1] + 0.3, p[2] + 0.17]);
    b.lathe('gold', [p[0], p[1] + 0.3, p[2]], [[0.0, 0], [0.12, 0.02], [0.17, 0.12], [0.16, 0.2], [0.1, 0.28], [0.0, 0.3]], 16);
    b.lathe('gold', [p[0], p[1] + 0.6, p[2]], [[0.0, 0], [0.25, 0.0], [0.22, 0.05], [0.12, 0.17], [0.03, 0.22], [0.0, 0.22]], 4);
    b.lathe('gold', [p[0], p[1] + 0.82, p[2]], [[0.0, 0], [0.09, 0.0], [0.1, 0.06], [0.07, 0.1], [0.0, 0.1]], 12);
    b.lathe('gold', [p[0], p[1] + 0.92, p[2]], [[0.0, 0], [0.07, 0.02], [0.08, 0.07], [0.04, 0.13], [0.0, 0.19]], 12);
    // Lotus lamp stand at the inner pillar.
    b.lathe('bronze', [ip - 0.3, y0, ip + 0.3], [[0.16, 0], [0.12, 0.05], [0.03, 0.1], [0.025, 0.85], [0.1, 0.9], [0.13, 0.97], [0.0, 0.98]], 12);
  });
  b.cylinder('paint', [0, top, 0], [0, s.wallTop, 0], 0.3, 20, false);
  // Coffered ceiling (gotenjo): beams in a grid, painted panels.
  const n = 11;
  const yC = s.wallTop - 0.16;
  const size = (2 * c) / n;
  MATERIALS.ceiling.size = size;
  // Seen from below; the top is hidden by the storey above.
  b.quad('ceiling', [-c, yC, -c], [c, yC, -c], [c, yC, c], [-c, yC, c], [0, 0]);
  for (let k = 0; k <= n; k += 1) {
    const t = -c + k * size;
    b.box('paint', [t - 0.035, yC - 0.09, -c], [t + 0.035, yC, c], ['-y', '+x', '-x']);
    b.box('paint', [-c, yC - 0.09, t - 0.035], [c, yC, t + 0.035], ['-y', '+z', '-z']);
  }
  // The coves where ceiling meets wall.
  b.fourSides(() => {
    b.quad('paint', [c, yC - 0.3, c - 0.005], [-c, yC - 0.3, c - 0.005], [-c, yC - 0.09, c - 0.005], [c, yC - 0.09, c - 0.005]);
  });
}

// The finial (sorin) on the top roof.
function finial(b, s) {
  b.setPart('Finial');
  const y = s.top - 0.15;
  // Dew basin (roban).
  b.box('bronze', [-0.62, y, -0.62], [0.62, y + 0.42, 0.62]);
  b.box('bronze', [-0.68, y + 0.42, -0.68], [0.68, y + 0.5, 0.68]);
  let h = y + 0.5;
  // Inverted bowl (fukubachi).
  b.lathe('bronze', [0, h, 0], [[0.5, 0], [0.52, 0.05], [0.48, 0.2], [0.36, 0.34], [0.18, 0.42], [0.0, 0.44]], 28);
  h += 0.42;
  // Lotus (ukebana): petals as a wavy profile turned with few segments,
  // twice, offset.
  for (const [seg, scale] of [[8, 1], [16, 0.9]]) {
    b.lathe('bronze', [0, h, 0], [[0.1, 0], [0.22 * scale, 0.04], [0.42 * scale, 0.16], [0.46 * scale, 0.26], [0.36 * scale, 0.28], [0.12, 0.3]], seg);
  }
  h += 0.28;
  const poleFrom = y + 0.5;
  // Nine rings, close together (a squat finial suits the wide roofs).
  const RING = 0.3;
  const FLAME = 0.78;
  for (let k = 0; k < 9; k += 1) {
    const r = 0.4 - k * 0.012;
    const ring = [];
    for (let a = 0; a <= 10; a += 1) {
      const t = (a / 10) * Math.PI * 2;
      ring.push([r - 0.06 + 0.06 * Math.cos(t), 0.06 + 0.06 * Math.sin(t)]);
    }
    b.lathe('bronze', [0, h + 0.05 + k * RING, 0], ring.map(([rr, yy]) => [Math.max(0.0, rr), yy]), 28);
    // Cross bars to the pole.
    b.box('bronze', [-r + 0.06, h + 0.09 + k * RING, -0.02], [r - 0.06, h + 0.13 + k * RING, 0.02]);
  }
  h += 9 * RING + 0.12;
  // Water flame (suien): four pierced plates as stacked tongues.
  b.fourSides(() => {
    for (let k = 0; k < 7; k += 1) {
      const t = k / 6;
      const w = 0.42 * Math.sin(Math.PI * (0.15 + t * 0.75)) + 0.05;
      const y0 = h + t * FLAME;
      const sway = 0.06 * Math.sin(k * 1.9);
      b.box('bronze', [-0.015, y0, 0.09 + sway], [0.015, y0 + 0.16, 0.09 + w + sway]);
      b.box('bronze', [-0.015, y0 + 0.1, 0.09 + w * 0.6 + sway], [0.015, y0 + 0.22, 0.09 + w * 0.9 + sway]);
    }
  });
  h += FLAME + 0.05;
  // The pole, up into the dragon vehicle.
  b.cylinder('bronze', [0, poleFrom, 0], [0, h + 0.2, 0], 0.09, 12, false);
  // Dragon vehicle (ryusha) and the jewel (hoju).
  b.lathe('bronze', [0, h, 0], [[0.03, 0], [0.12, 0.05], [0.14, 0.14], [0.11, 0.23], [0.03, 0.27]], 18);
  h += 0.26;
  b.lathe('bronze', [0, h, 0], [[0.03, 0], [0.13, 0.06], [0.16, 0.15], [0.12, 0.27], [0.05, 0.36], [0.0, 0.42]], 18);
  return h + 0.42;
}

// The whole pagoda into the builder; returns facts the scene needs.
export function buildPagoda(b) {
  const storeys = layout();
  const bells = [];
  platform(b);
  for (const s of storeys) {
    const roof = roofOf(s);
    // The bell under the eaves' south-east corner (as roofParts hangs it).
    const c0 = roof.base(1, 0);
    bells.push([c0[0] + 0.3 * Math.SQRT1_2, c0[1] - ROOF_T - 0.12 - 0.74 + 0.2, c0[2] + 0.3 * Math.SQRT1_2]);
    b.setPart(`Storey ${s.index + 1}`);
    if (s.index > 0) balcony(b, s);
    pillars(b, s);
    walls(b, s);
    brackets(b, s, roof);
    if (s.index > 0) {
      // A board ceiling closing the storey.
      const c = s.c;
      b.box('wood', [-c + 0.05, s.wallTop - 0.2, -c + 0.05], [c - 0.05, s.wallTop - 0.16, c - 0.05], ['-y']);
    }
    b.setPart(`Roof ${s.index + 1}`);
    roofParts(b, s, roof);
  }
  // The central pillar through the upper storeys (seen in a section).
  b.setPart('Interior');
  b.cylinder('wood', [0, storeys[0].wallTop, 0], [0, storeys[2].top, 0], 0.3, 20, false);
  interior(b, storeys[0]);
  const height = finial(b, storeys[storeys.length - 1]);
  return { storeys, height, platform: PLATFORM, bells };
}
