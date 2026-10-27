import { t } from "./i18n-utils.js";
import { isOnline } from "./connectivity.js";
import { configuredUrl, createRemoteList, isRelativeUrl, listSite, localizedName } from "./remote-list.js";
import DEFAULT_LIST from "./examples/index.json";

// The example models of the "Load example model" select (main.js). The list
// is fetched at runtime (remote-list.js; when: main.js's watchExampleModelList)
// from viewer.exampleModelsUrl (viewer-settings.json), so
// a new example needs no new build or app release. The bundled copy is
// examples/index.json, the same file published at <site>/examples/index.json.
//
// Format: { "models": [entry] }, entry = { url, name, app? }. "name" may be a
// string or { en, de, pl }; "./examples/..." URLs are served with the viewer.
// app: false - not offered in the app (test files, and models the app has a
// lighter version of; the app build leaves them out of its bundle).
//
// The app has the models of the list it was built with. Any other "./" entry
// is a model added since: it is loaded from the list's site, online only.
const IS_MOBILE_BUILD = typeof __BUILD__ !== "undefined" && __BUILD__ === "mobile";
// The web viewer serves the list itself; the app fetches it from the site.
const DEFAULT_URL = IS_MOBILE_BUILD ? "https://explora4d.eu/viewer/examples/index.json" : "./examples/index.json";

const listUrl = () => configuredUrl("exampleModelsUrl", DEFAULT_URL);

const BUNDLED = new Set((DEFAULT_LIST.models || []).filter((entry) => entry.app !== false).map((entry) => entry.url));

function normalizeList(data) {
  if (!Array.isArray(data?.models)) return null;
  const site = IS_MOBILE_BUILD ? listSite(listUrl()) : null;
  return data.models
    .filter((entry) => entry && typeof entry.url === "string" && entry.url.trim())
    .filter((entry) => !(IS_MOBILE_BUILD && entry.app === false))
    .flatMap((entry) => {
      if (!isRelativeUrl(entry.url)) return [{ ...entry, online: true }];
      if (!IS_MOBILE_BUILD || BUNDLED.has(entry.url)) return [{ ...entry, online: false }];
      return site ? [{ ...entry, url: new URL(entry.url, site).href, online: true }] : [];
    });
}

const list = createRemoteList({
  name: "Example models",
  cacheKey: "dfg3dviewer-example-models",
  keep: IS_MOBILE_BUILD,
  defaultData: DEFAULT_LIST,
  url: listUrl,
  normalize: normalizeList,
});

export function getExampleModels() {
  return list.get();
}

export function refreshExampleModels() {
  return list.refresh();
}

// Not offered in the app (a device may still remember it as its last model).
export function isHiddenInApp(url) {
  return IS_MOBILE_BUILD && (DEFAULT_LIST.models || []).some((entry) => entry.url === url && entry.app === false);
}

// Fills the select with the list, keeping its <button> (customizable select,
// external-sources.css), the options marked data-keep (dev.html's own test
// files) and the chosen model. base: prefix for the "./" URLs of a page not
// served from the site root (dev.html: "./viewer/"). The same list in the
// same language leaves the options as they are (an open list stays open);
// only the online-only ones follow the network.
export function renderExampleModelOptions(select) {
  if (!select) return;
  const base = select.dataset.exampleBase || "";
  const online = isOnline();
  const options = getExampleModels().map((entry) => ({
    value: base && isRelativeUrl(entry.url) ? base + entry.url.replace(/^\.\//, "") : entry.url,
    text: localizedName(entry.name) || entry.url,
    online: entry.online,
  }));
  // Shown while the model on screen came from elsewhere (the repository, the
  // device, a manifest): clearExampleModelSelection().
  let placeholder = select.querySelector("option[data-placeholder]");
  if (!placeholder) {
    placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.dataset.placeholder = "true";
    placeholder.disabled = true;
    placeholder.hidden = true;
    const button = select.querySelector(":scope > button");
    select.insertBefore(placeholder, button ? button.nextSibling : select.firstChild);
  }
  placeholder.textContent = t("localPreview.noExampleModel", "Other model");
  const signature = JSON.stringify(options);
  if (select.dataset.exampleList !== signature) {
    select.dataset.exampleList = signature;
    const value = select.value;
    select.querySelectorAll("option:not([data-keep]):not([data-placeholder])").forEach((option) => option.remove());
    const kept = select.querySelector("option[data-keep]");
    options.forEach(({ value: url, text, online: needsNetwork }) => {
      const option = document.createElement("option");
      option.value = url;
      option.textContent = text;
      if (needsNetwork) option.dataset.online = "true";
      select.insertBefore(option, kept);
    });
    select.value = value;
    if (select.selectedIndex < 0) select.value = "";
  }
  const label = t("examplesPanel.online", "Needs an internet connection");
  select.querySelectorAll("option[data-online]").forEach((option) => {
    option.title = label;
    option.disabled = !online;
  });
}

// Shows `url` in the select: its example also when written another way
// ("/examples/x.glb" for "./examples/x.glb"), else the placeholder.
export function selectExampleModel(select, url) {
  if (!select) return;
  const key = (value) => String(value || "").replace(/^\.?\//, "");
  const option = [...select.options].find((entry) => !entry.dataset.placeholder && key(entry.value) === key(url));
  select.value = option ? option.value : "";
}

// A model opened from anywhere but the select: the select shows none of its
// examples (the placeholder of renderExampleModelOptions()).
export function clearExampleModelSelection() {
  const select = document.getElementById("example-model-select");
  if (!select) return;
  renderExampleModelOptions(select);
  select.value = "";
}
