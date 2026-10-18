import { core } from "../core.js";

const RESIZE_GRIP_PX = 18;

// Panels start centered via left:50% + translateX(-50%); the first drag or
// resize pins them to explicit pixel coordinates so neither fights the transform.
function pinPanel(panel) {
  if (panel.dataset.windowPinned === "1") return;
  const parent = panel.offsetParent || panel.parentElement;
  if (!parent) return;
  const parentRect = parent.getBoundingClientRect();
  const rect = panel.getBoundingClientRect();
  panel.style.left = `${rect.left - parentRect.left + parent.scrollLeft}px`;
  panel.style.top = `${rect.top - parentRect.top + parent.scrollTop}px`;
  panel.style.transform = "none";
  panel.dataset.windowPinned = "1";
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

// One window at a time: showing a panel window closes the others, and a
// click (not a drag) on the background - the 3D canvas or the viewer
// container itself - closes them all. Each panel closes through its own
// close function, so its side effects run.
const windows = new Map();
const CLICK_SLOP_PX = 6;
let pressStart = null;

// The open panel window, closed (ui/back-navigation.js); false when none is.
export function closeOpenPanelWindow() {
  const open = [...windows.entries()].find(([panel]) => !panel.hidden);
  open?.[1]();
  return Boolean(open);
}

export function hasOpenPanelWindow() {
  return [...windows.keys()].some((panel) => !panel.hidden);
}

function closeWindows(except) {
  windows.forEach((close, panel) => {
    if (panel !== except && !panel.hidden) close();
  });
}

function isBackground(target) {
  const container = core.container;
  if (!container || !(target instanceof Element)) return false;
  return target === container || (target.tagName === "CANVAS" && container.contains(target));
}

let backgroundWatched = false;

function watchBackgroundClicks(Viewer) {
  if (backgroundWatched) return;
  backgroundWatched = true;
  Viewer.addCleanup(() => { backgroundWatched = false; });
  Viewer.bindEventListener(document, "pointerdown", (event) => {
    pressStart = event.isPrimary && isBackground(event.target) ? { x: event.clientX, y: event.clientY } : null;
  }, true);
  Viewer.bindEventListener(document, "pointerup", (event) => {
    const start = pressStart;
    pressStart = null;
    if (!start || !event.isPrimary || !isBackground(event.target)) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > CLICK_SLOP_PX) return;
    closeWindows(null);
  }, true);
}

export function makePanelWindow(Viewer, panel, handle, close = () => { panel.hidden = true; }) {
  if (!panel || !handle) return;
  handle.classList.add("panel-window-handle");
  panel.classList.add("panel-window");

  windows.set(panel, close);
  watchBackgroundClicks(Viewer);
  const observer = new MutationObserver(() => {
    if (!panel.hidden) closeWindows(panel);
  });
  observer.observe(panel, { attributes: true, attributeFilter: ["hidden"] });
  Viewer.addCleanup(() => {
    observer.disconnect();
    windows.delete(panel);
  });

  Viewer.bindEventListener(handle, "pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest("button, input, select, textarea, a")) return;
    pinPanel(panel);
    const parent = panel.offsetParent || panel.parentElement;
    const startX = event.clientX;
    const startY = event.clientY;
    const startLeft = panel.offsetLeft;
    const startTop = panel.offsetTop;
    handle.setPointerCapture?.(event.pointerId);

    const onMove = (moveEvent) => {
      const maxLeft = (parent?.clientWidth ?? window.innerWidth) - panel.offsetWidth;
      const maxTop = (parent?.clientHeight ?? window.innerHeight) - panel.offsetHeight;
      panel.style.left = `${clamp(startLeft + moveEvent.clientX - startX, 0, maxLeft)}px`;
      panel.style.top = `${clamp(startTop + moveEvent.clientY - startY, 0, maxTop)}px`;
    };
    const onEnd = (endEvent) => {
      handle.releasePointerCapture?.(endEvent.pointerId);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onEnd);
      handle.removeEventListener("pointercancel", onEnd);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onEnd);
    handle.addEventListener("pointercancel", onEnd);
    event.preventDefault();
  });

  // The browser's native resize grip (CSS `resize: both`) gives no start
  // event, but it does press on the panel itself in its bottom-right corner:
  // pin the position and swap the max-height cap for the current height so
  // dragging the grip can both grow and shrink the panel.
  Viewer.bindEventListener(panel, "pointerdown", (event) => {
    if (event.target !== panel) return;
    const rect = panel.getBoundingClientRect();
    if (event.clientX < rect.right - RESIZE_GRIP_PX || event.clientY < rect.bottom - RESIZE_GRIP_PX) return;
    pinPanel(panel);
    panel.style.height = `${panel.offsetHeight}px`;
    panel.style.maxHeight = "none";
  });
}
