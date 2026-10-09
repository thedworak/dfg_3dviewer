import { core } from "../core.js";
import { apiUrl, appRequestHeaders, remoteAssetUrl } from "../remote.js";
import { toastHelper } from "../viewer-utils.js";
import { t } from "../i18n-utils.js";
import { StatusPoller } from "../status-poller.js";
import { UltraLoader } from "../ultra-loader.js";
import { makePanelWindow } from "./panel-window.js";

// Mirrors worker/server.py's SUPPORTED_FORMATS: Blender importers, STEP/IGES/3MF
// converted without Blender, and formats the viewer reads directly (kept as
// uploaded, no thumbnails), point clouds turned into 3D Tiles
// (worker/pointcloud.py), plus the .zip archive support the standalone
// worker adds on top - see worker/README.md.
const SUPPORTED_EXTENSIONS = [
  "abc", "dae", "fbx", "obj", "ply", "stl", "wrl", "x3d", "ifc", "blend", "gml", "glb",
  "usd", "usda", "usdc", "usdz",
  "step", "stp", "iges", "igs", "3mf",
  "gltf", "3ds", "pcd", "xyz", "amf", "kmz", "vox", "lwo",
  "las", "laz", "e57",
  "zip",
];

// A link to import (POST /api/model/create-from-url): http(s), and the file
// name in its path must end in one of SUPPORTED_EXTENSIONS. Returns
// { url } or { error } (an i18n key and its fallback, plus vars).
function validateModelUrl(raw) {
  const value = String(raw || "").trim();
  let url;
  try {
    url = new URL(value);
  } catch {
    return { error: ["uploadPanel.urlInvalid", "Enter a full link starting with https:// or http://."] };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { error: ["uploadPanel.urlInvalid", "Enter a full link starting with https:// or http://."] };
  }
  let name = "";
  try {
    name = decodeURIComponent(url.pathname.split("/").pop() || "");
  } catch {
    name = url.pathname.split("/").pop() || "";
  }
  const dot = name.lastIndexOf(".");
  const extension = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
  if (!extension) {
    return { error: ["uploadPanel.urlNoFile", "The link must point to a model file, e.g. …/model.glb."] };
  }
  if (!SUPPORTED_EXTENSIONS.includes(extension)) {
    return { error: ["uploadPanel.unsupportedFormat", "Unsupported file format: .{ext}", { ext: extension }] };
  }
  return { url: url.href };
}

// GET /api/limits and the `code` of a limit error (see worker/limits.py).
// Worker-less builds (Drupal, static hosting) have no such endpoint - the
// usage line then just stays hidden.
async function fetchUploadLimits() {
  const response = await fetch(apiUrl("/api/limits"), { cache: "no-store", headers: appRequestHeaders() });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function formatMegabytes(bytes) {
  const value = bytes / 1048576;
  return value >= 10 ? String(Math.round(value)) : value.toFixed(1);
}

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

    async refreshUploadLimits() {
      try {
        this.uploadLimits = await fetchUploadLimits();
      } catch (_error) {
        this.uploadLimits = null;
      }
      this.renderUploadLimits();
    },

    // One line such as "Uploads: 3/20 this hour · 5/100 today · Storage:
    // 120/2048 MB"; limits set to 0 (unlimited) are left out.
    renderUploadLimits() {
      const line = this.uploadInputs?.limits;
      if (!line) return;
      const data = this.uploadLimits;
      const limits = data?.limits;
      const usage = data?.usage;
      const parts = [];
      if (limits && usage) {
        const uploads = [];
        if (limits.uploadsPerHour) {
          uploads.push(t("uploadPanel.limitsHour", { used: usage.uploadsLastHour, limit: limits.uploadsPerHour }, "{used}/{limit} this hour"));
        }
        if (limits.uploadsPerDay) {
          uploads.push(t("uploadPanel.limitsDay", { used: usage.uploadsLastDay, limit: limits.uploadsPerDay }, "{used}/{limit} today"));
        }
        if (uploads.length) parts.push(`${t("uploadPanel.limitsUploads", "Uploads")}: ${uploads.join(", ")}`);
        if (limits.storageMb) {
          parts.push(t(
            "uploadPanel.limitsStorage",
            { used: formatMegabytes(usage.storageBytes), limit: limits.storageMb },
            "Storage: {used}/{limit} MB"
          ));
        }
        if (limits.maxModels) {
          parts.push(t("uploadPanel.limitsModels", { used: usage.models, limit: limits.maxModels }, "Models: {used}/{limit}"));
        }
      }
      line.textContent = parts.join(" · ");
      line.hidden = parts.length === 0;
    },

    // Localized message for a worker limit error ({ code, limit, retryAfter }).
    describeUploadLimitError(data) {
      const limit = data?.limit ?? "";
      const minutes = Math.max(1, Math.ceil(Number(data?.retryAfter || 60) / 60));
      switch (data?.code) {
        case "rate_hour":
          return t("uploadPanel.limitRateHour", { limit, minutes }, "Upload limit reached ({limit} per hour). Try again in {minutes} min.");
        case "rate_day":
          return t("uploadPanel.limitRateDay", { limit, minutes }, "Daily upload limit reached ({limit} per day). Try again in {minutes} min.");
        case "concurrent":
          return t("uploadPanel.limitConcurrent", { limit }, "You already have {limit} model(s) being converted. Wait until they finish.");
        case "storage":
          return t("uploadPanel.limitStorage", { limit }, "Storage limit reached ({limit} MB). Delete a model to free space.");
        case "models":
          return t("uploadPanel.limitModels", { limit }, "Model limit reached ({limit}). Delete a model to upload a new one.");
        default:
          return data?.error || t("uploadPanel.uploadError", "Upload failed. Please try again.");
      }
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
        // Also reloads the limits line (see refreshAuthState).
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
      this.uploadInputs.url.value = "";
      this.markUploadUrl(null);
      const state = this.authState;
      this.uploadInputs.submit.disabled = Boolean(state?.required && !state.user);
      this.setUploadStatusText("");
    },

    // Shows the link check as it is typed; null clears it.
    markUploadUrl(result) {
      const input = this.uploadInputs?.url;
      if (!input) return;
      if (result?.error) {
        const [key, fallback, vars] = result.error;
        input.setAttribute("aria-invalid", "true");
        this.setUploadStatusText(vars ? t(key, vars, fallback) : t(key, fallback), "error");
      } else {
        input.removeAttribute("aria-invalid");
        if (this.uploadInputs.status?.dataset.tone === "error") this.setUploadStatusText("");
      }
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
        urlLabel: t("uploadPanel.urlLabel", "…or a link to the file"),
        urlPlaceholder: t("uploadPanel.urlPlaceholder", "https://example.org/model.glb"),
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
            <input id="uploadPanelFileInput" type="file" accept="${SUPPORTED_EXTENSIONS.map((ext) => `.${ext}`).join(",")}" />
          </label>
          <label class="upload-panel-field">${panelText.urlLabel}
            <input id="uploadPanelUrlInput" type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="${panelText.urlPlaceholder}" />
          </label>
          <p id="uploadPanelHint" class="upload-panel-hint">${panelText.formatsHint}</p>
          <p id="uploadPanelLimits" class="upload-panel-hint upload-panel-limits" hidden></p>
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
        url: panel.querySelector("#uploadPanelUrlInput"),
        submit: panel.querySelector("#uploadPanelSubmit"),
        status: panel.querySelector("#uploadPanelStatus"),
        auth: panel.querySelector("#uploadPanelAuth"),
        hint: panel.querySelector("#uploadPanelHint"),
        limits: panel.querySelector("#uploadPanelLimits"),
        hintBase: panelText.formatsHint,
      };
      const form = panel.querySelector("#uploadPanelForm");
      const closeButton = panel.querySelector("#uploadPanelClose");

      this.bindEventListener(form, "submit", (event) => this.handleUploadSubmit(event));
      // A file or a link, not both: choosing one clears the other.
      const { file, url } = this.uploadInputs;
      this.bindEventListener(file, "change", () => {
        if (file.files?.length && url.value) {
          url.value = "";
          this.markUploadUrl(null);
        }
      });
      this.bindEventListener(url, "input", () => {
        if (url.value.trim() && file.value) file.value = "";
        this.markUploadUrl(url.value.trim() ? validateModelUrl(url.value) : null);
      });
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
      const link = this.uploadInputs?.url?.value.trim();
      if (!file && !link) {
        this.setUploadStatusText(t("uploadPanel.chooseFileOrUrl", "Choose a file or paste a link to one."), "error");
        return;
      }

      if (this.authState?.required && !this.authState?.user) {
        this.setUploadStatusText(t("uploadPanel.loginRequired", "Log in to upload models."), "error");
        toastHelper("uploadLoginRequired", "warning");
        return;
      }

      if (!file) {
        const result = validateModelUrl(link);
        this.markUploadUrl(result);
        if (result.error) return;
        // The worker downloads it (browsers would mostly be blocked by CORS).
        await this.sendUploadRequest({
          method: "POST",
          body: JSON.stringify({ url: result.url }),
          headers: { ...appRequestHeaders(), "Content-Type": "application/json" },
        }, "/api/model/create-from-url");
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
      await this.sendUploadRequest({ method: "POST", body: formData, headers: appRequestHeaders() }, "/api/model/create");
    },

    // Starts a conversion (an uploaded file or a link) and follows it.
    async sendUploadRequest(request, endpoint) {
      const fromUrl = endpoint.endsWith("-from-url");
      this.uploadInputs.submit.disabled = true;
      this.setUploadStatusText(
        fromUrl ? t("uploadPanel.downloading", "Downloading the file...") : t("uploadPanel.uploading", "Uploading..."),
        "info"
      );

      try {
        const response = await fetch(apiUrl(endpoint), request);
        if (response.status === 401) {
          await this.refreshAuthState();
          this.setUploadStatusText(t("uploadPanel.loginRequired", "Log in to upload models."), "error");
          return;
        }
        if (response.status === 429 || response.status === 507) {
          let data = {};
          try {
            data = await response.json();
          } catch (_error) {
            // Proxy error page - fall back to the generic message.
          }
          this.setUploadStatusText(this.describeUploadLimitError(data), "error");
          this.refreshUploadLimits();
          return;
        }
        if (response.status === 413) {
          this.setUploadStatusText(t("uploadPanel.tooLarge", "That file is too large to upload."), "error");
          return;
        }
        // The worker's reason a link cannot be imported (remote_fetch.py).
        if (fromUrl && !response.ok && response.status !== 401) {
          let data = {};
          try {
            data = await response.json();
          } catch (_error) {
            // Proxy error page - the generic message below.
          }
          if (response.status === 404 && !data.error) {
            // An older worker without the endpoint.
            this.setUploadStatusText(t("uploadPanel.urlUnsupported", "This repository cannot import from links."), "error");
            return;
          }
          this.setUploadStatusText(
            t("uploadPanel.urlFetchError", { reason: data.error || `HTTP ${response.status}` }, "Could not import the link: {reason}"),
            "error"
          );
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
        this.refreshUploadLimits();
        toastHelper("uploadStarted", "info");

        UltraLoader.start([...this.processingLoadingStepKeys]);
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
        core.autoPath = remoteAssetUrl(data.modelUrl);
        this.resetLoadedModelState();
        await this.mainLoadModelWrapper();

        // Mirrors the same gate the example-model switch uses before
        // rebuilding the gallery (see main.js) - the worker's own thumbnails
        // (imageUrls) are the correct source here regardless of build vs
        // buildFake, since there is no Drupal field markup to read in a
        // standalone deployment.
        const galleryCfg = core.CONFIG.viewer?.gallery;
        if (
          (galleryCfg?.build === true || galleryCfg?.buildFake === true) &&
          !core.SANDBOX_MODE &&
          !this.isEmbedMode()
        ) {
          this.renderModelGalleryImages((data.imageUrls || []).map(remoteAssetUrl));
        }
      } else if (data.status === "failed" || data.status === "error") {
        toastHelper("uploadError", "error");
      }
    },
  });
}
