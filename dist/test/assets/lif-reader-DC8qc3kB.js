// Leica .lif image stacks read in the browser, without the worker: the same
// steps as worker/lif.py, so a .lif opened from the disk (or from a server
// with range requests) is shown by volume.js like a converted one.
//
// Only what is needed is read, never the whole file: the header (the XML
// project tree), the small header of each memory block (to find where the
// data of each series starts), then the voxels of the stack shown, a few
// tens of MB at a time - File.slice() for a local file, HTTP Range for a URL
// (a server without ranges sends the whole file once, kept in memory).
//
// openLif() reads the project (main thread: the XML needs DOMParser) and
// returns a manifest of the same shape as the worker's (.dfgvol); the voxels
// of a stack are read, averaged down to MAX_SIZE voxels per axis and mapped
// to 8 bits in a Web Worker (lif-volume-worker.js), on the main thread
// where module workers do not start.

const MAX_SIZE = 512;
const HEADER_MAGIC = 0x70;
const BLOCK_MARK = 0x2a;
// Largest piece read at once.
const CHUNK_BYTES = 32 * 1024 * 1024;
const LOW_PERCENTILE = 0.1;
const HIGH_PERCENTILE = 99.95;

const DIM_X = 1;
const DIM_Y = 2;
const DIM_Z = 3;
const DIM_T = 4;
const DIM_TILE = 10;

const LUT_COLORS = {
  red: "#ff0000", green: "#00ff00", blue: "#0000ff", cyan: "#00ffff",
  magenta: "#ff00ff", yellow: "#ffff00", gray: "#ffffff", grey: "#ffffff",
};
const UNIT_TO_MICRONS = { m: 1e6, mm: 1e3, um: 1, "µm": 1, nm: 1e-3 };
// Windows FILETIME (100 ns since 1601) -> Unix milliseconds.
const FILETIME_UNIX_MS = 11644473600000n;

// Reading bytes: { size, read(offset, length) -> Uint8Array } over a File /
// Blob or a URL. A plain { file } or { url } is what the Web Worker gets.
function createByteSource(source) {
  if (source.file) {
    const file = source.file;
    return {
      size: file.size,
      async read(offset, length) {
        return new Uint8Array(await file.slice(offset, offset + length).arrayBuffer());
      },
    };
  }
  let whole = null;
  const byteSource = {
    size: null,
    async read(offset, length) {
      if (whole) return whole.subarray(offset, offset + length);
      const response = await fetch(source.url, { headers: { Range: `bytes=${offset}-${offset + length - 1}` } });
      if (!response.ok) throw new Error(`${source.url}: HTTP ${response.status}`);
      if (response.status === 206) {
        const total = Number(response.headers.get("Content-Range")?.split("/")[1]);
        if (Number.isFinite(total)) byteSource.size = total;
        return new Uint8Array(await response.arrayBuffer());
      }
      // No range support: the whole file, once.
      whole = new Uint8Array(await response.arrayBuffer());
      byteSource.size = whole.length;
      return whole.subarray(offset, offset + length);
    },
  };
  return byteSource;
}

// The XML and { block id: { offset, size } } of the data blocks.
async function readLifHeader(byteSource) {
  const head = await byteSource.read(0, 13);
  const view = new DataView(head.buffer, head.byteOffset, head.byteLength);
  if (head.length < 13 || view.getUint32(0, true) !== HEADER_MAGIC || head[8] !== BLOCK_MARK) {
    throw new Error("Not a Leica LIF file");
  }
  const chars = view.getUint32(9, true);
  const xml = new TextDecoder("utf-16le").decode(await byteSource.read(13, chars * 2));
  // Version 1 has 32-bit block sizes, version 2 64-bit.
  const wide = Number(/<LMSDataContainerHeader[^>]*\bVersion="(\d+)"/.exec(xml.slice(0, 200))?.[1] ?? 2) >= 2;
  const blocks = {};
  let at = 13 + chars * 2;
  // The size is known for a File, and for a URL from its first range
  // response; without it, blocks are read until one is missing.
  while (byteSource.size == null || at + 22 <= byteSource.size) {
    let bytes = await byteSource.read(at, 256);
    if (bytes.length < 22) break;
    let data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (data.getUint32(0, true) !== HEADER_MAGIC) {
      if (byteSource.size == null) break;
      throw new Error(`Damaged LIF memory block at byte ${at}`);
    }
    const blockSize = wide ? Number(data.getBigUint64(9, true)) : data.getUint32(9, true);
    const idCharsAt = wide ? 18 : 14;
    const headerLength = idCharsAt + 4 + data.getUint32(idCharsAt, true) * 2;
    if (headerLength > bytes.length) {
      bytes = await byteSource.read(at, headerLength);
      data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    }
    const id = new TextDecoder("utf-16le").decode(bytes.subarray(idCharsAt + 4, headerLength));
    blocks[id] = { offset: at + headerLength, size: blockSize };
    at += headerLength + blockSize;
  }
  return { xml, blocks };
}

// Reading the project tree (main thread).

const children = (element, tag) => Array.from(element?.children || []).filter((child) => child.tagName === tag);
const child = (element, tag) => children(element, tag)[0] || null;
const number = (value, fallback = 0) => (Number.isFinite(Number(value)) && value !== null && value !== "" ? Number(value) : fallback);

function channelName(channel, index) {
  const properties = {};
  children(channel, "ChannelProperty").forEach((property) => {
    properties[child(property, "Key")?.textContent] = (child(property, "Value")?.textContent || "").trim();
  });
  const lut = channel.getAttribute("LUTName") || "";
  const name = properties.DyeName || properties.DetectorName;
  return name && lut ? `${name} (${lut})` : name || lut || `Channel ${index + 1}`;
}

function acquisition(image) {
  const info = {};
  const setting = image.querySelector("ATLConfocalSettingDefinition") || image.querySelector("ATLCameraSettingDefinition");
  if (setting) {
    const objective = (setting.getAttribute("ObjectiveName") || "").replace(/\s+/g, " ").trim();
    if (objective) info.objective = objective;
    if (setting.getAttribute("NumericalAperture")) info.numericalAperture = number(setting.getAttribute("NumericalAperture"));
    if (setting.getAttribute("Immersion")) info.immersion = setting.getAttribute("Immersion").trim();
    if (setting.getAttribute("Zoom")) info.zoom = number(setting.getAttribute("Zoom"));
    if (setting.getAttribute("PinholeAiry")) info.pinholeAiry = Math.round(number(setting.getAttribute("PinholeAiry")) * 1000) / 1000;
  }
  const hardware = children(image, "Attachment").find((element) => element.getAttribute("Name") === "HardwareSetting");
  if (hardware?.getAttribute("SystemTypeName")) info.system = hardware.getAttribute("SystemTypeName");
  const stand = image.querySelector("[MicroscopeModel]")?.getAttribute("MicroscopeModel");
  if (stand && stand !== "1") info.stand = stand;
  const lasers = new Set();
  image.querySelectorAll("LaserLineSetting").forEach((line) => {
    if (number(line.getAttribute("IntensityDev")) > 0) lasers.add(Math.round(number(line.getAttribute("LaserLine"))));
  });
  if (lasers.size) info.laserLinesNm = [...lasers].sort((a, b) => a - b);
  const first = (child(image, "TimeStampList")?.textContent || "").trim().split(/\s+/)[0];
  if (first && /^[0-9a-f]+$/i.test(first)) {
    const ms = BigInt(`0x${first}`) / 10000n - FILETIME_UNIX_MS;
    const when = new Date(Number(ms));
    if (!Number.isNaN(when.getTime())) info.acquired = when.toISOString().replace(/\.\d+Z$/, "Z");
  }
  return info;
}

function skipReason(dims, channels, size) {
  if (!size || !channels.length) return "no image data";
  if (!dims[DIM_X] || !dims[DIM_Y]) return "not an image";
  if ((dims[DIM_TILE]?.count || 1) > 1) return "mosaic of separate tiles (open the merged image instead)";
  if ((dims[DIM_Z]?.count || 1) < 2) return "a single plane, not a stack";
  if (channels.some((channel) => channel.float)) return "floating-point data";
  return null;
}

function voxelSize(dim) {
  if (dim.count < 2) return 1;
  const scale = UNIT_TO_MICRONS[dim.unit.toLowerCase().replace("μ", "µ")] ?? 1;
  const size = (dim.length / (dim.count - 1)) * scale;
  return size > 0 ? size : 1;
}

// The manifest (as worker/lif.py writes it) of the project in `xml`; each
// stack also carries its `layout` for readSeriesVolume().
function describeLif(xml, blocks, fileName, maxSize = MAX_SIZE) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("The LIF header is not readable XML");
  const manifest = { format: "dfg-volume", version: 1, source: fileName, series: [], skipped: [] };
  const taken = new Set();

  const walk = (element, path) => {
    const elements = path ? children(child(element, "Children"), "Element") : children(element, "Element");
    elements.forEach((item) => {
      const name = item.getAttribute("Name") || "?";
      const itemPath = path ? `${path}/${name}` : name;
      const image = child(child(item, "Data"), "Image");
      const description = child(image, "ImageDescription");
      const block = blocks[child(item, "Memory")?.getAttribute("MemoryBlockID")];
      if (description && block) {
        const dims = {};
        children(child(description, "Dimensions"), "DimensionDescription").forEach((d) => {
          dims[number(d.getAttribute("DimID"))] = {
            count: number(d.getAttribute("NumberOfElements"), 1),
            length: Math.abs(number(d.getAttribute("Length"))),
            unit: d.getAttribute("Unit") || "",
            stride: number(d.getAttribute("BytesInc")),
          };
        });
        const channels = children(child(description, "Channels"), "ChannelDescription").map((c, i) => ({
          name: channelName(c, i),
          lut: c.getAttribute("LUTName") || "",
          bits: number(c.getAttribute("Resolution"), 8),
          float: c.getAttribute("DataType") === "1",
          offset: number(c.getAttribute("BytesInc")),
        }));
        const reason = skipReason(dims, channels, block.size);
        if (reason) {
          manifest.skipped.push({ name, path: itemPath, reason });
        } else {
          const shape = [DIM_Z, DIM_Y, DIM_X].map((d) => dims[d].count);
          const factors = shape.map((n) => Math.max(1, Math.ceil(n / maxSize)));
          const [nz, ny, nx] = shape.map((n, i) => Math.ceil(n / factors[i]));
          let id = name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "series";
          for (let k = 2; taken.has(id); k += 1) id = `${id.replace(/-\d+$/, "")}-${k}`;
          taken.add(id);
          manifest.series.push({
            id,
            name,
            path: itemPath,
            dims: [nx, ny, nz],
            sourceDims: [shape[2], shape[1], shape[0]],
            voxelSize: [[DIM_X, 2], [DIM_Y, 1], [DIM_Z, 0]].map(([d, i]) => Number((voxelSize(dims[d]) * factors[i]).toFixed(6))),
            unit: "µm",
            frames: dims[DIM_T]?.count || 1,
            channels: channels.map((c) => ({ name: c.name, color: LUT_COLORS[c.lut.toLowerCase()] || "#ffffff", bits: c.bits })),
            acquisition: acquisition(image),
            layout: {
              offset: block.offset,
              size: block.size,
              shape,
              strides: [DIM_Z, DIM_Y, DIM_X].map((d) => dims[d].stride),
              factors,
              channels: channels.map((c) => ({ offset: c.offset, itemSize: c.bits <= 8 ? 1 : 2 })),
            },
          });
        }
      }
      walk(item, itemPath);
    });
  };
  walk(doc.documentElement, "");
  if (!manifest.series.length) {
    const reasons = manifest.skipped.slice(0, 5).map((s) => `${s.name}: ${s.reason}`).join("; ");
    throw new Error(`No image stack (Z series) in ${fileName} to show in 3D${reasons ? ` (${reasons})` : ""}`);
  }
  // The deepest stack first: the one shown.
  manifest.series.sort((a, b) => b.sourceDims[2] - a.sourceDims[2]);
  return manifest;
}

// Reading a stack (Web Worker or main thread).

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

// The 8-bit voxels of one stack (channel by channel, x fastest), with each
// channel's value range and Otsu threshold. Like worker/lif.py: block means
// by the layout's factors, mapped between the 0.1 and 99.95 percentiles.
async function readSeriesVolume(byteSource, layout, { onProgress } = {}) {
  const [nz, ny, nx] = layout.shape;
  const [sz, sy, sx] = layout.strides;
  const [fz, fy, fx] = layout.factors;
  const oz = Math.ceil(nz / fz);
  const oy = Math.ceil(ny / fy);
  const ox = Math.ceil(nx / fx);
  const voxels = ox * oy * oz;
  const out = new Uint8Array(voxels * layout.channels.length);
  const channels = [];
  // Voxels of the source per output voxel in x and y (smaller at the edges).
  const cellCount = new Float32Array(oy * ox);
  for (let y = 0; y < ny; y += 1) {
    for (let x = 0; x < nx; x += 1) cellCount[Math.floor(y / fy) * ox + Math.floor(x / fx)] += 1;
  }
  const planeSpan = (ny - 1) * sy + (nx - 1) * sx;
  const totalPlanes = nz * layout.channels.length;
  let planesDone = 0;

  for (let c = 0; c < layout.channels.length; c += 1) {
    const { offset: channelOffset, itemSize } = layout.channels[c];
    const base = layout.offset + channelOffset;
    const end = layout.offset + layout.size;
    if (base + (nz - 1) * sz + planeSpan + itemSize > end) throw new Error("The stack's data is shorter than its dimensions");
    // Means kept at the source's precision until the window is known.
    const means = itemSize === 1 ? new Uint8Array(voxels) : new Uint16Array(voxels);
    const histogram = new Float64Array(itemSize === 1 ? 256 : 65536);
    const sums = new Float32Array(oy * ox);
    // Output planes in pieces of whole slabs (fz source planes) of at most CHUNK_BYTES.
    const slabsPerRead = Math.max(1, Math.floor(CHUNK_BYTES / Math.max(1, sz * fz)));
    for (let k0 = 0; k0 < oz; k0 += slabsPerRead) {
      const k1 = Math.min(oz, k0 + slabsPerRead);
      const z0 = k0 * fz;
      const z1 = Math.min(nz, k1 * fz);
      const readStart = base + z0 * sz;
      const bytes = await byteSource.read(readStart, (z1 - 1 - z0) * sz + planeSpan + itemSize);
      for (let k = k0; k < k1; k += 1) {
        sums.fill(0);
        const zStart = k * fz;
        const zEnd = Math.min(nz, zStart + fz);
        for (let z = zStart; z < zEnd; z += 1) {
          const planeAt = (z - z0) * sz;
          for (let y = 0; y < ny; y += 1) {
            const rowAt = planeAt + y * sy;
            const cellRow = Math.floor(y / fy) * ox;
            if (itemSize === 1) {
              for (let x = 0; x < nx; x += 1) sums[cellRow + Math.floor(x / fx)] += bytes[rowAt + x * sx];
            } else {
              for (let x = 0; x < nx; x += 1) {
                const at = rowAt + x * sx;
                sums[cellRow + Math.floor(x / fx)] += bytes[at] | (bytes[at + 1] << 8);
              }
            }
          }
        }
        const depth = zEnd - zStart;
        const planeOut = k * oy * ox;
        for (let i = 0; i < oy * ox; i += 1) {
          const value = Math.round(sums[i] / (cellCount[i] * depth));
          means[planeOut + i] = value;
          histogram[value] += 1;
        }
      }
      planesDone += z1 - z0;
      onProgress?.({ loaded: planesDone, total: totalPlanes });
    }
    const low = percentileOf(histogram, voxels, LOW_PERCENTILE);
    let high = percentileOf(histogram, voxels, HIGH_PERCENTILE);
    if (high <= low) high = low + 1;
    const scale = 255 / (high - low);
    const target = out.subarray(c * voxels, (c + 1) * voxels);
    const bytesHistogram = new Float64Array(256);
    for (let i = 0; i < voxels; i += 1) {
      const value = Math.min(255, Math.max(0, Math.round((means[i] - low) * scale)));
      target[i] = value;
      bytesHistogram[value] += 1;
    }
    channels.push({ range: [low, high], threshold: otsu(bytesHistogram) });
  }
  return { bytes: out, channels };
}

// Reads a stack in a Web Worker (lif-volume-worker.js), or here when module
// workers do not start.
function readInWorker(source, layout, onProgress) {
  return new Promise((resolve, reject) => {
    const onMainThread = () => readSeriesVolume(createByteSource(source), layout, { onProgress }).then(resolve, reject);
    let worker;
    try {
      worker = new Worker(new URL(new URL('lif-volume-worker-lKV1fb_z.js', import.meta.url).href), { type: "module" });
    } catch {
      onMainThread();
      return;
    }
    let started = false;
    worker.onmessage = ({ data }) => {
      if (data?.type === "ready") {
        started = true;
        worker.postMessage({ source, layout });
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
      if (!started) onMainThread();
      else reject(new Error(event.message || "LIF reader failed"));
    };
  });
}

// A .lif from a File/Blob ({ file }) or a URL ({ url }): its manifest, and
// loadSeries(index) for the voxels of a stack (filling in the stack's
// channel ranges and thresholds).
async function openLif(source, fileName) {
  const { xml, blocks } = await readLifHeader(createByteSource(source));
  const manifest = describeLif(xml, blocks, fileName);
  return {
    manifest,
    async loadSeries(index, { onProgress } = {}) {
      const series = manifest.series[index];
      const result = await readInWorker(source, series.layout, onProgress);
      result.channels.forEach((channel, c) => Object.assign(series.channels[c], channel));
      return result.bytes;
    },
  };
}

export { MAX_SIZE, createByteSource, describeLif, openLif, readLifHeader, readSeriesVolume };
//# sourceMappingURL=lif-reader-At2Q6Oqv.js.map
