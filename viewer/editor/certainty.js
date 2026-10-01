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

    setCertaintyScale(raw) {
      Viewer.certaintyScale = normalizeCertaintyScale(raw);
      Viewer.certaintyScaleFromManifest = raw != null;
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

    // Paints the model for the view; does nothing while it is off.
    applyCertaintyView() {
      Viewer.removeCertaintyOverlays();
      if (!Viewer.certaintyView) return;

      const overlays = new Map();
      Viewer.certaintyOverlays = overlays;
      const paint = (mesh, color) => {
        if (!mesh.isMesh || !mesh.geometry || mesh.userData?.isCertaintyOverlay) return;
        if (Viewer.isPickingOverlayObject?.(mesh)) return;
        const overlay = overlays.get(mesh);
        if (overlay) {
          overlay.material.color.set(color);
          return;
        }
        overlays.set(mesh, Viewer.createCertaintyOverlay(mesh, color));
      };

      Viewer.getCertaintyRoots().forEach((root) => {
        root.traverse((child) => paint(child, Viewer.certaintyScale.unassessedColor));
      });
      const counts = new Map();
      Viewer.getCertaintyAssessments().forEach(({ level, node }) => {
        node.traverse((child) => paint(child, level.color));
        counts.set(level.code, (counts.get(level.code) || 0) + 1);
      });
      overlays.forEach((overlay, mesh) => mesh.add(overlay));
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

    // Before a new model: its meshes are gone, the view stays switched on.
    disposeCertaintyView() {
      Viewer.certaintyOverlays = null;
      Viewer.removeCertaintyLegend();
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
          if (event.target.closest(".certainty-legend__close")) Viewer.setCertaintyView(false);
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
      const rows = scale.levels.map((level, index) => {
        const range = certaintyLevelRange(scale, index);
        const count = counts.get(level.code) || 0;
        return `
          <li class="certainty-legend__row" data-code="${escapeHtml(level.code)}">
            <span class="certainty-legend__swatch" style="background:${level.color};color:${contrastColor(level.color)}" aria-hidden="true">${escapeHtml(level.symbol || level.code)}</span>
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
          <button type="button" class="certainty-legend__close" aria-label="${escapeHtml(closeLabel)}" title="${escapeHtml(closeLabel)}">&times;</button>
        </div>
        <ul class="certainty-legend__levels">
          ${rows}
          <li class="certainty-legend__row certainty-legend__row--unassessed">
            <span class="certainty-legend__swatch" style="background:${scale.unassessedColor};color:${contrastColor(scale.unassessedColor)}" aria-hidden="true">–</span>
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
