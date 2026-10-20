import { core } from "./core.js";

// A model uploaded to the worker (worker/server.py) is served from
// /files/<job>/...: its job id, and where its saved viewer settings live.

// The worker's job id from a model folder URL (/files/<job>/...), or null.
export function workerJobId(path) {
  try {
    const match = new URL(path, window.location.origin).pathname.match(/^\/files\/([A-Za-z0-9_-]+)\//);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// The saved settings of the model on screen, when it is an upload:
// metadata/<file>_viewer.json in its folder (POST /api/model/settings
// writes it, like Drupal's SaveMetadataController), else null.
export function workerSettingsUrl() {
  const { path, filename } = core.fileObject || {};
  if (!path || !filename || filename.startsWith("blob:") || !workerJobId(path)) return null;
  try {
    return new URL(`metadata/${encodeURIComponent(filename)}_viewer.json`, new URL(path, window.location.href)).href;
  } catch {
    return null;
  }
}
