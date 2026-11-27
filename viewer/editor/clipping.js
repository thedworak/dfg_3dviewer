import THREE from "../init.js";
import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { toastHelper, updateActiveClippingPlanes } from "../viewer-utils.js";
import { getViewerSideStack } from "../ui/side-stack.js";
import { attachToolPanelChrome, PANEL_ICONS } from "../ui/tool-panel-chrome.js";
import { setSectionFillStyle } from "./section-fill.js";
import { buildSectionSvg, computeSectionSegments, downloadSvg, sectionBasis } from "./section-export.js";

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
// The plane put to a face: the viewer's accent.
const FACE_COLOR = 0xf5a524;
const BOX_KEYS = { x: "x-low", y: "y-low", z: "z-low" };
const GHOST_OPACITY = 0.1;
const SLIDER_STEPS = 1000;
// A new or reset cut stands just past the model's far end, which keeps the
// whole model (planes keep the side below the cut, until flipped): 0% cut.
const DEFAULT_FRACTION = 1 + OVERSHOOT;

// The plane drawn in the scene for `key` ("x", "y", "z"; "x-low"... the
// section box's other sides; "face", the plane put to a face): its face -
// a faint quad, an outline and a grid, stretched to the model - and, not
// stretched, a handle at its corner: a double arrow along the plane's normal
// (drag it, or the quad, to move the plane) and a label with where it is.
// `axis`: the world axis it is turned to (none for "face").
function createAxisVisual(axis, key = axis, color = AXIS_COLORS[axis]) {
  const group = new THREE.Group();
  group.name = "ClippingPlaneVisual";
  group.userData.noClipping = true;
  group.userData.clippingAxis = key;
  group.visible = false;
  group.renderOrder = 997;

  const face = new THREE.Group();
  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: QUAD_OPACITY.rest,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  quad.userData.clippingAxis = key;

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
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85, depthTest: false })
  );
  border.renderOrder = 998;

  // The grid: minor lines and every fifth one stronger, rebuilt when the
  // model's box changes (updateClippingGrid).
  const gridMaterial = (opacity) => new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  const minor = new THREE.LineSegments(new THREE.BufferGeometry(), gridMaterial(GRID_OPACITY.rest.minor));
  const major = new THREE.LineSegments(new THREE.BufferGeometry(), gridMaterial(GRID_OPACITY.rest.major));
  minor.renderOrder = 997;
  major.renderOrder = 997;
  // Not something to pick or drag: the quad and the arrow are.
  minor.raycast = () => {};
  major.raycast = () => {};
  border.raycast = () => {};
  face.add(quad, minor, major, border);

  // The handle: a double arrow along the normal (local z), in front of all.
  const handle = new THREE.Group();
  const arrowMaterial = new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.95 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.1, 10), arrowMaterial);
  shaft.rotation.x = Math.PI / 2;
  const tipUp = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 14), arrowMaterial);
  tipUp.rotation.x = Math.PI / 2;
  tipUp.position.z = 0.7;
  const tipDown = tipUp.clone();
  tipDown.rotation.x = -Math.PI / 2;
  tipDown.position.z = -0.7;
  const arrow = new THREE.Group();
  arrow.add(shaft, tipUp, tipDown);
  arrow.traverse((child) => {
    child.userData.clippingAxis = key;
    child.renderOrder = 999;
  });
  // A wider invisible grip around it: easier to take on a phone.
  const grip = new THREE.Mesh(new THREE.SphereGeometry(0.75, 10, 8), new THREE.MeshBasicMaterial({ visible: false }));
  grip.userData.clippingAxis = key;
  arrow.add(grip);
  const label = createPlaneLabel(color);
  handle.add(arrow, label.sprite);

  // PlaneGeometry lies in XY; turn it so its normal points along the axis.
  if (axis === "x") group.rotation.y = Math.PI / 2;
  if (axis === "y") group.rotation.x = -Math.PI / 2;

  group.add(face, handle);
  return { key, axis, color, group, face, quad, border, handle, arrow, grip, label, grid: { minor, major, key: "" } };
}

// The label beside a plane's handle: its name and where it stands, white on
// its colour, the same size on the screen at any distance.
function createPlaneLabel(color) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true, sizeAttenuation: false });
  const sprite = new THREE.Sprite(material);
  sprite.center.set(0, 0.5);
  sprite.renderOrder = 1000;
  sprite.raycast = () => {};
  return { canvas, texture, sprite, text: "", color };
}

function drawPlaneLabel(label, text) {
  if (label.text === text) return;
  label.text = text;
  const { canvas } = label;
  const g = canvas.getContext("2d");
  if (!g) return;
  const font = "600 30px system-ui, sans-serif";
  g.font = font;
  const width = Math.min(canvas.width, Math.ceil(g.measureText(text).width) + 28);
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = `#${new THREE.Color(label.color).getHexString()}`;
  g.beginPath();
  g.roundRect?.(0, 8, width, 48, 12);
  if (!g.roundRect) g.rect(0, 8, width, 48);
  g.fill();
  g.fillStyle = "#fff";
  g.font = font;
  g.textBaseline = "middle";
  g.fillText(text, 14, 33);
  label.texture.needsUpdate = true;
  // Only the drawn part shows: the rest of the canvas is clear.
  label.width = width / canvas.width;
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
      // "solid" or "hatch" (thin diagonal lines over the fill, section-fill.js).
      fillPattern: "solid",
      // The part cut away kept as a faint ghost.
      ghost: false,
      ghostObject: null,
      ghostSource: null,
      ghostPlanes: [],
      // The axis moved or turned on last: its colour fills the cut faces.
      lastAxis: "x",
      // The section box: each axis cut from both sides - the axis' own plane
      // keeps what is below it, this one (as a fraction of the model's box)
      // what is above.
      box: { enabled: false, low: { x: -OVERSHOOT, y: -OVERSHOOT, z: -OVERSHOOT } },
      // The plane put to a face (tap "Align to a face", then the model): its
      // point and its normal into the model, how far it went in.
      face: { enabled: false, origin: null, normal: null, offset: 0, negated: false },
      facePicking: false,
      extraVisuals: null,
      // The plane moved last ("x", "x-low", "face"...), the drawing's.
      lastKey: "x",
      touchedAt: 0,
      restTimer: 0,
    },

    isClippingAvailable() {
      return !core.PRESENTATION_MODE && Array.isArray(core.clippingPlanes) && core.clippingPlanes.length >= 3;
    },

    isClippingAxisEnabled(axis) {
      return core.planeParams?.clippingMode?.[axis] === true;
    },

    // Gaussian splats (splats.js) are cut splat by splat, with no surface:
    // nothing to fill, draw, pick a face of or show as a ghost.
    isClippingSplats() {
      return Viewer.getClippingRoots(Viewer.clippingState?.root).some((root) => root.userData?.isGaussianSplats === true);
    },

    hasActiveClipping() {
      return CLIPPING_AXES.some((axis) => Viewer.isClippingAxisEnabled(axis)) || Viewer.clippingState?.face?.enabled === true;
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
      Viewer.clippingState.lastKey = axis;
      Viewer.touchClippingPlanes();
      Viewer.updateClippingVisual(axis);
      if (Viewer.clippingState.box?.enabled) Viewer.updateClippingVisual(BOX_KEYS[axis]);
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
      state.restTimer = window.setTimeout(() => Viewer.getClippingVisualKeys().forEach((key) => Viewer.updateClippingVisual(key)), REST_AFTER_MS + 20);
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

    setClippingFillPattern(pattern) {
      Viewer.clippingState.fillPattern = pattern === "hatch" ? "hatch" : "solid";
      Viewer.applyClippingFillStyle();
      Viewer.updateClippingPanel();
    },

    applyClippingFillStyle() {
      const material = core.outlineClipping?.userData?.fillMaterial;
      if (!material) return;
      const state = Viewer.clippingState;
      let axis = state.lastAxis;
      if (!Viewer.isClippingAxisEnabled(axis)) axis = CLIPPING_AXES.find((entry) => Viewer.isClippingAxisEnabled(entry)) || axis;
      const color = state.fillColor === "plane"
        ? new THREE.Color(AXIS_COLORS[axis] ?? AXIS_COLORS.x).multiplyScalar(0.82).getHex()
        : FILL_NEUTRAL;
      setSectionFillStyle(material, { color, hatch: state.fillPattern === "hatch" });
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
        Viewer.clippingState.box.low[axis] = -OVERSHOOT;
      });
      if (Viewer.clippingState.face.enabled) Viewer.clippingState.face.offset = 0;
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
        Viewer.clippingState.box = { enabled: false, low: { x: -OVERSHOOT, y: -OVERSHOOT, z: -OVERSHOOT } };
        Viewer.clippingState.face = { enabled: false, origin: null, normal: null, offset: 0, negated: false };
        Viewer.clippingState.facePicking = false;
        if (Array.isArray(core.extraClippingPlanes)) core.extraClippingPlanes.length = 0;
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
      Viewer.syncClippingExtraPlanes();
      updateActiveClippingPlanes();
      ["x-low", "y-low", "z-low", "face"].forEach((key) => Viewer.updateClippingVisual(key));
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
      Viewer.resolvePendingClippingFace();

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
      if (!state.extraVisuals) {
        state.extraVisuals = {};
        CLIPPING_AXES.forEach((axis) => {
          state.extraVisuals[BOX_KEYS[axis]] = createAxisVisual(axis, BOX_KEYS[axis]);
        });
        state.extraVisuals.face = createAxisVisual(null, "face", FACE_COLOR);
      }
      [...Object.values(state.visuals), ...Object.values(state.extraVisuals)].forEach(({ group }) => {
        if (group.parent !== core.scene) core.scene.add(group);
      });
    },

    getClippingVisual(key) {
      const state = Viewer.clippingState;
      return state.visuals?.[key] || state.extraVisuals?.[key] || null;
    },

    getClippingVisualKeys() {
      return [...CLIPPING_AXES, ...Object.values(BOX_KEYS), "face"];
    },

    // Where a plane is and how it is drawn: { visible, center, extents,
    // quaternion (the face plane's), direction (it moves along), position
    // (along that), label }.
    getClippingPlaneInfo(key) {
      const state = Viewer.clippingState;
      const bounds = state.bounds;
      if (!bounds) return null;
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const minSpan = Math.max(size.x, size.y, size.z) * 0.05;
      if (key === "face") {
        const face = state.face;
        if (!face.origin || !face.normal) return null;
        const extent = Math.max(size.x, size.y, size.z) * QUAD_MARGIN;
        const point = face.origin.clone().addScaledVector(face.normal, face.offset);
        // The quad's middle: the model's middle brought onto the plane.
        const onPlane = center.clone().addScaledVector(face.normal, face.normal.dot(new THREE.Vector3().subVectors(point, center)));
        return {
          visible: Viewer.clippingMode && face.enabled,
          center: onPlane,
          extents: [extent, extent],
          quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), face.normal),
          direction: face.normal.clone(),
          position: face.offset,
          label: `◆ ${Viewer.formatClippingLength(Math.max(0, face.offset))}`,
        };
      }
      const axis = key.charAt(0);
      const low = key !== axis;
      const range = Viewer.getClippingAxisRange(axis);
      const span = QUAD_AXES[axis].map(([world]) => Math.max(size[world], minSpan) * QUAD_MARGIN);
      const position = low ? Viewer.getClippingBoxLow(axis) : Viewer.getClippingAxisPosition(axis);
      const at = center.clone();
      at[axis] = position;
      const enabled = Viewer.clippingMode && Viewer.isClippingAxisEnabled(axis);
      return {
        visible: low ? enabled && state.box.enabled : enabled,
        center: at,
        extents: span,
        quaternion: null,
        direction: AXIS_VECTORS[axis].clone(),
        position,
        label: `${axis.toUpperCase()} ${Viewer.formatClippingLength(position - (range?.min ?? 0))}`,
      };
    },

    // Moves the plane `key` to `position` (along its direction).
    setClippingPlanePosition(key, position) {
      if (key === "face") Viewer.setClippingFaceOffset(position);
      else if (key.length > 1) Viewer.setClippingBoxLow(key.charAt(0), position);
      else Viewer.setClippingAxisPosition(key, position);
    },

    // ---- The section box --------------------------------------------------

    getClippingBoxLow(axis) {
      const range = Viewer.getClippingAxisRange(axis);
      if (!range) return 0;
      return range.min + Viewer.clippingState.box.low[axis] * range.size;
    },

    setClippingBoxLow(axis, position) {
      const range = Viewer.getClippingAxisRange(axis);
      if (!range || !Number.isFinite(position)) return;
      // Never past the axis' own plane: the box keeps something.
      const high = Viewer.getClippingAxisPosition(axis);
      const value = THREE.MathUtils.clamp(position, range.low, Math.min(range.high, high - range.size * 0.005));
      const state = Viewer.clippingState;
      state.box.low[axis] = (value - range.min) / range.size;
      state.lastKey = BOX_KEYS[axis];
      Viewer.touchClippingPlanes();
      Viewer.syncClippingExtraPlanes();
      Viewer.updateClippingVisual(BOX_KEYS[axis]);
      Viewer.syncClippingGhost();
      Viewer.updateClippingPanel();
    },

    // The box on: every axis cuts, each from both sides (its own plane keeps
    // what is below, so it is not flipped while the box is on); off: back to
    // one plane per axis.
    setClippingBoxEnabled(enabled) {
      const state = Viewer.clippingState;
      if (!Viewer.isClippingAvailable()) return;
      state.box.enabled = enabled === true;
      if (state.box.enabled) {
        if (!Viewer.clippingMode) Viewer.clippingMode = true;
        CLIPPING_AXES.forEach((axis) => {
          const position = Viewer.getClippingAxisPosition(axis);
          if (Viewer.isClippingAxisNegated(axis)) {
            // A flipped plane keeps what is above it: it becomes the box's low
            // side, the axis' own plane goes to the far end.
            Viewer.setClippingAxisNegated(axis, false);
            const range = Viewer.getClippingAxisRange(axis);
            if (range) {
              Viewer.setClippingAxisPosition(axis, range.high, { clamp: false });
              state.box.low[axis] = (position - range.min) / range.size;
            }
          }
          core.planeParams.clippingMode[axis] = true;
        });
      }
      Viewer.applyClippingState();
    },

    // ---- The plane put to a face -----------------------------------------

    // Tap "Align to a face", then a face of the model: a plane there, turned
    // to it, keeping what is behind it - then moved in with its slider.
    startClippingFacePick() {
      const state = Viewer.clippingState;
      if (!state.facePicking && Viewer.isClippingSplats()) return;
      state.facePicking = !state.facePicking;
      const canvas = core.renderer?.domElement;
      if (canvas) canvas.style.cursor = state.facePicking ? "crosshair" : "";
      if (state.facePicking) toastHelper("clippingFacePick", "info", { duration: 2600 });
      Viewer.updateClippingPanel();
    },

    pickClippingFace(event) {
      const roots = Viewer.getClippingRoots(Viewer.clippingState.root);
      if (!roots.length || !core.camera) return null;
      Viewer.getClippingRay(event);
      const hits = Viewer.clippingState.raycaster.intersectObjects(roots, true)
        .filter((hit) => hit.face && hit.object.isMesh && !hit.object.userData?.noClipping && Viewer.isPointKeptByClipping(hit.point));
      const hit = hits[0];
      if (!hit) return null;
      const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      // Towards the viewer, whichever way the face was modelled.
      if (normal.dot(Viewer.clippingState.raycaster.ray.direction) > 0) normal.negate();
      return { point: hit.point.clone(), normal };
    },

    // Whether a point is on the kept side of every plane cutting now.
    isPointKeptByClipping(point) {
      return (core.activeClippingPlanes || []).every((plane) => plane.distanceToPoint(point) >= -1e-6);
    },

    setClippingFace(point, faceNormal) {
      const state = Viewer.clippingState;
      if (!Viewer.isClippingAvailable() || !point || !faceNormal) return;
      // Into the model: behind the tapped face.
      state.face = { enabled: true, origin: point.clone(), normal: faceNormal.clone().normalize().negate(), offset: 0, negated: false };
      state.facePicking = false;
      state.lastKey = "face";
      if (!Viewer.clippingMode) Viewer.clippingMode = true;
      const canvas = core.renderer?.domElement;
      if (canvas) canvas.style.cursor = "";
      Viewer.touchClippingPlanes();
      Viewer.applyClippingState();
    },

    // How far the face plane can go: from just outside the model's box, in
    // front of the face, to past its far side.
    getClippingFaceRange() {
      const state = Viewer.clippingState;
      const { origin, normal } = state.face;
      if (!origin || !normal || !state.bounds) return null;
      const corners = [];
      const { min, max } = state.bounds;
      [min.x, max.x].forEach((x) => [min.y, max.y].forEach((y) => [min.z, max.z].forEach((z) => corners.push(new THREE.Vector3(x, y, z)))));
      const along = corners.map((corner) => normal.dot(new THREE.Vector3().subVectors(corner, origin)));
      const low = Math.min(...along);
      const high = Math.max(...along);
      const pad = (high - low) * OVERSHOOT;
      return { min: low, max: high, low: low - pad, high: high + pad, size: Math.max(high - low, 1e-6) };
    },

    setClippingFaceOffset(offset) {
      const state = Viewer.clippingState;
      const range = Viewer.getClippingFaceRange();
      if (!range || !Number.isFinite(offset)) return;
      state.face.offset = THREE.MathUtils.clamp(offset, range.low, range.high);
      state.lastKey = "face";
      Viewer.touchClippingPlanes();
      Viewer.syncClippingExtraPlanes();
      Viewer.updateClippingVisual("face");
      Viewer.syncClippingGhost();
      Viewer.updateClippingPanel();
    },

    setClippingFaceNegated(negated) {
      Viewer.clippingState.face.negated = negated === true;
      Viewer.syncClippingExtraPlanes();
      Viewer.syncClippingGhost();
      Viewer.updateClippingPanel();
    },

    removeClippingFace() {
      Viewer.clippingState.face = { enabled: false, origin: null, normal: null, offset: 0, negated: false };
      Viewer.applyClippingState();
    },

    // The box's low sides and the face plane, cutting with the axes' planes
    // (core.extraClippingPlanes, which updateActiveClippingPlanes adds).
    syncClippingExtraPlanes() {
      const state = Viewer.clippingState;
      if (!Array.isArray(core.extraClippingPlanes)) core.extraClippingPlanes = [];
      const planes = core.extraClippingPlanes;
      state.extraPlanes ||= { x: new THREE.Plane(), y: new THREE.Plane(), z: new THREE.Plane(), face: new THREE.Plane() };
      const wanted = [];
      if (Viewer.clippingMode && state.box.enabled) {
        CLIPPING_AXES.forEach((axis) => {
          if (!Viewer.isClippingAxisEnabled(axis)) return;
          // Keeps what is above the low side: x >= low.
          const plane = state.extraPlanes[axis];
          plane.normal.copy(AXIS_VECTORS[axis]);
          plane.constant = -Viewer.getClippingBoxLow(axis);
          wanted.push(plane);
        });
      }
      const face = state.face;
      if (Viewer.clippingMode && face.enabled && face.origin && face.normal) {
        const plane = state.extraPlanes.face;
        const point = face.origin.clone().addScaledVector(face.normal, face.offset);
        plane.setFromNormalAndCoplanarPoint(face.normal, point);
        if (face.negated) plane.negate();
        wanted.push(plane);
      }
      const changed = wanted.length !== planes.length || wanted.some((plane, index) => planes[index] !== plane);
      planes.length = 0;
      planes.push(...wanted);
      // The materials take a new number of planes only when told; moved, the
      // same Plane objects are read again each frame.
      if (changed) updateActiveClippingPlanes();
    },

    // The scene's drawing of a plane, by key: where it stands, its size,
    // how strongly it shows (moved now, pointed at, or at rest), its handle.
    updateClippingVisual(key) {
      const state = Viewer.clippingState;
      const visual = Viewer.getClippingVisual(key);
      if (!visual) return;
      const bounds = state.bounds;
      const info = bounds ? Viewer.getClippingPlaneInfo(key) : null;
      visual.group.visible = Boolean(info?.visible);
      if (!info) return;

      const size = bounds.getSize(new THREE.Vector3());
      visual.group.position.copy(info.center);
      if (info.quaternion) visual.group.quaternion.copy(info.quaternion);
      const extents = info.extents;
      visual.face.scale.set(extents[0], extents[1], 1);
      Viewer.updateClippingGrid(visual.axis, visual, extents[0]);

      // The handle at the quad's corner, as large as a twentieth of the model.
      const handleSize = Math.max(size.x, size.y, size.z) * 0.05;
      visual.handle.position.set(extents[0] / 2, extents[1] / 2, 0);
      visual.arrow.scale.setScalar(handleSize);
      drawPlaneLabel(visual.label, info.label);
      // Only the drawn part of the label's canvas, about 22 px tall on screen.
      const labelHeight = 0.022;
      const labelWidth = visual.label.width || 0.5;
      visual.label.sprite.scale.set(labelHeight * 4 * labelWidth, labelHeight, 1);
      visual.label.sprite.center.set(-0.12, 0.5);
      visual.label.sprite.material.map.repeat.set(labelWidth, 1);

      const resting = performance.now() - state.touchedAt > REST_AFTER_MS;
      const mode = state.drag?.axis === key ? "drag" : state.hoverAxis === key ? "hover" : resting ? "rest" : "active";
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
    updateClippingGrid(axis, visual, faceExtent = 0) {
      const bounds = Viewer.clippingState.bounds;
      if (!bounds) return;
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const metersPerUnit = Viewer.resolveModelUnit?.().meters || 1;
      if (!QUAD_AXES[axis]) {
        // A plane at any angle (the face plane): lines from its middle.
        const step = niceStep(faceExtent * metersPerUnit, 12) / metersPerUnit;
        const key = ["face", step, faceExtent].map((value) => (typeof value === "number" ? value.toPrecision(6) : value)).join("|");
        if (visual.grid.key === key) return;
        visual.grid.key = key;
        const minor = [];
        const major = [];
        const count = Math.floor(faceExtent / 2 / step);
        for (let k = -count; k <= count; k += 1) {
          const local = (k * step) / faceExtent;
          const target = k % 5 === 0 ? major : minor;
          target.push(local, -0.5, 0, local, 0.5, 0, -0.5, local, 0, 0.5, local, 0);
        }
        [["minor", minor], ["major", major]].forEach(([name, points]) => {
          const lines = visual.grid[name];
          lines.geometry.dispose();
          lines.geometry = new THREE.BufferGeometry();
          lines.geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
        });
        return;
      }
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
      Object.values(Viewer.clippingState.extraVisuals || {}).forEach((visual) => Viewer.removeAndDisposeFromScene(visual.group));
      Viewer.clippingState.visuals = null;
      Viewer.clippingState.extraVisuals = null;
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

    // The plane under the pointer: its arrow first (it stands in front of
    // all), then its quad.
    pickClippingAxis(event) {
      const state = Viewer.clippingState;
      if (!Viewer.clippingMode || !state.visuals || !core.camera) return null;
      const visuals = Viewer.getClippingVisualKeys().map((key) => Viewer.getClippingVisual(key)).filter((visual) => visual?.group.visible);
      if (!visuals.length) return null;
      Viewer.getClippingRay(event);
      const [handle] = state.raycaster.intersectObjects(visuals.map((visual) => visual.arrow), true);
      if (handle) return handle.object.userData.clippingAxis;
      const [hit] = state.raycaster.intersectObjects(visuals.map((visual) => visual.quad), false);
      return hit ? hit.object.userData.clippingAxis : null;
    },

    // Parameter along the line through `origin` in the plane `key`'s
    // direction, of the point closest to the ray.
    getAxisParameter(ray, axis, origin) {
      const d = Viewer.getClippingPlaneInfo(axis)?.direction || AXIS_VECTORS[axis.charAt(0)];
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
      // "Align to a face": this tap chooses the face.
      if (Viewer.clippingState.facePicking) {
        const picked = Viewer.pickClippingFace(event);
        event.preventDefault();
        event.stopImmediatePropagation();
        Viewer.onDownPosition?.set?.(Number.NaN, Number.NaN);
        if (picked) Viewer.setClippingFace(picked.point, picked.normal);
        return;
      }
      const axis = Viewer.pickClippingAxis(event);
      if (!axis) return;
      event.preventDefault();
      event.stopImmediatePropagation();

      const canvas = core.renderer.domElement;
      canvas.setPointerCapture?.(event.pointerId);
      const origin = Viewer.getClippingVisual(axis).group.position.clone();
      const ray = Viewer.getClippingRay(event);
      Viewer.clippingState.drag = {
        axis,
        pointerId: event.pointerId,
        origin,
        startPosition: Viewer.getClippingPlaneInfo(axis)?.position ?? 0,
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
        const range = drag.axis === "face" ? Viewer.getClippingFaceRange() : Viewer.getClippingAxisRange(drag.axis.charAt(0));
        const height = core.renderer.domElement.clientHeight || 1;
        position = drag.startPosition + ((drag.startY - event.clientY) / height) * (range?.size || 1);
      }
      Viewer.setClippingPlanePosition(drag.axis, position);
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
      // A value typed in: Enter takes it, Escape leaves it as it was.
      const valueField = (onChange) => {
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
          if (value.dataset.cancel !== "true") onChange(value.value);
        });
        value.addEventListener("blur", () => {
          delete value.dataset.cancel;
          Viewer.updateClippingPanel();
        });
        return value;
      };
      const rangeInput = (className, onInput) => {
        const input = document.createElement("input");
        input.type = "range";
        input.min = "0";
        input.max = String(SLIDER_STEPS);
        input.className = className;
        input.addEventListener("input", () => onInput(Number(input.value) / SLIDER_STEPS));
        return input;
      };
      // Which side is kept: the filled half, the plane down the middle.
      const flipButton = (onClick) => {
        const flip = document.createElement("button");
        flip.type = "button";
        flip.className = "viewer-clipping-panel_flip";
        flip.innerHTML = '<svg viewBox="0 0 20 16" width="20" height="16" aria-hidden="true" focusable="false"><rect class="viewer-clipping-panel_flip-kept" x="2" y="3" width="8" height="10" rx="1.5"/><rect x="10" y="3" width="8" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 1.6" opacity=".7"/><path d="M10 1v14" stroke="var(--axis-color)" stroke-width="2" stroke-linecap="round"/></svg>';
        flip.addEventListener("click", onClick);
        return flip;
      };

      CLIPPING_AXES.forEach((axis) => {
        const row = document.createElement("div");
        row.className = "viewer-clipping-panel_row";
        row.dataset.axis = axis;

        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "viewer-clipping-panel_axis";
        toggle.textContent = axis.toUpperCase();
        toggle.addEventListener("click", () => Viewer.toggleClippingPlaneHelper(axis));

        // One slider; with the section box a second one under it for the
        // box's low side, both on one track.
        const track = document.createElement("div");
        track.className = "viewer-clipping-panel_track";
        const sliderLow = rangeInput("viewer-clipping-panel_slider viewer-clipping-panel_slider--low", (fraction) => {
          const range = Viewer.getClippingAxisRange(axis);
          if (range) Viewer.setClippingBoxLow(axis, range.low + fraction * (range.high - range.low));
        });
        const slider = rangeInput("viewer-clipping-panel_slider", (fraction) => {
          const range = Viewer.getClippingAxisRange(axis);
          if (!range) return;
          if (!Viewer.isClippingAxisEnabled(axis)) Viewer.setClippingAxisEnabled(axis, true, { silent: true });
          const position = Viewer.clippingState.box.enabled
            ? Math.max(range.low + fraction * (range.high - range.low), Viewer.getClippingBoxLow(axis) + range.size * 0.005)
            : Viewer.clippingCutToPosition(axis, fraction);
          Viewer.setClippingAxisPosition(axis, position);
        });
        track.append(sliderLow, slider);

        // Where the plane stands, from the model's edge, in metres (or the
        // unit set for measuring): typed in, it goes there. With the box,
        // "low – high".
        const value = valueField((text) => {
          const range = Viewer.getClippingAxisRange(axis);
          if (!range) return;
          const shown = Viewer.formatClippingLength(Viewer.getClippingAxisPosition(axis) - range.min);
          if (Viewer.clippingState.box.enabled) {
            const [low, high] = Viewer.parseClippingLengthPair(text, shown) || [];
            if (low === undefined) return;
            Viewer.setClippingAxisPosition(axis, range.min + high);
            Viewer.setClippingBoxLow(axis, range.min + low);
            return;
          }
          const length = Viewer.parseClippingLengthText(text, shown);
          if (length === null) return;
          if (!Viewer.isClippingAxisEnabled(axis)) Viewer.setClippingAxisEnabled(axis, true, { silent: true });
          Viewer.setClippingAxisPosition(axis, range.min + length);
        });

        const flip = flipButton(() => Viewer.setClippingAxisNegated(axis, !Viewer.isClippingAxisNegated(axis)));
        row.append(toggle, track, value, flip);
        root.appendChild(row);
        rows[axis] = { row, toggle, track, slider, sliderLow, value, flip };
      });

      // The plane put to a face: its own row while there is one; its button
      // takes it away.
      {
        const row = document.createElement("div");
        row.className = "viewer-clipping-panel_row";
        row.dataset.axis = "face";
        row.hidden = true;
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "viewer-clipping-panel_axis";
        toggle.textContent = "◆";
        toggle.addEventListener("click", () => Viewer.removeClippingFace());
        const track = document.createElement("div");
        track.className = "viewer-clipping-panel_track";
        const slider = rangeInput("viewer-clipping-panel_slider", (fraction) => {
          const range = Viewer.getClippingFaceRange();
          if (range) Viewer.setClippingFaceOffset(range.low + fraction * (range.high - range.low));
        });
        track.append(slider);
        const value = valueField((text) => {
          const length = Viewer.parseClippingLengthText(text, Viewer.formatClippingLength(Math.abs(Viewer.clippingState.face.offset)));
          if (length !== null) Viewer.setClippingFaceOffset(length);
        });
        const flip = flipButton(() => Viewer.setClippingFaceNegated(!Viewer.clippingState.face.negated));
        row.append(toggle, track, value, flip);
        root.appendChild(row);
        rows.face = { row, toggle, track, slider, value, flip };
      }

      // Tools: the section box, a plane put to a face, the drawing.
      const tools = document.createElement("div");
      tools.className = "viewer-clipping-panel_tools";
      const tool = (icon, onClick) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "viewer-clipping-panel_tool";
        const iconSpan = document.createElement("span");
        iconSpan.className = "viewer-clipping-panel_tool-icon";
        iconSpan.setAttribute("aria-hidden", "true");
        iconSpan.innerHTML = icon;
        const text = document.createElement("span");
        button.append(iconSpan, text);
        button.addEventListener("click", onClick);
        tools.appendChild(button);
        return { button, text };
      };
      const svgIcon = (body) => `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round">${body}</svg>`;
      const boxTool = tool(svgIcon('<path d="M2.5 5 8 2l5.5 3v6L8 14l-5.5-3z"/><path d="M2.5 5 8 8l5.5-3M8 8v6"/>'), () => Viewer.setClippingBoxEnabled(!Viewer.clippingState.box.enabled));
      const faceTool = tool(svgIcon('<path d="M3 13 13 3"/><path d="M9 3h4v4"/><rect x="2" y="9" width="5" height="5" rx="1"/>'), () => Viewer.startClippingFacePick());
      const exportTool = tool(svgIcon('<path d="M8 2v8M5 7l3 3 3-3"/><path d="M2.5 11.5v2h11v-2"/>'), () => Viewer.exportClippingSection());
      root.appendChild(tools);

      // The look of the cut: filled, in the plane's colour, hatched, the part
      // cut away as a ghost - switches, Reset beside them.
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
      const hatch = toggle((checked) => Viewer.setClippingFillPattern(checked ? "hatch" : "solid"));
      hatch.label.classList.add("is-sub");
      const ghost = toggle((checked) => Viewer.setClippingGhostVisible(checked));
      const reset = document.createElement("button");
      reset.type = "button";
      reset.className = "viewer-clipping-panel_reset";
      reset.addEventListener("click", () => Viewer.resetClippingPlanes());
      actions.append(options, reset);
      root.appendChild(actions);

      stack.appendChild(root);
      state.panel = {
        root, title, rows, reset, boxTool, faceTool, exportTool,
        fillInput: fill.input, fillText: fill.text,
        planeColorInput: planeColor.input, planeColorText: planeColor.text, planeColorLabel: planeColor.label,
        hatchInput: hatch.input, hatchText: hatch.text, hatchLabel: hatch.label,
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

      const state = Viewer.clippingState;
      const box = state.box.enabled;
      panel.title.textContent = t("clipping.title", "Section planes");
      attachToolPanelChrome(panel.root, panel.title.parentNode, {
        icon: PANEL_ICONS.clipping,
        label: () => t("clipping.title", "Section planes"),
        // Like the toolbar button: the planes go, the panel with them.
        onClose: () => Viewer.toggleClippingPlanesPanel(),
      });
      const setValue = (value, text, label, disabled) => {
        if (document.activeElement !== value) value.value = text;
        value.title = label;
        value.setAttribute("aria-label", label);
        value.disabled = disabled;
      };
      CLIPPING_AXES.forEach((axis) => {
        const { row, toggle, track, slider, sliderLow, value, flip } = panel.rows[axis];
        const enabled = Viewer.isClippingAxisEnabled(axis);
        const negated = Viewer.isClippingAxisNegated(axis);
        row.classList.toggle("is-enabled", enabled);
        row.classList.toggle("is-box", box);
        track.classList.toggle("is-box", box);
        // Without the box it only draws the track (its thumb hidden, CSS).
        sliderLow.tabIndex = box ? 0 : -1;
        if (box) sliderLow.removeAttribute("aria-hidden");
        else sliderLow.setAttribute("aria-hidden", "true");
        flip.disabled = box;
        toggle.setAttribute("aria-pressed", enabled ? "true" : "false");
        const toggleLabel = Viewer.tFormat?.("clipping.toggleAxis", { axis: axis.toUpperCase() }, "Cut along {axis}") || axis;
        toggle.title = toggleLabel;
        toggle.setAttribute("aria-label", toggleLabel);
        slider.setAttribute("aria-label", Viewer.tFormat?.("clipping.position", { axis: axis.toUpperCase() }, "{axis} position") || axis);
        sliderLow.setAttribute("aria-label", Viewer.tFormat?.("clipping.boxLow", { axis: axis.toUpperCase() }, "{axis}: the box's other side") || axis);
        flip.setAttribute("aria-pressed", negated ? "true" : "false");
        flip.title = t("clipping.flip", "Flip the kept side");
        flip.setAttribute("aria-label", flip.title);

        const range = Viewer.getClippingAxisRange(axis);
        if (!range) return;
        const span = range.high - range.low;
        const position = Viewer.getClippingAxisPosition(axis);
        if (box) {
          const low = Viewer.getClippingBoxLow(axis);
          const from = THREE.MathUtils.clamp((low - range.low) / span, 0, 1);
          const to = THREE.MathUtils.clamp((position - range.low) / span, 0, 1);
          if (document.activeElement !== slider) slider.value = String(Math.round(to * SLIDER_STEPS));
          if (document.activeElement !== sliderLow) sliderLow.value = String(Math.round(from * SLIDER_STEPS));
          row.style.setProperty("--from", `${(from * 100).toFixed(2)}%`);
          row.style.setProperty("--to", `${(to * 100).toFixed(2)}%`);
          const text = Viewer.formatClippingLengthPair(Math.max(0, low - range.min), position - range.min);
          const label = Viewer.tFormat?.("clipping.boxValueTitle", { axis: axis.toUpperCase() }, "{axis}: the box from - to, from the model's edge - type both") || axis;
          setValue(value, text, label, !enabled);
          return;
        }
        const sliderCut = THREE.MathUtils.clamp(Viewer.clippingPositionToCut(axis, position), 0, 1);
        if (document.activeElement !== slider) slider.value = String(Math.round(sliderCut * SLIDER_STEPS));
        row.style.setProperty("--from", "0%");
        row.style.setProperty("--to", `${(sliderCut * 100).toFixed(2)}%`);
        // Where it stands from the model's edge; how much it removes, on hover.
        const cut = negated ? (position - range.min) / range.size : (range.max - position) / range.size;
        const percent = Math.round(THREE.MathUtils.clamp(cut, 0, 1) * 100);
        const label = Viewer.tFormat?.("clipping.valueTitle", { axis: axis.toUpperCase(), percent }, "{axis}: from the model's edge ({percent}% cut away) - type a value") || axis;
        setValue(value, Viewer.formatClippingLength(position - range.min), label, !enabled);
      });

      // The face plane's row.
      const faceRow = panel.rows.face;
      const face = state.face;
      faceRow.row.hidden = !face.enabled;
      faceRow.row.classList.toggle("is-enabled", face.enabled);
      if (face.enabled) {
        const range = Viewer.getClippingFaceRange();
        faceRow.toggle.title = t("clipping.removeFace", "Remove the plane put to a face");
        faceRow.toggle.setAttribute("aria-label", faceRow.toggle.title);
        faceRow.toggle.setAttribute("aria-pressed", "true");
        faceRow.slider.setAttribute("aria-label", t("clipping.facePosition", "How deep the plane put to a face goes"));
        faceRow.flip.setAttribute("aria-pressed", face.negated ? "true" : "false");
        faceRow.flip.title = t("clipping.flip", "Flip the kept side");
        faceRow.flip.setAttribute("aria-label", faceRow.flip.title);
        if (range) {
          const fraction = THREE.MathUtils.clamp((face.offset - range.low) / (range.high - range.low), 0, 1);
          if (document.activeElement !== faceRow.slider) faceRow.slider.value = String(Math.round(fraction * SLIDER_STEPS));
          faceRow.row.style.setProperty("--from", "0%");
          faceRow.row.style.setProperty("--to", `${(fraction * 100).toFixed(2)}%`);
        }
        const depth = `${face.offset < 0 ? "−" : ""}${Viewer.formatClippingLength(Math.abs(face.offset))}`;
        setValue(faceRow.value, depth, t("clipping.faceValueTitle", "How deep behind the face - type a value"), false);
      }

      const toolText = (entry, key, fallback, pressed) => {
        entry.text.textContent = t(key, fallback);
        if (pressed !== undefined) entry.button.setAttribute("aria-pressed", pressed ? "true" : "false");
      };
      toolText(panel.boxTool, "clipping.box", "Section box", box);
      panel.boxTool.button.title = t("clipping.boxTitle", "Cut every axis from both sides: a box around what to see");
      toolText(panel.faceTool, "clipping.alignFace", "Align to a face", state.facePicking);
      panel.faceTool.button.title = t("clipping.alignFaceTitle", "Tap a face of the model: a section plane there, parallel to it");
      toolText(panel.exportTool, "clipping.export", "Drawing (SVG)");
      panel.exportTool.button.title = t("clipping.exportTitle", "Download the section along the plane moved last as a drawing, with a scale bar");

      const splats = Viewer.isClippingSplats();
      const splatsTitle = splats ? t("clipping.splatsOnly", "Gaussian splats have no surface: they are cut, without a fill, a drawing or a plane put to a face") : "";
      [panel.faceTool, panel.exportTool].forEach((entry) => {
        entry.button.disabled = splats;
        if (splats) entry.button.title = splatsTitle;
      });
      panel.root.classList.toggle("is-splats", splats);

      const filled = core.planeParams?.outline?.visible === true && !splats;
      panel.fillInput.checked = filled;
      panel.fillInput.disabled = Boolean(Viewer.animationState) || splats;
      panel.fillText.textContent = t("clipping.fill", "Section fill");
      panel.planeColorInput.checked = state.fillColor === "plane";
      panel.planeColorInput.disabled = !filled || Boolean(Viewer.animationState);
      panel.planeColorLabel.classList.toggle("is-disabled", panel.planeColorInput.disabled);
      panel.planeColorText.textContent = t("clipping.planeColor", "In the plane's colour");
      panel.hatchInput.checked = state.fillPattern === "hatch";
      panel.hatchInput.disabled = panel.planeColorInput.disabled;
      panel.hatchLabel.classList.toggle("is-disabled", panel.hatchInput.disabled);
      panel.hatchText.textContent = t("clipping.hatch", "Hatched");
      panel.ghostInput.checked = state.ghost === true && !splats;
      panel.ghostInput.disabled = Boolean(Viewer.animationState) || splats;
      [panel.fillInput, panel.ghostInput].forEach((input) => {
        input.closest("label")?.classList.toggle("is-disabled", splats);
        input.closest("label")?.setAttribute("title", splatsTitle);
      });
      panel.ghostText.textContent = t("clipping.ghost", "Show the part cut away");
      panel.reset.textContent = t("clipping.reset", "Reset");
    },

    // A length for the panel: in the unit set for measuring
    // (editor/model-units.js).
    formatClippingLength(sceneUnits) {
      // At the very edge: 0 in the unit used around it, not "0.0 µm".
      if (Math.abs(sceneUnits) < 1e-9) {
        const unit = Viewer.formatLength?.(Viewer.clippingState.bounds?.getSize(new THREE.Vector3()).length() || 1).text.match(/[a-zµ]+$/i)?.[0];
        return unit ? `0 ${unit}` : "0";
      }
      return Viewer.formatLength ? Viewer.formatLength(sceneUnits).text : sceneUnits.toFixed(2);
    },

    // "2.70–10.82 m": the unit once when both have the same.
    formatClippingLengthPair(low, high) {
      const a = Viewer.formatClippingLength(low);
      const b = Viewer.formatClippingLength(high);
      const unitA = a.match(/\s([a-zµ]+)$/i)?.[1];
      const unitB = b.match(/\s([a-zµ]+)$/i)?.[1];
      return unitA && unitA === unitB ? `${a.slice(0, -unitA.length - 1)}–${b}` : `${a}–${b}`;
    },

    // What was typed - "4.5", "4,5 m", "120 cm", "3 ft" - as a length in
    // scene units, or null. A number alone is in the unit of `shown` (the
    // value as it was).
    parseClippingLengthText(text, shown = "") {
      const match = String(text).trim().replace(",", ".").match(/^(-?\d*\.?\d+)\s*(km|m|cm|mm|µm|um|ft|in|mi)?$/i);
      if (!match) return null;
      const number = Number(match[1]);
      if (!Number.isFinite(number)) return null;
      const METERS = { km: 1000, m: 1, cm: 0.01, mm: 0.001, "µm": 1e-6, um: 1e-6, ft: 0.3048, in: 0.0254, mi: 1609.344 };
      const unit = match[2]?.toLowerCase() || String(shown).match(/(km|m|cm|mm|µm|ft|in|mi)$/)?.[1];
      const metersPerUnit = Viewer.resolveModelUnit?.().meters || 1;
      const meters = unit && METERS[unit] ? number * METERS[unit] : number * metersPerUnit;
      return meters / metersPerUnit;
    },

    // "2 – 7.5 m", "2-7.5", "2 m .. 750 cm": [low, high] in scene units.
    parseClippingLengthPair(text, shown = "") {
      const parts = String(text).split(/\s*(?:–|—|\.\.|\bto\b|(?<=\d|[a-zµ])\s*-\s*(?=\d))\s*/i).filter(Boolean);
      if (parts.length !== 2) return null;
      // A unit given on the second only counts for both ("2 - 7.5 m").
      const unit = parts[1].match(/(km|m|cm|mm|µm|um|ft|in|mi)$/i)?.[1];
      const low = Viewer.parseClippingLengthText(/[a-zµ]$/i.test(parts[0]) || !unit ? parts[0] : `${parts[0]} ${unit}`, shown);
      const high = Viewer.parseClippingLengthText(parts[1], shown);
      if (low === null || high === null) return null;
      return low <= high ? [low, high] : [high, low];
    },

    // What was typed into an axis' value, as a plane position (scene units),
    // or null.
    parseClippingLength(axis, text) {
      const range = Viewer.getClippingAxisRange(axis);
      if (!range) return null;
      const length = Viewer.parseClippingLengthText(text, Viewer.formatClippingLength(Viewer.getClippingAxisPosition(axis) - range.min));
      return length === null ? null : range.min + length;
    },

    // The section along the plane moved last - or the first cutting - as an
    // SVG drawing (section-export.js), downloaded.
    exportClippingSection() {
      const state = Viewer.clippingState;
      if (Viewer.isClippingSplats()) return null;
      const planeOf = (key) => {
        if (key === "face") return state.face.enabled ? state.extraPlanes?.face : null;
        if (key?.length > 1) return state.box.enabled && Viewer.isClippingAxisEnabled(key.charAt(0)) ? state.extraPlanes?.[key.charAt(0)] : null;
        return key && Viewer.isClippingAxisEnabled(key) ? core.clippingPlanes[AXIS_INDEX[key]] : null;
      };
      let key = state.lastKey;
      let plane = planeOf(key);
      if (!plane) {
        key = [...CLIPPING_AXES, "face"].find((entry) => planeOf(entry));
        plane = planeOf(key);
      }
      if (!plane) {
        toastHelper("clippingExportNothing", "warning");
        return null;
      }
      const others = (core.activeClippingPlanes || []).filter((entry) => entry !== plane);
      const roots = Viewer.getClippingRoots(state.root);
      const segments = computeSectionSegments(roots, plane, others);
      const metersPerUnit = Viewer.resolveModelUnit?.().meters || 1;
      const info = Viewer.getClippingPlaneInfo(key);
      const name = key === "face" ? "◆" : key.charAt(0).toUpperCase();
      const where = info?.label?.split(" ").slice(1).join(" ") || "";
      const { filename = "", basename = "", extension = "" } = core.fileObject || {};
      const model = (String(filename).startsWith("blob:") ? `${basename}.${extension}` : String(filename).split("/").pop()) || "";
      const svg = buildSectionSvg(segments, {
        basis: sectionBasis(plane.normal),
        metersPerUnit,
        title: `${t("clipping.sectionTitle", "Section")} ${name}${where ? ` · ${where}` : ""}`,
        subtitle: [model, new Date().toISOString().slice(0, 10)].filter(Boolean).join(" · "),
      });
      const slug = `${key === "face" ? "face" : key.charAt(0)}-${where.replace(/[^\w.]+/g, "")}`.replace(/-$/, "");
      downloadSvg(svg, `section-${slug}.svg`);
      return { segments: segments.length, svg };
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
        fillPattern: Viewer.clippingState.fillPattern,
        ghost: Viewer.clippingState.ghost === true,
        ...Viewer.getClippingExtrasForPersistence(),
      };
    },

    // The section box and the plane put to a face, as saved: the box's low
    // sides as fractions of the model's box; the face plane's point the same
    // way, its normal, and how far it went in as a fraction of the model's
    // largest side. Only what is on.
    getClippingExtrasForPersistence() {
      const state = Viewer.clippingState;
      const round = (value) => Math.round(value * 1e6) / 1e6;
      const extras = {};
      if (state.box.enabled) {
        extras.box = { enabled: true, low: Object.fromEntries(CLIPPING_AXES.map((axis) => [axis, round(state.box.low[axis])])) };
      }
      const face = state.face;
      const bounds = state.bounds;
      if (face.enabled && face.origin && face.normal && bounds) {
        const size = bounds.getSize(new THREE.Vector3());
        const largest = Math.max(size.x, size.y, size.z) || 1;
        extras.face = {
          point: CLIPPING_AXES.map((axis) => round((face.origin[axis] - bounds.min[axis]) / (size[axis] || 1))),
          normal: face.normal.toArray().map(round),
          depth: round(face.offset / largest),
          negated: face.negated === true,
        };
      }
      return extras;
    },

    // The box and the face plane back (getClippingExtrasForPersistence); the
    // face plane waits for the model's box if it is not known yet.
    applyClippingExtras(saved) {
      const state = Viewer.clippingState;
      if (saved?.box && typeof saved.box === "object") {
        state.box.enabled = saved.box.enabled === true;
        CLIPPING_AXES.forEach((axis) => {
          const fraction = Number(saved.box.low?.[axis]);
          state.box.low[axis] = Number.isFinite(fraction) ? THREE.MathUtils.clamp(fraction, -OVERSHOOT, 1 + OVERSHOOT) : -OVERSHOOT;
        });
        if (state.box.enabled) CLIPPING_AXES.forEach((axis) => { core.planeParams.clippingMode[axis] = true; });
      }
      const face = saved?.face;
      const valid = face && Array.isArray(face.point) && face.point.length === 3 && Array.isArray(face.normal) && face.normal.length === 3
        && [...face.point, ...face.normal].every(Number.isFinite);
      state.pendingFace = valid ? face : null;
      if (!valid) state.face = { enabled: false, origin: null, normal: null, offset: 0, negated: false };
      Viewer.resolvePendingClippingFace();
    },

    resolvePendingClippingFace() {
      const state = Viewer.clippingState;
      const face = state.pendingFace;
      if (!face || !state.bounds) return;
      state.pendingFace = null;
      const size = state.bounds.getSize(new THREE.Vector3());
      const largest = Math.max(size.x, size.y, size.z) || 1;
      const origin = new THREE.Vector3(...CLIPPING_AXES.map((axis, index) => state.bounds.min[axis] + face.point[index] * size[axis]));
      const normal = new THREE.Vector3(...face.normal).normalize();
      state.face = { enabled: true, origin, normal, offset: (Number(face.depth) || 0) * largest, negated: face.negated === true };
      // Saved cutting: the section tool is on.
      if (!Viewer.clippingMode) Viewer.clippingMode = true;
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
      if (saved.fillPattern === "hatch" || saved.fillPattern === "solid") state.fillPattern = saved.fillPattern;
      Viewer.applyClippingExtras(saved);
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
