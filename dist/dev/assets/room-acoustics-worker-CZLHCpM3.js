import { c as computeRoomAcoustics, a as acousticsTransferables } from './room-acoustics-Bwk-VQOn.js';

// Web Worker for a room's acoustics (started by editor/scene-acoustics.js):
// the model's triangles come in (transferred), the reverberation times and
// the impulse response go back (transferred).

self.onmessage = (event) => {
  const { geometry, options } = event.data || {};
  try {
    const { result, response } = computeRoomAcoustics(geometry, {
      ...options,
      onProgress: (progress) => self.postMessage({ type: "progress", progress }),
    });
    self.postMessage({ type: "done", result, response }, [
      ...acousticsTransferables(response),
      ...result.histogram.map((band) => band.buffer),
    ]);
  } catch (error) {
    self.postMessage({ type: "error", message: error?.message || String(error) });
  }
};

// Tells the page the module loaded: a worker that fails to start falls back
// to the main thread.
self.postMessage({ type: "ready" });
//# sourceMappingURL=room-acoustics-worker-VjnrRnCi.js.map
