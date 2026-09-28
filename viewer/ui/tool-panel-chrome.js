import { core } from "../core.js";
import { isAppBuild } from "../remote.js";
import { t } from "../i18n-utils.js";

// Floating tool panels (section planes, measurements, point cloud, tour) take
// a lot of a phone screen. On touch devices and in the app their header gets a
// grip to drag the panel anywhere over the viewer (double tap: back to the
// side stack) and a button that minimizes it to the header alone.

const DOUBLE_TAP_MS = 320;
const TAP_SLOP_PX = 6;
const undockedPanels = new Set();

// Sent on document whenever one of these panels appears, so the editor
// toolbar can fold its secondary tools away (editor-toolbar.js).
export const TOOL_PANEL_OPEN_EVENT = "viewer-tool-panel-open";

function watchPanelVisibility(panel, root) {
  const isShown = () => !panel.hidden && !root.hidden;
  const announce = () => document.dispatchEvent(new CustomEvent(TOOL_PANEL_OPEN_EVENT, { detail: { panel } }));
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

// The panel is positioned inside its side stack (position: absolute there),
// kept within the viewer container.
function clampPanel(panel) {
  const stack = panel.offsetParent;
  const container = core.container;
  if (!stack || !container) return;
  const stackRect = stack.getBoundingClientRect();
  const bounds = container.getBoundingClientRect();
  // A fullscreen viewer runs on under the app's ad banner (main.css).
  const bannerHeight = document.fullscreenElement
    ? parseFloat(getComputedStyle(document.body).getPropertyValue("--app-ad-banner-height")) || 0
    : 0;
  const minLeft = bounds.left - stackRect.left;
  const minTop = bounds.top - stackRect.top;
  const maxLeft = bounds.right - stackRect.left - panel.offsetWidth;
  const maxTop = bounds.bottom - bannerHeight - stackRect.top - panel.offsetHeight;
  const left = Math.min(Math.max(parseFloat(panel.style.left) || 0, minLeft), Math.max(minLeft, maxLeft));
  const top = Math.min(Math.max(parseFloat(panel.style.top) || 0, minTop), Math.max(minTop, maxTop));
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
}

function undockPanel(panel) {
  if (panel.classList.contains("is-undocked")) return;
  panel.style.width = `${panel.offsetWidth}px`;
  panel.style.left = `${panel.offsetLeft}px`;
  panel.style.top = `${panel.offsetTop}px`;
  panel.classList.add("is-undocked");
  undockedPanels.add(panel);
}

function dockPanel(panel) {
  panel.classList.remove("is-undocked");
  panel.style.removeProperty("left");
  panel.style.removeProperty("top");
  panel.style.removeProperty("width");
  undockedPanels.delete(panel);
}

window.addEventListener("resize", () => undockedPanels.forEach(clampPanel));

function createGrip(panel) {
  const grip = document.createElement("button");
  grip.type = "button";
  grip.className = "tool-panel-chrome_grip";
  grip.textContent = "⠿";
  let lastTap = 0;

  grip.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    let startLeft = 0;
    let startTop = 0;
    let moved = false;
    grip.setPointerCapture?.(event.pointerId);

    const onMove = (moveEvent) => {
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
      grip.releasePointerCapture?.(endEvent.pointerId);
      grip.removeEventListener("pointermove", onMove);
      grip.removeEventListener("pointerup", onEnd);
      grip.removeEventListener("pointercancel", onEnd);
      if (moved || endEvent.type === "pointercancel") return;
      const now = performance.now();
      if (now - lastTap < DOUBLE_TAP_MS) {
        dockPanel(panel);
        lastTap = 0;
      } else {
        lastTap = now;
      }
    };
    grip.addEventListener("pointermove", onMove);
    grip.addEventListener("pointerup", onEnd);
    grip.addEventListener("pointercancel", onEnd);
  });
  return grip;
}

function createMinimize(panel) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tool-panel-chrome_minimize";
  // Headers that drag their dialog (materials, shading) must not start a
  // drag - and capture the pointer - from this button.
  button.addEventListener("pointerdown", (event) => event.stopPropagation());
  button.addEventListener("click", () => {
    panel.classList.toggle("is-minimized");
    syncMinimize(panel, button);
    if (panel.classList.contains("is-undocked")) clampPanel(panel);
  });
  return button;
}

function syncMinimize(panel, button) {
  const minimized = panel.classList.contains("is-minimized");
  const label = minimized ? t("toolPanel.restore", "Restore panel") : t("toolPanel.minimize", "Minimize panel");
  button.textContent = minimized ? "▢" : "–";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-expanded", String(!minimized));
}

// Adds the grip (first in `header`) and the minimize button (before `before`,
// or last) to a panel. `movable: false` for dialogs that already drag by
// their header; `visibilityRoot`: the element whose `hidden` shows and hides
// the panel, when that is not the panel itself. Safe to call again on every
// render: panels that rebuild their header get the same buttons put back.
// While minimized, only the header stays visible (tool-panel-chrome in
// viewer-tools.css).
export function attachToolPanelChrome(panel, header, {
  before = null,
  minimizable = true,
  movable = true,
  visibilityRoot = panel,
} = {}) {
  if (!panel || !header || !isToolPanelChromeEnabled()) return;
  if (!panel.toolPanelChrome) {
    panel.toolPanelChrome = {
      grip: movable ? createGrip(panel) : null,
      minimize: minimizable ? createMinimize(panel) : null,
    };
    panel.classList.add("has-tool-chrome");
    watchPanelVisibility(panel, visibilityRoot);
  }
  const { grip, minimize } = panel.toolPanelChrome;
  header.classList.add("tool-panel-chrome");
  if (grip) {
    const label = t("toolPanel.move", "Move panel (double tap: dock)");
    grip.title = label;
    grip.setAttribute("aria-label", label);
    if (header.firstChild !== grip) header.prepend(grip);
  }
  if (minimize) {
    syncMinimize(panel, minimize);
    const anchor = before && before.parentNode === header ? before : null;
    if (minimize.nextSibling !== anchor || minimize.parentNode !== header) header.insertBefore(minimize, anchor);
  }
}
