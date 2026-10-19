import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { placeOnGrid, toastHelper } from "../viewer-utils.js";
import { applyUpAxis, getUpAxis, normalizeUpAxis } from "../up-axis.js";

// The up-axis choices' names, in the viewer's language (the toolbar's
// "Up axis" menu).
export function upAxisLabel(axis) {
  const labels = {
    "Y+": () => t("gui.upAxisYPlus", "Y up (default)"),
    "Y-": () => t("gui.upAxisYMinus", "Upside down (-Y up)"),
    "Z+": () => t("gui.upAxisZPlus", "Z up"),
    "Z-": () => t("gui.upAxisZMinus", "-Z up"),
    "X+": () => t("gui.upAxisXPlus", "X up"),
    "X-": () => t("gui.upAxisXMinus", "-X up"),
  };
  return labels[axis]?.() ?? axis;
}

// Editor side of up-axis.js: turning the loaded model upright by naming
// which axis of its file is up. Saved with the rotation (metadata) and as
// AIM3DViewer.modelTransform.upAxis (manifest).
export function attachUpAxisEditor(Viewer) {
  Object.assign(Viewer, {
    getUpAxisRoot() {
      const root = core.helperObjects?.[0]
        ?? (Array.isArray(core.mainObject) ? core.mainObject.find((item) => item?.isObject3D) : null);
      return Array.isArray(root) ? root[0] : root;
    },

    getModelUpAxis() {
      const root = this.getUpAxisRoot();
      return root ? getUpAxis(root) : null;
    },

    setUpAxis(axis, { silent = false } = {}) {
      const root = this.getUpAxisRoot();
      const upAxis = normalizeUpAxis(axis);
      if (!root || !upAxis) return false;
      if (root.userData?.isTiledModel) {
        if (!silent) toastHelper("upAxisNotForTiles", "warning");
        return false;
      }
      if (!applyUpAxis(root, upAxis)) {
        this.updateUpAxisSubmenuState?.();
        return false;
      }
      // The section outline is a copy sharing the model's geometry: only
      // its pivot needs turning.
      if (core.outlineClipping) applyUpAxis(core.outlineClipping, upAxis, { bakeGeometry: false });
      // Upright on the grid again, as after loading.
      if (!core.PRESENTATION_MODE) placeOnGrid(root);
      this.syncOutlineClippingTransform?.();
      this.disposeFacePickCache?.();
      this.refreshClippingForModel?.(root);
      this.refreshAnnotationPOIs?.();
      this.updateUpAxisSubmenuState?.();
      this.render?.();
      return true;
    },
  });
}
