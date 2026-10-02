import { core } from "../core.js";
import THREE from "../init.js";
import { t } from "../i18n-utils.js";
import { getViewerSideStack } from "../ui/side-stack.js";
import {
  certaintyLevelForValue,
  certaintyText,
  normalizeCertaintyAssessment,
  normalizeCertaintyScale,
} from "../manifesto/certainty-scale.js";

// Level of Certainty (LoC) view: every assessed object (or group) of the
// model painted in its level's colour, the rest grey, a legend of the scale
// and annotation badges showing the level's code and symbol instead of their
// number. The assessments live on the annotations (entry.certainty, see
// manifesto/certainty-scale.js); the scale comes from the manifest
// (AIM3DViewer.certainty) or is the default one.
//
// The colours are overlays: a copy of each mesh, sharing its geometry, in a
// see-through material (opacity from the scale, 40% by default, set from the
// legend), so the model's own materials show through. The overlays are
// children of their meshes, ignored by picking, and removed when the view is
// switched off.

// Black or white, whichever reads better on `hex`.
function contrastColor(hex) {
  const color = new THREE.Color(hex);
  const luminance = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
  return luminance > 0.45 ? "#111827" : "#ffffff";
}

// Filter key of the objects no annotation assesses.
const UNASSESSED = "__unassessed__";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]
  ));
}

export function attachCertainty(Viewer) {
  Object.assign(Viewer, {
    certaintyScale: normalizeCertaintyScale(null),
    // Exported only when a manifest gave it or an annotation is assessed.
    certaintyScaleFromManifest: false,
    certaintyView: false,
    // mesh -> its colour overlay, while the view is on.
    certaintyOverlays: null,
    certaintyLegend: null,
    // Level codes (and UNASSESSED) picked in the legend, or null: no filter,
    // every level shown. An empty set (Select none) shows none.
    certaintyFilter: null,

    setCertaintyScale(raw) {
      Viewer.certaintyScale = normalizeCertaintyScale(raw);
      Viewer.certaintyScaleFromManifest = raw != null;
      Viewer.certaintyFilter = null;
      Viewer.populateCertaintyDialogOptions?.();
      if (Viewer.certaintyView) Viewer.refreshAnnotationPOIs?.();
    },

    // The scale as written to a manifest's AIM3DViewer block, or undefined
    // when nothing uses it.
    getCertaintyScaleForExport() {
      const assessed = (Viewer.annotationEntries || []).some((entry) => entry?.certainty);
      if (!Viewer.certaintyScaleFromManifest && !assessed) return undefined;
      const { min, max, unassessedColor, opacity, levels, label } = Viewer.certaintyScale;
      return {
        min,
        max,
        unassessedColor,
        opacity,
        ...(label ? { label: structuredClone(label) } : {}),
        visible: Viewer.certaintyView === true,
        levels: levels.map((level) => structuredClone(level)),
      };
    },

    getCertaintyLevel(value) {
      return certaintyLevelForValue(Viewer.certaintyScale, value);
    },

    getCertaintyLevelForEntry(entry) {
      return entry?.certainty ? Viewer.getCertaintyLevel(entry.certainty.value) : null;
    },

    getCertaintyLevelLabel(level) {
      return certaintyText(level?.label, core.currentLanguage || "en");
    },

    // "C ▲ Indirect sources" - the code and symbol keep levels apart
    // without colour.
    formatCertaintyLevel(level) {
      if (!level) return "";
      return [level.code, level.symbol, Viewer.getCertaintyLevelLabel(level)].filter(Boolean).join(" ");
    },

    normalizeCertainty(raw) {
      return normalizeCertaintyAssessment(raw, Viewer.certaintyScale);
    },

    // The object an assessment of `targetId` paints: the object itself, or
    // the group it belongs to (its parent, while inside the model).
    resolveCertaintyTargetId(targetId, scope) {
      if (scope !== "group") return targetId;
      const object = Viewer.resolveObjectByTargetId(targetId);
      const parent = object?.parent;
      if (!parent || parent === core.scene || !parent.parent) return targetId;
      return Viewer.resolveFaceTargetId(parent) || targetId;
    },

    // Assessed annotations with their level and the object they paint,
    // outermost first so an object's own assessment wins over its group's.
    getCertaintyAssessments() {
      return (Viewer.annotationEntries || [])
        .map((entry) => {
          const level = Viewer.getCertaintyLevelForEntry(entry);
          if (!level) return null;
          const targetId = entry.certainty.targetId
            || Viewer.resolveCertaintyTargetId(entry.targetId || entry.object, entry.certainty.scope);
          const node = Viewer.resolveObjectByTargetId(targetId);
          if (!node) return null;
          let depth = 0;
          for (let current = node; current.parent; current = current.parent) depth += 1;
          return { entry, level, node, depth };
        })
        .filter(Boolean)
        .sort((a, b) => a.depth - b.depth);
    },

    getCertaintyRoots() {
      const slots = Array.isArray(core.mainObject) ? core.mainObject : [core.mainObject];
      return slots.flat().filter((item) => item?.isObject3D);
    },

    // Whether the legend's filter shows objects (and badges) of `key`, a
    // level code or UNASSESSED.
    isCertaintyKeyShown(key) {
      const filter = Viewer.certaintyFilter;
      return !filter || filter.has(key);
    },

    // An annotation badge hidden by the legend's filter.
    isCertaintyEntryFilteredOut(entry) {
      if (!Viewer.certaintyView || !Viewer.certaintyFilter) return false;
      const level = Viewer.getCertaintyLevelForEntry(entry);
      return !Viewer.isCertaintyKeyShown(level ? level.code : UNASSESSED);
    },

    // Every key the legend can filter by: the levels and UNASSESSED.
    getCertaintyFilterKeys() {
      return [...Viewer.certaintyScale.levels.map((level) => level.code), UNASSESSED];
    },

    // Picks or drops `key` in the filter and repaints; dropping the last one
    // lifts the filter.
    toggleCertaintyFilter(key) {
      const filter = new Set(Viewer.certaintyFilter || []);
      if (filter.has(key)) filter.delete(key);
      else filter.add(key);
      return Viewer.setCertaintyFilter(filter.size ? filter : null);
    },

    // Select all (every level picked) or none (nothing painted).
    selectAllCertaintyLevels(all) {
      return Viewer.setCertaintyFilter(all ? Viewer.getCertaintyFilterKeys() : []);
    },

    // `keys`: the keys to show, or null for no filter. Repaints.
    setCertaintyFilter(keys) {
      Viewer.certaintyFilter = keys == null ? null : new Set(keys);
      Viewer.refreshAnnotationPOIs?.();
      return Viewer.certaintyFilter ? Array.from(Viewer.certaintyFilter) : null;
    },

    // Every level picked, or no filter at all.
    isEveryCertaintyLevelShown() {
      const filter = Viewer.certaintyFilter;
      return !filter || Viewer.getCertaintyFilterKeys().every((key) => filter.has(key));
    },

    // Paints the model for the view; does nothing while it is off. Objects
    // of levels left out by the legend's filter keep their own look.
    applyCertaintyView() {
      Viewer.removeCertaintyOverlays();
      if (!Viewer.certaintyView) return;

      // mesh -> { color, key }, the last paint winning.
      const paints = new Map();
      const paint = (mesh, color, key) => {
        if (!mesh.isMesh || !mesh.geometry || mesh.userData?.isCertaintyOverlay) return;
        if (Viewer.isPickingOverlayObject?.(mesh)) return;
        paints.set(mesh, { color, key });
      };

      Viewer.getCertaintyRoots().forEach((root) => {
        root.traverse((child) => paint(child, Viewer.certaintyScale.unassessedColor, UNASSESSED));
      });
      const counts = new Map();
      Viewer.getCertaintyAssessments().forEach(({ level, node }) => {
        node.traverse((child) => paint(child, level.color, level.code));
        counts.set(level.code, (counts.get(level.code) || 0) + 1);
      });

      const overlays = new Map();
      Viewer.certaintyOverlays = overlays;
      paints.forEach(({ color, key }, mesh) => {
        if (!Viewer.isCertaintyKeyShown(key)) return;
        const overlay = Viewer.createCertaintyOverlay(mesh, color);
        overlays.set(mesh, overlay);
        mesh.add(overlay);
      });
      Viewer.renderCertaintyLegend(counts);
    },

    // A see-through copy of `mesh` in `color`, drawn over it (polygon offset)
    // and never hit by a raycast.
    createCertaintyOverlay(mesh, color) {
      const own = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      const material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.85,
        metalness: 0,
        side: own?.side ?? THREE.FrontSide,
        wireframe: core.wireframeMode === true,
        clippingPlanes: own?.clippingPlanes || null,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      applyOverlayOpacity(material, Viewer.certaintyScale.opacity);
      const overlay = new THREE.Mesh(mesh.geometry, material);
      overlay.name = "certainty-overlay";
      overlay.userData.isCertaintyOverlay = true;
      overlay.userData.isPickingOverlay = true;
      overlay.raycast = () => {};
      return overlay;
    },

    // Removes the overlays (the geometry is the mesh's own: kept).
    removeCertaintyOverlays() {
      const overlays = Viewer.certaintyOverlays;
      if (!overlays) return;
      overlays.forEach((overlay) => {
        overlay.removeFromParent();
        overlay.material.dispose();
      });
      Viewer.certaintyOverlays = null;
    },

    // Opacity of the colour overlays, 0-1; kept in the scale, so it is
    // exported with it.
    setCertaintyOpacity(opacity) {
      const value = Math.min(1, Math.max(0, Number(opacity)));
      if (!Number.isFinite(value)) return Viewer.certaintyScale.opacity;
      Viewer.certaintyScale.opacity = value;
      Viewer.certaintyOverlays?.forEach((overlay) => applyOverlayOpacity(overlay.material, value));
      Viewer.syncCertaintyOpacityControl();
      return value;
    },

    syncCertaintyOpacityControl() {
      const legend = Viewer.certaintyLegend;
      if (!legend) return;
      const percent = Math.round(Viewer.certaintyScale.opacity * 100);
      const input = legend.querySelector(".certainty-legend__opacity input");
      const output = legend.querySelector(".certainty-legend__opacity output");
      if (input && Number(input.value) !== percent) input.value = String(percent);
      if (output) output.textContent = `${percent}%`;
    },

    setCertaintyView(enabled) {
      Viewer.certaintyView = enabled === true;
      if (!Viewer.certaintyView) {
        Viewer.certaintyFilter = null;
        Viewer.removeCertaintyOverlays();
        Viewer.removeCertaintyLegend();
      }
      // Repaints (applyCertaintyView) and redraws the badges.
      Viewer.refreshAnnotationPOIs?.();
      Viewer.updateEditorToolbarLabels?.();
      Viewer.updateEditorToolbarState?.();
      return Viewer.certaintyView;
    },

    toggleCertaintyView() {
      return Viewer.setCertaintyView(!Viewer.certaintyView);
    },

    // Before a new model: its meshes are gone, and the view, the filter and
    // the scale go with the old model. A manifest with a visible scale
    // switches the view back on (import3IFManifest).
    disposeCertaintyView() {
      Viewer.certaintyOverlays = null;
      Viewer.removeCertaintyLegend();
      Viewer.certaintyView = false;
      Viewer.certaintyFilter = null;
      Viewer.certaintyScale = normalizeCertaintyScale(null);
      Viewer.certaintyScaleFromManifest = false;
      Viewer.populateCertaintyDialogOptions?.();
      Viewer.updateEditorToolbarLabels?.();
      Viewer.updateEditorToolbarState?.();
    },

    applyCertaintyLanguage() {
      Viewer.populateCertaintyDialogOptions?.();
      if (Viewer.certaintyView) Viewer.refreshAnnotationPOIs?.();
    },

    removeCertaintyLegend() {
      Viewer.certaintyLegend?.remove();
      Viewer.certaintyLegend = null;
    },

    // The scale, highest level first: swatch with the level's symbol, its
    // code, name, range and how many objects are assessed at it.
    renderCertaintyLegend(counts = new Map()) {
      // With the other floating panels, so they stack instead of overlapping.
      const stack = getViewerSideStack();
      if (!stack) return;
      let legend = Viewer.certaintyLegend;
      if (!legend) {
        legend = document.createElement("section");
        legend.className = "certainty-legend";
        legend.setAttribute("aria-live", "polite");
        legend.addEventListener("click", (event) => {
          if (event.target.closest(".certainty-legend__close")) {
            Viewer.setCertaintyView(false);
            return;
          }
          const toggleAll = event.target.closest(".certainty-legend__select-all");
          if (toggleAll) {
            Viewer.selectAllCertaintyLevels(toggleAll.dataset.select === "all");
            return;
          }
          const swatch = event.target.closest(".certainty-legend__swatch[data-filter]");
          if (swatch) Viewer.toggleCertaintyFilter(swatch.dataset.filter);
        });
        legend.addEventListener("input", (event) => {
          if (event.target.matches(".certainty-legend__opacity input")) {
            Viewer.setCertaintyOpacity(Number(event.target.value) / 100);
          }
        });
        stack.appendChild(legend);
        Viewer.certaintyLegend = legend;
      }
      const scale = Viewer.certaintyScale;
      const title = scale.label
        ? certaintyText(scale.label, core.currentLanguage || "en")
        : t("certainty.legendTitle", "Level of Certainty (LoC)");
      const filter = Viewer.certaintyFilter;
      const filterTitle = escapeHtml(t("certainty.filter", "Show only this level (click again to undo)"));
      // A swatch is a toggle button of the filter; the picked ones ringed,
      // the rows left out dimmed.
      const swatch = (key, color, text) => `
            <button type="button" class="certainty-legend__swatch${filter?.has(key) ? " is-active" : ""}" data-filter="${escapeHtml(key)}" aria-pressed="${filter?.has(key) === true}" title="${filterTitle}" style="background:${color};color:${contrastColor(color)}">${escapeHtml(text)}</button>`;
      const rowClass = (key) => (filter && !filter.has(key) ? " is-filtered-out" : "");
      // Select none while everything shows, select all otherwise.
      const selectAll = !Viewer.isEveryCertaintyLevelShown();
      const selectLabel = selectAll
        ? t("certainty.selectAll", "Select all")
        : t("certainty.selectNone", "Select none");
      const rows = scale.levels.map((level, index) => {
        const range = certaintyLevelRange(scale, index);
        const count = counts.get(level.code) || 0;
        return `
          <li class="certainty-legend__row${rowClass(level.code)}" data-code="${escapeHtml(level.code)}">${swatch(level.code, level.color, level.symbol || level.code)}
            <span class="certainty-legend__code">${escapeHtml(level.code)}</span>
            <span class="certainty-legend__label">${escapeHtml(Viewer.getCertaintyLevelLabel(level))}</span>
            <span class="certainty-legend__range">${escapeHtml(range)}</span>
            <span class="certainty-legend__count" title="${escapeHtml(t("certainty.assessedCount", "Assessed objects"))}">${count}</span>
          </li>`;
      }).join("");
      const closeLabel = t("certainty.hideView", "Hide Level of Certainty");
      legend.innerHTML = `
        <div class="certainty-legend__header">
          <h4 class="certainty-legend__title">${escapeHtml(title)}</h4>
          <button type="button" class="certainty-legend__select-all" data-select="${selectAll ? "all" : "none"}">${escapeHtml(selectLabel)}</button>
          <button type="button" class="certainty-legend__close" aria-label="${escapeHtml(closeLabel)}" title="${escapeHtml(closeLabel)}">&times;</button>
        </div>
        <ul class="certainty-legend__levels">
          ${rows}
          <li class="certainty-legend__row certainty-legend__row--unassessed${rowClass(UNASSESSED)}">${swatch(UNASSESSED, scale.unassessedColor, "–")}
            <span class="certainty-legend__code"></span>
            <span class="certainty-legend__label">${escapeHtml(t("certainty.unassessed", "Not assessed"))}</span>
          </li>
        </ul>
        <label class="certainty-legend__opacity">
          <span>${escapeHtml(t("certainty.opacity", "Overlay opacity"))}</span>
          <input type="range" min="0" max="100" step="5" value="${Math.round(scale.opacity * 100)}" />
          <output>${Math.round(scale.opacity * 100)}%</output>
        </label>`;
    },

    // An annotation badge in the view: the level's colour, its code large
    // and its symbol small beneath.
    createCertaintyBadgeTexture(level) {
      const size = 256;
      const center = size / 2;
      const radius = size * 0.4;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");

      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
      ctx.shadowBlur = size * 0.08;
      ctx.shadowOffsetY = size * 0.015;
      ctx.fillStyle = level.color;
      ctx.beginPath();
      ctx.arc(center, center, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.lineWidth = size * 0.04;
      ctx.strokeStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(center, center, radius, 0, Math.PI * 2);
      ctx.stroke();

      const ink = contrastColor(level.color);
      ctx.fillStyle = ink;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      let fontSize = size * (level.symbol ? 0.36 : 0.46);
      ctx.font = `700 ${fontSize}px system-ui, Arial, sans-serif`;
      const maxTextWidth = radius * 1.35;
      const textWidth = ctx.measureText(level.code).width;
      if (textWidth > maxTextWidth) {
        fontSize *= maxTextWidth / textWidth;
        ctx.font = `700 ${fontSize}px system-ui, Arial, sans-serif`;
      }
      ctx.fillText(level.code, center, level.symbol ? center - size * 0.06 : center + fontSize * 0.04);
      if (level.symbol) {
        ctx.font = `600 ${size * 0.2}px system-ui, Arial, sans-serif`;
        ctx.fillText(level.symbol, center, center + size * 0.2);
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      return texture;
    },
  });
}

// The values a level covers: from its own up to the next level's (or the
// scale's maximum). On a whole-number scale "8–9", otherwise "8–<10".
function certaintyLevelRange(scale, index) {
  const lower = scale.levels[index].value;
  const isTop = index === 0;
  const above = isTop ? scale.max : scale.levels[index - 1].value;
  const whole = Number.isInteger(lower) && Number.isInteger(above);
  const upper = isTop ? above : (whole ? above - 1 : above);
  if (upper <= lower) return `${lower}`;
  return isTop || whole ? `${lower}–${upper}` : `${lower}–<${upper}`;
}

// See-through below 1; opaque overlays write depth like any surface.
function applyOverlayOpacity(material, opacity) {
  const transparent = opacity < 1;
  if (material.transparent !== transparent) material.needsUpdate = true;
  material.transparent = transparent;
  material.opacity = opacity;
  material.depthWrite = !transparent;
}
