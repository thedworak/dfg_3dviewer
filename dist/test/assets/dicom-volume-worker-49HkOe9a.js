import { readDicomVolume } from './dicom-reader-P-M05U2L.js';
import './model-extension-V-bD6FLD.js';
import './volume-voxels-CI6ldnye.js';

// Web Worker for DICOM series opened without the worker server (started by
// dicom-reader.js): reads the slices, rescales them, averages them down and
// maps them to 8 bits, and sends the voxels back (transferred).

self.onmessage = async (event) => {
  const { source, layout } = event.data || {};
  try {
    const result = await readDicomVolume(source, layout, {
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
//# sourceMappingURL=dicom-volume-worker-CLaDeIKV.js.map
