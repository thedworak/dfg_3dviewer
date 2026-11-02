// The format of a model file by its name: the extension, lower case - and
// "nii" for a gzipped NIfTI volume (.nii.gz), which is not an archive. DICOM
// files often have no extension at all: isDicomFile() tells them by content.

const DOUBLE_EXTENSIONS = [[".nii.gz", "nii"]];

export function modelExtension(name) {
  const clean = String(name || "").split(/[?#]/)[0].split("/").pop().toLowerCase();
  const double = DOUBLE_EXTENSIONS.find(([suffix]) => clean.endsWith(suffix));
  if (double) return double[1];
  const at = clean.lastIndexOf(".");
  return at >= 0 ? clean.slice(at + 1) : "";
}

// The name without its extension (brain.nii.gz -> brain).
export function modelBasename(name) {
  const clean = String(name || "").split("/").pop();
  const double = DOUBLE_EXTENSIONS.find(([suffix]) => clean.toLowerCase().endsWith(suffix));
  if (double) return clean.slice(0, -double[0].length);
  const at = clean.lastIndexOf(".");
  return at >= 0 ? clean.slice(0, at) : clean;
}

// A DICOM Part 10 file: "DICM" after the 128-byte preamble.
export async function isDicomFile(file) {
  if (!file || file.size < 132) return false;
  const marker = new Uint8Array(await file.slice(128, 132).arrayBuffer());
  return String.fromCharCode(...marker) === "DICM";
}
