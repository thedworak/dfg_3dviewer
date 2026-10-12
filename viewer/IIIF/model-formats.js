// The media type of a model URL, by its extension (IIIF body "format").
// Kept apart from presentation4.js so it loads without three.js.
const MODEL_FORMATS = {
  glb: "model/gltf-binary",
  gltf: "model/gltf+json",
  obj: "model/obj",
  stl: "model/stl",
  usdz: "model/vnd.usdz+zip",
};

export function modelFormatOf(url) {
  const extension = String(url || "").split(/[?#]/)[0].split(".").pop().toLowerCase();
  return MODEL_FORMATS[extension] || null;
}
