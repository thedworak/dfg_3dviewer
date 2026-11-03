import { t } from "../../i18n-utils.js";
import { modelBasename } from "../../model-extension.js";
import { GALLERY_IMAGE_EXT, exampleAssetUrl } from "../../ui/model-thumbnail.js";
import { apiRequest } from "../api.js";
import { confirmDialog, toast } from "../dialogs.js";

// The thumbnails of the viewer's bundled example models (examples/index.json,
// the "Load example model" list): which have renders, where they come from
// and whether they load. Admins render them in the viewer - an example
// opened from here, then "Generate thumbnails" in the editor toolbar
// (editor/thumbnail-capture.js) - and the worker keeps them
// (worker/example_thumbnails.py); without those the gallery shows the
// renders bundled with the viewer (examples/gallery/), if there are any.

// The views in the gallery's order (ui/thumbnail-gallery.js).
const VIEWS = ["side0", "side45", "side90", "side135", "side180", "side225", "side270", "side315", "top"];

const localized = (name, fallback = "") => {
  if (typeof name === "string") return name;
  if (!name || typeof name !== "object") return fallback;
  const lang = (document.documentElement.lang || "en").slice(0, 2);
  return name[lang] || name.en || Object.values(name)[0] || fallback;
};

// The name of an example's set of renders, as the viewer derives it
// (ui/thumbnail-gallery.js exampleGallerySet): its folder right under
// examples/ (one model in every format shares one set), else its filename.
export function exampleSetOf(url) {
  const match = String(url || "").match(/^\.\/examples\/(.+)$/);
  if (!match) return null;
  const parts = match[1].split("/");
  const filename = parts.pop();
  if (!filename) return null;
  const dir = parts.length === 1 && parts[0] !== "gallery" ? parts[0] : filename;
  return { dir, basename: modelBasename(filename) };
}

const storedUrl = (set, view, version) =>
  `/api/examples/thumbnails/${encodeURIComponent(set.dir)}/${encodeURIComponent(`${set.basename}_${view}.png`)}${version ? `?v=${version}` : ""}`;

const bundledUrl = (set, view) =>
  exampleAssetUrl(`gallery/${encodeURIComponent(set.dir)}/${encodeURIComponent(`${set.basename}_${view}.${GALLERY_IMAGE_EXT}`)}`);

// Resolves true when the image loads, false otherwise.
function imageLoads(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image.naturalWidth > 0);
    image.onerror = () => resolve(false);
    image.src = src;
  });
}

class ExamplesSection {
  constructor() {
    const element = document.createElement("section");
    element.className = "exadmin-section exadmin-examples";
    element.innerHTML = `
      <div class="exadmin-section-header">
        <h2></h2>
        <button type="button" class="exadmin-examples-recheck"></button>
      </div>
      <p class="exadmin-reports-hint"></p>
      <p class="upload-panel-status" role="status" aria-live="polite"></p>
      <ul class="exadmin-examples-list"></ul>
    `;
    this.element = element;
    element.querySelector("h2").textContent = t("exadmin.examplesTitle", "Example model thumbnails");
    element.querySelector(".exadmin-reports-hint").textContent = t(
      "exadmin.examplesHint",
      "Open an example in the viewer, set the view you like, then use \"Generate thumbnails\" in the editor toolbar. The renders are kept on the server and shown in the gallery before the ones bundled with the viewer."
    );
    const recheck = element.querySelector(".exadmin-examples-recheck");
    recheck.textContent = t("exadmin.examplesRecheck", "Check again");
    recheck.addEventListener("click", () => this.load());
    this.status = element.querySelector(".upload-panel-status");
    this.list = element.querySelector(".exadmin-examples-list");
  }

  setStatus(message, tone = "info") {
    this.status.textContent = message;
    this.status.dataset.tone = tone;
  }

  async load() {
    this.setStatus(t("exadmin.loading", "Loading..."));
    let list;
    try {
      const response = await fetch(exampleAssetUrl("index.json"), { cache: "no-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      list = await response.json();
    } catch (error) {
      console.error("[exadmin] Failed to load the example list:", error);
      this.setStatus(error.message, "error");
      return;
    }
    let stored = {};
    try {
      stored = (await apiRequest("/api/examples/thumbnails")).thumbnails || {};
    } catch (error) {
      console.warn("[exadmin] Failed to load the stored example thumbnails:", error);
    }
    this.stored = stored;
    this.sets = this.groupSets(list);
    this.render();
  }

  // One row per set of renders, with the examples (formats) that show it.
  groupSets(list) {
    const groups = list?.groups && typeof list.groups === "object" ? list.groups : {};
    const sets = new Map();
    (Array.isArray(list?.models) ? list.models : []).forEach((entry) => {
      const set = exampleSetOf(entry?.url);
      if (!set) return;
      const key = `${set.dir}/${set.basename}`;
      if (!sets.has(key)) {
        sets.set(key, { key, set, title: localized(groups[entry.group], entry.group || set.basename), examples: [] });
      }
      sets.get(key).examples.push({ url: entry.url, name: localized(entry.name, entry.url) });
    });
    return [...sets.values()];
  }

  render() {
    this.list.textContent = "";
    if (!this.sets.length) {
      const empty = document.createElement("li");
      empty.className = "exadmin-reports-empty";
      empty.textContent = t("exadmin.examplesEmpty", "No example models.");
      this.list.appendChild(empty);
      this.setStatus("");
      return;
    }
    const checks = this.sets.map((entry) => {
      const { item, check } = this.renderSet(entry);
      this.list.appendChild(item);
      return check;
    });
    Promise.all(checks).then((results) => {
      const loading = results.filter((result) => result === "ok").length;
      const broken = results.filter((result) => result === "broken").length;
      this.setStatus(
        t("exadmin.examplesSummary", { loading, total: results.length, broken },
          "Thumbnails load for {loading} of {total} sets; {broken} fail to load."),
        broken ? "error" : "info"
      );
    });
  }

  renderSet({ key, set, title, examples }) {
    const stored = this.stored[key];
    const storedViews = Array.isArray(stored?.views) ? stored.views : [];
    const item = document.createElement("li");
    item.className = "exadmin-report exadmin-example";

    const thumb = document.createElement("span");
    thumb.className = "models-panel-item-thumb exadmin-example-thumb";
    item.appendChild(thumb);

    const body = document.createElement("div");
    body.className = "exadmin-example-body";
    const head = document.createElement("div");
    head.className = "exadmin-report-head";
    const name = document.createElement("strong");
    name.textContent = title;
    const where = document.createElement("span");
    where.className = "exadmin-report-date";
    where.textContent = `gallery/${key}`;
    head.append(name, where);
    body.appendChild(head);

    const formats = document.createElement("p");
    formats.className = "exadmin-report-meta";
    formats.textContent = examples.map((example) => example.name).join(" · ");
    body.appendChild(formats);

    const state = document.createElement("p");
    state.className = "exadmin-report-meta exadmin-example-state";
    state.textContent = t("exadmin.examplesChecking", "Checking...");
    body.appendChild(state);

    const actions = document.createElement("div");
    actions.className = "exadmin-report-actions";
    const open = document.createElement("a");
    open.href = `${exampleAssetUrl("../")}?model=${encodeURIComponent(examples[0].url)}`;
    open.target = "_blank";
    open.rel = "noopener";
    open.textContent = t("exadmin.examplesOpen", "Open in the viewer to render");
    actions.appendChild(open);
    if (storedViews.length) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "exadmin-report-danger";
      remove.textContent = t("exadmin.examplesRemove", "Remove the viewer's renders");
      remove.addEventListener("click", () => this.remove(set));
      actions.appendChild(remove);
    }
    body.appendChild(actions);
    item.appendChild(body);

    // Each view of the set that shows, the main one (side45) as the picture.
    const check = (async () => {
      const sources = storedViews.length
        ? storedViews.map((view) => storedUrl(set, view, stored.version))
        : VIEWS.map((view) => bundledUrl(set, view));
      const results = await Promise.all(sources.map(imageLoads));
      const loaded = results.filter(Boolean).length;
      const mainIndex = (storedViews.length ? storedViews : VIEWS).indexOf("side45");
      const picture = sources[results[mainIndex] ? mainIndex : results.indexOf(true)];
      if (picture) {
        const image = document.createElement("img");
        image.alt = "";
        image.src = picture;
        thumb.appendChild(image);
      }
      let result;
      if (storedViews.length) {
        result = loaded === sources.length ? "ok" : "broken";
        state.textContent = t("exadmin.examplesStored", { loaded, total: sources.length },
          "Rendered in the viewer: {loaded} of {total} views load.");
      } else if (loaded) {
        result = "ok";
        state.textContent = t("exadmin.examplesBundled", { loaded, total: sources.length },
          "Bundled renders: {loaded} of {total} views load.");
      } else {
        result = "missing";
        state.textContent = t("exadmin.examplesMissing", "No thumbnails - the gallery shows the generic images.");
      }
      item.dataset.status = result;
      return result;
    })();
    return { item, check };
  }

  async remove(set) {
    const confirmed = await confirmDialog({
      message: t("exadmin.examplesRemoveConfirm", "Remove the thumbnails rendered in the viewer? The bundled ones show again."),
      confirmLabel: t("exadmin.examplesRemove", "Remove the viewer's renders"),
      cancelLabel: t("adminPanel.deleteCancel", "Cancel"),
      danger: true,
    });
    if (!confirmed) return;
    try {
      const query = new URLSearchParams({ dir: set.dir, basename: set.basename });
      await apiRequest(`/api/examples/thumbnails?${query}`, "DELETE");
      toast("exampleThumbnailsRemoved", "info");
      await this.load();
    } catch (error) {
      console.error("[exadmin] Failed to remove example thumbnails:", error);
      this.setStatus(error.message, "error");
    }
  }
}

export const examplesSection = {
  id: "examples",
  label: () => t("exadmin.navExamples", "Example thumbnails"),
  mount(container) {
    const section = new ExamplesSection();
    container.appendChild(section.element);
    section.load();
  },
};
