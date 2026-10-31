import { core } from './core.js';
import { extraRequestHeaders, hasFeature } from './app-features.js';

// The repository the viewer talks to (worker API, converted models). A normal
// page is served by that repository, so everything stays same-origin. The app
// build is served from inside the app package
// instead, and reaches the repository at mobile.remoteUrl from
// viewer-settings.json - empty there means the app runs offline only.
export function isAppBuild() {
  return Boolean(core.CONFIG?.mobile);
}

const REMOTE_URL_KEY = 'dfg3dviewer-remote-url';
const REMOTE_URLS_KEY = 'dfg3dviewer-remote-urls';
// Storage blocked: the choice lasts for this session only.
let remoteUrlInMemory = null;
let remoteUrlsInMemory = [];

// ExHUB: the repository the app was built with (mobile.remoteUrl). Always
// one of the choices; other repositories are added by their address
// (models panel) and kept on the device.
export function defaultRemoteUrl() {
  return isAppBuild() ? normalizeRemoteUrl(core.CONFIG.mobile.remoteUrl) || '' : '';
}

// Set in the app (models panel); wins over mobile.remoteUrl from the build.
// Empty (an address cleared before ExHUB was always there) = ExHUB.
function storedRemoteUrl() {
  try {
    return localStorage.getItem(REMOTE_URL_KEY) || null;
  } catch {
    return remoteUrlInMemory;
  }
}

export function remoteBase() {
  if (!isAppBuild()) return '';
  // Another repository address may not be available (app-features.js); then
  // the one the app was built with.
  const stored = hasFeature('customRepository') ? storedRemoteUrl() : null;
  return stored ? String(stored).trim().replace(/\/+$/, '') : defaultRemoteUrl();
}

export function isDefaultRemote(url = remoteBase()) {
  return url === defaultRemoteUrl();
}

// "repo.example.org" -> "https://repo.example.org". Null when it is not a
// usable URL.
function normalizeRemoteUrl(input) {
  let value = String(input || '').trim();
  if (!value || /\s/.test(value)) return null;
  if (!/^[a-z][\w+.-]*:\/\//i.test(value)) value = `https://${value}`;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.origin + url.pathname.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

// The repositories added by address, besides ExHUB.
export function addedRemoteUrls() {
  let urls;
  try {
    urls = JSON.parse(localStorage.getItem(REMOTE_URLS_KEY) || '[]');
  } catch {
    urls = remoteUrlsInMemory;
  }
  // A device that set an address before the list existed: that one.
  const stored = storedRemoteUrl();
  if (Array.isArray(urls) && stored && !urls.includes(stored)) urls = [...urls, stored];
  return (Array.isArray(urls) ? urls : []).filter((url) => typeof url === 'string' && url && !isDefaultRemote(url));
}

function writeAddedRemoteUrls(urls) {
  try {
    localStorage.setItem(REMOTE_URLS_KEY, JSON.stringify(urls));
  } catch {
    remoteUrlsInMemory = urls;
  }
}

function writeStoredRemoteUrl(value) {
  try {
    if (value) localStorage.setItem(REMOTE_URL_KEY, value);
    else localStorage.removeItem(REMOTE_URL_KEY);
  } catch {
    remoteUrlInMemory = value || null;
  }
}

// Switches to a repository by its address, adding it to the list when it is
// not ExHUB; "" goes back to ExHUB. Returns the normalized address, or null
// when it is not a usable URL.
export function setRemoteUrl(input) {
  const value = String(input || '').trim() ? normalizeRemoteUrl(input) : defaultRemoteUrl();
  if (value === null) return null;
  if (isDefaultRemote(value)) {
    writeStoredRemoteUrl(null);
  } else {
    const urls = addedRemoteUrls();
    if (!urls.includes(value)) writeAddedRemoteUrls([...urls, value]);
    writeStoredRemoteUrl(value);
  }
  initRemote();
  return value;
}

// Removes an added repository; when it was the one in use, back to ExHUB.
export function removeRemoteUrl(url) {
  if (remoteBase() === url) writeStoredRemoteUrl(null);
  writeAddedRemoteUrls(addedRemoteUrls().filter((added) => added !== url));
  initRemote();
}

// The app's session on the repository (worker/auth.py): the app runs on
// another origin and never gets the session cookie, so it keeps the token
// from logging in and sends it as a Bearer header instead. Per repository
// address - a token is only valid on the worker that issued it.
const SESSION_KEY = 'dfg3dviewer-session';
let sessionsInMemory = {};

function readSessions() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || '{}') || {};
  } catch {
    return sessionsInMemory;
  }
}

export function sessionToken() {
  return isAppBuild() ? readSessions()[remoteBase()] || '' : '';
}

export function setSessionToken(token) {
  if (!isAppBuild()) return;
  const sessions = readSessions();
  if (token) sessions[remoteBase()] = token;
  else delete sessions[remoteBase()];
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessions));
  } catch {
    // Storage blocked: signed in until the app restarts.
    sessionsInMemory = sessions;
  }
}

// Headers for requests to the repository: the app's session (above) and
// whatever the app build adds (app-features.js).
export function appRequestHeaders() {
  const headers = isAppBuild() ? { ...extraRequestHeaders() } : {};
  const token = sessionToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
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

// The page to request deleting an account and its data (viewer/legal/),
// served by the repository the account lives on.
export function deleteAccountUrl() {
  return remoteAssetUrl('/delete-account.html');
}

// The terms of use (viewer/legal/terms.html in the app's builds), served
// next to delete-account.html. Elsewhere only when the settings name one
// (viewer.auth.termsUrl): a plain viewer has no terms of its own.
export function termsUrl() {
  const configured = core.CONFIG?.viewer?.auth?.termsUrl;
  if (configured) return configured;
  return isAppBuild() && remoteBase() ? remoteAssetUrl('/terms.html') : '';
}

export function privacyUrl() {
  const configured = core.CONFIG?.viewer?.auth?.privacyUrl;
  if (configured) return configured;
  return isAppBuild() && remoteBase() ? remoteAssetUrl('/privacy.html') : '';
}

// Where the store's subscriptions are managed (cancelled): deleting an
// account cancels nothing - a subscription belongs to the Apple ID or
// Google account that bought it. Empty outside the apps.
export function manageSubscriptionsUrl() {
  const platform = window.Capacitor?.getPlatform?.();
  if (platform === 'ios') return 'https://apps.apple.com/account/subscriptions';
  if (platform === 'android') return 'https://play.google.com/store/account/subscriptions';
  return '';
}

// body.viewer-app hides what the app does not use; body.viewer-no-remote
// hides everything that needs a repository when none is configured.
export function initRemote() {
  document.body?.classList.toggle('viewer-app', isAppBuild());
  document.body?.classList.toggle('viewer-no-remote', !hasRemote());
}
