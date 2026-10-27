import { core } from "../core.js";

// Column in the top-right corner of the viewer that holds the floating tool
// panels (animation player, measurements, section planes), so they stack
// instead of overlapping.
export function getViewerSideStack() {
  if (!core.container) return null;
  let stack = core.container.querySelector(":scope > .viewer-side-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "viewer-side-stack";
    core.container.appendChild(stack);
  }
  return stack;
}

// A tall panel in the column, kept within the viewer's height (it scrolls
// inside instead of running past the viewer's bottom edge, e.g. in a page
// that gives the viewer little height). Follows the viewer's size while the
// panel is in the page.
export function fitPanelToViewer(panel, margin = 24) {
  const container = core.container;
  if (!panel || !container || typeof ResizeObserver === "undefined") return;
  const fit = () => {
    if (!panel.isConnected) {
      observer.disconnect();
      return;
    }
    panel.style.maxHeight = `${Math.max(220, container.clientHeight - margin)}px`;
  };
  const observer = new ResizeObserver(fit);
  observer.observe(container);
  fit();
}
