import { isDicomFile } from "./model-extension.js";
import { ChannelAccumulator, runVolumeWorker } from "./volume-voxels.js";

// DICOM series read in the browser, without the worker - the rules of
// worker/dicom_series.py (see there): the files of a dropped .zip (or one
// file) told apart by their "DICM" marker, grouped by series, slices sorted
// along the slice normal, values rescaled (CT in Hounsfield units, with the
// windows the files suggest).
//
// Read here: uncompressed transfer syntaxes - implicit and explicit VR,
// little and big endian - one file per slice. Compressed series (JPEG,
// JPEG 2000, RLE, deflate) and multi-frame files are listed as skipped:
// the worker's conversion reads them. Only what describes the image goes
// into the manifest, never who the patient is.
//
// The headers are read on the main thread (the first 64 kB of each file,
// more when the pixel data starts later); the slices are read, rescaled and
// averaged down in a Web Worker (dicom-volume-worker.js).

export const MAX_SIZE = 512;
const HEAD_BYTES = 65536;
const IMPLICIT_LE = "1.2.840.10008.1.2";
const EXPLICIT_LE = "1.2.840.10008.1.2.1";
const EXPLICIT_BE = "1.2.840.10008.1.2.2";
const DICOMDIR = "1.2.840.10008.1.3.10";
const LONG_VRS = new Set(["OB", "OD", "OF", "OL", "OV", "OW", "SQ", "SV", "UC", "UN", "UR", "UT", "UV"]);
const SHORT_TAGS = new Set(["00280002", "00280010", "00280011", "00280100", "00280103"]);
// The tags read (group + element, hex).
const TAGS = {
  "00020002": "MediaStorageSOPClassUID", "00020010": "TransferSyntaxUID",
  "00080060": "Modality", "00080070": "Manufacturer", "00081090": "ManufacturerModelName", "0008103E": "SeriesDescription",
  "00180015": "BodyPartExamined", "00180050": "SliceThickness", "00180060": "KVP", "00180088": "SpacingBetweenSlices",
  "0020000E": "SeriesInstanceUID", "00200011": "SeriesNumber", "00200013": "InstanceNumber",
  "00200032": "ImagePositionPatient", "00200037": "ImageOrientationPatient",
  "00280002": "SamplesPerPixel", "00280008": "NumberOfFrames", "00280010": "Rows", "00280011": "Columns",
  "00280030": "PixelSpacing", "00280100": "BitsAllocated", "00280103": "PixelRepresentation",
  "00281050": "WindowCenter", "00281051": "WindowWidth", "00281052": "RescaleIntercept", "00281053": "RescaleSlope",
  "00281054": "RescaleType", "00281055": "WindowCenterWidthExplanation",
};
const PIXEL_DATA = "7FE00010";

const hex = (group, element) => (group.toString(16).padStart(4, "0") + element.toString(16).padStart(4, "0")).toUpperCase();
const numbers = (text) => (text ? String(text).split("\\").map(Number).filter(Number.isFinite) : []);

// Skips an element of undefined length (a sequence, or encapsulated pixel
// data): items until the sequence delimiter. Returns the position after it.
function skipUndefined(view, at, little, explicit) {
  while (at + 8 <= view.byteLength) {
    const group = view.getUint16(at, little);
    const element = view.getUint16(at + 2, little);
    const length = view.getUint32(at + 4, little);
    at += 8;
    if (group === 0xfffe && element === 0xe0dd) return at;
    if (group === 0xfffe && element === 0xe000) {
      if (length === 0xffffffff) {
        // An item of undefined length: its elements until the item delimiter.
        for (;;) {
          if (at + 8 > view.byteLength) return view.byteLength;
          if (view.getUint16(at, little) === 0xfffe && view.getUint16(at + 2, little) === 0xe00d) {
            at += 8;
            break;
          }
          at = readElement(view, at, little, explicit, null).next;
        }
      } else {
        at += length;
      }
    } else {
      return at;
    }
  }
  return view.byteLength;
}

// One element at `at`: { tag, vr, value position, length, next }; values of
// the wanted tags go into `out`.
function readElement(view, at, little, explicit, out) {
  const group = view.getUint16(at, little);
  const element = view.getUint16(at + 2, little);
  const tag = hex(group, element);
  let vr = null;
  let length;
  let start;
  // Item and delimiter tags have no VR, even in explicit syntaxes.
  if (explicit && group !== 0xfffe) {
    vr = String.fromCharCode(view.getUint8(at + 4), view.getUint8(at + 5));
    if (LONG_VRS.has(vr)) {
      length = view.getUint32(at + 8, little);
      start = at + 12;
    } else {
      length = view.getUint16(at + 6, little);
      start = at + 8;
    }
  } else {
    length = view.getUint32(at + 4, little);
    start = at + 8;
  }
  if (length === 0xffffffff) {
    return { tag, vr, start, length, next: skipUndefined(view, start, little, explicit), undefinedLength: true };
  }
  const next = start + length;
  if (out && TAGS[tag] && next <= view.byteLength) {
    if (vr === "US" || (!vr && SHORT_TAGS.has(tag))) {
      out[TAGS[tag]] = view.getUint16(start, little);
    } else {
      const bytes = new Uint8Array(view.buffer, view.byteOffset + start, length);
      out[TAGS[tag]] = new TextDecoder("latin1").decode(bytes).replace(/[\0 ]+$/, "").trim();
    }
  }
  return { tag, vr, start, length, next };
}

// The header of a DICOM file: wanted values, the transfer syntax and where
// the pixel data is ({ offset, length }, or null beyond `bytes`).
export function parseDicomHeader(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = {};
  let at = 132;
  // File meta: explicit VR little endian, group 0002.
  while (at + 8 <= view.byteLength && view.getUint16(at, true) === 0x0002) {
    at = readElement(view, at, true, true, out).next;
  }
  const syntax = out.TransferSyntaxUID || IMPLICIT_LE;
  const little = syntax !== EXPLICIT_BE;
  const explicit = syntax !== IMPLICIT_LE;
  let pixels = null;
  while (at + 8 <= view.byteLength) {
    const item = readElement(view, at, little, explicit, out);
    if (item.tag === PIXEL_DATA) {
      pixels = item.undefinedLength ? { offset: item.start, encapsulated: true } : { offset: item.start, length: item.length };
      break;
    }
    if (item.next > view.byteLength) break;
    at = item.next;
  }
  return { values: out, syntax, little, explicit, pixels };
}

async function readHeader(file) {
  let size = Math.min(file.size, HEAD_BYTES);
  for (;;) {
    const header = parseDicomHeader(new Uint8Array(await file.slice(0, size).arrayBuffer()));
    if (header.pixels || size >= file.size) return header;
    size = Math.min(file.size, size * 8);
  }
}

function windowsOf(values) {
  const centers = numbers(values.WindowCenter);
  const widths = numbers(values.WindowWidth);
  const names = values.WindowCenterWidthExplanation ? values.WindowCenterWidthExplanation.split("\\") : [];
  return centers.map((center, i) => ({ name: names[i] || `Window ${i + 1}`, center, width: widths[i] }))
    .filter((window) => window.width > 0);
}

function seriesName(values, index) {
  const name = [values.SeriesNumber, values.SeriesDescription].filter(Boolean).join(" ");
  return name || `${values.Modality || "Series"} ${index + 1}`;
}

// The manifest of the DICOM series among `files` (Files), and their slices.
export async function describeDicom(files, fileName) {
  const headers = [];
  for (const file of files) {
    if (!(await isDicomFile(file))) continue;
    const header = await readHeader(file);
    if (header.values.MediaStorageSOPClassUID === DICOMDIR || !header.values.Rows) continue;
    headers.push({ file, ...header });
  }
  const groups = new Map();
  headers.forEach((header) => {
    const uid = header.values.SeriesInstanceUID || "";
    if (!groups.has(uid)) groups.set(uid, []);
    groups.get(uid).push(header);
  });
  const manifest = { format: "dfg-volume", version: 1, source: fileName, series: [], skipped: [] };
  [...groups.values()].forEach((slices, index) => {
    const first = slices[0].values;
    const name = seriesName(first, index);
    const skip = (reason) => manifest.skipped.push({ name, path: name, reason });
    if (Number(first.SamplesPerPixel || 1) !== 1) return skip("colour images, not a scan");
    if (Number(first.NumberOfFrames || 1) > 1) return skip("a multi-frame file: upload it for the server's conversion");
    if (slices.length < 2) return skip("a single image, not a series");
    if (slices.some((s) => s.syntax !== IMPLICIT_LE && s.syntax !== EXPLICIT_LE && s.syntax !== EXPLICIT_BE)) {
      return skip("compressed DICOM (JPEG, JPEG 2000, RLE...): upload it for the server's conversion");
    }
    if (slices.some((s) => !s.pixels || s.pixels.encapsulated)) return skip("no pixel data");
    if (new Set(slices.map((s) => `${s.values.Rows}x${s.values.Columns}`)).size > 1) return skip("slices of different sizes");
    // Along the slice normal, else by instance number.
    const orientation = numbers(first.ImageOrientationPatient);
    let spacing = null;
    if (orientation.length >= 6 && slices.every((s) => numbers(s.values.ImagePositionPatient).length >= 3)) {
      const [a, b, c, d, e, f] = orientation;
      const normal = [b * f - c * e, c * d - a * f, a * e - b * d];
      slices.forEach((s) => {
        const p = numbers(s.values.ImagePositionPatient);
        s.depth = normal[0] * p[0] + normal[1] * p[1] + normal[2] * p[2];
      });
      slices.sort((x, y) => x.depth - y.depth);
      const steps = slices.slice(1).map((s, i) => Math.abs(s.depth - slices[i].depth)).filter((step) => step > 1e-4).sort((x, y) => x - y);
      if (steps.length) spacing = steps[Math.floor(steps.length / 2)];
    } else {
      slices.sort((x, y) => Number(x.values.InstanceNumber || 0) - Number(y.values.InstanceNumber || 0));
    }
    spacing ||= Number(first.SpacingBetweenSlices || first.SliceThickness) || null;
    const rows = Number(first.Rows);
    const columns = Number(first.Columns);
    const pixel = numbers(first.PixelSpacing);
    const known = pixel.length >= 2;
    const voxel = known ? [pixel[1] * 1e3, pixel[0] * 1e3, (spacing || pixel[0]) * 1e3] : [1, 1, spacing || 1];
    const shape = [slices.length, rows, columns];
    const factors = shape.map((n) => Math.max(1, Math.ceil(n / MAX_SIZE)));
    const ct = first.Modality === "CT" && ["HU", "US", ""].includes(String(first.RescaleType || "").toUpperCase());
    const channel = { name, color: "#ffffff", bits: Number(first.BitsAllocated || 16) };
    if (ct) channel.unit = "HU";
    const windows = windowsOf(first);
    if (windows.length) channel.windows = windows;
    const acquisition = {};
    if (first.Modality) acquisition.modality = first.Modality;
    const system = [first.Manufacturer, first.ManufacturerModelName].filter(Boolean).join(" ");
    if (system) acquisition.system = system;
    if (first.BodyPartExamined) acquisition.bodyPart = first.BodyPartExamined;
    if (Number(first.SliceThickness)) acquisition.sliceThicknessMm = Number(first.SliceThickness);
    manifest.series.push({
      id: name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || `series-${index + 1}`,
      name,
      path: `${slices.length} slices`,
      dims: shape.map((n, i) => Math.ceil(n / factors[i])).reverse(),
      sourceDims: [columns, rows, slices.length],
      voxelSize: voxel.map((v, i) => Number((v * factors[2 - i]).toPrecision(6))),
      unit: known ? "µm" : "px",
      frames: 1,
      channels: [channel],
      acquisition,
      layout: {
        shape,
        factors,
        bits: Number(first.BitsAllocated || 16),
        hounsfield: ct,
        signed: Number(first.PixelRepresentation || 0) === 1,
        slices: slices.map((s) => ({
          file: files.indexOf(s.file),
          offset: s.pixels.offset,
          little: s.little,
          slope: Number(s.values.RescaleSlope) || 1,
          intercept: Number(s.values.RescaleIntercept) || 0,
        })),
      },
    });
  });
  if (!manifest.series.length) {
    const reasons = manifest.skipped.slice(0, 5).map((s) => `${s.name}: ${s.reason}`).join("; ");
    throw new Error(`No DICOM series in ${fileName} to show in 3D${reasons ? ` (${reasons})` : ""}`);
  }
  manifest.series.sort((a, b) => b.sourceDims[2] - a.sourceDims[2]);
  return manifest;
}

// Reading the slices (Web Worker or main thread).

async function sliceValues(files, layout, slice) {
  const [, rows, columns] = layout.shape;
  const size = layout.bits / 8;
  const bytes = new Uint8Array(await files[slice.file].slice(slice.offset, slice.offset + rows * columns * size).arrayBuffer());
  if (!slice.little && size > 1) {
    for (let i = 0; i < bytes.length; i += size) bytes.subarray(i, i + size).reverse();
  }
  const Type = { 8: layout.signed ? Int8Array : Uint8Array, 16: layout.signed ? Int16Array : Uint16Array, 32: layout.signed ? Int32Array : Uint32Array }[layout.bits];
  if (!Type) throw new Error(`${layout.bits}-bit DICOM pixels are not supported`);
  const raw = new Type(bytes.buffer);
  const values = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) values[i] = raw[i] * slice.slope + slice.intercept;
  return values;
}

// The 8-bit voxels of a series, with its value range (rescaled: HU for CT)
// and Otsu threshold. Integer rescaled values (CT) go in one pass; others
// after a first pass for their extremes.
export async function readDicomVolume(source, layout, { onProgress } = {}) {
  const files = source.files;
  const integers = layout.slices.every((s) => s.slope === 1 && Number.isInteger(s.intercept)) && layout.bits <= 16;
  const total = layout.slices.length * (integers ? 1 : 2);
  let done = 0;
  let mapping;
  if (integers) {
    mapping = {
      levels: 65536,
      toLevel: (v) => Math.min(65535, Math.max(0, v + 32768)),
      toValue: (l) => l - 32768,
    };
  } else {
    let min = Infinity;
    let max = -Infinity;
    for (const slice of layout.slices) {
      const values = await sliceValues(files, layout, slice);
      for (let i = 0; i < values.length; i += 1) {
        if (values[i] < min) min = values[i];
        if (values[i] > max) max = values[i];
      }
      onProgress?.({ loaded: (done += 1), total });
    }
    if (!(max > min)) max = min + 1;
    const scale = 65535 / (max - min);
    mapping = {
      levels: 65536,
      toLevel: (v) => Math.min(65535, Math.max(0, (v - min) * scale)),
      toValue: (l) => Math.round((min + l / scale) * 1000) / 1000,
    };
  }
  const accumulator = new ChannelAccumulator(layout.shape, layout.factors, mapping);
  for (let z = 0; z < layout.slices.length; z += 1) {
    accumulator.add(z, await sliceValues(files, layout, layout.slices[z]));
    onProgress?.({ loaded: (done += 1), total });
  }
  const voxels = layout.shape.reduce((n, size, i) => n * Math.ceil(size / layout.factors[i]), 1);
  const bytes = new Uint8Array(voxels);
  // CT: up to the maximum, like worker/volumes.py, for the HU windows.
  const { low, high, threshold } = accumulator.finish(bytes, layout.hounsfield ? 100 : undefined);
  return { bytes, channels: [{ range: [mapping.toValue(low), mapping.toValue(high)], threshold }] };
}

// DICOM from a dropped file ({ file }, with the other files of its archive)
// or a URL ({ url }, one file): its manifest, and loadSeries(index).
export async function openDicom(source, fileName, siblings = null) {
  let files = siblings?.length ? siblings : null;
  if (!files) {
    const file = source.file || new File([await (await fetch(source.url)).blob()], fileName);
    files = [file];
  }
  const manifest = await describeDicom(files, fileName);
  return {
    manifest,
    async loadSeries(index, { onProgress } = {}) {
      const stack = manifest.series[index];
      const result = await runVolumeWorker(
        () => new Worker(new URL("./dicom-volume-worker.js", import.meta.url), { type: "module" }),
        { source: { files }, layout: stack.layout },
        () => readDicomVolume({ files }, stack.layout, { onProgress }),
        onProgress,
      );
      result.channels.forEach((channel, c) => Object.assign(stack.channels[c], channel));
      return result.bytes;
    },
  };
}
