// The media type of a model URL, by its extension (IIIF body "format"), and
// the IIIF type of what the viewer shows from it: a Model, a Sound (an
// audio file, audio.js) or an Image (a 2D image, image2d.js). Kept apart
// from presentation4.js so it loads without three.js.
const MODEL_FORMATS = {
  glb: "model/gltf-binary",
  gltf: "model/gltf+json",
  obj: "model/obj",
  stl: "model/stl",
  usdz: "model/vnd.usdz+zip",
};

const SOUND_FORMATS = {
  wav: "audio/wav",
  wave: "audio/wav",
  bwf: "audio/wav",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  flac: "audio/flac",
  m4a: "audio/mp4",
  aac: "audio/aac",
  weba: "audio/webm",
};

const IMAGE_FORMATS = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  bmp: "image/bmp",
};

const extensionOf = (url) => String(url || "").split(/[?#]/)[0].split(".").pop().toLowerCase();

export function modelFormatOf(url) {
  const extension = extensionOf(url);
  return MODEL_FORMATS[extension] || SOUND_FORMATS[extension] || IMAGE_FORMATS[extension] || null;
}

// "Model", "Sound" or "Image".
export function contentTypeOf(url) {
  const extension = extensionOf(url);
  if (SOUND_FORMATS[extension]) return "Sound";
  if (IMAGE_FORMATS[extension]) return "Image";
  return "Model";
}

// A Sound, Audio or Image body is the scene's content (shown as a model is)
// when its file is one the viewer opens.
export function isShownMediaBody(type, url) {
  const kind = String(type || "").toLowerCase();
  const extension = extensionOf(url);
  if (kind === "sound" || kind === "audio") return Boolean(SOUND_FORMATS[extension]);
  if (kind === "image") return Boolean(IMAGE_FORMATS[extension]);
  return false;
}
