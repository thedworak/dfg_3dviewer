import { core } from "../core.js";
import { showToast, toastHelper } from "../viewer-utils.js";
import { t } from "../i18n-utils.js";
import THREE from "../init.js";
import { attachToolPanelChrome } from "../ui/tool-panel-chrome.js";

// "original": the loader's own materials, as loaded. The others are made
// from them on each switch (see buildMaterialForMode); "clay", "matcap",
// "flat" and "normals" are for reading the geometry of a scan.
export const SHADING_MODES = ["original", "standard", "phong", "lambert", "toon", "flat", "clay", "matcap", "normals", "custom"];
export const DEFAULT_SHADING_MODE = "original";

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

    setShadingMode(mode, options = {}) {
      if (!SHADING_MODES.includes(mode)) return;

      this.shadingMode = mode;
      if (mode === "custom") {
        this.customVertexShader = options.vertexShader || this.customVertexShader || DEFAULT_CUSTOM_VERTEX_SHADER;
        this.customFragmentShader = options.fragmentShader || this.customFragmentShader || DEFAULT_CUSTOM_FRAGMENT_SHADER;
      }

      if (mode === "custom") this.watchCustomShaderErrors();
      this.applyShadingMode();
      this.updateEditorToolbarState?.();
      this.updateShadingSubmenuState?.();

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

    openCustomShaderDialog() {
      this.buildShadingDialog();
      if (!this.shadingDialog) return;

      if (this.shadingDialogInputs) {
        this.shadingDialogInputs.vertex.value = this.customVertexShader || DEFAULT_CUSTOM_VERTEX_SHADER;
        this.shadingDialogInputs.fragment.value = this.customFragmentShader || DEFAULT_CUSTOM_FRAGMENT_SHADER;
      }

      this.updateShadingDialogBounds();
      this.shadingDialog.hidden = false;
      this.closeActionMenu?.();
    },

    closeShadingDialog() {
      if (!this.shadingDialog) return;
      this.shadingDialog.hidden = true;
    },

    buildShadingDialog() {
      if (!core.container || this.shadingDialog) return;

      const dialog = document.createElement("div");
      dialog.id = "shadingDialog";
      dialog.className = "materials-dialog";
      dialog.hidden = true;
      dialog.innerHTML = `
        <div class="materials-dialog__backdrop" data-shading-dismiss="true"></div>
        <div class="materials-dialog__panel" role="dialog" aria-modal="true" aria-labelledby="shadingDialogTitle">
          <div class="materials-dialog__header">
            <h3 id="shadingDialogTitle">${t("gui.shadingCustom", "Custom shader")}</h3>
            <button type="button" class="materials-dialog__close" data-shading-dismiss="true" aria-label="${t("gui.shadingCustom", "Custom shader")}">&times;</button>
          </div>
          <div class="materials-dialog__body">
            <label class="materials-dialog__field">
              <span>${t("gui.shadingCustomVertex", "Vertex shader")}</span>
              <textarea id="shadingDialogVertex" class="shading-dialog__textarea" spellcheck="false"></textarea>
            </label>
            <label class="materials-dialog__field">
              <span>${t("gui.shadingCustomFragment", "Fragment shader")}</span>
              <textarea id="shadingDialogFragment" class="shading-dialog__textarea" spellcheck="false"></textarea>
            </label>
            <div class="shading-dialog__actions">
              <button type="button" id="shadingDialogReset" class="shading-dialog__button">${t("gui.shadingCustomReset", "Reset to default")}</button>
              <button type="button" id="shadingDialogApply" class="shading-dialog__button shading-dialog__button-primary">${t("gui.shadingCustomApply", "Apply")}</button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(dialog);
      this.shadingDialog = dialog;
      this.shadingDialogPosition = null;
      const panel = dialog.querySelector(".materials-dialog__panel");
      const header = dialog.querySelector(".materials-dialog__header");
      attachToolPanelChrome(panel, header, {
        before: header.querySelector(".materials-dialog__close"),
        movable: false,
        visibilityRoot: dialog,
      });
      this.shadingDialogInputs = {
        vertex: dialog.querySelector("#shadingDialogVertex"),
        fragment: dialog.querySelector("#shadingDialogFragment"),
      };

      this.bindEventListener(dialog, "click", (event) => {
        const dismissTrigger = event.target?.closest?.("[data-shading-dismiss='true']");
        if (dismissTrigger) {
          this.closeShadingDialog();
        }
      });

      this.bindEventListener(document, "keydown", (event) => {
        if (event.key !== "Escape") return;
        if (!this.shadingDialog || this.shadingDialog.hidden) return;
        event.preventDefault();
        this.closeShadingDialog();
      });

      this.bindEventListener(dialog.querySelector("#shadingDialogReset"), "click", () => {
        this.shadingDialogInputs.vertex.value = DEFAULT_CUSTOM_VERTEX_SHADER;
        this.shadingDialogInputs.fragment.value = DEFAULT_CUSTOM_FRAGMENT_SHADER;
      });

      this.bindEventListener(dialog.querySelector("#shadingDialogApply"), "click", () => {
        const vertexShader = this.shadingDialogInputs.vertex.value;
        const fragmentShader = this.shadingDialogInputs.fragment.value;
        this.setShadingMode("custom", { vertexShader, fragmentShader });
      });

      this.bindEventListener(header, "pointerdown", (event) => {
        if (event.button !== 0) return;
        if (event.target?.closest?.(".materials-dialog__close")) return;
        const targetRect =
          Viewer.mainCanvas?.getBoundingClientRect?.() ||
          core.container?.getBoundingClientRect?.();
        const panelRect = panel?.getBoundingClientRect?.();
        if (!targetRect || !panelRect) return;

        this.shadingDialogDragging = {
          offsetX: event.clientX - panelRect.left,
          offsetY: event.clientY - panelRect.top,
        };
        panel.setPointerCapture?.(event.pointerId);
        panel.classList.add("is-dragging");
        event.preventDefault();
      });

      this.bindEventListener(document, "pointermove", (event) => {
        if (!this.shadingDialogDragging || !this.shadingDialog || this.shadingDialog.hidden) return;
        const targetRect =
          Viewer.mainCanvas?.getBoundingClientRect?.() ||
          core.container?.getBoundingClientRect?.();
        const panelRect = panel?.getBoundingClientRect?.();
        if (!targetRect || !panelRect) return;

        const nextLeft = event.clientX - this.shadingDialogDragging.offsetX;
        const nextTop = event.clientY - this.shadingDialogDragging.offsetY;
        const minLeft = targetRect.left + 12;
        const maxLeft = targetRect.right - panelRect.width - 12;
        const minTop = targetRect.top + 12;
        const maxTop = targetRect.bottom - panelRect.height - 12;

        this.shadingDialogPosition = {
          left: Math.min(Math.max(nextLeft, minLeft), Math.max(minLeft, maxLeft)),
          top: Math.min(Math.max(nextTop, minTop), Math.max(minTop, maxTop)),
        };

        this.updateShadingDialogBounds();
      });

      const stopShadingDialogDrag = () => {
        this.shadingDialogDragging = false;
        panel?.classList.remove("is-dragging");
      };

      this.bindEventListener(document, "pointerup", stopShadingDialogDrag);
      this.bindEventListener(document, "pointercancel", stopShadingDialogDrag);

      this.bindEventListener(window, "resize", () => this.updateShadingDialogBounds());
      this.bindEventListener(window, "scroll", () => this.updateShadingDialogBounds(), true);
      this.bindEventListener(document, "fullscreenchange", () => this.updateShadingDialogBounds());
    },

    updateShadingDialogBounds() {
      if (!this.shadingDialog) return;
      const targetRect =
        Viewer.mainCanvas?.getBoundingClientRect?.() ||
        core.container?.getBoundingClientRect?.();
      if (!targetRect) return;

      const left = Math.max(0, Math.round(targetRect.left));
      const top = Math.max(0, Math.round(targetRect.top));
      const width = Math.max(0, Math.round(targetRect.width));
      const height = Math.max(0, Math.round(targetRect.height));
      const panel = this.shadingDialog.querySelector(".materials-dialog__panel");
      const panelWidth = panel?.offsetWidth || Math.min(640, width - 24);
      const panelHeight = panel?.offsetHeight || Math.min(700, height * 0.88);

      if (!this.shadingDialogPosition) {
        // The top right corner, like the other tool panels (side stack).
        this.shadingDialogPosition = {
          left: Math.max(left + 12, left + width - panelWidth - 12),
          top: top + 12,
        };
      } else {
        const minLeft = left + 12;
        const maxLeft = left + width - panelWidth - 12;
        const minTop = top + 12;
        const maxTop = top + height - panelHeight - 12;
        this.shadingDialogPosition = {
          left: Math.min(Math.max(this.shadingDialogPosition.left, minLeft), Math.max(minLeft, maxLeft)),
          top: Math.min(Math.max(this.shadingDialogPosition.top, minTop), Math.max(minTop, maxTop)),
        };
      }

      this.shadingDialog.style.left = `${left}px`;
      this.shadingDialog.style.top = `${top}px`;
      this.shadingDialog.style.width = `${width}px`;
      this.shadingDialog.style.height = `${height}px`;
      if (panel) {
        panel.style.left = `${this.shadingDialogPosition.left - left}px`;
        panel.style.top = `${this.shadingDialogPosition.top - top}px`;
        panel.style.right = "auto";
        panel.style.transform = "none";
      }
    },
  });
}
