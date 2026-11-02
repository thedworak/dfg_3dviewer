// What the in-browser volume readers share (lif-reader.js, tiff-reader.js),
// as worker/volumes.py does for the worker's converters: a channel's block
// means, kept as integer levels (0..255 or 0..65535) with their histogram,
// mapped to 8 bits between the 0.1 and 99.95 percentiles, and the Otsu
// threshold of the result; and running a reader in a Web Worker.

const LOW_PERCENTILE = 0.1;
const HIGH_PERCENTILE = 99.95;

function percentileOf(histogram, total, percent) {
  const target = (percent / 100) * (total - 1);
  let seen = 0;
  for (let value = 0; value < histogram.length; value += 1) {
    seen += histogram[value];
    if (seen > target) return value;
  }
  return histogram.length - 1;
}

function otsu(histogram) {
  let total = 0;
  let sum = 0;
  for (let i = 0; i < 256; i += 1) {
    total += histogram[i];
    sum += i * histogram[i];
  }
  if (!total) return 0.5;
  let weight = 0;
  let mean = 0;
  let best = 0;
  let threshold = 0;
  for (let i = 0; i < 256; i += 1) {
    weight += histogram[i];
    mean += i * histogram[i];
    const background = weight;
    const foreground = total - weight;
    if (!background || !foreground) continue;
    const between = (sum * background - mean * total) ** 2 / (background * foreground);
    if (between > best) {
      best = between;
      threshold = i;
    }
  }
  return Math.round((threshold / 255) * 10000) / 10000;
}

// Writes the 8-bit voxels of a channel into target, from its means (levels)
// and their histogram. Returns { low, high } (levels) and its threshold.
export function finishChannel(means, histogram, target) {
  const voxels = means.length;
  const low = percentileOf(histogram, voxels, LOW_PERCENTILE);
  let high = percentileOf(histogram, voxels, HIGH_PERCENTILE);
  if (high <= low) high = low + 1;
  const scale = 255 / (high - low);
  const bytes = new Float64Array(256);
  for (let i = 0; i < voxels; i += 1) {
    const value = Math.min(255, Math.max(0, Math.round((means[i] - low) * scale)));
    target[i] = value;
    bytes[value] += 1;
  }
  return { low, high, threshold: otsu(bytes) };
}

// Voxels of the source per output voxel in x and y (fewer at the edges).
export function cellCounts(ny, nx, fy, fx) {
  const ox = Math.ceil(nx / fx);
  const counts = new Float32Array(Math.ceil(ny / fy) * ox);
  for (let y = 0; y < ny; y += 1) {
    for (let x = 0; x < nx; x += 1) counts[Math.floor(y / fy) * ox + Math.floor(x / fx)] += 1;
  }
  return counts;
}

// Runs a reader in a Web Worker - createWorker() returns it, or throws when
// module workers do not start - or, then, on the main thread (onMainThread).
// The worker answers "ready", then "progress" and "done" or "error".
export function runVolumeWorker(createWorker, message, onMainThread, onProgress) {
  return new Promise((resolve, reject) => {
    let worker;
    try {
      worker = createWorker();
    } catch {
      onMainThread().then(resolve, reject);
      return;
    }
    let started = false;
    worker.onmessage = ({ data }) => {
      if (data?.type === "ready") {
        started = true;
        worker.postMessage(message);
      } else if (data?.type === "progress") {
        onProgress?.(data.progress);
      } else if (data?.type === "done") {
        worker.terminate();
        resolve(data.result);
      } else if (data?.type === "error") {
        worker.terminate();
        reject(new Error(data.message));
      }
    };
    worker.onerror = (event) => {
      event.preventDefault?.();
      worker.terminate();
      if (!started) onMainThread().then(resolve, reject);
      else reject(new Error(event.message || "Volume reader failed"));
    };
  });
}
