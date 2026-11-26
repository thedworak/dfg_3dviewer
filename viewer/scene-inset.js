import { core } from "./core.js";

// The part of the scene covered by a window along an edge of the viewer
// (a phone's settings sheet, ui/tool-panel-chrome.js; an open menu,
// ui/menu-toolbar.js): the camera's view is moved so that the middle of the
// picture - where a fitted model sits - is the middle of what is still
// seen, above the sheet (or beside it). It is a
// view offset (camera.setViewOffset), not a camera move: orbiting, fitting
// and picking work as before, only the picture slides; it eases there.

const insets = new Map();
const current = { x: 0, y: 0 };
let shiftedCamera = null;

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

// `inset`: { bottom, right, left } in CSS pixels covered, or null when
// `source` covers nothing any more.
export function setSceneInset(source, inset) {
  if (inset && (inset.bottom > 0 || inset.right > 0 || inset.left > 0)) insets.set(source, inset);
  else insets.delete(source);
}

export function getSceneInset() {
  let bottom = 0;
  let right = 0;
  let left = 0;
  insets.forEach((inset) => {
    bottom = Math.max(bottom, inset.bottom || 0);
    right = Math.max(right, inset.right || 0);
    left = Math.max(left, inset.left || 0);
  });
  return { bottom, right, left };
}

// Each frame, before rendering (main.js animate).
export function applySceneInset(delta = 1 / 60) {
  const camera = core.camera;
  const canvas = core.mainCanvas;
  if (!camera || !canvas || core.renderer?.xr?.isPresenting) return;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return;
  const { bottom, right, left } = getSceneInset();
  // Half of what is covered, and never more than a third of the view (a
  // window on the left moves the picture right: a negative offset).
  const targetX = (Math.min(right, width * 0.66) - Math.min(left, width * 0.66)) / 2;
  const targetY = Math.min(bottom, height * 0.66) / 2;
  const k = reducedMotion() ? 1 : Math.min(1, delta * 12);
  current.x += (targetX - current.x) * k;
  current.y += (targetY - current.y) * k;
  if (Math.abs(targetX - current.x) < 0.5) current.x = targetX;
  if (Math.abs(targetY - current.y) < 0.5) current.y = targetY;

  if (shiftedCamera && shiftedCamera !== camera) {
    shiftedCamera.clearViewOffset();
    shiftedCamera = null;
  }
  if (!current.x && !current.y) {
    if (shiftedCamera) {
      camera.clearViewOffset();
      shiftedCamera = null;
    }
    return;
  }
  const view = camera.view;
  if (view?.enabled && view.fullWidth === width && view.fullHeight === height
    && view.offsetX === current.x && view.offsetY === current.y) return;
  camera.setViewOffset(width, height, current.x, current.y, width, height);
  shiftedCamera = camera;
}
