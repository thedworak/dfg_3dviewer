import { core } from "../core.js";
import { toastHelper } from "../viewer-utils.js";
import { t } from "../i18n-utils.js";
import { StatusPoller } from "../status-poller.js";
import { UltraLoader } from "../ultra-loader.js";

// Mirrors the case-branches scripts/convert.sh actually handles, plus the
// .zip archive support the standalone worker (worker/server.py) adds on top
// of it - see worker/README.md.
const SUPPORTED_EXTENSIONS = ["abc", "dae", "fbx", "obj", "ply", "stl", "wrl", "x3d", "ifc", "blend", "gml", "glb", "zip"];

export function attachUploadPanel(Viewer) {
  Object.assign(Viewer, {
    isUploadPanelOpen() {
      return this.uploadPanel?.hidden === false;
    },

    updateUploadMenuEntryState() {
      if (!this.uploadModel) return;
      // Icon-only, matching #example-theme-toggle's compact footprint next
      // to the model picker - the full label lives in aria-label/title
      // instead of visible text.
      this.uploadModel.innerHTML = `<span class="upload-model-icon" aria-hidden="true"></span>`;
      const a11yLabel = t("menu.openUploadPanel", "Upload a 3D model for conversion");
      this.uploadModel.setAttribute("aria-label", a11yLabel);
      this.uploadModel.setAttribute("title", a11yLabel);
    },

    openUploadPanel(event) {
      this.createUploadPanel();
      this.toggleUploadPanel(event);
    },

    toggleUploadPanel(event) {
      event?.preventDefault?.();
      this.closeActionMenu();
      if (!this.uploadPanel) return;
      const willShow = this.uploadPanel.hidden === true;
      this.uploadPanel.hidden = !willShow;
      if (willShow) {
        this.resetUploadPanelState();
      }
    },

    closeUploadPanel() {
      if (this.uploadPanel) {
        this.uploadPanel.hidden = true;
      }
    },

    resetUploadPanelState() {
      if (!this.uploadInputs) return;
      this.uploadInputs.file.value = "";
      this.uploadInputs.submit.disabled = false;
      this.setUploadStatusText("");
    },

    setUploadStatusText(message, tone = "info") {
      if (!this.uploadInputs?.status) return;
      this.uploadInputs.status.textContent = message;
      this.uploadInputs.status.dataset.tone = tone;
    },

    createUploadPanel() {
      if (!core.container || this.uploadPanel) return;

      const panelText = {
        title: t("uploadPanel.title", "Upload & convert model"),
        closeAria: t("uploadPanel.closeAria", "Close upload panel"),
        fileLabel: t("uploadPanel.fileLabel", "3D model file"),
        formatsHint: t(
          "uploadPanel.formatsHint",
          "Supported: abc, dae, fbx, obj, ply, stl, wrl, x3d, ifc, blend, gml, glb, or a .zip archive containing one of these."
        ),
        submit: t("uploadPanel.submit", "Upload & convert"),
      };

      const panel = document.createElement("div");
      panel.id = "uploadModelPanel";
      panel.hidden = true;
      panel.innerHTML = `
        <div class="upload-panel-header">
          <span>${panelText.title}</span>
          <button id="uploadPanelClose" type="button" aria-label="${panelText.closeAria}">X</button>
        </div>
        <form id="uploadPanelForm" class="upload-panel-body">
          <label class="upload-panel-field">${panelText.fileLabel}
            <input id="uploadPanelFileInput" type="file" accept=".abc,.dae,.fbx,.obj,.ply,.stl,.wrl,.x3d,.ifc,.blend,.gml,.glb,.zip" required />
          </label>
          <p class="upload-panel-hint">${panelText.formatsHint}</p>
          <div class="upload-panel-actions">
            <button id="uploadPanelSubmit" type="submit">${panelText.submit}</button>
          </div>
          <p id="uploadPanelStatus" class="upload-panel-status" role="status" aria-live="polite"></p>
        </form>
      `;

      core.container.appendChild(panel);
      this.uploadPanel = panel;
      this.uploadInputs = {
        file: panel.querySelector("#uploadPanelFileInput"),
        submit: panel.querySelector("#uploadPanelSubmit"),
        status: panel.querySelector("#uploadPanelStatus"),
      };

      const form = panel.querySelector("#uploadPanelForm");
      const closeButton = panel.querySelector("#uploadPanelClose");

      this.bindEventListener(form, "submit", (event) => this.handleUploadSubmit(event));
      this.bindEventListener(closeButton, "click", () => this.closeUploadPanel());
    },

    async handleUploadSubmit(event) {
      event.preventDefault();
      const file = this.uploadInputs?.file?.files?.[0];
      if (!file) return;

      const extension = (file.name.split(".").pop() || "").toLowerCase();
      if (!SUPPORTED_EXTENSIONS.includes(extension)) {
        this.setUploadStatusText(
          t("uploadPanel.unsupportedFormat", { ext: extension }, "Unsupported file format: .{ext}"),
          "error"
        );
        return;
      }

      const formData = new FormData();
      formData.append("file", file);

      this.uploadInputs.submit.disabled = true;
      this.setUploadStatusText(t("uploadPanel.uploading", "Uploading..."), "info");

      try {
        const response = await fetch("/api/model/create", { method: "POST", body: formData });
        if (!response.ok) {
          throw new Error(`Upload failed (HTTP ${response.status})`);
        }
        const data = await response.json();
        const jobId = data.entity_id;
        if (!jobId) {
          throw new Error("No job id returned by the conversion service.");
        }

        this.closeUploadPanel();
        toastHelper("uploadStarted", "info");

        UltraLoader.start(this.getProcessingLoadingSteps());
        const poller = new StatusPoller(jobId, {
          forcePoll: true,
          onUpdate: (statusData) => this.handleUploadStatusUpdate(statusData),
        });
        poller.start();
      } catch (error) {
        this.reportError(error, { context: "Model upload failed" });
        this.setUploadStatusText(t("uploadPanel.uploadError", "Upload failed. Please try again."), "error");
        toastHelper("uploadError", "error");
      } finally {
        if (this.uploadInputs?.submit) {
          this.uploadInputs.submit.disabled = false;
        }
      }
    },

    async handleUploadStatusUpdate(data) {
      if (!data) return;
      if (data.status === "ready" && data.modelUrl) {
        toastHelper("uploadReady", "success");
        core.autoPath = data.modelUrl;
        this.resetLoadedModelState();
        await this.mainLoadModelWrapper();

        // Mirrors the same gate the example-model switch uses before
        // rebuilding the gallery (see main.js) - the worker's own thumbnails
        // (imageUrls) are the correct source here regardless of build vs
        // buildFake, since there is no Drupal field markup to read in a
        // standalone deployment.
        const galleryCfg = core.CONFIG.viewer?.gallery;
        if (
          Array.isArray(data.imageUrls) &&
          data.imageUrls.length > 0 &&
          (galleryCfg?.build === true || galleryCfg?.buildFake === true) &&
          !core.SANDBOX_MODE &&
          !this.isEmbedMode()
        ) {
          this.renderModelGalleryImages(data.imageUrls);
        }
      } else if (data.status === "failed" || data.status === "error") {
        toastHelper("uploadError", "error");
      }
    },
  });
}
