// What an audio file looks like (audio.js): its waveform, its spectrogram
// and its levels, worked out once from the decoded samples - in a Web Worker
// (audio-analysis-worker.js), else here on the main thread.
//
//   peaks        per channel, the lowest and highest sample of each of
//                `buckets` stretches of the file: the waveform at any width
//                up to that many pixels.
//   spectrogram  short-time Fourier transform of the channels mixed down:
//                `columns` moments × fftSize / 2 frequencies, each the mean
//                power of up to FRAMES_PER_COLUMN Hann-windowed frames
//                around that moment, in dB below full scale (a full-scale
//                sine is 0 dB) in half-dB steps: byte = (dB + 127.5) × 2.
//                A long file is sampled, not read whole: enough frames for
//                the columns, so an hour costs what a few minutes do.
//   stats        the peak and RMS level (dBFS) and the samples at full
//                scale (clipped).

const DB_FLOOR = -127.5;
const FRAMES_PER_COLUMN = 4;

const toDb = (byte) => byte / 2 + DB_FLOOR;

function fftSizeFor(sampleRate) {
  // About 43 ms: 2048 samples at 48 kHz, 1024 at 22.05 kHz.
  const target = sampleRate * 0.043;
  let size = 256;
  while (size < target && size < 8192) size *= 2;
  return size;
}

// In-place radix-2 FFT of re/im (length a power of two).
function makeFft(size) {
  const levels = Math.log2(size);
  const reverse = new Uint32Array(size);
  for (let i = 0; i < size; i++) {
    let r = 0;
    for (let bit = 0; bit < levels; bit++) r |= ((i >> bit) & 1) << (levels - 1 - bit);
    reverse[i] = r;
  }
  const cos = new Float64Array(size / 2);
  const sin = new Float64Array(size / 2);
  for (let i = 0; i < size / 2; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / size);
    sin[i] = -Math.sin((2 * Math.PI * i) / size);
  }
  return (re, im) => {
    for (let i = 0; i < size; i++) {
      const j = reverse[i];
      if (j > i) {
        const tr = re[i]; re[i] = re[j]; re[j] = tr;
        const ti = im[i]; im[i] = im[j]; im[j] = ti;
      }
    }
    for (let half = 1; half < size; half *= 2) {
      const step = size / (half * 2);
      for (let start = 0; start < size; start += half * 2) {
        for (let k = 0; k < half; k++) {
          const a = start + k;
          const b = a + half;
          const wr = cos[k * step];
          const wi = sin[k * step];
          const xr = re[b] * wr - im[b] * wi;
          const xi = re[b] * wi + im[b] * wr;
          re[b] = re[a] - xr;
          im[b] = im[a] - xi;
          re[a] += xr;
          im[a] += xi;
        }
      }
    }
  };
}

function computePeaks(channels, buckets) {
  const length = channels[0]?.length || 0;
  const count = Math.max(1, Math.min(buckets, length));
  const min = channels.map(() => new Float32Array(count));
  const max = channels.map(() => new Float32Array(count));
  channels.forEach((samples, c) => {
    for (let b = 0; b < count; b++) {
      const start = Math.floor((b * length) / count);
      const end = Math.max(start + 1, Math.floor(((b + 1) * length) / count));
      let low = Infinity;
      let high = -Infinity;
      for (let i = start; i < end && i < length; i++) {
        const value = samples[i];
        if (value < low) low = value;
        if (value > high) high = value;
      }
      min[c][b] = Number.isFinite(low) ? low : 0;
      max[c][b] = Number.isFinite(high) ? high : 0;
    }
  });
  return { buckets: count, min, max };
}

function computeStats(channels) {
  let peak = 0;
  let sum = 0;
  let clipped = 0;
  let count = 0;
  channels.forEach((samples) => {
    for (let i = 0; i < samples.length; i++) {
      const value = Math.abs(samples[i]);
      if (value > peak) peak = value;
      if (value >= 0.999) clipped += 1;
      sum += value * value;
    }
    count += samples.length;
  });
  const db = (value) => (value > 0 ? 20 * Math.log10(value) : -Infinity);
  return { peakDb: db(peak), rmsDb: db(Math.sqrt(sum / Math.max(1, count))), clipped };
}

function computeSpectrogram(channels, sampleRate, maxColumns, onProgress) {
  const length = channels[0]?.length || 0;
  const fftSize = fftSizeFor(sampleRate);
  const bins = fftSize / 2;
  const columns = Math.max(1, Math.min(maxColumns, Math.floor(length / (fftSize / 4)) || 1));
  const data = new Uint8Array(columns * bins);
  const fft = makeFft(fftSize);
  const window = new Float64Array(fftSize);
  for (let i = 0; i < fftSize; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (fftSize - 1));
  const re = new Float64Array(fftSize);
  const im = new Float64Array(fftSize);
  const power = new Float64Array(bins);
  // A full-scale sine through the Hann window: |X| = N / 4.
  const reference = (fftSize / 4) ** 2;
  const gain = 1 / channels.length;
  let maxDb = -Infinity;
  for (let c = 0; c < columns; c++) {
    const start = (c * length) / columns;
    const span = length / columns;
    const frames = Math.max(1, Math.min(FRAMES_PER_COLUMN, Math.ceil(span / (fftSize / 2))));
    power.fill(0);
    for (let f = 0; f < frames; f++) {
      const centre = Math.floor(start + ((f + 0.5) * span) / frames);
      const first = centre - fftSize / 2;
      for (let i = 0; i < fftSize; i++) {
        const at = first + i;
        let value = 0;
        if (at >= 0 && at < length) {
          for (let ch = 0; ch < channels.length; ch++) value += channels[ch][at];
          value *= gain;
        }
        re[i] = value * window[i];
        im[i] = 0;
      }
      fft(re, im);
      for (let b = 0; b < bins; b++) power[b] += re[b] * re[b] + im[b] * im[b];
    }
    for (let b = 0; b < bins; b++) {
      const db = 10 * Math.log10(power[b] / frames / reference + 1e-14);
      if (db > maxDb) maxDb = db;
      data[c * bins + b] = Math.max(0, Math.min(255, Math.round((db - DB_FLOOR) * 2)));
    }
    if (onProgress && c % 64 === 0) onProgress(c / columns);
  }
  return { columns, bins, fftSize, sampleRate, data, maxDb: Number.isFinite(maxDb) ? Math.min(0, maxDb) : DB_FLOOR };
}

// channels: Float32Array per channel; sampleRate: of these samples.
function analyzeAudio({ channels, sampleRate }, { columns = 2048, buckets = 4096, onProgress } = {}) {
  if (!channels?.length || !channels[0]?.length) throw new Error("The audio file has no samples.");
  const peaks = computePeaks(channels, buckets);
  onProgress?.(0.05);
  const stats = computeStats(channels);
  const spectrogram = computeSpectrogram(channels, sampleRate, columns, (progress) => onProgress?.(0.1 + progress * 0.9));
  onProgress?.(1);
  return { sampleRate, length: channels[0].length, peaks, spectrogram, stats };
}

// The buffers to transfer from the worker.
function analysisTransferables(result) {
  return [
    ...result.peaks.min.map((array) => array.buffer),
    ...result.peaks.max.map((array) => array.buffer),
    result.spectrogram.data.buffer,
  ];
}

export { analyzeAudio as a, analysisTransferables as b, toDb as t };
//# sourceMappingURL=audio-analysis-Bf2Q8x44.js.map
