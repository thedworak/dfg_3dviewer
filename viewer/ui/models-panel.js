import { core } from "../core.js";
import { apiUrl, remoteAssetUrl } from "../remote.js";
import { toastHelper } from "../viewer-utils.js";
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
        <ul id="modelsPanelList" class="models-panel-list"></ul>
      `;

      core.container.appendChild(panel);
      this.modelsPanel = panel;
      this.modelsList = panel.querySelector("#modelsPanelList");

      const closeButton = panel.querySelector("#modelsPanelClose");
      this.bindEventListener(closeButton, "click", () => this.closeModelsPanel());
      makePanelWindow(this, panel, panel.querySelector(".upload-panel-header"));
    },

    async loadModelsList() {
      // Also called after login/logout to refresh delete permissions, so it
      // has to no-op quietly when the panel was never opened, or is closed.
      if (!this.modelsList || this.modelsPanel?.hidden) return;
      const list = this.modelsList;
      list.textContent = "";

      let jobs = [];
      try {
        const response = await fetch(apiUrl("/api/jobs"));
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        jobs = Array.isArray(data.jobs) ? data.jobs : [];
      } catch (error) {
        this.reportError(error, { context: "Failed to load models list" });
        const errorItem = document.createElement("li");
        errorItem.className = "models-panel-empty";
        errorItem.textContent = t("modelsPanel.loadError", "Could not load previous models.");
        list.appendChild(errorItem);
        return;
      }

      if (jobs.length === 0) {
        const emptyItem = document.createElement("li");
        emptyItem.className = "models-panel-empty";
        emptyItem.textContent = t("modelsPanel.empty", "No previously generated models yet.");
        list.appendChild(emptyItem);
        return;
      }

      jobs.forEach((job) => list.appendChild(this.renderModelRow(job)));
    },

    renderModelRow(job) {
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

    async loadModelFromList(job) {
      if (!job?.modelUrl) return;
      this.closeModelsPanel();
      core.autoPath = remoteAssetUrl(job.modelUrl);
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
        this.renderModelGalleryImages(job.imageUrls.map(remoteAssetUrl));
      }
    },
  });
}
