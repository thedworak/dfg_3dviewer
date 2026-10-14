import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import THREE from "../init.js";
import { getViewerSideStack } from "../ui/side-stack.js";

// Reconstruction variants and the comparison view.
//
// Variants are alternative hypotheses of the same object - two roofs, three
// versions of a lost tower - each a set of model nodes. One variant is shown
// at a time, picked in the variants panel; nodes of no variant are always
// shown. Variants come from the model (glTF scene extras `variants`, or nodes
// whose extras carry a `variant` id) and/or the manifest (AIM3DViewer.variants),
// which may relabel them, describe them, cite their sources and give each a
// Level of Certainty value (manifesto/certainty-scale.js).
//
// The comparison view draws the scene twice per frame, each time with one
// side shown: a variant, or a stage of the 4D timeline (timeline.js) by its
// year. "swipe": both sides in the same view, split by a divider that is
// dragged across the canvas; "split": side by side, each in its own half,
// the camera shared. Settings: AIM3DViewer.compare in a manifest; URL
// overrides ?compare=swipe|split, ?compareLeft=<variant id|year>,
// ?compareRight=..., ?variant=<id>.

export const COMPARE_MODES = ["swipe", "split"];
const DEFAULT_POSITION = 0.5;
// The divider stays this far (share of the canvas) from the edges.
const EDGE = 0.02;
// Arrow keys move the divider by this share of the canvas.
const KEY_STEP = 0.02;

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function toArray(value) {
  if (value == null || value === "") return [];
  return (Array.isArray(value) ? value : [value]).map(String).filter(Boolean);
}

// IIIF language map ({ "pl": ["..."] }) or a plain string, in the viewer's language.
function readText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(readText).filter(Boolean).join("\n");
  if (isPlainObject(value)) {
    const lang = core.currentLanguage || "en";
    return readText(value[lang] ?? value.en ?? value.none ?? Object.values(value)[0]);
  }
  return String(value);
}

function findObject(roots, name) {
  const sanitized = THREE.PropertyBinding.sanitizeNodeName(name);
  for (const root of roots) {
    const object = root.getObjectByName(name) || root.getObjectByName(sanitized);
    if (object) return object;
  }
  return null;
}

function clampPosition(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_POSITION;
  return Math.min(Math.max(number, EDGE), 1 - EDGE);
}

// The variants written into the model: glTF scene extras `variants` (an
// array, or { label, description, active, items }), else nodes whose extras
// carry a `variant` id (with `variantLabel`, `variantDescription`).
function readModelVariants(roots) {
  let found = null;
  roots.forEach((root) => root.traverse((object) => {
    const value = object.userData?.variants;
    if (!found && (Array.isArray(value) || isPlainObject(value))) found = value;
  }));
  if (found) return Array.isArray(found) ? { items: found } : found;

  const byId = new Map();
  roots.forEach((root) => root.traverse((object) => {
    const id = object.userData?.variant;
    if (object === root || !object.name || id == null || id === "") return;
    const key = String(id);
    if (!byId.has(key)) byId.set(key, { id: key, nodes: [] });
    const variant = byId.get(key);
    variant.nodes.push(object.name);
    if (object.userData.variantLabel != null && variant.label == null) variant.label = object.userData.variantLabel;
    if (object.userData.variantDescription != null && variant.description == null) variant.description = object.userData.variantDescription;
  }));
  return byId.size >= 2 ? { items: [...byId.values()] } : null;
}

// Model and manifest merged. Manifest variants replace the model's list; a
// manifest variant without nodes takes those of the model's variant with the
// same id.
function buildVariants(roots, manifestConfig) {
  const config = isPlainObject(manifestConfig) ? manifestConfig : {};
  if (config.enabled === false) return null;
  const model = readModelVariants(roots) || {};
  const modelItems = Array.isArray(model.items) ? model.items : [];
  const modelById = new Map(modelItems.filter((item) => item?.id != null).map((item) => [String(item.id), item]));
  const rawItems = Array.isArray(config.items) && config.items.length ? config.items : modelItems;

  const items = rawItems
    .map((raw, index) => {
      if (!isPlainObject(raw)) return null;
      const id = String(raw.id ?? `variant-${index + 1}`);
      const inherited = modelById.get(id) || {};
      const nodes = toArray(raw.nodes ?? raw.node ?? inherited.nodes ?? inherited.node);
      const objects = nodes.map((name) => findObject(roots, name)).filter(Boolean);
      const certainty = Number(raw.certainty ?? inherited.certainty);
      return {
        id,
        label: raw.label ?? inherited.label ?? id,
        description: raw.description ?? inherited.description ?? "",
        source: raw.source ?? inherited.source ?? null,
        certainty: Number.isFinite(certainty) ? certainty : null,
        nodes,
        objects,
      };
    })
    .filter(Boolean);
  if (items.length < 2) return null;

  const active = items.find((item) => item.id === String(config.active ?? model.active ?? ""))?.id ?? items[0].id;
  return {
    items,
    active,
    label: config.label ?? model.label ?? null,
    description: config.description ?? model.description ?? null,
    showPanel: typeof config.showPanel === "boolean" ? config.showPanel : true,
    fromManifest: Boolean(Array.isArray(config.items) && config.items.length),
  };
}

// A side as written in manifests and URLs: { variant: id } | { year: n },
// or a bare id / year.
function normalizeSide(raw) {
  if (isPlainObject(raw)) {
    if (raw.variant != null && raw.variant !== "") return { variant: String(raw.variant) };
    if (Number.isFinite(Number(raw.year)) && raw.year !== "" && raw.year !== null) return { year: Number(raw.year) };
    return null;
  }
  if (raw == null || raw === "") return null;
  return { key: String(raw) };
}

function sideKey(side) {
  if (!side) return "";
  if (side.variant != null) return `variant:${side.variant}`;
  if (side.year != null) return `year:${side.year}`;
  return "";
}

export function attachCompare(Viewer) {
  Object.assign(Viewer, {
    variantsState: null,
    // AIM3DViewer.variants / AIM3DViewer.compare of the manifest shown.
    variantsManifestConfig: null,
    compareManifestConfig: null,
    variantsRoots: null,
    compareState: null,

    // From setupModelAnimations, after the timeline.
    setupVariants(object) {
      const roots = (Array.isArray(object) ? object.flat() : [object]).filter((root) => root?.isObject3D);
      const previousActive = Viewer.variantsState?.active;
      const wasComparing = Viewer.compareState?.active === true;
      const previousCompare = wasComparing ? Viewer.getCompareForExport() : null;
      Viewer.disposeVariants({ keepConfig: true });
      Viewer.variantsRoots = roots;
      if (roots.length) {
        const variants = buildVariants(roots, Viewer.variantsManifestConfig);
        if (variants) {
          Viewer.variantsState = { ...variants, ui: null };
          const urlVariant = new URLSearchParams(window.location.search).get("variant");
          const keep = [previousActive, urlVariant].find((id) => id && variants.items.some((item) => item.id === id));
          if (keep) Viewer.variantsState.active = keep;
          Viewer.applyVariantVisibility();
          if (Viewer.variantsState.showPanel && Viewer.urlOptions?.hideUi !== true) Viewer.createVariantsPanel();
        }
      }
      // The comparison asked for by the manifest or the URL, or the one
      // open before the model was swapped (a progressive preview).
      const requested = previousCompare || Viewer.getRequestedCompare();
      if (requested) Viewer.openCompare(requested);
      return Viewer.variantsState;
    },

    hasVariants() {
      return Boolean(Viewer.variantsState);
    },

    getActiveVariant() {
      const state = Viewer.variantsState;
      return state?.items.find((item) => item.id === state.active) || null;
    },

    setActiveVariant(id) {
      const state = Viewer.variantsState;
      if (!state || !state.items.some((item) => item.id === String(id))) return false;
      state.active = String(id);
      Viewer.applyVariantVisibility();
      Viewer.syncVariantsPanel();
      return true;
    },

    // Only the objects of `id` (the active variant without) among the
    // variants' objects are shown.
    applyVariantVisibility(id = Viewer.variantsState?.active) {
      const state = Viewer.variantsState;
      if (!state) return;
      const shown = new Set(state.items.find((item) => item.id === id)?.objects || []);
      state.items.forEach((item) => item.objects.forEach((object) => {
        object.visible = shown.has(object);
      }));
    },

    // ---- comparison sides -----------------------------------------------------

    // Everything a side can show: the variants, then the timeline's stages.
    getCompareOptions() {
      const options = [];
      Viewer.variantsState?.items.forEach((item) => {
        options.push({ side: { variant: item.id }, label: readText(item.label) || item.id, item });
      });
      const timeline = Viewer.timelineState;
      timeline?.visualStages.forEach((stage) => {
        const year = Math.round(stage.year * 100) / 100;
        const label = readText(stage.label);
        options.push({
          side: { year: stage.year },
          label: label ? `${year} – ${label}` : String(year),
          stage,
        });
      });
      return options;
    },

    // A side as an option of getCompareOptions(); null when nothing matches.
    resolveCompareSide(raw) {
      const side = normalizeSide(raw);
      if (!side) return null;
      const options = Viewer.getCompareOptions();
      if (side.key != null) {
        const byVariant = options.find((option) => option.side.variant === side.key);
        if (byVariant) return byVariant;
        const year = Number(side.key);
        if (!Number.isFinite(year)) return null;
        side.year = year;
      }
      if (side.variant != null) return options.find((option) => option.side.variant === side.variant) || null;
      // A year between stages shows the last stage reached.
      const stages = options.filter((option) => option.stage);
      if (!stages.length) return null;
      let match = null;
      stages.forEach((option) => {
        if (option.side.year <= side.year + 1e-4) match = option;
      });
      return match || stages[0];
    },

    // Two different sides to start from: the manifest's, else the first and
    // the last option (two variants, or the first and last stage).
    getDefaultCompareSides() {
      const options = Viewer.getCompareOptions();
      if (options.length < 2) return null;
      const variants = options.filter((option) => option.item);
      if (variants.length >= 2) {
        const active = Viewer.variantsState?.active;
        const left = variants.find((option) => option.item.id === active) || variants[0];
        const right = variants.find((option) => option !== left);
        return [left, right];
      }
      return [options[0], options[options.length - 1]];
    },

    // The comparison the manifest or URL asks for, or null.
    getRequestedCompare() {
      const params = new URLSearchParams(window.location.search);
      const config = isPlainObject(Viewer.compareManifestConfig) ? Viewer.compareManifestConfig : null;
      const mode = params.get("compare") ?? (config && config.enabled !== false ? (config.mode || "swipe") : null);
      if (!mode || mode === "0" || mode === "false" || mode === "off") return null;
      return {
        mode: COMPARE_MODES.includes(mode) ? mode : "swipe",
        left: params.get("compareLeft") ?? config?.left ?? null,
        right: params.get("compareRight") ?? config?.right ?? null,
        position: config?.position,
      };
    },

    canCompare() {
      return Viewer.getCompareOptions().length >= 2;
    },

    // ---- comparison view ------------------------------------------------------

    openCompare({ mode = "swipe", left = null, right = null, position = DEFAULT_POSITION } = {}) {
      if (!Viewer.canCompare()) return false;
      const defaults = Viewer.getDefaultCompareSides();
      let leftOption = Viewer.resolveCompareSide(left) || defaults[0];
      let rightOption = Viewer.resolveCompareSide(right) || defaults[1];
      if (sideKey(leftOption.side) === sideKey(rightOption.side)) {
        rightOption = defaults.find((option) => sideKey(option.side) !== sideKey(leftOption.side)) || defaults[1];
      }
      if (!Viewer.compareState) Viewer.compareState = { active: false, ui: null };
      Object.assign(Viewer.compareState, {
        active: true,
        mode: COMPARE_MODES.includes(mode) ? mode : "swipe",
        position: clampPosition(position),
        left: leftOption.side,
        right: rightOption.side,
      });
      Viewer.createCompareOverlay();
      Viewer.syncCompareOverlay(true);
      Viewer.syncVariantsPanel();
      Viewer.updateEditorToolbarState?.();
      return true;
    },

    closeCompare() {
      const state = Viewer.compareState;
      if (!state) return;
      state.active = false;
      state.ui?.root.remove();
      state.ui = null;
      Viewer.compareState = null;
      // Back to what the panels show.
      Viewer.applyVariantVisibility();
      Viewer.renderTimelineStages?.(0, { force: true });
      Viewer.syncVariantsPanel();
      Viewer.updateEditorToolbarState?.();
    },

    toggleCompare(options = {}) {
      if (Viewer.compareState?.active) {
        Viewer.closeCompare();
        return false;
      }
      return Viewer.openCompare(options);
    },

    isComparing() {
      return Viewer.compareState?.active === true;
    },

    setCompareMode(mode) {
      const state = Viewer.compareState;
      if (!state || !COMPARE_MODES.includes(mode)) return;
      state.mode = mode;
      Viewer.syncCompareOverlay(true);
    },

    setCompareSide(which, raw) {
      const state = Viewer.compareState;
      const option = Viewer.resolveCompareSide(raw);
      if (!state || !option || (which !== "left" && which !== "right")) return false;
      state[which] = option.side;
      Viewer.syncCompareOverlay(true);
      return true;
    },

    setComparePosition(position) {
      const state = Viewer.compareState;
      if (!state) return;
      state.position = clampPosition(position);
      Viewer.syncCompareOverlay();
    },

    // What one side shows, set on the scene before it is drawn.
    applyCompareSide(side) {
      if (side?.variant != null) {
        Viewer.applyVariantVisibility(side.variant);
      } else {
        Viewer.applyVariantVisibility();
      }
      if (side?.year != null) Viewer.showTimelineStagesAt?.(side.year);
      else Viewer.renderTimelineStages?.(0, { force: true });
    },

    // Instead of renderFrame() while comparing (main.js animate). Returns
    // false when there is nothing to compare, so the caller draws as usual.
    renderCompareFrame(renderFrame) {
      const state = Viewer.compareState;
      const renderer = core.renderer;
      const camera = core.camera;
      if (!state?.active || !renderer || !camera || !core.scene) return false;
      if (renderer.xr?.isPresenting) return false;

      const size = renderer.getSize(new THREE.Vector2());
      const width = size.x;
      const height = size.y;
      const split = state.mode === "split";
      const divider = split ? Math.round(width / 2) : Math.round(width * state.position);
      const savedViewport = renderer.getViewport(new THREE.Vector4());
      const savedScissor = renderer.getScissor(new THREE.Vector4());
      const savedScissorTest = renderer.getScissorTest();
      const saved = camera.isPerspectiveCamera
        ? { aspect: camera.aspect }
        : { left: camera.left, right: camera.right };

      try {
        [["left", 0, divider], ["right", divider, width - divider]].forEach(([which, x, w]) => {
          if (w <= 0) return;
          Viewer.applyCompareSide(state[which]);
          renderer.setScissorTest(true);
          renderer.setScissor(x, 0, w, height);
          if (split) {
            // Each half its own view with the shared camera, narrowed to it.
            renderer.setViewport(x, 0, w, height);
            if (camera.isPerspectiveCamera) {
              camera.aspect = w / Math.max(height, 1);
            } else {
              const center = (saved.left + saved.right) / 2;
              const half = ((saved.right - saved.left) / 2) * (w / Math.max(width, 1));
              camera.left = center - half;
              camera.right = center + half;
            }
            camera.updateProjectionMatrix();
          } else {
            renderer.setViewport(0, 0, width, height);
          }
          renderFrame();
          if (split) {
            Object.assign(camera, saved);
            camera.updateProjectionMatrix();
          }
        });
      } finally {
        renderer.setScissorTest(savedScissorTest);
        renderer.setScissor(savedScissor);
        renderer.setViewport(savedViewport);
        // The scene stays as the panels show it between frames (picking,
        // exports, thumbnails).
        Viewer.applyVariantVisibility();
        Viewer.renderTimelineStages?.(0, { force: true });
      }
      Viewer.syncCompareOverlay();
      return true;
    },

    // ---- comparison overlay ---------------------------------------------------

    createCompareOverlay() {
      const state = Viewer.compareState;
      if (!state || state.ui || !core.container) return;
      const el = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
      };

      const root = el("div", "viewer-compare");
      root.id = "viewerCompare";
      const divider = el("div", "viewer-compare_divider");
      const handle = el("button", "viewer-compare_handle");
      handle.type = "button";
      handle.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor"><path d="M9 6.5v11L3.5 12zM15 6.5v11l5.5-5.5z"/></svg>';
      divider.append(handle);

      const bar = el("div", "viewer-compare_bar");
      bar.setAttribute("role", "group");
      const leftSelect = el("select", "viewer-compare_select is-left");
      const rightSelect = el("select", "viewer-compare_select is-right");
      const modeButton = el("button", "viewer-compare_mode");
      modeButton.type = "button";
      const closeButton = el("button", "viewer-compare_close", "×");
      closeButton.type = "button";
      bar.append(leftSelect, modeButton, rightSelect, closeButton);

      const leftLabel = el("div", "viewer-compare_label is-left");
      const rightLabel = el("div", "viewer-compare_label is-right");
      root.append(leftLabel, rightLabel, divider, bar);

      // Input on the overlay stays away from the orbit controls and shortcuts.
      [bar, handle].forEach((node) => ["pointerdown", "pointerup", "wheel", "keydown", "click", "dblclick"].forEach((type) => {
        node.addEventListener(type, (event) => event.stopPropagation());
      }));

      const positionAt = (clientX) => {
        const rect = root.getBoundingClientRect();
        Viewer.setComparePosition((clientX - rect.left) / Math.max(rect.width, 1));
      };
      handle.addEventListener("pointerdown", (event) => {
        if (state.mode !== "swipe") return;
        event.preventDefault();
        handle.setPointerCapture?.(event.pointerId);
        state.dragging = true;
        root.classList.add("is-dragging");
      });
      handle.addEventListener("pointermove", (event) => {
        if (state.dragging) positionAt(event.clientX);
      });
      const endDrag = (event) => {
        if (!state.dragging) return;
        state.dragging = false;
        root.classList.remove("is-dragging");
        handle.releasePointerCapture?.(event.pointerId);
      };
      handle.addEventListener("pointerup", endDrag);
      handle.addEventListener("pointercancel", endDrag);
      handle.addEventListener("keydown", (event) => {
        if (state.mode !== "swipe") return;
        const step = event.shiftKey ? KEY_STEP * 5 : KEY_STEP;
        if (event.key === "ArrowLeft") Viewer.setComparePosition(state.position - step);
        else if (event.key === "ArrowRight") Viewer.setComparePosition(state.position + step);
        else if (event.key === "Home") Viewer.setComparePosition(0);
        else if (event.key === "End") Viewer.setComparePosition(1);
        else return;
        event.preventDefault();
      });

      leftSelect.addEventListener("change", () => Viewer.setCompareSide("left", JSON.parse(leftSelect.value)));
      rightSelect.addEventListener("change", () => Viewer.setCompareSide("right", JSON.parse(rightSelect.value)));
      modeButton.addEventListener("click", () => Viewer.setCompareMode(state.mode === "swipe" ? "split" : "swipe"));
      closeButton.addEventListener("click", () => Viewer.closeCompare());

      core.container.append(root);
      state.ui = {
        root, divider, handle, bar, leftSelect, rightSelect, modeButton, closeButton, leftLabel, rightLabel,
        shown: "",
      };
      Viewer.updateCompareLabels();
    },

    // Static texts and the options (language switch, a new stage list).
    updateCompareLabels() {
      const state = Viewer.compareState;
      const ui = state?.ui;
      if (!ui) return;
      const options = Viewer.getCompareOptions();
      [ui.leftSelect, ui.rightSelect].forEach((select) => {
        select.innerHTML = "";
        const groups = [
          [t("compare.variantsGroup", "Variants"), options.filter((option) => option.item)],
          [t("compare.timelineGroup", "Timeline"), options.filter((option) => option.stage)],
        ].filter(([, items]) => items.length);
        groups.forEach(([label, items]) => {
          const parent = groups.length > 1 ? document.createElement("optgroup") : select;
          if (parent !== select) {
            parent.label = label;
            select.append(parent);
          }
          items.forEach((option) => {
            const node = document.createElement("option");
            node.value = JSON.stringify(option.side);
            node.textContent = option.label;
            parent.append(node);
          });
        });
      });
      ui.leftSelect.title = t("compare.left", "Left side");
      ui.leftSelect.setAttribute("aria-label", ui.leftSelect.title);
      ui.rightSelect.title = t("compare.right", "Right side");
      ui.rightSelect.setAttribute("aria-label", ui.rightSelect.title);
      ui.closeButton.title = t("compare.close", "Close the comparison");
      ui.closeButton.setAttribute("aria-label", ui.closeButton.title);
      ui.handle.title = t("compare.divider", "Drag to compare (arrow keys move it)");
      ui.handle.setAttribute("aria-label", ui.handle.title);
      ui.bar.setAttribute("aria-label", t("compare.title", "Compare"));
      Viewer.syncCompareOverlay(true);
    },

    // Follows the canvas, the divider and the sides; only touches the DOM
    // when something changed.
    syncCompareOverlay(force = false) {
      const state = Viewer.compareState;
      const ui = state?.ui;
      if (!ui) return;
      const canvas = core.renderer?.domElement;
      const container = core.container;
      let box = "";
      if (canvas && container) {
        const canvasRect = canvas.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        box = [
          canvasRect.left - containerRect.left + container.scrollLeft,
          canvasRect.top - containerRect.top + container.scrollTop,
          canvasRect.width,
          canvasRect.height,
        ].map((value) => Math.round(value)).join(",");
      }
      const position = state.mode === "split" ? 0.5 : state.position;
      const key = [box, state.mode, position.toFixed(4), sideKey(state.left), sideKey(state.right), core.currentLanguage].join("|");
      if (!force && key === ui.shown) return;
      ui.shown = key;

      if (box) {
        const [left, top, width, height] = box.split(",").map(Number);
        Object.assign(ui.root.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
      }
      ui.root.classList.toggle("is-split", state.mode === "split");
      ui.divider.style.left = `${position * 100}%`;
      ui.handle.tabIndex = state.mode === "swipe" ? 0 : -1;
      ui.handle.setAttribute("aria-valuenow", String(Math.round(position * 100)));
      ui.leftSelect.value = JSON.stringify(state.left);
      ui.rightSelect.value = JSON.stringify(state.right);
      const optionLabel = (side) => Viewer.getCompareOptions().find((option) => sideKey(option.side) === sideKey(side))?.label || "";
      ui.leftLabel.textContent = optionLabel(state.left);
      ui.rightLabel.textContent = optionLabel(state.right);
      ui.leftLabel.style.right = state.mode === "split" ? "50%" : `${(1 - position) * 100}%`;
      ui.rightLabel.style.left = `${position * 100}%`;
      const modeLabel = state.mode === "swipe"
        ? t("compare.toSplit", "Side by side")
        : t("compare.toSwipe", "Swipe");
      ui.modeButton.textContent = modeLabel;
      ui.modeButton.title = state.mode === "swipe"
        ? t("compare.toSplitHint", "Show the two sides side by side")
        : t("compare.toSwipeHint", "Show both sides in one view, split by a divider");
    },

    // ---- variants panel -------------------------------------------------------

    createVariantsPanel() {
      const state = Viewer.variantsState;
      if (!state || !core.container) return;
      const el = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
      };

      const panel = el("section", "viewer-variants");
      panel.id = "viewerVariants";
      panel.setAttribute("role", "group");
      const header = el("div", "viewer-variants_header");
      const title = el("span", "viewer-variants_title");
      const compareButton = el("button", "viewer-variants_compare");
      compareButton.type = "button";
      const collapseButton = el("button", "viewer-variants_collapse");
      collapseButton.type = "button";
      header.append(title, compareButton, collapseButton);

      const body = el("div", "viewer-variants_body");
      const info = el("p", "viewer-variants_info");
      const list = el("div", "viewer-variants_list");
      list.setAttribute("role", "radiogroup");
      const buttons = state.items.map((item) => {
        const button = el("button", "viewer-variants_item");
        button.type = "button";
        button.setAttribute("role", "radio");
        button.dataset.variant = item.id;
        const name = el("span", "viewer-variants_name");
        const badge = el("span", "viewer-variants_badge");
        button.append(name, badge);
        button.addEventListener("click", () => Viewer.setActiveVariant(item.id));
        list.append(button);
        return { item, button, name, badge };
      });
      const card = el("div", "viewer-variants_card");
      const description = el("p", "viewer-variants_description");
      const source = el("p", "viewer-variants_source");
      card.append(description, source);
      body.append(info, list, card);
      panel.append(header, body);

      ["pointerdown", "pointerup", "wheel", "keydown"].forEach((type) => {
        panel.addEventListener(type, (event) => event.stopPropagation());
      });
      compareButton.addEventListener("click", () => Viewer.toggleCompare());
      collapseButton.addEventListener("click", () => {
        panel.classList.toggle("is-collapsed");
        Viewer.updateVariantsLabels();
      });

      getViewerSideStack()?.append(panel);
      state.ui = { panel, title, info, compareButton, collapseButton, buttons, description, source };
      Viewer.updateVariantsLabels();
    },

    updateVariantsLabels() {
      const state = Viewer.variantsState;
      const ui = state?.ui;
      if (ui) {
        const title = readText(state.label) || t("compare.variantsTitle", "Reconstruction variants");
        ui.panel.setAttribute("aria-label", title);
        ui.title.textContent = title;
        ui.info.textContent = readText(state.description);
        ui.info.hidden = !ui.info.textContent;
        const collapsed = ui.panel.classList.contains("is-collapsed");
        ui.collapseButton.textContent = collapsed ? "▾" : "▴";
        ui.collapseButton.title = collapsed ? t("compare.expand", "Show variants") : t("compare.collapse", "Hide variants");
        ui.collapseButton.setAttribute("aria-label", ui.collapseButton.title);
        ui.collapseButton.setAttribute("aria-expanded", collapsed ? "false" : "true");
        ui.buttons.forEach(({ item, name, badge }) => {
          name.textContent = readText(item.label) || item.id;
          const level = item.certainty != null ? Viewer.getCertaintyLevel?.(item.certainty) : null;
          badge.hidden = !level;
          if (level) {
            badge.textContent = [level.code, level.symbol].filter(Boolean).join(" ");
            badge.title = Viewer.formatCertaintyLevel?.(level) || level.code;
            badge.style.setProperty("--viewer-variant-level", level.color);
          }
        });
        Viewer.syncVariantsPanel();
      }
      Viewer.updateCompareLabels();
    },

    syncVariantsPanel() {
      const state = Viewer.variantsState;
      const ui = state?.ui;
      if (!ui) return;
      const comparing = Viewer.isComparing();
      ui.buttons.forEach(({ item, button }) => {
        const active = item.id === state.active;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-checked", active ? "true" : "false");
      });
      const active = Viewer.getActiveVariant();
      ui.description.textContent = readText(active?.description);
      ui.description.hidden = !ui.description.textContent;
      const source = readText(active?.source);
      ui.source.textContent = source ? t("timeline.source", { source }, "Source: {source}") : "";
      ui.source.hidden = !source;
      ui.compareButton.classList.toggle("is-active", comparing);
      ui.compareButton.setAttribute("aria-pressed", comparing ? "true" : "false");
      ui.compareButton.textContent = t("compare.title", "Compare");
      ui.compareButton.title = comparing ? t("compare.close", "Close the comparison") : t("compare.open", "Compare two variants side by side");
    },

    // ---- manifests ------------------------------------------------------------

    // AIM3DViewer.variants of an exported manifest.
    getVariantsForExport() {
      const state = Viewer.variantsState;
      if (!state) return Viewer.variantsManifestConfig?.enabled === false ? { enabled: false } : undefined;
      return {
        ...(state.label ? { label: state.label } : {}),
        ...(state.description ? { description: state.description } : {}),
        active: state.active,
        ...(state.showPanel ? {} : { showPanel: false }),
        items: state.items.map((item) => ({
          id: item.id,
          ...(item.label != null && item.label !== item.id ? { label: item.label } : {}),
          ...(item.description ? { description: item.description } : {}),
          ...(item.source ? { source: item.source } : {}),
          ...(item.certainty != null ? { certainty: item.certainty } : {}),
          ...(item.nodes.length ? { nodes: item.nodes } : {}),
        })),
      };
    },

    // AIM3DViewer.compare of an exported manifest, while comparing.
    getCompareForExport() {
      const state = Viewer.compareState;
      if (!state?.active) return undefined;
      return {
        mode: state.mode,
        left: { ...state.left },
        right: { ...state.right },
        ...(state.mode === "swipe" ? { position: Math.round(state.position * 1000) / 1000 } : {}),
      };
    },

    // A manifest's variants and comparison (absent: the model's own
    // variants, no comparison).
    apply3IFManifestVariants(variantsConfig, compareConfig) {
      Viewer.variantsManifestConfig = isPlainObject(variantsConfig) ? variantsConfig : null;
      Viewer.compareManifestConfig = isPlainObject(compareConfig) ? compareConfig : null;
      const roots = Viewer.variantsRoots;
      if (!roots?.length) return false;
      Viewer.closeCompare();
      Viewer.setupVariants(roots.length === 1 ? roots[0] : roots);
      return Boolean(variantsConfig || compareConfig) && Boolean(Viewer.variantsState || Viewer.compareState);
    },

    disposeVariants({ keepConfig = false } = {}) {
      Viewer.closeCompare();
      const state = Viewer.variantsState;
      if (state) {
        state.items.forEach((item) => item.objects.forEach((object) => {
          object.visible = true;
        }));
        state.ui?.panel.remove();
      }
      Viewer.variantsState = null;
      if (!keepConfig) {
        Viewer.variantsManifestConfig = null;
        Viewer.compareManifestConfig = null;
        Viewer.variantsRoots = null;
      }
    },
  });
}
