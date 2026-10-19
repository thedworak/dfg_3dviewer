// Model thumbnails and the generic images that stand in for missing ones
// (gallery, browse panel, admin pages). No viewer imports: the admin pages
// (exadmin/) use it without loading the viewer.

// Renders of the Explora 4D logo (viewer/examples/gallery/generic/
// explora4d-placeholder-01..09.png), shown wherever a gallery image is
// missing. Resolved against this module like viewer-settings.json: the chunk
// sits in <build>/assets/, the examples next to it in <build>/examples/.
export const GENERIC_GALLERY_IMAGE_COUNT = 9;

// Rollup builds turn the gallery PNGs into WebP (rollup.config.js,
// convertGalleryToWebp); the dev server (Parcel, no __BUILD__) serves the
// PNGs straight from viewer/examples.
export const GALLERY_IMAGE_EXT = typeof __BUILD__ !== "undefined" ? "webp" : "png";

export function getGenericGalleryImageUrl(index) {
  const moduleUrl = new URL(import.meta.url);
  const examplesPath = moduleUrl.pathname.includes("/assets/") ? "../examples/" : "./examples/";
  const number = String((index % GENERIC_GALLERY_IMAGE_COUNT) + 1).padStart(2, "0");
  return new URL(`${examplesPath}gallery/generic/explora4d-placeholder-${number}.${GALLERY_IMAGE_EXT}`, moduleUrl).href;
}

// One of the generic images for a model without thumbnails (browse and
// admin panels), the same one for the same model every time.
export function genericThumbnailUrl(seed = "") {
  let hash = 0;
  for (const char of String(seed)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return getGenericGalleryImageUrl(hash % GENERIC_GALLERY_IMAGE_COUNT);
}

// Fills a list row's thumbnail slot: the model's own image, or a generic one
// when it has none or it fails to load (the slot's CSS placeholder is left
// if even that is missing).
export function fillModelThumbnail(slot, imageUrl, seed) {
  const thumb = document.createElement("img");
  thumb.alt = "";
  thumb.loading = "lazy";
  const generic = genericThumbnailUrl(seed);
  thumb.addEventListener("error", function onError() {
    if (thumb.src !== generic && imageUrl) {
      thumb.src = generic;
      return;
    }
    thumb.removeEventListener("error", onError);
    thumb.remove();
  });
  thumb.src = imageUrl || generic;
  slot.appendChild(thumb);
}
