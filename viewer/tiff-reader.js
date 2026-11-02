import { addDecoder, fromBlob, fromUrl } from "geotiff";
import LzwDecoder from "./tiff-lzw.js";
import { cellCounts, finishChannel, runVolumeWorker } from "./volume-voxels.js";

// geotiff.js's LZW decoder fails on full code tables (tiff-lzw.js).
addDecoder(5, async () => LzwDecoder);

// TIFF image stacks read in the browser, without the worker - the same
// files as worker/tiff_stack.py: multi-page TIFFs, ImageJ hyperstacks,
// OME-TIFF, and slices one file each (a .zip of them, unpacked by
// extract-helper.js). Decoded by geotiff.js (all compressions, BigTIFF,
// tiles), a page at a time: from the File, or by HTTP range requests.
//
// openTiff() reads the first page's description (main thread: OME-XML
// needs DOMParser) and returns a manifest of the same shape as the worker's;
// the pages of a stack are read, averaged down to MAX_SIZE voxels per axis
// and mapped to 8 bits in a Web Worker (tiff-volume-worker.js).
//
// Pixel types: 8/16-bit integers are kept as they are, signed 16-bit (CT
// in Hounsfield units) shifted; 32-bit and float values are scaled between
// the minimum and maximum of a sample of pages, NaN as the lowest.

export const MAX_SIZE = 512;
const SAMPLE_PAGES = 16;
const PALETTE = ["#00ff00", "#ff00ff", "#00ffff", "#ffff00", "#ff0000", "#0000ff"];
const UNIT_TO_MICRONS = { m: 1e6, cm: 1e4, mm: 1e3, um: 1, "µm": 1, micron: 1, microns: 1, nm: 1e-3 };
const RESOLUTION_CENTIMETER = 3;
const FORMAT_INT = 2;
const FORMAT_FLOAT = 3;

const micronsPer = (unit) => (unit ? UNIT_TO_MICRONS[String(unit).trim().toLowerCase().replace("μ", "µ").replace("\\u00b5", "µ")] ?? null : null);
const defaultColors = (count) => (count === 1 ? ["#ffffff"] : Array.from({ length: count }, (_v, i) => PALETTE[i % PALETTE.length]));
const naturalKey = (name) => name.toLowerCase().split(/(\d+)/).map((part) => (/^\d+$/.test(part) ? part.padStart(12, "0") : part)).join("");

function openTiffSource(source) {
  return source.file ? fromBlob(source.file) : fromUrl(source.url);
}

function rational(value) {
  if (Array.isArray(value) || ArrayBuffer.isView(value)) return value[1] ? value[0] / value[1] : 0;
  return Number(value) || 0;
}

// µm per pixel in x and y from the page's resolution, in `unitScale` µm per
// unit (ImageJ), else only for a resolution in centimetres (inches are
// usually a meaningless 72 dpi).
async function resolutionSize(image, unitScale = null) {
  const directory = image.fileDirectory;
  const x = rational(await directory.loadValue("XResolution"));
  const y = rational(await directory.loadValue("YResolution"));
  if (!(x > 0) || !(y > 0)) return null;
  if (unitScale) return [unitScale / x, unitScale / y];
  if (Number(await directory.loadValue("ResolutionUnit")) !== RESOLUTION_CENTIMETER) return null;
  return [1e4 / x, 1e4 / y];
}

function voxel(xy, z) {
  if (xy && xy[0] > 0 && xy[1] > 0) return { voxelSize: [xy[0], xy[1], z > 0 ? z : xy[0]], unit: "µm" };
  return { voxelSize: [1, 1, 1], unit: "px" };
}

function imagejInfo(description) {
  const info = {};
  description.split(/\r?\n/).forEach((line) => {
    const at = line.indexOf("=");
    if (at > 0) info[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  });
  return info;
}

// The images of an OME-XML: sizes, page order, voxel size, channels.
function omeImages(xml) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) return [];
  const byLocalName = (root, name) => Array.from(root.getElementsByTagNameNS("*", name));
  const instruments = new Map(byLocalName(doc, "Instrument").map((i) => [i.getAttribute("ID"), i]));
  let firstPage = 0;
  return byLocalName(doc, "Image").map((image) => {
    const pixels = byLocalName(image, "Pixels")[0];
    if (!pixels) return null;
    const size = (axis) => Number(pixels.getAttribute(`Size${axis}`)) || 1;
    const physical = (axis) => {
      const value = Number(pixels.getAttribute(`PhysicalSize${axis}`));
      const scale = micronsPer(pixels.getAttribute(`PhysicalSize${axis}Unit`) || "µm");
      return value > 0 && scale ? value * scale : null;
    };
    const channels = byLocalName(pixels, "Channel").map((channel) => {
      const raw = channel.getAttribute("Color");
      let color = null;
      if (raw !== null) {
        const rgba = Number(raw) >>> 0;
        color = `#${[24, 16, 8].map((shift) => ((rgba >>> shift) & 255).toString(16).padStart(2, "0")).join("")}`;
        if (color === "#000000") color = null;
      }
      return { name: channel.getAttribute("Name") || channel.getAttribute("Fluor") || "", color };
    });
    // The image's first page: its TiffData's IFD, else after the previous image.
    const ifd = byLocalName(pixels, "TiffData")[0]?.getAttribute("IFD");
    const start = ifd != null ? Number(ifd) : firstPage;
    const counts = { Z: size("Z"), C: size("C"), T: size("T") };
    firstPage = start + counts.Z * counts.C * counts.T;
    const acquisition = {};
    const date = byLocalName(image, "AcquisitionDate")[0]?.textContent;
    if (date) acquisition.acquired = date;
    const instrument = instruments.get(byLocalName(image, "InstrumentRef")[0]?.getAttribute("ID"));
    if (instrument) {
      const objective = byLocalName(instrument, "Objective")[0];
      const name = [objective?.getAttribute("Manufacturer"), objective?.getAttribute("Model")].filter(Boolean).join(" ");
      if (name) acquisition.objective = name;
      if (objective?.getAttribute("LensNA")) acquisition.numericalAperture = Number(objective.getAttribute("LensNA"));
      const microscope = byLocalName(instrument, "Microscope")[0];
      const system = [microscope?.getAttribute("Manufacturer"), microscope?.getAttribute("Model")].filter(Boolean).join(" ");
      if (system) acquisition.system = system;
    }
    return {
      name: image.getAttribute("Name") || "",
      counts,
      // "XYZCT" -> Z fastest, then C, then T.
      order: (pixels.getAttribute("DimensionOrder") || "XYZCT").slice(2),
      start,
      xy: [physical("X"), physical("Y")],
      z: physical("Z"),
      channels,
      acquisition,
    };
  }).filter(Boolean);
}

// Page of (z, c) when the pages run in `order` (e.g. "ZCT") over counts.
function pageLayout(order, counts, start) {
  const steps = {};
  let step = 1;
  for (const axis of order) {
    steps[axis] = step;
    step *= counts[axis] || 1;
  }
  return { start, zStep: steps.Z || 1, cStep: steps.C || 0 };
}

function series({ name, nx, ny, nz, channels, voxelSize, unit, frames = 1, acquisition = {}, layout }) {
  const factors = [nz, ny, nx].map((n) => Math.max(1, Math.ceil(n / MAX_SIZE)));
  const [oz, oy, ox] = [nz, ny, nx].map((n, i) => Math.ceil(n / factors[i]));
  return {
    id: name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "stack",
    name,
    path: name,
    dims: [ox, oy, oz],
    sourceDims: [nx, ny, nz],
    voxelSize: voxelSize.map((v, i) => Number((v * factors[2 - i]).toPrecision(6))),
    unit,
    frames,
    channels,
    acquisition,
    layout: { ...layout, shape: [nz, ny, nx], factors },
  };
}

// The manifest of the TIFF in source ({ file } or { url }); `siblings` are
// the other files unpacked from the same archive, for a stack of slices.
export async function describeTiff(source, fileName, siblings = null) {
  const tiff = await openTiffSource(source);
  const image = await tiff.getImage(0);
  const nx = image.getWidth();
  const ny = image.getHeight();
  const samples = image.getSamplesPerPixel();
  const pixel = { format: image.getSampleFormat(), bits: image.getBitsPerSample() };
  if (pixel.format === FORMAT_FLOAT && pixel.bits === 16) throw new Error("16-bit float TIFFs are not supported");
  // Writers end it with a NUL, which DOMParser refuses.
  const description = String((await image.fileDirectory.loadValue("ImageDescription")) || "").replace(/\0+$/, "");
  const base = fileName.replace(/\.ome\.tiff?$|\.tiff?$/i, "");
  const manifest = { format: "dfg-volume", version: 1, source: fileName, series: [], skipped: [] };
  const channelList = (count, meta = [], fallback = base) => {
    const colors = defaultColors(count);
    return Array.from({ length: count }, (_v, c) => ({
      name: meta[c]?.name || (count > 1 ? `Channel ${c + 1}` : fallback),
      color: meta[c]?.color || colors[c],
      bits: pixel.bits,
    }));
  };

  if (description.includes("<OME")) {
    omeImages(description).forEach((ome, index) => {
      const name = ome.name || (index ? `${base} ${index + 1}` : base);
      if (ome.counts.Z < 2) {
        manifest.skipped.push({ name, path: name, reason: "a single plane, not a stack" });
        return;
      }
      const channelCount = samples > 1 ? samples : ome.counts.C;
      const pages = pageLayout(ome.order, ome.counts, ome.start);
      manifest.series.push(series({
        name,
        nx,
        ny,
        nz: ome.counts.Z,
        channels: channelList(channelCount, ome.channels, name),
        ...voxel(ome.xy, ome.z),
        frames: ome.counts.T,
        acquisition: ome.acquisition,
        layout: {
          pixel,
          channels: Array.from({ length: channelCount }, (_v, c) => (
            samples > 1 ? { start: pages.start, sample: c } : { start: pages.start + c * pages.cStep, sample: 0 }
          )),
          zStep: pages.zStep,
        },
      }));
    });
  } else if (description.startsWith("ImageJ=")) {
    const info = imagejInfo(description);
    const channels = Number(info.channels) || 1;
    const frames = Number(info.frames) || 1;
    const slices = Number(info.slices) || Math.floor((Number(info.images) || 1) / (channels * frames));
    const scale = micronsPer(info.unit);
    if (slices < 2) {
      manifest.skipped.push({ name: base, path: base, reason: "a single plane, not a stack" });
    } else {
      const channelCount = samples > 1 ? samples : channels;
      manifest.series.push(series({
        name: base,
        nx,
        ny,
        nz: slices,
        channels: channelList(channelCount),
        ...voxel(scale ? await resolutionSize(image, scale) : null, scale && Number(info.spacing) ? Number(info.spacing) * scale : null),
        frames,
        // Hyperstack pages: channel fastest, then slice, then frame.
        layout: {
          pixel,
          channels: Array.from({ length: channelCount }, (_v, c) => (samples > 1 ? { start: 0, sample: c } : { start: c, sample: 0 })),
          zStep: samples > 1 ? 1 : channels,
        },
      }));
    }
  } else {
    const count = await tiff.getImageCount();
    const slices = count === 1 && siblings
      ? siblings
        .filter((file) => /\.tiff?$/i.test(file.name) && file.name.replace(/[^/]*$/, "") === fileName.replace(/[^/]*$/, ""))
        .sort((a, b) => naturalKey(a.name).localeCompare(naturalKey(b.name)))
      : null;
    const xy = await resolutionSize(image);
    if (slices && slices.length >= 2) {
      const folder = fileName.split("/").slice(-2, -1)[0] || base;
      manifest.series.push(series({
        name: folder,
        nx,
        ny,
        nz: slices.length,
        channels: channelList(samples, [], folder),
        ...voxel(xy, null),
        layout: { pixel, slices: true, channels: Array.from({ length: samples }, (_v, c) => ({ start: 0, sample: c })), zStep: 1 },
      }));
      manifest.slices = slices;
    } else if (count < 2) {
      manifest.skipped.push({ name: base, path: base, reason: "a single plane, not a stack" });
    } else {
      manifest.series.push(series({
        name: base,
        nx,
        ny,
        nz: count,
        channels: channelList(samples),
        ...voxel(xy, null),
        layout: { pixel, channels: Array.from({ length: samples }, (_v, c) => ({ start: 0, sample: c })), zStep: 1 },
      }));
    }
  }
  if (!manifest.series.length) {
    const reasons = manifest.skipped.slice(0, 5).map((s) => `${s.name}: ${s.reason}`).join("; ");
    throw new Error(`No image stack (Z series) in ${fileName} to show in 3D${reasons ? ` (${reasons})` : ""}`);
  }
  manifest.series.sort((a, b) => b.sourceDims[2] - a.sourceDims[2]);
  return manifest;
}

// Reading a stack (Web Worker or main thread).

// The value -> level (0..levels-1) mapping of a channel, and back.
async function levelsFor(pixel, readPlane, nz) {
  if (pixel.format !== FORMAT_FLOAT && pixel.bits <= 8) {
    const shift = pixel.format === FORMAT_INT ? 128 : 0;
    return { levels: 256, toLevel: (v) => v + shift, toValue: (l) => l - shift };
  }
  if (pixel.format !== FORMAT_FLOAT && pixel.bits === 16) {
    const shift = pixel.format === FORMAT_INT ? 32768 : 0;
    return { levels: 65536, toLevel: (v) => v + shift, toValue: (l) => l - shift };
  }
  // 32-bit and float: between the extremes of a sample of planes.
  let min = Infinity;
  let max = -Infinity;
  const step = Math.max(1, Math.floor(nz / SAMPLE_PAGES));
  for (let z = 0; z < nz; z += step) {
    const plane = await readPlane(z);
    for (let i = 0; i < plane.length; i += 1) {
      const v = plane[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (!(max > min)) max = min + 1;
  const scale = 65535 / (max - min);
  return {
    levels: 65536,
    toLevel: (v) => (Number.isNaN(v) ? 0 : Math.min(65535, Math.max(0, (v - min) * scale))),
    toValue: (l) => Math.round((min + l / scale) * 1000) / 1000,
  };
}

// The 8-bit voxels of one stack (channel by channel, x fastest), with each
// channel's value range (in the file's units) and Otsu threshold.
export async function readTiffVolume(source, layout, { onProgress } = {}) {
  const [nz, ny, nx] = layout.shape;
  const [fz, fy, fx] = layout.factors;
  const oz = Math.ceil(nz / fz);
  const oy = Math.ceil(ny / fy);
  const ox = Math.ceil(nx / fx);
  const voxels = ox * oy * oz;
  const out = new Uint8Array(voxels * layout.channels.length);
  const cellCount = cellCounts(ny, nx, fy, fx);
  const tiffs = layout.slices
    ? await Promise.all(source.slices.map((file) => fromBlob(file)))
    : [await openTiffSource(source)];
  const channels = [];
  let planesDone = 0;

  for (let c = 0; c < layout.channels.length; c += 1) {
    const { start, sample } = layout.channels[c];
    const readPlane = async (z) => {
      const image = layout.slices
        ? await tiffs[z].getImage(0)
        : await tiffs[0].getImage(start + z * layout.zStep);
      return (await image.readRasters({ samples: [sample] }))[0];
    };
    const { levels, toLevel, toValue } = await levelsFor(layout.pixel, readPlane, nz);
    const means = levels === 256 ? new Uint8Array(voxels) : new Uint16Array(voxels);
    const histogram = new Float64Array(levels);
    const sums = new Float32Array(oy * ox);
    for (let k = 0; k < oz; k += 1) {
      sums.fill(0);
      const zEnd = Math.min(nz, (k + 1) * fz);
      for (let z = k * fz; z < zEnd; z += 1) {
        const plane = await readPlane(z);
        for (let y = 0; y < ny; y += 1) {
          const row = y * nx;
          const cellRow = Math.floor(y / fy) * ox;
          for (let x = 0; x < nx; x += 1) sums[cellRow + Math.floor(x / fx)] += toLevel(plane[row + x]);
        }
        planesDone += 1;
        onProgress?.({ loaded: planesDone, total: nz * layout.channels.length });
      }
      const depth = zEnd - k * fz;
      const planeOut = k * oy * ox;
      for (let i = 0; i < oy * ox; i += 1) {
        const value = Math.round(sums[i] / (cellCount[i] * depth));
        means[planeOut + i] = value;
        histogram[value] += 1;
      }
    }
    const { low, high, threshold } = finishChannel(means, histogram, out.subarray(c * voxels, (c + 1) * voxels));
    channels.push({ range: [toValue(low), toValue(high)], threshold });
  }
  return { bytes: out, channels };
}

// A TIFF from a File/Blob ({ file }) or a URL ({ url }), with the other
// files of its archive (siblings, for a stack of slices): its manifest, and
// loadSeries(index) for the voxels of a stack.
export async function openTiff(source, fileName, siblings = null) {
  const manifest = await describeTiff(source, fileName, siblings);
  const slices = manifest.slices;
  delete manifest.slices;
  const readSource = slices ? { slices } : source;
  return {
    manifest,
    async loadSeries(index, { onProgress } = {}) {
      const stack = manifest.series[index];
      const result = await runVolumeWorker(
        () => new Worker(new URL("./tiff-volume-worker.js", import.meta.url), { type: "module" }),
        { source: readSource, layout: stack.layout },
        () => readTiffVolume(readSource, stack.layout, { onProgress }),
        onProgress,
      );
      result.channels.forEach((channel, c) => Object.assign(stack.channels[c], channel));
      return result.bytes;
    },
  };
}
