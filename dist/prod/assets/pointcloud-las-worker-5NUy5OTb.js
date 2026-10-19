import { decodeLasUrl } from './pointcloud-las-decode-Ie91ZEyo.js';
import './_commonjsHelpers-B1ynBD_6.js';

// Web Worker for LAS / LAZ point clouds (started by pointcloud-las.js): the
// download, decompression and re-centring happen here, and the points go
// back to the page in batches (transferred, not copied) while the viewer
// stays responsive. Messages: see pointcloud-las-decode.js.

self.onmessage = async (event) => {
  const { url, maxPoints, compressed } = event.data || {};
  const emit = (message, transfer = []) => self.postMessage(message, transfer);
  try {
    await decodeLasUrl(url, { maxPoints, compressed, emit });
  } catch (error) {
    emit({ type: "error", message: error?.message || String(error) });
  }
};

// Tells the page the module (and laz-perf) loaded: a worker that fails to
// start falls back to the main thread.
self.postMessage({ type: "ready" });
//# sourceMappingURL=pointcloud-las-worker-ujcmB-5A.js.map
