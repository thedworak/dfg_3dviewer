import { core } from "../core.js";
import { apiUrl, appRequestHeaders, remoteAssetUrl } from "../remote.js";
import { toastHelper } from "../viewer-utils.js";
import { t } from "../i18n-utils.js";
import { StatusPoller } from "../status-poller.js";
import { UltraLoader } from "../ultra-loader.js";
import { makePanelWindow } from "./panel-window.js";
import { hidePreviewBadge, showPreviewBadge } from "../loaders.js";

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
  "spz", "splat", "ksplat", "sog", "rad",
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

// How much of the top progress bar the upload itself takes; the worker's
// 0-100 fills the rest.
const UPLOAD_PROGRESS_SHARE = 30;

// fetch() cannot report how much of a request body has been sent, so the
// upload goes through XMLHttpRequest; it resolves to a Response like fetch().
function sendWithProgress(url, { method, body, headers }, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    Object.entries(headers || {}).forEach(([name, value]) => xhr.setRequestHeader(name, value));
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded, event.total);
    });
    xhr.addEventListener("load", () => {
      const body = [204, 205, 304].includes(xhr.status) ? null : xhr.responseText;
      resolve(new Response(body, { status: xhr.status, statusText: xhr.statusText }));
    });
    xhr.addEventListener("error", () => reject(new TypeError("Network error during upload")));
    xhr.addEventListener("abort", () => reject(new TypeError("Upload aborted")));
    xhr.send(body);
  });
}

// Attempts per piece of an upload sent in pieces, after a network error or
// an error of the server, a few seconds apart.
const PIECE_ATTEMPTS = 4;
// Pieces sent at once: Cloudflare and the proxies take each piece whole
// before passing it on, which leaves the connection idle between pieces
// sent one by one.
const PIECES_AT_ONCE = 3;

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

// A file sent to the worker in pieces (worker/server.py, /api/model/upload/):
// each under Cloudflare's 100 MB request limit, which a single request of a
// larger file never gets through. Resolves to the Response of the first
// refused request, or of the finish that starts the conversion - answered
// like POST /api/model/create. A backend without it (the Drupal module, an
// older worker) gets the file in one request instead.
async function sendFileInPieces(file, onProgress, { isPrivate = false } = {}) {
  const headers = appRequestHeaders();
  const start = await fetch(apiUrl("/api/model/upload/start"), {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, size: file.size, private: isPrivate }),
  });
  let session = null;
  if (start.ok) {
    try {
      session = await start.json();
    } catch (_error) {
      // A page instead of JSON: a host that answers every path with one.
    }
  } else if (start.status !== 404 && start.status !== 405) {
    return start;
  }
  const { uploadId, chunkBytes } = session || {};
  if (!uploadId || !(chunkBytes > 0)) {
    const formData = new FormData();
    formData.append("file", file);
    const createUrl = apiUrl(isPrivate ? "/api/model/create?private=1" : "/api/model/create");
    return sendWithProgress(createUrl, { method: "POST", body: formData, headers }, onProgress);
  }

  const offsets = [];
  for (let offset = 0; offset < file.size; offset += chunkBytes) offsets.push(offset);
  // Bytes sent of each piece, for one total across the pieces in flight.
  const sent = new Map();
  const reportProgress = () => {
    let total = 0;
    sent.forEach((bytes) => { total += bytes; });
    onProgress?.(Math.min(total, file.size), file.size);
  };
  let refused = null;

  const sendPiece = async (offset) => {
    for (let attempt = 1; ; attempt += 1) {
      let response = null;
      let error = null;
      try {
        response = await sendWithProgress(
          apiUrl(`/api/model/upload/${uploadId}?offset=${offset}`),
          { method: "PUT", body: file.slice(offset, offset + chunkBytes), headers },
          (loaded) => { sent.set(offset, loaded); reportProgress(); },
        );
      } catch (caught) {
        error = caught;
      }
      if (response?.ok) {
        sent.set(offset, Math.min(chunkBytes, file.size - offset));
        reportProgress();
        return;
      }
      sent.set(offset, 0);
      reportProgress();
      // Refused (limits, login, a bad piece): no use sending it again.
      if (response && response.status < 500) {
        refused = refused || response;
        return;
      }
      if (attempt >= PIECE_ATTEMPTS || refused || failure) {
        if (response) refused = refused || response;
        else throw error;
        return;
      }
      await wait(2000 * attempt);
    }
  };

  // A piece that failed for good stops the others from starting new ones.
  let failure = null;
  const queue = [...offsets];
  const sender = async () => {
    try {
      while (queue.length && !refused && !failure) await sendPiece(queue.shift());
    } catch (error) {
      failure = failure || error;
    }
  };
  await Promise.all(Array.from({ length: Math.min(PIECES_AT_ONCE, offsets.length) }, sender));
  if (failure) throw failure;
  if (refused) return refused;
  return fetch(apiUrl(`/api/model/upload/${uploadId}/finish`), { method: "POST", headers });
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

    // Which layer refused an upload as too large: the worker answers with
    // JSON, Cloudflare (100 MB on Free/Pro) and nginx with an HTML page.
    async describeTooLarge(response) {
      let body = "";
      try {
        body = await response.text();
      } catch (_error) {
        // No body - the generic message below.
      }
      try {
        const reason = JSON.parse(body)?.error;
        if (reason) return t("uploadPanel.tooLargeWorker", { reason }, "The server refused the file: {reason}");
      } catch (_error) {
        // Not the worker's JSON.
      }
      if (/cloudflare/i.test(body)) {
        return t(
          "uploadPanel.tooLargeCloudflare",
          "The file is larger than Cloudflare lets through (100 MB on the Free and Pro plans), so it never reached the server."
        );
      }
      if (/nginx/i.test(body)) {
        return t("uploadPanel.tooLargeProxy", "A proxy in front of the server refused the file as too large (nginx client_max_body_size).");
      }
      return t("uploadPanel.tooLarge", "That file is too large to upload.");
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
      // Private needs an owner: only with accounts, logged in.
      if (this.uploadInputs.privateField) this.uploadInputs.privateField.hidden = !(state.required && state.user);
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

    isUploadPrivate() {
      const field = this.uploadInputs?.privateField;
      return Boolean(field && !field.hidden && this.uploadInputs.private.checked);
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
      this.uploadInputs.private.checked = false;
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

    // Blurs the viewer and the thumbnail gallery while a model is uploaded
    // and converted (upload-panel.css); `gallery: false` leaves the gallery
    // as it is, e.g. until the new model's thumbnails replace it.
    setUploadBusy(busy, { viewer = true, gallery = true } = {}) {
      const targets = [];
      if (viewer && core.container) targets.push(core.container);
      if (gallery) {
        const imageList = document.getElementById("image-list");
        const galleryElement = imageList?.closest(".image-list-scroller") || imageList;
        if (galleryElement) targets.push(galleryElement);
      }
      targets.forEach((element) => {
        element.classList.toggle("viewer-upload-busy", busy);
        if (busy) element.setAttribute("aria-busy", "true");
        else element.removeAttribute("aria-busy");
      });
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
        privateLabel: t("uploadPanel.private", "Private"),
        privateHint: t("uploadPanel.privateHint", "Only you and admins see it in the model list; anyone with its link can still open it."),
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
          <label id="uploadPanelPrivateField" class="upload-panel-private" title="${panelText.privateHint}" hidden>
            <input id="uploadPanelPrivate" type="checkbox" />
            <span>${panelText.privateLabel}</span>
          </label>
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
        private: panel.querySelector("#uploadPanelPrivate"),
        privateField: panel.querySelector("#uploadPanelPrivateField"),
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
      makePanelWindow(this, panel, panel.querySelector(".upload-panel-header"), () => this.closeUploadPanel());
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
            event.preventDefault();
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
          body: JSON.stringify({ url: result.url, private: this.isUploadPrivate() }),
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

      const isPrivate = this.isUploadPrivate();
      await this.sendUploadRequest((onProgress) => sendFileInPieces(file, onProgress, { isPrivate }), "/api/model/create");
    },

    // Starts a conversion (an uploaded file or a link) and follows it: the
    // upload is the first of the processing steps, with the bytes sent so
    // far under it, and the viewer stays blurred until the model is in.
    // `request`: fetch()'s options, or a function of the progress callback
    // that sends it and resolves to the Response.
    async sendUploadRequest(request, endpoint) {
      const fromUrl = endpoint.endsWith("-from-url");
      this.uploadInputs.submit.disabled = true;
      this.setUploadStatusText(
        fromUrl ? t("uploadPanel.downloading", "Downloading the file...") : t("uploadPanel.uploading", "Uploading..."),
        "info"
      );
      const firstStep = fromUrl ? "processingSteps.downloadingFile" : "processingSteps.uploadingFile";
      UltraLoader.start([firstStep, ...this.processingLoadingStepKeys], { initialProgress: 0 });
      this.setUploadBusy(true);
      let started = false;

      const onProgress = (loaded, total) => {
        const fraction = total ? loaded / total : 0;
        UltraLoader.set(fraction * UPLOAD_PROGRESS_SHARE);
        UltraLoader.detail(fraction, () => t(
          "processingSteps.uploadedBytes",
          { percent: Math.round(fraction * 100), loaded: formatMegabytes(loaded), total: formatMegabytes(total) },
          "{percent}% · {loaded} / {total} MB"
        ));
      };

      try {
        const response = typeof request === "function"
          ? await request(onProgress)
          : await sendWithProgress(apiUrl(endpoint), request, fromUrl ? null : onProgress);
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
          this.setUploadStatusText(await this.describeTooLarge(response), "error");
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

        started = true;
        this.closeUploadPanel();
        this.refreshUploadLimits();
        toastHelper("uploadStarted", "info");

        UltraLoader.phase({ stepOffset: 1, progressFrom: UPLOAD_PROGRESS_SHARE });
        const poller = new StatusPoller(jobId, {
          forcePoll: true,
          onUpdate: (statusData) => this.handleUploadStatusUpdate(statusData, jobId),
          onError: () => this.setUploadBusy(false),
        });
        poller.start();
      } catch (error) {
        this.reportError(error, { context: "Model upload failed" });
        this.setUploadStatusText(t("uploadPanel.uploadError", "Upload failed. Please try again."), "error");
        toastHelper("uploadError", "error");
      } finally {
        // Refused or failed before any processing: the panel says why.
        if (!started) {
          UltraLoader.hide();
          this.setUploadBusy(false);
        }
        if (this.uploadInputs?.submit) {
          const state = this.authState;
          this.uploadInputs.submit.disabled = Boolean(state?.required && !state.user);
        }
      }
    },

    // Status updates of an upload, one after the other: a point cloud's
    // preview has to be in before the finished model replaces it.
    handleUploadStatusUpdate(data, jobId) {
      this.uploadStatusQueue = (this.uploadStatusQueue || Promise.resolve())
        .then(() => this.applyUploadStatus(data, jobId))
        .catch((error) => {
          this.setUploadBusy(false);
          this.reportError(error, { context: "Upload status update failed" });
        });
      return this.uploadStatusQueue;
    },

    async applyUploadStatus(data, jobId) {
      if (!data) return;
      const finished = ["ready", "failed", "error"].includes(data.status);
      // A point cloud's quick preview (worker/pointcloud.py) while its
      // streamed tiles are built: shown once, replaced when they are ready.
      if (!finished && data.previewUrl && this.uploadPreviewJob !== jobId) {
        this.uploadPreviewJob = jobId;
        core.autoPath = remoteAssetUrl(data.previewUrl);
        // The preview is there to be looked at while the rest is built.
        this.setUploadBusy(false, { gallery: false });
        this.resetLoadedModelState();
        await this.mainLoadModelWrapper();
        showPreviewBadge(t("loadingLog.pointCloudPreview", "Preview · building the full point cloud..."));
        toastHelper("pointCloudPreview", "info");
        return;
      }
      if (finished && this.uploadPreviewJob === jobId) {
        this.uploadPreviewJob = null;
        hidePreviewBadge();
      }
      if (data.status === "ready" && data.modelUrl) {
        toastHelper("uploadReady", "success");
        core.autoPath = remoteAssetUrl(data.modelUrl);
        // The model's own loading progress shows on the viewer; the gallery
        // waits for the new thumbnails.
        this.setUploadBusy(false, { gallery: false });
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
      // renderModelGalleryImages built a new, unblurred gallery; one left as
      // it was (and the viewer, after a failure) is unblurred here.
      if (finished) this.setUploadBusy(false);
    },
  });
}
