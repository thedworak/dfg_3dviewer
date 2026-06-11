import { core } from "../core.js";
import { showToast, toastHelper } from "../viewer-utils.js";
import { t } from "../i18n-utils.js";
import THREE from "../init.js";

export function attachMaterialsEditor(Viewer) {
  Object.assign(Viewer, {
    openMaterialsFolder(materialUuid = null) {
      this.buildMaterialsDialog();
      if (!this.materialsDialog) return;
      if (!this.materialsEditorObject || !this.materialsList?.length) {
        showToast(t("gui.selectByMaterial", "select by material"), "warning");
        return;
      }

      this.syncMaterialsDialogSelectionOptions();

      const nextUuid =
        materialUuid && materialUuid !== ""
          ? materialUuid
          : this.selectedMaterialUuid || this.materialsList[0]?.uuid || "";

      if (nextUuid) {
        this.selectMaterialInEditor(this.materialsEditorObject, nextUuid);
      }

      this.updateMaterialsDialogBounds();
      this.materialsDialog.hidden = false;
      this.syncMaterialsDialogFields();
      this.closeActionMenu();
      this.materialsDialogSelect?.focus();
    },

    destroyMaterialGuiControls() {
      if (this.materialGuiControls) {
        Object.values(this.materialGuiControls).forEach((controller) => {
          if (controller?.destroy) {
            controller.destroy();
          }
        });
        this.materialGuiControls = null;
      }
    },

    destroyMaterialSelectionController() {
      this.materialsEditorObject = null;
      this.selectedMaterialUuid = null;
      this.materialsList = [];
      if (this.materialsDialogSelect) {
        this.materialsDialogSelect.innerHTML = "";
      }
      this.syncMaterialsDialogFields();
    },

    getMaterialByUuid(object, uuid) {
      if (!object || !uuid) return null;
      let found = null;
      object.traverse((child) => {
        if (
          child.isMesh &&
          child.material
        ) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((material) => {
            if (material?.isMaterial && material.uuid === uuid) {
              found = material;
            }
          });
        }
      });
      return found;
    },

    normalizeMaterialColorValue(value, fallback = "#ffffff") {
      if (!value) return fallback;
      if (typeof value === "string") {
        if (value.startsWith("0x")) {
          return `#${value.slice(2).padStart(6, "0")}`;
        }
        return value.startsWith("#") ? value : `#${value}`;
      }
      if (typeof value.getHexString === "function") {
        return `#${value.getHexString()}`;
      }
      return fallback;
    },

    syncMaterialsDialogSelectionOptions() {
      if (!this.materialsDialogSelect) return;

      const currentValue = this.selectedMaterialUuid || "";
      this.materialsDialogSelect.innerHTML = "";

      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = t("gui.selectByMaterial", "select by material");
      this.materialsDialogSelect.appendChild(placeholder);

      this.materialsList.forEach((item) => {
        const option = document.createElement("option");
        option.value = item.uuid;
        option.textContent = item.label;
        this.materialsDialogSelect.appendChild(option);
      });

      this.materialsDialogSelect.value = currentValue;
    },

    updateMaterialsDialogLabels() {
      if (!this.materialsDialog) return;

      const title = this.materialsDialog.querySelector("#materialsDialogTitle");
      const closeButton = this.materialsDialog.querySelector(".materials-dialog__close");
      const fieldLabels = Array.from(
        this.materialsDialog.querySelectorAll(".materials-dialog__field > span")
      );
      const hint = this.materialsDialogInputs?.hint;
      const emptyState = this.materialsDialogInputs?.emptyState;

      if (title) {
        title.textContent = t("gui.materials", "Materials");
      }
      if (closeButton) {
        closeButton.setAttribute("aria-label", t("gui.materials", "Materials"));
      }

      if (fieldLabels.length > 0) {
        fieldLabels[0].textContent = t("gui.editMaterial", "Edit material");
      }
      if (fieldLabels.length > 1) {
        fieldLabels[1].textContent = t("gui.color", "Color");
      }
      if (fieldLabels.length > 2) {
        fieldLabels[2].textContent = t("gui.emissive", "Emissive");
      }
      if (fieldLabels.length > 3) {
        fieldLabels[3].textContent = t("gui.intensity", "Intensity");
      }
      if (fieldLabels.length > 4) {
        fieldLabels[4].textContent = t("gui.metalness", "Metalness");
      }

      if (this.materialsDialogSelect) {
        const placeholderOption = this.materialsDialogSelect.querySelector('option[value=""]');
        if (placeholderOption) {
          placeholderOption.textContent = t("gui.selectByMaterial", "select by material");
        }
      }

      if (hint) {
        hint.textContent = t("gui.selectByMaterial", "select by material");
      }
      if (emptyState) {
        emptyState.textContent = t("gui.selectByMaterial", "select by material");
      }
    },

    syncMaterialsDialogFields() {
      if (!this.materialsDialogInputs) return;

      const material = this.materialsEditorObject && this.selectedMaterialUuid
        ? this.getMaterialByUuid(this.materialsEditorObject, this.selectedMaterialUuid)
        : null;
      const hasMaterial = Boolean(material);
      const {
        color,
        emissiveColor,
        emissive,
        metalness,
        emptyState,
        hint,
      } = this.materialsDialogInputs;

      if (this.materialsDialogSelect) {
        this.materialsDialogSelect.disabled = this.materialsList.length === 0;
        this.materialsDialogSelect.value = this.selectedMaterialUuid || "";
      }

      [color, emissiveColor, emissive, metalness].forEach((input) => {
        if (input) input.disabled = !hasMaterial;
      });

      if (!hasMaterial) {
        if (color) color.value = "#ffffff";
        if (emissiveColor) emissiveColor.value = "#000000";
        if (emissive) emissive.value = "0";
        if (metalness) metalness.value = "0";
        if (emptyState) emptyState.hidden = this.materialsList.length > 0;
        if (hint) hint.textContent = t("gui.selectByMaterial", "select by material");
        return;
      }

      if (color) color.value = this.normalizeMaterialColorValue(material.color, "#ffffff");
      if (emissiveColor) emissiveColor.value = this.normalizeMaterialColorValue(material.emissive, "#000000");
      if (emissive) emissive.value = String(material.emissiveIntensity ?? 0);
      if (metalness) metalness.value = String(material.metalness ?? 0);
      if (emptyState) emptyState.hidden = true;
      if (hint) {
        hint.textContent =
          this.materialsList.find((item) => item.uuid === material.uuid)?.label || material.uuid;
      }
    },

    selectMaterialInEditor(object, value) {
      if (!object) return;
      if (!value) {
        this.destroyMaterialGuiControls();
        this.selectedMaterialUuid = null;
        this.refreshMaterialsToolbarMenu();
        this.syncMaterialsDialogFields();
        return;
      }

      this.destroyMaterialGuiControls();
      const material = this.getMaterialByUuid(object, value);
      if (!material) {
        this.selectedMaterialUuid = null;
        this.refreshMaterialsToolbarMenu();
        this.syncMaterialsDialogFields();
        return;
      }

      core.materialProperties.color = this.normalizeMaterialColorValue(material.color, "#ffffff");
      core.materialProperties.emissiveColor = this.normalizeMaterialColorValue(material.emissive, "#000000");
      core.materialProperties.emissive = material.emissiveIntensity ?? 0;
      core.materialProperties.metalness = material.metalness ?? 0;
      this.selectedMaterialUuid = value;
      this.syncMaterialsDialogSelectionOptions();
      this.refreshMaterialsToolbarMenu();
      this.syncMaterialsDialogFields();
    },

    initializeMaterialsEditor(object) {
      if (!object) return;
      this.destroyMaterialGuiControls();
      this.destroyMaterialSelectionController();

      const materials = new Map();
      const registerMaterial = (material) => {
        if (!material || !material.isMaterial || !material.uuid) return;
        if (!materials.has(material.uuid)) {
          materials.set(material.uuid, material);
        }
      };

      const gatherMaterials = (mesh) => {
        if (!mesh.material) return;
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(registerMaterial);
        } else {
          registerMaterial(mesh.material);
        }
      };

      if (object.isMesh) {
        gatherMaterials(object);
      }
      object.traverse((child) => {
        if (child.isMesh) {
          gatherMaterials(child);
        }
      });

      const options = {
        [t("gui.selectByMaterial", "select by material")]: "",
      };
      this.materialsList = [];

      materials.forEach((material, uuid) => {
        const label = material.name?.trim() ? material.name : uuid;
        options[label] = uuid;
        this.materialsList.push({ uuid, label });
      });

      core.materialsPropertiesText["Edit material"] = "";
      this.materialsEditorObject = object;
      this.refreshMaterialsToolbarMenu();
      this.syncMaterialsDialogSelectionOptions();
      this.syncMaterialsDialogFields();
    },

    refreshMaterialsToolbarMenu() {
      if (!this.materialsSubmenu) return;
      this.materialsSubmenu.innerHTML = "";

      const list = this.materialsList?.length ? this.materialsList : [];
      if (!list.length) {
        const emptyButton = document.createElement("button");
        emptyButton.type = "button";
        emptyButton.className = "viewer-editor-tool viewer-editor-tool_submenu-button viewer-editor-tool_submenu-control viewer-editor-tool_submenu-materials";
        emptyButton.disabled = true;
        const label = t("gui.selectByMaterial", "Select by material");
        const text = document.createElement("span");
        text.textContent = label;
        emptyButton.appendChild(text);
        this.materialsSubmenu.appendChild(emptyButton);
        return;
      }

      list.forEach((item) => {
        const subButton = document.createElement("button");
        subButton.type = "button";
        subButton.className = "viewer-editor-tool viewer-editor-tool_submenu-button viewer-editor-tool_submenu-control viewer-editor-tool_submenu-materials";
        if (item.uuid === this.selectedMaterialUuid) {
          subButton.classList.add("is-active");
        }
        subButton.dataset.materialUuid = item.uuid;
        subButton.setAttribute("title", item.label);
        subButton.setAttribute("aria-label", item.label);

        const iconSpan = document.createElement("span");
        iconSpan.className = "viewer-editor-tool_icon";
        iconSpan.setAttribute("aria-hidden", "true");
        iconSpan.innerHTML = this.getEditorToolbarIcon("color");
        subButton.appendChild(iconSpan);

        const labelSpan = document.createElement("span");
        labelSpan.className = "viewer-editor-tool_label";
        labelSpan.textContent = item.label;
        subButton.appendChild(labelSpan);

        this.bindEventListener(subButton, "click", (event) => {
          event.stopPropagation();
          this.openMaterialsFolder(item.uuid);
        });

        this.materialsSubmenu.appendChild(subButton);
      });
    },

    buildMaterialsDialog() {
      if (!core.container || this.materialsDialog) return;

      const dialog = document.createElement("div");
      dialog.id = "materialsDialog";
      dialog.className = "materials-dialog";
      dialog.hidden = true;
      dialog.innerHTML = `
        <div class="materials-dialog__backdrop" data-materials-dismiss="true"></div>
        <div class="materials-dialog__panel" role="dialog" aria-modal="true" aria-labelledby="materialsDialogTitle">
          <div class="materials-dialog__header">
            <h3 id="materialsDialogTitle">${t("gui.materials", "Materials")}</h3>
            <button type="button" class="materials-dialog__close" data-materials-dismiss="true" aria-label="${t("gui.materials", "Materials")}">&times;</button>
          </div>
          <div class="materials-dialog__body">
            <label class="materials-dialog__field">
              <span>${t("gui.editMaterial", "Edit material")}</span>
              <select id="materialsDialogSelect"></select>
            </label>
            <p id="materialsDialogHint" class="materials-dialog__hint">${t("gui.selectByMaterial", "select by material")}</p>
            <p id="materialsDialogEmpty" class="materials-dialog__empty">${t("gui.selectByMaterial", "select by material")}</p>
            <div class="materials-dialog__grid">
              <label class="materials-dialog__field">
                <span>${t("gui.color", "Color")}</span>
                <input id="materialsDialogColor" type="color" />
              </label>
              <label class="materials-dialog__field">
                <span>${t("gui.emissive", "Emissive")}</span>
                <input id="materialsDialogEmissiveColor" type="color" />
              </label>
              <label class="materials-dialog__field">
                <span>${t("gui.intensity", "Intensity")}</span>
                <input id="materialsDialogEmissive" type="range" min="0" max="1" step="0.01" />
              </label>
              <label class="materials-dialog__field">
                <span>${t("gui.metalness", "Metalness")}</span>
                <input id="materialsDialogMetalness" type="range" min="0" max="1" step="0.01" />
              </label>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(dialog);
      this.materialsDialog = dialog;
      this.materialsDialogPosition = null;
      this.materialsDialogSelect = dialog.querySelector("#materialsDialogSelect");
      const panel = dialog.querySelector(".materials-dialog__panel");
      const header = dialog.querySelector(".materials-dialog__header");
      this.materialsDialogInputs = {
        color: dialog.querySelector("#materialsDialogColor"),
        emissiveColor: dialog.querySelector("#materialsDialogEmissiveColor"),
        emissive: dialog.querySelector("#materialsDialogEmissive"),
        metalness: dialog.querySelector("#materialsDialogMetalness"),
        emptyState: dialog.querySelector("#materialsDialogEmpty"),
        hint: dialog.querySelector("#materialsDialogHint"),
      };

      this.bindEventListener(dialog, "click", (event) => {
        const dismissTrigger = event.target?.closest?.("[data-materials-dismiss='true']");
        if (dismissTrigger) {
          this.closeMaterialsDialog();
        }
      });

      this.bindEventListener(document, "keydown", (event) => {
        if (event.key !== "Escape") return;
        if (!this.materialsDialog || this.materialsDialog.hidden) return;
        event.preventDefault();
        this.closeMaterialsDialog();
      });

      const handleMaterialSelect = (event) => {
        this.selectMaterialInEditor(this.materialsEditorObject, event.target.value);
      };
      this.bindEventListener(this.materialsDialogSelect, "change", handleMaterialSelect);
      this.bindEventListener(this.materialsDialogSelect, "input", handleMaterialSelect);

      this.bindEventListener(this.materialsDialogInputs.color, "input", (event) => {
        const material = this.getMaterialByUuid(this.materialsEditorObject, this.selectedMaterialUuid);
        if (!material?.color) return;
        const value = event.target.value;
        core.materialProperties.color = value;
        material.color = new THREE.Color(value);
      });

      this.bindEventListener(this.materialsDialogInputs.emissiveColor, "input", (event) => {
        const material = this.getMaterialByUuid(this.materialsEditorObject, this.selectedMaterialUuid);
        if (!material || material.emissive === undefined) return;
        const value = event.target.value;
        core.materialProperties.emissiveColor = value;
        material.emissive = new THREE.Color(value);
      });

      this.bindEventListener(this.materialsDialogInputs.emissive, "input", (event) => {
        const material = this.getMaterialByUuid(this.materialsEditorObject, this.selectedMaterialUuid);
        if (!material) return;
        const value = parseFloat(event.target.value);
        core.materialProperties.emissive = value;
        material.emissiveIntensity = value;
      });

      this.bindEventListener(this.materialsDialogInputs.metalness, "input", (event) => {
        const material = this.getMaterialByUuid(this.materialsEditorObject, this.selectedMaterialUuid);
        if (!material) return;
        const value = parseFloat(event.target.value);
        core.materialProperties.metalness = value;
        material.metalness = value;
      });

      this.bindEventListener(header, "pointerdown", (event) => {
        if (event.button !== 0) return;
        if (event.target?.closest?.(".materials-dialog__close")) return;
        const targetRect =
          Viewer.mainCanvas?.getBoundingClientRect?.() ||
          core.container?.getBoundingClientRect?.();
        const panelRect = panel?.getBoundingClientRect?.();
        if (!targetRect || !panelRect) return;

        this.materialsDialogDragging = {
          offsetX: event.clientX - panelRect.left,
          offsetY: event.clientY - panelRect.top,
        };
        panel.setPointerCapture?.(event.pointerId);
        panel.classList.add("is-dragging");
        event.preventDefault();
      });

      this.bindEventListener(document, "pointermove", (event) => {
        if (!this.materialsDialogDragging || !this.materialsDialog || this.materialsDialog.hidden) return;
        const targetRect =
          Viewer.mainCanvas?.getBoundingClientRect?.() ||
          core.container?.getBoundingClientRect?.();
        const panelRect = panel?.getBoundingClientRect?.();
        if (!targetRect || !panelRect) return;

        const nextLeft = event.clientX - this.materialsDialogDragging.offsetX;
        const nextTop = event.clientY - this.materialsDialogDragging.offsetY;
        const minLeft = targetRect.left + 12;
        const maxLeft = targetRect.right - panelRect.width - 12;
        const minTop = targetRect.top + 12;
        const maxTop = targetRect.bottom - panelRect.height - 12;

        this.materialsDialogPosition = {
          left: Math.min(Math.max(nextLeft, minLeft), Math.max(minLeft, maxLeft)),
          top: Math.min(Math.max(nextTop, minTop), Math.max(minTop, maxTop)),
        };

        this.updateMaterialsDialogBounds();
      });

      const stopMaterialsDialogDrag = () => {
        this.materialsDialogDragging = false;
        panel?.classList.remove("is-dragging");
      };

      this.bindEventListener(document, "pointerup", stopMaterialsDialogDrag);
      this.bindEventListener(document, "pointercancel", stopMaterialsDialogDrag);

      this.bindEventListener(window, "resize", () => this.updateMaterialsDialogBounds());
      this.bindEventListener(window, "scroll", () => this.updateMaterialsDialogBounds(), true);
      this.bindEventListener(document, "fullscreenchange", () => this.updateMaterialsDialogBounds());

      this.syncMaterialsDialogSelectionOptions();
      this.syncMaterialsDialogFields();
    },

    updateMaterialsDialogBounds() {
      if (!this.materialsDialog) return;
      const targetRect =
        Viewer.mainCanvas?.getBoundingClientRect?.() ||
        core.container?.getBoundingClientRect?.();
      if (!targetRect) return;

      const left = Math.max(0, Math.round(targetRect.left));
      const top = Math.max(0, Math.round(targetRect.top));
      const width = Math.max(0, Math.round(targetRect.width));
      const height = Math.max(0, Math.round(targetRect.height));
      const panel = this.materialsDialog.querySelector(".materials-dialog__panel");
      const panelWidth = panel?.offsetWidth || Math.min(360, width - 24);
      const panelHeight = panel?.offsetHeight || Math.min(520, height - 24);

      if (!this.materialsDialogPosition) {
        this.materialsDialogPosition = {
          left: Math.max(left + 12, left + width - panelWidth - 16),
          top: Math.max(top + 16, top + Math.min(40, Math.max(16, height * 0.08))),
        };
      } else {
        const minLeft = left + 12;
        const maxLeft = left + width - panelWidth - 12;
        const minTop = top + 12;
        const maxTop = top + height - panelHeight - 12;
        this.materialsDialogPosition = {
          left: Math.min(Math.max(this.materialsDialogPosition.left, minLeft), Math.max(minLeft, maxLeft)),
          top: Math.min(Math.max(this.materialsDialogPosition.top, minTop), Math.max(minTop, maxTop)),
        };
      }

      this.materialsDialog.style.left = `${left}px`;
      this.materialsDialog.style.top = `${top}px`;
      this.materialsDialog.style.width = `${width}px`;
      this.materialsDialog.style.height = `${height}px`;
      if (panel) {
        panel.style.left = `${this.materialsDialogPosition.left - left}px`;
        panel.style.top = `${this.materialsDialogPosition.top - top}px`;
        panel.style.right = "auto";
        panel.style.transform = "none";
      }
    },

    closeMaterialsDialog() {
      if (!this.materialsDialog) return;
      this.materialsDialog.hidden = true;
    },
  });
}
