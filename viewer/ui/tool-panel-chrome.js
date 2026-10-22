import { core } from "../core.js";
import { isAppBuild } from "../remote.js";
import { t } from "../i18n-utils.js";

// Floating tool panels (section planes, measurements, point cloud, tour, sun,
// timeline) get a grip in their header to drag the panel anywhere over the
// viewer (double tap: back to the side stack), a button that minimizes it to
// a small round icon (tap: restore, drag: move) and, for panels without one
// of their own, a close button.

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
  scene: svg('<path d="m2.5 13.5 7-7"/><path d="M12 2v2M11 3h2M14 6.5v1.5M13.25 7.25h1.5"/>'),
  sun: svg('<circle cx="8" cy="8" r="3"/><path d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3 3l1.1 1.1M11.9 11.9 13 13M3 13l1.1-1.1M11.9 4.1 13 3"/>'),
  timeline: svg('<path d="M1.5 8h13"/><circle cx="4" cy="8" r="1.4" fill="currentColor"/><circle cx="9.5" cy="8" r="1.4" fill="currentColor"/><path d="M4 4v1.5M9.5 4v1.5M12.5 10.5V12"/>'),
  measure: svg('<rect x="1" y="5" width="14" height="6" rx="1" transform="rotate(-30 8 8)"/><path d="m4.6 8.6.9 1.5M7.2 7.1l.9 1.5M9.8 5.6l.9 1.5"/>'),
  clipping: svg('<path d="M2 11 8 14l6-3V5L8 2 2 5z"/><path d="M1 8.5h14" stroke-dasharray="2 1.5"/>'),
  pointCloud: svg('<circle cx="4" cy="5" r="1" fill="currentColor"/><circle cx="8" cy="3.5" r="1" fill="currentColor"/><circle cx="12" cy="6" r="1" fill="currentColor"/><circle cx="6" cy="9" r="1" fill="currentColor"/><circle cx="10.5" cy="10" r="1" fill="currentColor"/><circle cx="4" cy="12.5" r="1" fill="currentColor"/><circle cx="8.5" cy="13" r="1" fill="currentColor"/>'),
  certainty: svg('<path d="M8 2 14.5 5.5 8 9 1.5 5.5z"/><path d="m1.5 8.5 6.5 3.5 6.5-3.5M1.5 11.5 8 15l6.5-3.5"/>'),
  material: svg('<path d="M8 1.5a6.5 6.5 0 1 0 0 13c1 0 1.5-.7 1.2-1.6-.4-1 .3-1.9 1.3-1.9h1.6a2.9 2.9 0 0 0 2.9-2.9C15 4.4 11.9 1.5 8 1.5z"/><circle cx="4.8" cy="7" r=".9" fill="currentColor"/><circle cx="7.5" cy="4.5" r=".9" fill="currentColor"/><circle cx="10.8" cy="5.5" r=".9" fill="currentColor"/>'),
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

function setMinimized(panel, minimized) {
  panel.classList.toggle("is-minimized", minimized);
  const { minimize, pip } = panel.toolPanelChrome || {};
  if (minimize) syncMinimize(panel, minimize);
  if (pip) pip.hidden = !minimized;
  if (minimized) pip?.focus({ preventScroll: true });
  else minimize?.focus({ preventScroll: true });
  if (panel.classList.contains("is-undocked")) clampPanel(panel);
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
// `movable: false` for dialogs that already drag by their header;
// `visibilityRoot`: the element whose `hidden` shows and hides the panel,
// when that is not the panel itself. Safe to call again on every render:
// panels that rebuild their contents get the same buttons put back.
export function attachToolPanelChrome(panel, header, {
  before = null,
  minimizable = true,
  movable = true,
  visibilityRoot = panel,
  icon = WINDOW_ICON,
  label = null,
  onClose = null,
} = {}) {
  if (!panel || !header) return;
  if (!panel.toolPanelChrome) {
    panel.toolPanelChrome = {
      grip: movable ? createGrip(panel) : null,
      minimize: minimizable ? createMinimize(panel) : null,
      pip: minimizable ? createPip(panel) : null,
      close: onClose ? createClose(onClose) : null,
    };
    panel.classList.add("has-tool-chrome");
    watchPanelVisibility(panel, visibilityRoot);
  }
  Object.assign(panel.toolPanelChrome, { header, options: { before, icon, label } });
  const { grip, minimize, pip, close } = panel.toolPanelChrome;
  header.classList.add("tool-panel-chrome");
  if (grip) {
    const moveLabel = t("toolPanel.move", "Move panel (double tap: dock)");
    grip.title = moveLabel;
    grip.setAttribute("aria-label", moveLabel);
    if (header.firstChild !== grip) header.prepend(grip);
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
  if (pip) {
    syncPip(panel, pip, icon, label);
    if (pip.parentNode !== panel) panel.append(pip);
  }
}

// The chrome's texts again, in the current language (ui/localization-theme.js).
export function refreshToolPanelChrome(panel) {
  const chrome = panel?.toolPanelChrome;
  if (chrome?.header) attachToolPanelChrome(panel, chrome.header, chrome.options);
}
