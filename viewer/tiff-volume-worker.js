import { readTiffVolume } from "./tiff-reader.js";

// Web Worker for TIFF stacks opened without the worker server (started by
// tiff-reader.js): decodes the pages of one stack, averages them down and
// maps them to 8 bits, and sends the voxels back (transferred).

self.onmessage = async (event) => {
  const { source, layout } = event.data || {};
  try {
    const result = await readTiffVolume(source, layout, {
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
