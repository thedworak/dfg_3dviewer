import THREE from "../init.js";
import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { toastHelper, updateActiveClippingPlanes } from "../viewer-utils.js";
import { getViewerSideStack } from "../ui/side-stack.js";

// Section (clipping) planes, one per world axis.
//
// The planes themselves live in core.clippingPlanes and their on/off state in
// core.planeParams.clippingMode, which manifests, share links and the embed
// configurator read and write. On top of that this module keeps each cut as a
// fraction of the model's bounding box, so the cut stays in the same relative
// place when the model is transformed or replaced by another one.
//
// Planes are moved by dragging their coloured quad in the scene or with the
// sliders in the clipping panel. A plane keeps the part of the model on its
// "negative" side (x <= position); flipping keeps the other side.

export const CLIPPING_AXES = ["x", "y", "z"];
const AXIS_INDEX = { x: 0, y: 1, z: 2 };
const AXIS_VECTORS = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};
const AXIS_COLORS = { x: 0xe53935, y: 0x43a047, z: 0x1e88e5 };
const PARAM_KEYS = {
  x: { group: "planeX", constant: "constantX", helper: "displayHelperX" },
  y: { group: "planeY", constant: "constantY", helper: "displayHelperY" },
  z: { group: "planeZ", constant: "constantZ", helper: "displayHelperZ" },
};
// Planes can be dragged a little past the model so it can be fully shown.
const OVERSHOOT = 0.05;
const QUAD_MARGIN = 1.15;
const QUAD_OPACITY = { idle: 0.1, hover: 0.22, drag: 0.28 };
const SLIDER_STEPS = 1000;

function createAxisVisual(axis) {
  const group = new THREE.Group();
  group.name = "ClippingPlaneVisual";
  group.userData.noClipping = true;
  group.userData.clippingAxis = axis;
  group.visible = false;
  group.renderOrder = 997;

  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      color: AXIS_COLORS[axis],
      transparent: true,
      opacity: QUAD_OPACITY.idle,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  quad.userData.clippingAxis = axis;

  const border = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.5, -0.5, 0),
      new THREE.Vector3(0.5, -0.5, 0),
      new THREE.Vector3(0.5, 0.5, 0),
      new THREE.Vector3(-0.5, 0.5, 0),
    ]),
    new THREE.LineBasicMaterial({ color: AXIS_COLORS[axis], transparent: true, opacity: 0.85, depthTest: false })
  );
  border.renderOrder = 998;

  // PlaneGeometry lies in XY; turn it so its normal points along the axis.
  if (axis === "x") group.rotation.y = Math.PI / 2;
  if (axis === "y") group.rotation.x = -Math.PI / 2;

  group.add(quad, border);
  return { group, quad, border };
}

export function attachClipping(Viewer) {
  Object.assign(Viewer, {
    clippingState: {
      bounds: null,
      root: null,
      fraction: { x: 0.5, y: 0.5, z: 0.5 },
      remembered: null,
      visuals: null,
      hoverAxis: null,
      drag: null,
      panel: null,
      interactionBound: false,
    },

    isClippingAvailable() {
      return !core.PRESENTATION_MODE && Array.isArray(core.clippingPlanes) && core.clippingPlanes.length >= 3;
    },

    isClippingAxisEnabled(axis) {
      return core.planeParams?.clippingMode?.[axis] === true;
    },

    hasActiveClipping() {
      return CLIPPING_AXES.some((axis) => Viewer.isClippingAxisEnabled(axis));
    },

    isClippingAxisNegated(axis) {
      return core.planeParams?.[PARAM_KEYS[axis].group]?.negated === true;
    },

    // World coordinate of the cut along the axis.
    getClippingAxisPosition(axis) {
      const plane = core.clippingPlanes?.[AXIS_INDEX[axis]];
      if (!plane) return 0;
      return Viewer.isClippingAxisNegated(axis) ? -plane.constant : plane.constant;
    },

    getClippingAxisRange(axis) {
      const bounds = Viewer.clippingState.bounds;
      if (!bounds) return null;
      const min = bounds.min[axis];
      const max = bounds.max[axis];
      const pad = Math.max(max - min, 1e-6) * OVERSHOOT;
      return { min, max, low: min - pad, high: max + pad, size: Math.max(max - min, 1e-6) };
    },

    setClippingAxisPosition(axis, position, { clamp = true } = {}) {
      if (!Viewer.isClippingAvailable() || !Number.isFinite(position)) return;
      const range = Viewer.getClippingAxisRange(axis);
      let value = position;
      if (range && clamp) value = THREE.MathUtils.clamp(value, range.low, range.high);
      if (range) Viewer.clippingState.fraction[axis] = (value - range.min) / range.size;

      const plane = core.clippingPlanes[AXIS_INDEX[axis]];
      const negated = Viewer.isClippingAxisNegated(axis);
      plane.normal.copy(AXIS_VECTORS[axis]).multiplyScalar(negated ? 1 : -1);
      plane.constant = negated ? -value : value;
      const keys = PARAM_KEYS[axis];
      if (core.planeParams?.[keys.group]) core.planeParams[keys.group][keys.constant] = plane.constant;

      Viewer.updateClippingVisual(axis);
      Viewer.updateClippingGui();
      Viewer.updateClippingPanel();
    },

    setClippingAxisNegated(axis, negated) {
      const position = Viewer.getClippingAxisPosition(axis);
      const keys = PARAM_KEYS[axis];
      if (core.planeParams?.[keys.group]) core.planeParams[keys.group].negated = negated === true;
      Viewer.setClippingAxisPosition(axis, position, { clamp: false });
    },

    setClippingAxisEnabled(axis, enabled, { silent = false } = {}) {
      if (!Viewer.isClippingAvailable() || !core.planeParams?.clippingMode) return;
      const active = enabled === true;
      core.planeParams.clippingMode[axis] = active;
      const keys = PARAM_KEYS[axis];
      if (core.planeParams[keys.group]) core.planeParams[keys.group][keys.helper] = active;
      if (active && !Viewer.clippingMode) {
        Viewer.clippingMode = true;
      }
      if (!silent) {
        toastHelper("clippingHelperToggle", "info", { axis: axis.toUpperCase(), state: active });
      }
      Viewer.applyClippingState();
    },

    toggleClippingPlaneHelper(axis) {
      Viewer.setClippingAxisEnabled(axis, !Viewer.isClippingAxisEnabled(axis));
    },

    toggleClippingPlaneVisible() {
      Viewer.setClippingFillVisible(!(core.planeParams?.outline?.visible === true));
    },

    setClippingFillVisible(visible) {
      if (!core.planeParams?.outline) return;
      core.planeParams.outline.visible = visible === true;
      Viewer.applyClippingState();
    },

    // The clipping tool: turning it off removes all cuts, turning it back on
    // restores the axes that were active before (X for a first use).
    toggleClippingPlanesPanel() {
      if (!Viewer.isClippingAvailable()) return;
      const state = Viewer.clippingState;
      Viewer.clippingMode = !Viewer.clippingMode;
      if (Viewer.clippingMode) {
        const restore = state.remembered || { x: true, y: false, z: false };
        CLIPPING_AXES.forEach((axis) => {
          core.planeParams.clippingMode[axis] = restore[axis] === true;
        });
        toastHelper("clippingEnabled", { duration: 2600 });
      } else {
        state.remembered = { ...core.planeParams.clippingMode };
        CLIPPING_AXES.forEach((axis) => {
          core.planeParams.clippingMode[axis] = false;
        });
        toastHelper("clippingDisabled");
      }
      Viewer.applyClippingState();
    },

    resetClippingPlanes() {
      CLIPPING_AXES.forEach((axis) => {
        core.planeParams[PARAM_KEYS[axis].group].negated = false;
        Viewer.clippingState.fraction[axis] = 0.5;
      });
      Viewer.positionClippingPlanesFromFractions();
    },

    // Pushes the current state into materials, visuals, outline and UI.
    applyClippingState() {
      updateActiveClippingPlanes();
      CLIPPING_AXES.forEach((axis) => {
        const keys = PARAM_KEYS[axis];
        if (core.planeParams?.[keys.group]) {
          core.planeParams[keys.group][keys.helper] = Viewer.isClippingAxisEnabled(axis);
        }
        Viewer.updateClippingVisual(axis);
      });
      Viewer.updateClippingOutlineVisibility();
      Viewer.updateClippingPlanesControllerLabel?.();
      Viewer.refreshClippingHintVisibility?.();
      Viewer.updateClippingGui();
      Viewer.updateClippingPanel();
      Viewer.updateEditorToolbarLabels?.();
      Viewer.updateEditorToolbarState?.();
    },

    updateClippingOutlineVisibility() {
      const outline = core.outlineClipping;
      if (!outline) return;
      // The fill is a static copy of the model, so it would not follow animations.
      const available = !Viewer.animationState;
      outline.visible = available && core.planeParams?.outline?.visible === true && Viewer.hasActiveClipping();
    },

    // ---- Model bounds ------------------------------------------------------

    getClippingRoots(object) {
      if (object) return (Array.isArray(object) ? object : [object]).filter(Boolean);
      const helperRoot = core.helperObjects?.[0];
      if (helperRoot) return (Array.isArray(helperRoot) ? helperRoot : [helperRoot]).filter(Boolean);
      return (core.mainObject || []).flatMap((entry) => (Array.isArray(entry) ? entry : [entry])).filter(Boolean);
    },

    // Called whenever the model is loaded, moved, rotated or scaled.
    refreshClippingForModel(object) {
      if (!Viewer.isClippingAvailable() || !core.scene) return;
      const state = Viewer.clippingState;
      if (object) state.root = object;
      const roots = Viewer.getClippingRoots(object || state.root);
      const bounds = new THREE.Box3();
      roots.forEach((root) => {
        root.updateMatrixWorld?.(true);
        bounds.expandByObject(root);
      });
      if (bounds.isEmpty()) return;
      state.bounds = bounds;

      Viewer.ensureClippingVisuals();
      Viewer.bindClippingInteraction();
      Viewer.positionClippingPlanesFromFractions();
    },

    positionClippingPlanesFromFractions() {
      CLIPPING_AXES.forEach((axis) => {
        const range = Viewer.getClippingAxisRange(axis);
        if (!range) return;
        Viewer.setClippingAxisPosition(axis, range.min + Viewer.clippingState.fraction[axis] * range.size, { clamp: false });
      });
      Viewer.applyClippingState();
    },

    // Re-reads fractions after the planes were set from outside (URL, manifest).
    syncClippingFractions() {
      CLIPPING_AXES.forEach((axis) => {
        const range = Viewer.getClippingAxisRange(axis);
        if (!range) return;
        Viewer.clippingState.fraction[axis] = (Viewer.getClippingAxisPosition(axis) - range.min) / range.size;
      });
    },

    // ---- Scene visuals -----------------------------------------------------

    ensureClippingVisuals() {
      const state = Viewer.clippingState;
      if (!state.visuals) {
        state.visuals = {};
        CLIPPING_AXES.forEach((axis) => {
          state.visuals[axis] = createAxisVisual(axis);
        });
      }
      CLIPPING_AXES.forEach((axis) => {
        const { group } = state.visuals[axis];
        if (group.parent !== core.scene) core.scene.add(group);
      });
    },

    updateClippingVisual(axis) {
      const state = Viewer.clippingState;
      const visual = state.visuals?.[axis];
      if (!visual) return;
      const bounds = state.bounds;
      visual.group.visible = Boolean(bounds && Viewer.clippingMode && Viewer.isClippingAxisEnabled(axis));
      if (!bounds) return;

      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      center[axis] = Viewer.getClippingAxisPosition(axis);
      visual.group.position.copy(center);
      // Quad axes after the group rotation: x-plane spans (z, y), y-plane (x, z), z-plane (x, y).
      const span = { x: [size.z, size.y], y: [size.x, size.z], z: [size.x, size.y] }[axis];
      const minSpan = Math.max(size.x, size.y, size.z) * 0.05;
      visual.group.scale.set(
        Math.max(span[0], minSpan) * QUAD_MARGIN,
        Math.max(span[1], minSpan) * QUAD_MARGIN,
        1
      );

      const mode = state.drag?.axis === axis ? "drag" : state.hoverAxis === axis ? "hover" : "idle";
      visual.quad.material.opacity = QUAD_OPACITY[mode];
      visual.border.material.opacity = mode === "idle" ? 0.6 : 1;
    },

    disposeClippingVisuals() {
      const visuals = Viewer.clippingState.visuals;
      if (!visuals) return;
      CLIPPING_AXES.forEach((axis) => Viewer.removeAndDisposeFromScene(visuals[axis].group));
      Viewer.clippingState.visuals = null;
    },

    // ---- Dragging planes in the scene -------------------------------------

    bindClippingInteraction() {
      const state = Viewer.clippingState;
      const canvas = core.renderer?.domElement;
      if (state.interactionBound || !canvas) return;
      state.interactionBound = true;
      state.raycaster = new THREE.Raycaster();
      // Capture phase so a grab on a plane never reaches OrbitControls.
      canvas.addEventListener("pointerdown", Viewer.onClippingPointerDown, { capture: true });
      canvas.addEventListener("pointermove", Viewer.onClippingPointerMove);
      canvas.addEventListener("pointerup", Viewer.onClippingPointerUp);
      canvas.addEventListener("pointercancel", Viewer.onClippingPointerUp);
      canvas.addEventListener("pointerleave", () => Viewer.setClippingHoverAxis(null));
    },

    getClippingRay(event) {
      const canvas = core.renderer.domElement;
      const rect = canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      Viewer.clippingState.raycaster.setFromCamera(ndc, core.camera);
      return Viewer.clippingState.raycaster.ray;
    },

    pickClippingAxis(event) {
      const state = Viewer.clippingState;
      if (!Viewer.clippingMode || !state.visuals || !core.camera) return null;
      const quads = CLIPPING_AXES
        .filter((axis) => state.visuals[axis].group.visible)
        .map((axis) => state.visuals[axis].quad);
      if (!quads.length) return null;
      Viewer.getClippingRay(event);
      const [hit] = state.raycaster.intersectObjects(quads, false);
      return hit ? hit.object.userData.clippingAxis : null;
    },

    // Parameter along the axis line through `origin` of the point closest to the ray.
    getAxisParameter(ray, axis, origin) {
      const d = AXIS_VECTORS[axis];
      const w0 = new THREE.Vector3().subVectors(origin, ray.origin);
      const b = d.dot(ray.direction);
      const denom = 1 - b * b;
      if (denom < 1e-3) return null;
      return (b * ray.direction.dot(w0) - d.dot(w0)) / denom;
    },

    setClippingHoverAxis(axis) {
      const state = Viewer.clippingState;
      if (state.hoverAxis === axis) return;
      const previous = state.hoverAxis;
      state.hoverAxis = axis;
      if (previous) Viewer.updateClippingVisual(previous);
      if (axis) Viewer.updateClippingVisual(axis);
      const canvas = core.renderer?.domElement;
      if (canvas && !state.drag) canvas.style.cursor = axis ? "grab" : "";
    },

    onClippingPointerDown(event) {
      if (event.button !== 0) return;
      const axis = Viewer.pickClippingAxis(event);
      if (!axis) return;
      event.preventDefault();
      event.stopImmediatePropagation();

      const canvas = core.renderer.domElement;
      canvas.setPointerCapture?.(event.pointerId);
      const origin = Viewer.clippingState.visuals[axis].group.position.clone();
      const ray = Viewer.getClippingRay(event);
      Viewer.clippingState.drag = {
        axis,
        pointerId: event.pointerId,
        origin,
        startPosition: Viewer.getClippingAxisPosition(axis),
        startParameter: Viewer.getAxisParameter(ray, axis, origin),
        startY: event.clientY,
        controlsEnabled: core.controls?.enabled !== false,
      };
      if (core.controls) core.controls.enabled = false;
      // Keep the click handler in picking.js from treating the release as a click.
      Viewer.onDownPosition?.set?.(Number.NaN, Number.NaN);
      canvas.style.cursor = "grabbing";
      Viewer.updateClippingVisual(axis);
      Viewer.disableInteractionHint?.();
    },

    onClippingPointerMove(event) {
      const drag = Viewer.clippingState.drag;
      if (!drag) {
        if (event.buttons === 0) Viewer.setClippingHoverAxis(Viewer.pickClippingAxis(event));
        return;
      }
      const ray = Viewer.getClippingRay(event);
      const parameter = Viewer.getAxisParameter(ray, drag.axis, drag.origin);
      let position;
      if (parameter !== null && drag.startParameter !== null) {
        position = drag.startPosition + (parameter - drag.startParameter);
      } else {
        // Looking straight along the axis: move with the vertical mouse motion.
        const range = Viewer.getClippingAxisRange(drag.axis);
        const height = core.renderer.domElement.clientHeight || 1;
        position = drag.startPosition + ((drag.startY - event.clientY) / height) * (range?.size || 1);
      }
      Viewer.setClippingAxisPosition(drag.axis, position);
    },

    onClippingPointerUp(event) {
      const drag = Viewer.clippingState.drag;
      if (!drag) return;
      Viewer.clippingState.drag = null;
      core.renderer.domElement.releasePointerCapture?.(event.pointerId);
      if (core.controls) core.controls.enabled = drag.controlsEnabled;
      Viewer.updateClippingVisual(drag.axis);
      core.renderer.domElement.style.cursor = Viewer.pickClippingAxis(event) ? "grab" : "";
    },

    cancelClippingDrag() {
      const drag = Viewer.clippingState.drag;
      if (!drag) return;
      Viewer.clippingState.drag = null;
      if (core.controls) core.controls.enabled = drag.controlsEnabled;
    },

    // ---- lil-gui folder (advanced editor) ---------------------------------

    ensureClippingGui() {
      const folder = core.clippingFolder;
      if (!folder || Viewer.clippingGui || !core.planeParams) return;
      const controllers = {};
      CLIPPING_AXES.forEach((axis) => {
        const keys = PARAM_KEYS[axis];
        const params = core.planeParams[keys.group];
        controllers[`${axis}Enabled`] = folder.add(params, keys.helper)
          .onChange((value) => Viewer.setClippingAxisEnabled(axis, value));
        controllers[`${axis}Position`] = folder.add(params, keys.constant, -1, 1, 0.001)
          .onChange(() => {
            if (Viewer.clippingState.updatingGui) return;
            const value = Number(params[keys.constant]);
            Viewer.setClippingAxisPosition(axis, Viewer.isClippingAxisNegated(axis) ? -value : value);
          });
      });
      controllers.outline = folder.add(core.planeParams.outline, "visible")
        .onChange((value) => Viewer.setClippingFillVisible(value));
      Viewer.clippingGui = controllers;
      Viewer.updateClippingGuiLabels();
    },

    updateClippingGuiLabels() {
      const gui = Viewer.clippingGui;
      if (!gui) return;
      CLIPPING_AXES.forEach((axis) => {
        const upper = axis.toUpperCase();
        gui[`${axis}Enabled`]?.name(t(`gui.displayHelper${upper}`, `Show ${upper} helper`));
        gui[`${axis}Position`]?.name(t(`gui.constant${upper}`, `Constant ${upper}`));
      });
      gui.outline?.name(t("clipping.fill", "Section fill"));
    },

    updateClippingGui() {
      Viewer.ensureClippingGui();
      const gui = Viewer.clippingGui;
      if (!gui) return;
      Viewer.clippingState.updatingGui = true;
      try {
        CLIPPING_AXES.forEach((axis) => {
          const controller = gui[`${axis}Position`];
          const range = Viewer.getClippingAxisRange(axis);
          if (controller && range) {
            // The GUI edits the raw plane constant, which is negated for flipped planes.
            const [low, high] = Viewer.isClippingAxisNegated(axis) ? [-range.high, -range.low] : [range.low, range.high];
            controller.min(low).max(high).step(range.size / SLIDER_STEPS);
          }
          controller?.updateDisplay();
          gui[`${axis}Enabled`]?.updateDisplay();
        });
        gui.outline?.updateDisplay();
      } finally {
        Viewer.clippingState.updatingGui = false;
      }
    },

    // ---- Floating panel ----------------------------------------------------

    ensureClippingPanel() {
      const state = Viewer.clippingState;
      if (state.panel?.root.isConnected) return state.panel;
      const stack = getViewerSideStack();
      if (!stack) return null;

      const root = document.createElement("div");
      root.id = "viewerClippingPanel";
      root.className = "viewer-clipping-panel";
      root.hidden = true;
      ["pointerdown", "pointerup", "wheel", "keydown"].forEach((type) => {
        root.addEventListener(type, (event) => event.stopPropagation());
      });

      const title = document.createElement("strong");
      title.className = "viewer-clipping-panel_title";
      root.appendChild(title);

      const rows = {};
      CLIPPING_AXES.forEach((axis) => {
        const row = document.createElement("div");
        row.className = "viewer-clipping-panel_row";
        row.dataset.axis = axis;

        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "viewer-clipping-panel_axis";
        toggle.textContent = axis.toUpperCase();
        toggle.addEventListener("click", () => Viewer.toggleClippingPlaneHelper(axis));

        const slider = document.createElement("input");
        slider.type = "range";
        slider.min = "0";
        slider.max = String(SLIDER_STEPS);
        slider.className = "viewer-clipping-panel_slider";
        slider.addEventListener("input", () => {
          const range = Viewer.getClippingAxisRange(axis);
          if (!range) return;
          if (!Viewer.isClippingAxisEnabled(axis)) Viewer.setClippingAxisEnabled(axis, true, { silent: true });
          const fraction = Number(slider.value) / SLIDER_STEPS;
          Viewer.setClippingAxisPosition(axis, range.low + fraction * (range.high - range.low));
        });

        const value = document.createElement("span");
        value.className = "viewer-clipping-panel_value";

        const flip = document.createElement("button");
        flip.type = "button";
        flip.className = "viewer-clipping-panel_flip";
        flip.textContent = "⇄";
        flip.addEventListener("click", () => Viewer.setClippingAxisNegated(axis, !Viewer.isClippingAxisNegated(axis)));

        row.append(toggle, slider, value, flip);
        root.appendChild(row);
        rows[axis] = { row, toggle, slider, value, flip };
      });

      const actions = document.createElement("div");
      actions.className = "viewer-clipping-panel_actions";
      const fill = document.createElement("label");
      fill.className = "viewer-clipping-panel_fill";
      const fillInput = document.createElement("input");
      fillInput.type = "checkbox";
      fillInput.addEventListener("change", () => Viewer.setClippingFillVisible(fillInput.checked));
      const fillText = document.createElement("span");
      fill.append(fillInput, fillText);
      const reset = document.createElement("button");
      reset.type = "button";
      reset.addEventListener("click", () => Viewer.resetClippingPlanes());
      actions.append(fill, reset);
      root.appendChild(actions);

      stack.appendChild(root);
      state.panel = { root, title, rows, fillInput, fillText, reset };
      return state.panel;
    },

    updateClippingPanel() {
      if (!Viewer.isClippingAvailable()) return;
      const panel = Viewer.ensureClippingPanel();
      if (!panel) return;
      panel.root.hidden = !Viewer.clippingMode || Viewer.urlOptions?.hideUi === true;
      if (panel.root.hidden) return;

      panel.title.textContent = t("clipping.title", "Section planes");
      CLIPPING_AXES.forEach((axis) => {
        const { row, toggle, slider, value, flip } = panel.rows[axis];
        const enabled = Viewer.isClippingAxisEnabled(axis);
        const negated = Viewer.isClippingAxisNegated(axis);
        row.classList.toggle("is-enabled", enabled);
        toggle.setAttribute("aria-pressed", enabled ? "true" : "false");
        const toggleLabel = Viewer.tFormat?.("clipping.toggleAxis", { axis: axis.toUpperCase() }, "Cut along {axis}") || axis;
        toggle.title = toggleLabel;
        toggle.setAttribute("aria-label", toggleLabel);
        slider.setAttribute("aria-label", Viewer.tFormat?.("clipping.position", { axis: axis.toUpperCase() }, "{axis} position") || axis);
        flip.setAttribute("aria-pressed", negated ? "true" : "false");
        flip.title = t("clipping.flip", "Flip the kept side");
        flip.setAttribute("aria-label", flip.title);

        const range = Viewer.getClippingAxisRange(axis);
        if (!range) return;
        const position = Viewer.getClippingAxisPosition(axis);
        const fraction = (position - range.low) / (range.high - range.low);
        if (document.activeElement !== slider) slider.value = String(Math.round(fraction * SLIDER_STEPS));
        const percent = Math.round(THREE.MathUtils.clamp((position - range.min) / range.size, 0, 1) * 100);
        value.textContent = `${percent}%`;
      });
      panel.fillInput.checked = core.planeParams?.outline?.visible === true;
      panel.fillInput.disabled = Boolean(Viewer.animationState);
      panel.fillText.textContent = t("clipping.fill", "Section fill");
      panel.reset.textContent = t("clipping.reset", "Reset");
    },

    // ---- Share links and manifests ----------------------------------------

    applyClippingOverridesFromUrl() {
      const options = Viewer.urlOptions || {};
      const { clippingMode, clippingConstants, clippingOutline, clippingNegated } = options;
      const hasMode = clippingMode && CLIPPING_AXES.every((axis) => typeof clippingMode[axis] === "boolean");
      const hasConstants = clippingConstants && CLIPPING_AXES.every((axis) => Number.isFinite(clippingConstants[axis]));
      const hasNegated = clippingNegated && CLIPPING_AXES.every((axis) => typeof clippingNegated[axis] === "boolean");
      const hasOutline = typeof clippingOutline === "boolean";
      if (!hasMode && !hasConstants && !hasOutline && !hasNegated) return;
      if (!Viewer.isClippingAvailable()) return;

      CLIPPING_AXES.forEach((axis) => {
        const keys = PARAM_KEYS[axis];
        if (hasNegated) core.planeParams[keys.group].negated = clippingNegated[axis];
        if (hasConstants) {
          const constant = clippingConstants[axis];
          Viewer.setClippingAxisPosition(axis, Viewer.isClippingAxisNegated(axis) ? -constant : constant, { clamp: false });
        } else if (hasNegated) {
          Viewer.setClippingAxisNegated(axis, clippingNegated[axis]);
        }
      });
      if (hasMode) {
        CLIPPING_AXES.forEach((axis) => {
          core.planeParams.clippingMode[axis] = clippingMode[axis];
        });
        Viewer.clippingMode = Viewer.hasActiveClipping();
      }
      if (hasOutline) core.planeParams.outline.visible = clippingOutline;
      Viewer.syncClippingFractions();
      Viewer.applyClippingState();
    },

    getClippingNegatedState() {
      return Object.fromEntries(CLIPPING_AXES.map((axis) => [axis, Viewer.isClippingAxisNegated(axis)]));
    },
  });
}
