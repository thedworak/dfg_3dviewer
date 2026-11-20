// The shape of a generated building (editor/surroundings-rules.js, a layout's
// `blocks`): its walls and its roof as faces, for the three ways the
// surroundings are drawn - the schematic look (editor/surroundings.js), the
// realistic one (editor/surroundings-realistic.js: the shapes it has no
// detailed version of) and the intro's (viewer/intro/intro-surroundings.js).
// Pure: no three.js.
//
//   writeBlockShape(face, block, { overhang, walls })
//
// calls face(points, kind, outward) for each face: `points` in the block's
// own frame - x along `w`, z along `d`, y up from its foot, metres -
// counter-clockwise seen from outside (from `outward`, a direction in the
// same frame); `kind` "wall", "roof", "under" (a roof's underside) or "gable"
// (a gable's triangle: wall-coloured). The caller turns and places them
// (`angle`, `x`, `z`) and colours them.
//
// Roofs: "gable" (ridge along `ridge`: "w" or "d"), "pyramid" and "onion"
// (drawn as a pyramid here), "hip" (four slopes, the ridge along the long
// side), "cone" (over round walls: `shape: "round"`), "pagoda" (`tiers`
// storeys, each under a wide roof, a finial `roofHeight` high); anything
// else a flat top.

const ROUND_SIDES = 12;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// The points in the right order for `outward`.
export function orient(points, outward) {
  const normal = cross(sub(points[1], points[0]), sub(points[points.length - 1], points[0]));
  return dot(normal, outward) < 0 ? [...points].reverse() : points;
}

// A ring of points round the vertical axis at height y.
function ring(radius, y, sides = ROUND_SIDES, turn = 0) {
  return Array.from({ length: sides }, (_item, index) => {
    const angle = turn + (index / sides) * Math.PI * 2;
    return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
  });
}

// Walls between two outlines (bottom and top, the same count of corners).
function band(face, lower, upper, kind) {
  const count = lower.length;
  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    const mid = [(lower[index][0] + lower[next][0]) / 2, 0, (lower[index][2] + lower[next][2]) / 2];
    face(orient([lower[index], lower[next], upper[next], upper[index]], mid), kind, mid);
  }
}

// A roof from an outline up to a point (a cone, a pyramid), and its
// underside where it overhangs.
function spire(face, outline, apex, under = true) {
  const count = outline.length;
  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    const mid = [(outline[index][0] + outline[next][0]) / 2, 0, (outline[index][2] + outline[next][2]) / 2];
    face(orient([outline[index], outline[next], apex], [mid[0], 1, mid[2]]), "roof", [mid[0], 1, mid[2]]);
  }
  if (under) face(orient(outline, [0, -1, 0]), "under", [0, -1, 0]);
}

// A roof between two outlines (a frustum), its underside below the lower.
function frustum(face, lower, upper) {
  const count = lower.length;
  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    const mid = [(lower[index][0] + lower[next][0]) / 2, 0, (lower[index][2] + lower[next][2]) / 2];
    const out = [mid[0], 1, mid[2]];
    face(orient([lower[index], lower[next], upper[next], upper[index]], out), "roof", out);
  }
  face(orient(lower, [0, -1, 0]), "under", [0, -1, 0]);
}

const rect = (hw, hd, y) => [[-hw, y, -hd], [hw, y, -hd], [hw, y, hd], [-hw, y, hd]];

export function writeBlockShape(face, block, { overhang = 0, walls = true } = {}) {
  const hw = block.w / 2;
  const hd = block.d / 2;
  const h = block.h;
  const rise = h + (block.roofHeight || 0);
  const o = overhang;

  if (block.roof === "pagoda") {
    // Each storey: a wall a little narrower than the one below, under a
    // roof reaching far out; the finial on top.
    const tiers = Math.max(1, Math.round(block.tiers || 3));
    const storey = h / tiers;
    let top = null;
    for (let tier = 0; tier < tiers; tier += 1) {
      const y0 = tier * storey;
      const wh = Math.min(hw, hd) * (1 - 0.11 * tier);
      const wallTop = y0 + storey * 0.5;
      band(face, rect(wh, wh, y0 - (tier ? 0 : 0.5)), rect(wh, wh, wallTop), "wall");
      const eave = rect(wh * 1.75, wh * 1.75, wallTop - storey * 0.05);
      top = rect(wh * 0.62, wh * 0.62, y0 + storey);
      frustum(face, eave, top);
    }
    spire(face, top, [0, rise, 0], false);
    return;
  }

  if (block.shape === "round") {
    // Round walls under a cone.
    const r = hw;
    band(face, ring(r, -0.5), ring(r, h), "wall");
    spire(face, ring(r + o, h - o * ((block.roofHeight || 1) / r)), [0, rise, 0]);
    return;
  }

  // walls: false - the caller draws a box's walls itself (with its doors
  // and windows), only the roof here.
  if (walls) band(face, rect(hw, hd, -0.5), rect(hw, hd, h), "wall");
  const roof = block.roof;
  if (roof === "pyramid" || roof === "onion") {
    const eave = h - o * ((block.roofHeight || 1) / Math.min(hw, hd));
    spire(face, rect(hw + o, hd + o, eave), [0, rise, 0], o > 0);
  } else if (roof === "hip") {
    // The ridge along the longer side, its ends as far in as the roof is
    // deep (slopes alike on all four sides).
    const alongW = hw >= hd;
    const span = (alongW ? hd : hw) + o;
    const length = (alongW ? hw : hd) + o;
    const eave = h - o * ((block.roofHeight || 1) / Math.max(span - o, 0.1));
    const half = Math.max(0, length - span);
    const P = (along, across, y) => (alongW ? [along, y, across] : [across, y, along]);
    const e = [P(-length, -span, eave), P(length, -span, eave), P(length, span, eave), P(-length, span, eave)];
    const r0 = P(-half, 0, rise);
    const r1 = P(half, 0, rise);
    // The two long slopes, the two hipped ends.
    const sideOut = (hand) => (alongW ? [0, 1, hand] : [hand, 1, 0]);
    const endOut = (hand) => (alongW ? [hand, 1, 0] : [0, 1, hand]);
    face(orient([e[0], e[1], r1, r0], sideOut(-1)), "roof", sideOut(-1));
    face(orient([e[2], e[3], r0, r1], sideOut(1)), "roof", sideOut(1));
    face(orient([e[1], e[2], r1], endOut(1)), "roof", endOut(1));
    face(orient([e[3], e[0], r0], endOut(-1)), "roof", endOut(-1));
    if (o > 0) face(orient(e, [0, -1, 0]), "under", [0, -1, 0]);
  } else if (roof === "gable") {
    const alongW = block.ridge === "w";
    const span = alongW ? hd : hw;
    const length = alongW ? hw : hd;
    const eave = h - o * ((block.roofHeight || 1) / span);
    const reach = length + o * 0.6;
    const P = (along, across, y) => (alongW ? [along, y, across] : [across, y, along]);
    [-1, 1].forEach((hand) => {
      const out = alongW ? [0, 1, hand] : [hand, 1, 0];
      const slope = [P(-reach, hand * (span + o), eave), P(reach, hand * (span + o), eave), P(reach, 0, rise), P(-reach, 0, rise)];
      face(orient(slope, out), "roof", out);
      if (o > 0) face(orient(slope, [0, -1, 0]), "under", [0, -1, 0]);
      const end = alongW ? [hand, 0, 0] : [0, 0, hand];
      face(orient([P(hand * length, -span, h), P(hand * length, span, h), P(hand * length, 0, rise)], end), "gable", end);
    });
  } else {
    face(orient(rect(hw, hd, h), [0, 1, 0]), "roof", [0, 1, 0]);
  }
}

// The roof shapes this module draws that the older writers had not (the
// realistic look draws the others in detail itself).
export const NEW_ROOFS = new Set(["hip", "cone", "pagoda"]);
export const hasNewShape = (block) => NEW_ROOFS.has(block.roof) || block.shape === "round";
