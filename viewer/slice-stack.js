// Stacks of slices one file each, as CT software exports them (a .zip,
// unpacked by extract-helper.js): their order, and the voxel size the
// scanner's software writes next to them. Used by tiff-reader.js and
// image-slices-reader.js; worker/volumes.py does the same for the worker.

// "slice_2" before "slice_10".
export const naturalKey = (name) => name.toLowerCase().split(/(\d+)/).map((part) => (/^\d+$/.test(part) ? part.padStart(12, "0") : part)).join("");

export const folderOf = (name) => String(name || "").replace(/[^/]*$/, "");

// The files of `siblings` in the folder of fileName that `matches` accepts,
// in natural name order.
export function slicesNextTo(fileName, siblings, matches) {
  const folder = folderOf(fileName);
  return (siblings || [])
    .filter((file) => folderOf(file.name) === folder && matches(file.name))
    .sort((a, b) => naturalKey(a.name).localeCompare(naturalKey(b.name)));
}

// SkyScan / Bruker micro-CT: the reconstruction log next to the slices
// (<name>_rec.log, NRecon) says "Image Pixel Size (um)=...": the voxel's
// edge in µm, the same along z. null without one.
const SKYSCAN_PIXEL = /^\s*Image Pixel Size \(um\)\s*=\s*([0-9.eE+-]+)/m;

export async function skyscanPixelSize(fileName, siblings) {
  const logs = slicesNextTo(fileName, siblings, (name) => /\.log$/i.test(name));
  // The reconstruction's log before the acquisition's.
  logs.sort((a, b) => Number(/_rec\.log$/i.test(b.name)) - Number(/_rec\.log$/i.test(a.name)));
  for (const log of logs) {
    const size = Number(SKYSCAN_PIXEL.exec(await log.text())?.[1]);
    if (size > 0) return size;
  }
  return null;
}
