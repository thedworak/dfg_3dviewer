import { createByteSource, readSeriesVolume } from "./lif-reader.js";

// Web Worker for the stacks of a .lif opened without the worker server
// (started by lif-reader.js): reads one stack from a File or URL, averages it
// down and maps it to 8 bits, and sends the voxels back (transferred).

self.onmessage = async (event) => {
  const { source, layout } = event.data || {};
  try {
    const result = await readSeriesVolume(createByteSource(source), layout, {
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
