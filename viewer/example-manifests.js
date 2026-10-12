import { t } from "./i18n-utils.js";
import { configuredUrl, createRemoteList, isRelativeUrl, listSite, localizedName } from "./remote-list.js";
import DEFAULT_LIST from "./manifesto/examples/index.json";

// The example AIM3D/IIIF manifests offered by the dev build's manifest form
// (metadata.js) and the app's examples panel (ui/examples-panel.js). The list
// is fetched at runtime (remote-list.js) - each time one of them opens and on
// "Refresh" - from viewer.exampleManifestsUrl (viewer-settings.json); the
// bundled copy is manifesto/examples/index.json - the same file is published
// with the manifests and is the default online source.
//
// Format: { "iiif": [entry], "aim3d": [entry] }, entry = { url, i18n?,
// fallback?, name?, excludeFromMobile?, inIIIFSelect? }. "name" may be a
// string or { en, de, pl }; "./manifests/..." URLs are served with the viewer.
// excludeFromMobile: its model is not in the app (left out of the app
// bundle by its build extension), so the app loads it from the site the list comes from
// (online only) - entry.baseUrl, passed on to Viewer.setupManifesto.
const DEFAULT_URL = "https://viewer.thedworak.com/manifests/index.json";

const IS_MOBILE_BUILD = typeof __BUILD__ !== "undefined" && __BUILD__ === "mobile";

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
  return iiif && aim3d ? { iiif, aim3d } : null;
}

const list = createRemoteList({
  name: "Example manifests",
  cacheKey: "dfg3dviewer-example-manifests",
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

// { url, i18n, name, baseUrl } with the name in the current language.
export function exampleManifestOption({ url, i18n, fallback, name, baseUrl }) {
  const fallbackName = localizedName(name) || fallback || url;
  return { url, i18n, name: i18n ? t(i18n, fallbackName) : fallbackName, baseUrl };
}
