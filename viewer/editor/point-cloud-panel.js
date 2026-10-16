import THREE from "../init.js";
import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { getViewerSideStack } from "../ui/side-stack.js";
import { attachToolPanelChrome } from "../ui/tool-panel-chrome.js";
import { getActiveTiles, getPointCloudPlugin, getPotreeAttributes, getTiledModelBox } from "../tiles.js";
import { PHONE_TOOLBAR_QUERY } from "../editor-toolbar.js";
import {
  COLOR_MODES, addColorModes, createColorUniforms, preparePointCloudMaterial, setPointColorMode, setPointEdl, setPointSize,
} from "../pointcloud-material.js";

// Point cloud display controls, shown when the loaded model is a point cloud:
//
//   direct clouds (LAS, LAZ, XYZ, PCD - THREE.Points in the scene):
//     size (adaptive - world units from the point spacing - or fixed pixels),
//     square/round/sphere points, Eye-Dome Lighting strength, colour by RGB /
//     intensity / height / classification (whatever the file carries),
//     switched in the shader (pointcloud-material.js)
//   streamed clouds (3D Tiles pnts, Potree - tiles.js):
//     size, square/round/sphere points, Eye-Dome Lighting strength, colour by
//     RGB, height, intensity and classification (Potree clouds that carry
//     them) - one set of uniforms shared by all tiles - or by level of
//     detail (to see how the octree refines)
//
// Defaults: viewer-settings.json -> viewer.pointCloud (colorMode, pointShape,
// sizeMode, pointSize, edlStrength) and viewer.tiles (edlStrength, pointShape).
//
// The window opens by itself except on phones, where it would cover the
// model; there (and everywhere) the toolbar's point cloud button, shown while
// a point cloud is loaded, opens and closes it.

const SIZE_MIN = 0.25;
const SIZE_MAX = 4;

const SHAPES = ["square", "round", "sphere"];
const DEFAULT_EDL = 0.4;

function sliderToSize(value) {
  // 0..100 -> 0.25..4 on a log scale, 50 = 1.
  return SIZE_MIN * Math.pow(SIZE_MAX / SIZE_MIN, Number(value) / 100);
}

function sizeToSlider(size) {
  return Math.round((Math.log(size / SIZE_MIN) / Math.log(SIZE_MAX / SIZE_MIN)) * 100);
}

const finiteOr = (value, fallback) => (Number.isFinite(Number(value)) && value !== null && value !== "" ? Number(value) : fallback);

export function attachPointCloudPanel(Viewer) {
  Object.assign(Viewer, {
    pointCloudState: null,

    // Called after a model is added to the scene (loaders.js).
    setupPointCloudControls(root) {
      Viewer.disposePointCloudControls();
      const tiles = getActiveTiles();
      const isTiled = Boolean(root?.userData?.isTiledModel && tiles);
      const points = [];
      root?.traverse?.((child) => {
        if (child.isPoints) points.push(child);
      });
      const plugin = isTiled ? getPointCloudPlugin() : null;
      const potree = core.tiledModel?.format === "potree";
      if (!points.length && !potree) return false;
      // A LAS/LAZ cloud still filling in: set up once all points are in
      // (loaders.js), so modes and colours see the whole cloud.
      if (points.some((object) => object.userData.pointCloud?.loading)) return false;

      const config = core.CONFIG?.viewer?.pointCloud || {};
      const tilesConfig = core.CONFIG?.viewer?.tiles || {};
      const modes = isTiled ? Viewer.getTiledColorModes(potree) : Viewer.getDirectColorModes(points);
      const preferred = config.colorMode;
      const directShape = SHAPES.includes(config.pointShape) ? config.pointShape
        : SHAPES.includes(tilesConfig.pointShape) ? tilesConfig.pointShape : "square";
      const state = {
        kind: isTiled ? "tiles" : "direct",
        root,
        points,
        plugin,
        potree,
        modes,
        size: 1,
        // Direct clouds: "adaptive" (world units, from the point spacing) or "fixed" (pixels).
        sizeMode: config.sizeMode === "fixed" ? "fixed" : "adaptive",
        shape: plugin?.pointShape || directShape,
        colorMode: modes.includes(preferred) ? preferred : modes[0],
        edl: plugin ? plugin.edlStrength
          : Math.min(1, Math.max(0, finiteOr(config.edlStrength, finiteOr(tilesConfig.edlStrength, DEFAULT_EDL)))),
        collapsed: false,
        hidden: window.matchMedia(PHONE_TOOLBAR_QUERY).matches,
        // Streamed clouds: the colour uniforms all tiles share.
        colorUniforms: isTiled ? createColorUniforms() : null,
        ui: null,
      };
      Viewer.pointCloudState = state;

      points.forEach((object) => {
        object.userData.baseMaterialSize ??= object.material.size;
      });
      if (!isTiled) {
        const pixels = finiteOr(config.pointSize, 2);
        points.forEach((object) => {
          // Pixels for "fixed": the size the loader gave in pixels (LAS/LAZ),
          // else viewer.pointCloud.pointSize (XYZ / PCD sizes are in other units).
          object.userData.basePixelSize ??= object.material.sizeAttenuation === false ? object.material.size : pixels;
          preparePointCloudMaterial(object);
        });
        Viewer.applyDirectPointSize();
        Viewer.setPointCloudShape(state.shape);
        Viewer.setPointCloudEdl(state.edl);
        Viewer.setPointCloudColorMode(state.colorMode);
      }
      if (isTiled && state.colorMode !== modes[0]) Viewer.setPointCloudColorMode(state.colorMode);
      Viewer.createPointCloudPanel();
      Viewer.updateEditorToolbarState?.();
      return true;
    },

    // Colour modes of a streamed cloud: height always, intensity and
    // classification when a Potree cloud carries them (3D Tiles pnts content
    // from py3dtiles has neither as vertex attributes).
    getTiledColorModes(potree) {
      const modes = ["rgb"];
      const attributes = potree ? getPotreeAttributes() : {};
      const varies = (name) => {
        const { min, max } = attributes[name] || {};
        return Array.isArray(min) && Array.isArray(max) && max[0] > min[0];
      };
      if (varies("intensity")) modes.push("intensity");
      modes.push("height");
      if (varies("classification")) modes.push("classification");
      modes.push("tile");
      return modes;
    },

    disposePointCloudControls() {
      const hadState = Boolean(Viewer.pointCloudState);
      Viewer.pointCloudState?.ui?.root.remove();
      Viewer.pointCloudState = null;
      if (hadState) Viewer.updateEditorToolbarState?.();
    },

    isPointCloudActive() {
      return Boolean(Viewer.pointCloudState?.ui);
    },

    isPointCloudPanelVisible() {
      const state = Viewer.pointCloudState;
      return Boolean(state?.ui && !state.hidden);
    },

    // The toolbar button: shows the window (with its settings open) or hides it.
    togglePointCloudPanel() {
      const state = Viewer.pointCloudState;
      if (!state?.ui) return;
      state.hidden = !state.hidden;
      if (!state.hidden) state.collapsed = false;
      Viewer.syncPointCloudPanel();
      Viewer.updateEditorToolbarState?.();
    },

    // Colour modes a direct cloud can offer, from the attributes it carries.
    getDirectColorModes(points) {
      const modes = [];
      const has = (name) => points.some((object) => object.geometry.getAttribute(name));
      const info = points[0]?.userData?.pointCloud;
      if (has("color") && info?.colorMode !== "intensity" && info?.colorMode !== "height") modes.push("rgb");
      if (has("intensity")) modes.push("intensity");
      modes.push("height");
      const classification = points[0]?.geometry.getAttribute("classification");
      if (classification) {
        const values = new Set();
        for (let i = 0; i < classification.count && values.size < 2; i += 97) values.add(classification.getX(i));
        if (values.size > 1) modes.push("classification");
      }
      return modes;
    },

    // Tiles loaded after the panel was set up get the current size. 3D Tiles
    // point clouds also get their level in the tile tree as the "tile" id the
    // plugin's debug colours use (the Potree plugin sets its own).
    applyPointCloudSettingsToTile(scene) {
      const state = Viewer.pointCloudState;
      if (!state || state.kind !== "tiles") return;
      scene.traverse((child) => {
        if (!child.isPoints) return;
        if (child.material?.isPointCloudMaterial) addColorModes(child.material, state.colorUniforms);
        child.userData.baseMaterialSize ??= child.material.size;
        child.material.size = child.userData.baseMaterialSize * state.size;
        const tileId = child.material.uniforms?.uTileId;
        if (!state.potree && tileId && Number.isFinite(child.userData.tileDepth)) {
          tileId.value = child.userData.tileDepth;
        }
      });
    },

    setPointCloudSize(size) {
      const state = Viewer.pointCloudState;
      if (!state) return;
      state.size = THREE.MathUtils.clamp(size, SIZE_MIN, SIZE_MAX);
      if (state.kind === "tiles") {
        if (state.potree && state.plugin && "pointScale" in state.plugin) {
          state.plugin.pointScale = state.size;
        }
        if (state.plugin) state.plugin.minPointSize = Math.max(1, 2 * state.size);
        const group = getActiveTiles()?.group;
        if (group) Viewer.applyPointCloudSettingsToTile(group);
      } else {
        Viewer.applyDirectPointSize();
      }
      Viewer.syncPointCloudPanel();
    },

    setPointCloudSizeMode(mode) {
      const state = Viewer.pointCloudState;
      if (!state || state.kind !== "direct") return;
      state.sizeMode = mode === "fixed" ? "fixed" : "adaptive";
      Viewer.applyDirectPointSize();
      Viewer.syncPointCloudPanel();
    },

    applyDirectPointSize() {
      const state = Viewer.pointCloudState;
      state?.points.forEach((object) => setPointSize(object, {
        sizeMode: state.sizeMode,
        scale: state.size,
        pixels: object.userData.basePixelSize ?? 2,
      }));
    },

    setPointCloudShape(shape) {
      const state = Viewer.pointCloudState;
      if (!state) return;
      state.shape = shape;
      if (state.kind === "tiles") {
        if (state.plugin) state.plugin.pointShape = shape;
      } else {
        state.points.forEach((object) => {
          preparePointCloudMaterial(object).pointShape = shape;
        });
      }
      Viewer.syncPointCloudPanel();
    },

    setPointCloudEdl(strength) {
      const state = Viewer.pointCloudState;
      if (!state || (state.kind === "tiles" && !state.plugin)) return;
      state.edl = THREE.MathUtils.clamp(strength, 0, 1);
      if (state.plugin) state.plugin.edlStrength = state.edl;
      else state.points.forEach((object) => setPointEdl(object, state.edl));
      Viewer.syncPointCloudPanel();
    },

    setPointCloudColorMode(mode) {
      const state = Viewer.pointCloudState;
      if (!state || !state.modes.includes(mode)) return;
      state.colorMode = mode;
      if (state.kind === "tiles") {
        if (state.plugin) state.plugin.debugColorMode = mode === "tile" ? "tile" : "none";
        const uniforms = state.colorUniforms;
        uniforms.uColorMode.value = COLOR_MODES[mode] ?? COLOR_MODES.rgb;
        if (mode === "height") {
          const box = getTiledModelBox();
          if (box) uniforms.uHeightRange.value.set(box.min.y, box.max.y);
        } else if (mode === "intensity") {
          // PotreeLoader scales intensity to 0..1.
          const { min, max } = getPotreeAttributes().intensity || {};
          uniforms.uIntensityRange.value.set((min?.[0] ?? 0) / 65535, (max?.[0] ?? 65535) / 65535);
        }
        const group = getActiveTiles()?.group;
        if (group) Viewer.applyPointCloudSettingsToTile(group);
      } else {
        state.points.forEach((object) => setPointColorMode(object, mode));
      }
      Viewer.syncPointCloudPanel();
    },

    createPointCloudPanel() {
      const state = Viewer.pointCloudState;
      const stack = getViewerSideStack();
      if (!state || !stack || core.PRESENTATION_MODE || Viewer.urlOptions?.hideUi === true) return;

      const root = document.createElement("section");
      root.id = "viewerPointCloudPanel";
      root.className = "viewer-pointcloud-panel";
      ["pointerdown", "pointerup", "wheel", "keydown"].forEach((type) => {
        root.addEventListener(type, (event) => event.stopPropagation());
      });

      const header = document.createElement("div");
      header.className = "viewer-pointcloud-panel_header";
      const title = document.createElement("strong");
      const collapse = document.createElement("button");
      collapse.type = "button";
      collapse.className = "viewer-pointcloud-panel_collapse";
      collapse.addEventListener("click", () => {
        state.collapsed = !state.collapsed;
        Viewer.syncPointCloudPanel();
      });
      header.append(title, collapse);
      // The panel's own collapse button already minimizes it: only the grip.
      attachToolPanelChrome(root, header, { minimizable: false });

      const body = document.createElement("div");
      body.className = "viewer-pointcloud-panel_body";

      const makeRow = (labelText, control) => {
        const row = document.createElement("label");
        row.className = "viewer-pointcloud-panel_row";
        const label = document.createElement("span");
        row.append(label, control);
        body.appendChild(row);
        return label;
      };

      const size = document.createElement("input");
      size.type = "range";
      size.min = "0";
      size.max = "100";
      size.addEventListener("input", () => Viewer.setPointCloudSize(sliderToSize(size.value)));
      const sizeLabel = makeRow("size", size);

      let sizeMode = null;
      let sizeModeLabel = null;
      if (state.kind === "direct") {
        sizeMode = document.createElement("select");
        ["adaptive", "fixed"].forEach((value) => sizeMode.appendChild(new Option(value, value)));
        sizeMode.addEventListener("change", () => Viewer.setPointCloudSizeMode(sizeMode.value));
        sizeModeLabel = makeRow("sizeMode", sizeMode);
      }

      const shape = document.createElement("select");
      SHAPES.forEach((value) => shape.appendChild(new Option(value, value)));
      shape.addEventListener("change", () => Viewer.setPointCloudShape(shape.value));
      const shapeLabel = makeRow("shape", shape);

      const color = document.createElement("select");
      state.modes.forEach((value) => color.appendChild(new Option(value, value)));
      color.addEventListener("change", () => Viewer.setPointCloudColorMode(color.value));
      const colorLabel = makeRow("color", color);
      color.disabled = state.modes.length < 2;

      let edl = null;
      let edlLabel = null;
      if (state.plugin || state.kind === "direct") {
        edl = document.createElement("input");
        edl.type = "range";
        edl.min = "0";
        edl.max = "100";
        edl.addEventListener("input", () => Viewer.setPointCloudEdl(Number(edl.value) / 100));
        edlLabel = makeRow("edl", edl);
      }

      const summary = document.createElement("p");
      summary.className = "viewer-pointcloud-panel_summary";
      body.appendChild(summary);

      root.append(header, body);
      stack.appendChild(root);
      state.ui = {
        root, title, collapse, body, size, sizeLabel, sizeMode, sizeModeLabel, shape, shapeLabel, color, colorLabel, edl, edlLabel, summary,
      };
      Viewer.syncPointCloudPanel();
    },

    syncPointCloudPanel() {
      const state = Viewer.pointCloudState;
      const ui = state?.ui;
      if (!ui) return;
      ui.root.setAttribute("aria-label", t("pointCloud.title", "Point cloud"));
      ui.title.textContent = t("pointCloud.title", "Point cloud");
      ui.root.hidden = state.hidden;
      ui.body.hidden = state.collapsed;
      ui.collapse.textContent = state.collapsed ? "+" : "–";
      const collapseLabel = state.collapsed ? t("pointCloud.expand", "Show settings") : t("pointCloud.collapse", "Hide settings");
      ui.collapse.title = collapseLabel;
      ui.collapse.setAttribute("aria-label", collapseLabel);
      ui.collapse.setAttribute("aria-expanded", state.collapsed ? "false" : "true");

      ui.sizeLabel.textContent = t("pointCloud.size", { value: state.size.toFixed(2).replace(/\.?0+$/, "") }, "Point size ×{value}");
      if (document.activeElement !== ui.size) ui.size.value = String(sizeToSlider(state.size));
      if (ui.sizeMode) {
        ui.sizeModeLabel.textContent = t("pointCloud.sizeMode", "Size");
        Array.from(ui.sizeMode.options).forEach((option) => {
          option.textContent = t(`pointCloud.sizeModes.${option.value}`, option.value);
        });
        ui.sizeMode.value = state.sizeMode;
      }
      ui.shapeLabel.textContent = t("pointCloud.shape", "Shape");
      Array.from(ui.shape.options).forEach((option) => {
        option.textContent = t(`pointCloud.shapes.${option.value}`, option.value);
      });
      ui.shape.value = state.shape;
      ui.colorLabel.textContent = t("pointCloud.color", "Colour");
      Array.from(ui.color.options).forEach((option) => {
        option.textContent = t(`pointCloud.colorModes.${option.value}`, option.value);
      });
      ui.color.value = state.colorMode;
      if (ui.edl) {
        ui.edlLabel.textContent = t("pointCloud.edl", { value: Math.round(state.edl * 100) }, "Eye-Dome Lighting {value}%");
        if (document.activeElement !== ui.edl) ui.edl.value = String(Math.round(state.edl * 100));
      }

      const info = state.points[0]?.userData?.pointCloud;
      if (state.kind === "tiles") {
        ui.summary.textContent = t("pointCloud.streamed", "Streamed: detail loads as you zoom in.");
      } else if (info) {
        ui.summary.textContent = info.skip > 1
          ? t("pointCloud.thinned", { loaded: info.loadedPoints.toLocaleString(), total: info.totalPoints.toLocaleString() }, "{loaded} of {total} points")
          : t("pointCloud.points", { total: info.totalPoints.toLocaleString() }, "{total} points");
      } else {
        const total = state.points.reduce((sum, object) => sum + object.geometry.getAttribute("position").count, 0);
        ui.summary.textContent = t("pointCloud.points", { total: total.toLocaleString() }, "{total} points");
      }
    },
  });
}
