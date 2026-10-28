import { truncateString } from "./utils.js";
import { setupObject, setupCamera, toastHelper } from './viewer-utils.js';
import { core } from './core.js';
import { t } from "./i18n-utils.js";
import { parseFloatParam } from "./viewer-param-utils.js";
import { clearIfcProperties } from "./ifc-properties.js";
import { workerSettingsUrl } from "./worker-model.js";
import { attachManifestTreeEditor } from "./manifesto/manifest-tree-editor.js";
import { exampleManifestOption, getExampleManifests, groupExampleOptions, refreshExampleManifests } from "./example-manifests.js";

// Below this distance (px) from its default glued corner, drag movement is
// absorbed rather than moved - the panel only actually detaches from the
// viewer frame's edge past a deliberate drag, instead of on the first pixel.
const METADATA_GLUE_THRESHOLD = 28;

// How close to the window's bottom-right corner a pointerdown has to land to
// count as grabbing the native resize grip (see isPointerInResizeCorner()).
const METADATA_RESIZE_HOTSPOT = 18;

// The metadata window's distance (px) from the viewer's edges and the toolbar.
const METADATA_WINDOW_MARGIN = 8;

let metadataResizeObserver = null;
let metadataHostResizeObserver = null;
let metadataNativeResizeActive = false;
let metadataNativeResizeReleaseTimer = null;
// Where the metadata window was dragged to (host px), kept while the viewer
// is open; null: just below the card.
let metadataWindowPosition = null;
// Saved settings handed over for the next model opened from a File: a
// repository model the app downloaded (or kept on the device), whose
// blob: URL has no folder to find metadata/<file>_viewer.json in.
let pendingSavedSettings = null;

export function setPendingSavedSettings(data) {
  pendingSavedSettings = data && typeof data === "object" && !Array.isArray(data) ? data : null;
}

let modelSettingsResetState = null;

function captureModelSettingsResetState(object) {
  const objects = Array.isArray(object) ? object : [object];

  modelSettingsResetState = {
    object,
    setupIndex: core.objectsConfig?.setupIndex,
    transforms: objects.map((model) => ({
      model,
      position: model.position.clone(),
      rotation: model.rotation.clone(),
      scale: model.scale.clone(),
    })),
  };
}

// Progressive loading swaps the preview model for the full one in place
// (see loaders.js): point the reset state at the new object, keeping the
// transform captured for the preview.
export function replaceModelSettingsResetObject(previousObject, nextObject) {
  if (!modelSettingsResetState || modelSettingsResetState.object !== previousObject) return;
  modelSettingsResetState.object = nextObject;
  modelSettingsResetState.transforms.forEach((entry) => {
    if (entry.model === previousObject) entry.model = nextObject;
  });
}

// Rebuilds the hierarchy submenu and the vertex/face counts shown in the
// metadata panel for a swapped-in model, without re-running the camera and
// metadata setup of handleMetadataResponse().
export function refreshModelHierarchyAndStats(object) {
  const stats = { vertices: 0, faces: 0 };
  Viewer.clearHierarchySubmenu();
  const root = Array.isArray(object) ? object[0] : object;
  root?.traverse?.((child) => {
    if (child.isPoints) stats.vertices += fetchMetadata(child, "vertices");
    if (!child.isMesh) return;
    stats.vertices += fetchMetadata(child, "vertices");
    stats.faces += fetchMetadata(child, "faces");
    if (child.name === "") child.name = "Mesh";
    Viewer.addHierarchySubmenuItem(truncateString(child.name, 35), child.id);
  });
  ["vertices", "faces"].forEach((key) => {
    core.metadataContainer?.querySelectorAll?.(`[data-metadata-count="${key}"]`).forEach((node) => {
      node.dataset.count = String(stats[key]);
    });
  });
  updateMetadataCounts(core.metadataContainer);
  return stats;
}

// A count in the viewer's language (108 315, 108,315, 108.315).
export function formatMetadataCount(value) {
  const count = Number(value);
  if (!Number.isFinite(count)) return String(value ?? "");
  try {
    return new Intl.NumberFormat(core.currentLanguage || "en", { maximumFractionDigits: 0 }).format(count);
  } catch (_error) {
    return String(Math.round(count));
  }
}

// Writes the counts ([data-metadata-count] with data-count) of the metadata
// card in the viewer's language: the stat tiles and the header's summary.
export function updateMetadataCounts(root = core.metadataContainer) {
  if (!root) return;
  root.querySelectorAll("[data-metadata-count]").forEach((node) => {
    node.textContent = formatMetadataCount(node.dataset.count);
  });
  const summary = root.querySelector(".metadata-toggle-summary");
  if (summary) {
    summary.textContent = t("metadata.summary", {
      format: summary.dataset.format || "",
      vertices: formatMetadataCount(summary.dataset.vertices),
    }, "{format} · {vertices} vertices");
  }
}

export async function resetModelSettings() {
  if (!modelSettingsResetState?.object) return;

  modelSettingsResetState.transforms.forEach(({ model, position, rotation, scale }) => {
    model.position.copy(position);
    model.rotation.copy(rotation);
    model.scale.copy(scale);
    model.updateMatrixWorld(true);
  });

  if (typeof modelSettingsResetState.setupIndex !== "undefined" && core.objectsConfig) {
    core.objectsConfig.setupIndex = modelSettingsResetState.setupIndex;
  }

  window.Viewer?.hydrateAnnotationsFromMetadataPayload?.(null);
  // The materials as loaded too (editor/materials-editor.js).
  window.Viewer?.resetAllMaterials?.();
  await handleMetadataResponse(null, { vertices: 0, faces: 0 }, modelSettingsResetState.object);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildMetadataRow(label, value) {
  if (!label || typeof value === "undefined" || value === null || value === "") {
    return "";
  }

  return (
    '<div class="metadata-row">' +
      '<span class="metadata-label">' + escapeHtml(label) + '</span>' +
      '<span class="metadata-value">' + escapeHtml(value) + '</span>' +
    '</div>'
  );
}

/**
 * Formats WissKI metadata labels and values for display.
 */
export function addWissKIMetadata(label, value) {
  if (typeof label !== "undefined" && typeof value !== "undefined") {
    var _str = "";
    label = label.replace("wisski_path_3d_model__", "");
    switch (label) {
      case "title":
        _str = t("metadata.title", "Title");
        break;
      case "author_name":
        _str = t("metadata.author", "Author");
        break;
      case "author_affiliation":
        _str = t("metadata.authorAffiliation", "Author affiliation");
        break;
      case "license":
        _str = t("metadata.license", "License");
        break;
      case "description":
        _str = t("metadata.description", "Description");
        break;
      case "object_type":
        _str = t("metadata.objectType", "Object type");
        break;
      case "reconstruction_authors":
        _str = t("metadata.reconstructionAuthors", "Reconstruction authors");
        break;
      case "reconstruction_period":
        _str = t("metadata.reconstructionPeriod", "Reconstruction period");
        break;
      default:
        _str = "";
        break;
    }

    if (_str !== "") {
      return buildMetadataRow(_str, value);
    }
  }
}

/**
 * Opens/closes the metadata window (the card is its button).
 */
export function expandMetadata() {
  const win = document.getElementById("metadata-window");
  if (!win) return;
  setMetadataWindowOpen(win.hidden || win.classList.contains("metadata-window-closing"));
}

export function isMetadataWindowOpen() {
  const win = document.getElementById("metadata-window");
  return Boolean(win && !win.hidden && !win.classList.contains("metadata-window-closing"));
}

// Back (ui/back-navigation.js): false when it was not open.
export function closeMetadataWindow() {
  if (!isMetadataWindowOpen()) return false;
  setMetadataWindowOpen(false);
  return true;
}

function setMetadataWindowOpen(open) {
  const win = document.getElementById("metadata-window");
  const toggle = document.getElementById("metadata-collapse");
  const card = document.getElementById("metadata-card");
  if (!win || !toggle) return;

  toggle.classList.toggle("metadata-collapsed", !open);
  toggle.setAttribute("aria-expanded", String(open));
  card?.classList.toggle("metadata-open", open);
  // Its entry in the Model menu (editor-toolbar.js), once the window shows
  // or has started closing.
  requestAnimationFrame(() => window.Viewer?.updateEditorToolbarState?.());

  if (!open) {
    if (win.hidden) return;
    // It shrinks back into the card, then hides (at once without the
    // animation, e.g. with reduced motion).
    const hide = () => {
      if (!win.classList.contains("metadata-window-closing")) return;
      win.classList.remove("metadata-window-closing", "metadata-window-overflowing");
      win.hidden = true;
      win.querySelectorAll(".metadata-row-pinned").forEach((row) => {
        row.classList.remove("metadata-row-pinned");
      });
    };
    setMetadataWindowOrigin(win);
    win.classList.add("metadata-window-closing");
    if (getComputedStyle(win).animationName === "none") hide();
    else win.addEventListener("animationend", hide, { once: true });
    return;
  }

  win.classList.remove("metadata-window-closing");
  win.hidden = false;
  const { width, height } = getInitialMetadataSize();
  if (width != null) win.style.width = `${width}px`;
  if (height != null) win.style.height = `${height}px`;
  placeMetadataWindow(win, metadataWindowPosition);
  // Grows out of the card: the animation restarted from its centre.
  setMetadataWindowOrigin(win);
  win.style.animation = "none";
  void win.offsetWidth;
  win.style.removeProperty("animation");
  updateMetadataOverflow();
}

// The window's animations (main.css) scale from the card's centre, wherever
// the two are.
function setMetadataWindowOrigin(win) {
  const card = document.getElementById("metadata-card");
  if (!card) return;
  const cardRect = card.getBoundingClientRect();
  // No card on screen (opened from the menus): from the window's corner.
  if (!cardRect.width) {
    win.style.removeProperty("--window-origin-x");
    win.style.removeProperty("--window-origin-y");
    return;
  }
  const x = (parseFloat(win.style.getPropertyValue("--window-x")) || 0);
  const y = (parseFloat(win.style.getPropertyValue("--window-y")) || 0);
  const host = getMetadataDragHost()?.getBoundingClientRect();
  if (!host) return;
  win.style.setProperty("--window-origin-x", `${cardRect.left + cardRect.width / 2 - host.left - x}px`);
  win.style.setProperty("--window-origin-y", `${cardRect.top + cardRect.height / 2 - host.top - y}px`);
}

function updateMetadataOverflow() {
  const win = document.getElementById("metadata-window");
  const content = document.getElementById("metadata-content");

  if (!win || !content || win.hidden) return;

  const hasOverflow = content.scrollHeight - content.clientHeight > 8;
  win.classList.toggle("metadata-window-overflowing", hasOverflow);

  content.querySelectorAll(".metadata-row").forEach((row) => {
    const value = row.querySelector(".metadata-value");
    if (!value) return;

    const wasPinned = row.classList.contains("metadata-row-pinned");
    row.classList.remove("metadata-row-pinned", "metadata-row-expandable");

    const isExpandable = value.scrollHeight - value.clientHeight > 4;
    row.classList.toggle("metadata-row-expandable", isExpandable);

    if (wasPinned && isExpandable) {
      row.classList.add("metadata-row-pinned");
    }
  });
}

function bindMetadataInteractions() {
  if (core.metadataContainer.dataset.boundCollapse === "true") return;

  core.metadataContainer.addEventListener("click", (e) => {
    if (e.target.closest("#metadata-collapse")) {
      expandMetadata();
      return;
    }
    if (e.target.closest(".metadata-window-close")) {
      setMetadataWindowOpen(false);
      document.getElementById("metadata-collapse")?.focus();
      return;
    }

    const content = document.getElementById("metadata-content");
    const row = e.target.closest(".metadata-row");
    if (!content || !row || !content.contains(row)) return;

    const willPin = !row.classList.contains("metadata-row-pinned");
    content.querySelectorAll(".metadata-row-pinned").forEach((pinnedRow) => {
      pinnedRow.classList.remove("metadata-row-pinned");
    });
    if (willPin) row.classList.add("metadata-row-pinned");
  });

  core.metadataContainer.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !e.target.closest("#metadata-window")) return;
    e.preventDefault();
    e.stopPropagation();
    setMetadataWindowOpen(false);
    document.getElementById("metadata-collapse")?.focus();
  });

  // The card and the window are rebuilt (innerHTML) on every
  // handleMetadataResponse() call, so their drag handles are fresh elements
  // each time - delegate from the container (which persists) instead.
  core.metadataContainer.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".metadata-drag-handle")) {
      startMetadataDrag(e);
      return;
    }
    if (e.target.closest(".metadata-window-header") && !e.target.closest(".metadata-window-close")) {
      startMetadataWindowDrag(e);
      return;
    }

    const win = e.target.closest("#metadata-window");
    if (win && isPointerInResizeCorner(win, e.clientX, e.clientY)) {
      beginNativeResizeTracking();
    }
  });

  window.addEventListener("resize", updateMetadataOverflow);
  core.metadataContainer.dataset.boundCollapse = "true";
}

function getMetadataContainerConfig() {
  return core.CONFIG?.viewer?.metadataContainer || {};
}

function getInitialMetadataPosition() {
  const position = getMetadataContainerConfig().position || {};
  return {
    x: parseFloatParam(position.x) ?? 0,
    y: parseFloatParam(position.y) ?? 0,
  };
}

function setStoredMetadataPosition(x, y) {
  core.CONFIG ??= {};
  core.CONFIG.viewer ??= {};
  core.CONFIG.viewer.metadataContainer ??= {};
  core.CONFIG.viewer.metadataContainer.position = {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
  };
}

// The stored size is the window's (the card itself is not resizable).
function getInitialMetadataSize() {
  const size = getMetadataContainerConfig().size || {};
  return {
    width: parseFloatParam(size.width),
    height: parseFloatParam(size.height),
  };
}

function setStoredMetadataSize(width, height) {
  core.CONFIG ??= {};
  core.CONFIG.viewer ??= {};
  core.CONFIG.viewer.metadataContainer ??= {};
  core.CONFIG.viewer.metadataContainer.size = {
    width: Number.isFinite(width) ? width : null,
    height: Number.isFinite(height) ? height : null,
  };
}

function getMetadataDragHost() {
  // Unlike editorToolbar/manifestoForm (which prefer the wrapper, since one
  // can render outside the 3D canvas), the metadata panel is an overlay ON
  // the model - it should stay confined to the actual viewer viewport, not
  // the taller wrapper that can also contain e.g. the manifesto form below it.
  return core.container || core.viewerWrapper || null;
}

function clampMetadataPosition(card, x, y) {
  const host = getMetadataDragHost();
  const hostRect = host?.getBoundingClientRect();
  if (!hostRect) return { x, y };

  // The card's untransformed rest position is the host's top-left corner
  // (see #metadata-container { left: 0 } in main.css), so a translate of 0
  // to (hostWidth - cardWidth)/(hostHeight - cardHeight) keeps it fully
  // inside the viewer, unlike editorToolbar's looser +-hostSize clamp.
  const maxX = Math.max(hostRect.width - card.offsetWidth, 0);
  const maxY = Math.max(hostRect.height - card.offsetHeight, 0);

  return {
    x: Math.min(Math.max(x, 0), maxX),
    y: Math.min(Math.max(y, 0), maxY),
  };
}

function applyMetadataPosition(card, x, y) {
  card.style.setProperty("--drag-x", `${x}px`);
  card.style.setProperty("--drag-y", `${y}px`);
  setStoredMetadataPosition(x, y);
}

function startMetadataDrag(event) {
  if (event.button !== 0) return;
  const card = document.getElementById("metadata-card");
  if (!card) return;

  event.preventDefault();

  const origin = getInitialMetadataPosition();
  // Only glued (resisting small drags) when still sitting exactly at the
  // default corner position - once the user has deliberately moved it away,
  // further drags follow the pointer 1:1 like editorToolbar's.
  const glued = origin.x === 0 && origin.y === 0;
  const startX = event.clientX;
  const startY = event.clientY;

  card.classList.add("metadata-dragging");

  const onPointerMove = (moveEvent) => {
    const rawDx = moveEvent.clientX - startX;
    const rawDy = moveEvent.clientY - startY;

    const dx = glued ? Math.sign(rawDx) * Math.max(Math.abs(rawDx) - METADATA_GLUE_THRESHOLD, 0) : rawDx;
    const dy = glued ? Math.sign(rawDy) * Math.max(Math.abs(rawDy) - METADATA_GLUE_THRESHOLD, 0) : rawDy;

    const next = clampMetadataPosition(card, origin.x + dx, origin.y + dy);
    applyMetadataPosition(card, next.x, next.y);
  };

  const stopDrag = () => {
    card.classList.remove("metadata-dragging");
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", stopDrag);
    document.removeEventListener("pointercancel", stopDrag);
  };

  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", stopDrag);
  document.addEventListener("pointercancel", stopDrag);
}

// The window's room in the viewer (host coordinates): the viewer less the
// toolbar's side of it - along the bottom (desktop bar, phone tabs) the
// window stays above it, down the left edge (phone rail) beside it.
function getMetadataWindowBounds() {
  const host = getMetadataDragHost();
  const hostRect = host?.getBoundingClientRect();
  if (!hostRect) return null;

  const bounds = {
    left: METADATA_WINDOW_MARGIN,
    top: METADATA_WINDOW_MARGIN,
    right: hostRect.width - METADATA_WINDOW_MARGIN,
    bottom: hostRect.height - METADATA_WINDOW_MARGIN,
  };

  const toolbar = core.editorToolbar;
  if (toolbar && host.contains(toolbar) && !toolbar.classList.contains("editorToolbar-hidden")) {
    // The menus' dock and what floats beside it (on a phone the navigation
    // bar, outside the dock's own box), each part for itself: a tall one
    // (the rail) keeps the window beside it, a wide one above or below it.
    const dock = toolbar.querySelector(":scope > .viewer-menus_dock") || toolbar;
    [dock, ...dock.children].forEach((element) => {
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x0 = rect.left - hostRect.left;
      const x1 = rect.right - hostRect.left;
      const y0 = rect.top - hostRect.top;
      const y1 = rect.bottom - hostRect.top;
      if (rect.height > rect.width) {
        if (x1 <= hostRect.width / 2) bounds.left = Math.max(bounds.left, x1 + METADATA_WINDOW_MARGIN);
        else bounds.right = Math.min(bounds.right, x0 - METADATA_WINDOW_MARGIN);
      } else if (y0 >= hostRect.height / 2) {
        bounds.bottom = Math.min(bounds.bottom, y0 - METADATA_WINDOW_MARGIN);
      } else {
        bounds.top = Math.max(bounds.top, y1 + METADATA_WINDOW_MARGIN);
      }
    });
  }
  return bounds;
}

// Puts the window at (x, y), or just below the card, kept inside its room:
// narrower and lower when the room is.
function placeMetadataWindow(win, position = null) {
  const bounds = getMetadataWindowBounds();
  if (!bounds) return;

  const roomWidth = Math.max(bounds.right - bounds.left, 160);
  const roomHeight = Math.max(bounds.bottom - bounds.top, 120);
  win.style.maxWidth = `${roomWidth}px`;
  win.style.maxHeight = `${roomHeight}px`;

  let { x, y } = position || {};
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    const card = document.getElementById("metadata-card");
    const host = getMetadataDragHost();
    const cardRect = card?.getBoundingClientRect();
    const hostRect = host?.getBoundingClientRect();
    x = cardRect && hostRect ? cardRect.left - hostRect.left : bounds.left;
    y = cardRect && hostRect ? cardRect.bottom - hostRect.top + METADATA_WINDOW_MARGIN : bounds.top;
  }

  const maxX = Math.max(bounds.right - win.offsetWidth, bounds.left);
  const maxY = Math.max(bounds.bottom - win.offsetHeight, bounds.top);
  x = Math.min(Math.max(x, bounds.left), maxX);
  y = Math.min(Math.max(y, bounds.top), maxY);

  win.style.setProperty("--window-x", `${x}px`);
  win.style.setProperty("--window-y", `${y}px`);
  if (position) metadataWindowPosition = { x, y };
}

function startMetadataWindowDrag(event) {
  if (event.button !== 0) return;
  const win = document.getElementById("metadata-window");
  if (!win) return;

  event.preventDefault();

  const origin = {
    x: parseFloat(win.style.getPropertyValue("--window-x")) || 0,
    y: parseFloat(win.style.getPropertyValue("--window-y")) || 0,
  };
  const startX = event.clientX;
  const startY = event.clientY;

  win.classList.add("metadata-dragging");

  const onPointerMove = (moveEvent) => {
    placeMetadataWindow(win, {
      x: origin.x + moveEvent.clientX - startX,
      y: origin.y + moveEvent.clientY - startY,
    });
  };

  const stopDrag = () => {
    win.classList.remove("metadata-dragging");
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", stopDrag);
    document.removeEventListener("pointercancel", stopDrag);
  };

  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", stopDrag);
  document.addEventListener("pointercancel", stopDrag);
}

// The window's own size also changes from the room shrinking (max-width/
// max-height) - not a user resize. Only trust a ResizeObserver firing as one
// while the user is actually holding the native grip down.
function isPointerInResizeCorner(element, clientX, clientY) {
  const rect = element.getBoundingClientRect();
  return (
    clientX >= rect.right - METADATA_RESIZE_HOTSPOT && clientX <= rect.right + 4 &&
    clientY >= rect.bottom - METADATA_RESIZE_HOTSPOT && clientY <= rect.bottom + 4
  );
}

function beginNativeResizeTracking() {
  metadataNativeResizeActive = true;
  clearTimeout(metadataNativeResizeReleaseTimer);

  const release = () => {
    // A short grace period so the ResizeObserver entry for the drag's final
    // frame (delivered asynchronously after pointerup) still lands while
    // tracking is considered active.
    metadataNativeResizeReleaseTimer = setTimeout(() => {
      metadataNativeResizeActive = false;
    }, 100);
    document.removeEventListener("pointerup", release);
    document.removeEventListener("pointercancel", release);
  };
  document.addEventListener("pointerup", release);
  document.addEventListener("pointercancel", release);
}

// Resize itself is native CSS ("#metadata-window { resize: both }" in
// main.css, its room capping it through max-width/max-height) - a
// ResizeObserver just persists the result.
function observeMetadataResize(win) {
  metadataResizeObserver?.disconnect();

  metadataResizeObserver = new ResizeObserver(() => {
    if (!metadataNativeResizeActive || win.hidden) return;
    setStoredMetadataSize(Math.round(win.offsetWidth), Math.round(win.offsetHeight));
    updateMetadataOverflow();
  });
  metadataResizeObserver.observe(win);
}

// Keep the card and the window inside the viewer (and the window off the
// toolbar) when the viewer is resized or the toolbar changes its layout.
function observeMetadataHost(card, win) {
  const host = getMetadataDragHost();
  metadataHostResizeObserver?.disconnect();
  if (!host) return;

  metadataHostResizeObserver = new ResizeObserver(() => {
    const { x, y } = getInitialMetadataPosition();
    const next = clampMetadataPosition(card, x, y);
    applyMetadataPosition(card, next.x, next.y);
    if (win && !win.hidden) {
      placeMetadataWindow(win, metadataWindowPosition);
      updateMetadataOverflow();
    }
  });
  metadataHostResizeObserver.observe(host);
  if (core.editorToolbar) metadataHostResizeObserver.observe(core.editorToolbar);
}

function initializeMetadataDragAndResize() {
  const card = document.getElementById("metadata-card");
  const win = document.getElementById("metadata-window");
  if (!card) return;

  if (core.container && getComputedStyle(core.container).position === "static") {
    core.container.style.position = "relative";
  }

  const { x, y } = getInitialMetadataPosition();
  applyMetadataPosition(card, x, y);

  if (win) observeMetadataResize(win);
  observeMetadataHost(card, win);
}

/**
 * Appends metadata HTML to the DOM.
 */
// The address of the manifest the model came from, or null: the URL it was
// loaded from, else its id when that is a web address (a manifest given as
// text has no other).
function currentManifestUrl() {
  const manifest = window.Viewer?.currentManifest;
  if (!manifest) return null;
  const source = manifest.source;
  if (manifest.type !== "text" && typeof source === "string" && !source.trim().startsWith("{")) {
    try {
      return new URL(source, window.location.href).href;
    } catch {
      return null;
    }
  }
  const id = manifest.json?.id || manifest.json?.["@id"];
  return typeof id === "string" && /^https?:\/\//.test(id) ? id : null;
}

export function appendMetadata(
  metadataContent
) {
  core.metadataContainer.innerHTML = metadataContent;

  if (!core.container.contains(core.metadataContainer)) {
    core.container.appendChild(core.metadataContainer);
  }
}

async function fetchEntityMetadata() {
  if (!core.CONFIG.entity.metadata.sourceType || core.CONFIG.entity.metadata.url === "") {
    return "";
  }

  const entityComponent = core.CONFIG.entity.id == null ? "" : encodeURIComponent(core.CONFIG.entity.id);
  console.log("Fetching entity metadata for ID:", entityComponent);
  if (!entityComponent) {
    console.warn("Entity ID is missing or invalid. Skipping metadata fetch.");
    return "";
  }
  const metadataUrl = core.CONFIG.entity.metadata.url.replace(/\/$/, "") + "/" + entityComponent;

  try {
    const response = await fetch(metadataUrl, { cache: "no-cache" });

    if (!response.ok) {
      console.warn("Metadata request failed with status:", response.status);
      return "";
    }

    const responseText = await response.text();

    try {
      const jsonData = JSON.parse(responseText);
      const record = Array.isArray(jsonData) ? jsonData[0] : jsonData;

      if (!record || typeof record !== "object") {
        return "";
      }

      console.log("Processing JSON metadata:", record);

      const jsonFieldMap = {
        title: "title",
        reconstruction_authors: "author_name",
        reconstruction_authors_affiliation: "author_affiliation",
        reconstruction_license: "license",
        reconstruction_time_frame: "reconstruction_period",
        object_description: "description",
        object_type: "object_type",
      };

      let entityMetadataContent = "";
      for (const [jsonField, metadataLabel] of Object.entries(jsonFieldMap)) {
        if (record[jsonField]) {
          const fetchedValue = addWissKIMetadata(metadataLabel, record[jsonField]);
          if (typeof fetchedValue !== "undefined") {
            entityMetadataContent += fetchedValue;
          }
        }
      }

      return entityMetadataContent;
    } catch (_jsonError) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(responseText, "application/xml");

      if (doc.documentElement.tagName === "parsererror") {
        console.error("XML parsing error:", doc.documentElement.textContent);
        return "";
      }

      let entityMetadataContent = "";
      if (doc.documentElement.childNodes.length > 0) {
        var data = doc.documentElement.childNodes[0].childNodes;
        if (data !== undefined) {
          for (var i = 0; i < data.length; i++) {
            var fetchedValue = addWissKIMetadata(data[i].tagName, data[i].textContent);
            if (typeof fetchedValue !== "undefined") {
              entityMetadataContent += fetchedValue;
            }
          }
        }
      }

      return entityMetadataContent;
    }
  } catch (error) {
    console.error("Error processing metadata:", error);
    return "";
  }
}

export function fetchMetadata(_object, _type) {
  if (!_object?.geometry) return 0;

  const indexedCount = _object.geometry.index?.count;
  const positionCount = _object.geometry.attributes?.position?.count ?? 0;

  switch (_type) {
    case "vertices":
      return positionCount;
    case "faces":
      if (_object.isPoints || _object.isLine) return 0;
      return (indexedCount ?? positionCount) / 3;
    default:
      return 0;
  }
}
/**
 * Handles metadata response and builds the metadata UI.
 */
export async function handleMetadataResponse(
  data,
  metadata,
  object,
) {
  Viewer.clearHierarchySubmenu();
  var tempArray = [];
  if (Array.isArray(object)) {
    setupObject(object[0], data);
    await setupCamera(object[0], data);
  } else if (object.name === "Scene" || object.children.length > 0 || object.type == "Mesh") {
    setupObject(object, data);
    object.traverse(function (child) {
      // Point clouds (e.g. LAS/LAZ, wrapped in a Group) have points but no faces.
      if (child.isPoints) metadata["vertices"] += fetchMetadata(child, "vertices");
      // Gaussian splats (splats.js): each splat counts as a point.
      if (Number.isFinite(child.userData?.gaussianSplats?.count)) metadata["vertices"] += child.userData.gaussianSplats.count;
      if (child.isMesh) {
        metadata["vertices"] += fetchMetadata(child, "vertices");
        metadata["faces"] += fetchMetadata(child, "faces");
        if (child.name === "") child.name = "Mesh";
        var shortChildName = truncateString(child.name, 35);
        
        Viewer.addHierarchySubmenuItem(shortChildName, child.id);
        
        child.traverse(function (children) {
          if (children.isMesh && children.name !== child.name) {
            if (children.name === "") children.name = "ChildrenMesh";
            var shortChildrenName = truncateString(children.name, 35);
            Viewer.addHierarchySubmenuItem(shortChildrenName, children.id);
          }
        });
      }
    });
    await setupCamera(object, data);
  } else {
    setupObject(object, data);
    await setupCamera(object, data);
    metadata["vertices"] += fetchMetadata(object, "vertices");
    metadata["faces"] += fetchMetadata(object, "faces");
    if (object.name === "") {
      Viewer.addHierarchySubmenuItem("Mesh", object.id);
      object.name = object.id;
    } else {
      Viewer.addHierarchySubmenuItem(object.name, object.id);
    }
  }

  if (!core.metadataContainer) {
    core.metadataContainer = document.createElement("div");
    core.metadataContainer.id = "metadata-container";
  }
  core.metadataContainer.setAttribute("data-viewer-theme", core.container?.closest(".viewer-wrapper")?.getAttribute("data-viewer-theme") || "dark");

  // Header: the file and a one-line summary; open, the counts as tiles, then
  // the entity's own metadata as a list.
  const fileName = `${core.fileObject.basename}.${core.fileObject.extension}`;
  const fileFormat = String(core.fileObject.extension || "").toUpperCase();
  const statTile = (key, fallback) =>
    '<div class="metadata-stat">' +
      '<span class="metadata-stat-value" data-metadata-count="' + key + '" data-count="' + escapeHtml(metadata[key]) + '">' +
        escapeHtml(formatMetadataCount(metadata[key])) +
      '</span>' +
      '<span class="metadata-stat-label" data-i18n-key="metadata.' + key + '">' + escapeHtml(t(`metadata.${key}`, fallback)) + '</span>' +
    '</div>';

  // A model from a IIIF (or AIM3D) manifest: the IIIF icon, linking to the
  // manifest. The community's drag-and-drop convention: dropped on another
  // IIIF viewer (Mirador, Universal Viewer) it opens the same manifest there.
  const manifestUrl = currentManifestUrl();
  const iiifLink = manifestUrl
    ? '<a class="metadata-iiif" href="' + escapeHtml(manifestUrl) + '" target="_blank" rel="noopener"' +
        ' title="' + escapeHtml(t("metadata.iiifManifest", "IIIF manifest: drag it into another IIIF viewer, or open it")) + '">' +
        '<img src="' + escapeHtml(`${core.DFG_ASSETS || "assets"}/img/logo/iiif.png`) + '" alt="IIIF" width="22" height="20">' +
      '</a>'
    : '';

  var metadataContent =
    '<div id="metadata-card"' + (iiifLink ? ' class="metadata-has-iiif"' : '') + '>' +
      '<div class="metadata-drag-handle" title="' + escapeHtml(t("metadata.move", "Move")) + '"></div>' +
      '<button id="metadata-collapse" class="metadata-collapse metadata-collapsed" type="button" aria-expanded="false" aria-controls="metadata-window"' +
        ' aria-label="' + escapeHtml(t("metadata.modelDetails", "Model details")) + ': ' + escapeHtml(fileName) + '">' +
        '<span class="metadata-toggle-copy">' +
          '<span class="metadata-toggle-title" title="' + escapeHtml(fileName) + '">' + escapeHtml(fileName) + '</span>' +
          '<span class="metadata-toggle-summary" data-format="' + escapeHtml(fileFormat) + '" data-vertices="' + escapeHtml(metadata["vertices"]) + '">' +
            escapeHtml(t("metadata.summary", { format: fileFormat, vertices: formatMetadataCount(metadata["vertices"]) }, "{format} · {vertices} vertices")) +
          '</span>' +
        '</span>' +
        '<span class="metadata-toggle-chevron" aria-hidden="true"></span>' +
      '</button>' +
      iiifLink +
    '</div>' +
    '<div id="metadata-window" role="dialog" aria-labelledby="metadata-window-title" hidden>' +
      '<div class="metadata-window-header" title="' + escapeHtml(t("metadata.move", "Move")) + '">' +
        '<span id="metadata-window-title" class="metadata-window-title" data-i18n-key="metadata.modelDetails">' + escapeHtml(t("metadata.modelDetails", "Model details")) + '</span>' +
        '<button class="metadata-window-close" type="button" aria-label="' + escapeHtml(t("metadata.close", "Close")) + '" title="' + escapeHtml(t("metadata.close", "Close")) + '">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
        '</button>' +
      '</div>' +
      '<div id="metadata-content" class="metadata-content">' +
        '<div class="metadata-stats">' +
          statTile("vertices", "Vertices") +
          statTile("faces", "Faces") +
        '</div>' +
        // A repository model's name, type, author... (ui/model-metadata.js),
        // filled in once fetched.
        '<div id="metadata-repository" class="metadata-repository" hidden></div>';
  metadataContent += await fetchEntityMetadata();

  if (!core.downloadModel) {
    if (core.downloadModelElement) {
      core.downloadModelElement.hidden = true;
      core.downloadModelElement.removeAttribute("href");
    }
  } else {
    const c_path = core.fileObject.path;
    if (core.loadedFile !== "") {
      core.fileObject.filename = core.fileObject.filename.replace(core.fileObject.orgExtension, core.fileObject.extension);
    }

    if (core.downloadModelElement) {
      core.downloadModelElement.href = `${encodeURI(c_path + core.fileObject.filename)}`;
      core.downloadModelElement.setAttribute("download", core.fileObject.filename);
      core.downloadModelElement.hidden = true;
    }
    window.Viewer?.updateDownloadMenuEntryLabel?.();    
  }

  if (core.viewEntity) {
    core.viewEntity.hidden = true;
    core.viewEntity.removeAttribute("data-embed-url");
  }
  if (window.Viewer?.shareView) {
    window.Viewer.shareView.hidden = true;
    window.Viewer.shareView.removeAttribute("data-share-url");
  }

  if (core.viewEntity && (core.CONFIG?.entity?.id || core.fileObject?.originalPath)) {
    const sharePayload = window.Viewer?.getSharePayload?.();
    if (sharePayload?.url) {
      core.viewEntity.setAttribute("data-embed-url", sharePayload.url);
      window.Viewer?.shareView?.setAttribute("data-share-url", sharePayload.url);
      if (window.Viewer?.shareView) {
        window.Viewer.shareView.hidden = false;
      }
    }
    window.Viewer?.updateShareMenuEntryState?.();
    window.Viewer?.updateEmbedMenuEntryState?.();
    core.viewEntity.hidden = false;
  }
  metadataContent +=
      '</div>' +  // #metadata-content
    '</div>';  // #metadata-window
  appendMetadata(metadataContent);
  window.Viewer?.renderRepositoryMetadata?.();
  bindMetadataInteractions();
  initializeMetadataDragAndResize();
  requestAnimationFrame(updateMetadataOverflow);
}

/**
 * Handles settings for the loaded object and camera.
 */
export async function settingsHandler(object, data) {
  if (Array.isArray(object)) {
    setupObject(object[0], data);
    await setupCamera(object[0], data);
  } else if (object.name === "Scene" || object.children.length > 0) {
    setupObject(object, data);
    await setupCamera(object, data);
  } else {
    setupObject(object, data);
    await setupCamera(object, data);
    // Hierarchy is now managed by the editor toolbar submenu
  }
}

async function loadMetadataData(metadataUrl) {
  if (metadataUrl === null || metadataUrl === '') {
    console.log("No metadata found due to null or empty metadata URL", metadataUrl);
    return null;
  }

  try {
    if (core.isLocalPreview) {
      return null;
    }
    const response = await fetch(metadataUrl, { cache: "no-cache" });

    if (response.status === 404) {
      toastHelper("settingsNotFound", "info", {
        filename: core.fileObject.filename
      });
      return null;
    }

    toastHelper("settingsFound", "success", {
      filename: core.fileObject.filename
    });
    return response.json();
  } catch (error) {
    toastHelper("metadataFetchError", "error", {
      error: error.message
    });
    return null;
  }
}

export async function traverseObject (object) {
  if (Array.isArray(object)) {
    // Keep relative transforms between parts; centering each element separately
    // collapses multi-part models into overlapping geometry.
    object.forEach((obj) => {
      obj.updateMatrixWorld(true);
    });
    await setupCamera(object, null);
  } else if (object.name === "Scene" || object.children.length > 0 || object.type == "Mesh") {
    setupObject(object, null);
    await setupCamera(object, null);
  } else {
    setupObject(object, null);
    await setupCamera(object, null);
  }
}

export async function presentationMode (object) {
  if (core.PRESENTATION_MODE) {
    traverseObject(object);
  } else { return; }
}

/**
 * Fetches settings and metadata for the loaded model.
 */
export async function fetchSettings(object) {
  var metadata = { vertices: 0, faces: 0 };
  let metadataUrl = '';

  captureModelSettingsResetState(object);
  clearIfcProperties();
  const pendingSettings = core.fileObject.filename.startsWith('blob:') ? pendingSavedSettings : null;
  pendingSavedSettings = null;

  // Skip metadata fetch for blob URLs (drag & drop files)
  if (core.fileObject.filename.startsWith('blob:')) {
    console.log("Skipping metadata fetch for local file");
  } else if (core.CONFIG.metadataUrl && core.fileObject.uri && core.fileObject.filename) {
    const metadataPrefix = new URL(core.CONFIG.metadataUrl).href.replace(/\/+$/, '') || '';
    // core.fileObject.uri can be a relative path (e.g. a manifest's own model
    // URL resolved against the current page) - resolve it against the page
    // instead of assuming it's already absolute, or this throws.
    let normalizedUri = new URL(core.fileObject.uri, document.baseURI).href.replace(/\/+$/, '');

    if (normalizedUri.startsWith(metadataPrefix)) {
      normalizedUri = normalizedUri.slice(metadataPrefix.length);
    }

    normalizedUri = normalizedUri.replace(/^\/+/, '');
    const metadataBase = new URL(core.CONFIG.metadataUrl);
    const fileUri = new URL(core.fileObject.uri, document.baseURI);

    const filePath = fileUri.pathname.replace(/^\/+|\/+$/g, '');

    metadataUrl = new URL(
      `/${filePath}/metadata/${core.fileObject.filename}_viewer.json`,
      metadataBase
    ).href;
    console.log("Fetched metadata from:", metadataUrl);
  } else {
    console.warn("Metadata URL or file information is missing. Skipping metadata fetch.");
  }

  // A model uploaded to the worker: its settings saved there ("Save
  // settings", metadata-persistence.js), if any - quietly none otherwise.
  const savedSettingsUrl = core.CONFIG.entity?.metadata?.sourceType === "IIIF" || metadataUrl ? null : workerSettingsUrl();

  if (core.CONFIG.entity.metadata.sourceType === "IIIF") {
    console.log("Fetching IIIF metadata from ", core.objectsConfig);
    await handleMetadataResponse( core.CONFIG.model, metadata, object);
  }
  else if (pendingSettings) {
    toastHelper("settingsFound", "success", { filename: `${core.fileObject.basename}.${core.fileObject.extension}` });
    window.Viewer?.hydrateAnnotationsFromMetadataPayload?.(pendingSettings);
    await handleMetadataResponse(pendingSettings, metadata, object);
  }
  else if (savedSettingsUrl) {
    let data = null;
    try {
      const response = await fetch(savedSettingsUrl, { cache: "no-cache" });
      if (response.ok) {
        data = await response.json();
        toastHelper("settingsFound", "success", { filename: core.fileObject.filename });
      }
    } catch (error) {
      console.warn("Saved settings could not be read", error);
    }
    window.Viewer?.hydrateAnnotationsFromMetadataPayload?.(data);
    await handleMetadataResponse(data, metadata, object);
  }
  else if (metadataUrl) {
    console.log("Loading metadata from URL:", metadataUrl);
    if (core.CONFIG.entity.proxyPath !== undefined || core.isLightweight) {
      metadataUrl = core.getProxyPath(metadataUrl, core.CONFIG);
      const data = await loadMetadataData(metadataUrl);
      if (data !== null) window.Viewer?.hydrateAnnotationsFromMetadataPayload?.(data);
      await handleMetadataResponse(data, metadata, object);
    } else {
      const data = await loadMetadataData(metadataUrl);
      if (data !== null) window.Viewer?.hydrateAnnotationsFromMetadataPayload?.(data);
      await handleMetadataResponse(data, metadata, object);
    }
  } else {
    window.Viewer?.hydrateAnnotationsFromMetadataPayload?.(null);
    await handleMetadataResponse(null, metadata, object);
  }
}

// The dropdowns' fill functions, to rename their options with the language.
const exampleDropdownFills = new Set();

export function relocalizeExampleManifestDropdowns() {
  exampleDropdownFills.forEach((fill) => fill());
}

// The example manifests (example-manifests.js) as the first options of the
// manifest form's dropdown; reloaded whenever the form is built and on its
// "Refresh" button. `fixedOptions` come first (the default manifest). The
// manifests of one model sit in an <optgroup> named after it, each named by
// what it changes.
function createExampleManifestDropdown({ labelKey, labelFallback, fixedOptions, pickExamples }) {
  const group = document.createElement("div");
  group.className = "form-manifesto-group";

  const label = document.createElement("label");
  label.textContent = t(labelKey, labelFallback);
  label.dataset.i18n = labelKey;
  label.className = "form-manifesto-label";

  const select = document.createElement("select");
  select.id = "manifesto-manifest-select";
  select.name = "manifesto-manifest-select";

  const refreshButton = document.createElement("button");
  refreshButton.type = "button";
  refreshButton.className = "secondary manifesto-examples-refresh";
  refreshButton.textContent = "↻";
  refreshButton.dataset.i18nTitle = "manifesto.refreshExamples";
  refreshButton.title = t("manifesto.refreshExamples", "Refresh the example list");
  refreshButton.dataset.i18nAriaLabel = "manifesto.refreshExamples";
  refreshButton.setAttribute("aria-label", refreshButton.title);

  const fill = () => {
    if (!select.isConnected && select.options.length) {
      exampleDropdownFills.delete(fill);
      return;
    }
    const selected = select.value;
    const items = [...fixedOptions, ...pickExamples(getExampleManifests()).map(exampleManifestOption)]
      .filter((item) => item?.url);
    select.textContent = "";
    const option = (item) => {
      const opt = document.createElement("option");
      opt.value = item.url;
      opt.textContent = item.name;
      if (item.i18n) opt.dataset.i18n = item.i18n;
      return opt;
    };
    groupExampleOptions(items).forEach(({ group, items: run }) => {
      if (!group) {
        run.forEach((item) => select.appendChild(option(item)));
        return;
      }
      const optgroup = document.createElement("optgroup");
      optgroup.label = group.name;
      run.forEach((item) => optgroup.appendChild(option(item)));
      select.appendChild(optgroup);
    });
    if (selected && items.some((item) => item.url === selected)) select.value = selected;
  };
  exampleDropdownFills.add(fill);

  const refresh = async ({ notify = false } = {}) => {
    refreshButton.disabled = true;
    const { updated } = await refreshExampleManifests();
    refreshButton.disabled = false;
    if (!select.isConnected) return;
    if (updated) fill();
    if (notify && !updated) toastHelper("exampleListRefreshFailed", "warning");
  };

  refreshButton.addEventListener("click", () => refresh({ notify: true }));

  fill();
  group.append(label, select, refreshButton);

  // add on the top
  document.querySelector("#form-manifesto-content").prepend(group);
  refresh();
}

export function createIIIFDropdown(iiifConfigURL) {
  createExampleManifestDropdown({
    labelKey: "iiif.manifest",
    labelFallback: "IIIF manifest",
    fixedOptions: [{ url: iiifConfigURL.url, name: iiifConfigURL.name }],
    // AIM3D manifests are IIIF manifests too (setupManifesto tells them apart).
    pickExamples: ({ iiif, aim3d }) => [...iiif, ...aim3d.filter((manifest) => manifest.inIIIFSelect)],
  });
}

export function createManifestSourceSwitch(activeType = "iiif") {
  const group = document.createElement("div");
  group.className = "form-manifesto-group manifesto-source-group";

  const label = document.createElement("label");
  label.className = "form-manifesto-label";
  label.textContent = t("manifesto.source", "Manifest type");
  label.dataset.i18n = "manifesto.source";

  const switchLabel = document.createElement("label");
  switchLabel.className = "manifesto-source-switch";
  switchLabel.htmlFor = "manifesto-source-switch";
  switchLabel.innerHTML = `
    <span>IIIF</span>
    <input
      id="manifesto-source-switch"
      type="checkbox"
      role="switch"
      data-i18n-aria-label="manifesto.source"
      aria-label="${escapeHtml(t("manifesto.source", "Manifest type"))}"
      ${activeType === "aim3if" ? "checked" : ""}
    >
    <span class="manifesto-source-track" aria-hidden="true"></span>
    <span>AIM3D</span>
  `;

  group.append(label, switchLabel);
  document.querySelector("#form-manifesto-content")?.prepend(group);
}

export function createAIM3IFDropdown(url) {
  createExampleManifestDropdown({
    labelKey: "aim3if.modelConfig",
    labelFallback: "Model configuration",
    fixedOptions: [{ url, i18n: "aim3if.optionDefault", name: t("aim3if.optionDefault", "Default configuration") }],
    pickExamples: ({ aim3d }) => aim3d,
  });
}

function getManifestoFormConfig() {
  return core.CONFIG?.viewer?.manifestoForm || {};
}

function getInitialManifestoPosition() {
  const position = getManifestoFormConfig().position || {};
  return {
    x: parseFloatParam(position.x) ?? 0,
    y: parseFloatParam(position.y) ?? 0,
  };
}

function setStoredManifestoPosition(x, y) {
  core.CONFIG ??= {};
  core.CONFIG.viewer ??= {};
  core.CONFIG.viewer.manifestoForm ??= {};
  core.CONFIG.viewer.manifestoForm.position = {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
  };
}

function setStoredManifestoSize(width, height) {
  core.CONFIG ??= {};
  core.CONFIG.viewer ??= {};
  core.CONFIG.viewer.manifestoForm ??= {};
  core.CONFIG.viewer.manifestoForm.size = {
    width: Number.isFinite(width) ? width : null,
    height: Number.isFinite(height) ? height : null,
  };
}

// Space kept between the form and the browser window's edges.
const MANIFESTO_VIEWPORT_GUTTER = 16;
// Window listeners of the current form - createManifestUI() rebuilds it.
let manifestoFormListeners = null;

// Makes #form-manifesto draggable (via its header) and resizable, and keeps
// both in sync with core.CONFIG.viewer.manifestoForm - mirrors the pattern
// core.editorToolbar already uses for its own position (see
// initializeEditorToolbarDrag() in editor-toolbar.js), adapted for a
// normal-flow panel instead of an absolutely-positioned one.
function initializeManifestoFormDrag(formContainer, handle) {
  manifestoFormListeners?.abort();
  manifestoFormListeners = new AbortController();
  const { signal } = manifestoFormListeners;

  const initialPosition = getInitialManifestoPosition();
  let currentX = initialPosition.x;
  let currentY = initialPosition.y;

  const applyPosition = () => {
    formContainer.style.transform = (currentX || currentY)
      ? `translate3d(${currentX}px, ${currentY}px, 0)`
      : "";
    setStoredManifestoPosition(currentX, currentY);
  };

  // Resizing (native, "resize: both") may make the form wider than the
  // viewer, but never wider or taller than the browser window - it would
  // otherwise stretch the page itself.
  const applySizeLimits = () => {
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    formContainer.style.maxWidth = `${Math.max(viewportWidth - 2 * MANIFESTO_VIEWPORT_GUTTER, 280)}px`;
    formContainer.style.maxHeight = `${Math.max(window.innerHeight - 2 * MANIFESTO_VIEWPORT_GUTTER, 120)}px`;
  };

  const clampPosition = (x, y) => {
    // x=0 is the in-flow rest position (centered by "margin: auto", or
    // starting at the host's left edge once wider than it); keep both edges
    // inside the browser window.
    const rect = formContainer.getBoundingClientRect();
    const restLeft = rect.left - currentX;
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const minX = MANIFESTO_VIEWPORT_GUTTER - restLeft;
    const maxX = viewportWidth - MANIFESTO_VIEWPORT_GUTTER - rect.width - restLeft;

    return {
      x: maxX < minX ? minX : Math.min(Math.max(x, minX), maxX),
      // Never move above its natural in-flow position (y < 0) - it already
      // sits directly below the viewer (see the appendChild call below),
      // so this alone guarantees dragging can never put it back over the
      // model, regardless of how the panel is later resized.
      y: Math.max(y, 0),
    };
  };

  const reclamp = () => {
    applySizeLimits();
    const next = clampPosition(currentX, currentY);
    if (next.x === currentX && next.y === currentY) return;
    currentX = next.x;
    currentY = next.y;
    applyPosition();
  };

  applySizeLimits();
  applyPosition();

  let dragState = null;

  const onPointerMove = (event) => {
    if (!dragState) return;
    const dx = event.clientX - dragState.startX;
    const dy = event.clientY - dragState.startY;
    const next = clampPosition(dragState.originX + dx, dragState.originY + dy);
    currentX = next.x;
    currentY = next.y;
    applyPosition();
  };

  const stopDrag = () => {
    if (!dragState) return;
    dragState = null;
    formContainer.classList.remove("form-manifesto-dragging");
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", stopDrag);
  };

  handle.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button")) return; // don't hijack the collapse button
    dragState = {
      startX: event.clientX,
      startY: event.clientY,
      originX: currentX,
      originY: currentY,
    };
    formContainer.classList.add("form-manifesto-dragging");
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", stopDrag);
  });

  // Resizing itself is native CSS (see "#form-manifesto { resize: both }"
  // in viewer/css/external-sources.css) - no custom handle needed. A
  // ResizeObserver still fires for a user dragging that native handle, so
  // it's enough to persist the result into config.
  const initialSize = getManifestoFormConfig().size || {};
  const initialWidth = parseFloatParam(initialSize.width);
  const initialHeight = parseFloatParam(initialSize.height);
  if (initialWidth != null) formContainer.style.width = `${initialWidth}px`;
  if (initialHeight != null) formContainer.style.height = `${initialHeight}px`;

  let isFirstResizeObservation = true;
  const resizeObserver = new ResizeObserver((entries) => {
    // Skip the observer's own initial firing (on observe()) so it doesn't
    // immediately overwrite a configured size with the pre-resize default.
    if (isFirstResizeObservation) {
      isFirstResizeObservation = false;
      return;
    }
    const entry = entries[0];
    if (!entry) return;
    setStoredManifestoSize(
      Math.round(entry.contentRect.width),
      Math.round(entry.contentRect.height)
    );
    // Growing from the right edge must not push it out of the window.
    reclamp();
  });
  resizeObserver.observe(formContainer);
  signal.addEventListener("abort", () => resizeObserver.disconnect());

  // The browser window or the viewer (moved/resized) changing size moves the
  // form's rest position - keep it on screen.
  window.addEventListener("resize", reclamp, { signal });
  const host = core.viewerWrapper || core.container || formContainer.parentElement;
  if (host) {
    const hostObserver = new ResizeObserver(() => reclamp());
    hostObserver.observe(host);
    signal.addEventListener("abort", () => hostObserver.disconnect());
  }
}

export function createManifestUI(type = "iiif") {
  const formContainer = document.createElement("div");
  const className = type === "iiif" ? "IIIF" : "AIM3IF";
  const titleKey = type === "iiif" ? "iiif" : "aim3if";
  formContainer.id = `form-manifesto`;
  // Expanded by default - collapsing is still available via the toggle
  // button below (a user choice to save is worth keeping), but it no longer
  // needs to default to collapsed just to stay out of the model's way: see
  // the appendChild call at the bottom of this function, which now places
  // this in normal document flow below the viewer instead of as a
  // position: fixed overlay on top of it.

  /* header */
  const header = document.createElement("div");
  header.className = `form-manifesto-header`;
  header.innerHTML = `
    <span class="form-manifesto-drag-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="14" height="14" focusable="false">
        <circle cx="9" cy="6" r="1.6" fill="currentColor"/>
        <circle cx="15" cy="6" r="1.6" fill="currentColor"/>
        <circle cx="9" cy="12" r="1.6" fill="currentColor"/>
        <circle cx="15" cy="12" r="1.6" fill="currentColor"/>
        <circle cx="9" cy="18" r="1.6" fill="currentColor"/>
        <circle cx="15" cy="18" r="1.6" fill="currentColor"/>
      </svg>
    </span>
    <span class="title" data-i18n="${titleKey}.loader">${escapeHtml(t(`${titleKey}.loader`, `${className} Loader`))}</span>
    <div class="tools">
      <button type="button" id="manifesto-toggle-collapse" data-i18n-title="${titleKey}.collapse" title="${escapeHtml(t(`${titleKey}.collapse`, `Collapse`))}">▾</button>
    </div>
  `;

  formContainer.appendChild(header);

  /* content */
  const content = document.createElement("div");
  content.className = `form-manifesto-content`;
  content.id = `form-manifesto-content`;
  content.innerHTML = `
    <div class="form-manifesto-group">
      <input type="text" id="manifesto-manifest-url" data-i18n-placeholder="${titleKey}.manifestUrlPlaceholder" placeholder="${escapeHtml(t(`${titleKey}.manifestUrlPlaceholder`, `https://example.org/manifesto/manifest.json`))}">
      <button class="primary" id="load-manifesto-from-url" data-i18n="${titleKey}.loadFromUrl">${escapeHtml(t(`${titleKey}.loadFromUrl`, `Load from URL`))}</button>
    </div>

    <div class="form-manifesto-group column">
      <div class="manifesto-view-toolbar">
        <div class="manifesto-view-toggle" role="group">
          <button type="button" id="manifesto-view-tree" aria-pressed="false" data-i18n="manifesto.treeView">${escapeHtml(t("manifesto.treeView", "Tree"))}</button>
          <button type="button" id="manifesto-view-json" aria-pressed="true" data-i18n="manifesto.jsonView">${escapeHtml(t("manifesto.jsonView", "JSON"))}</button>
        </div>
        <button type="button" id="manifesto-tree-expand" class="manifesto-tree-tool" data-i18n="manifesto.expandAll" hidden>${escapeHtml(t("manifesto.expandAll", "Expand all"))}</button>
        <button type="button" id="manifesto-tree-collapse" class="manifesto-tree-tool" data-i18n="manifesto.collapseAll" hidden>${escapeHtml(t("manifesto.collapseAll", "Collapse all"))}</button>
      </div>
      <div id="manifesto-manifest-tree" class="manifesto-manifest-tree" hidden></div>
      <textarea id="manifesto-manifest-text" rows="8" data-i18n-placeholder="${titleKey}.manifestTextPlaceholder" placeholder="${escapeHtml(t(`${titleKey}.manifestTextPlaceholder`, `Paste ${className} manifest JSON here...`))}"></textarea>
      <div class="actions">
        <button class="secondary" id="load-manifesto-from-text" data-i18n="${titleKey}.loadFromText">${escapeHtml(t(`${titleKey}.loadFromText`, `Load from Text`))}</button>
      </div>
    </div>

    <div class="form-manifesto-group column manifesto-retarget">
      <label class="form-manifesto-label" for="manifesto-retarget-url" data-i18n="manifesto.retargetTitle">${escapeHtml(t("manifesto.retargetTitle", "Use these settings with another model"))}</label>
      <p class="manifesto-retarget-hint" data-i18n="manifesto.retargetHint">${escapeHtml(t("manifesto.retargetHint", "Lights, rendering and shading stay; annotations, thumbnails, the timeline and the section planes belong to the current model and are left out."))}</p>
      <div class="manifesto-retarget-row">
        <input type="text" id="manifesto-retarget-url" list="manifesto-retarget-models" data-i18n-placeholder="manifesto.retargetPlaceholder" placeholder="${escapeHtml(t("manifesto.retargetPlaceholder", "Model URL (GLB, glTF, OBJ, ...)"))}">
        <datalist id="manifesto-retarget-models"></datalist>
        <button class="primary" type="button" id="manifesto-retarget-apply" data-i18n="manifesto.retargetApply">${escapeHtml(t("manifesto.retargetApply", "Apply"))}</button>
      </div>
      <label class="manifesto-retarget-option">
        <input type="checkbox" id="manifesto-retarget-camera">
        <span data-i18n="manifesto.retargetKeepCamera">${escapeHtml(t("manifesto.retargetKeepCamera", "Keep the camera"))}</span>
      </label>
    </div>
  `;

  formContainer.appendChild(content);

  // Appended into the viewer's own wrapper (same host core.editorToolbar
  // uses - see getEditorToolbarHost() in
  // editor-toolbar.js and the appendChild call in main.js), not
  // document.body: #form-manifesto is normal-flow now (see
  // viewer/css/external-sources.css), so this renders it as a block below
  // the viewer instead of a position: fixed overlay on top of it.
  (core.viewerWrapper || core.container || document.body).appendChild(formContainer);

  initializeManifestoFormDrag(formContainer, header);
  showManifestInForm = attachManifestTreeEditor();
}

// Shows a manifest in the form's tree/JSON views; replaced by
// createManifestUI() with one bound to the current form.
let showManifestInForm = () => {};

export function displayManifestInForm(manifestJson) {
  showManifestInForm(manifestJson);
}
