import { core } from "../core.js";
import { toastHelper } from "../viewer-utils.js";
import { t } from "../i18n-utils.js";
import { isOnline } from "../connectivity.js";
import { makePanelWindow } from "./panel-window.js";
import { exampleManifestOption, getExampleManifests, groupExampleOptions, refreshExampleManifests } from "../example-manifests.js";
import { inspectAIM3DManifest, manifestFeatureIcons, manifestModelUrls } from "../manifesto/manifest-inspection.js";
import { featureIconsCaption, featureIconSvg, featureLabel } from "./feature-icons.js";
import { fetchModelValidation } from "./validation-report.js";
import { clearExampleModelSelection } from "../example-models.js";
import { UPDATE_ARROW, manifestUpdateHint } from "./manifest-update.js";
import { markScenesSeen } from "./scenes-hint.js";

// The example AIM3D/IIIF manifests - "4D scenes", the main content - the
// dev build also offers in its manifest form (metadata.js): in the app the
// first tab of the "Models" panels (models-source.js), on the page the
// first button of the header. The list itself is fetched on every open and on
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
// name (feature-icons.js). The manifest as the viewer loads it (main.js
// getManifestJson): for a bundled one, the worker's copy with the thumbnails
// rendered since, when there is one - so its thumbnails icon shows them.
const inspections = new Map();

function inspectExample(url, loadManifest) {
  if (!inspections.has(url)) {
    const absolute = new URL(url, window.location.href).href;
    inspections.set(url, loadManifest(url)
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

// Search and filter above the list: the words match a scene's name and its
// group, the icon buttons the features its manifest contains (the same icons
// as under each name) - all of the chosen ones. Both stay across re-renders
// and languages. The buttons are those of the features found so far: a
// manifest's icons arrive when its inspection does.
const normalize = (value) => String(value || "").toLocaleLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
const filter = { query: "", features: new Set() };
let seenFeatures = new Map();

// In the order of the inspection (manifest-inspection.js), not of arrival.
function rememberFeatures(inspection, features) {
  const before = seenFeatures.size;
  features.forEach(({ id, icon, label }) => seenFeatures.has(id) || seenFeatures.set(id, { id, icon, label }));
  if (seenFeatures.size === before) return false;
  const order = inspection.features.map((feature) => feature.id);
  seenFeatures = new Map([...seenFeatures].sort(([a], [b]) => order.indexOf(a) - order.indexOf(b)));
  return true;
}

export function attachExamplesPanel(Viewer) {
  Object.assign(Viewer, {
    // After thumbnails were saved to a manifest (thumbnail-capture.js): its
    // icons are checked again on the next render of the list.
    forgetExampleInspections() {
      inspections.clear();
      if (this.examplesPanel?.hidden === false) this.loadExamplesList();
    },

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
          <span>${t("examplesPanel.title", "4D scenes")}</span>
          <button id="examplesPanelRefresh" type="button" title="${t("examplesPanel.refresh", "Refresh")}" aria-label="${t("examplesPanel.refresh", "Refresh")}">↻</button>
          <button id="examplesPanelClose" type="button" aria-label="${t("examplesPanel.closeAria", "Close")}">X</button>
        </div>
        <div class="examples-panel-filter">
          <input class="examples-panel-search" type="search" autocomplete="off" spellcheck="false">
          <div class="examples-panel-features" role="group"></div>
        </div>
        <p class="examples-panel-empty" hidden></p>
        <div class="examples-panel-list"></div>
      `;

      const sourceToggle = this.createModelsSourceToggle?.("examples");
      if (sourceToggle) panel.querySelector(".upload-panel-header").after(sourceToggle);

      core.container.appendChild(panel);
      this.examplesPanel = panel;
      this.examplesList = panel.querySelector(".examples-panel-list");

      const search = panel.querySelector(".examples-panel-search");
      search.value = filter.query;
      this.bindEventListener(search, "input", () => {
        filter.query = search.value;
        this.applyExamplesFilter();
      });
      // Typing stays in the field: no viewer shortcuts; Esc clears it.
      this.bindEventListener(search, "keydown", (event) => {
        event.stopPropagation();
        if (event.key === "Escape" && search.value) {
          event.preventDefault();
          search.value = "";
          filter.query = "";
          this.applyExamplesFilter();
        }
      });
      this.bindEventListener(panel.querySelector("#examplesPanelClose"), "click", () => this.closeExamplesPanel());
      this.bindEventListener(panel.querySelector("#examplesPanelRefresh"), "click", () => this.loadExamplesList({ notify: true }));
      makePanelWindow(this, panel, panel.querySelector(".upload-panel-header"), () => this.closeExamplesPanel());
    },

    // On every open: shows the list in use at once, then fetches the current
    // one and shows that (the list in use stays when the fetch fails).
    async loadExamplesList({ notify = false } = {}) {
      if (!this.examplesList) return;
      markScenesSeen();
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
      this.localizeExamplesFilter();
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
          items.forEach(({ url, name, baseUrl }) => {
            const row = this.renderExampleRow({ url, name, baseUrl, type, online });
            row.dataset.search = normalize(`${displayName(name)} ${group?.name || ""}`);
            list.appendChild(row);
          });
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
            if (this.examplesList?.classList.contains("is-filtering")) return;
            this.openExampleGroups ??= new Set();
            if (details.open) this.openExampleGroups.add(details.dataset.group);
            else this.openExampleGroups.delete(details.dataset.group);
          });
          this.examplesList.appendChild(details);
        });
      });
      this.applyExamplesFilter();
    },

    // The field's texts and the feature buttons, in the current language.
    localizeExamplesFilter() {
      const panel = this.examplesPanel;
      if (!panel) return;
      const search = panel.querySelector(".examples-panel-search");
      search.placeholder = t("examplesPanel.searchPlaceholder", "Search scenes...");
      search.setAttribute("aria-label", t("examplesPanel.search", "Search the scenes"));
      panel.querySelector(".examples-panel-features").setAttribute("aria-label", t("examplesPanel.filterAria", "Show only scenes with"));
      this.renderExampleFeatureButtons();
    },

    renderExampleFeatureButtons() {
      const bar = this.examplesPanel?.querySelector(".examples-panel-features");
      if (!bar) return;
      bar.textContent = "";
      bar.hidden = seenFeatures.size === 0;
      seenFeatures.forEach((feature, id) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "examples-panel-feature";
        button.dataset.feature = id;
        const label = featureLabel(feature);
        button.title = label;
        button.setAttribute("aria-label", label);
        button.setAttribute("aria-pressed", String(filter.features.has(id)));
        button.innerHTML = featureIconSvg(feature.icon);
        button.addEventListener("click", () => {
          if (filter.features.has(id)) filter.features.delete(id);
          else filter.features.add(id);
          button.setAttribute("aria-pressed", String(filter.features.has(id)));
          this.applyExamplesFilter();
        });
        bar.appendChild(button);
      });
      if (seenFeatures.size) {
        const clear = document.createElement("button");
        clear.type = "button";
        clear.className = "examples-panel-feature-clear";
        clear.textContent = t("examplesPanel.clearFilter", "Clear");
        clear.hidden = filter.features.size === 0;
        clear.addEventListener("click", () => {
          filter.features.clear();
          this.renderExampleFeatureButtons();
          this.applyExamplesFilter();
        });
        bar.appendChild(clear);
      }
    },

    // Hides the rows that do not match, then the groups and headings left
    // empty; a group with matches opens while filtering (its own open state
    // comes back after).
    applyExamplesFilter() {
      const list = this.examplesList;
      if (!list) return;
      const words = normalize(filter.query).split(/\s+/).filter(Boolean);
      const active = words.length > 0 || filter.features.size > 0;
      list.classList.toggle("is-filtering", active);
      let shown = 0;
      list.querySelectorAll(".models-panel-row").forEach((row) => {
        const features = (row.dataset.features || "").split(" ");
        const match = words.every((word) => row.dataset.search?.includes(word))
          && [...filter.features].every((id) => features.includes(id));
        row.hidden = !match;
        if (match) shown += 1;
      });
      list.querySelectorAll(".examples-panel-group").forEach((details) => {
        const total = details.querySelectorAll(".models-panel-row").length;
        const matching = details.querySelectorAll(".models-panel-row:not([hidden])").length;
        const any = matching > 0;
        details.hidden = !any;
        const count = details.querySelector(".examples-panel-count");
        if (count) count.textContent = active ? `${matching} / ${total}` : String(total);
        if (active && any) details.open = true;
        else if (!active) details.open = this.openExampleGroups?.has(details.dataset.group) === true;
      });
      // A heading stays while anything up to the next heading is shown.
      list.querySelectorAll(".examples-panel-heading").forEach((heading) => {
        let any = false;
        for (let node = heading.nextElementSibling; node && !node.matches(".examples-panel-heading"); node = node.nextElementSibling) {
          if (!node.hidden && node.querySelector(".models-panel-row:not([hidden])")) any = true;
        }
        heading.hidden = !any;
      });
      const clear = this.examplesPanel?.querySelector(".examples-panel-feature-clear");
      if (clear) clear.hidden = filter.features.size === 0;
      const empty = this.examplesPanel?.querySelector(".examples-panel-empty");
      if (empty) {
        empty.hidden = !active || shown > 0;
        empty.textContent = t("examplesPanel.noMatch", "No scene matches.");
      }
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
        inspectExample(url, (manifestUrl) => this.getManifestJson(manifestUrl, "url")).then((result) => {
          if (!result || !text.isConnected) return;
          text.appendChild(featureIconsCaption(result.inspection, result.modelValidation));
          const features = manifestFeatureIcons(result.inspection);
          item.dataset.features = features.map((feature) => feature.id).join(" ");
          if (rememberFeatures(result.inspection, features)) this.renderExampleFeatureButtons();
          if (filter.features.size) this.applyExamplesFilter();
          // Made for a newer viewer: an up arrow - update to open it, or
          // to see all of it.
          const version = result.inspection.version;
          if (version?.newer) {
            const hint = manifestUpdateHint(version);
            const arrow = document.createElement("span");
            arrow.className = "examples-panel-update";
            arrow.dataset.state = version.state;
            arrow.setAttribute("role", "img");
            arrow.setAttribute("aria-label", hint);
            arrow.title = hint;
            arrow.textContent = UPDATE_ARROW;
            source.before(arrow);
          }
          // Thumbnails saved in the manifest (AIM3DViewer.thumbnails): a
          // badge of its own beside the source, not one icon among many.
          const thumbnails = result.inspection.features.find((feature) => feature.id === "thumbnails");
          if (thumbnails?.present) {
            const label = t("examplesPanel.thumbnails", { count: thumbnails.count }, "Thumbnails saved in the manifest: {count}");
            const badge = document.createElement("span");
            badge.className = "examples-panel-thumbnails";
            badge.setAttribute("role", "img");
            badge.setAttribute("aria-label", label);
            badge.title = label;
            source.before(badge);
          }
        });
      }
      this.bindEventListener(button, "click", () => this.loadExampleManifest(url, type, baseUrl, displayName(name)));
      item.appendChild(button);
      return item;
    },

    // The model list in the header then names the scene (example-models.js).
    async loadExampleManifest(url, type, baseUrl, name = "") {
      this.closeExamplesPanel();
      clearExampleModelSelection({ scene: name });
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
