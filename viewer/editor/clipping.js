import THREE from "../init.js";
import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { toastHelper, updateActiveClippingPlanes } from "../viewer-utils.js";
import { getViewerSideStack } from "../ui/side-stack.js";
import { attachToolPanelChrome, PANEL_ICONS } from "../ui/tool-panel-chrome.js";

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
//
// A plane is drawn as an outline in its axis colour with a light grid (in
// metres, from the model's edge); its faint face shows while it is moved or
// pointed at and fades a moment later, leaving the cut to be seen. The cut
// faces are filled dark and neutral, or in the plane's colour; the part cut
// away can be kept as a faint ghost.

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
// The quad just larger than the model's box on its two sides.
const QUAD_MARGIN = 1.06;
// "active": moved a moment ago; "rest": a while after, the face nearly gone.
const QUAD_OPACITY = { rest: 0.03, active: 0.12, hover: 0.2, drag: 0.24 };
const GRID_OPACITY = { rest: { minor: 0.1, major: 0.2 }, active: { minor: 0.2, major: 0.38 } };
const BORDER_OPACITY = { rest: 0.55, active: 0.95 };
const REST_AFTER_MS = 1400;
// The cut faces (loaders.js builds their material): neutral, or the plane's.
const FILL_NEUTRAL = 0x2f3034;
const GHOST_COLOR = 0xaab2bd;
const GHOST_OPACITY = 0.1;
const SLIDER_STEPS = 1000;
// A new or reset cut stands just past the model's far end, which keeps the
// whole model (planes keep the side below the cut, until flipped): 0% cut.
const DEFAULT_FRACTION = 1 + OVERSHOOT;

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

  // A Line back to its start rather than a LineLoop, which the WebGPU
  // renderer does not draw.
  const border = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.5, -0.5, 0),
      new THREE.Vector3(0.5, -0.5, 0),
      new THREE.Vector3(0.5, 0.5, 0),
      new THREE.Vector3(-0.5, 0.5, 0),
      new THREE.Vector3(-0.5, -0.5, 0),
    ]),
    new THREE.LineBasicMaterial({ color: AXIS_COLORS[axis], transparent: true, opacity: 0.85, depthTest: false })
  );
  border.renderOrder = 998;

  // The grid: minor lines and every fifth one stronger, rebuilt when the
  // model's box changes (updateClippingGrid).
  const gridMaterial = (opacity) => new THREE.LineBasicMaterial({ color: AXIS_COLORS[axis], transparent: true, opacity, depthWrite: false });
  const minor = new THREE.LineSegments(new THREE.BufferGeometry(), gridMaterial(GRID_OPACITY.rest.minor));
  const major = new THREE.LineSegments(new THREE.BufferGeometry(), gridMaterial(GRID_OPACITY.rest.major));
  minor.renderOrder = 997;
  major.renderOrder = 997;
  // Not something to pick or drag: the quad is.
  minor.raycast = () => {};
  major.raycast = () => {};
  border.raycast = () => {};

  // PlaneGeometry lies in XY; turn it so its normal points along the axis.
  if (axis === "x") group.rotation.y = Math.PI / 2;
  if (axis === "y") group.rotation.x = -Math.PI / 2;

  group.add(quad, minor, major, border);
  return { group, quad, border, grid: { minor, major, key: "" } };
}

// The quad's local x and y, as world axes and their sign after the group's
// turn (createAxisVisual): x-plane (-z, y), y-plane (x, -z), z-plane (x, y).
const QUAD_AXES = {
  x: [["z", -1], ["y", 1]],
  y: [["x", 1], ["z", -1]],
  z: [["x", 1], ["y", 1]],
};

// 1, 2 or 5 times a power of ten: the step for about `count` lines.
function niceStep(span, count) {
  const raw = span / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  return (unit < 1.5 ? 1 : unit < 3.5 ? 2 : unit < 7.5 ? 5 : 10) * power;
}

export function attachClipping(Viewer) {
  Object.assign(Viewer, {
    clippingState: {
      bounds: null,
      root: null,
      fraction: { x: DEFAULT_FRACTION, y: DEFAULT_FRACTION, z: DEFAULT_FRACTION },
      remembered: null,
      visuals: null,
      hoverAxis: null,
      drag: null,
      panel: null,
      interactionBound: false,
      // "neutral" or "plane" (the cut faces in the cutting plane's colour).
      fillColor: "neutral",
      // The part cut away kept as a faint ghost.
      ghost: false,
      ghostObject: null,
      ghostSource: null,
      ghostPlanes: [],
      // The axis moved or turned on last: its colour fills the cut faces.
      lastAxis: "x",
      touchedAt: 0,
      restTimer: 0,
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

    // The panel's sliders run from nothing cut (0, the plane just past the
    // kept side's far end) to everything cut (1), whichever side is kept.
    clippingCutToPosition(axis, cut) {
      const range = Viewer.getClippingAxisRange(axis);
      if (!range) return 0;
      const span = range.high - range.low;
      return Viewer.isClippingAxisNegated(axis) ? range.low + cut * span : range.high - cut * span;
    },

    clippingPositionToCut(axis, position) {
      const range = Viewer.getClippingAxisRange(axis);
      if (!range) return 0;
      const span = range.high - range.low;
      return Viewer.isClippingAxisNegated(axis) ? (position - range.low) / span : (range.high - position) / span;
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

      Viewer.clippingState.lastAxis = axis;
      Viewer.touchClippingPlanes();
      Viewer.updateClippingVisual(axis);
      Viewer.syncClippingGhost();
      Viewer.applyClippingFillStyle();
      Viewer.updateClippingGui();
      Viewer.updateClippingPanel();
    },

    // The planes' faces show while they are moved, then fade (updateClippingVisual).
    touchClippingPlanes() {
      const state = Viewer.clippingState;
      state.touchedAt = performance.now();
      window.clearTimeout(state.restTimer);
      state.restTimer = window.setTimeout(() => CLIPPING_AXES.forEach((axis) => Viewer.updateClippingVisual(axis)), REST_AFTER_MS + 20);
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
      if (active) Viewer.clippingState.lastAxis = axis;
      Viewer.touchClippingPlanes();
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

    // The cut faces: "neutral" (dark) or "plane" (the colour of the plane
    // moved last, when several cut).
    setClippingFillColor(mode) {
      Viewer.clippingState.fillColor = mode === "plane" ? "plane" : "neutral";
      Viewer.applyClippingFillStyle();
      Viewer.updateClippingPanel();
    },

    applyClippingFillStyle() {
      const material = core.outlineClipping?.userData?.fillMaterial;
      if (!material) return;
      const state = Viewer.clippingState;
      let axis = state.lastAxis;
      if (!Viewer.isClippingAxisEnabled(axis)) axis = CLIPPING_AXES.find((entry) => Viewer.isClippingAxisEnabled(entry)) || axis;
      if (state.fillColor === "plane") material.color.setHex(AXIS_COLORS[axis]).multiplyScalar(0.82);
      else material.color.setHex(FILL_NEUTRAL);
    },

    setClippingGhostVisible(visible) {
      Viewer.clippingState.ghost = visible === true;
      Viewer.syncClippingGhost();
      Viewer.updateClippingPanel();
    },

    // The part cut away, faint: a copy of the section fill's geometry (shared,
    // not copied) clipped the other way - the union of what each plane
    // removes (inverted planes, clipIntersection).
    syncClippingGhost() {
      const state = Viewer.clippingState;
      const source = core.outlineClipping;
      if (state.ghostObject && state.ghostSource !== source) {
        // The geometry is the model's: only the copy and its material go.
        state.ghostObject.removeFromParent();
        state.ghostObject = null;
        state.ghostSource = null;
      }
      const wanted = state.ghost && Viewer.clippingMode && Viewer.hasActiveClipping() && !Viewer.animationState;
      if (!wanted && !state.ghostObject) return;
      if (!state.ghostObject && source && core.scene) {
        state.ghostMaterial ||= new THREE.MeshBasicMaterial({
          color: GHOST_COLOR,
          transparent: true,
          opacity: GHOST_OPACITY,
          depthWrite: false,
          side: THREE.FrontSide,
          clipIntersection: true,
          clippingPlanes: state.ghostPlanes,
        });
        const ghost = source.clone(true);
        ghost.name = "ClippingGhost";
        // updateActiveClippingPlanes (viewer-utils.js) leaves it be: it has its
        // own, inverted planes.
        ghost.userData = { noClipping: true };
        ghost.traverse((child) => {
          if (child.isMesh) child.material = state.ghostMaterial;
          child.raycast = () => {};
          child.renderOrder = 996;
        });
        core.scene.add(ghost);
        state.ghostObject = ghost;
        state.ghostSource = source;
      }
      const ghost = state.ghostObject;
      if (!ghost) return;
      ghost.position.copy(source.position);
      ghost.quaternion.copy(source.quaternion);
      ghost.scale.copy(source.scale);
      // The cutting planes, each turned to keep what it removes.
      const active = core.activeClippingPlanes || [];
      const planes = state.ghostPlanes;
      const countChanged = planes.length !== active.length;
      while (planes.length < active.length) planes.push(new THREE.Plane());
      planes.length = active.length;
      active.forEach((plane, index) => planes[index].copy(plane).negate());
      if (countChanged && state.ghostMaterial) state.ghostMaterial.needsUpdate = true;
      if (core.rendererBackend === "webgpu") {
        Object.assign(ghost, { isClippingGroup: true, enabled: true, clipIntersection: true, clipShadows: false, clippingPlanes: planes });
      }
      ghost.visible = wanted && planes.length > 0;
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
        // Touch devices: only briefly - the panel that opens now stays and
        // replaces the drag hint (main.js, isClippingPanelReplacingHint).
        toastHelper("clippingEnabled", { duration: Viewer.isClippingPanelReplacingHint?.() ? 1500 : 2600 });
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
        Viewer.clippingState.fraction[axis] = DEFAULT_FRACTION;
      });
      Viewer.positionClippingPlanesFromFractions();
    },

    // Clears all active cuts, resets fractions to margins, and disables clipping mode.
    clearClippingPlanes() {
      if (core.planeParams?.clippingMode) {
        CLIPPING_AXES.forEach((axis) => {
          core.planeParams.clippingMode[axis] = false;
          const keys = PARAM_KEYS[axis];
          if (core.planeParams[keys.group]) {
            core.planeParams[keys.group].negated = false;
            core.planeParams[keys.group][keys.helper] = false;
          }
          if (Viewer.clippingState?.fraction) {
            Viewer.clippingState.fraction[axis] = DEFAULT_FRACTION;
          }
        });
      }
      if (core.planeParams?.outline) {
        core.planeParams.outline.visible = false;
      }
      Viewer.clippingMode = false;
      if (Viewer.clippingState) {
        Viewer.clippingState.remembered = null;
        Viewer.clippingState.drag = null;
      }
      if (Array.isArray(core.activeClippingPlanes)) {
        core.activeClippingPlanes.length = 0;
      }
      if (Viewer.isClippingAvailable()) {
        Viewer.placeIdleClippingPlanesAtMargins();
        Viewer.applyClippingState();
      } else {
        updateActiveClippingPlanes();
      }
      Viewer.updateEditorToolbarLabels?.();
      Viewer.updateEditorToolbarState?.();
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
      Viewer.applyClippingFillStyle();
      Viewer.syncClippingGhost();
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

    // An axis that does not cut stands at the margin, past the model's kept
    // side, whatever constant came with it (manifests save all three, 0 for
    // an axis never moved, which is the middle of most models): when it is
    // turned on, the whole model is still there - an audio file's whole
    // spectrum, say.
    placeIdleClippingPlanesAtMargins() {
      if (!Viewer.isClippingAvailable() || !core.planeParams?.clippingMode) return;
      CLIPPING_AXES.forEach((axis) => {
        if (Viewer.isClippingAxisEnabled(axis)) return;
        Viewer.clippingState.fraction[axis] = Viewer.isClippingAxisNegated(axis) ? -OVERSHOOT : DEFAULT_FRACTION;
      });
      if (Viewer.clippingState.bounds) Viewer.positionClippingPlanesFromFractions();
      else Viewer.applyClippingState();
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

      Viewer.updateClippingGrid(axis, visual);

      const resting = performance.now() - state.touchedAt > REST_AFTER_MS;
      const mode = state.drag?.axis === axis ? "drag" : state.hoverAxis === axis ? "hover" : resting ? "rest" : "active";
      const level = mode === "rest" ? "rest" : "active";
      visual.quad.material.opacity = QUAD_OPACITY[mode];
      visual.border.material.opacity = BORDER_OPACITY[level];
      visual.grid.minor.material.opacity = GRID_OPACITY[level].minor;
      visual.grid.major.material.opacity = GRID_OPACITY[level].major;
    },

    // The grid on a plane: a line every 1, 2 or 5 (times a power of ten)
    // metres - about a dozen across - counted from the model's edge, every
    // fifth stronger. In the quad's own (unit) coordinates: the group's scale
    // stretches it to the model.
    updateClippingGrid(axis, visual) {
      const bounds = Viewer.clippingState.bounds;
      if (!bounds) return;
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const metersPerUnit = Viewer.resolveModelUnit?.().meters || 1;
      const sides = QUAD_AXES[axis].map(([world]) => size[world]);
      const minSpan = Math.max(size.x, size.y, size.z) * 0.05;
      const extents = sides.map((side) => Math.max(side, minSpan) * QUAD_MARGIN);
      const step = niceStep(Math.max(...sides) * metersPerUnit, 12) / metersPerUnit;
      const key = [axis, step, ...extents, bounds.min.x, bounds.min.y, bounds.min.z].map((value) => (typeof value === "number" ? value.toPrecision(6) : value)).join("|");
      if (visual.grid.key === key) return;
      visual.grid.key = key;
      const minor = [];
      const major = [];
      QUAD_AXES[axis].forEach(([world, sign], index) => {
        const extent = extents[index];
        const half = extent / 2;
        const first = Math.ceil((center[world] - half - bounds.min[world]) / step);
        const last = Math.floor((center[world] + half - bounds.min[world]) / step);
        if (last - first > 400) return;
        for (let k = first; k <= last; k += 1) {
          const local = (sign * (bounds.min[world] + k * step - center[world])) / extent;
          const target = k % 5 === 0 ? major : minor;
          // A line across the quad at `local` along its x (index 0) or y.
          if (index === 0) target.push(local, -0.5, 0, local, 0.5, 0);
          else target.push(-0.5, local, 0, 0.5, local, 0);
        }
      });
      [["minor", minor], ["major", major]].forEach(([name, points]) => {
        const lines = visual.grid[name];
        lines.geometry.dispose();
        lines.geometry = new THREE.BufferGeometry();
        lines.geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
      });
    },

    disposeClippingVisuals() {
      const visuals = Viewer.clippingState.visuals;
      if (!visuals) return;
      CLIPPING_AXES.forEach((axis) => Viewer.removeAndDisposeFromScene(visuals[axis].group));
      Viewer.clippingState.visuals = null;
      Viewer.clippingState.ghostObject?.removeFromParent();
      Viewer.clippingState.ghostObject = null;
      Viewer.clippingState.ghostSource = null;
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

      const header = document.createElement("div");
      header.className = "viewer-clipping-panel_header";
      const title = document.createElement("strong");
      title.className = "viewer-clipping-panel_title";
      header.appendChild(title);
      root.appendChild(header);

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
          Viewer.setClippingAxisPosition(axis, Viewer.clippingCutToPosition(axis, Number(slider.value) / SLIDER_STEPS));
        });

        // Where the plane stands, from the model's edge, in metres (or the
        // unit set for measuring): typed in, it goes there.
        const value = document.createElement("input");
        value.type = "text";
        value.inputMode = "decimal";
        value.spellcheck = false;
        value.className = "viewer-clipping-panel_value";
        value.addEventListener("focus", () => value.select());
        value.addEventListener("keydown", (event) => {
          if (event.key === "Enter") value.blur();
          if (event.key === "Escape") {
            value.dataset.cancel = "true";
            value.blur();
          }
        });
        value.addEventListener("change", () => {
          if (value.dataset.cancel === "true") return;
          const position = Viewer.parseClippingLength(axis, value.value);
          if (position === null) return;
          if (!Viewer.isClippingAxisEnabled(axis)) Viewer.setClippingAxisEnabled(axis, true, { silent: true });
          Viewer.setClippingAxisPosition(axis, position);
        });
        value.addEventListener("blur", () => {
          delete value.dataset.cancel;
          Viewer.updateClippingPanel();
        });

        // Which side is kept: the filled half, the plane down the middle.
        const flip = document.createElement("button");
        flip.type = "button";
        flip.className = "viewer-clipping-panel_flip";
        flip.innerHTML = '<svg viewBox="0 0 20 16" width="20" height="16" aria-hidden="true" focusable="false"><rect class="viewer-clipping-panel_flip-kept" x="2" y="3" width="8" height="10" rx="1.5"/><rect x="10" y="3" width="8" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 1.6" opacity=".7"/><path d="M10 1v14" stroke="var(--axis-color)" stroke-width="2" stroke-linecap="round"/></svg>';
        flip.addEventListener("click", () => Viewer.setClippingAxisNegated(axis, !Viewer.isClippingAxisNegated(axis)));

        row.append(toggle, slider, value, flip);
        root.appendChild(row);
        rows[axis] = { row, toggle, slider, value, flip };
      });

      // The look of the cut: filled, in the plane's colour, the part cut
      // away as a ghost - switches in a row, Reset beside them.
      const actions = document.createElement("div");
      actions.className = "viewer-clipping-panel_actions";
      const options = document.createElement("div");
      options.className = "viewer-clipping-panel_options";
      const toggle = (onChange) => {
        const label = document.createElement("label");
        label.className = "viewer-clipping-panel_option";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.setAttribute("role", "switch");
        input.addEventListener("change", () => onChange(input.checked));
        const text = document.createElement("span");
        label.append(input, text);
        options.appendChild(label);
        return { label, input, text };
      };
      const fill = toggle((checked) => Viewer.setClippingFillVisible(checked));
      const planeColor = toggle((checked) => Viewer.setClippingFillColor(checked ? "plane" : "neutral"));
      planeColor.label.classList.add("is-sub");
      const ghost = toggle((checked) => Viewer.setClippingGhostVisible(checked));
      const reset = document.createElement("button");
      reset.type = "button";
      reset.className = "viewer-clipping-panel_reset";
      reset.addEventListener("click", () => Viewer.resetClippingPlanes());
      actions.append(options, reset);
      root.appendChild(actions);

      stack.appendChild(root);
      state.panel = {
        root, title, rows, reset,
        fillInput: fill.input, fillText: fill.text,
        planeColorInput: planeColor.input, planeColorText: planeColor.text, planeColorLabel: planeColor.label,
        ghostInput: ghost.input, ghostText: ghost.text,
      };
      return state.panel;
    },

    updateClippingPanel() {
      if (!Viewer.isClippingAvailable()) return;
      const panel = Viewer.ensureClippingPanel();
      if (!panel) return;
      panel.root.hidden = !Viewer.clippingMode || Viewer.urlOptions?.hideUi === true;
      // The drag hint gives way to the panel on touch devices (main.js).
      Viewer.updateClippingHintVisibility?.();
      if (panel.root.hidden) return;

      panel.title.textContent = t("clipping.title", "Section planes");
      attachToolPanelChrome(panel.root, panel.title.parentNode, {
        icon: PANEL_ICONS.clipping,
        label: () => t("clipping.title", "Section planes"),
        // Like the toolbar button: the planes go, the panel with them.
        onClose: () => Viewer.toggleClippingPlanesPanel(),
      });
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
        const sliderCut = THREE.MathUtils.clamp(Viewer.clippingPositionToCut(axis, position), 0, 1);
        if (document.activeElement !== slider) {
          slider.value = String(Math.round(sliderCut * SLIDER_STEPS));
        }
        row.style.setProperty("--cut", `${(sliderCut * 100).toFixed(2)}%`);
        // Where it stands from the model's edge; how much it removes, on hover.
        const cut = negated ? (position - range.min) / range.size : (range.max - position) / range.size;
        const percent = Math.round(THREE.MathUtils.clamp(cut, 0, 1) * 100);
        if (document.activeElement !== value) value.value = Viewer.formatClippingLength(position - range.min);
        const valueLabel = Viewer.tFormat?.("clipping.valueTitle", { axis: axis.toUpperCase(), percent }, "{axis}: from the model's edge ({percent}% cut away) - type a value")
          || `${axis.toUpperCase()}`;
        value.title = valueLabel;
        value.setAttribute("aria-label", valueLabel);
        value.disabled = !enabled;
      });
      const filled = core.planeParams?.outline?.visible === true;
      panel.fillInput.checked = filled;
      panel.fillInput.disabled = Boolean(Viewer.animationState);
      panel.fillText.textContent = t("clipping.fill", "Section fill");
      panel.planeColorInput.checked = Viewer.clippingState.fillColor === "plane";
      panel.planeColorInput.disabled = !filled || Boolean(Viewer.animationState);
      panel.planeColorLabel.classList.toggle("is-disabled", panel.planeColorInput.disabled);
      panel.planeColorText.textContent = t("clipping.planeColor", "In the plane's colour");
      panel.ghostInput.checked = Viewer.clippingState.ghost === true;
      panel.ghostInput.disabled = Boolean(Viewer.animationState);
      panel.ghostText.textContent = t("clipping.ghost", "Show the part cut away");
      panel.reset.textContent = t("clipping.reset", "Reset");
    },

    // A length along an axis for the panel: in the unit set for measuring
    // (editor/model-units.js), from the model's edge.
    formatClippingLength(sceneUnits) {
      return Viewer.formatLength ? Viewer.formatLength(sceneUnits).text : sceneUnits.toFixed(2);
    },

    // What was typed into an axis' value - "4.5", "4,5 m", "120 cm", "3 ft" -
    // as a plane position (scene units), or null. A number alone is in the
    // unit shown there before.
    parseClippingLength(axis, text) {
      const range = Viewer.getClippingAxisRange(axis);
      const match = String(text).trim().replace(",", ".").match(/^(-?\d*\.?\d+)\s*(km|m|cm|mm|µm|um|ft|in|mi)?$/i);
      if (!range || !match) return null;
      const number = Number(match[1]);
      if (!Number.isFinite(number)) return null;
      const METERS = { km: 1000, m: 1, cm: 0.01, mm: 0.001, "µm": 1e-6, um: 1e-6, ft: 0.3048, in: 0.0254, mi: 1609.344 };
      let unit = match[2]?.toLowerCase();
      if (!unit) {
        const shown = Viewer.formatClippingLength(Viewer.getClippingAxisPosition(axis) - range.min).match(/(km|m|cm|mm|µm|ft|in|mi)$/);
        unit = shown?.[1];
      }
      const metersPerUnit = Viewer.resolveModelUnit?.().meters || 1;
      const meters = unit && METERS[unit] ? number * METERS[unit] : number * metersPerUnit;
      return range.min + meters / metersPerUnit;
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
      if (hasMode) {
        Viewer.placeIdleClippingPlanesAtMargins();
        return;
      }
      Viewer.applyClippingState();
    },

    // The cuts as saved with the settings (metadata-persistence.js): which
    // axes cut, which side each keeps, where each stands as a fraction of
    // the model's box (so it stays in place when the model's position or
    // scale is saved too) and whether the cut faces are filled. Undefined
    // while nothing is cut.
    getClippingForPersistence() {
      if (!core.planeParams?.clippingMode || !Viewer.hasActiveClipping()) return undefined;
      const round = (value) => Math.round(value * 1e6) / 1e6;
      return {
        mode: Object.fromEntries(CLIPPING_AXES.map((axis) => [axis, Viewer.isClippingAxisEnabled(axis)])),
        negated: Viewer.getClippingNegatedState(),
        fraction: Object.fromEntries(CLIPPING_AXES.map((axis) => [axis, round(Viewer.clippingState.fraction[axis])])),
        outlineVisible: core.planeParams?.outline?.visible === true,
        fillColor: Viewer.clippingState.fillColor,
        ghost: Viewer.clippingState.ghost === true,
      };
    },

    // Saved cuts (getClippingForPersistence) back on the model. Before the
    // model's box is known they wait in the fractions, which
    // refreshClippingForModel() places. True when applied.
    applySavedClipping(saved) {
      if (!saved || typeof saved !== "object" || !saved.mode || typeof saved.mode !== "object") return false;
      if (!Viewer.isClippingAvailable() || !core.planeParams?.clippingMode) return false;
      const state = Viewer.clippingState;
      CLIPPING_AXES.forEach((axis) => {
        const keys = PARAM_KEYS[axis];
        if (core.planeParams[keys.group]) core.planeParams[keys.group].negated = saved.negated?.[axis] === true;
        const fraction = Number(saved.fraction?.[axis]);
        state.fraction[axis] = Number.isFinite(fraction)
          ? THREE.MathUtils.clamp(fraction, -OVERSHOOT, 1 + OVERSHOOT)
          : DEFAULT_FRACTION;
        core.planeParams.clippingMode[axis] = saved.mode[axis] === true;
      });
      if (typeof saved.outlineVisible === "boolean" && core.planeParams.outline) {
        core.planeParams.outline.visible = saved.outlineVisible;
      }
      if (saved.fillColor === "plane" || saved.fillColor === "neutral") state.fillColor = saved.fillColor;
      if (typeof saved.ghost === "boolean") state.ghost = saved.ghost;
      Viewer.clippingMode = Viewer.hasActiveClipping();
      state.remembered = null;
      if (state.bounds) {
        Viewer.positionClippingPlanesFromFractions();
      } else {
        Viewer.applyClippingState();
      }
      return true;
    },

    getClippingNegatedState() {
      return Object.fromEntries(CLIPPING_AXES.map((axis) => [axis, Viewer.isClippingAxisNegated(axis)]));
    },
  });
}
