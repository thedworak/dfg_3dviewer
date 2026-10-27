// The rules of the publishing check (publish-check.js): from facts the
// viewer gathers about the model and the view (no three.js objects, so they
// can be tested alone) to a list of checks, each
//
//   { key, level, values }
//
// `level`: "fix" (worth fixing before saving or rendering, with a fix the
// window offers), "tip" (worth a look, may be meant so), "wait" (not yet:
// the model is loading) or "ok" (passed). `values` fill in the text.

// The flat faces at one end of the model, against the other ends: below
// this share of the surface there is no base to speak of.
const BASE_MIN_SHARE = 0.03;
// How many times the second end's flat area a base needs to count.
const BASE_RATIO_SURE = 4;
// A slab (a relief, a painting, a facade) is this thin against its other
// sides at most: its back is no base, it may well stand as it is.
const SLAB_RATIO = 0.35;
// Floating or sunk by more than this share of the height.
const GROUND_TOLERANCE = 0.02;
// Of the view: less is small, out of view is beyond this share hidden.
const FRAME_SMALL = 0.05;
const FRAME_HIDDEN = 0.12;
// The mean brightness (sRGB, 0..1) of the model's pixels.
const EXPOSURE_DARK = 0.2;
const EXPOSURE_BRIGHT = 0.8;
const EXPOSURE_CLIPPED = 0.3;
const EXPOSURE_TARGET = 0.45;
// Heavy for phones and the browser.
const HEAVY_TRIANGLES = 3_000_000;
const HEAVY_TEXTURE = 8192;
// A size without a unit from the file that is likely in another unit.
const SIZE_TOO_LARGE_M = 2000;
const SIZE_TOO_SMALL_M = 0.005;

// Which end the model stands on, from the flat area at each end of its box
// ({ "Y-": area, "Z+": area, ... }), its whole surface and the box's size
// ({ X, Y, Z }, optional): { base, confidence 0..1 }; base null when no end
// stands out (a box, a building with a flat roof as large as its floor),
// no confidence for the back of a slab.
export function decideModelBase(areas, total, extents = null) {
  const entries = Object.entries(areas || {}).sort((a, b) => b[1] - a[1]);
  if (!entries.length || !(total > 0)) return { base: null, confidence: 0 };
  const [best, second = [null, 0]] = entries;
  if (best[1] < total * BASE_MIN_SHARE) return { base: null, confidence: 0 };
  const ratio = best[1] / Math.max(second[1], total * 0.005);
  let confidence = Math.min(1, Math.max(0, (ratio - 1) / (BASE_RATIO_SURE - 1)));
  if (extents) {
    const axis = best[0][0];
    const others = Object.entries(extents).filter(([key]) => key !== axis).map(([, value]) => value);
    if (extents[axis] < Math.min(...others) * SLAB_RATIO) confidence = 0;
  }
  return { base: best[0], confidence, ratio };
}

// The axis of the file to name as up (up-axis.js) for a model standing on
// `base` (world) now, with `currentUpAxis` applied: what points away from
// the base becomes up. `toFileAxis` turns a world direction ("Y+") into the
// file's axis under the current fix.
export function suggestUpAxis(base, toFileAxis) {
  if (!base || base === "Y-") return null;
  const away = `${base[0]}${base[1] === "-" ? "+" : "-"}`;
  return toFileAxis ? toFileAxis(away) : away;
}

// The exposure: "dark" or "bright" with the factor that brings the mean to
// the target, or null.
export function decideExposure(light) {
  if (!light || !(light.pixels >= 200)) return null;
  const { mean, clipped = 0 } = light;
  if (mean < EXPOSURE_DARK) {
    return { state: "dark", factor: Math.min(3, (EXPOSURE_TARGET / Math.max(mean, 0.02)) ** 1.6) };
  }
  if (mean > EXPOSURE_BRIGHT || clipped > EXPOSURE_CLIPPED) {
    return { state: "bright", factor: Math.max(0.35, (EXPOSURE_TARGET / mean) ** 1.6) };
  }
  return null;
}

// The model's box in the view: { inside, hidden, coverage } from the
// corners in normalized device coordinates ([x, y, z] each, z > 1 behind
// the camera).
export function measureFraming(corners, cameraInside) {
  if (cameraInside) return { inside: true, hidden: 0, coverage: 1 };
  if (!Array.isArray(corners) || !corners.length) return null;
  const behind = corners.some(([, , z]) => z > 1 || z < -1);
  const xs = corners.map(([x]) => x);
  const ys = corners.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const area = Math.max(0, maxX - minX) * Math.max(0, maxY - minY);
  const clip = (value) => Math.min(1, Math.max(-1, value));
  const visible = Math.max(0, clip(maxX) - clip(minX)) * Math.max(0, clip(maxY) - clip(minY));
  return {
    inside: false,
    hidden: behind ? 1 : area > 0 ? 1 - visible / area : 0,
    coverage: visible / 4,
  };
}

// facts: see publish-check.js gatherPublishFacts().
export function evaluatePublishChecks(facts) {
  const checks = [];
  const add = (key, level, values = {}) => checks.push({ key, level, values });
  if (!facts) return checks;

  if (facts.loading) add("loading", "wait");
  const mesh = facts.kind === "mesh";

  // Standing upright.
  if (mesh && facts.base) {
    const { base, confidence, upAxis, rotated } = facts.base;
    if (base && base !== "Y-" && confidence >= 0.5) {
      const upsideDown = base === "Y+";
      const values = { side: upsideDown ? "upsideDown" : "side", upAxis, rotated: rotated === true };
      // Flat on top may be a table or a deck on columns: only pointed out.
      // A model turned by hand: the fix would turn it again.
      add("orientation", !upsideDown && confidence >= 0.75 && upAxis && !rotated ? "fix" : "tip", values);
    } else {
      add("orientation", "ok");
    }
  }

  // On the ground.
  if (facts.ground && !facts.tiled) {
    const { offset, height } = facts.ground;
    if (height > 0 && Math.abs(offset) > height * GROUND_TOLERANCE) {
      add("ground", "fix", { direction: offset > 0 ? "above" : "below", share: Math.abs(offset) / height });
    } else {
      add("ground", "ok");
    }
  }

  // In the view (the saved start view, the main thumbnail).
  if (facts.framing) {
    const { inside, hidden, coverage } = facts.framing;
    if (inside) add("framing", "tip", { state: "inside" });
    else if (hidden > FRAME_HIDDEN) add("framing", "fix", { state: "cut", percent: Math.round(hidden * 100) });
    else if (coverage < FRAME_SMALL) add("framing", "fix", { state: "small", percent: Math.max(1, Math.round(coverage * 100)) });
    else add("framing", "ok");
  }

  // Lighting.
  if (facts.light !== undefined) {
    const exposure = decideExposure(facts.light);
    if (exposure) add("exposure", "fix", { state: exposure.state, factor: exposure.factor, percent: Math.round((facts.light.mean || 0) * 100) });
    else if (facts.light) add("exposure", "ok");
  }

  // What would show in the renders and the saved view but is only a tool.
  const tools = facts.tools || {};
  const toolKeys = ["clipping", "measurements", "faces", "selection", "transform", "lightTransform", "wireframe", "certainty"];
  const activeTools = toolKeys.filter((key) => tools[key]);
  activeTools.forEach((key) => add(`tool.${key}`, "fix"));
  if (tools.shading) add("tool.shading", "tip", { mode: tools.shading });
  if (tools.weather) add("tool.weather", "tip", { type: tools.weather });
  if (!activeTools.length && !tools.shading) add("tools", "ok");

  if (facts.quality && facts.quality !== "high") add("quality", "fix", { quality: facts.quality });

  // The model itself.
  if (facts.size && facts.unitSource === "default") {
    const largest = Math.max(facts.size.x, facts.size.y, facts.size.z);
    if (largest > SIZE_TOO_LARGE_M || (largest > 0 && largest < SIZE_TOO_SMALL_M)) {
      add("units", "tip", { meters: largest, state: largest > SIZE_TOO_LARGE_M ? "large" : "small" });
    }
  }
  const materials = facts.materials || {};
  if (materials.black?.length) add("materials.black", "tip", { names: materials.black });
  if (materials.invisible?.length) add("materials.invisible", "tip", { names: materials.invisible });
  if (materials.suggested > 0) add("materials.suggested", "tip", { count: materials.suggested });
  if (facts.triangles > HEAVY_TRIANGLES || facts.largestTexture >= HEAVY_TEXTURE) {
    add("heavy", "tip", { triangles: facts.triangles, texture: facts.largestTexture });
  }
  if (facts.canValidate) add("metadata", "tip");

  return checks;
}

// The checks to show first: what to fix, then tips, then what passed.
const LEVEL_ORDER = { wait: 0, fix: 1, tip: 2, ok: 3 };
export function sortPublishChecks(checks) {
  return checks
    .map((check, index) => ({ check, index }))
    .sort((a, b) => (LEVEL_ORDER[a.check.level] - LEVEL_ORDER[b.check.level]) || a.index - b.index)
    .map(({ check }) => check);
}
