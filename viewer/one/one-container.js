// The One (.one4d): one file for a model with its levels of detail, point
// clouds, splats, textures, timeline (4D), Level of Certainty and metadata.
// Draft format, version 0.1 - see docs/one-format.md.
//
// The container is a ZIP archive anyone can open, written so a viewer can
// read it part by part (HTTP Range requests) instead of whole:
// - the first entry is the manifest `one.json`, so the first bytes of the
//   file (PK\3\4 then "one.json" at byte 30) tell what it is;
// - entries are stored (method 0), not deflated, and their data starts on
//   a 64-byte boundary (padding in the local header's extra field, ID
//   0x4F4E), so a part can be handed to a decoder or the GPU as it lies;
// - the parts follow in the order they are needed: the preview, then the
//   levels of detail from the coarsest to the finest, the rest after.
//
// This module has no dependencies and runs in the browser and in Node
// (scripts/one-pack.mjs): reading from an ArrayBuffer, a Blob/File or a
// URL, writing to a Uint8Array.

export const ONE_FORMAT = "one";
export const ONE_VERSION = "0.1";
export const ONE_MANIFEST = "one.json";
export const ONE_EXTENSIONS = ["one4d", "one"];
export const ONE_MEDIA_TYPE = "model/vnd.one4d+zip";
export const ONE_ALIGNMENT = 64;
// Extra field ID of the alignment padding ("NO" little-endian: 0x4F4E).
const PADDING_EXTRA_ID = 0x4f4e;
// The part kinds this version defines; others are kept and skipped.
export const ONE_PART_KINDS = ["mesh", "points", "splats", "image", "audio", "data"];

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_OF_CENTRAL = 0x06054b50;
const LOCAL_HEADER_SIZE = 30;
const CENTRAL_HEADER_SIZE = 46;
const END_SIZE = 22;
// The end record and a comment of at most 64 KiB.
const TAIL_SEARCH = END_SIZE + 0xffff;
// Read at once from the start of the file: the manifest is usually inside.
const HEAD_READ = 64 * 1024;

// Raw DEFLATE with the platform's own streams (browsers, Node 18+): the
// default when the caller passes no inflate/deflate function.
async function throughStream(bytes, Stream) {
  const stream = new Blob([bytes]).stream().pipeThrough(new Stream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
export const platformInflate = typeof DecompressionStream === "function"
  ? (bytes) => throughStream(bytes, DecompressionStream)
  : null;
export const platformDeflate = typeof CompressionStream === "function"
  ? (bytes) => throughStream(bytes, CompressionStream)
  : null;

const utf8 = new TextEncoder();
const utf8Decoder = new TextDecoder();

// ---------------------------------------------------------------------------
// Sources: { size, read(offset, length) -> Promise<Uint8Array>, name }

export function bufferSource(buffer, name = "") {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return {
    name,
    size: bytes.byteLength,
    async read(offset, length) {
      return bytes.subarray(offset, offset + length);
    },
  };
}

export function blobSource(blob, name = blob?.name || "") {
  return {
    name,
    size: blob.size,
    async read(offset, length) {
      return new Uint8Array(await blob.slice(offset, offset + length).arrayBuffer());
    },
  };
}

// A file on a server, read with Range requests. A server that answers a
// Range request with the whole file (200) is read whole, once.
export async function urlSource(url, { fetchImpl = globalThis.fetch, headers = {} } = {}) {
  let whole = null;
  const fetchWhole = async () => {
    if (!whole) {
      const response = await fetchImpl(url, { headers });
      if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
      whole = new Uint8Array(await response.arrayBuffer());
    }
    return whole;
  };

  // The size and whether ranges work: the first bytes, asked as a range.
  const first = await fetchImpl(url, { headers: { ...headers, Range: `bytes=0-${HEAD_READ - 1}` } });
  if (!first.ok) throw new Error(`${url}: HTTP ${first.status}`);
  let size;
  let head = null;
  if (first.status === 206) {
    const range = first.headers.get("content-range") || "";
    size = Number(range.split("/").pop());
    head = new Uint8Array(await first.arrayBuffer());
    if (!Number.isFinite(size)) {
      whole = null;
      size = (await fetchWhole()).byteLength;
      head = null;
    }
  } else {
    whole = new Uint8Array(await first.arrayBuffer());
    size = whole.byteLength;
  }

  return {
    name: String(url).split(/[?#]/)[0].split("/").pop(),
    size,
    rangeRequests: !whole,
    async read(offset, length) {
      if (whole) return whole.subarray(offset, offset + length);
      if (head && offset + length <= head.byteLength) return head.subarray(offset, offset + length);
      const response = await fetchImpl(url, {
        headers: { ...headers, Range: `bytes=${offset}-${offset + length - 1}` },
      });
      if (response.status === 206) return new Uint8Array(await response.arrayBuffer());
      if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
      whole = new Uint8Array(await response.arrayBuffer());
      return whole.subarray(offset, offset + length);
    },
  };
}

// ---------------------------------------------------------------------------
// Reading

const view = (bytes) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

// True for bytes that start like a .one4d file (a ZIP whose first entry is
// one.json). 38 bytes are enough.
export function isOneContainer(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b.byteLength < LOCAL_HEADER_SIZE + ONE_MANIFEST.length) return false;
  const v = view(b);
  if (v.getUint32(0, true) !== LOCAL_HEADER) return false;
  const nameLength = v.getUint16(26, true);
  if (nameLength !== ONE_MANIFEST.length) return false;
  return utf8Decoder.decode(b.subarray(LOCAL_HEADER_SIZE, LOCAL_HEADER_SIZE + nameLength)) === ONE_MANIFEST;
}

async function readCentralDirectory(source) {
  const tailLength = Math.min(source.size, TAIL_SEARCH);
  const tail = await source.read(source.size - tailLength, tailLength);
  const v = view(tail);
  let end = -1;
  for (let i = tail.byteLength - END_SIZE; i >= 0; i -= 1) {
    if (v.getUint32(i, true) === END_OF_CENTRAL) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error("Not a ZIP archive (no end of central directory)");
  const count = v.getUint16(end + 10, true);
  const cdSize = v.getUint32(end + 12, true);
  const cdOffset = v.getUint32(end + 16, true);
  if (count === 0xffff || cdOffset === 0xffffffff) {
    throw new Error("ZIP64 archives are not supported by this version (files over 4 GB)");
  }
  const tailStart = source.size - tailLength;
  const cd = cdOffset >= tailStart
    ? tail.subarray(cdOffset - tailStart, cdOffset - tailStart + cdSize)
    : await source.read(cdOffset, cdSize);
  const cv = view(cd);
  const entries = new Map();
  let p = 0;
  for (let i = 0; i < count; i += 1) {
    if (cv.getUint32(p, true) !== CENTRAL_HEADER) throw new Error("Damaged ZIP central directory");
    const method = cv.getUint16(p + 10, true);
    const crc32 = cv.getUint32(p + 16, true);
    const compressedSize = cv.getUint32(p + 20, true);
    const size = cv.getUint32(p + 24, true);
    const nameLength = cv.getUint16(p + 28, true);
    const extraLength = cv.getUint16(p + 30, true);
    const commentLength = cv.getUint16(p + 32, true);
    const headerOffset = cv.getUint32(p + 42, true);
    const name = utf8Decoder.decode(cd.subarray(p + CENTRAL_HEADER_SIZE, p + CENTRAL_HEADER_SIZE + nameLength));
    if (!name.endsWith("/")) {
      entries.set(name, { name, method, crc32, compressedSize, size, headerOffset, nameLength, extraLength, dataOffset: null });
    }
    p += CENTRAL_HEADER_SIZE + nameLength + extraLength + commentLength;
  }
  return entries;
}

function normalizePath(path) {
  return String(path || "").replace(/\\/g, "/").replace(/^\.?\/+/, "");
}

// Slack read past a local header's name when its extra field length is
// not known yet: covers this format's alignment padding (at most 67 bytes).
const LOCAL_EXTRA_GUESS = 128;

// The entries as one.json gives them (files[path].offset/.length, written
// by writeOneContainer): no need to read the central directory at the end
// of the file. null when a file lacks its offset (another ZIP writer).
function entriesFromManifest(manifest, manifestEntry) {
  const files = manifest?.files;
  if (!files || typeof files !== "object") return null;
  const entries = new Map([[ONE_MANIFEST, manifestEntry]]);
  for (const [name, info] of Object.entries(files)) {
    if (!Number.isInteger(info?.offset) || !Number.isInteger(info?.size)) return null;
    const method = info.compression === "deflate" ? 8 : 0;
    const compressedSize = Number.isInteger(info.length) ? info.length : info.size;
    entries.set(name, { name, method, crc32: null, compressedSize, size: info.size, dataOffset: info.offset });
  }
  return entries;
}

// Opens a container. `inflate(bytes) -> Uint8Array | Promise` reads
// deflated entries (by default the platform's DecompressionStream).
// `directory`: "auto" reads the files' places from one.json when it has
// them (one read before the first part: what a viewer wants), else from
// the central directory; "read" always reads the central directory too
// (and checks one.json against it: what a checking tool wants).
export async function openOneContainer(source, { inflate = platformInflate, directory = "auto" } = {}) {
  // The first read: the local header of one.json and, usually, all of it.
  const head = await source.read(0, Math.min(source.size, HEAD_READ));
  if (!isOneContainer(head)) {
    throw new Error("Not a .one4d file: its first entry is not one.json");
  }
  const hv = view(head);
  const manifestEntry = {
    name: ONE_MANIFEST,
    method: hv.getUint16(8, true),
    crc32: hv.getUint32(14, true),
    compressedSize: hv.getUint32(18, true),
    size: hv.getUint32(22, true),
    headerOffset: 0,
    dataOffset: LOCAL_HEADER_SIZE + hv.getUint16(26, true) + hv.getUint16(28, true),
  };
  // Sizes after the data (flag bit 3): only the central directory knows them.
  const sizesKnown = (hv.getUint16(6, true) & 0x08) === 0;

  let entries = null;
  const decode = async (entry, data) => {
    if (entry.method === 0) return data;
    if (entry.method === 8 && inflate) return inflate(data);
    throw new Error(`${entry.name}: compression method ${entry.method} is not supported`);
  };

  async function readEntry(entry) {
    if (entry.dataOffset == null) {
      // Header and data in one read: the extra field length from the
      // central directory is usually the local one too.
      const guess = LOCAL_HEADER_SIZE + entry.nameLength + Math.max(entry.extraLength || 0, LOCAL_EXTRA_GUESS);
      const chunk = await source.read(entry.headerOffset, Math.min(guess + entry.compressedSize, source.size - entry.headerOffset));
      const v = view(chunk);
      if (v.getUint32(0, true) !== LOCAL_HEADER) throw new Error(`Damaged ZIP entry ${entry.name}`);
      const start = LOCAL_HEADER_SIZE + v.getUint16(26, true) + v.getUint16(28, true);
      entry.dataOffset = entry.headerOffset + start;
      if (start + entry.compressedSize <= chunk.byteLength) return decode(entry, chunk.subarray(start, start + entry.compressedSize));
    }
    return decode(entry, await source.read(entry.dataOffset, entry.compressedSize));
  }

  async function ensureDataOffset(entry) {
    if (entry.dataOffset == null) {
      const header = view(await source.read(entry.headerOffset, LOCAL_HEADER_SIZE));
      if (header.getUint32(0, true) !== LOCAL_HEADER) throw new Error(`Damaged ZIP entry ${entry.name}`);
      entry.dataOffset = entry.headerOffset + LOCAL_HEADER_SIZE + header.getUint16(26, true) + header.getUint16(28, true);
    }
    return entry.dataOffset;
  }

  async function readFile(path) {
    const entry = entries.get(normalizePath(path));
    if (!entry) throw new Error(`${path}: not in the container`);
    return readEntry(entry);
  }

  let manifestBytes;
  if (sizesKnown) {
    const end = manifestEntry.dataOffset + manifestEntry.compressedSize;
    manifestBytes = await decode(manifestEntry, end <= head.byteLength
      ? head.subarray(manifestEntry.dataOffset, end)
      : await source.read(manifestEntry.dataOffset, manifestEntry.compressedSize));
  } else {
    entries = await readCentralDirectory(source);
    manifestBytes = await readFile(ONE_MANIFEST);
  }
  const manifest = JSON.parse(utf8Decoder.decode(manifestBytes));

  const problems = [];
  if (!entries) {
    entries = directory === "auto" ? entriesFromManifest(manifest, manifestEntry) : null;
    if (!entries) {
      entries = await readCentralDirectory(source);
      // one.json's places checked against the central directory.
      for (const [name, info] of Object.entries(manifest.files || {})) {
        const entry = entries.get(name);
        if (!entry || !Number.isInteger(info?.offset)) continue;
        await ensureDataOffset(entry);
        if (entry.dataOffset !== info.offset || entry.compressedSize !== (info.length ?? info.size)) {
          problems.push({ level: "error", message: `files["${name}"]: offset/length in one.json do not match the archive` });
        }
      }
    }
  }
  problems.push(...validateOneManifest(manifest, entries));
  if (problems.some((problem) => problem.level === "error")) {
    throw new Error(`Invalid one.json:\n${problems.map((problem) => `- ${problem.message}`).join("\n")}`);
  }

  return {
    source,
    manifest,
    entries,
    problems,
    has: (path) => entries.has(normalizePath(path)),
    readFile,
    async readText(path) {
      return utf8Decoder.decode(await readFile(path));
    },
    async readJSON(path) {
      return JSON.parse(utf8Decoder.decode(await readFile(path)));
    },
    // Where a part lies in the file: what a Range request or a worker
    // reading the file itself needs.
    async locate(path) {
      const entry = entries.get(normalizePath(path));
      if (!entry) return null;
      return { offset: await ensureDataOffset(entry), length: entry.compressedSize, stored: entry.method === 0 };
    },
    // Checks the SHA-256 the manifest gives a file (files[path].sha256).
    async verify(path) {
      const expected = manifest.files?.[normalizePath(path)]?.sha256;
      if (!expected) return null;
      return (await sha256Hex(await readFile(path))) === expected;
    },
  };
}

// ---------------------------------------------------------------------------
// The manifest

// Problems with a manifest: [{ level: "error" | "warning", message }].
// `entries`, when given, are the container's files (a Map or a Set of
// names), checked against what the manifest refers to.
export function validateOneManifest(manifest, entries = null) {
  const problems = [];
  const error = (message) => problems.push({ level: "error", message });
  const warning = (message) => problems.push({ level: "warning", message });
  const exists = (path) => !entries || entries.has(normalizePath(path));

  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    error("one.json is not a JSON object");
    return problems;
  }
  if (manifest.format !== ONE_FORMAT) error(`format must be "${ONE_FORMAT}"`);
  const [major, minor] = String(manifest.version || "").split(".").map(Number);
  const [ownMajor, ownMinor] = ONE_VERSION.split(".").map(Number);
  if (!Number.isInteger(major)) error("version is missing (\"major.minor\")");
  else if (major > ownMajor) error(`version ${manifest.version} is newer than this reader (${ONE_VERSION})`);
  else if (major === ownMajor && minor > ownMinor) warning(`version ${manifest.version} is newer than this reader (${ONE_VERSION}); unknown fields are skipped`);

  if (manifest.preview != null && !exists(manifest.preview)) error(`preview ${manifest.preview} is not in the container`);
  if (manifest.scene != null && !exists(manifest.scene)) error(`scene ${manifest.scene} is not in the container`);

  const parts = manifest.parts;
  if (!Array.isArray(parts) || !parts.length) {
    error("parts must list at least one part");
    return problems;
  }
  const ids = new Set();
  parts.forEach((part, index) => {
    const label = part?.id ? `part "${part.id}"` : `parts[${index}]`;
    if (!part || typeof part !== "object") {
      error(`${label} is not an object`);
      return;
    }
    if (!part.id) error(`${label} has no id`);
    else if (ids.has(part.id)) error(`${label}: the id is used twice`);
    ids.add(part.id);
    if (!ONE_PART_KINDS.includes(part.kind)) warning(`${label}: kind "${part.kind}" is unknown, the part is skipped`);
    const lods = partLods(part);
    if (!lods.length) error(`${label} has neither path nor lods`);
    lods.forEach((lod) => {
      if (!lod.path) error(`${label}: a level of detail has no path`);
      else if (!exists(lod.path)) error(`${label}: ${lod.path} is not in the container`);
    });
  });
  const timeline = manifest.timeline;
  if (timeline?.stages && Array.isArray(timeline.stages)) {
    timeline.stages.forEach((stage, index) => {
      toList(stage.parts).forEach((id) => {
        if (!ids.has(id)) error(`timeline.stages[${index}] names part "${id}", which is not in parts`);
      });
    });
  }
  return problems;
}

const toList = (value) => (value == null ? [] : Array.isArray(value) ? value : [value]);

// The levels of detail of a part, coarsest first: `lods`, or one level of
// its `path`.
export function partLods(part) {
  if (Array.isArray(part?.lods) && part.lods.length) {
    return part.lods.map((lod) => (typeof lod === "string" ? { path: lod } : lod));
  }
  return part?.path ? [{ path: part.path }] : [];
}

// The part shown when nothing chooses another: role "primary", else the
// first part of a known kind.
export function primaryPart(manifest) {
  const known = (manifest.parts || []).filter((part) => ONE_PART_KINDS.includes(part.kind));
  return known.find((part) => part.role === "primary") || known[0] || null;
}

// The AIM3DViewer.timeline for the parts' timeline: stages naming parts
// get those parts' glTF node names (the root node of each part's model is
// named one-<part id>, see the viewer's .one4d loader).
export function timelineForViewer(manifest) {
  const timeline = manifest?.timeline;
  if (!timeline || typeof timeline !== "object") return null;
  const stages = toList(timeline.stages).map((stage) => {
    const { parts, ...rest } = stage;
    const nodes = [...toList(rest.nodes), ...toList(parts).map((id) => `one-${id}`)];
    return nodes.length ? { ...rest, nodes } : rest;
  });
  return { ...timeline, ...(stages.length ? { stages } : {}) };
}

// ---------------------------------------------------------------------------
// Writing

let crcTable = null;
export function crc32(bytes) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export async function sha256Hex(bytes) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function dosDateTime(date) {
  const year = Math.max(1980, date.getUTCFullYear());
  return {
    time: (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | Math.floor(date.getUTCSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate(),
  };
}

// The order parts are written in: manifest, preview, scene, then each
// part's levels coarsest first (primary part first), then everything else.
export function containerOrder(manifest, paths) {
  const order = [];
  const add = (path) => {
    const clean = normalizePath(path);
    if (clean && paths.includes(clean) && !order.includes(clean)) order.push(clean);
  };
  add(manifest.preview);
  add(manifest.scene);
  const primary = primaryPart(manifest);
  const parts = [primary, ...(manifest.parts || []).filter((part) => part !== primary)].filter(Boolean);
  // Every part's coarsest level before any finer one: something of each
  // part can be shown early.
  const levels = parts.map(partLods);
  const depth = Math.max(0, ...levels.map((lods) => lods.length));
  for (let level = 0; level < depth; level += 1) levels.forEach((lods) => lods[level] && add(lods[level].path));
  [...paths].sort().forEach(add);
  return order;
}

// Formats compressed already: not tried. Others (a GLB without Meshopt or
// Draco, JSON, LAS...) are deflated when it pays (DEFLATE_GAIN).
const COMPRESSED = /\.(laz|spz|sog|rad|png|jpe?g|webp|avif|gif|mp3|ogg|oga|opus|m4a|aac|weba|flac|zip|gz|br|zst)$/i;
// Deflated only when it saves at least this share.
const DEFLATE_GAIN = 0.1;

function layoutOffsets(names, lengths, manifestLength) {
  // Where each entry's data starts, one.json first (see the loop below).
  const offsets = [];
  let offset = 0;
  names.forEach((name, index) => {
    const nameLength = utf8.encode(name).length;
    const base = offset + LOCAL_HEADER_SIZE + nameLength + 4;
    const pad = (ONE_ALIGNMENT - (base % ONE_ALIGNMENT)) % ONE_ALIGNMENT;
    const dataOffset = base + pad;
    offsets.push(dataOffset);
    offset = dataOffset + (index === 0 ? manifestLength : lengths[index]);
  });
  return offsets;
}

// Writes a container. `files`: { path: Uint8Array }, everything but
// one.json; `manifest`: one.json without `files`, which is filled in here:
// each file's size, SHA-256, media type, and where its data lies (offset,
// length, compression), so a reader needs no other read than one.json's to
// reach any part. `deflate(bytes) -> Uint8Array | Promise` (raw DEFLATE:
// platformDeflate, Node's zlib.deflateRawSync), when given, compresses the
// files whose format is not compressed already, when that saves at least
// 10%. Returns { bytes, manifest, problems }.
export async function writeOneContainer(manifest, files, { date = new Date(), mediaTypes = {}, deflate = null } = {}) {
  const paths = Object.keys(files).map(normalizePath);
  const byPath = Object.fromEntries(Object.entries(files).map(([path, data]) => [normalizePath(path), data]));
  const order = containerOrder(manifest, paths);
  const fileInfo = {};
  const stored = {};
  for (const path of order) {
    const data = byPath[path];
    let body = data;
    if (deflate && !COMPRESSED.test(path) && data.byteLength > 256) {
      const packed = await deflate(data);
      if (packed.byteLength <= data.byteLength * (1 - DEFLATE_GAIN)) body = packed;
    }
    stored[path] = body;
    const mediaType = mediaTypes[path] || guessMediaType(path);
    fileInfo[path] = {
      size: data.byteLength,
      sha256: await sha256Hex(data),
      ...(mediaType ? { mediaType } : {}),
      offset: 0,
      ...(body !== data ? { length: body.byteLength, compression: "deflate" } : {}),
    };
  }
  const finalManifest = { ...manifest, files: fileInfo };
  const problems = validateOneManifest(finalManifest, new Set(paths));
  const errors = problems.filter((problem) => problem.level === "error");
  if (errors.length) throw new Error(`Invalid manifest:\n${errors.map((problem) => `- ${problem.message}`).join("\n")}`);

  // The offsets are in one.json, whose length moves them: laid out again
  // until one.json keeps its length (padded with spaces if it got shorter).
  const names = [ONE_MANIFEST, ...order];
  const lengths = [0, ...order.map((path) => stored[path].byteLength)];
  let manifestBytes = null;
  let length = 0;
  for (let pass = 0; pass < 16; pass += 1) {
    const offsets = layoutOffsets(names, lengths, length);
    order.forEach((path, index) => {
      fileInfo[path].offset = offsets[index + 1];
    });
    manifestBytes = utf8.encode(JSON.stringify(finalManifest, null, 2));
    if (manifestBytes.byteLength === length) break;
    if (manifestBytes.byteLength < length) {
      const padded = new Uint8Array(length).fill(0x20);
      padded.set(manifestBytes);
      manifestBytes = padded;
      break;
    }
    length = manifestBytes.byteLength;
  }

  const entries = [
    [ONE_MANIFEST, manifestBytes, manifestBytes],
    ...order.map((path) => [path, byPath[path], stored[path]]),
  ];
  const { time, date: dosDate } = dosDateTime(date);
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const [name, data, body] of entries) {
    const nameBytes = utf8.encode(name);
    const crc = crc32(data);
    const method = body === data ? 0 : 8;
    // Padding so the data starts on ONE_ALIGNMENT (an extra field of at
    // least its 4-byte header).
    const base = offset + LOCAL_HEADER_SIZE + nameBytes.length + 4;
    const pad = (ONE_ALIGNMENT - (base % ONE_ALIGNMENT)) % ONE_ALIGNMENT;
    const extra = new Uint8Array(4 + pad);
    view(extra).setUint16(0, PADDING_EXTRA_ID, true);
    view(extra).setUint16(2, pad, true);
    const header = new Uint8Array(LOCAL_HEADER_SIZE);
    const h = view(header);
    h.setUint32(0, LOCAL_HEADER, true);
    h.setUint16(4, 20, true); // version needed
    h.setUint16(6, 0x0800, true); // UTF-8 names
    h.setUint16(8, method, true);
    h.setUint16(10, time, true);
    h.setUint16(12, dosDate, true);
    h.setUint32(14, crc, true);
    h.setUint32(18, body.byteLength, true);
    h.setUint32(22, data.byteLength, true);
    h.setUint16(26, nameBytes.length, true);
    h.setUint16(28, extra.length, true);
    chunks.push(header, nameBytes, extra, body);
    central.push({ nameBytes, crc, method, compressedSize: body.byteLength, size: data.byteLength, offset });
    if (name !== ONE_MANIFEST && fileInfo[name].offset !== base + pad) throw new Error(`Layout error at ${name}`);
    offset += header.length + nameBytes.length + extra.length + body.byteLength;
    if (offset > 0xffffffff) throw new Error("The container would be over 4 GB (ZIP64 is not supported by this version)");
  }
  const cdOffset = offset;
  for (const entry of central) {
    const record = new Uint8Array(CENTRAL_HEADER_SIZE);
    const r = view(record);
    r.setUint32(0, CENTRAL_HEADER, true);
    r.setUint16(4, 20, true); // made by
    r.setUint16(6, 20, true); // needed
    r.setUint16(8, 0x0800, true);
    r.setUint16(10, entry.method, true);
    r.setUint16(12, time, true);
    r.setUint16(14, dosDate, true);
    r.setUint32(16, entry.crc, true);
    r.setUint32(20, entry.compressedSize, true);
    r.setUint32(24, entry.size, true);
    r.setUint16(28, entry.nameBytes.length, true);
    r.setUint32(42, entry.offset, true);
    chunks.push(record, entry.nameBytes);
    offset += record.length + entry.nameBytes.length;
  }
  const end = new Uint8Array(END_SIZE);
  const e = view(end);
  e.setUint32(0, END_OF_CENTRAL, true);
  e.setUint16(8, central.length, true);
  e.setUint16(10, central.length, true);
  e.setUint32(12, offset - cdOffset, true);
  e.setUint32(16, cdOffset, true);
  chunks.push(end);
  offset += END_SIZE;

  const out = new Uint8Array(offset);
  let p = 0;
  chunks.forEach((chunk) => {
    out.set(chunk, p);
    p += chunk.byteLength;
  });
  return { bytes: out, manifest: finalManifest, problems };
}

const MEDIA_TYPES = {
  glb: "model/gltf-binary",
  gltf: "model/gltf+json",
  las: "application/vnd.las",
  laz: "application/vnd.laszip",
  spz: "application/octet-stream",
  ply: "application/octet-stream",
  ktx2: "image/ktx2",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  avif: "image/avif",
  json: "application/json",
  jsonld: "application/ld+json",
  wav: "audio/wav",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  flac: "audio/flac",
  txt: "text/plain",
  md: "text/markdown",
};

export function guessMediaType(path) {
  return MEDIA_TYPES[String(path).split(".").pop().toLowerCase()] || null;
}
