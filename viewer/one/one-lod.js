// The One (.one4d): which level of detail a part needs, from its size on
// screen (docs/one-format.md, "Levels of detail"). Plain arithmetic, no
// three.js: the viewer (one-viewer.js createOneLod) passes its camera and
// the part's bounding sphere; the tests call it directly.

// A level's need, when its part's size on screen is known:
// - a level with `geometricError` (in the file's units, as in 3D Tiles) is
//   good enough while that error, projected, stays under MAX_SCREEN_ERROR
//   pixels: the coarsest such level is taken;
// - a level with `screenSize` (a share of the view's height) is used once
//   the part's bounding sphere covers that much of the view;
// - without either, the levels share the range DEFAULT_SIZES: with two,
//   the finer one from 30% of the view's height (a model framed in the
//   view covers 80-90% of it; zoomed out as far as the viewer goes, 20%).
export const MAX_SCREEN_ERROR = 4;
const DEFAULT_SIZES = [0.3, 0.8];
// Coarser again only below this share of the threshold: no flicker at
// the edge.
const HYSTERESIS = 0.7;

function defaultScreenSize(level, count) {
  if (level === 0) return 0;
  if (count === 2) return DEFAULT_SIZES[0];
  const t = (level - 1) / Math.max(1, count - 2);
  return DEFAULT_SIZES[0] * (DEFAULT_SIZES[1] / DEFAULT_SIZES[0]) ** t;
}

// How big `sphere` (world space) is on screen: its diameter as a share of
// the view's height, and the pixels per world unit at its centre.
export function screenMeasure(camera, sphere, viewHeight) {
  if (camera.isOrthographicCamera) {
    const span = (camera.top - camera.bottom) / camera.zoom;
    return { share: (2 * sphere.radius) / span, pixelsPerUnit: viewHeight / span };
  }
  const { position: p } = camera;
  const { center: c } = sphere;
  const centreDistance = Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z);
  const distance = Math.max(centreDistance - sphere.radius, sphere.radius * 0.05, 1e-6);
  const span = 2 * distance * Math.tan((camera.fov * Math.PI) / 360);
  return { share: (2 * sphere.radius) / span, pixelsPerUnit: viewHeight / span };
}

// The level a part needs, from the one it shows now (for the hysteresis).
export function chooseLevel(lods, measure, current = 0, worldScale = 1) {
  const count = lods.length;
  if (count < 2) return 0;
  const errors = lods.every((lod) => Number.isFinite(lod.geometricError));
  if (errors) {
    // Coarsest level whose projected error is small enough; leaving a finer
    // level only when the coarser one's error is well under the limit.
    for (let level = 0; level < count; level += 1) {
      const pixels = lods[level].geometricError * worldScale * measure.pixelsPerUnit;
      const limit = level < current ? MAX_SCREEN_ERROR * HYSTERESIS : MAX_SCREEN_ERROR;
      if (pixels <= limit) return level;
    }
    return count - 1;
  }
  let chosen = 0;
  for (let level = 1; level < count; level += 1) {
    const size = Number.isFinite(lods[level].screenSize) ? lods[level].screenSize : defaultScreenSize(level, count);
    const needed = level <= current ? size * HYSTERESIS : size;
    if (measure.share >= needed) chosen = level;
  }
  return chosen;
}

