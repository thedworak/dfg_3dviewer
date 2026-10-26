import { t } from "./i18n-utils.js";
import { configuredUrl, createRemoteList, isRelativeUrl, listSite, localizedName } from "./remote-list.js";
import DEFAULT_LIST from "./manifesto/examples/index.json";

// The example AIM3D/IIIF manifests offered by the dev build's manifest form
// (metadata.js) and the app's examples panel (ui/examples-panel.js). The list
// is fetched at runtime (remote-list.js) - each time one of them opens and on
// "Refresh" - from viewer.exampleManifestsUrl (viewer-settings.json); the
// bundled copy is manifesto/examples/index.json - the same file is published
// with the manifests (<site>/manifests/index.json).
//
// Format: { "groups"?: { id: { name } }, "iiif": [entry], "aim3d": [entry] },
// entry = { url, i18n?, fallback?, name?, group?, variant?,
// excludeFromMobile?, inIIIFSelect? }. "name" may be a string or
// { en, de, pl }; "./manifests/..." URLs are served with the viewer.
// group + variant: the lists show the entry under its group's name (the
// model), by the variant alone ("Golden hour, ACES"). The full name stays
// for viewers released before groups existed.
// excludeFromMobile: its model is not in the app (left out of the app
// bundle by its build extension), so the app loads it from the site the list comes from
// (online only) - entry.baseUrl, passed on to Viewer.setupManifesto.
const IS_MOBILE_BUILD = typeof __BUILD__ !== "undefined" && __BUILD__ === "mobile";
// The web viewer serves the list itself (a build shows its own examples,
// not those of the last deployment); the app fetches it from the site.
const DEFAULT_URL = IS_MOBILE_BUILD ? "https://explora4d.eu/viewer/manifests/index.json" : "./manifests/index.json";

const listUrl = () => configuredUrl("exampleManifestsUrl", DEFAULT_URL);

function normalizeEntries(entries) {
  if (!Array.isArray(entries)) return null;
  const site = IS_MOBILE_BUILD ? listSite(listUrl()) : null;
  return entries
    .filter((entry) => entry && typeof entry.url === "string" && entry.url.trim())
    .flatMap((entry) => {
      if (!IS_MOBILE_BUILD || !entry.excludeFromMobile) return [entry];
      // Not in the app: loaded from the list's site, its "./" URLs too.
      if (!isRelativeUrl(entry.url)) return [entry];
      return site ? [{ ...entry, url: new URL(entry.url, site).href, baseUrl: site }] : [];
    });
}

function normalizeList(data) {
  const iiif = normalizeEntries(data?.iiif);
  const aim3d = normalizeEntries(data?.aim3d);
  const groups = data?.groups && typeof data.groups === "object" ? data.groups : {};
  return iiif && aim3d ? { iiif, aim3d, groups } : null;
}

const list = createRemoteList({
  name: "Example manifests",
  cacheKey: "dfg3dviewer-example-manifests",
  keep: IS_MOBILE_BUILD,
  defaultData: DEFAULT_LIST,
  url: listUrl,
  normalize: normalizeList,
});

export function getExampleManifests() {
  return list.get();
}

export function refreshExampleManifests() {
  return list.refresh();
}

// { url, i18n, name, baseUrl, group } with the names in the current
// language. In a group: name is the variant, group { id, name } the model.
export function exampleManifestOption({ url, i18n, fallback, name, baseUrl, group, variant }) {
  const fallbackName = localizedName(name) || fallback || url;
  const groupName = group ? localizedName(list.get()?.groups?.[group]?.name) : "";
  const variantName = localizedName(variant);
  if (groupName && variantName) return { url, name: variantName, baseUrl, group: { id: group, name: groupName } };
  return { url, i18n, name: i18n ? t(i18n, fallbackName) : fallbackName, baseUrl, group: null };
}

// Splits options into runs: [{ group, items }], group null for the
// ungrouped ones. Entries of a group stay together where the first one is.
export function groupExampleOptions(options) {
  const runs = [];
  const byGroup = new Map();
  options.forEach((option) => {
    const id = option.group?.id;
    if (id && byGroup.has(id)) {
      byGroup.get(id).items.push(option);
      return;
    }
    const run = { group: option.group || null, items: [option] };
    if (id) byGroup.set(id, run);
    else if (runs.at(-1)?.group === null) {
      runs.at(-1).items.push(option);
      return;
    }
    runs.push(run);
  });
  return runs;
}
