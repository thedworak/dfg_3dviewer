import THREE from "./init.js";
import { core, setCore } from "./core.js";
import { toastHelper } from './viewer-utils.js';

const BUILD_ID = (typeof __BUILD_ID__ !== "undefined") ? __BUILD_ID__ : "";

function poweredByHtml() {
  const build = BUILD_ID ? ` (${BUILD_ID})` : "";
  const text = `Powered by three.js r${THREE.REVISION}${build}`;
  return `<span class="credits-item"><a href="https://threejs.org" target="_blank" rel="noopener noreferrer" class="credits-link">${text}</a></span>`;
}

export async function createCreditsElement() {
  const credits = core.CONFIG?.viewer?.credits;

  if (!credits?.visible) {
    return null;
  }

  const creditsDiv = document.createElement("div");
  creditsDiv.id = "credits";
  // #credits has no default left/bottom in CSS (only position: absolute) -
  // updateSize() is what sets those, and it doesn't run correctly until
  // layout is settled (typically once a model has loaded). Staying hidden
  // until then avoids a visible flash at the wrong spot followed by a jump
  // to the right one; updateSize() reveals it once it applies real coords.
  creditsDiv.style.visibility = "hidden";

  // Single line, spanning the full viewer width (see viewer/css/credits.css)
  // now that this renders below the viewer instead of overlaying it: logo +
  // item values separated by a middot, rather than stacked labeled
  // sections. Item labels (e.g. "CREATED BY") are dropped on purpose -
  // there's no room for them next to the separators on one line.
  let html = "";

  if (credits.logo?.src) {
    const logoImg = `<img src="${credits.logo.src}" class="credits-main-logo" alt="Logo">`;
    html += credits.logo.url
      ? `<a href="${credits.logo.url}" target="_blank" rel="noopener noreferrer" class="credits-main-logo-link">${logoImg}</a>`
      : logoImg;
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
      return `<span class="credits-item">${logoHtml}${textHtml}</span>`;
    })
    .concat(poweredByHtml())
    .join(`<span class="credits-sep" aria-hidden="true">&middot;</span>`);

  html += `<span class="credits-items">${itemsHtml}</span>`;

  creditsDiv.innerHTML = html;

  return creditsDiv;
}

export async function loadDroppedModel (file) {
  const extension = file.name.split('.').pop().toLowerCase();

  clearCurrentModel();

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

function clearCurrentModel () {
  if (!core.mainObject || core.mainObject.length === 0) {
    return;
  }

  core.mainObject.forEach(obj => {
    core.scene.remove(obj);
  });

  core.mainObject = [];
};