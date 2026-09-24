import { core } from "../core.js";
import { toastHelper } from "../viewer-utils.js";
import { t } from "../i18n-utils.js";
import { StatusPoller } from "../status-poller.js";
import { UltraLoader } from "../ultra-loader.js";
import { makePanelWindow } from "./panel-window.js";

// Mirrors worker/server.py's SUPPORTED_FORMATS: Blender importers, STEP/IGES/3MF
// converted without Blender, and formats the viewer reads directly (kept as
// uploaded, no thumbnails), plus the .zip archive support the standalone
// worker adds on top - see worker/README.md.
const SUPPORTED_EXTENSIONS = [
  "abc", "dae", "fbx", "obj", "ply", "stl", "wrl", "x3d", "ifc", "blend", "gml", "glb",
  "usd", "usda", "usdc", "usdz",
  "step", "stp", "iges", "igs", "3mf",
  "gltf", "3ds", "pcd", "xyz", "amf", "kmz", "vox", "lwo",
  "zip",
];

export function attachUploadPanel(Viewer) {
  Object.assign(Viewer, {
    renderUploadHint() {
      const hint = this.uploadInputs?.hint;
      if (!hint) return;
      const maxBytes = this.authState?.maxUploadBytes;
      const limit = maxBytes
        ? " " + t("uploadPanel.maxSize", { size: Math.round(maxBytes / 1048576) }, "Maximum upload size: {size} MB.")
        : "";
      hint.textContent = this.uploadInputs.hintBase + limit;
    },

    // Login itself lives in its own panel (ui/login-panel.js); the upload
    // panel only says when a login is needed and points there.
    renderUploadAuthNotice() {
      const section = this.uploadInputs?.auth;
      if (!section) return;
      const state = this.authState || { required: false };
      const canUpload = !state.required || Boolean(state.user);
      section.hidden = canUpload;
      section.textContent = "";
      if (this.uploadInputs.submit) this.uploadInputs.submit.disabled = !canUpload;
      if (canUpload) return;

      const hint = document.createElement("p");
      hint.className = "upload-panel-hint";
      hint.textContent = t("uploadPanel.loginRequired", "Log in to upload models.");
      const login = document.createElement("button");
      login.type = "button";
      login.textContent = t("uploadPanel.login", "Log in");
      this.bindEventListener(login, "click", () => this.openLoginPanel());
      section.append(hint, login);
    },

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
        this.refreshAuthState();
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
      const state = this.authState;
      this.uploadInputs.submit.disabled = Boolean(state?.required && !state.user);
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
          <div id="uploadPanelAuth" class="upload-panel-auth" hidden></div>
          <label class="upload-panel-field">${panelText.fileLabel}
            <input id="uploadPanelFileInput" type="file" accept="${SUPPORTED_EXTENSIONS.map((ext) => `.${ext}`).join(",")}" required />
          </label>
          <p id="uploadPanelHint" class="upload-panel-hint">${panelText.formatsHint}</p>
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
        auth: panel.querySelector("#uploadPanelAuth"),
        hint: panel.querySelector("#uploadPanelHint"),
        hintBase: panelText.formatsHint,
      };
      const form = panel.querySelector("#uploadPanelForm");
      const closeButton = panel.querySelector("#uploadPanelClose");

      this.bindEventListener(form, "submit", (event) => this.handleUploadSubmit(event));
      this.bindEventListener(closeButton, "click", () => this.closeUploadPanel());
      makePanelWindow(this, panel, panel.querySelector(".upload-panel-header"));
    },

    /**
     * In-viewer replacement for window.confirm(). Resolves true on confirm,
     * false on cancel, Escape or backdrop click.
     */
    confirmDialog({ message, confirmLabel, cancelLabel, danger = false }) {
      return new Promise((resolve) => {
        const backdrop = document.createElement("div");
        backdrop.className = "viewer-confirm-backdrop";
        backdrop.innerHTML = `
          <div class="viewer-confirm" role="alertdialog" aria-modal="true" aria-describedby="viewerConfirmMessage">
            <p id="viewerConfirmMessage" class="viewer-confirm-message"></p>
            <div class="viewer-confirm-actions">
              <button type="button" class="viewer-confirm-cancel"></button>
              <button type="button" class="viewer-confirm-ok${danger ? " viewer-confirm-ok--danger" : ""}"></button>
            </div>
          </div>`;
        backdrop.querySelector(".viewer-confirm-message").textContent = message;
        const cancel = backdrop.querySelector(".viewer-confirm-cancel");
        const ok = backdrop.querySelector(".viewer-confirm-ok");
        cancel.textContent = cancelLabel;
        ok.textContent = confirmLabel;

        const finish = (value) => {
          document.removeEventListener("keydown", onKey, true);
          backdrop.remove();
          resolve(value);
        };
        const onKey = (event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            finish(false);
          }
        };
        document.addEventListener("keydown", onKey, true);
        cancel.addEventListener("click", () => finish(false));
        ok.addEventListener("click", () => finish(true));
        backdrop.addEventListener("pointerdown", (event) => {
          event.stopPropagation();
          if (event.target === backdrop) finish(false);
        });

        core.container.appendChild(backdrop);
        cancel.focus();
      });
    },

    async handleUploadSubmit(event) {
      event.preventDefault();
      const file = this.uploadInputs?.file?.files?.[0];
      if (!file) return;

      if (this.authState?.required && !this.authState?.user) {
        this.setUploadStatusText(t("uploadPanel.loginRequired", "Log in to upload models."), "error");
        toastHelper("uploadLoginRequired", "warning");
        return;
      }

      const extension = (file.name.split(".").pop() || "").toLowerCase();
      if (!SUPPORTED_EXTENSIONS.includes(extension)) {
        this.setUploadStatusText(
          t("uploadPanel.unsupportedFormat", { ext: extension }, "Unsupported file format: .{ext}"),
          "error"
        );
        return;
      }

      const maxBytes = this.authState?.maxUploadBytes;
      if (maxBytes && file.size > maxBytes) {
        this.setUploadStatusText(
          t("uploadPanel.tooLargeLimit", { size: Math.round(maxBytes / 1048576) }, "That file is larger than the {size} MB upload limit."),
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
        if (response.status === 401) {
          await this.refreshAuthState();
          this.setUploadStatusText(t("uploadPanel.loginRequired", "Log in to upload models."), "error");
          return;
        }
        if (response.status === 413) {
          this.setUploadStatusText(t("uploadPanel.tooLarge", "That file is too large to upload."), "error");
          return;
        }
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
          const state = this.authState;
          this.uploadInputs.submit.disabled = Boolean(state?.required && !state.user);
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
