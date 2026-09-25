import { core } from './core.js';

// The repository the viewer talks to (worker API, converted models). A normal
// page is served by that repository, so everything stays same-origin. The app
// build (see capacitor.config.json) is served from inside the app package
// instead, and reaches the repository at mobile.remoteUrl from
// viewer-settings.json - empty there means the app runs offline only.
export function isAppBuild() {
  return Boolean(core.CONFIG?.mobile);
}

export function remoteBase() {
  return String(core.CONFIG?.mobile?.remoteUrl || '').trim().replace(/\/+$/, '');
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
