import { truncateString } from "./utils.js";
import { setupObject, setupCamera, toastHelper } from './viewer-utils.js';
import { core } from './core.js';
import { t } from "./i18n-utils.js";
import { parseFloatParam } from "./viewer-param-utils.js";
import { clearIfcProperties } from "./ifc-properties.js";

// Below this distance (px) from its default glued corner, drag movement is
// absorbed rather than moved - the panel only actually detaches from the
// viewer frame's edge past a deliberate drag, instead of on the first pixel.
const METADATA_GLUE_THRESHOLD = 28;

// How close to the card's bottom-right corner a pointerdown has to land to
// count as grabbing the native resize grip (see isPointerInResizeCorner()).
const METADATA_RESIZE_HOTSPOT = 18;

let metadataResizeObserver = null;
let metadataHostResizeObserver = null;
let metadataNativeResizeActive = false;
let metadataNativeResizeReleaseTimer = null;

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
    if (!child.isMesh) return;
    stats.vertices += fetchMetadata(child, "vertices");
    stats.faces += fetchMetadata(child, "faces");
    if (child.name === "") child.name = "Mesh";
    Viewer.addHierarchySubmenuItem(truncateString(child.name, 35), child.id);
  });
  ["vertices", "faces"].forEach((key) => {
    const label = core.metadataContainer?.querySelector?.(`[data-i18n-key="metadata.${key}"]`);
    const value = label?.parentElement?.querySelector(".metadata-value");
    if (value) value.textContent = String(stats[key]);
  });
  return stats;
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
      '<span class="metadata-label">' + escapeHtml(label) + ':</span>' +
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
 * Expands/collapses the metadata panel.
 */
export function expandMetadata() {
  const content = document.getElementById("metadata-content");
  const toggle = document.getElementById("metadata-collapse");
  const card = document.getElementById("metadata-card");

  if (!content || !toggle) return;

  const expanded = content.classList.toggle("expanded");
  toggle.classList.toggle("metadata-collapsed", !expanded);
  card?.classList.toggle("metadata-open", expanded);

  // accessibility
  toggle.setAttribute("aria-expanded", expanded);

  // A manual resize (see observeMetadataResize()) sets an explicit inline
  // width/height on the card. Left alone, that inline size would keep the
  // collapsed card just as big as when it was expanded, with the content
  // hidden inside empty space instead of the card actually shrinking back
  // to the compact pill - so swap it out for the collapsed default here,
  // and restore the stored manual size when expanding again.
  if (card?.classList.contains("metadata-card-resized")) {
    if (expanded) {
      const { width, height } = getInitialMetadataSize();
      if (width != null) card.style.width = `${width}px`;
      if (height != null) card.style.height = `${height}px`;
    } else {
      card.style.width = "";
      card.style.height = "";
    }
  }

  if (!expanded) {
    card?.classList.remove("metadata-card-overflowing");
    content.querySelectorAll(".metadata-row-pinned").forEach((row) => {
      row.classList.remove("metadata-row-pinned");
    });
    return;
  }

  updateMetadataOverflow();
}

function updateMetadataOverflow() {
  const content = document.getElementById("metadata-content");
  const card = document.getElementById("metadata-card");

  if (!content || !card || !content.classList.contains("expanded")) return;

  const hasOverflow = content.scrollHeight - content.clientHeight > 8;
  card.classList.toggle("metadata-card-overflowing", hasOverflow);

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
    const toggle = e.target.closest("#metadata-collapse");
    if (toggle) {
      expandMetadata(e);
      return;
    }

    const card = document.getElementById("metadata-card");
    const content = document.getElementById("metadata-content");
    if (!card || !content || !content.classList.contains("expanded")) return;

    const row = e.target.closest(".metadata-row");
    if (!row) return;

    const willPin = !row.classList.contains("metadata-row-pinned");
    content.querySelectorAll(".metadata-row-pinned").forEach((pinnedRow) => {
      pinnedRow.classList.remove("metadata-row-pinned");
    });
    if (willPin) row.classList.add("metadata-row-pinned");
  });

  // The card is rebuilt (innerHTML) on every handleMetadataResponse() call,
  // so its own drag handle is a fresh element each time - delegate from the
  // container (which persists) instead of binding it directly.
  core.metadataContainer.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".metadata-drag-handle")) {
      startMetadataDrag(e);
      return;
    }

    const card = e.target.closest("#metadata-card");
    if (card && isPointerInResizeCorner(card, e.clientX, e.clientY)) {
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

// The card's own width/height also change from expanding/collapsing (an
// animated CSS transition, not a resize) and from the host ResizeObserver
// re-clamping it - neither is a user resize. Only trust a ResizeObserver
// firing as one while the user is actually holding the native grip down.
function isPointerInResizeCorner(card, clientX, clientY) {
  const rect = card.getBoundingClientRect();
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

// Resize itself is native CSS (see "#metadata-card.metadata-open { resize:
// both }" in main.css, enabled only while expanded) - a ResizeObserver just
// persists the result and keeps it from growing past the viewer's edge,
// mirroring initializeManifestoFormDrag()'s resize handling below.
function observeMetadataResize(card) {
  metadataResizeObserver?.disconnect();

  let isFirstObservation = true;
  metadataResizeObserver = new ResizeObserver((entries) => {
    if (isFirstObservation) {
      isFirstObservation = false;
      return;
    }
    if (!metadataNativeResizeActive) return;

    const entry = entries[0];
    if (!entry) return;

    const host = getMetadataDragHost();
    const hostRect = host?.getBoundingClientRect();
    const { x, y } = getInitialMetadataPosition();

    let width = entry.contentRect.width;
    let height = entry.contentRect.height;

    if (hostRect) {
      const maxWidth = Math.max(hostRect.width - x, 160);
      const maxHeight = Math.max(hostRect.height - y, 60);
      if (width > maxWidth) {
        width = maxWidth;
        card.style.width = `${width}px`;
      }
      if (height > maxHeight) {
        height = maxHeight;
        card.style.height = `${height}px`;
      }
    }

    card.classList.add("metadata-card-resized");
    setStoredMetadataSize(Math.round(width), Math.round(height));
  });
  metadataResizeObserver.observe(card);
}

// Keep the stored position valid if the viewer itself is resized, mirroring
// initializeEditorToolbarDrag()'s own host ResizeObserver in editor-toolbar.js.
function observeMetadataHost(card) {
  const host = getMetadataDragHost();
  metadataHostResizeObserver?.disconnect();
  if (!host) return;

  metadataHostResizeObserver = new ResizeObserver(() => {
    const { x, y } = getInitialMetadataPosition();
    const next = clampMetadataPosition(card, x, y);
    applyMetadataPosition(card, next.x, next.y);
  });
  metadataHostResizeObserver.observe(host);
}

function initializeMetadataDragAndResize() {
  const card = document.getElementById("metadata-card");
  if (!card) return;

  if (core.container && getComputedStyle(core.container).position === "static") {
    core.container.style.position = "relative";
  }

  const { x, y } = getInitialMetadataPosition();
  applyMetadataPosition(card, x, y);

  const { width, height } = getInitialMetadataSize();
  const hasStoredSize = width != null || height != null;
  card.classList.toggle("metadata-card-resized", hasStoredSize);
  // The card is always (re)built collapsed (see the HTML template in
  // handleMetadataResponse()) - only apply a previously stored manual size
  // once it's actually expanded again (see expandMetadata()), or a freshly
  // rebuilt card would immediately show a large collapsed box with its
  // content hidden inside empty space.
  if (hasStoredSize && card.classList.contains("metadata-open")) {
    if (width != null) card.style.width = `${width}px`;
    if (height != null) card.style.height = `${height}px`;
  }

  observeMetadataResize(card);
  observeMetadataHost(card);
}

/**
 * Appends metadata HTML to the DOM.
 */
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

  var metadataContent =
    '<div id="metadata-card">' +
      '<div class="metadata-drag-handle" title="' + escapeHtml(t("metadata.move", "Move")) + '"></div>' +
      '<button id="metadata-collapse" class="metadata-collapse metadata-collapsed" type="button" aria-expanded="false" aria-controls="metadata-content">' +
        '<span class="metadata-toggle-icon" aria-hidden="true"></span>' +
        '<span class="metadata-toggle-copy">' +
          '<span class="metadata-toggle-eyebrow" data-i18n-key="metadata.modelDetails">' + escapeHtml(t("metadata.modelDetails", "Model details")) + '</span>' +
          '<span class="metadata-toggle-title" data-i18n-key="metadata.metadata">' + escapeHtml(t("metadata.metadata", "Metadata")) + '</span>' +
        '</span>' +
        '<span class="metadata-toggle-chevron" aria-hidden="true"></span>' +
      '</button>' +
      '<div id="metadata-content" class="metadata-content">';
  metadataContent +=
    '<div class="metadata-row">' +
      '<span class="metadata-label" data-i18n-key="metadata.visualizedFile">' + escapeHtml(t("metadata.visualizedFile", "Visualized file")) + ':</span>' +
      '<span class="metadata-value">' +
        escapeHtml(core.fileObject.basename) + '.' + escapeHtml(core.fileObject.extension) +
      '</span>' +
    '</div>';

  metadataContent += '<div class="metadataSeparator"></div>';

  metadataContent +=
    '<div class="metadata-row">' +
      '<span class="metadata-label" data-i18n-key="metadata.vertices">' + escapeHtml(t("metadata.vertices", "Vertices")) + ':</span>' +
      '<span class="metadata-value">' + metadata["vertices"] + '</span>' +
    '</div>';

  metadataContent +=
    '<div class="metadata-row">' +
      '<span class="metadata-label" data-i18n-key="metadata.faces">' + escapeHtml(t("metadata.faces", "Faces")) + ':</span>' +
      '<span class="metadata-value">' + metadata["faces"] + '</span>' +
    '</div>';
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
    '</div>';  
  appendMetadata(metadataContent);
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

  if (core.CONFIG.entity.metadata.sourceType === "IIIF") {
    console.log("Fetching IIIF metadata from ", core.objectsConfig);
    await handleMetadataResponse( core.CONFIG.model, metadata, object);
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
    await handleMetadataResponse("", metadata, object);
  }
}

export function createIIIFDropdown(iiifConfigURL) {
  // list of candidate IIIF config URLs (add more as needed)
  const iiifList = [
    { url: iiifConfigURL.url, name: iiifConfigURL.name },
    { url: "https://raw.githubusercontent.com/IIIF/3d/main/manifests/4_transform_and_position/model_transform_scale_position.json", name: t("iiif.optionModelPositionScale", "Model Position and Scale") },
    { url: "https://raw.githubusercontent.com/IIIF/3d/main/manifests/1_basic_model_in_scene/model_origin.json", name: t("iiif.optionModelOrigin", "Model Origin") },
    { url: "https://raw.githubusercontent.com/IIIF/3d/main/manifests/1_basic_model_in_scene/model_origin_bgcolor.json", name: t("iiif.optionModelOriginBg", "Model Origin with background color") },
    { url: "https://raw.githubusercontent.com/IIIF/3d/main/manifests/4_transform_and_position/model_position.json", name: t("iiif.optionModelPosition", "Model Position") },
  ].filter(Boolean);

  const group = document.createElement("div");
  group.className = "form-manifesto-group";

  const label = document.createElement("label");
  label.textContent = t("iiif.manifest", "IIIF manifest");
  label.className = "form-manifesto-label";

  const select = document.createElement("select");
  select.id = "manifesto-manifest-select";
  select.name = "manifesto-manifest-select";

  iiifList.forEach(item => {
    const opt = document.createElement("option");
    opt.value = item.url;
    opt.textContent = item.name;
    select.appendChild(opt);
  });

  group.appendChild(label);
  group.appendChild(select);

  // add on the top
  document.querySelector("#form-manifesto-content").prepend(group);

}

export function createManifestSourceSwitch(activeType = "iiif") {
  const group = document.createElement("div");
  group.className = "form-manifesto-group manifesto-source-group";

  const label = document.createElement("label");
  label.className = "form-manifesto-label";
  label.textContent = t("manifesto.source", "Manifest type");

  const switchLabel = document.createElement("label");
  switchLabel.className = "manifesto-source-switch";
  switchLabel.htmlFor = "manifesto-source-switch";
  switchLabel.innerHTML = `
    <span>IIIF</span>
    <input
      id="manifesto-source-switch"
      type="checkbox"
      role="switch"
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
  const group = document.createElement("div");
  group.className = "form-manifesto-group";

  const aim3ifList = [
    { url: url, name: t("aim3if.optionDefault", "Default configuration") },
    { url: "https://viewer.thedworak.com/manifests/box.json", name: t("aim3if.optionBox", "Box configuration") },
    { url: "./manifests/box-aim3d-local.json", name: t("aim3if.optionBoxLocal", "Box (localhost)") },
    { url: "./manifests/wolpa-synagogue-aim3d-local.json", name: t("aim3if.optionWolpaLocal", "Wolpa Synagogue (localhost)") },
    { url: "./manifests/wolpa-synagogue-aim3d-local-ceiling.json", name: t("aim3if.optionWolpaLocalCeiling", "Wolpa Synagogue - ceiling view (localhost)") },
    // Add more AIM3IF configurations here as needed
  ].filter(item => item?.url);

  const label = document.createElement("label");
  label.textContent = t("aim3if.modelConfig", "Model configuration");
  label.className = "form-manifesto-label";

  const select = document.createElement("select");
  select.id = "manifesto-manifest-select";
  select.name = "manifesto-manifest-select";

  aim3ifList.forEach(item => {
    const opt = document.createElement("option");
    opt.value = item.url;
    opt.textContent = item.name;
    select.appendChild(opt);
  });
  group.appendChild(label);
  group.appendChild(select);

  // add on the top
  document.querySelector("#form-manifesto-content").prepend(group);
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

// Makes #form-manifesto draggable (via its header) and resizable, and keeps
// both in sync with core.CONFIG.viewer.manifestoForm - mirrors the pattern
// core.editorToolbar already uses for its own position (see
// initializeEditorToolbarDrag() in editor-toolbar.js), adapted for a
// normal-flow panel instead of an absolutely-positioned one.
function initializeManifestoFormDrag(formContainer, handle) {
  const host = core.viewerWrapper || core.container || formContainer.parentElement;

  const initialPosition = getInitialManifestoPosition();
  let currentX = initialPosition.x;
  let currentY = initialPosition.y;

  const applyPosition = () => {
    formContainer.style.transform = (currentX || currentY)
      ? `translate3d(${currentX}px, ${currentY}px, 0)`
      : "";
    setStoredManifestoPosition(currentX, currentY);
  };
  applyPosition();

  const clampPosition = (x, y) => {
    const hostRect = host?.getBoundingClientRect();
    // The panel starts horizontally centered (CSS "margin: auto"), so x=0
    // is that centered rest position - moving left needs a *negative* x,
    // not just a small positive one. maxX is the slack on either side
    // (half of the leftover host width) before an edge of the panel would
    // reach the corresponding edge of the host.
    const maxX = hostRect
      ? Math.max((hostRect.width - formContainer.offsetWidth) / 2, 0)
      : Infinity;

    return {
      x: Math.min(Math.max(x, -maxX), maxX),
      // Never move above its natural in-flow position (y < 0) - it already
      // sits directly below the viewer (see the appendChild call below),
      // so this alone guarantees dragging can never put it back over the
      // model, regardless of how the panel is later resized.
      y: Math.max(y, 0),
    };
  };

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
  });
  resizeObserver.observe(formContainer);
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
    <span class="title">${escapeHtml(t(`${titleKey}.loader`, `${className} Loader`))}</span>
    <div class="tools">
      <button type="button" id="manifesto-toggle-collapse" title="${escapeHtml(t(`${titleKey}.collapse`, `Collapse`))}">▾</button>
    </div>
  `;

  formContainer.appendChild(header);

  /* content */
  const content = document.createElement("div");
  content.className = `form-manifesto-content`;
  content.id = `form-manifesto-content`;
  content.innerHTML = `
    <div class="form-manifesto-group">
      <input type="text" id="manifesto-manifest-url" placeholder="${escapeHtml(t(`${titleKey}.manifestUrlPlaceholder`, `https://example.org/manifesto/manifest.json`))}">
      <button class="primary" id="load-manifesto-from-url">${escapeHtml(t(`${titleKey}.loadFromUrl`, `Load from URL`))}</button>
    </div>

    <div class="form-manifesto-group column">
      <textarea id="manifesto-manifest-text" rows="8" placeholder="${escapeHtml(t(`${titleKey}.manifestTextPlaceholder`, `Paste ${className} manifest JSON here...`))}"></textarea>
      <div class="actions">
        <button class="secondary" id="load-manifesto-from-text">${escapeHtml(t(`${titleKey}.loadFromText`, `Load from Text`))}</button>
      </div>
    </div>
  `;

  formContainer.appendChild(content);

  // Appended into the viewer's own wrapper (same host core.editorToolbar
  // and #credits already use - see getEditorToolbarHost() in
  // editor-toolbar.js and the appendChild call in main.js), not
  // document.body: #form-manifesto is normal-flow now (see
  // viewer/css/external-sources.css), so this renders it as a block below
  // the viewer instead of a position: fixed overlay on top of it.
  (core.viewerWrapper || core.container || document.body).appendChild(formContainer);

  initializeManifestoFormDrag(formContainer, header);
}
