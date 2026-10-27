import { core } from "../core.js";
import { toastHelper } from "../viewer-utils.js";
import { t } from "../i18n-utils.js";
import { makeDraggable } from "./panel-window.js";

const AXES = ["x", "y", "z"];
// The embed's proportions (the iframe code's aspect-ratio, the preview's).
const EMBED_ASPECTS = ["16:9", "4:3", "1:1", "21:9", "3:4"];
// The preview is a whole viewer: loaded again once the typing stops.
const EMBED_PREVIEW_DELAY_MS = 600;

// A coordinate in a narrow field: fewer decimals the larger it is.
function shortNumber(value) {
  const size = Math.abs(value);
  return String(Number(value.toFixed(size >= 100 ? 1 : size >= 10 ? 2 : 3)));
}

// An embed sits on another site: the model by its full address.
function absoluteModelUrl(path) {
  if (!path) return null;
  try {
    return new URL(path, window.location.href).href;
  } catch {
    return path;
  }
}

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));

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
      // "embed.html" is kept out of the literal `new URL(...)` call on purpose:
      // bundlers (Parcel in particular) statically resolve a literal first
      // argument as a build-time asset relative to this source file, but
      // embed.html only ever lives next to the built module at runtime
      // (dist/<target>/embed.html), not next to viewer/ui/ in source.
      // This module is bundled into a chunk under assets/, one level below
      // the entry module and embed.html (the same case as viewer-settings.json
      // in main.js).
      let moduleUrl = new URL(import.meta.url);
      if (moduleUrl.protocol !== "http:" && moduleUrl.protocol !== "https:") {
        // Parcel's dev server hands back a non-fetchable placeholder here.
        moduleUrl = new URL(window.location.href);
      }
      const embedFileName = moduleUrl.pathname.includes("/assets/") ? "../embed.html" : "embed.html";
      const embedUrl = new URL(embedFileName, moduleUrl);
      embedUrl.search = "";
      embedUrl.hash = "";
      return embedUrl;
    },

    getViewerPageUrl() {
      const viewerUrl = new URL(window.location.href);
      viewerUrl.search = "";
      viewerUrl.hash = "";

      if (viewerUrl.pathname.endsWith("/embed.html")) {
        viewerUrl.pathname = viewerUrl.pathname.replace(/\/embed\.html$/, "/index.html");
      }

      return viewerUrl;
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
      // The model on screen (main.js mainLoadModelWrapper); before the first
      // load, the one the page names.
      const modelPath = this.shownModelUrl !== undefined
        ? this.shownModelUrl
        : core.fileObject?.originalPath || core.container?.getAttribute("3d") || "";
      const options = {
        model: absoluteModelUrl(modelPath),
        id: entityId || null,
        theme: this.currentTheme === "light" ? "light" : null,
        language: null,
        aspect: EMBED_ASPECTS[0],
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
        cameraProjection: null,
        cameraZoom: null,
        clippingMode: null,
        clippingConstants: null,
        clippingOutline: null,
        clippingNegated: null,
      };

      if (includeCamera) {
        options.cameraPosition = this.formatVector3Param(core.camera?.position);
        options.cameraTarget = this.formatVector3Param(core.controls?.target);
        options.fov = Number.isFinite(core.camera?.fov) ? core.camera.fov : null;
        options.cameraProjection = core.camera?.isOrthographicCamera ? "orthographic" : "perspective";
        options.cameraZoom = Number.isFinite(core.camera?.zoom) ? core.camera.zoom : null;
        options.clippingMode = this.formatClippingModeParam(core.planeParams?.clippingMode);

        // The section planes only while one cuts the model: their places
        // belong to the model on screen.
        if (options.clippingMode) {
          const clipX = Number(core.clippingPlanes?.[0]?.constant);
          const clipY = Number(core.clippingPlanes?.[1]?.constant);
          const clipZ = Number(core.clippingPlanes?.[2]?.constant);
          if (Number.isFinite(clipX) && Number.isFinite(clipY) && Number.isFinite(clipZ)) {
            options.clippingConstants = this.formatVector3Param({ x: clipX, y: clipY, z: clipZ });
          }
          options.clippingOutline = core.planeParams?.outline?.visible === true;
          options.clippingNegated = this.formatClippingModeParam(this.getClippingNegatedState?.());
        }
      }

      return options;
    },

    // The camera's vectors: three number fields each (x, y, z), and the
    // hidden "x,y,z" field the address is built from.
    setEmbedVectorInputs(key, value) {
      const inputs = this.embedConfigInputs;
      if (!inputs) return;
      inputs[key].value = value ?? "";
      const vector = this.parseVector3Param(value);
      AXES.forEach((axis) => {
        inputs[`${key}${axis.toUpperCase()}`].value = vector ? shortNumber(vector[axis]) : "";
      });
    },

    syncEmbedVectorInput(key) {
      const inputs = this.embedConfigInputs;
      const parts = AXES.map((axis) => inputs[`${key}${axis.toUpperCase()}`].value.trim());
      inputs[key].value = parts.every((part) => part === "") ? "" : parts.join(",");
    },

    applyEmbedOptionsToInputs(options = {}) {
      const inputs = this.embedConfigInputs;
      if (!inputs) return;
      inputs.model.value = options.model ?? "";
      inputs.id.value = options.id ?? "";
      inputs.theme.value = options.theme === "light" ? "light" : "dark";
      inputs.language.value = options.language ?? "";
      inputs.aspect.value = EMBED_ASPECTS.includes(options.aspect) ? options.aspect : EMBED_ASPECTS[0];
      inputs.autorotate.checked = options.autorotate === true;
      inputs.autorotateSpeed.value = Number.isFinite(options.autorotateSpeed) ? String(options.autorotateSpeed) : "";
      inputs.disableInteraction.checked = options.disableInteraction === true;
      inputs.hideUi.checked = options.hideUi === true;
      inputs.hideMetadata.checked = options.hideMetadata === true;
      inputs.presentationMode.checked = options.presentationMode === true;
      this.setEmbedVectorInputs("camPos", options.cameraPosition);
      this.setEmbedVectorInputs("camTarget", options.cameraTarget);
      inputs.fov.value = Number.isFinite(options.fov) ? String(Number(options.fov.toFixed(2))) : "";
      this.syncEmbedAutorotate();
    },

    // The speed counts only while auto-rotate is on.
    syncEmbedAutorotate() {
      const inputs = this.embedConfigInputs;
      if (inputs) inputs.autorotateSpeed.disabled = !inputs.autorotate.checked;
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
      const inputs = this.embedConfigInputs;
      if (!inputs) return true;
      // A vector: all three numbers, or none.
      const vectorOk = (key) => {
        const fields = AXES.map((axis) => inputs[`${key}${axis.toUpperCase()}`]);
        const filled = fields.filter((field) => field.value.trim() !== "");
        const ok = filled.length === 0 || (filled.length === 3 && fields.every((field) => Number.isFinite(Number(field.value))));
        const message = t("embedPanel.vectorHint", "Give all three numbers, or none");
        fields.forEach((field) => this.setEmbedInputError(field, !ok, message));
        return ok;
      };
      const camPosOk = vectorOk("camPos");
      const camTargetOk = vectorOk("camTarget");
      const fovRaw = inputs.fov.value.trim();
      const parsedFov = this.parseFloatParam(fovRaw);
      const fovOk = fovRaw === "" || (Number.isFinite(parsedFov) && parsedFov >= 1 && parsedFov <= 179);
      this.setEmbedInputError(inputs.fov, !fovOk, t("embedPanel.fovHint", "FOV: a number from 1 to 179"));
      return camPosOk && camTargetOk && fovOk;
    },

    buildViewerParams(options = {}) {
      const params = new URLSearchParams();

      if (options.model) {
        params.set("model", options.model);
      } else if (options.id) {
        params.set("id", options.id);
      }

      if (options.theme === "light") {
        params.set("theme", options.theme);
      }
      if (options.language) {
        params.set("lang", options.language);
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
      if (options.cameraProjection === "orthographic" || options.cameraProjection === "perspective") {
        params.set("projection", options.cameraProjection);
      }
      if (Number.isFinite(options.cameraZoom) && options.cameraProjection === "orthographic") {
        params.set("zoom", String(options.cameraZoom));
      }
      if (options.clippingMode) {
        params.set("clip", options.clippingMode);
      }
      if (options.clippingConstants) {
        params.set("clipConst", options.clippingConstants);
      }
      if (options.clippingNegated) {
        params.set("clipFlip", options.clippingNegated);
      }
      if (typeof options.clippingOutline === "boolean") {
        params.set("clipOutline", options.clippingOutline ? "1" : "0");
      }

      return params;
    },

    buildEmbedPayload(options = {}) {
      const embedUrl = this.getEmbedPageUrl();
      const params = this.buildViewerParams(options);
      embedUrl.search = params.toString();
      const aspect = EMBED_ASPECTS.includes(options.aspect) ? options.aspect : EMBED_ASPECTS[0];

      return {
        url: embedUrl.toString(),
        code: `<iframe src="${embedUrl.toString()}" title="DFG 3D Viewer" loading="lazy" allow="fullscreen; xr-spatial-tracking" referrerpolicy="strict-origin-when-cross-origin" style="width:100%; aspect-ratio: ${aspect.replace(":", " / ")}; border: 0; background: transparent;"></iframe>`,
      };
    },

    buildViewerPayload(options = {}) {
      const viewerUrl = this.getViewerPageUrl();
      const params = this.buildViewerParams(options);
      viewerUrl.search = params.toString();
      return { url: viewerUrl.toString() };
    },

    getEmbedPayload() {
      return this.buildEmbedPayload(this.getCurrentEmbedOptions({ includeCamera: true }));
    },

    getSharePayload() {
      return this.buildViewerPayload(this.getCurrentEmbedOptions({ includeCamera: true }));
    },

    collectEmbedConfiguratorOptions() {
      const inputs = this.embedConfigInputs;
      if (!inputs) return this.getCurrentEmbedOptions({ includeCamera: true });
      const currentViewState = this.getCurrentEmbedOptions({ includeCamera: true });
      const parsedCamPos = this.parseVector3Param(inputs.camPos.value);
      const parsedCamTarget = this.parseVector3Param(inputs.camTarget.value);
      const parsedFov = this.parseFloatParam(inputs.fov.value);
      const normalizedFov = Number.isFinite(parsedFov) ? Math.min(179, Math.max(1, parsedFov)) : null;
      return {
        model: inputs.model.value.trim() || null,
        id: inputs.id.value.trim() || null,
        theme: inputs.theme.value === "light" ? "light" : null,
        language: inputs.language.value || null,
        aspect: inputs.aspect.value,
        autorotate: inputs.autorotate.checked,
        autorotateSpeed: this.parseFloatParam(inputs.autorotateSpeed.value),
        disableInteraction: inputs.disableInteraction.checked,
        hideUi: inputs.hideUi.checked,
        hideMetadata: inputs.hideMetadata.checked,
        presentationMode: inputs.presentationMode.checked,
        cameraPosition: this.formatVector3Param(parsedCamPos),
        cameraTarget: this.formatVector3Param(parsedCamTarget),
        fov: normalizedFov,
        cameraProjection: currentViewState.cameraProjection,
        cameraZoom: currentViewState.cameraZoom,
        clippingMode: currentViewState.clippingMode,
        clippingConstants: currentViewState.clippingConstants,
        clippingOutline: currentViewState.clippingOutline,
        clippingNegated: currentViewState.clippingNegated,
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

    // The address and the code at once; the preview (a whole viewer) once
    // the typing stops.
    updateEmbedConfiguratorPreview({ immediate = false } = {}) {
      const inputs = this.embedConfigInputs;
      if (!inputs) return;
      if (this.updatingEmbedFields) return;
      this.validateEmbedInputFields();
      const options = this.collectEmbedConfiguratorOptions();
      const hasSource = this.hasEmbedSourceSelection(options);
      if (!hasSource) {
        this.notifyMissingEmbedSource();
      } else {
        this.embedMissingSourceNotified = false;
      }
      const payload = this.buildEmbedPayload(options);
      inputs.url.value = payload.url;
      inputs.iframe.value = payload.code;
      this.embedConfiguratorPanel.style.setProperty("--embed-aspect", options.aspect.replace(":", " / "));
      this.embedConfiguratorPanel.querySelector(".embed-config-empty").hidden = hasSource;
      this.fitEmbedPreview();
      clearTimeout(this.embedPreviewTimer);
      const load = () => {
        const frame = this.embedConfigPreviewFrame;
        if (!frame) return;
        const src = hasSource ? payload.url : "about:blank";
        if (frame.getAttribute("src") !== src) frame.setAttribute("src", src);
      };
      if (immediate) load();
      else this.embedPreviewTimer = setTimeout(load, EMBED_PREVIEW_DELAY_MS);
    },

    // The preview at the embed's proportions, as large as its area allows.
    fitEmbedPreview() {
      const panel = this.embedConfiguratorPanel;
      const stage = panel?.querySelector(".embed-config-stage");
      const frame = this.embedConfigPreviewFrame;
      if (!stage || !frame || panel.hidden) return;
      const [w, h] = (this.embedConfigInputs.aspect.value || EMBED_ASPECTS[0]).split(":").map(Number);
      const ratio = w / h;
      const width = Math.min(stage.clientWidth, stage.clientHeight * ratio);
      frame.style.width = `${Math.floor(width)}px`;
      frame.style.height = `${Math.floor(width / ratio)}px`;
    },

    fillConfiguratorWithCurrentCamera() {
      if (!this.embedConfigInputs) return;

      this.updatingEmbedFields = true;

      const activeCamera = core.camera;
      const activeControls = core.controls;

      this.setEmbedVectorInputs("camPos", this.formatVector3Param(activeCamera?.position));
      this.setEmbedVectorInputs("camTarget", this.formatVector3Param(activeControls?.target));
      this.embedConfigInputs.fov.value = Number.isFinite(activeCamera?.fov) ? String(Number(activeCamera.fov.toFixed(2))) : "";

      this.updatingEmbedFields = false;
      this.updateEmbedConfiguratorPreview({ immediate: true });
    },

    resetEmbedConfiguratorFromViewerState() {
      if (!this.embedConfigInputs) return;
      this.applyEmbedOptionsToInputs(this.getCurrentEmbedOptions({ includeCamera: true }));
      this.updateEmbedConfiguratorPreview({ immediate: true });
    },

    toggleEmbedConfigurator(event) {
      event?.preventDefault?.();
      this.closeActionMenu();
      if (!this.embedConfiguratorPanel) return;
      const willShow = this.embedConfiguratorPanel.hidden === true;
      this.embedConfiguratorPanel.hidden = !willShow;
      if (willShow) {
        this.resetEmbedConfiguratorFromViewerState();
      }
      this.updateEmbedMenuEntryState();
    },

    openEmbedConfiguratorFromMenu(event) {
      this.createEmbedConfiguratorPanel();
      this.toggleEmbedConfigurator(event);
    },

    createEmbedConfiguratorPanel() {
      if (!core.container || this.embedConfiguratorPanel || this.isEmbedMode()) return;
      const text = (key, fallback) => escapeHtml(t(`embedPanel.${key}`, fallback));
      const axisInputs = (key, label) => `
        <div class="embed-config-row">
          <span class="embed-config-label">${label}</span>
          <div class="embed-config-xyz">
            ${AXES.map((axis) => `<label class="embed-config-axis"><span>${axis.toUpperCase()}</span><input id="embed${key[0].toUpperCase()}${key.slice(1)}${axis.toUpperCase()}" type="number" step="any" inputmode="decimal" /></label>`).join("")}
          </div>
          <input id="embed${key[0].toUpperCase()}${key.slice(1)}Input" type="hidden" />
        </div>`;
      const check = (id, key, fallback) =>
        `<label class="embed-config-check"><input id="${id}" type="checkbox" /> <span>${text(key, fallback)}</span></label>`;
      const languages = [["", text("languageAuto", "Viewer's default")], ["en", "English"], ["pl", "Polski"], ["de", "Deutsch"]];

      const panel = document.createElement("div");
      panel.id = "embedConfiguratorPanel";
      panel.hidden = true;
      // Moved within the window, not the viewer (panel-window.js).
      panel.style.position = "fixed";
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-labelledby", "embedConfigTitle");
      panel.innerHTML = `
      <div class="embed-config-header">
        <span id="embedConfigTitle" class="embed-config-title">${text("title", "Embed options")}</span>
        <button id="embedClosePanel" class="embed-config-close" type="button" aria-label="${text("closeAria", "Close embed options")}" title="${text("closeAria", "Close embed options")}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>
      <div class="embed-config-layout">
        <div class="embed-config-side">
          <section class="embed-config-section">
            <h4>${text("sectionModel", "Model")}</h4>
            <input id="embedModelInput" class="embed-config-wide" type="text" placeholder="${text("modelUrlPlaceholder", "/examples/box.glb")}" aria-label="${text("modelUrl", "Model URL")}" title="${text("modelUrl", "Model URL")}" />
            <div class="embed-config-row">
              <label class="embed-config-label" for="embedIdInput">${text("entityId", "Entity ID")}</label>
              <input id="embedIdInput" type="text" />
            </div>
          </section>
          <section class="embed-config-section">
            <h4>${text("sectionLook", "Look")}</h4>
            <div class="embed-config-row">
              <label class="embed-config-label" for="embedThemeInput">${text("theme", "Theme")}</label>
              <select id="embedThemeInput">
                <option value="dark">${text("themeDark", "Dark")}</option>
                <option value="light">${text("themeLight", "Light")}</option>
              </select>
            </div>
            <div class="embed-config-row">
              <label class="embed-config-label" for="embedLanguageInput">${text("language", "Language")}</label>
              <select id="embedLanguageInput">
                ${languages.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}
              </select>
            </div>
            <div class="embed-config-row">
              <label class="embed-config-label" for="embedAspectInput">${text("aspect", "Proportions")}</label>
              <select id="embedAspectInput">
                ${EMBED_ASPECTS.map((aspect) => `<option value="${aspect}">${aspect}</option>`).join("")}
              </select>
            </div>
          </section>
          <section class="embed-config-section">
            <h4>${text("sectionCamera", "Camera")}</h4>
            ${axisInputs("camPos", text("cameraPosition", "Position"))}
            ${axisInputs("camTarget", text("cameraTarget", "Target"))}
            <div class="embed-config-row">
              <label class="embed-config-label" for="embedFovInput">${text("fov", "FOV")}</label>
              <input id="embedFovInput" class="embed-config-short" type="number" step="1" min="1" max="179" />
            </div>
            <div class="embed-config-buttons">
              <button id="embedUseCurrentCamera" type="button" title="${text("useCurrentCameraHint", "The camera of the viewer behind this window")}">${text("useCurrentCamera", "Current camera")}</button>
              <button id="embedResetFromViewer" type="button" title="${text("resetFromViewerHint", "All the options as the viewer has them")}">${text("resetFromViewer", "Reset")}</button>
            </div>
          </section>
          <section class="embed-config-section">
            <h4>${text("sectionBehaviour", "Behaviour")}</h4>
            <div class="embed-config-check embed-config-check--with-value">
              <label><input id="embedAutorotateInput" type="checkbox" /> <span>${text("autoRotate", "Auto-rotate")}</span></label>
              <input id="embedAutorotateSpeedInput" class="embed-config-short" type="number" step="0.1" aria-label="${text("autoRotateSpeed", "Auto-rotate speed")}" title="${text("autoRotateSpeed", "Auto-rotate speed")}" />
            </div>
            ${check("embedDisableInteractionInput", "disableInteraction", "Disable interaction")}
            ${check("embedHideUiInput", "hideActionMenu", "Hide action menu")}
            ${check("embedHideMetadataInput", "hideMetadata", "Hide metadata")}
            ${check("embedPresentationModeInput", "presentationMode", "Presentation mode")}
          </section>
        </div>
        <div class="embed-config-main">
          <div class="embed-config-preview-bar">
            <span class="embed-config-preview-title">${text("preview", "Preview")}</span>
            <button id="embedReloadPreview" type="button" class="embed-config-icon" aria-label="${text("reload", "Reload the preview")}" title="${text("reload", "Reload the preview")}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <a id="embedOpenPreview" class="embed-config-icon" target="_blank" rel="noopener" aria-label="${text("openTab", "Open in a new tab")}" title="${text("openTab", "Open in a new tab")}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </a>
          </div>
          <div class="embed-config-stage">
            <iframe id="embedPreviewFrame" title="${text("previewTitle", "Embed preview")}" allow="fullscreen; xr-spatial-tracking"></iframe>
            <p class="embed-config-empty" hidden>${text("noSource", "A model URL or an entity ID is needed: a model opened from this device is not on the web.")}</p>
          </div>
          <div class="embed-config-code">
            <div class="embed-config-code-row">
              <label class="embed-config-label" for="embedUrlOutput">${text("embedUrl", "Embed URL")}</label>
              <input id="embedUrlOutput" type="text" readonly />
              <button id="embedCopyUrl" type="button">${text("copyUrl", "Copy URL")}</button>
            </div>
            <div class="embed-config-code-row">
              <label class="embed-config-label" for="embedIframeOutput">${text("iframeCode", "Iframe code")}</label>
              <textarea id="embedIframeOutput" rows="2" readonly></textarea>
              <button id="embedCopyIframe" type="button" class="is-primary">${text("copyIframe", "Copy iframe")}</button>
            </div>
          </div>
        </div>
      </div>
    `;

      // Beside the toolbar (in the wrapper, with the viewer's colours), so
      // it stands over it.
      (core.viewerWrapper || core.container).appendChild(panel);
      this.embedConfiguratorPanel = panel;
      const byId = (id) => panel.querySelector(`#${id}`);
      this.embedConfigInputs = {
        model: byId("embedModelInput"),
        id: byId("embedIdInput"),
        theme: byId("embedThemeInput"),
        language: byId("embedLanguageInput"),
        aspect: byId("embedAspectInput"),
        autorotate: byId("embedAutorotateInput"),
        autorotateSpeed: byId("embedAutorotateSpeedInput"),
        disableInteraction: byId("embedDisableInteractionInput"),
        hideUi: byId("embedHideUiInput"),
        hideMetadata: byId("embedHideMetadataInput"),
        presentationMode: byId("embedPresentationModeInput"),
        camPos: byId("embedCamPosInput"),
        camTarget: byId("embedCamTargetInput"),
        fov: byId("embedFovInput"),
        url: byId("embedUrlOutput"),
        iframe: byId("embedIframeOutput"),
      };
      ["camPos", "camTarget"].forEach((key) => {
        AXES.forEach((axis) => {
          const suffix = axis.toUpperCase();
          const input = byId(`embed${key[0].toUpperCase()}${key.slice(1)}${suffix}`);
          this.embedConfigInputs[`${key}${suffix}`] = input;
          this.bindEventListener(input, "input", () => {
            this.syncEmbedVectorInput(key);
            this.updateEmbedConfiguratorPreview();
          });
        });
      });
      this.embedConfigPreviewFrame = byId("embedPreviewFrame");

      // Moved by its header, resized by its corner (panel-window.js). A
      // window over the page: pinned where it stands on the screen, before
      // panel-window.js would pin it within its parent.
      this.bindEventListener(panel, "pointerdown", () => {
        if (panel.dataset.windowPinned === "1") return;
        const rect = panel.getBoundingClientRect();
        panel.style.left = `${Math.round(rect.left)}px`;
        panel.style.top = `${Math.round(rect.top)}px`;
        panel.style.transform = "none";
        panel.dataset.windowPinned = "1";
      }, { capture: true });
      makeDraggable(this, panel, panel.querySelector(".embed-config-header"));
      if (typeof ResizeObserver !== "undefined") {
        const observer = new ResizeObserver(() => this.fitEmbedPreview());
        observer.observe(panel.querySelector(".embed-config-stage"));
        this.addCleanup?.(() => observer.disconnect());
      }

      const inputs = this.embedConfigInputs;
      [
        inputs.model, inputs.id, inputs.theme, inputs.language, inputs.aspect, inputs.autorotate,
        inputs.autorotateSpeed, inputs.disableInteraction, inputs.hideUi, inputs.hideMetadata,
        inputs.presentationMode, inputs.fov,
      ].forEach((input) => {
        const eventName = input.type === "checkbox" || input.tagName === "SELECT" ? "change" : "input";
        this.bindEventListener(input, eventName, () => {
          if (input === inputs.autorotate) this.syncEmbedAutorotate();
          this.updateEmbedConfiguratorPreview({ immediate: eventName === "change" });
        });
      });

      this.bindEventListener(byId("embedUseCurrentCamera"), "click", () => this.fillConfiguratorWithCurrentCamera());
      this.bindEventListener(byId("embedResetFromViewer"), "click", () => this.resetEmbedConfiguratorFromViewerState());
      this.bindEventListener(byId("embedClosePanel"), "click", () => this.closeEmbedConfigurator());
      this.bindEventListener(byId("embedReloadPreview"), "click", () => {
        const frame = this.embedConfigPreviewFrame;
        const src = frame.getAttribute("src");
        if (src && src !== "about:blank") {
          frame.setAttribute("src", "about:blank");
          frame.setAttribute("src", src);
        }
      });
      // The address of the moment, when the link is followed.
      this.bindEventListener(byId("embedOpenPreview"), "click", (event) => {
        const options = this.collectEmbedConfiguratorOptions();
        if (!this.hasEmbedSourceSelection(options)) {
          event.preventDefault();
          this.notifyMissingEmbedSource({ force: true });
          return;
        }
        event.currentTarget.href = this.buildEmbedPayload(options).url;
      });
      const copy = (button, field, toastKeys, context) => {
        this.bindEventListener(button, "click", async () => {
          try {
            const options = this.collectEmbedConfiguratorOptions();
            if (!this.hasEmbedSourceSelection(options)) {
              this.notifyMissingEmbedSource({ force: true });
              return;
            }
            await this.copyTextToClipboard(this.buildEmbedPayload(options)[field]);
            toastHelper(toastKeys[0], "success");
          } catch (error) {
            this.reportError(error, { context });
            toastHelper(toastKeys[1], "error");
          }
        });
      };
      copy(byId("embedCopyUrl"), "url", ["embedUrlCopied", "embedUrlCopyError"], "Copy embed URL failed");
      copy(byId("embedCopyIframe"), "code", ["embedIframeCopied", "embedIframeCopyError"], "Copy embed iframe failed");
      // The whole field at a click, ready to copy by hand.
      [inputs.url, inputs.iframe].forEach((field) => this.bindEventListener(field, "focus", () => field.select()));

      this.applyEmbedOptionsToInputs(this.getCurrentEmbedOptions({ includeCamera: true }));
      this.updateEmbedConfiguratorPreview({ immediate: true });
    },

    async copyEmbedCode(event) {
      event?.preventDefault?.();
      this.closeActionMenu();

      try {
        const { code } = this.getEmbedPayload();
        await this.copyTextToClipboard(code);
        toastHelper("embedCodeCopied", "success");
      } catch (error) {
        this.reportError(error, { context: "Copy embed code failed" });
        toastHelper("embedCodeCopyError", "error");
      }
    },

    async copyShareViewUrl(event) {
      event?.preventDefault?.();
      this.closeActionMenu();

      try {
        const { url } = this.getSharePayload();
        if (!url) {
          toastHelper("embedSourceMissing", "warning");
          return;
        }
        await this.copyTextToClipboard(url);
        toastHelper("shareUrlCopied", "success");
      } catch (error) {
        this.reportError(error, { context: "Copy share URL failed" });
        toastHelper("shareUrlCopyError", "error");
      }
    },

    updateShareMenuEntryState() {
      if (!this.shareView) return;
      const label = t("menu.shareView", "Share view");
      this.shareView.innerHTML = `<span class="share-view-icon" aria-hidden="true"></span><span>${label}</span>`;
      const a11yLabel = t("menu.copyShareView", "Copy share view link");
      this.shareView.setAttribute("aria-label", a11yLabel);
      this.shareView.setAttribute("title", a11yLabel);
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
        // The preview's viewer stops with the window.
        clearTimeout(this.embedPreviewTimer);
        this.embedConfigPreviewFrame?.setAttribute("src", "about:blank");
      }
      this.updateEmbedMenuEntryState();
    },

    closeEmbedMode() {
      this.closeEmbedConfigurator();
    },
  });
}
