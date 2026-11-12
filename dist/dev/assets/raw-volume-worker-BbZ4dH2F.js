import { readRawVolume } from './raw-volume-reader-Ccq5OUrN.js';
import './volume-voxels-CI6ldnye.js';

// Web Worker for NRRD / NIfTI / MetaImage volumes opened without the worker
// server (started by raw-volume-reader.js): streams the voxels, averages
// them down and maps them to 8 bits, and sends them back (transferred).

self.onmessage = async (event) => {
  const { source, layout } = event.data || {};
  try {
    const result = await readRawVolume(source, layout, {
      onProgress: (progress) => self.postMessage({ type: "progress", progress }),
    });
    self.postMessage({ type: "done", result }, [result.bytes.buffer]);
  } catch (error) {
    self.postMessage({ type: "error", message: error?.message || String(error) });
  }
};

// Tells the page the module loaded: a worker that fails to start falls back
// to the main thread.
self.postMessage({ type: "ready" });
//# sourceMappingURL=raw-volume-worker-_LgbeXC1.js.map
