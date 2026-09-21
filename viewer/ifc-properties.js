import { core } from "./core.js";
import THREE from "./init.js";

// IFC metadata (psets, quantities, spatial tree) does not fit into glTF, so
// scripts/ifc_metadata.py exports it to <name>_ifc.json next to the *_viewer.json.
// Node names in the GLB are IFC GlobalIds (IfcConvert --use-element-guids), which
// are the keys of `elements` in that JSON.

let ifcData = null;
// Directly loaded .ifc: properties are read on demand from the web-ifc model (IFCModel).
let liveModel = null;
let liveRequest = 0;
let panel = null;
let highlights = [];
// Elements hidden through the panel's eye toggle; they stay hidden until toggled back / "Show all".
const hiddenNodes = new Set();
let selectedNode = null;
let highlightMaterial = null;

const esc = (v) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function hasIfcProperties() {
  return ifcData !== null || liveModel !== null;
}

export function clearIfcProperties() {
  showAllHidden();
  ifcData = null;
  liveModel = null;
  liveRequest++;
  closeIfcPanel();
}

export async function loadIfcProperties(url) {
  clearIfcProperties();
  if (!url) return;
  try {
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) return; // not an IFC-derived model: silently skip
    const data = await response.json();
    if (data && data.elements) ifcData = data;
  } catch (error) {
    console.warn("[ifc-properties] could not load", url, error);
  }
}

/** Serves properties straight from a model loaded by IFCLoader (no converted GLB + JSON needed). */
export function setIfcModel(model) {
  clearIfcProperties();
  if (model?.ifcManager && model.geometry?.attributes?.expressID) liveModel = model;
}

const unwrap = (v) => {
  if (Array.isArray(v)) return v.map(unwrap);
  if (v && typeof v === "object" && "value" in v) return unwrap(v.value);
  if (v === ".T.") return true;
  if (v === ".F.") return false;
  return v ?? null;
};

const VALUE_KEYS = [
  "NominalValue", "LengthValue", "AreaValue", "VolumeValue", "CountValue", "WeightValue", "TimeValue",
  "EnumerationValues", "ListValues",
];

// IfcPropertySet / IfcElementQuantity (recursive web-ifc lines) -> { setName: { propName: value } }
function convertPsets(lines) {
  const psets = {};
  for (const line of lines || []) {
    const items = line.HasProperties || line.Quantities;
    if (!items) continue;
    const props = {};
    for (const item of items) {
      const name = unwrap(item.Name);
      if (!name) continue;
      const key = VALUE_KEYS.find((k) => item[k] != null);
      props[name] = key ? unwrap(item[key]) : null;
    }
    psets[unwrap(line.Name) || "Pset"] = props;
  }
  return psets;
}

async function readLiveEntry(model, id) {
  const [item, psets, types] = await Promise.all([
    model.getItemProperties(id, false),
    model.getPropertySets(id, true),
    model.getTypeProperties(id, false),
  ]);
  return {
    guid: unwrap(item?.GlobalId),
    entry: {
      type: model.getIfcType(id),
      name: unwrap(item?.Name),
      description: unwrap(item?.Description),
      objectType: unwrap(item?.ObjectType),
      predefinedType: unwrap(item?.PredefinedType),
      tag: unwrap(item?.Tag),
      typeRef: types?.[0] ? { name: unwrap(types[0].Name) } : null,
      psets: convertPsets(psets),
    },
  };
}

// Sub-geometry with only the triangles of one element, sharing the model's vertex buffers.
function elementGeometry(geometry, id) {
  const index = geometry.index.array;
  const ids = geometry.attributes.expressID;
  const out = [];
  for (let i = 0; i < index.length; i += 3) {
    if (ids.getX(index[i]) === id) out.push(index[i], index[i + 1], index[i + 2]);
  }
  if (!out.length) return null;
  const sub = new THREE.BufferGeometry();
  sub.setAttribute("position", geometry.attributes.position);
  sub.setIndex(out);
  return sub;
}

function findElement(object) {
  for (let node = object; node; node = node.parent) {
    if (node.name && ifcData.elements[node.name]) return { node, guid: node.name, entry: ifcData.elements[node.name] };
  }
  return null;
}

function renderValue(value) {
  if (value && typeof value === "object") return esc(value.name || value.guid || JSON.stringify(value));
  return esc(value);
}

function renderPsets(psets) {
  return Object.entries(psets)
    .map(([name, props]) => {
      const rows = Object.entries(props)
        .filter(([key]) => key !== "id")
        .map(([key, value]) => `<tr><th>${esc(key)}</th><td>${renderValue(value)}</td></tr>`)
        .join("");
      return `<details class="ifc-props-set" open><summary>${esc(name)}</summary><table class="ifc-props-table">${rows}</table></details>`;
    })
    .join("");
}

// Position/size the user chose; kept for the session so the panel reopens where it was left.
let panelBox = null;

function clampToContainer(left, top, width, height) {
  const host = core.container;
  const maxLeft = Math.max(0, host.clientWidth - Math.min(width, 48));
  const maxTop = Math.max(0, host.clientHeight - 32);
  return [Math.min(Math.max(-width + 48, left), maxLeft), Math.min(Math.max(0, top), maxTop)];
}

function applyPanelBox(el) {
  if (!panelBox) return;
  el.style.left = `${panelBox.left}px`;
  el.style.top = `${panelBox.top}px`;
  el.style.right = "auto";
  if (panelBox.width) el.style.width = `${panelBox.width}px`;
  if (panelBox.height) {
    el.style.height = `${panelBox.height}px`;
    el.classList.add("ifc-props-sized");
  }
}

function rememberPanelBox(el, extra = {}) {
  panelBox = {
    ...(panelBox || {}),
    left: el.offsetLeft,
    top: el.offsetTop,
    ...extra,
  };
}

/** Header drag + native CSS resize (bottom-right grip); both persist in panelBox. */
function bindPanelInteractions(el) {
  let drag = null;
  let sizeBefore = null;

  el.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    sizeBefore = { w: el.offsetWidth, h: el.offsetHeight };
    const header = e.target.closest(".ifc-props-header");
    if (!header || e.target.closest("button") || e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, left: el.offsetLeft, top: el.offsetTop };
    header.setPointerCapture?.(e.pointerId);
    el.classList.add("ifc-props-dragging");
    e.preventDefault();
  });

  el.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const [left, top] = clampToContainer(
      drag.left + e.clientX - drag.x,
      drag.top + e.clientY - drag.y,
      el.offsetWidth,
      el.offsetHeight
    );
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.right = "auto";
  });

  const finish = () => {
    if (drag) {
      drag = null;
      el.classList.remove("ifc-props-dragging");
      rememberPanelBox(el);
    }
    if (sizeBefore && (el.offsetWidth !== sizeBefore.w || el.offsetHeight !== sizeBefore.h)) {
      rememberPanelBox(el, { width: el.offsetWidth, height: el.offsetHeight });
      el.classList.add("ifc-props-sized");
    }
    sizeBefore = null;
    updateNoticeAvoidance();
  };
  el.addEventListener("pointerup", finish);
  el.addEventListener("pointercancel", finish);
}

// Keeps the "controls" shortcuts notice (docked at the right edge, vertically
// centred - see #viewerNoticeContainer--shortcuts) from covering this panel:
//   open          -> notice moves to the left edge
//   open-left     -> panel was dragged to the left half, notice stays on the right
//   crowded       -> viewer too narrow for both, notice is hidden while the panel is open
const NOTICE_WIDTH = 380 + 32;

function noticeContainer() {
  return document.getElementById("viewerNoticeContainer");
}

function updateNoticeAvoidance() {
  const notice = noticeContainer();
  if (!notice) return;
  if (!panel) {
    notice.removeAttribute("data-ifc-panel");
    return;
  }
  const hostWidth = core.container.clientWidth;
  const panelCenter = panel.offsetLeft + panel.offsetWidth / 2;
  let state = panelCenter < hostWidth / 2 ? "open-left" : "open";
  if (hostWidth < panel.offsetWidth + NOTICE_WIDTH + 24) state = "crowded";
  notice.setAttribute("data-ifc-panel", state);
}

function ensurePanel() {
  if (panel) return panel;
  panel = document.createElement("div");
  panel.id = "ifc-properties-panel";
  bindPanelInteractions(panel);
  applyPanelBox(panel);
  core.container.appendChild(panel);
  window.addEventListener("resize", updateNoticeAvoidance);
  return panel;
}

/** Removes the overlay meshes added by highlightElement(). Geometry is shared, so only the material is kept/disposed. */
export function clearIfcHighlight() {
  highlights.forEach((overlay) => {
    overlay.parent?.remove(overlay);
    if (overlay.userData.ownGeometry) overlay.geometry.dispose();
  });
  highlights = [];
  highlightMaterial?.dispose();
  highlightMaterial = null;
}

/**
 * Highlights every mesh below `node` with a translucent overlay that shares the
 * original geometry and is a child of the mesh, so it follows its transform.
 * Overlays are excluded from raycasting so they never get picked themselves.
 */
function createHighlightMaterial() {
  clearIfcHighlight();
  highlightMaterial = new THREE.MeshBasicMaterial({
    color: 0x00e5ff,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

function addOverlay(mesh, geometry) {
  const overlay = new THREE.Mesh(geometry, highlightMaterial);
  overlay.raycast = () => {};
  overlay.renderOrder = 999;
  overlay.userData.ifcHighlight = true;
  mesh.add(overlay);
  highlights.push(overlay);
  return overlay;
}

function highlightElement(node) {
  createHighlightMaterial();
  const meshes = [];
  node.traverse((child) => {
    if (child.isMesh && !child.userData.ifcHighlight) meshes.push(child);
  });
  meshes.forEach((mesh) => addOverlay(mesh, mesh.geometry));
}

const EYE_ICON =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF_ICON =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7c2 0 3.8.7 5.3 1.6M22 12s-3.6 7-10 7c-2 0-3.8-.7-5.3-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M3 3l18 18"/></svg>';

function showAllHidden() {
  hiddenNodes.forEach((node) => (node.visible = true));
  hiddenNodes.clear();
}

function toggleSelectedVisibility() {
  if (!selectedNode) return;
  selectedNode.visible = !selectedNode.visible;
  if (selectedNode.visible) hiddenNodes.delete(selectedNode);
  else hiddenNodes.add(selectedNode);
  refreshVisibilityControls();
}

function refreshVisibilityControls() {
  if (!panel) return;
  const visible = selectedNode ? selectedNode.visible !== false : true;
  const toggle = panel.querySelector(".ifc-props-visibility");
  if (toggle) {
    toggle.style.display = selectedNode ? "" : "none"; // per-element hiding needs a node (not for merged IFC mesh)
    toggle.innerHTML = visible ? EYE_ICON : EYE_OFF_ICON;
    toggle.setAttribute("aria-pressed", String(!visible));
    const label = visible ? "Hide element" : "Show element";
    toggle.title = label;
    toggle.setAttribute("aria-label", label);
  }
  const bar = panel.querySelector(".ifc-props-hidden-bar");
  if (bar) {
    bar.hidden = hiddenNodes.size === 0;
    bar.querySelector(".ifc-props-hidden-count").textContent = `Hidden elements: ${hiddenNodes.size}`;
  }
}

export function closeIfcPanel() {
  liveRequest++; // drop any in-flight property read
  selectedNode = null;
  clearIfcHighlight();
  panel?.remove();
  panel = null;
  window.removeEventListener("resize", updateNoticeAvoidance);
  updateNoticeAvoidance();
}

export function showIfcProperties(object, hit = null) {
  if (liveModel) return showLiveProperties(object, hit);
  if (!ifcData || !object) return false;
  const found = findElement(object);
  if (!found) return false;
  const { node, guid, entry } = found;
  highlightElement(node);
  selectedNode = node;
  renderPanel(entry, guid);
  return true;
}

function showLiveProperties(object, hit) {
  if (object !== liveModel || hit?.faceIndex == null) return false;
  const id = liveModel.getExpressId(object.geometry, hit.faceIndex);
  const request = ++liveRequest;
  selectedNode = null;
  const sub = elementGeometry(object.geometry, id);
  createHighlightMaterial();
  if (sub) addOverlay(object, sub).userData.ownGeometry = true;
  readLiveEntry(liveModel, id)
    .then(({ guid, entry }) => {
      if (request === liveRequest) renderPanel(entry, guid);
    })
    .catch((error) => console.warn("[ifc-properties] could not read element", id, error));
  return true;
}

function renderPanel(entry, guid) {
  const head = [
    ["Type", entry.type],
    ["Name", entry.name],
    ["Description", entry.description],
    ["Object type", entry.objectType],
    ["Predefined type", entry.predefinedType],
    ["Tag", entry.tag],
    ["Material", entry.material],
    ["IFC type", entry.typeRef?.name],
    ["GlobalId", guid],
  ]
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`)
    .join("");

  const el = ensurePanel();
  el.innerHTML =
    `<div class="ifc-props-header"><span class="ifc-props-title">${esc(entry.name || entry.type)}</span>` +
    `<button type="button" class="ifc-props-btn ifc-props-visibility"></button>` +
    `<button type="button" class="ifc-props-btn ifc-props-close" aria-label="Close">×</button></div>` +
    `<div class="ifc-props-hidden-bar" hidden><span class="ifc-props-hidden-count"></span>` +
    `<button type="button" class="ifc-props-show-all">Show all</button></div>` +
    `<div class="ifc-props-body"><table class="ifc-props-table">${head}</table>${entry.psets ? renderPsets(entry.psets) : ""}</div>`;
  el.querySelector(".ifc-props-close").addEventListener("click", closeIfcPanel);
  el.querySelector(".ifc-props-visibility").addEventListener("click", toggleSelectedVisibility);
  el.querySelector(".ifc-props-show-all").addEventListener("click", () => {
    showAllHidden();
    refreshVisibilityControls();
  });
  refreshVisibilityControls();
  updateNoticeAvoidance();
}

/**
 * <dir>/gltf/<name>.glb -> <dir>/metadata/<name>_ifc.json (the layout produced by
 * scripts/convert.sh), independent of the Drupal metadataUrl setting so it also
 * works for the standalone worker and local previews.
 */
export function ifcPropertiesUrlForModel(modelPath) {
  if (!modelPath || modelPath.startsWith("blob:")) return null;
  const match = modelPath.match(/^(.*)\/gltf\/([^/?#]+)\.(?:glb|gltf)(?:[?#].*)?$/i);
  return match ? `${match[1]}/metadata/${match[2]}_ifc.json` : null;
}
