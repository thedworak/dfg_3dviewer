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
// highPercentile 100 keeps the maximum (CT in Hounsfield units: metal).
function finishChannel(means, histogram, target, highPercentile = HIGH_PERCENTILE) {
  const voxels = means.length;
  const low = percentileOf(histogram, voxels, LOW_PERCENTILE);
  let high = percentileOf(histogram, voxels, highPercentile);
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
function cellCounts(ny, nx, fy, fx) {
  const ox = Math.ceil(nx / fx);
  const counts = new Float32Array(Math.ceil(ny / fy) * ox);
  for (let y = 0; y < ny; y += 1) {
    for (let x = 0; x < nx; x += 1) counts[Math.floor(y / fy) * ox + Math.floor(x / fx)] += 1;
  }
  return counts;
}

// One channel's block means, fed a source plane at a time in increasing z:
// levels - 256 or 65536 - and toLevel(value) map the values to integer
// levels; finish() writes the 8-bit voxels.
class ChannelAccumulator {
  constructor([nz, ny, nx], [fz, fy, fx], { levels, toLevel }) {
    Object.assign(this, { nz, ny, nx, fz, fy, fx, toLevel });
    this.ox = Math.ceil(nx / fx);
    this.oy = Math.ceil(ny / fy);
    this.cells = cellCounts(ny, nx, fy, fx);
    this.sums = new Float32Array(this.oy * this.ox);
    this.means = levels === 256 ? new Uint8Array(this.ox * this.oy * Math.ceil(nz / fz)) : new Uint16Array(this.ox * this.oy * Math.ceil(nz / fz));
    this.histogram = new Float64Array(levels);
    this.slab = 0;
    this.depth = 0;
  }

  // Plane z: values[start + i * step] for the i-th pixel, x fastest.
  add(z, values, start = 0, step = 1) {
    const slab = Math.floor(z / this.fz);
    if (slab !== this.slab) this.flush();
    this.slab = slab;
    const { ny, nx, fy, fx, ox, sums, toLevel } = this;
    for (let y = 0; y < ny; y += 1) {
      const cellRow = Math.floor(y / fy) * ox;
      let at = start + y * nx * step;
      for (let x = 0; x < nx; x += 1, at += step) sums[cellRow + Math.floor(x / fx)] += toLevel(values[at]);
    }
    this.depth += 1;
  }

  flush() {
    if (!this.depth) return;
    const { sums, cells, means, histogram, depth } = this;
    const planeOut = this.slab * this.oy * this.ox;
    for (let i = 0; i < sums.length; i += 1) {
      const value = Math.round(sums[i] / (cells[i] * depth));
      means[planeOut + i] = value;
      histogram[value] += 1;
    }
    sums.fill(0);
    this.depth = 0;
  }

  finish(target, highPercentile) {
    this.flush();
    return finishChannel(this.means, this.histogram, target, highPercentile);
  }
}

// Runs a reader in a Web Worker - createWorker() returns it, or throws when
// module workers do not start - or, then, on the main thread (onMainThread).
// The worker answers "ready", then "progress" and "done" or "error".
function runVolumeWorker(createWorker, message, onMainThread, onProgress) {
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

export { ChannelAccumulator as C, cellCounts as c, finishChannel as f, runVolumeWorker as r };
//# sourceMappingURL=volume-voxels-DuUhffkS.js.map
