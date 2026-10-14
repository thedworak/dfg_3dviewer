import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import THREE from "../init.js";
import { USDZExporter } from "three/examples/jsm/exporters/USDZExporter.js";
import { getViewerSideStack } from "../ui/side-stack.js";
import { toastHelper } from "../viewer-utils.js";

// The model in a headset or on a phone, from the browser (WebXR):
//
// - VR (immersive-vr) puts the viewer where the camera stood, on the model's
//   ground, at real size (the model unit, see getDistanceMeasurementScaleMeters).
//   A controller's trigger teleports to the spot on the ground it points at.
// - AR (immersive-ar) shows the model in the room, in front of the viewer, at
//   real size or fitted to a table (TABLE_SIZE metres), without the background
//   and the grid.
// - AR Quick Look (iPhone, iPad) has no WebXR: the model is exported to USDZ,
//   in metres, and handed to the system viewer.
//
// The XR camera's pose is relative to its parent, so the camera is put in a
// "rig" group for the session: the rig's position and scale (scene units per
// metre) place the viewer in the scene. The session drives the render loop
// (renderer.setAnimationLoop); Viewer.animate stops asking the window for
// frames while it runs, and post-processing and the comparison view step
// aside (rendering.js, compare.js).

const XR_MODES = ["vr", "ar"];
const SESSION_TYPES = { vr: "immersive-vr", ar: "immersive-ar" };
// Size (metres) of the model's largest side on a table in AR.
const TABLE_SIZE = 0.6;
// In AR the model stands this far (metres) in front of the viewer.
const AR_DISTANCE = 1.2;
// Eye height (metres) added when the browser has no floor-level space.
const EYE_HEIGHT = 1.6;
const RAY_LENGTH = 5;
// Depth range (metres) while presenting.
const XR_NEAR = 0.02;
const XR_FAR = 5000;

function getModelRoots() {
  return (core.mainObject || []).filter((object) => object?.isObject3D);
}

function getModelBox() {
  const box = new THREE.Box3();
  getModelRoots().forEach((object) => box.expandByObject(object));
  return box;
}

export function attachWebXR(Viewer) {
  Object.assign(Viewer, {
    xr: {
      support: { vr: false, ar: false, quickLook: false },
      checked: false,
      // "real" or "table" (AR only; VR is always real size).
      arScale: "table",
      session: null,
      mode: null,
      saved: null,
      rig: null,
      controllers: [],
    },

    // Asks the browser which immersive modes it offers; the toolbar button
    // shows once one is there.
    async checkXRSupport() {
      const state = Viewer.xr;
      const xr = navigator.xr;
      const ask = async (type) => {
        try {
          return xr?.isSessionSupported ? (await xr.isSessionSupported(type)) === true : false;
        } catch {
          return false;
        }
      };
      const [vr, ar] = await Promise.all([ask(SESSION_TYPES.vr), ask(SESSION_TYPES.ar)]);
      let quickLook = false;
      try {
        quickLook = document.createElement("a").relList?.supports?.("ar") === true;
      } catch {
        quickLook = false;
      }
      state.support = { vr, ar, quickLook };
      state.checked = true;
      Viewer.syncXRPanel();
      Viewer.updateEditorToolbarState?.();
      return { ...state.support };
    },

    isXRAvailable() {
      const { vr, ar, quickLook } = Viewer.xr.support;
      return vr || ar || quickLook;
    },

    isXRPresenting() {
      return Viewer.xr.session != null;
    },

    getXRMode() {
      return Viewer.xr.mode;
    },

    setXRArScale(value) {
      Viewer.xr.arScale = value === "real" ? "real" : "table";
      Viewer.syncXRPanel();
      if (Viewer.xr.mode === "ar") Viewer.placeXRRig();
    },

    // Where the viewer stands for `mode`: the rig's position on the ground,
    // its turn about the vertical (facing the model) and its scale in scene
    // units per metre.
    getXRPlacement(mode = "vr", { floorLevel = true } = {}) {
      const box = getModelBox();
      const center = box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3());
      const size = box.isEmpty() ? new THREE.Vector3(1, 1, 1) : box.getSize(new THREE.Vector3());
      const ground = box.isEmpty() ? 0 : box.min.y;
      const metersPerUnit = Viewer.getDistanceMeasurementScaleMeters?.() || 1;
      let scale = 1 / metersPerUnit;
      if (mode === "ar" && Viewer.xr.arScale !== "real") {
        const largest = Math.max(size.x, size.y, size.z) || 1;
        scale = largest / TABLE_SIZE;
      }

      // Look at the model from the side the camera looks at it from.
      const from = core.camera?.position?.clone() ?? new THREE.Vector3(0, 0, 1);
      const away = new THREE.Vector3(from.x - center.x, 0, from.z - center.z);
      if (away.lengthSq() < 1e-9) away.set(0, 0, 1);
      away.normalize();
      let distance;
      if (mode === "ar") {
        // The model's near side AR_DISTANCE in front of the viewer.
        distance = AR_DISTANCE * scale + Math.max(size.x, size.z) / 2;
      } else {
        const horizontal = Math.hypot(from.x - center.x, from.z - center.z);
        distance = Math.max(horizontal, Math.max(size.x, size.z) / 2 + 1 * scale);
      }
      const position = new THREE.Vector3(
        center.x + away.x * distance,
        ground + (floorLevel ? 0 : -EYE_HEIGHT * scale),
        center.z + away.z * distance,
      );
      return {
        position,
        rotationY: Math.atan2(away.x, away.z),
        scale,
        ground,
      };
    },

    placeXRRig() {
      const state = Viewer.xr;
      if (!state.rig || !state.mode) return;
      const placement = Viewer.getXRPlacement(state.mode, { floorLevel: state.floorLevel !== false });
      state.rig.position.copy(placement.position);
      state.rig.rotation.set(0, placement.rotationY, 0);
      state.rig.scale.setScalar(placement.scale);
      state.ground = placement.ground;
      state.rig.updateMatrixWorld(true);
    },

    async startXR(mode = "vr") {
      const state = Viewer.xr;
      if (!XR_MODES.includes(mode)) return false;
      if (state.session || state.starting) return false;
      const renderer = core.renderer;
      if (!navigator.xr?.requestSession || !renderer?.xr) {
        toastHelper("xrUnavailable");
        return false;
      }
      state.starting = true;
      Viewer.syncXRPanel();
      const overlay = mode === "ar" ? Viewer.getXROverlay() : null;
      const options = mode === "ar"
        ? {
          optionalFeatures: ["local-floor", "dom-overlay"],
          ...(overlay ? { domOverlay: { root: overlay } } : {}),
        }
        : { optionalFeatures: ["local-floor", "bounded-floor", "hand-tracking"] };
      let session;
      try {
        session = await navigator.xr.requestSession(SESSION_TYPES[mode], options);
      } catch (error) {
        state.starting = false;
        Viewer.syncXRPanel();
        console.warn("WebXR session refused", error);
        toastHelper("xrFailed");
        return false;
      }
      try {
        await Viewer.enterXRSession(session, mode);
      } catch (error) {
        console.warn("WebXR session failed", error);
        state.starting = false;
        try { await session.end(); } catch { /* already over */ }
        Viewer.leaveXRSession();
        toastHelper("xrFailed");
        return false;
      }
      state.starting = false;
      Viewer.syncXRPanel();
      return true;
    },

    async enterXRSession(session, mode) {
      const state = Viewer.xr;
      const renderer = core.renderer;
      // The comparison and a photo over the canvas have no place in a headset.
      Viewer.closeCompare?.();
      Viewer.closePhoto?.();

      const camera = core.camera;
      state.saved = {
        camera,
        parent: camera.parent,
        position: camera.position.clone(),
        quaternion: camera.quaternion.clone(),
        scale: camera.scale.clone(),
        near: camera.near,
        far: camera.far,
        target: core.controls?.target?.clone(),
        controlsEnabled: core.controls?.enabled,
        background: core.scene.background,
        gridVisible: core.basicGrid?.visible,
      };
      state.mode = mode;
      state.session = session;

      const floorLevel = !Array.isArray(session.enabledFeatures) || session.enabledFeatures.includes("local-floor");
      state.floorLevel = floorLevel;
      renderer.xr.enabled = true;
      renderer.xr.setReferenceSpaceType(floorLevel ? "local-floor" : "local");

      const rig = new THREE.Group();
      rig.name = "xr-rig";
      rig.userData.isXRRig = true;
      core.scene.add(rig);
      rig.add(camera);
      camera.position.set(0, 0, 0);
      camera.quaternion.identity();
      camera.scale.set(1, 1, 1);
      // The rig's scale turns the view into metres, so the depth range is
      // in metres too.
      camera.near = XR_NEAR;
      camera.far = XR_FAR;
      camera.updateProjectionMatrix?.();
      state.rig = rig;
      Viewer.placeXRRig();
      if (core.controls) core.controls.enabled = false;

      if (mode === "ar") {
        if (state.overlay) state.overlay.hidden = false;
        core.scene.background = null;
        if (core.basicGrid) core.basicGrid.visible = false;
      }
      Viewer.addXRControllers();

      state.onEnd = () => Viewer.leaveXRSession();
      session.addEventListener("end", state.onEnd);
      await renderer.xr.setSession(session);
      // The session gives the frames from now on (see Viewer.animate).
      renderer.setAnimationLoop((time) => Viewer.animate(time));
      Viewer.syncXRPanel();
      Viewer.updateEditorToolbarState?.();
    },

    addXRControllers() {
      const state = Viewer.xr;
      const renderer = core.renderer;
      if (!state.rig || !renderer?.xr?.getController) return;
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -1),
      ]);
      for (let index = 0; index < 2; index += 1) {
        const controller = renderer.xr.getController(index);
        if (!controller) continue;
        const ray = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xe9b264 }));
        ray.name = "xr-ray";
        ray.scale.z = RAY_LENGTH;
        ray.visible = state.mode === "vr";
        controller.add(ray);
        const onSelect = () => Viewer.teleportXR(controller);
        controller.addEventListener("selectend", onSelect);
        state.rig.add(controller);
        state.controllers.push({ controller, ray, onSelect });
      }
    },

    // Moves the viewer to where the controller's ray meets the ground (VR).
    teleportXR(controller) {
      const state = Viewer.xr;
      if (state.mode !== "vr" || !state.rig || !controller) return false;
      controller.updateMatrixWorld(true);
      const origin = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);
      const direction = new THREE.Vector3(0, 0, -1)
        .transformDirection(controller.matrixWorld);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(state.ground ?? 0));
      const hit = new THREE.Ray(origin, direction).intersectPlane(plane, new THREE.Vector3());
      if (!hit) return false;
      state.rig.position.x = hit.x;
      state.rig.position.z = hit.z;
      state.rig.updateMatrixWorld(true);
      return true;
    },

    async stopXR() {
      const session = Viewer.xr.session;
      if (!session) return;
      try {
        await session.end();
      } catch {
        Viewer.leaveXRSession();
      }
    },

    // Puts back the camera, the controls, the background and the window's
    // render loop once the session is over.
    leaveXRSession() {
      const state = Viewer.xr;
      const renderer = core.renderer;
      if (state.session && state.onEnd) state.session.removeEventListener?.("end", state.onEnd);
      const wasPresenting = state.session != null;
      state.session = null;
      state.mode = null;
      state.onEnd = null;

      state.controllers.forEach(({ controller, ray, onSelect }) => {
        controller.removeEventListener("selectend", onSelect);
        controller.remove(ray);
        controller.parent?.remove(controller);
      });
      if (state.controllers.length) {
        state.controllers[0].ray.geometry.dispose();
        state.controllers.forEach(({ ray }) => ray.material.dispose());
      }
      state.controllers = [];

      const saved = state.saved;
      if (saved) {
        const camera = saved.camera;
        state.rig?.remove(camera);
        if (saved.parent) saved.parent.add(camera);
        camera.position.copy(saved.position);
        camera.quaternion.copy(saved.quaternion);
        camera.scale.copy(saved.scale);
        camera.near = saved.near;
        camera.far = saved.far;
        camera.updateProjectionMatrix?.();
        camera.updateMatrixWorld(true);
        if (saved.target && core.controls?.target) core.controls.target.copy(saved.target);
        if (core.controls) core.controls.enabled = saved.controlsEnabled !== false;
        if (core.scene) core.scene.background = saved.background;
        if (core.basicGrid && saved.gridVisible != null) core.basicGrid.visible = saved.gridVisible;
        state.saved = null;
      }
      state.rig?.parent?.remove(state.rig);
      state.rig = null;
      if (state.overlay) state.overlay.hidden = true;

      if (renderer?.xr) {
        renderer.setAnimationLoop(null);
        renderer.xr.enabled = false;
      }
      if (wasPresenting) {
        core.controls?.update();
        requestAnimationFrame(Viewer.animate);
      }
      Viewer.syncXRPanel();
      Viewer.updateEditorToolbarState?.();
    },

    // ---- AR Quick Look (iOS) ----------------------------------------------

    // The models as USDZ, in metres (the format's unit), from the current
    // look of the scene. Resolves to a Blob.
    async exportUSDZ() {
      const roots = getModelRoots();
      if (!roots.length) return null;
      const metersPerUnit = Viewer.getDistanceMeasurementScaleMeters?.() || 1;
      const group = new THREE.Group();
      group.scale.setScalar(metersPerUnit);
      roots.forEach((root) => {
        root.updateMatrixWorld(true);
        const copy = root.clone();
        root.matrixWorld.decompose(copy.position, copy.quaternion, copy.scale);
        group.add(copy);
      });
      // Stand the model on the floor, centred.
      const box = new THREE.Box3().setFromObject(group);
      if (!box.isEmpty()) {
        const center = box.getCenter(new THREE.Vector3());
        group.position.set(-center.x, -box.min.y, -center.z);
      }
      const exporter = new USDZExporter();
      const data = await exporter.parseAsync(group, { quickLookCompatible: true });
      return new Blob([data], { type: "model/vnd.usdz+zip" });
    },

    async openQuickLook() {
      const state = Viewer.xr;
      if (state.exporting) return false;
      state.exporting = true;
      Viewer.syncXRPanel();
      try {
        const blob = await Viewer.exportUSDZ();
        if (!blob) throw new Error("No model to export");
        if (state.quickLookUrl) URL.revokeObjectURL(state.quickLookUrl);
        state.quickLookUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.rel = "ar";
        link.href = state.quickLookUrl;
        link.download = `${(core.fileObject?.filename || "model").replace(/\.[^.]+$/, "")}.usdz`;
        // Quick Look opens only from a link holding an image.
        link.appendChild(document.createElement("img"));
        link.click();
        return true;
      } catch (error) {
        console.warn("USDZ export failed", error);
        toastHelper("xrFailed");
        return false;
      } finally {
        state.exporting = false;
        Viewer.syncXRPanel();
      }
    },

    // ---- panel ----------------------------------------------------------------

    toggleXRPanel(open) {
      const show = open ?? !Viewer.xrPanel;
      if (show) Viewer.createXRPanel();
      else Viewer.removeXRPanel();
      Viewer.updateEditorToolbarState?.();
    },

    isXRPanelOpen() {
      return Viewer.xrPanel != null;
    },

    createXRPanel() {
      if (Viewer.xrPanel || !core.container) return;
      const el = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
      };
      const panel = el("section", "viewer-xr");
      panel.id = "viewerXR";
      panel.setAttribute("role", "group");
      const header = el("div", "viewer-xr_header");
      const title = el("span", "viewer-xr_title");
      const closeButton = el("button", "viewer-xr_icon", "×");
      closeButton.type = "button";
      header.append(title, closeButton);

      const actions = el("div", "viewer-xr_actions");
      const button = (key) => {
        const node = el("button", "viewer-xr_button");
        node.type = "button";
        node.dataset.xr = key;
        actions.append(node);
        return node;
      };
      const vrButton = button("vr");
      const arButton = button("ar");
      const quickLookButton = button("quickLook");

      const scaleRow = el("div", "viewer-xr_scale");
      const scaleText = el("span");
      const scaleOption = (value) => {
        const label = el("label", "viewer-xr_check");
        const input = el("input");
        input.type = "radio";
        input.name = "viewer-xr-scale";
        input.value = value;
        const text = el("span");
        label.append(input, text);
        scaleRow.append(label);
        input.addEventListener("change", () => input.checked && Viewer.setXRArScale(value));
        return { input, text };
      };
      scaleRow.append(scaleText);
      const tableScale = scaleOption("table");
      const realScale = scaleOption("real");
      const note = el("p", "viewer-xr_note");
      panel.append(header, actions, scaleRow, note);

      ["pointerdown", "pointerup", "wheel", "keydown"].forEach((type) => {
        panel.addEventListener(type, (event) => event.stopPropagation());
      });
      closeButton.addEventListener("click", () => Viewer.toggleXRPanel(false));
      vrButton.addEventListener("click", () => (Viewer.xr.mode === "vr" ? Viewer.stopXR() : Viewer.startXR("vr")));
      arButton.addEventListener("click", () => (Viewer.xr.mode === "ar" ? Viewer.stopXR() : Viewer.startXR("ar")));
      quickLookButton.addEventListener("click", () => Viewer.openQuickLook());

      getViewerSideStack()?.append(panel);
      Viewer.xrPanel = {
        panel, title, closeButton, vrButton, arButton, quickLookButton, scaleRow, scaleText,
        tableScale, realScale, note,
      };
      Viewer.updateXRLabels();
      if (!Viewer.xr.checked) Viewer.checkXRSupport();
    },

    removeXRPanel() {
      Viewer.xrPanel?.panel.remove();
      Viewer.xrPanel = null;
    },

    // Shown over the camera image in AR (dom-overlay), to leave it.
    getXROverlay() {
      const state = Viewer.xr;
      if (!state.overlay && core.container) {
        const overlay = document.createElement("div");
        overlay.className = "viewer-xr_overlay";
        overlay.hidden = true;
        const exitButton = document.createElement("button");
        exitButton.type = "button";
        exitButton.className = "viewer-xr_exit";
        exitButton.addEventListener("click", () => Viewer.stopXR());
        overlay.append(exitButton);
        core.container.append(overlay);
        state.overlay = overlay;
        state.exitButton = exitButton;
      }
      if (state.exitButton) state.exitButton.textContent = t("xr.exitAr", "Exit AR");
      return state.overlay;
    },

    updateXRLabels() {
      const ui = Viewer.xrPanel;
      if (!ui) return;
      ui.panel.setAttribute("aria-label", t("xr.title", "VR and AR"));
      ui.title.textContent = t("xr.title", "VR and AR");
      ui.closeButton.title = t("xr.close", "Close");
      ui.closeButton.setAttribute("aria-label", t("xr.close", "Close"));
      ui.scaleText.textContent = t("xr.arScale", "Size in AR");
      ui.tableScale.text.textContent = t("xr.scaleTable", "On a table");
      ui.realScale.text.textContent = t("xr.scaleReal", "Real size");
      if (Viewer.xr.exitButton) Viewer.xr.exitButton.textContent = t("xr.exitAr", "Exit AR");
      Viewer.syncXRPanel();
    },

    syncXRPanel() {
      const ui = Viewer.xrPanel;
      if (!ui) return;
      const state = Viewer.xr;
      const { vr, ar, quickLook } = state.support;
      const busy = state.starting === true;
      ui.vrButton.hidden = !vr;
      ui.arButton.hidden = !ar;
      ui.quickLookButton.hidden = !quickLook;
      ui.vrButton.disabled = busy || state.mode === "ar";
      ui.arButton.disabled = busy || state.mode === "vr";
      ui.quickLookButton.disabled = state.exporting === true;
      ui.vrButton.textContent = state.mode === "vr" ? t("xr.exitVr", "Exit VR") : t("xr.enterVr", "View in VR");
      ui.arButton.textContent = state.mode === "ar" ? t("xr.exitAr", "Exit AR") : t("xr.enterAr", "View in AR");
      ui.quickLookButton.textContent = state.exporting
        ? t("xr.preparing", "Preparing the model…")
        : t("xr.quickLook", "Open in AR Quick Look");
      ui.vrButton.classList.toggle("is-active", state.mode === "vr");
      ui.arButton.classList.toggle("is-active", state.mode === "ar");
      ui.scaleRow.hidden = !ar;
      ui.tableScale.input.checked = state.arScale !== "real";
      ui.realScale.input.checked = state.arScale === "real";
      let note;
      if (!state.checked) note = t("xr.checking", "Checking what this device offers…");
      else if (!vr && !ar && !quickLook) note = t("xr.unsupported", "This browser offers neither VR nor AR. Open the viewer in a headset's browser, or on a phone.");
      else if (state.mode === "vr") note = t("xr.vrHint", "Point a controller at the ground and pull the trigger to move there.");
      else note = t("xr.hint", "The model is shown at real size in VR; in AR on a table or at real size.");
      ui.note.textContent = note;
    },

    disposeXR() {
      if (Viewer.xr.session) Viewer.stopXR();
      if (Viewer.xr.quickLookUrl) {
        URL.revokeObjectURL(Viewer.xr.quickLookUrl);
        Viewer.xr.quickLookUrl = null;
      }
    },
  });
}
