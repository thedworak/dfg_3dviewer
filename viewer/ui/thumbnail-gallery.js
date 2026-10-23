import { core } from "../core.js";
import { isValidUrl } from "../utils.js";
import { t } from "../i18n-utils.js";
import { GALLERY_IMAGE_EXT, GENERIC_GALLERY_IMAGE_COUNT, getGenericGalleryImageUrl } from "./model-thumbnail.js";

function getGalleryConfig() {
  return core.CONFIG?.viewer?.gallery || {};
}

function getGalleryHost(Viewer, mainElement) {
  return (
    Viewer.fileElement?.[0] ||
    mainElement ||
    Viewer.container ||
    core.container ||
    null
  );
}

// A viewer turned into a movable window (ui/window-controls.js, a manifest's
// viewer.window) leaves a placeholder where it stood: the gallery goes before
// that, so it stays above the viewer - and the placeholder stays right
// before the window, where window-controls.js resizes it.
function galleryAnchor(host) {
  const previous = host?.previousElementSibling;
  return previous?.classList.contains("viewer-window-placeholder") ? previous : host;
}

function removeExistingGalleryDom() {
  const imageList = document.getElementById("image-list");
  (imageList?.closest(".image-list-scroller") || imageList)?.remove();
  document.getElementById("modalGallery")?.remove();
}

// Swaps a thumbnail that fails to load for the generic image with the same
// position (once - a missing generic image is left broken).
function useGenericImageOnError(img, index, onReplaced) {
  img.addEventListener("error", () => {
    if (img.dataset.genericFallback) return;
    img.dataset.genericFallback = "1";
    img.src = getGenericGalleryImageUrl(index);
    onReplaced?.(img.src);
  }, { once: true });
}

function getConfiguredTestImages() {
  const gallery = getGalleryConfig();
  const configuredImages = Array.isArray(gallery.testImages) ? gallery.testImages : [];
  const normalizedImages = configuredImages.map((entry, index) => {
    if (typeof entry === "string") {
      const src = normalizeGalleryUrl(entry);
      return src ? { src, alt: `Preview ${index + 1}`, label: "" } : null;
    }
    if (entry && typeof entry === "object") {
      const src = normalizeGalleryUrl(entry.src || entry.url || "");
      if (!src) return null;
      return {
        src,
        alt: String(entry.alt || entry.label || `Preview ${index + 1}`),
        label: String(entry.label || ""),
      };
    }
    return null;
  }).filter(Boolean);

  if (normalizedImages.length > 0) {
    return normalizedImages;
  }

  return [];
}

function createDefaultTestImages() {
  return Array.from({ length: GENERIC_GALLERY_IMAGE_COUNT }, (_unused, index) => ({
    src: getGenericGalleryImageUrl(index),
    alt: `Preview ${index + 1}`,
    label: "",
  }));
}

const GALLERY_RENDER_ANGLES = ["0", "45", "90", "135", "180", "225", "270", "315"];

// scripts/render.py writes a 9-shot turntable per source file into
// viewer/examples/gallery/<filename>/<basename>_side<angle>.png (+ _top.png;
// .webp in the builds),
// named after that same file's own filename/basename - see core.fileObject,
// set from the currently loaded model's path in main.js. Deriving the path
// this way means a freshly rendered example picks up its own thumbnails
// automatically, with no config file to keep in sync per model.
// An example in a folder of its own (examples/tempietto/: one model in every
// format) shares one set for all its files, gallery/<folder>/.
function getPerModelGalleryImages() {
  const filename = core.fileObject?.filename;
  const basename = core.fileObject?.basename;
  if (!filename || !basename) return [];
  const folder = (core.fileObject?.path || "").match(/\/examples\/([^/]+)\/$/)?.[1];
  const dir = folder && folder !== "gallery" ? folder : filename;

  const images = GALLERY_RENDER_ANGLES.map((angle) => ({
    src: normalizeGalleryUrl(`examples/gallery/${dir}/${basename}_side${angle}.${GALLERY_IMAGE_EXT}`),
    alt: `${basename} - ${angle}°`,
    label: `${angle}°`,
  }));
  images.push({
    src: normalizeGalleryUrl(`examples/gallery/${dir}/${basename}_top.${GALLERY_IMAGE_EXT}`),
    alt: `${basename} - top`,
    label: t("gallery.top", "Top"),
  });
  return images.filter((img) => img.src);
}

function probeImageExists(src) {
  return new Promise((resolve) => {
    if (!src) {
      resolve(false);
      return;
    }
    const probe = new Image();
    probe.onload = () => resolve(true);
    probe.onerror = () => resolve(false);
    probe.src = src;
  });
}

// The caption of a turntable render (scripts/render.py, worker/server.py:
// <basename>_side<angle>.<ext>, <basename>_top.<ext>) from its URL, for
// galleries that come as bare URL lists.
function labelFromRenderUrl(src) {
  const name = String(src || "").split(/[?#]/)[0].split("/").pop() || "";
  const side = name.match(/_side(\d{1,3})\.[a-z0-9]+$/i);
  if (side) return `${side[1]}°`;
  if (/_top\.[a-z0-9]+$/i.test(name)) return t("gallery.top", "Top");
  return "";
}

function createFakeGalleryElements(testImages) {
  return testImages.map((entry) => {
    const wrapper = document.createElement("div");
    wrapper.className = "field__item";
    const label = entry.label ?? labelFromRenderUrl(entry.src);
    if (label) wrapper.dataset.label = label;
    // Built with properties, not markup: the alt text may come from a
    // manifest (AIM3DViewer.thumbnails labels).
    const img = document.createElement("img");
    img.loading = "lazy";
    img.src = entry.src;
    img.width = 200;
    img.height = 200;
    img.alt = entry.alt;
    img.className = "img-fluid image-style-wisski-preview";
    wrapper.appendChild(img);
    return wrapper;
  });
}

function prepareGalleryImages(Viewer, imageElementsChildren) {
  imageElementsChildren = imageElementsChildren.filter(function (_image) {
    if (!(_image instanceof Element)) return false;
    let rawUrl = "";
    const img = _image.querySelector("img");
    const link = _image.querySelector("a");
    if (img && img.getAttribute("src")) {
      rawUrl = img.getAttribute("src");
    } else if (link && link.getAttribute("href")) {
      rawUrl = link.getAttribute("href");
    } else {
      rawUrl = (_image.textContent || _image.innerHTML || "").trim();
    }

    const normalized = normalizeGalleryUrl(rawUrl);
    if (!isValidUrl(normalized)) {
      return false;
    }
    _image.innerHTML = normalized;
    return !!img;
  });
  imageElementsChildren.forEach(function (imgLink) {
    imgLink.innerHTML =
      '<img loading="lazy" src="' +
      imgLink.innerHTML +
      '" width="200px" height="200px" alt="" class="img-fluid image-style-wisski-preview">';
  });
  return imageElementsChildren;
}

function normalizeGalleryUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") {
    return "";
  }

  let url = rawUrl.trim();
  if (url === "") {
    return "";
  }

  if (url.startsWith("public://")) {
    url = "/sites/default/files/" + url.substring("public://".length);
  } else if (url.startsWith("sites/default/files/")) {
    url = "/" + url;
  }

  const base = (core.CONFIG?.mainUrl || window.location.origin || "").replace(/\/+$/, "");

  try {
    const parsed = new URL(url, window.location.origin);
    const host = parsed.host || "";
    const path = parsed.pathname || "";
    const normalizedHost = host.toLowerCase();
    const hasBadHost = host.includes("_") || normalizedHost === "default" || normalizedHost === "dfg_3dviewer";

    if (path.startsWith("/sites/default/files/")) {
      if (hasBadHost) {
        return `${base}${path}`;
      }
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.href;
      }
      return `${base}${path}`;
    }
    return parsed.href;
  } catch (_error) {
    if (url.startsWith("/sites/default/files/")) {
      return `${base}${url}`;
    }
    return url;
  }
}

const SCROLL_HINT_ICONS = {
  prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 5.3a1 1 0 0 1 0 1.4L9.41 12l5.3 5.3a1 1 0 1 1-1.42 1.4l-6-6a1 1 0 0 1 0-1.4l6-6a1 1 0 0 1 1.41 0Z"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.3 18.7a1 1 0 0 1 0-1.4l5.29-5.3-5.3-5.3a1 1 0 1 1 1.42-1.4l6 6a1 1 0 0 1 0 1.4l-6 6a1 1 0 0 1-1.41 0Z"/></svg>',
};

// On a phone the thumbnails are one row that scrolls sideways (main.css),
// which nothing on screen gave away. The wrapper fades the edge that has
// more thumbnails behind it and shows a small chevron there (tapping it
// scrolls); both only when the row overflows that way, and CSS keeps them
// to the phone layout.
function wrapWithScrollHints(Viewer, imageList) {
  const scroller = document.createElement("div");
  scroller.className = "image-list-scroller";
  scroller.setAttribute("role", "region");
  scroller.setAttribute("aria-label", t("gallery.label", "Views of the model"));
  scroller.appendChild(imageList);

  const [prevButton, nextButton] = ["prev", "next"].map((direction) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `image-list-hint image-list-hint--${direction}`;
    button.tabIndex = -1; // the thumbnails themselves are reachable by keyboard
    // Shown by update() only when the row scrolls that way - not left to the
    // stylesheet alone, so a missing or older one never shows empty buttons.
    button.hidden = true;
    button.setAttribute("aria-hidden", "true");
    button.innerHTML = SCROLL_HINT_ICONS[direction];
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const step = Math.max(64, imageList.clientWidth * 0.8);
      imageList.scrollBy({ left: direction === "next" ? step : -step, behavior: "smooth" });
    });
    scroller.appendChild(button);
    return button;
  });

  const update = () => {
    const max = imageList.scrollWidth - imageList.clientWidth;
    const canPrev = imageList.scrollLeft > 2;
    const canNext = imageList.scrollLeft < max - 2;
    scroller.classList.toggle("can-scroll-prev", canPrev);
    scroller.classList.toggle("can-scroll-next", canNext);
    prevButton.hidden = !canPrev;
    nextButton.hidden = !canNext;
  };
  imageList.addEventListener("scroll", update, { passive: true });
  if (typeof ResizeObserver === "function") new ResizeObserver(update).observe(imageList);
  Viewer.bindEventListener(window, "resize", update);
  // Thumbnails can change the row's width as they load.
  imageList.addEventListener("load", update, true);
  requestAnimationFrame(update);
  return scroller;
}

// Swaps the thumbnail shimmer placeholder for the real image once it has
// finished loading (or failed), covering both the still-loading case and
// images that are already cached and complete by the time this runs.
function markThumbnailLoaded(img, container) {
  const markLoaded = () => {
    img.classList.add("is-loaded");
    if (container instanceof HTMLElement) {
      container.classList.add("is-loaded");
    }
  };
  if (img.complete && img.naturalWidth > 0) {
    markLoaded();
  } else {
    img.addEventListener("load", markLoaded, { once: true });
    img.addEventListener("error", markLoaded, { once: true });
  }
}

const GALLERY_ICONS = {
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.7 5.3a1 1 0 0 0-1.4 1.4L10.59 12l-5.3 5.3a1 1 0 1 0 1.42 1.4L12 13.41l5.3 5.3a1 1 0 0 0 1.4-1.42L13.41 12l5.3-5.3a1 1 0 0 0-1.42-1.4L12 10.59Z"/></svg>',
  zoomReset: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 3a7.5 7.5 0 0 1 5.96 12.05l4.25 4.24a1 1 0 0 1-1.42 1.42l-4.24-4.25A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM8 9.5h5a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2Z"/></svg>',
};

const GALLERY_ZOOM_MIN = 1;
const GALLERY_ZOOM_MAX = 6;
const GALLERY_ZOOM_DETAIL = 2.5;

// The caption a thumbnail shows: its own label (data-label: an angle, a
// manifest's label), else the image's alt text from the page (Drupal
// fields), else nothing.
function thumbnailCaption(container, img) {
  return container?.dataset?.label || (img.getAttribute("alt") || "").trim();
}

function handleImages(Viewer, mainElement, imageElements, imageElementsChildren) {
  if (imageElementsChildren === undefined) {
    imageElementsChildren = imageElements;
  }
  removeExistingGalleryDom();
  // Layout comes from main.css: one row, scrolling sideways when it is
  // longer than the page.
  const imageList = document.createElement("div");
  imageList.setAttribute("id", "image-list");
  imageList.setAttribute("role", "list");

  const galleryImages = []; // { src, caption }
  const galleryThumbEls = [];
  const filmstripItems = [];
  let currentGalleryIndex = -1;
  let lastFocus = null;

  const el = (tag, className, attrs = {}) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    Object.entries(attrs).forEach(([name, value]) => node.setAttribute(name, value));
    return node;
  };
  const iconButton = (className, label, icon) => {
    const button = el("button", className, { type: "button", title: label, "aria-label": label });
    button.innerHTML = icon;
    return button;
  };

  // The lightbox: the image on the viewer's own backdrop (a studio plate,
  // like the canvas), its caption and number, and a filmstrip of all views.
  const modalGallery = el("div", "modalGallery", {
    id: "modalGallery",
    role: "dialog",
    "aria-modal": "true",
    "aria-label": t("gallery.dialog", "Image viewer"),
  });
  const modalStage = el("div", "galleryStage");
  const modalImageWrap = el("div", "modalImageWrap");
  const modalImage = el("img", "modalImage", { alt: "", draggable: "false" });
  const modalPrev = iconButton("galleryNav galleryNavPrev", t("gallery.previous", "Previous view"), SCROLL_HINT_ICONS.prev);
  const modalNext = iconButton("galleryNav galleryNavNext", t("gallery.next", "Next view"), SCROLL_HINT_ICONS.next);
  const modalClose = iconButton("closeGallery", t("gallery.close", "Close"), GALLERY_ICONS.close);
  const modalFooter = el("div", "galleryFooter");
  const modalCaption = el("div", "galleryCaption", { "aria-live": "polite" });
  const modalCaptionNumber = el("span", "galleryCaptionNumber");
  const modalCaptionText = el("span", "galleryCaptionText");
  const modalCounter = el("span", "galleryCounter");
  const modalZoomReset = el("button", "galleryZoomReset", { type: "button", title: t("gallery.zoomReset", "Reset zoom") });
  const modalHint = el("p", "galleryHint");
  const modalFilmstrip = el("div", "galleryFilmstrip");
  modalHint.textContent = t("gallery.hint", "");
  modalZoomReset.hidden = true;

  modalCaption.append(modalCaptionNumber, modalCounter, modalCaptionText, modalZoomReset);
  modalFooter.append(modalCaption, modalFilmstrip, modalHint);
  modalImageWrap.appendChild(modalImage);
  modalStage.appendChild(modalImageWrap);
  modalGallery.append(modalStage, modalPrev, modalNext, modalClose, modalFooter);

  // Zoom (Viewer.zoomImage, kept across images and across open/close, as
  // before) and the pan of the zoomed image, which each image starts without.
  const pan = { x: 0, y: 0 };
  const clampZoom = (zoom) => Math.min(GALLERY_ZOOM_MAX, Math.max(GALLERY_ZOOM_MIN, zoom));
  Viewer.zoomImage = clampZoom(Number(Viewer.zoomImage) || 1);

  const clampPan = () => {
    const zoom = Viewer.zoomImage;
    // The image fills its plate, which clips it: it pans as far as its edges.
    const maxX = Math.max(0, (modalImage.clientWidth * (zoom - 1)) / 2);
    const maxY = Math.max(0, (modalImage.clientHeight * (zoom - 1)) / 2);
    pan.x = Math.min(maxX, Math.max(-maxX, pan.x));
    pan.y = Math.min(maxY, Math.max(-maxY, pan.y));
  };

  const applyTransform = () => {
    clampPan();
    modalImage.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${Viewer.zoomImage})`;
    const zoomed = Viewer.zoomImage > 1.001;
    modalGallery.classList.toggle("is-zoomed", zoomed);
    modalZoomReset.hidden = !zoomed;
    modalZoomReset.textContent = `${Math.round(Viewer.zoomImage * 100)}%`;
    modalZoomReset.insertAdjacentHTML("afterbegin", GALLERY_ICONS.zoomReset);
  };

  // Zooms keeping the point under (clientX, clientY) where it is.
  const zoomTo = (zoom, clientX, clientY) => {
    const previous = Viewer.zoomImage;
    const next = clampZoom(zoom);
    if (next === previous) return;
    const rect = modalImageWrap.getBoundingClientRect();
    const px = (clientX ?? rect.left + rect.width / 2) - (rect.left + rect.width / 2);
    const py = (clientY ?? rect.top + rect.height / 2) - (rect.top + rect.height / 2);
    pan.x = px - (px - pan.x) * (next / previous);
    pan.y = py - (py - pan.y) * (next / previous);
    Viewer.zoomImage = next;
    applyTransform();
  };

  const resetZoom = () => {
    pan.x = 0;
    pan.y = 0;
    Viewer.zoomImage = 1;
    applyTransform();
  };

  const preload = (index) => {
    const entry = galleryImages[(index + galleryImages.length) % galleryImages.length];
    if (entry) new Image().src = entry.src;
  };

  const showGalleryImageAtIndex = function (index) {
    if (galleryImages.length === 0) {
      return;
    }
    const count = galleryImages.length;
    const normalizedIndex = (index + count) % count;
    galleryThumbEls[currentGalleryIndex]?.classList.remove("is-active-thumb");
    filmstripItems[currentGalleryIndex]?.classList.remove("is-active");
    filmstripItems[currentGalleryIndex]?.removeAttribute("aria-current");
    currentGalleryIndex = normalizedIndex;

    const { src, caption } = galleryImages[normalizedIndex];
    if (modalImage.getAttribute("src") !== src) {
      modalImageWrap.classList.add("is-loading");
      modalImage.src = src;
    }
    modalImage.alt = caption;
    pan.x = 0;
    pan.y = 0;
    applyTransform();

    modalCaptionNumber.textContent = String(normalizedIndex + 1).padStart(2, "0");
    modalCaptionText.textContent = caption || t("gallery.view", { number: normalizedIndex + 1 }, `View ${normalizedIndex + 1}`);
    modalCounter.textContent = `/ ${String(count).padStart(2, "0")}`;
    modalGallery.classList.toggle("is-single", count < 2);

    galleryThumbEls[normalizedIndex]?.classList.add("is-active-thumb");
    const filmItem = filmstripItems[normalizedIndex];
    if (filmItem) {
      filmItem.classList.add("is-active");
      filmItem.setAttribute("aria-current", "true");
      if (modalGallery.classList.contains("is-open")) {
        filmItem.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
      }
    }
    preload(normalizedIndex + 1);
    preload(normalizedIndex - 1);
  };

  const markModalImageLoaded = () => modalImageWrap.classList.remove("is-loading");
  modalImage.addEventListener("load", markModalImageLoaded);
  modalImage.addEventListener("error", markModalImageLoaded);

  const openModalGalleryAtIndex = function (index) {
    lastFocus = document.activeElement;
    showGalleryImageAtIndex(index);
    modalGallery.classList.add("is-open");
    filmstripItems[currentGalleryIndex]?.scrollIntoView({ block: "nearest", inline: "center" });
    modalClose.focus({ preventScroll: true });
  };

  const closeModalGallery = function () {
    if (!modalGallery.classList.contains("is-open")) return;
    modalGallery.classList.remove("is-open");
    const thumb = galleryThumbEls[currentGalleryIndex];
    thumb?.classList.remove("is-active-thumb");
    // Back to the thumbnail of the view last shown (not the one opened), or
    // wherever the focus was.
    if (thumb && (!lastFocus || imageList.contains(lastFocus) || modalGallery.contains(lastFocus))) {
      thumb.scrollIntoView({ block: "nearest", inline: "nearest" });
      thumb.focus({ preventScroll: true });
    } else {
      lastFocus?.focus?.({ preventScroll: true });
    }
    lastFocus = null;
  };

  modalClose.addEventListener("click", (event) => {
    event.stopPropagation();
    closeModalGallery();
  });
  modalPrev.addEventListener("click", (event) => {
    event.stopPropagation();
    showGalleryImageAtIndex(currentGalleryIndex - 1);
  });
  modalNext.addEventListener("click", (event) => {
    event.stopPropagation();
    showGalleryImageAtIndex(currentGalleryIndex + 1);
  });
  modalZoomReset.addEventListener("click", (event) => {
    event.stopPropagation();
    resetZoom();
  });

  Viewer.bindEventListener(modalGallery, "wheel", function (event) {
    event.preventDefault();
    event.stopPropagation();
    const factor = 1 + (Viewer.ZOOM_SPEED_IMAGE || 0.1) * 1.5;
    zoomTo(Viewer.zoomImage * (event.deltaY > 0 ? 1 / factor : factor), event.clientX, event.clientY);
  }, { passive: false });

  // Pointers on the stage: one drags a zoomed image or swipes to the next
  // view, two pinch-zoom, a double click or tap zooms into a detail (and
  // back out).
  const pointers = new Map();
  let gesture = null;
  let lastTap = null;
  let suppressClick = false;

  const pinchDistance = () => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y) || 1;
  };

  modalStage.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    suppressClick = false;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      gesture = {
        type: "pinch",
        distance: pinchDistance(),
        zoom: Viewer.zoomImage,
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2,
      };
    } else if (pointers.size === 1) {
      gesture = {
        type: Viewer.zoomImage > 1.001 ? "pan" : "swipe",
        startX: event.clientX,
        startY: event.clientY,
        panX: pan.x,
        panY: pan.y,
        moved: false,
      };
    }
  });

  modalStage.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId) || !gesture) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (gesture.type === "pinch" && pointers.size === 2) {
      zoomTo(gesture.zoom * (pinchDistance() / gesture.distance), gesture.cx, gesture.cy);
      suppressClick = true;
      modalStage.setPointerCapture?.(event.pointerId);
      return;
    }
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    if (!gesture.moved && Math.hypot(dx, dy) > 6) {
      gesture.moved = true;
      suppressClick = true;
      // Captured only once it is a drag: a plain click keeps its own target
      // (the image, or the backdrop that closes).
      modalStage.setPointerCapture?.(event.pointerId);
    }
    if (gesture.type === "pan") {
      pan.x = gesture.panX + dx;
      pan.y = gesture.panY + dy;
      modalImage.classList.add("is-dragging");
      applyTransform();
    } else if (gesture.type === "swipe" && gesture.moved) {
      modalImageWrap.style.transform = `translateX(${dx * 0.35}px)`;
    }
  });

  const endPointer = (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    modalImage.classList.remove("is-dragging");
    modalImageWrap.style.transform = "";
    if (!gesture) return;
    if (gesture.type === "pinch") {
      // The finger left on the glass carries on as a pan.
      const rest = [...pointers.values()][0];
      gesture = rest
        ? { type: "pan", startX: rest.x, startY: rest.y, panX: pan.x, panY: pan.y, moved: true }
        : null;
      return;
    }
    if (pointers.size > 0 || event.type === "pointercancel") {
      gesture = null;
      return;
    }
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    if (gesture.type === "swipe" && gesture.moved && Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      showGalleryImageAtIndex(currentGalleryIndex + (dx < 0 ? 1 : -1));
    } else if (!gesture.moved && event.target === modalImage) {
      const now = performance.now();
      if (lastTap && now - lastTap.time < 320 && Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 30) {
        if (Viewer.zoomImage > 1.001) resetZoom();
        else zoomTo(GALLERY_ZOOM_DETAIL, event.clientX, event.clientY);
        lastTap = null;
      } else {
        lastTap = { time: now, x: event.clientX, y: event.clientY };
      }
    }
    gesture = null;
  };
  modalStage.addEventListener("pointerup", endPointer);
  modalStage.addEventListener("pointercancel", endPointer);

  // A click on the backdrop (not the image, not after a drag) closes.
  Viewer.bindEventListener(modalGallery, "click", function (event) {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    if (event.target === modalGallery || event.target === modalStage || event.target === modalImageWrap) {
      closeModalGallery();
    }
  });

  Viewer.bindEventListener(document, "click", function (event) {
    if (
      !modalGallery.contains(event.target) &&
      !imageList.contains(event.target)
    ) {
      closeModalGallery();
    }
  });

  Viewer.bindEventListener(document, "keydown", function (event) {
    if (!modalGallery.classList.contains("is-open")) {
      return;
    }
    const keys = {
      ArrowLeft: () => showGalleryImageAtIndex(currentGalleryIndex - 1),
      ArrowRight: () => showGalleryImageAtIndex(currentGalleryIndex + 1),
      Home: () => showGalleryImageAtIndex(0),
      End: () => showGalleryImageAtIndex(galleryImages.length - 1),
      Escape: () => closeModalGallery(),
      "+": () => zoomTo(Viewer.zoomImage * 1.25),
      "=": () => zoomTo(Viewer.zoomImage * 1.25),
      "-": () => zoomTo(Viewer.zoomImage / 1.25),
      0: () => resetZoom(),
    };
    if (keys[event.key]) {
      event.preventDefault();
      event.stopPropagation();
      keys[event.key]();
      return;
    }
    // Tab stays inside the dialog.
    if (event.key === "Tab") {
      const focusable = [...modalGallery.querySelectorAll("button")].filter(
        (button) => !button.hidden && button.offsetParent !== null
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const outside = !modalGallery.contains(document.activeElement);
      if (event.shiftKey && (document.activeElement === first || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  Viewer.bindEventListener(window, "resize", () => {
    if (modalGallery.classList.contains("is-open")) applyTransform();
  });

  // A thumbnail: the whole card opens its view, by mouse, touch or keyboard.
  const addThumbnail = (img, thumbContainer) => {
    const index = galleryImages.length;
    const caption = thumbnailCaption(thumbContainer, img);
    galleryImages.push({ src: img.src, caption });
    galleryThumbEls[index] = thumbContainer;

    if (thumbContainer instanceof HTMLElement) {
      thumbContainer.dataset.number = String(index + 1).padStart(2, "0");
      if (caption) thumbContainer.dataset.label = caption;
      thumbContainer.setAttribute("role", "listitem");
    }
    const target = thumbContainer instanceof HTMLElement ? thumbContainer : img;
    target.tabIndex = 0;
    target.setAttribute(
      "aria-label",
      caption
        ? t("gallery.open", { number: index + 1, label: caption }, `Open view ${index + 1}: ${caption}`)
        : t("gallery.openPlain", { number: index + 1 }, `Open view ${index + 1}`)
    );
    target.addEventListener("click", (event) => {
      event.preventDefault();
      openModalGalleryAtIndex(index);
    });
    target.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openModalGalleryAtIndex(index);
      }
    });
    img.draggable = false;

    const filmItem = el("button", "galleryFilmstripItem", {
      type: "button",
      "aria-label": caption || t("gallery.view", { number: index + 1 }, `View ${index + 1}`),
    });
    const filmImg = el("img", "", { alt: "", loading: "lazy", draggable: "false" });
    filmImg.src = img.src;
    filmItem.appendChild(filmImg);
    filmItem.addEventListener("click", (event) => {
      event.stopPropagation();
      showGalleryImageAtIndex(index);
    });
    filmstripItems[index] = filmItem;
    modalFilmstrip.appendChild(filmItem);

    useGenericImageOnError(img, index, (src) => {
      galleryImages[index].src = src;
      filmImg.src = src;
    });
    markThumbnailLoaded(img, thumbContainer);
  };

  for (let i = 0; imageElementsChildren.length - i >= 0; i++) {
    if (
      imageElementsChildren[i] !== undefined &&
      imageElementsChildren[i].innerHTML !== undefined
    ) {
      var imgList = imageElementsChildren[i].getElementsByTagName("a");
      for (let j = 0; j < imgList.length; j++) {
        imgList[j].setAttribute("href", "#");
        imgList[j].setAttribute("src", imgList[j].firstChild.src);
        imgList[j].setAttribute("class", "image-list-item");
        imgList[j].tabIndex = -1; // the card is the control
      }
      imgList = imageElementsChildren[i].getElementsByTagName("img");
      if (imgList.length == 1) {
        imgList[0].style.maxWidth = "fit-content";
        imgList[0].style.maxHeight = "180px";
      }
      for (let j = 0; j < imgList.length; j++) {
        const thumbContainer =
          imgList[j].closest(".field__item") || imageElementsChildren[i];
        addThumbnail(imgList[j], thumbContainer);
      }
      if (imageElementsChildren[i] instanceof HTMLElement) {
        imageElementsChildren[i].style.display = "block";
      }
      imageList.appendChild(imageElementsChildren[i]);
    }
  }
  if (
    imageList &&
    imageList.childNodes.length > 0 &&
    getGalleryHost(Viewer, mainElement)
  ) {
    const galleryHost = galleryAnchor(getGalleryHost(Viewer, mainElement));
    galleryHost.insertAdjacentElement("beforebegin", modalGallery);
    galleryHost.insertAdjacentElement("beforebegin", wrapWithScrollHints(Viewer, imageList));
  }
}

// Bumped on every gallery (re)build so a stale probeImageExists()
// resolution from an earlier, since-superseded model switch can't overwrite
// the gallery for whichever model is actually selected now (a fast switch
// could otherwise let an older, slower-to-resolve probe win the race and
// leave mismatched thumbnails on screen).
let galleryBuildGeneration = 0;

// getPerModelGalleryImages() only knows how to guess paths for the built-in
// viewer/examples/gallery/<filename>/... fixtures - a model just converted by
// the standalone worker (worker/server.py) lives at whatever /files/<job id>/
// views/... URLs its status response actually returned, so that convention
// can't find it. This renders a gallery directly from an explicit URL list
// instead of guessing one, reusing the same thumbnail/lightbox DOM as the
// buildFake fallback below. A model without images (none rendered yet) gets
// the generic placeholders, so the previous model's gallery never lingers.
export function renderModelGalleryImages(Viewer, imageUrls = []) {
  // Supersedes a buildThumbnailGallery() probe still in flight.
  galleryBuildGeneration++;
  const gallery = getGalleryConfig();
  const mainElement = gallery.container ? document.getElementById(gallery.container) : null;
  let images = (Array.isArray(imageUrls) ? imageUrls : [])
    .map((src, index) => ({ src: normalizeGalleryUrl(src), alt: `Preview ${index + 1}`, label: labelFromRenderUrl(src) }))
    .filter((img) => img.src);
  if (images.length === 0) images = createDefaultTestImages();
  const elements = createFakeGalleryElements(images);
  handleImages(Viewer, mainElement, elements, elements);
}

// A thumbnail label: a string or a IIIF language map, in the viewer's
// language, else English, else any.
function thumbnailLabel(label, fallback) {
  if (typeof label === "string") return label.trim() || fallback;
  if (!label || typeof label !== "object") return fallback;
  const texts = label[core.currentLanguage] || label.en || label.none || Object.values(label)[0];
  const text = Array.isArray(texts) ? texts.join(" ") : String(texts || "");
  return text.trim() || fallback;
}

// A manifest's thumbnail URL: relative ones ("./examples/...") against the
// page, like the manifest's model URLs. The builds only ship the WebP copies
// of the examples' gallery PNGs (GALLERY_IMAGE_EXT).
function resolveManifestThumbnailUrl(src) {
  let url = src.trim();
  try {
    url = new URL(url, document.baseURI).href;
  } catch {
    return "";
  }
  if (GALLERY_IMAGE_EXT === "webp") {
    url = url.replace(/(\/examples\/gallery\/[^?#]*)\.png(?=$|[?#])/, "$1.webp");
  }
  return normalizeGalleryUrl(url);
}

// AIM3DViewer.thumbnails of the manifest just loaded (any number of URLs or
// { src, label }), or the generic placeholders when it has none - never the
// gallery of the model or manifest shown before.
export function renderManifestGalleryImages(Viewer, thumbnails) {
  galleryBuildGeneration++;
  const gallery = getGalleryConfig();
  const mainElement = gallery.container ? document.getElementById(gallery.container) : null;
  let images = (Array.isArray(thumbnails) ? thumbnails : [])
    .map((entry, index) => {
      const src = typeof entry === "string" ? entry : entry?.src;
      if (typeof src !== "string" || !src.trim()) return null;
      const fallbackAlt = `Preview ${index + 1}`;
      const label = typeof entry === "string" ? "" : thumbnailLabel(entry.label, "");
      return {
        src: resolveManifestThumbnailUrl(src),
        alt: label || fallbackAlt,
        label: label || labelFromRenderUrl(src),
      };
    })
    .filter((img) => img?.src);
  if (images.length === 0) images = createDefaultTestImages();
  const elements = createFakeGalleryElements(images);
  handleImages(Viewer, mainElement, elements, elements);
}

// The thumbnails of the manifest on screen (Viewer.currentManifest, cleared
// when a model is loaded without one): an array, empty when it has none;
// null without a manifest.
export function getManifestThumbnails(Viewer) {
  const manifest = Viewer?.currentManifest?.json;
  if (!manifest) return null;
  const thumbnails = manifest.AIM3DViewer?.thumbnails;
  return Array.isArray(thumbnails) ? thumbnails : [];
}

export function buildThumbnailGallery(Viewer) {
  const gallery = getGalleryConfig();
  // A manifest's own renders, whichever gallery source is configured; one
  // without them gets the generic images in the local-testing gallery, the
  // page's own images (Drupal fields) otherwise.
  const manifestThumbnails = getManifestThumbnails(Viewer);
  if (manifestThumbnails && (manifestThumbnails.length > 0 || gallery.buildFake === true)) {
    renderManifestGalleryImages(Viewer, manifestThumbnails);
    return;
  }
  const buildGeneration = ++galleryBuildGeneration;
  var mainElement = gallery.container
    ? document.getElementById(gallery.container)
    : null;
  var imageElements;
  if (gallery.imageClass !== "") {
    imageElements = document.getElementsByClassName(
      gallery.imageClass
    );
    if (imageElements.length === 0) {
      const fallbackFields = document.querySelectorAll(
        ".field--type-image"
      );
      if (fallbackFields.length > 0) {
        imageElements = fallbackFields;
        console.warn(
          "Gallery imageClass not found, falling back to .field--type-image."
        );
      }
    }
    if (imageElements.length > 0) {
      var galleryLabel = document.getElementsByClassName("field__label");
      if (galleryLabel !== undefined && galleryLabel.length > 0) {
        galleryLabel[0].innerText = "";
      }
    }
  } else if (gallery.imageId !== "") {
    imageElements = document.getElementById(gallery.imageId);
  }

  if (imageElements != null) {
    if (imageElements.length > 0) {
      if (imageElements[0].innerHTML !== undefined) {
        let imagesList = Array.from(
          imageElements[0].getElementsByClassName("field__items")[0]
            .childNodes
        );
        imagesList = prepareGalleryImages(Viewer, imagesList);
        imageElements[0].classList.add("field--label-hidden");
        //imageElements[0].classList.add("field__items");
        handleImages(Viewer, mainElement, imagesList, imagesList);
      } else {
        handleImages(Viewer, mainElement, imageElements);
      }
    } else if (
      imageElements.childNodes !== undefined &&
      imageElements.childNodes.length > 0
    ) {
      if (
        typeof imageElements.childNodes[0].innerHTML == "string" ||
        typeof imageElements.childNodes[1].innerHTML == "string"
      ) {
        let imagesList = Array.from(imageElements.childNodes);
        imagesList = prepareGalleryImages(Viewer, imagesList);
        imageElements.classList.add("field--type-image");
        imageElements.classList.add("field--label-hidden");
        //imageElements.classList.add("field__items");
        handleImages(Viewer, mainElement, imagesList, imageElements);
      } else {
        handleImages(Viewer, mainElement, imageElements);
      }
    }
  }

  if (core.CONFIG?.viewer?.gallery?.buildFake === true) {
    // buildFake is the dedicated opt-in for this fallback, so it doesn't
    // also gate on gallery.build: that flag is forced to false for the
    // test/dev rollup targets (see rollup.config.js) to disable the real
    // Drupal-field-based gallery there, which would otherwise silently
    // disable this fallback too even though it's the one thing meant to
    // work in those environments.
    const renderFake = (images) => {
      const fakeImages = createFakeGalleryElements(images);
      handleImages(Viewer, mainElement, fakeImages, fakeImages);
      console.log("Built fallback thumbnail gallery for local testing");
    };

    const testImages = getConfiguredTestImages();
    const staticFallback = testImages.length > 0 ? testImages : createDefaultTestImages();

    // Prefer thumbnails rendered for the currently loaded example (see
    // core.fileObject, refreshed on every model switch) over the static
    // testImages config, so picking a different example model actually
    // swaps the gallery instead of always showing the same fixed set.
    const perModelImages = getPerModelGalleryImages();
    if (perModelImages.length > 0) {
      probeImageExists(perModelImages[0].src).then((exists) => {
        if (buildGeneration !== galleryBuildGeneration) return;
        renderFake(exists ? perModelImages : staticFallback);
      });
    } else {
      renderFake(staticFallback);
    }
    return;
  }

  console.log("No gallery source found");
}
