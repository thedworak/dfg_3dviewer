import { ViewHelper } from "three/examples/jsm/helpers/ViewHelper.js";
import { core } from "../core.js";

// Axes gizmo in a corner of the canvas. Clicking an axis turns the camera to
// look along it (front/top/side views). Settings (viewer-settings.json →
// viewer.viewHelper): enabled (bool, default true), position ("bottom-right",
// "bottom-left", "top-right", "top-left"). URL override: ?viewHelper=0|1.

const HELPER_SIZE = 128;
// Below this canvas size the gizmo would cover too much of the model.
const MIN_CANVAS_SIZE = HELPER_SIZE * 2.5;
const MARGIN = 8;

export function attachViewHelper(Viewer) {
  Object.assign(Viewer, {
    viewHelper: null,

    isViewHelperEnabled() {
      if (core.PRESENTATION_MODE === true || Viewer.urlOptions?.hideUi === true) return false;
      const param = Viewer.parseBooleanParam?.(new URLSearchParams(window.location.search).get("viewHelper"));
      if (typeof param === "boolean") return param;
      const config = core.CONFIG?.viewer?.viewHelper;
      if (typeof config === "boolean") return config;
      return config?.enabled !== false;
    },

    initViewHelper() {
      if (Viewer.viewHelper || !core.renderer || !core.camera || !Viewer.isViewHelperEnabled()) return;
      const helper = new ViewHelper(core.camera, core.renderer.domElement);
      helper.setLabels?.("X", "Y", "Z");

      const position = String(core.CONFIG?.viewer?.viewHelper?.position || "bottom-right");
      const [vertical, horizontal] = position.split("-");
      helper.location = {
        top: vertical === "top" ? MARGIN : null,
        bottom: vertical === "top" ? null : MARGIN,
        left: horizontal === "left" ? MARGIN : null,
        right: horizontal === "left" ? null : MARGIN,
      };
      Viewer.viewHelper = helper;
    },

    isViewHelperVisible() {
      const canvas = core.renderer?.domElement;
      return Boolean(
        Viewer.viewHelper &&
        canvas &&
        canvas.offsetWidth >= MIN_CANVAS_SIZE &&
        canvas.offsetHeight >= MIN_CANVAS_SIZE
      );
    },

    // Called from the render loop after the scene has been drawn.
    renderViewHelper(delta) {
      const helper = Viewer.viewHelper;
      if (!helper) return;
      // setCameraProjection() swaps core.camera, so rebind every frame.
      helper.camera = core.camera;
      if (core.controls?.target) helper.center.copy(core.controls.target);
      if (helper.animating) helper.update(delta);
      if (!Viewer.isViewHelperVisible()) return;
      // The renderer keeps autoClear on, which would wipe the scene drawn
      // just before; the helper only needs its own depth cleared.
      const autoClear = core.renderer.autoClear;
      core.renderer.autoClear = false;
      helper.render(core.renderer);
      core.renderer.autoClear = autoClear;
    },

    // Returns true when the click hit an axis and started a camera turn.
    handleViewHelperClick(event) {
      if (!Viewer.isViewHelperVisible()) return false;
      if (!core.controls?.enabled) return false;
      return Viewer.viewHelper.handleClick(event);
    },

    disposeViewHelper() {
      Viewer.viewHelper?.dispose();
      Viewer.viewHelper = null;
    },
  });
}
