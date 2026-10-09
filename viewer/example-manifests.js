import { core } from "./core.js";
import { t } from "./i18n-utils.js";
import { isOnline } from "./connectivity.js";
import DEFAULT_LIST from "./manifesto/examples/index.json";

// The example AIM3D/IIIF manifests offered by the dev build's manifest form
// (metadata.js) and the app's examples panel (ui/examples-panel.js). The list
// is fetched at runtime - each time one of them opens and on "Refresh" - from
// viewer.exampleManifestsUrl (viewer-settings.json), so it can change without
// a new build. The last list fetched is kept on the device; without a
// connection (or when the fetch fails) that one is used, else the copy of
// manifesto/examples/index.json taken at build time - the same file is
// published with the manifests and is the default online source.
//
// Format: { "iiif": [entry], "aim3d": [entry] }, entry = { url, i18n?,
// fallback?, name?, excludeFromMobile?, inIIIFSelect? }. "name" may be a
// string or { en, de, pl }; "./manifests/..." URLs are served with the viewer.
// excludeFromMobile: its model is not in the app (MOBILE_EXCLUDED_MODELS in
// rollup.config.js), so the app loads it from the site the list comes from
// (online only) - entry.baseUrl, passed on to Viewer.setupManifesto.
const DEFAULT_URL = "https://viewer.thedworak.com/manifests/index.json";
const CACHE_KEY = "dfg3dviewer-example-manifests";
const FETCH_TIMEOUT_MS = 8000;

const IS_MOBILE_BUILD = typeof __BUILD__ !== "undefined" && __BUILD__ === "mobile";

// The site the list is published on: <site>/manifests/index.json.
function siteBase() {
  try {
    return new URL("../", new URL(listUrl(), document.baseURI)).href;
  } catch {
    return null;
  }
}

function normalizeEntries(entries) {
  if (!Array.isArray(entries)) return null;
  const site = IS_MOBILE_BUILD ? siteBase() : null;
  return entries
    .filter((entry) => entry && typeof entry.url === "string" && entry.url.trim())
    .flatMap((entry) => {
      if (!IS_MOBILE_BUILD || !entry.excludeFromMobile) return [entry];
      // Not in the app: loaded from the list's site, its "./" URLs too.
      if (!/^\.\.?\//.test(entry.url)) return [entry];
      return site ? [{ ...entry, url: new URL(entry.url, site).href, baseUrl: site }] : [];
    });
}

function normalizeList(data) {
  const iiif = normalizeEntries(data?.iiif);
  const aim3d = normalizeEntries(data?.aim3d);
  return iiif && aim3d ? { iiif, aim3d } : null;
}

function readCache() {
  try {
    return normalizeList(JSON.parse(window.localStorage.getItem(CACHE_KEY) || "null"));
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // Not kept - the next start without a connection uses the default list.
  }
}

let current = readCache() || normalizeList(DEFAULT_LIST);
let pending = null;

export function getExampleManifests() {
  return current;
}

function listUrl() {
  const configured = core.CONFIG?.viewer?.exampleManifestsUrl;
  return typeof configured === "string" && configured.trim() ? configured.trim() : DEFAULT_URL;
}

// Fetches the list; resolves to { list, updated }. Never rejects: on any
// failure the list in use stays as it is. Concurrent calls share one fetch.
export function refreshExampleManifests() {
  if (pending) return pending;
  if (!isOnline()) return Promise.resolve({ list: current, updated: false });

  pending = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(listUrl(), { cache: "no-cache", signal: controller.signal });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const data = await response.json();
      const list = normalizeList(data);
      if (!list) throw new Error("Unexpected format");
      writeCache(data);
      current = list;
      return { list, updated: true };
    } catch (error) {
      console.warn("Example manifests: keeping the current list -", error?.message || error);
      return { list: current, updated: false };
    } finally {
      clearTimeout(timer);
      pending = null;
    }
  })();
  return pending;
}

function localizedName(name) {
  if (typeof name === "string") return name;
  if (!name || typeof name !== "object") return "";
  return name[core.currentLanguage] || name.en || Object.values(name).find((value) => typeof value === "string") || "";
}

// { url, i18n, name, baseUrl } with the name in the current language.
export function exampleManifestOption({ url, i18n, fallback, name, baseUrl }) {
  const fallbackName = localizedName(name) || fallback || url;
  return { url, i18n, name: i18n ? t(i18n, fallbackName) : fallbackName, baseUrl };
}
