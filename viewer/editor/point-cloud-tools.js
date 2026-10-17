import THREE from "../init.js";
import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { toastHelper } from "../viewer-utils.js";
import { getTiledModelBox } from "../tiles.js";
import { CLASSIFICATION_COLORS } from "../pointcloud-material.js";
import { remoteAssetUrl } from "../remote.js";

// Point cloud tools in the point cloud panel (point-cloud-panel.js):
//
//   classes   a check box per ASPRS class present in the cloud: hidden
//             classes drop out of the view, the Eye-Dome Lighting and GPU
//             picking (uClassHiddenMask, pointcloud-material.js)
//   profile   two clicks on the cloud draw a line; only a vertical slab of
//             points along it stays (width adjustable), seen from the side
//             with an orthographic camera - a cross-section to measure on
//
// Both work through the shader uniforms of the cloud: one set for a streamed
// cloud (all its tiles), one per THREE.Points for a directly loaded one.

const CLASS_SLOTS = 32;
const UP = new THREE.Vector3(0, 1, 0);
const PROFILE_COLOR = 0xff3b30;

function colorSwatch(classId) {
  const hex = CLASSIFICATION_COLORS[classId] ?? 0xeeeeee;
  return `#${hex.toString(16).padStart(6, "0")}`;
}

// tiles/<name>/metadata.json (or tileset.json) -> tiles/<name>.classification.json,
// which the worker writes when it classified the points itself
// (worker/classify.py); null for other URLs.
export function classificationInfoUrl(modelUrl) {
  const match = String(modelUrl || "").match(/^(.*\/tiles\/[^/?#]+)\/(?:metadata|tileset)\.json(?:[?#].*)?$/);
  return match ? `${match[1]}.classification.json` : null;
}

export function attachPointCloudTools(Viewer) {
  Object.assign(Viewer, {
    // The colour/filter uniform sets of the current cloud.
    getPointCloudUniformSets() {
      const state = Viewer.pointCloudState;
      if (!state) return [];
      if (state.kind === "tiles") return [state.colorUniforms];
      return state.points.map((object) => object.material?.userData?.colorModes).filter(Boolean);
    },

    // ---- Classes ---------------------------------------------------------

    // Classes of a direct cloud with their point counts.
    countPointClasses(points) {
      const counts = new Map();
      points.forEach((object) => {
        const attribute = object.geometry.getAttribute("classification");
        if (!attribute) return;
        const values = attribute.array;
        const local = new Uint32Array(256);
        for (let i = 0; i < attribute.count; i += 1) local[values[i] & 255] += 1;
        local.forEach((count, classId) => {
          if (count) counts.set(classId, (counts.get(classId) || 0) + count);
        });
      });
      return counts;
    },

    // Streamed clouds: classes become known as tiles load.
    notePointClassesOfTile(scene) {
      const state = Viewer.pointCloudState;
      if (!state || state.kind !== "tiles") return;
      let added = false;
      scene.traverse((child) => {
        const attribute = child.isPoints ? child.geometry.getAttribute("classification") : null;
        if (!attribute) return;
        const values = attribute.array;
        for (let i = 0; i < attribute.count; i += 1) {
          if (!state.classes.has(values[i])) {
            state.classes.set(values[i], 0);
            added = true;
          }
        }
      });
      if (added) Viewer.renderPointCloudClassList();
    },

    setPointCloudClassVisible(classId, visible) {
      const state = Viewer.pointCloudState;
      if (!state) return;
      if (visible) state.hiddenClasses.delete(classId);
      else state.hiddenClasses.add(classId);
      Viewer.applyPointCloudClassVisibility();
      Viewer.renderPointCloudClassList();
    },

    applyPointCloudClassVisibility() {
      const state = Viewer.pointCloudState;
      if (!state) return;
      const hiddenOther = [...state.hiddenClasses].some((classId) => classId >= CLASS_SLOTS);
      Viewer.getPointCloudUniformSets().forEach((uniforms) => {
        let mask = 0;
        state.hiddenClasses.forEach((classId) => {
          if (classId < CLASS_SLOTS) mask |= 1 << classId;
        });
        // Unsigned: class 31 sets the sign bit of a JS integer.
        uniforms.uClassHiddenMask.value = mask >>> 0;
        uniforms.uOtherClassVisible.value = hiddenOther ? 0 : 1;
      });
    },

    // ---- Profile ---------------------------------------------------------

    isPointCloudProfilePicking() {
      return Array.isArray(Viewer.pointCloudState?.profilePicking);
    },

    startPointCloudProfile() {
      const state = Viewer.pointCloudState;
      if (!state) return;
      Viewer.clearPointCloudProfile({ keepProjection: true });
      state.profilePicking = [];
      // Clicks go to the profile, not to the ruler or annotations.
      Viewer.RULER_MODE = false;
      Viewer.pickingMode = false;
      Viewer.updateDistanceMeasurementControllerLabel?.();
      Viewer.updatePickingModeControllerLabel?.();
      toastHelper("profileStart", "info");
      Viewer.syncPointCloudPanel();
    },

    cancelPointCloudProfile() {
      const state = Viewer.pointCloudState;
      if (!state) return;
      state.profilePicking = null;
      Viewer.syncPointCloudPanel();
    },

    addPointCloudProfilePoint(point) {
      const state = Viewer.pointCloudState;
      if (!state?.profilePicking) return;
      state.profilePicking.push(point.clone());
      if (state.profilePicking.length === 1) {
        toastHelper("profileSecond", "info");
        return;
      }
      const [a, b] = state.profilePicking;
      state.profilePicking = null;
      Viewer.setPointCloudProfile(a, b);
    },

    getPointCloudBox() {
      const state = Viewer.pointCloudState;
      if (!state) return null;
      if (state.kind === "tiles") return getTiledModelBox();
      const box = new THREE.Box3();
      state.points.forEach((object) => box.union(new THREE.Box3().setFromObject(object)));
      return box.isEmpty() ? null : box;
    },

    // A profile along a -> b (world space): a vertical slab, its width
    // across the line; points outside are hidden.
    setPointCloudProfile(a, b, { width = null, view = true } = {}) {
      const state = Viewer.pointCloudState;
      if (!state) return false;
      const direction = b.clone().sub(a);
      direction.addScaledVector(UP, -direction.dot(UP));
      if (direction.lengthSq() < 1e-12) {
        toastHelper("profileTooShort", "warning");
        return false;
      }
      direction.normalize();
      const normal = new THREE.Vector3().crossVectors(UP, direction).normalize();
      const box = Viewer.getPointCloudBox();
      const diagonal = box ? box.getSize(new THREE.Vector3()).length() : a.distanceTo(b);
      const spacing = state.points[0]?.userData?.pointSpacing || 0;
      const defaultWidth = Math.max(spacing * 4, diagonal * 0.004);
      state.profile = {
        a: a.clone(),
        b: b.clone(),
        normal,
        direction,
        diagonal,
        width: width ?? state.profile?.width ?? defaultWidth,
        projectionBefore: state.profile?.projectionBefore
          ?? (core.camera?.isOrthographicCamera ? "orthographic" : "perspective"),
      };
      Viewer.applyPointCloudProfile();
      Viewer.drawPointCloudProfileLine();
      if (view) Viewer.viewPointCloudProfile();
      Viewer.syncPointCloudPanel();
      return true;
    },

    applyPointCloudProfile() {
      const state = Viewer.pointCloudState;
      const profile = state?.profile;
      Viewer.getPointCloudUniformSets().forEach((uniforms) => {
        uniforms.uProfileEnabled.value = Boolean(profile);
        if (!profile) return;
        uniforms.uProfilePlane.value.set(profile.normal.x, profile.normal.y, profile.normal.z, profile.normal.dot(profile.a));
        uniforms.uProfileHalfWidth.value = profile.width / 2;
        uniforms.uProfileAxis.value.copy(profile.direction);
        const from = profile.direction.dot(profile.a);
        const to = profile.direction.dot(profile.b);
        uniforms.uProfileRange.value.set(Math.min(from, to), Math.max(from, to));
      });
    },

    setPointCloudProfileWidth(width) {
      const profile = Viewer.pointCloudState?.profile;
      if (!profile || !(width > 0)) return;
      profile.width = width;
      Viewer.applyPointCloudProfile();
      Viewer.syncPointCloudPanel();
    },

    // The profile line on the cloud (not pickable, drawn on top).
    drawPointCloudProfileLine() {
      const state = Viewer.pointCloudState;
      Viewer.removePointCloudProfileLine();
      if (!state?.profile || !core.scene) return;
      const geometry = new THREE.BufferGeometry().setFromPoints([state.profile.a, state.profile.b]);
      const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({
        color: PROFILE_COLOR,
        depthTest: false,
        transparent: true,
      }));
      line.name = "point-cloud-profile";
      line.renderOrder = 999;
      line.raycast = () => {};
      line.userData.isPointCloudProfile = true;
      core.scene.add(line);
      state.profileLine = line;
    },

    removePointCloudProfileLine() {
      const line = Viewer.pointCloudState?.profileLine;
      if (!line) return;
      line.removeFromParent();
      line.geometry.dispose();
      line.material.dispose();
      Viewer.pointCloudState.profileLine = null;
    },

    // Side view of the slab: orthographic, square to it, the line filling
    // the width of the view, from the side the camera was on.
    viewPointCloudProfile() {
      const profile = Viewer.pointCloudState?.profile;
      if (!profile || !core.camera || !core.controls) return;
      Viewer.setCameraProjection?.("orthographic");
      const box = Viewer.getPointCloudBox();
      const center = profile.a.clone().add(profile.b).multiplyScalar(0.5);
      if (box) center.y = (box.min.y + box.max.y) / 2;
      const side = core.camera.position.clone().sub(center).dot(profile.normal) < 0 ? -1 : 1;
      const camera = core.camera;
      camera.up.copy(UP);
      camera.position.copy(center).addScaledVector(profile.normal, side * Math.max(profile.diagonal, 1e-3));
      core.controls.target.copy(center);
      camera.lookAt(center);
      // The line's length across, the cloud's height up: whichever fills the view first.
      const length = Math.abs(profile.direction.dot(profile.b) - profile.direction.dot(profile.a));
      const height = box ? box.max.y - box.min.y : 0;
      const frustumWidth = camera.right - camera.left;
      const frustumHeight = camera.top - camera.bottom;
      if (camera.isOrthographicCamera && frustumWidth > 0 && frustumHeight > 0 && length > 0) {
        camera.zoom = Math.min(frustumWidth / (length * 1.15), height > 0 ? frustumHeight / (height * 1.15) : Infinity);
      }
      camera.updateProjectionMatrix();
      core.cameraLight?.position?.copy?.(camera.position);
      const distance = camera.position.distanceTo(center);
      if (core.controls.maxDistance < distance * 2) core.controls.maxDistance = distance * 2;
      core.controls.update();
    },

    clearPointCloudProfile({ keepProjection = false } = {}) {
      const state = Viewer.pointCloudState;
      if (!state) return;
      const profile = state.profile;
      state.profile = null;
      state.profilePicking = null;
      Viewer.applyPointCloudProfile();
      Viewer.removePointCloudProfileLine();
      if (profile && !keepProjection && profile.projectionBefore === "perspective") {
        Viewer.setCameraProjection?.("perspective");
      }
      Viewer.syncPointCloudPanel();
    },

    // ---- Panel rows --------------------------------------------------------

    // Profile and classes rows, added to the panel's body (createPointCloudPanel).
    buildPointCloudToolRows(body) {
      const state = Viewer.pointCloudState;
      const ui = {};

      ui.profileRow = document.createElement("div");
      ui.profileRow.className = "viewer-pointcloud-panel_row viewer-pointcloud-panel_profile";
      ui.profileLabel = document.createElement("span");
      ui.profileButton = document.createElement("button");
      ui.profileButton.type = "button";
      ui.profileButton.className = "viewer-pointcloud-panel_button";
      ui.profileButton.addEventListener("click", () => {
        if (Viewer.isPointCloudProfilePicking()) Viewer.cancelPointCloudProfile();
        else if (state.profile) Viewer.clearPointCloudProfile();
        else Viewer.startPointCloudProfile();
      });
      ui.profileRow.append(ui.profileLabel, ui.profileButton);
      body.appendChild(ui.profileRow);

      // Width: log scale from 1/2000 to 1/5 of the cloud's diagonal.
      ui.widthRow = document.createElement("label");
      ui.widthRow.className = "viewer-pointcloud-panel_row";
      ui.widthLabel = document.createElement("span");
      ui.width = document.createElement("input");
      ui.width.type = "range";
      ui.width.min = "0";
      ui.width.max = "100";
      ui.width.addEventListener("input", () => {
        const diagonal = state.profile?.diagonal;
        if (!diagonal) return;
        Viewer.setPointCloudProfileWidth((diagonal / 2000) * Math.pow(400, Number(ui.width.value) / 100));
      });
      ui.widthRow.append(ui.widthLabel, ui.width);
      body.appendChild(ui.widthRow);

      ui.classes = document.createElement("fieldset");
      ui.classes.className = "viewer-pointcloud-panel_classes";
      ui.classesLegend = document.createElement("legend");
      ui.classList = document.createElement("div");
      ui.classList.className = "viewer-pointcloud-panel_class-list";
      // Classes the worker assigned (not the scanner or a person).
      ui.classesNote = document.createElement("p");
      ui.classesNote.className = "viewer-pointcloud-panel_note";
      ui.classesNote.hidden = true;
      ui.classes.append(ui.classesLegend, ui.classList, ui.classesNote);
      body.appendChild(ui.classes);

      state.toolsUi = ui;
      Viewer.renderPointCloudClassList();
      Viewer.loadPointCloudClassificationInfo();
      return ui;
    },

    loadPointCloudClassificationInfo() {
      const state = Viewer.pointCloudState;
      const url = classificationInfoUrl(core.fileObject?.originalPath);
      if (!state || !url) return;
      fetch(remoteAssetUrl(url), { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : null))
        .then((info) => {
          if (!info || Viewer.pointCloudState !== state) return;
          state.autoClassification = info;
          Viewer.renderPointCloudClassList();
        })
        .catch(() => {});
    },

    renderPointCloudClassList() {
      const state = Viewer.pointCloudState;
      const ui = state?.toolsUi;
      if (!ui) return;
      const info = state.autoClassification;
      ui.classesNote.hidden = !info;
      if (info) {
        ui.classesNote.textContent = info.classifier === "command"
          ? t("pointCloud.autoClassifiedModel", "Classes assigned automatically by a model - check before relying on them.")
          : t("pointCloud.autoClassified", "Classes assigned automatically from the geometry - check before relying on them.");
      }
      const classes = [...state.classes.keys()].sort((a, b) => a - b);
      ui.classes.hidden = classes.length < 2;
      ui.classesLegend.textContent = t("pointCloud.classesTitle", "Classes");
      ui.classList.replaceChildren(...classes.map((classId) => {
        const row = document.createElement("label");
        row.className = "viewer-pointcloud-panel_class";
        const box = document.createElement("input");
        box.type = "checkbox";
        box.checked = !state.hiddenClasses.has(classId);
        box.dataset.classId = String(classId);
        box.addEventListener("change", () => Viewer.setPointCloudClassVisible(classId, box.checked));
        const swatch = document.createElement("span");
        swatch.className = "viewer-pointcloud-panel_swatch";
        swatch.style.background = colorSwatch(classId);
        const name = document.createElement("span");
        const count = state.classes.get(classId);
        // ASPRS names for the standard classes, a number for the others.
        const named = t(`pointCloud.classNames.${classId}`, { value: classId }, "\u0000");
        const label = named !== "\u0000" ? named : t("pointCloud.classOther", { value: classId }, "Class {value}");
        name.textContent = count ? `${label} (${count.toLocaleString()})` : label;
        row.append(box, swatch, name);
        return row;
      }));
    },

    syncPointCloudToolRows() {
      const state = Viewer.pointCloudState;
      const ui = state?.toolsUi;
      if (!ui) return;
      const picking = Viewer.isPointCloudProfilePicking();
      ui.profileLabel.textContent = t("pointCloud.profile", "Profile");
      ui.profileButton.textContent = picking
        ? t("pointCloud.cancelProfile", "Cancel")
        : state.profile
          ? t("pointCloud.clearProfile", "Clear profile")
          : t("pointCloud.drawProfile", "Draw profile");
      ui.profileButton.setAttribute("aria-pressed", picking || state.profile ? "true" : "false");
      ui.widthRow.hidden = !state.profile;
      if (state.profile) {
        const width = state.profile.width;
        const formatted = Viewer.formatLength?.(width)?.text || width.toFixed(3);
        ui.widthLabel.textContent = t("pointCloud.profileWidth", { value: formatted }, "Profile width {value}");
        if (document.activeElement !== ui.width) {
          ui.width.value = String(Math.round((Math.log((width * 2000) / state.profile.diagonal) / Math.log(400)) * 100));
        }
      }
      Viewer.renderPointCloudClassList();
    },
  });
}
