import { readImageSlices } from "./image-slices-reader.js";

// Web Worker for stacks of PNG / JPEG / BMP slices opened without the worker
// server (started by image-slices-reader.js): decodes the slices, averages
// them down and maps them to 8 bits, and sends them back (transferred).

self.onmessage = async (event) => {
  const { slices, layout } = event.data || {};
  try {
    const result = await readImageSlices(slices, layout, {
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
