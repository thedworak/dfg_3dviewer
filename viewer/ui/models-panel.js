import { core } from "../core.js";
import { apiUrl, remoteAssetUrl, isAppBuild, hasRemote, remoteBase, setRemoteUrl } from "../remote.js";
import { listLibrary, saveToLibrary, repositoryEntryId } from "../offline-library.js";
import { toastHelper } from "../viewer-utils.js";
import { isOnline } from "../connectivity.js";
import { hasFeature } from "../monetization/plan.js";
import { t } from "../i18n-utils.js";
import { makePanelWindow } from "./panel-window.js";

// GET /api/jobs is public (see worker/server.py's list_jobs) - browsing
// finished models doesn't require an account, only deleting one does (gated
// server-side per job's canDelete, computed from ownership/role). So unlike
// the upload and admin panels, this one's entry point is never hidden.
export function attachModelsPanel(Viewer) {
  Object.assign(Viewer, {
    isModelsPanelOpen() {
      return this.modelsPanel?.hidden === false;
    },

    openModelsPanel(event) {
      this.createModelsPanel();
      this.toggleModelsPanel(event);
    },

    toggleModelsPanel(event) {
      event?.preventDefault?.();
      this.closeActionMenu?.();
      if (!this.modelsPanel) return;
      const willShow = this.modelsPanel.hidden === true;
      this.modelsPanel.hidden = !willShow;
      if (willShow) this.loadModelsList();
    },

    closeModelsPanel() {
      if (this.modelsPanel) this.modelsPanel.hidden = true;
    },

    createModelsPanel() {
      if (!core.container || this.modelsPanel) return;

      const panelText = {
        title: t("modelsPanel.title", "Previously generated models"),
        closeAria: t("modelsPanel.closeAria", "Close models panel"),
      };

      const panel = document.createElement("div");
      panel.id = "modelsPanel";
      panel.hidden = true;
      panel.innerHTML = `
        <div class="upload-panel-header">
          <span>${panelText.title}</span>
          <button id="modelsPanelClose" type="button" aria-label="${panelText.closeAria}">X</button>
        </div>
        ${isAppBuild() ? `
        <form id="modelsPanelRepository" class="models-panel-repository">
          <label for="modelsPanelRepositoryUrl">${t("modelsPanel.repositoryLabel", "Repository address")}</label>
          <div class="models-panel-repository-row">
            <input id="modelsPanelRepositoryUrl" type="text" inputmode="url" autocapitalize="off" spellcheck="false" autocomplete="url" placeholder="https://repository.example.org" />
            <button type="submit">${t("modelsPanel.repositorySave", "Connect")}</button>
          </div>
        </form>` : ""}
        <ul id="modelsPanelList" class="models-panel-list"></ul>
      `;

      const sourceToggle = this.createModelsSourceToggle?.("remote");
      if (sourceToggle) panel.querySelector(".upload-panel-header").after(sourceToggle);

      core.container.appendChild(panel);
      this.modelsPanel = panel;
      this.modelsList = panel.querySelector("#modelsPanelList");

      // The app build reaches the repository over the network (remote.js):
      // its address is set here and kept on the device. Empty = offline only.
      const repositoryForm = panel.querySelector("#modelsPanelRepository");
      if (repositoryForm) {
        const urlInput = repositoryForm.querySelector("input");
        urlInput.value = remoteBase();
        this.bindEventListener(repositoryForm, "submit", (event) => {
          event.preventDefault();
          const value = setRemoteUrl(urlInput.value);
          if (value === null) {
            toastHelper("repositoryUrlInvalid", "error");
            return;
          }
          urlInput.value = value;
          this.refreshAuthState?.();
          this.loadModelsList();
        });
      }

      this.updateRepositoryFormVisibility();

      const closeButton = panel.querySelector("#modelsPanelClose");
      this.bindEventListener(closeButton, "click", () => this.closeModelsPanel());
      makePanelWindow(this, panel, panel.querySelector(".upload-panel-header"));
    },

    // The address field is a Business feature in the app (monetization/plan.js).
    updateRepositoryFormVisibility() {
      const form = this.modelsPanel?.querySelector("#modelsPanelRepository");
      if (!form) return;
      const allowed = hasFeature("customRepository");
      const wasHidden = form.hidden;
      form.hidden = !allowed;
      form.querySelector("input").value = remoteBase();
      if (wasHidden !== form.hidden && this.modelsPanel?.hidden === false) this.loadModelsList();
    },

    async loadModelsList() {
      // Also called after login/logout to refresh delete permissions, so it
      // has to no-op quietly when the panel was never opened, or is closed.
      if (!this.modelsList || this.modelsPanel?.hidden) return;
      const list = this.modelsList;
      list.textContent = "";

      if (!hasRemote()) {
        const emptyItem = document.createElement("li");
        emptyItem.className = "models-panel-empty";
        emptyItem.textContent = t("modelsPanel.noRepository", "Enter the repository address to browse its models.");
        list.appendChild(emptyItem);
        return;
      }

      // The app without network, or with the repository down: a line in the
      // list and a quiet toast, not an error - the device models still work.
      if (isAppBuild() && !isOnline()) {
        const offlineItem = document.createElement("li");
        offlineItem.className = "models-panel-empty";
        offlineItem.textContent = t("modelsPanel.offline", "No internet connection. Models on this device still work.");
        list.appendChild(offlineItem);
        return;
      }

      let jobs = [];
      try {
        const response = await fetch(apiUrl("/api/jobs"));
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        jobs = Array.isArray(data.jobs) ? data.jobs : [];
      } catch (error) {
        this.reportError(error, { context: "Failed to load models list", toast: !isAppBuild() });
        const errorItem = document.createElement("li");
        errorItem.className = "models-panel-empty";
        errorItem.textContent = isAppBuild()
          ? t("modelsPanel.unreachable", "The repository is not responding. Models on this device still work.")
          : t("modelsPanel.loadError", "Could not load previous models.");
        list.appendChild(errorItem);
        if (isAppBuild()) toastHelper("repositoryUnreachable", "info", { key: "repository-unreachable", replace: true });
        return;
      }

      if (jobs.length === 0) {
        const emptyItem = document.createElement("li");
        emptyItem.className = "models-panel-empty";
        emptyItem.textContent = t("modelsPanel.empty", "No previously generated models yet.");
        list.appendChild(emptyItem);
        return;
      }

      let savedIds = new Set();
      try {
        savedIds = new Set((await listLibrary()).map((entry) => entry.id));
      } catch (_error) {
        // No IndexedDB (e.g. blocked storage): rows just offer saving.
      }
      jobs.forEach((job) => list.appendChild(this.renderModelRow(job, savedIds.has(repositoryEntryId(job.id)))));
    },

    // App build only (the browser has the repository at hand). Single-file
    // models only: a 3D Tiles tileset is many files fetched as the camera
    // moves, so it cannot be kept as one entry.
    canSaveOffline(job) {
      if (!isAppBuild()) return false;
      const path = String(job?.modelUrl || "").split(/[?#]/)[0];
      const extension = path.split(".").pop().toLowerCase();
      return path !== "" && extension !== "json" && extension !== "gltf" &&
        (core.SUPPORTED_EXTENSIONS.includes(extension) || this.SUPPORTED_ARCHIVES?.includes(extension));
    },

    async saveModelOffline(job, button) {
      button.disabled = true;
      button.dataset.state = "saving";
      try {
        const response = await fetch(remoteAssetUrl(job.modelUrl));
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const file = await response.blob();
        let thumbnail = null;
        if (job.imageUrls?.[0]) {
          thumbnail = await fetch(remoteAssetUrl(job.imageUrls[0]))
            .then((r) => (r.ok ? r.blob() : null))
            .catch(() => null);
        }
        const fileName = decodeURIComponent(String(job.modelUrl).split(/[?#]/)[0].split("/").pop());
        await saveToLibrary({
          id: repositoryEntryId(job.id),
          name: job.name || fileName,
          fileName,
          source: "repository",
          remoteId: job.id,
          file,
          thumbnail,
        });
        button.dataset.state = "saved";
        const savedAria = t("modelsPanel.savedOffline", { name: job.name || fileName }, "{name} is on this device");
        button.setAttribute("aria-label", savedAria);
        button.title = savedAria;
        toastHelper("librarySaved", "success");
      } catch (error) {
        button.disabled = false;
        button.dataset.state = "";
        this.reportError(error, { context: "Failed to save the model on this device", toast: false });
        toastHelper("librarySaveError", "error");
      }
    },

    renderModelRow(job, savedOffline = false) {
      const name = job.name || job.id;
      const item = document.createElement("li");
      item.className = "models-panel-row";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "models-panel-item";
      button.title = name;

      if (job.imageUrls?.[0]) {
        const thumb = document.createElement("img");
        thumb.src = remoteAssetUrl(job.imageUrls[0]);
        thumb.alt = "";
        thumb.loading = "lazy";
        // App: no broken-image icon when /files/ does not answer.
        if (isAppBuild()) thumb.addEventListener("error", () => thumb.remove(), { once: true });
        button.appendChild(thumb);
      }

      const text = document.createElement("div");
      text.className = "models-panel-item-text";

      const label = document.createElement("span");
      label.className = "models-panel-item-name";
      label.textContent = name;
      text.appendChild(label);

      // job.owner is null for anonymous uploads (accounts off, or jobs from
      // before accounts were enabled) - the caption then just falls back to
      // the date.
      const uploadedBy = job.owner ? t("modelsPanel.uploadedBy", { user: job.owner }, "Uploaded by {user}") : "";
      const uploadedAt = job.createdAt ? new Date(job.createdAt * 1000).toLocaleDateString() : "";
      const captionText = [uploadedBy, uploadedAt].filter(Boolean).join(" · ");
      if (captionText) {
        const caption = document.createElement("span");
        caption.className = "models-panel-item-meta";
        caption.textContent = captionText;
        text.appendChild(caption);
      }

      button.appendChild(text);

      this.bindEventListener(button, "click", () => this.loadModelFromList(job));
      item.appendChild(button);

      if (this.canSaveOffline(job)) {
        const saveButton = document.createElement("button");
        saveButton.type = "button";
        saveButton.className = "models-panel-save";
        const saveAria = savedOffline
          ? t("modelsPanel.savedOffline", { name }, "{name} is on this device")
          : t("modelsPanel.saveOffline", { name }, "Keep {name} on this device");
        saveButton.setAttribute("aria-label", saveAria);
        saveButton.title = saveAria;
        saveButton.dataset.state = savedOffline ? "saved" : "";
        saveButton.disabled = savedOffline;
        this.bindEventListener(saveButton, "click", (event) => {
          event.stopPropagation();
          this.saveModelOffline(job, saveButton);
        });
        item.appendChild(saveButton);
      }

      // canDelete is computed by the worker (own uploads, or admin, or
      // accounts off); older workers omit it and allow deleting as before.
      if (job.canDelete === false) {
        return item;
      }

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "models-panel-delete";
      deleteButton.textContent = "✕";
      const deleteAria = t("modelsPanel.deleteAria", { name }, "Delete {name}");
      deleteButton.setAttribute("aria-label", deleteAria);
      deleteButton.title = deleteAria;
      this.bindEventListener(deleteButton, "click", (event) => {
        event.stopPropagation();
        this.deleteModelFromList(job, item);
      });
      item.appendChild(deleteButton);

      return item;
    },

    async deleteModelFromList(job, item) {
      if (!job?.id) return;
      const name = job.name || job.id;
      const confirmed = await this.confirmDialog({
        message: t(
          "modelsPanel.deleteConfirm",
          { name },
          'Delete "{name}"? This permanently removes the converted model and its renders.'
        ),
        confirmLabel: t("modelsPanel.deleteAction", "Delete"),
        cancelLabel: t("modelsPanel.deleteCancel", "Cancel"),
        danger: true,
      });
      if (!confirmed) return;

      try {
        const response = await fetch(apiUrl(`/api/jobs/${encodeURIComponent(job.id)}`), { method: "DELETE" });
        if (!response.ok && response.status !== 404) {
          throw new Error(`Delete failed (HTTP ${response.status})`);
        }
        item.remove();
        if (this.modelsList && this.modelsList.children.length === 0) {
          const emptyItem = document.createElement("li");
          emptyItem.className = "models-panel-empty";
          emptyItem.textContent = t("modelsPanel.empty", "No previously generated models yet.");
          this.modelsList.appendChild(emptyItem);
        }
        toastHelper("modelDeleted", "info");
      } catch (error) {
        this.reportError(error, { context: "Failed to delete previous model" });
        toastHelper("modelDeleteError", "error");
      }
    },

    // App: is the model file there? Only the response headers are awaited
    // (the body is dropped), so a big model is not downloaded twice.
    async isRemoteModelReachable(url) {
      if (!isOnline()) return false;
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
        return response.ok;
      } catch {
        return false;
      } finally {
        window.clearTimeout(timer);
        controller.abort();
      }
    },

    // App, single-file models: the whole file is downloaded (progress in
    // the loader card) before the current model is cleared, so a connection
    // lost half-way leaves the scene as it was. Returns a File, or null.
    async downloadRemoteModel(job) {
      if (!isOnline()) return null;
      const fileName = decodeURIComponent(String(job.modelUrl).split(/[?#]/)[0].split("/").pop());
      core.circle?.show?.();
      core.circle?.set?.(0, 100);
      try {
        const response = await fetch(remoteAssetUrl(job.modelUrl), { cache: "no-store" });
        if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
        const total = Number(response.headers.get("content-length")) || 0;
        const reader = response.body.getReader();
        const chunks = [];
        let received = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.length;
          if (total) core.circle?.set?.(received, total);
        }
        return new File(chunks, fileName);
      } catch (error) {
        this.reportError(error, { context: "Failed to download the model", toast: false });
        core.circle?.hide?.();
        return null;
      }
    },

    async loadModelFromList(job) {
      if (!job?.modelUrl) return;
      if (isAppBuild()) {
        // One download at a time: a second tap while it runs is ignored.
        if (this.remoteModelPending) return;
        // Before the current model is cleared: with the repository
        // unreachable the app keeps what is on screen, and says so quietly.
        this.remoteModelPending = true;
        let file = null;
        let reachable = false;
        try {
          file = this.canSaveOffline(job) ? await this.downloadRemoteModel(job) : null;
          reachable = file !== null || (!this.canSaveOffline(job) &&
            await this.isRemoteModelReachable(remoteAssetUrl(job.modelUrl)));
        } finally {
          this.remoteModelPending = false;
        }
        if (!reachable) {
          toastHelper("repositoryUnreachable", "info", { key: "repository-unreachable", replace: true });
          return;
        }
        this.closeModelsPanel();
        if (file) {
          if (!(await this.openLocalFile(file))) return;
        } else {
          core.autoPath = remoteAssetUrl(job.modelUrl);
          this.resetLoadedModelState();
          await this.mainLoadModelWrapper();
        }
      } else {
        this.closeModelsPanel();
        core.autoPath = remoteAssetUrl(job.modelUrl);
        this.resetLoadedModelState();
        await this.mainLoadModelWrapper();
      }

      const galleryCfg = core.CONFIG.viewer?.gallery;
      if (
        Array.isArray(job.imageUrls) &&
        job.imageUrls.length > 0 &&
        (galleryCfg?.build === true || galleryCfg?.buildFake === true) &&
        !core.SANDBOX_MODE &&
        !this.isEmbedMode()
      ) {
        this.renderModelGalleryImages(job.imageUrls.map(remoteAssetUrl));
      }
    },
  });
}
