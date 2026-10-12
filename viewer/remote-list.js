import { core } from "./core.js";
import { isOnline } from "./connectivity.js";

// A list the viewer fetches at runtime so it can change without a new build
// (or app release): the example manifests (example-manifests.js) and the
// example models (example-models.js). Without a connection (or when the
// fetch fails) the copy bundled at build time is used - in the app, the last
// list fetched, kept on the device (keep). A web viewer keeps none: its
// bundled copy is as new as the site, and a kept list could be another
// deployment's.
//
// normalize(data) turns the fetched JSON into the list in use, or null when
// it is not one (the list in use then stays).
const FETCH_TIMEOUT_MS = 8000;

export function createRemoteList({ name, cacheKey, keep = true, defaultData, url, normalize }) {
  function readCache() {
    if (!keep) return null;
    try {
      return normalize(JSON.parse(window.localStorage.getItem(cacheKey) || "null"));
    } catch {
      return null;
    }
  }

  function writeCache(data) {
    if (!keep) return;
    try {
      window.localStorage.setItem(cacheKey, JSON.stringify(data));
    } catch {
      // Not kept - the next start without a connection uses the default list.
    }
  }

  let current = readCache() || normalize(defaultData);
  let pending = null;

  return {
    get: () => current,

    // Resolves to { list, updated }. Never rejects: on any failure the list
    // in use stays as it is. Concurrent calls share one fetch.
    refresh() {
      if (pending) return pending;
      if (!isOnline()) return Promise.resolve({ list: current, updated: false });

      pending = (async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        try {
          const response = await fetch(url(), { cache: "no-cache", signal: controller.signal });
          if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
          const data = await response.json();
          const list = normalize(data);
          if (!list) throw new Error("Unexpected format");
          writeCache(data);
          current = list;
          return { list, updated: true };
        } catch (error) {
          console.warn(`${name}: keeping the current list -`, error?.message || error);
          return { list: current, updated: false };
        } finally {
          clearTimeout(timer);
          pending = null;
        }
      })();
      return pending;
    },
  };
}

// The URL in viewer-settings.json (viewer.<key>), else the fallback.
export function configuredUrl(key, fallback) {
  const configured = core.CONFIG?.viewer?.[key];
  return typeof configured === "string" && configured.trim() ? configured.trim() : fallback;
}

// The site a list is published on: <site>/<dir>/index.json -> <site>/.
export function listSite(listUrl) {
  try {
    return new URL("../", new URL(listUrl, document.baseURI)).href;
  } catch {
    return null;
  }
}

export const isRelativeUrl = (url) => /^\.\.?\//.test(url);

// A name given as a string or as { en, de, pl }.
export function localizedName(name) {
  if (typeof name === "string") return name;
  if (!name || typeof name !== "object") return "";
  return name[core.currentLanguage] || name.en || Object.values(name).find((value) => typeof value === "string") || "";
}
