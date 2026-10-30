import THREE from "../init.js";
import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { applyRenderingSettings, getRenderingSettings, renderFrame } from "../rendering.js";
import { getUpAxis, upAxisQuaternion } from "../up-axis.js";
import { fitPanelToViewer, getViewerSideStack } from "../ui/side-stack.js";
import { attachToolPanelChrome, PANEL_ICONS, refreshToolPanelChrome } from "../ui/tool-panel-chrome.js";
import { getSmartHint, hideSmartHint, showSmartHint } from "../ui/smart-hint.js";
import { decideModelBase, evaluatePublishChecks, measureFraming, sortPublishChecks, suggestUpAxis } from "./publish-rules.js";
import { shadingModeLabel } from "./shading.js";

// Prepare for publishing (File > Prepare for publishing): before the
// model's settings are saved to the repository and its renders made, what
// would show in them or in the saved start view and should not - the model
// lying on its side or floating, out of the frame, too dark, the tools left
// on (section planes, measurements, the transform handles, wireframe) - each
// with a fix, and tips worth a look (heavy for phones, black materials, the
// unit). Then the next steps: save the settings, make the renders.
//
// The rules are in publish-rules.js; this gathers the facts (the model's
// geometry is sampled in the browser, the view's brightness read from a
// small copy of the canvas) and runs the fixes.
//
// The viewer also speaks up by itself (ui/smart-hint.js): a model that
// seems to lie on its side after loading, and things to fix when "Save
// settings", "Render preview" or "Generate thumbnails" is pressed (with
// "Continue anyway"). Not in tests unless asked (setPublishGuard). While
// it is on, the toolbar's button carries the number of things to fix (and
// its menu's tab a dot), kept up to date after the tools change, the camera
// stops and the model is moved.
//
// The renders' front (thumbnail-capture.js): the side the start view looks
// from (the saved camera, the framing here), in steps of 45°.

const SAMPLE_TRIANGLES = 120000;
// Flat: the normal within about 25° of the axis.
const FLAT = 0.9;
// The ends of the box: this share of its size.
const END_BAND = 0.04;
const BRIGHTNESS_SIZE = 96;
const ORIENTATION_HINT_DELAY_MS = 1500;
const ORIENTATION_HINT_TIMEOUT_MS = 60000;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

const DIRECTION_VECTORS = {
  "X+": new THREE.Vector3(1, 0, 0),
  "X-": new THREE.Vector3(-1, 0, 0),
  "Y+": new THREE.Vector3(0, 1, 0),
  "Y-": new THREE.Vector3(0, -1, 0),
  "Z+": new THREE.Vector3(0, 0, 1),
  "Z-": new THREE.Vector3(0, 0, -1),
};

function axisName(vector) {
  const abs = [Math.abs(vector.x), Math.abs(vector.y), Math.abs(vector.z)];
  const index = abs.indexOf(Math.max(...abs));
  const value = [vector.x, vector.y, vector.z][index];
  return `${"XYZ"[index]}${value >= 0 ? "+" : "-"}`;
}

// The flat area at each end of the box, in world space, and the whole
// surface (sampled evenly over at most SAMPLE_TRIANGLES triangles).
function measureEnds(roots, box) {
  const meshes = [];
  let total = 0;
  roots.forEach((root) => root.traverse((object) => {
    if (!object.isMesh || !object.geometry?.attributes?.position) return;
    if (object.userData?.isCertaintyOverlay || object.userData?.isWeather || object.userData?.isGaussianSplats) return;
    const geometry = object.geometry;
    const count = Math.floor((geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3);
    meshes.push({ object, count });
    total += count;
  }));
  const stride = Math.max(1, Math.ceil(total / SAMPLE_TRIANGLES));
  const size = box.getSize(new THREE.Vector3());
  const band = [size.x, size.y, size.z].map((value) => Math.max(value * END_BAND, 1e-6));
  const min = [box.min.x, box.min.y, box.min.z];
  const max = [box.max.x, box.max.y, box.max.z];
  const areas = { "X+": 0, "X-": 0, "Y+": 0, "Y-": 0, "Z+": 0, "Z-": 0 };
  let surface = 0;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  meshes.forEach(({ object, count }) => {
    const geometry = object.geometry;
    const position = geometry.attributes.position;
    const index = geometry.index;
    object.updateWorldMatrix(true, false);
    const matrix = object.matrixWorld;
    for (let triangle = 0; triangle < count; triangle += stride) {
      const i = triangle * 3;
      a.fromBufferAttribute(position, index ? index.getX(i) : i).applyMatrix4(matrix);
      b.fromBufferAttribute(position, index ? index.getX(i + 1) : i + 1).applyMatrix4(matrix);
      c.fromBufferAttribute(position, index ? index.getX(i + 2) : i + 2).applyMatrix4(matrix);
      ab.subVectors(b, a);
      ac.subVectors(c, a);
      const normal = ab.cross(ac);
      const length = normal.length();
      if (!(length > 0)) continue;
      const area = length / 2;
      surface += area;
      normal.divideScalar(length);
      const components = [normal.x, normal.y, normal.z];
      for (let axis = 0; axis < 3; axis += 1) {
        if (Math.abs(components[axis]) < FLAT) continue;
        const values = [a.getComponent(axis), b.getComponent(axis), c.getComponent(axis)];
        if (Math.max(...values) <= min[axis] + band[axis]) areas[`${"XYZ"[axis]}-`] += area;
        else if (Math.min(...values) >= max[axis] - band[axis]) areas[`${"XYZ"[axis]}+`] += area;
      }
    }
  });
  return { areas, surface };
}

export function attachPublishCheck(Viewer) {
  const run = {
    save: Viewer.saveEditorMetadata,
    thumbnails: Viewer.generateThumbnails,
    preview: Viewer.takeScreenshot,
  };

  Object.assign(Viewer, {
    publishCheck: {
      checks: [],
      // Fixes and the toolbar's actions: asked before saving and rendering.
      guard: typeof window === "undefined" || !window.__E2E__,
      // The actions done anyway despite the hint, for this model.
      acknowledged: new Set(),
      // The settings as last saved (publishSignature), and when.
      savedSignature: null,
      savedAt: null,
      hintTimer: null,
      badgeTimer: null,
      badgeBound: false,
      // The base measured last (measurePublishBase), for the same model
      // standing the same way.
      baseCache: null,
      // The renders' front from the start view, else the file's +Z.
      frontFromView: true,
      // A start view someone chose: a saved camera, a manifest's, framed
      // or saved here (the automatic one keeps the file's +Z front).
      startViewChosen: false,
      brightnessCanvas: null,
    },
    publishCheckPanel: null,

    setPublishGuard(enabled) {
      Viewer.publishCheck.guard = enabled === true;
    },

    // ---- the facts --------------------------------------------------------------

    getPublishModelBox(roots = Viewer.getSunModelRoots?.() || []) {
      const box = new THREE.Box3();
      roots.forEach((root) => {
        try {
          box.expandByObject(root, true);
        } catch (_error) {
          // Streamed or splat objects without plain geometry.
        }
      });
      return box;
    },

    // Which end the model stands on, and the up axis that would stand it up.
    measurePublishBase(roots, box) {
      if (box.isEmpty()) return null;
      const state = Viewer.publishCheck;
      const key = JSON.stringify([roots.map((root) => root.uuid), box.min.toArray(), box.max.toArray(), getUpAxis(Viewer.getUpAxisRoot?.())]
        .flat(2).map((value) => (typeof value === "number" ? Math.round(value * 1e4) / 1e4 : value)));
      if (state.baseCache?.key === key) return state.baseCache.value;
      const value = Viewer.measurePublishBaseNow(roots, box);
      state.baseCache = { key, value };
      return value;
    },

    measurePublishBaseNow(roots, box) {
      const { areas, surface } = measureEnds(roots, box);
      const size = box.getSize(new THREE.Vector3());
      const decision = decideModelBase(areas, surface, { X: size.x, Y: size.y, Z: size.z });
      const root = Viewer.getUpAxisRoot?.();
      const rotated = Boolean(root) && (Math.abs(root.rotation.x) + Math.abs(root.rotation.y) + Math.abs(root.rotation.z)) > 1e-3;
      // A world direction as the file's axis under the fix applied now.
      const inverse = upAxisQuaternion(getUpAxis(root)).invert();
      const toFileAxis = (direction) => axisName(DIRECTION_VECTORS[direction].clone().applyQuaternion(inverse));
      return { ...decision, upAxis: suggestUpAxis(decision.base, toFileAxis), rotated };
    },

    // The mean brightness of the model's pixels in the view (sRGB 0..1) and
    // the share blown out; null where the canvas cannot be read (WebGPU).
    measureViewBrightness() {
      const source = core.renderer?.domElement;
      if (core.rendererBackend === "webgpu" || !source?.width || !source.height) return null;
      const state = Viewer.publishCheck;
      const canvas = state.brightnessCanvas || (state.brightnessCanvas = document.createElement("canvas"));
      canvas.width = BRIGHTNESS_SIZE;
      canvas.height = Math.max(1, Math.round(BRIGHTNESS_SIZE * source.height / source.width));
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return null;
      try {
        // In the same task as the drawing: the canvas as now.
        renderFrame();
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(source, 0, 0, canvas.width, canvas.height);
        const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
        let sum = 0;
        let pixels = 0;
        let clipped = 0;
        for (let i = 0; i < data.length; i += 4) {
          // The background is the page's, behind a clear canvas.
          if (data[i + 3] < 242) continue;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          sum += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
          if (Math.max(r, g, b) >= 250) clipped += 1;
          pixels += 1;
        }
        return pixels ? { mean: sum / pixels, clipped: clipped / pixels, pixels } : { mean: 0, clipped: 0, pixels: 0 };
      } catch (error) {
        console.warn("The view's brightness could not be read", error);
        return null;
      }
    },

    gatherPublishFacts({ light = true } = {}) {
      const roots = Viewer.getSunModelRoots?.() || [];
      let kind = roots.length ? "mesh" : null;
      let triangles = 0;
      let largestTexture = 0;
      const black = [];
      const invisible = [];
      roots.forEach((root) => root.traverse((object) => {
        if (object.userData?.isGaussianSplats) kind = "splats";
        if (object.isPoints && kind !== "splats") kind = "pointcloud";
        if (!object.isMesh || !object.geometry?.attributes?.position) return;
        const geometry = object.geometry;
        triangles += (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
      }));
      if (Viewer.isPointCloudActive?.() && kind === "mesh" && triangles === 0) kind = "pointcloud";
      (Viewer.materialsEditor?.items || []).forEach((item) => {
        const material = item.current;
        [material.map, material.normalMap, material.emissiveMap].forEach((texture) => {
          const image = texture?.image;
          if (image) largestTexture = Math.max(largestTexture, image.width || 0, image.height || 0);
        });
        const color = material.color;
        const lit = (color ? Math.max(color.r, color.g, color.b) : 1) + (material.emissive ? Math.max(material.emissive.r, material.emissive.g, material.emissive.b) * (material.emissiveIntensity ?? 1) : 0);
        if (!material.map && !material.vertexColors && lit < 0.004 && !(material.metalness > 0.5)) black.push({ id: item.id, label: item.label });
        if (material.visible === false || (material.transparent && material.opacity < 0.05 && !(material.transmission > 0))) invisible.push({ id: item.id, label: item.label });
      });

      const tiled = roots.some((root) => root.userData?.isTiledModel);
      const box = Viewer.getPublishModelBox(roots);
      const empty = box.isEmpty();
      const unit = Viewer.resolveModelUnit?.() || { meters: 1, source: "default" };
      const size = empty ? null : box.getSize(new THREE.Vector3());
      const camera = core.camera;
      const animating = window.viewer?.isCameraAnimating?.() === true;
      let framing = null;
      if (!empty && camera && !animating && !tiled) {
        camera.updateMatrixWorld();
        const corners = [];
        for (let i = 0; i < 8; i += 1) {
          const corner = new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
          corner.project(camera);
          corners.push([corner.x, corner.y, corner.z]);
        }
        framing = measureFraming(corners, box.containsPoint(camera.position));
      }
      const ground = !empty && kind && kind !== "splats"
        ? { offset: box.min.y - (core.basicGrid?.position?.y ?? box.min.y), height: size.y }
        : null;
      const transform = Viewer.transformText || {};
      const loading = window.viewer?.fullModelLoaded !== true;
      return {
        kind,
        tiled,
        loading,
        base: kind === "mesh" && !tiled && !empty && !loading ? Viewer.measurePublishBase(roots, box) : null,
        ground,
        framing,
        light: light && kind && !empty && !loading ? Viewer.measureViewBrightness() : undefined,
        tools: {
          clipping: Viewer.hasActiveClipping?.() === true,
          measurements: Boolean(Viewer.measurementDraft) || (Viewer.measurementResults?.length || 0) > 0 || (Viewer.ruler?.length || 0) > 0,
          faces: (Viewer.selectedFaces?.length || 0) > 0,
          transform: Boolean(transform["Transform 3D Object"]),
          lightTransform: Boolean(transform["Transform Light"]),
          wireframe: core.wireframeMode === true,
          certainty: Viewer.certaintyView === true,
          selection: (core.selectedObjects?.length || 0) > 0,
          shading: Viewer.shadingMode && Viewer.shadingMode !== "original" ? Viewer.shadingMode : null,
          weather: Viewer.weather?.enabled ? Viewer.weather.type : null,
        },
        quality: Viewer.getRenderQuality?.() || "high",
        size: size ? { x: size.x * unit.meters, y: size.y * unit.meters, z: size.z * unit.meters } : null,
        unitSource: unit.source,
        triangles: Math.round(triangles),
        largestTexture,
        materials: { black, invisible, suggested: Viewer.getMaterialsWithSuggestions?.().length || 0 },
        canValidate: typeof Viewer.toggleValidationReport === "function" && Boolean(Viewer.editorToolbarButtons?.validationReport),
      };
    },

    computePublishChecks(options) {
      const facts = Viewer.gatherPublishFacts(options);
      const checks = sortPublishChecks(evaluatePublishChecks(facts));
      Viewer.publishCheck.checks = checks;
      Viewer.publishCheck.facts = facts;
      return checks;
    },

    // ---- fixes --------------------------------------------------------------------

    canFixPublishCheck(check) {
      if (check.level === "ok" || check.level === "wait") return false;
      // Upside down may be meant (a table): the fix only where sure.
      if (check.key === "orientation") return Boolean(check.values.upAxis) && !check.values.rotated && (check.level === "fix" || check.values.side === "upsideDown");
      return !["units", "heavy"].includes(check.key);
    },

    fixPublishCheck(check) {
      const root = Viewer.getUpAxisRoot?.();
      switch (check.key) {
        case "orientation":
          return Viewer.setUpAxis?.(check.values.upAxis) === true;
        case "ground": {
          if (!root) return false;
          const box = Viewer.getPublishModelBox();
          if (box.isEmpty()) return false;
          root.position.y -= box.min.y - (core.basicGrid?.position?.y ?? 0);
          root.updateMatrixWorld(true);
          Viewer.syncOutlineClippingTransform?.();
          Viewer.refreshClippingForModel?.(root);
          Viewer.refreshAnnotationPOIs?.();
          return true;
        }
        case "framing":
          return Viewer.frameModelInView();
        case "exposure": {
          const exposure = getRenderingSettings().exposure;
          applyRenderingSettings({ exposure: Math.min(3, Math.max(0.05, Math.round(exposure * check.values.factor * 100) / 100)) });
          Viewer.updateLightsSubmenuState?.();
          return true;
        }
        case "tool.clipping":
          Viewer.removeAllClipping?.();
          return true;
        case "tool.measurements":
          if (Viewer.RULER_MODE) Viewer.toggleDistanceMeasurement?.();
          Viewer.clearMeasurements?.();
          return true;
        case "tool.faces":
          Viewer.clearSelectedFaces?.();
          return true;
        case "tool.transform":
          Viewer.setObjectTransformMode?.("");
          return true;
        case "tool.lightTransform":
          Viewer.setLightTransformMode?.("");
          return true;
        case "tool.wireframe":
          if (core.wireframeMode) Viewer.toggleWireframeMode?.();
          return true;
        case "tool.certainty":
          Viewer.setCertaintyView?.(false);
          return true;
        case "tool.selection":
          Viewer.clearHierarchySelection?.();
          return true;
        case "tool.shading":
          Viewer.setShadingMode?.("original");
          return true;
        case "tool.weather":
          Viewer.setWeather?.(false);
          return true;
        case "quality":
          return Viewer.setRenderQuality?.("high") === true;
        case "materials.suggested":
          Viewer.applySuggestedMaterialTypes?.();
          return true;
        case "materials.black":
        case "materials.invisible":
          Viewer.openMaterialsPanel?.(check.values.names?.[0]?.id);
          return true;
        case "metadata":
          if (!Viewer.isValidationReportOpen?.()) Viewer.toggleValidationReport?.();
          return true;
        default:
          return false;
      }
    },

    // Every "fix" with a fix of its own; the tips stay for the user.
    fixAllPublishChecks() {
      const fixes = Viewer.publishCheck.checks.filter((check) => check.level === "fix" && Viewer.canFixPublishCheck(check));
      // Standing up first: it puts the model on the ground and changes its box.
      fixes.sort((a, b) => (a.key === "orientation" ? -1 : 0) - (b.key === "orientation" ? -1 : 0));
      let fixed = 0;
      fixes.forEach((check) => {
        if (check.key === "framing" || check.key === "ground") return;
        if (Viewer.fixPublishCheck(check)) fixed += 1;
      });
      // On the model as it stands now.
      ["ground", "framing"].forEach((key) => {
        const check = Viewer.computePublishChecks({ light: false }).find((item) => item.key === key && item.level === "fix");
        if (check && Viewer.fixPublishCheck(check)) fixed += 1;
      });
      Viewer.refreshPublishCheck();
      return fixed;
    },

    // The whole model in the view, from the side the camera looks from now;
    // also the view "Reset camera" goes back to.
    frameModelInView() {
      const camera = core.camera;
      const controls = core.controls;
      const box = Viewer.getPublishModelBox();
      if (!camera || !controls || box.isEmpty()) return false;
      core.cameraTween?.stop?.();
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      const direction = camera.position.clone().sub(controls.target);
      if (direction.lengthSq() < 1e-12) direction.set(1, 0.6, 1);
      direction.normalize();
      let distance;
      if (camera.isPerspectiveCamera) {
        const vertical = THREE.MathUtils.degToRad(camera.fov) / 2;
        const horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
        distance = sphere.radius / Math.sin(Math.min(vertical, horizontal)) * 1.05;
      } else {
        distance = sphere.radius * 4;
        camera.zoom = Math.min(camera.right - camera.left, camera.top - camera.bottom) / (sphere.radius * 2.2);
      }
      camera.position.copy(sphere.center).addScaledVector(direction, distance);
      camera.far = Math.max(camera.far, distance + sphere.radius * 4);
      camera.updateProjectionMatrix();
      controls.target.copy(sphere.center);
      controls.update();
      core.cameraCoords = camera.position.clone();
      core.controlsTarget = sphere.center.clone();
      Viewer.markStartViewChosen();
      return true;
    },

    // ---- saved, and the actions it guards ---------------------------------------

    // What the saved settings hold, to tell a change since saving.
    publishSignature() {
      const root = Viewer.getUpAxisRoot?.();
      const round = (vector) => (vector ? vector.toArray().map((value) => Math.round(value * 1000) / 1000) : null);
      return JSON.stringify({
        position: round(root?.position),
        rotation: root ? [root.rotation.x, root.rotation.y, root.rotation.z].map((value) => Math.round(value * 1000) / 1000) : null,
        scale: round(root?.scale),
        upAxis: root ? getUpAxis(root) : null,
        camera: round(core.camera?.position),
        target: round(core.controls?.target),
        light: core.dirLight ? [round(core.dirLight.position), core.dirLight.color?.getHex(), core.dirLight.intensity] : null,
        ambient: core.ambientLight ? [core.ambientLight.color?.getHex(), core.ambientLight.intensity] : null,
        materials: Viewer.getMaterialOverridesForPersistence?.() || [],
      });
    },

    // The settings saved now (with or without the panel open).
    markPublishSaved() {
      // The saved camera is the start view now ("Reset camera", the
      // renders' front).
      if (core.camera && core.controls) {
        core.cameraCoords = core.camera.position.clone();
        core.controlsTarget = core.controls.target.clone();
        Viewer.markStartViewChosen();
      }
      Viewer.publishCheck.savedSignature = Viewer.publishSignature();
      Viewer.publishCheck.savedAt = new Date();
      Viewer.syncPublishSteps();
    },

    getPublishSaveState() {
      const state = Viewer.publishCheck;
      if (!state.savedSignature) return "unsaved";
      return state.savedSignature === Viewer.publishSignature() ? "saved" : "changed";
    },

    // `kind`: "save", "preview" or "thumbnails". With things to fix, a hint
    // asks first: review them, or go on anyway (not asked again for this
    // model). Resolves to the action's result, false when it waits.
    async checkBeforePublishing(kind, proceed) {
      const state = Viewer.publishCheck;
      if (!state.guard || state.acknowledged.has(kind) || Viewer.publishCheckPanel) return proceed();
      const fixes = Viewer.computePublishChecks().filter((check) => check.level === "fix");
      if (!fixes.length) return proceed();
      showSmartHint({
        key: "publishGuard",
        once: false,
        tone: "warning",
        message: t(`prepare.guard.${kind}`, { count: fixes.length }, "{count} things to fix first"),
        detail: fixes.slice(0, 3).map((check) => Viewer.describePublishCheck(check).title).join(" · "),
        actions: [
          { key: "review", primary: true, label: t("prepare.guard.review", "Review"), run: () => Viewer.togglePublishCheckPanel(true) },
          {
            key: "continue",
            label: t("prepare.guard.continue", "Continue anyway"),
            run: () => {
              state.acknowledged.add(kind);
              proceed();
            },
          },
        ],
      });
      return false;
    },

    saveEditorMetadata: async (...args) => Viewer.checkBeforePublishing("save", async () => {
      const saved = await run.save.apply(Viewer, args);
      if (saved) Viewer.markPublishSaved();
      return saved;
    }),
    generateThumbnails: (...args) => Viewer.checkBeforePublishing("thumbnails", () => run.thumbnails.apply(Viewer, args)),
    takeScreenshot: (...args) => Viewer.checkBeforePublishing("preview", () => run.preview.apply(Viewer, args)),

    // From the window: it was the review.
    async runPublishStep(kind) {
      if (kind === "save") {
        const saved = await run.save.apply(Viewer);
        if (saved) Viewer.markPublishSaved();
        return saved;
      }
      return kind === "thumbnails" ? run.thumbnails.apply(Viewer) : run.preview.apply(Viewer);
    },

    // After loading, in the editor: a model on its side is pointed out with
    // a button that stands it up; the toolbar's count is made.
    schedulePublishHints() {
      const state = Viewer.publishCheck;
      clearTimeout(state.hintTimer);
      if (!state.guard || !core.EDITOR || core.PRESENTATION_MODE || Viewer.urlOptions?.hideUi === true) return;
      const started = performance.now();
      const manifest = Viewer.currentManifest;
      let counted = false;
      const wait = () => {
        if (Viewer.currentManifest !== manifest) return;
        const settled = window.viewer?.fullModelLoaded === true && window.viewer?.isCameraAnimating?.() !== true;
        // The toolbar's count, once the model stands still.
        if (settled && !counted) {
          counted = true;
          Viewer.schedulePublishBadge();
        }
        // Another hint first (a heavy model): this one waits for it.
        if (!settled || getSmartHint()) {
          if (performance.now() - started < ORIENTATION_HINT_TIMEOUT_MS) state.hintTimer = setTimeout(wait, 500);
          return;
        }
        Viewer.offerOrientationHint();
      };
      state.hintTimer = setTimeout(wait, ORIENTATION_HINT_DELAY_MS);
    },

    offerOrientationHint() {
      const roots = Viewer.getSunModelRoots?.() || [];
      const box = Viewer.getPublishModelBox(roots);
      if (!roots.length || box.isEmpty() || roots.some((root) => root.userData?.isTiledModel)) return false;
      const base = Viewer.measurePublishBase(roots, box);
      const [check] = evaluatePublishChecks({ kind: "mesh", base });
      if (check?.key !== "orientation" || check.level !== "fix") return false;
      return showSmartHint({
        key: "orientation",
        message: Viewer.describePublishCheck(check).title,
        detail: t("prepare.orientationHint", "Its largest flat faces are at the side, not below."),
        actions: [{
          key: "fix",
          primary: true,
          label: t("prepare.fix.orientation", "Stand it up"),
          run: () => {
            Viewer.setUpAxis?.(check.values.upAxis);
            Viewer.refreshPublishCheck();
          },
        }],
      });
    },

    // ---- the toolbar's count -----------------------------------------------------

    schedulePublishBadge() {
      const state = Viewer.publishCheck;
      if (!state.guard || !core.EDITOR || !Viewer.editorToolbarButtons?.publishCheck) return;
      if (!state.badgeBound) {
        state.badgeBound = true;
        const later = () => Viewer.schedulePublishBadge();
        core.controls?.addEventListener?.("end", later);
        core.transformControl?.addEventListener?.("mouseUp", later);
      }
      clearTimeout(state.badgeTimer);
      state.badgeTimer = setTimeout(() => Viewer.updatePublishBadge(), 400);
    },

    // The number of things to fix on the toolbar's button; null while the
    // model loads.
    updatePublishBadge() {
      const button = Viewer.editorToolbarButtons?.publishCheck;
      if (!button) return null;
      let count = null;
      if (window.viewer?.fullModelLoaded === true && window.viewer?.isCameraAnimating?.() !== true) {
        const checks = Viewer.publishCheckPanel ? Viewer.publishCheck.checks : Viewer.computePublishChecks({ light: false });
        count = checks.filter((check) => check.level === "fix").length;
      }
      const icon = button.querySelector(".viewer-editor-tool_icon") || button;
      let badge = icon.querySelector(":scope > .viewer-tool-badge");
      if (!badge) {
        badge = el("span", "viewer-tool-badge");
        badge.setAttribute("aria-hidden", "true");
        icon.append(badge);
      }
      badge.hidden = !count;
      badge.textContent = count ? String(Math.min(count, 9)) + (count > 9 ? "+" : "") : "";
      button.dataset.badge = count ? String(count) : "";
      const label = t("prepare.title", "Prepare for publishing");
      button.setAttribute("aria-label", count ? `${label}: ${t("prepare.badge", { count }, "{count} to fix")}` : label);
      // Its menu's tab: the File tab, or "More" on a phone.
      core.editorToolbar?.querySelectorAll('.viewer-menus_tab[data-menu="file"], .viewer-menus_tab[data-menu="more"]').forEach((tab) => {
        tab.classList.toggle("has-badge", Boolean(count));
      });
      return count;
    },

    // ---- the renders' front -------------------------------------------------------

    // Degrees about the up axis from +Z to the side the start view looks
    // from, in steps of 45° (0 without a start view, or when off).
    getThumbnailFrontAngle(box = Viewer.getPublishModelBox()) {
      const camera = core.cameraCoords;
      const state = Viewer.publishCheck;
      if (!state.frontFromView || !state.startViewChosen || !camera || box.isEmpty()) return 0;
      const center = box.getCenter(new THREE.Vector3());
      const dx = camera.x - center.x;
      const dz = camera.z - center.z;
      if (Math.hypot(dx, dz) < 1e-9) return 0;
      const angle = Math.round(THREE.MathUtils.radToDeg(Math.atan2(dx, dz)) / 45) * 45;
      return ((angle % 360) + 360) % 360;
    },

    markStartViewChosen() {
      Viewer.publishCheck.startViewChosen = true;
    },

    setThumbnailFrontFromView(enabled) {
      Viewer.publishCheck.frontFromView = enabled !== false;
      Viewer.syncPublishSteps();
    },

    // ---- the words ----------------------------------------------------------------

    describePublishCheck(check) {
      const v = check.values || {};
      const percent = (value) => `${Math.round(value * 100)}%`;
      const names = (list) => (list || []).slice(0, 3).map((item) => `„${item.label}”`).join(", ") + ((list?.length || 0) > 3 ? " …" : "");
      const text = (key, vars, fallback) => t(`prepare.check.${key}`, vars, fallback);
      switch (check.key) {
        case "loading": return { title: text("loading", {}, "The model is still loading"), detail: text("loadingDetail", {}, "Check again once the full model is shown.") };
        case "orientation":
          if (check.level === "ok") return { title: text("orientationOk", {}, "Stands upright") };
          return {
            title: v.side === "upsideDown" ? text("upsideDown", {}, "The model seems to be upside down") : text("onSide", {}, "The model seems to lie on its side"),
            detail: v.upAxis
              ? text("orientationDetail", { axis: v.upAxis }, "Its flat base is not at the bottom. Up axis {axis} would stand it up.")
              : text("orientationRotated", {}, "It was turned by hand: check the rotation."),
            fixLabel: t("prepare.fix.orientation", "Stand it up"),
          };
        case "ground":
          if (check.level === "ok") return { title: text("groundOk", {}, "Stands on the ground") };
          return {
            title: v.direction === "above" ? text("floating", {}, "The model floats above the ground") : text("sunk", {}, "The model reaches below the ground"),
            detail: text("groundDetail", { share: percent(v.share) }, "By {share} of its height."),
            fixLabel: t("prepare.fix.ground", "Put it on the ground"),
          };
        case "framing":
          if (check.level === "ok") return { title: text("framingOk", {}, "The whole model is in the view") };
          if (v.state === "inside") return { title: text("inside", {}, "The view is inside the model"), detail: text("insideDetail", {}, "Fine for an interior; the saved start view and the preview show it so."), fixLabel: t("prepare.fix.framing", "Frame the model") };
          return {
            title: v.state === "cut" ? text("cut", { percent: v.percent }, "Part of the model is out of the view") : text("small", {}, "The model is small in the view"),
            detail: v.state === "cut"
              ? text("cutDetail", { percent: `${v.percent}%` }, "About {percent} of it is cut off in the saved start view and the preview.")
              : text("smallDetail", { percent: `${v.percent}%` }, "It fills about {percent} of the view."),
            fixLabel: t("prepare.fix.framing", "Frame the model"),
          };
        case "exposure":
          if (check.level === "ok") return { title: text("exposureOk", {}, "Well lit") };
          return {
            title: v.state === "dark" ? text("dark", {}, "The model looks too dark") : text("bright", {}, "The model looks too bright"),
            detail: text("exposureDetail", { percent: `${v.percent}%` }, "Average brightness {percent}."),
            fixLabel: v.state === "dark" ? t("prepare.fix.brighter", "Brighten") : t("prepare.fix.darker", "Darken"),
          };
        case "tools": return { title: text("toolsOk", {}, "No tools left on") };
        case "tool.clipping": return { title: text("clipping", {}, "Section planes cut the model"), detail: text("toolDetail", {}, "They would show in the renders."), fixLabel: t("prepare.fix.clipping", "Remove the sections") };
        case "tool.measurements": return { title: text("measurements", {}, "Measurements are on the model"), detail: text("toolDetail", {}, "They would show in the renders."), fixLabel: t("prepare.fix.measurements", "Clear them") };
        case "tool.faces": return { title: text("faces", {}, "Faces are picked"), detail: text("toolDetail", {}, "They would show in the renders."), fixLabel: t("prepare.fix.faces", "Clear the picking") };
        case "tool.transform": return { title: text("transform", {}, "The move / turn handles are shown"), detail: text("toolDetail", {}, "They would show in the renders."), fixLabel: t("prepare.fix.hide", "Hide them") };
        case "tool.lightTransform": return { title: text("lightTransform", {}, "The light's handles are shown"), detail: text("toolDetail", {}, "They would show in the renders."), fixLabel: t("prepare.fix.hide", "Hide them") };
        case "tool.wireframe": return { title: text("wireframe", {}, "Wireframe is on"), detail: text("toolDetail", {}, "They would show in the renders."), fixLabel: t("prepare.fix.off", "Turn off") };
        case "tool.certainty": return { title: text("certainty", {}, "The Level of Certainty colours are on"), detail: text("toolDetail", {}, "They would show in the renders."), fixLabel: t("prepare.fix.off", "Turn off") };
        case "tool.selection": return { title: text("selection", {}, "Parts are highlighted"), detail: text("toolDetail", {}, "They would show in the renders."), fixLabel: t("prepare.fix.clearSelection", "Clear the highlight") };
        case "tool.shading": return { title: text("shading", { mode: shadingModeLabel(v.mode) }, "Shading: {mode}"), detail: text("shadingDetail", {}, "The renders show this mode, not the materials."), fixLabel: t("prepare.fix.shading", "Original materials") };
        case "tool.weather": return { title: text("weather", { type: t(`weather.${v.type}`, v.type) }, "Weather: {type}"), detail: text("weatherDetail", {}, "It would be in the renders; fine if meant so."), fixLabel: t("prepare.fix.off", "Turn off") };
        case "quality": return { title: text("quality", { quality: t(`performance.quality.${v.quality}`, v.quality) }, "Render quality lowered: {quality}"), detail: text("qualityDetail", {}, "The renders would be at a lower resolution, without some effects."), fixLabel: t("prepare.fix.quality", "Full quality") };
        case "units": return {
          title: text(v.state === "large" ? "unitsLarge" : "unitsSmall", { size: Viewer.formatSceneMeters?.(v.meters) ?? `${v.meters} m` }, "Is the unit right? The model measures {size}"),
          detail: text("unitsDetail", {}, "The file does not say its unit: set it in the measurement menu, the sizes and the sun depend on it."),
        };
        case "materials.black": return { title: text("black", {}, "Black materials"), detail: names(v.names), fixLabel: t("prepare.fix.materials", "Open the materials") };
        case "materials.suggested": return {
          title: text("suggested", { count: v.count }, "Material types from the names: {count}"),
          detail: text("suggestedDetail", {}, "Names like “glass” or “wood” on materials still as loaded: their types in one click (Look > Materials undoes it)."),
          fixLabel: t("prepare.fix.suggested", "Apply the types"),
        };
        case "materials.invisible": return { title: text("invisible", {}, "Invisible materials"), detail: names(v.names), fixLabel: t("prepare.fix.materials", "Open the materials") };
        case "heavy": return {
          title: text("heavy", {}, "Heavy for phones"),
          detail: text("heavyDetail", { triangles: (v.triangles / 1e6).toFixed(1), texture: v.texture || "–" }, "{triangles} M triangles, textures up to {texture} px: the worker's optimised copy loads faster."),
        };
        case "metadata": return { title: text("metadata", {}, "Metadata and rights"), detail: text("metadataDetail", {}, "The validation report checks the title, description and licence."), fixLabel: t("prepare.fix.metadata", "Validation report") };
        default: return { title: check.key };
      }
    },

    // ---- window ---------------------------------------------------------------------

    isPublishCheckPanelOpen() {
      return Boolean(Viewer.publishCheckPanel);
    },

    togglePublishCheckPanel(open = !Viewer.publishCheckPanel) {
      if (open) Viewer.createPublishCheckPanel();
      else Viewer.removePublishCheckPanel();
      Viewer.updateEditorToolbarState?.();
    },

    createPublishCheckPanel() {
      if (Viewer.publishCheckPanel) {
        Viewer.refreshPublishCheck();
        return;
      }
      if (!core.container || Viewer.urlOptions?.hideUi === true) return;
      hideSmartHint("publishGuard");
      const button = (className, onClick) => {
        const node = el("button", className);
        node.type = "button";
        node.addEventListener("click", onClick);
        return node;
      };
      const panel = el("section", "viewer-prepare viewer-scene");
      panel.id = "viewerPublishCheck";
      panel.setAttribute("role", "group");
      const header = el("div", "viewer-scene_header");
      const title = el("span", "viewer-scene_title");
      const closeButton = button("viewer-scene_icon", () => Viewer.togglePublishCheckPanel(false));
      closeButton.textContent = "×";
      header.append(title, closeButton);
      const intro = el("p", "viewer-scene_intro");
      const summary = el("div", "viewer-prepare_summary");
      const list = el("ul", "viewer-prepare_items");
      const actions = el("div", "viewer-scene_actions");
      const fixAllButton = button("viewer-scene_apply viewer-prepare_fix-all", () => {
        const fixed = Viewer.fixAllPublishChecks();
        Viewer.publishCheckPanel.status.textContent = t("prepare.fixed", { count: fixed }, "Fixed: {count}.");
      });
      const recheckButton = button("viewer-prepare_recheck", () => Viewer.refreshPublishCheck());
      actions.append(fixAllButton, recheckButton);
      const passed = el("details", "viewer-scene_basis viewer-prepare_passed");
      const passedSummary = el("summary");
      const passedList = el("ul");
      passed.append(passedSummary, passedList);
      const stepsTitle = el("div", "viewer-materials_heading");
      const steps = el("ol", "viewer-prepare_steps");
      const status = el("p", "viewer-scene_status");
      status.setAttribute("role", "status");
      panel.append(header, intro, summary, list, actions, passed, stepsTitle, steps, status);
      ["pointerdown", "pointerup", "wheel", "keydown"].forEach((type) => {
        panel.addEventListener(type, (event) => event.stopPropagation());
      });
      attachToolPanelChrome(panel, header, {
        before: closeButton,
        icon: PANEL_ICONS.prepare,
        label: () => t("prepare.title", "Prepare for publishing"),
      });
      getViewerSideStack()?.append(panel);
      fitPanelToViewer(panel);
      Viewer.publishCheckPanel = { panel, title, closeButton, intro, summary, list, fixAllButton, recheckButton, passed, passedSummary, passedList, stepsTitle, steps, status };
      Viewer.updatePublishCheckLabels();
    },

    removePublishCheckPanel() {
      Viewer.publishCheckPanel?.panel.remove();
      Viewer.publishCheckPanel = null;
    },

    updatePublishCheckLabels() {
      const ui = Viewer.publishCheckPanel;
      if (!ui) return;
      const name = t("prepare.title", "Prepare for publishing");
      ui.panel.setAttribute("aria-label", name);
      ui.title.textContent = name;
      refreshToolPanelChrome(ui.panel);
      ui.closeButton.title = t("scene.close", "Close");
      ui.closeButton.setAttribute("aria-label", ui.closeButton.title);
      ui.intro.textContent = t("prepare.intro", "Before the settings go to the repository and the renders are made: what would show in them and should not.");
      ui.recheckButton.textContent = t("prepare.recheck", "Check again");
      ui.stepsTitle.textContent = t("prepare.next", "Next");
      ui.status.textContent = "";
      Viewer.refreshPublishCheck();
    },

    // The checks again, after a change or a fix.
    refreshPublishCheck() {
      if (!Viewer.publishCheckPanel) return;
      Viewer.computePublishChecks();
      Viewer.syncPublishCheckPanel();
      Viewer.schedulePublishBadge();
    },

    syncPublishCheckPanel() {
      const ui = Viewer.publishCheckPanel;
      if (!ui) return;
      const checks = Viewer.publishCheck.checks;
      const open = checks.filter((check) => check.level !== "ok");
      const ok = checks.filter((check) => check.level === "ok");
      const fixes = checks.filter((check) => check.level === "fix");
      const tips = checks.filter((check) => check.level === "tip");
      const waiting = checks.some((check) => check.level === "wait");
      ui.summary.dataset.state = waiting ? "wait" : fixes.length ? "fix" : "ready";
      ui.summary.textContent = waiting
        ? t("prepare.summary.wait", "Waiting for the model…")
        : fixes.length
          ? t("prepare.summary.fix", { fixes: fixes.length, tips: tips.length }, "To fix: {fixes} · tips: {tips}")
          : t("prepare.summary.ready", { tips: tips.length }, "Ready to publish · tips: {tips}");
      ui.list.replaceChildren(...open.map((check) => {
        const words = Viewer.describePublishCheck(check);
        const row = el("li", "viewer-prepare_item");
        row.dataset.check = check.key;
        row.dataset.level = check.level;
        const mark = el("span", "viewer-prepare_mark", check.level === "fix" ? "!" : check.level === "wait" ? "…" : "i");
        mark.setAttribute("aria-hidden", "true");
        const text = el("div", "viewer-prepare_text");
        text.append(el("strong", null, words.title));
        if (words.detail) text.append(el("span", null, words.detail));
        row.append(mark, text);
        if (words.fixLabel && Viewer.canFixPublishCheck(check)) {
          const fix = el("button", "viewer-prepare_fix", words.fixLabel);
          fix.type = "button";
          fix.addEventListener("click", () => {
            Viewer.fixPublishCheck(check);
            Viewer.refreshPublishCheck();
          });
          row.append(fix);
        }
        return row;
      }));
      const fixable = fixes.filter((check) => Viewer.canFixPublishCheck(check)).length;
      ui.fixAllButton.textContent = t("prepare.fixAll", { count: fixable }, "Fix all ({count})");
      ui.fixAllButton.disabled = fixable === 0;
      ui.passed.hidden = ok.length === 0;
      ui.passedSummary.textContent = t("prepare.passed", { count: ok.length }, "Passed: {count}");
      ui.passedList.replaceChildren(...ok.map((check) => el("li", null, Viewer.describePublishCheck(check).title)));
      Viewer.syncPublishSteps();
    },

    // Save the settings, then the renders - where the viewer offers them.
    syncPublishSteps() {
      const ui = Viewer.publishCheckPanel;
      if (!ui) return;
      const buttons = Viewer.editorToolbarButtons || {};
      const steps = [];
      if (buttons.save) {
        const saveState = Viewer.getPublishSaveState();
        const time = Viewer.publishCheck.savedAt?.toLocaleTimeString?.([], { hour: "2-digit", minute: "2-digit" }) || "";
        steps.push({
          key: "save",
          label: t("prepare.step.save", "Save the settings"),
          state: saveState,
          note: saveState === "saved" ? t("prepare.step.saved", { time }, "Saved at {time}")
            : saveState === "changed" ? t("prepare.step.changed", "Changed since saving")
              : t("prepare.step.unsaved", "Not saved in this session"),
          action: t("gui.saveSettings", "Save settings"),
        });
      }
      // The renders only for who may change them (editor/thumbnail-capture.js).
      if (buttons.generateThumbnails && !buttons.generateThumbnails.disabled) {
        steps.push({ key: "thumbnails", label: t("prepare.step.thumbnails", "Make the renders"), note: t("prepare.step.thumbnailsNote", "Nine views from the model as shown now"), action: t("gui.generateThumbnails", "Generate thumbnails") });
      } else if (buttons.preview && !buttons.preview.disabled) {
        steps.push({ key: "preview", label: t("prepare.step.preview", "Make the main thumbnail"), note: t("prepare.step.previewNote", "From the current view"), action: t("gui.renderPreview", "Change main thumbnail") });
      }
      ui.stepsTitle.hidden = steps.length === 0;
      ui.steps.hidden = steps.length === 0;
      ui.steps.replaceChildren(...steps.map((step) => {
        const row = document.createElement("li");
        row.className = "viewer-prepare_step";
        row.dataset.step = step.key;
        if (step.state) row.dataset.state = step.state;
        const text = document.createElement("div");
        text.className = "viewer-prepare_text";
        const label = document.createElement("strong");
        label.textContent = step.label;
        const note = document.createElement("span");
        note.textContent = step.note;
        text.append(label, note);
        if (step.key === "thumbnails") {
          const front = el("label", "viewer-prepare_front");
          const input = el("input");
          input.type = "checkbox";
          input.checked = Viewer.publishCheck.frontFromView;
          input.addEventListener("change", () => Viewer.setThumbnailFrontFromView(input.checked));
          const angle = Viewer.getThumbnailFrontAngle();
          const words = Viewer.publishCheck.startViewChosen
            ? t("prepare.step.front", { angle }, "Front: the side the start view looks from ({angle}°)")
            : t("prepare.step.frontNone", "Front: the side the start view looks from (none saved yet: the file's front)");
          front.append(input, el("span", null, words));
          text.append(front);
        }
        const action = document.createElement("button");
        action.type = "button";
        action.className = "viewer-prepare_fix";
        action.textContent = step.action;
        action.addEventListener("click", async () => {
          await Viewer.runPublishStep(step.key);
          Viewer.syncPublishSteps();
        });
        row.append(text, action);
        return row;
      }));
    },

    // Before a new model: what was checked and saved was the old one's.
    disposePublishCheck() {
      const state = Viewer.publishCheck;
      clearTimeout(state.hintTimer);
      state.acknowledged.clear();
      state.savedSignature = null;
      state.savedAt = null;
      state.checks = [];
      state.baseCache = null;
      state.startViewChosen = false;
      hideSmartHint("orientation");
      hideSmartHint("publishGuard");
      if (Viewer.publishCheckPanel) Viewer.syncPublishCheckPanel();
    },
  });
}
