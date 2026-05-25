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
  return Array.from({ length: 4 }, (_unused, index) => ({
    src: createPlaceholderSvgDataUrl(index, `Preview ${index + 1}`),
    alt: `Preview ${index + 1}`,
  }));
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

function handleImages(Viewer, mainElement, imageElements, imageElementsChildren) {
  if (imageElementsChildren === undefined) {
    imageElementsChildren = imageElements;
  }
  removeExistingGalleryDom();
  var imageList = document.createElement("div");
  imageList.setAttribute("id", "image-list");
  var modalGallery = document.createElement("div");
  var modalImage = document.createElement("img");
  modalImage.setAttribute("class", "modalImage");
  modalImage.style.transform = "scale(0.95)";
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
  modalClose.onclick = function () {
    modalGallery.style.display = "none";
  };

  Viewer.bindEventListener(document, "click", function (event) {
    if (
      !modalGallery.contains(event.target) &&
      !imageList.contains(event.target)
    ) {
      modalGallery.style.display = "none";
      Viewer.zoomImage = 1.5;
      modalImage.style.transform = "scale(1.5)";
    }
  });

  modalGallery.appendChild(modalImage);
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
        imgList[j].onclick = function () {
          modalGallery.style.display = "block";
          imageList.style.zIndex = 0;
          imageList.style.display = "hidden";
          modalImage.src = this.src;
        };
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

export function buildThumbnailGallery(Viewer) {
  const gallery = getGalleryConfig();
  var mainElement = gallery.container
    ? document.getElementById(gallery.container)
    : null;
  var imageElements;
  if (gallery.imageClass !== "") {
    imageElements = document.getElementsByClassName(
      gallery.imageClass
    );
    if (imageElements.length > 0) {
      var galleryLabel = document.getElementsByClassName("field__label");
      if (galleryLabel !== undefined) galleryLabel[0].innerText = "";
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
        imageElements[0].classList.add("field__items");
        handleImages(Viewer, mainElement, imagesList, imageElements);
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
        imageElements.classList.add("field__items");
        handleImages(Viewer, mainElement, imagesList, imageElements);
      } else {
        handleImages(Viewer, mainElement, imageElements);
      }
    }
  }

  const testImages = getConfiguredTestImages();
  const fallbackImages = testImages.length > 0 ? testImages : createDefaultTestImages();
  if (gallery.build === true) {
    const fakeImages = createFakeGalleryElements(fallbackImages);
    handleImages(Viewer, mainElement, fakeImages, fakeImages);
    console.log("Built fallback thumbnail gallery for local testing");
    return;
  }

  console.log("No gallery source found");
}
