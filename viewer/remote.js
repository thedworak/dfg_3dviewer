import { core } from './core.js';
import { getAppUserId, hasFeature } from './monetization/plan.js';

// The repository the viewer talks to (worker API, converted models). A normal
// page is served by that repository, so everything stays same-origin. The app
// build (see capacitor.config.json) is served from inside the app package
// instead, and reaches the repository at mobile.remoteUrl from
// viewer-settings.json - empty there means the app runs offline only.
export function isAppBuild() {
  return Boolean(core.CONFIG?.mobile);
}

const REMOTE_URL_KEY = 'dfg3dviewer-remote-url';

// Set in the app (models panel); wins over mobile.remoteUrl from the build.
function storedRemoteUrl() {
  try {
    return localStorage.getItem(REMOTE_URL_KEY);
  } catch {
    return null;
  }
}

export function remoteBase() {
  if (!isAppBuild()) return '';
  // Another repository address is a Business feature; the other plans use
  // the one the app was built with.
  const stored = hasFeature('customRepository') ? storedRemoteUrl() : null;
  const url = stored !== null ? stored : core.CONFIG.mobile.remoteUrl;
  return String(url || '').trim().replace(/\/+$/, '');
}

// "repo.example.org" -> "https://repo.example.org"; "" clears it (offline
// only). Returns the normalized value, or null when it is not a usable URL.
export function setRemoteUrl(input) {
  let value = String(input || '').trim();
  if (/\s/.test(value)) return null;
  if (value && !/^[a-z][\w+.-]*:\/\//i.test(value)) value = `https://${value}`;
  if (value) {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
      value = url.origin + url.pathname.replace(/\/+$/, '');
    } catch {
      return null;
    }
  }
  try {
    localStorage.setItem(REMOTE_URL_KEY, value);
  } catch {
    // Storage blocked: the setting lasts for this session only.
    core.CONFIG.mobile.remoteUrl = value;
  }
  initRemote();
  return value;
}

// Headers for requests to the repository. Business: the RevenueCat app user
// id, from which the worker grants its business limits (worker/entitlements.py).
export function appRequestHeaders() {
  const id = isAppBuild() && hasFeature('serverBusinessLimits') ? getAppUserId() : '';
  return id ? { 'X-App-User-Id': id } : {};
}

export function hasRemote() {
  return !isAppBuild() || remoteBase() !== '';
}

// "/api/jobs" -> "https://repo.example.org/api/jobs" in the app build,
// unchanged elsewhere.
export function apiUrl(path) {
  return remoteBase() + path;
}

// Model and image URLs the worker returns are site-relative ("/files/...");
// in the app they must point back at the repository, not at the app bundle.
export function remoteAssetUrl(url) {
  const base = remoteBase();
  if (!base || typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//')) {
    return url;
  }
  return base + url;
}

// body.viewer-app hides what cannot work from inside the app (sign-in and user
// management rely on a same-site session cookie); body.viewer-no-remote hides
// everything that needs a repository when none is configured.
export function initRemote() {
  document.body?.classList.toggle('viewer-app', isAppBuild());
  document.body?.classList.toggle('viewer-no-remote', !hasRemote());
}
