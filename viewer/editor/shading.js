import { core } from "../core.js";
import { showToast, toastHelper } from "../viewer-utils.js";
import { t } from "../i18n-utils.js";
import THREE from "../init.js";
import { attachToolPanelChrome, PANEL_ICONS, refreshToolPanelChrome } from "../ui/tool-panel-chrome.js";
import { fitPanelToViewer, getViewerSideStack } from "../ui/side-stack.js";
import { getEditorToolbarIcon } from "../editor-toolbar.js";

// "original": the loader's own materials, as loaded. The others are made
// from them on each switch (see buildMaterialForMode); "clay", "matcap",
// "flat" and "normals" are for reading the geometry of a scan.
export const SHADING_MODES = ["original", "standard", "phong", "lambert", "toon", "flat", "clay", "matcap", "normals", "custom"];
export const DEFAULT_SHADING_MODE = "original";

// The modes' names, in the viewer's language (the shading menu, the
// comparison of editor/compare.js).
export function shadingModeLabel(mode) {
  const labels = {
    original: () => t("gui.shadingOriginal", "Original materials"),
    standard: () => t("gui.shadingStandard", "Standard (PBR)"),
    phong: () => t("gui.shadingPhong", "Phong"),
    lambert: () => t("gui.shadingLambert", "Lambert"),
    toon: () => t("gui.shadingToon", "Toon"),
    clay: () => t("gui.shadingClay", "Clay (no texture)"),
    matcap: () => t("gui.shadingMatcap", "Matcap (studio clay)"),
    flat: () => t("gui.shadingFlat", "Flat shading (show faces)"),
    normals: () => t("gui.shadingNormals", "Normals"),
    custom: () => t("gui.shadingCustom", "Custom shader"),
  };
  return labels[mode]?.() ?? String(mode);
}

// Untextured clay: a warm light grey, matte.
const CLAY_COLOR = 0xc9c2b6;

// The clipping_planes chunks make the section planes cut the model in this
// mode too; vColor carries vertex colours (PLY, XYZ, ...), USE_COLOR being
// defined for a model that has them.
export const DEFAULT_CUSTOM_VERTEX_SHADER = `#include <clipping_planes_pars_vertex>
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vColor;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vUv = uv;
  vColor = vec3(1.0);
#ifdef USE_COLOR
  vColor = color.rgb;
#endif
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
}
`;

export const DEFAULT_CUSTOM_FRAGMENT_SHADER = `#include <clipping_planes_pars_fragment>
uniform vec3 uColor;
uniform sampler2D uMap;
uniform bool uHasMap;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vColor;

void main() {
  #include <clipping_planes_fragment>
  vec3 base = (uHasMap ? texture2D(uMap, vUv).rgb * uColor : uColor) * vColor;
  // Simple rim-light effect: brighten edges facing away from the camera.
  float rim = 1.0 - max(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)), 0.0);
  vec3 color = base + rim * rim * 0.6;
  gl_FragColor = vec4(color, 1.0);
}
`;

function copyCommonMaterialProperties(target, base) {
  target.name = base.name;
  target.side = base.side;
  target.transparent = base.transparent;
  target.opacity = base.opacity;
  target.alphaTest = base.alphaTest;
  target.wireframe = core.wireframeMode || false;
  target.clippingPlanes = base.clippingPlanes || null;
  target.clipShadows = base.clipShadows || false;
  target.vertexColors = base.vertexColors;
  if (base.map) target.map = base.map;
  if (base.alphaMap) target.alphaMap = base.alphaMap;
  if ("normalMap" in target && base.normalMap) {
    target.normalMap = base.normalMap;
    if (base.normalScale) target.normalScale = base.normalScale.clone();
  }
  if ("aoMap" in target && base.aoMap) {
    target.aoMap = base.aoMap;
    target.aoMapIntensity = base.aoMapIntensity ?? 1;
  }
  if ("emissive" in target) {
    target.emissive = base.emissive ? base.emissive.clone() : new THREE.Color(0x000000);
    if (base.emissiveMap) target.emissiveMap = base.emissiveMap;
    target.emissiveIntensity = base.emissiveIntensity ?? 1;
  }
}

// Geometry-only modes keep what shapes the surface's outline (sides,
// cut-outs, clipping, wireframe) and drop everything about its look.
function copyShapeProperties(target, base) {
  target.name = base.name;
  target.side = base.side;
  target.alphaTest = base.alphaTest;
  if ("alphaMap" in target && base.alphaMap) target.alphaMap = base.alphaMap;
  target.wireframe = core.wireframeMode || false;
  target.clippingPlanes = base.clippingPlanes || null;
  target.clipShadows = base.clipShadows || false;
}

// The matcap of the "matcap" mode: a lit clay sphere, drawn once.
let matcapTexture = null;
function getMatcapTexture() {
  if (matcapTexture) return matcapTexture;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#3a3632";
  ctx.fillRect(0, 0, size, size);
  // Key light from the upper left, a soft rim on the lower right.
  const body = ctx.createRadialGradient(size * 0.36, size * 0.32, size * 0.02, size * 0.5, size * 0.5, size * 0.5);
  body.addColorStop(0, "#fbf6ee");
  body.addColorStop(0.35, "#d8cfc2");
  body.addColorStop(0.75, "#8f857a");
  body.addColorStop(1, "#4a443e");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  const rim = ctx.createRadialGradient(size * 0.5, size * 0.5, size * 0.4, size * 0.5, size * 0.5, size * 0.5);
  rim.addColorStop(0, "rgba(200, 210, 230, 0)");
  rim.addColorStop(1, "rgba(200, 210, 230, 0.35)");
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  matcapTexture = new THREE.CanvasTexture(canvas);
  matcapTexture.colorSpace = THREE.SRGBColorSpace;
  return matcapTexture;
}

function buildMaterialForMode(baseMaterial, mode, customShader) {
  const color = baseMaterial.color ? baseMaterial.color.clone() : new THREE.Color(0xffffff);

  switch (mode) {
    case "flat": {
      // The material itself, every map kept, with faceted normals; an
      // unlit one (no flatShading) becomes a lit standard one.
      const material = "flatShading" in baseMaterial && !baseMaterial.isMeshBasicMaterial
        ? baseMaterial.clone()
        : buildMaterialForMode(baseMaterial, "standard", null);
      material.flatShading = true;
      material.wireframe = core.wireframeMode || false;
      // clone() copies the planes; the clipping tool moves the shared ones.
      material.clippingPlanes = baseMaterial.clippingPlanes || null;
      return material;
    }
    case "clay": {
      const material = new THREE.MeshStandardMaterial({ color: CLAY_COLOR, roughness: 0.85, metalness: 0 });
      copyShapeProperties(material, baseMaterial);
      return material;
    }
    case "matcap": {
      const material = new THREE.MeshMatcapMaterial({ matcap: getMatcapTexture() });
      copyShapeProperties(material, baseMaterial);
      return material;
    }
    case "normals": {
      const material = new THREE.MeshNormalMaterial();
      copyShapeProperties(material, baseMaterial);
      return material;
    }
    case "phong": {
      const material = new THREE.MeshPhongMaterial({ color, shininess: 30, specular: 0x111111 });
      copyCommonMaterialProperties(material, baseMaterial);
      return material;
    }
    case "lambert": {
      const material = new THREE.MeshLambertMaterial({ color });
      copyCommonMaterialProperties(material, baseMaterial);
      return material;
    }
    case "toon": {
      const material = new THREE.MeshToonMaterial({ color });
      copyCommonMaterialProperties(material, baseMaterial);
      return material;
    }
    case "custom": {
      const hasMap = Boolean(baseMaterial.map);
      const material = new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: color },
          uMap: { value: baseMaterial.map || null },
          uHasMap: { value: hasMap },
        },
        vertexShader: customShader?.vertexShader || DEFAULT_CUSTOM_VERTEX_SHADER,
        fragmentShader: customShader?.fragmentShader || DEFAULT_CUSTOM_FRAGMENT_SHADER,
        side: baseMaterial.side,
        transparent: baseMaterial.transparent,
        wireframe: core.wireframeMode || false,
        vertexColors: baseMaterial.vertexColors === true,
        clipping: true,
      });
      material.clippingPlanes = baseMaterial.clippingPlanes || null;
      material.name = baseMaterial.name;
      return material;
    }
    case "standard":
    default: {
      const material = new THREE.MeshStandardMaterial({
        color,
        metalness: baseMaterial.metalness ?? 0,
        roughness: baseMaterial.roughness ?? 1,
      });
      material.envMapIntensity = baseMaterial.envMapIntensity ?? 1;
      copyCommonMaterialProperties(material, baseMaterial);
      return material;
    }
  }
}

export function attachShadingEditor(Viewer) {
  Object.assign(Viewer, {
    getShadingRootObjects() {
      return Array.isArray(core.mainObject) ? core.mainObject.filter((item) => item?.isObject3D) : [];
    },

    applyShadingMode() {
      const roots = this.getShadingRootObjects();
      if (!roots.length) return;
      // The comparison's materials were made from the previous state.
      this.clearCompareShadingMaterials();

      // The Level of Certainty overlays are meshes too: shade the model
      // without them, then lay them again.
      const certaintyView = this.certaintyView === true;
      if (certaintyView) this.removeCertaintyOverlays?.();

      const mode = SHADING_MODES.includes(this.shadingMode) ? this.shadingMode : DEFAULT_SHADING_MODE;
      const customShader = mode === "custom"
        ? { vertexShader: this.customVertexShader, fragmentShader: this.customFragmentShader }
        : null;

      roots.forEach((root) => {
        root.traverse((child) => {
          if (!child.isMesh || !child.material) return;

          // Snapshot the mesh's original (loader-provided) materials once, on the
          // first shading-mode switch, so every later switch derives from the same
          // source instead of compounding lossy conversions between material types.
          if (!child.userData.__shadingBaseMaterials) {
            child.userData.__shadingBaseMaterials = Array.isArray(child.material)
              ? child.material.slice()
              : [child.material];
          }

          // The previous switch's materials (never the originals): released,
          // or every switch would leave a set of programs behind. Their
          // textures are the originals' (or the shared matcap): kept.
          child.userData.__shadingMaterials?.forEach((material) => material.dispose());
          child.userData.__shadingMaterials = null;

          const baseMaterials = child.userData.__shadingBaseMaterials;
          let nextMaterials;
          if (mode === "original") {
            // As loaded; wireframe and the clipping planes may have changed
            // meanwhile.
            nextMaterials = baseMaterials;
            nextMaterials.forEach((material) => {
              material.wireframe = core.wireframeMode || false;
              material.needsUpdate = true;
            });
          } else {
            nextMaterials = baseMaterials.map((baseMaterial) => {
              const newMaterial = buildMaterialForMode(baseMaterial, mode, customShader);
              newMaterial.needsUpdate = true;
              return newMaterial;
            });
            child.userData.__shadingMaterials = nextMaterials;
          }

          child.material = Array.isArray(child.material) ? nextMaterials.slice() : nextMaterials[0];
        });
      });
      if (certaintyView) this.applyCertaintyView?.();
    },

    // ---- the comparison (editor/compare.js) ----------------------------------

    // The modes a comparison can show: the custom shader once there is one
    // (and only with WebGL, see setShadingMode).
    getCompareShadingModes() {
      return SHADING_MODES.filter((mode) => mode !== "custom" || (
        core.rendererBackend !== "webgpu" && Boolean(this.customFragmentShader)
      ));
    },

    // Shows `mode` on the model for one side of a comparison, and returns
    // what puts the shown materials back (called after that side is drawn).
    // Each mode's materials are made once per mesh and kept, so the two
    // sides swap them every frame without building or compiling anything.
    showShadingForCompare(mode) {
      const current = SHADING_MODES.includes(this.shadingMode) ? this.shadingMode : DEFAULT_SHADING_MODE;
      if (!SHADING_MODES.includes(mode) || mode === current) return null;
      const roots = this.getShadingRootObjects();
      const shown = [];
      roots.forEach((root) => root.traverse((child) => {
        if (!child.isMesh || !child.material || child.userData.isCertaintyOverlay) return;
        if (!child.userData.__shadingBaseMaterials) {
          child.userData.__shadingBaseMaterials = Array.isArray(child.material)
            ? child.material.slice()
            : [child.material];
        }
        let cache = child.userData.__compareShadingMaterials;
        if (!cache) {
          cache = new Map();
          child.userData.__compareShadingMaterials = cache;
        }
        let materials = cache.get(mode);
        if (!materials) {
          const base = child.userData.__shadingBaseMaterials;
          if (mode === "original") {
            materials = base;
          } else {
            const customShader = mode === "custom"
              ? { vertexShader: this.customVertexShader, fragmentShader: this.customFragmentShader }
              : null;
            materials = base.map((material) => buildMaterialForMode(material, mode, customShader));
            materials.forEach((material) => {
              material.wireframe = core.wireframeMode || false;
              material.needsUpdate = true;
            });
          }
          cache.set(mode, materials);
        }
        shown.push([child, child.material]);
        child.material = Array.isArray(child.material) ? materials : materials[0];
      }));
      return () => shown.forEach(([child, material]) => {
        child.material = material;
      });
    },

    // Releases the comparison's materials (the originals are kept).
    clearCompareShadingMaterials() {
      this.getShadingRootObjects().forEach((root) => root.traverse((child) => {
        const cache = child.userData?.__compareShadingMaterials;
        if (!cache) return;
        cache.forEach((materials, mode) => {
          if (mode !== "original") materials.forEach((material) => material.dispose());
        });
        child.userData.__compareShadingMaterials = null;
      }));
    },

    setShadingMode(mode, options = {}) {
      if (!SHADING_MODES.includes(mode)) return;
      // GLSL: the WebGL renderer's only (renderer-backend.js).
      if (mode === "custom" && core.rendererBackend === "webgpu") {
        if (options.silent !== true) toastHelper("webglOnlyFeature", "warning", { feature: t("gui.shadingCustom", "Custom shader") });
        return;
      }

      this.shadingMode = mode;
      if (mode === "custom") {
        this.customVertexShader = options.vertexShader || this.customVertexShader || DEFAULT_CUSTOM_VERTEX_SHADER;
        this.customFragmentShader = options.fragmentShader || this.customFragmentShader || DEFAULT_CUSTOM_FRAGMENT_SHADER;
      }

      if (mode === "custom") this.watchCustomShaderErrors();
      this.applyShadingMode();
      this.updateEditorToolbarState?.();
      this.updateShadingSubmenuState?.();
      this.syncShadingPanel();
      // Its note on the other modes (editor/materials-editor.js).
      this.syncMaterialsPanel?.();

      // The menu shows the mode; only the shader dialog's Apply, which has no
      // other feedback, says so.
      if (mode === "custom" && options.silent !== true) {
        toastHelper("shadingModeApplied", "success", { mode: t("gui.shadingCustom", "Custom shader") });
      }
    },

    // A custom shader that does not compile leaves the model invisible:
    // the compiler's first error is shown, once per Apply. three checks a
    // program on its first use, i.e. on the next frame. The handler replaces
    // three's own console report, so it logs as well.
    watchCustomShaderErrors() {
      const renderer = core.renderer;
      if (!renderer?.debug) return;
      this.customShaderErrorShown = false;
      renderer.debug.onShaderError = (gl, program, vertexShader, fragmentShader) => {
        const logs = [vertexShader, fragmentShader]
          .map((shader) => (gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? "" : gl.getShaderInfoLog(shader)?.trim()))
          .filter(Boolean);
        const programLog = gl.getProgramInfoLog(program)?.trim();
        console.error("Custom shader failed to compile:", ...logs, programLog || "");
        if (this.shadingMode !== "custom" || this.customShaderErrorShown) return;
        this.customShaderErrorShown = true;
        const detail = (logs[0] || programLog || "").split("\n").find((line) => /error/i.test(line)) || logs[0] || "";
        toastHelper("customShaderError", "error", { detail: detail.slice(0, 200), duration: 9000 });
      };
    },

    // ---- the window (Look > Shading) -------------------------------------
    // The modes, and the custom shader's code (GLSL, WebGL only) under them.
    // Like the other tool panels it can be moved and minimized to an icon.

    isShadingPanelOpen() {
      return Boolean(this.shadingPanel);
    },

    toggleShadingPanel(open = !this.shadingPanel) {
      if (open) this.createShadingPanel();
      else this.removeShadingPanel();
      this.updateEditorToolbarState?.();
    },

    // The window with the custom shader's code open (the old dialog's name).
    openCustomShaderDialog() {
      this.toggleShadingPanel(true);
      const ui = this.shadingPanel;
      if (!ui) return;
      ui.shader.open = true;
      ui.fragment.focus({ preventScroll: true });
    },

    createShadingPanel() {
      if (this.shadingPanel || !core.container || this.urlOptions?.hideUi === true) return;
      const el = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
      };
      const button = (className, onClick) => {
        const node = el("button", className);
        node.type = "button";
        node.addEventListener("click", onClick);
        return node;
      };
      const panel = el("section", "viewer-shading viewer-scene");
      panel.id = "viewerShading";
      panel.setAttribute("role", "group");
      const header = el("div", "viewer-scene_header");
      const title = el("span", "viewer-scene_title");
      const closeButton = button("viewer-scene_icon", () => this.toggleShadingPanel(false));
      closeButton.textContent = "×";
      header.append(title, closeButton);

      // The model as loaded, then the material models, then the views for
      // reading a scan's geometry.
      const modes = el("div", "viewer-shading_modes");
      modes.setAttribute("role", "radiogroup");
      const modeButtons = {};
      SHADING_MODES.filter((mode) => mode !== "custom").forEach((mode) => {
        const modeButton = button("viewer-shading_mode", () => this.setShadingMode(mode));
        modeButton.dataset.mode = mode;
        modeButton.setAttribute("role", "radio");
        const icon = el("span", "viewer-shading_mode-icon");
        icon.setAttribute("aria-hidden", "true");
        icon.innerHTML = getEditorToolbarIcon(`shading${mode[0].toUpperCase()}${mode.slice(1)}`);
        modeButton.append(icon, el("span", "viewer-shading_mode-name"));
        modes.append(modeButton);
        modeButtons[mode] = modeButton;
      });

      const shader = el("details", "viewer-shading_shader");
      const summary = el("summary", "viewer-shading_shader-title");
      const vertexLabel = el("label", "viewer-shading_code");
      const vertexName = el("span");
      const vertex = el("textarea", "viewer-shading_textarea");
      vertex.spellcheck = false;
      vertexLabel.append(vertexName, vertex);
      const fragmentLabel = el("label", "viewer-shading_code");
      const fragmentName = el("span");
      const fragment = el("textarea", "viewer-shading_textarea");
      fragment.spellcheck = false;
      fragmentLabel.append(fragmentName, fragment);
      const actions = el("div", "viewer-scene_actions");
      const resetButton = button("viewer-shading_reset", () => {
        vertex.value = DEFAULT_CUSTOM_VERTEX_SHADER;
        fragment.value = DEFAULT_CUSTOM_FRAGMENT_SHADER;
      });
      const applyButton = button("viewer-scene_apply", () => {
        this.setShadingMode("custom", { vertexShader: vertex.value, fragmentShader: fragment.value });
      });
      actions.append(resetButton, applyButton);
      shader.append(summary, vertexLabel, fragmentLabel, actions);
      vertex.value = this.customVertexShader || DEFAULT_CUSTOM_VERTEX_SHADER;
      fragment.value = this.customFragmentShader || DEFAULT_CUSTOM_FRAGMENT_SHADER;

      const note = el("p", "viewer-scene_status");

      panel.append(header, modes, shader, note);
      ["pointerdown", "pointerup", "wheel", "keydown"].forEach((type) => {
        panel.addEventListener(type, (event) => event.stopPropagation());
      });
      attachToolPanelChrome(panel, header, {
        before: closeButton,
        icon: PANEL_ICONS.shading,
        label: () => t("gui.shading", "Shading"),
      });
      getViewerSideStack()?.append(panel);
      fitPanelToViewer(panel);
      this.shadingPanel = {
        panel, title, closeButton, modeButtons, shader, summary, vertexName, vertex, fragmentName, fragment,
        resetButton, applyButton, note,
      };
      this.updateShadingPanelLabels();
    },

    removeShadingPanel() {
      this.shadingPanel?.panel.remove();
      this.shadingPanel = null;
    },

    updateShadingPanelLabels() {
      const ui = this.shadingPanel;
      if (!ui) return;
      const name = t("gui.shading", "Shading");
      ui.panel.setAttribute("aria-label", name);
      ui.title.textContent = name;
      refreshToolPanelChrome(ui.panel);
      ui.closeButton.title = t("scene.close", "Close");
      ui.closeButton.setAttribute("aria-label", ui.closeButton.title);
      Object.entries(ui.modeButtons).forEach(([mode, modeButton]) => {
        const label = shadingModeLabel(mode);
        modeButton.querySelector(".viewer-shading_mode-name").textContent = label;
        modeButton.title = label;
      });
      ui.summary.textContent = t("gui.shadingCustom", "Custom shader");
      ui.vertexName.textContent = t("gui.shadingCustomVertex", "Vertex shader");
      ui.fragmentName.textContent = t("gui.shadingCustomFragment", "Fragment shader");
      ui.resetButton.textContent = t("gui.shadingCustomReset", "Reset to default");
      ui.applyButton.textContent = t("gui.shadingCustomApply", "Apply");
      ui.note.textContent = t("gui.shadingNote", "The model's own materials stay as they are: Original materials shows them again.");
      this.syncShadingPanel();
    },

    // The mode chosen; the custom shader only with WebGL (renderer-backend.js).
    syncShadingPanel() {
      const ui = this.shadingPanel;
      if (!ui) return;
      const active = this.shadingMode || DEFAULT_SHADING_MODE;
      Object.entries(ui.modeButtons).forEach(([mode, modeButton]) => {
        modeButton.classList.toggle("is-active", mode === active);
        modeButton.setAttribute("aria-checked", String(mode === active));
      });
      ui.shader.hidden = core.rendererBackend === "webgpu";
      ui.summary.classList.toggle("is-active", active === "custom");
    },
  });
}
