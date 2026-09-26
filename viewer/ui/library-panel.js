import { core } from "../core.js";
import { toastHelper } from "../viewer-utils.js";
import { t } from "../i18n-utils.js";
import { makePanelWindow } from "./panel-window.js";
import { listLibrary, saveToLibrary, removeFromLibrary, libraryEntryFile } from "../offline-library.js";

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} kB`;
}

// Models on this device (see offline-library.js): picking a file from the
// device opens it and keeps a copy here, and models saved from the
// repository (models panel) are listed next to them. Works without network.
export function attachLibraryPanel(Viewer) {
  Object.assign(Viewer, {
    openLibraryPanel(event) {
      event?.preventDefault?.();
      this.createLibraryPanel();
      if (!this.libraryPanel) return;
      const willShow = this.libraryPanel.hidden === true;
      this.libraryPanel.hidden = !willShow;
      if (willShow) this.loadLibraryList();
    },

    closeLibraryPanel() {
      if (this.libraryPanel) this.libraryPanel.hidden = true;
    },

    createLibraryPanel() {
      if (!core.container || this.libraryPanel) return;

      const panelText = {
        title: t("libraryPanel.title", "Models on this device"),
        closeAria: t("libraryPanel.closeAria", "Close"),
        browse: t("libraryPanel.browse", "Browse files…"),
      };

      const panel = document.createElement("div");
      panel.id = "libraryPanel";
      panel.hidden = true;
      panel.innerHTML = `
        <div class="upload-panel-header">
          <span>${panelText.title}</span>
          <button id="libraryPanelClose" type="button" aria-label="${panelText.closeAria}">X</button>
        </div>
        <button id="libraryPanelBrowse" type="button" class="library-panel-browse">${panelText.browse}</button>
        <ul id="libraryPanelList" class="models-panel-list"></ul>
      `;

      const sourceToggle = this.createModelsSourceToggle?.("local");
      if (sourceToggle) panel.querySelector(".upload-panel-header").after(sourceToggle);

      core.container.appendChild(panel);
      this.libraryPanel = panel;
      this.libraryList = panel.querySelector("#libraryPanelList");

      this.bindEventListener(panel.querySelector("#libraryPanelClose"), "click", () => this.closeLibraryPanel());
      this.bindEventListener(panel.querySelector("#libraryPanelBrowse"), "click", () => this.browseDeviceFiles());
      makePanelWindow(this, panel, panel.querySelector(".upload-panel-header"));
    },

    // No accept filter: Android has no MIME types for most 3D formats (.glb,
    // .ifc, ...) and would grey those files out; openLocalFile() checks the
    // extension instead.
    browseDeviceFiles() {
      const input = document.createElement("input");
      input.type = "file";
      input.addEventListener("change", async () => {
        const file = input.files?.[0];
        if (!file) return;
        this.closeLibraryPanel();
        const opened = await this.openLocalFile(file);
        if (!opened) return;
        try {
          await saveToLibrary({ fileName: file.name, source: "device", file });
        } catch (error) {
          this.reportError?.(error, { context: "Failed to keep the model on this device" });
          toastHelper("librarySaveError", "error");
        }
      }, { once: true });
      input.click();
    },

    async loadLibraryList() {
      if (!this.libraryList || this.libraryPanel?.hidden) return;
      const list = this.libraryList;
      list.textContent = "";

      let entries = [];
      try {
        entries = await listLibrary();
      } catch (error) {
        this.reportError?.(error, { context: "Failed to read models on this device" });
      }

      if (entries.length === 0) {
        const emptyItem = document.createElement("li");
        emptyItem.className = "models-panel-empty";
        emptyItem.textContent = t("libraryPanel.empty", "No models on this device yet.");
        list.appendChild(emptyItem);
        return;
      }

      entries.forEach((entry) => list.appendChild(this.renderLibraryRow(entry)));
    },

    renderLibraryRow(entry) {
      const item = document.createElement("li");
      item.className = "models-panel-row";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "models-panel-item";
      button.title = entry.name;

      if (entry.thumbnail) {
        const thumb = document.createElement("img");
        const thumbUrl = URL.createObjectURL(entry.thumbnail);
        thumb.src = thumbUrl;
        thumb.alt = "";
        thumb.addEventListener("load", () => URL.revokeObjectURL(thumbUrl), { once: true });
        button.appendChild(thumb);
      }

      const text = document.createElement("div");
      text.className = "models-panel-item-text";
      const label = document.createElement("span");
      label.className = "models-panel-item-name";
      label.textContent = entry.name;
      text.appendChild(label);
      const caption = document.createElement("span");
      caption.className = "models-panel-item-meta";
      const origin = entry.source === "repository"
        ? t("libraryPanel.fromRepository", "From the repository")
        : t("libraryPanel.fromDevice", "From this device");
      caption.textContent = [origin, formatSize(entry.size), new Date(entry.savedAt).toLocaleDateString()].join(" · ");
      text.appendChild(caption);
      button.appendChild(text);

      this.bindEventListener(button, "click", () => {
        this.closeLibraryPanel();
        this.openLocalFile(libraryEntryFile(entry));
      });
      item.appendChild(button);

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "models-panel-delete";
      deleteButton.textContent = "✕";
      const deleteAria = t("libraryPanel.deleteAria", { name: entry.name }, "Remove {name} from this device");
      deleteButton.setAttribute("aria-label", deleteAria);
      deleteButton.title = deleteAria;
      this.bindEventListener(deleteButton, "click", async (event) => {
        event.stopPropagation();
        const confirmed = await this.confirmDialog({
          message: t("libraryPanel.deleteConfirm", { name: entry.name }, 'Remove "{name}" from this device?'),
          confirmLabel: t("libraryPanel.deleteAction", "Remove"),
          cancelLabel: t("modelsPanel.deleteCancel", "Cancel"),
          danger: true,
        });
        if (!confirmed) return;
        await removeFromLibrary(entry.id);
        this.loadLibraryList();
        this.loadModelsList?.();
      });
      item.appendChild(deleteButton);

      return item;
    },
  });
}
