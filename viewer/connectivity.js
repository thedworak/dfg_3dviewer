import { core, setCore } from './core.js';

// Online/offline state for the app build (and any page that loses its
// connection). core.isOnline mirrors navigator.onLine, and body.viewer-offline
// lets CSS hide controls that need a server (upload, sign-in, model browser).
// navigator.onLine only says a network is attached, not that the repository
// answers - callers that talk to a server must still handle fetch failures.
const listeners = new Set();

function applyState(online) {
  setCore('isOnline', online);
  document.body?.classList.toggle('viewer-offline', !online);
  listeners.forEach((listener) => listener(online));
}

export function initConnectivity() {
  applyState(navigator.onLine !== false);
  window.addEventListener('online', () => applyState(true));
  window.addEventListener('offline', () => applyState(false));
}

// Calls listener(online) on every change; returns a function that unsubscribes.
export function onConnectivityChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isOnline() {
  return core.isOnline !== false;
}
