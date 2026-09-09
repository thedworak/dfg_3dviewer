import { core } from "../core.js";
import { isValidUrl } from "../utils.js";

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

function removeExistingGalleryDom() {
  document.getElementById("image-list")?.remove();
  document.getElementById("modalGallery")?.remove();
}

function createPlaceholderSvgDataUrl(index, label = "") {
  const palette = [
    ["#1f3c88", "#6da3ff"],
    ["#0f766e", "#6ee7b7"],
    ["#9a3412", "#fdba74"],
    ["#5b21b6", "#c4b5fd"],
  ];
  const [start, end] = palette[index % palette.length];
  const title = label || `Preview ${index + 1}`;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${start}"/>
          <stop offset="100%" stop-color="${end}"/>
        </linearGradient>
      </defs>
      <rect width="480" height="320" fill="url(#g)"/>
      <circle cx="92" cy="86" r="34" fill="rgba(255,255,255,0.25)"/>
      <path d="M48 248l94-98 72 66 66-86 152 118H48z" fill="rgba(255,255,255,0.22)"/>
      <text x="240" y="164" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="#ffffff">${title}</text>
    </svg>
  `.trim();
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function getConfiguredTestImages() {
  const gallery = getGalleryConfig();
  const configuredImages = Array.isArray(gallery.testImages) ? gallery.testImages : [];
  const normalizedImages = configuredImages.map((entry, index) => {
    if (typeof entry === "string") {
      const src = normalizeGalleryUrl(entry);
      return src ? { src, alt: `Preview ${index + 1}` } : null;
    }
    if (entry && typeof entry === "object") {
      const src = normalizeGalleryUrl(entry.src || entry.url || "");
      if (!src) return null;
      return {
        src,
        alt: String(entry.alt || entry.label || `Preview ${index + 1}`),
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
  return Array.from({ length: 9 }, (_unused, index) => ({
    src: createPlaceholderSvgDataUrl(index, `Preview ${index + 1}`),
    alt: `Preview ${index + 1}`,
  }));
}

const GALLERY_RENDER_ANGLES = ["0", "45", "90", "135", "180", "225", "270", "315"];

// scripts/render.py writes a 9-shot turntable per source file into
// viewer/examples/gallery/<filename>/<basename>_side<angle>.png (+ _top.png),
// named after that same file's own filename/basename - see core.fileObject,
// set from the currently loaded model's path in main.js. Deriving the path
// this way means a freshly rendered example picks up its own thumbnails
// automatically, with no config file to keep in sync per model.
function getPerModelGalleryImages() {
  const filename = core.fileObject?.filename;
  const basename = core.fileObject?.basename;
  if (!filename || !basename) return [];

  const images = GALLERY_RENDER_ANGLES.map((angle) => ({
    src: normalizeGalleryUrl(`examples/gallery/${filename}/${basename}_side${angle}.png`),
    alt: `${basename} - ${angle}°`,
  }));
  images.push({
    src: normalizeGalleryUrl(`examples/gallery/${filename}/${basename}_top.png`),
    alt: `${basename} - top`,
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

function createFakeGalleryElements(testImages) {
  return testImages.map((entry) => {
    const wrapper = document.createElement("div");
    wrapper.className = "field__item";
    wrapper.innerHTML =
      `<img loading="lazy" src="${entry.src}" width="200px" height="200px" alt="${entry.alt}" class="img-fluid image-style-wisski-preview">`;
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

function handleImages(Viewer, mainElement, imageElements, imageElementsChildren) {
  if (imageElementsChildren === undefined) {
    imageElementsChildren = imageElements;
  }
  removeExistingGalleryDom();
  var imageList = document.createElement("div");
  imageList.setAttribute("id", "image-list");
  imageList.style.display = "flex";
  imageList.style.flexWrap = "wrap";
  imageList.style.gap = "16px";
  imageList.style.alignItems = "center";
  var modalGallery = document.createElement("div");
  var modalImageWrap = document.createElement("div");
  var modalImage = document.createElement("img");
  var modalPrev = document.createElement("button");
  var modalNext = document.createElement("button");
  var modalCounter = document.createElement("span");
  const galleryImageSources = [];
  const galleryThumbEls = [];
  let currentGalleryIndex = -1;
  modalImageWrap.setAttribute("class", "modalImageWrap");
  modalCounter.setAttribute("class", "galleryCounter");
  modalImage.setAttribute("class", "modalImage");
  // Start from whatever zoom the user last left the gallery at (Viewer.zoomImage
  // persists on the Viewer instance across images and across open/close), so a
  // fresh build still reflects the remembered zoom instead of always resetting.
  modalImage.style.transform = `scale(${Viewer.zoomImage})`;
  Viewer.bindEventListener(modalGallery, "wheel", function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.deltaY > 0 && Viewer.zoomImage > 0.15) {
      modalImage.style.transform = `scale(${(Viewer.zoomImage -= Viewer.ZOOM_SPEED_IMAGE)})`;
    } else if (e.deltaY < 0 && Viewer.zoomImage < 5) {
      modalImage.style.transform = `scale(${(Viewer.zoomImage += Viewer.ZOOM_SPEED_IMAGE)})`;
    }
    return false;
  });
  var modalClose = document.createElement("span");
  modalGallery.setAttribute("id", "modalGallery");
  modalGallery.setAttribute("class", "modalGallery");
  modalClose.setAttribute("class", "closeGallery");
  modalClose.setAttribute("title", "Close");
  modalClose.innerHTML = "&times";
  modalPrev.setAttribute("type", "button");
  modalPrev.setAttribute("class", "galleryNav galleryNavPrev");
  modalPrev.setAttribute("title", "Previous image");
  modalPrev.setAttribute("aria-label", "Previous image");
  modalPrev.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 5.3a1 1 0 0 1 0 1.4L9.41 12l5.3 5.3a1 1 0 1 1-1.42 1.4l-6-6a1 1 0 0 1 0-1.4l6-6a1 1 0 0 1 1.41 0Z"/></svg>';
  modalNext.setAttribute("type", "button");
  modalNext.setAttribute("class", "galleryNav galleryNavNext");
  modalNext.setAttribute("title", "Next image");
  modalNext.setAttribute("aria-label", "Next image");
  modalNext.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.3 18.7a1 1 0 0 1 0-1.4l5.29-5.3-5.3-5.3a1 1 0 1 1 1.42-1.4l6 6a1 1 0 0 1 0 1.4l-6 6a1 1 0 0 1-1.41 0Z"/></svg>';

  const showGalleryImageAtIndex = function (index) {
    if (galleryImageSources.length === 0) {
      return;
    }
    const normalizedIndex =
      (index + galleryImageSources.length) % galleryImageSources.length;
    if (galleryThumbEls[currentGalleryIndex]) {
      galleryThumbEls[currentGalleryIndex].classList.remove("is-active-thumb");
    }
    currentGalleryIndex = normalizedIndex;
    modalImage.src = galleryImageSources[normalizedIndex];
    modalCounter.textContent = `${normalizedIndex + 1} / ${galleryImageSources.length}`;
    if (galleryThumbEls[normalizedIndex]) {
      galleryThumbEls[normalizedIndex].classList.add("is-active-thumb");
    }
  };

  const openModalGalleryAtIndex = function (index) {
    showGalleryImageAtIndex(index);
    modalGallery.classList.add("is-open");
    imageList.style.zIndex = 0;
    imageList.style.display = "hidden";
  };

  const closeModalGallery = function () {
    modalGallery.classList.remove("is-open");
    if (galleryThumbEls[currentGalleryIndex]) {
      galleryThumbEls[currentGalleryIndex].classList.remove("is-active-thumb");
    }
    // Intentionally leave Viewer.zoomImage / modalImage's transform as-is so the
    // zoom level the user scrolled to carries over to the next image and the
    // next time the gallery is opened, instead of snapping back to a default.
  };

  modalClose.onclick = function () {
    closeModalGallery();
  };

  modalPrev.onclick = function (event) {
    event.preventDefault();
    event.stopPropagation();
    showGalleryImageAtIndex(currentGalleryIndex - 1);
  };

  modalNext.onclick = function (event) {
    event.preventDefault();
    event.stopPropagation();
    showGalleryImageAtIndex(currentGalleryIndex + 1);
  };

  Viewer.bindEventListener(modalGallery, "click", function (event) {
    if (event.target === modalGallery) {
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
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showGalleryImageAtIndex(currentGalleryIndex - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      showGalleryImageAtIndex(currentGalleryIndex + 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeModalGallery();
    }
  });

  modalImageWrap.appendChild(modalImage);
  modalGallery.appendChild(modalPrev);
  modalGallery.appendChild(modalImageWrap);
  modalGallery.appendChild(modalNext);
  modalGallery.appendChild(modalCounter);
  modalGallery.appendChild(modalClose);
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
      }
      imgList = imageElementsChildren[i].getElementsByTagName("img");
      if (imgList.length == 1) {
        imgList[0].style.maxWidth = "fit-content";
        imgList[0].style.maxHeight = "180px";
      }
      for (let j = 0; j < imgList.length; j++) {
        const nextIndex = galleryImageSources.push(imgList[j].src) - 1;
        const thumbContainer =
          imgList[j].closest(".field__item") || imageElementsChildren[i];
        galleryThumbEls[nextIndex] = thumbContainer;
        imgList[j].onclick = function () {
          openModalGalleryAtIndex(nextIndex);
        };
        markThumbnailLoaded(imgList[j], thumbContainer);
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
    const galleryHost = getGalleryHost(Viewer, mainElement);
    galleryHost.insertAdjacentElement("beforebegin", modalGallery);
    galleryHost.insertAdjacentElement("beforebegin", imageList);
  }
}

// Bumped on every buildThumbnailGallery() call so a stale probeImageExists()
// resolution from an earlier, since-superseded model switch can't overwrite
// the gallery for whichever model is actually selected now (a fast switch
// could otherwise let an older, slower-to-resolve probe win the race and
// leave mismatched thumbnails on screen).
let galleryBuildGeneration = 0;

export function buildThumbnailGallery(Viewer) {
  const buildGeneration = ++galleryBuildGeneration;
  const gallery = getGalleryConfig();
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
