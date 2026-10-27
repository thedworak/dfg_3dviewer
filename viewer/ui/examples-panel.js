import { core } from "../core.js";
import { toastHelper } from "../viewer-utils.js";
import { t } from "../i18n-utils.js";
import { isOnline } from "../connectivity.js";
import { makePanelWindow } from "./panel-window.js";
import { exampleManifestOption, getExampleManifests, groupExampleOptions, refreshExampleManifests } from "../example-manifests.js";
import { inspectAIM3DManifest, manifestModelUrls } from "../manifesto/manifest-inspection.js";
import { featureIconsCaption } from "./feature-icons.js";
import { fetchModelValidation } from "./validation-report.js";
import { clearExampleModelSelection } from "../example-models.js";

// The example AIM3D/IIIF manifests the dev build offers in its manifest
// form (metadata.js): in the app the third tab of the "Models" panels
// (models-source.js), on the page the header's manifests button. The list itself is fetched on every open and on
// "Refresh" (example-manifests.js). The "./manifests/" ones are bundled with
// the app and work offline; the others are fetched from the internet.
const GROUPS = [
  { type: "aim3if", label: ["examplesPanel.aim3d", "AIM3D manifests"], key: "aim3d" },
  { type: "iiif", label: ["examplesPanel.iiif", "IIIF manifests"], key: "iiif" },
];

const isBundled = (url) => url.startsWith("./");

// What each manifest contains and whether its values are right
// (manifest-inspection.js), with the check of its model file when a worker
// serves it: fetched once per manifest and session, shown as icons under its
// name (feature-icons.js).
const inspections = new Map();

function inspectExample(url) {
  if (!inspections.has(url)) {
    const absolute = new URL(url, window.location.href).href;
    inspections.set(url, fetch(absolute)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
      .then(async (manifest) => ({
        inspection: inspectAIM3DManifest(manifest),
        modelValidation: await fetchModelValidation(manifestModelUrls(manifest, absolute)[0]),
      }))
      .catch(() => {
        // Not cached: offline now, perhaps online on the next open.
        inspections.delete(url);
        return null;
      }));
  }
  return inspections.get(url);
}

// "(localhost)" in the dev names means "served with the viewer" - in the app
// that is the app itself.
const displayName = (name) => name.replace(/\s*\(localhost\)\s*$/i, "");

export function attachExamplesPanel(Viewer) {
  Object.assign(Viewer, {
    closeExamplesPanel() {
      if (this.examplesPanel) this.examplesPanel.hidden = true;
    },

    // The page's header button (main.js): opens the list, or closes it.
    toggleExamplesPanel(event) {
      event?.preventDefault?.();
      if (this.examplesPanel?.hidden === false) {
        this.closeExamplesPanel();
        return;
      }
      this.closeActionMenu?.();
      this.createExamplesPanel();
      if (!this.examplesPanel) return;
      this.examplesPanel.hidden = false;
      this.loadExamplesList();
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
      makePanelWindow(this, panel, panel.querySelector(".upload-panel-header"), () => this.closeExamplesPanel());
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
        this.examplesList.appendChild(heading);
        // A model's manifests folded under its name (with their count), each
        // by what it changes; a group stays open across re-renders.
        groupExampleOptions(examples[key].map(exampleManifestOption)).forEach(({ group, items }) => {
          const list = document.createElement("ul");
          list.className = "models-panel-list";
          items.forEach(({ url, name, baseUrl }) => list.appendChild(this.renderExampleRow({ url, name, baseUrl, type, online })));
          if (!group) {
            this.examplesList.appendChild(list);
            return;
          }
          const details = document.createElement("details");
          details.className = "examples-panel-group";
          details.dataset.group = `${key}:${group.id}`;
          details.open = this.openExampleGroups?.has(details.dataset.group) === true;
          const summary = document.createElement("summary");
          summary.className = "examples-panel-subheading";
          const title = document.createElement("span");
          title.textContent = group.name;
          const count = document.createElement("span");
          count.className = "examples-panel-count";
          count.textContent = String(items.length);
          summary.append(title, count);
          details.append(summary, list);
          details.addEventListener("toggle", () => {
            this.openExampleGroups ??= new Set();
            if (details.open) this.openExampleGroups.add(details.dataset.group);
            else this.openExampleGroups.delete(details.dataset.group);
          });
          this.examplesList.appendChild(details);
        });
      });
    },

    renderExampleRow({ url, name, baseUrl, type, online }) {
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
      text.appendChild(title);
      // An icon instead of a caption: a phone for the bundled ones, a
      // globe for those fetched from the internet.
      const bundled = isBundled(url);
      const sourceLabel = bundled
        ? t("examplesPanel.bundled", "In the app, works offline")
        : t("examplesPanel.online", "Needs an internet connection");
      const source = document.createElement("span");
      source.className = "examples-panel-source";
      source.dataset.source = bundled ? "bundled" : "online";
      source.setAttribute("role", "img");
      source.setAttribute("aria-label", sourceLabel);
      source.title = sourceLabel;
      button.append(text, source);
      button.disabled = !online && !bundled;
      if (!button.disabled) {
        inspectExample(url).then((result) => {
          if (result && text.isConnected) text.appendChild(featureIconsCaption(result.inspection, result.modelValidation));
        });
      }
      this.bindEventListener(button, "click", () => this.loadExampleManifest(url, type, baseUrl));
      item.appendChild(button);
      return item;
    },

    async loadExampleManifest(url, type, baseUrl) {
      this.closeExamplesPanel();
      clearExampleModelSelection();
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
