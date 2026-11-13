import { a as analyzeAudio, b as analysisTransferables } from './audio-analysis-BRwyCUP5.js';

// Web Worker for an audio file's waveform, spectrogram and levels (started
// by audio.js): the decoded channels come in (transferred), the analysis
// goes back (transferred).

self.onmessage = (event) => {
  const { channels, sampleRate } = event.data || {};
  try {
    const result = analyzeAudio({ channels, sampleRate }, {
      onProgress: (progress) => self.postMessage({ type: "progress", progress }),
    });
    self.postMessage({ type: "done", result }, analysisTransferables(result));
  } catch (error) {
    self.postMessage({ type: "error", message: error?.message || String(error) });
  }
};

// Tells the page the module loaded: a worker that fails to start falls back
// to the main thread.
self.postMessage({ type: "ready" });
//# sourceMappingURL=audio-analysis-worker-DOUTxI1l.js.map
