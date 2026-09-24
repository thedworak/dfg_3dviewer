import THREE from "../init.js";
import { core } from "../core.js";
import { t } from "../i18n-utils.js";
import { getViewerSideStack } from "../ui/side-stack.js";
import { getActiveTiles, getPointCloudPlugin } from "../tiles.js";

// Point cloud display controls, shown when the loaded model is a point cloud:
//
//   direct clouds (LAS, LAZ, XYZ, PCD - THREE.Points in the scene):
//     size, square/round points, colour by RGB / intensity / height /
//     classification (whatever the file carries), recoloured on the CPU
//   streamed clouds (3D Tiles pnts, Potree - tiles.js):
//     size, square/round/sphere points, Eye-Dome Lighting strength, colour by
//     RGB or by level of detail (to see how the octree refines)
//
// Defaults: viewer-settings.json -> viewer.pointCloud (colorMode, pointShape)
// and viewer.tiles (edlStrength, pointShape).

const SIZE_MIN = 0.25;
const SIZE_MAX = 4;

// ASPRS LAS standard classes (LAS 1.4, table 17).
const CLASSIFICATION_COLORS = {
  0: 0x9e9e9e, 1: 0xbdbdbd, 2: 0xa1784f, 3: 0xb5e28c, 4: 0x6fbf4a, 5: 0x2e7d32,
  6: 0xe8743b, 7: 0xd500f9, 8: 0x7e57c2, 9: 0x2f80ed, 10: 0x795548, 11: 0x616161,
  12: 0xfdd835, 13: 0xffb300, 14: 0xffca28, 15: 0x8d6e63, 16: 0x90a4ae, 17: 0x5c6bc0,
  18: 0xff1744,
};

function sliderToSize(value) {
  // 0..100 -> 0.25..4 on a log scale, 50 = 1.
  return SIZE_MIN * Math.pow(SIZE_MAX / SIZE_MIN, Number(value) / 100);
}

function sizeToSlider(size) {
  return Math.round((Math.log(size / SIZE_MIN) / Math.log(SIZE_MAX / SIZE_MIN)) * 100);
}

// Round sprites for plain PointsMaterial: drop the corners of the square.
// The define is part of the program cache key, so both variants coexist.
function applyRoundShape(material, round) {
  if (!material.userData.roundPatched) {
    material.userData.roundPatched = true;
    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "void main() {",
        "void main() {\n#ifdef ROUND_POINTS\n  vec2 roundCoord = gl_PointCoord - 0.5;\n  if (dot(roundCoord, roundCoord) > 0.25) discard;\n#endif"
      );
    };
  }
  material.defines = round ? { ROUND_POINTS: "" } : {};
  material.needsUpdate = true;
}

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

      const config = core.CONFIG?.viewer?.pointCloud || {};
      const tilesConfig = core.CONFIG?.viewer?.tiles || {};
      const modes = isTiled ? ["rgb", "tile"] : Viewer.getDirectColorModes(points);
      const preferred = config.colorMode;
      const state = {
        kind: isTiled ? "tiles" : "direct",
        root,
        points,
        plugin,
        potree,
        modes,
        size: 1,
        shape: plugin?.pointShape || (config.pointShape === "round" ? "round" : tilesConfig.pointShape || "square"),
        colorMode: modes.includes(preferred) ? preferred : modes[0],
        edl: plugin ? plugin.edlStrength : 0,
        collapsed: false,
        ui: null,
      };
      if (!isTiled && !["square", "round"].includes(state.shape)) state.shape = "square";
      Viewer.pointCloudState = state;

      points.forEach((object) => {
        object.userData.baseMaterialSize ??= object.material.size;
      });
      if (!isTiled) {
        Viewer.setPointCloudShape(state.shape);
        Viewer.setPointCloudColorMode(state.colorMode);
      }
      Viewer.createPointCloudPanel();
      return true;
    },

    disposePointCloudControls() {
      Viewer.pointCloudState?.ui?.root.remove();
      Viewer.pointCloudState = null;
    },

    isPointCloudActive() {
      return Boolean(Viewer.pointCloudState);
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
        state.points.forEach((object) => {
          object.material.size = object.userData.baseMaterialSize * state.size;
        });
      }
      Viewer.syncPointCloudPanel();
    },

    setPointCloudShape(shape) {
      const state = Viewer.pointCloudState;
      if (!state) return;
      state.shape = shape;
      if (state.kind === "tiles") {
        if (state.plugin) state.plugin.pointShape = shape;
      } else {
        state.points.forEach((object) => applyRoundShape(object.material, shape === "round"));
      }
      Viewer.syncPointCloudPanel();
    },

    setPointCloudEdl(strength) {
      const state = Viewer.pointCloudState;
      if (!state?.plugin) return;
      state.edl = THREE.MathUtils.clamp(strength, 0, 1);
      state.plugin.edlStrength = state.edl;
      Viewer.syncPointCloudPanel();
    },

    setPointCloudColorMode(mode) {
      const state = Viewer.pointCloudState;
      if (!state || !state.modes.includes(mode)) return;
      state.colorMode = mode;
      if (state.kind === "tiles") {
        if (state.plugin) state.plugin.debugColorMode = mode === "tile" ? "tile" : "none";
        const group = getActiveTiles()?.group;
        if (group) Viewer.applyPointCloudSettingsToTile(group);
      } else {
        state.points.forEach((object) => Viewer.recolorPoints(object, mode));
      }
      Viewer.syncPointCloudPanel();
    },

    // Rewrites the colour attribute of a direct cloud; the file's own RGB
    // is kept aside on first use so it can be restored.
    recolorPoints(object, mode) {
      const geometry = object.geometry;
      const position = geometry.getAttribute("position");
      const count = position.count;
      let color = geometry.getAttribute("color");
      if (!color) {
        color = new THREE.BufferAttribute(new Uint8Array(count * 3), 3, true);
        geometry.setAttribute("color", color);
        object.material.vertexColors = true;
        object.material.needsUpdate = true;
      }
      if (!object.userData.originalColors && color.array) {
        object.userData.originalColors = color.array.slice();
      }
      const target = color.array;
      const isNormalizedBytes = target instanceof Uint8Array;
      const write = (index, r, g, b) => {
        if (isNormalizedBytes) {
          target[index * 3] = r;
          target[index * 3 + 1] = g;
          target[index * 3 + 2] = b;
        } else {
          target[index * 3] = r / 255;
          target[index * 3 + 1] = g / 255;
          target[index * 3 + 2] = b / 255;
        }
      };

      if (mode === "rgb" && object.userData.originalColors) {
        target.set(object.userData.originalColors);
      } else if (mode === "intensity") {
        const intensity = geometry.getAttribute("intensity");
        let max = 0;
        for (let i = 0; i < count; i += 1) max = Math.max(max, intensity.getX(i));
        for (let i = 0; i < count; i += 1) {
          const value = Math.round(40 + (max > 0 ? intensity.getX(i) / max : 0) * 215);
          write(i, value, value, value);
        }
      } else if (mode === "classification") {
        const classification = geometry.getAttribute("classification");
        const swatch = new THREE.Color();
        for (let i = 0; i < count; i += 1) {
          swatch.setHex(CLASSIFICATION_COLORS[classification.getX(i)] ?? 0xeeeeee);
          write(i, swatch.r * 255, swatch.g * 255, swatch.b * 255);
        }
      } else {
        // Height: world Y, whatever the file's own up axis was.
        object.updateMatrixWorld(true);
        const elements = object.matrixWorld.elements;
        const heights = new Float32Array(count);
        let minY = Infinity;
        let maxY = -Infinity;
        for (let i = 0; i < count; i += 1) {
          const y = elements[1] * position.getX(i) + elements[5] * position.getY(i)
            + elements[9] * position.getZ(i) + elements[13];
          heights[i] = y;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
        const range = maxY - minY || 1;
        const swatch = new THREE.Color();
        for (let i = 0; i < count; i += 1) {
          // Blue (low) through green to red (high).
          swatch.setHSL((1 - (heights[i] - minY) / range) * 0.66, 0.85, 0.5);
          write(i, swatch.r * 255, swatch.g * 255, swatch.b * 255);
        }
      }
      color.needsUpdate = true;
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

      const shape = document.createElement("select");
      const shapes = state.kind === "tiles" ? ["square", "round", "sphere"] : ["square", "round"];
      shapes.forEach((value) => shape.appendChild(new Option(value, value)));
      shape.addEventListener("change", () => Viewer.setPointCloudShape(shape.value));
      const shapeLabel = makeRow("shape", shape);

      const color = document.createElement("select");
      state.modes.forEach((value) => color.appendChild(new Option(value, value)));
      color.addEventListener("change", () => Viewer.setPointCloudColorMode(color.value));
      const colorLabel = makeRow("color", color);
      color.disabled = state.modes.length < 2;

      let edl = null;
      let edlLabel = null;
      if (state.plugin) {
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
        root, title, collapse, body, size, sizeLabel, shape, shapeLabel, color, colorLabel, edl, edlLabel, summary,
      };
      Viewer.syncPointCloudPanel();
    },

    syncPointCloudPanel() {
      const state = Viewer.pointCloudState;
      const ui = state?.ui;
      if (!ui) return;
      ui.root.setAttribute("aria-label", t("pointCloud.title", "Point cloud"));
      ui.title.textContent = t("pointCloud.title", "Point cloud");
      ui.body.hidden = state.collapsed;
      ui.collapse.textContent = state.collapsed ? "+" : "–";
      const collapseLabel = state.collapsed ? t("pointCloud.expand", "Show settings") : t("pointCloud.collapse", "Hide settings");
      ui.collapse.title = collapseLabel;
      ui.collapse.setAttribute("aria-label", collapseLabel);
      ui.collapse.setAttribute("aria-expanded", state.collapsed ? "false" : "true");

      ui.sizeLabel.textContent = t("pointCloud.size", { value: state.size.toFixed(2).replace(/\.?0+$/, "") }, "Point size ×{value}");
      if (document.activeElement !== ui.size) ui.size.value = String(sizeToSlider(state.size));
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
