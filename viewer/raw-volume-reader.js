import { ChannelAccumulator, runVolumeWorker } from "./volume-voxels.js";

// NRRD, NIfTI and MetaImage volumes read in the browser, without the worker
// - the same files and rules as worker/raw_volume.py (see there): .nrrd,
// .nhdr (+ its data file), .nii, .nii.gz, .mha, .mhd (+ its data file). A
// detached data file is taken from the same archive (a .zip dropped from the
// disk) or, for a URL, from next to it.
//
// The header is read first (main thread, a few kB). The voxels are then
// read once, front to back, as a stream - from the File, or one HTTP request
// - decompressed on the way (gzip, zlib) and averaged down plane by plane
// in a Web Worker (raw-volume-worker.js); nothing but the result is kept.
// 8/16-bit integers are mapped as they are; other types, and data with a
// NIfTI scaling, between their minimum and maximum, found by reading the
// data once more before. bzip2 and ASCII NRRD are left to the worker.

export const MAX_SIZE = 512;
const HEAD_BYTES = 65536;

const TYPES = {
  u1: [Uint8Array, 1], i1: [Int8Array, 1], u2: [Uint16Array, 2], i2: [Int16Array, 2],
  u4: [Uint32Array, 4], i4: [Int32Array, 4], f4: [Float32Array, 4], f8: [Float64Array, 8],
  u8: [BigUint64Array, 8], i8: [BigInt64Array, 8],
};
const NRRD_TYPES = {
  uchar: "u1", "unsigned char": "u1", uint8: "u1", uint8_t: "u1",
  "signed char": "i1", int8: "i1", int8_t: "i1",
  short: "i2", "short int": "i2", "signed short": "i2", "signed short int": "i2", int16: "i2", int16_t: "i2",
  ushort: "u2", "unsigned short": "u2", "unsigned short int": "u2", uint16: "u2", uint16_t: "u2",
  int: "i4", "signed int": "i4", int32: "i4", int32_t: "i4",
  uint: "u4", "unsigned int": "u4", uint32: "u4", uint32_t: "u4",
  longlong: "i8", "long long": "i8", int64: "i8", int64_t: "i8",
  ulonglong: "u8", "unsigned long long": "u8", uint64: "u8", uint64_t: "u8",
  float: "f4", double: "f8",
};
const NIFTI_TYPES = { 2: "u1", 4: "i2", 8: "i4", 16: "f4", 64: "f8", 256: "i1", 512: "u2", 768: "u4", 1024: "i8", 1280: "u8" };
const NIFTI_UNITS = { 1: 1e6, 2: 1e3, 3: 1 };
const MET_TYPES = {
  MET_UCHAR: "u1", MET_CHAR: "i1", MET_USHORT: "u2", MET_SHORT: "i2", MET_UINT: "u4", MET_INT: "i4",
  MET_ULONG: "u4", MET_LONG: "i4", MET_ULONG_LONG: "u8", MET_LONG_LONG: "i8", MET_FLOAT: "f4", MET_DOUBLE: "f8",
};
const NRRD_NON_SPATIAL = new Set(["vector", "covariant-vector", "normal", "list", "point", "rgb-color", "hsv-color",
  "xyz-color", "rgba-color", "complex", "2-vector", "3-color", "3-vector", "4-color", "4-vector"]);
const UNIT_TO_MICRONS = { m: 1e6, cm: 1e4, mm: 1e3, um: 1, "µm": 1, micron: 1, microns: 1, nm: 1e-3 };
const PALETTE = ["#00ff00", "#ff00ff", "#00ffff", "#ffff00", "#ff0000", "#0000ff"];

export const volumeFormat = (name) => (/\.nii\.gz$/i.test(name) ? "nii" : name.split(".").pop().toLowerCase());
const stemOf = (name) => name.split("/").pop().replace(/\.nii\.gz$/i, "").replace(/\.[^.]+$/, "");
const micronsPer = (unit) => (unit ? UNIT_TO_MICRONS[String(unit).trim().toLowerCase().replace("μ", "µ")] ?? null : null);

// Bytes.

// A stream of the bytes of source ({ file } or { url }) from `offset` on,
// decompressed when `encoding` is gzip or zlib.
async function openStream(source, offset, encoding) {
  let stream;
  if (source.file) {
    stream = source.file.slice(offset).stream();
  } else {
    const response = await fetch(source.url, offset ? { headers: { Range: `bytes=${offset}-` } } : {});
    if (!response.ok) throw new Error(`${source.url}: HTTP ${response.status}`);
    stream = response.body;
    // Sent whole: the bytes before offset are skipped below.
    if (offset && response.status !== 206) {
      const reader = new ByteReader(stream);
      await reader.skip(offset);
      stream = reader.remaining();
    }
  }
  if (encoding === "gzip" || encoding === "gz") return stream.pipeThrough(new DecompressionStream("gzip"));
  if (encoding === "zlib") return stream.pipeThrough(new DecompressionStream("deflate"));
  if (encoding && encoding !== "raw") throw new Error(`${encoding} data is read by the server's conversion only`);
  return stream;
}

// Exact reads and skips over a ReadableStream.
class ByteReader {
  constructor(stream) {
    this.reader = stream.getReader();
    this.chunk = new Uint8Array(0);
    this.at = 0;
  }

  async fill() {
    if (this.at < this.chunk.length) return true;
    const { done, value } = await this.reader.read();
    if (done) return false;
    this.chunk = value;
    this.at = 0;
    return true;
  }

  async skip(count) {
    while (count > 0) {
      if (!(await this.fill())) throw new Error("The data ends early");
      const step = Math.min(count, this.chunk.length - this.at);
      this.at += step;
      count -= step;
    }
  }

  async read(count) {
    const out = new Uint8Array(count);
    let filled = 0;
    while (filled < count) {
      if (!(await this.fill())) throw new Error("The data ends early");
      const step = Math.min(count - filled, this.chunk.length - this.at);
      out.set(this.chunk.subarray(this.at, this.at + step), filled);
      this.at += step;
      filled += step;
    }
    return out;
  }

  remaining() {
    const reader = this;
    return new ReadableStream({
      async pull(controller) {
        if (!(await reader.fill())) {
          controller.close();
          return;
        }
        controller.enqueue(reader.chunk.subarray(reader.at));
        reader.at = reader.chunk.length;
      },
      cancel: () => reader.reader.cancel(),
    });
  }

  cancel() {
    this.reader.cancel().catch(() => {});
  }
}

async function readHead(source, count = HEAD_BYTES, encoding = null) {
  const reader = new ByteReader(await openStream(source, 0, encoding));
  const out = [];
  let total = 0;
  while (total < count && (await reader.fill())) {
    const part = reader.chunk.subarray(reader.at, reader.at + count - total);
    out.push(part);
    total += part.length;
    reader.at += part.length;
  }
  reader.cancel();
  const bytes = new Uint8Array(total);
  out.reduce((at, part) => (bytes.set(part, at), at + part.length), 0);
  return bytes;
}

// The plane's values as a typed array (big-endian data swapped).
function decodeValues(bytes, type, littleEndian) {
  const [Type, size] = TYPES[type];
  const copy = bytes.slice();
  if (!littleEndian && size > 1) {
    for (let i = 0; i < copy.length; i += size) copy.subarray(i, i + size).reverse();
  }
  const values = new Type(copy.buffer);
  return Type === BigInt64Array || Type === BigUint64Array ? Float64Array.from(values, Number) : values;
}

// Headers.

function nrrdHeader(bytes) {
  const text = new TextDecoder("latin1").decode(bytes);
  if (!text.startsWith("NRRD000")) throw new Error("Not a NRRD file");
  const end = text.search(/\r?\n\r?\n/);
  if (end < 0) throw new Error("The NRRD header is longer than expected");
  const fields = {};
  text.slice(0, end).split(/\r?\n/).slice(1).forEach((line) => {
    if (line.startsWith("#")) return;
    const match = /^([^:]+):=?\s?(.*)$/.exec(line);
    if (match) fields[match[1].trim().toLowerCase()] = match[2].trim();
  });
  return { fields, headerEnd: end + text.slice(end).match(/^\r?\n\r?\n/)[0].length };
}

function describeNrrd(bytes, name) {
  const { fields, headerEnd } = nrrdHeader(bytes);
  let sizes = (fields.sizes || "").split(/\s+/).filter(Boolean).map(Number);
  const type = NRRD_TYPES[(fields.type || "").toLowerCase()];
  if (!sizes.length || !type) throw new Error(`Unsupported NRRD type ${fields.type}`);
  let kinds = fields.kinds ? fields.kinds.toLowerCase().split(/\s+/) : sizes.map(() => "domain");
  let channels = 1;
  if (NRRD_NON_SPATIAL.has(kinds[0])) {
    channels = sizes[0];
    sizes = sizes.slice(1);
    kinds = kinds.slice(1);
  }
  if (sizes.length < 3 || sizes[2] < 2) throw new Error("A single plane, not a stack");
  const directions = (fields["space directions"] || "").match(/\([^)]*\)|none/g) || [];
  const vectors = directions.filter((part) => part !== "none").map((part) => part.slice(1, -1).split(",").map(Number));
  let size = vectors.length >= 3 ? vectors.slice(0, 3).map((v) => Math.hypot(...v)) : null;
  if (!size && fields.spacings) {
    const spacings = fields.spacings.split(/\s+/).map(Number).slice(-sizes.length).slice(0, 3);
    if (spacings.length === 3) size = spacings.map((s) => (Number.isFinite(s) ? Math.abs(s) : 1));
  }
  const units = fields["space units"] ? (fields["space units"].match(/"([^"]*)"/g) || []).map((u) => u.slice(1, -1)) : [];
  const scale = units.length ? micronsPer(units[0]) : ("space" in fields || "space dimension" in fields ? 1e3 : null);
  const encoding = (fields.encoding || "raw").toLowerCase();
  const dataFile = fields["data file"] || fields.datafile;
  if (dataFile && (/^LIST/.test(dataFile) || dataFile.includes("%"))) throw new Error("NRRD data split over several files is not supported");
  const skip = Number(fields["byte skip"] || 0);
  if (skip === -1) throw new Error("NRRD byte skip -1 is read by the server's conversion only");
  return {
    name,
    shape: [sizes[2], sizes[1], sizes[0]],
    channels,
    type,
    littleEndian: (fields.endian || "little") === "little" || type.endsWith("1"),
    interleaved: true,
    channelStride: 0,
    voxel: size && scale ? size.map((s) => s * scale) : size || [1, 1, 1],
    unit: size && scale ? "µm" : "px",
    frames: sizes.slice(3).reduce((a, b) => a * b, 1),
    data: dataFile ? { file: dataFile.split(/\s+/)[0], offset: 0 } : { offset: headerEnd },
    encoding,
    skip,
  };
}

function describeNifti(bytes, name, gzipped) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let little = true;
  let size = view.getInt32(0, true);
  if (size !== 348 && size !== 540) {
    little = false;
    size = view.getInt32(0, false);
  }
  const ascii = (from, to) => String.fromCharCode(...bytes.subarray(from, to));
  let dims;
  let datatype;
  let pixdim;
  let offset;
  let slope;
  let intercept;
  let units;
  if (size === 348) {
    if (ascii(344, 347) !== "n+1") throw new Error("A NIfTI header and image pair (.hdr/.img) is not supported");
    dims = Array.from({ length: 8 }, (_v, i) => view.getInt16(40 + i * 2, little));
    datatype = view.getInt16(70, little);
    pixdim = Array.from({ length: 8 }, (_v, i) => view.getFloat32(76 + i * 4, little));
    offset = Math.round(view.getFloat32(108, little));
    slope = view.getFloat32(112, little);
    intercept = view.getFloat32(116, little);
    units = bytes[123] & 7;
  } else if (size === 540) {
    if (ascii(4, 7) !== "n+2") throw new Error("A NIfTI header and image pair is not supported");
    datatype = view.getInt16(12, little);
    dims = Array.from({ length: 8 }, (_v, i) => Number(view.getBigInt64(16 + i * 8, little)));
    pixdim = Array.from({ length: 8 }, (_v, i) => view.getFloat64(104 + i * 8, little));
    offset = Number(view.getBigInt64(168, little));
    slope = view.getFloat64(176, little);
    intercept = view.getFloat64(184, little);
    units = view.getInt32(500, little) & 7;
  } else {
    throw new Error("Not a NIfTI file");
  }
  const type = NIFTI_TYPES[datatype];
  if (!type) throw new Error(`Unsupported NIfTI data type ${datatype}`);
  const [nx, ny, nz, nt, nc] = [1, 2, 3, 4, 5].map((i) => Math.max(1, i <= dims[0] ? dims[i] : 1));
  if (nz < 2) throw new Error("A single plane, not a stack");
  const voxel = pixdim.slice(1, 4).map((p) => Math.abs(p) || 1);
  const scale = NIFTI_UNITS[units];
  const item = TYPES[type][1];
  return {
    name,
    shape: [nz, ny, nx],
    channels: nc,
    type,
    littleEndian: little,
    // Channels (dim 5) come after all time points.
    interleaved: nc === 1,
    channelStride: nx * ny * nz * nt * item,
    voxel: scale ? voxel.map((v) => v * scale) : voxel,
    unit: scale ? "µm" : "px",
    frames: nt,
    data: { offset: gzipped ? 0 : offset },
    encoding: gzipped ? "gzip" : "raw",
    skip: gzipped ? offset : 0,
    slope: Number.isFinite(slope) && slope !== 0 ? slope : 1,
    intercept: Number.isFinite(intercept) ? intercept : 0,
  };
}

function describeMetaImage(bytes, name) {
  const text = new TextDecoder("latin1").decode(bytes);
  const fields = {};
  let headerEnd = 0;
  for (const match of text.matchAll(/([^\r\n]*)(\r?\n|$)/g)) {
    const line = match[1].trim();
    headerEnd = match.index + match[0].length;
    if (!line) {
      if (!match[0]) break;
      continue;
    }
    const at = line.indexOf("=");
    if (at < 0) throw new Error("Not a MetaImage file");
    const key = line.slice(0, at).trim().toLowerCase();
    fields[key] = line.slice(at + 1).trim();
    if (key === "elementdatafile") break;
  }
  if (!fields.elementdatafile || !fields.dimsize) throw new Error("Not a MetaImage file");
  const sizes = fields.dimsize.split(/\s+/).map(Number);
  const type = MET_TYPES[(fields.elementtype || "").toUpperCase()];
  if (!type) throw new Error(`Unsupported MetaImage element type ${fields.elementtype}`);
  if (sizes.length < 3 || sizes[2] < 2) throw new Error("A single plane, not a stack");
  const msb = (fields.binarydatabyteordermsb || fields.byteordermsb || "False").toLowerCase() === "true";
  const dataFile = fields.elementdatafile;
  if (dataFile.toUpperCase() === "LIST" || dataFile.includes("%")) throw new Error("MetaImage data split over several files is not supported");
  const headerSize = Number(fields.headersize || 0);
  if (headerSize === -1) throw new Error("MetaImage HeaderSize -1 is read by the server's conversion only");
  const local = dataFile.toUpperCase() === "LOCAL";
  const size = (fields.elementspacing || fields.elementsize || "1 1 1").split(/\s+/).slice(0, 3).map(Number);
  return {
    name,
    shape: [sizes[2], sizes[1], sizes[0]],
    channels: Number(fields.elementnumberofchannels || 1),
    type,
    littleEndian: !msb,
    interleaved: true,
    channelStride: 0,
    // ITK's convention: millimetres.
    voxel: size.map((s) => s * 1e3),
    unit: "µm",
    frames: sizes.slice(3).reduce((a, b) => a * b, 1),
    data: local ? { offset: headerEnd + headerSize } : { file: dataFile, offset: headerSize },
    encoding: (fields.compresseddata || "False").toLowerCase() === "true" ? "zlib" : "raw",
    skip: 0,
  };
}

function manifestFor(volume, fileName) {
  const [nz, ny, nx] = volume.shape;
  const factors = volume.shape.map((n) => Math.max(1, Math.ceil(n / MAX_SIZE)));
  const colors = volume.channels === 1 ? ["#ffffff"] : Array.from({ length: volume.channels }, (_v, i) => PALETTE[i % PALETTE.length]);
  const bits = TYPES[volume.type][1] * 8;
  return {
    format: "dfg-volume",
    version: 1,
    source: fileName,
    skipped: [],
    series: [{
      id: volume.name.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase() || "volume",
      name: volume.name,
      path: fileName,
      dims: volume.shape.map((n, i) => Math.ceil(n / factors[i])).reverse(),
      sourceDims: [nx, ny, nz],
      voxelSize: volume.voxel.map((v, i) => Number((v * factors[2 - i]).toFixed(6))),
      unit: volume.unit,
      frames: volume.frames,
      channels: colors.map((color, c) => ({ name: volume.channels === 1 ? volume.name : `Channel ${c + 1}`, color, bits })),
      acquisition: {},
      layout: { ...volume, factors },
    }],
  };
}

// The manifest of the volume in source ({ file } or { url }); the data file
// of a detached header from `siblings` (Files of the same archive) or next
// to the URL. Returns { manifest, dataSource }.
export async function describeRawVolume(source, fileName, siblings = null) {
  const format = volumeFormat(fileName);
  const name = stemOf(fileName);
  let volume;
  if (format === "nii") {
    const gzipped = /\.gz$/i.test(fileName);
    volume = describeNifti(await readHead(source, 540, gzipped ? "gzip" : null), name, gzipped);
  } else {
    const head = await readHead(source);
    volume = format === "nrrd" || format === "nhdr" ? describeNrrd(head, name) : describeMetaImage(head, name);
  }
  let dataSource = source;
  if (volume.data.file) {
    if (source.file) {
      const folder = fileName.replace(/[^/]*$/, "");
      const file = siblings?.find((f) => f.name === folder + volume.data.file || f.name.split("/").pop() === volume.data.file);
      if (!file) throw new Error(`${fileName} keeps its voxels in ${volume.data.file}: open a .zip with both files`);
      dataSource = { file };
    } else {
      dataSource = { url: new URL(volume.data.file, source.url).href };
    }
  }
  return { manifest: manifestFor(volume, fileName), dataSource };
}

// Reading the voxels (Web Worker or main thread).

// The planes of the first time point, in the order they are stored:
// [{ position (in the decompressed data), z, channel or -1 for all }].
function planeOrder(layout) {
  const [nz, ny, nx] = layout.shape;
  const item = TYPES[layout.type][1];
  const planeBytes = ny * nx * item * (layout.interleaved ? layout.channels : 1);
  const planes = [];
  const channels = layout.interleaved ? [-1] : Array.from({ length: layout.channels }, (_v, c) => c);
  channels.forEach((channel) => {
    for (let z = 0; z < nz; z += 1) {
      planes.push({ position: layout.skip + Math.max(0, channel) * layout.channelStride + z * planeBytes, z, channel });
    }
  });
  return { planes: planes.sort((a, b) => a.position - b.position), planeBytes };
}

// Calls visit(values, z, channel) for every plane, front to back.
async function eachPlane(source, layout, visit, onPlane) {
  const { planes, planeBytes } = planeOrder(layout);
  const reader = new ByteReader(await openStream(source, layout.data.offset, layout.encoding));
  let at = 0;
  try {
    for (const plane of planes) {
      await reader.skip(plane.position - at);
      const values = decodeValues(await reader.read(planeBytes), layout.type, layout.littleEndian);
      at = plane.position + planeBytes;
      visit(values, plane.z, plane.channel);
      onPlane?.();
    }
  } finally {
    reader.cancel();
  }
}

// The voxels of the volume (channel by channel, x fastest), with each
// channel's value range (in the file's units, NIfTI scaling applied) and
// Otsu threshold.
export async function readRawVolume(source, layout, { onProgress } = {}) {
  const [nz, ny, nx] = layout.shape;
  const voxels = layout.shape.reduce((n, size, i) => n * Math.ceil(size / layout.factors[i]), 1);
  const slope = layout.slope ?? 1;
  const intercept = layout.intercept ?? 0;
  const scaled = slope !== 1 || intercept !== 0;
  const passes = !scaled && ["u1", "i1", "u2", "i2"].includes(layout.type) ? 1 : 2;
  const total = nz * (layout.interleaved ? 1 : layout.channels) * passes;
  let done = 0;
  const progress = () => onProgress?.({ loaded: (done += 1), total });
  const channels = Array.from({ length: layout.channels }, (_v, c) => c);
  const plane = ny * nx;

  // Each channel's mapping: 8/16-bit integers as they are, the rest between
  // the extremes of its (scaled) values, found by a first pass.
  let mappings;
  if (passes === 1) {
    const shift = { u1: 0, i1: 128, u2: 0, i2: 32768 }[layout.type];
    const levels = layout.type.endsWith("1") ? 256 : 65536;
    mappings = channels.map(() => ({ levels, toLevel: (v) => v + shift, toValue: (l) => l - shift }));
  } else {
    const min = channels.map(() => Infinity);
    const max = channels.map(() => -Infinity);
    await eachPlane(source, layout, (values, _z, only) => {
      (only < 0 ? channels : [only]).forEach((c) => {
        const step = only < 0 ? layout.channels : 1;
        for (let i = only < 0 ? c : 0, n = 0; n < plane; n += 1, i += step) {
          const v = values[i] * slope + intercept;
          if (v < min[c]) min[c] = v;
          if (v > max[c]) max[c] = v;
        }
      });
    }, progress);
    mappings = channels.map((c) => {
      const low = Number.isFinite(min[c]) ? min[c] : 0;
      const high = max[c] > low ? max[c] : low + 1;
      const toLevels = 65535 / (high - low);
      return {
        levels: 65536,
        toLevel: (v) => {
          const level = (v * slope + intercept - low) * toLevels;
          return level >= 0 ? Math.min(65535, level) : 0;
        },
        toValue: (l) => Math.round((low + l / toLevels) * 1000) / 1000,
      };
    });
  }

  const accumulators = mappings.map((mapping) => new ChannelAccumulator(layout.shape, layout.factors, mapping));
  await eachPlane(source, layout, (values, z, only) => {
    if (only >= 0) accumulators[only].add(z, values);
    else channels.forEach((c) => accumulators[c].add(z, values, c, layout.channels));
  }, progress);

  const bytes = new Uint8Array(voxels * layout.channels);
  const results = accumulators.map((accumulator, c) => {
    const { low, high, threshold } = accumulator.finish(bytes.subarray(c * voxels, (c + 1) * voxels));
    return { range: [mappings[c].toValue(low), mappings[c].toValue(high)], threshold };
  });
  return { bytes, channels: results };
}

// A NRRD / NIfTI / MetaImage file from a File ({ file }) or a URL ({ url }),
// with the other files of its archive: its manifest, and loadSeries(0).
export async function openRawVolume(source, fileName, siblings = null) {
  const { manifest, dataSource } = await describeRawVolume(source, fileName, siblings);
  return {
    manifest,
    async loadSeries(index, { onProgress } = {}) {
      const stack = manifest.series[index];
      const result = await runVolumeWorker(
        () => new Worker(new URL("./raw-volume-worker.js", import.meta.url), { type: "module" }),
        { source: dataSource, layout: stack.layout },
        () => readRawVolume(dataSource, stack.layout, { onProgress }),
        onProgress,
      );
      result.channels.forEach((channel, c) => Object.assign(stack.channels[c], channel));
      return result.bytes;
    },
  };
}
