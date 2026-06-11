import { core } from "../core.js";
import { toastHelper } from "../viewer-utils.js";
import { t } from "../i18n-utils.js";

export function attachEmbedConfigurator(Viewer) {
  Object.assign(Viewer, {
    isEmbedModeActive() {
      return this.embedConfiguratorPanel?.hidden === false;
    },

    isEmbedMode() {
      const params = new URLSearchParams(window.location.search);
      const embedParam = params.get("embed");
      return window.location.pathname.endsWith("/embed.html") || embedParam === "1" || embedParam === "true";
    },

    getEmbedPageUrl() {
      const embedUrl = new URL("embed.html", import.meta.url);
      embedUrl.search = "";
      embedUrl.hash = "";
      return embedUrl;
    },

    async copyTextToClipboard(value) {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return;
      }

      const tempInput = document.createElement("textarea");
      tempInput.value = value;
      tempInput.setAttribute("readonly", "true");
      tempInput.style.position = "absolute";
      tempInput.style.left = "-9999px";
      document.body.appendChild(tempInput);
      tempInput.select();
      document.execCommand("copy");
      tempInput.remove();
    },

    getCurrentEmbedOptions({ includeCamera = false } = {}) {
      const entityId = core.CONFIG?.entity?.id;
      const modelPath = core.fileObject?.originalPath || core.container?.getAttribute("3d") || "";
      const options = {
        model: modelPath || null,
        id: entityId || null,
        theme: this.currentTheme === "light" ? "light" : null,
        autorotate: core.controls?.autoRotate === true,
        autorotateSpeed: Number.isFinite(core.controls?.autoRotateSpeed) ? core.controls.autoRotateSpeed : null,
        disableInteraction: this.urlOptions?.disableInteraction === true,
        hideUi: this.urlOptions?.hideUi === true,
        hideMetadata: this.urlOptions?.hideMetadata === true,
        presentationMode: core.PRESENTATION_MODE === true,
        sandboxMode: core.SANDBOX_MODE === true,
        cameraPosition: null,
        cameraTarget: null,
        fov: null,
      };

      if (includeCamera) {
        options.cameraPosition = this.formatVector3Param(core.camera?.position);
        options.cameraTarget = this.formatVector3Param(core.controls?.target);
        options.fov = Number.isFinite(core.camera?.fov) ? core.camera.fov : null;
      }

      return options;
    },

    applyEmbedOptionsToInputs(options = {}) {
      if (!this.embedConfigInputs) return;
      this.embedConfigInputs.model.value = options.model ?? "";
      this.embedConfigInputs.id.value = options.id ?? "";
      this.embedConfigInputs.theme.value = options.theme === "light" ? "light" : "dark";
      this.embedConfigInputs.autorotate.checked = options.autorotate === true;
      this.embedConfigInputs.autorotateSpeed.value = Number.isFinite(options.autorotateSpeed) ? String(options.autorotateSpeed) : "";
      this.embedConfigInputs.disableInteraction.checked = options.disableInteraction === true;
      this.embedConfigInputs.hideUi.checked = options.hideUi === true;
      this.embedConfigInputs.hideMetadata.checked = options.hideMetadata === true;
      this.embedConfigInputs.presentationMode.checked = options.presentationMode === true;
      this.embedConfigInputs.camPos.value = options.cameraPosition ?? "";
      this.embedConfigInputs.camTarget.value = options.cameraTarget ?? "";
      this.embedConfigInputs.fov.value = Number.isFinite(options.fov) ? String(options.fov) : "";
    },

    setEmbedInputError(input, hasError, message = "") {
      if (!input) return;
      input.classList.toggle("embed-input-invalid", hasError);
      if (hasError && message) {
        input.setAttribute("title", message);
        input.setAttribute("aria-invalid", "true");
      } else {
        input.removeAttribute("title");
        input.removeAttribute("aria-invalid");
      }
    },

    validateEmbedInputFields() {
      if (!this.embedConfigInputs) return true;
      const { camPos, camTarget, fov } = this.embedConfigInputs;
      const camPosRaw = camPos.value.trim();
      const camTargetRaw = camTarget.value.trim();
      const fovRaw = fov.value.trim();

      const camPosOk = camPosRaw === "" || this.parseVector3Param(camPosRaw) !== null;
      const camTargetOk = camTargetRaw === "" || this.parseVector3Param(camTargetRaw) !== null;
      const parsedFov = this.parseFloatParam(fovRaw);
      const fovOk = fovRaw === "" || (Number.isFinite(parsedFov) && parsedFov >= 1 && parsedFov <= 179);

      this.setEmbedInputError(camPos, !camPosOk, "Use format: x,y,z (for example 1.2,0.8,2.5)");
      this.setEmbedInputError(camTarget, !camTargetOk, "Use format: x,y,z (for example 0,0,0)");
      this.setEmbedInputError(fov, !fovOk, "FOV must be a number from 1 to 179");

      return camPosOk && camTargetOk && fovOk;
    },

    buildEmbedPayload(options = {}) {
      const embedUrl = this.getEmbedPageUrl();
      const params = new URLSearchParams();

      if (options.model) {
        params.set("model", options.model);
      } else if (options.id) {
        params.set("id", options.id);
      }

      if (options.theme === "light") {
        params.set("theme", options.theme);
      }

      if (options.autorotate === true) {
        params.set("autorotate", "1");
        if (Number.isFinite(options.autorotateSpeed)) {
          params.set("autorotateSpeed", String(options.autorotateSpeed));
        }
      }

      if (options.disableInteraction) {
        params.set("disableInteraction", "1");
      }
      if (options.hideUi) {
        params.set("hideUi", "1");
      }
      if (options.hideMetadata) {
        params.set("hideMetadata", "1");
      }
      if (options.presentationMode) {
        params.set("presentationMode", "1");
      }
      if (options.sandboxMode) {
        params.set("sandbox", "1");
      }
      if (options.cameraPosition) {
        params.set("camPos", options.cameraPosition);
      }
      if (options.cameraTarget) {
        params.set("camTarget", options.cameraTarget);
      }
      if (Number.isFinite(options.fov)) {
        params.set("fov", String(options.fov));
      }

      embedUrl.search = params.toString();

      return {
        url: embedUrl.toString(),
        code: `<iframe src="${embedUrl.toString()}" title="DFG 3D Viewer" loading="lazy" allow="fullscreen; xr-spatial-tracking" referrerpolicy="strict-origin-when-cross-origin" style="width:100%; aspect-ratio: 16 / 9; border: 0;"></iframe>`,
      };
    },

    getSharePayload() {
      return this.buildEmbedPayload(this.getCurrentEmbedOptions({ includeCamera: true }));
    },

    collectEmbedConfiguratorOptions() {
      const inputs = this.embedConfigInputs;
      if (!inputs) return this.getCurrentEmbedOptions({ includeCamera: true });
      const parsedCamPos = this.parseVector3Param(inputs.camPos.value);
      const parsedCamTarget = this.parseVector3Param(inputs.camTarget.value);
      const parsedFov = this.parseFloatParam(inputs.fov.value);
      const normalizedFov = Number.isFinite(parsedFov) ? Math.min(179, Math.max(1, parsedFov)) : null;
      return {
        model: inputs.model.value.trim() || null,
        id: inputs.id.value.trim() || null,
        theme: inputs.theme.value === "light" ? "light" : null,
        autorotate: inputs.autorotate.checked,
        autorotateSpeed: this.parseFloatParam(inputs.autorotateSpeed.value),
        disableInteraction: inputs.disableInteraction.checked,
        hideUi: inputs.hideUi.checked,
        hideMetadata: inputs.hideMetadata.checked,
        presentationMode: inputs.presentationMode.checked,
        cameraPosition: this.formatVector3Param(parsedCamPos),
        cameraTarget: this.formatVector3Param(parsedCamTarget),
        fov: normalizedFov,
      };
    },

    hasEmbedSourceSelection(options = {}) {
      return Boolean(options.model || options.id);
    },

    notifyMissingEmbedSource({ force = false } = {}) {
      if (!force && this.embedMissingSourceNotified) return;
      toastHelper("embedSourceMissing", "warning");
      this.embedMissingSourceNotified = true;
    },

    updateEmbedConfiguratorPreview() {
      if (!this.embedConfigInputs) return;
      this.validateEmbedInputFields();
      const options = this.collectEmbedConfiguratorOptions();
      if (!this.hasEmbedSourceSelection(options)) {
        this.notifyMissingEmbedSource();
      } else {
        this.embedMissingSourceNotified = false;
      }
      const payload = this.buildEmbedPayload(options);
      this.embedConfigInputs.url.value = payload.url;
      this.embedConfigInputs.iframe.value = payload.code;
      if (this.embedConfigPreviewFrame) {
        this.embedConfigPreviewFrame.src = payload.url;
      }
    },

    fillConfiguratorWithCurrentCamera() {
      if (!this.embedConfigInputs) return;
      this.embedConfigInputs.camPos.value = this.formatVector3Param(core.camera?.position) || "";
      this.embedConfigInputs.camTarget.value = this.formatVector3Param(core.controls?.target) || "";
      this.embedConfigInputs.fov.value = Number.isFinite(core.camera?.fov) ? String(core.camera.fov) : "";
      this.updateEmbedConfiguratorPreview();
    },

    resetEmbedConfiguratorFromViewerState() {
      if (!this.embedConfigInputs) return;
      this.applyEmbedOptionsToInputs(this.getCurrentEmbedOptions({ includeCamera: true }));
      this.updateEmbedConfiguratorPreview();
    },

    toggleEmbedConfigurator(event) {
      event?.preventDefault?.();
      this.closeActionMenu();
      if (!this.embedConfiguratorPanel) return;
      const willShow = this.embedConfiguratorPanel.hidden === true;
      this.embedConfiguratorPanel.hidden = !willShow;
      if (willShow) {
        this.updateEmbedConfiguratorPreview();
      }
      this.updateEmbedMenuEntryState();
    },

    openEmbedConfiguratorFromMenu(event) {
      this.toggleEmbedConfigurator(event);
    },

    createEmbedConfiguratorPanel() {
      if (!core.container || this.embedConfiguratorPanel) return;

      const defaults = this.getCurrentEmbedOptions({ includeCamera: true });
      const panelText = {
        title: t("embedPanel.title", "Embed options"),
        closeAria: t("embedPanel.closeAria", "Close embed options"),
        modelUrl: t("embedPanel.modelUrl", "Model URL"),
        modelUrlPlaceholder: t("embedPanel.modelUrlPlaceholder", "/examples/box.glb"),
        entityId: t("embedPanel.entityId", "Entity ID"),
        theme: t("embedPanel.theme", "Theme"),
        themeDark: t("embedPanel.themeDark", "Dark"),
        themeLight: t("embedPanel.themeLight", "Light"),
        autoRotateSpeed: t("embedPanel.autoRotateSpeed", "Auto-rotate speed"),
        cameraPosition: t("embedPanel.cameraPosition", "Camera position"),
        cameraTarget: t("embedPanel.cameraTarget", "Camera target"),
        cameraVectorPlaceholder: t("embedPanel.cameraVectorPlaceholder", "x,y,z"),
        fov: t("embedPanel.fov", "FOV"),
        autoRotate: t("embedPanel.autoRotate", "Auto-rotate"),
        disableInteraction: t("embedPanel.disableInteraction", "Disable interaction"),
        hideActionMenu: t("embedPanel.hideActionMenu", "Hide action menu"),
        hideMetadata: t("embedPanel.hideMetadata", "Hide metadata"),
        presentationMode: t("embedPanel.presentationMode", "Presentation mode"),
        useCurrentCamera: t("embedPanel.useCurrentCamera", "Use Current Camera"),
        resetFromViewer: t("embedPanel.resetFromViewer", "Reset From Viewer"),
        copyUrl: t("embedPanel.copyUrl", "Copy URL"),
        copyIframe: t("embedPanel.copyIframe", "Copy Iframe"),
        embedUrl: t("embedPanel.embedUrl", "Embed URL"),
        iframeCode: t("embedPanel.iframeCode", "Iframe code"),
        preview: t("embedPanel.preview", "Preview"),
        previewTitle: t("embedPanel.previewTitle", "Embed preview"),
      };
      const panel = document.createElement("div");
      panel.id = "embedConfiguratorPanel";
      panel.hidden = true;
      panel.innerHTML = `
      <div class="embed-config-header">
        <span>${panelText.title}</span>
        <button id="embedClosePanel" type="button" aria-label="${panelText.closeAria}">X</button>
      </div>
      <div class="embed-config-layout">
        <div class="embed-config-main">
          <div class="embed-config-grid">
            <label>${panelText.modelUrl}<input id="embedModelInput" type="text" placeholder="${panelText.modelUrlPlaceholder}" value="${defaults.model ?? ""}" /></label>
            <label>${panelText.entityId}<input id="embedIdInput" type="text" value="${defaults.id ?? ""}" /></label>
            <label>${panelText.theme}
              <select id="embedThemeInput">
                <option value="dark">${panelText.themeDark}</option>
                <option value="light"${defaults.theme === "light" ? " selected" : ""}>${panelText.themeLight}</option>
              </select>
            </label>
            <label>${panelText.autoRotateSpeed}<input id="embedAutorotateSpeedInput" type="number" step="0.1" value="${Number.isFinite(defaults.autorotateSpeed) ? defaults.autorotateSpeed : ""}" /></label>
            <label>${panelText.cameraPosition}<input id="embedCamPosInput" type="text" placeholder="${panelText.cameraVectorPlaceholder}" value="${defaults.cameraPosition ?? ""}" /></label>
            <label>${panelText.cameraTarget}<input id="embedCamTargetInput" type="text" placeholder="${panelText.cameraVectorPlaceholder}" value="${defaults.cameraTarget ?? ""}" /></label>
            <label>${panelText.fov}<input id="embedFovInput" type="number" step="1" min="1" max="179" value="${Number.isFinite(defaults.fov) ? defaults.fov : ""}" /></label>
          </div>
          <div class="embed-config-checks">
            <label><input id="embedAutorotateInput" type="checkbox"${defaults.autorotate ? " checked" : ""} /> ${panelText.autoRotate}</label>
            <label><input id="embedDisableInteractionInput" type="checkbox"${defaults.disableInteraction ? " checked" : ""} /> ${panelText.disableInteraction}</label>
            <label><input id="embedHideUiInput" type="checkbox"${defaults.hideUi ? " checked" : ""} /> ${panelText.hideActionMenu}</label>
            <label><input id="embedHideMetadataInput" type="checkbox"${defaults.hideMetadata ? " checked" : ""} /> ${panelText.hideMetadata}</label>
            <label><input id="embedPresentationModeInput" type="checkbox"${defaults.presentationMode ? " checked" : ""} /> ${panelText.presentationMode}</label>
          </div>
          <div class="embed-config-actions">
            <button id="embedUseCurrentCamera" type="button">${panelText.useCurrentCamera}</button>
            <button id="embedResetFromViewer" type="button">${panelText.resetFromViewer}</button>
            <button id="embedCopyUrl" type="button">${panelText.copyUrl}</button>
            <button id="embedCopyIframe" type="button">${panelText.copyIframe}</button>
          </div>
          <label class="embed-config-field">${panelText.embedUrl}<textarea id="embedUrlOutput" readonly></textarea></label>
          <label class="embed-config-field">${panelText.iframeCode}<textarea id="embedIframeOutput" readonly></textarea></label>
        </div>
        <div class="embed-config-preview-side">
          <span>${panelText.preview}</span>
          <iframe id="embedPreviewFrame" title="${panelText.previewTitle}" loading="lazy"></iframe>
        </div>
      </div>
    `;

      core.container.appendChild(panel);
      this.embedConfiguratorPanel = panel;
      this.embedConfigInputs = {
        model: panel.querySelector("#embedModelInput"),
        id: panel.querySelector("#embedIdInput"),
        theme: panel.querySelector("#embedThemeInput"),
        autorotate: panel.querySelector("#embedAutorotateInput"),
        autorotateSpeed: panel.querySelector("#embedAutorotateSpeedInput"),
        disableInteraction: panel.querySelector("#embedDisableInteractionInput"),
        hideUi: panel.querySelector("#embedHideUiInput"),
        hideMetadata: panel.querySelector("#embedHideMetadataInput"),
        presentationMode: panel.querySelector("#embedPresentationModeInput"),
        camPos: panel.querySelector("#embedCamPosInput"),
        camTarget: panel.querySelector("#embedCamTargetInput"),
        fov: panel.querySelector("#embedFovInput"),
        url: panel.querySelector("#embedUrlOutput"),
        iframe: panel.querySelector("#embedIframeOutput"),
      };
      this.embedConfigPreviewFrame = panel.querySelector("#embedPreviewFrame");

      const watchedInputs = [
        this.embedConfigInputs.model,
        this.embedConfigInputs.id,
        this.embedConfigInputs.theme,
        this.embedConfigInputs.autorotate,
        this.embedConfigInputs.autorotateSpeed,
        this.embedConfigInputs.disableInteraction,
        this.embedConfigInputs.hideUi,
        this.embedConfigInputs.hideMetadata,
        this.embedConfigInputs.presentationMode,
        this.embedConfigInputs.camPos,
        this.embedConfigInputs.camTarget,
        this.embedConfigInputs.fov,
      ];
      watchedInputs.forEach((input) => {
        if (!input) return;
        const eventName = input.type === "checkbox" || input.tagName === "SELECT" ? "change" : "input";
        this.bindEventListener(input, eventName, () => this.updateEmbedConfiguratorPreview());
      });

      const useCurrentCameraButton = panel.querySelector("#embedUseCurrentCamera");
      const resetFromViewerButton = panel.querySelector("#embedResetFromViewer");
      const copyUrlButton = panel.querySelector("#embedCopyUrl");
      const copyIframeButton = panel.querySelector("#embedCopyIframe");
      const closePanelButton = panel.querySelector("#embedClosePanel");

      this.bindEventListener(useCurrentCameraButton, "click", () => this.fillConfiguratorWithCurrentCamera());
      this.bindEventListener(resetFromViewerButton, "click", () => this.resetEmbedConfiguratorFromViewerState());
      this.bindEventListener(closePanelButton, "click", () => {
        this.closeEmbedConfigurator();
      });
      this.bindEventListener(copyUrlButton, "click", async () => {
        try {
          const options = this.collectEmbedConfiguratorOptions();
          if (!this.hasEmbedSourceSelection(options)) {
            this.notifyMissingEmbedSource({ force: true });
            return;
          }
          const payload = this.buildEmbedPayload(options);
          await this.copyTextToClipboard(payload.url);
          toastHelper("embedUrlCopied", "success");
        } catch (error) {
          this.reportError(error, { context: "Copy embed URL failed" });
          toastHelper("embedUrlCopyError", "error");
        }
      });
      this.bindEventListener(copyIframeButton, "click", async () => {
        try {
          const options = this.collectEmbedConfiguratorOptions();
          if (!this.hasEmbedSourceSelection(options)) {
            this.notifyMissingEmbedSource({ force: true });
            return;
          }
          const payload = this.buildEmbedPayload(options);
          await this.copyTextToClipboard(payload.code);
          toastHelper("embedIframeCopied", "success");
        } catch (error) {
          this.reportError(error, { context: "Copy embed iframe failed" });
          toastHelper("embedIframeCopyError", "error");
        }
      });

      this.updateEmbedConfiguratorPreview();
    },

    async copyEmbedCode(event) {
      event?.preventDefault?.();
      this.closeActionMenu();

      try {
        const { code } = this.getSharePayload();
        await this.copyTextToClipboard(code);
        toastHelper("embedCodeCopied", "success");
      } catch (error) {
        this.reportError(error, { context: "Copy embed code failed" });
        toastHelper("embedCodeCopyError", "error");
      }
    },

    updateEmbedMenuEntryState() {
      if (!this.viewEntity) return;
      const isActive = this.isEmbedModeActive();
      const label = isActive ? t("menu.exitEmbed", "Exit embed") : t("menu.embed", "Embed");
      const iconClass = isActive ? "embed-exit-icon" : "embed-icon";
      this.viewEntity.innerHTML = `<span class="${iconClass}"></span><span>${label}</span>`;
      const a11yLabel = isActive
        ? t("menu.exitEmbedMode", "Exit embed mode")
        : t("menu.openEmbedOptions", "Open embed options");
      this.viewEntity.setAttribute("aria-label", a11yLabel);
      this.viewEntity.setAttribute("title", a11yLabel);
    },

    closeEmbedConfigurator() {
      if (this.embedConfiguratorPanel) {
        this.embedConfiguratorPanel.hidden = true;
      }
      this.updateEmbedMenuEntryState();
    },

    closeEmbedMode() {
      this.closeEmbedConfigurator();
    },
  });
}
