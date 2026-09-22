import { core } from "../core.js";
import { showToast, toastHelper } from "../viewer-utils.js";
import { t } from "../i18n-utils.js";
import THREE from "../init.js";

export const SHADING_MODES = ["standard", "phong", "lambert", "toon", "custom"];

export const DEFAULT_CUSTOM_VERTEX_SHADER = `varying vec3 vNormal;
varying vec2 vUv;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const DEFAULT_CUSTOM_FRAGMENT_SHADER = `uniform vec3 uColor;
uniform sampler2D uMap;
uniform bool uHasMap;
varying vec3 vNormal;
varying vec2 vUv;

void main() {
  vec3 base = uHasMap ? texture2D(uMap, vUv).rgb * uColor : uColor;
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

function buildMaterialForMode(baseMaterial, mode, customShader) {
  const color = baseMaterial.color ? baseMaterial.color.clone() : new THREE.Color(0xffffff);

  switch (mode) {
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

      const mode = SHADING_MODES.includes(this.shadingMode) ? this.shadingMode : "standard";
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

          const nextMaterials = child.userData.__shadingBaseMaterials.map((baseMaterial) => {
            const newMaterial = buildMaterialForMode(baseMaterial, mode, customShader);
            newMaterial.needsUpdate = true;
            return newMaterial;
          });

          child.material = Array.isArray(child.material) ? nextMaterials : nextMaterials[0];
        });
      });
    },

    setShadingMode(mode, options = {}) {
      if (!SHADING_MODES.includes(mode)) return;

      this.shadingMode = mode;
      if (mode === "custom") {
        this.customVertexShader = options.vertexShader || this.customVertexShader || DEFAULT_CUSTOM_VERTEX_SHADER;
        this.customFragmentShader = options.fragmentShader || this.customFragmentShader || DEFAULT_CUSTOM_FRAGMENT_SHADER;
      }

      this.applyShadingMode();
      this.updateEditorToolbarState?.();
      this.updateShadingSubmenuState?.();

      if (options.silent !== true) {
        toastHelper("shadingModeApplied", "success", { mode: t(`gui.shading${mode.charAt(0).toUpperCase()}${mode.slice(1)}`, mode) });
      }
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
        this.shadingDialogPosition = {
          left: Math.max(left + 12, left + width - panelWidth - 16),
          top: Math.max(top + 16, top + Math.min(40, Math.max(16, height * 0.08))),
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
