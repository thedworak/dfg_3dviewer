import { core } from "../core.js";
import { toastHelper } from "../viewer-utils.js";
import { t } from "../i18n-utils.js";
import { StatusPoller } from "../status-poller.js";
import { UltraLoader } from "../ultra-loader.js";

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

// Same-origin worker endpoints (see worker/auth.py). Cookies travel by default
// for same-origin requests, so no credentials option is needed.
async function authRequest(path, body) {
  const response = await fetch(`/api/auth/${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try {
    data = await response.json();
  } catch (_error) {
    // Non-JSON error page (e.g. from a proxy) - fall through with the status.
  }
  if (!response.ok) {
    const error = new Error(data.error || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

export function attachUploadPanel(Viewer) {
  Object.assign(Viewer, {
    // Accounts are enforced by the worker (WORKER_AUTH_MODE); the manifest's
    // AIM3DViewer.viewer.auth only tunes the UI: enabled:false hides it,
    // allowRegistration:false hides the register button.
    async refreshAuthState() {
      const uiConfig = core.CONFIG?.viewer?.auth || {};
      const state = { required: false, registration: false, user: null, maxUploadBytes: 0 };
      // The upload limit is reported by the same endpoint, so query it even
      // when the manifest hides the login UI.
      try {
        const serverConfig = await authRequest("config");
        state.maxUploadBytes = Number(serverConfig.maxUploadBytes) || 0;
        if (uiConfig.enabled !== false) {
          state.required = serverConfig.mode === "required";
          state.registration =
            serverConfig.registration !== "closed" && uiConfig.allowRegistration !== false;
          if (state.required) {
            state.user = (await authRequest("me")).user || null;
          }
        }
      } catch (_error) {
        // Older worker without /api/auth/*: behaves as accounts off.
      }
      this.authState = state;
      this.renderUploadHint();
      this.renderAuthSection();
      return state;
    },

    renderUploadHint() {
      const hint = this.uploadInputs?.hint;
      if (!hint) return;
      const maxBytes = this.authState?.maxUploadBytes;
      const limit = maxBytes
        ? " " + t("uploadPanel.maxSize", { size: Math.round(maxBytes / 1048576) }, "Maximum upload size: {size} MB.")
        : "";
      hint.textContent = this.uploadInputs.hintBase + limit;
    },

    renderAuthSection() {
      const section = this.uploadInputs?.auth;
      if (!section) return;
      const state = this.authState || { required: false };
      section.hidden = !state.required;
      section.textContent = "";
      const canUpload = !state.required || Boolean(state.user);
      if (this.uploadInputs.submit) this.uploadInputs.submit.disabled = !canUpload;
      if (!state.required) return;

      if (state.user) {
        const label = document.createElement("span");
        label.textContent = t("uploadPanel.signedInAs", { user: state.user }, "Signed in as {user}");
        const logout = document.createElement("button");
        logout.type = "button";
        logout.textContent = t("uploadPanel.logout", "Log out");
        this.bindEventListener(logout, "click", () => this.handleAuthAction("logout"));
        section.append(label, logout);
        return;
      }

      const hint = document.createElement("p");
      hint.className = "upload-panel-hint";
      hint.textContent = t("uploadPanel.loginRequired", "Log in to upload models.");
      const username = document.createElement("input");
      username.type = "text";
      username.autocomplete = "username";
      username.placeholder = t("uploadPanel.username", "Username");
      username.setAttribute("aria-label", username.placeholder);
      const password = document.createElement("input");
      password.type = "password";
      password.autocomplete = "current-password";
      password.placeholder = t("uploadPanel.password", "Password");
      password.setAttribute("aria-label", password.placeholder);
      const login = document.createElement("button");
      login.type = "button";
      login.textContent = t("uploadPanel.login", "Log in");
      this.bindEventListener(login, "click", () =>
        this.handleAuthAction("login", { username: username.value.trim(), password: password.value })
      );
      section.append(hint, username, password, login);
      if (state.registration) {
        const register = document.createElement("button");
        register.type = "button";
        register.textContent = t("uploadPanel.register", "Register");
        this.bindEventListener(register, "click", () =>
          this.handleAuthAction("register", { username: username.value.trim(), password: password.value })
        );
        section.appendChild(register);
      }
    },

    async handleAuthAction(action, credentials) {
      try {
        if (action === "register") {
          const result = await authRequest("register", credentials);
          this.setUploadStatusText(
            result.status === "pending"
              ? t("uploadPanel.registeredPending", "Account created. It must be approved before you can upload.")
              : t("uploadPanel.registeredActive", "Account created. You can log in now."),
            "success"
          );
          return;
        }
        await authRequest(action, credentials || {});
        this.setUploadStatusText("");
        await this.refreshAuthState();
        this.loadPreviousModelsList();
      } catch (error) {
        this.setUploadStatusText(error.message, "error");
      }
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
        this.refreshAuthState().then(() => this.loadPreviousModelsList());
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
        previousTitle: t("uploadPanel.previousTitle", "Previously generated models"),
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
        <div class="upload-panel-previous">
          <div class="upload-panel-previous-title">${panelText.previousTitle}</div>
          <ul id="uploadPanelPreviousList" class="upload-panel-previous-list"></ul>
        </div>
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
      this.uploadPreviousList = panel.querySelector("#uploadPanelPreviousList");

      const form = panel.querySelector("#uploadPanelForm");
      const closeButton = panel.querySelector("#uploadPanelClose");

      this.bindEventListener(form, "submit", (event) => this.handleUploadSubmit(event));
      this.bindEventListener(closeButton, "click", () => this.closeUploadPanel());
    },

    async loadPreviousModelsList() {
      if (!this.uploadPreviousList) return;
      const list = this.uploadPreviousList;
      list.textContent = "";

      let jobs = [];
      try {
        const response = await fetch("/api/jobs");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        jobs = Array.isArray(data.jobs) ? data.jobs : [];
      } catch (error) {
        this.reportError(error, { context: "Failed to load previous models list" });
        const errorItem = document.createElement("li");
        errorItem.className = "upload-panel-previous-empty";
        errorItem.textContent = t("uploadPanel.previousLoadError", "Could not load previous models.");
        list.appendChild(errorItem);
        return;
      }

      if (jobs.length === 0) {
        const emptyItem = document.createElement("li");
        emptyItem.className = "upload-panel-previous-empty";
        emptyItem.textContent = t("uploadPanel.previousEmpty", "No previously generated models yet.");
        list.appendChild(emptyItem);
        return;
      }

      jobs.forEach((job) => {
        const name = job.name || job.id;
        const item = document.createElement("li");
        item.className = "upload-panel-previous-row";

        const button = document.createElement("button");
        button.type = "button";
        button.className = "upload-panel-previous-item";
        button.title = name;

        if (job.imageUrls?.[0]) {
          const thumb = document.createElement("img");
          thumb.src = job.imageUrls[0];
          thumb.alt = "";
          thumb.loading = "lazy";
          button.appendChild(thumb);
        }

        const label = document.createElement("span");
        label.textContent = name;
        button.appendChild(label);

        this.bindEventListener(button, "click", () => this.loadPreviousModel(job));
        item.appendChild(button);

        // canDelete is computed by the worker (own uploads, or admin, or
        // accounts off); older workers omit it and allow deleting as before.
        if (job.canDelete === false) {
          list.appendChild(item);
          return;
        }

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "upload-panel-previous-delete";
        deleteButton.textContent = "✕";
        const deleteAria = t("uploadPanel.previousDeleteAria", { name }, "Delete {name}");
        deleteButton.setAttribute("aria-label", deleteAria);
        deleteButton.title = deleteAria;
        this.bindEventListener(deleteButton, "click", (event) => {
          event.stopPropagation();
          this.deletePreviousModel(job, item);
        });
        item.appendChild(deleteButton);

        list.appendChild(item);
      });
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

    async deletePreviousModel(job, item) {
      if (!job?.id) return;
      const name = job.name || job.id;
      const confirmed = await this.confirmDialog({
        message: t(
          "uploadPanel.previousDeleteConfirm",
          { name },
          'Delete "{name}"? This permanently removes the converted model and its renders.'
        ),
        confirmLabel: t("uploadPanel.previousDeleteAction", "Delete"),
        cancelLabel: t("uploadPanel.previousDeleteCancel", "Cancel"),
        danger: true,
      });
      if (!confirmed) return;

      try {
        const response = await fetch(`/api/jobs/${encodeURIComponent(job.id)}`, { method: "DELETE" });
        if (!response.ok && response.status !== 404) {
          throw new Error(`Delete failed (HTTP ${response.status})`);
        }
        item.remove();
        if (this.uploadPreviousList && this.uploadPreviousList.children.length === 0) {
          const emptyItem = document.createElement("li");
          emptyItem.className = "upload-panel-previous-empty";
          emptyItem.textContent = t("uploadPanel.previousEmpty", "No previously generated models yet.");
          this.uploadPreviousList.appendChild(emptyItem);
        }
        toastHelper("modelDeleted", "info");
      } catch (error) {
        this.reportError(error, { context: "Failed to delete previous model" });
        toastHelper("modelDeleteError", "error");
      }
    },

    async loadPreviousModel(job) {
      if (!job?.modelUrl) return;
      this.closeUploadPanel();
      core.autoPath = job.modelUrl;
      this.resetLoadedModelState();
      await this.mainLoadModelWrapper();

      const galleryCfg = core.CONFIG.viewer?.gallery;
      if (
        Array.isArray(job.imageUrls) &&
        job.imageUrls.length > 0 &&
        (galleryCfg?.build === true || galleryCfg?.buildFake === true) &&
        !core.SANDBOX_MODE &&
        !this.isEmbedMode()
      ) {
        this.renderModelGalleryImages(job.imageUrls);
      }
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
