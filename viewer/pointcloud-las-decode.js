import { LAZPerfLoader } from "@loaders.gl/las";

// Decoding of LAS / LAZ point clouds into batches of points, shared by the
// Web Worker (pointcloud-las-worker.js) and the main-thread fallback
// (pointcloud-las.js, where module workers are not available). No three.js
// and no DOM here: this module runs inside the worker.
//
//   LAS (uncompressed)  parsed while it downloads: point records are decoded
//                       as the bytes arrive, thinned on the fly, and the file
//                       itself is never held in memory - so a scan of several
//                       GB only costs the memory of the points kept. All point
//                       formats 0-10 (LAS 1.0-1.4).
//   LAZ                 downloaded in full (laz-perf needs the whole file),
//                       then decompressed in batches of 100 000 points with
//                       loaders.gl's laz-perf build (point formats 0-3).
//
// Messages passed to emit(message, transfer):
//   { type: "progress", loaded, total }       download progress (bytes)
//   { type: "header", totalPoints, capacity, skip, center, bounds, hasColor, pointFormat }
//       center: the cloud's origin in file coordinates (double precision);
//       positions are sent relative to it as Float32. bounds: [min, max]
//       relative to the center from the LAS header, or null if the header
//       has none - the final bounds come with "done".
//   { type: "batch", start, count, positions, colors, intensity, classification }
//       positions Float32 xyz (Z up, as in the file), colors Uint8 rgb (or
//       null), intensity Uint16, classification Uint8; start = index of the
//       batch's first point
//   { type: "done", loadedPoints, bounds, intensityMax }

const BATCH_POINTS = 100_000;
const HEADER_MIN_BYTES = 227;

// Byte offset of red/green/blue inside a point record, per point format.
const COLOR_OFFSETS = { 2: 20, 3: 28, 5: 28, 7: 30, 8: 30, 10: 30 };

// The public header block (LAS 1.0-1.4) of a buffer starting at the file's
// first byte.
export function readLasHeader(buffer) {
  const view = new DataView(buffer);
  if (view.byteLength < HEADER_MIN_BYTES || String.fromCharCode(...new Uint8Array(buffer, 0, 4)) !== "LASF") {
    throw new Error("Not a LAS/LAZ file (missing LASF signature)");
  }
  const minor = view.getUint8(25);
  const formatByte = view.getUint8(104);
  let pointCount = view.getUint32(107, true);
  if (minor >= 4 && view.byteLength >= 255) {
    const count = Number(view.getBigUint64(247, true));
    if (count > 0) pointCount = count;
  }
  const f64 = (offset) => view.getFloat64(offset, true);
  const min = [f64(187), f64(203), f64(219)];
  const max = [f64(179), f64(195), f64(211)];
  const boundsValid = min.every((value, axis) => Number.isFinite(value) && Number.isFinite(max[axis]) && value <= max[axis])
    && min.some((value, axis) => value !== 0 || max[axis] !== 0);
  return {
    version: `${view.getUint8(24)}.${minor}`,
    pointsOffset: view.getUint32(96, true),
    // LASzip marks compressed files by setting bit 7 (or 6) of the format.
    compressed: (formatByte & 0xc0) !== 0,
    pointFormat: formatByte & 0x3f,
    recordLength: view.getUint16(105, true),
    pointCount,
    scale: [f64(131), f64(139), f64(147)],
    offset: [f64(155), f64(163), f64(171)],
    bounds: boundsValid ? { min, max } : null,
  };
}

export function readLasPointCount(buffer) {
  return readLasHeader(buffer).pointCount;
}

// Thinning: every skip-th point, so that about maxPoints are kept.
function thinning(pointCount, maxPoints) {
  const skip = Math.max(1, Math.ceil(pointCount / maxPoints));
  return { skip, capacity: Math.ceil(pointCount / skip) };
}

// Collects decoded points (file coordinates, double precision) and sends
// them on in batches, re-centred to Float32.
class PointBatcher {
  constructor({ header, skip, capacity, hasColor, colorDepth, emit }) {
    this.emit = emit;
    this.capacity = capacity;
    this.hasColor = hasColor;
    // "auto": raw LAS colours are 16-bit by the spec, but many writers store
    // 8-bit values; decided by the first batch with any colour in it.
    this.colorShift = colorDepth === 8 ? 0 : null;
    this.written = 0;
    this.intensityMax = 0;
    this.min = [Infinity, Infinity, Infinity];
    this.max = [-Infinity, -Infinity, -Infinity];
    this.center = header.bounds
      ? header.bounds.min.map((value, axis) => (value + header.bounds.max[axis]) / 2)
      : null;
    this.allocate();
    this.emit({
      type: "header",
      totalPoints: header.pointCount,
      capacity,
      skip,
      center: this.center,
      // Rounded like the positions (Float32), so no point lies outside.
      bounds: header.bounds && this.center
        ? [header.bounds.min.map((value, axis) => Math.fround(value - this.center[axis])), header.bounds.max.map((value, axis) => Math.fround(value - this.center[axis]))]
        : null,
      hasColor,
      pointFormat: header.pointFormat,
    });
  }

  allocate() {
    this.size = 0;
    this.xyz = new Float64Array(BATCH_POINTS * 3);
    this.rgb = this.hasColor ? new Uint16Array(BATCH_POINTS * 3) : null;
    this.intensity = new Uint16Array(BATCH_POINTS);
    this.classification = new Uint8Array(BATCH_POINTS);
  }

  get full() {
    return this.written + this.size >= this.capacity;
  }

  push(x, y, z, r, g, b, intensity, classification) {
    if (this.full) return;
    const i = this.size;
    this.xyz[i * 3] = x;
    this.xyz[i * 3 + 1] = y;
    this.xyz[i * 3 + 2] = z;
    if (this.rgb) {
      this.rgb[i * 3] = r;
      this.rgb[i * 3 + 1] = g;
      this.rgb[i * 3 + 2] = b;
    }
    this.intensity[i] = intensity;
    this.classification[i] = classification;
    this.size += 1;
    if (this.size === BATCH_POINTS) this.flush();
  }

  flush() {
    const count = this.size;
    if (!count) return;
    // A header without bounds: the first batch decides the origin.
    if (!this.center) {
      const lo = [Infinity, Infinity, Infinity];
      const hi = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < count * 3; i += 1) {
        const axis = i % 3;
        if (this.xyz[i] < lo[axis]) lo[axis] = this.xyz[i];
        if (this.xyz[i] > hi[axis]) hi[axis] = this.xyz[i];
      }
      this.center = lo.map((value, axis) => (value + hi[axis]) / 2);
    }
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i += 1) {
      const axis = i % 3;
      const value = this.xyz[i] - this.center[axis];
      positions[i] = value;
      if (value < this.min[axis]) this.min[axis] = value;
      if (value > this.max[axis]) this.max[axis] = value;
    }
    let colors = null;
    if (this.rgb) {
      if (this.colorShift === null) {
        let maxColor = 0;
        for (let i = 0; i < count * 3; i += 1) if (this.rgb[i] > maxColor) maxColor = this.rgb[i];
        if (maxColor > 0) this.colorShift = maxColor > 255 ? 8 : 0;
      }
      const shift = this.colorShift ?? 0;
      colors = new Uint8Array(count * 3);
      for (let i = 0; i < count * 3; i += 1) colors[i] = Math.min(255, this.rgb[i] >> shift);
    }
    const intensity = this.intensity.slice(0, count);
    for (let i = 0; i < count; i += 1) if (intensity[i] > this.intensityMax) this.intensityMax = intensity[i];
    const classification = this.classification.slice(0, count);

    const message = { type: "batch", start: this.written, count, positions, colors, intensity, classification, center: this.center };
    const transfer = [positions.buffer, intensity.buffer, classification.buffer];
    if (colors) transfer.push(colors.buffer);
    this.emit(message, transfer);
    this.written += count;
    this.size = 0;
  }

  finish() {
    this.flush();
    if (this.written === 0) throw new Error("The point cloud contains no points.");
    this.emit({
      type: "done",
      loadedPoints: this.written,
      center: this.center,
      bounds: [this.min, this.max],
      intensityMax: this.intensityMax,
    });
  }
}

// Uncompressed LAS, decoded record by record as the bytes arrive.
class LasStreamDecoder {
  constructor({ maxPoints, emit }) {
    this.maxPoints = maxPoints;
    this.emit = emit;
    this.headerBytes = [];
    this.headerLength = 0;
    this.header = null;
    this.leftover = null; // the start of a record cut by a chunk boundary
    this.record = 0;
    this.batcher = null;
  }

  get done() {
    return Boolean(this.header) && (this.record >= this.header.pointCount || this.batcher.full);
  }

  push(chunk) {
    if (!this.header) {
      this.headerBytes.push(chunk);
      this.headerLength += chunk.byteLength;
      if (this.headerLength < HEADER_MIN_BYTES) return;
      const joined = concatChunks(this.headerBytes, this.headerLength);
      const header = readLasHeader(joined.buffer);
      if (header.compressed) throw new Error("LAZ data in a .las file");
      if (this.headerLength < header.pointsOffset) return;
      this.headerBytes = null;
      this.startRecords(header);
      // The header and the VLRs are skipped; the rest are point records.
      chunk = joined.subarray(header.pointsOffset);
    }
    this.decode(chunk);
  }

  startRecords(header) {
    if (!(header.pointFormat in RECORD_MIN_LENGTH) || header.recordLength < RECORD_MIN_LENGTH[header.pointFormat]) {
      throw new Error(`Unsupported LAS point format ${header.pointFormat}`);
    }
    this.header = header;
    const { skip, capacity } = thinning(header.pointCount, this.maxPoints);
    this.skip = skip;
    this.colorOffset = COLOR_OFFSETS[header.pointFormat] ?? -1;
    this.batcher = new PointBatcher({
      header, skip, capacity, hasColor: this.colorOffset >= 0, colorDepth: "auto", emit: this.emit,
    });
  }

  decode(chunk) {
    const size = this.header.recordLength;
    let offset = 0;
    if (this.leftover) {
      const needed = size - this.leftover.byteLength;
      if (chunk.byteLength < needed) {
        this.leftover = concatChunks([this.leftover, chunk], this.leftover.byteLength + chunk.byteLength);
        return;
      }
      const record = concatChunks([this.leftover, chunk.subarray(0, needed)], size);
      this.leftover = null;
      this.readRecord(new DataView(record.buffer), 0);
      offset = needed;
    }
    const view = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);
    while (offset + size <= chunk.byteLength && !this.done) {
      this.readRecord(view, offset);
      offset += size;
    }
    if (offset < chunk.byteLength && !this.done) this.leftover = chunk.slice(offset);
  }

  readRecord(view, at) {
    if (this.done) return;
    const index = this.record;
    this.record += 1;
    if (index % this.skip !== 0) return;
    const { scale, offset, pointFormat } = this.header;
    const x = view.getInt32(at, true) * scale[0] + offset[0];
    const y = view.getInt32(at + 4, true) * scale[1] + offset[1];
    const z = view.getInt32(at + 8, true) * scale[2] + offset[2];
    const intensity = view.getUint16(at + 12, true);
    // Formats 0-5 keep flags in the top bits of the classification byte.
    const classification = pointFormat < 6 ? view.getUint8(at + 15) & 0x1f : view.getUint8(at + 16);
    const c = this.colorOffset;
    if (c >= 0) {
      this.batcher.push(x, y, z, view.getUint16(at + c, true), view.getUint16(at + c + 2, true), view.getUint16(at + c + 4, true), intensity, classification);
    } else {
      this.batcher.push(x, y, z, 0, 0, 0, intensity, classification);
    }
  }

  finish() {
    if (!this.header) throw new Error("Not a LAS/LAZ file (incomplete header)");
    this.batcher.finish();
  }
}

// Minimum record length per point format (LAS 1.4, tables 7-16).
const RECORD_MIN_LENGTH = { 0: 20, 1: 28, 2: 26, 3: 34, 4: 57, 5: 63, 6: 30, 7: 36, 8: 38, 9: 59, 10: 67 };

function concatChunks(chunks, length) {
  const joined = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) {
    joined.set(chunk.subarray(0, length - at), at);
    at += Math.min(chunk.byteLength, length - at);
    if (at >= length) break;
  }
  return joined;
}

// LAZ: decompressed in batches by laz-perf.
export function decodeLazBuffer(buffer, { maxPoints, emit }) {
  const header = readLasHeader(buffer);
  const { skip, capacity } = thinning(header.pointCount, maxPoints);
  const batcher = new PointBatcher({
    header, skip, capacity, hasColor: header.pointFormat in COLOR_OFFSETS, colorDepth: 8, emit,
  });
  let read = 0;
  LAZPerfLoader.parseSync(buffer, {
    // fp64: UTM/national grid coordinates (hundreds of km) do not survive
    // Float32; the batcher re-centres them in double precision.
    las: { fp64: true, skip, colorDepth: "auto" },
    worker: false,
    // After each batch of laz-perf: the arrays are filled up to vertexCount.
    onProgress: (mesh) => {
      const until = mesh.header.vertexCount;
      const position = mesh.attributes.POSITION.value;
      const color = mesh.attributes.COLOR_0?.value;
      const intensity = mesh.attributes.intensity.value;
      const classification = mesh.attributes.classification.value;
      for (let i = read; i < until; i += 1) {
        batcher.push(
          position[i * 3], position[i * 3 + 1], position[i * 3 + 2],
          color ? color[i * 4] : 0, color ? color[i * 4 + 1] : 0, color ? color[i * 4 + 2] : 0,
          intensity[i], classification[i],
        );
      }
      read = until;
    },
  });
  batcher.finish();
}

function isLazName(url) {
  try {
    return /\.laz$/i.test(new URL(url).pathname);
  } catch {
    return /\.laz(\?|#|$)/i.test(url);
  }
}

// Downloads and decodes a LAS/LAZ file. compressed: true/false from the
// file name, or null to tell by the header (blob: URLs have no name).
export async function decodeLasUrl(url, { maxPoints, compressed = null, emit }) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} while loading the point cloud`);
  const total = Number(response.headers.get("content-length")) || 0;
  const reader = response.body?.getReader();
  if (!reader) {
    const buffer = await response.arrayBuffer();
    emit({ type: "progress", loaded: buffer.byteLength, total: buffer.byteLength });
    return decodeBuffer(buffer, { maxPoints, emit });
  }

  let loaded = 0;
  let stream = null; // LasStreamDecoder once the file is known to be uncompressed
  const chunks = [];
  let isLaz = compressed ?? (isLazName(url) ? true : null);
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    loaded += value.byteLength;
    emit({ type: "progress", loaded, total: Math.max(total, loaded) });
    if (isLaz === null) {
      // Told by the header's point format byte.
      chunks.push(value);
      const length = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
      if (length < HEADER_MIN_BYTES) continue;
      isLaz = readLasHeader(concatChunks(chunks, length).buffer).compressed;
      if (!isLaz) {
        stream = new LasStreamDecoder({ maxPoints, emit });
        chunks.splice(0).forEach((chunk) => stream.push(chunk));
      }
      continue;
    }
    if (isLaz) {
      chunks.push(value);
    } else {
      stream ??= new LasStreamDecoder({ maxPoints, emit });
      stream.push(value);
      if (stream.done) {
        // Enough points (the rest are trailing records past the count, or
        // extended VLRs): stop the download.
        reader.cancel().catch(() => {});
        break;
      }
    }
  }
  if (stream) return stream.finish();
  if (!chunks.length) throw new Error("The point cloud file is empty.");
  const length = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const buffer = concatChunks(chunks, length).buffer;
  chunks.length = 0;
  return decodeBuffer(buffer, { maxPoints, emit });
}

// A whole file already in memory.
export function decodeBuffer(buffer, { maxPoints, emit }) {
  const header = readLasHeader(buffer);
  if (header.compressed) return decodeLazBuffer(buffer, { maxPoints, emit });
  const stream = new LasStreamDecoder({ maxPoints, emit });
  stream.push(new Uint8Array(buffer));
  return stream.finish();
}
