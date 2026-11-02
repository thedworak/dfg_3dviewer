import { ChannelAccumulator, runVolumeWorker } from "./volume-voxels.js";
import { folderOf, skyscanPixelSize, slicesNextTo } from "./slice-stack.js";

// Slices one image each - PNG, JPEG or BMP, as micro-CT software exports
// them (SkyScan / Bruker NRecon, and many others) - read in the browser,
// without the worker: the images of one type in the folder of the opened one
// (a .zip dropped from the disk, extract-helper.js), in natural name order,
// are the stack. The same files as worker/image_slices.py.
//
// Decoded by the browser (createImageBitmap) in a Web Worker
// (image-slices-worker.js), a slice at a time, averaged down to MAX_SIZE
// voxels per axis. Colour images are taken as their luminance; the browser
// decodes 16-bit PNGs to 8 bits (the worker keeps all 16). The voxel size
// comes from a SkyScan reconstruction log next to the slices, else the
// unit is "px".

export const MAX_SIZE = 512;
export const IMAGE_SLICE_EXTENSIONS = ["png", "jpg", "jpeg", "bmp"];

// jpg and jpeg are one kind.
const kindOf = (name) => {
  const extension = String(name || "").split(".").pop().toLowerCase();
  return extension === "jpeg" ? "jpg" : extension;
};
export const isImageSlice = (name) => IMAGE_SLICE_EXTENSIONS.includes(kindOf(name));

export function imageSlices(fileName, siblings) {
  const kind = kindOf(fileName);
  return slicesNextTo(fileName, siblings, (name) => kindOf(name) === kind);
}

async function decode(file) {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  const canvas = typeof OffscreenCanvas !== "undefined"
    ? new OffscreenCanvas(width, height)
    : Object.assign(document.createElement("canvas"), { width, height });
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  return { width, height, rgba: context.getImageData(0, 0, width, height).data };
}

// Grey levels of an RGBA image: its red channel when grey, else luminance.
function grey(rgba) {
  const plane = new Uint8Array(rgba.length / 4);
  for (let i = 0, at = 0; i < plane.length; i += 1, at += 4) {
    const r = rgba[at];
    const g = rgba[at + 1];
    const b = rgba[at + 2];
    plane[i] = r === g && g === b ? r : Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }
  return plane;
}

// The manifest of the stack the image `fileName` is a slice of, and its
// slices (Files), from `siblings` - the other files of its archive.
export async function describeImageSlices(fileName, siblings) {
  const slices = imageSlices(fileName, siblings);
  if (slices.length < 2) throw new Error(`${fileName.split("/").pop()} is a single image: open a .zip of all the slices of the stack`);
  const first = await createImageBitmap(slices[0]);
  const nx = first.width;
  const ny = first.height;
  first.close?.();
  const nz = slices.length;
  const pixel = await skyscanPixelSize(fileName, siblings);
  const name = folderOf(fileName).split("/").filter(Boolean).pop() || fileName.split("/").pop().replace(/[_-]?\d*\.[^.]+$/, "") || "Slices";
  const factors = [nz, ny, nx].map((n) => Math.max(1, Math.ceil(n / MAX_SIZE)));
  const voxel = pixel ? [pixel, pixel, pixel] : [1, 1, 1];
  const manifest = {
    format: "dfg-volume",
    version: 1,
    source: fileName,
    skipped: [],
    series: [{
      id: name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "slices",
      name,
      path: name,
      dims: [nx, ny, nz].map((n, i) => Math.ceil(n / factors[2 - i])),
      sourceDims: [nx, ny, nz],
      voxelSize: voxel.map((v, i) => Number((v * factors[2 - i]).toPrecision(6))),
      unit: pixel ? "µm" : "px",
      frames: 1,
      channels: [{ name, color: "#ffffff", bits: 8 }],
      acquisition: {},
      layout: { shape: [nz, ny, nx], factors },
    }],
  };
  return { manifest, slices };
}

// The 8-bit voxels of the stack (x fastest), with its value range and Otsu
// threshold.
export async function readImageSlices(slices, layout, { onProgress } = {}) {
  const [nz, ny, nx] = layout.shape;
  const accumulator = new ChannelAccumulator(layout.shape, layout.factors, { levels: 256, toLevel: (v) => v });
  for (let z = 0; z < nz; z += 1) {
    const { width, height, rgba } = await decode(slices[z]);
    if (width !== nx || height !== ny) {
      throw new Error(`${slices[z].name}: ${width} × ${height} pixels, not ${nx} × ${ny} as the first slice`);
    }
    accumulator.add(z, grey(rgba));
    onProgress?.({ loaded: z + 1, total: nz });
  }
  const voxels = layout.shape.reduce((n, size, i) => n * Math.ceil(size / layout.factors[i]), 1);
  const bytes = new Uint8Array(voxels);
  const { low, high, threshold } = accumulator.finish(bytes);
  return { bytes, channels: [{ range: [low, high], threshold }] };
}

// An image slice from a .zip (source.file) with the archive's other files:
// the stack's manifest, and loadSeries(0).
export async function openImageSlices(_source, fileName, siblings = null) {
  const { manifest, slices } = await describeImageSlices(fileName, siblings);
  return {
    manifest,
    async loadSeries(index, { onProgress } = {}) {
      const stack = manifest.series[index];
      const result = await runVolumeWorker(
        () => new Worker(new URL("./image-slices-worker.js", import.meta.url), { type: "module" }),
        { slices, layout: stack.layout },
        () => readImageSlices(slices, stack.layout, { onProgress }),
        onProgress,
      );
      Object.assign(stack.channels[0], result.channels[0]);
      return result.bytes;
    },
  };
}
