import THREE from "./init.js";
import { core, setCore } from "./core.js";
import { toastHelper } from './viewer-utils.js';
import { t } from './i18n-utils.js';

const BUILD_ID = (typeof __BUILD_ID__ !== "undefined") ? __BUILD_ID__ : "";
const BUILD_TIME = (typeof __BUILD_TIME__ !== "undefined") ? __BUILD_TIME__ : "";

// "2026-10-02 10:45" in the viewer's local time, or "" without a valid time.
function formatBuildTime(iso) {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return "";
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// The viewer reads and writes IIIF Presentation manifests.
function iiifCreditHtml() {
  const src = `${core.DFG_ASSETS || "assets"}/img/logo/iiif.png`;
  return `<span class="credits-item"><a href="https://iiif.io" target="_blank" rel="noopener noreferrer" class="credits-link credits-iiif" title="IIIF - International Image Interoperability Framework"><img class="credits-logo" src="${src}" alt="IIIF" width="16" height="14">IIIF</a></span>`;
}

function poweredByHtml() {
  const parts = [BUILD_ID, formatBuildTime(BUILD_TIME)].filter(Boolean);
  const build = parts.length ? ` (${parts.join(", ")})` : "";
  // The renderer, when it is not the default one (renderer-backend.js).
  const backend = core.rendererBackend !== "webgpu" ? ""
    : core.rendererDevice === "webgl2" ? " · WebGPU renderer (WebGL 2)" : " · WebGPU";
  const text = `Powered by three.js r${THREE.REVISION}${backend}${build}`;
  const title = BUILD_TIME ? ` title="Build ${BUILD_ID || ""} ${BUILD_TIME}"` : "";
  return `<span class="credits-item"><a href="https://threejs.org" target="_blank" rel="noopener noreferrer" class="credits-link"${title}>${text}</a></span>`;
}

// The credits window (opened from Help → Credits, main.js toggleCredits):
// the logo, then one line per credit - its own logo, its label ("Created
// by") and text, linked when the settings give a URL - then IIIF and the
// three.js build.
export async function createCreditsElement() {
  const credits = core.CONFIG?.viewer?.credits;

  if (!credits?.visible) {
    return null;
  }

  const creditsDiv = document.createElement("div");
  creditsDiv.id = "credits";
  creditsDiv.hidden = true;
  creditsDiv.setAttribute("role", "dialog");
  creditsDiv.setAttribute("aria-label", t("credits.title", "Credits"));

  let html = `<div class="upload-panel-header credits-header">
      <span>${t("credits.title", "Credits")}</span>
      <button type="button" class="credits-close" aria-label="${t("credits.close", "Close")}">X</button>
    </div>`;

  if (credits.logo?.src) {
    const logoImg = `<img src="${credits.logo.src}" class="credits-main-logo" alt="Logo">`;
    html += credits.logo.url
      ? `<a href="${credits.logo.url}" target="_blank" rel="noopener noreferrer" class="credits-main-logo-link">${logoImg}</a>`
      : `<span class="credits-main-logo-link">${logoImg}</span>`;
  }

  const itemsHtml = (credits.items ?? [])
    .map((item) => {
      const logoHtml = item.logo?.src
        ? (() => {
            const itemLogoImg = `<img class="credits-logo" src="${item.logo.src}" alt="">`;
            return item.logo.url
              ? `<a href="${item.logo.url}" target="_blank" rel="noopener noreferrer">${itemLogoImg}</a>`
              : itemLogoImg;
          })()
        : "";
      const textHtml = item.url
        ? `<a href="${item.url}" target="_blank" rel="noopener noreferrer" class="credits-link">${item.text}</a>`
        : `<span class="credits-text">${item.text}</span>`;
      const labelHtml = item.label ? `<span class="credits-label">${item.label}</span>` : "";
      return `<span class="credits-item">${logoHtml}<span class="credits-entry">${labelHtml}${textHtml}</span></span>`;
    })
    .concat(iiifCreditHtml(), poweredByHtml())
    .join("");

  html += `<div class="credits-items">${itemsHtml}</div>`;

  creditsDiv.innerHTML = html;

  // A logo that does not load leaves no broken image (nor its link's room).
  creditsDiv.querySelectorAll("img").forEach((img) => {
    img.addEventListener("error", () => {
      const link = img.parentElement?.tagName === "A" && img.parentElement.children.length === 1 ? img.parentElement : null;
      (link || img).hidden = true;
      if (img.classList.contains("credits-main-logo")) img.closest(".credits-main-logo-link")?.setAttribute("hidden", "");
    }, { once: true });
  });

  return creditsDiv;
}

export async function loadDroppedModel (file) {
  const extension = file.name.split('.').pop().toLowerCase();

  // As before a model opened from a URL (models panel): the previous one
  // goes with its selection, tools and helpers, or the editing tools and
  // "Save settings" would still act on it.
  Viewer.resetLoadedModelState();

  const url = URL.createObjectURL(file);

  core.fileObject.originalPath = url;
  core.fileObject.filename = url;
  core.fileObject.basename = file.name.substring(0, file.name.lastIndexOf('.'));
  core.fileObject.extension = extension;
  core.fileObject.path = '';
  core.fileObject.uri = url;
  core.fileObject.relativePath = url;

  Viewer._ext = extension;

  setCore('fileObject', core.fileObject);

  core.autoPath = '';

  await Viewer.mainLoadModel();

  if (core.SANDBOX_MODE) {
    Viewer.showSandboxGuiAfterModelLoad();
    Viewer.dismissStatusNotice("sandbox-drop-model");
  }

  toastHelper("modelLoadedSimple", "success");
};
