import { core } from "../core.js";
import { isAppBuild } from "../remote.js";
import { t } from "../i18n-utils.js";
import { setSceneInset } from "../scene-inset.js";

// Floating tool panels (section planes, measurements, point cloud, tour, sun,
// timeline) get a grip in their header to drag the panel anywhere over the
// viewer (double tap: back to the side stack), a button that minimizes it to
// a small round icon (tap: restore, drag: move) and, for panels without one
// of their own, a close button. On a phone a panel (unless `modal: false`)
// is a sheet along the foot of the viewer, the model
// moved to the middle of what is left above it; dragged down, Escape or its
// minimize button folds it back to its icon. A fold button rolls a panel up to its header and the
// controls marked [data-panel-peek] (the surroundings' year, say): on a
// phone the scene stays in view while the one setting that matters is
// changed.

const DOUBLE_TAP_MS = 320;
const TAP_SLOP_PX = 6;
const undockedPanels = new Set();

// Sent on document whenever one of these panels appears, so the editor
// toolbar can fold its secondary tools away (editor-toolbar.js).
export const TOOL_PANEL_OPEN_EVENT = "viewer-tool-panel-open";

function watchPanelVisibility(panel, root) {
  const isShown = () => !panel.hidden && !root.hidden;
  // Only where the toolbar folds for them (touch devices and the app).
  const announce = () => {
    if (isToolPanelChromeEnabled()) document.dispatchEvent(new CustomEvent(TOOL_PANEL_OPEN_EVENT, { detail: { panel } }));
  };
  let shown = isShown();
  if (shown) announce();
  const observer = new MutationObserver(() => {
    const now = isShown();
    if (now && !shown) announce();
    shown = now;
  });
  [...new Set([panel, root])].forEach((element) => {
    observer.observe(element, { attributes: true, attributeFilter: ["hidden"] });
  });
}

export function isToolPanelChromeEnabled() {
  return isAppBuild() || window.matchMedia?.("(pointer: coarse)").matches === true;
}

// Undocked, the panel sits in the viewer container itself (not in the side
// stack, which shrinks and moves as its other panels change), kept within it.
function clampPanel(panel) {
  const parent = panel.offsetParent;
  const container = core.container;
  if (!parent || !container) return;
  const parentRect = parent.getBoundingClientRect();
  const bounds = container.getBoundingClientRect();
  // A fullscreen viewer runs on under the app's ad banner (main.css).
  const bannerHeight = document.fullscreenElement
    ? parseFloat(getComputedStyle(document.body).getPropertyValue("--app-ad-banner-height")) || 0
    : 0;
  const minLeft = bounds.left - parentRect.left;
  const minTop = bounds.top - parentRect.top;
  const maxLeft = bounds.right - parentRect.left - panel.offsetWidth;
  const maxTop = bounds.bottom - bannerHeight - parentRect.top - panel.offsetHeight;
  const left = Math.min(Math.max(parseFloat(panel.style.left) || 0, minLeft), Math.max(minLeft, maxLeft));
  const top = Math.min(Math.max(parseFloat(panel.style.top) || 0, minTop), Math.max(minTop, maxTop));
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
}

function undockPanel(panel) {
  if (panel.classList.contains("is-undocked")) return;
  const rect = panel.getBoundingClientRect();
  // Minimized, the panel is only its icon: it gets back its own width.
  if (!panel.classList.contains("is-minimized")) panel.style.width = `${rect.width}px`;
  const container = core.container;
  if (container && panel.parentElement !== container) {
    // Where it goes back to on docking.
    const placeholder = document.createComment("tool panel");
    panel.before(placeholder);
    panel.toolPanelChrome.placeholder = placeholder;
    container.append(panel);
  }
  panel.classList.add("is-undocked");
  const parentRect = (panel.offsetParent || panel.parentElement).getBoundingClientRect();
  panel.style.left = `${rect.left - parentRect.left}px`;
  panel.style.top = `${rect.top - parentRect.top}px`;
  undockedPanels.add(panel);
}

function dockPanel(panel) {
  const placeholder = panel.toolPanelChrome?.placeholder;
  if (placeholder?.isConnected) placeholder.replaceWith(panel);
  else placeholder?.remove();
  if (panel.toolPanelChrome) panel.toolPanelChrome.placeholder = null;
  panel.classList.remove("is-undocked");
  panel.style.removeProperty("left");
  panel.style.removeProperty("top");
  panel.style.removeProperty("width");
  undockedPanels.delete(panel);
}

window.addEventListener("resize", () => undockedPanels.forEach((panel) => {
  if (panel.isConnected) clampPanel(panel);
  else undockedPanels.delete(panel);
}));

// Dragging `handle` moves the panel out of the side stack; a tap (no drag)
// calls onTap with the time since the previous tap.
function bindDrag(panel, handle, onTap) {
  let lastTap = 0;
  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    let startLeft = 0;
    let startTop = 0;
    let moved = false;
    handle.chromeDragged = false;
    const pointerId = event.pointerId;

    // On the window, capturing: undocking moves the panel in the DOM, which
    // would end a pointer capture on the handle, and panels stop pointer
    // events from bubbling out of them.
    const onMove = (moveEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (!moved) {
        if (Math.hypot(dx, dy) < TAP_SLOP_PX) return;
        moved = true;
        undockPanel(panel);
        startLeft = parseFloat(panel.style.left) || 0;
        startTop = parseFloat(panel.style.top) || 0;
      }
      panel.style.left = `${startLeft + dx}px`;
      panel.style.top = `${startTop + dy}px`;
      clampPanel(panel);
    };
    const onEnd = (endEvent) => {
      if (endEvent.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onEnd, true);
      window.removeEventListener("pointercancel", onEnd, true);
      handle.chromeDragged = moved;
      if (moved || endEvent.type === "pointercancel") return;
      const now = performance.now();
      onTap?.(now - lastTap);
      lastTap = now;
    };
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onEnd, true);
    window.addEventListener("pointercancel", onEnd, true);
  });
  // Keyboard and assistive technology: a click without a pointer press.
  handle.addEventListener("click", (event) => {
    if (event.detail === 0) onTap?.(Infinity);
  });
}

function createGrip(panel) {
  const grip = document.createElement("button");
  grip.type = "button";
  grip.className = "tool-panel-chrome_grip";
  grip.textContent = "⠿";
  bindDrag(panel, grip, (sinceLastTap) => {
    if (sinceLastTap < DOUBLE_TAP_MS) dockPanel(panel);
  });
  return grip;
}

const WINDOW_ICON = `<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" focusable="false">
  <rect x="1.5" y="2.5" width="13" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.4"/>
  <line x1="1.5" y1="5.5" x2="14.5" y2="5.5" stroke="currentColor" stroke-width="1.4"/>
</svg>`;

// Icons of the minimized panels (attachToolPanelChrome's `icon`).
const svg = (body) => `<svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
export const PANEL_ICONS = {
  tour: svg('<path d="M3 14V2.5h8.5l-1.8 2.75 1.8 2.75H3"/>'),
  weather: svg('<path d="M4.5 10.5a2.8 2.8 0 0 1-.3-5.6 3.9 3.9 0 0 1 7.5.4 2.6 2.6 0 0 1-.2 5.2z"/><path d="M5.5 12.8l-.6 1.4M8.5 12.8l-.6 1.4M11.5 12.8l-.6 1.4"/>'),
  seasons: svg('<path d="M3 13C3 6.5 6.5 3 13 3c0 6.5-3.5 10-10 10z"/><path d="M3 13l5.5-5.5"/>'),
  // Houses and a tower: the generated surroundings.
  surroundings: svg('<path d="M1.5 14.5h13"/><path d="M2.5 14.5V9l2.5-2 2.5 2v5.5"/><path d="M9.5 14.5V5h3v9.5"/><path d="M9.5 5 11 2.5 12.5 5"/>'),
  scene: svg('<path d="m2.5 13.5 7-7"/><path d="M12 2v2M11 3h2M14 6.5v1.5M13.25 7.25h1.5"/>'),
  sun: svg('<circle cx="8" cy="8" r="3"/><path d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3 3l1.1 1.1M11.9 11.9 13 13M3 13l1.1-1.1M11.9 4.1 13 3"/>'),
  timeline: svg('<path d="M1.5 8h13"/><circle cx="4" cy="8" r="1.4" fill="currentColor"/><circle cx="9.5" cy="8" r="1.4" fill="currentColor"/><path d="M4 4v1.5M9.5 4v1.5M12.5 10.5V12"/>'),
  measure: svg('<rect x="1" y="5" width="14" height="6" rx="1" transform="rotate(-30 8 8)"/><path d="m4.6 8.6.9 1.5M7.2 7.1l.9 1.5M9.8 5.6l.9 1.5"/>'),
  clipping: svg('<path d="M2 11 8 14l6-3V5L8 2 2 5z"/><path d="M1 8.5h14" stroke-dasharray="2 1.5"/>'),
  pointCloud: svg('<circle cx="4" cy="5" r="1" fill="currentColor"/><circle cx="8" cy="3.5" r="1" fill="currentColor"/><circle cx="12" cy="6" r="1" fill="currentColor"/><circle cx="6" cy="9" r="1" fill="currentColor"/><circle cx="10.5" cy="10" r="1" fill="currentColor"/><circle cx="4" cy="12.5" r="1" fill="currentColor"/><circle cx="8.5" cy="13" r="1" fill="currentColor"/>'),
  volume: svg('<path d="M8 1.5 14 4.75v6.5L8 14.5 2 11.25v-6.5z"/><path d="M2 4.75 8 8l6-3.25M8 8v6.5" opacity=".55"/><circle cx="8" cy="8" r="1.6" fill="currentColor"/>'),
  image: svg('<rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/><path d="m2 11 3.5-3.5 3 3 1.8-1.8L14 12.5"/><circle cx="10.5" cy="5.8" r="1.1"/>'),
  sounds: svg('<path d="M2 6.5h2.5L8 3.5v9l-3.5-3H2z"/><path d="M10.5 6a2.8 2.8 0 0 1 0 4M12.5 4.2a5.4 5.4 0 0 1 0 7.6"/>'),
  liveLink: svg('<circle cx="4" cy="8" r="1.8"/><circle cx="12" cy="4" r="1.8"/><circle cx="12" cy="12" r="1.8"/><path d="M5.6 7.2l4.8-2.4M5.6 8.8l4.8 2.4"/>'),
  liveData: svg('<rect x="1.5" y="2" width="13" height="6.5" rx="1"/><path d="M1.5 5.2h13M6 2v6.5"/><path d="M1.5 12.5h3l1.5-2 2 3.5 1.5-2.5 1 1h4"/>'),
  audio: svg('<path d="M2 7v2M4.75 5v6M7.5 2.5v11M10.25 4.5v7M13 6.5v3"/>'),
  certainty: svg('<path d="M8 2 14.5 5.5 8 9 1.5 5.5z"/><path d="m1.5 8.5 6.5 3.5 6.5-3.5M1.5 11.5 8 15l6.5-3.5"/>'),
  material: svg('<path d="M8 1.5a6.5 6.5 0 1 0 0 13c1 0 1.5-.7 1.2-1.6-.4-1 .3-1.9 1.3-1.9h1.6a2.9 2.9 0 0 0 2.9-2.9C15 4.4 11.9 1.5 8 1.5z"/><circle cx="4.8" cy="7" r=".9" fill="currentColor"/><circle cx="7.5" cy="4.5" r=".9" fill="currentColor"/><circle cx="10.8" cy="5.5" r=".9" fill="currentColor"/>'),
  prepare: svg('<path d="M5.5 2.5h5v2h-5z"/><path d="M4.5 3.5H3v11h10v-11h-1.5"/><path d="m5.5 9.5 1.8 1.8 3.4-3.6"/>'),
  shading: svg('<circle cx="8" cy="8" r="6"/><path d="M8 2a6 6 0 0 1 0 12z" fill="currentColor"/>'),
  // Blender's camera: a frame, the lens, the triangle on top.
  camera: svg('<path d="M1.5 6.5h9v7h-9z"/><path d="m10.5 8.5 4-2v7l-4-2"/><path d="M3.5 4.5h5L6 1.8z" fill="currentColor"/>'),
  light: svg('<path d="M6 12.5h4M6.8 14.5h2.4"/><path d="M8 1.5a4.5 4.5 0 0 0-2.6 8.2v1.3h5.2V9.7A4.5 4.5 0 0 0 8 1.5z"/>'),
  animation: svg('<circle cx="8" cy="8" r="6.5"/><path d="m6.5 5.3 4 2.7-4 2.7z" fill="currentColor"/>'),
  window: WINDOW_ICON,
};

// The minimized panel: a round icon that restores it on a tap and moves it
// when dragged.
function createPip(panel) {
  const pip = document.createElement("button");
  pip.type = "button";
  pip.className = "tool-panel-chrome_pip";
  pip.addEventListener("pointerup", (event) => event.stopPropagation());
  pip.addEventListener("wheel", (event) => event.stopPropagation(), { passive: true });
  bindDrag(panel, pip, null);
  // On the click, not when the pointer lifts: restored on pointerup, the
  // panel would be under the finger when the tap's click arrives, and the
  // click would land on its close button.
  pip.addEventListener("click", () => {
    if (pip.chromeDragged) {
      pip.chromeDragged = false;
      return;
    }
    setMinimized(panel, false);
  });
  return pip;
}

// A phone's layout: the menus' own ("bar" upright, "rail" on its side,
// ui/menu-toolbar.js), so the windows change with them; the classic toolbar
// by the same query as editor-toolbar.js's PHONE_TOOLBAR_QUERY.
const PHONE_QUERY = "(max-width: 640px), (max-height: 520px) and (pointer: coarse)";

function menusMode() {
  const toolbar = core.editorToolbar;
  return toolbar?.classList.contains("viewer-menus") ? toolbar.dataset.mode || null : null;
}

export function isPhoneLayout() {
  const mode = menusMode();
  if (mode) return mode === "bar" || mode === "rail";
  return window.matchMedia?.(PHONE_QUERY).matches === true;
}

// `modal` left out: a sheet on a phone (every settings window); false for
// the panels that stay small over the scene (a player bar, a legend).
function isModal(panel) {
  const modal = panel.toolPanelChrome?.options?.modal;
  if (modal === undefined) return isPhoneLayout();
  return Boolean(typeof modal === "function" ? modal() : modal);
}

const chromePanels = new Set();

// Shown and not minimized, a panel is a sheet exactly when it should be one
// now: as it appears, and again when the layout changes (turned, resized).
function syncSheet(panel) {
  const chrome = panel.toolPanelChrome;
  if (!chrome?.options) return;
  if (!panel.isConnected) {
    chromePanels.delete(panel);
    if (panel.classList.contains("is-modal-open")) closeModal(panel);
    return;
  }
  const root = chrome.visibilityRoot || panel;
  const shown = !panel.hidden && !root.hidden;
  const want = shown && !panel.classList.contains("is-minimized") && isModal(panel);
  const open = panel.classList.contains("is-modal-open");
  if (want && !open) openModal(panel);
  else if (!want && open) closeModal(panel);
  else if (open) {
    panel.classList.toggle("is-side-sheet", isSideSheet());
    updateSheetInset(panel);
  }
}

let layoutFrame = 0;
const syncAllSheets = () => {
  cancelAnimationFrame(layoutFrame);
  // After the menus have taken their own layout for the new size.
  layoutFrame = requestAnimationFrame(() => [...chromePanels].forEach(syncSheet));
};
window.addEventListener("resize", syncAllSheets);
window.addEventListener("orientationchange", syncAllSheets);

// A `modal` panel restored on a phone is a sheet: along the foot of the
// viewer (in landscape, its right side), with no backdrop - the model stays
// in view above it and can be turned while the settings change; the
// picture slides to the middle of what the sheet leaves (scene-inset.js).
// Its grabber (or header) drags it between half and nearly all of the
// viewer's height; dragged down past half that, it minimizes.
const SHEET_SNAPS = [0.46, 0.88];
const SHEET_MINIMIZE_BELOW = 0.22;

const isSideSheet = () => {
  const mode = menusMode();
  if (mode) return mode === "rail";
  return window.matchMedia?.("(orientation: landscape) and (max-height: 520px)").matches === true;
};

function sheetInset(panel) {
  const canvas = core.mainCanvas || core.container;
  if (!canvas || !panel.classList.contains("is-modal-open") || panel.classList.contains("is-minimized")) return null;
  const view = canvas.getBoundingClientRect();
  const rect = panel.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  if (isSideSheet()) return { right: Math.max(0, view.right - rect.left) };
  return { bottom: Math.max(0, view.bottom - rect.top) };
}

function updateSheetInset(panel) {
  // A sheet folded to a slider being adjusted: the picture keeps where it
  // was rather than jumping under the finger.
  if (panel.classList.contains("is-range-peek")) return;
  setSceneInset(panel, sheetInset(panel));
}

function setSheetSnap(panel, index) {
  const chrome = panel.toolPanelChrome;
  chrome.sheetSnap = Math.min(Math.max(index, 0), SHEET_SNAPS.length - 1);
  panel.style.setProperty("--tool-sheet-height", `${SHEET_SNAPS[chrome.sheetSnap] * 100}%`);
  panel.classList.toggle("is-sheet-full", chrome.sheetSnap === SHEET_SNAPS.length - 1);
}

const isSheetControl = (target) => target instanceof Element
  && Boolean(target.closest("button:not(.tool-panel-chrome_grabber), input, select, textarea, a, [contenteditable]"));

// The grabber and the header drag the sheet up and down; a tap on the
// grabber goes to the other height.
function bindSheetDrag(panel, header) {
  const chrome = panel.toolPanelChrome;
  if (chrome.sheetDragHeader === header) return;
  chrome.sheetDragHeader = header;
  header.addEventListener("pointerdown", (event) => {
    if (!panel.classList.contains("is-modal-open") || isSideSheet() || event.button > 0 || isSheetControl(event.target)) return;
    const container = core.container;
    if (!container) return;
    event.preventDefault();
    event.stopPropagation();
    const pointerId = event.pointerId;
    const startY = event.clientY;
    const startHeight = panel.getBoundingClientRect().height;
    const full = container.clientHeight;
    let moved = false;
    const onMove = (moveEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const dy = moveEvent.clientY - startY;
      if (!moved && Math.abs(dy) < TAP_SLOP_PX) return;
      moved = true;
      panel.classList.add("is-sheet-dragging");
      panel.style.height = `${Math.min(Math.max(startHeight - dy, 48), full * 0.94)}px`;
      updateSheetInset(panel);
    };
    const onEnd = (endEvent) => {
      if (endEvent.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onEnd, true);
      window.removeEventListener("pointercancel", onEnd, true);
      panel.classList.remove("is-sheet-dragging");
      if (!moved) {
        if (endEvent.type !== "pointercancel" && event.target.closest?.(".tool-panel-chrome_grabber")) {
          setSheetSnap(panel, chrome.sheetSnap === 0 ? 1 : 0);
        }
        return;
      }
      const height = panel.getBoundingClientRect().height / full;
      panel.style.removeProperty("height");
      if (height < SHEET_MINIMIZE_BELOW) {
        setMinimized(panel, true, { focus: false });
        return;
      }
      // The nearest height, or the next one in the direction it was flung.
      const dy = endEvent.clientY - startY;
      let index = SHEET_SNAPS.reduce((best, snap, i) => (Math.abs(snap - height) < Math.abs(SHEET_SNAPS[best] - height) ? i : best), 0);
      if (Math.abs(dy) > full * 0.08) index = dy < 0 ? Math.max(index, chrome.sheetSnap + 1) : Math.min(index, chrome.sheetSnap - 1);
      if (index < 0) {
        setMinimized(panel, true, { focus: false });
        return;
      }
      setSheetSnap(panel, index);
      updateSheetInset(panel);
    };
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onEnd, true);
    window.addEventListener("pointercancel", onEnd, true);
  });
}

function createGrabber() {
  const grabber = document.createElement("button");
  grabber.type = "button";
  grabber.className = "tool-panel-chrome_grabber";
  return grabber;
}

const openSheets = new Set();

// Restored as a sheet, in the viewer container; where it was (the side
// stack, or where its icon was dragged) is kept for minimizing again.
function openModal(panel) {
  const chrome = panel.toolPanelChrome;
  const container = core.container;
  if (!chrome || !container || panel.classList.contains("is-modal-open")) return;
  if (panel.parentElement !== container) {
    chrome.modalMark = document.createComment("modal tool panel");
    panel.before(chrome.modalMark);
  }
  container.append(panel);
  panel.classList.add("is-modal-open");
  panel.classList.toggle("is-side-sheet", isSideSheet());
  panel.setAttribute("role", "dialog");
  setSheetSnap(panel, chrome.sheetSnap ?? 0);
  chrome.sheetObserver ||= new ResizeObserver(() => (panel.isConnected ? updateSheetInset(panel) : syncSheet(panel)));
  chrome.sheetObserver.observe(panel);
  openSheets.add(panel);
  updateSheetInset(panel);
}

function closeModal(panel) {
  const chrome = panel.toolPanelChrome;
  if (!chrome || !panel.classList.contains("is-modal-open")) return;
  panel.classList.remove("is-modal-open", "is-side-sheet", "is-sheet-full", "is-sheet-dragging");
  panel.style.removeProperty("height");
  chrome.sheetObserver?.disconnect();
  openSheets.delete(panel);
  setSceneInset(panel, null);
  // Removed by its owner (closed for good): not put back.
  if (!panel.isConnected) chrome.modalMark?.remove();
  else if (chrome.modalMark?.isConnected) chrome.modalMark.replaceWith(panel);
  else chrome.modalMark?.remove();
  chrome.modalMark = null;
}

function setMinimized(panel, minimized, { focus = true } = {}) {
  if (minimized) closeModal(panel);
  else if (isModal(panel)) openModal(panel);
  panel.classList.toggle("is-minimized", minimized);
  const { minimize, pip } = panel.toolPanelChrome || {};
  if (minimize) syncMinimize(panel, minimize);
  if (pip) pip.hidden = !minimized;
  if (focus && minimized) pip?.focus({ preventScroll: true });
  else if (focus) minimize?.focus({ preventScroll: true });
  if (panel.classList.contains("is-undocked")) clampPanel(panel);
}

// Floats a panel over the viewer where it stands in the side stack, as if
// dragged out of it (a double tap on its grip docks it again). Not for a
// hidden, minimized or sheet panel. Returns whether it floats.
export function undockToolPanel(panel) {
  if (!panel?.toolPanelChrome || !panel.isConnected || panel.hidden) return false;
  if (panel.classList.contains("is-minimized") || panel.classList.contains("is-modal-open")) return false;
  undockPanel(panel);
  clampPanel(panel);
  return true;
}

// Minimizes (true) or restores a panel with this chrome - a modal one as its
// window. focus: false leaves the focus where it is (a panel minimized as
// it appears).
export function setToolPanelMinimized(panel, minimized, options) {
  if (panel?.toolPanelChrome) setMinimized(panel, minimized, options);
}

export function isToolPanelMinimized(panel) {
  return Boolean(panel?.classList.contains("is-minimized"));
}

function createClose(onClose) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tool-panel-chrome_close";
  button.textContent = "×";
  button.addEventListener("pointerdown", (event) => event.stopPropagation());
  button.addEventListener("click", () => onClose());
  return button;
}

const FOLD_ICON = '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m4 10 4-4 4 4"/></svg>';

function createFold(panel) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tool-panel-chrome_fold";
  button.innerHTML = FOLD_ICON;
  button.addEventListener("pointerdown", (event) => event.stopPropagation());
  button.addEventListener("click", () => setToolPanelFolded(panel, !isToolPanelFolded(panel)));
  return button;
}

function syncFold(panel, button) {
  const folded = isToolPanelFolded(panel);
  const label = folded ? t("toolPanel.unfold", "Unfold panel") : t("toolPanel.fold", "Fold panel (keep its main setting)");
  button.title = label;
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-expanded", String(!folded));
}

export function isToolPanelFolded(panel) {
  return Boolean(panel?.classList.contains("is-peek"));
}

// On a phone an open settings window can cover nearly all of the model.
// While a range is being adjusted, temporarily fold the window down to that
// one control.  This is installed here rather than in every individual
// panel, so new panels get the same behaviour automatically.  The original
// folded state is respected: a panel the user folded deliberately is never
// unfolded by this helper.
function installRangePeek(panel) {
  if (panel.toolPanelRangePeek) return;
  const state = panel.toolPanelRangePeek = { target: null, timer: 0, restore: false, pointerId: null };
  const isPhone = () => window.matchMedia?.("(pointer: coarse)").matches === true;
  const clearTimer = () => {
    window.clearTimeout(state.timer);
    state.timer = 0;
  };
  const finish = () => {
    clearTimer();
    if (!state.restore) return;
    state.target?.removeAttribute("data-panel-peek");
    state.target = null;
    state.restore = false;
    state.pointerId = null;
    setRangePeekLook(panel, false);
    setToolPanelFolded(panel, false);
    panel.scrollTop = state.scrollTop || 0;
  };
  const finishSoon = () => {
    clearTimer();
    // Keeping the compact view briefly after lifting a finger makes the
    // changed model visible before the rest of the window returns.
    state.timer = window.setTimeout(finish, 360);
  };
  const begin = (input) => {
    if (!isPhone() || panel.classList.contains("is-minimized") || isToolPanelFolded(panel)) return;
    // A sheet at half height leaves the model in view: nothing to fold.
    if (panel.classList.contains("is-modal-open") && !panel.classList.contains("is-sheet-full") && !isSideSheet()) return;
    clearTimer();
    const target = input.closest("label") || input;
    if (!panel.contains(target)) return;
    state.target?.removeAttribute("data-panel-peek");
    state.target = target;
    target.setAttribute("data-panel-peek", "");
    state.restore = true;
    // The slider stays under the finger: where it was before folding, the
    // folded window shifted to it (a centred modal window would otherwise
    // shrink around its middle and take the slider up with it).
    state.scrollTop = panel.scrollTop;
    const before = target.getBoundingClientRect().top;
    setToolPanelFolded(panel, true);
    const after = target.getBoundingClientRect().top;
    setRangePeekLook(panel, true, before - after);
  };
  const rangeFrom = (event) => event.target instanceof HTMLInputElement && event.target.type === "range" ? event.target : null;

  panel.addEventListener("pointerdown", (event) => {
    const input = rangeFrom(event);
    if (!input || event.button > 0) return;
    begin(input);
    if (state.restore) state.pointerId = event.pointerId;
  }, true);
  // A finger may finish outside the slider, so listen on the window rather
  // than relying on the range being the event target at pointer-up.
  ["pointerup", "pointercancel"].forEach((type) => window.addEventListener(type, (event) => {
    if (state.restore && event.pointerId === state.pointerId) finishSoon();
  }, true));
  // Keyboard changes have no pointer-up.  The short delay is reset on each
  // input event, keeping the single field visible during repeated key presses.
  panel.addEventListener("focusin", (event) => {
    const input = rangeFrom(event);
    if (input) begin(input);
  });
  panel.addEventListener("input", (event) => {
    if (rangeFrom(event) && state.restore) finishSoon();
  });
  panel.addEventListener("focusout", (event) => {
    if (rangeFrom(event) && state.restore) finishSoon();
  });
}

// While a slider is adjusted: the folded window moved by `shift` px to keep
// the slider in place.
function setRangePeekLook(panel, on, shift = 0) {
  panel.classList.toggle("is-range-peek", on);
  panel.style.translate = on && shift ? `0 ${Math.round(shift)}px` : "";
  if (!on && panel.classList.contains("is-modal-open")) updateSheetInset(panel);
}

// Rolls the panel up to its header and its [data-panel-peek] controls
// (true), or shows all of it again.
export function setToolPanelFolded(panel, folded) {
  const chrome = panel?.toolPanelChrome;
  if (!chrome) return;
  panel.classList.toggle("is-peek", folded);
  if (chrome.fold) syncFold(panel, chrome.fold);
  if (panel.classList.contains("is-undocked")) clampPanel(panel);
}

function createMinimize(panel) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tool-panel-chrome_minimize";
  // Headers that drag their dialog (materials, shading) must not start a
  // drag - and capture the pointer - from this button.
  button.addEventListener("pointerdown", (event) => event.stopPropagation());
  button.addEventListener("click", () => setMinimized(panel, !panel.classList.contains("is-minimized")));
  return button;
}

function syncMinimize(panel, button) {
  const minimized = panel.classList.contains("is-minimized");
  const label = minimized ? t("toolPanel.restore", "Restore panel") : t("toolPanel.minimize", "Minimize panel");
  button.textContent = "–";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-expanded", String(!minimized));
}

function syncPip(panel, pip, icon, label) {
  if (pip.chromeIcon !== icon) {
    pip.innerHTML = icon;
    pip.chromeIcon = icon;
  }
  const name = (typeof label === "function" ? label() : label) || panel.getAttribute("aria-label") || "";
  const text = name
    ? `${t("toolPanel.restore", "Restore panel")}: ${name}`
    : t("toolPanel.restore", "Restore panel");
  pip.title = text;
  pip.setAttribute("aria-label", text);
  pip.hidden = !panel.classList.contains("is-minimized");
}

// Adds the grip (first in `header`), the minimize button (before `before`,
// or last) and the round icon the minimized panel shrinks to (`icon`: SVG
// markup, `label`: the panel's name, or a function returning it) to a panel.
// `onClose`: adds a close button (last) for panels without one of their own.
// `foldable: false`: no fold button (attachToolPanelChrome's header and
// [data-panel-peek] controls only, see setToolPanelFolded).
// `movable: false` for dialogs that already drag by their header;
// `visibilityRoot`: the element whose `hidden` shows and hides the panel,
// when that is not the panel itself. `modal` (or a function, asked each
// time): a sheet; left out, a sheet on a phone (isModal). Safe to call again on
// every render:
// panels that rebuild their contents get the same buttons put back.
export function attachToolPanelChrome(panel, header, {
  before = null,
  minimizable = true,
  foldable = true,
  movable = true,
  visibilityRoot = panel,
  icon = WINDOW_ICON,
  label = null,
  onClose = null,
  modal = undefined,
} = {}) {
  if (!panel || !header) return;
  if (!panel.toolPanelChrome) {
    panel.toolPanelChrome = {
      grip: movable ? createGrip(panel) : null,
      fold: foldable ? createFold(panel) : null,
      minimize: minimizable ? createMinimize(panel) : null,
      pip: minimizable ? createPip(panel) : null,
      close: onClose ? createClose(onClose) : null,
      grabber: createGrabber(),
    };
    panel.classList.add("has-tool-chrome");
    installRangePeek(panel);
    watchPanelVisibility(panel, visibilityRoot);
    // A sheet: Escape folds it; hidden, it gives the scene back.
    panel.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && panel.classList.contains("is-modal-open")) setMinimized(panel, true);
    });
    const sheetObserver = new MutationObserver(() => syncSheet(panel));
    [...new Set([panel, visibilityRoot])].forEach((element) => {
      sheetObserver.observe(element, { attributes: true, attributeFilter: ["hidden"] });
    });
    chromePanels.add(panel);
  }
  Object.assign(panel.toolPanelChrome, { header, visibilityRoot, options: { before, icon, label, modal } });
  const { grip, fold, minimize, pip, close, grabber } = panel.toolPanelChrome;
  header.classList.add("tool-panel-chrome");
  if (modal !== false) {
    const grabLabel = t("toolPanel.resizeSheet", "Drag to resize, tap: taller or lower");
    grabber.title = grabLabel;
    grabber.setAttribute("aria-label", grabLabel);
    if (header.firstChild !== grabber) header.prepend(grabber);
    bindSheetDrag(panel, header);
  }
  if (grip) {
    const moveLabel = t("toolPanel.move", "Move panel (double tap: dock)");
    grip.title = moveLabel;
    grip.setAttribute("aria-label", moveLabel);
    const first = header.firstChild === grabber ? grabber.nextSibling : header.firstChild;
    if (first !== grip) header.insertBefore(grip, first);
  }
  if (close) {
    const closeLabel = t("toolPanel.close", "Close panel");
    close.title = closeLabel;
    close.setAttribute("aria-label", closeLabel);
    if (header.lastChild !== close) header.append(close);
  }
  if (minimize) {
    syncMinimize(panel, minimize);
    const anchor = before && before.parentNode === header ? before : close;
    if (minimize.nextSibling !== anchor || minimize.parentNode !== header) header.insertBefore(minimize, anchor);
  }
  if (fold) {
    syncFold(panel, fold);
    const anchor = minimize?.parentNode === header ? minimize : (before && before.parentNode === header ? before : close);
    if (fold.nextSibling !== anchor || fold.parentNode !== header) header.insertBefore(fold, anchor);
  }
  if (pip) {
    syncPip(panel, pip, icon, label);
    if (pip.parentNode !== panel) panel.append(pip);
  }
  // After its caller has put it in place (the side stack).
  queueMicrotask(() => syncSheet(panel));
}

// How far a panel's playback has come (tour, timeline, animation), as a ring
// around its icon while it is minimized: `value` 0..1, null for none.
export function setToolPanelProgress(panel, value) {
  const pip = panel?.toolPanelChrome?.pip;
  if (!pip) return;
  const shown = Number.isFinite(value);
  pip.classList.toggle("has-progress", shown);
  if (shown) pip.style.setProperty("--tool-panel-progress", String(Math.min(Math.max(value, 0), 1)));
  else pip.style.removeProperty("--tool-panel-progress");
}

// The chrome's texts again, in the current language (ui/localization-theme.js).
export function refreshToolPanelChrome(panel) {
  const chrome = panel?.toolPanelChrome;
  if (chrome?.header) attachToolPanelChrome(panel, chrome.header, chrome.options);
}
