import { core } from "../core.js";
import {
  apiUrl, appRequestHeaders, remoteAssetUrl, isAppBuild, hasRemote, remoteBase, setRemoteUrl,
  defaultRemoteUrl, addedRemoteUrls, removeRemoteUrl, isDefaultRemote,
} from "../remote.js";
import { listLibrary, saveToLibrary, repositoryEntryId } from "../offline-library.js";
import { toastHelper } from "../viewer-utils.js";
import { isOnline } from "../connectivity.js";
import { hasFeature, isFeatureGatingEnabled } from "../app-features.js";
import { createLockIcon } from "./lock-icon.js";
import { t } from "../i18n-utils.js";
import { makePanelWindow } from "./panel-window.js";
import { metaCaption, metaPart } from "./meta-icons.js";
import { modelCheckPart } from "./feature-icons.js";
import { fillModelThumbnail } from "./model-thumbnail.js";
import { ifcPropertiesUrlForModel, setPendingIfcProperties } from "../ifc-properties.js";
import { setPendingSavedSettings } from "../metadata.js";
import { clearExampleModelSelection } from "../example-models.js";
import { modelLicenseLabel, modelTypeLabel } from "./model-metadata.js";

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
        title: t("modelsPanel.title", "ExHUB"),
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
        <div id="modelsPanelRepository" class="models-panel-repository">
          <div class="models-panel-repository-row">
            <span class="models-panel-repository-current"></span>
            <select id="modelsPanelRepositorySelect" aria-label="${t("modelsPanel.repositoryChoose", "Repository")}"></select>
            <button type="button" class="models-panel-repository-remove" aria-label="${t("modelsPanel.repositoryRemove", "Remove this repository")}" title="${t("modelsPanel.repositoryRemove", "Remove this repository")}">&minus;</button>
            <button type="button" class="models-panel-repository-add" aria-label="${t("modelsPanel.repositoryAdd", "Add a repository by its address")}" title="${t("modelsPanel.repositoryAdd", "Add a repository by its address")}" aria-expanded="false">+</button>
          </div>
          <form class="models-panel-repository-form" hidden>
            <label for="modelsPanelRepositoryUrl">${t("modelsPanel.repositoryLabel", "Repository address")}</label>
            <div class="models-panel-repository-row">
              <input id="modelsPanelRepositoryUrl" type="text" inputmode="url" autocapitalize="off" spellcheck="false" autocomplete="url" placeholder="https://repository.example.org" />
              <button type="submit">${t("modelsPanel.repositorySave", "Connect")}</button>
            </div>
          </form>
        </div>` : ""}
        <ul id="modelsPanelList" class="models-panel-list"></ul>
      `;

      const sourceToggle = this.createModelsSourceToggle?.("remote");
      if (sourceToggle) panel.querySelector(".upload-panel-header").after(sourceToggle);

      core.container.appendChild(panel);
      this.modelsPanel = panel;
      this.modelsList = panel.querySelector("#modelsPanelList");

      // The app build reaches the repository over the network (remote.js):
      // ExHUB, the one it was built with, or another one added by its
      // address - kept on the device.
      const repository = panel.querySelector("#modelsPanelRepository");
      if (repository) {
        const select = repository.querySelector("select");
        const form = repository.querySelector("form");
        const addButton = repository.querySelector(".models-panel-repository-add");
        const urlInput = form.querySelector("input");
        const switchTo = (url) => {
          const value = setRemoteUrl(url);
          if (value === null) {
            toastHelper("repositoryUrlInvalid", "error");
            return false;
          }
          this.refreshAuthState?.();
          this.updateRepositoryFormVisibility();
          this.loadModelsList();
          return true;
        };
        this.bindEventListener(select, "change", () => switchTo(select.value));
        this.bindEventListener(repository.querySelector(".models-panel-repository-remove"), "click", () => {
          removeRemoteUrl(remoteBase());
          this.refreshAuthState?.();
          this.updateRepositoryFormVisibility();
          this.loadModelsList();
        });
        // Locked (hasFeature()): a tap on "+" says why.
        this.bindEventListener(addButton, "click", () => {
          if (repository.dataset.locked === "true") {
            toastHelper("planLocked", "info", { key: "plan-locked", replace: true });
            this.showLockedFeature?.("customRepository");
            return;
          }
          form.hidden = !form.hidden;
          addButton.setAttribute("aria-expanded", String(!form.hidden));
          if (!form.hidden) urlInput.focus();
        });
        this.bindEventListener(form, "submit", (event) => {
          event.preventDefault();
          if (!switchTo(urlInput.value)) return;
          urlInput.value = "";
          form.hidden = true;
          addButton.setAttribute("aria-expanded", "false");
        });
      }

      this.updateRepositoryFormVisibility();

      const closeButton = panel.querySelector("#modelsPanelClose");
      this.bindEventListener(closeButton, "click", () => this.closeModelsPanel());
      makePanelWindow(this, panel, panel.querySelector(".upload-panel-header"), () => this.closeModelsPanel());
    },

    // The repositories to choose from: ExHUB, then those added. Adding one
    // can be locked in the app (hasFeature() in app-features.js); then only
    // ExHUB.
    updateRepositoryFormVisibility() {
      const repository = this.modelsPanel?.querySelector("#modelsPanelRepository");
      if (!repository) return;
      const wasLocked = repository.dataset.locked === "true";
      const locked = isFeatureGatingEnabled() && !hasFeature("customRepository");
      repository.dataset.locked = locked ? "true" : "false";

      const current = remoteBase();
      const choices = [
        ...(defaultRemoteUrl() ? [defaultRemoteUrl()] : []),
        ...(locked ? [] : addedRemoteUrls()),
      ];
      const select = repository.querySelector("select");
      select.textContent = "";
      choices.forEach((url) => {
        const option = document.createElement("option");
        option.value = url;
        option.textContent = this.repositoryName(url);
        option.title = url;
        option.selected = url === current;
        select.appendChild(option);
      });
      // One choice: its name, not a list of one.
      select.hidden = choices.length < 2;
      const name = repository.querySelector(".models-panel-repository-current");
      name.hidden = choices.length > 1;
      name.textContent = current ? this.repositoryName(current) : "";
      name.title = current;
      repository.querySelector(".models-panel-repository-remove").hidden = locked || !current || isDefaultRemote(current);

      const addButton = repository.querySelector(".models-panel-repository-add");
      addButton.classList.toggle("plan-locked", locked);
      addButton.querySelector(".plan-lock-icon")?.remove();
      if (locked) addButton.appendChild(createLockIcon());
      const form = repository.querySelector("form");
      // No repository at all (an app built without one): the address first.
      if (locked) form.hidden = true;
      else if (!current) form.hidden = false;
      addButton.setAttribute("aria-expanded", String(!form.hidden));
      if (wasLocked !== locked && this.modelsPanel?.hidden === false) this.loadModelsList();
    },

    // "ExHUB" for the one the app was built with, else the address without
    // "https://".
    repositoryName(url) {
      if (isDefaultRemote(url)) return t("modelsPanel.exhub", "ExHUB");
      return url.replace(/^https:\/\//, "");
    },

    async loadModelsList() {
      // Also called after login/logout to refresh delete permissions, so it
      // has to no-op quietly when the panel was never opened, or is closed.
      if (!this.modelsList || this.modelsPanel?.hidden) return;
      const list = this.modelsList;
      list.textContent = "";

      // Not in this plan (models-source.js keeps the panel closed; this is
      // the fallback if it gets here anyway).
      if (!hasFeature("remoteModels")) {
        const lockedItem = document.createElement("li");
        lockedItem.className = "models-panel-empty";
        lockedItem.append(createLockIcon(), t("toasts.planLocked", "Available in the Business plan."));
        list.appendChild(lockedItem);
        return;
      }

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
        const response = await fetch(apiUrl("/api/jobs"), { headers: appRequestHeaders() });
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

    // A model converted from IFC has its properties in metadata/<name>_ifc.json.
    // The app opens repository models from a downloaded File (blob: URL), so it
    // fetches that file here instead of the loader. Null when there is none.
    // /files/ never changes under its URL (worker/server.py, _serve_file), so
    // the WebView's and Cloudflare's copies are used (no cache: "no-store").
    async fetchIfcProperties(job) {
      const url = ifcPropertiesUrlForModel(remoteAssetUrl(job.modelUrl));
      if (!url) return null;
      try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        return data?.elements ? data : null;
      } catch {
        return null;
      }
    },

    // The model's saved viewer settings ("Save settings": metadata/<file>_viewer.json
    // next to it, see worker-model.js), for a copy opened from a File, which
    // has no folder to look in. Null when there are none. Never cached: they
    // are rewritten in place.
    async fetchSavedSettings(job) {
      try {
        const modelUrl = new URL(remoteAssetUrl(job.modelUrl), window.location.href);
        const fileName = decodeURIComponent(modelUrl.pathname.split("/").pop());
        const response = await fetch(new URL(`metadata/${encodeURIComponent(fileName)}_viewer.json`, modelUrl), { cache: "no-cache" });
        if (!response.ok) return null;
        const data = await response.json();
        return data && typeof data === "object" ? data : null;
      } catch {
        return null;
      }
    },

    // A .rad (the level-of-detail tree of Gaussian splats, worker/splats.py)
    // is paged from the server: the coarse splats first, finer ones where
    // the camera looks (splats.js). Downloaded whole, it would wait for the
    // full tree and decode all of it.
    isPagedModel(job) {
      return String(job?.modelUrl || "").split(/[?#]/)[0].toLowerCase().endsWith(".rad");
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
        const ifcProperties = await this.fetchIfcProperties(job);
        const settings = await this.fetchSavedSettings(job);
        const fileName = decodeURIComponent(String(job.modelUrl).split(/[?#]/)[0].split("/").pop());
        await saveToLibrary({
          id: repositoryEntryId(job.id),
          name: job.name || fileName,
          fileName,
          source: "repository",
          remoteId: job.id,
          file,
          thumbnail,
          ifcProperties,
          settings,
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
      // The name entered with the model (model-metadata.js), else its file's.
      const metadata = job.metadata || null;
      const name = metadata?.name || job.name || job.id;
      const item = document.createElement("li");
      item.className = "models-panel-row";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "models-panel-item";
      button.title = [
        name,
        metadata?.author,
        metadata?.date,
        modelLicenseLabel(metadata?.license),
        metadata && job.name && job.name !== name ? job.name : "",
      ].filter(Boolean).join(" · ");

      // Always a thumbnail: a generic one when the job has no image yet or it
      // fails to load.
      const thumbSlot = document.createElement("span");
      thumbSlot.className = "models-panel-item-thumb";
      thumbSlot.setAttribute("aria-hidden", "true");
      fillModelThumbnail(thumbSlot, job.imageUrls?.[0] ? remoteAssetUrl(job.imageUrls[0]) : "", job.id);
      button.appendChild(thumbSlot);

      const text = document.createElement("div");
      text.className = "models-panel-item-text";

      const label = document.createElement("span");
      label.className = "models-panel-item-name";
      label.textContent = name;
      text.appendChild(label);

      // The type entered with the model, as a pill first in the caption.
      const typeLabel = modelTypeLabel(metadata?.type);
      const type = typeLabel ? document.createElement("span") : null;
      if (type) {
        type.className = "models-panel-item-type";
        type.dataset.type = metadata.type;
        type.textContent = typeLabel;
      }

      // job.owner is null for anonymous uploads (accounts off, or jobs from
      // before accounts were enabled) - the caption then just falls back to
      // the date. job.validation: the worker's check of the model file
      // (validation.json), null for formats it does not check.
      if (type || job.owner || job.createdAt || job.validation || job.private) {
        text.appendChild(metaCaption([
          type,
          job.private ? metaPart("private", t("modelsMeta.private", "Private: only its owner and admins see it in this list")) : null,
          job.owner ? metaPart("user", t("modelsMeta.uploadedBy", "Uploaded by"), job.owner) : null,
          job.createdAt
            ? metaPart("date", t("modelsMeta.uploaded", "Uploaded"), new Date(job.createdAt * 1000).toLocaleDateString())
            : null,
          modelCheckPart(job.validation),
        ]));
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

      // Private or listed for everyone: for a model with an owner (accounts
      // on), switched by its owner or an admin - the ones who may delete it.
      if (job.owner && this.authState?.required) {
        item.appendChild(this.createVisibilityButton(job, name));
      }

      // Its metadata, by the same people (worker/model_metadata.py); an
      // older worker lists no "metadata" field and has no form to save it.
      if ("metadata" in job) {
        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "models-panel-edit";
        const editAria = t("modelMetadata.editAria", { name }, "Edit the metadata of {name}");
        editButton.setAttribute("aria-label", editAria);
        editButton.title = editAria;
        this.bindEventListener(editButton, "click", (event) => {
          event.stopPropagation();
          this.editModelMetadata(job.id, metadata);
        });
        item.appendChild(editButton);
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

    createVisibilityButton(job, name) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "models-panel-visibility";
      const render = () => {
        const label = job.private
          ? t("modelsPanel.makePublic", { name }, "{name} is private - show it to everyone")
          : t("modelsPanel.makePrivate", { name }, "Make {name} private - only you and admins see it in this list");
        button.dataset.state = job.private ? "private" : "public";
        button.setAttribute("aria-label", label);
        button.setAttribute("aria-pressed", String(Boolean(job.private)));
        button.title = label;
      };
      render();
      this.bindEventListener(button, "click", async (event) => {
        event.stopPropagation();
        button.disabled = true;
        try {
          const response = await fetch(apiUrl(`/api/jobs/${encodeURIComponent(job.id)}/visibility`), {
            method: "POST",
            headers: { ...appRequestHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify({ private: !job.private }),
          });
          if (!response.ok) throw new Error(`Visibility change failed (HTTP ${response.status})`);
          job.private = (await response.json()).private === true;
          render();
          // The "Private" mark in the caption follows.
          this.loadModelsList();
          toastHelper(job.private ? "modelMadePrivate" : "modelMadePublic", "info");
        } catch (error) {
          this.reportError(error, { context: "Failed to change model visibility" });
          toastHelper("modelVisibilityError", "error");
        } finally {
          button.disabled = false;
        }
      });
      return button;
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
        const response = await fetch(apiUrl(`/api/jobs/${encodeURIComponent(job.id)}`), { method: "DELETE", headers: appRequestHeaders() });
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
        const response = await fetch(url, { signal: controller.signal });
        response.body?.cancel().catch(() => {});
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
    // Cacheable like fetchIfcProperties: opening the same model again comes
    // from the WebView's cache, a first open from Cloudflare's.
    async downloadRemoteModel(job) {
      if (!isOnline()) return null;
      const fileName = decodeURIComponent(String(job.modelUrl).split(/[?#]/)[0].split("/").pop());
      core.circle?.show?.();
      core.circle?.set?.(0, 100);
      try {
        const response = await fetch(remoteAssetUrl(job.modelUrl));
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
        let ifcProperties = null;
        let settings = null;
        let reachable = false;
        const download = this.canSaveOffline(job) && !this.isPagedModel(job);
        try {
          file = download ? await this.downloadRemoteModel(job) : null;
          if (file) [ifcProperties, settings] = await Promise.all([this.fetchIfcProperties(job), this.fetchSavedSettings(job)]);
          reachable = file !== null || (!download &&
            await this.isRemoteModelReachable(remoteAssetUrl(job.modelUrl)));
        } finally {
          this.remoteModelPending = false;
        }
        if (!reachable) {
          toastHelper("repositoryUnreachable", "info", { key: "repository-unreachable", replace: true });
          return;
        }
        this.closeModelsPanel();
        clearExampleModelSelection();
        if (file) {
          // The metadata window finds the job by the file's name.
          this.openedRepositoryJob = { id: job.id, fileName: file.name };
          setPendingIfcProperties(ifcProperties);
          setPendingSavedSettings(settings);
          const opened = await this.openLocalFile(file);
          setPendingIfcProperties(null);
          setPendingSavedSettings(null);
          if (!opened) return;
        } else {
          this.openedRepositoryJob = null;
          core.autoPath = remoteAssetUrl(job.modelUrl);
          this.resetLoadedModelState();
          await this.mainLoadModelWrapper();
        }
      } else {
        this.openedRepositoryJob = null;
        this.closeModelsPanel();
        clearExampleModelSelection();
        core.autoPath = remoteAssetUrl(job.modelUrl);
        this.resetLoadedModelState();
        await this.mainLoadModelWrapper();
      }

      const galleryCfg = core.CONFIG.viewer?.gallery;
      if (
        (galleryCfg?.build === true || galleryCfg?.buildFake === true) &&
        !core.SANDBOX_MODE &&
        !this.isEmbedMode()
      ) {
        this.renderModelGalleryImages((job.imageUrls || []).map(remoteAssetUrl));
      }
    },
  });
}
