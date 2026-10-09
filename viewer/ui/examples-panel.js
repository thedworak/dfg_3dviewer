import { core } from "../core.js";
import { toastHelper } from "../viewer-utils.js";
import { t } from "../i18n-utils.js";
import { isOnline } from "../connectivity.js";
import { makePanelWindow } from "./panel-window.js";
import { exampleManifestOption, getExampleManifests, refreshExampleManifests } from "../example-manifests.js";

// App only: the example AIM3D/IIIF manifests the dev build offers in its
// manifest form (metadata.js), as the third tab of the "Models" panels
// (models-source.js). The list itself is fetched on every open and on
// "Refresh" (example-manifests.js). The "./manifests/" ones are bundled with
// the app and work offline; the others are fetched from the internet.
const GROUPS = [
  { type: "aim3if", label: ["examplesPanel.aim3d", "AIM3D manifests"], key: "aim3d" },
  { type: "iiif", label: ["examplesPanel.iiif", "IIIF manifests"], key: "iiif" },
];

const isBundled = (url) => url.startsWith("./");

// "(localhost)" in the dev names means "served with the viewer" - in the app
// that is the app itself.
const displayName = (name) => name.replace(/\s*\(localhost\)\s*$/i, "");

export function attachExamplesPanel(Viewer) {
  Object.assign(Viewer, {
    closeExamplesPanel() {
      if (this.examplesPanel) this.examplesPanel.hidden = true;
    },

    createExamplesPanel() {
      if (!core.container || this.examplesPanel) return;

      const panel = document.createElement("div");
      panel.id = "examplesPanel";
      panel.hidden = true;
      panel.innerHTML = `
        <div class="upload-panel-header">
          <span>${t("examplesPanel.title", "Example manifests")}</span>
          <button id="examplesPanelRefresh" type="button" title="${t("examplesPanel.refresh", "Refresh")}" aria-label="${t("examplesPanel.refresh", "Refresh")}">↻</button>
          <button id="examplesPanelClose" type="button" aria-label="${t("examplesPanel.closeAria", "Close")}">X</button>
        </div>
        <div class="examples-panel-list"></div>
      `;

      const sourceToggle = this.createModelsSourceToggle?.("examples");
      if (sourceToggle) panel.querySelector(".upload-panel-header").after(sourceToggle);

      core.container.appendChild(panel);
      this.examplesPanel = panel;
      this.examplesList = panel.querySelector(".examples-panel-list");

      this.bindEventListener(panel.querySelector("#examplesPanelClose"), "click", () => this.closeExamplesPanel());
      this.bindEventListener(panel.querySelector("#examplesPanelRefresh"), "click", () => this.loadExamplesList({ notify: true }));
      makePanelWindow(this, panel, panel.querySelector(".upload-panel-header"));
    },

    // On every open: shows the list in use at once, then fetches the current
    // one and shows that (the list in use stays when the fetch fails).
    async loadExamplesList({ notify = false } = {}) {
      if (!this.examplesList) return;
      this.renderExamplesList();
      const refreshButton = this.examplesPanel?.querySelector("#examplesPanelRefresh");
      if (refreshButton) refreshButton.disabled = true;
      const { updated } = await refreshExampleManifests();
      if (refreshButton) refreshButton.disabled = false;
      if (updated) this.renderExamplesList();
      else if (notify) toastHelper("exampleListRefreshFailed", "warning");
    },

    // Names follow the language, and the online-only examples are disabled
    // without network.
    renderExamplesList() {
      if (!this.examplesList) return;
      const examples = getExampleManifests();
      const online = isOnline();
      this.examplesList.textContent = "";
      GROUPS.forEach(({ type, label, key }) => {
        const heading = document.createElement("h3");
        heading.className = "examples-panel-heading";
        heading.textContent = t(...label);
        const list = document.createElement("ul");
        list.className = "models-panel-list";
        examples[key].map(exampleManifestOption).forEach(({ url, name, baseUrl }) => {
          const item = document.createElement("li");
          item.className = "models-panel-row";
          const button = document.createElement("button");
          button.type = "button";
          button.className = "models-panel-item";
          const text = document.createElement("span");
          text.className = "models-panel-item-text";
          const title = document.createElement("span");
          title.className = "models-panel-item-name";
          title.textContent = displayName(name);
          const caption = document.createElement("span");
          caption.className = "models-panel-item-meta";
          caption.textContent = isBundled(url)
            ? t("examplesPanel.bundled", "In the app, works offline")
            : t("examplesPanel.online", "Needs an internet connection");
          text.append(title, caption);
          button.appendChild(text);
          button.disabled = !online && !isBundled(url);
          this.bindEventListener(button, "click", () => this.loadExampleManifest(url, type, baseUrl));
          item.appendChild(button);
          list.appendChild(item);
        });
        this.examplesList.append(heading, list);
      });
    },

    async loadExampleManifest(url, type, baseUrl) {
      this.closeExamplesPanel();
      try {
        core.objectsConfig.setupIndex = 0;
        await this.setupManifesto(url, "url", type, { baseUrl });
      } catch (error) {
        this.reportError?.(error, { context: "Failed to load the example manifest", toast: false });
        toastHelper("exampleManifestError", "error");
      }
    },
  });
}
