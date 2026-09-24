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
